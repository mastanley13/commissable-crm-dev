# Reconciliation E2E Validation Report

Date: 2026-03-16

## Scope

This pass validates the current reconciliation implementation against the documented source of truth for:

- 1:1 matching
- 1:many matching
- many:1 matching
- many:many behavior
- within-variance handling
- outside-variance / Flex handling
- commission-rate mismatch handling
- unmatch reversal
- cross-deal mismatch blocking
- future schedule update impacts
- chargeback path

Primary source-of-truth docs used:

- `docs/CRM‑FLOW‑001 — Bundle _ Split Rules Spec (1_M, M_1, M_M) + Undo_Unmatch.md`
- `docs/plans/UAT Guide 02_02_26.md`
- `docs/test-data/tc05-tc06/README.md`

## Prerequisite Review

### Repo state

- Out-of-scope local diffs were present and left untouched:
  - `app/api/accounts/route.ts`
  - `lib/address-format.ts`

### Test data / environment readiness

- Seeded internal test packs do exist for:
  - TC-05 bundle / rip-and-replace
  - TC-06 commission-rate difference (`1:M`)
- External UAT data is still not fully ready:
  - Updated Telarus template-variation files are still `Waiting on Rob / External` in `docs/tasks/Live_Backlog_Commissable_CRM - merged_status_2026-03-10.csv:15`
  - Client-run self-test UAT is still `Waiting on Rob / External` in `docs/tasks/Live_Backlog_Commissable_CRM - merged_status_2026-03-10.csv:14`
  - Test-environment cleanup remains open in `docs/notes/02-23-26-checkin-review.md:14`

### Execution notes

- I used a disposable Postgres database created locally through Prisma CLI.
- The checked-in integration harness is not safe under parallel test execution because it truncates shared tables and re-runs migrations per file. Running with Node's default parallelism caused advisory-lock timeouts and deadlocks.
- Re-running with `--test-concurrency=1` produced stable results.

## Executed Validation

### Checked-in automated suite

Executed sequentially against a disposable DB:

- `tests/integration-reconciliation-match-flow.test.ts`
- `tests/integration-reconciliation-variance-flex.test.ts`
- `tests/integration-reconciliation-rate-discrepancy.test.ts`
- `tests/integration-reconciliation-unmatch-regression.test.ts`
- `tests/integration-reconciliation-cross-deal-guard.test.ts`
- `tests/integration-bundle-rip-replace.test.ts`
- `tests/integration-chargeback-scenarios.test.ts`
- `tests/integration-flex-review.test.ts`
- `tests/match-selection.test.ts`
- `tests/match-group-defaults.test.ts`

Sequential result summary:

- 35 passed
- 4 failed

### Ad hoc route-level validation

To close gaps in direct non-1:1 apply coverage, I additionally executed route-level preview/apply checks for:

- `OneToMany`
- `ManyToOne`
- `ManyToMany`

All three returned `previewStatus=200`, `previewOk=true`, `applyStatus=200`, with applied match rows created as expected.

## Test Matrix

