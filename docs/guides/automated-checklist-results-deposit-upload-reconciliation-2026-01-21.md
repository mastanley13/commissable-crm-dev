# Automated Checklist Results - Deposit Upload + Reconciliation (2026-01-21)

Runs the runnable items from `docs/guides/automated-checklist-deposit-upload-reconciliation.md` and records outcomes.

## Environment

- OS: Windows (PowerShell)
- Node: `v22.18.0`
- npm: `10.9.3`

## Repo-wide runnable checks

- **AUTO-RUN-01** PASS — `npm test` (58 tests, 0 failures; 21 skipped because integration env is not set)
- **AUTO-RUN-02** FAIL — `npm run lint`
  - `components/deposit-upload/map-fields-step.tsx:1065` (`react/no-unescaped-entities`)
- **AUTO-RUN-03** FAIL — `npm run build`
  - Build fails during lint/typecheck step with the same `react/no-unescaped-entities` errors as `npm run lint`.

## Deposit Upload checks (keyed to `docs/guides/deposit-upload.md`)

### Where it lives (routes + implementation)

- **DU-AUTO-01 (Runnable now)** PASS — Static route presence check
  - Verified files exist:
    - `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`
    - `app/api/reconciliation/deposits/import/route.ts`

### Workflow > 2) Create deposit context (who/when/what)

- **DU-AUTO-02 (To implement)** NOT RUN — Requires a unit/component test harness for the UI gating predicate in `components/deposit-upload/create-template-step.tsx`.

### Workflow > 3) Map fields (column-to-field mapping)

- **DU-AUTO-03 (Runnable now)** PASS — Field suggestion heuristics
  - Evidence: `npm test` includes `suggestDepositFieldMatches` tests (`tests/deposit-upload-field-suggestions.test.ts`).
- **DU-AUTO-04 (Runnable now)** PASS — Header resolution / ambiguity
  - Evidence: `npm test` includes `resolveSpreadsheetHeader` tests (`tests/deposit-upload-resolve-header.test.ts`).
- **DU-AUTO-05 (Runnable now)** PASS — Template auto-seeding match logic
  - Evidence: `npm test` includes Telarus seeding tests (`tests/deposit-upload-template-matching.test.ts`).
- **DU-AUTO-06 (Runnable now)** PASS — Mapping config roundtrip + 1:1 mapping enforcement
  - Evidence: `npm test` includes `DU-AUTO-06` tests in `tests/deposit-import-template-mapping.test.ts`.

### What gets created (server behavior) > File parsing

- **DU-AUTO-07 (Runnable now)** PASS — CSV parsing contract tests (`tests/deposit-import-parse-csv.test.ts`)
- **DU-AUTO-08 (Runnable now)** PASS — Excel parsing contract tests (`tests/deposit-import-parse-xlsx.test.ts`)
- **DU-AUTO-09 (Runnable now)** PASS — Unsupported file type rejection (`tests/deposit-import-parse-unsupported.test.ts`)

### What gets created (server behavior) > Import route contract tests

- **DU-AUTO-10..DU-AUTO-15 (Implemented; integration-gated)** SKIPPED in default `npm test`
  - Tests live in `tests/integration-deposit-import-route.test.ts`.
  - To run: set `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL` (disposable Postgres), then run `npm test`.

## Reconciliation checks (keyed to `docs/guides/reconciliation.md`)

- **REC-AUTO-01 (Runnable now)** PASS — Flex decision logic unit tests
  - Evidence: `npm test` includes `evaluateFlexDecision` tests (`tests/revenue-schedule-flex-decision.test.ts`).

- **REC-AUTO-02..REC-AUTO-20 (Implemented; integration-gated)** SKIPPED in default `npm test`
  - Test files:
    - `tests/integration-reconciliation-settings.test.ts` (REC-AUTO-02)
    - `tests/integration-reconciliation-deposits.test.ts` (REC-AUTO-03/04)
    - `tests/integration-reconciliation-candidates.test.ts` (REC-AUTO-05/06)
    - `tests/integration-reconciliation-match-flow.test.ts` (REC-AUTO-07/08/17/18/19)
    - `tests/integration-reconciliation-variance-flex.test.ts` (REC-AUTO-09/10/11/12)
    - `tests/integration-reconciliation-ai-adjustment.test.ts` (REC-AUTO-13/14)
    - `tests/integration-reconciliation-auto-match.test.ts` (REC-AUTO-15/16)
    - `tests/integration-reconciliation-finalize-regression.test.ts` (REC-AUTO-20)
  - To run: set `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL` (disposable Postgres), then run `npm test`.

## Flex review checks

- **FLEX-AUTO-01..FLEX-AUTO-03 (Implemented; integration-gated)** SKIPPED in default `npm test`
  - Tests live in `tests/integration-flex-review.test.ts`.
  - To run: set `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL` (disposable Postgres), then run `npm test`.

## AI verification mode

- **AI-VERIFY-01 (Runnable now)** NOT RUN — Requires a running app + a known deposit dataset to capture API response artifacts.
- **AI-VERIFY-02 (To implement)** NOT RUN — Requires a scripted smoke runner.

## Notes / blockers

- `npm run lint` and `npm run build` are blocked by `react/no-unescaped-entities` errors in `components/deposit-upload/map-fields-step.tsx:1065`.
- Integration-gated tests require a disposable Postgres DB and are guarded by `RUN_INTEGRATION_TESTS=1` + `TEST_DATABASE_URL` to avoid accidentally running against a real environment.
