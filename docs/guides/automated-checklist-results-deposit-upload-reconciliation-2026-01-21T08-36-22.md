# Automated Checklist Results — Deposit Upload + Reconciliation (2026-01-21T08-36-22)

Source checklist: `docs/guides/automated-checklist-deposit-upload-reconciliation.md`

## Environment

- OS: Windows (PowerShell)
- Node: `v22.18.0`
- npm: `10.9.3`

## Baseline runnable checks (repo-wide)

- [x] **AUTO-RUN-01** PASS — `npm test`
  - Summary: `58` tests, `37` pass, `0` fail, `21` skipped (integration env not set)
- [x] **AUTO-RUN-02** FAIL — `npm run lint`
  - Error: `components/deposit-upload/map-fields-step.tsx:1065` (`react/no-unescaped-entities`)
- [x] **AUTO-RUN-03** FAIL — `npm run build`
  - Failure during “Linting and checking validity of types” with the same `react/no-unescaped-entities` errors as lint.

---

# Deposit Upload — automated checks

## Where it lives (routes + implementation)

- [x] **DU-AUTO-01 (Runnable now)** PASS — Static route presence check
  - `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`: present
  - `app/api/reconciliation/deposits/import/route.ts`: present

## Workflow > 2) Create deposit context (who/when/what)

- [ ] **DU-AUTO-02 (To implement)** SKIPPED — No automated test implemented for the UI gating logic.

## Workflow > 3) Map fields (column-to-field mapping)

- [x] **DU-AUTO-03 (Runnable now)** PASS — Field suggestion heuristics
  - Evidence: `npm test` includes `tests/deposit-upload-field-suggestions.test.ts`.
- [x] **DU-AUTO-04 (Runnable now)** PASS — Header resolution / ambiguity
  - Evidence: `npm test` includes `tests/deposit-upload-resolve-header.test.ts`.
- [x] **DU-AUTO-05 (Runnable now)** PASS — Template auto-seeding match logic
  - Evidence: `npm test` includes `tests/deposit-upload-template-matching.test.ts`.
- [x] **DU-AUTO-06 (Implemented)** PASS — Mapping config roundtrip + constraints
  - Evidence: `npm test` includes `tests/deposit-import-template-mapping.test.ts`.

## What gets created (server behavior) > File parsing

- [x] **DU-AUTO-07 (Implemented)** PASS — CSV parsing contract tests
  - Evidence: `npm test` includes `tests/deposit-import-parse-csv.test.ts`.
- [x] **DU-AUTO-08 (Implemented)** PASS — Excel parsing contract tests
  - Evidence: `npm test` includes `tests/deposit-import-parse-xlsx.test.ts`.
- [x] **DU-AUTO-09 (Implemented)** PASS — Unsupported file type rejection
  - Evidence: `npm test` includes `tests/deposit-import-parse-unsupported.test.ts`.

## What gets created (server behavior) > Import route contract tests (API-level, no browser)

- [ ] **DU-AUTO-10..DU-AUTO-15 (Implemented; integration-gated)** SKIPPED — Integration env not set
  - Tests exist, but are skipped unless `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL` are set.
  - Evidence (tests present): `tests/integration-deposit-import-route.test.ts`.

---

# Reconciliation — automated checks

- [x] **REC-AUTO-01 (Runnable now)** PASS — Flex decision logic unit tests
  - Evidence: `npm test` includes `tests/revenue-schedule-flex-decision.test.ts`.

- [ ] **REC-AUTO-02..REC-AUTO-20 (Implemented; integration-gated)** SKIPPED — Integration env not set
  - Evidence (tests present):
    - `tests/integration-reconciliation-settings.test.ts`
    - `tests/integration-reconciliation-deposits.test.ts`
    - `tests/integration-reconciliation-candidates.test.ts`
    - `tests/integration-reconciliation-match-flow.test.ts`
    - `tests/integration-reconciliation-variance-flex.test.ts`
    - `tests/integration-reconciliation-ai-adjustment.test.ts`
    - `tests/integration-reconciliation-auto-match.test.ts`
    - `tests/integration-reconciliation-finalize-regression.test.ts`

---

# Flex review — automated checks

- [ ] **FLEX-AUTO-01..FLEX-AUTO-03 (Implemented; integration-gated)** SKIPPED — Integration env not set
  - Evidence (tests present): `tests/integration-flex-review.test.ts`.

---

# AI verification mode

- [ ] **AI-VERIFY-01 (Runnable now)** SKIPPED — Requires a running app + known deposit dataset to capture artifacts.
- [ ] **AI-VERIFY-02 (To implement)** SKIPPED — Requires a scripted smoke runner.

## Notes / blockers

- Lint/build are currently blocked by `react/no-unescaped-entities` in `components/deposit-upload/map-fields-step.tsx:1065`.
- Integration-gated tests were not executed because no disposable Postgres `TEST_DATABASE_URL` was configured for this run.
