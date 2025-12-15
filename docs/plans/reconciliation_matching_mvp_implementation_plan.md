# Deposit → Revenue Schedule Matching – MVP Implementation Plan

This document recommends a **fast, MVP‑oriented** approach for implementing deposit line item → revenue schedule matching in Commissable, using **real data** from the existing database.

It’s meant to be the concrete “how we build it first” plan, optimized for:

- Getting a working demo quickly.
- Minimizing risky refactors later.
- Staying aligned with the full reconciliation/matching spec.

---

## 1. Goals & Constraints

- **Primary goal (MVP):**
  - From the Deposits list, click into a Deposit and see:
    - Real **Deposit Line Items** from the database.
    - Real **Revenue Schedule** candidates for each line, with a **match confidence**.
    - Ability to **accept** a suggested match or choose a different RS.
  - Applying a match should **persist**:
    - The link between the deposit line and revenue schedule.
    - Updated allocations and statuses for the line and deposit.
    - (Optionally) updated actuals on the Revenue Schedule behind a feature flag.

- **Non‑goals for the very first cut (defer to later phases):**
  - Full 1:many and many:1 automation across arbitrary complex scenarios.
  - FLEX/chargeback workflows beyond basic stubs.
  - Learning loop and model‑like tuning of confidence weights.
  - PDF parsing or fully generic template editor.

The idea is: **ship a thin but correct path** for 1:1 and simple partial cases, with architecture that won’t block the richer behavior later.

---

## 2. Quick Assessment of the Existing Plan

The earlier plan you approved is **directionally correct**:

- Data model separation between deposits, line items, and revenue schedules.
- Two‑pass matching (exact IDs then fuzzy) with confidence scores.
- Using the existing two‑table UI as the main reconciliation workspace.

Where it is **more than you need for an MVP**:

- It tries to cover *all* scenarios (FLEX, CB, 1:many, many:1, learning loop) up front.
- It persists candidate matches + explanations immediately, which is powerful but adds schema and API surface area before we’ve even validated the scoring.

**Recommended change in strategy:**

- **Keep the same overall architecture**, but **narrow MVP scope** to:
  - Exact (and very simple fuzzy) matching only.
  - 1:1 match application (and simple partials where there’s a single obvious RS).
  - Compute candidate lists **on the fly** for now; persist only the **accepted** matches.

This lets you demo value quickly while keeping the core data model compatible with the full design.

---

## 3. Data Model – What to Build First

Even for a fast MVP, it’s worth getting the **schema roughly “right”** to avoid painful migrations later.

### 3.1 New tables

1. **`DepositLineItem`**
   - Foreign keys:
     - `tenantId`
     - `depositId` → `Deposit`
     - `primaryRevenueScheduleId` (nullable; convenience pointer to the “main” RS when there’s a single dominant match)
   - Core fields:
     - `paymentDate`
     - Raw vendor identifiers: `accountIdVendor`, `customerIdVendor`, `orderIdVendor`
     - Raw text: `accountNameRaw`, `productNameRaw`, `distributorNameRaw`, `vendorNameRaw`
     - Numeric: `usage`, `commission`
     - Allocations: `usageAllocated`, `usageUnallocated`, `commissionAllocated`, `commissionUnallocated`
     - Flags: `isChargeback`, `status` (`Unmatched`, `Suggested`, `Matched`, `PartiallyMatched`, etc.).

2. **`DepositLineMatch`** (join table – use it even if MVP is 1:1)
   - Foreign keys:
     - `tenantId`
     - `depositLineItemId` → `DepositLineItem`
     - `revenueScheduleId` → `RevenueSchedule`
   - Matching metadata:
     - `usageAmount`, `commissionAmount` (how much of the line this match allocates).
     - `confidenceScore` (0–1).
     - `status` (`Suggested`, `Applied`, `Rejected`).
     - `source` (`Auto`, `Manual`).
     - `explanation` (JSON; per‑signal scores – can be null initially).

> **Why this is still “MVP‑friendly”**
>
> You can start by creating **at most one `DepositLineMatch` row per line**, effectively 1:1. The join table simply keeps options open for 1:many/many:1 later without schema churn.

### 3.2 Changes to existing entities (minimal)

- **`Deposit`**
  - Already has totals and allocation fields; for MVP, ensure we keep:
    - `totalItems`, `totalReconciledItems`
    - `usageAllocated`, `usageUnallocated`
    - `commissionAllocated`, `commissionUnallocated`
  - Add a simple status convention for MVP:
    - `Pending` — no lines matched yet.
    - `InReview` — some lines matched, some not.
    - `Completed` — all lines are either matched or explicitly ignored.

