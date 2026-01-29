# Billing Status Completion Plan — Settlement Adjustments + Flex Resolution (v1)

Date: 2026-01-29  
Owner: Engineering / Product  
Scope: Finish remaining Billing Status lifecycle work per:
- `docs/plans/billing-status-lifecycle-implementation-checklist.md`
- `docs/plans/Billing_Status_response_to_questoins_flex_01_29_26.md`

This plan is implementation-ready and assumes the Billing Status field + automation + governance + basic settlement endpoint already exist, but require updates to align with the clarified rules (do not overwrite original expected values; flex resolution types; parent dispute clearing rules).

---

## 1) Executive Summary

We will complete Billing Status by:
1) Reworking **settlement** so “Accept Actual” and “Write Off” create **adjustments** (do not overwrite original contractual expectations), with full auditability and reporting-friendly metadata.
2) Implementing **Flex resolution** as a first-class workflow with three resolution types and correct dispute-clearing behavior for both flex schedules and their base schedules.
3) Locking down **apply-to-future** scope safety and validating the new Billing Status model via side-by-side comparison reporting.

---

## 2) Target Acceptance Criteria (what “done” means)

### 2.1 Settlement / Clearing Disputes
- “Accept Actual” and “Write Off” **do not overwrite** `expectedUsage` / `expectedCommission` contractual baseline fields.
- They instead create adjustments such that **Expected Net equals Actual Net** (variance → 0) while preserving original expected values.
- Each settlement:
  - sets `billingStatusSource=Settlement`,
  - writes `billingStatusUpdatedById/At` + `billingStatusReason`,
  - is fully audited (before/after + action metadata).
- Billing Status clears from `In Dispute` only through explicit settlement-style actions (as already decided in P0).

### 2.2 Flex Resolution
- Flex items can be resolved via:
  - `ApplyToExisting`
  - `ConvertToPermanent`
  - `AcceptAsOneTime` (requires reason)
- Resolving a flex schedule always clears the **flex schedule** dispute (removes it from the operational queue).
- Resolving can clear the **base schedule** dispute only when:
  - the resolution type is `ApplyToExisting`, AND
  - the base schedule has **no remaining flex children** with `billingStatus=InDispute`, AND
  - the base schedule is not disputed for other reasons.
- Audits exist for:
  - flex schedule resolution,
  - any base schedule dispute changes,
  - any changes to adjustments/settlement metadata.

### 2.3 Apply-To-Future Safety
- Billing Status changes and settlement effects on future schedules only occur when **explicitly requested** (toggle).
- History preservation is enforced: no unintended changes to unrelated or already-finalized periods.
- Tests verify scope boundaries.

### 2.4 Side-by-Side Validation
- We can produce a comparison report of:
  - legacy dispute constructs (legacy `inDispute`/“Disputed” semantics) vs `billingStatus=InDispute`
  - mismatches list for review and remediation.

---

## 3) Current-State Notes (Known Gaps)

### 3.1 Settlement endpoint behavior must be corrected
The current settlement implementation (if present) must be updated to:
- stop writing `expectedUsage` / `expectedCommission` to match actuals,
- instead create and store adjustments + settlement metadata.

### 3.2 Expected Commission adjustments need a canonical model
If the data model currently lacks an explicit `expectedCommissionAdjustment`, add it (preferred) or define an equivalent adjustment mechanism consistent with “Expected Net = Gross + Adjustments”.

---

## 4) Data Model Changes (v1)

### 4.1 RevenueSchedule: Expected Commission adjustment
Add one canonical field (recommended):
- `expectedCommissionAdjustment Decimal? @db.Decimal(16, 2)` (name may vary; keep consistent with existing adjustment patterns)

Rationale:
- We must be able to represent settlements as adjustments without overwriting contractual expected commission.

### 4.2 RevenueSchedule: Settlement metadata (minimal v1)
Option A (recommended): new table for auditability/reporting (best long-term)
- `RevenueScheduleAdjustment` (or `RevenueScheduleSettlement`) with:
  - `id`, `tenantId`, `revenueScheduleId`
  - `type`: `ACCEPT_ACTUAL_AS_EXPECTED | WRITE_OFF | MANUAL_CORRECTION`
  - `usageDelta`, `commissionDelta`
  - `reason` (required)
  - `approvedByUserId`, `approvedAt`
  - `createdAt`

Option B (fallback/minimal schema): add fields to RevenueSchedule
- `settlementType`, `settlementReason`, `settledById`, `settledAt`, plus the deltas in existing adjustment fields

Recommendation:
- Use Option A if possible; otherwise Option B is acceptable but less extensible.

### 4.3 Flex resolution metadata
Add persisted fields (either on `RevenueSchedule` for flex schedules only, or in a dedicated table):
- `flexResolutionType`: `ApplyToExisting | ConvertToPermanent | AcceptAsOneTime`
- `flexResolutionReason` (required)
- `flexResolvedById`, `flexResolvedAt`
- `flexResolvedToRevenueScheduleId` (nullable; used when ApplyToExisting merges into another schedule)

---

## 5) API Work (v1)

### 5.1 Settlement endpoint (replace/upgrade)
Endpoint:
- `POST /api/revenue-schedules/:id/settlement`

