# Opportunity Product Tab – Create/Add Product UX, Progressive Search, and De‑duplication

Owner: Engineering
Target view: Opportunity Details → Products tab → “Add to Existing” and “Create New Product”

## Goal
Enable users to quickly add an existing product or create a new one directly from the Opportunity Products tab, while reducing duplicate products by guiding users through progressive, multi‑field search and performing de‑duplication checks during creation.

## Current State (repo context)
- UI
  - `components/opportunity-line-item-create-modal.tsx` already provides two modes: “Add to Existing” and “Create New.” It has simple inputs and a free‑text product search with optional distributor/vendor filters.
  - Opportunity endpoints for adding line items exist under `app/api/opportunities/[opportunityId]/line-items/`.
- API
  - `GET /api/products` supports `q` and a `filters` param with fields like `distributorId`, `vendorId`, `productFamilyVendor`, `productNameVendor`, `partNumberVendor` (maps to `productCode`), etc. (`app/api/products/route.ts`).
  - `POST /api/products` creates a product and enforces uniqueness on `tenantId + productCode` (see `prisma/schema.prisma`, model `Product`, `@@unique([tenantId, productCode])`).

Implication: We can build progressive search and a smarter “create” preflight mostly on top of the existing endpoints, with a small API enhancement for facet counts and duplicate checks.

## Requirements
- From the Products tab of an Opportunity:
  - Add Existing: Let users progressively narrow the catalog by choosing Distributor → Vendor → Product Family → Product Name/Code. Each selection filters subsequent choices (“search by elimination”).
  - Create New: Allow creating a product inline, but first surface likely matches to prevent duplicates.
- Search:
  - Combine multiple fields (IDs and names) and free text. Show top matches and facet counts to guide narrowing.
  - Prefill Vendor/Distributor from current Opportunity context where possible.
- De‑duplication:
  - Prevent exact duplicates (already covered by productCode uniqueness).
  - Detect likely duplicates (same vendor + similar name or same productCode ignoring punctuation/case) and warn/redirect to existing.

## Design Overview
1) Progressive search UI (shared component)
   - New component `components/product-lookup-panel.tsx` used inside the Opportunity line‑item modal (Add Existing tab) and optionally elsewhere.
   - Inputs (progressive): Distributor (account lookup), then Vendor (options filtered by current distributor selection), then optional Product Family, Product Name, Product Code.
   - Results list updates on each change; show badge counts (facets) next to dropdown options when available.
   - Accessibility: keyboard navigation, loading skeletons, empty state.

2) API enhancements
   - Faceted search: `GET /api/products/facets` returns counts for vendor, distributor, family given current filter set to power “by elimination” UX.
   - Duplicate preflight: `POST /api/products/dedupe-check` accepts proposed fields and returns potential matches (by normalized productCode and by vendor+name similarity).
   - Minor upgrades to `GET /api/products`:
     - Ensure IDs (vendor/distributor) are applied as strict filters.
     - Keep `q` OR the structured filters; combine using `AND` with the existing `OR` block as implemented.

3) Create New Product flow
   - In `opportunity-line-item-create-modal.tsx` → before calling `POST /api/products`, call `POST /api/products/dedupe-check`.
   - If matches found, show a confirmation panel listing close matches with “Use this existing” action. Users can still proceed (unless an exact conflict exists, which DB will block).
   - Auto‑derive minimal required fields (house name/code) still supported, but prefer explicit entry where practical.

4) Add to Existing flow
   - Replace the current single input list with the `product-lookup-panel` progressive UX.
   - Only enable the “Add” button when a product is selected.

5) Duplicate reduction strategy (V1 pragmatic)
   - No schema change required for V1.
   - Server‑side checks compare:
     - Exact productCode (case/space/punctuation‑insensitive).
     - Same vendorId + normalized productNameVendor (trim, casefold, collapse whitespace).
   - Optional V2 (separate milestone): add `normalizedProductCode` and `normalizedProductNameVendor` computed columns with indexes or a composite unique on `[tenantId, vendorAccountId, normalizedProductNameVendor]` after data cleanup.

## Step‑by‑Step Plan (with estimates)
Time in ideal engineering days (8h). Ranges reflect uncertainty.

