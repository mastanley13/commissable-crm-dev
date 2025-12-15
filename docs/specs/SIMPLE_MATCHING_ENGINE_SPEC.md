# Deposit <-> Revenue Schedule Matching Engine (Simplified Spec)

## Overview

For each deposit line item, the engine:

- Normalizes deposit (and conceptually schedule) data into canonical fields.
- Compares that line item against every open revenue schedule, field by field.
- Converts each field comparison into a numeric score (0–1) with a match type label.
- Groups fields into hierarchy “levels” (Distributor, Vendor, IDs, Names, Rate) and computes a level‑by‑level score plus bonuses.
- Uses the final hierarchy score as the confidence score, picks the best schedule as the primary match, and keeps the next best as alternates.

This document specifies a simplified matching engine you can implement in another workspace to suggest matches between **deposit line items** and **revenue schedules**.

The design mirrors the POC’s `EnhancedMatchingEngineV3`, but is intentionally lighter and decoupled from any specific database or framework.

---

## 1. Core Data Models (Normalized Layer)

Define small, framework‑agnostic models (classes, dataclasses, or DTOs) that represent the data **after** initial normalization/mapping from your database or CSVs.

### 1.1 Deposit Line Item (normalized)

`DepositLineItemNormalized`:

- `id: string`
- `distributor: string | null`
- `vendor_name: string | null`
- `vendor_account: string | null`
- `customer_id: string | null`
- `customer_name: string | null`
- `order_id_distributor: string | null`  
  (e.g., Telarus Order ID or your equivalent)
- `order_id_vendor: string | null`  
  (e.g., vendor account ID / "Account ID – Vendor")
- `product_name: string | null`
- `commission_rate: float | string | null`  
  (actual rate on the deposit line; format can be `0.155`, `15.5`, or `"15.5%"`)
- `amount: float`  
  (actual payout / commission amount)

### 1.2 Revenue Schedule (normalized)

`RevenueScheduleNormalized`:

- `id: string`
- `distributor_name: string | null`
- `vendor_name: string | null`
- `customer_id: string | null`
- `customer_name: string | null`
- `order_id_distributor: string | null`
- `order_id_vendor: string | null`
- `product_name: string | null`
- `expected_commission: float`
- `expected_commission_rate: float | string | null`

### 1.3 Match Suggestion

`MatchSuggestion`:

- `deposit_id: string`
- `schedule_id: string | null`
- `score: float` (0.0–1.0)
- `confidence_level: "high" | "medium" | "low"`
- `reasons: string[]`
- `alternates: AlternateMatch[]`

`AlternateMatch`:

- `schedule_id: string`
- `score: float`
- `confidence_level: "high" | "medium" | "low"`
- `reasons: string[]`

---

## 2. Normalization Step (Per Row)

Before calling the matching engine, convert your raw DB/CSV structures into the normalized models. This layer is where you handle vendor‑specific column names and messy input formats.

### 2.1 Deposit normalization

For each raw deposit row:

- Map fields:
  - Map your vendor‑specific columns to the normalized names:
    - Telarus Order ID → `order_id_distributor`
    - Account ID – Vendor → `vendor_account` (and/or `order_id_vendor`)
    - Customer ID / Sales ID → `customer_id`
    - Account Legal Name / Customer Name → `customer_name`
    - Vendor Name → `vendor_name`
    - Distributor / Origin → `distributor`
    - Product Name / Service Description → `product_name`
    - Commission / Amount / Payment Amount → `amount`
    - Commission Percent / Rate → `commission_rate`
- Clean IDs:
  - Trim whitespace.
  - Collapse multiple spaces into a single space.
  - Treat `""`, `"N/A"`, `"null"` as `null`.
- Clean names:
  - Lowercase only for comparison (keep original if you need it for display).
  - Strip punctuation where appropriate.
  - Collapse whitespace.
- Clean money:
  - Remove `$`, `,`, and spaces.
  - Parse as float; treat invalid or empty as 0 or `null` per your needs.
- Clean rates:
  - If string ends with `%`, strip `%` and parse number.
  - Else, parse as float:
    - If value < 1.0, treat as decimal fraction (e.g., `0.155` → `15.5`%).
    - Else, treat as already in percentage units (e.g., `15.5` → `15.5`%).

Use the cleaned values to build `DepositLineItemNormalized`.

### 2.2 Revenue schedule normalization

