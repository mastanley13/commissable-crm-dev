# History Tab – Refined Implementation Plan

Owner: Engineering  
Scope: Account, Contact, Opportunity, Product, Revenue Schedule detail pages  
Last Updated: 2025-11-18

This document is a **working implementation roadmap** for the History tab, meant to be used while building and reviewing PRs. It refines the existing:

- `history-tab-implementation-plan.md` (high-level design & estimates)
- `history-tab-execution-plan.md` (entity-level checklist)

into a **sequenced set of milestones and PR-sized work chunks**.

---

## 0. Assumptions & Non‑Goals

- `AuditLog` model and `GET /api/audit-logs` endpoint already exist and will be reused.
- Detail views already exist for all in-scope entities and use a tab-based layout.
- V1 History tab is **read-only** (no rollback/restore).
- Out of scope:
  - Bulk export or CSV download.
  - Live/streaming updates.
  - Cross-entity “timeline” views.

---

## Milestone A – Backend Audit Coverage & API Readiness

**Goal:** Ensure all in-scope entities reliably write meaningful audit records consumable by the History tab.

### A1. Confirm existing audit coverage (Accounts & Contacts)

- [ ] Review Account audit paths:
  - [ ] `app/api/accounts/[accountId]/route.ts` – verify `logAccountAudit` is called on CREATE/UPDATE/DELETE/restore.
  - [ ] Confirm important fields (name, status, owner, account code) appear in `previousValues` / `newValues`.
- [ ] Review Contact audit paths:
  - [ ] `app/api/contacts/[id]/route.ts` – verify `logContactAudit` on CREATE/UPDATE/DELETE/restore.
  - [ ] Ensure soft vs. permanent delete are distinguishable via metadata (e.g., `stage` or `action`).

**Exit criteria:** Account and Contact mutations produce consistent `AuditLog` entries with `changedFields` populated for key fields.

### A2. Implement audit helpers for missing entities

- [ ] Add convenience wrappers in `lib/audit.ts`:
  - [ ] `logOpportunityAudit`
  - [ ] `logProductAudit` (confirm/extend if already partially implemented)
  - [ ] `logRevenueScheduleAudit`
- [ ] Ensure each helper:
  - Accepts `tenantId`, `user`, `previousValues`, `newValues`, and `entity metadata`.
  - Uses `getChangedFields(previousValues, newValues)` to compute `changedFields`.
  - Tags `entityName` and `entityId` consistently with how the frontend will query.

**Exit criteria:** One call site per entity can log a realistic audit event using each helper.

### A3. Wire audit logging into mutation routes (Opportunities, Products, Revenue Schedules)

- [ ] Opportunities:
  - [ ] `app/api/opportunities/[opportunityId]/route.ts` – call `logOpportunityAudit` on:
    - [ ] CREATE (wherever create occurs; route or service).
    - [ ] UPDATE (PATCH).
    - [ ] DELETE / restore (if supported).
- [ ] Products:
  - [ ] `app/api/products/[productId]/route.ts` and related handlers – call `logProductAudit` on:
    - [ ] CREATE.
    - [ ] UPDATE (including active/inactive, pricing, commission).
    - [ ] DELETE (respecting revenue schedule constraints).
- [ ] Revenue Schedules:
  - [ ] `app/api/revenue-schedules/[revenueScheduleId]/route.ts` – call `logRevenueScheduleAudit` on:
    - [ ] CREATE.
    - [ ] UPDATE (date, status, amounts, commission).
    - [ ] DELETE.

**Exit criteria:** For each entity, CREATE/UPDATE/DELETE result in `AuditLog` entries with accurate `changedFields`.

### A4. API contract sanity check

- [ ] Validate `GET /api/audit-logs` response shape matches UI needs:
  - `createdAt`, `user`, `action`, `entityName`, `entityId`, `changedFields` (JSON).
- [ ] Confirm existing query params:
  - [ ] `entityName`, `entityIds` / `entityId`, pagination knobs (`page`, `pageSize`).
- [ ] Decide for V1:
  - [ ] Use **client-side filters only** (leveraging existing response).
  - [ ] Optionally, add server-side filter params (`action`, `userId`, `fromDate`, `toDate`) if low-risk.

**Exit criteria:** API can be called by the History tab without further schema changes; any additions are documented.

---

## Milestone B – Shared History UI Component

**Goal:** Build a reusable History tab component that consumes the audit API and matches existing table UX.

**New file:** `components/audit-history-tab.tsx`

