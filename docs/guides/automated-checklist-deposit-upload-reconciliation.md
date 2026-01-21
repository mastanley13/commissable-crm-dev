# Automated Verification Checklist - Deposit Upload + Reconciliation

This checklist is keyed to the guide sections:
- `docs/guides/deposit-upload.md`
- `docs/guides/reconciliation.md`

Goal: validate behavior **without manual browser review** using runnable tests, API calls, and DB assertions.

---

## How to use this checklist

- Treat items as "automatable test cases" with IDs.
- Mark each item as one of:
  - **Runnable now**: already supported by existing tests/scripts/tools.
  - **Implemented (integration-gated)**: tests exist, but require `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL` (disposable Postgres) to run.
  - **To implement**: requires adding tests or harness code.
- For items that are "API-only", you can validate via:
  - an automated test runner (recommended), or
  - a Postman/newman collection, or
  - a small Node/TS script (Prisma + fetch), or
  - AI verification of captured JSON/DB snapshots.

---

## Baseline runnable checks (repo-wide) (Runnable now)

- [x] **AUTO-RUN-01** Run unit tests: `npm test`
  - Latest run: PASS — see `docs/guides/automated-checklist-results-deposit-upload-reconciliation-2026-01-21T08-36-22.md`
  - Expected: all tests in `tests/*.test.ts` pass.
- [x] **AUTO-RUN-02** Run lint: `npm run lint`
  - Latest run: FAIL — see `docs/guides/automated-checklist-results-deposit-upload-reconciliation-2026-01-21T08-36-22.md`
  - Expected: lint passes (or failures are understood and tracked).
- [x] **AUTO-RUN-03** (Optional) Build: `npm run build`
  - Latest run: FAIL — see `docs/guides/automated-checklist-results-deposit-upload-reconciliation-2026-01-21T08-36-22.md`
  - Expected: build succeeds.

Note: as of the latest automated run in this repo, `npm run lint` / `npm run build` fail due to `react/no-unescaped-entities` at `components/deposit-upload/map-fields-step.tsx:1065`.

---

# Deposit Upload - automated checks (docs/guides/deposit-upload.md)

## Where it lives (routes + implementation)

- [x] **DU-AUTO-01 (Runnable now)** Static route presence check
  - Method: verify the following files exist:
    - `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`
    - `app/api/reconciliation/deposits/import/route.ts`
  - Expected: files present; imports resolve.

## Workflow > 2) Create deposit context (who/when/what)

- [ ] **DU-AUTO-02 (To implement)** UI gating logic (no browser)
  - Method: unit test the "canProceed" gating in `components/deposit-upload/create-template-step.tsx` by extracting the predicate or testing via a lightweight component test harness.
  - Expected: proceed disabled unless required inputs are present.

## Workflow > 3) Map fields (column-to-field mapping)

- [x] **DU-AUTO-03 (Runnable now)** Field suggestion heuristics
  - Method: run existing tests:
    - `tests/deposit-upload-field-suggestions.test.ts`
  - Expected: suggestions behave consistently for common header names.

- [x] **DU-AUTO-04 (Runnable now)** Header resolution / ambiguity
  - Method: run existing tests:
    - `tests/deposit-upload-resolve-header.test.ts`
  - Expected: ambiguous/missing headers are detected and return a stable error shape.

- [x] **DU-AUTO-05 (Runnable now)** Template auto-seeding match logic
  - Method: run existing tests:
    - `tests/deposit-upload-template-matching.test.ts`
  - Expected: Telarus template matcher returns expected mapping for known vendor/distributor pairs.

- [x] **DU-AUTO-06 (Runnable now)** Mapping config roundtrip
  - Method: run existing tests:
    - `tests/deposit-import-template-mapping.test.ts`
  - Expected: mapping config roundtrips, normalizes invalid config, and enforces 1:1 canonical mapping.

## What gets created (server behavior) > File parsing

