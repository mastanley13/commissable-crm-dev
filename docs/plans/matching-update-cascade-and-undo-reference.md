# Matching Update Cascade & Undo Reference

> How applying a match propagates changes from **Deposit** through **Opportunity** to **Product Catalog**, and exactly what **Undo** must revert.

---

## 1. Overview

When a user applies a match (or the auto-matcher does), the system creates a `DepositLineMatch` linking a `DepositLineItem` to a `RevenueSchedule`. That single action triggers a cascade of updates across **five** entity layers:

```
DepositLineMatch (created)
  --> DepositLineItem   (allocation totals + status)
  --> RevenueSchedule   (actual amounts + reconciliation status + billing status)
  --> Deposit           (aggregate totals + status)
  --> Opportunity       (vendor ID fields auto-filled)
  --> Product           (vendor name/part-number auto-filled)
```

All updates happen inside a single Prisma `$transaction`, so either everything commits or nothing does.

---

## 2. Layer-by-Layer: What Gets Updated on Match Apply

### 2.1 DepositLineMatch (created/upserted)

| Field | Value |
|---|---|
| `depositLineItemId` | The deposit line being matched |
| `revenueScheduleId` | The target revenue schedule |
| `usageAmount` | Allocated usage portion of the line |
| `commissionAmount` | Allocated commission portion of the line |
| `status` | `Applied` |
| `source` | `Manual` (user action) or `Auto` (auto-matcher) |
| `matchGroupId` | Links to the parent `DepositMatchGroup` |
| `confidenceScore` | Matching confidence (auto-match only) |

**Source code:** `app/api/reconciliation/deposits/[depositId]/matches/apply/route.ts:169-194`

### 2.2 DepositLineItem (recomputed)

After all matches are upserted, `recomputeDepositLineItemAllocations()` recalculates these fields:

| Field | How It's Computed |
|---|---|
| `status` | `Matched` (fully allocated), `PartiallyMatched` (some allocated), or `Unmatched` (none) |
| `primaryRevenueScheduleId` | The schedule with the largest allocation weight |
| `usageAllocated` | `SUM(match.usageAmount)` across all Applied matches |
| `usageUnallocated` | `line.usage - usageAllocated` (floored at 0) |
| `commissionAllocated` | `SUM(match.commissionAmount)` across all Applied matches |
| `commissionUnallocated` | `line.commission - commissionAllocated` (floored at 0) |

**Status logic:** A line is `Matched` when both `usageRemaining` and `commissionRemaining` are within epsilon (0.005).

**Source code:** `lib/matching/deposit-line-allocations.ts:30-141`

### 2.3 RevenueSchedule (recomputed)

`recomputeRevenueScheduleFromMatches()` recalculates from the sum of all `Applied` matches against the schedule:

| Field | How It's Computed |
|---|---|
| `actualUsage` | `SUM(match.usageAmount)` across all Applied matches for this schedule |
| `actualCommission` | `SUM(match.commissionAmount)` across all Applied matches |
| `status` | Derived from balance (see below) |
| `billingStatus` | Auto-updated if `billingStatusSource = Auto` and automation is enabled |

**Status derivation:**

| Condition | Status |
|---|---|
| No matches (`matchCount = 0`) | `Unreconciled` |
| Usage balance and commission difference both within variance tolerance | `Reconciled` |
| Actual exceeds expected (negative balance) | `Overpaid` |
| Actual below expected (positive balance) | `Underpaid` |

Where:
- `expectedUsageNet = expectedUsage + usageAdjustment`
- `actualUsageNet = actualUsage + actualUsageAdjustment`
- `usageBalance = expectedUsageNet - actualUsageNet`
- Tolerance = `abs(expectedUsageNet) * varianceTolerance` (tenant-configurable)

**Source code:** `lib/matching/revenue-schedule-status.ts:80-209`

### 2.4 Deposit (aggregate recomputed)

`recomputeDepositAggregates()` rolls up all line items:

| Field | How It's Computed |
|---|---|
| `totalUsage` | `SUM(line.usage)` |
| `usageAllocated` | `SUM(line.usageAllocated)` |
| `usageUnallocated` | `SUM(line.usageUnallocated)` |
| `totalCommissions` | `SUM(line.commission)` |
| `commissionAllocated` | `SUM(line.commissionAllocated)` |
| `commissionUnallocated` | `SUM(line.commissionUnallocated)` |
| `totalItems` | Count of all line items |
| `itemsReconciled` | Count of `Matched` + `Ignored` lines |
| `itemsUnreconciled` | `totalItems - itemsReconciled` |
| `status` | `Pending` / `InReview` (see below) |

