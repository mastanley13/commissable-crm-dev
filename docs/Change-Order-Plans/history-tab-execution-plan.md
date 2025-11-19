# History Tab – Execution Plan (Detail Pages Aligned with Table Patterns)

Owner: Engineering  
Scope: Account, Contact, Opportunity, Product, Revenue Schedule detail pages  
Last Updated: 2025‑11‑18

This document turns the high‑level **History Tab Implementation Plan** into a concrete, step‑by‑step execution plan that mirrors the existing dynamic table patterns used across detail pages.

The goal is: **each detail page gets a History tab that uses the shared audit‑log API, renders a table matching our established table look/feel, and obeys existing permission and audit rules.**

---

## 1. Confirm Backend Audit Coverage per Entity

**Objective:** Ensure that all relevant changes for each entity are actually written into `AuditLog`, so the History tab has useful data.

**Tasks**
- [ ] **Accounts**
  - [ ] Review `app/api/accounts/[accountId]/route.ts` to confirm:
    - CREATE/UPDATE/DELETE (soft/permanent) and restore paths call `logAccountAudit`.
    - Important fields (name, status, owner) are included in `previousValues` / `newValues`.
  - [ ] Add any missing audit calls on secondary mutations (e.g., owner reassignment if not already covered).

- [ ] **Contacts**
  - [ ] Review `app/api/contacts/[id]/route.ts` for `logContactAudit` usage on CREATE/UPDATE/DELETE/restore.
  - [ ] Confirm that soft vs. permanent deletions are clearly distinguishable in audit metadata (e.g., `stage: 'soft' | 'permanent'`).

- [ ] **Opportunities**
  - [ ] Implement `logOpportunityAudit` in `lib/audit.ts` (mirroring `logAccountAudit`).
  - [ ] Wire `logOpportunityAudit` into `app/api/opportunities/[opportunityId]/route.ts` for:
    - [ ] CREATE (wherever it is handled).
    - [ ] UPDATE (PATCH).
    - [ ] DELETE / restore if supported.
  - [ ] Include key fields: name, stage, status, amount, owner, account.

- [ ] **Products**
  - [x] Implement `logProductAudit` in `lib/audit.ts` and use it in:
    - [x] `POST /api/products` (creation).
    - [x] `PATCH /api/products/[productId]` (updates, including active/inactive).
    - [x] `DELETE /api/products/[productId]` (hard delete with revenue‑schedule guard).
  - [ ] Confirm field coverage (code, names, active status, basic pricing/commission) and adjust if history consumers need more/less detail.

- [ ] **Revenue Schedules**
  - [ ] Implement `logRevenueScheduleAudit` in `lib/audit.ts`.
  - [ ] Wire into `app/api/revenue-schedules/[revenueScheduleId]/route.ts` (or equivalent):
    - [ ] CREATE
    - [ ] UPDATE (e.g., schedule date, status, expected/actual commission)
    - [ ] DELETE

**Deliverable:** For each entity, at least CREATE/UPDATE/DELETE are logged with meaningful `previousValues`/`newValues` so the History tab can explain “who changed what, and when”.

---

## 2. Shared History Table Component

**Objective:** Build a reusable History table that matches existing table UX (headers, pagination, styling) and can be dropped into any detail page tab.

**New file:** `components/audit-history-tab.tsx`

**Responsibilities**
- Fetch paginated audit log data from `GET /api/audit-logs`.
- Render a table whose visual design matches existing detail‑view tables (e.g., those in `account-details-view.tsx` / `contact-details-view.tsx`).
- Support:
  - [ ] Columns: Date/Time, User, Action, Field, From, To.
  - [ ] Grouping multiple field changes under a single “event” row with an expand/collapse affordance.
  - [ ] Client‑side filters: date range (Last 7 days / 30 days / All), action (Create/Update/Delete), and optionally user.
  - [ ] Pagination (page size 25 or 50) with the same pagination component used on other tables.

**Interface sketch**
- Props:
  - `entityName: 'Account' | 'Contact' | 'Opportunity' | 'Product' | 'RevenueSchedule'`
  - `entityId: string`
  - Optional presentation props (e.g., compact mode for tabs).
- Behavior:
  - On mount or when `entityId` changes, call `/api/audit-logs?entityName=...&entityId=...&page=1&pageSize=50`.
  - Map `changedFields` JSON into rows:
    - Each audit record becomes a “group”.
    - Within a group, one row per field change.
  - Use the same typography, spacing, and header styles as other detail tables (consult `Detail_View_Tables_Reference_Guide.md`).

