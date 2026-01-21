# Plan: Implement “NOT RUN” Automated Checks (Deposit Upload + Reconciliation)

This plan converts the “To implement / NOT RUN” items from:
- `docs/guides/automated-checklist-deposit-upload-reconciliation.md`
- `docs/guides/automated-checklist-results-deposit-upload-reconciliation-2026-01-21.md`

…into a tracked implementation roadmap with a per-check checkbox matrix and suggested test file structure.

---

## Scope

Implement and run the following automated checks:
- **DU-AUTO-06..DU-AUTO-15**
- **REC-AUTO-02..REC-AUTO-20**
- **FLEX-AUTO-01..FLEX-AUTO-03**
- **AI-VERIFY-01..AI-VERIFY-02**

---

## Key prerequisites / enabling decisions

- **Integration test strategy**
  - Option A (fast): import Next route handlers and invoke them with mocked `Request`/`NextRequest`.
  - Option B (realistic): start a Next server and call endpoints via `fetch()`.
- **Test DB strategy**
  - Recommended: disposable Postgres DB/schema for integration tests.
  - Alternative: SQLite if Prisma schema + code paths support it.
- **Auth strategy for API tests**
  - If endpoints depend on cookies/session: decide on (1) mintable test session, (2) mocked auth context, or (3) explicit test-only bypass gated behind `NODE_ENV=test` and never enabled in production.
- **CI wiring**
  - Decide whether integration tests run by default in `npm test`, or via a separate script (recommended).

---

## Suggested test layout & naming

Current pattern:
- Unit tests live at `tests/*.test.ts` and run with `npm test` (`node --import tsx --test tests/*.test.ts`).

Recommended structure (choose one):

### Option 1: Keep everything under `tests/` root (no script changes)
- Unit tests: `tests/deposit-import-template-mapping.test.ts`
- Integration tests: prefix with `tests/integration-*.test.ts`
  - Gate integration tests on env var (ex: `process.env.TEST_DATABASE_URL`) and `skip()` when missing.

### Option 2 (recommended): Add `tests/integration/` and a separate npm script
- Unit tests (existing): `tests/*.test.ts`
- Integration tests: `tests/integration/*.test.ts`
- Add npm scripts (planned):
  - `test:unit` → existing
  - `test:integration` → `node --import tsx --test tests/integration/*.test.ts`
  - `test:all` → runs both

### Fixtures & helpers
- Fixtures:
  - CSV: `tests/fixtures/deposit-import/*.csv`
  - XLSX: `tests/fixtures/deposit-import/*.xlsx`
  - API capture artifacts (AI-VERIFY): `reports/reconciliation/<depositId>/*.json`
- Helpers (planned):
  - `tests/helpers/db.ts` (migrate/reset/truncate)
  - `tests/helpers/factories.ts` (seed Tenant/User/Deposit/Schedules)
  - `tests/helpers/http.ts` (build requests, parse responses)
  - `tests/helpers/auth.ts` (mint test auth context)

---

## Execution phases (recommended order)

1. **Unit-level correctness first (no DB)**: DU-AUTO-06..DU-AUTO-09
2. **Import API integration**: DU-AUTO-10..DU-AUTO-15
3. **Reconciliation API integration**: REC-AUTO-02..REC-AUTO-20
4. **Flex review integration**: FLEX-AUTO-01..FLEX-AUTO-03
5. **AI verification artifacts + smoke runner**: AI-VERIFY-01..AI-VERIFY-02

---

## Checkbox matrix (per ID)

Legend:
- **Implement**: test/harness exists and is committed.
- **Runnable**: can run locally with documented env setup.
- **CI**: wired into CI pipeline (or a `npm run ...` target used by CI).

### Deposit Upload (To implement)

| ID | Implement | Runnable | CI | Suggested file(s) | Notes / dependencies |
|---|---|---|---|---|---|
| DU-AUTO-06 | [x] | [x] | [ ] | `tests/deposit-import-template-mapping.test.ts` | Unit tests for `lib/deposit-import/template-mapping.ts` roundtrip + constraints (runs in `npm test`). |
| DU-AUTO-07 | [x] | [x] | [ ] | `tests/deposit-import-parse-csv.test.ts` | Runnable via `npm test`. |
| DU-AUTO-08 | [x] | [x] | [ ] | `tests/deposit-import-parse-xlsx.test.ts` | Runnable via `npm test` (generates XLSX in-memory). |
| DU-AUTO-09 | [x] | [x] | [ ] | `tests/deposit-import-parse-unsupported.test.ts` | Runnable via `npm test`. |
| DU-AUTO-10 | [x] | [x] | [ ] | `tests/integration-deposit-import-route.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| DU-AUTO-11 | [x] | [x] | [ ] | `tests/integration-deposit-import-route.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| DU-AUTO-12 | [x] | [x] | [ ] | `tests/integration-deposit-import-route.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| DU-AUTO-13 | [x] | [x] | [ ] | `tests/integration-deposit-import-route.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| DU-AUTO-14 | [x] | [x] | [ ] | `tests/integration-deposit-import-route.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| DU-AUTO-15 | [x] | [x] | [ ] | `tests/integration-deposit-import-route.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |

### Reconciliation (To implement)

| ID | Implement | Runnable | CI | Suggested file(s) | Notes / dependencies |
|---|---|---|---|---|---|
| REC-AUTO-02 | [x] | [x] | [ ] | `tests/integration-reconciliation-settings.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-03 | [x] | [x] | [ ] | `tests/integration-reconciliation-deposits.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-04 | [x] | [x] | [ ] | `tests/integration-reconciliation-deposits.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-05 | [x] | [x] | [ ] | `tests/integration-reconciliation-candidates.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-06 | [x] | [x] | [ ] | `tests/integration-reconciliation-candidates.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-07 | [x] | [x] | [ ] | `tests/integration-reconciliation-match-flow.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-08 | [x] | [x] | [ ] | `tests/integration-reconciliation-match-flow.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-09 | [x] | [x] | [ ] | `tests/integration-reconciliation-variance-flex.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-10 | [x] | [x] | [ ] | `tests/integration-reconciliation-variance-flex.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-11 | [x] | [x] | [ ] | `tests/integration-reconciliation-variance-flex.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-12 | [x] | [x] | [ ] | `tests/integration-reconciliation-variance-flex.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-13 | [x] | [x] | [ ] | `tests/integration-reconciliation-ai-adjustment.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-14 | [x] | [x] | [ ] | `tests/integration-reconciliation-ai-adjustment.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-15 | [x] | [x] | [ ] | `tests/integration-reconciliation-auto-match.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-16 | [x] | [x] | [ ] | `tests/integration-reconciliation-auto-match.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-17 | [x] | [x] | [ ] | `tests/integration-reconciliation-match-flow.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-18 | [x] | [x] | [ ] | `tests/integration-reconciliation-match-flow.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-19 | [x] | [x] | [ ] | `tests/integration-reconciliation-match-flow.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| REC-AUTO-20 | [x] | [x] | [ ] | `tests/integration-reconciliation-finalize-regression.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |

### Flex review (To implement)

| ID | Implement | Runnable | CI | Suggested file(s) | Notes / dependencies |
|---|---|---|---|---|---|
| FLEX-AUTO-01 | [x] | [x] | [ ] | `tests/integration-flex-review.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| FLEX-AUTO-02 | [x] | [x] | [ ] | `tests/integration-flex-review.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |
| FLEX-AUTO-03 | [x] | [x] | [ ] | `tests/integration-flex-review.test.ts` | Requires `RUN_INTEGRATION_TESTS=1` and `TEST_DATABASE_URL`. |

### AI verification mode

| ID | Implement | Runnable | CI | Suggested file(s) | Notes / dependencies |
|---|---|---|---|---|---|
| AI-VERIFY-01 | [ ] | [ ] | [ ] | `scripts/capture-reconciliation-artifacts.ts` (or `.js`) | Requires running app + known dataset + configured auth token/cookies. Writes JSON artifacts for AI review. |
| AI-VERIFY-02 | [ ] | [ ] | [ ] | `scripts/smoke-reconciliation.ts` + `tests/helpers/*` | Seeds minimal dataset, calls key APIs, prints DB summary + saves artifacts; ideal for CI smoke. |

---

## Per-suite “done” definition (so checks are truly complete)

For a check to move from **NOT RUN** → **PASS** in results:
- Test exists and is deterministic.
- The test asserts **both**:
  - API response contract (status + payload shape), and
  - DB invariants (rows created/updated, aggregates recomputed, flags/timestamps correct).
- The test runs cleanly on a fresh DB and is repeatable (idempotent seeds, isolation/truncation).

---

## Known build blocker (affects “build succeeds” but not required for implementing these tests)

Current `npm run build` fails with:
- `components/deposit-reconciliation-detail-view.tsx:3025:37` — `'devMatchingControls' is possibly 'undefined'.`

If CI requires `next build`, this will need to be resolved to get green pipelines even after adding tests.
