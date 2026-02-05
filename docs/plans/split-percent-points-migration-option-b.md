# Option B Plan: Store Commission Split % Fields as Percent Points (0–100)

## Summary

Goal: **standardize financial split % fields** (House Split %, House Rep %, Subagent %) so they are **stored in the database as percentage points** (e.g., `50.00` means 50%) and only converted to fractions **at calculation/formatting time** (`fraction = points / 100`).

This aligns with the product/commission specs that describe formulas using **÷ 100** and “splits must total 100%”.

## Current State (as of 2026-02-05)

### Database units are inconsistent with the spec

- `Opportunity.houseSplitPercent`, `Opportunity.houseRepPercent`, `Opportunity.subagentPercent` are stored as **fractions (0–1)**.
  - Prisma: `@db.Decimal(5, 4)` in `prisma/schema.prisma` (e.g., `0.5000`).
- `RevenueSchedule.houseSplitPercentOverride`, `RevenueSchedule.houseRepSplitPercentOverride`, `RevenueSchedule.subagentSplitPercentOverride` are stored as **fractions (0–1)**.
  - Prisma: `@db.Decimal(5, 4)` in `prisma/schema.prisma`.

### API accepts points but persists fractions (via conversion)

Example: bulk update split endpoint validates `0..100` and then persists `value / 100` (fraction):
- `app/api/revenue-schedules/bulk/update-split/route.ts`:
  - parses `0..100`
  - stores `houseFraction = resolvedHouse / 100` into `houseSplitPercentOverride`

Other endpoints have similar behavior (accept both points and fractions via heuristics).

### UI/display often assumes “percent formatter input is a fraction”

Many parts of the app format percents with `Intl.NumberFormat(...{ style: "percent" })`, which expects a **fraction**. Today this works because DB stores fractions.

## Target State

### Storage (DB)

Store split fields as **percent points**:

- `Opportunity.houseSplitPercent`: `0..100` (points)
- `Opportunity.houseRepPercent`: `0..100` (points)
- `Opportunity.subagentPercent`: `0..100` (points)
- `RevenueSchedule.*SplitPercentOverride`: `0..100` (points)

Recommended DB precision: `Decimal(5,2)` for these fields (e.g., `33.33`).

### API contract

- All “Split %” inputs/outputs use **points** (`50.00` means 50%).
- API validations enforce:
  - each split `>= 0` and `<= 100`
  - totals must equal `100` (within tolerance)

### Calculations + percent-formatting

- Any time we multiply money by a split rate:
  - `fraction = points / 100`
- Any time we format split percent with `Intl(... style:"percent")`:
  - pass `points / 100`

## Migration Strategy (safe rollout)

Implement as a **staged rollout** to avoid breaking existing data or clients.

### Phase 0 — Inventory and unit audit (no behavior change)

1. Inventory all read/write paths for:
   - opportunity create/update split fields
   - revenue schedule split override create/update (single + bulk)
   - any derived split math used in revenue schedule detail/list helpers
2. Run a one-time audit query in each environment to confirm storage units:
   - Expect most non-null values to be `<= 1.0` today (fractions).
   - Flag anomalies where any split is `> 1.0` (already points or corrupt).

Suggested audit SQL:

```sql
-- Opportunity splits: flag rows that look like points already
select id, "houseSplitPercent", "houseRepPercent", "subagentPercent"
from "Opportunity"
where
  ("houseSplitPercent" is not null and "houseSplitPercent" > 1) or
  ("houseRepPercent" is not null and "houseRepPercent" > 1) or
  ("subagentPercent" is not null and "subagentPercent" > 1);

-- RevenueSchedule overrides: flag rows that look like points already
select id, "houseSplitPercentOverride", "houseRepSplitPercentOverride", "subagentSplitPercentOverride"
from "RevenueSchedule"
where
  ("houseSplitPercentOverride" is not null and "houseSplitPercentOverride" > 1) or
  ("houseRepSplitPercentOverride" is not null and "houseRepSplitPercentOverride" > 1) or
  ("subagentSplitPercentOverride" is not null and "subagentSplitPercentOverride" > 1);
```

If anomalies exist, decide case-by-case whether those rows should be converted, left alone, or manually corrected.

### Phase 1 — Add explicit conversion helpers + dual-read/dual-write compatibility

Add canonical helpers (location suggestion: `lib/number-format.ts` or a new `lib/percent-units.ts`):

- `splitPointsToFraction(points: number | null): number | null` (`points / 100`)
- `splitFractionToPoints(fraction: number | null): number | null` (`fraction * 100`)
- `coerceSplitPoints(input: unknown): number | null`
  - During compatibility phase only: accept both `0..1` and `0..100` and normalize to **points**.
  - Suggested rule:
    - if `abs(input) <= 1` treat as fraction → `points = input * 100`
    - else treat as points → `points = input`

Then update API endpoints to:
- **store points** (new target) *after Phase 2 backfill is complete* OR
- **still store fractions** temporarily but return points in responses (dual-mode) to avoid breaking UIs.

Recommendation: keep this phase minimal and behind a feature flag, because it can be confusing to keep two modes running.

### Phase 2 — DB migration + data backfill (convert stored fractions → points)

#### 2.1 Prisma schema change

Update Prisma field types from `Decimal(5,4)` to `Decimal(5,2)`:
- `Opportunity.houseSplitPercent`, `Opportunity.houseRepPercent`, `Opportunity.subagentPercent`
- `RevenueSchedule.houseSplitPercentOverride`, `RevenueSchedule.houseRepSplitPercentOverride`, `RevenueSchedule.subagentSplitPercentOverride`

