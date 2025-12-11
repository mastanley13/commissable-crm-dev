# Opportunity Vendor/Distributor Consistency Enforcement Guide 🧩

This document explains how the current application behavior enforces the business rule:

> **"Cannot have more than one Distributor/Vendor on the same Opportunity."**

and how that behavior matches the original spec/request.

---

## Business Requirement (Spec)

**Problem:** Users must not be able to add products from different Distributors/Vendors to a single Opportunity, because each Distributor/Vendor pays separately and at different times. Mixing vendors on one Opportunity causes reconciliation and reporting issues.

**Desired behavior:**

- Each Opportunity can only contain products from **one** Distributor/Vendor combination.
- When a user adds or edits an Opportunity Product (line item), the system should:
  - Look up the Distributor/Vendor for the incoming product.
  - Compare it to the Distributor/Vendor used by any existing products on the same Opportunity.
  - If they do **not** match, block the save and show:

    > `Cannot have more than one Distributor/Vendor on the same Opportunity.`

The original suggestion was to do this via an Apex trigger on `OpportunityLineItem`; in this app, the same logic is implemented in Node/TypeScript using Prisma and HTTP APIs instead of Apex.

---

## Implementation Overview

The rule is enforced in a shared helper and applied in both line‑item **create** and **update** flows:

- Core consistency helper:
  - `lib/opportunities/vendor-distributor.ts`
- Line item creation (add product to Opportunity):
  - `app/api/opportunities/[opportunityId]/line-items/route.ts` (`POST`)
- Line item update (change product on an existing line item):
  - `app/api/opportunities/line-items/[lineItemId]/route.ts` (`PATCH`)
- UI modals that surface the API error back to the user:
  - `components/opportunity-line-item-create-modal.tsx`
  - `components/opportunity-line-item-edit-modal.tsx`

Together, these pieces implement the single‑Vendor/Distributor‑per‑Opportunity requirement described in the spec.

---

## Core Logic: `assertVendorDistributorConsistentForOpportunity`

**File:** `lib/opportunities/vendor-distributor.ts`

Key pieces:

- **Data shape**

  ```ts
  export type VendorDistributorPair = {
    distributorAccountId: string | null
    vendorAccountId: string | null
  }
  ```

- **Canonical pair lookup**

  ```ts
  async function getCanonicalPairForOpportunity(db, tenantId, opportunityId) {
    const lineItems = await db.opportunityProduct.findMany({
      where: { tenantId, opportunityId },
      select: {
        product: { select: { distributorAccountId: true, vendorAccountId: true } }
      }
    })

    for (const item of lineItems) {
      const distributorAccountId = item.product?.distributorAccountId ?? null
      const vendorAccountId = item.product?.vendorAccountId ?? null

      if (distributorAccountId || vendorAccountId) {
        return { distributorAccountId, vendorAccountId }
      }
    }

    return null
  }
  ```

  - Scans existing `opportunityProduct` rows for the given Opportunity.
  - Returns the **first** product that has either a Distributor or Vendor set.
  - If *no* such product exists, returns `null` (no canonical pair yet).

- **Enforcement function**

  ```ts
  export async function assertVendorDistributorConsistentForOpportunity(
    db: DbClient,
    tenantId: string,
    opportunityId: string,
    newPair: VendorDistributorPair
  ): Promise<void> {
    const canonical = await getCanonicalPairForOpportunity(db, tenantId, opportunityId)

    if (!canonical) {
      // No existing vendor/distributor context: allow any new pair.
      return
    }

    if (pairsEqual(canonical, newPair)) {
      return
    }

    const error = new Error("Cannot have more than one Distributor/Vendor on the same Opportunity.")
    ;(error as any).code = "OPPORTUNITY_VENDOR_DISTRIBUTOR_MISMATCH"
    throw error
  }
  ```

**How this matches the spec:**

- For an Opportunity that already has at least one product with a Distributor and/or Vendor:
  - That first product defines the canonical `(distributorAccountId, vendorAccountId)` pair.
  - Any subsequent line item must use the **exact same pair**.
  - If the new product’s pair does not match, the function throws with a specific error code and the exact message required by the spec.
