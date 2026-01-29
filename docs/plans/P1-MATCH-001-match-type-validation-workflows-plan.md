# P1-MATCH-001 — Match-Type Validation + 1:1 / 1:Many / Many:1 Workflows (Implementation Plan)

Date: 2026-01-29  
Owner: Engineering / Product  
Scope: Reconciliation “Match” action (deposit line items ↔ revenue schedules)

This document expands P1-MATCH-001 from the master plan into an implementation-ready spec + checklist for shipping:

- Match-type validation on **Match**
- Explicit detection + routing for:
  - **1:1** (one deposit line → one schedule)
  - **1:Many** (one deposit line → multiple schedules)
  - **Many:1** (multiple deposit lines → one schedule)
- A guided UI (“wizard”) for 1:Many and Many:1
- A consistent backend “bulk apply” path that preserves today’s flex/chargeback behaviors
- Audit logging capturing match-type and user decisions (“learn from user actions”)

---

## 1) Glossary / Entities (as implemented)

- **Deposit**: a vendor/distributor payment batch (contains many line items).
- **Deposit Line Item** (`DepositLineItem`): a row in the deposit file with actual usage/commission.
- **Revenue Schedule** (`RevenueSchedule`): an expected monthly “bucket” for usage/commission.
- **Deposit Line Match** (`DepositLineMatch`): join record linking a deposit line to a revenue schedule, with allocated amounts.

Key existing endpoints and codepaths:

- UI reconciliation detail view:
  - `components/deposit-reconciliation-detail-view.tsx`
- Apply a manual match (currently single line + single schedule per click):
  - `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route.ts`
- Unmatch a line (removes all matches for that line):
  - `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route.ts`
- Auto-match (batch, but still 1 line → 1 schedule per line):
  - `app/api/reconciliation/deposits/[depositId]/auto-match/route.ts`
  - `app/api/reconciliation/deposits/[depositId]/auto-match/preview/route.ts`

---

## 2) Current State (what the system does today)

### 2.1 UI constraints

- The UI allows multi-select in the schedules table, but **Match** is effectively constrained to **one line** + **one schedule**:
  - It blocks multiple schedules (“Select only one schedule to match to”).
  - The bulk action tooltip indicates “Select exactly one line item to match”.

### 2.2 Backend behavior (important for planning)

The backend already supports:

- Multiple `DepositLineMatch` rows per deposit line (partial allocation / split allocations).
- Deposit aggregates and line allocations recomputation after matches.
- Flex/chargeback handling triggered from “apply match”:
  - Negative lines can trigger Flex Chargeback creation.
  - Overages within tolerance can trigger auto-adjust split.
  - Overages outside tolerance can trigger a “prompt” decision.

So, the core missing piece is not the data model; it’s:

1) validation + routing, and  
2) a first-class bulk apply action that can apply many match rows in one user-driven workflow.

---

## 3) Target Behavior (what “done” means for P1-MATCH-001)

### 3.1 Match-type detection on Match click

Let:

- `L = number of selected deposit lines`
- `S = number of selected schedules`

Detect:

- `L=1 && S=1` → **1:1**
- `L=1 && S>1` → **1:Many**
- `L>1 && S=1` → **Many:1**
- `L>1 && S>1` → **M:N** (explicitly blocked in v1; future story)

### 3.2 Routing rules

- **1:1**: apply immediately (existing flow remains the “fast path”).
- **1:Many**: open a guided flow (wizard) and apply multiple allocations in one action.
- **Many:1**: open a guided flow (wizard) and apply multiple allocations in one action.
- Always show a clear message in the UI: “Detected match type: 1:1 / 1:Many / Many:1”.

### 3.3 Logging (“system learns from user actions”)

At minimum, log:

- Detected match type
- Allocation strategy (FIFO / proportional / manual)
- Selected IDs and allocation plan (not full PII; use IDs + amounts)
- Outcome (success, blocked validation, flex prompt path chosen, etc.)

---

## 4) Workflows (detailed)

## 4.1 1:1 Workflow (one deposit line → one schedule)

### UX
1) User selects exactly one deposit line and exactly one schedule.
2) UI indicates “Detected 1:1”.
3) User clicks Match.
4) System applies match immediately and updates line/schedule/deposit.

### Backend
Use existing endpoint:

- `POST /api/reconciliation/deposits/:depositId/line-items/:lineId/apply-match`

### Validation (must block)
- Deposit line `reconciled=true` → block.
- Deposit line status `Ignored` → block.
- Schedule status `Reconciled` → block.
- Negative line amounts: the existing endpoint already routes to chargeback behavior; UI should still allow it but should message clearly that this is a chargeback/flex path.

### Acceptance criteria
- 1:1 match still works exactly as today.
- Audit log captures `matchTypeDetected=1:1`.