Apply the same style of mapping/cleaning to schedules:

- Map your revenue schedule columns to:
  - `customer_id`, `customer_name`
  - `distributor_name`, `vendor_name`
  - `order_id_distributor`, `order_id_vendor`
  - `product_name`
  - `expected_commission`, `expected_commission_rate`
- Clean IDs, names, money, and rates using the same rules as for deposits.
- Build `RevenueScheduleNormalized` objects.

---

## 3. Matching Entry Point

Top‑level function to run matching across all deposit line items and all candidate revenue schedules.

```pseudo
function match_deposits(
    deposits: List[DepositLineItemNormalized],
    schedules: List[RevenueScheduleNormalized],
    strict: bool = false
) -> List[MatchSuggestion]:

    suggestions = []

    for each d in deposits:
        candidates = []

        for each s in schedules:
            field_scores, field_reasons = score_fields(d, s, strict)

            if field_scores is empty:
                continue

            hierarchy_result = score_hierarchy(field_scores)
            total_score = hierarchy_result.total_score

            if total_score <= 0:
                continue

            reasons = field_reasons + hierarchy_result.reasons
            candidates.append((s, total_score, reasons))

        suggestion = build_suggestion(d, candidates)
        suggestions.append(suggestion)

    return suggestions
```

`strict` controls how forgiving the matching is:

- `strict = false` → allow contains + fuzzy matches.
- `strict = true` → mostly exact / case‑insensitive matches.

---

## 4. Field‑Level Scoring (`score_fields`)

For each deposit–schedule pair, compute a list of per‑field scores. Each entry is:

- `FieldScore`:
  - `field_name: string`
  - `match_type: string`
  - `score: float`

### 4.1 Match type → numeric score

Use a common scoring table:

- `exact` → 1.00
- `exact_ci` (case‑insensitive, normalized equality) → 0.95
- `contains` → 0.85
- `fuzzy_high` → 0.75
- `fuzzy_medium` → 0.60
- `fuzzy_low` → 0.40
- `none` → 0.0

### 4.2 Field scoring pseudocode

```pseudo
function score_fields(
    d: DepositLineItemNormalized,
    s: RevenueScheduleNormalized,
    strict: bool
) -> (List[FieldScore], List[string] reasons):

    scores = []
    reasons = []

    // 1. Customer ID
    if d.customer_id and s.customer_id:
        mt, sc = match_id(d.customer_id, s.customer_id, strict)
        scores.add(FieldScore("customer_id", mt, sc))

    // 2. Order ID – Distributor
    if d.order_id_distributor and s.order_id_distributor:
        mt, sc = match_id(d.order_id_distributor, s.order_id_distributor, strict)
        scores.add(FieldScore("order_id_distributor", mt, sc))

    // 3. Vendor Account ↔ Order ID – Vendor
    if d.vendor_account and s.order_id_vendor:
        mt, sc = match_id(d.vendor_account, s.order_id_vendor, strict)
        scores.add(FieldScore("vendor_account", mt, sc))

    // 4. Customer Name
    if d.customer_name and s.customer_name:
        mt, sc = match_name(d.customer_name, s.customer_name, strict)
        scores.add(FieldScore("customer_name", mt, sc))

    // 5. Distributor
    if d.distributor and s.distributor_name:
        mt, sc = match_name_with_aliases(d.distributor, s.distributor_name, strict)
        scores.add(FieldScore("distributor_name", mt, sc))

    // 6. Vendor Name
    if d.vendor_name and s.vendor_name:
        mt, sc = match_name(d.vendor_name, s.vendor_name, strict)
        scores.add(FieldScore("vendor_name", mt, sc))

    // 7. Commission Rate (optional)
    if d.commission_rate and s.expected_commission_rate:
        mt, sc = match_rate(d.commission_rate, s.expected_commission_rate)
        scores.add(FieldScore("commission_rate", mt, sc))

    // 8. Product Name
    if d.product_name and s.product_name:
        mt, sc = match_product(d.product_name, s.product_name, strict)
        scores.add(FieldScore("product_name", mt, sc))

    // Convert non-zero scores to human-readable reasons
    for each fs in scores where fs.score > 0:
        reasons.add(human_readable_reason(fs))

    return scores, reasons
```

### 4.3 Helper match functions (summaries)

**`match_id(a, b, strict)`**

