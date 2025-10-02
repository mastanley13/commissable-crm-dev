Here’s a clean, staged plan you can hand to your coding agent. It’s organized by phases, with concrete tasks, files to touch, and “done” criteria. Copy/paste as your working checklist.

# Reassignment Implementation — Phased Roadmap

## Guiding approach

* **One engine, many entry points.** Build a single `commission-engine` and reuse it for Level 1 (Opportunity), Level 2 (Account bulk — already exists), Level 3 (Global).
* **Versioned snapshots.** Never mutate historical structures; append effective-dated snapshots and audit deltas.
* **Feature flags.** Gate each phase behind `reassignment_v1.*` flags so you can ship safely.

---

## Phase 0 — Data model & groundwork (foundation)

**Goal:** Add the minimal fields + types needed across all flows; establish a single place to compute and apply reassignment results.

**DB (Prisma or your ORM)**

* `Opportunity`

  * `commissionEndDate: DateTime?`
  * `reassignmentType: Enum('HOUSE_ABSORB','DIRECT_TRANSFER','CUSTOM')?`
  * `reassignmentDate: DateTime?`
  * `reassignmentReason: String?`
  * `commissionStatus: Enum('ACTIVE','ENDED','PENDING_REASSIGN','REASSIGNED') @default('ACTIVE')`
  * `originalCommissionJson: Json` (snapshot at creation if not already stored)
  * `currentCommissionJson: Json` (active splits; totals must = 100)
* `CommissionChange` (new table; immutable audit + versioning)

  * `id, opportunityId, scope: Enum('L1','L2','L3')`
  * `effectiveDate, endDate?`
  * `type: Enum(...)`
  * `beforeJson: Json, afterJson: Json`
  * `reason: String, triggeredByUserId: String`
  * `batchId?: String` (link to a bulk run)
  * `createdAt`
* `ReassignmentBatch` (for Level 2/3 queue)

  * `id, scopeJson: Json` (accounts/opportunity ids filter)
  * `strategyJson: Json` (uniform/segmented rules)
  * `status: Enum('PENDING','RUNNING','COMPLETE','ERROR','CANCELLED')`
  * `errorJson?: Json, createdByUserId, createdAt, executedAt?`
* **Revenue schedule** (if you pay out on schedules):

  * add `prorationApplied: Boolean @default(false)`
  * ensure each schedule has `periodStart, periodEnd`.

**Code scaffolding**

* `lib/commission-engine.ts`

  * `computeNewSplits({currentSplits, type, newRepId?, customSplits?}) -> {afterSplits}`
  * `validateSplits(splits) -> {ok, issues[]}`
  * `applyReassignment({opportunityId, effectiveDate, reason, afterSplits, scope, batchId?})`
* `lib/commission-proration.ts`

  * `prorateSchedules({opportunityId, cutoffDate}) -> adjustments`

**Done when**

* Migrations run.
* Engine functions exist with unit tests (percent math, 100% rule, edge cases).
* Existing Level 2 APIs compile against the new types (no behavior change yet).

---

## Phase 1 — Level 1 (Individual Opportunity) “Manage Commissions”

**Goal:** Allow per-opportunity reassignment with Types A/B/C.

**UI**

* `app/(dashboard)/opportunities/[opportunityId]/page.tsx` (build if missing)
* `components/opportunity-commissions-panel.tsx`

  * “Manage Commissions” button → modal
  * Fields: `Commission_End_Date`, `Reassignment_Date`, `Type` (A/B/C)
  * If **B**: pick **New Rep**; if **C**: editable custom grid (rep + %) with live 100% validation
  * Inline **Impact Preview** (before vs after splits; first-month and next-12-months estimates from `commission-calculator.ts`)

**API**

* `app/api/opportunities/[opportunityId]/commissions/preview/route.ts`
* `app/api/opportunities/[opportunityId]/commissions/reassign/route.ts`

  * Use `commission-engine.applyReassignment`
  * Write `CommissionChange` row
  * Trigger proration worker (Phase 3) behind feature flag

**Done when**

* From an Opportunity page, you can set end/effective dates, choose Type A/B/C, preview, and apply.
* Audit rows write correctly; `currentCommissionJson` updates.

