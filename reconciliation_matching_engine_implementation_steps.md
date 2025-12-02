# Deposit → Revenue Schedule Matching Engine – Implementation Steps

This document is a **developer-facing checklist** for implementing the deposit line item → revenue schedule matching logic, assuming:

- Another agent will complete the **schema work** for `DepositLineItem` (and any related tables).
- This plan will be used **after** schema is stable to implement the **matching engine, APIs, and UI wiring** with minimal surprises.

It is written to be **implementation-ready**: each section is an ordered set of concrete steps you can follow.

---

## 0. Confirm Inputs, Outputs, and Invariants

Before writing matching code, confirm the core contracts so we don’t build against incorrect assumptions.

### 0.1. Deposit & Line Item Data Contract

1. Confirm the final Prisma model(s) for:
   - `Deposit`
   - `DepositLineItem`
   - (Optional but recommended) `DepositLineMatch` join table.
2. For **each `DepositLineItem`**, list the fields available for matching:
   - Identifiers: `accountIdVendor?`, `customerIdVendor?`, `orderIdVendor?`, any other vendor/distributor IDs.
   - Text fields: account/customer names, product names, distributor/vendor names.
   - Numbers: `usage`, `commission`, any gross/net/adjustment fields.
   - Dates: `paymentDate`, any posting/billing dates if present.
   - Allocation & status fields: `usageAllocated`, `usageUnallocated`, `commissionAllocated`, `commissionUnallocated`, line `status`.
3. Decide which fields are **required vs optional** for the matching engine to function (e.g., at least one of IDs or name+amount+date).
4. Document any **per-tenant/per-template variations** (e.g., some templates may not have useful product names, only SKUs).

### 0.2. Revenue Schedule Data Contract

1. Confirm the Prisma `RevenueSchedule` model fields relevant to matching:
   - IDs: `id`, `scheduleNumber?`.
   - Account/product/vendorship: `accountId`, `productId?`, `distributorAccountId?`, `vendorAccountId?`.
   - Amounts: `expectedUsage`, `usageAdjustment`, `actualUsage`, `expectedCommission`, `actualCommission`, `actualCommissionAdjustment`.
   - Dates: `scheduleDate`.
   - Status: `status` (Projected/Invoiced/Paid/Cancelled).
2. Confirm reachable related entities and fields:
   - `Account`: account names/legal names.
   - `Product`: vendor & house product names, SKUs/part numbers.
   - `Opportunity`: `customerIdVendor`, `orderIdVendor`, `distributorName`, `vendorName` (if needed).
3. Decide whether any **vendor IDs will be denormalized** onto `RevenueSchedule` (e.g. `customerIdVendor`, `orderIdVendor`) to simplify matching queries.

### 0.3. Matching Engine Output Contract

1. For **UI candidates** (bottom table), define the server-side shape mapping to `SuggestedMatchScheduleRow` (`lib/mock-data.ts`):
   - `id`, `status`, `lineItem`, `matchConfidence`, `vendorName`, `legalName`, `productNameVendor`,
   - `revenueScheduleDate`, `revenueScheduleName`, `quantity`, `priceEach`,
   - `expectedUsageGross`, `expectedUsageAdjustment`, `expectedUsageNet`,
   - `actualUsage`, `usageBalance`,
   - `expectedCommissionGross`, `expectedCommissionAdjustment`, `expectedCommissionNet`,
   - `actualCommission`, `commissionDifference`,
   - `expectedCommissionRatePercent`, `actualCommissionRatePercent`, `commissionRateDifference`.
2. For **persisted matches** (MVP may be 1:1 but design for 1:many):
   - Decide what goes into `DepositLineMatch`:
     - `depositLineItemId`, `revenueScheduleId`,
     - `usageAmount`, `commissionAmount`,
     - `confidenceScore`, `status` (`Suggested`, `Applied`, `Rejected`), `source` (`Auto`, `Manual`),
     - `explanation?` JSON for signal breakdown (optional at MVP).
3. Confirm the **status vocabulary** for:
   - `DepositLineItem.status` (e.g. `Unmatched`, `Suggested`, `Matched`, `PartiallyMatched`).
   - `Deposit.status` (`Pending`, `InReview`, `Completed`).
   - How these are derived from matches and allocation fields.

