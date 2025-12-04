# Reconciliation “AI Matching” – Current Implementation (Run AI Matching Button)

This document describes how the **Run AI Matching** feature works today for deposit reconciliation, including what “AI model” is in use.

> Short answer: there is **no external ML/LLM model** in this flow. Matching is done by a deterministic, rule‑based scoring engine implemented in TypeScript in `lib/matching/deposit-matcher.ts`.

---

## 1. User Flow – Run AI Matching

**Entry point (UI)**  
- Screen: deposit detail reconciliation view – `app/(dashboard)/reconciliation/[depositId]/page.tsx`.
- Button: **Run AI Matching** (passed into `DepositReconciliationDetailView` as `onRunAutoMatch`).

**Step 1 – Preview**  
1. Clicking **Run AI Matching** calls `handleRequestAutoMatchPreview()` on the page component.
2. That issues a `POST` to:
   - `/api/reconciliation/deposits/{depositId}/auto-match/preview`  
     (`app/api/reconciliation/deposits/[depositId]/auto-match/preview/route.ts`)
3. The preview endpoint:
   - Fetches all `depositLineItem` rows for the deposit.
   - Skips any lines already `Matched` or `PartiallyMatched`.
   - For each remaining line, calls the matching engine (`matchDepositLine`) with `limit: 1` to get the top candidate.
   - Only keeps **Pass A** candidates that are:
     - `matchType === "exact"` and
     - `matchConfidence === 1` (within tenant variance tolerance).
4. The preview result (`AutoMatchPreviewSummary`) is rendered in `AutoMatchPreviewModal` (`components/auto-match-preview-modal.tsx`), showing:
   - Line, account, usage, commission.
   - Candidate schedule, confidence %, and top reasons.
   - Summary counts: processed, already matched, eligible for auto‑match, fuzzy‑only, no candidates, errors.

**Step 2 – Apply**  
1. When the user clicks **Apply matches** in the modal, the page calls `executeAutoMatch()`.
2. This sends a `POST` to:
   - `/api/reconciliation/deposits/{depositId}/auto-match`  
     (`app/api/reconciliation/deposits/[depositId]/auto-match/route.ts`)
3. The auto‑match endpoint:
   - Re‑iterates over all deposit lines.
   - Skips already `Matched` / `PartiallyMatched` items.
   - Calls `matchDepositLine` with `limit: 1` and the tenant’s matching preferences.
   - For a line to be auto‑matched, the **top candidate** must be:
     - `matchType === "exact"` and
     - `matchConfidence === 1`.
   - If those conditions are met, it calls `applyAutoMatch(...)` to persist the match and update aggregates.
4. The page then refreshes line items and suggestions so the grid reflects the new matches.

**Step 3 – Manual cleanup and finalize**  
- Fuzzy suggestions (Pass B) remain available per line via the candidates API (see section 4).  
- After reviewing, the user can finalize the deposit via `/finalize` and, if needed, `/unfinalize`.

---

## 2. What “AI Model” Is Being Used?

There is **no third‑party AI/ML service** involved in this feature:

- No `openai`, `anthropic`, or other LLM SDKs are called from the matching code or the auto‑match endpoints.
- All matching logic lives in `lib/matching/deposit-matcher.ts` and related helpers under `lib/matching/`.

Instead, the “AI” behavior comes from a **deterministic hierarchical scoring engine** that:

- Computes **string‑similarity scores** between deposit lines and revenue schedules.
- Uses **ID equality checks** and **amount/date proximity** as strong signals.
- Combines those signals with weights to produce a `matchConfidence` in `[0, 1]`.
- Applies business rules about variance and conflicts to decide auto‑match vs suggestion.

Because it is deterministic:

- Given the same deposit lines, revenue schedules, and tenant settings, **re‑running Run AI Matching produces the same results**.

---

## 3. Matching Engine Overview

Core engine: `matchDepositLine` in `lib/matching/deposit-matcher.ts`.

```ts
export async function matchDepositLine(
  depositLineItemId: string,
  options?: {
    limit?: number
    includeFutureSchedules?: boolean
    useHierarchicalMatching?: boolean
    varianceTolerance?: number
    allowCrossVendorFallback?: boolean
    debugLog?: boolean
  },
): Promise<MatchDepositLineResult>
```

### 3.1 Inputs

For a given `depositLineItemId`, the engine loads:

- The **deposit line** with:
  - Amounts: `usage`, `commission`.
  - Identifiers: `accountId`, `vendorAccountId`, `customerIdVendor`, `orderIdVendor`, `locationId`, `customerPurchaseOrder`.
  - Product signal: `productNameRaw` (plus linked product fields).
  - Dates: `paymentDate` and deposit `paymentDate` / `month`.
- The **deposit**:
  - `tenantId`, `distributorAccountId`, `vendorAccountId`, `paymentDate`, `month`.
- Existing `DepositLineMatch` records for that line (used to inject any already‑applied match into the candidates).

### 3.2 Candidate universe (which schedules we consider)

Candidate fetch: `fetchCandidateSchedules` in `deposit-matcher.ts`.

- Tenant: only schedules for the same `tenantId`.
- Status: only schedules whose `status` is one of:
  - `Unreconciled`, `Underpaid`, `Overpaid` (never fully reconciled).
- Date window:
  - `referenceDate = paymentDate || deposit.paymentDate || deposit.month || today`.
  - From `referenceDate - dateWindowMonths` (default 1 month) to:
    - `endOfMonth(referenceDate)`; or
    - `endOfMonth(referenceDate) + dateWindowMonths` if `includeFutureSchedules` is true.
- Account scoping (strict mode):
  - If the deposit has `distributorAccountId`, candidate schedules must match that.
  - If the deposit has `vendorAccountId`, candidates must match that.
  - If the line has `accountId`, candidates must match that.
- Result limit:
  - Engine computes a search limit: `max(limit * 3, DEFAULT_UNIVERSE_LIMIT)` (default 30).

**Fallback candidates (not used by Run AI auto‑match)**  
- If strict query returns no schedules *and* `allowCrossVendorFallback` is true, the engine:
  - Drops the distributor/vendor/account filters and re‑queries.
  - Marks those schedules with `__isFallback: true`.
  - Capped later so they cannot auto‑match (see Pass B).
- The `Run AI Matching` flow does **not** enable `allowCrossVendorFallback`, so cross‑vendor fallback schedules are not considered for auto‑match.

**Positive commission filter**  
- After fetching, the engine keeps only schedules where `commissionDifference > 0` (still owing commission).

---

## 4. Engine Modes & Tenant Settings

Tenant preferences are loaded via `getTenantMatchingPreferences` in `lib/matching/settings.ts`. Settings are stored in `SystemSetting`:

- `reconciliation.varianceTolerance` – per‑tenant variance tolerance (0–1).  
  - Default from env: `DEFAULT_VARIANCE_TOLERANCE` (percentage, e.g. `2` → 2% → 0.02).
  - In the Reconciliation Settings UI, users edit this as a percentage.
- `reconciliation.includeFutureSchedulesDefault` – whether to include a forward date window for candidates.
- `reconciliation.engineMode` – `"env" | "legacy" | "hierarchical"`; default is `"hierarchical"`.

**Mode resolution in Run AI Matching flows**  

Both the candidates API and the auto‑match endpoints resolve the engine mode as:

- If `engineMode === "legacy"` → use **legacy** single‑pass scoring.
- Otherwise (`"hierarchical"` or `"env"`) → use **hierarchical** Pass A / Pass B scoring.

In code (preview and auto‑match routes):

```ts
useHierarchicalMatching: prefs.engineMode === "legacy" ? false : true
```

So in practice, unless a tenant is explicitly configured to `"legacy"`, **Run AI Matching uses the hierarchical engine**.

---

## 5. Hierarchical Scoring (“AI Model”)

When `useHierarchicalMatching` is true, the engine uses two passes:

1. **Pass A** – exact identity + within variance → `matchType: "exact"`, `matchConfidence: 1`.
2. **Pass B** – fuzzy similarity → `matchType: "fuzzy"`, `matchConfidence: 0–1`.

Both passes produce `ScoredCandidate` objects, then:

- Combined list is sorted (by confidence and FIFO) and truncated to `limit`.

### 5.1 Pass A – Exact match within variance

Implementation: `buildPassACandidate` in `deposit-matcher.ts`.

**Guardrails**
- Fallback schedules (`__isFallback`) are excluded wholesale – they never enter Pass A.

**Strong identity checks (binary signals)**  
Each candidate schedule is checked against the line for:

- **Account legal name exact match** – normalized via `normalizeName` (uppercased, punctuation collapsed, legal suffixes like `LLC`, `INC`, `CORP`, `LTD` stripped).
- **Order ID exact match** – `orderIdVendor` vs schedule `orderIdHouse`, `distributorOrderId`, or `opportunity.orderIdVendor` (normalized by `cleanId`).
- **Customer ID exact match** – `customerIdVendor` vs any of `opportunity.customerIdVendor/House/Distributor`.
- **Account ID exact match** – `accountId` vs `schedule.accountId` (both normalized).
- **Location or PO exact match** – `locationId` vs `opportunity.locationId` **or** `customerPurchaseOrder` vs `opportunity.customerPurchaseOrder`.

If **none** of these are true, the schedule is **not** a Pass A candidate.

**Amount and date proximity (variance tolerance)**  
For candidates that pass identity checks, the engine computes:

- `amountScore` – max of:
  - Proximity between line commission vs expected commission; and
  - Proximity between line usage vs expected usage.  
  (Proximity is `1 - variance`, where variance is the relative difference between amounts.)
- `dateScore` – proximity between line payment date and schedule date, decaying to 0 over a 90‑day window.

The schedule qualifies for Pass A only if:

- `amountScore >= 1 - varianceTolerance` **and**  
- `dateScore >= 1 - varianceTolerance`.

Examples:

- If variance tolerance is `0` (0%), both scores must be exactly `1.0` (perfect match).
- If variance tolerance is `0.02` (2%), scores must be at least `0.98`.

**Pass A candidate output**

- `matchType = "exact"`
- `matchConfidence = 1`
- `confidenceLevel = "high"`
- `reasons` summarizing which identity signals were true (e.g. “Order ID matches”, “Account legal name matches”).

These are the **only candidates that Run AI Matching will auto‑apply**.

### 5.2 Pass B – Fuzzy similarity

Implementation: `scoreCandidatePassB` in `deposit-matcher.ts`.

**Hard conflict filter (strong ID conflicts)**

The engine first calls `hasStrongIdConflict(lineItem, schedule)` and discards the candidate if:

- The line has an `orderIdVendor`, the schedule has *any* order id fields, and they do **not** match; or
- Both sides have `accountId` and they differ; or
- Both sides have `locationId` and they differ; or
- Both sides have `customerPurchaseOrder` and they differ.

Customer IDs are *not* treated as a hard conflict (real data often has alternate IDs), but they remain a positive signal in Pass A.

**Similarity signals (weighted features)**

For non‑conflicting candidates, Pass B builds these features:

1. **Account name similarity** (`weight = 0.4`)  
   - `computeNameSimilarity` over the line’s account/legal name vs schedule account/legal/distributor names.
2. **Product identity similarity** (`weight = 0.3`)  
   - Uses product names, part numbers, and descriptions on both sides (`computeProductIdentitySimilarity`).
3. **Amount proximity** (`weight = 0.2`)  
   - Max of usage and commission proximity, similar to Pass A but without variance gating.
4. **Date proximity** (`weight = 0.1`)  
   - Proximity of payment date vs schedule date.

Each signal contributes `score * weight` where `score` is clamped to `[0, 1]`.

**Confidence score and level**

- `weightedScore = Σ(contribution)`;
- `matchConfidence = min(weightedScore, 1)`, rounded to 4 decimals;
- `confidenceLevel` via thresholds:
  - `>= 0.9` → `"high"`
  - `>= 0.75` → `"medium"`
  - `< 0.75` → `"low"`

**Cross‑vendor fallback cap**

- If a schedule is from the relaxed fallback query (`__isFallback: true`):
  - `matchConfidence` is capped at `CROSS_VENDOR_CONFIDENCE_CAP = 0.6` and  
  - a reason “Cross-vendor fallback candidate (confidence capped)” is added.

**Pass B minimum confidence filter**

- Only candidates with `matchConfidence >= PASS_B_MIN_CONFIDENCE` (currently `0.5`) are kept in Pass B.

Pass B candidates are **never auto‑applied**; they appear as **Suggested** matches in the per‑line suggestions grid.

### 5.3 Legacy engine (single‑pass)

When `useHierarchicalMatching` is false, the engine uses `scoreCandidateLegacy`:

- Mixes a set of boolean and similarity signals:
  - Vendor account match, account Id match, customer ID match, order ID match.
  - Account name similarity, product name similarity.
  - Usage and commission amount proximity.
  - Date proximity.
- Applies a specific weight to each signal and sums contributions into `matchConfidence` (capped at 1).
- All candidates are labeled with `matchType = "legacy"`.

This mode is only used when a tenant’s `reconciliation.engineMode` is explicitly set to `"legacy"` or another endpoint passes `useHierarchicalMatching: false`. The Run AI Matching flow prefers the hierarchical engine.

---