- **`RevenueSchedule`**
  - Use existing fields:
    - `expectedUsage`, `actualUsage`
    - `expectedCommission`, `actualCommission`
  - For MVP, **optional** to update actuals immediately; see §5.3 for a safe rollout path.

---

## 4. Implementation Phases (Optimized for Speed)

### Phase 1 – Schema + bootstrap data (1–2 days)

**Scope**

- Add `DepositLineItem` and `DepositLineMatch` models + migrations.
- Seed a **small set of DepositLineItem rows** for one or two real deposits:
  - Either via a quick script that reads a known CSV and inserts rows.
  - Or via a simple `/api/reconciliation/deposits/[depositId]/seed` dev‑only endpoint.

**Deliberately skipped**

- Full deposit upload/intake flow; we just need *some* real lines to match in MVP.

### Phase 2 – Minimal matching engine (exact + simple heuristics) (2–3 days)

**Goal:** For each `DepositLineItem`, compute a ranked list of `RevenueSchedule` candidates and a confidence score.

**2.1 Matching service (Node/TypeScript module)**

- Create `lib/matching/deposit-matcher.ts` with core function:
  - `matchDepositLines(depositId: string, options?: { autoApply: boolean })`

**2.2 Candidate retrieval rules (MVP)**

1. **Filter gate** (cheap, mostly indexed):
   - `tenantId` matches.
   - Distributor/vendor IDs or account IDs align between line and RS (using opportunity/product vendor/distributor IDs).
   - `scheduleDate` within a configurable window around the line’s `paymentDate` (e.g. same month ± 1 month).

2. **Exact/strong matches (Pass A)**
   - If `customerIdVendor` matches an RS’s vendor/customer ID and:
   - `orderIdVendor` (or distributor order ID) matches, and:
   - `productNameVendor` (or SKU) matches exactly, and:
   - Amounts within a tight variance (e.g. ±2–5% on commission),
   - then give a **high base confidence**, e.g. `0.98`.

3. **Fallback (Pass B – very light fuzzy)**
   - If Pass A fails or yields multiple candidates with similar strength:
     - Fuzzy compare account names (`accountNameRaw` vs RS account name).
     - Fuzzy compare product names (vendor name vs RS product name/description).
     - Use a **looser** amount variance (e.g. ±15%).

> For MVP, string similarity can be a simple normalized Levenshtein or Jaro‑Winkler implementation; we don’t need ML here.

**2.3 Scoring & thresholds (MVP)**

- Score = weighted sum of:
  - ID/SKU matches (heavy weight).
  - Fuzzy name matches.
  - Amount & date penalties/bonuses.
- Thresholds:
  - `≥ 0.97` → Auto‑match (if there is a **single** candidate above this).
  - `0.90–0.97` → Suggested; require user approval.
  - `< 0.90` → No suggestion, line stays `Unmatched`.

**2.4 Persistence strategy for MVP**

- **Persist only `Applied` matches**:
  - When the engine runs in `autoApply` mode:
    - Insert one `DepositLineMatch` with status `Applied` for clear auto matches.
  - Store `confidenceScore` on those rows.
- **Do not persist all candidates yet**:
  - For suggestions, compute candidates **on the fly** when the UI asks for them, to keep schema and data volume small.
  - Later, if needed, add a `DepositLineCandidate` table for auditing and training data.

---

### Phase 3 – APIs for deposit detail (2–3 days)

Expose a single cohesive API for the detail screen rather than many small ones.

1. **`GET /api/reconciliation/deposits/[depositId]/detail`**
   - Returns:
     - Deposit metadata (mapped to the shape already used by `DepositReconciliationDetailView`).
     - All `DepositLineItem` rows for that deposit, including:
       - Allocations and line‑level `status`.
   - Optionally triggers matching **if no matches have been run yet** for this deposit (idempotent “lazy match”).

2. **`GET /api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates`**
   - Runs the matching engine **in read‑only mode** for that line and returns:
     - Top N (e.g. 3–5) `RevenueSchedule` candidates with:
       - `matchConfidence`
       - expected vs actual usage/commission, balances.
   - This payload maps directly to the “Suggested Matches – Revenue Schedules” table shape.

3. **`POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match`**
   - Body: `{ revenueScheduleId, usageAmount?, commissionAmount? }`.
   - Behavior:
     - Create/update a `DepositLineMatch` with status `Applied`.
     - Update `DepositLineItem` allocations and `status`.
     - Optionally (behind a feature flag), update RS actuals.
     - Update deposit header aggregates and status (`Pending` → `InReview` → `Completed`).