---

## 4.2 1:Many Workflow (one deposit line → multiple schedules)

### Why this exists
This covers both:

- **Prepayment** behavior: one payment covers multiple future periods (FIFO allocation).
- **Bundled billing** behavior: vendor bills one combined line for multiple internal schedules/products.

For P1-MATCH-001 we ship an allocation wizard; deeper “product consolidation” is a Phase 2 (see section 9).

### Trigger
- `L=1` and `S>1`

### Wizard: minimum v1 steps

**Step A — Confirm match type**
- Show selected line summary (unallocated usage/commission).
- Show count + list of selected schedules (dates, expected balances, current allocated).
- Display: “Detected 1:Many”.

**Step B — Select allocation strategy**
- `FIFO` (recommended default v1):
  - Sort schedules by `scheduleDate` ascending.
  - Allocate usage/commission across schedules in order until the line’s unallocated amount is exhausted.
- `Proportional` (optional v1):
  - Allocate across schedules by their expected net usage/commission weights.
- `Manual` (always available):
  - User edits per-schedule usage/commission allocations directly.

**Step C — Validate totals**
- Total allocated usage must be `<= line.usageUnallocated` (plus a small epsilon).
- Total allocated commission must be `<= line.commissionUnallocated` (plus epsilon).
- Allocations must not be negative.

**Step D — Apply**
- Apply allocations in one transaction.
- Return updated line allocations, updated deposit aggregates, and recomputed schedules.
- If flex variance prompts are produced for any affected base schedule, present them inline and require a choice before completing.

### Backend: required capability
Implement a single “bulk apply” endpoint that can create/update many `DepositLineMatch` rows at once.

Recommended route (new):

- `POST /api/reconciliation/deposits/:depositId/apply-matches`

Example request body:

```json
{
  "mode": "one_to_many",
  "allocations": [
    { "lineId": "dl_1", "revenueScheduleId": "rs_a", "usageAmount": 100, "commissionAmount": 10 },
    { "lineId": "dl_1", "revenueScheduleId": "rs_b", "usageAmount": 50, "commissionAmount": 5 }
  ]
}
```

Response should include enough for the UI to refresh without extra queries:

```json
{
  "data": {
    "deposit": { "...": "..." },
    "updatedLines": [ /* updated line rows */ ],
    "updatedSchedules": [ /* schedule rows or schedule ids */ ],
    "flexPrompts": [ /* optional prompts requiring user action */ ]
  }
}
```

### Acceptance criteria
- User can select one line + multiple schedules and successfully apply allocations.
- FIFO allocation works for prepayment-style flows.
- Audit log captures `matchTypeDetected=1:Many` and `allocationStrategy`.

---

## 4.3 Many:1 Workflow (multiple deposit lines → one schedule)

### Why this exists
This covers:

- **Partial payments**: multiple deposit lines pay down one schedule.

Note: the docs also describe a larger “expand to separate products” concept in some Many:1 situations; that is Phase 2 (section 9).

### Trigger
- `L>1` and `S=1`

### Wizard: minimum v1 steps

**Step A — Confirm match type**
- Show schedule summary (expected vs actual, current balance).
- Show selected lines (each with unallocated usage/commission).
- Display: “Detected Many:1”.

**Step B — Draft allocations**
Default v1 suggestion:
- For each selected line, allocate its entire unallocated usage/commission to the chosen schedule.

Allow “Manual” override per line:
- User can reduce allocations per line (but not exceed the line’s unallocated).

**Step C — Validate**
- No negative allocations.
- No allocations above each line’s unallocated.
- Schedule may accept multiple lines; after apply, recompute schedule status.

**Step D — Apply**
- Apply allocations for all selected lines to the schedule in one transaction.
- If this creates an overage scenario outside tolerance, surface flex prompt choices.

### Backend: required capability
Use the same bulk endpoint as 1:Many; only the payload differs.

Example:

```json
{
  "mode": "many_to_one",
  "allocations": [
    { "lineId": "dl_1", "revenueScheduleId": "rs_a", "usageAmount": 30, "commissionAmount": 3 },
    { "lineId": "dl_2", "revenueScheduleId": "rs_a", "usageAmount": 70, "commissionAmount": 7 }
  ]
}
```

### Acceptance criteria
- User can select multiple lines + one schedule and match in one action.
- Audit log captures `matchTypeDetected=Many:1` and allocation decisions.

---

## 5) Validation Matrix (v1 rules)

### Selection validation

- `L=0` → error: “Select at least one deposit line item.”
- `S=0` → error: “Select at least one schedule.”
- `L>1 && S>1` → block: “M:N matching not supported yet.” (future story)

### Domain validation (must-block)

If any selected deposit line item:
- `reconciled=true` → block.
- `status=Ignored` → block.

