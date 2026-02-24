# Flex Schedule + M2M Decision Matrix and Ticket Breakdown

Date: 2026-02-24  
Source feedback: `docs/notes/flex-features-handoff-feedback.md`

## Objective

Define the exact decisions, implementation tickets, and QA path required to align:

1. Flex Product (reconciliation exception workflow), and  
2. Flex Schedule Month-to-Month (M2M) continuation workflow.

This plan is structured to remove terminology ambiguity and close implementation gaps for M2M lifecycle behavior.

---

## Decision Matrix

| Decision ID | Topic | Current State | Options | Recommended Decision | Owner | Needed By | Why it matters |
|---|---|---|---|---|---|---|---|
| DM-01 | Canonical terminology | "Flex schedule" is used for both exception and M2M in different docs | A) Keep both terms as-is, B) Rename M2M to "Schedule Extension", C) Rename exception flow | **B**: Use "Flex Product (Exception)" and "Schedule Extension (M2M)" everywhere going forward | Rob + Product | Before doc edits | Prevents recurring requirement confusion and ticket drift |
| DM-02 | Scope of `Flex_Product_Guide.md` | Guide currently covers exception workflow only | A) Keep scoped doc + link M2M doc, B) Merge both into one guide | **A**: Keep it exception-scoped; add clear definitions and cross-links | Hunter | Immediate | Keeps runbooks focused and testable |
| DM-03 | Flex schedule date rule text | Guide says `scheduleDate = Deposit.month`; some docs say "always 1st of month" | A) Keep current wording, B) Clarify to first day of reporting month | **B**: State "first day of deposit reporting month (YYYY-MM-01)" | Hunter | Immediate | Removes date ambiguity without changing behavior |
| DM-04 | Naming/tagging convention (`-F`, `-CB`, `-CB-REV`) | Mixed historical expectations; current logic relies on classification fields | A) Enforce suffixes in schedule numbers, B) Deprecate suffixes and rely on classification fields | **TBD (Product decision)**. Proposed: **B** unless reporting depends on suffix parsing | Rob + Hunter | Before schema/API work | Affects UI labels, reports, and migration compatibility |
| DM-05 | Commission-only no-match rule | Required in handoff docs; unclear if fully aligned in unknown-line flow | A) Usage=Commission + Rate=100%, B) Keep raw values | **TBD (Business decision)**. Proposed: **A** to match documented ops workflow | Rob + Hunter | Before flex edge-case ticket | Prevents reconciliation mismatch in commission-only imports |
| DM-06 | M2M lifecycle state model | Only `ActiveBilling` and `BillingEnded` exist; no explicit Billing-M2M state | A) Keep current 2-state model, B) add explicit `BillingM2M` state | **B**: Add explicit `BillingM2M` status to `OpportunityProductStatus` | Rob + Hunter | Before schema migration | Needed to satisfy lifecycle requirements and reporting |
| DM-07 | M2M stop condition | "3 months no deposits" is a requirement in docs but not implemented | A) No stop condition, B) auto-end after 3 months no deposits | **B**: implement auto-transition to `BillingEnded` after configured threshold (default 3 months) | Rob + Hunter | Before job ticket finalization | Prevents indefinite schedule generation |
| DM-08 | M2M run cadence + idempotency contract | Job exists; behavior not fully documented as contract | A) Best-effort job only, B) strict monthly idempotent contract with telemetry | **B**: strict contract + structured job result metrics | Hunter | Before QA test plan finalization | Needed for reliable ops and repeatable UAT |

---

## Ticket Breakdown

## Doc Track

| Ticket ID | Title | Priority | Owner | Depends On | Acceptance Criteria |
|---|---|---|---|---|---|
| DOC-01 | Add canonical definitions section (Exception vs M2M) | P0 | Hunter | DM-01 | New "Definitions" section exists in `docs/runbooks/Flex_Product_Guide.md` with explicit term mapping and "do not mix terms" note |
| DOC-02 | Add dedicated M2M runbook | P0 | Hunter | DM-01, DM-06, DM-07 | New runbook describes trigger, cadence, idempotency, lifecycle transitions, stop condition, and troubleshooting |
| DOC-03 | Clarify flex schedule date language | P0 | Hunter | DM-03 | All flex docs use exact phrase "first day of deposit reporting month (YYYY-MM-01)" |
| DOC-04 | Publish naming/tagging policy | P1 | Hunter | DM-04 | Single source-of-truth section states whether suffixes are required or deprecated; all conflicting docs updated |
| DOC-05 | Document commission-only edge case | P1 | Hunter | DM-05 | Guide includes explicit rule and example for commission-only no-match scenario |
| DOC-06 | Update TC-12/TC-13 runbooks and test script alignment | P0 | Hunter | DOC-01, DOC-02 | `TC-12` and `TC-13` expectations match final terminology and lifecycle behavior, including evidence checklist |