- For an Opportunity with no vendor/distributor context yet (no existing products with those fields):
  - The first product is accepted and establishes the canonical pair going forward.

This is conceptually equivalent to a “before insert/before update” validation trigger on Opportunity Line Items, implemented at the API layer instead of directly in the DB or Apex.

---

## Line Item Creation (`POST /api/opportunities/{id}/line-items`)

**File:** `app/api/opportunities/[opportunityId]/line-items/route.ts`

Flow (simplified):

1. Validate request basics (opportunity exists, user has permissions, productId and quantity are valid).
2. Load the `product` using `productId`, including:
   - `product.distributorAccountId`
   - `product.vendorAccountId`
   - Related `distributor` / `vendor` names for snapshots.
3. Compute the “resolved” Distributor:

   ```ts
   let resolvedDistributorAccountId = product.distributorAccountId ?? null
   let resolvedDistributorName = product.distributor?.accountName ?? null

   if (!resolvedDistributorAccountId && product.vendorAccountId) {
     const noneDirect = await ensureNoneDirectDistributorAccount(tenantId)
     resolvedDistributorAccountId = noneDirect.id
     resolvedDistributorName = noneDirect.accountName
   }
   ```

   - If the product has a **Vendor but no Distributor**, it automatically attaches the special `None-Direct` Distributor via `ensureNoneDirectDistributorAccount` (`lib/none-direct-distributor.ts`).
   - This ensures that every product used in an Opportunity yields a consistent `(distributorAccountId, vendorAccountId)` pair, even for “direct” vendor deals.

4. Enforce the single Distributor/Vendor rule:

   ```ts
   const newPair = {
     distributorAccountId: resolvedDistributorAccountId,
     vendorAccountId: product.vendorAccountId ?? null
   }

   await assertVendorDistributorConsistentForOpportunity(
     prisma,
     tenantId,
     existingOpportunity.id,
     newPair
   )
   ```

5. If the helper throws with `code === "OPPORTUNITY_VENDOR_DISTRIBUTOR_MISMATCH"`, the endpoint returns:

   ```ts
   return NextResponse.json(
     { error: "Cannot have more than one Distributor/Vendor on the same Opportunity." },
     { status: 400 }
   )
   ```

6. If validation passes, the API creates the `opportunityProduct` row (line item) and, if requested, generates revenue schedules.

**Spec alignment:**

- The create‑line‑item path directly matches the spec’s “check on new product being added” requirement.
- It blocks the save when the incoming product’s Distributor/Vendor does not match the existing Opportunity context and returns the exact error message specified.

---

## Line Item Update (`PATCH /api/opportunities/line-items/{id}`)

**File:** `app/api/opportunities/line-items/[lineItemId]/route.ts`

Flow (simplified for product changes):

1. Load the target `opportunityProduct` (line item), including its `opportunity` and current `product`.
2. Validate permissions (edit‑any or edit‑assigned based on Opportunity owner).
3. If the payload includes `"productId"`:

   - Load the new `product` (including `distributorAccountId` and `vendorAccountId`).
   - Build a new pair:

     ```ts
     const newPair = {
       distributorAccountId: product.distributorAccountId ?? null,
       vendorAccountId: product.vendorAccountId ?? null
     }

     if (existingLineItem.opportunity) {
       await assertVendorDistributorConsistentForOpportunity(
         prisma,
         tenantId,
         existingLineItem.opportunity.id,
         newPair
       )
     }
     ```

   - If the helper throws, the endpoint maps it to a `400` with the same error text:

     ```ts
     if ((error as any).code === "OPPORTUNITY_VENDOR_DISTRIBUTOR_MISMATCH") {
       return NextResponse.json(
         { error: "Cannot have more than one Distributor/Vendor on the same Opportunity." },
         { status: 400 }
       )
     }
     ```

4. If validation passes, the line item is updated and any dependent calculations (stage recalculation, etc.) run.

**Spec alignment:**

- This covers the “user edits an existing line item and switches it to a different product” scenario.
- The same rule and error message apply: if the new product’s Distributor/Vendor doesn’t match the existing Opportunity context, the update is blocked.

