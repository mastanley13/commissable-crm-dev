# Reconciliation Update Client Summary and UAT Guide

Prepared: March 24, 2026

## Client-Facing Summary

### Overview

This update improves how reconciliation handles overages, future schedule impacts, flex-child creation, and undo behavior.

The main change is that overage handling now uses adjustment records instead of changing schedule unit pricing. This makes the system easier to audit, safer to reverse, and more accurate for odd-dollar and multi-unit scenarios.

### What Changed

1. Variance handling now uses adjustment records

- When a user chooses to absorb an overage into the current schedule, the system creates an adjustment record.
- When a user chooses to apply the impact to the current and future schedules, the system creates separate adjustment records for each affected schedule.
- Schedule unit pricing is no longer used as the mechanism for these variance resolutions.

2. Flex-child schedules are only created on final confirmation

- Previewing a match or switching between options no longer creates a child flex schedule in the background.
- A child flex schedule is created only when the user explicitly confirms the flex-child option.

3. Undo behavior is more precise

- Undo now removes only the records created by the specific reconciliation action being reversed.
- This includes adjustment records and flex-child schedules created by that match group.
- Older or unrelated schedule records are not supposed to be touched by the undo flow.

4. Future-schedule propagation is tracked explicitly

- When a user applies an adjustment across the current and future schedules, each impacted schedule receives its own tracked adjustment record.
- This makes the system more transparent and improves auditability.

5. Candidate visibility is cleaner

- Standard matching logic now excludes flex and legacy child-style schedules from normal candidate lists where they should not appear.
- This should reduce confusion and avoid matching against records that are intended only for flex workflows or historical cleanup.

6. Variance messaging was updated

- The modal language now reflects the actual system behavior:
  - adjust current schedule
  - adjust current and future schedules
  - create flex child
- Confirmation and preview text now describe adjustment behavior instead of implying schedule price edits.

### Business Value

- Better audit trail for reconciliation decisions
- Safer undo behavior
- Better handling of uneven dollar amounts
- Less risk of accidental data creation during preview
- Clearer user guidance in the variance-resolution workflow

### Included in This Release

- Current-schedule adjustment flow
- Current-and-future adjustment flow
- Final-confirm flex-child creation flow
- Match-group undo cleanup for created artifacts
- Updated reconciliation messaging and option labels

### Controlled Follow-Up Items

The following support work was added, but these should be treated as controlled follow-up items rather than assumed end-user behavior changes:

- Legacy flex inventory tooling was added to identify historical flex and orphan child records before any cleanup is performed.
- Duplicate-suggestion investigation tooling was added to compare records such as `12698` and `12710` before any suppression rule is introduced.

No client-facing claim should be made that legacy flex cleanup or duplicate-candidate suppression is complete unless those data reviews are performed and approved separately.

## UAT Guide

### UAT Objective

Confirm that reconciliation variance handling now behaves correctly for:

- adjust current schedule only
- adjust current and future schedules
- create flex child on final confirmation only
- undo for each scenario
- odd-dollar and multi-unit overages
- updated modal copy and option behavior

### Recommended Test Data

Use test data that includes:

- one deposit line with a small overage against a single revenue schedule
- one deposit line with an overage large enough to require the variance modal
- one revenue schedule that has future schedules in the same chain
- one case where flex-child creation is the correct outcome
- one case with uneven dollars such as `$10.01`, `$12.37`, or another amount that does not divide evenly by unit quantity

### UAT Preconditions

Before starting UAT, confirm:

- the latest database migration has been applied
- the environment includes the reconciliation changes from March 24, 2026
- the tester has access to deposits, revenue schedules, and match undo actions

### Test 1: Preview does not create a flex child

Purpose:
Verify that preview and option selection are non-persistent until final confirmation.

Steps:
1. Open a deposit line that will trigger the variance-resolution modal.
2. Review the available options.
3. Select the flex-child option, but do not confirm.
4. Close the modal or switch to another option.
5. Check Suggested Matches, revenue schedule lists, and the parent schedule detail.

Expected result:

- No new child flex schedule exists.
- No temporary child record appears in Suggested Matches.
- The parent schedule remains unchanged.

### Test 2: Adjust current schedule only

Purpose:
Verify Scenario A behavior.

Steps:
1. Open a deposit line with an overage that requires manual resolution.
2. Select `Adjust Current Schedule`.
3. Confirm the action.
4. Review the matched schedule and any visible audit or adjustment detail.
5. Review future schedules in the same chain.

Expected result:

- The current schedule reflects the adjustment outcome.
- Future schedules remain unchanged.
- Schedule pricing is not rewritten as the method of resolution.
- The reconciliation completes without creating a flex child.

### Test 3: Adjust current and future schedules

Purpose:
Verify Scenario B behavior.