4. **`POST /api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch`**
   - Reverses a match for MVP by:
     - Deleting or marking the `DepositLineMatch` as `Rejected`.
     - Resetting allocations on the line.
     - Optionally rolling back RS actuals if you enabled that behavior.

---

### Phase 4 – Wire the existing UI (1–2 days)

You already have a polished UI (`DepositReconciliationDetailView`) using mock data. The MVP work here is **purely wiring**:

1. **Replace mocks in the deposit detail page**
   - In `app/(dashboard)/reconciliation/[depositId]/page.tsx`:
     - Fetch from `/api/reconciliation/deposits/[depositId]/detail`.
     - Pass real `metadata` and `lineItems` into `DepositReconciliationDetailView`.
     - For the bottom table, either:
       - Fetch candidates once per deposit and cache them, or
       - Lazy‑load candidates for the currently selected line and show them in the table.

2. **Connect actions**
   - “Match” (per‑row or bulk) → `apply-match` endpoint.
   - “Mark Unmatched” → `unmatch` endpoint.
   - Status chips simply reflect the `DepositLineItem.status` and `DepositLineMatch.status`.

3. **Demo‑ready behavior**
   - On page load for a deposit:
     - You see real deposit header info.
     - Top table shows actual lines from DB.
     - Bottom table shows suggestions for a selected line (or all lines in a simple initial mode).
   - Clicking “Match” persists and visually updates both tables.

---

## 5. Safety & Evolution Beyond MVP

### 5.1 FLEX and chargebacks (post‑MVP)

- Introduce FLEX and CB logic once the basic engine is proven:
  - Overpayments: allocate up to expected amounts, then create a new RS with `-F` suffix for overage.
  - Chargebacks: for negative lines, create `-CB` RS instead of altering original RS.
- These can be implemented as **special cases** in the `apply-match` handler using the same `DepositLineMatch` table.

### 5.2 Learning loop (post‑MVP)

- After the team has used the tool on real data for a while:
  - Start logging **corrections** (where the user picked a different RS than the top suggestion).
  - Use this feedback to:
    - Grow alias tables (account names, product names).
    - Tune field weights in a config document per tenant/template.
  - Wire that config into the matching engine’s scoring function.

### 5.3 Protecting production revenue data

To reduce risk while testing:

- Use a **feature flag** (env var or tenant setting) for:
  - “Update RevenueSchedule actualUsage/actualCommission from deposit matches.”
- MVP rollout suggestion:
  1. Initially: only persist `DepositLineItem` and `DepositLineMatch`, leave RS actuals untouched.
  2. Validate a set of deposits end‑to‑end with finance.
  3. Flip the flag for a sandbox tenant to let matches drive RS actuals.
  4. Once confidence is high, enable for production tenants.

---

## 6. Summary – Why This Is the Best MVP Approach

- **Fast to demo:** Reuses the existing UI and deposit header list; the only net‑new surface is two tables + a small matching module and a couple of APIs.
- **Architecturally sound:** Introduces `DepositLineItem` and `DepositLineMatch` in a way that naturally extends to 1:many, FLEX, chargebacks, and learning without schema redesign.
- **Incremental:** You can stop after Phases 1–4 and still have a meaningful, testable system; everything else is additive.
- **Safe:** Feature flags and separated match tables allow you to validate matching behavior without risking corruption of core revenue schedule data.

If you like this plan, the very next step would be to:

1. Seed a small real dataset into `DepositLineItem`.
2. Implement the minimal matching function + `/detail` API so your current UI can immediately start showing real matches.

---

## 7. Alignment with SIMPLE_MATCHING_ENGINE_SPEC

The **SIMPLE_MATCHING_ENGINE_SPEC.md** describes a lightweight, framework-agnostic matching core. That spec is compatible with this MVP and adds useful detail about the *inside* of the engine. This section captures how we will align this plan with that spec so implementation is straightforward.

### 7.1 Normalized Matching DTOs

- Introduce a small **normalized layer** inside the engine:
  - `DepositLineItemNormalized` with canonical fields (distributor, vendor name, vendor account / customer IDs, distributor/vendor order IDs, customer/account name, product name, commission rate, commission/amount).
  - `RevenueScheduleNormalized` with distributor/vendor names, customer IDs/names, distributor/vendor order IDs, product name, expected commission and expected commission rate.
- These DTOs are built from `DepositLineItem`, `Deposit`, `RevenueSchedule`, and related `Account` / `Product` / `Opportunity` fields *before* scoring.
- Keep this layer pure (no Prisma types, no HTTP) so it can be reused in batch jobs or external tools.

### 7.2 Consistent Normalization Rules

