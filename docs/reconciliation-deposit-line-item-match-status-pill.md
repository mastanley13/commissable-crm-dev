# Deposit Line Items: Match-By-Status Pattern

This document describes the **“status pill doubles as the action”** pattern used on the **Deposit Line Items** table in Deposit Reconciliation.

## Overview

Instead of a dedicated **Match** button column, the **Deposit Status** pill is clickable and performs the relevant action for that row:

- For rows that are not yet matched, clicking the status pill attempts to **apply a match** using the currently selected suggested schedule.
- For rows that are already matched, clicking the status pill **unmatches** (resets) the row.
- For rows that are finalized/reconciled (or otherwise locked), the pill is **read-only**.

The goal is to reduce column noise and make the “current state + next action” obvious in a single UI element.

## User Behavior

### Match (Unmatched/Suggested)

1. Select a schedule in the **Suggested Matches** table.
2. In the **Deposit Line Items** table, click the **Deposit Status** pill for the line you want to match.
3. The UI shows **Updating…** while the match request runs.
4. On success, a toast confirms the match, and the line’s status updates.

If no suggested schedule is selected, clicking the pill will show an error toast prompting the user to select a schedule.

### Unmatch (Matched / Partially Matched)

- Click the **Matched** or **Partially Matched** status pill to reset the line back to **Unmatched** (this clears applied matches and recomputes aggregates).

### Disabled States

The status pill is disabled when:

- The line is **Reconciled** (`row.reconciled === true`).
- The line is **Ignored**.
- The row is currently updating (match/unmatch request in flight).

## Visual/Interaction Details

- The pill uses the existing status tone classes (`Matched`, `Partially Matched`, `Unmatched`, `Suggested`, `Reconciled`, `Ignored`).
- A small dot is shown inside the pill to reinforce status at a glance.
- While an action is in flight, the pill text becomes **Updating…** and the control is disabled.

## Implementation Notes (Code References)

**Primary UI**

- `components/deposit-reconciliation-detail-view.tsx`:
  - The **Deposit Status** column renders a clickable pill button that decides between **match** and **unmatch** based on current row status.
  - The per-row in-flight state is tracked with `matchingLineId` and `undoingLineId`.

**Match API**

- `POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match`
  - Applies a match to a selected revenue schedule.
  - Source: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route.ts`

**Unmatch API**

- `POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch`
  - Clears matches and resets the line to `Unmatched`, then recomputes aggregates.
  - Source: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route.ts`

## QA Checklist

- Clicking **Unmatched/Suggested** status with **no schedule selected** shows an error toast.
- Selecting a schedule, then clicking **Unmatched/Suggested** status applies a match and updates the row.
- Clicking **Matched/Partially Matched** status unmatches the row.
- Status pill is disabled for **Reconciled** (and **Ignored**) rows.
- While match/unmatch is running, the row shows **Updating…** and ignores additional clicks.

## Recommendations for Reuse

If you apply this pattern elsewhere:

- Keep the element a real `<button>` (not a `<span>`) for accessibility.
- Include `title` and/or `aria-label` that explains the action (“Click to unmatch”, “Select a schedule then click to match”).
- Use per-row loading state so only the affected row locks during updates.
- Avoid baking rapidly-changing state into “base columns” if the table uses persisted column preferences (use refs or a stable indirection).

