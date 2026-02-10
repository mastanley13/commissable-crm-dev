# Plan: Skip Total/Subtotal Rows in Single-Vendor Deposit Import

## Goal
Apply existing totals/subtotals row detection from `lib/deposit-import/multi-vendor.ts` to the single-vendor import loop in `app/api/reconciliation/deposits/import/route.ts` so summary rows are not imported as deposit line items.

- Impact: High (prevents incorrect line imports and reconciliation noise)
- Effort: Low (~1-2 hours)
- Primary validation target: `TC-16` in `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Guide.md` and `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Script.csv`

## Current State (Observed)
- Multi-vendor flow already skips totals rows via helpers in `lib/deposit-import/multi-vendor.ts` (`rowHasTotalsLabel`, `shouldSkipMultiVendorRow`).
- Single-vendor flow in `app/api/reconciliation/deposits/import/route.ts` currently skips rows only when both usage and commission are null.
- Resulting gap: rows like `Total`, `SubTotal`, or `Grand Total` with numeric values can still be imported in single-vendor mode.

## Scope
- In scope:
1. Update single-vendor row processing in `app/api/reconciliation/deposits/import/route.ts`.
2. Reuse existing totals-detection logic from `lib/deposit-import/multi-vendor.ts` (no new pattern logic).
3. Add/extend automated coverage for single-vendor totals skipping.

- Out of scope:
1. Changing multi-vendor logic.
2. Changing field mapping UX.
3. Broad parser refactors.

## Implementation Steps
1. Import totals helper in route.
- Add an import for `rowHasTotalsLabel` from `@/lib/deposit-import/multi-vendor` in `app/api/reconciliation/deposits/import/route.ts`.
- Why: avoids duplicate regex logic and keeps behavior consistent across single- and multi-vendor flows.

2. Add skip guard in single-vendor loop.
- In the single-vendor `parsedFile.rows.map(...)` block, short-circuit rows when `rowHasTotalsLabel(row)` is true.
- Place the guard before usage/commission parsing so totals rows are ignored regardless of numeric content.
- Why: totals rows often contain amounts and currently bypass the null-check filter.

3. Preserve existing valid-row behavior.
- Keep the existing usage/commission null-check as-is after totals filtering.
- Why: preserves current behavior for blank/non-transaction rows and commission-only handling.

4. Add automated test coverage for the gap.
- Add a new integration case in `tests/integration-deposit-import-route.test.ts`:
1. Single-vendor CSV containing normal rows plus `Total`/`SubTotal`/`Grand Total` rows with numeric values.
2. Assert successful import.
3. Assert persisted `depositLineItem` count equals only transactional rows.
- Why: prevents regressions and directly enforces TC-16 expectation for single-vendor path.

5. Run focused test suite.
- Execute:
1. `tests/integration-deposit-import-route.test.ts`
2. `tests/multi-vendor-skip-rows.test.ts`
- Why: validates the changed path and confirms helper behavior still matches existing expectations.

6. Manual QA pass aligned to runbook.
- Re-run `TC-16` from:
1. `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Guide.md`
2. `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Script.csv`
- Confirm line count excludes summary rows in both multi-vendor and single-vendor uploads.

## Acceptance Criteria
1. Single-vendor uploads do not create deposit line items for rows labeled `Total`, `Totals`, `SubTotal`, `Sub-total`, `Grand Total`, or `Grand Totals`.
2. Legitimate transactional/vendor values (for example `Total Telecom`) are not incorrectly filtered.
3. Existing commission-only behavior remains unchanged.
4. TC-16 expected outcome passes for both upload modes.

## Risks and Mitigations
1. Risk: false positives on non-summary business text containing total-like wording.
- Mitigation: rely on existing `rowHasTotalsLabel` logic already validated in `tests/multi-vendor-skip-rows.test.ts` (including `Total Telecom` non-match case).

2. Risk: behavior drift between upload modes over time.
- Mitigation: shared helper usage and targeted integration coverage in single-vendor route.

## Time Breakdown (~1-2h)
1. Code change in `route.ts`: 15-25 minutes.
2. Integration test addition/update: 30-45 minutes.
3. Focused test execution + quick fix cycle: 20-30 minutes.
4. Manual TC-16 spot-check + evidence capture: 15-20 minutes.
