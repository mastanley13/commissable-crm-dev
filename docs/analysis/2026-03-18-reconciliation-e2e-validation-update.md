# Reconciliation E2E Validation Update

Date: 2026-03-18

Supersedes in part: `docs/analysis/2026-03-16-reconciliation-e2e-validation-report.md`

## Purpose

This update answers one follow-up question from the March 16, 2026 validation pass:

- Does `unmatch reversal` pass now?

I re-ran the current unmatch regression suite on 2026-03-18 against a disposable local Postgres database, separate from the main application database.

## What Was Re-Validated On 2026-03-18

Executed sequentially against a disposable database:

- `tests/integration-reconciliation-unmatch-regression.test.ts`

Command shape used:

```powershell
$env:RUN_INTEGRATION_TESTS='1'
$env:TEST_DATABASE_URL='postgresql://app:commissable%402025@127.0.0.1:5432/commissable_crm_codex_unmatch_check_20260318'
node --import tsx --test --test-concurrency=1 tests/integration-reconciliation-unmatch-regression.test.ts
```

Result:

- 6 passed
- 0 failed

Passing scenarios in that suite:

- `REC-UNMATCH-01`: within-tolerance adjustments are rolled back on unmatch
- `REC-UNMATCH-02`: apply-to-future adjustments are rolled back on unmatch
- `REC-UNMATCH-03`: unmatch is blocked while the deposit is finalized
- `REC-UNMATCH-04`: bulk unmatch removes suggested flex matches and restores normalized line state
- `REC-UNMATCH-05`: line-level unmatch retires flex schedules created from overage splits
- `REC-UNMATCH-06`: bulk unmatch cleans up matches tied to soft-deleted schedules

## Updated Test Matrix

This matrix keeps the March 16 baseline for the broader reconciliation workflow and applies the March 18 re-validation where new evidence exists.

| Scenario | Prior status on 2026-03-16 | Current validation update on 2026-03-18 | Current status |
| --- | --- | --- | --- |
| 1:1 matching | Pass | Not re-run in this update; still based on 2026-03-16 validation. | Pass |
| 1:many matching | Pass | Not re-run in this update; still based on 2026-03-16 validation. | Pass |
| many:1 matching | Pass | Not re-run in this update; still based on 2026-03-16 validation. | Pass |
| many:many behavior | Pass | Not re-run in this update; still based on 2026-03-16 validation. | Pass |
| within-variance handling | Pass | `REC-UNMATCH-01` rollback path passed. The earlier contract-drift warning remains separate from rollback behavior. | Pass |
| outside-variance / Flex handling | Pass | Not re-run in this update; still based on 2026-03-16 validation. | Pass |
| commission-rate mismatch handling | Pass | Not re-run in this update; still based on 2026-03-16 validation. | Pass |
| unmatch reversal | Fail | Re-validated directly. Full unmatch regression suite passed `6/6`, including the previously failing `REC-UNMATCH-04` bulk unmatch reversal case. | Pass |
| cross-deal mismatch blocking | Pass | Not re-run in this update; still based on 2026-03-16 validation. | Pass |
| future schedule update impacts | Pass | `REC-UNMATCH-02` passed, confirming rollback of apply-to-future adjustments in the unmatch path. | Pass |
| chargeback path | Pass | Not re-run in this update. Chargeback creation/approval status still relies on 2026-03-16 validation. | Pass |

## Direct Answer: Does Unmatch Reversal Pass Now?

Yes.

As of 2026-03-18, `unmatch reversal` passes in the current repo state based on a fresh sequential run of `tests/integration-reconciliation-unmatch-regression.test.ts`.

Most importantly, the previously failing case from the March 16 report now passes:

- `REC-UNMATCH-04: bulk unmatch removes suggested flex matches and restores normalized line state`

That means the specific prior defect, where bulk unmatch could leave a suggested Flex/chargeback line in a mutated normalized state after the match was removed, is no longer reproducing in the checked-in test coverage.

## Client-Facing Summary

The reconciliation module remains strong across the core matching workflows that were validated on March 16, and the specific undo concern raised in that report has now been re-tested and is passing.

The most important update is that the prior `unmatch reversal` blocker has been cleared in current testing. We re-ran the dedicated unmatch regression suite on March 18 and all six scenarios passed, including the exact bulk unmatch case that had previously failed. In plain terms: the system now successfully removes the match and restores the affected line state in the scenario that was previously flagged as a data-integrity risk.

This materially improves readiness because undo behavior is a trust-critical workflow for finance users. If an accounting user reverses a match, the expectation is that the system returns the affected records to the correct pre-match state. Current test evidence now supports that expectation for the dedicated unmatch regression coverage.

## Client-Facing Explanation

What changed since the March 16 report:

- On March 16, the main open defect was bulk unmatch reversal for suggested Flex/chargeback lines.
- On March 18, that exact area was re-tested in the current codebase.
- The previously failing case now passes.

What this means in business terms:

- Users should be able to undo a reconciliation action with more confidence.
- The specific risk of a line appearing unmatched while still retaining incorrect normalized values was not reproduced in the current regression run.
- This reduces the likelihood of finance users seeing misleading post-unmatch data in that scenario.

What this does not mean yet:

- This update does not claim that the entire reconciliation suite was re-run on March 18.
- Areas outside unmatch still rely on the March 16 validation baseline unless separately re-tested.
- The earlier notes about stale assertions in some other reconciliation tests and broader UAT/environment readiness remain relevant until the wider suite is re-validated.

## Recommended Client Message

Since the last reconciliation validation pass, we re-tested the undo/unmatch workflow and confirmed the previously failing bulk unmatch reversal scenario is now passing. The dedicated unmatch regression suite passed in full, including restoration of suggested Flex/chargeback line state. Core reconciliation coverage from the March 16 validation remains positive, and the main previously identified undo blocker is no longer reproducing in current test coverage.

## Remaining Cautions

- A warning still appears in one rollback flow when future schedule scope cannot be derived because product identifiers are missing. The test passed, but the warning indicates residual scope-resolution fragility rather than a rollback failure.
- This update is a targeted validation update, not a full broad-suite re-certification.
- For full client/UAT sign-off, the broader reconciliation suite should still be re-run cleanly after any remaining stale assertions or environment-prep issues are addressed.

## Validation Notes

- The disposable verification database used for the March 18 run was separate from the main application database.
- The temporary test database was dropped after the run.
- No application files were modified as part of the verification itself; this document records the result.