- [x] **DU-AUTO-07 (Runnable now)** CSV parsing contract tests
  - Method: run existing tests:
    - `tests/deposit-import-parse-csv.test.ts`
  - Expected: empty/no-header inputs reject; returned `{ headers, rows }` is correct and stable.

- [x] **DU-AUTO-08 (Runnable now)** Excel parsing contract tests
  - Method: run existing tests:
    - `tests/deposit-import-parse-xlsx.test.ts` (generates XLSX in-memory)
  - Expected: header row is used; rows are parsed and normalized.

- [x] **DU-AUTO-09 (Runnable now)** Unsupported file type rejection
  - Method: run existing tests:
    - `tests/deposit-import-parse-unsupported.test.ts`
  - Expected: consistent "unsupported file type" error.

## What gets created (server behavior) > Import route contract tests (API-level, no browser)

These are implemented as integration tests against a disposable Postgres DB and are gated to avoid accidental execution against real environments.

- Enable by setting:
  - `RUN_INTEGRATION_TESTS=1`
  - `TEST_DATABASE_URL=postgresql://...` (disposable DB)

- [ ] **DU-AUTO-10 (Implemented; integration-gated)** Required mappings enforced
  - Target: `POST /api/reconciliation/deposits/import`
  - Method: `tests/integration-deposit-import-route.test.ts`
  - Expected: 400 when `usage` or `commission` mapping is missing.

- [ ] **DU-AUTO-11 (Implemented; integration-gated)** Ambiguous/missing mapped column errors
  - Method: `tests/integration-deposit-import-route.test.ts`
  - Expected: 400 with clear message when a mapped header is ambiguous or missing.

- [ ] **DU-AUTO-12 (Implemented; integration-gated)** Commission-only row behavior
  - Method: `tests/integration-deposit-import-route.test.ts`
  - Expected DB state: when usage is missing but commission exists, line item usage equals commission; commissionRate becomes 1.0.

- [ ] **DU-AUTO-13 (Implemented; integration-gated)** Line payment date parsing
  - Method: `tests/integration-deposit-import-route.test.ts`
  - Expected: Excel serial date and ISO date strings map to `DepositLineItem.paymentDate`; missing column falls back to deposit date.

- [ ] **DU-AUTO-14 (Implemented; integration-gated)** Idempotency behavior
  - Method: `tests/integration-deposit-import-route.test.ts`
  - Expected:
    - same `idempotencyKey` with completed job returns the same `depositId`
    - same key in-flight returns 409.

- [ ] **DU-AUTO-15 (Implemented; integration-gated)** Template persistence toggle behavior
  - Method: `tests/integration-deposit-import-route.test.ts`
  - Expected:
    - when `saveTemplateMapping=true`, template config is updated/created
    - when false, template remains unchanged

---

# Reconciliation - automated checks (docs/guides/reconciliation.md)

## Settings that affect reconciliation

- [x] **REC-AUTO-01 (Runnable now)** Flex decision logic unit tests
  - Method: run existing test `tests/revenue-schedule-flex-decision.test.ts`
  - Expected: tolerance/overage logic remains stable and explainable.

- [ ] **REC-AUTO-02 (Implemented; integration-gated)** Settings persistence tests (API-level)
  - Targets:
    - `GET|POST /api/reconciliation/settings` (tenant)
    - `GET|POST /api/reconciliation/user-settings` (user confidence thresholds)
  - Method: `tests/integration-reconciliation-settings.test.ts`
  - Expected: values are stored and retrieved consistently; bounds checking enforced.

## Pages > Deposits list API (`GET /api/reconciliation/deposits`)

- [ ] **REC-AUTO-03 (Implemented; integration-gated)** Filtering + pagination contract
  - Method: `tests/integration-reconciliation-deposits.test.ts`
  - Expected:
    - `pageSize` is capped at 100
    - `from/to` filters by `paymentDate`
    - `q` filters by deposit name and related account names
    - invalid status/paymentType returns 400

## Deposit detail API (`GET /api/reconciliation/deposits/[depositId]/detail`)