**Deposit status logic:**
- `Pending` &mdash; no items reconciled and no partial matches
- `InReview` &mdash; at least one item is matched, partially matched, or ignored
- `Completed` &mdash; only set via explicit user finalization (never auto-set)

**Source code:** `lib/matching/deposit-aggregates.ts:40-133`

### 2.5 Opportunity (auto-fill from deposit line)

`autoFillFromDepositMatch()` copies vendor identifiers from the deposit line to the **Opportunity** linked through the revenue schedule:

| Opportunity Field | Source (DepositLineItem) | Condition |
|---|---|---|
| `accountIdVendor` | `line.accountIdVendor` | Only if currently empty/null |
| `customerIdVendor` | `line.customerIdVendor` | Only if currently empty/null |
| `orderIdVendor` | `line.orderIdVendor` | Only if currently empty/null |

Values are canonicalized via `canonicalizeMultiValueString()` before writing.

**Audit trail:** Creates an `AuditLog` entry with:
- `action: Update`, `entityName: Opportunity`
- `metadata.action: "AutoFillFromDepositMatch"`
- `previousValues` and `newValues` snapshots for each changed field
- References to `depositId`, `depositLineItemId`, `revenueScheduleId`, `depositLineMatchId`

**Source code:** `lib/matching/auto-fill.ts:49-121`

### 2.6 Product Catalog (auto-fill from deposit line)

The same `autoFillFromDepositMatch()` function also updates the **Product** linked through the revenue schedule:

| Product Field | Source (DepositLineItem) | Condition |
|---|---|---|
| `productNameVendor` | `line.productNameRaw` | Only if currently empty/null |
| `partNumberVendor` | `line.partNumberRaw` | Only if currently empty/null |

Values are canonicalized (`kind: "text"` for product name, `kind: "id"` for part number).

**Audit trail:** Creates an `AuditLog` entry with:
- `action: Update`, `entityName: Product`
- `metadata.action: "AutoFillFromDepositMatch"`
- `previousValues` and `newValues` snapshots for each changed field
- Same deposit/schedule references as the Opportunity audit

**Source code:** `lib/matching/auto-fill.ts:123-189`

---

## 3. What Undo Must Revert

There are **two undo paths**: group undo (undoing an entire match group) and individual line unmatch.

### 3.1 Group Undo (`POST .../matches/{matchGroupId}/undo`)

This undoes all matches that were applied as part of a `DepositMatchGroup`.

**Source code:** `app/api/reconciliation/deposits/[depositId]/matches/[matchGroupId]/undo/route.ts`

#### Step-by-step revert sequence (within a single transaction):

| Step | Action | Detail |
|---|---|---|
| 1 | **Find the apply audit log** | Looks up the `AuditLog` with `metadata.action = "ApplyMatchGroup"` for this group to recover snapshots |
| 2 | **Parse pre-existing match snapshots** | Extracts `existingMatchesBefore` from the apply audit &mdash; these are matches that existed before the group was applied (for cases where apply upserted over a previous match) |
| 3 | **Collect auto-fill audit log IDs** | Extracts `autoFillAuditLogIds` recorded during apply &mdash; these identify which Opportunity/Product fields were auto-filled |
| 4 | **Undo auto-fill on Opportunity** | For each auto-fill audit log targeting an Opportunity, calls `undoAutoFillAuditLog()` which: |
|   | | - Reads the audit log's `newValues` (what was written) |
|   | | - Reads the current Opportunity field value |
|   | | - **Conflict check:** If `currentValue !== newValues[field]`, throws `UndoAutoFillConflictError` (field was changed by someone else since auto-fill &mdash; undo is skipped for that field) |
|   | | - If no conflict: restores `previousValues[field]` (the value before auto-fill) |
|   | | - Creates audit log with `metadata.action: "UndoAutoFillFromDepositMatch"` |
| 5 | **Undo auto-fill on Product** | Same logic as Opportunity, but for `productNameVendor` and `partNumberVendor` |
| 6 | **Restore pre-existing matches** | For each match that had a pre-existing snapshot, restores the previous `usageAmount`, `commissionAmount`, `status`, `source`, and `matchGroupId` |
| 7 | **Delete group matches** | `deleteMany` all `DepositLineMatch` records still pointing to this `matchGroupId` |
| 8 | **Mark group as undone** | Updates `DepositMatchGroup`: `status = Undone`, `undoneAt`, `undoneByUserId`, `undoReason` |
| 9 | **Recompute line items** | Calls `recomputeDepositLineItemAllocations()` for each affected line &mdash; recalculates `status`, `usageAllocated`, `usageUnallocated`, `commissionAllocated`, `commissionUnallocated`, `primaryRevenueScheduleId` |
| 10 | **Recompute revenue schedules** | Calls `recomputeRevenueSchedules()` for each affected schedule &mdash; recalculates `actualUsage`, `actualCommission`, `status`, and potentially `billingStatus` |
| 11 | **Recompute deposit aggregates** | Calls `recomputeDepositAggregates()` &mdash; recalculates all deposit-level totals and `status` |

