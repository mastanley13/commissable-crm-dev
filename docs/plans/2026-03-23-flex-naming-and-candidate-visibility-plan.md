---
title: Flex Naming and Candidate Visibility Standardization Plan
owner: Engineering / Product
status: Draft
last_updated: 2026-03-23
source_feedback:
  - docs/notes/Reconciliation Maching Issues and Workflow.docx.md
  - docs/analysis/2026-03-12-march-2026-spec-comparative-analysis.md
  - docs/analysis/2026-03-18-reconciliation-e2e-validation-update.md
---

# Flex Naming and Candidate Visibility Standardization Plan

## Goal

Standardize flex schedule naming and visibility so that:

- all new flex children use `[parent].[sequence]`
- legacy `FLEX-...` naming is retired
- flex children do not appear in normal reconciliation candidate suggestions
- flex schedules remain visible only in the flows that are meant to manage them

## Working assumptions

- The March 2026 client memo is the governing rule for flex child naming and visibility.
- Flex child schedules are user-initiated only. They are not created during preview or intermediate selection steps.
- Normal reconciliation candidate search should only return schedules that are valid normal matching targets, not flex holding records.

## Current-state summary

- `lib/flex/revenue-schedule-flex-actions.ts` still contains `buildFlexChildScheduleNumber`, which emits legacy `FLEX-...` identifiers.
- The same file also supports child numbering through `generateChildRevenueScheduleName`, so two naming patterns currently coexist.
- `lib/flex/revenue-schedule-display.ts` and `tests/revenue-schedule-display.test.ts` explicitly preserve `FLEX-...` display behavior.
- `lib/matching/deposit-matcher.ts` does not exclude flex schedules from normal candidate selection, so orphaned or legacy flex rows can surface in Suggested Matches.
- The March 2026 note shows that legacy and orphaned flex rows create operator confusion before any new match is applied.

## Gap-to-root-cause map

| Required outcome | Current gap | Root cause | Planned fix |
| --- | --- | --- | --- |
| All new flex children must use `[parent].[sequence]` | New code can still generate `FLEX-...` values | Two naming helpers remain active | Route all flex child creation through one canonical numbering helper |
| `FLEX-...` must be retired | Legacy records and display helpers keep the old format alive | No formal migration or deprecation plan exists | Inventory, migrate, or quarantine legacy rows and remove the old helper |
| Flex children must not appear in normal candidate suggestions | Candidate matching queries include flex rows | Candidate retrieval filters only by status/date/deletedAt | Add a shared "normal matching target" filter that excludes flex rows |
| Flex schedules should appear only where intended | The system has no single visibility contract for flex rows | Matching, display, and reporting paths evolved independently | Define flex visibility rules per surface and encode them in query helpers |
| Undo must remove flex artifacts created by a match | Old orphan rows can persist and confuse future matching | Historical cleanup has been inconsistent and ownership is not always explicit | Keep match-group ownership clear and enforce delete-on-undo for flex child creation |

## Remediation workstreams

### 1. Lock the canonical naming and visibility contract

- Define the canonical naming rule:
  - first child: `12698.1`
  - second child: `12698.2`
  - and so on
- Define the visibility rule:
  - flex children are hidden from normal suggested matches and general schedule candidate queries
  - flex children remain visible in:
    - Flex Review or Flex Schedule Report
    - parent schedule detail as linked children
    - audit and reporting surfaces that explicitly deal with flex
- Decide whether chargeback and chargeback-reversal schedules follow the same visibility rule or a specialized variant.

Exit criteria:

- Engineering and product have one written contract for flex naming and flex visibility.

### 2. Remove legacy naming from creation paths

- Delete or deprecate `buildFlexChildScheduleNumber`.
- Route all new flex child numbering through `generateChildRevenueScheduleName`.
- Ensure any preview route only computes the proposed child number; it does not create the schedule row.
- Ensure Option C apply is the only place that persists the child schedule.

Exit criteria:

- No new code path generates `FLEX-...` identifiers for flex child schedules.
- Preview paths can show a proposed child name without inserting any records.

