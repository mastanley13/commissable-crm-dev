Commissable CRM — Products (M2) Audit

Scope
- Source of truth: Markdown-Notes/Products_M2_Implementation_Plan.md
- This audit compares the current Products implementation to the plan, with status by area and concrete code references.

Summary Status
- List view: Implemented (search, column filters, sorting, server pagination, column prefs, bulk activate/deactivate/delete, CSV export)
- Create/Edit: Not implemented (UI shows “coming soon”; no POST API)
- Detail view: Not implemented (no product details page/tabs)
- RBAC: Partially implemented on API (read/mutate guarded); UI not permission‑gated for actions like export
- Audit logging: Not implemented for Products
- Performance budgets/caching: Not implemented (no caching/metrics; pagination present; no virtualization)
- Opportunity integration (picker/line items): Not implemented

What’s Completed
- Server list endpoint with filters, sorting, pagination
  - app/api/products/route.ts:52 (GET) — tenant scoping; keyword search; per‑column filters; sort; pagination; include distributor/vendor; maps via helpers
  - Page size capped at 100; default 25
- Update + delete endpoints (id)
  - app/api/products/[productId]/route.ts:1 (PATCH/DELETE) — toggles isActive; deletes product
- Products list page with table + bulk actions + export
  - app/(dashboard)/products/page.tsx:328 — fetches list from /api/products with query/filters/sort/pagination
  - app/(dashboard)/products/page.tsx:948 — create button is present but shows “Create coming soon” (no modal/form)
  - Bulk actions: delete, activate, deactivate, export CSV
    - components/product-bulk-action-bar.tsx:1 — bulk bar
    - app/(dashboard)/products/page.tsx:627 — bulk activate (PATCH active: true)
    - app/(dashboard)/products/page.tsx:694 — bulk deactivate (PATCH active: false)
    - app/(dashboard)/products/page.tsx:568 — bulk delete (DELETE)
    - app/(dashboard)/products/page.tsx:760 — CSV export
- Column customization (save/hide/reorder/resize)
  - hooks/useTablePreferences.ts — persisted via /api/table-preferences
  - app/api/table-preferences/[pageKey]/route.ts — GET/POST implemented
- Data model foundation
  - prisma/schema.prisma:470 — Product model with productCode (unique per tenant), names, description, revenueType, commissionPercent, priceEach, isActive, distributor/vendor relations, timestamps, indexes

Partially Implemented
- List view feature set (per plan)
  - Implemented: keyword search, per‑column filters, sorting, server pagination, column preferences, CSV export
  - Partial: “saved views” UI not wired on Products page
  - Not present: row virtualization
- RBAC
  - API list access requires admin or any of: products.read/update/create/delete (coarse but protective): app/api/products/route.ts:17,34
  - Mutations (PATCH/DELETE) require products.update/delete/create/read or admin: app/api/products/[productId]/route.ts:6
  - UI does not gate buttons by permission; API will block unauthorized calls

Not Implemented (Gaps vs Plan)
- Create/Edit product
  - No POST /api/products; no create/edit form; UI shows “Create coming soon”: app/(dashboard)/products/page.tsx:948
- Detail page with tabs (Details, Usage, History)
  - No /products/[id] page; no audit/history or usage tabs
- Business rules & validation (MSAP matrix)
  - No SKU uniqueness handling in UI/API error taxonomy (DB unique exists); no real‑time validation for price/currency/tax/discount; no field‑level restrictions (e.g., cost)
- Opportunity integration
  - No product picker/lookup endpoint or usage in Opportunities; no line‑item math from product pricing
- Audit logging
  - No CRUD audit writes for Products
- Performance and caching
  - No Redis/response caching; no latency instrumentation to validate budgets
- Import
  - No import flow or UI wired for product catalog

API Compliance vs Plan
- Implemented
  - GET /api/products (filters/sort/pagination): app/api/products/route.ts:52
  - PATCH /api/products/{id} (active toggle): app/api/products/[productId]/route.ts:1
  - DELETE /api/products/{id}: app/api/products/[productId]/route.ts:1
- Missing
  - POST /api/products (create)
  - GET /api/products/{id} (details)
  - Field‑level update endpoints/validation (e.g., price, tax class)
  - Caching layer (Redis) and cache‑bust on writes
  - Audit event publishing on CRUD

Data Model vs Plan
- Present (Product entity, unique SKU/code, pricing fields, relations)
  - prisma/schema.prisma:470 — Product model and indexes (unique [tenantId, productCode])
- Missing vs plan placeholders
  - Classification fields like category/subcategory/tags; tax_class fields; currency rules
  - Helper maps several vendor‑classification fields to null placeholders (not stored): app/api/products/helpers.ts:41 (PRODUCT_SPEC_TODO_FIELDS)

UI/UX vs Plan
- Done
  - List with filters/sort/pagination; column preferences; CSV export; bulk activation/deactivation/delete
- Partial
  - Saved views not wired on Products page
- Missing
  - Detail page with tabs (Details/Usage/History)
  - Create/Edit forms with real‑time validation and currency formatting
  - Lookup typeahead for Opportunities (name/SKU)

RBAC & Security
- API enforces permissions for list and mutations; UI exposes actions without explicit permission gating
- No audit logging on Products endpoints (required by plan)

Performance/Observability
- Server‑side pagination implemented; cap 100 per page
- No caching, tracing, or latency metrics to validate budgets
- DynamicTable uses scroll container; no row virtualization

UAT Checklist (Products) — Current Status
- Create/Edit Product with all MSAP fields: Not implemented
- List filters & sort; server‑side pagination 100; search p95 < 500ms: Partial (list mechanics done; budgets unmeasured; no caching)
- Lookup API and active filter behavior: Partial (list endpoint exists; no dedicated lookup/limit path; active filter supported)
- RBAC (4‑role) with field restrictions: Partial (API guards in place; no field‑level restrictions or UI gating)
- Audit trail on CRUD and priced fields: Not implemented
- Opportunity line‑item integration: Not implemented

Recommended Next Steps
- Ship create/edit product: POST /api/products, GET /api/products/{id}, PATCH for field edits; add form with real‑time validation and currency/percent inputs
- Build product detail page with tabs (Details, Usage, History); wire audit log history
- Implement product lookup (name/SKU) for Opportunities and ensure unit price, tax/discount rules flow per MSAP
- Add audit logging on all product CRUD; include diff for sensitive fields (price/cost)
- Add optional Redis caching for list/lookups; add latency instrumentation and export dashboards; consider virtualization
- Extend RBAC: UI gating and field‑level restrictions where required (e.g., cost)
- Extend Prisma/Product schema to include MSAP classification and tax/currency fields and enforce SKU uniqueness in API with friendly errors

Notes
- The list view maps distributor/vendor names from relations and includes pricing columns; several vendor classification fields are placeholders pending schema (helper flags these TODOs).

