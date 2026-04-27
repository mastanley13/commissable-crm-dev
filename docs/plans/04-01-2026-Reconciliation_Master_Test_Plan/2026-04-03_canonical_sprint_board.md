# Canonical Sprint Board

Date: 2026-04-03

## Usage Rules

This is the live sprint tracker.

Use it with:

- `Commissable_Master_Test_Plan.xlsx - Reconciliation Scenarios.csv`
- `Commissable_Master_Test_Plan.xlsx - Handwritten Test Cases (TC-01-17).csv`
- `Commissable_Master_Test_Plan.xlsx - General Testing Checklist.csv`
- `Commissable_Test_Action_Plan.xlsx - Wave Plan.csv`
- `Commissable_Test_Action_Plan.xlsx - What To Add.csv`
- `Commissable_Test_Action_Plan.xlsx - Field Mapping.csv`
- `.artifacts/playwright/reconciliation-suite/history/2026-04-03_09-01-18/`

Rules:

- Do not create new sprint summary docs unless there is a stakeholder deliverable.
- Update this board and the canonical files instead.
- Work one lane at a time: `plan`, `execute`, or `verify`.
- Each work block must end with a synthesis step.

## Current Sprint Goal

Finish the client-blocking reconciliation work without adding more planning sprawl.

The current sequence is:

1. Set the board and freeze the working baseline
2. Eliminate the `M:1` blocker cluster
3. Close the handwritten acceptance layer
4. Cut the general checklist into `client-blocking now` vs `defer`

## Frozen Baseline

Evidence baseline:

- `.artifacts/playwright/reconciliation-suite/history/2026-04-03_09-01-18/`

Known status from baseline:

- `pass`: `5`
- `pass-pending-ui-review`: `90`
- `blocked`: `10`
- `fail`: `0`

## Bucket 1: Blocked Engineering

### Active Cluster: grouped-allocation wording and crosswalk cleanup

Priority: `P0`

Representative first row:

- `RS-004`

Family rows:

- `RS-004`
- `RS-019`
- `RS-020`
- `RS-030`
- `RS-031`
- `RS-043`
- `RS-052`
- `RS-072`
- `RS-075`
- `RS-091`

Related handwritten case:

- `TC-05` `1:M Wizard` (`TC-05` is the handwritten label; use it as the live grouped `M:1` analogue)

Execution checklist:

- [x] Confirm the baseline evidence for `RS-019`
- [x] Trace candidate selection for the grouped allocation flow
- [x] Trace the real apply route used by the browser flow
- [x] Verify post-apply deposit state
- [x] Verify post-apply revenue schedule state
- [ ] Verify residual and rounding behavior
- [x] Verify undo or cleanup path
- [x] Prove the fixture is rerun-safe
- [x] Promote `RS-019` from representative blocker to proven `M:1` runtime path
- [x] Rerun the remaining grouped-family rows against the same proof standard after remapping
- [x] Update the `TC-05` / stale `TC-04` mapping notes based on the family result

Definition of done:

- the stale `TC-04` one-line runtime is no longer treated as valid proof for this family
- one true representative `M:1` path is proven end-to-end
- `TC-05` and the grouped-family manual anchor are no longer ambiguous

Latest synthesis:

1. Scope proved:
   The grouped `M:1` lane is now frozen as proven for handwritten closeout: `RS-004` remains the canonical grouped proof, `RS-020` remains the strongest row-specific grouped follow-up, `RS-030` and `RS-031` remain explicit product-rule replacement blocks, `TC-05` now has a recorded pass-ready handwritten disposition, `TC-04` browser evidence was refreshed, `TC-17` branch coverage was refreshed, and the remaining mandatory handwritten rows were checked against targeted integration evidence before one clean full-suite rerun.