## API/Job Track

| Ticket ID | Title | Priority | Owner | Depends On | Acceptance Criteria |
|---|---|---|---|---|---|
| JOB-01 | Harden M2M runner lifecycle logic | P0 | Hunter | DM-06, DM-07 | Runner transitions products to M2M lifecycle state, creates at most one schedule per target month, and respects end conditions |
| JOB-02 | Implement no-deposit threshold auto-end | P0 | Hunter | DM-07 | Products with no qualifying deposits for threshold months transition to `BillingEnded`; no future M2M schedules created |
| JOB-03 | Add structured job telemetry response | P1 | Hunter | DM-08 | `/api/jobs/month-to-month-schedules` response includes counts: scanned, created, skipped_existing, transitioned_m2m, transitioned_ended, errors |
| JOB-04 | Add dry-run mode for M2M endpoint | P1 | Hunter | DM-08 | Endpoint supports dry-run (no writes) with projected result counts for validation |
| FLEX-API-01 | Align commission-only unknown-line flex creation | P1 | Hunter | DM-05 | Unknown/no-match commission-only line follows approved rule and is covered by tests |

## Schema Track

| Ticket ID | Title | Priority | Owner | Depends On | Acceptance Criteria |
|---|---|---|---|---|---|
| SCH-01 | Add `BillingM2M` to `OpportunityProductStatus` enum | P0 | Hunter | DM-06 | Prisma enum updated, migration applied, code paths compile, existing statuses unaffected |
| SCH-02 | Add optional config for M2M no-deposit threshold | P1 | Hunter | DM-07 | Tenant/system setting exists (default 3), read by M2M runner, documented |
| SCH-03 | Backfill strategy for existing ActiveBilling products | P1 | Hunter | SCH-01 | One-time migration/runbook defines how existing products enter `BillingM2M` safely |

## QA Track

| Ticket ID | Title | Priority | Owner | Depends On | Acceptance Criteria |
|---|---|---|---|---|---|
| QA-01 | E2E test: exception flex workflow terminology and outcomes | P0 | QA + Hunter | DOC-01, DOC-03 | TC-12 passes with explicit evidence for classification, queue item, and schedule date semantics |
| QA-02 | E2E test: M2M create + idempotency | P0 | QA + Hunter | JOB-01, JOB-03 | TC-13 passes: first run creates one schedule, second run same month creates none |
| QA-03 | E2E test: M2M lifecycle transition and stop condition | P0 | QA + Hunter | JOB-02, SCH-01 | Product transitions to `BillingM2M`, then to `BillingEnded` after threshold; no additional schedules generated |
| QA-04 | Regression test: stage derivation with new M2M status | P1 | QA + Hunter | SCH-01 | Opportunity stage logic remains correct for Provisioning, ActiveBilling/BillingM2M, BillingEnded |
| QA-05 | Edge-case test: commission-only no-match flex | P1 | QA + Hunter | FLEX-API-01 | Behavior matches approved decision and documentation exactly |

---

## Recommended Execution Sequence

1. Finalize DM-01 through DM-08 in a 30-minute decision review.  
2. Ship Doc Track P0 tickets (`DOC-01`, `DOC-02`, `DOC-03`, `DOC-06`).  
3. Implement Schema P0 (`SCH-01`) and API/Job P0 (`JOB-01`, `JOB-02`).  
4. Implement QA P0 (`QA-01`, `QA-02`, `QA-03`) and collect evidence artifacts.  
5. Close P1 tickets and run a final doc consistency pass.

---

## Definition of Done

All of the below are true:

1. No ambiguity remains between exception flex and M2M continuation terminology in active docs.  
2. M2M lifecycle behavior is explicit, implemented, and tested (including stop condition).  
3. TC-12 and TC-13 pass in UAT with evidence linked.  
4. Naming/tagging and commission-only handling are explicitly decided and reflected in docs + behavior.

