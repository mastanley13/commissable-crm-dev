# Reconciliation Matching Status Summary

Date: 2025-12-04  
Source docs: `12-4-25-Reconciliation-Matching-plan.md`, `12-4-25-minimum-checklist.md`, `12-4-25-Finalize-Reconcile-Deposit-specs.md`, `12-4-25-Finalize-Reconcile-Implementation-Status.md`, `Primary-Matching-Hierarchy.md`

---

## Legend

- **Done** – implemented in code and wired to UI/API for the Reconciliation detail page
- **Partial** – core behavior exists but is incomplete, missing UI, or not fully tuned
- **Next** – not implemented yet; only defined in specs/markdown

---

## Feature Matrix (Current Status vs Plan Phases)

| Area | Feature | Plan Phase(s) / Section(s) | Status | Notes |
|------|---------|----------------------------|--------|-------|
| **Candidate Retrieval** | Tenant / Distributor / Vendor hard filters | Phase 2 – Candidate Retrieval; Hierarchy items 1–2 | **Done** | `fetchCandidateSchedules` always filters by `tenantId`, `distributorAccountId`, `vendorAccountId`; cross‑vendor fallback is off by default and only enabled via explicit flag. |
| | Date window (past‑only + future toggle) | Phase 2; Primary Hierarchy "Date Filtering" | **Done** | Default window is past‑only up to end of reference month; `includeFutureSchedules` is controlled by a per‑tenant setting via Reconciliation Settings and can be overridden per‑request from the detail page. |
| | Status filter + positive commission diff | Phase 2; Primary Hierarchy "Status Filtering" | **Done** | Only `Unreconciled`/`Underpaid`/`Overpaid` schedules with positive `commissionDifference` are considered; `Reconciled` schedules are excluded from the candidate universe. |
| | FIFO tie‑break (date + createdAt) | Phase 2; Hierarchy item 8 | **Done** | `sortCandidatesWithFIFO` sorts by confidence, then `scheduleDate`, then `createdAt`, enforcing FIFO for ties. |
| **Pass A / Exact Matching** | Strong IDs + Account Legal Name exact pass | Phase 3 – Pass A; Hierarchy items 3–4 | **Done** | `buildPassACandidate` requires at least one of: legal name, order ID, customer ID, account ID, or Location/PO exact match (plus distributor/vendor filters) and enforces variance tolerance on amount/date. |
| | Location ID / Customer PO as strong IDs | Hierarchy item 5; Phase 1 fields | **Partial** | `locationId` and `customerPurchaseOrder` exist on `DepositLineItem` and are used as a strong ID in Pass A and conflict checks in Pass B; full population via import/ETL and tuning are still pending. |
| | Per‑tenant variance tolerance (Pass A) | Phase 0/3; Checklist 3.1 | **Done** | Variance tolerance is stored in `SystemSetting` (`reconciliation.varianceTolerance`), applied in Pass A and auto‑match, and editable via the Reconciliation Settings UI. |
| **Pass B / Fuzzy Matching** | Reweighted fuzzy scoring (40/30/20/10) | Phase 4 – Pass B; Primary Hierarchy Pass B | **Done** | Pass B scoring uses 40% account name, 30% product identity (names, part numbers, descriptions), 20% amount proximity, 10% date proximity; feeds the "Match Confidence" column. |
| | Combined Pass A + Pass B candidate list | Phase 3–4; Quick Start Day 3 | **Done** | Hierarchical flow always runs Pass B, combines exact and fuzzy candidates (score ≥ 0.5), removes duplicates, and sorts with FIFO; Pass A rows float to the top. |
| | Strong‑ID conflicts in Pass B | Phase 4; Hierarchy item 4 | **Done** | Candidates with conflicting strong IDs (Order/Customer/Account/Location/PO) are dropped from Pass B so only consistent data appears as suggestions. |
| **Additional Fields** | Product Description in product identity | Hierarchy item 7 | **Partial** | Product descriptions (vendor/distributor/base) are included in product identity similarity via a "best‑of" match; impact on ranking still needs validation on real data. |
| | Location ID / Customer PO on ETL | Phase 1 – Data model & field readiness | **Next** | Fields exist and the engine uses them when present, but the import/mapping pipeline for real deposits and schedules still needs to be wired and verified. |
| **AI / Auto‑Match & Variance** | Per‑tenant variance setting | Checklist 3.1; Phase 0/3 | **Done** | Variance is stored in `SystemSetting`, used in `/candidates`, `/auto-match`, and RevenueSchedule recomputation, and surfaced in the Reconciliation Settings modal. |
| | Run AI Matching endpoint (auto‑match Pass A) | Checklist 3.2–3.3; Phase 5/6 | **Done** | `/api/reconciliation/deposits/[depositId]/auto-match` applies Pass A exact matches within variance for unmatched lines; Pass B is suggest‑only. |
| | Run AI Matching preview modal | Checklist 3.3; Quick Start Day 4 | **Done** | "Run AI Matching" button opens a preview modal (backed by `/auto-match/preview`) that lists eligible Pass A matches; the user must confirm before auto‑match executes. |
| | Store match origin + confidence | Checklist 3.2 | **Done** | `DepositLineMatch.source` and `confidenceScore` are persisted for all matches, and the Reconciliation UI shows origin badges (Auto/Manual) alongside Exact/Fuzzy and confidence level. |
| | Auto‑match thresholds & FLEX routing | Checklist 3.1; FLEX specs | **Next** | Only Pass A exact 1.0 matches within variance are auto‑applied; medium‑band thresholds, FLEX routing, and overage handling are not implemented. |
| **Reconciliation Workflow** | Line‑level Match / Unmatch | Phase 2.4; Checklist 2.4.1 | **Done** | Per‑line apply‑match and unmatch APIs update `DepositLineItemStatus`, allocations, and deposit aggregates; RevenueSchedule actuals/statuses are recomputed for manual Apply/Unmatch and again on Finalize (auto‑match relies on Finalize for schedule recompute). |
| | RevenueSchedule status engine (actuals + variance) | Specs §1.1–1.3; Implementation Status §1 | **Done** | `recomputeRevenueScheduleFromMatches`/`recomputeRevenueSchedules` write `actualUsage`/`actualCommission`, compute variance, and move schedules between `Unreconciled`/`Underpaid`/`Overpaid`/`Reconciled`. |
| | Finalize Deposit | Phase 2.4.2; Checklist Test 4 | **Partial** | `Finalize` endpoint sets `Deposit.status = Completed`, marks lines/matches as reconciled, and recomputes RevenueSchedule actuals/statuses when no lines remain Unmatched/Suggested; audit logging records a `finalize` event but richer before/after detail and advanced undo remain future work. |
| | Reopen Deposit (Unreconcile) | Phase 2.4.2; Checklist Test 4 | **Partial** | `Unfinalize` sets `Deposit.status = InReview`, clears `reconciled`/`reconciledAt`, and logs an `unfinalize` event; schedule statuses and matches remain in place (no bulk unmatch or schedule‑level rollback yet). |
| | Status dropdowns & table filtering | Phase 2.3; Checklist 2.3 | **Partial** | Deposit line filters (Matched/Unreconciled/Partially Matched/All) and schedule filters (Suggested/Reconciled/Un‑Reconciled/All) work, but schedules do not have a distinct "Matched" phase separate from "Reconciled". |
| **Advanced Scenarios** | FLEX schedules (overages / unknown products) | Checklist 4.1; later phases | **Next** | FLEX schedule creation (`RS‑…‑F`), unknown‑product flows, and FLEX review UI are still specs‑only. |
| | Partial payments (many:1) & FIFO allocation | Checklist 4.2 | **Next** | `DepositLineMatch` can hold custom allocations, but RevenueSchedule running balances and full many:1 behavior are not yet implemented. |
| | Prepayments (1:many splits) | Checklist 4.3 | **Next** | No support yet for splitting a single deposit line across multiple future schedules. |
| | Chargebacks & reversals (‑CB / ‑CB‑REV) | Checklist 4.4 | **Next** | Negative deposit lines do not create dedicated chargeback schedules or reversals; current behavior is neutral. |
| **Observability & Tuning** | Debug logs for matching decisions | Phase 6 – Observability | **Partial** | Dev‑only logging summarizes candidate confidences, types, and core reasons; there are no structured metrics or dashboards yet. |
| | Matching metrics & correction tracking | Phase 6 – Metrics | **Partial** | `logMatchingMetric` writes audit events for manual/auto matches and finalize/unfinalize; aggregated dashboards and correction‑rate metrics are still missing. |

