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
  - **To implement**: requires adding tests or harness code.
- For items that are "API-only", you can validate via:
  - an automated test runner (recommended), or
  - a Postman/newman collection, or
  - a small Node/TS script (Prisma + fetch), or
  - AI verification of captured JSON/DB snapshots.

---

## Baseline runnable checks (repo-wide) (Runnable now)

- [ ] **AUTO-RUN-01** Run unit tests: `npm test`
  - Expected: all tests in `tests/*.test.ts` pass.
- [ ] **AUTO-RUN-02** Run lint: `npm run lint`
  - Expected: lint passes (or failures are understood and tracked).
- [ ] **AUTO-RUN-03** (Optional) Build: `npm run build`
  - Expected: build succeeds.

---

# Deposit Upload - automated checks (docs/guides/deposit-upload.md)

## Where it lives (routes + implementation)

- [ ] **DU-AUTO-01 (Runnable now)** Static route presence check
  - Method: verify the following files exist:
    - `app/(dashboard)/reconciliation/deposit-upload-list/page.tsx`
    - `app/api/reconciliation/deposits/import/route.ts`
  - Expected: files present; imports resolve.

## Workflow > 2) Create deposit context (who/when/what)

- [ ] **DU-AUTO-02 (To implement)** UI gating logic (no browser)
  - Method: unit test the "canProceed" gating in `components/deposit-upload/create-template-step.tsx` by extracting the predicate or testing via a lightweight component test harness.
  - Expected: proceed disabled unless required inputs are present.

## Workflow > 3) Map fields (column-to-field mapping)

- [ ] **DU-AUTO-03 (Runnable now)** Field suggestion heuristics
  - Method: run existing tests:
    - `tests/deposit-upload-field-suggestions.test.ts`
  - Expected: suggestions behave consistently for common header names.

- [ ] **DU-AUTO-04 (Runnable now)** Header resolution / ambiguity
  - Method: run existing tests:
    - `tests/deposit-upload-resolve-header.test.ts`
  - Expected: ambiguous/missing headers are detected and return a stable error shape.

- [ ] **DU-AUTO-05 (Runnable now)** Template auto-seeding match logic
  - Method: run existing tests:
    - `tests/deposit-upload-template-matching.test.ts`
  - Expected: Telarus template matcher returns expected mapping for known vendor/distributor pairs.

- [ ] **DU-AUTO-06 (To implement)** Mapping config roundtrip
  - Method: add unit tests for `lib/deposit-import/template-mapping.ts`:
    - `seedDepositMapping()` removes invalid headers
    - `setColumnSelection()` enforces 1:1 canonical mapping
    - `serializeDepositMappingForTemplate()` and `extractDepositMappingFromTemplateConfig()` roundtrip safely
  - Expected: mapping config roundtrips and remains valid.

## What gets created (server behavior) > File parsing

- [ ] **DU-AUTO-07 (To implement)** CSV parsing contract tests
  - Method: unit test `lib/deposit-import/parse-file.ts`:
    - rejects empty/no-header CSV
    - trims/normalizes rows
    - skips empty lines
  - Expected: returned `{ headers, rows }` is correct and stable.

- [ ] **DU-AUTO-08 (To implement)** Excel parsing contract tests
  - Method: unit test Excel parsing path using a small fixture XLSX in test assets.
  - Expected: header row is used; rows are parsed and normalized.

- [ ] **DU-AUTO-09 (To implement)** Unsupported file type rejection
  - Method: parse a fake `.pdf` and assert it throws "Unsupported file type".
  - Expected: consistent error.

## What gets created (server behavior) > Import route contract tests (API-level, no browser)

These are best implemented as integration tests against a disposable DB (SQLite/Postgres test schema).

- [ ] **DU-AUTO-10 (To implement)** Required mappings enforced
  - Target: `POST /api/reconciliation/deposits/import`
  - Expected: 400 when `usage` or `commission` mapping is missing.

- [ ] **DU-AUTO-11 (To implement)** Ambiguous/missing mapped column errors
  - Expected: 400 with clear message when a mapped header is ambiguous or missing.

- [ ] **DU-AUTO-12 (To implement)** Commission-only row behavior
  - Expected DB state: when usage is missing but commission exists, line item usage equals commission; commissionRate becomes 1.0.

- [ ] **DU-AUTO-13 (To implement)** Line payment date parsing
  - Expected: Excel serial date and ISO date strings map to `DepositLineItem.paymentDate`; missing column falls back to deposit date.

- [ ] **DU-AUTO-14 (To implement)** Idempotency behavior
  - Expected:
    - same `idempotencyKey` with completed job returns the same `depositId`
    - same key in-flight returns 409.

- [ ] **DU-AUTO-15 (To implement)** Template persistence toggle behavior
  - Expected:
    - when `saveTemplateMapping=true`, template config is updated/created
    - when false, template remains unchanged

---

# Reconciliation - automated checks (docs/guides/reconciliation.md)

## Settings that affect reconciliation

- [ ] **REC-AUTO-01 (Runnable now)** Flex decision logic unit tests
  - Method: run existing test `tests/revenue-schedule-flex-decision.test.ts`
  - Expected: tolerance/overage logic remains stable and explainable.

- [ ] **REC-AUTO-02 (To implement)** Settings persistence tests (API-level)
  - Targets:
    - `GET|POST /api/reconciliation/settings` (tenant)
    - `GET|POST /api/reconciliation/user-settings` (user confidence thresholds)
  - Expected: values are stored and retrieved consistently; bounds checking enforced.

## Pages > Deposits list API (`GET /api/reconciliation/deposits`)

