# Development Task Summaries

This file is now being used as a cumulative running log so task summaries from different agents can be added without removing prior entries.

## Entry 1: Reconciliation Unmatch Rollback / Archived Schedule Cleanup

## 1. Issues Identified
- Reconciliation unmatch was not a full rollback. It could remove visible allocations while leaving behind schedule adjustments, `apply-to-future` mutations, and Flex-created side effects.
- Line-level and bulk unmatch behavior were drifting because they were implemented through different paths with different assumptions.
- Unmatch behavior on finalized/reconciled deposits was underspecified and not consistently guarded.
- During live validation, we found a second data-integrity defect: a deposit line could remain `Partially Matched` against a revenue schedule that had already been soft-deleted, leaving the line allocated while the lower schedule grid showed nothing usable.
- The live bad row confirmed a deeper root cause: at least one match path allowed `DepositLineMatch` rows to exist against archived schedules, and allocation recompute still counted those deleted-schedule matches.

## 2. Changes Implemented
- Added a dedicated reconciliation undo-log model and migration so match-created non-derivable mutations can be reversed deterministically.
- Added shared rollback helpers in `lib/reconciliation/undo-log.ts`.
- Added a shared unmatch reversal service in `lib/reconciliation/unmatch-reversal.ts`.
- Refactored both unmatch entry points to use the same reversal engine:
  - `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route.ts`
  - `app/api/reconciliation/deposits/[depositId]/bulk/unmatch-allocations/route.ts`
- Wired mutation logging into the match/adjustment flows that create reversible side effects:
  - direct adjustment writes in `apply-match`
  - future-schedule mutations in `lib/reconciliation/future-schedules.ts`
  - auto-fill/match metadata writes in `lib/matching/auto-fill.ts`
  - Flex-created schedule flows in `lib/flex/revenue-schedule-flex-actions.ts`
- Added finalized-state protection so unmatch is blocked until the deposit is unfinalized.
- Added regression coverage for:
  - within-tolerance rollback
  - `apply-to-future` rollback
  - finalized-state blocking
  - Flex-created schedule cleanup
  - deleted-schedule candidate hiding
  - bulk unmatch cleanup of soft-deleted matched schedules
- Patched the candidate/grid and bulk-unmatch behavior for soft-deleted schedules:
  - hidden archived schedules from the reconciliation candidates grid
  - allowed bulk unmatch to clean up orphaned matches even if the selected revenue schedule had already been archived

## 3. Reasoning Behind Changes
- Unmatch is the system's reconciliation integrity safeguard, so it must reverse persisted side effects, not just update the UI.
- `apply-to-future` and Flex-creation flows mutate future schedules and create new records, so they need durable provenance and a single transaction-safe rollback path.
- One shared reversal service prevents bulk and line-level unmatch from drifting over time.
- Archived schedules should not appear as valid match targets, but the system still needs to be able to clean up historical bad rows that already reference them.
- Live validation showed that bad historical data can exist independently of the new rollback flow, so the task also required targeted repair and defect isolation, not only code changes.

## 4. Expected Behavior
- Unmatch removes the selected match rows and restores the affected deposit line, revenue schedules, and deposit aggregates to their pre-match state.
- Any adjustment fields written because of the match are reset.
- Any future-schedule deltas written through `apply-to-future` are reversed.
- Flex schedules created by the matched flow are retired when that match is undone.
- Reconciled/finalized deposits cannot be unmatched until explicitly unfinalized first.
- Soft-deleted revenue schedules do not appear in the bottom reconciliation grid as active matched/suggested schedules.
- If historical bad data still exists, bulk unmatch can clean up the orphaned match rows instead of failing with "Unknown revenue schedule id(s)".

## 5. Client Summary
- The reconciliation unmatch flow was upgraded from a partial cleanup into a shared rollback engine with provenance for reversible mutations.
- The immediate browser error around archived schedules blocking unmatch was fixed.
- During validation we found and repaired one live bad partial-match row where a deposit line was still allocated to archived revenue schedule `12709`.
- That repair removed the orphaned `DepositLineMatch`, reset the line's allocations, and brought the live deposit back into a clean state for that line.
- Two residual code defects were also identified for follow-up:
  - match paths still need a hard `deletedAt: null` guard at initial schedule lookup
  - line allocation recompute should ignore matches tied to deleted schedules

## 6. Testing Performed
- Ran static verification:
  - `npx tsc --noEmit --pretty false`
- Added and registered targeted regression coverage in:
  - `tests/integration-reconciliation-unmatch-regression.test.ts`
  - `tests/integration-reconciliation-candidates.test.ts`
