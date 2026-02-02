xxxxx# Commissable CRM - Patch Notes (through Jan 29, 2026)

These notes summarize recently implemented changes in the repo, based primarily on:
- `docs/plans/Commissable CRM — Master Dev Plan (Meetings Jan 21, 22, 26, 2026).md`
- `docs/plans/billing-status-lifecycle-implementation-checklist.md`
- `Reconciliation System.docx.md`

## Highlights

- Billing Status lifecycle automation (schedule-level `Open` / `Reconciled` / `In Dispute`), including manual/settlement override metadata and an idempotent engine wired into recompute.
- Reconciliation UX improvements (multi-select support, dynamic top/bottom grid filtering, safer default selection behavior, and formatting fixes).
- Deposit upload workflow improvements (mapping review UX + start import directly from Review).
- Deposit verification + ticketing enhancements for auditability and real-world reconciliation workflows.

## Changes by area

### Reconciliation - UI/UX

- Added multi-select support to enable 1:M and M:1 matching workflows. (P0-UI-004)
- Bottom revenue schedule grid now filters dynamically based on the selected status/context in the top deposit grid. (P0-UI-003)
- Default reconciliation view remains `Unmatched`, and the deposit line item status filter no longer includes a `Suggested` option (suggestions remain available in the revenue schedule suggestions table). (P0-UI-005)
- Opening a deposit no longer auto-selects the first deposit line item (prevents accidental filtering/matching). (P0-UI-006)
- Fixed reconciliation formatting:
  - Commission rate percentages now render at the correct scale (e.g., 16.00% vs 1,600%). (P0-UI-001)
  - Currency values now render with currency formatting. (P0-UI-001)
  - Column sizing/min-width behavior updated so key usage/commission columns can be tightened without breaking readability. (P0-UI-002)

### Matching / Account attribution

- Deposit mapping now supports `Account Legal Name`, and matching uses it (when uniquely resolvable) to attribute deposit line items to the correct account and filter candidate revenue schedules. (P0-REC-001)

### Deposit upload - Mapping Review flow

- Mapping Review UI restyled:
  - Mapped/Unmapped tabs (with row counts)
  - 3-column layout
  - Removed sample rows from Review (keeps review focused on mapping + validation). (P0-MAP-002)
- Upload flow change: import now starts from Review (Confirm step removed/merged). Review header now shows right-aligned `Rows detected` and `Mapped fields`, and Start Import explains why it is disabled when blocked. (P0-MAP-003)

### Deposit verification workflow

- Relabeled deposit `Date` field to `Report Date` for clarity.
- Added deposit verification fields to capture actual payment receipt details:
  - Received Date
  - Received By
  - Actual Received Amount. (P0-DEP-001)

### Ticketing / dispute tracking

- Ticketing enhancements to support vendor dispute workflows:
  - Added Vendor Ticket ID storage + UI
  - Added Vendor Contact lookup + display
  - Displayed Created By
  - Relabeled internal Ticket Number to `House Ticket Number`. (P0-DEP-002)

### Billing Status lifecycle (spec implementation)

- Implemented schedule-level Billing Status lifecycle:
  - `billingStatus` values: `Open`, `Reconciled`, `In Dispute`
  - Manual override metadata: `billingStatusUpdatedById`, `billingStatusUpdatedAt`, `billingStatusReason`
  - Source tracking to prevent recompute clobbering manual/settlement actions: `billingStatusSource = Auto | Manual | Settlement`. (Implemented and respected by recompute; 2026-01-29)
- Added a deterministic/idempotent Billing Status Engine and wired it into schedule recompute. (Implemented; 2026-01-29)
- Implemented the strict reconciliation rule: a schedule only becomes `billingStatus=Reconciled` after deposit finalize (not simply when `RevenueSchedule.status` is reconciled). (Implemented; 2026-01-29)
- Flex/chargeback semantics:
  - Flex Product schedule creation sets both the flex schedule and its parent/base schedule to `billingStatus=In Dispute`.
  - Chargeback schedules set `billingStatus=In Dispute` immediately on creation (approval gates are separate and do not auto-clear Billing Status).
  - Chargeback reversal schedules are created as `In Dispute` and remain so unless explicitly settled.
- Added a settlement endpoint (`POST /api/revenue-schedules/[revenueScheduleId]/settlement`) that sets `billingStatusSource=Settlement` and clears dispute to `Open` (or `Reconciled` if the deposit is finalized).
- Updated dispute-related UI flags/filters to prefer `billingStatus === In Dispute` where "Dispute" semantics are intended (Revenue Schedules API + dashboard quick filter; Opportunity schedule helpers).
- Rollout/safety:
  - Feature flag added for "spec billing status automation".
  - One-time backfill migration exists for legacy schedules (adjust if rule set changes).

### Tests

- Unit tests added for the Billing Status Engine mapping (flex, chargeback, strict reconciled rule).
- Integration tests added for apply-match, create-flex (FlexProduct), and chargeback approval flows to validate Billing Status transitions.

## Notes / follow-ups

- Automated Billing Status audit log coverage is partial (Flex Product parent/base auto-set emits an audit entry; broader "auto transition" audit event coverage is still pending).
- Consider running reports/filters side-by-side (old dispute heuristics vs `billingStatus`) until fully validated.
