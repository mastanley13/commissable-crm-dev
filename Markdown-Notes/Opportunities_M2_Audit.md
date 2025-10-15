Commissable CRM — Opportunities (M2) Audit

**Last Updated:** 2025-10-14

Scope
- Source of truth: Markdown-Notes/Opportunities_M2_Implementation_Plan.md
- This audit compares the current Opportunities implementation to the plan, with status by area and concrete code references.

Summary Status
- List view: ✅ Implemented (filters, sorting, pagination, column prefs, bulk actions, CSV export)
- Create/Edit: ✅ Implemented via modals; basic validation only
- Detail view: ✅ **NEWLY IMPLEMENTED** - Full detail page with tabs (Details, Products, Activities, History)
- Product line items UI: ✅ **NEWLY IMPLEMENTED** - Complete CRUD for line items with modals
- Product line items API: ✅ **NEWLY IMPLEMENTED** - POST/PATCH/DELETE endpoints
- Activities tab: ✅ **NEWLY IMPLEMENTED** - Integrated with existing activities system
- History/Audit tab: ✅ **NEWLY IMPLEMENTED** - Fetches from /api/audit-logs
- Kanban: ❌ Not implemented
- Import: ❌ Not implemented
- RBAC: ✅ Implemented on API (view/edit/delete scoping)
- Audit logging: ⚠️ Partially implemented (audit log API exists; read-only for Opportunities; no write-on-CRUD yet)
- Performance budgets/caching: ⚠️ Partially implemented (no caching; pagination present; no virtualization)
- Stage/probability rules and close flow: ⚠️ Partially implemented (enum validation only; no transition rules; no close endpoint)

What's Completed

**List View & Core CRUD**
- Server list endpoint with filters, sorting, pagination
  - app/api/opportunities/route.ts:80 (GET) — includes role scoping, query, column filters, sort, pagination, and take/skip
  - Page size capped at 100; default 25
- Create endpoint
  - app/api/opportunities/route.ts:259 (POST) — validates required fields and enums; creates record
- Record detail fetch for edit
  - app/api/opportunities/[opportunityId]/route.ts:83 (GET) — returns full detail with line items, account, owner, createdBy, updatedBy
- Update and delete endpoints
  - app/api/opportunities/[opportunityId]/route.ts:160 (PATCH) — updates name/stage/owner/leadSource/estimatedCloseDate/status/subAgent; supports "active" boolean
  - app/api/opportunities/[opportunityId]/route.ts:283 (DELETE)
- Opportunities list page with table + bulk actions
  - app/(dashboard)/opportunities/page.tsx:310 — fetches list from /api/opportunities with filters/sort/pagination
  - app/(dashboard)/opportunities/page.tsx:1310 — renders DynamicTable with pagination controls
  - Bulk actions: owner, status, delete, CSV export
    - app/(dashboard)/opportunities/page.tsx:903 — bulk owner update (PATCH)
    - app/(dashboard)/opportunities/page.tsx:997 — bulk status update (PATCH)
    - app/(dashboard)/opportunities/page.tsx:807 — permanent delete (DELETE)
    - components/opportunity-bulk-action-bar.tsx — bar and buttons
    - Inline row toggle for active/inactive (status): app/(dashboard)/opportunities/page.tsx:666
- Column customization (save/hide/reorder/resize)
  - hooks/useTablePreferences.ts — reads/writes via /api/table-preferences
  - app/api/table-preferences/route.ts — GET/POST implemented
- Create/edit modals
  - components/account-opportunity-create-modal.tsx — creates opportunity from account
  - components/opportunity-edit-modal.tsx — edits core fields (name, stage, owner, leadSource, est. close, status, subagent)

**Detail View & Tabs** ✅ **NEW**
- Detail page route
  - app/(dashboard)/opportunities/[opportunityId]/page.tsx — fetches detail, handles edit modal, breadcrumbs
- Detail view component with 4 tabs (Details, Products, Activities, History)
  - components/opportunity-details-view.tsx:362 — main component with tab state and shared header
  - components/opportunity-details-view.tsx:1023 — pill-style tab navigation matching Accounts/Contacts pattern
- Header section (read-only fields)
  - components/opportunity-details-view.tsx:176 — OpportunityHeader with name, stage, status, probability, account link, owner, type, leadSource
- Details tab
  - components/opportunity-details-view.tsx:246 — DetailsTab showing overview, totals, description, audit info
- Products tab with line item CRUD
  - components/opportunity-details-view.tsx:1049 — Products tab with ListHeader, DynamicTable, column prefs (pageKey: opportunities:detail:products)
  - components/opportunity-details-view.tsx:385 — useTablePreferences for products
  - components/opportunity-line-item-create-modal.tsx — product picker, quantity, pricing, dates
  - components/opportunity-line-item-edit-modal.tsx — edit existing line items
  - Delete confirmation dialog: components/opportunity-details-view.tsx:1240
