# Milestone 3 — Ops Polish (Flex Review Queue)

Date: 2026-02-02

## What changed (implementation summary)

### Flex Review Queue API

* Added server-side filters + pagination support for Flex Review items.
* Added CSV export for the filtered queue.
* Added bulk resolve/reject endpoint for **non-chargeback** items (chargebacks must be approved).

### Flex Review Queue UI

* Queue now drives filters against the API (server-side).
* Added pagination controls (page navigation + page size).
* Added CSV export button (downloads server-generated CSV for the filtered queue).
* Improved bulk UX for mixed selection (shows counts, skips chargebacks for resolve, reports errors).

### Notifications (digest)

* Added digest generation for reconciliation managers:
  * A permission-gated endpoint for managers to trigger the digest for the current tenant.
  * A JOB_SECRET-gated job endpoint intended for schedulers/cron (per-tenant or all-tenant).

## How to test in the browser

### 1) Filters + pagination

1. Navigate to `Reconciliation → Flex Review Queue` (URL: `/reconciliation/flex-review`).
2. Apply filters (Status, Assignee, Type, Reason, Vendor, Distributor, Schedule, Min age, Min $).
3. Verify:
   * The list updates to reflect filters.
   * Page resets to 1 when you change filters.
   * Pagination shows “Page X of Y” and next/prev behave as expected.

Expected result: the list and “(total)” count reflect server-side filtering, and pagination returns different rows when you change page.

### 2) CSV export matches filters

1. Apply a narrow set of filters (so you can eyeball results).
2. Click `Export CSV`.
3. Verify:
   * The CSV rows match the queue’s filtered results.
   * Key columns look correct (Status, Flex Type, Flex Reason, Schedule, Parent Schedule, Expected Commission, Vendor/Distributor, Assigned To).

Expected result: CSV contains all matching rows (not just the current page) and respects the same filters.

### 3) Bulk actions on mixed selections

1. Filter to Status = Open.
2. Select a **mix** of:
   * chargeback items (FlexChargeback / FlexChargebackReversal)
   * non-chargeback items (all other flex classifications)
3. Try the bulk actions:
   * `Assign to me` / `Unassign`: should update assignments on open items.
   * `Resolve` / `Reject`: should affect only **non-chargeback** items; chargebacks should be skipped with a message.
   * `Approve & Apply` (Admin-only): should approve/apply chargeback items; non-admin users should not be able to apply.

Expected result: bulk resolve/reject returns partial success when mixed sets are selected, and the UI reports skipped chargebacks + errors when present.

### 4) Digest notifications

1. As a reconciliation manager, call the digest job (see API section below) or trigger it from the manager endpoint.
2. Navigate to `/notifications`.
3. Verify a notification exists titled `Flex Review Queue Digest (YYYY-MM-DD)` and the counts look reasonable.

Expected result: 1 notification per day per user (idempotent).

## API verification (Postman/curl examples)

### Flex Review API (filters/pagination)

* JSON: `GET /api/flex-review?status=Open&assignment=all&page=1&pageSize=200`
* CSV: `GET /api/flex-review?status=Open&format=csv&includeAll=true`

### Bulk resolve/reject (non-chargeback only)

`POST /api/flex-review/bulk/resolve`

Body:

```json
{
  "itemIds": ["..."],
  "status": "Resolved",
  "notes": "Bulk resolved during ops triage"
}
```

### Digest (manager-triggered, current tenant)

`POST /api/flex-review/digest?minAgeDays=7`

### Digest (job endpoint for scheduler/cron)

`POST /api/jobs/flex-review-digest?minAgeDays=7`

Headers:

* `x-job-secret: $JOB_SECRET`

Optional query params:

* `tenantId=<tenantId>` — run for a single tenant
* `dryRun=true` — compute counts but do not create notifications

## Go / No-Go for Milestone 4

Recommend starting Milestone 4 once these are green:

* Filters and CSV parity confirmed with real tenant data.
* Bulk mixed-set behavior confirmed (resolve/reject skips chargebacks; approve-only for admins).
* Pagination verified with >500 matching records (ensures multiple pages).
* Digest job is scheduled (or at least proven manually) and notifications show up correctly.

If Milestone 4 depends on ops workflow stability (reports/close processes), completing the above first will reduce regressions.