- [ ] **REC-AUTO-04 (Implemented; integration-gated)** Metadata + line item shape contract
  - Method: `tests/integration-reconciliation-deposits.test.ts`
  - Expected: stable metadata fields (`usageTotal`, `allocated`, `unallocated`, `status`, `reconciled`) and line item fields (usage/commission + other identifiers).

## Suggested matches API (`GET /api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates`)

- [ ] **REC-AUTO-05 (Implemented; integration-gated)** Candidate generation honors include-future and engine mode
  - Method: `tests/integration-reconciliation-candidates.test.ts`
  - Expected:
    - include-future expands date window (default window is +/- 1 month in matcher)
    - hierarchical vs legacy scoring changes `matchType`/confidence behavior

- [ ] **REC-AUTO-06 (Implemented; integration-gated)** User confidence filtering
  - Method: `tests/integration-reconciliation-candidates.test.ts`
  - Expected: candidates below `reconciliation.suggestedMatchesMinConfidence` are excluded from response when status is "Suggested".

## Apply match / unmatch APIs

- [ ] **REC-AUTO-07 (Implemented; integration-gated)** Manual match allocation math
  - Target: `POST .../apply-match`
  - Method: `tests/integration-reconciliation-match-flow.test.ts`
  - Expected:
    - cannot allocate ignored/reconciled line items
    - cannot allocate more than remaining unallocated amounts
    - creates or updates `DepositLineMatch` as Applied
    - updates `DepositLineItem` allocation fields + status (Unmatched/PartiallyMatched/Matched)
    - updates deposit aggregates

- [ ] **REC-AUTO-08 (Implemented; integration-gated)** Unmatch clears all allocations for a line
  - Target: `POST .../unmatch`
  - Method: `tests/integration-reconciliation-match-flow.test.ts`
  - Expected:
    - deletes all matches for the line
    - resets primaryRevenueScheduleId and allocations
    - recomputes affected schedules and deposit aggregates

## Variance handling / flex resolution

- [ ] **REC-AUTO-09 (Implemented; integration-gated)** Auto-adjust when overage is within tolerance
  - Target: `POST .../apply-match`
  - Method: `tests/integration-reconciliation-variance-flex.test.ts`
  - Expected: when overage <= tolerance, an adjustment split is created automatically and schedule recomputed.

- [ ] **REC-AUTO-10 (Implemented; integration-gated)** Prompt path when overage exceeds tolerance
  - Method: `tests/integration-reconciliation-variance-flex.test.ts`
  - Expected: response includes a `flexDecision` indicating prompt and allowed actions.

- [ ] **REC-AUTO-11 (Implemented; integration-gated)** Negative line triggers chargeback pending
  - Method: `tests/integration-reconciliation-variance-flex.test.ts`
  - Expected:
    - creates flex chargeback schedule + a Suggested match
    - line becomes Suggested (pending approval)
    - a flex review item is enqueued

- [ ] **REC-AUTO-12 (Implemented; integration-gated)** Resolve-flex API creates adjustment/flex product and (optional) applies to future schedules
  - Target: `POST .../resolve-flex`
  - Method: `tests/integration-reconciliation-variance-flex.test.ts`
  - Expected:
    - action Adjust/FlexProduct/Manual behaves as documented
    - applyToFuture updates eligible future schedules in scope when action=Adjust

## AI adjustment preview/apply APIs

- [ ] **REC-AUTO-13 (Implemented; integration-gated)** AI adjustment preview returns recommendation + scope/future schedule list
  - Target: `POST .../ai-adjustment/preview`
  - Method: `tests/integration-reconciliation-ai-adjustment.test.ts`
  - Expected: preview includes suggestion type (allocate vs adjust), base overage values, and future schedule count/list.

- [ ] **REC-AUTO-14 (Implemented; integration-gated)** AI adjustment apply updates current and (optional) future schedules
  - Target: `POST .../ai-adjustment/apply`
  - Method: `tests/integration-reconciliation-ai-adjustment.test.ts`
  - Expected: creates adjustment split; when applyToFuture=true, updates future schedules and returns IDs.