---

## 1. Matching Engine Architecture & Module Layout

Design the matching logic so it is testable and decoupled from HTTP and React.

### 1.1. Module Placement

1. Create a dedicated matching module folder, e.g.:
   - `lib/matching/`
2. Within it, plan to add:
   - `lib/matching/types.ts` – shared types for engine input/output.
   - `lib/matching/normalization.ts` – string/date/amount normalization helpers.
   - `lib/matching/signals.ts` – individual scoring signals (IDs, names, amounts, dates).
   - `lib/matching/engine.ts` – orchestrates candidate selection + scoring.
   - `lib/matching/config.ts` – default weights and thresholds, later overridable per `ReconciliationTemplate`.

### 1.2. Public Engine API (TypeScript)

1. Define a minimal engine interface, e.g.:
   - `matchDepositLineToRevenueSchedules(input: MatchInput): MatchResult`.
2. `MatchInput` should contain:
   - `tenantId`, `deposit`, `lineItem`.
   - Pre-fetched candidate `revenueSchedules` (with enough related data).
   - Optional configuration overrides (weights, thresholds).
3. `MatchResult` should contain:
   - `candidates: CandidateMatch[]` (ordered by confidence).
   - For each candidate: `revenueSchedule`, `matchConfidence`, `signalsBreakdown` (optional).
4. Ensure the engine API is **pure** (no DB calls, no network) so it can be unit-tested and used from multiple endpoints.

---

## 2. Normalization & Utility Layer

Implement shared helpers that all signals use to avoid inconsistent behavior.

### 2.1. String Normalization

1. Create functions in `normalization.ts`:
   - `normalizeString(value: string | null | undefined): string`:
     - Trim, uppercase, collapse internal whitespace, remove common punctuation.
   - `normalizeAccountName(value: string): string`:
     - Apply `normalizeString`.
     - Strip common legal suffixes: `INC`, `INC.`, `LLC`, `LLC.`, `CORP`, `CORPORATION`, `CO`, `CO.`, `L.L.C`, etc.
   - `normalizeProductName(value: string): string`:
     - Apply `normalizeString`, possibly strip marketing fluff if needed later.
2. Ensure normalization is **idempotent** and safe for empty/undefined inputs.

### 2.2. Date Normalization

1. Implement helpers:
   - `toUtcDate(date: Date | string | null | undefined): Date | null`.
   - `monthsDifference(a: Date, b: Date): number`.
   - `daysDifference(a: Date, b: Date): number`.
2. Decide on **time zone behavior**:
   - Treat all `paymentDate` and `scheduleDate` as UTC-only (date-only semantics).
   - Avoid off-by-one errors around midnight by stripping time components.

### 2.3. Amount & Balance Utilities

1. Use `Decimal.js` or Prisma’s `Decimal` type where interacting with DB decimals.
2. Implement helpers:
   - `amountRatio(a: Decimal, b: Decimal): number` – min/max ratio (0–1).
   - `differenceRatio(expected: Decimal, actual: Decimal): number` – absolute diff over expected.
   - `withinTolerance(expected: Decimal, actual: Decimal, tolerancePct: number): boolean`.
3. Functions to compute values used in the UI:
   - `expectedUsageNet = expectedUsage + usageAdjustment`.
   - `expectedCommissionNet = expectedCommission + expectedCommissionAdjustment`.
   - `usageBalance = expectedUsageNet - actualUsage`.
   - `commissionDifference = expectedCommissionNet - actualCommission`.

---

## 3. Candidate Retrieval Strategy

Separate **candidate universe selection** (DB queries) from scoring.

### 3.1. Per-Deposit Candidate Prefetch

1. When loading a deposit detail, plan to fetch:
   - The `Deposit` row.
   - All `DepositLineItem` rows for that deposit.
   - A pre-filtered set of `RevenueSchedule` rows that could plausibly match any line:
     - `tenantId` = current tenant.
     - `distributorAccountId = deposit.distributorAccountId`.
     - `vendorAccountId = deposit.vendorAccountId`.
     - `scheduleDate` between `[minLinePaymentDate - preWindow, maxLinePaymentDate + postWindow]` (e.g. ±90 days).
