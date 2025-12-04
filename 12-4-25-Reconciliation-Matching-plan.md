# Reconciliation Matching Engine Enhancement Plan
## Date: December 4, 2025

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Matcher Behavior](#1-how-the-current-matcher-behaves)
3. [Gap Analysis](#2-gaps-vs-the-primary-matching-hierarchy)
4. [Suggested Updates](#3-suggested-updates-to-align-with-the-hierarchy)
   - 3.1 Candidate Retrieval & Filtering
   - 3.2 Two-Pass Engine (Pass A & Pass B)
   - 3.3 Hierarchy Mapping (1-8)
   - 3.4 Thresholds & Auto-Apply
5. [Critical Decisions Required](#4-critical-decisions-required-phase-0)
6. [Field Availability Analysis](#5-field-availability-analysis)
7. [Phased Implementation Checklist](#6-phased-implementation-checklist)
8. [Quick Start Path](#7-quick-start-path-minimal-viable-implementation)

---

## Executive Summary

This plan outlines the transformation of the current single-pass weighted matching engine into a **hierarchical two-pass system** that aligns with the Primary Matching Hierarchy specification. The key changes are:

| Current State | Target State |
|---------------|--------------|
| Single-pass weighted scoring | Two-pass: Exact (Pass A) → Fuzzy (Pass B) |
| Distributor/Vendor as soft filters | Distributor/Vendor as **hard prerequisites** |
| Equal-ish weights across signals | Hierarchical: 40% name / 30% product / 20% amount / 10% date |
| No status filtering | Only OPEN/PARTIALLY_PAID with positive commission diff |
| Symmetric date window (±1 month) | Past-only by default, future via toggle |
| FIFO in query only | FIFO enforced in final sort (tie-breaker) |

**Estimated Implementation Time:** 7-11 days (depending on schema changes)

---

## 1. How the Current Matcher Behaves

> **Source:** `lib/matching/deposit-matcher.ts`

### 1.1 Core Flow: `matchDepositLine(lineId, { limit })`

1. Loads the deposit line item + its deposit and related account/product/opportunity data
2. Calls `fetchCandidateSchedules` to get candidate RevenueSchedules
3. Scores each candidate with `scoreCandidate`
4. Sorts by `matchConfidence` DESC, truncates, and returns

### 1.2 Candidate Retrieval: `fetchCandidateSchedules`

**Current Filters Applied:**
| Filter | Behavior |
|--------|----------|
| `tenantId` | Always required |
| `scheduleDate` | Within `[fromDate, toDate]` (± `dateWindowMonths`, default 1) |
| `distributorAccountId` | Matches `deposit.distributorAccountId` (if present) |
| `vendorAccountId` | Matches `deposit.vendorAccountId` (if present) |
| `accountId` | Matches `lineItem.accountId` (if present) |

**Query Ordering:** `scheduleDate ASC`, `createdAt ASC` (FIFO-friendly)

**⚠️ Fallback Behavior:** If the strict query returns zero rows, it falls back to dropping distributor/vendor/account filters and just uses tenant + date window.

**❌ Not Applied:**
- No `RevenueSchedule.status` filter
- No "positive commission difference" check
- No future-date exclusion toggle

### 1.3 Scoring: `scoreCandidate`

Builds signals and weights them, then sums to a final score (clamped to 1.0):

| Signal | Weight | Description |
|--------|--------|-------------|
| `vendor_account_exact` | 0.18 | Vendor account ID exact match |
| `account_exact` | 0.22 | Account ID exact match |
| `customer_id_exact` | 0.12 | Customer/vendor ID exact match |
| `order_id_exact` | 0.12 | Order ID exact match |
| `account_name_similarity` | 0.12 | Fuzzy (accountName/accountLegalName/distributorName) |
| `product_similarity` | 0.08 | Product name similarity (vendor/house names) |
| `usage_amount` | 0.08 | Usage amount proximity |
| `commission_amount` | 0.05 | Commission amount proximity |
| `date_proximity` | 0.03 | Date closeness |
| **Total** | **1.00** | |

### 1.4 Current Limitations Summary

- **Single-pass blended score:** IDs + names + amounts + date all contribute at once
- **Distributor/Vendor not scored:** Used only as query filters (and dropped in fallback)
- **Confidence buckets** (`high`/`medium`/`low`) derived from thresholds but auto-match logic is not enforced; the `GET /candidates` endpoint just returns candidates for UI
- **No explicit exact-match-first pass**

---

## 2. Gaps vs. the Primary Matching Hierarchy

> **Reference:** `Primary-Matching-Hierarchy.md`

### 2.1 Gap Summary Table

| Hierarchy Item | Current Status | Gap Severity |
|----------------|----------------|--------------|
| 1-2. Distributor & Vendor as prerequisites | Soft filters, fallback ignores them | 🔴 **High** |
| 3. Account Legal Name priority | Folded into generic similarity signal | 🟡 Medium |
| 4. Strong Identifiers (exact match) | Present but diluted by other scores | 🟡 Medium |
| 5. Location ID / Customer PO # | **Not implemented** | 🔴 **High** |
| 6. Product Name & Part Number | Names only, no part numbers | 🟡 Medium |
| 7. Product Description | **Not implemented** | 🟡 Medium |
| 8. Revenue Schedule Date (FIFO) | Query order only, lost at sort time | 🔴 **High** |
| Two-pass logic | Single-pass only | 🔴 **High** |
| Status filtering | Not implemented | 🔴 **High** |
| Future-date filtering | Symmetric window includes future | 🟡 Medium |

### 2.2 Detailed Gap Analysis

#### Distributor & Vendor as Absolute Prerequisites
- **Current:** Used as filters, but fallback query ignores them entirely if the first query returns no schedules
- **Required:** Must be hard prerequisites - no match possible without exact Distributor AND Vendor match

#### Account Legal Name as the Next Priority
- **Current:** Folded into a generic `account_name_similarity` signal, not treated as "exact match" and not clearly prioritized over other name fields
- **Required:** Primary comparison field for Pass A exact matching and highest weight (40%) in Pass B fuzzy

#### Strong Identifiers as Priority After Legal Name
- **Current:** Order ID / Customer ID / Account ID are present as signals with moderate weights but:
  - Not separated into an "exact match pass"
  - A strong ID match can be partially diluted by poor name/amount/date scores
- **Required:** Pass A triggers on ANY strong ID exact match

#### Location ID / Customer PO #
- **Current:** Not represented at all in matching signals
- **Required:** Should be treated as strong identifiers in Pass A
- **Note:** Fields exist on `Opportunity` model (`locationId`, `customerPurchaseOrder`) - need to wire into matching

#### Product Name & Part Number
- **Current:** Product similarity only uses product names
- **Required:** Should include part numbers (`partNumberVendor`, `partNumberDistributor`, `partNumberHouse` on `Product`)

#### Product Description
- **Current:** Not used as a signal at all
- **Required:** Should contribute to product identity matching

#### Revenue Schedule Date as Tie-Breaker (FIFO)
- **Current:**
  - Used as a hard filter (± window) and small-weight signal (3%)
  - FIFO tie-breaking not enforced in final sort; candidates sorted purely by `matchConfidence`
  - Equal scores don't guarantee earliest schedule wins
- **Required:** Multi-key sort: `matchConfidence DESC`, `scheduleDate ASC`, `createdAt ASC`

#### Two-Pass Logic (Exact, then Fuzzy)
- **Current:** Single-pass weighted scoring
- **Required:** 
  - Pass A: Exact matching for 1.0 confidence
  - Pass B: Fuzzy matching only if Pass A yields no candidates

#### Date Filtering
- **Current:** Symmetric ±1 month window; can include future schedules
- **Required:** Only schedules on or before current month, unless "Include Future-Dated Schedules" toggle is enabled

#### Status Filtering
- **Current:** No `RevenueSchedule.status` filter and no "positive commission difference" check
- **Required:** Only OPEN or PARTIALLY_PAID with positive commission differences
- **Note:** Current `RevenueScheduleStatus` enum: `Projected`, `Invoiced`, `Paid`, `Cancelled`
  - Map: `Projected`/`Invoiced` → "OPEN", exclude `Paid`/`Cancelled`

---

## 3. Suggested Updates to Align with the Hierarchy

### 3.1 Candidate Retrieval: Enforce Prerequisites and Filters

**Focus:** Make Distributor/Vendor and basic financial constraints match the spec.

#### 3.1.1 Make Distributor & Vendor Hard Prerequisites

Keep the existing strict filters:
- `distributorAccountId: deposit.distributorAccountId` (when present)
- `vendorAccountId: deposit.vendorAccountId` (when present)

**Remove or heavily downgrade the fallback that drops these filters:**

| Option | Behavior | Recommendation |
|--------|----------|----------------|
| **Option A (Strict)** | If strict query returns zero rows, return zero candidates (line remains Unmatched or user must manually search) | ✅ **Recommended** |
| **Option B (Flexible)** | Keep fallback, but add flag `options.allowCrossVendorFallback` and mark all fallback candidates with capped confidence (≤ 0.6) so they never auto-match | Use if business requires |

#### 3.1.2 Add Status + "Open Balance" Filtering

**Status Filter:**
Approximate OPEN or PARTIALLY_PAID using existing `RevenueScheduleStatus`:
```typescript
status: { in: [RevenueScheduleStatus.Projected, RevenueScheduleStatus.Invoiced] }
```

**Positive Commission Difference Filter:**
After fetching candidates, compute and filter:
```typescript
const expectedNet = (schedule.expectedCommission ?? 0) + (schedule.expectedCommissionAdjustment ?? 0)
const actualNet = (schedule.actualCommission ?? 0) + (schedule.actualCommissionAdjustment ?? 0)
const commissionDiff = expectedNet - actualNet

// Filter to commissionDiff > 0
```

> **Note:** This must be a post-fetch filter since it requires computation across multiple fields.

#### 3.1.3 Align Date Filtering with "On or Before Current Month"

**Reference Date Calculation:**
```typescript
const referenceDate = deposit.month ?? deposit.paymentDate ?? lineItem.paymentDate ?? new Date()
```

**Date Window:**
- `toDate = endOfMonth(referenceDate)` (default: no future schedules)
- `fromDate = addMonths(referenceDate, -options.dateWindowMonths)` (e.g., 1-3 months back)

**Add Option for Future Schedules:**
```typescript
interface MatchOptions {
  // ... existing options
  includeFutureSchedules?: boolean
}

// If includeFutureSchedules is true:
toDate = addMonths(endOfMonth(referenceDate), options.dateWindowMonths)
```

Wire this to the UI "Include Future-Dated Schedules" toggle.

#### 3.1.4 Preserve FIFO Tie-Break Order in Scoring

**Query Ordering (keep existing):**
```typescript
orderBy: [{ scheduleDate: "asc" }, { createdAt: "asc" }]
```

**Final Sort (NEW - multi-key):**
```typescript
candidates.sort((a, b) => {
  // Primary: confidence descending
  if (b.matchConfidence !== a.matchConfidence) {
    return b.matchConfidence - a.matchConfidence
  }
  // Secondary: schedule date ascending (FIFO)
  if (a.scheduleDate !== b.scheduleDate) {
    return new Date(a.scheduleDate).getTime() - new Date(b.scheduleDate).getTime()
  }
  // Tertiary: created date ascending
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
})
```

This ensures that when multiple candidates tie on score (especially at 1.0), the earliest schedule wins.

---

### 3.2 Two-Pass Engine: Pass A Exact, Pass B Fuzzy

Introduce an explicit two-pass flow in `matchDepositLine`:

```
┌─────────────────────────────────────────────────────────────┐
│                    matchDepositLine()                        │
├─────────────────────────────────────────────────────────────┤
│  1. Fetch candidates (with hard filters)                     │
│  2. Run Pass A (Exact Match)                                 │
│     └─ If any Pass A hits → return only those (conf = 1.0)   │
│  3. If no Pass A hits → Run Pass B (Fuzzy Match)             │
│     └─ Return fuzzy scored candidates                        │
│  4. Apply FIFO-aware multi-key sort                          │
└─────────────────────────────────────────────────────────────┘
```

#### 3.2.1 Pass A: Exact Match on IDs + Legal Name

**Compute exact (binary) signals for each candidate:**

| Signal | Comparison |
|--------|------------|
| `distributor_vendor_ok` | Already ensured by filters; treat as requirement |
| `account_legal_exact` | `normalizeName(lineItem.accountNameRaw \|\| lineItem.account?.accountName)` vs `normalizeName(schedule.account?.accountLegalName \|\| schedule.account?.accountName)` |
| `order_id_exact` | Reuse `hasOrderIdMatch()` - checks House, Vendor, Distributor order IDs |
| `customer_id_exact` | `lineItem.customerIdVendor` vs `schedule.opportunity?.customerIdVendor` (+ House, Distributor variants) |
| `account_id_exact` | `lineItem.accountId` vs `schedule.accountId` |
| `location_or_po_exact` | (Future) When fields exist on `DepositLineItem` |

**Pass A Qualification Criteria:**
A candidate is a **Pass A hit** if:
1. Distributor & Vendor match (by filter) ✓
2. **AND** at least one of:
   - `account_legal_exact` = true
   - `order_id_exact` = true
   - `customer_id_exact` = true
   - `account_id_exact` = true
3. **AND** amount/date variance within tolerance:
   - `amountProximity >= 1 - varianceTolerance` (default `varianceTolerance = 0.0`)
   - `dateProximity` above minimum threshold

**For Pass A Hits:**
```typescript
{
  matchConfidence: 1.0,
  confidenceLevel: "high",
  matchType: "exact"  // NEW field
}
```

**If Any Pass A Candidates Exist:**
- Restrict output to just those candidates
- Sort using FIFO-aware sort (score desc → date asc → createdAt asc)
- This gives you the "Exact Matching (Priority 1)" behavior

#### 3.2.2 Pass B: Fuzzy Match Using Weighted Schema

**Only invoked if no Pass A hits.**

**Build fuzzy signals with hierarchy-aligned weights:**

| Signal | Weight | Implementation |
|--------|--------|----------------|
| **Account Name Similarity** | ~40% | Compare line's raw account name vs schedule `accountLegalName` first; fall back to `accountName` if legal missing |
| **Product Identity Similarity** | ~30% | Combine: product name similarity + part number similarity + (optional) description similarity. Use `max()` or weighted combo. |
| **Amount Proximity** | ~20% | Combine usage and commission proximity: `max(usage_proximity, commission_proximity)` or average |
| **Date Proximity** | ~10% | Reuse `dateProximity` helper |

**Strong IDs as Constraints in Pass B:**
IDs are no longer primary "score boosters" but constraints:
- If the line has a non-null ID and the candidate has a **conflicting** ID value:
  - **Option A:** Drop that candidate entirely
  - **Option B:** Cap its max confidence (e.g., ≤ 0.7) so it never crosses auto-match thresholds

**Compute Pass B `matchConfidence`:**
```typescript
const matchConfidence = 
  0.40 * account_name_similarity +
  0.30 * product_identity_similarity +
  0.20 * amount_signal +
  0.10 * date_proximity
```

**Preserve `signals` and `reasons` arrays** so the UI can explain why a candidate scored as it did.

---

### 3.3 Mapping the Hierarchy 1-8 Directly to Implementation

| Priority | Field(s) | Implementation |
|----------|----------|----------------|
| **1-2** | Distributor & Vendor (Exact) | Enforced by `fetchCandidateSchedules` filters; no candidates without matching IDs (unless intentional low-confidence fallback) |
| **3** | Account Legal Name | **Pass A:** `account_legal_exact` is a key trigger for exact matches. **Pass B:** Uses `accountLegalName` as primary comparison field with largest fuzzy weight (40%) |
| **4** | Strong Identifiers (Order/Customer/Account IDs) | **Pass A:** Combined with Distributor/Vendor, determine whether a candidate qualifies as exact match (1.0). **Pass B:** ID mismatches cap or exclude candidates |
| **5** | Location ID / Customer PO # | Once fields added to `DepositLineItem`: treat as additional strong IDs in Pass A (exact match). Optionally use as fuzzy signal in Pass B if vendors format inconsistently |
| **6** | Product Name & Part Number | Use names + part numbers together for single "product identity" score with 30% weight in Pass B |
| **7** | Product Description | Add similarity check comparing product descriptions. Either fold into 30% product identity bucket (`max(name, part, description)`) or give small dedicated weight |
| **8** | Revenue Schedule Date | Used in three places: (1) Query filter (date window), (2) Fuzzy signal in Pass B (10% weight), (3) Tie-breaker in final sort (FIFO rule) |

---

### 3.4 Thresholds & Auto-Apply Behavior

Adopt the two-threshold scheme from the broader spec:

#### Pass A (Exact Match)
- Any candidate that qualifies gets `matchConfidence = 1.0`
- Eligible for **auto-apply** when amount variance ≤ tolerance

#### Pass B (Fuzzy Match)
| Confidence | Action | UI Indicator |
|------------|--------|--------------|
| ≥ 0.95 | Auto-match (if allowed) | 🟢 Green |
| 0.90 – 0.94 | Suggested match | 🟡 Yellow |
| < 0.90 | Manual only | 🔴 Red |

#### Implementation

`matchDepositLine` can return:
- `candidates` with scores and `matchType`
- Optionally, a suggested `autoApplyScheduleId` when:
  - Pass A exact match exists (preferred), **OR**
  - The best fuzzy candidate exceeds auto-match threshold **AND** is well-separated from the next best (e.g., gap ≥ 0.05)

---

## 4. Critical Decisions Required (Phase 0)

> **⚠️ These decisions must be confirmed with stakeholders before implementation begins.**

### 4.1 Prerequisite & Fallback Policy

| Decision | Options | Recommendation | Status |
|----------|---------|----------------|--------|
| **Fallback when no Distributor/Vendor match?** | A) Strict - return zero candidates B) Capped confidence fallback (≤ 0.6) | **Option A (Strict)** - cleaner, forces manual review | ⬜ Pending |
| **Allow cross-vendor candidates?** | Yes (with cap) / No | **No** - preserves data integrity | ⬜ Pending |

### 4.2 Auto-Apply Rules

| Decision | Options | Recommendation | Status |
|----------|---------|----------------|--------|
| **Can fuzzy (Pass B) matches auto-apply?** | A) Yes (≥ 0.95) B) No (only exact Pass A) | **Option B (No)** - safer, builds trust first | ⬜ Pending |
| **Pass A variance tolerance?** | 0%, 2%, 5% | **0%** as default, make configurable | ⬜ Pending |
| **Auto-match threshold for Pass B (if enabled)?** | 0.95, 0.97, disabled | **0.97** if enabled, or disabled initially | ⬜ Pending |
| **Require separation from next-best?** | Yes (gap ≥ 0.05) / No | **Yes** - prevents false positives | ⬜ Pending |

### 4.3 Feature Scope

| Decision | Options | Recommendation | Status |
|----------|---------|----------------|--------|
| **Include Location ID / Customer PO in MVP?** | Yes / No / Later | **Later** - focus on core hierarchy first | ⬜ Pending |
| **Include Product Description in MVP?** | Yes / No / Later | **Later** - name + part number sufficient initially | ⬜ Pending |
| **Future-date toggle default?** | Excluded / Included | **Excluded** by default | ⬜ Pending |

### 4.4 Rollout Strategy

| Decision | Options | Recommendation | Status |
|----------|---------|----------------|--------|
| **Use feature flag for new engine?** | Yes / No | **Yes** - enables safe rollout and A/B comparison | ⬜ Pending |
| **Deprecation timeline for old engine?** | Immediate / 2 weeks / 1 month | **2 weeks** after validation | ⬜ Pending |

---

## 5. Field Availability Analysis

> **Based on current Prisma schema analysis**

### 5.1 Fields Already Available

| Field | Model | Location | Ready to Use |
|-------|-------|----------|--------------|
| `accountLegalName` | `Account` | `account.accountLegalName` | ✅ Yes |
| `distributorAccountId` | `RevenueSchedule` | Direct field | ✅ Yes |
| `vendorAccountId` | `RevenueSchedule` | Direct field | ✅ Yes |
| `orderIdHouse` | `RevenueSchedule` | Direct field | ✅ Yes |
| `distributorOrderId` | `RevenueSchedule` | Direct field | ✅ Yes |
| `orderIdVendor` | `Opportunity` | Via `schedule.opportunity.orderIdVendor` | ✅ Yes |
| `customerIdVendor` | `Opportunity` | Via `schedule.opportunity.customerIdVendor` | ✅ Yes |
| `customerIdHouse` | `Opportunity` | Via `schedule.opportunity.customerIdHouse` | ✅ Yes |
| `customerIdDistributor` | `Opportunity` | Via `schedule.opportunity.customerIdDistributor` | ✅ Yes |
| `accountIdHouse` | `Opportunity` | Via `schedule.opportunity.accountIdHouse` | ✅ Yes |
| `accountIdVendor` | `Opportunity` | Via `schedule.opportunity.accountIdVendor` | ✅ Yes |
| `locationId` | `Opportunity` | Via `schedule.opportunity.locationId` | ✅ Yes (wire to matching) |
| `customerPurchaseOrder` | `Opportunity` | Via `schedule.opportunity.customerPurchaseOrder` | ✅ Yes (wire to matching) |

### 5.2 Fields on DepositLineItem

| Field | Status | Notes |
|-------|--------|-------|
| `accountIdVendor` | ✅ Exists | Ready |
| `customerIdVendor` | ✅ Exists | Ready |
| `orderIdVendor` | ✅ Exists | Ready |
| `accountNameRaw` | ✅ Exists | Ready |
| `locationId` | ❌ Missing | **Need to add for Location matching** |
| `customerPO` | ❌ Missing | **Need to add for PO matching** |

### 5.3 Fields Needing Verification

| Field | Model | Action |
|-------|-------|--------|
| `partNumberVendor` | `Product` | Verify exists |
| `partNumberHouse` | `Product` | Verify exists |
| `partNumberDistributor` | `Product` | Verify exists |
| `productDescription` | `Product` | Verify exists or add |

### 5.4 RevenueScheduleStatus Enum

Current values:
```
Projected | Invoiced | Paid | Cancelled
```

**Mapping to spec:**
- `Projected`, `Invoiced` → Treat as "OPEN" (include in matching)
- `Paid`, `Cancelled` → Exclude from matching

---

## 6. Phased Implementation Checklist

### Phase 0 – Alignment & Guardrails
**Duration:** 1 day | **Blocking:** All other phases

- [ ] Confirm with stakeholders that Distributor/Vendor must be hard prerequisites
- [ ] Decide whether any cross-vendor fallback mode is allowed, and under what confidence cap
- [ ] Lock initial thresholds and tolerances:
  - [ ] Exact variance tolerance for Pass A (default 0.00%)
  - [ ] Auto-match vs. suggestion thresholds (e.g., 0.95 / 0.90)
- [ ] Decide whether fuzzy (Pass B) candidates are ever allowed to auto-apply, or only Pass A exact matches
- [ ] Confirm UI expectations for "Include Future-Dated Schedules" toggle
- [ ] Decide on feature flag approach for safe rollout

**Exit Criteria:** All decisions in Section 4 marked as confirmed

---

### Phase 0.5 – Test Data Preparation
**Duration:** 0.5 days | **Parallel with:** Phase 1

- [ ] Create test scenarios for validation:

| Test Case | Deposit Line Setup | Expected Result |
|-----------|-------------------|-----------------|
| Perfect exact match | All IDs match RS | 1.0 confidence, Pass A |
| Fuzzy name match | Similar name, no IDs | 0.7-0.85 confidence, Pass B |
| Vendor mismatch | Wrong vendor on deposit | Zero candidates (gate) |
| FIFO tie-breaker | Two RS with same score | Earlier date selected |
| Future-dated RS | RS in next month | Excluded by default |
| Paid RS | RS status = Paid | Excluded |
| Zero commission diff | RS fully reconciled | Excluded |

- [ ] Identify 5-10 real deposit lines for manual validation
- [ ] Document expected outcomes for comparison

---

### Phase 1 – Data Model & Field Readiness
**Duration:** 0.5-1.5 days

#### Phase 1a – Wire Existing Fields (0.5 days)
- [ ] Verify all required fields exist in Prisma models:
  - [ ] Distributor/vendor references on `Deposit` and `RevenueSchedule`
  - [ ] `Account.accountLegalName` is populated and used
  - [ ] Strong IDs on deposits and schedules (`customerIdVendor`, `orderIdVendor`, etc.)
- [ ] Wire `locationId` and `customerPurchaseOrder` from `Opportunity` into matching
- [ ] Verify `Product` records expose part numbers (vendor/distributor/house fields)

#### Phase 1b – Schema Updates (if needed, 1 day)
- [ ] Design and add missing fields:
  - [ ] `locationId` on `DepositLineItem`
  - [ ] `customerPO` on `DepositLineItem`
  - [ ] Any missing product description fields
- [ ] Create Prisma migration
- [ ] Add necessary indexes on new ID fields for performance

**Exit Criteria:** All fields available and queryable

---

### Phase 2 – Candidate Retrieval & Filtering
**Duration:** 1-2 days

- [ ] Update `fetchCandidateSchedules` in `lib/matching/deposit-matcher.ts`:
  - [ ] Always filter by `tenantId`
  - [ ] Treat `distributorAccountId` and `vendorAccountId` as **hard prerequisites** when present
  - [ ] Apply date window aligned to spec:
    - [ ] From: `referenceDate - N months` (backward window)
    - [ ] To: end of current month by default
    - [ ] Extend into future only when `includeFutureSchedules` is true
  - [ ] Restrict by `RevenueSchedule.status` to `Projected` or `Invoiced`
- [ ] After fetching, filter out schedules with non-positive commission difference:
  ```typescript
  const commissionDiff = expectedNet - actualNet
  candidates = candidates.filter(c => commissionDiff > 0)
  ```
- [ ] Decide behavior when no candidates remain:
  - [ ] Strict: return zero candidates
  - [ ] Optional fallback: allow cross-vendor but cap confidence
- [ ] Keep `orderBy [scheduleDate ASC, createdAt ASC]` for FIFO
- [ ] Add `includeFutureSchedules?: boolean` to `MatchOptions`

#### Phase 2 Tests
- [ ] Test: Distributor/Vendor as hard filters
- [ ] Test: Date window respecting "current month" vs. future-inclusive toggle
- [ ] Test: Status filter excludes Paid/Cancelled
- [ ] Test: Commission difference filter excludes zero/negative

**Exit Criteria:** Candidate retrieval returns only valid, matchable schedules

---

### Phase 3 – Exact Match Pass (Pass A)
**Duration:** 1-2 days

- [ ] Refactor `matchDepositLine` to implement two-pass flow:
  - [ ] Pass A: attempt exact matches first
  - [ ] Pass B: only run if Pass A yields no candidates
- [ ] Implement Pass A helper(s) to compute:
  - [ ] `account_legal_exact` using `accountLegalName` as primary
  - [ ] `order_id_exact` via existing `hasOrderIdMatch`
  - [ ] `customer_id_exact` comparing all variants (Vendor, House, Distributor)
  - [ ] `account_id_exact` comparing `DepositLineItem.accountId` to `RevenueSchedule.accountId`
  - [ ] (Future) `location_or_po_exact` when fields added
- [ ] Define Pass A candidate criteria:
  - [ ] Distributor and Vendor must match (pre-filtered)
  - [ ] At least one of the strong ID / legal-name exact signals is true
  - [ ] Amount proximity and date proximity within configured tolerance
- [ ] For Pass A hits:
  - [ ] Set `matchConfidence = 1.0`
  - [ ] Set `confidenceLevel = "high"` and `matchType = "exact"`
- [ ] If any Pass A candidates exist:
  - [ ] Restrict result set to Pass A candidates only
  - [ ] Sort by `matchConfidence DESC`, then `scheduleDate ASC`, then `createdAt ASC`

#### Phase 3 Tests
- [ ] Test: Exact ID + legal-name matches produce 1.0 confidence
- [ ] Test: Pass A chosen even when fuzzy alternatives exist
- [ ] Test: Non-matching IDs prevent Pass A qualification
- [ ] Test: Variance tolerance enforced

**Exit Criteria:** Pass A correctly identifies and scores exact matches at 1.0

---

### Phase 4 – Fuzzy Match Pass (Pass B) & Signal Weights
**Duration:** 1-2 days | **Can parallel with Phase 3**

- [ ] Extract fuzzy scoring logic into dedicated Pass B implementation
- [ ] Implement Pass B signal weights to match hierarchy:
  - [ ] Account name similarity (~40%), prioritizing `accountLegalName`
  - [ ] Product identity similarity (~30%) combining:
    - [ ] Product name (vendor/house/distributor)
    - [ ] Part number similarity
    - [ ] (Optional) Description similarity
  - [ ] Amount proximity (~20%), combining usage and commission
  - [ ] Date proximity (~10%) using existing `dateProximity` helper
- [ ] Treat strong IDs as constraints in Pass B:
  - [ ] If line has given ID and candidate's value conflicts → drop or cap (≤ 0.7)
- [ ] Compute Pass B `matchConfidence`:
  ```typescript
  0.40 * account_name_similarity +
  0.30 * product_identity_similarity +
  0.20 * amount_signal +
  0.10 * date_proximity
  ```
- [ ] Preserve `signals` and `reasons` arrays for UI explanation
- [ ] Apply FIFO-aware sort to final Pass B candidates

#### Phase 4 Tests
- [ ] Test: Fuzzy matches generate expected confidence bands
- [ ] Test: ID conflicts cap or exclude candidates
- [ ] Test: FIFO tie-breaking when multiple candidates have similar scores
- [ ] Test: Weight distribution produces expected rankings

**Exit Criteria:** Pass B correctly scores fuzzy matches with new weights

---

### Phase 5 – API & UI Wiring
**Duration:** 1 day

- [ ] Extend `MatchOptions` in `lib/matching/deposit-matcher.ts`:
  - [ ] `includeFutureSchedules?: boolean`
  - [ ] `useHierarchicalMatching?: boolean` (feature flag)
  - [ ] Any strictness flags for fallback behavior
- [ ] Update `/candidates` endpoint:
  - [ ] Read and forward new options from request/URL to `matchDepositLine`
  - [ ] Ensure response includes `matchType` (exact vs. fuzzy)
  - [ ] Include richer `signals` data if needed
- [ ] Define auto-match rules in service layer:
  - [ ] Pass A: auto-apply when `matchConfidence === 1.0` and variance ≤ tolerance
  - [ ] Pass B: auto-apply only when `matchConfidence >= autoMatchThreshold` AND gap to next-best is safe (if fuzzies allowed)
- [ ] Implement/update logic that:
  - [ ] Creates/updates `DepositLineMatch` rows with `source=Auto` or `source=Manual`
  - [ ] Updates `DepositLineItem.status`
  - [ ] Calls `recomputeDepositAggregates` after match/unmatch
- [ ] Surface "Include Future-Dated Schedules" toggle in reconciliation UI

#### Phase 5 Tests
- [ ] Test: API accepts and respects new options
- [ ] Test: Feature flag correctly switches between old/new engine
- [ ] Test: Auto-match creates correct records

**Exit Criteria:** Full API and UI integration complete

---

### Phase 6 – Testing, Tuning, and Observability
**Duration:** 1-2 days

#### Integration Testing
- [ ] End-to-end tests with real or realistic data
- [ ] Compare old vs. new engine results side-by-side
- [ ] Validate against manually-reviewed matches

#### Dry-Run Evaluation
- [ ] Log top candidate, confidence, and `matchType` per line
- [ ] Compare against human-reviewed matches to tune weights and thresholds
- [ ] Document false positive and false negative rates

#### Observability
- [ ] Add structured logs for every auto-match applied:
  - [ ] Key signals and reasons
  - [ ] Match type (Pass A vs. Pass B)
  - [ ] Confidence score
- [ ] Add metrics:
  - [ ] Auto-match rate
  - [ ] Suggestion rate
  - [ ] Manual match rate
  - [ ] Correction rate (where users override suggestions)

#### Tuning
- [ ] Adjust weights if needed based on observed behavior
- [ ] Adjust thresholds if auto-match rate too high/low
- [ ] Document final configuration

**Exit Criteria:** Engine validated, monitored, and tuned for production

---

## 7. Quick Start Path (Minimal Viable Implementation)

> Goal: ship a safe, observable 80% solution in ~4 days without schema changes.

### Scope & Guardrails
- Use existing fields only (no new migrations); distributor + vendor stay hard prerequisites.
- Pass A only auto-applies (variance tolerance 0% default); Pass B is suggest-only.
- Keep cross-vendor fallback disabled by default; cap it if later enabled.
- Ship behind `useHierarchicalMatching` feature flag with opt-in per tenant.

### Day 1: Candidate Retrieval Hardening (Phase 2)
- In `lib/matching/deposit-matcher.ts`, enforce: tenantId, distributor, vendor, date window (back N months to end of current month), status in Projected/Invoiced.
- Add `includeFutureSchedules?: boolean` to optionally extend the window forward.
- Post-fetch drop schedules with `commissionDiff <= 0`; retain FIFO order (scheduleDate asc, createdAt asc).
- Remove fallback that drops distributor/vendor; if kept, guard with capped-confidence flag default false.
- Output: PR with updated `fetchCandidateSchedules` plus tests for status/date/commission filters.

### Day 2: Pass A Exact Match (Phase 3)
- Add helper `isPassAMatch(line, schedule, varianceTolerance)` that checks legal name exact or any strong ID exact (order/customer/account) after distributor/vendor gating.
- If any Pass A hits: set `matchConfidence = 1.0`, `matchType = "exact"`, `confidenceLevel = "high"`, and keep them in the combined candidate list (they will sort to the top above any fuzzy suggestions).
- Apply variance tolerance (default 0) using amount/date proximity; block Pass A if outside tolerance.
- Tests: exact ID + legal-name hits, vendor mismatch returns zero, ties resolve by scheduleDate then createdAt.

### Day 3: Pass B Reweighting & ID Constraints (Phase 4)
- Always run Pass B to produce additional fuzzy suggestions, even when Pass A finds exact matches; tag candidates `matchType = "fuzzy"`.
- Reweight signals: Account 0.40, Product Identity 0.30 (names + part numbers if present), Amount 0.20, Date 0.10.
- Treat conflicting strong IDs as drop (preferred) or confidence cap (<= 0.7) via option default drop; drop any Pass B candidates that duplicate a Pass A schedule.
- Filter out very low-confidence Pass B results (e.g., `matchConfidence < 0.5`) so only 50–99% suggestions appear in the UI.
- Preserve `signals`/`reasons`; apply multi-key sort (confidence desc, scheduleDate asc, createdAt asc) for FIFO.
- Tests: fuzzy scoring bands, ID conflict exclusion/cap, FIFO tie-breaks.

### Day 4: Wiring, Flag, and Dry Run (Phase 5/6 lite)
- Extend `/candidates` + UI to pass `includeFutureSchedules` and `useHierarchicalMatching`.
- Keep auto-apply limited to Pass A; guard new engine with feature flag default off.
- Add structured debug log per candidate in dry-run mode (matchType, confidence, top signals).
- Dry-run 5-10 real lines comparing old vs. new; record deltas and adjust weights if needed.

**Deliverable:** Feature-flagged hierarchical matcher that enforces distributor/vendor gates, exact-first behavior, reweighted fuzzy scoring, FIFO tie-breaks, and basic observability - ready for broader tuning and any later schema updates.

---

## Appendix: Code Snippets

### A.1 Multi-Key FIFO Sort
```typescript
function sortCandidatesWithFIFO(candidates: ScoredCandidate[]): ScoredCandidate[] {
  return candidates.sort((a, b) => {
    // Primary: confidence descending
    if (b.matchConfidence !== a.matchConfidence) {
      return b.matchConfidence - a.matchConfidence
    }
    // Secondary: schedule date ascending (FIFO)
    const dateA = a.revenueScheduleDate ? new Date(a.revenueScheduleDate).getTime() : Infinity
    const dateB = b.revenueScheduleDate ? new Date(b.revenueScheduleDate).getTime() : Infinity
    if (dateA !== dateB) {
      return dateA - dateB
    }
    // Tertiary: use stable order from query
    return 0
  })
}
```

### A.2 Pass A Exact Match Check
```typescript
function isPassAMatch(
  lineItem: DepositLineWithRelations,
  schedule: RevenueScheduleWithRelations,
  varianceTolerance: number = 0
): boolean {
  // Check at least one strong identifier matches exactly
  const hasExactId = 
    checkAccountLegalExact(lineItem, schedule) ||
    hasOrderIdMatch(lineItem.orderIdVendor, schedule) ||
    checkCustomerIdExact(lineItem, schedule) ||
    checkAccountIdExact(lineItem, schedule)
  
  if (!hasExactId) return false
  
  // Check amount variance within tolerance
  const amountScore = amountProximity(
    toNumber(lineItem.commission),
    getExpectedCommissionNet(schedule)
  )
  
  return amountScore >= (1 - varianceTolerance)
}
```

### A.3 Pass B Weighted Score
```typescript
function computePassBScore(
  lineItem: DepositLineWithRelations,
  schedule: RevenueScheduleWithRelations
): number {
  const accountNameSim = computeNameSimilarity(
    normalizeName(lineItem.accountNameRaw ?? ''),
    normalizeName(schedule.account?.accountLegalName ?? schedule.account?.accountName ?? '')
  )
  
  const productIdentitySim = Math.max(
    computeNameSimilarity(lineItem.productNameRaw ?? '', schedule.product?.productNameVendor ?? ''),
    computeNameSimilarity(lineItem.productNameRaw ?? '', schedule.product?.productNameHouse ?? '')
    // Add part number similarity when available
  )
  
  const amountSim = Math.max(
    amountProximity(toNumber(lineItem.usage), getExpectedUsageNet(schedule)),
    amountProximity(toNumber(lineItem.commission), getExpectedCommissionNet(schedule))
  )
  
  const dateSim = dateProximity(
    lineItem.paymentDate ?? lineItem.deposit?.paymentDate ?? null,
    schedule.scheduleDate ?? null
  )
  
  return (
    0.40 * accountNameSim +
    0.30 * productIdentitySim +
    0.20 * amountSim +
    0.10 * dateSim
  )
}
```

---

## Document History

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-04 | 1.0 | Initial plan created |
| 2025-12-04 | 1.1 | Added: Executive Summary, Critical Decisions section, Field Availability Analysis, Quick Start Path, Code Snippets, Table of Contents. Reorganized phases with integrated testing. Added feature flag recommendation and estimated durations. |
| 2025-12-04 | 1.2 | Updated Quick Start Path to reflect implemented behavior: hierarchical engine wired into `/candidates` behind feature flag + dev toggles, Pass A exact matches combined with Pass B fuzzy suggestions (≥0.5 confidence), and candidate retrieval hardening (status/date/commission filters, future-date option). |
