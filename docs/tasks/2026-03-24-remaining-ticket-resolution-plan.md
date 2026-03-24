# Commissable CRM Remaining Ticket Resolution Plan

Source files:
- `docs/tasks/03-23-Commissable-Ticket-List.xlsx - Tickets.csv`
- `docs/tasks/Commissable_Wave_Ownership_Matrix.xlsx`

## Goal

Resolve the remaining incomplete reconciliation tickets in the order that minimizes rework, respects dependencies, and keeps undo/reversal behavior correct.

## Remaining Incomplete Tickets

- CRM-REC-101
- CRM-REC-102
- CRM-REC-103
- CRM-REC-104
- CRM-REC-105
- CRM-REC-106
- CRM-REC-107
- CRM-REC-108
- CRM-REC-109
- CRM-REC-110

## Recommended Sequence

1. CRM-REC-105
2. CRM-REC-110
3. CRM-REC-101
4. CRM-REC-106
5. CRM-REC-107
6. CRM-REC-103
7. CRM-REC-102
8. CRM-REC-108
9. CRM-REC-109
10. CRM-REC-104

## Why This Order

- `CRM-REC-105` is the data-model foundation for reversible actions.
- `CRM-REC-110` establishes the adjustment-ledger model used by Scenario A and Scenario B.
- `CRM-REC-101` removes a release-blocking behavior in preview flow and protects Scenario C from persisting bad child records too early.
- `CRM-REC-106` and `CRM-REC-107` should be built once match-group metadata and the ledger model exist.
- `CRM-REC-103` should follow after create/update flows are real enough to reverse.
- `CRM-REC-102` should be handled in two steps: inventory first, cleanup second.
- `CRM-REC-108` depends on preview correctness, cleanup direction, and match-group persistence.
- `CRM-REC-109` is best finalized after A/B/C behaviors are stable.
- `CRM-REC-104` is an investigation ticket and should not change production behavior until the duplicate case is confirmed.

## Execution Phases

### Phase 1: Foundations

#### CRM-REC-105: Extend match_group metadata for reversible variance actions

Objective:
Add the persistence needed to track which records were created or changed by a reconciliation decision.

Implementation plan:
- Identify where `match_group` is created and updated during reconciliation flows.
- Extend persisted metadata to capture:
  - `resolution_type`
  - created adjustment ids
  - created child schedule ids
  - updated schedule ids
- Keep the model additive so future flows can store more affected objects without schema churn.
- Add server-side helpers to read and write this metadata consistently.

Definition of done:
- Every reconciliation action can record what it created or affected.
- Undo logic can target records by match group without touching older records.
- Automated tests cover metadata persistence and retrieval.

Risks:
- If this is underspecified, later undo logic will be fragile or overbroad.

#### CRM-REC-110: Support odd-amount and multi-unit adjustments as total-dollar ledger entries

Objective:
Represent variance handling as additive adjustment records instead of changing `price_each`.

Implementation plan:
- Locate current schedule adjustment creation logic.
- Define the adjustment record shape for total-dollar entries.
- Ensure uneven overages are stored as exact total adjustments, not rounded unit math.
- Verify multiple adjustments accumulate instead of overwriting prior values.
- Add UI formatting rules for total-dollar display in success states and audit views.

Definition of done:
- Adjustments persist as additive dollar entries.
- `price_each` remains unchanged in all uneven or forward-adjustment cases.
- Tests cover odd-amount examples and repeated adjustments.

Risks:
- If existing calculations assume per-unit math, recomputation bugs may surface.

#### CRM-REC-101: Prevent premature flex child creation during match preview

Objective:
Keep preview state in memory only until the user explicitly confirms Option C.

Implementation plan:
- Trace the current preview and option-selection flow for child schedule creation.
- Remove any persistence side effects from preview, selection, or intermediate steps.
- Ensure Suggested Matches only shows base schedules before confirmation.
- Gate child creation behind the final Option C confirm action.
- Add regression tests around preview and option toggling.

Definition of done:
- No child flex schedule is persisted until final confirm.
- Suggested Matches does not show preview-generated children.

Risks:
- Hidden side effects may exist in shared preview helpers or background persistence hooks.

### Phase 2: Scenario Flows

#### CRM-REC-106: Implement Scenario A - Adjust this schedule only

Objective:
Create a single adjustment on the current schedule and leave all future schedules unchanged.

Implementation plan:
- Build the Scenario A apply path using the metadata model from `CRM-REC-105`.
- Create one adjustment record linked to the current schedule only.
- Recalculate derived fields for the current schedule only.
- Record created adjustment ids in match-group metadata.
- Add undo coverage to ensure only Scenario A artifacts are removed.

Definition of done:
- One adjustment record is created for the current schedule only.
- `price_each` remains unchanged.
- Undo removes only the record created by that match group.

#### CRM-REC-107: Implement Scenario B - Adjust this and all future schedules

Objective:
Apply one independent adjustment record to the current and all future schedules in the same chain.

Implementation plan:
- Define the schedule-selection query for current plus future schedules.
- Create one adjustment record per affected schedule.
- Preserve prior adjustments and append new records.
- Store all created adjustment ids and updated schedule ids in match-group metadata.
- Surface the named next schedule, including `12699`, in UX states where required.

