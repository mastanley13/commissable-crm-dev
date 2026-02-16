# TC-05 Bundle (Rip-and-Replace) Gap Resolution Plan
Date: 2026-02-12  
Owner: TBD  
Scope: Reconciliation Match Wizard, Bundle APIs, Undo, Guardrails, Tests

## 1. Goal
Harden the TC-05 "Bundle (Rip & Replace)" workflow so that it is:
- Safe by default (no duplicate schedules/products due to retries or partial replace).
- Predictable (clear replace rules, clear eligibility checks).
- Reversible (undo is reliable and discoverable).
- Testable (automated coverage for core behaviors and regressions).

## 2. Current Implementation (What Exists Today)

### 2.1 User Flow (Wizard)
- Entry: Match Wizard in `M:1` selection.
- User chooses `M:1 Mode` = `Bundle (Rip & Replace)`.
- Bundle apply creates new products/opportunity-products/schedules, then wizard switches into `M:M` allocation for the newly created schedules for the selected schedule date.

Touchpoints:
- UI: `components/reconciliation-match-wizard-modal.tsx`
- Apply API: `POST /api/reconciliation/deposits/:depositId/bundle-rip-replace/apply`
- Undo API: `POST /api/reconciliation/deposits/:depositId/bundle-rip-replace/:bundleAuditLogId/undo`

### 2.2 Server Behavior (Bundle Apply)
- Requires 2+ `lineIds` and exactly 1 base `revenueScheduleId`.
- Base schedule must have `opportunityId`, `opportunityProductId`, and `scheduleDate`.
- Creates:
  - 1 new `Product` per deposit line item.
  - 1 new `OpportunityProduct` per created product.
  - New `RevenueSchedule` rows across all "effective dates" (derived from remaining schedules on the base opportunity product, starting at base schedule date).
- Replace mode:
  - `keep_old`: no deletion of old schedules.
  - `soft_delete_old`: soft-delete old schedules that are `Unreconciled` and have no Applied matches.

### 2.3 Undo Behavior (Bundle Undo)
- Uses the AuditLog metadata written during apply.
- Blocks undo if any created schedule has an Applied allocation.
- Soft-deletes created schedules.
- Undeletes replaced schedules (if any).
- Deactivates created products/opportunity-products.

## 3. Known Gaps (What We Need To Fix)

### 3.1 Duplicate Risk
- No idempotency. Retries can create duplicate products/schedules.

### 3.2 Replace Semantics Can Produce Mixed Old+New Schedules
- In `soft_delete_old`, deletion is partial (only "eligible" schedules), but creation still proceeds.
- This can produce overlapping schedules (old and new) for the same dates.

Default policy for hardening:
- If `mode=soft_delete_old`, block apply if any target schedule cannot be replaced.

### 3.3 Missing Eligibility Checks For Bundle Apply
Add guardrails to ensure bundle is only run on "clean" candidates:
- Selected lines should not be reconciled or ignored (already done).
- Selected lines should not already have Applied allocations (not currently enforced by bundle apply).
- Base schedule and replace-target schedules should meet replace eligibility when in `soft_delete_old`.

### 3.4 OpportunityProduct Totals Incomplete
- Created `OpportunityProduct` does not set `expectedRevenue`.
- This can break downstream computations that use expected revenue totals.

### 3.5 Undo Discoverability and Lifecycle
- Undo is effectively "wizard-session scoped" (user needs the auditLogId in-state).
- No first-class "list bundle operations for this deposit" UI/API.

### 3.6 Negative Lines and Wizard Flex Remainders
- Negative deposit lines are blocked in wizard and bundle apply.
- "Wizard creates Flex remainder" is not implemented.

Hardening default:
- Keep negative lines out of scope for TC-05 hardening.
- Do not implement wizard Flex creation in the first hardening slice; keep current behavior (partial allocations allowed) but improve messaging and document the manual Flex path.

### 3.7 Automated Test Coverage
- No automated tests for bundle apply/undo.

## 4. Proposed Changes (Implementation-Ready)

### P0. BundleOperation Model (Idempotency + Undo Anchor)
Add a dedicated persistence record instead of relying only on AuditLog metadata.

Schema (Prisma):
- `BundleOperation`
  - `id` (uuid)
  - `tenantId`
  - `depositId`
  - `baseRevenueScheduleId`
  - `baseOpportunityProductId`
  - `baseScheduleDate`
  - `mode` (`keep_old` | `soft_delete_old`)
  - `lineIds` (Json array, stored sorted)
  - `idempotencyKey` (string, unique per tenant)
  - `reason` (nullable)
  - `createdProductIds` (Json array)
  - `createdOpportunityProductIds` (Json array)
  - `createdRevenueScheduleIds` (Json array)
  - `replacedRevenueScheduleIds` (Json array)
  - `createdAt`
  - `undoneAt` (nullable)
  - `undoneByUserId` (nullable)
  - `undoReason` (nullable)
  - `applyAuditLogId` (nullable)
  - `undoAuditLogId` (nullable)