Request:
- `action`: `AcceptActual | WriteOff`
- `reason`: required
- `applyToFuture`: optional boolean (default false)

Behavior:
1) Validate:
   - schedule exists, tenant-scoped, not deleted
   - schedule is `billingStatus=InDispute`
   - schedule has at least one applied match (or defined “actual” basis)
2) Compute deltas:
   - Determine Expected Net vs Actual Net
   - Compute deltas needed to bring Expected Net to Actual Net via adjustments:
     - `usageAdjustmentDelta`
     - `expectedCommissionAdjustmentDelta`
3) Persist:
   - write deltas to adjustment fields (and/or create adjustment record row)
   - record settlement metadata (type + reason + approvedBy + approvedAt)
   - set `billingStatusSource=Settlement`
   - clear billing status to `Open` (or `Reconciled` only when deposit finalized per STRICT rule)
4) Audit:
   - single RevenueSchedule audit entry including reason/type and before/after

### 5.2 Flex Resolve endpoint (new)
Endpoint (recommended):
- `POST /api/flex-review/:flexReviewItemId/resolve` (primary workflow)
Fallback:
- `POST /api/revenue-schedules/:id/flex-resolve` (if flex review item not available)

Request:
- `resolutionType`: `ApplyToExisting | ConvertToPermanent | AcceptAsOneTime`
- `reason`: required
- `applyToFuture`: optional boolean (default false; only applies when the resolution changes expectations forward)
- For `ApplyToExisting`:
  - `targetRevenueScheduleId` (required)

Behavior:
1) Validate flex schedule exists and is a flex classification; ensure it’s currently `In Dispute`.
2) Mark flex schedule resolved:
   - store resolution metadata
   - set `billingStatusSource=Settlement` (or `Manual` if you prefer), set `billingStatus=Open` (or `Reconciled` if finalized)
3) If `ApplyToExisting`:
   - (v1 minimal) link resolution to target schedule via metadata; do not move allocations unless explicitly part of scope
   - Clear base schedule dispute only if open disputed flex children count becomes 0
4) If `ConvertToPermanent`:
   - (v1) record resolution metadata and leave financial structures unchanged unless you explicitly add product/schedule creation in this milestone
5) If `AcceptAsOneTime`:
   - record resolution metadata; clear from queue; require reason
6) Audit all touched schedules.

---

## 6) UI Work (v1)

### 6.1 Flex Review queue (primary)
Add a “Resolve” action with modal:
- Resolution Type selector (3 options)
- Reason text (required)
- For ApplyToExisting: target schedule picker

### 6.2 Revenue Schedule detail (secondary)
Add “Resolve Flex” action when the schedule is a flex classification:
- Same modal + same API call

---

## 7) Billing Status Audit Completion

Goal: every billingStatus change has an audit record with a consistent schema.

Implementation steps:
- Introduce a helper that emits a standard “BillingStatusChanged” audit payload:
  - prior/new: `billingStatus`, `billingStatusSource`, `billingStatusReason`
  - trigger: `AutoRecompute | AutoFlexCreate:* | ApproveFlex | FinalizeDeposit | UnfinalizeDeposit | Settlement:* | FlexResolved:*`
  - context IDs
- Ensure each codepath uses the helper.

---

## 8) Apply-To-Future Scope Guard

Steps:
1) Identify all operations that mutate future schedules (adjustments apply-forward, etc.).
2) Ensure billing status transitions only happen for schedules explicitly recomputed in-scope.
3) Add tests to ensure no unrelated schedules change.

---

## 9) Side-by-Side Validation Deliverable

Deliver a script or admin-only endpoint that outputs:
- count(legacyDispute=true), count(billingStatus=InDispute)
- mismatch counts and a sample list (scheduleId, legacy flags, billingStatus, flex classification, status)
- explicit highlighting for chargeback “pending” legacy cases

Acceptance:
- stakeholders can review mismatches and decide remediation/backfill rules.

---

## 10) Test Plan (v1)

### 10.1 Unit
- Settlement delta math: expected net → actual net (usage + commission)
- Base dispute clearing: if any child flex still In Dispute, base remains In Dispute

### 10.2 Integration (DB-backed)
- Apply-match → finalize → `billingStatus` becomes Reconciled (STRICT)
- Create flex product → base+flex InDispute → resolve flex:
  - AcceptAsOneTime clears flex only
  - ApplyToExisting clears flex; clears base only if last disputed child
- Settlement:
  - does not overwrite expected baseline values
  - writes adjustments + metadata
  - audit logs exist for each transition

---

## 11) Delivery Sequencing (recommended)

1) Data model additions (commission expected adjustments + settlement/flex resolution metadata)
2) Update settlement endpoint to adjustments-based approach
3) Implement flex resolve endpoint + base dispute clearing rules
4) UI: Flex Review resolve modal + optional schedule detail action
5) Complete audit coverage across billing status transitions
6) Apply-to-future scope tests and enforcement
7) Side-by-side validation report/script + stakeholder review

---

## 12) Open Items (explicitly tracked)
- Whether ConvertToPermanent will actually create new product/schedules in this milestone or just record the resolution metadata (recommended: metadata-only in v1; creation can be Phase 3+).
- Exact legacy dispute signal used for side-by-side comparison (recommended: legacy `inDispute`/Disputed constructs, not overpaid heuristics).