- Normalize: trim, lowercase both strings.
- If equal → `("exact", 1.0)`.
- Else if equal ignoring case → `("exact_ci", 0.95)`.
- Else if not strict and one contains the other → `("contains", 0.85)`.
- Else if not strict:
  - Compute similarity using something like `SequenceMatcher`.
  - If similarity > 0.8 → `("fuzzy_high", 0.75)`.
  - Else if > 0.6 → `("fuzzy_medium", 0.60)`.
  - Else if > 0.4 → `("fuzzy_low", 0.40)`.
- Else → `("none", 0.0)`.

**`match_name(a, b, strict)`**

- Normalize names:
  - Lowercase.
  - Remove punctuation.
  - Collapse whitespace.
- Apply the same logic as `match_id` on normalized names.

**`match_name_with_aliases(a, b, strict)`**

- Same as `match_name`, but before fuzzy matching:
  - Check if `(a, b)` is in a known alias set (e.g., equivalent labels such as `"telarus"` vs `"acc business"` for this POC).
  - If so, treat as `("alias_match", 1.0)` (same score as exact).

**`match_product(a, b, strict)`**

- Normalize:
  - Lowercase and trim.
  - Remove vendor prefixes (e.g., `"ACC Business-"`, `"Telarus-"`).
  - Remove generic words like `"data-"`, `"internet-"`, `"loop & port-"`.
  - Normalize common patterns (`"DS3"`, `"ADI"`, etc.) into canonical tokens.
- Then use `match_name` logic on the normalized strings.

**`match_rate(a, b)`**

- Normalize both rates to a `0–100` numeric scale:
  - If value is a string with `%`, remove `%` and parse.
  - Else parse as float.
  - If parsed value < 1.0, treat as decimal fraction (×100).
  - Else, treat as percentage.
- Compute `diff_pct = abs(a - b) / max(a, b)` (if max > 0; else treat as 0).
- Use thresholds:
  - `diff_pct <= 0.01` (1%) → `("exact", 1.0)`
  - `<= 0.05` (5%) → `("fuzzy_high", 0.75)`
  - `<= 0.10` (10%) → `("fuzzy_medium", 0.60)`
  - `<= 0.20` (20%) → `("fuzzy_low", 0.40)`
  - Else → `("none", 0.0)`

---

## 5. Hierarchy Scoring (`score_hierarchy`)

Rather than averaging all fields equally, group them into business‑meaningful levels and compute an average per level, plus bonuses.

### 5.1 Hierarchy levels

Use the same conceptual structure as the POC:

1. **Level 1 – Distributor**
   - Fields: `["distributor_name"]`
   - Required: `true`
2. **Level 2 – Vendor**
   - Fields: `["vendor_name"]`
   - Required: `true`
3. **Level 3 – IDs**
   - Fields: `["customer_id", "order_id_distributor", "order_id_vendor", "vendor_account"]`
   - Required: `true`
4. **Level 4 – Names**
   - Fields: `["customer_name", "product_name"]`
   - Required: `false`
5. **Level 5 – Commission Rate**
   - Fields: `["commission_rate"]`
   - Required: `false`

### 5.2 Hierarchy scoring pseudocode

```pseudo
function score_hierarchy(field_scores: List[FieldScore]) -> HierarchyResult:

    // level_scores[level] = { avg_score: float, required: bool }
    level_scores = {}
    hierarchy_reasons = []

    for level in [1..5]:
        level_fields = fields_for_level(level)
        fs_for_level = [fs.score for fs in field_scores
                        where fs.field_name in level_fields]

        if fs_for_level not empty:
            avg = average(fs_for_level)
        else:
            avg = 0.0

        level_scores[level] = {
            avg_score: avg,
            required: level_is_required(level)
        }

    // Base total score = average of all level avg_scores
    base_scores = [ls.avg_score for ls in level_scores.values]
    if base_scores is empty:
        base = 0.0
    else:
        base = average(base_scores)

    // Bonus: strong matches on required levels
    strong_required = count(
        level where level_scores[level].required
        and level_scores[level].avg_score >= 0.8
    )
    bonus = (0.05 if strong_required >= 2 else 0.0)

    // Bonus: sequential compliance across levels
    seq_bonus = 0.0
    for level in [1..5]:
        avg = level_scores[level].avg_score
        if avg >= 0.7:
            seq_bonus += 0.02
        else if avg >= 0.5:
            seq_bonus += 0.01

    // Cap sequential bonus at +10%
    bonus += min(seq_bonus, 0.10)

    total = min(1.0, base + bonus)

    // Hierarchy-level reasons for UI
    for level in [1..5]:
        avg = level_scores[level].avg_score
        name = level_name(level)
        required = level_scores[level].required

        if avg >= 0.8:
            hierarchy_reasons.add("Strong " + name + " match: " + avg)
        else if avg >= 0.5:
            hierarchy_reasons.add("Moderate " + name + " match: " + avg)
        else if required and avg < 0.3:
            hierarchy_reasons.add("Weak " + name + " match (required): " + avg)

    return {
        total_score: total,
        reasons: hierarchy_reasons,
        level_scores: level_scores
    }
```