### B1. Define component interface and types

- [ ] Component props:
  - [ ] `entityName: 'Account' | 'Contact' | 'Opportunity' | 'Product' | 'RevenueSchedule'`
  - [ ] `entityId: string`
  - [ ] Optional presentation props (e.g., `compact?: boolean`).
- [ ] Internal types:
  - [ ] `HistoryEvent` (one audit log record).
  - [ ] `HistoryFieldChange` (single field delta: name, from, to).
- [ ] Map directly from API response shape to internal types.

**Exit criteria:** Props and types are stable enough to be reused by all detail views.

### B2. Data loading, pagination, and states

- [ ] Implement data fetching:
  - [ ] On mount / `entityId` change, call `/api/audit-logs?entityName={entityName}&entityId={entityId}&page=1&pageSize=50`.
  - [ ] Handle pagination (page change updates query).
- [ ] States:
  - [ ] Loading (skeleton or spinner matching existing tables).
  - [ ] Error (inline message with retry).
  - [ ] Empty (friendly “No history yet” message).

**Exit criteria:** Component can fetch and render a basic list of audit events for a single entity with paging.

### B3. Table layout and grouping behavior

- [ ] Reuse or mimic existing table components (e.g., `DynamicTable` or similar):
  - [ ] Columns: Date/Time, User, Action, Field, From, To.
  - [ ] Align header styles, typography, and spacing with other detail tables.
- [ ] Grouping:
  - [ ] Treat each audit log record as an “event”.
  - [ ] Within an event, display one row per changed field.
  - [ ] Provide expand/collapse affordance per event (collapsed view shows summary: count of fields changed).

**Exit criteria:** Users can scan events at a high level and expand to see field-level changes, with a table that visually fits existing pages.

### B4. Client-side filters and basic formatting

- [ ] Filters (client-only for V1):
  - [ ] Date range quick picks: Last 7 days / 30 days / All.
  - [ ] Action filter: Create / Update / Delete.
  - [ ] Optional user filter (dropdown from visible events).
- [ ] Formatting:
  - [ ] Dates: consistent date/time format across rows.
  - [ ] Numbers: use existing currency/percentage helpers where available.
  - [ ] Long text: truncate with tooltip or “show more” affordance.

**Exit criteria:** Users can narrow down history to a reasonable subset and read values in a consistent format.

### B5. Redaction and sensitive-field handling

- [ ] Define a lightweight redaction strategy:
  - [ ] Central list of fields to redact (passwords, tokens, internal IDs, etc.).
  - [ ] Render redacted values as `***` or `(redacted)`.
- [ ] Consider JSON values:
  - [ ] Compact display by default; allow expanded view for complex objects.

**Exit criteria:** No obviously sensitive values are rendered raw in the History tab; redaction behavior is predictable.

---

## Milestone C – Permissions & Tab Visibility

**Goal:** Ensure the History tab only appears to users authorized to view audit logs, and fails gracefully otherwise.

### C1. Align with API permissions

- [ ] Inspect `app/api/audit-logs/route.ts` for current rules:
  - [ ] Required permissions (e.g., `auditLogs.read`, `auditLogs.manage`, entity manage permissions).
- [ ] Decide frontend strategy:
  - [ ] Preferred: gate History tab visibility with a helper based on `user.permissions` (from auth context).
  - [ ] Fallback: optimistic render + handle 403/401 with an inline “You do not have permission” message.

### C2. Implement `canViewHistory` helper

- [ ] Add a helper, e.g., `canViewHistory(user, entityName)` in a shared permissions utility:
  - [ ] Encapsulate mapping from entityName to required permission(s).
  - [ ] Expose a simple boolean to detail views.

**Exit criteria:** Any detail view can reliably decide whether to show the History tab based on a single helper.

---

## Milestone D – Wire History Tabs into Detail Views

**Goal:** Add a History tab to each target detail view and mount the shared component.

### D1. Accounts

- [ ] `components/account-details-view.tsx`:
  - [ ] Locate tab configuration (`TABS` or equivalent).
  - [ ] Add `History` tab (key: `'history'`).
  - [ ] When active, render `<AuditHistoryTab entityName="Account" entityId={account.id} />`.
  - [ ] Apply `canViewHistory` to show/hide the tab.

### D2. Contacts

- [ ] `components/contact-details-view.tsx`:
  - [ ] Extend tab configuration to include `History`.
  - [ ] Render `<AuditHistoryTab entityName="Contact" entityId={contact.id} />`.
  - [ ] Apply `canViewHistory`.

