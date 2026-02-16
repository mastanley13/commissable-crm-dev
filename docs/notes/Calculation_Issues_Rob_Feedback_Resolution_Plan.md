# Calculation Issues - Rob Feedback Resolution Plan

Date: 2026-02-10
Source issue note: `docs/notes/Calculation_Issues_Rob_Feedback.md`

## Objective
Fix stale or missing recalculation of revenue schedule expected values when Quantity, Price Each, Usage Adjustment, or Expected Commission Rate changes (single edit and bulk apply), and ensure values are persisted and consistent after refresh.

## Confirmed Findings (Code-Level)
1. Bulk update writes input fields but does not recompute/persist expected usage and expected commission fields.
- Evidence: `app/api/revenue-schedules/bulk-update/route.ts:75`, `app/api/revenue-schedules/bulk-update/route.ts:98`, `app/api/revenue-schedules/bulk-update/route.ts:114`, `app/api/revenue-schedules/bulk-update/route.ts:136`.
- Current behavior: updates `opportunityProduct.quantity`, `opportunityProduct.unitPrice`, `revenueSchedule.usageAdjustment`, and `product.commissionPercent`, but not `revenueSchedule.expectedUsage` / `revenueSchedule.expectedCommission`.

2. Single-schedule PATCH computes commission using the old product rate, then updates product rate later without a second recalculation.
- Evidence: expected commission computed from existing rate at `app/api/revenue-schedules/[revenueScheduleId]/route.ts:494` and `app/api/revenue-schedules/[revenueScheduleId]/route.ts:496`; rate update occurs later at `app/api/revenue-schedules/[revenueScheduleId]/route.ts:537`.
- Impact: changing expected rate can leave commission gross/net stale until another operation happens.

3. Rate changes currently mutate `Product.commissionPercent` (shared field), which can affect schedules outside the selected set.
- Evidence: `app/api/revenue-schedules/bulk-update/route.ts:117`, `app/api/revenue-schedules/bulk/update-rate/route.ts:135`, `app/api/revenue-schedules/[revenueScheduleId]/route.ts:537`.
- Impact: conflicts with requirement that unselected schedules must not change.

4. Revenue Schedules list computes displayed expected rate from existing amounts, not from authoritative rate input.
- Evidence: UI sends `expectedCommissionRatePercent: null` at `app/(dashboard)/revenue-schedules/page.tsx:1259` and then derives display rate at `app/(dashboard)/revenue-schedules/page.tsx:1272`.
- Impact: if expected commission is stale, displayed rate is stale/misleading.

5. Formula contract drift exists for commission base.
- Evidence: math helper derives `expectedCommissionGross` from `expectedUsageNet * expectedRateFraction` at `lib/revenue-schedule-math.ts:185`.
- Requested behavior example uses gross base (`expectedUsageGross * rate`).

6. `expectedCommissionAdjustment` exists in bulk patch input but is explicitly not persisted.
- Evidence: `app/api/revenue-schedules/bulk-update/route.ts:128`.

7. `effectiveDate` is accepted in bulk update payload but currently unused.
- Evidence: request type includes field at `app/api/revenue-schedules/bulk-update/route.ts:23`.

## Root Cause Summary
- Recalculation logic is duplicated and incomplete across endpoints.
- Derived values are treated as partly persisted and partly display-derived, causing drift.
- Rate ownership is product-level, while the requested behavior is schedule-selection-level.
- UI rate display is derived from potentially stale amounts.

## Confirmed Decisions (Locked)
These are verified and should be treated as implementation constraints.

1. Commission base (formula contract)
- Use `ExpectedUsageGross * Rate` for `Expected Commission Gross`.
- This matches Rob's worked example and the acceptance criteria package.

2. Rate ownership model (authoritative source of truth)
- The schedule-level rate is authoritative for calculations and updates.
- Do not mutate a shared product rate during "apply to selected."
- Product rate may remain as a default for new schedules only.

3. Commission adjustment storage
- Implement Option B: add a dedicated `expectedCommissionAdjustment` field with a migration.
- Do not overload `actualCommissionAdjustment` for expected adjustments (avoid semantic corruption).

## Implementation Plan

