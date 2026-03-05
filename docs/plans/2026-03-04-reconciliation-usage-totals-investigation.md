# Reconciliation Deposit List: Usage Total Missing + "Total Revenue" Mislabel

Date: 2026-03-04

## Reported Symptoms (From Screenshots)

Deposit detail page for `ACC Business - Telarus - 2026-02-02` shows:
- `Deposit Total` (usage/billing): `$797.30`
- `Commission Total`: `$127.56`

Reconciliation deposits list for **February 2026** shows the same deposit with:
- `Total Revenue`: `$0.00`
- `Total Commission`: `$127.56`
- No visible usage/billing total column (by default).

## Expected Behavior

- Deposits list should display the deposit usage/billing total (matching the deposit detail’s `Deposit Total`).
- Column label should be `Total Usage/Billing` (or similar), not `Total Revenue`.
- CSV export from the deposits list should export the same usage/billing total and header.

## Findings / Root Cause

1. The deposits list page defaults to showing the `totalRevenue` field as a currency column labeled `Total Revenue`. The default-visible set includes `totalRevenue` but not `totalUsage`. File: `app/(dashboard)/reconciliation/page.tsx` (see around lines 24-33, 96-103).

2. The correct field (`totalUsage`) exists on the list page but is hidden by default (`hidden: true`). File: `app/(dashboard)/reconciliation/page.tsx` (see around lines 232-240).

3. The deposit import pipeline computes and persists `Deposit.totalUsage`, but it does not populate `Deposit.totalRevenue`. Import sums `lineItemsData.usage` into `totalUsage` and updates the deposit with `totalUsage`, `usageAllocated`, and `usageUnallocated`. File: `app/api/reconciliation/deposits/import/route.ts` (see around lines 737-752).

4. The API already returns both `totalRevenue` and `totalUsage`, so the list UI is simply binding to the wrong property by default. File: `app/api/reconciliation/deposits/route.ts` (see `mapDeposit()` around lines 9-29).

5. Prisma schema contains both fields (`Deposit.totalRevenue` and `Deposit.totalUsage`), which makes the misbinding easy to miss. File: `prisma/schema.prisma` (see `model Deposit` around lines 783-806).

## Impact

- Deposits list shows misleading `$0.00` for usage/billing totals for many deposits (where `totalRevenue` is null).
- Users may export incorrect data because the CSV export uses `row.totalRevenue` under a `Total Revenue` header.
- Users can manually add `Total Usage` via the column chooser, but the default UX and labeling are incorrect.

## Plan To Address

1. Update reconciliation deposits list default columns and labels: change default-visible column from `totalRevenue` to `totalUsage`; rename the visible label to `Total Usage/Billing` (and ensure filter/chooser labels match); decide how to handle `totalRevenue` (preferred: hide it by default and label it as deprecated, or remove it from the column list if it is not used anywhere else).

2. Migrate existing saved table preferences for `reconciliation:list`: when loading preferences, if a preference includes `totalRevenue` but not `totalUsage`, swap them (and update the label).

3. Fix deposits list CSV export: change CSV header from `Total Revenue` to `Total Usage/Billing` and export `row.totalUsage` (not `row.totalRevenue`).

4. Validate data assumptions and consider backfill for legacy records: confirm `Deposit.totalUsage` is set for all relevant deposits in production data; if any older deposits have null `totalUsage`, plan a one-time backfill that sums `DepositLineItem.usage` per deposit and updates `Deposit.totalUsage` (and derived allocated/unallocated if needed).

5. Add regression coverage: add a test that the reconciliation deposits list displays usage/billing totals using `totalUsage`; add a test (or minimal coverage) for CSV export headers and values if export is testable in the current test suite.

## Acceptance Criteria

In Reconciliation > Deposits list for February 2026, deposit `ACC Business - Telarus - 2026-02-02` shows:
- `Total Usage/Billing` = `$797.30`
- `Total Commission` = `$127.56`
- The default columns no longer include `Total Revenue`.
- CSV export includes a `Total Usage/Billing` column populated from `totalUsage`.
