# User-Reported Errors (1-5-26)

This doc summarizes likely causes/blockers based on a code review of the current repo (no runtime reproduction yet).

## 1) “New Opportunity” popup errors + wrong defaults

**User report (normalized)**
- “New Opportunity” popup throws an error / won’t allow completion unless typing over Subagent and House %.
- Defaults should be: Subagent = “None”, Opportunity Owner = related Account Owner, House Split % = 100.00%, House Rep % = 0.00%, Subagent % = 0.00%.

**Most likely cause(s)**
- In `components/account-opportunity-create-modal.tsx`, the create form initializes `houseRepPercent` and `subagentPercent` as empty strings and the submit gating requires them to be non-empty:
  - `canSubmit` currently requires `form.houseRepPercent` and `form.subagentPercent` to be truthy, so the modal effectively forces the user to type values even when “0.00” is intended.
  - House Split % is computed from the two percentages, but the percentage inputs render as blank when the underlying strings are blank.
- Owner default is set to the *first* active user returned by `/api/admin/users?status=Active`, not the Account’s owner:
  - The modal already calls `/api/accounts/{accountId}` (to fetch legal name) but does not use `ownerId` from that payload.
  - `/api/accounts/[accountId]` does expose `ownerId` and `accountOwner`.
- Minor bug: selecting a subagent in the Account Opportunity modal sets `subagentContactId` to `null` instead of the selected contact id (`components/account-opportunity-create-modal.tsx` dropdown click handler). This won’t affect persistence today (backend doesn’t store `subagentContactId`), but it’s still inconsistent and could break future work.

**Suggested fixes / unblockers**
- In `components/account-opportunity-create-modal.tsx`:
  - Initialize `houseRepPercent` and `subagentPercent` to `"0.00"` (matching the generic `components/opportunity-create-modal.tsx` behavior).
  - Alternatively (or additionally), adjust `canSubmit` to treat empty percent fields as `"0.00"` rather than blocking submit.
  - When opening the modal, fetch `/api/accounts/{accountId}` and prefer `ownerId` from the Account as the default Opportunity Owner (fall back to first active user only if missing).
  - (Optional UX) Add an explicit “None” selection for Subagent rather than requiring freeform typing to clear.

**Notes**
- The API route `app/api/opportunities/route.ts` does **not** require a subagent; the “can’t submit” behavior is almost certainly client-side gating/validation.

## 2) “Create New Product” can’t be saved / doesn’t show up on Opportunity “Products” tab

**User report (normalized)**
- “Create New Product” form seems complete, but can’t save (especially when vendor/distributor details aren’t known).
- Even when it “saves”, it doesn’t return to the Opportunity Products tab and nothing appears saved.
- Desired behavior: allow minimal entry now; later “match deposit” should fill distributor product name/part number/etc.

**What the code is doing today (two different flows exist)**
1) **Opportunity Products tab flow**: `components/opportunity-line-item-create-modal.tsx`
   - “Create New Product” does two steps:
     1) POST `/api/products` to create a catalog product (with some fields auto-derived if blank).
     2) POST `/api/opportunities/[opportunityId]/line-items` to attach it as a line item.
   - If step (2) fails, it *rolls back* by DELETE-ing the product it just created. Result: “nothing saved”.
2) **Catalog Products page flow**: `components/product-create-modal.tsx`
   - Submit is blocked unless `productNameHouse`, `productCode` (vendor part number), and `revenueType` are present (`canSubmit`).
   - This will feel like “can’t save” if the business expectation is “part number unknown is OK”.

**Most likely blocker causing “nothing saved” from the Opportunity modal**
- The line item attach endpoint enforces **one Distributor/Vendor pair per Opportunity**:
  - See `lib/opportunities/vendor-distributor.ts` and its usage in `app/api/opportunities/[opportunityId]/line-items/route.ts` (and the preflight route `.../validate-vendor-distributor/route.ts`).
  - If the Opportunity already has a canonical vendor/distributor from an existing line item, then creating/attaching a new product with a different (or blank) vendor/distributor will fail with “Cannot have more than one Distributor/Vendor on the same Opportunity.”
  - Because the UI rolls back catalog product creation on attach failure, the user ends up with no product in the catalog and no line item.

**Suggested fixes / unblockers**
- For the Opportunity “Create New Product” modal (`components/opportunity-line-item-create-modal.tsx`):
  - If the Opportunity already has a canonical vendor/distributor pair, prefill those values in the modal (and/or hide them) so the user can’t accidentally mismatch.
  - Improve the error shown when the single vendor/distributor invariant is violated (explain what pair is currently “locked” on the Opportunity and how to proceed).
  - Consider removing rollback-on-failure, or replacing it with an atomic backend endpoint (create product + attach line item in a single transaction) so the UX is deterministic.
- For the catalog Product create modal (`components/product-create-modal.tsx`):
  - If “part number unknown” is a valid workflow, relax the requirement on `productCode` (or auto-generate a temporary code similar to the Opportunity modal).

## 3) “Create new Contact” popup not inheriting Account Type

**User report (normalized)**
- Create Contact popup doesn’t inherit “Account Type” (shown as “Contact Type” in the modal) from the related Account.

**Most likely cause(s)**
- `components/contact-create-modal.tsx` displays “Contact Type” as `selectedAccount?.accountTypeName` (read-only) based on the `options.accounts` list.
- `/api/contacts/options` only includes **Active** accounts (`app/api/contacts/options/route.ts`).
  - If the related Account is not Active (or not present in that options list for any reason), `selectedAccount` will be undefined and the contact type field will appear blank.
  - Submit will also fail because `selectedAccount?.accountTypeId` is required.

**Suggested fixes / unblockers**
- In `/api/contacts/options`:
  - Include the current `defaultAccountId` (even if not Active) when the modal is opened from an Account detail page; or
  - Remove the `status: "Active"` filter entirely if there’s no strong reason to block contact creation for inactive accounts.
- In `components/contact-create-modal.tsx`:
  - When `defaultAccountId` is provided, fetch `/api/accounts/{id}` and use that to render “Contact Type” even before options load / even if the account isn’t in `options.accounts`.

## 4) Can we remove Vendor/Distributor fields from “New Product” and rely on deposit matching?

**Key constraint in current implementation**
- The Opportunity line item attach path enforces “single Distributor/Vendor per Opportunity” (`assertVendorDistributorConsistentForOpportunity`).
- If vendor/distributor is left blank for new products while the Opportunity already has a canonical pair, attaches will fail.

**Design doc**
- See `docs/notes/2026-01-05-new-product-popup-without-vendor-distributor.md` for a full “current vs proposed workflows” breakdown and phased implementation plan.

**Possible approaches (product/engineering decision)**
- **Keep the invariant** and make the UI smarter:
  - Prefill/lock vendor/distributor to the Opportunity’s canonical pair; allow “unknown” only when the Opportunity has no canonical pair yet.
- **Relax the invariant** (requires careful thought):
  - Treat `null/null` vendor/distributor as a wildcard during Opportunity creation, and “lock in” the canonical pair later when matching occurs.
  - This likely requires additional rules about how/when existing line items are updated so future attaches don’t start failing unexpectedly.

## Quick follow-ups (to confirm in prod/dev)
- When the Opportunity “Create New Product” fails, capture the toast + network response body for:
  - `/api/opportunities/[opportunityId]/line-items/validate-vendor-distributor`
  - `/api/opportunities/[opportunityId]/line-items`
- Confirm whether the affected Account is Active when “Contact Type” is blank in the Contact modal.