### Phase 1 - Centralize deterministic calculation service
1. Add a server-shared calculator (single source of truth) for:
- `expectedUsageGross = qty * price`
- `expectedUsageNet = expectedUsageGross + usageAdjustment`
- `expectedCommissionGross = expectedUsageGross * rate`
- `expectedCommissionNet = expectedCommissionGross + expectedCommissionAdjustment`
2. Add consistent rounding utilities (currency 2 decimals, rate normalization once).
3. Enforce a single rate representation at service boundaries (percent points in API input, fraction in math internals).

Suggested files:
- New: `lib/revenue-schedule-calculations.ts`
- Update consumers: `lib/revenue-schedule-math.ts` (or adapt to call shared calculator)

### Phase 1.5 - Schema Changes (Enable Correct Ownership + Persistence)
1. Add schedule-level expected commission rate field
- Add `RevenueSchedule.expectedCommissionRatePercent` as `Decimal? @db.Decimal(5, 2)` (percent points, e.g. `12.34` means `12.34%`).
- Migration/backfill: for existing schedules, populate from the current effective product rate at migration time.
- Going forward: schedule uses this field for rate; product rate is only a default used when creating a new schedule (snapshot into the schedule field).

2. Add dedicated expected commission adjustment field
- Add `RevenueSchedule.expectedCommissionAdjustment` as `Decimal? @db.Decimal(16, 2)`.
- Migration/backfill: copy current legacy "expected adjustment" values into the new column if/where they exist today.
  - Note: today, UI/API behavior suggests `actualCommissionAdjustment` has been used as "Expected Commission Adjustment."
  - To avoid data loss, initial migration should copy `actualCommissionAdjustment -> expectedCommissionAdjustment` (do not delete/overwrite `actualCommissionAdjustment`).
  - After rollout, we can run a data-cleanup script if we want to normalize semantics for records that truly represent actual adjustments.

### Phase 2 - Fix write paths to always persist recalculated values
1. Update `app/api/revenue-schedules/[revenueScheduleId]/route.ts`:
- Resolve final inputs first (including new rate), then compute once, then persist schedule + related entities in one transaction.
- Ensure rate-only edits recompute and persist commission values immediately.
- Persist into the correct schedule-owned fields:
  - `RevenueSchedule.expectedUsage`
  - `RevenueSchedule.expectedCommission`
  - `RevenueSchedule.expectedCommissionRatePercent`
  - `RevenueSchedule.expectedCommissionAdjustment`

2. Update `app/api/revenue-schedules/bulk-update/route.ts`:
- For each selected schedule, resolve effective qty/price/rate/adjustments and persist recomputed expected fields.
- Stop mutating `Product.commissionPercent` as part of "apply to selected."
- Persist schedule-level `expectedCommissionRatePercent` when the rate is changed via bulk apply.
- Persist `expectedCommissionAdjustment` (do not ignore it).
- Implement `effectiveDate` semantics:
  - Apply bulk changes only to schedules with `scheduleDate >= effectiveDate` (matching how `/bulk/update-rate` already filters).

3. Update `app/api/revenue-schedules/bulk/update-rate/route.ts`:
- After rate updates, recompute and persist affected schedules so values are not stale.
- Return schedule-level update counts and failures clearly.
- Update behavior to be schedule-scoped:
  - Do not write `Product.commissionPercent` for "selected schedules."
  - Write `RevenueSchedule.expectedCommissionRatePercent` for schedules in scope and recompute expected commission.

### Phase 3 - Align read models and UI display with authoritative data
1. API mapping:
- Return expected rate explicitly from authoritative source in list/detail payloads.
- Avoid relying on derived rate from stale gross/net fields.
- Ensure list/detail return the schedule-owned `expectedCommissionRatePercent` (percent points), not a derived value from amounts.

2. UI:
- In `app/(dashboard)/revenue-schedules/page.tsx`, stop passing `expectedCommissionRatePercent: null` during rate display calculations.
- Prefer server-returned expected rate for display.
- Ensure UI sends and expects schedule-owned rate values for inline edit + bulk apply.

3. Opportunity context consistency:
- Align opportunity revenue schedule mapping (`app/api/opportunities/helpers.ts`) to the same formula contract and base.

### Phase 4 - Testing and regression coverage
1. Unit tests for calculator:
- Qty/price/rate/adjustment combinations.
- Negative adjustments.
- Rounding edge cases.
- Rate parsing/normalization.

2. Integration tests:
- Single schedule PATCH recalculates and persists dependent fields.
- Bulk update recalculates only selected schedules.
- Rate-only updates cascade to commission fields.
- Refresh confirms persisted state.