2. Evidence captured:
   Grouped-family proof: `.artifacts/playwright/reconciliation-suite/history/2026-04-06_12-41-31/reconciliation-summary.md`; `.artifacts/playwright/reconciliation-suite/history/2026-04-06_12-41-31/scenario-results/RS-004.json`; `.artifacts/playwright/reconciliation-suite/history/2026-04-06_12-41-31/scenario-results/RS-020.json`; `.artifacts/playwright/reconciliation-suite/history/2026-04-06_12-41-31/scenario-results/RS-030.json`; `.artifacts/playwright/reconciliation-suite/history/2026-04-06_12-41-31/scenario-results/RS-031.json`. Refreshed `TC-04` / `TC-17` branch evidence: `.artifacts/playwright/reconciliation-suite/history/2026-04-06_13-11-39/reconciliation-summary.md`; `.artifacts/playwright/reconciliation-suite/history/2026-04-06_13-11-39/scenario-results/RS-001.json`; `.artifacts/playwright/reconciliation-suite/history/2026-04-06_13-11-39/scenario-results/RS-003.json`; `.artifacts/playwright/reconciliation-suite/history/2026-04-06_13-11-39/scenario-results/RS-073.json`. Latest saved full-suite artifact rerun: `.artifacts/playwright/reconciliation-suite/history/2026-04-06_13-12-31/reconciliation-summary.md`; `.artifacts/playwright/reconciliation-suite/history/2026-04-06_13-12-31/scenario-results/RS-033.json`; `.artifacts/playwright/reconciliation-suite/history/2026-04-06_13-12-31/scenario-results/RS-042.json`. Targeted integration closeout evidence: `tests/integration-deposit-import-route.test.ts` (`DU-AUTO-16` pass), `tests/integration-chargeback-scenarios.test.ts` (`CHARGEBACK-03` pass), `tests/integration-reconciliation-match-group-undo.test.ts` (`REC-MATCH-GROUP-UNDO-01` pass), `tests/integration-reconciliation-unmatch-regression.test.ts` (`REC-UNMATCH-04` pass, `REC-UNMATCH-05` fail), `tests/integration-bundle-rip-replace.test.ts` (`REC-AUTO-BUNDLE-05` pass, `REC-AUTO-BUNDLE-06` fail), `tests/integration-revenue-schedule-change-start-date.test.ts` (`REV-CHANGE-START-DATE` shift + collision pass), `tests/integration-reconciliation-ai-adjustment.test.ts` (`REC-AUTO-13/14` pass), `tests/integration-reconciliation-rate-discrepancy.test.ts` (`REC-RATE-04/05` fail), `tests/integration-month-to-month-schedules.test.ts` (`M2M-AUTO-01` and `M2M-AUTO-03` pass).
3. Canonical files updated:
   sprint board
4. Residual risk:
   `TC-04` still needs final operator allocation confirmation even though `RS-003` reran cleanly as `pass-pending-ui-review`. `TC-17` now has current branch coverage (`RS-001` pass, `RS-003` pass-pending-ui-review, `RS-073` pass) but does not yet have a dedicated mixed-file upload-to-finalization signoff. `TC-06`, `TC-11`, and `TC-15` each showed a closeout-phase regression or unresolved defect signal and should stay open. Current April 7 reporting is now `pass: 6`, `pass-pending-ui-review: 95`, `fail: 1`, `blocked: 3`; the old `67 blocked` full-suite story is outdated and should not be used in stakeholder status updates.
5. Exact next row set:
   `TC-04` final operator confirm, `TC-17` mixed-file signoff, `TC-15` unmatch defect triage, `TC-06` bundle replacement defect triage, `TC-11` future-update carry-over defect triage

### Next Engineering Items

- `TC-04` `M:1 Wizard` final operator confirm against refreshed `RS-003`
- `TC-17` `Deposit Flows (End-to-End)` mixed-file upload/finalization signoff
- `TC-15` `Undo Flows` defect follow-up on `REC-UNMATCH-05`
- `TC-06` `Bundle Find-and-Replace` defect follow-up on `REC-AUTO-BUNDLE-06`
- `TC-11` `Updates Carry-Over` defect follow-up on `REC-RATE-04/05`

## Bucket 2: Manual Acceptance

These are mandatory before calling the sprint client-ready.

### Mandatory handwritten row set

- [ ] `TC-04` `M:1 Wizard` (handwritten label; live analogue is `1:M`) - `pass-pending-ui-review`; refreshed in `.artifacts/playwright/reconciliation-suite/history/2026-04-06_13-11-39/scenario-results/RS-003.json`, but final operator-facing allocation confirm is still required.
- [x] `TC-05` `1:M Wizard` (handwritten label; live analogue is grouped `M:1`) - handwritten disposition recorded as `pass-ready`; canonical proof is `RS-004` with `RS-020` as supporting grouped follow-up, while `RS-030` and `RS-031` stay logged as product-rule replacement blocks rather than contradictory proof.
- [ ] `TC-06` `Bundle Find-and-Replace` - not closed; `REC-AUTO-BUNDLE-05` passed the mixed-rate replacement guard, but `REC-AUTO-BUNDLE-06` failed during replacement-success verification.
- [x] `TC-10` `Mass Change Start Date` - pass via `REV-CHANGE-START-DATE` shift and collision-guard integration checks.
- [ ] `TC-11` `Updates Carry-Over` - mixed evidence; `REC-AUTO-13/14` passed the apply-to-future path, but `REC-RATE-04/05` failed in the closeout rerun, so the handwritten case stays open.
- [x] `TC-13` `Month-to-Month` - pass via `M2M-AUTO-01` and `M2M-AUTO-03`.
- [x] `TC-14` `Chargeback and Reversal` - pass via `CHARGEBACK-03`, with junk-row ignore support reconfirmed by `DU-AUTO-16`.
- [ ] `TC-15` `Undo Flows` - mixed / defected; `REC-MATCH-GROUP-UNDO-01` and `REC-UNMATCH-04` passed, but `REC-UNMATCH-05` failed, so the handwritten row is not closed.
- [x] `TC-16` `Deposit Upload Ignore Totals` - pass via `DU-AUTO-16`.
- [ ] `TC-17` `Deposit Flows (End-to-End)` - branch evidence is current (`RS-001` pass, `RS-003` pass-pending-ui-review, `RS-073` pass), but the dedicated mixed-file upload-to-finalization signoff is still open.