2. Include necessary relations:
   - `account`, `product`, and `opportunity` if needed for vendor IDs.
3. Design a thin adapter:
   - `buildCandidateUniverse(deposit: Deposit, lines: DepositLineItem[]): Promise<RevenueScheduleWithContext[]>`.

### 3.2. Per-Line Candidate Filtering

1. Given the pre-fetched universe and a single line:
   - Apply stricter filters, e.g.:
     - If `customerIdVendor` is present, restrict to schedules whose opportunity or account has that ID.
     - If `orderIdVendor` is present, restrict to schedules whose opportunity/order IDs match.
     - Narrow date range around the line’s `paymentDate` (±N days or months).
2. Implement this filtering in-memory for MVP; move heavy filters into SQL if needed later.
3. Limit the number of candidates passed into the scoring engine (e.g. ≤ 100) with safe defaults.

---

## 4. Signal & Scoring Implementation

Define individual “signals” that each contribute to the final confidence score.

### 4.1. Signal Definitions

1. In `signals.ts`, define a `SignalResult` interface:
   - `signal: string` (e.g. `"customerIdVendor_exact"`).
   - `score: number` (0–1).
   - `weight: number`.
   - `description?: string`.
2. Implement signals grouped by category:
   - **ID signals**:
     - `customerIdVendor_exact`.
     - `orderIdVendor_exact`.
     - `accountIdVendor_exact`.
   - **Name signals**:
     - `accountName_similarity`.
     - `productName_similarity`.
   - **Amount signals**:
     - `usage_amount_ratio`.
     - `commission_amount_ratio`.
   - **Date signals**:
     - `schedule_vs_payment_date_proximity`.
3. Each signal function signature:
   - `(line: LineContext, schedule: ScheduleContext) => SignalResult | null`.

### 4.2. Scoring Configuration

1. In `config.ts`, define a default configuration object:
   - `signalWeights: Record<string, number>`.
   - Thresholds:
     - `autoMatchThreshold` (e.g. 0.97).
     - `suggestThreshold` (e.g. 0.90).
2. Make config overridable:
   - `resolveMatchingConfig(tenantId, templateId?): Promise<MatchingConfig>`.
   - Initially hardcode; later read from `ReconciliationTemplate.config`.

### 4.3. Combining Signals into Confidence

1. In `engine.ts`, implement:
   - `scoreCandidate(line, schedule, config): { confidence: number; signals: SignalResult[] }`.
2. Steps:
   - Run all relevant signals, collect non-null `SignalResult`s.
   - For each, compute weighted contribution: `signal.score * signal.weight`.
   - Sum contributions, clamp to [0, 1].
   - Optionally enforce rules like:
     - Require at least one ID signal or combination of high name+amount+date scores before surpassing `suggestThreshold`.
3. Return both the final `confidence` and `signals` for potential logging and debugging.

---

## 5. Matching Engine Orchestration

Bring together candidate filtering, signal scoring, and result truncation.

### 5.1. Per-Line Matching Function

1. Implement `matchDepositLineToRevenueSchedules` in `engine.ts`:
   - Inputs: `line`, `candidateSchedules`, `config`.
   - Steps:
     1. Normalize line fields (names, IDs, dates, amounts).
     2. Filter `candidateSchedules` down using quick heuristics (ID/date filters).
     3. For each remaining candidate:
        - Compute `scoreCandidate`.
     4. Sort candidates by `confidence` descending.
     5. Truncate to top N (e.g. 3–5).
     6. Map to `CandidateMatch` shape containing:
        - `revenueSchedule`, `confidence`, `signals`.
2. Implement a second helper for **batch processing**:
   - `matchAllLinesForDeposit(deposit, lines, candidateUniverse, config)` – useful for precomputing matches if needed later.

### 5.2. Mapping to UI Shape

1. Add a mapper function:
   - `toSuggestedMatchScheduleRow(line: DepositLineItem, candidate: CandidateMatch): SuggestedMatchScheduleRow`.