### 3. Audit and clean up existing flex rows

- Build a one-time inventory of existing flex rows grouped into:
  - valid child schedules with `parentRevenueScheduleId`
  - legacy `FLEX-...` rows that can be migrated safely
  - orphaned flex rows that should be deleted or soft-deleted
  - duplicate candidates that require case-by-case review
- For valid legacy rows:
  - backfill `parentRevenueScheduleId` where possible
  - rename them into `[parent].[sequence]` if no collision exists
- For orphaned or invalid rows:
  - delete or quarantine them so they no longer pollute matching results
- Produce a dry-run report before changing production-like data.

Exit criteria:

- The team has a clear migration script or cleanup runbook for existing legacy flex data.
- Legacy `FLEX-...` rows no longer appear as active matching targets.

### 4. Add candidate-query filtering and explicit surface scoping

- Add a shared filter for normal reconciliation candidates, for example:
  - `flexClassification = Normal`
  - exclude child-only flex rows
  - exclude soft-deleted legacy flex artifacts
- Apply that filter in:
  - `lib/matching/deposit-matcher.ts`
  - `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route.ts`
- Keep flex rows accessible through explicit flex/reporting queries instead of generic matching queries.
- Review any fallback matching path so it cannot reintroduce flex rows after the strict query returns no results.

Exit criteria:

- Normal candidate search never returns flex holding rows.
- Flex review and reporting still surface the records that finance users need to resolve.

### 5. Harden undo and lifecycle ownership

- Ensure every flex child created by matching is owned by a match group or undo-log record that can target it precisely.
- On undo or unmatch:
  - delete the created child flex schedule
  - delete related adjustment rows if the match also created them
- Preserve the current March 18 unmatch regression coverage and extend it if needed so this behavior stays stable.

Exit criteria:

- A flex child created by a match never remains as an orphaned candidate after undo.

### 6. Update tests and display rules

- Update `tests/revenue-schedule-display.test.ts` so the canonical `.1` style is the expected behavior going forward.
- Add or expand candidate tests to assert:
  - normal schedules are returned
  - flex children are excluded
  - legacy `FLEX-...` rows are excluded
- Keep or extend unmatch regression coverage so deletion and visibility rules are protected.
- Add tests around name generation if sequence collisions or parentless flex creation are possible edge cases.

Exit criteria:

- Naming and visibility rules are enforced by automated tests, not just by cleanup scripts.

## Suggested implementation order

1. Finalize the naming and visibility contract.
2. Remove legacy naming from creation helpers.
3. Add candidate-query filters.
4. Build and dry-run the legacy data cleanup script.
5. Update display rules and automated tests.
6. Run the disposable-DB candidate and unmatch regression suite.

## Expected file touchpoints

- `lib/flex/revenue-schedule-flex-actions.ts`
- `lib/revenue-schedule-number.ts`
- `lib/flex/revenue-schedule-display.ts`
- `lib/matching/deposit-matcher.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/resolve-flex/route.ts`
- `app/api/reconciliation/deposits/[depositId]/matches/apply/route.ts`
- `tests/revenue-schedule-display.test.ts`
- `tests/integration-reconciliation-candidates.test.ts`
- `tests/integration-reconciliation-unmatch-regression.test.ts`
- `scripts`

## Acceptance criteria

- No new flex child schedule is created with a `FLEX-...` number.
- All new flex children use `[parent].[sequence]`.
- Normal candidate suggestions exclude flex children and legacy flex artifacts.
- Flex child schedules remain visible in flex review, flex reporting, and parent-detail contexts only.
- Undo removes any flex child created by the match that introduced it.
- Existing legacy data is either migrated safely or removed from active matching surfaces.

## Risks and open decisions

- Some historical `FLEX-...` rows may not have enough parent metadata to migrate automatically.
- External references or screenshots may still use legacy names and will need coordinated update after migration.
- The team must decide whether chargeback and chargeback-reversal schedules are hidden by the same query filter or by a related but separate rule.

