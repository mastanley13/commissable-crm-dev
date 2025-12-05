Here are the **“Now / must‑fix” Reconciliation items that are still missing or at‑risk**, based on the specs + 12‑02 meeting. Use this as a **checklist against your current build** before you tell Rob “Reconciliation is done.”

Where I’m not 100% sure if it’s implemented, I’ve marked it **ASSUMED** (because the docs/meeting suggest it wasn’t done yet).

---

## Status Snapshot - 2025-12-04 (after Quick Start Path Days 1-4)

High-level summary of each checklist item based on the current code (matching library, reconciliation APIs, and Reconciliation UI components). Updated to reflect the Quick Start Path implementation (candidate retrieval hardening, Pass A + Pass B scoring, feature flag + dev toggles).

### 1. Matching Logic - Final Hierarchy & Engine

- **1.1 Implement the final field priority order** - **Partially implemented (MVP in place).** Hierarchical Pass A/B scoring, strong ID and account legal name checks, product name/part number similarity, and FIFO tie-breaking are coded in lib/matching/deposit-matcher.ts and wired into the `/candidates` API. Location ID / Customer PO # are now present on DepositLineItem and treated as strong identifiers in Pass A (plus conflict checks in Pass B), and Product Description is folded into product identity similarity; ingestion/population of these new fields still needs to be completed and tuned. The hierarchical engine is gated behind HIERARCHICAL_MATCHING_ENABLED / NEXT_PUBLIC_HIERARCHICAL_MATCHING and can be toggled per-request via the dev-only "Matching Dev Controls" on the Reconciliation page (Legacy vs Hierarchical).
- **1.1 Enforce Distributor + Vendor as hard filters** - **Implemented.** fetchCandidateSchedules always filters by distributorAccountId and vendorAccountId for the current deposit, and cross-vendor fallback is only used when allowCrossVendorFallback is explicitly enabled (the candidates API does not enable it).
- **1.2 Pass A (exact matching)** - **Implemented and active when hierarchical engine is enabled.** buildPassACandidate enforces exact Account Legal Name / strong IDs and uses varianceTolerance (currently 0%) to require near-perfect amount/date proximity; qualifying candidates are returned as `matchType = "exact"`, `matchConfidence = 1.0`, and appear at the top of the Suggested table but are still applied manually (no auto-apply yet).
- **1.2 Pass B (fuzzy matching + confidence)** - **Implemented and active when hierarchical engine is enabled.** Pass B uses the 40/30/20/10 weighting for account name, product identity, amount, and date, computes matchConfidence / confidenceLevel, and the Reconciliation UI shows these scores. Pass B now always runs alongside Pass A and returns additional `matchType = "fuzzy"` suggestions with confidence ≥ 0.5 (50–99%) for manual review; candidates with strong-ID conflicts are dropped. When the feature flag is off, the `/candidates` API still uses the legacy single-pass scorer.
- **1.3 FIFO rule** - **Implemented.** sortCandidatesWithFIFO sorts first by matchConfidence descending, then by revenueScheduleDate and createdAt ascending, so older schedules win ties as required.
- **1.3 Status filter (open + positive difference only)** - **Implemented.** fetchCandidateSchedules limits schedules to RevenueScheduleStatus.Projected / Invoiced and filters out candidates with non-positive commission difference via computeCommissionDifference.
- **1.3 Date filter + future toggle** - **Partially implemented.** The default query window is past-only (up to the end of the payment month), and an includeFutureSchedules option exists and is wired to a dev-only checkbox in the "Matching Dev Controls" on the Reconciliation page; there is not yet a production-facing "Include Future-Dated Schedules" setting for non-dev users.

### 2. Reconciliation Page UI and Status Workflow

- **2.1 Currency formatting (all amount fields)** - **Implemented.** DepositReconciliationDetailView formats all usage/commission fields in both tables using currency formatting (USD, two decimals).
- **2.1 Period / Schedule Date formatting** - **Implemented (format style differs slightly).** Dates are rendered as "Mon DD, YYYY", so timestamps are no longer raw ISO strings, though they are not strictly MM/DD/YYYY.
- **2.2 Explicit Matched status (lines + schedules)** - **Partially implemented.** Line items use DepositLineItemStatus and appear as Matched, Partially Matched, or Unreconciled in the UI; candidate schedules jump directly from Suggested to Reconciled with no separate Matched phase tied to a deposit-level finalize step.
- **2.2 Status transitions (Unmatched/Matched/Reconciled, plus Unreconcile)** - **Partially implemented.** Match/unmatch flows update line-item status and recompute deposit aggregates. There is now a basic Finalize / Reopen Deposit action (sets Deposit.status to Completed / InReview and flips reconciled/reconciledAt), but schedules do not yet have a distinct Matched phase and finalization does not currently update RevenueSchedule-side balances or statuses.
- **2.3 Status dropdowns (Suggested/All/Matched/Unmatched/Reconciled)** - **Partially implemented.** The top DepositLineStatusFilterDropdown supports Matched, Unmatched, Partial, and All; the bottom ReconciliationScheduleStatusFilterDropdown supports Suggested, All Schedules, Reconciled, and Un-Reconciled, but schedules do not have a Matched status and labels are not fully aligned.
- **2.3 Remove matched rows from Unmatched views** - **Partially implemented.** Top table rows move between Unreconciled, Matched, and Partially Matched correctly, and matched schedules stop appearing in Suggested, but schedules show as Reconciled instead of Matched, and the Un-Reconciled filter currently never shows any rows.
- **2.4.1 Match (dual status + link)** - **Partially implemented.** The apply-match API creates or updates DepositLineMatch rows (source Manual), updates line-item status and allocations, and marks the chosen schedule row as Reconciled in the UI; schedules do not yet have a dedicated match status separate from RevenueScheduleStatus.
- **2.4.1 Unmatch (dual rollback)** - **Partially implemented.** The unmatch API deletes DepositLineMatch rows, resets the line to Unmatched, restores usage/commission allocation on the line, recomputes deposit aggregates, and returns the schedule to the suggestion pool; schedule-side balances/statuses are not updated yet.
- **2.4.2 "Reconcile Deposit" action** - **Not implemented.** There is no finalize endpoint or UI control; deposit status is derived from line summary in recomputeDepositAggregates, and reconciled / reconciledAt are not set by any explicit action.
- **2.4.2 "Unreconcile Deposit" action** - **Not implemented.** There is no batch rollback to return a completed deposit and its line items/schedules to a pre-reconciled state, and no dedicated audit entry.
- **2.4.3 Delete Deposit** - **Partially implemented as a UI stub.** The Reconciliation list page has a bulk Delete action that removes rows from local state only; there is no backend delete API or safety checks to unmatch schedules first.
- **2.5 Bottom schedule sort (Product, then Date)** - **Not implemented.** Schedule candidates are sorted by matchConfidence (with FIFO tie-breaking) and the table preserves that order until a user sorts manually; there is no default Product-then-Date sort.
- **2.5 Top deposit table sort stability** - **Implemented.** Deposit line items are returned ordered by lineNumber then createdAt, and the table preserves that stable order unless a user re-sorts.
- **2.6 Visual highlighting of matching fields** - **Not implemented.** The Reconciliation detail view uses status chips and selection but does not highlight matching fields across the two tables.

