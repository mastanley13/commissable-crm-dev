# History Tab – Implementation Plan and Estimates

Owner: Engineering
Target screens: Account Details, Contact Details, Opportunity Details, Product Details, Revenue Schedule Details

## Goal
Add a read‑only History tab to the above detail pages that shows who changed what and when. The tab uses a single, paginated API and a common UI component. It should support basic filters and be permission‑gated.

## Current State (as of this repo)
- Prisma already defines an `AuditLog` model with indexes and an `AuditAction` enum. See `prisma/schema.prisma` (model `AuditLog`).
- There is a GET endpoint at `GET /api/audit-logs` that returns logs by `entityName` and `entityId(s)` with pagination and user info.
- Central logging utilities exist in `lib/audit.ts` (`logAudit`, `getChangedFields`, helpers for Account/Contact/Activity/User).
- Account and Contact API routes already call the audit helpers on update/delete/restore. Opportunities, Products, and Revenue Schedules currently do not consistently log audit events, and UI pages do not yet expose a History tab.

Implication: We can reuse the existing schema and API; the main work is UI + completing backend instrumentation for entities that don’t yet log changes.

## Scope
Deliver a History tab on each target detail page that:
- Lists audit entries with columns: Date/Time, User, Action, Field, From, To, (optional) Source/Metadata.
- Groups by change “event” (one update may have multiple field deltas), with an expandable row to reveal full details.
- Paginates (page size 50 by default) and supports quick filters (date range, user, action).
- Obeys permissions: show tab only if the user has any of `auditLogs.read`, `auditLogs.manage`, or a module‑specific manage permission on the underlying entity (matching the existing API guard).

Out of scope: Version rollback/restore, streaming live updates, CSV export (can be follow‑ups).

## Design Overview
1) Data model: reuse `AuditLog`.
   - Fields we will display: `createdAt`, `user?.fullName|email`, `action`, `changedFields` (JSON mapping of field -> {from,to}).
   - Indexes already exist: `@@index([tenantId, entityName, entityId])` and `@@index([tenantId, createdAt])`.
   - Optional (future): add a `changeGroupId` to group multi‑entity transactions; not needed for V1.

2) API layer:
   - Reuse `GET /api/audit-logs?entityName=Account&entityId=...` with pagination. It already supports `entityIds` for batch detail pages if needed.
   - Optional (future): add query params for `action`, `userId`, and date range for filtering server‑side.

3) Backend instrumentation gaps:
   - Add structured logging in these routes using `logAudit` with calculated `changedFields`:
     - Opportunities: `app/api/opportunities/[opportunityId]/route.ts` (PATCH, DELETE, and any CREATE flows if present elsewhere).
     - Products: `app/api/products/[productId]/route.ts` (PATCH and any CREATE/DELETE endpoints).
     - Revenue Schedules: `app/api/revenue-schedules/[revenueScheduleId]/route.ts` (PATCH and any CREATE/DELETE endpoints).
   - Implement convenience wrappers in `lib/audit.ts`: `logOpportunityAudit`, `logProductAudit`, `logRevenueScheduleAudit` mirroring `logAccountAudit`/`logContactAudit`.
   - For V1, log at the end of successful mutations with: `{ previousValues, newValues, changedFields }` from `getChangedFields(prev, next)`.
   - Optional (future): wrap mutating calls in a small service that always logs upon success to avoid missed paths.

4) UI component (shared): `components/audit-history-tab.tsx`
   - Props: `{ entityName: 'Account'|'Contact'|'Opportunity'|'Product'|'RevenueSchedule', entityId: string }`.
   - Fetch: calls `/api/audit-logs` with pagination; renders list (or a compact table) with expandable rows.
   - Display rules:
     - Show a one‑line summary per field change: `Field → From → To`.
     - Truncate long text with tooltip; pretty‑print JSON objects.
     - Redact secrets/PII fields if we flag them (see below).
   - Filters: client‑side date range, action, and user filter; wire up query params if server‑side filtering is later added.
   - Empty/edge states and loading skeletons included.

5) Add tab to each detail page
   - Account: `components/account-details-view.tsx` – extend `TABS` to include `History`; mount `AuditHistoryTab` when selected.
   - Contact: `components/contact-details-view.tsx` – same.
   - Opportunity: `components/opportunity-details-view.tsx` – same.
   - Product: `components/product-details-view.tsx` – same.
   - Revenue Schedule: `components/revenue-schedule-details-view.tsx` – same.
   - Only render the tab if the user has view permission (use the same permission checks used elsewhere or a simple probe to `/api/audit-logs` and hide on 403).

6) Privacy, security, and performance
   - Permissions: the API already requires `auditLogs.read|manage` OR certain module manages. UI should hide the tab if not allowed.
   - Redaction: define a lightweight redaction list (field codes or column names) for sensitive data (e.g., passwords, tokens, SSNs); in the UI, show `•••` for values whose keys are in the exception list. CSVs and raw JSON should also respect redaction.
   - Pagination: default `pageSize=50`, provide “Load more” or numbered pagination. Indexes already support the query shape.
   - Retention: optional policy (e.g., 18–24 months) documented; no change needed for V1.

