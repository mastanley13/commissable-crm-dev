# Reconciliation Stale Selection / Unmatch State Plan

Date: 2026-03-12

## Scope

Narrow UI-state fix for the Reconciliation deposit detail page so a successful match does not leave stale line or schedule selections behind.

## Findings

1. The deposit detail page keeps selection state in two places:
   - Page-level `selectedLineId` in `app/(dashboard)/reconciliation/[depositId]/page.tsx`
   - Local multi-select arrays in `components/deposit-reconciliation-detail-view.tsx`
2. Before this fix, successful match flows refreshed the page data but did not fully clear the detail view's local `selectedLineItems` and `selectedSchedules`.
3. The detail view also had logic that re-added the active `selectedLineId` back into the multi-select set after refresh.
4. That combination allowed stale selections to survive a successful match and made the next action look like a multi-line or unmatch-style selection, which could route the user into the wrong `M:1` flow.

## Root Cause

Selection reset after a successful match was incomplete. The page cleared the active line id, but the detail view kept prior line and schedule selections alive across refreshes, and then rehydrated the active line into the selected-lines array.

## Resolution Plan

1. Centralize selection reset logic in a small helper so the cleared state is explicit and reusable.
2. On every successful match mutation path, clear:
   - `selectedLineId`
   - `selectedLineItems`
   - `selectedSchedules`
3. Stop automatically re-adding `selectedLineId` into the selected-lines array after refresh.
4. Keep only still-visible ids when line or schedule data reloads, so hidden stale ids cannot come back.
5. Add a focused regression test for the helper that proves:
   - reset returns an empty selection state
   - filtered selections do not reintroduce cleared rows on refresh

## Implementation Notes

- Main UI fix: `components/deposit-reconciliation-detail-view.tsx`
- Helper: `lib/matching/reconciliation-selection-state.ts`
- Regression coverage: `tests/reconciliation-selection-state.test.ts`

## Verification

1. Match a line to a schedule successfully.
2. Confirm both grids return to a cleared selection state.
3. Select a new line and schedule.
4. Confirm the next action is classified from the new selection only and does not inherit the prior `M:1` or unmatch context.