Generate a Prisma migration.

#### 2.2 Backfill data (idempotent conversion)

We want to multiply by 100 **only when a value looks like a fraction**.
Because splits are constrained to `0..100` points and normally sum to `100`, using `<= 1` as the “fraction detector” is safe.

Suggested backfill SQL (run once per environment):

```sql
-- Convert Opportunity splits to points
update "Opportunity"
set
  "houseSplitPercent" = case
    when "houseSplitPercent" is null then null
    when "houseSplitPercent" <= 1 then "houseSplitPercent" * 100
    else "houseSplitPercent"
  end,
  "houseRepPercent" = case
    when "houseRepPercent" is null then null
    when "houseRepPercent" <= 1 then "houseRepPercent" * 100
    else "houseRepPercent"
  end,
  "subagentPercent" = case
    when "subagentPercent" is null then null
    when "subagentPercent" <= 1 then "subagentPercent" * 100
    else "subagentPercent"
  end;

-- Convert RevenueSchedule overrides to points
update "RevenueSchedule"
set
  "houseSplitPercentOverride" = case
    when "houseSplitPercentOverride" is null then null
    when "houseSplitPercentOverride" <= 1 then "houseSplitPercentOverride" * 100
    else "houseSplitPercentOverride"
  end,
  "houseRepSplitPercentOverride" = case
    when "houseRepSplitPercentOverride" is null then null
    when "houseRepSplitPercentOverride" <= 1 then "houseRepSplitPercentOverride" * 100
    else "houseRepSplitPercentOverride"
  end,
  "subagentSplitPercentOverride" = case
    when "subagentSplitPercentOverride" is null then null
    when "subagentSplitPercentOverride" <= 1 then "subagentSplitPercentOverride" * 100
    else "subagentSplitPercentOverride"
  end;
```

Post-backfill validation:
- Sample a set of opportunities and confirm splits sum to ~100.
- Sample a set of schedule overrides and confirm values look like typical percentages (e.g., 20, 30, 50).

### Phase 3 — Code sweep: treat splits as points everywhere (remove heuristics)

After DB values are points, remove “0–1 vs 0–100” heuristics for split fields.

#### 3.1 API updates (required)

Update opportunity endpoints to store and return points:
- `app/api/opportunities/route.ts`
  - Replace `parsePercentValue()` (currently normalizes to fraction) with a **points** parser.
- `app/api/opportunities/[opportunityId]/route.ts`
  - Ensure PATCH updates and validations treat split fields as points.

Update revenue schedule endpoints to store and return points:
- `app/api/revenue-schedules/[revenueScheduleId]/route.ts`
  - Stop dividing user inputs by 100 before persisting overrides.
- `app/api/revenue-schedules/bulk/update-split/route.ts`
  - Stop converting `resolvedHouse / 100` and store `resolvedHouse` directly.
  - Update audit payloads accordingly (store points, not fractions).

Update mapping/helpers that currently treat stored values as fractions:
- `app/api/revenue-schedules/helpers.ts`
  - `getEffectiveSplitFractions()` currently returns raw stored values (fractions).
  - After migration it should either:
    - return points (rename to `getEffectiveSplitPoints`) and convert later, OR
    - return fractions by converting `points / 100` internally.

#### 3.2 UI updates (required)

Update any UI code that **pre-divides by 100** before sending to the API:
- `components/account-opportunity-create-modal.tsx` (currently sends `parseFloat(x) / 100`)
- Any other create/edit forms that convert split inputs to fractions before submit.

Update any UI formatting helpers that currently rely on “if value <= 1 assume fraction” for split fields:
- For split fields specifically, formatting should always be `percentFormatter.format(points / 100)`.

#### 3.3 Math correctness checks (required)

Anywhere we compute commission allocations using splits, ensure we divide by 100 exactly once:
- `commissionNetHouse = actualCommission * (houseSplitPoints / 100)`
- Same for rep/subagent.

This is the main regression risk (double-dividing or not dividing).

### Phase 4 — Remove compatibility and enforce constraints

Once all environments are migrated and stable:

1. Remove dual-read/heuristic parsers for split fields.
2. Tighten validation:
   - reject `0..1` inputs as “fraction units not allowed” (optional, but helps prevent reintroduction).
3. Optionally add DB-level checks (if desired) to enforce:
   - each split between `0..100`
   - sum to `100` (harder at DB layer; often kept in app logic).

## Testing Plan

Add/extend tests to catch unit bugs:

1. Unit tests for new conversion helpers:
   - points → fraction → points roundtrip
2. Integration tests for:
   - opportunity create/update storing points
   - bulk split update persisting points and rendering correctly
3. Snapshot-style tests for revenue schedule detail/list mapping:
   - ensure displayed `%` strings are correct for common split values (20/30/50).

## Rollout Checklist

Per environment (dev → staging → prod):

1. Deploy Phase 1 code (if using feature flag).
2. Apply DB migration + backfill SQL.
3. Deploy Phase 3 code sweep (points-only).
4. Monitor:
   - split totals validation errors
   - schedules showing strange split values (e.g., >1000% symptoms)
5. Remove compatibility code (Phase 4).

## Rollback Plan (if needed)

If a rollback is required after Phase 2 backfill:

- **Code rollback** is straightforward.
- **Data rollback** requires dividing by 100 for rows that are points; this is not perfectly reversible if values changed after migration.
- Prefer to avoid rollback by validating in staging and taking a DB snapshot before production backfill.