7) Migration / backfill (optional but recommended)
   - Backfill a single `Create` audit event for existing records so the first row shows when the record was created. Implement a script in `scripts/backfill-audit-logs.ts` that inserts a `Create` entry for entities that are missing any log.

8) Testing & QA
   - Unit tests for `getChangedFields` and new audit wrapper helpers.
   - Integration tests for each patched API endpoint to assert one audit row is created with expected `action` and `changedFields`.
   - UI smoke tests per page: load History tab, see rows, expand, paginate.
   - Manual QA checklist covering permissions (show/hide), pagination, redaction, and basic performance.

## Step‑by‑Step Plan (with estimates)
Time is expressed in ideal engineering days (8h). Ranges reflect uncertainty.

1) Finalize requirements and UI spec (0.5–1 day)
   - Confirm columns, copy, and permission rules.
   - Align on V1 filters and deferables (CSV export, server‑side filters).

2) Schema verification (0–0.5 day)
   - The existing `AuditLog` model is sufficient for V1; no migration required.
   - Optional: design note for a future `changeGroupId` if we later need atomic grouping across entities.

3) Backend instrumentation completion (1.5–2.5 days)
   - Add `logOpportunityAudit`, `logProductAudit`, `logRevenueScheduleAudit` helpers.
   - Wire them in the respective API routes on CREATE/UPDATE/DELETE paths.
   - Verify existing Account and Contact logs cover restore/soft‑delete flows.

4) API polish (0–0.5 day)
   - Reuse existing `/api/audit-logs` route.
   - Optionally add server‑side filters for `action`, `userId`, and date range if needed immediately.

5) Shared UI component (0.75–1.25 days)
   - Build `AuditHistoryTab` component with fetch, pagination, expandable rows, and redaction support.
   - Add compact rendering for long/JSON values.

6) Wire tab into 5 detail pages (0.75–1.25 days)
   - Update each `*-details-view.tsx` to add the `History` tab and mount `AuditHistoryTab` with the correct `entityName` and `entityId`.
   - Gate by permission and ensure graceful empty/loading states.

7) Tests + QA (0.75–1.25 days)
   - API integration tests for the newly instrumented routes.
   - UI smoke tests and manual QA pass across all five pages.

8) Docs and handoff (0.25 day)
   - Add short README in `docs/` describing usage, permissions, and redaction list management.

Estimated total: 4.5–7.25 days (most teams land around 5–6 days).

## Milestone‑based Breakdown
- Milestone A (backend ready): Steps 2–4 complete; logs are being written and fetched. 2–3 days.
- Milestone B (Account + Contact UI): Step 5 done, tabs added on these pages. +0.75–1.25 days.
- Milestone C (All entities UI): Wire remaining three pages. +0.75–1.25 days.
- Milestone D (Tests + QA + Docs): Step 7–8. +1–1.5 days.

## Acceptance Criteria
- A History tab appears on the five target detail pages for users with permission.
- The tab lists audit entries in reverse chronological order and paginates.
- Each update shows per‑field diffs with old/new values, with sensible truncation and tooltips.
- Sensitive fields are redacted per a configurable list.
- Creating, updating, deleting across Accounts, Contacts, Opportunities, Products, and Revenue Schedules produces audit rows.

## Risks and Mitigations
- Incomplete instrumentation: centralize helpers and review all mutation paths to avoid misses.
- Large JSON values: truncate and add “View raw” expansion; ensure the API keeps values as JSON.
- PII exposure: maintain a redaction allow/deny list and enforce at render time; consider a server‑side redaction pass later.
- Query volume on large tenants: use the existing indexes and paginate; consider adding date filters on the API if needed.

## Concrete File Touch List (planned)
- Backend
  - `lib/audit.ts` – add `logOpportunityAudit`, `logProductAudit`, `logRevenueScheduleAudit`.
  - `app/api/opportunities/[opportunityId]/route.ts` – call audit helpers on PATCH/DELETE.
  - `app/api/products/[productId]/route.ts` – call audit helpers on PATCH (and any CREATE/DELETE handlers).
  - `app/api/revenue-schedules/[revenueScheduleId]/route.ts` – call audit helpers on PATCH (and any CREATE/DELETE handlers).
  - (Optional) `app/api/audit-logs/route.ts` – add filter params if needed.
- Frontend
  - `components/audit-history-tab.tsx` – new shared component.
  - `components/account-details-view.tsx` – add History tab.
  - `components/contact-details-view.tsx` – add History tab.
  - `components/opportunity-details-view.tsx` – add History tab.
  - `components/product-details-view.tsx` – add History tab.
  - `components/revenue-schedule-details-view.tsx` – add History tab.
- (Optional) `scripts/backfill-audit-logs.ts` – seed Create events for legacy data.

## Fast‑Track Variants
- Account‑only V1 (uses existing instrumentation): 1.5–2.0 days to build the shared component and wire it into Accounts.
- Minimal UI (no filters, simple list): subtract ~0.25–0.5 day.

## Next Steps
1) Confirm the exact column set and redaction list.
2) Approve the estimate and choose either full scope or Account‑only fast track.
3) Implement Milestone A → B first; release History on Accounts/Contacts quickly, then complete the remaining entities.