3. UI/E2E:
- Bulk apply updates display immediately.
- Refresh preserves values.
- Backend failure keeps UI state consistent with persisted data.

Suggested tests:
- Extend `tests/revenue-schedule-math.test.ts`
- Add route integration tests for `app/api/revenue-schedules/bulk-update/route.ts`
- Add route integration tests for `app/api/revenue-schedules/[revenueScheduleId]/route.ts`

### Phase 5 - Data repair and rollout safety
1. Create a one-time backfill script to recompute `expectedUsage` and `expectedCommission` for existing schedules.
2. Run in dry-run mode first with diff output.
3. Roll out behind a short-lived feature flag if needed, with audit logging for changed records.

## Acceptance Criteria Mapping
- A1/A2/A3: Covered by Phase 2 single + bulk write-path recalculation.
- B4/B5: Covered by Phase 2 + Phase 3 (selected-only integrity and immediate UI consistency).
- C6/C7: Covered by Phase 1 rounding/rate normalization + persisted recomputation.
- D8/D9: Covered by Phase 4 negative tests and error-state handling.

## Definition of Done
1. Single and bulk schedule edits recalculate and persist all dependent expected fields.
2. Rate changes recalculate dependent commission fields immediately.
3. No stale computed values after refresh.
4. Selected-only behavior verified by integration tests.
5. Existing stale records repaired by backfill script and validated.

## Implementation Prep (Next Execution Checklist)
This section is intended to make the coding phase mechanical and low-risk.

1. Add Prisma schema + migrations.
Update `prisma/schema.prisma` to add schedule-owned fields: `RevenueSchedule.expectedCommissionRatePercent Decimal? @db.Decimal(5, 2)` and `RevenueSchedule.expectedCommissionAdjustment Decimal? @db.Decimal(16, 2)`.
Create migration SQL to: backfill `expectedCommissionRatePercent` from the effective product rate at migration time; copy legacy expected adjustment values into `expectedCommissionAdjustment` (initially: copy `actualCommissionAdjustment -> expectedCommissionAdjustment` without deleting or overwriting the old column).

2. Centralize calculator + lock the formula contract in code.
Add `lib/revenue-schedule-calculations.ts` (server-shared) plus unit tests; update `lib/revenue-schedule-math.ts` so any UI-derived metrics match the locked contract (`expectedCommissionGross = expectedUsageGross * rate`).

3. Update API write paths to persist recalculated values (single + bulk).
Update `app/api/revenue-schedules/[revenueScheduleId]/route.ts` to compute once using final inputs (including schedule-owned rate and expected commission adjustment) and persist `expectedUsage`, `expectedCommission`, `expectedCommissionRatePercent`, and `expectedCommissionAdjustment`.
Update `app/api/revenue-schedules/bulk-update/route.ts` to: honor `effectiveDate` (only schedules with `scheduleDate >= effectiveDate`); never mutate `Product.commissionPercent` for selection-scoped updates; persist recomputed expected fields for every updated schedule.
Update `app/api/revenue-schedules/bulk/update-rate/route.ts` to be schedule-scoped (write schedule-owned rate, recompute expected commission, do not write product rate).
Update schedule creation/clone flows to snapshot the schedule-owned rate and expected commission adjustment at creation time (e.g. `app/api/opportunities/[opportunityId]/revenue-schedules/create/route.ts`, `app/api/revenue-schedules/[revenueScheduleId]/clone/route.ts`).

4. Update API read models + UI display to use authoritative schedule-owned rate.
Update `app/api/revenue-schedules/helpers.ts` and `app/api/opportunities/helpers.ts` to use `RevenueSchedule.expectedCommissionRatePercent` and the locked formula contract; update `app/(dashboard)/revenue-schedules/page.tsx` to display expected rate from server payload (stop deriving it from potentially stale amounts).

5. Add/extend tests to prevent regression.
Unit: extend `tests/revenue-schedule-math.test.ts` for the gross-based commission contract and rounding.
Integration: add coverage for `POST /api/revenue-schedules/bulk-update` (recalc + persistence + selection-only + effectiveDate) and `PATCH /api/revenue-schedules/:id` (rate change triggers commission recalc), plus `POST /api/revenue-schedules/bulk/update-rate` (schedule-owned rate update + recompute).