### 3. AI / Auto-Match and Variance Threshold

- **3.1 Global variance setting (per tenant)** - **Implemented (backend).** Variance tolerance is stored per tenant via SystemSetting (`reconciliation.varianceTolerance`) and read in both the candidates API and auto-match flows; there is not yet an admin UI for managing this setting, but it can be configured via system settings.
- **3.1 Use variance for auto-apply vs suggest vs FLEX** - **Partially implemented.** Pass A uses the per-tenant variance tolerance to decide whether an exact match qualifies as a 1.0 "perfect" match eligible for auto-match; Pass B is always suggest-only and FLEX/exception routing is not yet implemented.
- **3.2 Auto-match pass over Unmatched lines** - **Implemented (Pass A only).** A deposit-level `/auto-match` endpoint and "Run AI Matching" flow iterate over deposit lines and automatically apply matches only for Pass A exact candidates within variance tolerance; there is no scheduled/background job yet, and Pass B candidates remain manual suggestions.
- **3.2 Store match origin and confidence** - **Partially implemented.** DepositLineMatch now persists `source = Auto` and `confidenceScore` for auto-applied matches, while manual matches continue to use `source = Manual`; the UI does not yet surface match origin/score beyond the Match Confidence column.
- **3.3 "Run AI Matching" trigger** - **Implemented (with preview).** The Reconciliation view now has a "Run AI Matching" button that opens a preview modal backed by an `/auto-match/preview` endpoint; it lists Pass A exact matches that qualify for auto-apply, and only after confirmation does the `/auto-match` endpoint run and update lines/schedules.

### 4. Variance, FLEX Products, and Advanced Scenarios

- **4.1 Overage FLEX schedules (RS-xxxxxx-F)** - **Not implemented.** FLEX schedule creation and linking logic are only present in specs.
- **4.1 Unknown Product FLEX and review UI** - **Not implemented.** Unmatched lines remain Unmatched/Suggested; there is no path that creates FLEX schedules for unknown products or a FLEX review table.
- **4.2 Partial payments (many:1) and FIFO allocation** - **Not implemented.** DepositLineMatch can store custom allocation amounts, but RevenueSchedule balances/statuses are not updated and there is no many:1 allocation logic.
- **4.3 Prepayments (1:many splits)** - **Not implemented.** APIs only support linking a line to a single schedule per apply-match call; there is no split flow.
- **4.4 Chargebacks and reversals (-CB / -CB-REV)** - **Not implemented.** Negative deposit lines are not treated specially and there are no dedicated CB/CB-REV schedule types.

### 5. Minimum "Done" Test Pass

- **Test 1: Simple 1:1 perfect match** - **Partially supported.** High-confidence suggestions and one-click manual matching work and deposit aggregates update, but auto-match and a true deposit-level Reconciled state are not implemented.
- **Test 2: Good match requiring Matched status** - **Partially supported.** Line items persist as Matched / Partially Matched across reloads and matched schedules disappear from Suggested, but schedules show as Reconciled rather than Matched and there is no distinct Matched phase before finalization.
- **Test 3: Unmatch flow** - **Partially supported.** The Unmatch endpoint correctly removes matches and restores the line and deposit aggregates; schedule balances/statuses are not yet updated.
- **Test 4: Deposit finalization and Unreconcile** - **Partially supported.** There are now explicit Finalize / Reopen endpoints and buttons that toggle Deposit.status and reconciled/reconciledAt, but they do not yet update schedule statuses or provide a full audit trail for the transition.
- **Test 5: Auto-match plus variance** - **Partially supported.** The engine uses a per-tenant variance tolerance and the "Run AI Matching" flow applies Pass A exact matches within tolerance, but there is still no FLEX behavior for overages and variance is not yet configurable via a dedicated reconciliation settings UI.
- **Test 6: Overage to FLEX** - **Not supported.** FLEX creation and review flows remain unimplemented.