- Test files were discovered successfully, but full integration execution was not run against a disposable database in this task because the local integration harness requires `TEST_DATABASE_URL` and truncates the target database.
- Performed live/browser validation against reconciliation flows and investigated multiple production-like failure states.
- Queried the database directly to identify the orphaned partial match:
  - deposit line item `ea51b9e3-7354-4bad-a2f2-9d376173c165`
  - revenue schedule `12709`
  - revenue schedule id `9cca61e0-d963-45a8-8932-d7f687e35b30`
  - orphaned match id `645b609f-f655-4e9a-9d03-ac27245ed7f6`
- Performed a one-time live data repair by force-unmatching that archived-schedule match and recomputing:
  - line allocations/status
  - archived schedule actuals/status
  - deposit aggregates
- Verified after repair:
  - the line had no remaining `DepositLineMatch` rows
  - the line returned to `Unmatched`
  - allocated usage/commission reset to `0`
  - primary schedule linkage was cleared

---

## Entry 2: Match Wizard Validation UX Update

## 1. Issues Identified
- The Match Wizard still framed the workflow as `Preview` even though the result was being used as validation before apply.
- The modal used mixed labels such as `Preview`, `Run Preview`, and `Run Validation Again`, which made the flow harder to understand.
- The UI did not emphasize the positive state where validation completed with no issues.
- Validation messaging was spread across several places instead of presenting one clear current status.
- The many-to-one replacement path still needed to remain visible and functional while the modal UX changed.

## 2. Changes Implemented
- Updated `components/reconciliation-match-wizard-modal.tsx` so the user-facing step is now `Validation` instead of `Preview`.
- Added debounced automatic validation for validatable match flows so validation re-runs when allocations or compatible selections change.
- Added `lib/matching/match-wizard-validation.ts` to centralize derivation of `idle`, `running`, `stale`, `valid`, `warning`, `error`, and `system_error` states.
- Reworked the Validation section to show:
  - one primary status card
  - a single issues list when warnings or blocking errors exist
  - a collapsed `Impact details` section for the after-apply summaries
- Updated Apply gating and helper copy so it references validation instead of preview.
- Auto-expanded the Allocation section when bundle replacement is required so the corrective path is immediately visible.
- Removed the inline `Run validation again` button so the Validation section behaves as an automatic status panel.
- Added focused unit coverage in `tests/match-wizard-validation-state.test.ts`.

## 3. Reasoning Behind Changes
- Validation is the actual decision gate for this modal, so the UI should describe it directly instead of calling it a preview.
- Automatic validation reduces unnecessary clicks and matches the intended one-screen workflow.
- Centralizing validation-state derivation makes the component easier to reason about and gives the task a small testable unit.
- Keeping the existing preview API route avoided unnecessary backend churn while still delivering the requested UX improvement.
- The work was intentionally scoped to the Match Wizard modal and its immediate validation behavior.

## 4. Expected Behavior
- The Match Wizard presents `Validation` instead of `Preview`.
- Validation runs automatically when compatible selections or allocations change.
- Users see one clear validation state:
  - waiting
  - running
  - no issues found
  - warnings found
  - blocking issues found
  - system error
- Apply is enabled only when the latest validation result is current and has no blocking issues.
- When many-to-one replacement is required, the Allocation section expands automatically so the user can take the replacement action.
- The Validation section no longer shows a manual `Run validation again` button.

## 5. Client Summary
- The Match Wizard now uses a Validation-first flow instead of a Preview-first flow.
- Validation runs automatically and tells the user whether there are issues or no issues.
- Apply is clearly tied to the latest validation result.
- The existing many-to-one replacement path remains intact and is more visible when required.
- The extra validation action button was removed so the modal reads like an automatic workflow instead of a manual one.

## 6. Testing Performed
- Ran focused unit coverage:
  - `node --import tsx --test tests/match-wizard-validation-state.test.ts`
- Verified the helper covers idle, running, stale, valid, warning, error, and system-error states.
- Attempted full TypeScript validation:
  - `npx tsc --noEmit`
- Full TypeScript validation is currently blocked by unrelated existing errors in `app/api/table-preferences/[pageKey]/route.ts` referencing `lockedColumns`.
- Did not run the full application test suite or a live browser session in this task.

---

# Development Task Summary

## 1. Issues Identified
- Reconciliation unmatch was not a full rollback. It could remove visible allocations while leaving behind schedule adjustments, `apply-to-future` mutations, and Flex-created side effects.
- Line-level and bulk unmatch behavior were drifting because they were implemented through different paths with different assumptions.
- Unmatch behavior on finalized/reconciled deposits was underspecified and not consistently guarded.
- During live validation, we found a second data-integrity defect: a deposit line could remain `Partially Matched` against a revenue schedule that had already been soft-deleted, leaving the line allocated while the lower schedule grid showed nothing usable.
- The live bad row confirmed a deeper root cause: at least one match path allowed `DepositLineMatch` rows to exist against archived schedules, and allocation recompute still counted those deleted-schedule matches.