### Current acceptance sequence

Run in this order:

Use the live physical directionality when executing:
- `TC-04` = one deposit line to many schedules (`1:M`)
- `TC-05` = many deposit lines to one schedule (grouped `M:1`)

1. `TC-05`
2. `TC-04`
3. `TC-17`
4. `TC-16`
5. `TC-15`
6. `TC-14`
7. `TC-06`
8. `TC-10`
9. `TC-11`
10. `TC-13`

Definition of done:

- no blank status remains for any mandatory handwritten case
- each row has explicit evidence or a logged defect

## Bucket 3: Data Prep / Environment

### Wave 0 bootstrap lane

- [ ] Confirm the five Wave 0 targets are still in the intended state
- [ ] Keep the Wave 0 file small and isolated
- [ ] Prove one unknown-account bootstrap
- [ ] Prove one existing-account/no-opportunity bootstrap
- [ ] Leave the remaining rows as controls

### Wave 1 clean baseline lane

- [ ] Confirm all Wave 1 green rows exist
- [ ] Confirm the `8` catalog mappings exist
- [ ] Build the clean Wave 1 deposit
- [ ] Include subtotal and total rows intentionally
- [ ] Confirm row filtering works

### Wave 2 engineered variance lane

- [ ] Build Wave 2 from Wave 1 customers only
- [ ] Split it into small scenario chunks
- [ ] Run `Rent the Runway` first for rate-trap proof
- [ ] Confirm decision-path containment after each chunk

### Environment safety

- [ ] Keep target tenant as `clone-2`
- [ ] Avoid parallel heavy browser work
- [ ] Record import IDs for every executed wave

## Bucket 4: Deferred Backlog

These are explicitly out of the critical path unless someone says they block client review:

- broad UI standardization items
- popup consistency cleanup
- dashboard or super-screen ideas
- AI timing / automation wishlist work
- non-reconciliation exploratory items

## Current Lane

Current lane: `verify`

Current row set:

- `TC-04`
- `TC-17`
- `TC-15`
- `TC-06`
- `TC-11`

Immediate goal:

- hold the grouped-family lane closed, use the refreshed browser plus integration evidence as the handwritten source of truth, and finish only the unresolved acceptance rows without reopening family-mapping work

Immediate inputs:

- corrected handwritten-to-runtime directionality (`TC-04` = live `1:M`, `TC-05` = live grouped `M:1`)
- grouped-family consolidation summary in `.artifacts/playwright/reconciliation-suite/history/2026-04-06_12-41-31/reconciliation-summary.md`
- `RS-004` representative grouped proof and `RS-020` row-specific follow-up review evidence
- blocked mixed-rate result files for `RS-030` and `RS-031`
- refreshed `TC-04` / `TC-17` branch run in `.artifacts/playwright/reconciliation-suite/history/2026-04-06_13-11-39/`
- full-suite rerun in `.artifacts/playwright/reconciliation-suite/history/2026-04-06_13-12-31/`
- targeted integration closeout checks for `TC-06`, `TC-10`, `TC-11`, `TC-13`, `TC-14`, `TC-15`, and `TC-16`

Immediate output required:

- explicit handwritten status for every mandatory row in scope
- one published current full-suite status after acceptance closeout
- the grouped-family lane remains frozen unless contradictory evidence appears

## Synthesis Template

End each work block with these five lines:

1. Scope proved:
2. Evidence captured:
3. Canonical files updated:
4. Residual risk:
5. Exact next row set:

## Baton Pass

If work stops mid-block, leave the next action in this format:

- `Next row set:`
- `Preconditions already verified:`
- `Open blocker:`
- `First command or first UI action to resume:`