---
> **Note (2025‑12‑04):** The sections below are the original detailed checklist from the 12‑02 review and are kept for historical context. Some status labels and descriptions may be stale. For the **current, authoritative status**, rely on the **Status Snapshot** and tests above.

## 1. Matching Logic - Final Hierarchy & Engine

- **1.1 Implement the final field priority order** - **Partially implemented.** Hierarchical Pass A/B scoring, strong ID and account legal name checks, product name/part number similarity, and FIFO tie-breaking are coded in lib/matching/deposit-matcher.ts, but Location ID / Customer PO # and Product Description are not yet used, and the new engine is disabled by default behind HIERARCHICAL_MATCHING_ENABLED / NEXT_PUBLIC_HIERARCHICAL_MATCHING.
- **1.1 Enforce Distributor + Vendor as hard filters** - **Implemented.** etchCandidateSchedules always filters by distributorAccountId and endorAccountId for the current deposit, and cross-vendor fallback is only used when llowCrossVendorFallback is explicitly enabled (the candidates API does not enable it).
- **1.2 Pass A (exact matching)** - **Implemented and active when hierarchical engine is enabled.** uildPassACandidate enforces exact Account Legal Name / strong IDs and uses arianceTolerance (currently 0%) to require near-perfect amount/date proximity; qualifying candidates are returned as `matchType = "exact"`, `matchConfidence = 1.0`, and appear at the top of the Suggested table but are still applied manually (no auto-apply yet).
- **1.2 Pass B (fuzzy matching + confidence)** - **Implemented and active when hierarchical engine is enabled.** Pass B uses the 40/30/20/10 weighting for account name, product identity, amount, and date, computes matchConfidence and confidenceLevel, and the Reconciliation UI shows these scores. Pass B now always runs alongside Pass A and returns additional `matchType = "fuzzy"` suggestions with confidence �%� 0.5 (50�?"99%) for manual review; candidates with strong-ID conflicts are dropped. When the feature flag is off, the candidates API still uses the legacy single-pass scorer.
- **1.3 FIFO rule** - **Implemented.** sortCandidatesWithFIFO sorts first by matchConfidence descending, then by 
evenueScheduleDate and createdAt ascending, so older schedules win ties as required.
- **1.3 Status filter (open + positive difference only)** - **Implemented.** etchCandidateSchedules limits schedules to RevenueScheduleStatus.Projected / Invoiced and filters out candidates with non-positive commission difference via computeCommissionDifference.
- **1.3 Date filter + future toggle** - **Partially implemented.** The default query window is past-only (up to the end of the payment month), and an includeFutureSchedules option exists and is wired to a dev-only checkbox in the "Matching Dev Controls" on the Reconciliation page; there is not yet a production-facing "Include Future-Dated Schedules" toggle for non-dev users.

### 2. Reconciliation Page UI and Status Workflow

- **2.1 Currency formatting (all amount fields)** - **Implemented.** DepositReconciliationDetailView formats all usage/commission fields in both tables with Intl.NumberFormat using USD with two decimals.
- **2.1 Period / Schedule Date formatting** - **Implemented (format style differs slightly).** Dates are rendered via Intl.DateTimeFormat as Mon DD, YYYY, so timestamps are no longer raw ISO strings, though they are not strictly MM/DD/YYYY.
- **2.2 Explicit Matched status (lines + schedules)** - **Partially implemented.** Line items use DepositLineItemStatus and appear as Matched, Partially Matched, or Unreconciled in the UI; candidate schedules jump directly from Suggested to Reconciled with no separate Matched phase tied to a deposit-level finalize step.
- **2.2 Status transitions (Unmatched/Matched/Reconciled, plus Unreconcile)** - **Partially implemented.** Match/unmatch flows update line-item status and recompute deposit aggregates, but there is no explicit "Reconcile Deposit" / "Unreconcile Deposit" action and no Matched-to-Reconciled transition for schedules when a deposit is finalized.
- **2.3 Status dropdowns (Suggested/All/Matched/Unmatched/Reconciled)** - **Partially implemented.** The top DepositLineStatusFilterDropdown supports Matched, Unmatched, Partial, and All; the bottom ReconciliationScheduleStatusFilterDropdown supports Suggested, All Schedules, Reconciled, and Un-Reconciled, but schedules do not have a Matched status and labels are not fully aligned.
- **2.3 Remove matched rows from Unmatched views** - **Partially implemented.** Top table rows move between Unreconciled, Matched, and Partially Matched correctly, and matched schedules stop appearing in Suggested, but schedules show as Reconciled instead of Matched, and the Un-Reconciled filter currently never shows any rows.
- **2.4.1 Match (dual status + link)** - **Partially implemented.** POST /apply-match creates or updates DepositLineMatch rows (source Manual), updates line-item status and allocations, and marks the chosen schedule row as Reconciled in the UI; schedules do not yet have a dedicated match status separate from RevenueScheduleStatus.
- **2.4.1 Unmatch (dual rollback)** - **Partially implemented.** POST /unmatch deletes DepositLineMatch rows, resets the line to Unmatched, restores usage/commission allocation on the line, recomputes deposit aggregates, and returns the schedule to the suggestion pool; schedule-side balances/statuses are not updated yet.
- **2.4.2 "Reconcile Deposit" action** - **Not implemented.** There is no finalize endpoint or UI control; deposit status is derived from line summary in 
ecomputeDepositAggregates, and 
econciled / 
econciledAt are not set by any explicit action.
- **2.4.2 "Unreconcile Deposit" action** - **Not implemented.** There is no batch rollback to return a completed deposit and its line items/schedules to a pre-reconciled state, and no dedicated audit entry.
- **2.4.3 Delete Deposit** - **Partially implemented as a UI stub.** The Reconciliation list page has a bulk Delete action that removes rows from local state only; there is no backend delete API or safety checks to unmatch schedules first.
- **2.5 Bottom schedule sort (Product, then Date)** - **Not implemented.** Schedule candidates are sorted by matchConfidence (with FIFO tie-breaking) and the table preserves that order until a user sorts manually; there is no default Product-then-Date sort.
- **2.5 Top deposit table sort stability** - **Implemented.** Deposit line items are returned ordered by lineNumber then createdAt, and the table preserves that stable order unless a user re-sorts.
- **2.6 Visual highlighting of matching fields** - **Not implemented.** The Reconciliation detail view uses status chips and selection but does not highlight matching fields across the two tables.

### 3. AI / Auto-Match and Variance Threshold

- **3.1 Global variance setting (per tenant)** - **Not implemented.** There is no reconciliation settings model or UI; only the arianceTolerance option on matchDepositLine.
- **3.1 Use variance for auto-apply vs suggest vs FLEX** - **Partially implemented in the engine only.** Pass A uses arianceTolerance to decide whether a candidate qualifies as a 1.0 "perfect" match, but there is no orchestration that turns this into auto-apply vs suggest vs FLEX behavior.
- **3.2 Auto-match pass over Unmatched lines** - **Not implemented.** There is no service or job that iterates deposit lines and automatically applies matches; all matches today are manual via the per-line pply-match endpoint.
- **3.2 Store match origin and confidence** - **Partially implemented.** DepositLineMatch includes source (Auto/Manual) and confidenceScore, but the UI always sets source = Manual and never passes confidence/type because there is no auto-match flow.
- **3.3 "Run AI Matching" trigger** - **Not implemented.** There is no "Run AI Matching" button or deposit-level API; only per-line matching exists.

### 4. Variance, FLEX Products, and Advanced Scenarios

- **4.1 Overage FLEX schedules (RS-xxxxxx-F)** - **Not implemented.** FLEX schedule creation and linking logic are only present in specs.
- **4.1 Unknown Product FLEX and review UI** - **Not implemented.** Unmatched lines remain Unmatched/Suggested; there is no path that creates FLEX schedules for unknown products or a FLEX review table.
- **4.2 Partial payments (many:1) and FIFO allocation** - **Not implemented.** DepositLineMatch can store custom allocation amounts, but RevenueSchedule balances/statuses are not updated and there is no many:1 allocation logic.
- **4.3 Prepayments (1:many splits)** - **Not implemented.** APIs only support linking a line to a single schedule per pply-match call; there is no split flow.
- **4.4 Chargebacks and reversals (-CB / -CB-REV)** - **Not implemented.** Negative deposit lines are not treated specially and there are no dedicated CB/CB-REV schedule types.

### 5. Minimum "Done" Test Pass

- **Test 1: Simple 1:1 perfect match** - **Partially supported.** High-confidence suggestions and one-click manual matching work and deposit aggregates update, but auto-match and a true deposit-level Reconciled state are not implemented.
- **Test 2: Good match requiring Matched status** - **Partially supported.** Line items persist as Matched / Partially Matched across reloads and matched schedules disappear from Suggested, but schedules show as Reconciled rather than Matched and there is no distinct Matched phase before finalization.
- **Test 3: Unmatch flow** - **Partially supported.** The Unmatch endpoint correctly removes matches and restores the line and deposit aggregates; schedule balances/statuses are not yet updated.
- **Test 4: Deposit finalization and Unreconcile** - **Not supported.** There is no explicit Reconcile/Unreconcile Deposit flow.
- **Test 5: Auto-match plus variance** - **Not supported.** The engine exposes variance hooks but there is no auto-match orchestration or "Run AI Matching" trigger.
- **Test 6: Overage to FLEX** - **Not supported.** FLEX creation and review flows remain unimplemented.

---
## 1. Matching Logic �?" Final Hierarchy & Engine

- **1.1 Implement final field priority order** �?" **Partially implemented.** Hierarchical Pass A/B scoring, strong ID and account legal name checks, product name/part number similarity, and FIFO tie�?`breaking are coded in `lib/matching/deposit-matcher.ts`, but Location ID / Customer PO # and Product Description are not yet used, and the new engine is disabled by default behind `HIERARCHICAL_MATCHING_ENABLED` / `NEXT_PUBLIC_HIERARCHICAL_MATCHING`.
- **1.1 Enforce Distributor + Vendor as hard filters** �?" **Implemented.** `fetchCandidateSchedules` always filters by `distributorAccountId` and `vendorAccountId` for the current deposit, and cross�?`vendor fallback is only used when `allowCrossVendorFallback` is explicitly enabled (the candidates API does **not** enable it).
- **1.2 Pass A (exact matching)** �?" **Implemented in engine, off by default.** `buildPassACandidate` enforces exact Account Legal Name / strong IDs and uses `varianceTolerance` to require near�?`perfect amount/date proximity; this only runs when hierarchical matching is enabled.
- **1.2 Pass B (fuzzy matching + confidence)** �?" **Implemented in engine + UI, off by default.** Pass B uses the 40/30/20/10 weighting for account name, product identity, amount, and date, computes `matchConfidence` + `confidenceLevel`, and the Reconciliation UI shows a `Match Confidence` column; the candidates API still uses the legacy single�?`pass scorer unless the env flag is turned on.
- **1.3 FIFO rule** �?" **Implemented.** `sortCandidatesWithFIFO` sorts first by `matchConfidence` DESC, then by `revenueScheduleDate` ASC and `createdAt` ASC, so older schedules win ties as required.
- **1.3 Status filter (open + positive difference only)** �?" **Implemented.** `fetchCandidateSchedules` limits schedules to `RevenueScheduleStatus.Projected` / `Invoiced` and filters out any candidate with non�?`positive commission difference via `computeCommissionDifference`.
- **1.3 Date filter + future toggle** �?" **Partially implemented.** The default query window is past�?`only (up to the end of the payment month), and an `includeFutureSchedules` option exists, but the UI/API never set it, so there is no user�?`visible �?oInclude Future�?`Dated Schedules�?? toggle yet.

### 2. Reconciliation Page UI & Status Workflow

- **2.1 Currency formatting (all amount fields)** �?" **Implemented.** `DepositReconciliationDetailView` formats all usage/commission fields in both tables with `Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })`.
- **2.1 Period / Schedule Date formatting** �?" **Implemented (format style differs slightly).** Dates are rendered via `Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })`, so timestamps are no longer raw ISO strings, though they use `Dec 4, 2025` rather than `MM/DD/YYYY`.
- **2.2 Introduce explicit `Matched` status (lines + schedules)** �?" **Partially implemented.** Line items use `DepositLineItemStatus` (Unmatched/Suggested/Matched/PartiallyMatched/Ignored) and appear as `Matched` / `Partially Matched` / `Unreconciled` in the UI; candidate schedules jump directly from `Suggested` to `Reconciled` and there is no separate `Matched` phase tied to a deposit�?`level finalize step.
- **2.2 Status transitions (Unmatched �+' Matched �+' Reconciled, plus Unreconcile)** �?" **Partially implemented.** Match/unmatch flows update line�?`item status and recompute deposit aggregates, but there is no explicit `Reconcile Deposit` / `Unreconcile Deposit` action and no Matched→Reconciled transition for schedules when a deposit is finalized.
- **2.3 Status dropdowns (Suggested/All/Matched/Unmatched/Reconciled)** �?" **Partially implemented.** The top `DepositLineStatusFilterDropdown` supports `Matched` / `Unmatched` / `Partial` / `All`; the bottom `ReconciliationScheduleStatusFilterDropdown` supports `Suggested` / `All Schedules` / `Reconciled` / `Un-Reconciled`, and both filters work off real status fields. However, schedules do not have a `Matched` status/filter and labels are not fully aligned between the two tables.
- **2.3 Remove matched rows from Unmatched views** �?" **Partially implemented.** Top table rows move between `Unreconciled`, `Matched`, and `Partially Matched` correctly, and matched schedules stop appearing in the `Suggested` view; schedule rows are labeled `Reconciled` rather than `Matched`, and the `Un-Reconciled` filter currently never shows any rows.
- **2.4.1 Match (dual status + link)** �?" **Partially implemented.** POST `/apply-match` creates/updates `DepositLineMatch` records (with `source = Manual`), updates the line�?`item status and allocation fields, and marks the chosen schedule row as `Reconciled` in the UI; schedule records themselves do not yet carry a persistent `Matched` status separate from their existing `RevenueScheduleStatus`.
- **2.4.1 Unmatch (dual rollback)** �?" **Partially implemented.** POST `/unmatch` deletes `DepositLineMatch` rows, resets the line item to `Unmatched`, restores usage/commission allocation on the line, recomputes deposit aggregates, and returns the schedule to the suggestion pool. RevenueSchedule amounts/statuses are not adjusted yet because schedule�?`side reconciliation logic is still TODO.
- **2.4.2 �?oReconcile Deposit�?? action** �?" **Not implemented.** There is no explicit finalize endpoint or UI control; deposit `status` (`ReconciliationStatus.Pending/InReview/Completed`) is derived automatically in `recomputeDepositAggregates`, and `reconciled` / `reconciledAt` are not updated by any current flow.
- **2.4.2 �?oUnreconcile Deposit�?? action** �?" **Not implemented.** There is no batch roll�?`back operation to return a completed deposit (and its line items/schedules) to a pre�?`reconciled state, nor a dedicated audit log entry for that operation.
- **2.4.3 Delete Deposit** �?" **Partially implemented as a UI stub.** The Reconciliation list page has a bulk �?oDelete�?? action that removes rows from local state only; there is no backend delete API, no permission gating, and no guarantee that associated matches/schedules are safely unwound.
- **2.5 Bottom schedule sort (Product, then Date)** �?" **Not implemented.** Schedule candidates arrive from the matcher sorted by `matchConfidence` (with FIFO tie�?`breaking), and the bottom table preserves that order until the user clicks column headers; there is no default sort of Product Name → Schedule Date.
- **2.5 Top deposit table sort stability** �?" **Implemented.** Deposit line items are returned ordered by `lineNumber` then `createdAt`, and the table preserves that stable order unless the user actively re�?`sorts, so filtering/searching does not cause rows to jump.
- **2.6 Visual highlighting of matching fields** �?" **Not implemented.** The current Reconciliation detail view uses status chips and selection, but there is no cross�?`table highlighting of matching fields when a line/schedule is selected.

### 3. AI / Auto�?`Match & Variance Threshold

- **3.1 Global variance setting (per tenant)** �?" **Not implemented.** There is no reconciliation settings model or UI yet; only an in�?`memory `varianceTolerance` option exists on `matchDepositLine`.
- **3.1 Matching logic uses variance for auto�?`apply vs suggest vs FLEX** �?" **Partially implemented in the engine only.** Pass A in the hierarchical scorer uses `varianceTolerance` to decide whether a candidate qualifies as a 1.0 �?operfect�? match, but the higher�?`level �?oauto�?`apply vs suggest vs FLEX�? routing has not been built.
- **3.2 Auto�?`match pass over Unmatched lines** �?" **Not implemented.** There is no service or job that iterates deposit lines and automatically applies matches; all matching is driven by the per�?`line `apply-match` endpoint from the UI.
- **3.2 Store match origin (`Exact/Fuzzy/Manual/Auto`) + confidence** �?" **Partially implemented.** `DepositLineMatch` includes `source` (Auto/Manual) and `confidenceScore`, but the UI always writes `source = Manual` and never passes `confidenceScore` or Pass A/B type; no auto�?`match flow exists yet to use `source = Auto`.
- **3.3 �?oRun AI Matching�?? trigger** �?" **Not implemented.** There is no �?oRun AI Matching�?? button or deposit�?`level endpoint; only manual per�?`line matching is available today.

### 4. Variance, FLEX Products & Advanced Scenarios

- **4.1 Overage FLEX schedules (`RS-xxxxxx-F`)** �?" **Not implemented.** FLEX schedule creation and linking logic are only present in specs; there is no code emitting `-F` schedules when a deposit overpays beyond variance.
- **4.1 Unknown Product FLEX + FLEX review UI** �?" **Not implemented.** Unmatched lines remain Unmatched/Suggested; there is no path that creates FLEX schedules for unknown products or a FLEX review table.
- **4.2 Partial payments (many:1) and FIFO allocation** �?" **Not implemented.** While `DepositLineMatch` can store custom `usageAmount`/`commissionAmount`, RevenueSchedule balances/statuses are not updated and there is no 1:many or many:1 payment allocation logic.
- **4.3 Prepayments (1:many splits)** �?" **Not implemented.** The APIs only support linking a line to a single schedule per `apply-match` call; there is no UI or backend flow to split a deposit line across multiple schedules.
- **4.4 Chargebacks & reversals (`-CB` / `-CB-REV`)** �?" **Not implemented.** Negative deposit lines are not treated specially and no chargeback/chargeback�?`reversal schedule types exist in code.

### 5. Minimum �?oDone�?? Test Pass

- **Test 1: Simple 1:1 perfect match** �?" **Partially supported.** High�?`confidence suggestions and one�?`click manual matching work and deposit aggregates update, but auto�?`match and a true deposit�?`level �?oReconciled�?? state are not implemented.
- **Test 2: Good match requiring `Matched` status** �?" **Partially supported.** Line items persist as `Matched` / `Partially Matched` across reloads and matched schedules no longer show under `Suggested`, but schedules are labeled `Reconciled` instead of `Matched` and there is no dedicated Matched phase before finalization.
- **Test 3: Unmatch flow** �?" **Partially supported.** The Unmatch endpoint correctly removes matches and restores the line and deposit aggregates; RevenueSchedule balances/statuses are not yet updated.
- **Test 4: Deposit finalization + Unreconcile** �?" **Not supported.** There is no explicit Reconcile/Unreconcile Deposit flow to exercise.
- **Test 5: Auto�?`match + variance** �?" **Not supported.** The engine exposes variance hooks but no auto�?`match orchestration exists.
- **Test 6: Overage to FLEX** �?" **Not supported.** FLEX creation and review flows remain unimplemented.

---

## 1. Matching Logic – Final Hierarchy & Engine

These are core logic items that **must match the finalized spec**, not your early “basic field” matching.

**1.1 Primary Matching Hierarchy**

* [ ] **Implement the final field priority order** in the matching engine (for all auto and suggested matches):

  1. Distributor (exact) – *required gate*
  2. Vendor (exact) – *required gate*
  3. Account Legal Name
  4. Strong IDs (Order ID – house/vendor/distributor; Customer ID – house/vendor/distributor; Account ID – house/vendor)
  5. Location ID / Customer PO #
  6. Product Name & Part Number
  7. Product Description
  8. Revenue Schedule Date 

  **ASSUMED missing** – on 12‑02 you were still using “basic fields” and hadn’t yet pulled the detailed order from Rob’s docs. 

* [ ] **Enforce Distributor + Vendor as hard filters** (no match attempt at all if either is wrong). 

**1.2 Two‑Pass Matching & Confidence Score**

* [ ] **Pass A – Exact matching** on strong identifiers (Distributor, Vendor, IDs, Account Legal Name). If you get a 1.0 (100%) match and the variance is within user tolerance, treat as “perfect” for downstream logic.
* [ ] **Pass B – Fuzzy matching** only when Pass A fails, using the weighted scoring:

  * Account Name similarity (~40%)
  * Product Name similarity (~30%)
  * Amount proximity (~20%)
  * Date proximity (~10%)

  Confidence should be stored per candidate (0–1 / 0–100%) and surfaced in the UI as “Match Confidence.”

  **ASSUMED missing** – meeting notes say you “missed the confidence criteria” and need to re‑review the documents. 

**1.3 Tie‑Breakers & Candidate Filtering**

* [ ] **FIFO rule**: when multiple schedules are eligible, always select the **oldest schedule date first** for a given product/opportunity (First‑In, First‑Out).
* [ ] **Status filter**: only consider revenue schedules with status **OPEN / PARTIALLY_PAID** (or equivalent “Unreconciled/Underpaid”) and a **positive commission difference**.
* [ ] **Date filter**: by default, do **not** match against **future‑dated** schedules (only current month or earlier) unless user explicitly toggles “Include Future‑Dated Schedules.”

---

## 2. Reconciliation Page UI & Status Workflow

This is the big “Implement reconciliation UI…” action item from 12‑02. 

### 2.1 Field Formatting (money & dates)

* [ ] **Currency formatting** – all revenue/commission amount fields (top deposit table and bottom schedule table) must be formatted as dollars with two decimals (e.g. `$1,234.56`).
* [ ] **Period / Schedule Date formatting** – show dates as proper dates (e.g. `MM/DD/YYYY`), not “year‑month‑date time” strings; remember revenue schedules are always **1st of the month**.

  These were explicitly called out as wrong in the 12‑02 walkthrough. **Definitely missing at that time.** 

### 2.2 Status Model: Unmatched → Matched → Reconciled

**Business rule:**

* When you match a line item to a schedule, both rows become **Matched** (not yet **Reconciled**) so users can leave/return without losing progress.
* After the deposit is “approved/finalized,” both line items and schedules move to **Reconciled**.

**Implementation gaps:**

* [ ] **Introduce explicit `Matched` status** for:

  * Deposit line items
  * Revenue schedules (for that deposit)
    They should not disappear into “Reconciled” immediately after a match.

* [ ] **Status transitions**:

  * Unmatched → Matched: when a user or AI creates a match.
  * Matched → Reconciled: when the deposit is finalized.
  * Matched → Unmatched: when user clicks “Unmatch.”
  * Reconciled → Matched/Unmatched: when user “Unreconciles” the deposit (see 2.4).

  **ASSUMED missing** – current behavior you demo’d only moved one side into “Reconciled”; Rob explicitly asked for a Matched phase first. 

### 2.3 Filters & Dropdowns (top and bottom tables)

Per the meeting, both top (deposit lines) and bottom (schedules) need consistent status filters. 

* [ ] Update both dropdowns to support:

  * **Suggested**
  * **All Schedules** (or equivalent for deposit side)
  * **Matched**
  * **Unmatched** (rename old “Unreconciled” here)
  * **Reconciled**

  And ensure they actually filter rows by the underlying status column, not just a label.

* [ ] When a line is matched, it must **disappear from “Unmatched”** views but appear under **“Matched”** for both tables.

### 2.4 Actions: Match, Unmatch, Reconcile, Unreconcile, Delete Deposit

**2.4.1 Match / Unmatch**

Manual match mostly works, but the revert path and dual‑status update were not finished.

* [ ] **Match**: ensure **both** the deposit line and schedule row move to `Matched` and are linked via a match record (or foreign key), not just visually.
* [ ] **Unmatch**: add a clear “Unmatch” action that:

  * Breaks the link between deposit line and schedule
  * Rolls back any applied amounts on the schedule (usage/commission actual & differences)
  * Sets both rows back to `Unmatched`
  * Returns the schedule to the suggestion pool (according to matching rules)

**2.4.2 Reconcile / Unreconcile Deposit (batch status)**

The spec and POC describe a **deposit‑level finalize step**: after all line items are settled, user confirms and the whole deposit flips to Reconciled, updating schedules and line items together.

* [ ] **“Reconcile Deposit”** action that:

  * Validates all line items are in a resolved state (Matched / FLEX / Exception handled)
  * Sets deposit status → `RECONCILED`
  * For each matched schedule where difference is zero, set status → `Reconciled`/`SETTLED`
  * Keeps `Underpaid`/`Overpaid` schedules in those statuses if a balance remains
  * Marks deposit line items → `Reconciled`

* [ ] **“Unreconcile Deposit”** action that:

  * For a previously reconciled deposit, rolls statuses back (e.g., deposit `RECONCILED` → `PROCESSING`; schedules `Reconciled` → `SETTLED` or prior; line items `Reconciled` → `Matched`)
  * Is permission‑gated (admin/reconciler only)
  * Writes a full audit log entry with reason.

  **ASSUMED missing** – Rob explicitly said “we need to be able to pull up that whole deposit and unreconcile it,” and this wasn’t shown as working. 

**2.4.3 Delete Deposit**

* [ ] **Delete Deposit** capability from the deposit list/detail when:

  * A file was uploaded twice (duplicate)
  * A deposit was created with wrong data / date
  * Deposit is not yet reconciled

  Deletion should:

  * Remove deposit and line items (or mark them deleted/archived)
  * Ensure any matched schedules are un‑matched first
  * Be permission‑gated + audited.

  **ASSUMED missing** – noted as required in the 12‑02 call but no behavior demonstrated. 

### 2.5 Sorting & Layout

* [ ] **Bottom schedule grid sort order** must be:

  1. Product Name (Vendor)
  2. Schedule Date (oldest → newest)

  *Not* by confidence alone. This is explicitly how Rob expects to work through a stack of months for a product.

* [ ] Confirm any default sort on the top deposit table is logical (e.g., by payment date or line number) and stable; avoid jumps when filtering.

### 2.6 Visual Highlighting of Matching Fields

* [ ] When a deposit line is selected (or when a suggested match is focused), **highlight the matching fields** (account name, product, amount, date, etc.) in both the deposit row and the candidate schedules using a subtle gray/blue background / bold text.

  Rob explicitly asked for this so he can see *why* a row is considered a good match without opening a separate detail view.

---

## 3. AI / Auto‑Match & Variance Threshold

The POC + specs define a **variance‑driven auto‑match**, and Rob reiterated this on 12‑02.

### 3.1 Variance Configuration (Admin / Settings)

* [ ] **Global per‑tenant setting for acceptable over/under variance** (e.g., 0–30%), stored in your reconciliation settings.

  * This can be a simple numeric input; a slider is optional but mentioned.

* [ ] Ensure matching logic uses this variance when deciding whether to **auto‑apply** vs **suggest** vs **FLEX/exception**.

### 3.2 Auto‑Match Engine Behavior

* [ ] Implement an **auto‑match pass** that:

  * Iterates over Unmatched deposit lines for a deposit
  * Uses the Two‑Pass matching + confidence scoring (Section 1)
  * Applies the variance rule:

    * Confidence ≥ high threshold (e.g., 0.95) **AND** variance ≤ tolerance → **auto‑match** (set both rows to `Matched`)
    * Confidence in “medium” band (e.g., 0.90–0.94) or variance > tolerance → **suggested only**, user must confirm
    * No suitable match → routed to FLEX/exception flow (Section 4)

* [ ] Store how a match was created (`Exact/Fuzzy/Manual/Auto`) and the confidence score for audit and future learning.

  **ASSUMED missing** – you explicitly said AI would be wired “after we’re happy with the matching and confidence” and it wasn’t yet. 

### 3.3 “Run AI Matching” Trigger

* [ ] Add a **“Run AI Matching” button** on the Reconciliation view for the currently open deposit that:

  * Calls the auto‑match engine for that deposit
  * Returns summary stats (total lines, auto‑matched, suggested, unmatched) to the UI
  * Leaves anything below the threshold as suggested/unmatched only

  Scheduling/background jobs can be a Later enhancement; for “Now” Rob just needs a clear manual trigger.

---

## 4. Variance, FLEX Products & Advanced Scenarios

(*ASSUMED in‑scope for “Reconciliation done” based on the Implementation Guide & POC; if you purposely moved them to a later phase, treat these as Next.*)

### 4.1 FLEX Creation for Overages & Unknowns

* [ ] **Overage FLEX**: when a deposit line matches a schedule but the amount exceeds acceptable variance:

  * Apply the **expected** amount to the original schedule and mark it Settled/Partially Paid accordingly
  * Create a FLEX revenue schedule for the **overage portion** using naming convention `RS-xxxxxx-F`, link it back to the deposit line, and mark it Reconciled/Settled.

* [ ] **Unknown Product FLEX**: when no schedule can be matched:

  * Create a FLEX schedule for the full amount with type “Unknown Product” and link it to the deposit line.
  * Queue it in a **FLEX review list** for later classification.

* [ ] Provide at least a basic **FLEX review UI** (table with type, amount, account, linked deposit, status).

### 4.2 Partial Payments (Many:1 / FIFO behavior)

* [ ] For a schedule receiving multiple deposits (partial payments):

  * Each applied payment reduces `usage_difference` / `commission_difference` until zero.
  * Status transitions: `Unreconciled` → `Underpaid/Partially Paid` → `Reconciled` as amounts accumulate. 
* [ ] When several open schedules share the same identifiers, ensure partials respect **FIFO** (apply to oldest open schedule first).

### 4.3 Prepayments (1:Many)

* [ ] Support splitting a **single large deposit line** across multiple future revenue schedules (e.g., 12‑month prepay):

  * UI should show the candidate schedules in chronological order with per‑schedule allocation, total applied, and remaining deposit balance. 

### 4.4 Chargebacks & Reversals

* [ ] For **negative deposit lines** (chargebacks):

  * Do **not** modify the original reconciled schedule; instead create a new `RS-xxxxxx-CB` schedule for the negative amount, linked to the original schedule. 
* [ ] For **chargeback reversals**, create `RS-xxxxxx-CB-REV` and link it to the CB record so the full history is auditable. 

  **ASSUMED missing** – none of these advanced scenarios were demo’d or mentioned as implemented in the 11‑24 or 12‑02 sessions; they’re defined in the Reconciliation specifications/guide.

---

## 5. Minimum “Done” Test Pass Before You Talk to Rob

When you think everything above is implemented, sanity‑check yourself by running these **end‑to‑end tests** (manual is fine):

1. **Simple 1:1 perfect match** – exact IDs, amounts. Expect auto‑match (or 1 click) with high confidence and clean Reconciled state. 
2. **Good match requiring Matched status** – match a few items, leave the page, come back; they must show as `Matched`, not `Reconciled`, and not re‑appear as Unmatched suggestions.
3. **Unmatch flow** – match, then unmatch; both sides go back to Unmatched and all amounts/statuses look correct.
4. **Deposit finalization + Unreconcile** – finalize a deposit, then unreconcile it; verify deposit, line items, and schedules roll back cleanly.
5. **Auto‑match + variance** – configure a non‑zero variance, upload a file with near matches, run AI Matching; validate auto‑matches vs suggestions line up with the rules.
6. **Overage to FLEX** – overpay a schedule past variance; confirm FLEX is created and the main schedule still has sane expected vs actual.

If you can check off **all the boxes in Sections 1–3, plus whichever Section 4 items you consider in‑scope for this release**, you’re in a strong position to tell Rob “Reconciliation is done” and back it up with behavior that matches the specs and the 12‑02 decisions.