## 6. How Auto‑Match Decisions Are Applied

Auto‑match summary type (same shape in preview and apply endpoints):

```ts
interface AutoMatchSummary {
  processed: number
  autoMatched: number
  alreadyMatched: number
  fuzzyOnly: number
  noCandidates: number
  errors: number
}
```

### 6.1 Eligibility rule

For both preview and `/auto-match`:

- The engine requests **only the top candidate per line** (`limit: 1`).  
- A line is auto‑match eligible **only if**:
  - `top.matchType === "exact"` and  
  - `top.matchConfidence === 1`.

In practice, that means **only Pass A exact matches within the tenant variance tolerance** are auto‑applied.

### 6.2 Persisting matches

For each auto‑matched line, `applyAutoMatch` in `auto-match/route.ts`:

1. Converts `usage` and `commission` into allocation amounts (`allocationUsage`, `allocationCommission`).
2. Runs a Prisma transaction:
   - `depositLineMatch.upsert` with key `(depositLineItemId, revenueScheduleId)`:
     - `status = Applied`
     - `source = DepositLineMatchSource.Auto`
     - `confidenceScore = matchConfidence`
     - `usageAmount` and `commissionAmount` set to allocation amounts.
   - `depositLineItem.update` to:
     - Set `status` to `Matched` if allocation covers full line amounts, else `PartiallyMatched`.
     - Set `primaryRevenueScheduleId` to the schedule.
     - Update `usageAllocated`, `usageUnallocated`, `commissionAllocated`, `commissionUnallocated`.
   - Call `recomputeDepositAggregates` to refresh deposit totals.
3. After the transaction, logs an audit metric via `logMatchingMetric` with `event = "auto_match"`.

### 6.3 Non‑auto behavior

- Lines with only Pass B fuzzy candidates count as `fuzzyOnly` and are **not** auto‑matched.
- Lines with no candidates count as `noCandidates`.
- Any errors computing matches are surfaced as `errors` in the summary and logged to the server console.

---

## 7. Per‑Line Suggestions (Fuzzy Matches)

The **Run AI Matching** button is about auto‑applying **Pass A** matches. Fuzzy matches are still exposed per line for manual review.

API: `GET /api/reconciliation/deposits/{depositId}/line-items/{lineId}/candidates`  
Location: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route.ts`

For a given line:

1. The endpoint verifies the deposit and line belong to the current tenant.
2. It loads tenant matching preferences (`varianceTolerance`, `includeFutureSchedulesDefault`, `engineMode`).
3. It resolves whether to use hierarchical vs legacy (same logic as above).
4. Calls `matchDepositLine(lineId, { limit: 10, ... })`.
5. If candidates are present and `lineItem.hasSuggestedMatches` is false, it updates the line to mark that suggestions exist.
6. Maps the engine’s `ScoredCandidate[]` into UI rows with `candidatesToSuggestedRows`, including:
   - Status (`Suggested`, `Matched`, `Reconciled`), confidence, match type, reasons, balances, and signal metadata for debugging.

These suggestions feed the per‑line **Match** modal and grids in `components/deposit-reconciliation-detail-view.tsx`.

---

## 8. Code References

- **UI & Flows**
  - `app/(dashboard)/reconciliation/[depositId]/page.tsx`
  - `components/deposit-reconciliation-detail-view.tsx`
  - `components/auto-match-preview-modal.tsx`
- **Engine & Settings**
  - `lib/matching/deposit-matcher.ts`
  - `lib/matching/settings.ts`
  - `lib/matching/deposit-aggregates.ts`
  - `lib/matching/metrics.ts`
- **API Routes**
  - `app/api/reconciliation/deposits/[depositId]/auto-match/preview/route.ts`
  - `app/api/reconciliation/deposits/[depositId]/auto-match/route.ts`
  - `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route.ts`
- **Status & planning docs**
  - `reconciliation_matching_status_summary.md`
  - `reconciliation_matching_engine_implementation_steps.md`
  - `SIMPLE_MATCHING_ENGINE_SPEC.md`

---

## 9. Summary

- The **Run AI Matching** button currently uses a **hierarchical, rule‑based matching engine**, not an external AI/ML model.
- **Auto‑match** applies only when a line has a **Pass A exact match** that is within the tenant’s variance tolerance, producing `matchConfidence = 1`.
- **Fuzzy matches** (Pass B) remain suggestion‑only and require manual review.
- All behavior is deterministic and traceable in `lib/matching/deposit-matcher.ts` and the related API routes listed above.