- Activities tab
  - components/opportunity-details-view.tsx:1084 — Activities tab with ListHeader, DynamicTable, column prefs (pageKey: opportunities:detail:activities)
  - components/opportunity-details-view.tsx:410 — useTablePreferences for activities
  - components/opportunity-details-view.tsx:598 — fetchActivities from /api/activities with contextType=Opportunity filter
  - components/activity-note-create-modal.tsx — create activity linked to opportunity
  - components/activity-note-edit-modal.tsx — edit activity
- History/Audit tab
  - components/opportunity-details-view.tsx:1125 — History tab with ListHeader, DynamicTable, column prefs (pageKey: opportunities:detail:history)
  - components/opportunity-details-view.tsx:429 — useTablePreferences for history
  - components/opportunity-details-view.tsx:798 — fetchHistory from /api/audit-logs for Opportunity + OpportunityProduct entities

**Line Items API** ✅ **NEW**
- Create line item
  - app/api/opportunities/[opportunityId]/line-items/route.ts:66 (POST) — validates product, quantity, calculates expectedRevenue; RBAC checks
- Update line item
  - app/api/opportunities/line-items/[lineItemId]/route.ts:66 (PATCH) — updates product, quantity, prices, dates; recalculates totals
- Delete line item
  - app/api/opportunities/line-items/[lineItemId]/route.ts:239 (DELETE) — removes line item; RBAC checks
- Helpers
  - app/api/opportunities/helpers.ts:279 — mapOpportunityProductToDetail for line item response formatting
  - app/api/opportunities/helpers.ts:310 — mapOpportunityToDetail includes lineItems array and computed totals

**RBAC on endpoints**
- List/detail/edit/delete: app/api/opportunities/route.ts & app/api/opportunities/[opportunityId]/route.ts — view any/assigned permissions
- Line items: app/api/opportunities/[opportunityId]/line-items/route.ts & app/api/opportunities/line-items/[lineItemId]/route.ts — edit any/assigned permissions

Partially Implemented
- List view feature set (per plan)
  - ✅ Implemented: keyword search, column filters, sorting, server pagination, bulk actions, CSV export
  - ⚠️ Partial: "saved views" UI (ListHeader supports saved sets, but Opportunities page does not wire savedFilterSets)
  - ❌ Not present: row virtualization
- Stage/probability/amount logic
  - ⚠️ Stage is an enum and validated server-side; no transition rules or stage-driven probability/required fields
  - ⚠️ Probability/amount fields exist in schema (prisma/schema.prisma:421-423) but are not surfaced in create/edit UI
  - ⚠️ Detail view displays probability and amount (components/opportunity-details-view.tsx:206-207) but no workflow to calculate/update them
- "Soft delete"/restore
  - ✅ Implemented by mapping active/inactive to status Open/Lost via PATCH; restore by setting active true
  - ✅ Two-stage delete dialog present; permanent delete issues DELETE
- Product totals in list and detail
  - ✅ List derives totals from related OpportunityProduct rows (app/api/opportunities/helpers.ts:221-227)
  - ✅ Detail view computes and displays totals (components/opportunity-details-view.tsx:292-313)
  - ✅ UI to manage line items on opportunity detail page now fully implemented

Not Implemented (Gaps vs Plan)
- Kanban view
  - ❌ No Kanban pipeline by stage; no drag-and-drop or guarded transitions
  - ❌ No components/opportunity-kanban-view.tsx
- Close endpoint and lifecycle
  - ❌ No POST /api/opportunities/{id}/close (won/lost with validations)
  - ⚠️ Status can be set to Won/Lost via PATCH but no required field enforcement (e.g., lossReason for Lost)
- Stage transition rules and workflow
  - ❌ No stage transition matrix enforcement or required fields by stage
  - ❌ No cross-field rules (e.g., lossReason required when status=Lost)
  - ❌ No probability auto-calculation based on stage
- Audit logging (write operations)
  - ⚠️ Audit log API exists and can be read (/api/audit-logs), but no write-on-CRUD for Opportunities or line items
  - ⚠️ General audit helpers exist (lib/audit.ts) but not wired to Opportunity endpoints
  - Recommendation: Add audit writes in POST/PATCH/DELETE handlers for app/api/opportunities/route.ts, app/api/opportunities/[opportunityId]/route.ts, and line item routes
- Performance and caching
  - ❌ No Redis/response caching for list/filters; no latency instrumentation to verify budgets (<500ms p95)
  - ❌ No virtualization in the table (scroll container only; DynamicTable does not virtualize rows)
  - ✅ Pagination present (page size capped at 100)
- Import
  - ❌ No import flow or UI wired for Opportunities
  - ❌ No app/api/opportunities/import endpoint
- Permissions gaps
  - ⚠️ CSV export accessible without an explicit "opportunities.export" permission gate on the page (app/(dashboard)/opportunities/page.tsx:593)
- Amount and probability management
  - ❌ No UI in create/edit modals to set amount or probability
  - ❌ No server-side logic to compute amount from line item totals (helper exists but not enforced)
  - ⚠️ Fields exist in schema and are displayed in detail view but cannot be edited