---

## High‑Level Assessment

- **Engine / Hierarchy (Pass A/B, filters, FIFO):** **Done/MVP** – hierarchy is respected, with strong IDs and legal name prioritized, product/amount/date weighted correctly, and date/status/commission filtering in place.
- **AI Matching & Variance:** **Partially Done** – per‑tenant variance, Pass A exact‑match auto‑apply, and the Run AI Matching preview are implemented; Pass B remains suggest‑only; FLEX/overage and richer variance/threshold policies are next.
- **Reconciliation Workflow:** **Partially Done** – line‑level matching/unmatching, deposit‑level Finalize/Reopen, and RevenueSchedule actuals/status transitions are in place; advanced scenarios (FLEX, partials, prepay, chargebacks) and richer undo/audit UX are still ahead.
- **Testing Readiness (Rob’s "Done" tests):** Tests 1, 3, and 4 are now largely supported end‑to‑end with the status engine and finalize/unfinalize flows; Test 2 remains partial (no distinct "Matched" phase for schedules), Test 5 is partial (no FLEX/overage routing), and Test 6 (FLEX) is still deferred.

Use this matrix as the primary snapshot for stakeholder conversations; defer to the underlying plan and checklist markdowns for deeper implementation details and future‑phase scope. 

---

## Roadmap (Next Steps Checklist)