## Auto-match APIs

- [ ] **REC-AUTO-15 (Implemented; integration-gated)** Auto-match preview respects user auto-match confidence threshold
  - Target: `POST /api/reconciliation/deposits/[depositId]/auto-match/preview`
  - Method: `tests/integration-reconciliation-auto-match.test.ts`
  - Expected: only top candidates >= `reconciliation.autoMatchMinConfidence` are included.

- [ ] **REC-AUTO-16 (Implemented; integration-gated)** Auto-match apply persists matches with source Auto
  - Target: `POST /api/reconciliation/deposits/[depositId]/auto-match`
  - Method: `tests/integration-reconciliation-auto-match.test.ts`
  - Expected: creates Applied matches with `source: Auto`, updates line and deposit aggregates.

## Finalize / unfinalize APIs

- [ ] **REC-AUTO-17 (Implemented; integration-gated)** Finalize blocks when Unmatched or Suggested lines exist
  - Target: `POST .../finalize`
  - Method: `tests/integration-reconciliation-match-flow.test.ts`
  - Expected: 400 with clear message when open lines exist.

- [ ] **REC-AUTO-18 (Implemented; integration-gated)** Finalize locks records and marks reconciled flags
  - Method: `tests/integration-reconciliation-match-flow.test.ts`
  - Expected DB state:
    - deposit is `reconciled=true` and `reconciledAt` set
    - matched/partially matched lines become `reconciled=true`
    - applied matches become `reconciled=true`

- [ ] **REC-AUTO-19 (Implemented; integration-gated)** Unfinalize clears reconciled flags and recomputes schedules
  - Target: `POST .../unfinalize`
  - Method: `tests/integration-reconciliation-match-flow.test.ts`
  - Expected: deposit reopens; lines/matches un-reconciled; schedule statuses recomputed.

- [ ] **REC-AUTO-20 (Implemented; integration-gated)** Known inconsistency regression test
  - Purpose: protect against finalize treating `status === "Completed"` as already finalized when `reconciled=false`.
  - Method: `tests/integration-reconciliation-finalize-regression.test.ts`
  - Expected: either finalize succeeds, or behavior is explicitly changed and tested.

## Flex review APIs

- [ ] **FLEX-AUTO-01 (Implemented; integration-gated)** Queue contract (`GET /api/flex-review`)
  - Method: `tests/integration-flex-review.test.ts`
  - Expected: stable fields, sorting, and permission enforcement (`reconciliation.manage`).

- [ ] **FLEX-AUTO-02 (Implemented; integration-gated)** Assign contract (`POST /api/flex-review/[itemId]/assign`)
  - Method: `tests/integration-flex-review.test.ts`
  - Expected: assignment persists; assignee must be a reconciliation manager; notifications created.

- [ ] **FLEX-AUTO-03 (Implemented; integration-gated)** Approve-and-apply updates source deposit
  - Target: `POST /api/flex-review/[itemId]/approve-and-apply`
  - Method: `tests/integration-flex-review.test.ts`
  - Expected: Suggested match becomes Applied (for chargeback/CB-rev), aggregates recomputed, item marked Approved.

---

## "AI verification" mode (no UI, minimal engineering)

If you do not yet have integration tests, you can still verify end-to-end logic by capturing artifacts and having an AI reviewer confirm invariants:

- [ ] **AI-VERIFY-01 (Runnable now)** Capture API responses for a known deposit
  - Collect:
    - `/api/reconciliation/deposits?...`
    - `/api/reconciliation/deposits/{depositId}/detail`
    - `/api/reconciliation/deposits/{depositId}/line-items/{lineId}/candidates`
  - Expected invariants:
    - line totals add up
    - candidates contain confidence + reasons

- [ ] **AI-VERIFY-02 (To implement)** Scripted smoke runner (Node/TS)
  - Write a `tsx` script that:
    - seeds minimal data
    - calls key APIs
    - prints JSON + a small DB summary
  - Expected: script output can be reviewed automatically in CI and by AI.
