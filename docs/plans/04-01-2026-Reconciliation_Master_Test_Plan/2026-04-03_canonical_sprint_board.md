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

### Active Cluster: grouped-allocation mapping conflict

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

- `TC-05` `1:M Wizard`

Execution checklist:

- [x] Confirm the baseline evidence for `RS-019`
- [x] Trace candidate selection for the grouped allocation flow
- [x] Trace the real apply route used by the browser flow
- [x] Verify post-apply deposit state
- [x] Verify post-apply revenue schedule state
- [ ] Verify residual and rounding behavior
- [x] Verify undo or cleanup path
- [x] Prove the fixture is rerun-safe
- [ ] Promote `RS-019` from representative blocker to proven path once a true `M:1` fixture exists
- [ ] Rerun the remaining grouped-family rows against the same proof standard after remapping
- [ ] Update the `TC-05` / stale `TC-04` mapping notes based on the family result

Definition of done:

- the stale `TC-04` one-line runtime is no longer treated as valid proof for this family
- one true representative `M:1` path is proven end-to-end or explicitly deferred pending a new fixture
- `TC-05` and the grouped-family manual anchor are no longer ambiguous

Latest synthesis:

1. Scope proved:
   `RS-020` now has a true many-lines-to-one underage proof using the dedicated deposit `74116291-3f21-4e52-91c5-1953ccf34174` against `RCN-TC05-2026-04` (`bc5393d9-891b-4dea-ab07-9fd981017708`), while `RS-030` and `RS-031` now have dedicated true-shape fixtures but remain blocked by current grouped preview behavior rather than stale runtime shape.
2. Evidence captured:
   `.artifacts/playwright/reconciliation-suite/history/2026-04-06_08-17-36/scenario-results/RS-020.json`; `.artifacts/playwright/reconciliation-suite/history/2026-04-06_08-29-38/scenario-results/RS-030.json`; `.artifacts/playwright/reconciliation-suite/history/2026-04-06_08-29-38/scenario-results/RS-031.json`
3. Canonical files updated:
   `generated/scenario-manifest.json`; grouped-family Playwright reporting/runner files; dedicated grouped fixture CSVs for `RS-020`, `RS-030`, and `RS-031`
4. Residual risk:
   `TC-05` should still remain non-pass until the explicit operator-facing acceptance pass is completed; `RS-030` / `RS-031` are now blocked by grouped preview behavior on true fixtures; `RS-019`, `RS-043`, `RS-052`, `RS-072`, `RS-075`, and `RS-091` are downgraded to runtime-path validation only until row-specific fixtures exist
5. Exact next row set:
   `TC-05` operator acceptance review, then `RS-043`, `RS-052`, `RS-072`, `RS-075`, and `RS-091`

### Next Engineering Items

- `TC-05` `1:M Wizard`
- `TC-14` `Chargeback and Reversal`
- `TC-15` `Undo Flows`
- `TC-06` `Bundle Find-and-Replace`

## Bucket 2: Manual Acceptance

These are mandatory before calling the sprint client-ready.

### Mandatory handwritten row set

- [ ] `TC-04` `M:1 Wizard`
- [ ] `TC-05` `1:M Wizard`
- [ ] `TC-06` `Bundle Find-and-Replace`
- [ ] `TC-10` `Mass Change Start Date`
- [ ] `TC-11` `Updates Carry-Over`
- [ ] `TC-13` `Month-to-Month`
- [ ] `TC-14` `Chargeback and Reversal`
- [ ] `TC-15` `Undo Flows`
- [ ] `TC-16` `Deposit Upload Ignore Totals`
- [ ] `TC-17` `Deposit Flows (End-to-End)`

### Current acceptance sequence

Run in this order:

1. `TC-04`
2. `TC-17`
3. `TC-16`
4. `TC-14`
5. `TC-15`
6. `TC-05`
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

Current lane: `execute`

Current row set:

- `TC-05` operator acceptance review
- `RS-043`
- `RS-052`
- `RS-072`
- `RS-075`
- `RS-091`

Immediate goal:

- keep `RS-020` as the first true grouped-family underage proof, preserve `RS-030` / `RS-031` as true-fixture blocked evidence, and replace or explicitly defer the remaining stale shape-only grouped rows

Immediate inputs:

- scenario artifacts for `RS-020`, `RS-030`, and `RS-031`
- live grouped allocation browser path plus the runtime-path validation labels in `generated/scenario-manifest.json`
- canonical status targets in `Reconciliation Scenarios.csv` and `Handwritten Test Cases.csv`

Immediate output required:

- one exact grouped-family synthesis note
- updated board status
- updated canonical status for `TC-05` only if the family proof becomes conclusive

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