**Implementation Steps**
- [ ] Design the minimal data model for the component (`HistoryEntry`, `HistoryFieldChange`) that maps directly from the API response.
- [ ] Implement data loading (with loading state, error state, empty state).
- [ ] Implement the table body using our `DynamicTable` where possible, or a small wrapper that mimics its look and feel.
- [ ] Add expand/collapse behavior to show/hide field‑level rows per event.
- [ ] Add client‑side filters (starting with date range + action).

---

## 3. Permissions and Tab Visibility

**Objective:** Show the History tab only when the user can view audit logs, and fail gracefully when the API denies access.

**Tasks**
- [ ] Confirm the permission rules in `app/api/audit-logs/route.ts`:
  - Currently: requires any of `auditLogs.read`, `auditLogs.manage`, or module‑level manage permissions.
- [ ] On the frontend, decide per entity how to gate the tab:
  - Option A (fast): Always render the tab; if `/api/audit-logs` returns 403/401, show an inline “no permission” message.
  - Option B (preferred): Drive tab visibility via user permissions from `auth-context` (e.g., check `user.permissions` or role code) and hide the tab entirely if the user cannot view audit logs.
- [ ] Implement a small helper (e.g., `canViewHistory(user, entityName)`) and reuse it in all detail views.

**Deliverable:** A consistent rule for when the History tab appears, matching the API’s access control, with a friendly message if the user lands there without permission.

---

## 4. Wire History Tab into Each Detail View

**Objective:** Add a History tab to each target detail page and integrate the shared history component.

**Targets**
- Accounts: `components/account-details-view.tsx`
- Contacts: `components/contact-details-view.tsx`
- Opportunities: `components/opportunity-details-view.tsx`
- Products: `components/product-details-view.tsx`
- Revenue Schedules: `components/revenue-schedule-supporting-details.tsx` (or dedicated details view, if present)

**Steps (per detail view)**
- [ ] Locate the tab configuration (`TABS` or similar) that defines the existing tabs (e.g., Details, Usage, Activities, etc.).
- [ ] Add a new tab entry:
  - Label: `History`
  - Key: `'history'`
- [ ] In the tab body rendering logic, mount `<AuditHistoryTab entityName="X" entityId={id} />` when the History tab is active.
- [ ] Ensure tab styling (font, spacing, active indicator) matches existing tabs.
- [ ] Apply the `canViewHistory` check:
  - If the user cannot view history, either:
    - Hide the tab entirely, or
    - Show a disabled tab with a tooltip (depending on UX choice).

**Design alignment**
- Use the same header styles, card layout, and table spacing that other tabs use in the same component.
- Respect responsive behavior (e.g., how other tables handle height and scrolling via `tableAreaRef`).

---

## 5. UX and Redaction Rules

**Objective:** Ensure the History tab is useful but does not leak sensitive or noisy data.

**Tasks**
- [ ] Define a list of fields that should not display raw values (e.g., passwords, tokens) – even if they appear in `changedFields`.
- [ ] Implement a small redaction layer in the history component:
  - If a field is in the redaction list, display `***` or a generic “(redacted)” instead of the actual `from` / `to` value.
- [ ] Add basic formatting rules:
  - Dates formatted consistently (`YYYY/MM/DD` + time).
  - Numbers formatted using existing helpers (currency, percent).
  - JSON values rendered in a compact, readable form or behind an “expand JSON” interaction.

---

## 6. QA Checklist

**Per Entity**
- [ ] Verify that a user with appropriate permissions can see the History tab.
- [ ] Perform a series of changes (create, edit, delete/restore) and confirm:
  - Entries appear in reverse chronological order.
  - User name, time, action, and changed fields are correct.
  - Field values match what actually changed on the entity.
- [ ] Attempt to access the History tab as a user without audit permissions:
  - Confirm the tab is hidden or a clear “no permission” message is shown.

**Cross‑cutting**
- [ ] Verify pagination works on large histories.
- [ ] Confirm performance is acceptable on tenants with many audit log entries (paging + indexes used).
- [ ] Ensure the History tab’s table visually matches other tables (row striping, typography, hover states, etc.).

---

## 7. Rollout Strategy

- Phase 1: Implement and release History tab for **Accounts** and **Contacts** (greatest existing audit coverage).
- Phase 2: Enable History for **Products** and **Opportunities** once their audit hooks are verified in staging.
- Phase 3: Add History for **Revenue Schedules** and any other audited entities as audit coverage is completed.

Each phase can be released independently as the shared component is reused.

