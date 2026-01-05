# New Product Popup Without Vendor/Distributor

## Summary (easy version)

Yes, we *can* remove Vendor/Distributor fields from the “New Product” popup, but only if we’re clear about what “a product” means:

- If `Product` is the **canonical House product** (our internal catalog record), then Vendor/Distributor details are **channel metadata** and should live in a separate mapping record (recommended).
- If `Product` is a **vendor/distributor-specific SKU**, then removing those fields means we’re creating ambiguous records and will eventually overwrite/lose data when matching fills them in.

The core issue is that deposit matching is discovering **vendor/distributor-specific identifiers**, while the catalog `Product` currently mixes “canonical” + “channel” fields.

## Current Behavior (today)

### Data model (simplified)

- `Product` includes:
  - House fields (e.g., `productNameHouse`, `productCode`, `revenueType`, etc.)
  - Channel fields (e.g., `vendorAccountId`, `distributorAccountId`, `productNameVendor`, vendor/distributor picklists, etc.)
- `OpportunityProduct` is a line item that snapshots some product fields.

### Current workflows

**A) Opportunity → Products → Add Product from Catalog**
1. User filters by distributor/vendor/family/subtype/product name.
2. User must pick a *specific catalog product* to enable “Add”.
3. System attaches product to the Opportunity as a line item.
4. Server enforces: **only one Distributor/Vendor pair per Opportunity**.

**B) Opportunity → Products → Create New Product**
1. UI currently collects vendor/distributor inputs and creates a catalog `Product`.
2. It then attaches it as an Opportunity line item.
3. If attach fails (often due to Distributor/Vendor mismatch rules), the UI rolls back by deleting the created Product → user perceives “it didn’t save”.

**C) Reconciliation / Deposit matching**
- Matching operates on “copies” of product-related data from line items / schedules and can discover vendor/distributor names, part numbers, etc.
- Today, those values are expected to land back on `Product` (but this becomes problematic if multiple channels exist).

## What We Want (desired behavior)

When a user doesn’t know Vendor/Distributor info at creation time:
- They can still create a Product (at least a canonical/house record).
- Deposit matching can later enrich the catalog with vendor/distributor-specific identifiers *without breaking* existing products or opportunities.

## Recommended Direction (Option A): Split canonical Product from channel metadata

### High-level idea

Keep `Product` as the canonical “House product” record, and move vendor/distributor-specific identifiers into a **mapping table** (one Product can have many vendor/distributor variants).

### Proposed data model (new)

**`Product` (canonical)**
- `id`, `tenantId`
- `productNameHouse`, internal identifiers
- `revenueType`, `priceEach`, commission defaults, etc.
- No requirement to store vendor/distributor identities here.

**New: `ProductChannelMapping` (or similar)**
- `id`, `tenantId`, `productId`
- `vendorAccountId?`, `distributorAccountId?`
- Vendor/distributor-specific names + part numbers (what matching discovers)
- Optional: “isPrimary”, “lastMatchedAt”, “matchConfidence”, etc.
- Unique constraints (example): `(tenantId, vendorAccountId, distributorAccountId, vendorPartNumber)` or whatever best represents “same SKU”.

### New workflows

**A) Opportunity → Products → Create New Product (no vendor/distributor fields)**
1. User enters minimal canonical details (House name, revenue type, etc.).
2. Product is created immediately as canonical `Product`.
3. User adds it as a line item.
4. If the Opportunity already has a locked Distributor/Vendor pair, the line item is associated with that pair *without* requiring the Product itself to store it.

**B) Deposit matching**
1. Matching identifies vendor/distributor-specific identifiers.
2. Instead of mutating `Product`, matching creates/updates `ProductChannelMapping`.
3. Opportunity line items can snapshot mapping info (or reference mapping id) for historical consistency.

### Behavior changes vs current

| Area | Current | Proposed (Option A) |
|---|---|---|
| Product creation | Often requires vendor/distributor fields or creates ambiguous catalog records | Always allowed with minimal canonical fields |
| Deposit matching updates | Mutates Product fields directly (risk: overwriting, ambiguity) | Writes/updates ProductChannelMapping (safe, additive) |
| Multi-channel products | Hard/ambiguous (1 Product → 1 vendor/distributor) | Native support (1 Product → many mappings) |
| “Locked vendor/distributor per Opportunity” | Enforced by checking existing line items | Still enforceable, but based on mapping/pair not Product identity |

### What needs to change (engineering)

- **Schema**
  - Add `ProductChannelMapping` table.
  - Update relationships and indexes.
  - Decide what to snapshot on `OpportunityProduct` (e.g., mapping id + names/part numbers snapshot).
- **API**
  - Update Product create endpoints to not require vendor/distributor.
  - Add endpoints to create/update mappings (likely used by matching).
  - Update Opportunity line item attach to enforce Distributor/Vendor rule based on mapping/pair.
- **UI**
  - New Product modal: remove vendor/distributor fields (or move them to an “optional details” accordion).
  - Catalog views: show vendor/distributor data by selecting a mapping (e.g., “Primary mapping” or “most recent matched”).
- **Matching**
  - When a match finds vendor/distributor info, upsert `ProductChannelMapping`.
  - Optionally auto-select/flag a “primary mapping” per Product for display defaults.

### Risks / tradeoffs

- More moving parts (extra table + relationships).
- UI needs to represent “a Product with multiple vendor variants” clearly.
- Requires a migration/backfill plan for existing `Product.vendorAccountId`/`distributorAccountId` rows into mappings.

## Alternative (Option B): Keep vendor/distributor on Product but make them optional + lock at Opportunity level

This is smaller scope but has long-term drawbacks.

### High-level idea
- Allow creating Product without vendor/distributor.
- When attaching to an Opportunity:
  - If the Opportunity already has a canonical pair, force the new line item to use that pair.
  - If not, set the canonical pair on first attach/match and backfill Product.

### Risks
- Eventually you will want the same “house product” across multiple vendor/distributor pairs; this model can’t represent that cleanly.
- Deposit matching can “flip” vendor/distributor fields on Product in ways that surprise users.

## Implementation Plan (recommended: Option A)

### Phase 0 — Confirm product definition and invariants
- Confirm whether a “Product” is intended to be canonical House product or vendor SKU.
- Confirm whether “one vendor/distributor per Opportunity” is a hard invariant or should change.

### Phase 1 — Data model + migration
- Add `ProductChannelMapping` schema + Prisma model.
- Migration: for each existing Product with vendor/distributor info, create a mapping row.
- Update reads so the UI can show vendor/distributor info via a “primary mapping”.

### Phase 2 — Update create + attach flows
- Update “Create New Product” UI to not require vendor/distributor.
- Update Opportunity line item attach logic to enforce the vendor/distributor rule based on chosen mapping/pair.
- Ensure rollback behavior is no longer “silent” if attach fails.

### Phase 3 — Matching integration
- Update deposit matching to upsert `ProductChannelMapping`.
- Add a deterministic rule for selecting “primary mapping” (or make it user-selectable).

### Phase 4 — UX polish and reporting
- Improve catalog search: allow searching by vendor part number across mappings.
- Provide a “Mappings” section on Product detail pages.

## What “success” looks like

- Users can always create a product with minimal info.
- Users are guided if they try to add from catalog but no match exists.
- Deposit matching enriches the catalog without overwriting or breaking existing product usage.
- Multi-channel products are supported without hacks.