- Apply the spec’s concrete normalization rules for both deposits and schedules:
  - IDs: trim, collapse spaces, treat `""`, `"N/A"`, `"null"` (case-insensitive) as `null`.
  - Names: normalize case, strip punctuation where appropriate, collapse whitespace, strip common legal suffixes (INC, LLC, CORP, CO, etc.).
  - Money: remove `$`, `,`, spaces; parse as decimal; document how invalid/empty values are handled (0 vs `null`).
  - Rates: if input ends with `%`, strip and parse; otherwise parse as float and interpret `< 1.0` as a fraction (0.155 → 15.5%) and `>= 1.0` as percent units (15.5 → 15.5%).
- Use shared helpers so the same rules are applied everywhere (engine, tests, any batch jobs).

### 7.3 Engine Output: Primary Match, Alternates, and Reasons

- Adopt a canonical engine output similar to the spec’s `MatchSuggestion`:
  - For each deposit line: the best `RevenueSchedule` match (or `null`), a numeric `score`/`matchConfidence`, a discrete `confidenceLevel` (`high` / `medium` / `low`), a `reasons: string[]` list, and a small list of alternates (each with its own score and reasons).
- Map this into the existing UI:
  - Primary match → top candidate row for that line.
  - Alternates → remaining candidate rows ordered by `matchConfidence`.
  - `reasons` and `confidenceLevel` are optional for the first visual cut but should be available for future tooltips/explanations and audit.

### 7.4 Scoring Model and Confidence Thresholds

- The SIMPLE spec uses a **hierarchical level** scoring model (Distributor, Vendor, IDs, Names, Rate) with level averages and bonuses; this MVP plan currently uses a **signal + weight** model (IDs, names, amounts, dates).
- For MVP:
  - Implement the simpler signal+weight model first, but structure configuration so signals can later be grouped into levels and extended with bonuses without changing external APIs.
  - Implement a single `classifyConfidence(score)` function in the engine that maps scores to `high` / `medium` / `low` using agreed thresholds, instead of duplicating threshold logic in UI or endpoints.
- Keep auto-match behavior and thresholds in configuration (per template/tenant where needed), and gate auto-apply behind feature flags as described earlier.

### 7.5 What This Changes

- Does **not** change:
  - The tables (`DepositLineItem`, `DepositLineMatch`, `RevenueSchedule`), endpoints, or UI layout described in this MVP.
- Does make explicit that:
  - We will use a normalized DTO layer and consistent normalization rules.
  - The engine’s primary output is a `MatchSuggestion` object (primary + alternates + reasons + confidenceLevel), from which the candidates table is derived.
  - Confidence thresholds and auto-match rules live in the engine/config layer, not scattered across the UI.

These clarifications are reflected in more detail in `reconciliation_matching_engine_implementation_steps.md` and should keep the eventual implementation aligned with the standalone SIMPLE matching spec.

---

## 8. Implementation Progress (Live)

**Completed**

- Added `DepositLineItem` and `DepositLineMatch` models to `prisma/schema.prisma` with relations from `Tenant`, `Account`, `Product`, `Deposit`, and `RevenueSchedule`.
- Added enums `DepositLineItemStatus`, `DepositLineMatchStatus`, and `DepositLineMatchSource` to capture line/match state and provenance.
- Ran `npx prisma migrate dev --name add_deposit_line_models`, creating and applying migration `20251202110335_add_deposit_line_models` and updating the PostgreSQL schema.
- Triggered Prisma Client generation after the migration (developers may still need to run `npx prisma generate` locally if their environment blocked the DLL rename once).
- Added `scripts/seed-deposit-line-items.ts` plus npm script `npm run seed:deposit-lines`, and executed it to populate sample deposit line items + a `DepositLineMatch` for the latest deposit so the Reconciliation detail view has real data to consume.
- Implemented `GET /api/reconciliation/deposits/[depositId]/detail` backed by the new models to return deposit metadata and live `DepositLineItem` rows for the selected deposit.
- Updated `app/(dashboard)/reconciliation/[depositId]/page.tsx` to call the detail API and live candidates API so both tables in `DepositReconciliationDetailView` render real data instead of mocks.
- Implemented a signal-and-weight matching engine in `lib/matching/deposit-matcher.ts` (IDs, names, amounts, dates with confidence levels) plus the `/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates` endpoint that returns ranked live `RevenueSchedule` suggestions with reasons for each line item.
- Added shared recomputation of deposit aggregates/status after apply/unmatch via `lib/matching/deposit-aggregates.ts`, keeping deposit headers in sync as matches change.

**In progress / upcoming**

- Add feature flags around auto-apply and optional updates to `RevenueSchedule` actuals, plus lightweight logging for manual overrides (post-MVP hardening).