---

## 6. Building Suggestions per Deposit Line (`build_suggestion`)

After computing scores for all schedule candidates for a deposit line, build a single `MatchSuggestion` record with the best match and a short list of alternates.

```pseudo
function build_suggestion(
    d: DepositLineItemNormalized,
    candidates: List[(s: RevenueScheduleNormalized, score: float, reasons: string[])]
) -> MatchSuggestion:

    if candidates is empty:
        return MatchSuggestion(
            deposit_id = d.id,
            schedule_id = null,
            score = 0.0,
            confidence_level = "low",
            reasons = ["No suitable match found"],
            alternates = []
        )

    // Sort best candidates first
    candidates.sort_by_score_desc()

    best_schedule, best_score, best_reasons = candidates[0]

    alternates = []
    for each (s, sc, rs) in candidates[1..4]:  // top 4 alternates
        alternates.add({
            schedule_id: s.id,
            score: sc,
            confidence_level: classify_confidence(sc),
            reasons: rs
        })

    return MatchSuggestion(
        deposit_id = d.id,
        schedule_id = best_schedule.id,
        score = best_score,
        confidence_level = classify_confidence(best_score),
        reasons = best_reasons,
        alternates = alternates
    )
```

### 6.1 Confidence level classification

```pseudo
function classify_confidence(score: float) -> string:
    if score >= 0.85:
        return "high"      // auto-approval candidate
    if score >= 0.70:
        return "high"
    if score >= 0.45:
        return "medium"
    if score >= 0.25:
        return "low"
    return "low"
```

You can adjust thresholds to be more or less conservative.

---

## 7. Optional: Auto‑Approval and Schedule Status

This layer sits on top of the matching engine and is specific to your application.

### 7.1 Auto‑approval rules

Given a list of `MatchSuggestion`s and access to the original `DepositLineItemNormalized` and `RevenueScheduleNormalized`:

- For any suggestion where:
  - `schedule_id` is not `null`, and
  - `confidence_level == "high"` (or `score >= some_threshold`),
- Mark the match as auto‑approved.

### 7.2 Schedule status computation

For an auto‑approved match:

- Let:
  - `paid = deposit.amount`
  - `expected = schedule.expected_commission`
- Compute:
  - If `expected > 0`: `ratio = paid / expected`
  - Else: treat as `ratio = 0` or handle separately.
- Update schedule status:
  - If `ratio >= 0.95`: `"Paired (Pending)"` (fully paid within 5%).
  - Else if `0 < ratio < 0.95`: `"Underpaid"`.
  - Else if `paid == 0` and `expected > 0`: `"Awaiting Payment"`.

You can store this back in your own database or expose it via your own API.

---

## 8. Implementation Notes for an Agent in Another Workspace

When you hand this spec to an agent in another codebase, you can ask it to:

1. **Create normalized models**:
   - Implement `DepositLineItemNormalized`, `RevenueScheduleNormalized`, `MatchSuggestion`, and helper types.
2. **Add adapters**:
   - Map from your DB entities / CSV rows into the normalized models using the normalization rules.
3. **Implement the matching engine**:
   - Functions: `match_deposits`, `score_fields`, `score_hierarchy`, helper match functions, and `build_suggestion`.
4. **Wire endpoints or batch jobs**:
   - E.g., `POST /matching/run` that:
     - Loads deposits and schedules from your DB.
     - Calls `match_deposits`.
     - Saves or returns the resulting `MatchSuggestion`s.
5. **Optional**:
   - Implement auto‑approval and schedule status updates on top of the match suggestions.

This keeps the matching logic **pure and reusable** while letting each application define its own persistence and API surface.