---

## Phase 2 — Implement Commission Types A/B/C (core logic hardening)

**Goal:** Finalize engine rules and reuse in Level 2.

**Engine rules**

* **Type A (House Absorption):** Remove departing rep; increase House % by removed amount.
* **Type B (Direct Transfer):** Replace departing rep with new rep, preserving exact %.
* **Type C (Custom):** Replace/redistribute to specified reps; auto-adjust House to keep 100%.

**Edge cases**

* Multiple subagents present
* Attempt to end House (disallow)
* 100% rounding (lock to 2 decimals; adjust House last)
* Closed/Won or reconciled periods (block or soft-skip)

**Done when**

* Jest tests cover the above and pass.
* Level 2 bulk code paths call the engine (refactor if needed).

---

## Phase 3 — Revenue schedule recalculation & proration

**Goal:** Recompute schedules that straddle `commissionEndDate`/`reassignmentDate`.

**Logic**

* For any schedule with `periodStart < cutoff <= periodEnd`:

  * Split into two schedules (pre / post) or store two computed split-sets for that period.
  * Mark `prorationApplied=true`.
* Write adjustments so Finance can see deltas.

**Code**

* `lib/commission-proration.ts` (complete)
* Call from Level 1/2/3 apply flows
* Extend `lib/commission-calculator.ts` to surface deltas in preview

**Done when**

* Preview shows prorated impact; applying creates correct schedules/adjustments.

---

## Phase 4 — Level 3 (Global Rep) Reassignment Wizard

**Goal:** Manager can bulk reassign by filtering Accounts by owner, choosing a strategy, and executing.

**UI**

* `components/global-reassignment-wizard/` (new)

  * **Step 1 Scope:** source = Accounts list selection (owner filter → selected accounts/opps)
  * **Step 2 Strategy:** Uniform (A/B/C) or **Segmented** (by Account Type, Stage, Deal Size, Geography)
  * **Step 3 Assignment:** For B/C choose replacements, for C define custom % per segment
  * **Step 4 Review & Impact Preview:** counts, $ deltas (month/annual), affected schedules
  * **Step 5 Execute:** enqueue `ReassignmentBatch`
* Entry points:

  * Accounts List (filtered by owner) → **Global Reassign**
  * Contact (Rep) Detail → **Terminate All Commissions** → opens wizard with prefilled scope

**API / Jobs**

* `app/api/reassignment-batches/route.ts` (POST create)
* `app/api/reassignment-batches/[batchId]/route.ts` (GET status)
* `jobs/reassignment-runner.ts` (DB-backed queue or your existing job runner):

  * Resolve scope → enumerate opportunities → call engine per opp → write `CommissionChange` → proration

**Done when**

* You can select a rep’s book, run Uniform or Segmented strategies, and see statuses update.

---

## Phase 5 — Queue, Dashboard & History

**Goal:** Operational visibility for managers and Finance.

**UI**

* `app/(dashboard)/reassignments/page.tsx`

  * **Tabs:** Pending | Running | Complete | Error
  * Columns: BatchId, CreatedBy, Scope summary, Affected Opps/Accounts, Started/Ended, Status, Actions (Cancel if RUNNING, Rollback—Phase 7)
* **Opportunity / Account detail**: “Reassignment History” timeline via `CommissionChange` rows.

**API**

* `app/api/reassignment-batches/list/route.ts`
* `app/api/commission-changes/[entityType]/[entityId]/route.ts`

**Done when**

* Managers see batches and can drill into history per account/opportunity.

---

## Phase 6 — Notifications

**Goal:** Keep stakeholders informed.

**Events & recipients**

* On **Preview ready** (optional): manager
* On **Apply/Batch Complete**: original rep, new rep(s), Finance, manager
* On **Errors**: creator + admins

**Code**

* `lib/notifications.ts` with channel abstractions (email/webhooks/in-app)
* Hook into Level 1/2/3 apply and batch completion

**Done when**

* Notifications fire with links to the affected entities/batch.

---

## Phase 7 — Rollback (48-hour window)

**Goal:** Safe undo for accidental bulk changes.

**Rules**