If selected schedule:
- `status=Reconciled` → block.

### Negative line items

If any selected line has negative usage or commission:
- v1 recommended behavior:
  - block bulk workflows and require handling those lines individually, OR
  - split the selection: run chargeback creation per negative line and continue for non-negative lines (more complex).

Decision required before implementation (see Open Questions).

---

## 6) Implementation Plan (milestones + deliverables)

### Milestone 0 — Confirm scope and defaults
- Confirm whether v1 includes:
  - FIFO allocation for 1:Many (recommended)
  - Proportional allocation (optional)
  - Handling for negative lines in bulk selection

### Milestone 1 — UI: match-type detection + routing
- Update `components/deposit-reconciliation-detail-view.tsx` so Match can be invoked when `S>1` or `L>1`.
- Add `detectMatchType(L,S)` and route:
  - 1:1 → existing apply-match
  - 1:Many → open wizard
  - Many:1 → open wizard
  - M:N → show a clear blocked message

### Milestone 2 — Backend: bulk apply endpoint (core)
- Add a new endpoint (recommended):
  - `app/api/reconciliation/deposits/[depositId]/apply-matches/route.ts`
- In a single transaction:
  - Upsert `DepositLineMatch` rows for all allocations
  - Recompute each affected line’s allocations/status
  - Recompute affected schedule(s) statuses/actuals
  - Recompute deposit aggregates
- Ensure it reuses the same core recompute and flex decision utilities where possible (avoid duplicated math).

### Milestone 3 — 1:Many wizard (FIFO v1)
- Create the wizard UI states in `components/deposit-reconciliation-detail-view.tsx` (or extract a new component).
- Implement FIFO draft allocation generation and validation.
- Call bulk apply and handle flex prompts.

### Milestone 4 — Many:1 wizard
- Implement per-line allocation drafting and validation.
- Call bulk apply and handle flex prompts.

### Milestone 5 — Audit + metrics
- Log:
  - match type
  - chosen strategy
  - allocation plan summary
  - outcome
- Prefer existing audit helpers:
  - `lib/audit.ts` via `logAudit` and (if needed) `logRevenueScheduleAudit`
  - matching metrics via `lib/matching/metrics`

### Milestone 6 — Tests
Add minimal coverage where tests already exist in the repo:
- Backend:
  - 1:Many FIFO allocation applies correct totals
  - Many:1 allocation applies correct totals
  - M:N is blocked
  - reconciled/ignored/reconciled schedule blocks
- UI:
  - detection routing (unit test if applicable; otherwise manual QA checklist)

### Milestone 7 — Rollout
- Add a feature flag (env or tenant preference):
  - Enable match-type workflows for UAT tenants first.
- Provide a short QA checklist for Rob/UAT:
  - 1:1 happy path
  - 1:Many FIFO prepayment
  - Many:1 partial payments
  - M:N blocked

---

## 7) Edge Cases / Guardrails (v1 decisions)

### “Already matched” lines
If selected lines already have applied matches:
- v1 recommended:
  - Wizard should draft allocations only from `usageUnallocated` / `commissionUnallocated` and allow incremental allocations.
  - If the user wants to redo entirely, require explicit Unmatch first (safer).

### Floating point tolerances
Use a consistent epsilon (the code currently uses small EPSILON values in places); ensure allocation validations use the same tolerance everywhere.

### Schedule ordering for FIFO
Use `scheduleDate` ascending, and define tie-breakers (schedule number, createdAt) to ensure deterministic behavior.

---

## 8) Out of Scope for P1-MATCH-001 (explicit)

- M:N matching (multiple lines ↔ multiple schedules in one operation)
- Product consolidation / product expansion workflows that create/remove products and regenerate future schedules
- “Learning loop” persistence beyond audit logging (e.g., SKU mapping tables, name variations tables)

---

## 9) Follow-on Stories (Phase 2 candidates)

These are described in the reconciliation spec docs but are larger than “detect + route”.

### 9.1 1:Many “Consolidate” flow (structural)
When one deposit line corresponds to multiple internal products/schedules, consolidate into a single product/schedule series to match vendor billing format.

### 9.2 Many:1 “Expand” flow (structural)
When many deposit lines correspond to one internal product/schedule, expand into multiple products/schedules to match vendor itemization format.

Both require:
- product creation UI
- schedule regeneration rules
- careful historical data handling

---

## 10) Open Questions (must answer before build)

1) For v1 1:Many, do we ship **FIFO** only (recommended), or include proportional allocation too?
2) In bulk workflows, how do we handle **negative lines**?
   - block bulk selections that contain negatives (simplest), or
   - allow and process them with chargeback creation per line (more complex)
3) When a user selects multiple lines where some are already partially matched, do we:
   - allow incremental allocations (recommended), or
   - force “Unmatch first” for those lines?