### Phase 1 – Harden Current MVP

- [ ] **Populate Location ID / Customer PO on real data** — Status: Partial. Backfill + coverage script exists (`scripts/reconciliation-location-po-coverage.ts`); vendor‑file ETL needs to be wired and validated.
  - [ ] Wire import/mapping so `DepositLineItem.locationId` and `customerPurchaseOrder` are filled from vendor files.
  - [ ] Add a simple diagnostic (script or report) to check coverage and spot obvious mismatches.
- [ ] **Validate product description impact** — Status: Partial. Product descriptions are in the scoring model; impact on ranking has not been validated on real data.
  - [ ] Review a few real deposits with similar products to see whether description‑based similarity improves or hurts ranking.
  - [ ] Adjust weighting or fallback behavior for descriptions if needed.
- [x] **Expose production future‑schedule control** — Status: Done. Reconciliation Settings adds a production toggle + per‑tenant default; candidate APIs honor the stored default unless overridden.
  - [x] Add a user‑facing "Include future‑dated schedules" toggle on the Reconciliation page (separate from dev‑only controls).
  - [x] Store a per‑tenant default for this behavior.
- [x] **Variance settings UX** — Status: Done. Reconciliation Settings UI surfaces and saves per‑tenant `reconciliation.varianceTolerance` (0–1).
  - [x] Show current variance tolerance and engine mode.
  - [x] Allow authorized users to update `reconciliation.varianceTolerance` without touching raw system settings.
- [x] **Explainability in UI** — Status: Done. Suggested schedules table shows origin badges (Exact/Fuzzy + Auto/Manual), confidence level, and a "Why?" pill that exposes top reasons from matcher output.

### Phase 2 – Complete Reconciliation Workflow

- [ ] **Tighten Finalize / Reopen semantics** — Status: Partial. Core flows exist and are permission‑gated; schedule recompute happens on Finalize but not on Unfinalize, and undo remains coarse‑grained.
  - [x] Enforce that Finalize is only allowed when no lines remain Unmatched/Suggested (i.e., all lines are resolved or explicitly excepted).
  - [x] On finalize, create an audit entry noting who finalized and with which variance/engine settings (via `logMatchingMetric`).
  - [ ] On reopen, consider additional audit context and/or optional schedule‑level rollback controls.
- [ ] **Clarify schedule statuses in UI** — Status: Partial. Filters exist but there is no distinct "Matched" phase for schedules separate from "Reconciled".
  - [ ] Ensure the Un‑Reconciled filter shows only schedules with open differences.
  - [ ] Refine labels and help text so operators understand "Suggested" vs "Reconciled" and what happens after Finalize.
- [ ] **Run AI Matching best‑practice flow** — Status: Partial. Preview → Auto‑Match → manual review → Finalize is supported in UI; role gating and guardrails are still light.
  - [ ] Document (and optionally enforce) the intended sequence: Preview → Apply Auto Matches (Pass A only) → Manual review of fuzzy suggestions → Finalize.
  - [ ] Consider gating Run AI Matching behind a role/permission if needed (e.g., only Accounting or Admin roles).

### Phase 3 – Advanced Scenarios (Post‑"Done")

- [ ] **FLEX schedules (overages / unknown products)** — Status: Next. Design scaffold lives in `docs/reconciliation-flex-partial-design.md`; no FLEX creation logic or review UI implemented yet.
  - [ ] For overages beyond variance, apply expected amounts to the main schedule and create a FLEX schedule (`RS-…-F`) for the overage.
  - [ ] For unknown products (no viable candidates), create FLEX "Unknown Product" schedules and surface them in a FLEX review table.
- [ ] **Partial payments (many:1)** — Status: Next. Many:1 behavior is not yet implemented.
  - [ ] Update RevenueSchedule balances and statuses based on cumulative `DepositLineMatch` allocations.
  - [ ] Ensure multiple deposits against the same schedule respect FIFO order when appropriate.
- [ ] **Prepayments (1:many)** — Status: Next. Splitting a deposit line across multiple future schedules is not supported.
  - [ ] Allow a single large deposit line to be allocated across multiple future schedules in date order, with clear UI for remaining balance.
- [ ] **Chargebacks & reversals** — Status: Next. No CB/CB‑REV schedule types or negative‑line handling are present.
  - [ ] Introduce CB and CB‑REV schedules, link them to original RevenueSchedules, and ensure matching/reconciliation logic handles negative lines correctly.
- [ ] **Observability & tuning** — Status: Partial. Audit‑backed `logMatchingMetric` exists; downstream metrics and tuning workflows are still manual.
  - [ ] Add basic metrics (auto‑match rate, suggestion acceptance/override, correction rate) and log key decisions in a structured, queryable way.
  - [ ] Use those metrics to tune weights, variance, and thresholds before expanding to more tenants.

