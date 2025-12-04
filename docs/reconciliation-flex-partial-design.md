# Reconciliation FLEX & Partial Payment Design (Scaffold)

## Goals
- Capture overage/unknown-product cases via FLEX revenue schedules without blocking baseline reconciliation.
- Support many:1 partial payments with FIFO allocations and clean balances.
- Keep telemetry: log each creation/update so we can tune thresholds before full rollout.

## Minimal Data Flow (proposed)
1. **Detection**
   - Triggered after a match is selected/applied (manual or auto).
   - If `commissionDifference` remains > variance tolerance ⇒ overage FLEX.
   - If no candidate survives filters ⇒ unknown-product FLEX.
2. **FLEX Emission**
   - Create `RevenueSchedule` with suffix `-F` and link back to the original schedule (or deposit line for unknown).
   - Copy distributor/vendor/account, set `status = Projected`, `commissionDifference = overage`, `usageBalance = overage`.
3. **Review Surface**
   - New FLEX table (filterable by type: Overage / Unknown).
   - Columns: Source Deposit, Line #, Account/Vendor, Amount, CreatedAt, Status, Reviewer.
4. **Partial Payment Mechanics (many:1)**
   - On match apply: subtract allocation from `RevenueSchedule.usageBalance` / `commissionDifference`.
   - Status transitions: `Projected|Invoiced` → `PartiallyPaid` (new) → `Reconciled` when balance ≤ 0.
   - FIFO: when multiple open schedules share identifiers, choose oldest `scheduleDate` then `createdAt`.
5. **Metrics to log (via `logMatchingMetric`)**
   - `event: "auto_match" | "manual_match" | "finalize" | "unfinalize"` plus `matchType`, `confidence`, `varianceTolerance`, `includeFutureSchedulesDefault`, `engineMode`.
   - Add events when emitting FLEX (`event: "flex_create"`) and when partially allocating (`event: "partial_allocate"`).

## Open Items (for next iteration)
- Schema deltas: `RevenueSchedule.status` needs `PartiallyPaid`; backlink fields for FLEX (`parentRevenueScheduleId`, `flexType`).
- UI entry point: toggle to “Send overages to FLEX” in reconciliation settings.
- Permissions: FLEX review gated by `reconciliation.manage`.
- Backfill: ensure existing matches recompute balances and emit FLEX where needed.