1) UX confirmation + acceptance criteria (0.25–0.5 day)
- Confirm exact fields order, facet display, warnings for duplicates, and prefill behavior from Opportunity context.

2) API – facets and preflight (0.75–1.25 days)
- Add `GET /api/products/facets` with inputs: current filters; outputs: counts for `vendorId`, `distributorId`, `productFamilyVendor`.
- Add `POST /api/products/dedupe-check` implementing normalized comparisons and fuzzy vendor+name match (ILIKE with normalization).

3) UI – shared product lookup panel (1.0–1.5 days)
- Build `components/product-lookup-panel.tsx` with:
  - Distributor and Vendor async selects (reuse `/api/accounts` with `accountType=Distributor|Vendor`).
  - Product Family dropdown (populated from facets and/or free‑text).
  - Name/Code inputs with debounced fetching.
  - Result list with essential meta (vendor/distributor, code, revenue type, price, family).

4) Wire into Opportunity Products modal (0.75–1.0 day)
- Replace Add Existing content in `components/opportunity-line-item-create-modal.tsx` with the lookup panel.
- Prefill Distributor/Vendor from Opportunity detail where reasonable.
- Keep existing line‑item payload/POST to `opportunities/[opportunityId]/line-items`.

5) Create New – de‑dup warning (0.5–0.75 day)
- In the same modal, run `dedupe-check` before submit. Show a side‑by‑side list of potential matches with “Use Existing” CTA.

6) Testing + QA (0.75–1.25 days)
- Unit tests: normalization helpers, dedupe checks (server).
- Integration: `GET /api/products` with combined filters, `facets`, `dedupe-check`.
- UI smoke tests: progressive narrowing, performance, keyboard nav, and adding line item.

7) Docs + handoff (0.25 day)
- Short README in `docs/` explaining the UX, endpoints, and how de‑dup works.

Estimated total: 4.25–6.5 days (most teams land ~5–6 days).

## Milestones
- M1 – API foundation (facets + dedupe‑check): 0.75–1.25 days.
- M2 – Lookup panel component built: +1.0–1.5 days.
- M3 – Wire into Opportunity modal + prefill: +0.75–1.0 day.
- M4 – Create New with dedupe warning: +0.5–0.75 day.
- M5 – Tests/QA/Docs: +1.0–1.5 days.

## Acceptance Criteria
- Add Existing uses progressive filtering; selecting Distributor and Vendor reduces the result set accordingly.
- Combined field search returns consistent, paginated results; facet counts guide narrowing.
- Create New warns on likely duplicates and blocks exact productCode collisions.
- Adding a selected product creates an opportunity line item successfully.

## Risks and Mitigations
- Performance on large catalogs: use indexed filters already present and paginate; debounce client calls; facet queries scoped by tenant and current filters only.
- False positives in dedupe: present as warnings with clear copy; never silently block non‑conflicting creates.
- Historical data inconsistencies: keep V1 server‑side checks; consider V2 normalization columns + backfill migration if needed.

## Concrete File Touch List (planned)
- Backend
  - `app/api/products/route.ts` – minor enhancements (ensure AND semantics, tune sorting for filtered results).
  - `app/api/products/facets/route.ts` – new endpoint for counts.
  - `app/api/products/dedupe-check/route.ts` – new endpoint for preflight duplicate detection.
- Frontend
  - `components/product-lookup-panel.tsx` – new shared component.
  - `components/opportunity-line-item-create-modal.tsx` – replace “Add Existing” section with the lookup panel; add preflight to Create New.
  - (Optional) `components/opportunity-details-view.tsx` – minor plumbing if additional context/prefill needed.
- Docs
  - This plan and a short usage guide.

## Optional V2 (schema hardening)
- Add normalized columns and a composite unique index after a data cleanup/backfill:
  - `normalizedProductCode`, `normalizedProductNameVendor` (generated or maintained in code).
  - Unique: `@@unique([tenantId, vendorAccountId, normalizedProductNameVendor])`.
  - Adds ~1.0–1.5 days (migration, backfill, QA) if prioritized.

## Next Steps
1) Confirm UX specifics (facet display, prefill rules, warning copy).
2) Approve scope (V1 only vs. include V2 schema hardening).
3) Execute M1→M3 for a working vertical slice, then layer dedupe warnings and QA.