* Only batches with `COMPLETE` and age ≤ 48h
* Reverse each `CommissionChange` (after→before), re-run proration back
* Log a new `CommissionChange` with `rollbackOf: batchId`

**API/UI**

* `POST /api/reassignment-batches/[batchId]/rollback`
* Button on Batch details (permission: Manager+)

**Done when**

* Rolling back restores prior `currentCommissionJson` and schedules.

---

## Phase 8 — Auto-assignment rules (optional)

**Goal:** Automatic replacement selection when a rep is ended globally.

**Admin config**

* Simple v1: round-robin within Team / Territory
* Advanced: workload, seniority, performance score

**Code**

* `lib/auto-assignment.ts` → `selectReplacement({account, opportunity})`
* Plug into Wizard “Strategy” step as **Auto** option

**Done when**

* Choosing Auto fills replacement rep(s) per rule with a clear audit trail.

---

## Phase 9 — Hardening & permissions

**Goal:** Lock it down and polish.

**Checks**

* Permission guard in UI + API (`Manager` only to execute; read-only for reps)
* Block closed/reconciled opportunities (or soft-skip with counts)
* Concurrency: idempotent batch runner; per-opp mutex
* Observability: structured logs for each step; metrics on successes/failures
* Seeded test data + e2e tests for L1/L2/L3 happy paths and edge cases

---

## API contracts (quick reference)

* `POST /api/opportunities/:id/commissions/preview`
  **Body:** `{ type, endDate, effectiveDate, newRepId?, customSplits? }`
  **Returns:** `{ beforeSplits, afterSplits, previewDeltas }`
* `POST /api/opportunities/:id/commissions/reassign`
  **Body:** same + `reason`
  **Returns:** `{ commissionChangeId }`
* `POST /api/reassignment-batches`
  **Body:** `{ scope, strategy, reason }`
  **Returns:** `{ batchId }`
* `GET /api/reassignment-batches/:batchId` → `{ status, counts, errors? }`
* `POST /api/reassignment-batches/:batchId/rollback`

---

## File map (create/modify)

* **Engine/logic**

  * `lib/commission-engine.ts` ✅ new
  * `lib/commission-proration.ts` ✅ new
  * `lib/auto-assignment.ts` (Phase 8)
* **UI**

  * `app/(dashboard)/opportunities/[opportunityId]/page.tsx` (build)
  * `components/opportunity-commissions-panel.tsx` (new)
  * `components/global-reassignment-wizard/*` (new)
  * `app/(dashboard)/reassignments/page.tsx` (new)
* **API**

  * `app/api/opportunities/[opportunityId]/commissions/preview/route.ts`
  * `app/api/opportunities/[opportunityId]/commissions/reassign/route.ts`
  * `app/api/reassignment-batches/route.ts`
  * `app/api/reassignment-batches/[batchId]/route.ts`
  * `app/api/reassignment-batches/[batchId]/rollback/route.ts`
  * `app/api/commission-changes/[entityType]/[entityId]/route.ts`
* **Jobs**

  * `jobs/reassignment-runner.ts` (db-backed queue)

---

## Acceptance checklist per phase (copy to your tracker)

* [ ] **P0** migrations applied; engine + validate + apply with tests
* [ ] **P1** L1 UI (modal), preview + apply APIs, audit rows write
* [ ] **P2** Types A/B/C pass unit tests; L2 refactored to engine
* [ ] **P3** Proration alters schedules; preview shows prorated deltas
* [ ] **P4** Global Wizard (scope→strategy→assign→review→execute) + batch
* [ ] **P5** Dashboard & history timelines
* [ ] **P6** Notifications wired
* [ ] **P7** Rollback for ≤48h batches
* [ ] **P8** Auto-assignment option
* [ ] **P9** Permissions, blocking rules, observability, e2e

---

## Quick sequencing (what to build first)

1. **P0/P2 together:** data + engine + unit tests (unblock everything).
2. **P1:** L1 UI & APIs → validates engine end-to-end.
3. **P3:** Proration (plugs into L1, then L2).
4. **P4/P5:** Global wizard + queue + dashboard.
5. **P6/P7:** Notifications & rollback.
6. **P8/P9:** Optional rules + hardening.

---