| Scenario | Expected behavior | Actual result | Status |
| --- | --- | --- | --- |
| 1:1 matching | Single line to single schedule applies, updates line/schedule totals, finalizes/unfinalizes cleanly, and can be un-matched. | Passed via `REC-AUTO-07/08/17/18/19` in `tests/integration-reconciliation-match-flow.test.ts`. | Pass |
| 1:many matching | One line can preview/apply across multiple schedules with valid allocations. | Passed in ad hoc route-level `matches/preview` + `matches/apply` for `OneToMany`; 2 applied match rows created. | Pass |
| many:1 matching | Multiple lines can preview/apply against one schedule for partial-payment style allocation. | Passed in ad hoc route-level `matches/preview` + `matches/apply` for `ManyToOne`; 2 applied match rows created. Mixed-rate guard also passed in `tests/integration-bundle-rip-replace.test.ts:314`. | Pass |
| many:many behavior | Multiple lines and multiple schedules preview/apply with supported allocation matrix behavior. | Passed in ad hoc route-level `matches/preview` + `matches/apply` for `ManyToMany`; 3 applied match rows created. FIFO default allocation logic also passed in `tests/match-group-defaults.test.ts`. | Pass |
| within-variance handling | Small overage should auto-adjust within tolerance without forcing Flex review. | Product behavior passed in direct route repro: response returned `flexDecision.action = auto_adjust` and `withinToleranceAdjustment.applied = true`. The checked-in test failed because it still expects `flexExecution` child creation in `tests/integration-reconciliation-variance-flex.test.ts:67`. | Pass |
| outside-variance / Flex handling | Overage above tolerance should prompt Flex resolution, and adjustment resolution should work. | Passed via `REC-AUTO-10` and `REC-AUTO-12` in `tests/integration-reconciliation-variance-flex.test.ts`. | Pass |
| commission-rate mismatch handling | Material mismatches should prompt, higher-rate updates can apply to future schedules, lower-rate mismatches route to exception workflow, and rollback must be atomic on failure. | Core behavior passed via `REC-RATE-01/02/02A/03/06/07/08` in `tests/integration-reconciliation-rate-discrepancy.test.ts`. One checked-in assertion failed because audit action storage moved from `metadata` to `changedFields/newValues` at `tests/integration-reconciliation-rate-discrepancy.test.ts:349`. | Pass |
| unmatch reversal | Unmatch should restore pre-match state, including within-tolerance adjustments, apply-to-future deltas, and Flex-created schedules. | Line-level reversal passed via `REC-UNMATCH-01/02/03/05/06` in `tests/integration-reconciliation-unmatch-regression.test.ts`. Bulk unmatch of a suggested chargeback/Flex match failed to restore original line values at `tests/integration-reconciliation-unmatch-regression.test.ts:315`. | Fail |
| cross-deal mismatch blocking | Cross-deal preview/apply should block with clear plain-language explanation. | Passed via `REC-GUARD-09` in `tests/integration-reconciliation-cross-deal-guard.test.ts`. | Pass |
| future schedule update impacts | Supported future-schedule update flows should update only the intended schedules and support rollback where required. | Passed for rate-discrepancy apply-to-future and rollback in `tests/integration-reconciliation-rate-discrepancy.test.ts` and for within-tolerance apply-to-future rollback in `tests/integration-reconciliation-unmatch-regression.test.ts:152`. Residual warning exists when a schedule lacks product scope identifiers. | Pass |
| chargeback path | Negative lines should create a pending Flex Chargeback, queue review, and support manager approval/apply. | Passed for chargeback creation in `tests/integration-chargeback-scenarios.test.ts` and review approval in `tests/integration-flex-review.test.ts`. Chargeback reversal (`CB-REV`) was not directly executed in this pass. | Pass |

## Confirmed Bugs / Inconsistencies / Edge Cases

### 1. Bulk unmatch does not fully reverse normalized chargeback/suggested Flex line state

Severity: High

Evidence:

- Failing assertion in `tests/integration-reconciliation-unmatch-regression.test.ts:374`
- Direct repro showed the line returned to `status="Unmatched"` but still retained:
  - `usage = 5`
  - `usageUnallocated = 5`
  - `commissionRate = 1`
  - `commissionUnallocated = 0`

Expected:

- Restore original pre-normalization values for the negative-commission chargeback input.

Impact:

- Users can believe a chargeback suggestion was fully undone when line values are still mutated.
- This is a real data-integrity regression in reversal behavior.

### 2. Within-tolerance auto-adjust test contract is stale, and the flow logs a scope-resolution warning for schedules without product identifiers

Severity: Medium

Evidence:

- Failing checked-in assertion in `tests/integration-reconciliation-variance-flex.test.ts:99`
- Direct route repro showed the implementation now returns:
  - `flexDecision.action = auto_adjust`
  - `withinToleranceAdjustment.applied = true`
  - `flexExecution = null`
- The same route logs:
  - `Failed to compute future schedule scope for within-tolerance adjustment prompt`
  - because product scope keys cannot be derived without product identifiers

Impact:

- Functional path still works for current-period adjustment.
- Future-scope prompt / propagation UX is degraded for under-specified schedules.
- Existing automated test coverage no longer matches the actual response contract.

### 3. Rate-discrepancy apply-to-future audit contract changed, and audit payload appears internally inconsistent

Severity: Medium

Evidence:

- Failing checked-in assertion in `tests/integration-reconciliation-rate-discrepancy.test.ts:431`
- Direct repro confirmed:
  - current and future schedules update correctly
  - audit entries exist
  - action is now stored in `changedFields/newValues`, not `metadata`
- Audit entry also recorded `expectedUsage: { from: 100, to: null }` even though persisted schedules still show `expectedUsage = 100`

Impact:

- Core rate-update workflow works.
- Audit consumers/tests that rely on `metadata.action` will miss these changes.
- The `expectedUsage -> null` diff suggests audit serialization is not fully trustworthy.

### 4. Mixed-rate bundle replacement test is inconsistent / potentially flaky

Severity: Medium

Evidence:

- Sequential suite failed `REC-AUTO-BUNDLE-06` at `tests/integration-bundle-rip-replace.test.ts:444`
- A direct isolated route repro returned the expected provenance strings in both `notes` and `comments`

Impact:

- This does not currently look like a stable product failure.
- It does indicate that the test or the replacement-note generation path needs hardening before it can be trusted as a release gate.

### 5. Integration harness itself is not reliable unless forced to single concurrency

Severity: Medium for QA process, Low for product behavior

Evidence:

- Parallel run produced Prisma advisory-lock timeouts, deadlocks, and FK/unique side effects.

Impact:

- QA automation can report false negatives unless run with `--test-concurrency=1`.
- This should be fixed before wider CI/UAT automation is trusted.

## UAT Readiness

Current readiness: Not ready for broad client/UAT sign-off yet.

What is ready enough:

- Core matching flows are working for 1:1, 1:M, M:1, and M:M.
- Cross-deal blocking works.
- Chargeback creation and review approval paths work.
- Rate-discrepancy handling is largely working.
- Future-schedule update and rollback behavior is largely working.

What still blocks or weakens client/UAT:

- Real defect in bulk unmatch reversal for chargeback/Flex-suggested lines.
- Internal automation has stale assertions in key reconciliation areas, so the regression suite is not yet a clean release gate.
- External UAT file readiness and client-run test data are still partially pending.
- Test-environment cleanup is still listed as outstanding.

Recommended gate before client/UAT:

1. Fix bulk unmatch state restoration for suggested chargeback/Flex lines.
2. Update stale automated tests for:
   - within-tolerance auto-adjust contract
   - rate-discrepancy audit contract
3. Re-run the sequential reconciliation suite and confirm zero product-level failures.
4. Finish test-environment cleanup and load the pending external UAT files.

## Regression List

- Bulk unmatch of suggested chargeback/Flex lines
- Within-tolerance auto-adjust response contract
- Future-scope prompt behavior when schedules lack product identifiers
- Rate-discrepancy apply-to-future audit logging shape and audit-field correctness
- Mixed-rate bundle replacement provenance / test stability
- Integration harness concurrency safety

## Plain-Language Internal Summary

The reconciliation engine is mostly in good shape on the core workflows. I was able to validate 1:1, 1:M, M:1, M:M, cross-deal blocking, chargeback creation/approval, and the main rate-discrepancy flows on a disposable database using the real API routes.

The biggest real issue still open is undo behavior for bulk unmatch on suggested chargeback/Flex items. The system clears the match and marks the line unmatched, but it does not fully restore the original line values, which is a data-integrity problem.

Two other failures from the automated suite are mostly test drift rather than broken functionality: within-tolerance adjustments now return a different payload shape, and rate apply-to-future audit entries now store their action in a different audit structure. There is also one inconsistent bundle replacement assertion that looks flaky and needs tightening before we rely on it as a release gate.

Bottom line: the workflow foundation is close, but I would not send this to client/UAT until the bulk-unmatch reversal bug is fixed, the stale reconciliation tests are updated, and the pending external UAT data/environment cleanup items are finished.
