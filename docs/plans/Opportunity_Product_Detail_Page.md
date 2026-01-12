# Opportunity Product Detail Page (Prep + Spec)

## Goal
Replace the current Opportunity → Products “product name” click behavior so it navigates to an **Opportunity Product detail page** (per-opportunity line item instance), not the Catalog Product page and not a modal.

## URL
Use a route that preserves Opportunity context and avoids collision with catalog routes:

- **Opportunity Product detail**: `/opportunities/[opportunityId]/products/[lineItemId]`
- **Catalog Product detail (existing)**: `/products/[productId]`

## Entity definitions
- **Catalog Product** (`Product`): global product master record.
- **Opportunity Product** (`OpportunityProduct`): per-opportunity line item that references a `Product` but must behave as an **independent instance** for editing/display.
  - Strategy: store **snapshot/override fields** on `OpportunityProduct` matching the Product Detail editable fields.

## Acceptance criteria
1) Clicking product name in Opportunity → Products navigates to `/opportunities/[opportunityId]/products/[lineItemId]`.
2) Opportunity Product detail page UI matches the Product Detail page field set (plus opportunity-only line item fields if desired).
3) Edits on the Opportunity Product page **never modify** the catalog `Product`.
4) The page provides an explicit link to open the catalog product (optional).
5) Audit History tab shows changes for `OpportunityProduct` (not `Product`).

## Data contract (frontend)
Create a detail type that mirrors Product Detail fields, but is line-item backed:

```ts
type OpportunityProductDetailRecord = {
  id: string // OpportunityProduct.id (line item id)
  opportunity: { id: string; name: string }
  catalogProductId: string // OpportunityProduct.productId

  // Mirrored Product Detail fields (editable)
  productCode: string
  productNameHouse: string
  productNameVendor: string | null
  description: string | null
  revenueType: string
  commissionPercent: number | null
  priceEach: number | null
  isActive: boolean
  distributor: { id: string; accountName: string; accountNumber: string | null } | null
  vendor: { id: string; accountName: string; accountNumber: string | null } | null
  createdAt: string
  updatedAt: string
  productFamilyHouse?: string | null
  productSubtypeHouse?: string | null
  productFamilyVendor?: string | null
  productSubtypeVendor?: string | null
  productNameDistributor?: string | null
  distributorProductFamily?: string | null
  distributorProductSubtype?: string | null
  partNumberVendor?: string | null
  partNumberDistributor?: string | null
  productDescriptionDistributor?: string | null
  productDescriptionVendor?: string | null
  productDescriptionHouse?: string | null

  // Opportunity-only line item fields (already exist today)
  quantity?: number | null
  unitPrice?: number | null
  expectedUsage?: number | null
  expectedRevenue?: number | null
  expectedCommission?: number | null
  revenueStartDate?: string | null
  revenueEndDate?: string | null
  status?: string | null
}
```

## API endpoints

### GET line item detail (new)
- `GET /api/opportunities/line-items/[lineItemId]`
- Response: `{ success: true, data: OpportunityProductDetailRecord }`
- Permissions: match Opportunity “view” permission model (view all vs assigned).

### PATCH line item detail (extend existing)
- `PATCH /api/opportunities/line-items/[lineItemId]`
- Accept a payload that mirrors Product Detail editable fields, but writes to `OpportunityProduct` snapshot fields.
- Additionally accepts current line item fields (`quantity`, `unitPrice`, etc) as it does today.

## Field mapping (Product Detail → OpportunityProduct)

### Existing snapshot fields (already in schema)
| Product detail field | OpportunityProduct field | Notes |
|---|---|---|
| `productCode` | `productCodeSnapshot` | Prefer snapshot; fallback to related `Product.productCode` |
| `productNameHouse` | `productNameHouseSnapshot` | Prefer snapshot; fallback to `Product.productNameHouse` |
| `productNameVendor` | `productNameVendorSnapshot` | Prefer snapshot; fallback to `Product.productNameVendor` |
| `revenueType` | `revenueTypeSnapshot` | Prefer snapshot; fallback to `Product.revenueType` |
| `priceEach` | `priceEachSnapshot` | Prefer snapshot; fallback to `Product.priceEach` |
| `commissionPercent` | `commissionPercentSnapshot` | Prefer snapshot; fallback to `Product.commissionPercent` |
| `distributor.accountName` | `distributorNameSnapshot` | Name snapshot exists; add ID snapshot if editing is needed |
| `vendor.accountName` | `vendorNameSnapshot` | Name snapshot exists; add ID snapshot if editing is needed |

### New snapshot fields needed (to match Product Detail editable fields)
Add snapshot columns to `OpportunityProduct` for:
- `descriptionSnapshot` (or `productDescriptionHouseSnapshot`)
- `productFamilyHouseSnapshot`
- `productSubtypeHouseSnapshot`
- `productFamilyVendorSnapshot`
- `productSubtypeVendorSnapshot`
- `productNameDistributorSnapshot`
- `partNumberVendorSnapshot`
- `partNumberDistributorSnapshot`
- `distributorProductFamilySnapshot`
- `distributorProductSubtypeSnapshot`
- `productDescriptionVendorSnapshot`
- `productDescriptionDistributorSnapshot`
- `vendorAccountIdSnapshot` (UUID, nullable)
- `distributorAccountIdSnapshot` (UUID, nullable)

**Backfill rule**: initialize snapshots from the related `Product` at creation time and (for existing rows) via a one-time script; page rendering should prefer snapshots and only fallback to `Product` fields when a snapshot is null.

## Vendor/Distributor consistency decision (required)
Today the system enforces a single Vendor/Distributor pair per Opportunity when changing `productId`.

For Opportunity Product detail editing, choose one:
1) **Strict**: vendor/distributor fields are read-only (derive from linked Product + existing name snapshots).
2) **Consistent override**: allow editing vendor/distributor on the Opportunity Product, but enforce that all line items in the opportunity share the same pair (editing updates other line items or blocks if mismatch).
3) **Fully independent**: allow per-line-item vendor/distributor overrides (requires updating downstream schedule logic and any “single pair per opportunity” assumptions).

## Implementation checklist (recommended order)
1) Add GET `/api/opportunities/line-items/[lineItemId]` returning a detail record.
2) Scaffold page `/opportunities/[opportunityId]/products/[lineItemId]` using a new `OpportunityProductDetailsView`.
3) Switch Opportunity → Products table links to the new page; keep a separate catalog link icon.
4) Add the new snapshot fields to Prisma + migration.
5) Backfill existing line items (script + job-run instructions).
6) Extend PATCH to update snapshot fields and audit log entries for `OpportunityProduct`.
7) Flesh out the UI so it matches Product Detail (tabs, inline editing, history).

