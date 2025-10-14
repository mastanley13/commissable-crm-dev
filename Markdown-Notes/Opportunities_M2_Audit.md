Commissable CRM — Opportunities (M2) Audit

Scope
- Source of truth: Markdown-Notes/Opportunities_M2_Implementation_Plan.md
- This audit compares the current Opportunities implementation to the plan, with status by area and concrete code references.

Summary Status
- List view: Implemented (filters, sorting, pagination, column prefs, bulk actions, CSV export)
- Create/Edit: Implemented via modals; basic validation only
- Detail view: Not implemented (no tabs, no products sub-grid, no history/audit tab)
- Product line items UI: Not implemented (DB model exists)
- Kanban: Not implemented
- Import: Not implemented
- RBAC: Implemented on API (view/edit/delete scoping)
- Audit logging: Not implemented for Opportunities
- Performance budgets/caching: Not implemented (no caching; pagination present; no virtualization)
- Stage/probability rules and close flow: Partially implemented (enum validation only; no transition rules; no close endpoint)

What’s Completed
- Server list endpoint with filters, sorting, pagination
  - app/api/opportunities/route.ts:80 (GET) — includes role scoping, query, column filters, sort, pagination, and take/skip
  - Page size capped at 100; default 25
- Create endpoint
  - app/api/opportunities/route.ts:253 (POST) — validates required fields and enums; creates record
- Record detail fetch for edit
  - app/api/opportunities/[opportunityId]/route.ts:96 (GET) — returns core fields for edit modal
- Update and delete endpoints
  - app/api/opportunities/[opportunityId]/route.ts:266 (PATCH result return) — updates name/stage/owner/leadSource/estimatedCloseDate/status; supports “active” boolean
  - app/api/opportunities/[opportunityId]/route.ts:274 (DELETE)
- Opportunities list page with table + bulk actions
  - app/(dashboard)/opportunities/page.tsx:329 — fetches list from /api/opportunities with filters/sort/pagination
  - app/(dashboard)/opportunities/page.tsx:1288 — renders DynamicTable with pagination controls
  - Bulk actions: owner, status, delete, CSV export
    - app/(dashboard)/opportunities/page.tsx:906 — bulk owner update (PATCH)
    - app/(dashboard)/opportunities/page.tsx:1002 — bulk status update (PATCH)
    - app/(dashboard)/opportunities/page.tsx:801 — permanent delete (DELETE)
    - components/opportunity-bulk-action-bar.tsx:1 — bar and buttons
    - Inline row toggle for active/inactive (status): app/(dashboard)/opportunities/page.tsx:667
- Column customization (save/hide/reorder/resize)
  - hooks/useTablePreferences.ts — reads/writes via /api/table-preferences
  - app/api/table-preferences/[pageKey]/route.ts — GET/POST implemented
- Create/edit modals
  - components/account-opportunity-create-modal.tsx — creates opportunity from account
  - components/opportunity-edit-modal.tsx — edits core fields (name, stage, owner, leadSource, est. close, status, subagent)
- RBAC on endpoints
  - app/api/opportunities/route.ts — view any/assigned permissions
  - app/api/opportunities/[opportunityId]/route.ts — view/edit any/assigned; delete guard

Partially Implemented
- List view feature set (per plan)
  - Implemented: keyword search, column filters, sorting, server pagination, bulk actions, CSV export
  - Partial: “saved views” UI (ListHeader supports saved sets, but Opportunities page does not wire savedFilterSets)
  - Not present: row virtualization
- Stage/probability/amount logic
  - Stage is an enum and validated server-side; no transition rules or stage-driven probability/required fields
  - Probability/amount fields exist in schema but are not surfaced in UI
- “Soft delete”/restore
  - Implemented by mapping active/inactive to status Open/Lost via PATCH; restore by setting active true
  - Two-stage delete dialog present; permanent delete issues DELETE
- Product totals in list
  - List derives totals from related OpportunityProduct rows
  - No UI to manage line items on an opportunity
- DB fields added but not in Prisma schema
  - Migration adds orderIdHouse, distributorName, vendorName, referredBy, closeDate
  - Prisma model does not declare these fields; API responses won’t include them via Prisma client (map defaults around this)
    - prisma/migrations/add_opportunity_contact_fields.sql
    - prisma/schema.prisma (Opportunity model) — lacks those columns