#### Auto-fill undo conflict handling:

| Scenario | Behavior |
|---|---|
| Current value === auto-filled value | Restores to previous value (undo succeeds) |
| Current value !== auto-filled value | `UndoAutoFillConflictError` &mdash; field was modified after auto-fill, undo is **skipped** for that field (logged but does not block the overall undo) |
| Entity not found | `UndoAutoFillEntityNotFoundError` &mdash; skipped, logged |
| Audit log not found | `UndoAutoFillNotUndoableError` &mdash; skipped, logged |

**Source code:** `lib/audit/undo-auto-fill.ts:59-223`

### 3.2 Individual Line Unmatch (`POST .../line-items/{lineId}/unmatch`)

This removes **all** matches for a single deposit line item.

**Source code:** `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route.ts`

#### What gets reverted:

| Entity | Field(s) | Reverted To |
|---|---|---|
| **DepositLineMatch** | (entire records) | Deleted (`deleteMany`) |
| **DepositLineItem** | `status` | `Unmatched` |
| | `primaryRevenueScheduleId` | `null` |
| | `usageAllocated` | `0` |
| | `usageUnallocated` | `line.usage` (full original amount) |
| | `commissionAllocated` | `0` |
| | `commissionUnallocated` | `line.commission` (full original amount) |
| **RevenueSchedule** | `actualUsage`, `actualCommission`, `status`, `billingStatus` | Recomputed via `recomputeRevenueSchedules()` |
| **Deposit** | All aggregate fields + `status` | Recomputed via `recomputeDepositAggregates()` |
| **Flex Schedules** | Auto-created flex schedules sourced from this line | Soft-deleted (`deletedAt = now()`) if no other matches reference them |

**Note:** Individual line unmatch does **not** currently undo auto-fill on Opportunity/Product fields. Only group undo tracks and reverts auto-fill.

---

## 4. Complete Entity Update Matrix

| Entity | Field | Apply (Match) | Group Undo | Line Unmatch |
|---|---|---|---|---|
| **DepositLineMatch** | (record) | Created/upserted | Deleted (or restored to snapshot) | Deleted |
| **DepositMatchGroup** | `status` | `Applied` | `Undone` | N/A |
| | `undoneAt` | N/A | Set to now | N/A |
| | `undoneByUserId` | N/A | Set to current user | N/A |
| **DepositLineItem** | `status` | Recomputed | Recomputed | `Unmatched` |
| | `primaryRevenueScheduleId` | Recomputed | Recomputed | `null` |
| | `usageAllocated` | Recomputed | Recomputed | `0` |
| | `usageUnallocated` | Recomputed | Recomputed | `line.usage` |
| | `commissionAllocated` | Recomputed | Recomputed | `0` |
| | `commissionUnallocated` | Recomputed | Recomputed | `line.commission` |
| **RevenueSchedule** | `actualUsage` | Recomputed | Recomputed | Recomputed |
| | `actualCommission` | Recomputed | Recomputed | Recomputed |
| | `status` | Recomputed | Recomputed | Recomputed |
| | `billingStatus` | Auto-updated (if Auto source) | Auto-updated (if Auto source) | Auto-updated (if Auto source) |
| **Deposit** | `totalUsage` | Recomputed | Recomputed | Recomputed |
| | `usageAllocated` | Recomputed | Recomputed | Recomputed |
| | `usageUnallocated` | Recomputed | Recomputed | Recomputed |
| | `totalCommissions` | Recomputed | Recomputed | Recomputed |
| | `commissionAllocated` | Recomputed | Recomputed | Recomputed |
| | `commissionUnallocated` | Recomputed | Recomputed | Recomputed |
| | `itemsReconciled` | Recomputed | Recomputed | Recomputed |
| | `itemsUnreconciled` | Recomputed | Recomputed | Recomputed |
| | `status` | Recomputed | Recomputed | Recomputed |
| **Opportunity** | `accountIdVendor` | Auto-filled (if empty) | Restored (if no conflict) | **Not reverted** |
| | `customerIdVendor` | Auto-filled (if empty) | Restored (if no conflict) | **Not reverted** |
| | `orderIdVendor` | Auto-filled (if empty) | Restored (if no conflict) | **Not reverted** |
| **Product** | `productNameVendor` | Auto-filled (if empty) | Restored (if no conflict) | **Not reverted** |
| | `partNumberVendor` | Auto-filled (if empty) | Restored (if no conflict) | **Not reverted** |