2. Compute:
   - `lineItem` = line’s `lineItem` number.
   - `matchConfidence` = candidate.confidence.
   - Vendor/account/product fields from `schedule` + related `account`/`product`.
   - `expectedUsageGross`, `expectedUsageAdjustment`, `expectedUsageNet`, `actualUsage`, `usageBalance`.
   - `expectedCommissionGross`, `expectedCommissionAdjustment`, `expectedCommissionNet`, `actualCommission`, `commissionDifference`.
   - Rate percents (`expectedCommissionRatePercent`, `actualCommissionRatePercent`, `commissionRateDifference`).

---

## 6. API Layer Implementation

Expose the engine via HTTP endpoints that align with the MVP plan and existing UI.

### 6.1. Deposit Detail Endpoint

1. Implement `GET /api/reconciliation/deposits/[depositId]/detail`:
   - Load `Deposit` by `id` + `tenantId`.
   - Load `DepositLineItem[]` for the deposit.
   - Optionally: prefetch candidate `RevenueSchedule` universe for optimization.
   - Map:
     - Deposit → `DepositReconciliationMetadata` shape (`components/deposit-reconciliation-detail-view.tsx`).
     - Line items → `DepositLineItemRow[]` (`lib/mock-data.ts`).
2. Return JSON:
   - `{ data: { deposit, lineItems } }`.

### 6.2. Candidate Retrieval Endpoint (Per Line)

1. Implement `GET /api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates`:
   - Validate deposit and line ownership (`line.depositId === depositId`, same tenant).
   - Fetch or compute the candidate RS universe (reusing any prefetch/cache if possible).
   - Call `matchDepositLineToRevenueSchedules`.
   - Map results to `SuggestedMatchScheduleRow[]`.
   - Return JSON: `{ data: candidates }`.
2. Apply pagination/top-N behavior via query params if needed, but MVP can just return top 3–5.

### 6.3. Apply Match Endpoint

1. Implement `POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match`:
   - Request body:
     - `revenueScheduleId`.
     - Optional `usageAmount`, `commissionAmount` for partials.
   - Steps:
     1. Validate entities and tenant.
     2. Look up the chosen candidate’s confidence (either recompute or trust client-provided `confidence` with server-side validation).
     3. Upsert a `DepositLineMatch` row:
        - Set status = `Applied`, source = `Manual` (or `Auto` later).
        - Save `confidenceScore` and allocation amounts.
     4. Update `DepositLineItem`:
        - Adjust `usageAllocated`, `usageUnallocated`, `commissionAllocated`, `commissionUnallocated`.
        - Update `status` (e.g. `Matched` if fully allocated).
     5. Update `Deposit` aggregates:
        - Increment `usageAllocated`, `usageUnallocated` accordingly.
        - Update `totalReconciledItems`, `itemsReconciled`, `itemsUnreconciled`.
        - Move deposit `status` among `Pending`/`InReview`/`Completed` as appropriate.
     6. (Optional, behind feature flag) Update `RevenueSchedule.actualUsage` and `actualCommission`.
   - Return updated line + deposit summary.

### 6.4. Unmatch Endpoint

1. Implement `POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch`:
   - Steps:
     1. Find the existing `DepositLineMatch`(es) for the line.
     2. Reverse allocations on `DepositLineItem`.
     3. Adjust `Deposit` aggregates.
     4. Optionally set match `status` to `Rejected` or delete record.
     5. Optionally roll back `RevenueSchedule.actualUsage/actualCommission` if they were modified.
   - Return updated line + deposit.

---

## 7. UI Integration Plan

Wire the existing deposit reconciliation detail view to the new APIs.

### 7.1. Deposit Detail Page Wiring

1. In `app/(dashboard)/reconciliation/[depositId]/page.tsx`:
   - Replace mock data with a fetch to `/api/reconciliation/deposits/[depositId]/detail`.
   - Pass real `metadata` and `lineItems` into `DepositReconciliationDetailView`.
2. Decide when to load candidates:
   - Option A (simpler): When the page loads, auto-select the first line and load its candidates.
   - Option B (scales better): Load candidates lazily when the user selects a line.

### 7.2. Candidate Loading on Selection

1. In `DepositReconciliationDetailView`:
   - Listen for changes to the selected deposit line row(s).
   - On change:
     - Call `/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates`.
     - Set `scheduleRows` state to the returned `SuggestedMatchScheduleRow[]`.
   - Show loading state in the bottom table while fetching.

