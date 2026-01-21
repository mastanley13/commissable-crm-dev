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
| DU-AUTO-06 | [ ] | [ ] | [ ] | `tests/deposit-import-template-mapping.test.ts` | Unit tests for `lib/deposit-import/template-mapping.ts` roundtrip + constraints. |
| DU-AUTO-07 | [ ] | [ ] | [ ] | `tests/deposit-import-parse-csv.test.ts` | Contract tests for `lib/deposit-import/parse-file.ts` CSV path. Add CSV fixtures. |
| DU-AUTO-08 | [ ] | [ ] | [ ] | `tests/deposit-import-parse-xlsx.test.ts` | Add `tests/fixtures/deposit-import/*.xlsx` and validate normalization/date handling. |
| DU-AUTO-09 | [ ] | [ ] | [ ] | `tests/deposit-import-parse-unsupported.test.ts` | Assert consistent “unsupported file type” error. |
| DU-AUTO-10 | [ ] | [ ] | [ ] | `tests/integration/deposit-import-required-mappings.test.ts` | Needs integration DB + ability to call `POST /api/reconciliation/deposits/import`. |
| DU-AUTO-11 | [ ] | [ ] | [ ] | `tests/integration/deposit-import-missing-headers.test.ts` | Validate ambiguous/missing mapped column errors. |
| DU-AUTO-12 | [ ] | [ ] | [ ] | `tests/integration/deposit-import-commission-only.test.ts` | Validate commission-only row behavior in DB. |
| DU-AUTO-13 | [ ] | [ ] | [ ] | `tests/integration/deposit-import-payment-date.test.ts` | Excel serial date + ISO date strings + fallback rules. |
| DU-AUTO-14 | [ ] | [ ] | [ ] | `tests/integration/deposit-import-idempotency.test.ts` | Requires known idempotency storage mechanism + assertions. |
| DU-AUTO-15 | [ ] | [ ] | [ ] | `tests/integration/deposit-import-template-persistence.test.ts` | Requires knowing where templates are stored and the toggle source (tenant/user setting). |

### Reconciliation (To implement)

| ID | Implement | Runnable | CI | Suggested file(s) | Notes / dependencies |
|---|---|---|---|---|---|
| REC-AUTO-02 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-settings.test.ts` | Requires settings API endpoints + permission enforcement. |
| REC-AUTO-03 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-list-filtering.test.ts` | Deposit list filtering/pagination/sort contract. |
| REC-AUTO-04 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-deposit-detail-shape.test.ts` | Detail endpoint returns stable metadata + line item shapes. |
| REC-AUTO-05 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-candidates-engine-modes.test.ts` | Candidate generation honors include-future + engine mode. |
| REC-AUTO-06 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-candidates-confidence.test.ts` | Confidence threshold filtering. |
| REC-AUTO-07 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-apply-match-allocation-math.test.ts` | DB assertions on allocations, totals, rounding. |
| REC-AUTO-08 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-unmatch-resets.test.ts` | Unmatch clears allocations + recomputes schedule/deposit aggregates. |
| REC-AUTO-09 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-flex-auto-adjust.test.ts` | Overages within tolerance auto-adjust path. |
| REC-AUTO-10 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-flex-prompt.test.ts` | Overages above tolerance returns `flexDecision` prompt shape. |
| REC-AUTO-11 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-negative-line-chargeback.test.ts` | Negative line triggers chargeback pending + Suggested match + flex review enqueue. |
| REC-AUTO-12 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-resolve-flex.test.ts` | Resolve-flex API for Adjust/FlexProduct/Manual + optional apply-to-future. |
| REC-AUTO-13 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-ai-adjustment-preview.test.ts` | Preview returns recommendation + scope + future schedule list. |
| REC-AUTO-14 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-ai-adjustment-apply.test.ts` | Apply updates current (+ optional future) schedules; asserts returned IDs. |
| REC-AUTO-15 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-auto-match-preview.test.ts` | Preview respects threshold and candidate ordering. |
| REC-AUTO-16 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-auto-match-apply.test.ts` | Apply persists matches with `source: Auto` + recompute invariants. |
| REC-AUTO-17 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-finalize-blocks-open-lines.test.ts` | Finalize blocks when Unmatched/Suggested lines exist. |
| REC-AUTO-18 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-finalize-flags.test.ts` | Finalize sets `reconciled` flags/timestamps across deposit/lines/matches. |
| REC-AUTO-19 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-unfinalize.test.ts` | Unfinalize clears flags + recomputes schedules. |
| REC-AUTO-20 | [ ] | [ ] | [ ] | `tests/integration/reconciliation-finalize-regression-completed-vs-reconciled.test.ts` | Regression: `status==="Completed"` but `reconciled=false` should be handled explicitly. |

### Flex review (To implement)

| ID | Implement | Runnable | CI | Suggested file(s) | Notes / dependencies |
|---|---|---|---|---|---|
| FLEX-AUTO-01 | [ ] | [ ] | [ ] | `tests/integration/flex-review-queue.test.ts` | `GET /api/flex-review` contract + sort + permission gating. |
| FLEX-AUTO-02 | [ ] | [ ] | [ ] | `tests/integration/flex-review-assign.test.ts` | `POST /api/flex-review/[itemId]/assign` persistence + RBAC. |
| FLEX-AUTO-03 | [ ] | [ ] | [ ] | `tests/integration/flex-review-approve-and-apply.test.ts` | Approve/apply updates source deposit/matches + recomputes aggregates. |

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

