# Deposit Auto-Complete Issue Fix

**Date:** 2026-01-21  
**Issue:** Deposit "ACC Business - Telarus - 2026-01-21" was automatically marked as "Completed" when matching a line item, preventing manual finalization.

## Root Cause Analysis

### The Problem

The system was automatically setting deposit status to `Completed` when all line items were matched or ignored, **before** the user clicked the "Finalize Deposit" button.

**Location:** `lib/matching/deposit-aggregates.ts` - `determineDepositStatus()` function

**Original Logic (Line 32):**
```typescript
if (itemsUnreconciled === 0) return ReconciliationStatus.Completed
```

### Why This Happened

1. The `recomputeDepositAggregates()` function is called after **every match operation**
2. For a deposit with 1 line item, when you match it:
   - `itemsReconciled = 1` (matched)
   - `itemsUnreconciled = 0` (none remaining)
   - The system automatically set status to `Completed`
3. When you tried to finalize, the finalize endpoint rejected the request because the deposit was already marked as "Completed"

### The Conceptual Issue

The system was conflating two different concepts:
- **All items matched/allocated** ← Should mean "ready to finalize" (InReview)
- **Deposit finalized by user** ← Should mean "finalized" (Completed)

## The Fix

Changed the automatic status calculation to **never** set status to `Completed`. Only the explicit finalize endpoint can set that status.

### Updated Logic

**File:** `lib/matching/deposit-aggregates.ts`

```typescript
function determineDepositStatus(totals: DepositAggregateTotals) {
  if (totals.totalItems === 0) return ReconciliationStatus.Pending
  const itemsReconciled = totals.matchedCount + totals.ignoredCount
  const itemsUnreconciled = totals.totalItems - itemsReconciled
  // NOTE: We should NOT auto-set to Completed when all items are matched.
  // The user must explicitly finalize the deposit via the finalize endpoint.
  // When all items are matched/ignored, the deposit is ready to finalize (InReview).
  if (itemsUnreconciled === 0 && itemsReconciled > 0) return ReconciliationStatus.InReview
  if (itemsReconciled > 0 || totals.partialCount > 0) return ReconciliationStatus.InReview
  return ReconciliationStatus.Pending
}
```

### Status Flow After Fix

1. **Pending** - No items matched yet
2. **InReview** - Some or all items matched/ignored (ready to finalize)
3. **Completed** - User explicitly clicked "Finalize Deposit" button

## Impact

### Before Fix
- ❌ Deposits with all items matched were automatically marked "Completed"
- ❌ Users couldn't manually finalize (got "already finalized" error)
- ❌ No clear distinction between "ready to finalize" and "finalized"

### After Fix
- ✅ Deposits remain in "InReview" status when all items are matched
- ✅ Users can explicitly finalize via the "Finalize Deposit" button
- ✅ Clear workflow: Match items → Review → Finalize

## Testing Recommendations

1. Upload a new deposit with 1 line item
2. Match the line item to a revenue schedule
3. Verify status shows "InReview" (not "Completed")
4. Click "Finalize Deposit" button
5. Verify status changes to "Completed"
6. Verify deposit is now reconciled (reconciled = true, reconciledAt = timestamp)

## Related Files

- `lib/matching/deposit-aggregates.ts` - Status calculation logic (FIXED)
- `app/api/reconciliation/deposits/[depositId]/finalize/route.ts` - Explicit finalize endpoint
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route.ts` - Calls recomputeDepositAggregates
- `app/api/reconciliation/deposits/[depositId]/auto-match/route.ts` - Calls recomputeDepositAggregates

## Notes

- This fix affects **all** deposit matching workflows
- The `Completed` status is now exclusively controlled by the finalize endpoint
- No other code changes needed - the fix is isolated to the status determination logic