API Compliance vs Plan
- ✅ **Implemented**
  - GET /api/opportunities (filters/sort/pagination): app/api/opportunities/route.ts:80
  - POST /api/opportunities: app/api/opportunities/route.ts:259
  - GET /api/opportunities/{id}: app/api/opportunities/[opportunityId]/route.ts:83 (returns full detail with line items)
  - PATCH /api/opportunities/{id}: app/api/opportunities/[opportunityId]/route.ts:160
  - DELETE /api/opportunities/{id}: app/api/opportunities/[opportunityId]/route.ts:283
  - **POST /api/opportunities/{id}/line-items**: app/api/opportunities/[opportunityId]/line-items/route.ts:66 ✅ **NEW**
  - **PATCH /api/opportunities/line-items/{id}**: app/api/opportunities/line-items/[lineItemId]/route.ts:66 ✅ **NEW**
  - **DELETE /api/opportunities/line-items/{id}**: app/api/opportunities/line-items/[lineItemId]/route.ts:239 ✅ **NEW**
- ❌ **Missing**
  - POST /api/opportunities/{id}/close (won/lost endpoint with validation)
  - Caching layer (Redis) and cache-bust on writes
  - Audit event publishing on CRUD (helpers exist but not integrated)

Data Model vs Plan
- ✅ Present (Opportunity, OpportunityProduct, indexes)
  - prisma/schema.prisma:409-447 — Opportunity model with all core fields, relations, indexes
  - prisma/schema.prisma:449-469 — OpportunityProduct model with quantity, pricing, dates, relations
  - All MSAP fields are present in schema (name, stage, status, type, leadSource, amount, probability, forecastCategory, etc.)

UI/UX vs Plan
- ✅ **Done**
  - List columns and controls, server pagination, bulk actions, column preferences, CSV export
  - **Detail page with tabs (Details/Products/Activities/History)** ✅ **NEW**
  - **Line item management UI (create/edit/delete modals)** ✅ **NEW**
  - **Activities tab integrated with existing system** ✅ **NEW**
  - **History/audit tab reading from /api/audit-logs** ✅ **NEW**
- ⚠️ **Partial**
  - Saved views not wired on Opportunities page (ListHeader capability exists)
  - Soft delete via status mapping (UI done; semantics differ from explicit soft-delete field)
  - Amount/probability not editable in create/edit modals (displayed in detail view only)
- ❌ **Missing**
  - Kanban pipeline view
  - Import flow and UI
  - Stage transition enforcement and validation rules

RBAC & Security
- ✅ API enforces view any/assigned, edit any/assigned, and delete
- ✅ Line item endpoints enforce same RBAC (edit any/assigned)
- ⚠️ UI does not gate CSV export by permission
- ❌ No audit logging writes on these endpoints (required by plan; read API exists)

Performance/Observability
- ✅ Server-side pagination implemented; pageSize capped at 100
- ❌ No caching, tracing, or latency metrics to validate budgets
- ❌ DynamicTable uses scroll container; no row virtualization

UAT Checklist (from plan) — Current Status
- ✅ Create, view, edit, delete: **Fully satisfied** (list, detail page, modals)
- ❌ Stage transitions/probability rules: Not implemented
- ✅ **Products line items management and totals: Fully implemented** ✅ **NEW**
- ⚠️ List view performance (p95 < 500ms), pagination ≤100: Partial (pagination present; budgets unmeasured)
- ✅ RBAC (4-role): Implemented on API and line item endpoints
- ❌ Audit logs for CRUD/stage changes: Read capability exists; write-on-CRUD not implemented
- ❌ Browser matrix: Not verified

Recommended Next Steps (Priority Order)
1. **Add audit logging writes** — Integrate lib/audit.ts helpers into Opportunity and line item POST/PATCH/DELETE handlers
2. **Implement amount/probability management** — Add fields to create/edit modals; optionally auto-calculate amount from line item totals
3. **Stage transition rules** — Add validation matrix and required-fields-by-stage enforcement
4. **Close endpoint** — Add POST /api/opportunities/{id}/close with won/lost validations (e.g., lossReason required for Lost)
5. **Kanban view** — Add components/opportunity-kanban-view.tsx with drag-and-drop stage changes
6. **Import flow** — Add import UI and POST /api/opportunities/import endpoint
7. **Performance optimizations** — Add Redis caching for list endpoints; add latency instrumentation; implement row virtualization
8. **Saved views** — Wire savedFilterSets on Opportunities list page
9. **Export permission gating** — Add "opportunities.export" permission check before CSV export

Progress Summary
- **Major milestone achieved:** Full detail page with tabs now implemented, including Products line item CRUD, Activities integration, and History/Audit viewing
- **Completion estimate:** ~70% of M2 Opportunities scope complete
- **Remaining work:** Business logic (stage transitions, close flow, amount calculation), audit write integration, Kanban view, import, performance tuning