Not Implemented (Gaps vs Plan)
- Detail view with tabs
  - No /opportunities/[id] page; no tabs for Details, Products (line items), Activity, History (audit)
- Product Line Items sub-grid and endpoints
  - No UI to add/edit/remove line items on an opportunity
  - No REST: POST /{id}/line-items, PATCH/DELETE line-items
  - DB models exist: prisma/schema.prisma: OpportunityProduct
- Kanban view
  - No Kanban pipeline by stage; no drag-and-drop or guarded transitions
- Close endpoint and lifecycle
  - No POST /{id}/close (won/lost with validations);
  - No won/lost validations beyond setting status via PATCH
- Validation rules from MSAP
  - No stage transition matrix enforcement or required fields by stage
  - No cross-field rules (e.g., lost_reason on close-lost)
- Audit logging
  - No CRUD audit writes for Opportunities or line items
  - General audit helpers exist; not applied to these endpoints
- Performance and caching
  - No Redis/response caching for list/filters; no latency instrumentation to verify budgets
  - No virtualization in the table (scroll container only)
- Import
  - No import flow or UI wired for Opportunities
- Permissions gaps
  - CSV export accessible without an explicit “opportunities.export” permission gate on the page

API Compliance vs Plan
- Implemented
  - GET /api/opportunities (filters/sort/pagination): app/api/opportunities/route.ts:80
  - POST /api/opportunities: app/api/opportunities/route.ts:253
  - GET /api/opportunities/{id}: app/api/opportunities/[opportunityId]/route.ts:96
  - PATCH /api/opportunities/{id}: app/api/opportunities/[opportunityId]/route.ts:266
  - DELETE /api/opportunities/{id}: app/api/opportunities/[opportunityId]/route.ts:274
- Missing
  - POST /{id}/close
  - POST /{id}/line-items, PATCH /line-items/{id}, DELETE /line-items/{id}
  - Caching layer (Redis) and cache-bust on writes
  - Audit event publishing on CRUD

Data Model vs Plan
- Present (Opportunity, OpportunityProduct, indexes)
  - prisma/schema.prisma: Opportunity model and indexes; OpportunityProduct model
- Missing from Prisma model (present in migration only)
  - orderIdHouse, distributorName, vendorName, referredBy, closeDate
  - Action: align Prisma schema with migration if those fields are required for UI/exports

UI/UX vs Plan
- Done
  - List columns and controls, server pagination, bulk actions, column preferences, CSV export
- Partial
  - Saved views not wired on Opportunities page (ListHeader capability exists)
  - Soft delete via status mapping (UI done; semantics differ from explicit soft-delete field)
- Missing
  - Detail page with tabs (Details/Products/Activity/History)
  - Kanban pipeline
  - Import

RBAC & Security
- API enforces view any/assigned, edit any/assigned, and delete
- UI does not gate CSV export by permission
- No audit logging on these endpoints (required by plan)

Performance/Observability
- Server-side pagination implemented; pageSize capped at 100
- No caching, tracing, or latency metrics to validate budgets
- DynamicTable uses scroll container; no row virtualization

UAT Checklist (from plan) — Current Status
- Create, view, edit, delete: Partially satisfied (via modals); no detail page
- Stage transitions/probability rules: Not implemented
- Products line items management and totals: Not implemented (totals derived; no UI)
- List view performance (p95 < 500ms), pagination 100: Unknown/Partial (pagination present; budgets unmeasured)
- RBAC (4-role): Implemented on API
- Audit logs for CRUD/stage changes: Not implemented
- Browser matrix: Not verified

Recommended Next Steps
- Ship the missing UX: detail page with tabs (Details, Products, Activity, History) and Kanban
- Implement line item endpoints + UI; compute totals server-side
- Enforce stage transition rules and per-stage validations; add POST /{id}/close
- Add audit logging on all Opportunities and line item CRUD
- Add optional Redis caching for list endpoints; add latency instrumentation and dashboards
- Wire saved views on Opportunities page; gate CSV export with “opportunities.export”
- Align Prisma schema with migration fields (orderIdHouse, distributorName, vendorName, referredBy, closeDate)

Notes
- The list view maps product-derived totals and displays vendor/distributor names, but the underlying fields added by SQL migration are not declared in Prisma, so they won’t be read/written by Prisma client unless added to schema.