IdempotencyKey derivation:
- `sha256(tenantId + depositId + baseRevenueScheduleId + mode + sorted(lineIds).join(","))`

API behavior:
- Apply:
  - Compute idempotencyKey.
  - If an existing operation exists and is not undone, return its computed response (no new writes).
  - Else create operation row, execute apply inside a transaction, store created IDs, store auditLogId.
- Undo:
  - Locate operation by id (or by auditLogId for backwards compatibility).
  - Enforce "no Applied allocations on created schedules".
  - Apply undo, mark operation undone, store undo audit.

### P0. Replace Eligibility Rules (Safe by Default)
In `soft_delete_old`:
- Determine the full target set:
  - All schedules for `baseOpportunityProductId`
  - `deletedAt is null`
  - `scheduleDate >= baseScheduleDate`
- Validate all targets are replaceable:
  - `status == Unreconciled`
  - no Applied `DepositLineMatch`
- If any target fails eligibility:
  - Return 409 with a deterministic error payload listing schedule IDs and the reason.
- If all eligible:
  - Soft-delete all targets in one updateMany.
  - Proceed with creation.

In `keep_old`:
- Allow creation, but add a UI confirmation message warning that duplicates will exist.
- Optional follow-up: hide `keep_old` behind an "advanced" toggle.

### P0. Bundle Apply Guardrails (Deposit Lines)
Before creating anything:
- For each selected lineId:
  - Confirm it has no Applied matches at all.
  - If it has Applied matches, return 409 and require unmatch/undo first.
- Optional strictness: require `usageUnallocated == usage` and `commissionUnallocated == commission` if we want "bundle only for fully-unmatched lines".

### P0. Fix OpportunityProduct Totals
When creating the new `OpportunityProduct`:
- Set `expectedRevenue` consistently (default: equals `expectedUsage` total, since "usage" is treated as money in reconciliation).
- Ensure snapshots are coherent:
  - `quantity=1`, `unitPrice=usagePerSchedule`
  - `expectedUsage = usagePerSchedule * numberOfPeriods`
  - `expectedRevenue = expectedUsage`
  - `expectedCommission = commissionPerSchedule * numberOfPeriods`

### P1. Bundle Operation List + Undo Entry Point
Add:
- `GET /api/reconciliation/deposits/:depositId/bundle-rip-replace/operations`
  - Returns recent bundle operations for the deposit, including status (active/undone) and metadata.
- Deposit detail UI enhancement:
  - Show "Bundle operations" list with Undo button (permissioned).
  - This removes dependence on "undo only inside the wizard session".

### P2. Negative Line Support (Defer)
Explicitly keep current behavior:
- Bundle apply rejects negative lines.
- Wizard preview rejects negative lines and directs to chargeback flow.

Track as separate ticket:
- "Bundle supports negative lines" requires product semantics (tax lines vs chargeback vs credit) and is not part of TC-05 hardening.

### P2. Wizard Flex Remainder Creation (Defer)
Do not change preview validation (partial allocations remain allowed).
Enhance UX only:
- If line remainder exists, show a callout linking to the existing per-line Flex tooling.

## 5. Test Plan

### 5.1 Automated (Required)
Add integration tests for:
- Apply is idempotent:
  - Call apply twice with same inputs.
  - Assert only one operation created and IDs are stable.
- Replace eligibility:
  - If any target schedule has Applied matches, `soft_delete_old` apply returns 409 and creates nothing.
- Line eligibility:
  - If any selected line has Applied matches, apply returns 409 and creates nothing.
- Undo safety:
  - If created schedules have Applied allocations, undo returns 409 and does not delete schedules.
- End-to-end regression:
  - Bundle apply
  - Wizard allocations apply as match group
  - Undo match group
  - Undo bundle

### 5.2 Manual UAT (TC-05)
Use:
- `docs/runbooks/2026-02-10-Reconciliation-Workflow-Test-Guide.md` section "TC-05"
- `docs/runbooks/2026-02-10-Reconciliation-Workflow-UAT-Browser-Steps.md` section "TC-05"

Pass criteria additions for hardening:
- Retrying "Create bundle schedules" does not create duplicates.
- Replace mode fails fast with an actionable message when old schedules cannot be replaced.

## 6. Rollout and Safety
- Ship behind a small, internal-only feature flag if needed:
  - "strictReplace" for `soft_delete_old`.
- Add metrics/logs:
  - count of bundle apply
  - count of idempotent replays
  - count of replace-blocked errors
  - undo success/failure counts

## 7. Assumptions and Defaults Chosen
- Idempotency: implement a BundleOperation table (operation-backed apply/undo).
- Replace semantics for `soft_delete_old`: block apply if any target schedule is not replaceable.
- Wizard Flex remainder creation: defer; improve guidance only.