## 2. Changes Implemented
- Added a dedicated reconciliation undo-log model and migration so match-created non-derivable mutations can be reversed deterministically.
- Added shared rollback helpers in `lib/reconciliation/undo-log.ts`.
- Added a shared unmatch reversal service in `lib/reconciliation/unmatch-reversal.ts`.
- Refactored both unmatch entry points to use the same reversal engine:
  - `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route.ts`
  - `app/api/reconciliation/deposits/[depositId]/bulk/unmatch-allocations/route.ts`
- Wired mutation logging into the match/adjustment flows that create reversible side effects:
  - direct adjustment writes in `apply-match`
  - future-schedule mutations in `lib/reconciliation/future-schedules.ts`
  - auto-fill/match metadata writes in `lib/matching/auto-fill.ts`
  - Flex-created schedule flows in `lib/flex/revenue-schedule-flex-actions.ts`
- Added finalized-state protection so unmatch is blocked until the deposit is unfinalized.
- Added regression coverage for:
  - within-tolerance rollback
  - `apply-to-future` rollback
  - finalized-state blocking
  - Flex-created schedule cleanup
  - deleted-schedule candidate hiding
  - bulk unmatch cleanup of soft-deleted matched schedules
- Patched the candidate/grid and bulk-unmatch behavior for soft-deleted schedules:
  - hidden archived schedules from the reconciliation candidates grid
  - allowed bulk unmatch to clean up orphaned matches even if the selected revenue schedule had already been archived

## 3. Reasoning Behind Changes
- Unmatch is the system’s reconciliation integrity safeguard, so it must reverse persisted side effects, not just update the UI.
- `apply-to-future` and Flex-creation flows mutate future schedules and create new records, so they need durable provenance and a single transaction-safe rollback path.
- One shared reversal service prevents bulk and line-level unmatch from drifting over time.
- Archived schedules should not appear as valid match targets, but the system still needs to be able to clean up historical bad rows that already reference them.
- Live validation showed that bad historical data can exist independently of the new rollback flow, so the task also required targeted repair and defect isolation, not only code changes.

## 4. Expected Behavior
- Unmatch removes the selected match rows and restores the affected deposit line, revenue schedules, and deposit aggregates to their pre-match state.
- Any adjustment fields written because of the match are reset.
- Any future-schedule deltas written through `apply-to-future` are reversed.
- Flex schedules created by the matched flow are retired when that match is undone.
- Reconciled/finalized deposits cannot be unmatched until explicitly unfinalized first.
- Soft-deleted revenue schedules do not appear in the bottom reconciliation grid as active matched/suggested schedules.
- If historical bad data still exists, bulk unmatch can clean up the orphaned match rows instead of failing with “Unknown revenue schedule id(s)”.

## 5. Client Summary
- The reconciliation unmatch flow was upgraded from a partial cleanup into a shared rollback engine with provenance for reversible mutations.
- The immediate browser error around archived schedules blocking unmatch was fixed.
- During validation we found and repaired one live bad partial-match row where a deposit line was still allocated to archived revenue schedule `12709`.
- That repair removed the orphaned `DepositLineMatch`, reset the line’s allocations, and brought the live deposit back into a clean state for that line.
- Two residual code defects were also identified for follow-up:
  - match paths still need a hard `deletedAt: null` guard at initial schedule lookup
  - line allocation recompute should ignore matches tied to deleted schedules

## 6. Testing Performed
- Ran static verification:
  - `npx tsc --noEmit --pretty false`
- Added and registered targeted regression coverage in:
  - `tests/integration-reconciliation-unmatch-regression.test.ts`
  - `tests/integration-reconciliation-candidates.test.ts`
- Test files were discovered successfully, but full integration execution was not run against a disposable database in this task because the local integration harness requires `TEST_DATABASE_URL` and truncates the target database.
- Performed live/browser validation against reconciliation flows and investigated multiple production-like failure states.
- Queried the database directly to identify the orphaned partial match:
  - deposit line item `ea51b9e3-7354-4bad-a2f2-9d376173c165`
  - revenue schedule `12709`
  - revenue schedule id `9cca61e0-d963-45a8-8932-d7f687e35b30`
  - orphaned match id `645b609f-f655-4e9a-9d03-ac27245ed7f6`
- Performed a one-time live data repair by force-unmatching that archived-schedule match and recomputing:
  - line allocations/status
  - archived schedule actuals/status
  - deposit aggregates
- Verified after repair:
  - the line had no remaining `DepositLineMatch` rows
  - the line returned to `Unmatched`
  - allocated usage/commission reset to `0`
  - primary schedule linkage was cleared