- [ ] **REC-AUTO-03 (To implement)** Filtering + pagination contract
  - Expected:
    - `pageSize` is capped at 100
    - `from/to` filters by `paymentDate`
    - `q` filters by deposit name and related account names
    - invalid status/paymentType returns 400

## Deposit detail API (`GET /api/reconciliation/deposits/[depositId]/detail`)

- [ ] **REC-AUTO-04 (To implement)** Metadata + line item shape contract
  - Expected: stable metadata fields (`usageTotal`, `allocated`, `unallocated`, `status`, `reconciled`) and line item fields (usage/commission + other identifiers).

## Suggested matches API (`GET /api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates`)

- [ ] **REC-AUTO-05 (To implement)** Candidate generation honors include-future and engine mode
  - Expected:
    - include-future expands date window (default window is +/- 1 month in matcher)
    - hierarchical vs legacy scoring changes `matchType`/confidence behavior

- [ ] **REC-AUTO-06 (To implement)** User confidence filtering
  - Expected: candidates below `reconciliation.suggestedMatchesMinConfidence` are excluded from response when status is "Suggested".

## Apply match / unmatch APIs

- [ ] **REC-AUTO-07 (To implement)** Manual match allocation math
  - Target: `POST .../apply-match`
  - Expected:
    - cannot allocate ignored/reconciled line items
    - cannot allocate more than remaining unallocated amounts
    - creates or updates `DepositLineMatch` as Applied
    - updates `DepositLineItem` allocation fields + status (Unmatched/PartiallyMatched/Matched)
    - updates deposit aggregates

- [ ] **REC-AUTO-08 (To implement)** Unmatch clears all allocations for a line
  - Target: `POST .../unmatch`
  - Expected:
    - deletes all matches for the line
    - resets primaryRevenueScheduleId and allocations
    - recomputes affected schedules and deposit aggregates

## Variance handling / flex resolution

- [ ] **REC-AUTO-09 (To implement)** Auto-adjust when overage is within tolerance
  - Target: `POST .../apply-match`
  - Expected: when overage <= tolerance, an adjustment split is created automatically and schedule recomputed.

- [ ] **REC-AUTO-10 (To implement)** Prompt path when overage exceeds tolerance
  - Expected: response includes a `flexDecision` indicating prompt and allowed actions.

- [ ] **REC-AUTO-11 (To implement)** Negative line triggers chargeback pending
  - Expected:
    - creates flex chargeback schedule + a Suggested match
    - line becomes Suggested (pending approval)
    - a flex review item is enqueued

- [ ] **REC-AUTO-12 (To implement)** Resolve-flex API creates adjustment/flex product and (optional) applies to future schedules
  - Target: `POST .../resolve-flex`
  - Expected:
    - action Adjust/FlexProduct/Manual behaves as documented
    - applyToFuture updates eligible future schedules in scope when action=Adjust

## AI adjustment preview/apply APIs

- [ ] **REC-AUTO-13 (To implement)** AI adjustment preview returns recommendation + scope/future schedule list
  - Target: `POST .../ai-adjustment/preview`
  - Expected: preview includes suggestion type (allocate vs adjust), base overage values, and future schedule count/list.

- [ ] **REC-AUTO-14 (To implement)** AI adjustment apply updates current and (optional) future schedules
  - Target: `POST .../ai-adjustment/apply`
  - Expected: creates adjustment split; when applyToFuture=true, updates future schedules and returns IDs.

## Auto-match APIs

- [ ] **REC-AUTO-15 (To implement)** Auto-match preview respects user auto-match confidence threshold
  - Target: `POST /api/reconciliation/deposits/[depositId]/auto-match/preview`
  - Expected: only top candidates >= `reconciliation.autoMatchMinConfidence` are included.

- [ ] **REC-AUTO-16 (To implement)** Auto-match apply persists matches with source Auto
  - Target: `POST /api/reconciliation/deposits/[depositId]/auto-match`
  - Expected: creates Applied matches with `source: Auto`, updates line and deposit aggregates.

## Finalize / unfinalize APIs

- [ ] **REC-AUTO-17 (To implement)** Finalize blocks when Unmatched or Suggested lines exist
  - Target: `POST .../finalize`
  - Expected: 400 with clear message when open lines exist.

- [ ] **REC-AUTO-18 (To implement)** Finalize locks records and marks reconciled flags
  - Expected DB state:
    - deposit is `reconciled=true` and `reconciledAt` set
    - matched/partially matched lines become `reconciled=true`
    - applied matches become `reconciled=true`

- [ ] **REC-AUTO-19 (To implement)** Unfinalize clears reconciled flags and recomputes schedules
  - Target: `POST .../unfinalize`
  - Expected: deposit reopens; lines/matches un-reconciled; schedule statuses recomputed.

- [ ] **REC-AUTO-20 (To implement)** Known inconsistency regression test
  - Purpose: protect against finalize treating `status === "Completed"` as already finalized when `reconciled=false`.
  - Expected: either finalize succeeds, or behavior is explicitly changed and tested.

## Flex review APIs

- [ ] **FLEX-AUTO-01 (To implement)** Queue contract (`GET /api/flex-review`)
  - Expected: stable fields, sorting, and permission enforcement (`reconciliation.manage`).

- [ ] **FLEX-AUTO-02 (To implement)** Assign contract (`POST /api/flex-review/[itemId]/assign`)
  - Expected: assignment persists; assignee must be a reconciliation manager; notifications created.

- [ ] **FLEX-AUTO-03 (To implement)** Approve-and-apply updates source deposit
  - Target: `POST /api/flex-review/[itemId]/approve-and-apply`
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