---

## 5. Audit Trail Summary

Every operation creates audit logs for traceability:

| Operation | Audit Action | Entity | Metadata Key |
|---|---|---|---|
| Apply match group | `Create` | `DepositMatchGroup` | `ApplyMatchGroup` |
| Auto-fill opportunity | `Update` | `Opportunity` | `AutoFillFromDepositMatch` |
| Auto-fill product | `Update` | `Product` | `AutoFillFromDepositMatch` |
| Recompute revenue schedule (on apply) | `Update` | `RevenueSchedule` | `ApplyMatchGroup` |
| Undo match group | `Update` | `DepositMatchGroup` | `UndoMatchGroup` |
| Undo auto-fill opportunity | `Update` | `Opportunity` | `UndoAutoFillFromDepositMatch` |
| Undo auto-fill product | `Update` | `Product` | `UndoAutoFillFromDepositMatch` |
| Recompute revenue schedule (on undo) | `Update` | `RevenueSchedule` | `UndoMatchGroup` |
| Unmatch individual line | `Delete` | `DepositLineMatch` | `RemoveAllocation` |
| Recompute revenue schedule (on unmatch) | `Update` | `RevenueSchedule` | `UnmatchDepositLine` |

---

## 6. Key Source Files

| File | Responsibility |
|---|---|
| `lib/matching/auto-fill.ts` | Auto-fills Opportunity + Product fields from deposit line data |
| `lib/audit/undo-auto-fill.ts` | Reverts auto-fill with conflict detection |
| `lib/matching/deposit-line-allocations.ts` | Recomputes line item allocation totals and status |
| `lib/matching/revenue-schedule-status.ts` | Recomputes revenue schedule actual amounts, status, billing status |
| `lib/matching/deposit-aggregates.ts` | Rolls up all line items into deposit-level aggregates |
| `app/api/.../matches/apply/route.ts` | Apply match group endpoint |
| `app/api/.../matches/[matchGroupId]/undo/route.ts` | Undo match group endpoint |
| `app/api/.../line-items/[lineId]/unmatch/route.ts` | Individual line unmatch endpoint |

---

## 7. Important Behavioral Notes

1. **Auto-fill is write-once**: Fields are only populated if currently empty. If the Opportunity already has `accountIdVendor`, auto-fill will not overwrite it.

2. **Undo auto-fill has conflict detection**: If someone manually edits `accountIdVendor` after auto-fill, undo will detect the conflict and skip that field rather than clobbering the manual edit.

3. **Individual line unmatch does not revert auto-fill**: Only group undo tracks and reverts Opportunity/Product auto-fills. If you unmatch a single line, the vendor IDs and product names stay on the Opportunity/Product.

4. **Revenue schedule status is always recomputed from scratch**: On both apply and undo, `actualUsage` and `actualCommission` are re-aggregated from all Applied matches &mdash; not incremented/decremented. This ensures consistency.

5. **Deposit status never auto-sets to Completed**: Even when all lines are matched, the deposit status only goes to `InReview`. Finalization requires explicit user action.

6. **Billing status respects source**: `billingStatus` is only auto-updated if `billingStatusSource = Auto`. Manual overrides are preserved.

7. **Flex schedules are soft-deleted on unmatch**: Auto-created flex revenue schedules (sourced from the unmatched line) are soft-deleted via `deletedAt` if no other matches reference them.

8. **All operations are transactional**: Apply, undo, and unmatch all run inside `prisma.$transaction()`, ensuring atomicity across all entity layers.