---

## UI Behavior and Error Surfacing

The front‑end modals call the APIs and surface server‑side validation messages directly to users.

### Add Product (Create Modal)

**File:** `components/opportunity-line-item-create-modal.tsx`

- Uses `POST /api/opportunities/${opportunityId}/line-items`.
- On a non‑OK response:

  ```ts
  const res = await fetch(`/api/opportunities/${opportunityId}/line-items`, { ... })
  if (!res.ok) {
    const ep = await res.json().catch(() => null)
    throw new Error(ep?.error ?? "Failed to create line item")
  }
  ...
  } catch (err: any) {
    showError("Unable to create line item", err?.message ?? "Please try again later.")
  }
  ```

- When the backend responds with the Vendor/Distributor message, that text becomes `err.message` and is shown in the toast.

### Edit Product (Edit Modal)

**File:** `components/opportunity-line-item-edit-modal.tsx`

- Uses `PATCH /api/opportunities/line-items/${lineItem.id}`.
- On a non‑OK response:

  ```ts
  const response = await fetch(`/api/opportunities/line-items/${lineItem.id}`, { ... })
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null)
    throw new Error(errorPayload?.error ?? "Failed to update line item")
  }
  ...
  } catch (error) {
    showError(
      "Unable to update line item",
      error instanceof Error ? error.message : "Please try again later."
    )
  }
  ```

- Again, the API’s Vendor/Distributor error message is surfaced directly to the user.

**Result:** Users see a clear, consistent error when they attempt to mix Distributors/Vendors on an Opportunity, aligning with the spec’s requirement for “stop user with an error message.”

---

## Edge Cases and Notes

### 1. First product with no Vendor/Distributor

- If the first product added to an Opportunity has **no** `distributorAccountId` and **no** `vendorAccountId`:
  - `getCanonicalPairForOpportunity` returns `null` (no canonical pair yet).
  - `assertVendorDistributorConsistentForOpportunity` treats this as “no existing context” and **allows** the new pair for the next product.
  - The first product that *does* have Distributor/Vendor set becomes the canonical pair.
- This behavior matches the “Edge case” note from the original spec: the system allows this, but you may choose separately to require Vendor/Distributor at the product level if you want to forbid this scenario entirely.

### 2. Direct‑vendor products (`None-Direct` distributor)

- When a product has a Vendor but no Distributor, the system assigns the special `None-Direct` Distributor account (via `ensureNoneDirectDistributorAccount`).
- The canonical pair for such an Opportunity is effectively:

  - `distributorAccountId = <None-Direct account ID>`
  - `vendorAccountId = <actual vendor account ID>`

- Any later line items must match this exact pair to be accepted.

### 3. Cloning line items

- `app/api/opportunities/[opportunityId]/line-items/clone/route.ts` clones existing `opportunityProduct` rows for the **same** Opportunity.
- Because it only duplicates existing rows that already match the canonical pair, it cannot introduce a new Vendor/Distributor combination and therefore does not need extra checks.

---

## Summary: Spec vs. Implementation

- **Requirement:** One Distributor/Vendor per Opportunity  
  **Implementation:** Enforced by `assertVendorDistributorConsistentForOpportunity` in `lib/opportunities/vendor-distributor.ts`, called during both line‑item create and update flows.

- **Requirement:** Check Distributor/Vendor on product add and compare to existing Opportunity products  
  **Implementation:** Both `POST /api/opportunities/{id}/line-items` and `PATCH /api/opportunities/line-items/{id}` load the product’s Distributor/Vendor and compare the `(distributorAccountId, vendorAccountId)` pair against the Opportunity’s canonical pair.

- **Requirement:** Block save and display: `"Cannot have more than one Distributor/Vendor on the same Opportunity."`  
  **Implementation:** The helper throws with that exact message; both APIs map the error to `400` with `{ error: "<message>" }`, and the UI modals display the server error in toasts.

Net result: the current implementation **meets the original business spec** for preventing multiple Distributors/Vendors on the same Opportunity, with clear user feedback and consistent behavior across creation, editing, and cloning of opportunity line items.

