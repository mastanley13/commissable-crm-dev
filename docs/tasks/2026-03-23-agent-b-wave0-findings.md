# Agent B Wave 0 Findings and Foundation Kickoff

Date: 2026-03-23
Owner: Agent B
Scope: `CRM-REC-104` investigation, `CRM-REC-102` inventory, `CRM-REC-105`, `CRM-REC-101`, `CRM-REC-110`

## Reviewed inputs

- `docs/tasks/Commissable_Multi_Agent_Handoff_2026-03-23.md`
- `docs/tasks/Commissable_Wave_Ownership_Matrix.xlsx - Wave Ownership Matrix.csv`
- `docs/tasks/03-23-Commissable-Ticket-List.xlsx - Tickets.csv`
- `docs/notes/Reconciliation Maching Issues and Workflow.docx.md`
- `docs/plans/2026-03-23-reconciliation-adjustment-ledger-alignment-plan.md`
- `docs/plans/2026-03-23-flex-naming-and-candidate-visibility-plan.md`
- Current reconciliation code paths under `app/api/reconciliation`, `lib/reconciliation`, `lib/flex`, and `lib/matching`

## Source-of-truth decision for this lane

Agent B should treat the March 23, 2026 handoff plus `docs/notes/Reconciliation Maching Issues and Workflow.docx.md` as the governing spec for this pass.

Reason:

- The March 23 handoff explicitly says the March 2026 reconciliation docs govern this wave.
- The ticket list for `CRM-REC-101`, `CRM-REC-105`, and `CRM-REC-110` matches the ledger model, confirm-only flex creation, and match-group ownership metadata.
- An older March document, `docs/specs/March_2026_Specs/2026-03-03 - Commissable - Handling Flex issues.docx.md`, still describes "Absorb into Price Each". That conflicts with the later handoff and later ticket wording.

Conclusion:

- `price_each` mutation is out.
- Total-dollar adjustment ledger rows are in.
- Flex children are confirm-only.

## Wave 0 findings

### `CRM-REC-104` - schedule `12710` investigation

Status: unresolved from repo-only evidence.

What I found:

- `12710` appears in the March 2026 narrative docs as a suspected duplicate beside `12698`.
- `12710` also appears in the prototype page `app/(dashboard)/admin/prototypes/reconciliation-live-preview/page.tsx`.
- I did not find seeded test data, fixtures, or local data snapshots in this repo that let me compare `12710` vs `12698` by account, opportunity product, schedule date, or source ids.

Conclusion:

- Keep current behavior unchanged for `12710` until a real dataset is inspected.
- Investigation output for now should be recorded as `unresolved`.
- Production suppression must stay blocked pending actual row-level comparison.

### `CRM-REC-102` - legacy flex/orphan inventory

Status: code-path inventory complete; data-row inventory not yet possible from repo-only evidence.

What I found in code:

- `lib/flex/revenue-schedule-flex-actions.ts` still has `buildFlexChildScheduleNumber()` and emits legacy `FLEX-*` schedule numbers.
- `app/api/reconciliation/deposits/[depositId]/matches/apply/route.ts` also has a local `buildFlexProductScheduleNumber()` helper that emits `FLEX-*`.
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route.ts` delegates to matching logic without an explicit flex-child exclusion contract at the route boundary.
- Existing tests cover candidate ordering and deleted schedules, but I did not find current coverage that explicitly excludes orphan `.N` children and legacy `FLEX-*` rows from normal suggestions.

What I could not verify yet:

- Count of live `FLEX-*` rows
- Count of orphan `.N` child rows
- Whether `FLEX-12698` rows are soft-deleted, active, or already partially migrated

Conclusion:

- Inventory of active code paths that can create or surface bad flex candidates is complete.
- Inventory of actual database rows still requires a disposable or production-like dataset.

## Foundation gap findings

### `CRM-REC-105` - match-group metadata is not sufficient yet

Current state:

- `DepositMatchGroup` stores `matchType`, status, created/undone metadata, and linked `DepositLineMatch` rows.
- It does not store first-class resolution metadata such as `resolutionType`, created adjustment ids, created child schedule ids, or affected schedule ids.

Impact:

- Undo currently depends on generic undo-log replay rather than explicit match-group artifact ownership.
- Scenario-specific reversal will stay fragile until match groups own their created artifacts directly.

### `CRM-REC-101` - confirm-only flex creation is not consistently enforced

Current state:

- `app/api/reconciliation/deposits/[depositId]/matches/apply/route.ts` can create new `RevenueSchedule` rows during grouped variance resolution.
- The current grouped `"Adjust"` path creates a new schedule row, not a ledger adjustment row.
- The current grouped `"FlexProduct"` path creates a child schedule with legacy `FLEX-*` naming.
- Older single-line variance routes still operate through split/child-schedule logic instead of a ledger-backed contract.

Impact:

- The foundation still mixes "adjustment" with "create a schedule".
- This violates the current March 2026 source of truth for Scenario A and Scenario B.

### `CRM-REC-110` - there is no first-class adjustment ledger yet

Current state:

- `RevenueSchedule` still relies on inline fields such as `usageAdjustment` and `expectedCommissionAdjustment`.
- I did not find a dedicated `RevenueScheduleAdjustment` or `schedule_adjustments` model in `prisma/schema.prisma`.
- Existing adjustment behavior uses inline deltas and split schedule creation, not additive dated ledger rows.

Impact:

- Odd-amount and multi-unit adjustments are not modeled as first-class additive records.
- Undo and auditability remain weaker than the March 2026 ledger spec requires.

## Regression coverage snapshot

Existing tests show the old model is still the active contract:

- `tests/integration-reconciliation-ai-adjustment.test.ts` covers preview/apply for the current AI adjustment path.
- `tests/integration-reconciliation-variance-flex.test.ts` includes `REC-AUTO-12`, which currently expects resolve-flex adjust behavior.
- `tests/integration-reconciliation-unmatch-regression.test.ts` includes flex cleanup assertions, but against the current split-schedule implementation.
- `tests/integration-reconciliation-candidates.test.ts` does not yet advertise explicit coverage for excluding flex child rows and legacy `FLEX-*` rows from normal candidate suggestions.

Conclusion:

- Existing tests are useful, but they protect the old contract more than the new ledger contract.
- Agent B will need new or updated tests before Agent C builds scenario-specific UX on top.

## Recommended next implementation slice

When code-edit scope is opened for Agent B, the smallest coherent foundation slice is:

1. Add a first-class adjustment ledger model and migration.
   - Store total-dollar usage and commission adjustments as additive rows.
   - Link each row to tenant, schedule, deposit, deposit line, and match group.

2. Extend `DepositMatchGroup` with explicit artifact ownership metadata.
   - `resolutionType`
   - `createdAdjustmentIds`
   - `createdChildScheduleIds`
   - `affectedScheduleIds`

3. Refactor grouped variance apply so:
   - adjustment scenarios create ledger rows, not child schedules
   - flex child creation is reserved for the confirm-only flex path
   - new flex child numbering uses `[parent].[sequence]`, never `FLEX-*`

4. Add a shared "normal matching target" filter for candidate search.
   - Exclude flex holding rows from standard suggestions
   - Keep specialized flex/reporting surfaces separate

5. Update integration coverage for the new contract.
   - ledger row creation for Scenario A and B
   - confirm-only child creation for Scenario C
   - candidate exclusion for orphan `.N` and legacy `FLEX-*`
   - match-group-owned undo targeting

## Open blockers and assumptions

- ASSUMED: repo-only review is acceptable for kickoff, but not sufficient to close `CRM-REC-104` or the data-count portion of `CRM-REC-102`.
- Blocker for final Wave 0 closure: access to a disposable or production-like dataset that includes schedules `12698`, `12699`, `12710`, orphan `.N` children, and legacy `FLEX-*` rows.
- Until that dataset is reviewed, `12710` should remain unsuppressed and recorded as `unresolved`.

## Immediate handoff value for Agent C

Agent C should not start scenario UX against the current persistence model.

Agent B foundation contract to target:

- Adjustment scenarios persist ledger rows, not new schedules.
- Flex child creation is confirm-only.
- Match groups own created artifact ids explicitly.
- Candidate search excludes flex holding rows from normal suggestions.
