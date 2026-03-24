---
title: Pre-UAT Integration and Regression Validation Plan
owner: Engineering / QA
status: Draft
last_updated: 2026-03-23
source_feedback:
  - docs/analysis/2026-03-16-reconciliation-e2e-validation-report.md
  - docs/analysis/2026-03-18-reconciliation-e2e-validation-update.md
  - docs/notes/Changing Rev Sch Start Dates Error.docx.md
  - docs/notes/Reconciliation Maching Issues and Workflow.docx.md
---

# Pre-UAT Integration and Regression Validation Plan

## Goal

Before the next UAT cycle, run the reconciliation and Change Start Date integration suite against a disposable Postgres database and add missing regression coverage for:

- Change Start Date collisions
- flex-suggestion filtering
- bulk unmatch reversal

## Current-state summary

- `tests/integration-test-helpers.ts` only enables integration tests when:
  - `RUN_INTEGRATION_TESTS=1`
  - `TEST_DATABASE_URL` points to a disposable Postgres database
- `package.json` uses `node --import tsx --test tests/*.test.ts` for `npm test`, which is not a safe release gate for DB-backed integration coverage because Node test concurrency can deadlock the shared integration harness.
- The March 16 validation report confirmed that disposable Postgres runs work, but also documented concurrency issues when the DB suite is not forced to sequential execution.
- The March 18 validation update confirmed that the targeted unmatch regression suite now passes when re-run sequentially on a disposable database.
- Current automated coverage still has gaps around the exact UAT issues raised in the recent client notes.

## Gap-to-root-cause map

| UAT risk | Current gap | Root cause | Planned fix |
| --- | --- | --- | --- |
| Start-date collisions can regress unnoticed | Existing start-date integration test only covers a happy path | No automated coverage for collision scope or user-facing failure contract | Add targeted integration cases for internal and external collisions |
| Flex rows can pollute suggested matches | Candidate tests do not explicitly gate out flex child rows and legacy `FLEX-...` rows | Flex visibility rules were never codified into the regression suite | Add candidate-filtering integration coverage |
| Undo confidence can erode after future changes | Bulk unmatch now passes, but the exact flex-child cleanup and normalized-line restoration path is trust-critical | A passing test exists, but it must remain in the UAT gate and may need stronger assertions | Keep and extend bulk unmatch regression coverage as a release gate |
| DB-backed validation is easy to skip | Default `npm test` does not guarantee a disposable Postgres run | Integration enablement is opt-in and operationally separate | Create a documented pre-UAT gate command and checklist |

## Remediation workstreams

### 1. Codify the disposable-Postgres test gate

- Define the official pre-UAT validation contract:
  - `npm run build`
  - default `npm test`
  - sequential DB-backed integration gate on a disposable Postgres database
- Use the existing integration harness, but run it with `--test-concurrency=1`.
- Document the required environment:
  - `RUN_INTEGRATION_TESTS=1`
  - `TEST_DATABASE_URL=<disposable-postgres-url>`
- Add a dedicated script or runbook entry so engineers do not rely on memory or ad hoc shell history.

Recommended command shape:

```powershell
$env:RUN_INTEGRATION_TESTS='1'
$env:TEST_DATABASE_URL='postgresql://app:password@127.0.0.1:5432/commissable_crm_uat_gate_20260323'
node --import tsx --test --test-concurrency=1 tests/integration-revenue-schedule-change-start-date.test.ts tests/integration-reconciliation-candidates.test.ts tests/integration-reconciliation-unmatch-regression.test.ts tests/integration-reconciliation-variance-flex.test.ts tests/integration-reconciliation-match-flow.test.ts tests/integration-reconciliation-rate-discrepancy.test.ts
```

Exit criteria:

- The team has one repeatable disposable-DB command for the pre-UAT gate.

### 2. Add missing regression coverage for Change Start Date

- Expand `tests/integration-revenue-schedule-change-start-date.test.ts` to cover:
  - internal collision inside the selected schedules
  - external collision against an existing schedule in the same scope
  - non-collision when a schedule exists outside the intended scope
  - user-facing collision text does not include raw ids
- If a preview endpoint is added for Change Start Date, include preview route assertions in the same suite or a companion suite.
- Validate the same date examples used in the client memo where possible.

Exit criteria:

- Start-date collision behavior is protected by DB-backed regression tests.

### 3. Add missing regression coverage for flex candidate filtering

- Expand `tests/integration-reconciliation-candidates.test.ts` to cover:
  - normal schedule appears as a candidate
  - flex child schedule does not appear as a normal candidate
  - legacy `FLEX-...` row does not appear as a normal candidate
  - parent detail or flex-review flows can still retrieve the same flex row through the correct specialized path
- Seed both normal and flex rows in the same account/product space so the exclusion is meaningful.

Exit criteria:

- Candidate filtering becomes an explicit part of the UAT gate instead of an implied behavior.

### 4. Keep bulk unmatch reversal in the release gate and strengthen it where needed

- Keep `tests/integration-reconciliation-unmatch-regression.test.ts` in the pre-UAT suite.
- Strengthen assertions for the flex-child cleanup path if needed:
  - created child schedule is deleted or retired correctly
  - normalized deposit line values are restored
  - no flex artifact remains visible to normal candidate search after undo
- Preserve the passing March 18 behavior as the minimum acceptable baseline.

Exit criteria:

- The bulk unmatch trust path is part of every UAT certification run.

### 5. Produce a lightweight validation artifact for each UAT cycle

- After the gate runs, record:
  - date of run
  - disposable DB identifier or naming convention
  - commit or branch
  - tests executed
  - pass/fail counts
  - open blockers
- Store the summary in `docs/analysis` so the team can compare UAT readiness over time.
- If the gate fails, do not rely on verbal confirmation. Capture the failing scenario and exact test name in the artifact.

Exit criteria:

- Every UAT cycle has a concrete validation record, not just a claim that tests were run.

## Suggested implementation order

1. Document the disposable-DB command and pre-UAT checklist.
2. Add Change Start Date collision regressions.
3. Add flex candidate-filter regressions.
4. Reconfirm bulk unmatch regression assertions.
5. Run the full pre-UAT gate sequentially on a disposable database.
6. Publish a short validation report in `docs/analysis`.

## Expected file touchpoints

- `package.json`
- `tests/integration-test-helpers.ts`
- `tests/integration-revenue-schedule-change-start-date.test.ts`
- `tests/integration-reconciliation-candidates.test.ts`
- `tests/integration-reconciliation-unmatch-regression.test.ts`
- `tests/integration-reconciliation-variance-flex.test.ts`
- `tests/integration-reconciliation-match-flow.test.ts`
- `tests/integration-reconciliation-rate-discrepancy.test.ts`
- `docs/analysis`

## Acceptance criteria

- The team has one documented sequential integration command that runs against a disposable Postgres database.
- The pre-UAT gate includes Change Start Date, candidate filtering, and unmatch reversal coverage.
- Start-date collision regressions are implemented and passing.
- Flex candidate-filter regressions are implemented and passing.
- Bulk unmatch reversal remains green in the pre-UAT gate.
- A dated validation artifact is produced before the next UAT cycle.

## Risks and open decisions

- If the team keeps relying on `npm test` alone, DB-backed regressions will continue to be skipped in normal workflows.
- The current integration harness truncates shared tables, so parallel execution must remain disabled unless the harness is redesigned.
- Disposable DB creation and teardown need an owner for UAT week so the gate does not become "someone should run it" work.