Definition of done:
- Each affected schedule receives an independent ledger entry.
- Future schedules are selected deterministically by product and date.
- Undo removes only the records created by this operation.

Risks:
- Chain-selection logic can be wrong if schedule ordering or product-link assumptions differ in real data.

### Phase 3: Reversal and Data Hygiene

#### CRM-REC-103: Cascade undo/unmatch cleanup for flex children and adjustment records

Objective:
Make undo/unmatch remove only artifacts created by the same match group.

Implementation plan:
- Build undo lookup around the metadata from `CRM-REC-105`.
- Delete only child schedules and adjustment records created by that match group.
- Protect pre-existing records from accidental deletion.
- Add tests for each scenario path and mixed historical data.

Definition of done:
- Undo is precise and scoped.
- Reversal works for Scenario A, B, and C artifacts without collateral deletion.

#### CRM-REC-102: Retire FLEX- naming and clean legacy flex records

Objective:
Stop generating old `FLEX-` naming and remove or migrate legacy invalid flex rows safely.

Implementation plan:
- First perform inventory of all legacy `FLEX-*` and orphan `.N` records.
- Classify each legacy record as valid, migratable, duplicate, or orphaned.
- Update creation logic so new child schedules always use `[parent].[sequence]`.
- Implement cleanup as a dry-run report first.
- Run live cleanup only after dry-run output is reviewed.

Definition of done:
- New code never creates `FLEX-` records.
- Legacy invalid records no longer pollute Suggested Matches or normal schedule views.
- Cleanup is auditable and reversible where possible.

Risks:
- This is the highest data-risk ticket. Do not combine inventory, migration, and destructive cleanup in one step.

### Phase 4: Flex Child Flow and Shared UX

#### CRM-REC-108: Implement Scenario C - Create flex child schedule

Objective:
Create a child flex schedule only on final confirmation and keep it hidden from standard schedule lists.

Implementation plan:
- Use the preview protections from `CRM-REC-101`.
- Generate the next child number in `[parent].[sequence]` format.
- Create the child with the correct parent link and pending resolution state.
- Record the created child id in match-group metadata.
- Ensure visibility rules keep the child in the Flex Schedule Report and parent detail view only.
- Add undo coverage through `CRM-REC-103`.

Definition of done:
- Child creation happens only on final confirm.
- Parent schedule remains unchanged.
- Undo removes only the created child.

Risks:
- Visibility rules may be spread across multiple queries and UI surfaces.

#### CRM-REC-109: Refresh variance popup copy, option states, and confirmation messaging

Objective:
Align UI wording and state behavior with the final ledger-based behavior across Scenarios A, B, and C.

Implementation plan:
- Consolidate Step 2 and Step 3 copy rules in a shared component or configuration.
- Make Apply Match disabled until one option is selected.
- Update confirmation copy to describe adjustment records rather than `price_each` edits.
- Ensure Scenario B names `12699` where required and Scenario C shows the proposed child schedule number.

Definition of done:
- Copy is consistent with implemented system behavior.
- State transitions are uniform across all scenarios.

Risks:
- Doing this too early creates churn if A/B/C behavior changes underneath it.

### Phase 5: Investigation and Follow-Through

#### CRM-REC-104: Investigate and suppress duplicate suggested schedule 12710

Objective:
Determine whether `12710` is a true duplicate of `12698` or a legitimate alternate suggestion.

Implementation plan:
- Compare opportunity product, account, dates, and source ids for `12710` versus `12698`.
- Document the investigation result with examples.
- If duplicate, implement suppression logic.
- If legitimate, improve UI or decision criteria so the reason it appears is clear.
- Do not suppress until the duplicate case is confirmed.

Definition of done:
- Investigation result is documented.
- Production behavior changes only if duplicate status is proven.

Risks:
- Premature suppression may hide a valid match candidate.

## Parallel Work Lanes

If multiple engineers are available, use these lanes:

- Lane 1: `CRM-REC-105` then `CRM-REC-103`
- Lane 2: `CRM-REC-110` then `CRM-REC-106` and `CRM-REC-107`
- Lane 3: `CRM-REC-101` then `CRM-REC-108`
- Lane 4: `CRM-REC-102` inventory/dry-run work and `CRM-REC-104` investigation
- Lane 5: `CRM-REC-109` after A/B/C behavior is stable

## Checkpoints

Checkpoint 1:
- `CRM-REC-105`, `CRM-REC-110`, and `CRM-REC-101` complete
- At this point, scenario implementation can proceed safely

Checkpoint 2:
- `CRM-REC-106` and `CRM-REC-107` complete with tests
- At this point, reversal behavior can be finished safely

Checkpoint 3:
- `CRM-REC-103`, `CRM-REC-102`, and `CRM-REC-108` complete
- At this point, flex creation and cleanup behavior should be stable enough for UX finalization

Checkpoint 4:
- `CRM-REC-109` and `CRM-REC-104` complete
- At this point, the reconciliation workstream is ready for final QA and UAT

## Immediate Recommendation

Start with:

1. `CRM-REC-105`
2. `CRM-REC-110`
3. `CRM-REC-101`

That combination gives the best unblock value and reduces the risk of building Scenario A, B, or C on the wrong data model.