Steps:
1. Open a deposit line tied to a schedule that has future schedules in the same chain.
2. Select `Adjust Current + Future`.
3. Confirm the action.
4. Review the current schedule.
5. Review the next future schedule and at least one later schedule in the chain.

Expected result:

- The current schedule reflects an adjustment.
- Each applicable future schedule reflects its own adjustment.
- The schedules remain separate records; the system should not overwrite prior adjustment history.
- No flex child is created.

### Test 4: Create flex child on final confirmation

Purpose:
Verify Scenario C behavior.

Steps:
1. Open a deposit line that should be resolved through flex-child creation.
2. Select `Create Flex Child`.
3. Confirm the action.
4. Review the parent schedule detail and any flex report or flex-specific view.
5. Review standard schedule candidate lists.

Expected result:

- A child flex schedule is created only after confirmation.
- The child schedule uses child numbering behavior tied to the parent schedule.
- The parent schedule remains unchanged by adjustment logic.
- The child is visible only in the intended flex-related locations, not as a normal standard candidate.

### Test 5: Undo after Adjust Current Schedule

Purpose:
Verify precise undo for Scenario A.

Steps:
1. Complete Test 2.
2. Use the undo or unmatch action for that reconciliation group.
3. Reopen the affected schedule.

Expected result:

- The adjustment created by that action is removed.
- No unrelated schedules or historical records are changed.
- The deposit line returns to its prior unreconciled state.

### Test 6: Undo after Adjust Current + Future

Purpose:
Verify precise undo for Scenario B.

Steps:
1. Complete Test 3.
2. Use the undo or unmatch action for that reconciliation group.
3. Review the current schedule and the future schedules that were previously affected.

Expected result:

- Only the adjustment records created by that specific action are removed.
- Other historical schedule activity remains intact.
- The chain returns to its pre-action state for this reconciliation event.

### Test 7: Undo after Create Flex Child

Purpose:
Verify precise undo for Scenario C.

Steps:
1. Complete Test 4.
2. Use the undo or unmatch action for that reconciliation group.
3. Review the parent schedule, flex report, and standard schedule list.

Expected result:

- The created flex child is removed.
- The parent schedule remains intact.
- No unrelated flex or standard schedules are removed.

### Test 8: Odd-dollar overage handling

Purpose:
Verify that uneven amounts are handled without forcing unit-price distortion.

Steps:
1. Use a deposit line with an uneven overage amount such as `$10.01`.
2. Resolve it with `Adjust Current Schedule`.
3. Repeat with `Adjust Current + Future`.
4. Review the resulting schedule values and audit trail.

Expected result:

- The exact total adjustment amount is preserved.
- The system does not rely on awkward rounded unit-price changes to force the result.
- Repeated adjustments accumulate correctly.

### Test 9: Candidate list cleanliness

Purpose:
Verify that standard matching candidates are cleaner after the update.

Steps:
1. Open normal reconciliation matching for a deposit line.
2. Review the candidate revenue schedules shown.
3. Compare against any known flex or legacy child schedules in the tenant.

Expected result:

- Standard candidates should not be polluted by flex-only or legacy child-style records that are outside the intended matching path.

### Test 10: Variance modal copy and state behavior

Purpose:
Verify that the UI wording and states align with the implemented behavior.

Steps:
1. Trigger the variance-resolution modal.
2. Review the option labels, descriptions, and confirmation text.
3. Do not select an option and confirm that apply is blocked where intended.
4. Select each option in turn and review the messaging.

Expected result:

- Labels clearly distinguish:
  - adjust current schedule
  - adjust current and future
  - create flex child
- Messaging describes adjustments rather than price edits.
- Apply cannot proceed until the required selection is made.

## UAT Sign-Off Checklist

Mark each item as Pass, Fail, or Needs Follow-Up:

- Preview does not create a flex child before confirmation
- Adjust Current Schedule changes only the current schedule
- Adjust Current + Future updates the intended schedule chain only
- Create Flex Child creates a child only after final confirmation
- Undo removes only records created by the specific reconciliation action
- Odd-dollar overages are preserved accurately
- Standard candidate lists no longer show inappropriate flex or legacy child records
- Variance modal copy matches actual behavior

## Suggested Defect Logging Format

For each issue found in UAT, capture:

- test case number
- deposit id
- revenue schedule number(s)
- selected option
- expected result
- actual result
- screenshot or recording

## Internal Notes for Review Team

- If UAT reveals legacy `FLEX-` records or orphan child records still appearing in unexpected places, route those findings into the legacy inventory and cleanup follow-up rather than treating them as a regression in the new adjustment-ledger behavior by default.
- If UAT reveals a suspected duplicate suggestion such as `12710`, capture both schedule numbers and route that into the duplicate-investigation follow-up unless the duplicate logic has already been formally approved for suppression.