### 7.3. Match & Unmatch Actions

1. For each line or schedule row with a “Match” action:
   - On click:
     - Determine the selected line + chosen schedule.
     - POST to `apply-match`.
     - On success:
       - Update the line’s status and allocation fields in state.
       - Optionally re-fetch candidates (or mark the chosen one as `Reconciled`).
2. For “Unmatch”:
   - POST to `unmatch`.
   - Update UI to reflect the line becoming `Unreconciled` again; update deposit metadata.
3. Ensure bulk-selection actions in the UI either:
   - Are disabled for MVP, or
   - Call batch endpoints implemented later.

---

## 8. Testing & Validation Steps

Design tests so the engine is trustworthy before it touches real data.

### 8.1. Unit Tests for Engine

1. Add tests for:
   - String normalization variants (case, punctuation, legal suffixes).
   - Each signal function’s behavior (ID match, name similarity, date proximity, amount ratios).
   - `scoreCandidate` weight composition and threshold behavior.
   - Edge cases (missing IDs, 0 usage, negative amounts for future CB scenarios).
2. Use synthetic line + schedule fixtures that cover:
   - Perfect 1:1 match.
   - Multiple plausible matches with different confidences.
   - Very low-confidence matches that should not cross thresholds.

### 8.2. Integration Tests for API

1. Seed a small dataset into a test DB:
   - 1–2 deposits, each with 5–10 line items.
   - Corresponding revenue schedules with slightly messy data (typos, date offsets, partial payments).
2. Test:
   - `/detail` returns correct shapes and totals.
   - `/candidates` returns:
     - Sorted candidates.
     - Reasonable confidences.
   - `/apply-match` updates:
     - Line allocations and status.
     - Deposit aggregates.
   - `/unmatch` reverses those changes correctly.

### 8.3. Manual QA Checklist

1. Validate with realistic vendor files:
   - Confirm high-confidence lines align to correct schedules.
   - Confirm ambiguous lines are not auto-matched.
2. Compare a subset of automated matches against **human baseline**.
3. Verify performance on a deposit with ~1,000+ lines (smoke test).

---

## 9. Rollout, Feature Flags, and Observability

Ensure safe rollout and enough visibility to tune matching later.

### 9.1. Feature Flags

1. Add flags/settings for:
   - `matching.autoApplyEnabled` – whether to auto-apply very high-confidence matches.
   - `reconciliation.updateRevenueScheduleActualsFromMatches` – whether to alter RS actualUsage/actualCommission.
2. Initially:
   - Keep auto-apply **off**; require manual approval.
   - Keep RS actual updates **off** in production until validated with finance.

### 9.2. Logging & Metrics

1. Log key events:
   - Each `apply-match` with:
     - Selected `revenueScheduleId`, `confidenceScore`, `source`.
   - Each manual override where the user rejects the top suggestion and chooses another RS.
2. Later use these logs to:
   - Build alias tables (name/SKU mappings).
   - Adjust signal weights and thresholds per template.

### 9.3. Backfill Strategy (Optional)

1. Design a background job that:
   - Iterates over existing deposits/lines with `status = Unmatched`.
   - Runs the matching engine in suggestion-only mode.
   - Persists suggestions or queues them for review.
2. Ensure this job respects:
   - Feature flags.
   - Tenant isolation and rate limits.

---

## 10. Dependencies & Coordination Points

To avoid hiccups, explicitly track the points where this implementation depends on other work.

1. **Schema finalization** (other agent):
   - Confirm `DepositLineItem` model and any `DepositLineMatch` join table.
   - Confirm required indexes (tenant + vendor/distributor + dates) for performance.
2. **Reconciliation templates**:
   - Agree on where matching configuration lives (`ReconciliationTemplate.config` vs global settings).
3. **Permissions & auth**:
   - Ensure the APIs are guarded by appropriate finance/reconciliation permissions.
4. **Migration plan**:
   - Ensure new tables and enums are added via Prisma migrations that are already validated (`prisma/schema.prisma` + migrations).

Once these dependencies are satisfied, you can follow sections **1–9** sequentially to implement the matching logic with minimal surprises.