### D3. Opportunities

- [ ] `components/opportunity-details-view.tsx`:
  - [ ] Add `History` tab.
  - [ ] Render `<AuditHistoryTab entityName="Opportunity" entityId={opportunity.id} />`.
  - [ ] Apply `canViewHistory`.

### D4. Products

- [ ] `components/product-details-view.tsx`:
  - [ ] Add `History` tab.
  - [ ] Render `<AuditHistoryTab entityName="Product" entityId={product.id} />`.
  - [ ] Apply `canViewHistory`.

### D5. Revenue Schedules

- [ ] Revenue schedule detail view component (e.g., `components/revenue-schedule-details-view.tsx` or equivalent):
  - [ ] Add `History` tab.
  - [ ] Render `<AuditHistoryTab entityName="RevenueSchedule" entityId={revenueSchedule.id} />`.
  - [ ] Apply `canViewHistory`.

**Exit criteria:** All in-scope detail pages have a History tab wired to the shared component, respecting permissions.

---

## Milestone E – UX Polish & Edge Cases

**Goal:** Align the History tab experience with the rest of the app and handle non-happy paths.

- [ ] Visual polish:
  - [ ] Match table header styles, row striping, hover states, and spacing to existing tables.
  - [ ] Ensure tab header label/ordering feels consistent across entities.
- [ ] Behavior:
  - [ ] Confirm history pagination behaves well with long histories.
  - [ ] Verify load/error states fit existing design patterns.
- [ ] Edge cases:
  - [ ] Entities with no history.
  - [ ] Users with partial permissions (e.g., can see Accounts but not audit logs).
  - [ ] Very large `changedFields` entries (performance and rendering).

**Exit criteria:** History feels like a first-class, native tab with predictable behavior under error and edge conditions.

---

## Milestone F – QA, Validation & Rollout

**Goal:** Validate correctness across entities and roll out safely in phases.

### F1. QA checklist per entity

- [ ] As a user with audit permissions:
  - [ ] Perform create, update, delete/restore flows.
  - [ ] Confirm entries appear in reverse chronological order.
  - [ ] Verify user, action, and field-level changes match actual behavior.
- [ ] As a user without audit permissions:
  - [ ] Confirm History tab is hidden or clearly blocked (per chosen UX).

### F2. Cross-cutting validation

- [ ] Performance:
  - [ ] Test against tenants with many audit entries; confirm queries stay within acceptable latency.
  - [ ] Validate pagination and any server-side filters use existing indexes.
- [ ] Security & privacy:
  - [ ] Confirm redacted fields never show raw values.
  - [ ] Sanity check that only expected users can access `/api/audit-logs`.

### F3. Rollout phases (suggested)

- [ ] Phase 1: Accounts & Contacts
  - [ ] Enable History using existing audit coverage.
- [ ] Phase 2: Products & Opportunities
  - [ ] Enable once audit hooks for these entities are validated in staging.
- [ ] Phase 3: Revenue Schedules (and other audited entities)
  - [ ] Turn on after confirming instrumentation and UI behavior.

**Exit criteria:** History tab is enabled for all in-scope entities with acceptable performance, correct permissions, and no major UX or security regressions.

---

## Recommended PR Breakdown

This section suggests how to slice the work into reviewable PRs. Adjust as needed to fit team practice.

- **PR1 – Backend audit helpers & instrumentation**
  - Implement `logOpportunityAudit`, `logProductAudit`, `logRevenueScheduleAudit` in `lib/audit.ts`.
  - Wire audit logging into Opportunities, Products, and Revenue Schedule routes.
  - Add/update tests for audit logging where feasible.

- **PR2 – Minimal `AuditHistoryTab` (Accounts only)**
  - Create `components/audit-history-tab.tsx` with basic data fetch + table (no filters).
  - Wire History tab into `account-details-view.tsx` guarded by permissions.
  - Validate end-to-end for Accounts in staging.

- **PR3 – Filters, grouping, and redaction**
  - Add grouping, expand/collapse behavior, and client-side filters.
  - Implement redaction rules and formatting for dates/numbers.

- **PR4 – Wire remaining entities**
  - Add History tabs for Contacts, Opportunities, Products, and Revenue Schedules.
  - Apply `canViewHistory` consistently.

- **PR5 – UX polish & rollout toggles (if needed)**
  - Final visual tweaks, edge-case handling, and any feature flagging / phased rollout configuration.

