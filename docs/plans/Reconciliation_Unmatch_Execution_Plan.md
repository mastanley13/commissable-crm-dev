# Reconciliation Unmatch Execution Plan

## Objective

Implement reconciliation unmatch as a full reversal engine that restores pre-match state, removes match-created downstream effects, preserves auditability, and prevents line-level and bulk unmatch behavior from diverging.

This plan is execution-focused and grounded in the current implementation.

## Product Rules To Enforce

1. Unmatch must reverse all persisted side effects created by the original match flow.
2. Unmatch must reset all adjustment fields that were introduced because of the match.
3. Any Flex schedule created because of that match must be removed or retired when the match is undone.
4. Any future-schedule mutations introduced by `applyToFuture` must be reversible.
5. Reconciled/finalized deposits must not be unmatchable until explicitly unfinalized first.
6. Both unmatch entry points must delegate to a single reversal service.
7. Rematch after unmatch must behave as if the original match never happened.

## Current Mutation Paths

### Match and adjustment entry points

- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/resolve-flex/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/ai-adjustment/apply/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/within-tolerance/apply-to-future/route.ts`

### Current unmatch entry points

- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route.ts`
- `app/api/reconciliation/deposits/[depositId]/bulk/unmatch-allocations/route.ts`

### Shared helpers already in play

- `lib/matching/revenue-schedule-status.ts`
- `lib/matching/deposit-line-allocations.ts`
- `lib/matching/deposit-aggregates.ts`
- `lib/flex/revenue-schedule-flex-actions.ts`
- `lib/reconciliation/future-schedules.ts`
- `lib/reconciliation/billing-status.ts`

## Side Effects That Must Be Reversible

### Deposit line item state

- `status`
- `primaryRevenueScheduleId`
- `usageAllocated`
- `usageUnallocated`
- `commissionAllocated`
- `commissionUnallocated`

### Revenue schedule derived actuals and status

- `actualUsage`
- `actualCommission`
- `status`
- auto billing-status recomputes that happen through schedule recomputation

### Revenue schedule direct adjustment writes

- `usageAdjustment`
- `expectedCommissionAdjustment`
- any legacy or fallback commission adjustment behavior that still reads from `actualCommissionAdjustment`

### Flex-created records and related side effects

- created Flex revenue schedules
- any parent/base schedule changes caused by Flex splitting
- base schedule billing status forced to `InDispute` during Flex product creation
- related flex review queue items that become orphaned if the created schedule is retired
- any created `OpportunityProduct` records attached to Flex product creation if those records are only valid while the Flex schedule exists

### Apply-to-future mutations

- future schedule `usageAdjustment` increments
- future schedule `expectedCommissionAdjustment` increments

### Match rows

- `DepositLineMatch` rows in both `Applied` and any relevant `Suggested` states covered by product requirements

### Metadata or auto-fill writes

- verify whether `autoFillFromDepositMatch` persists match-linked identifiers or schedule metadata that must be reversed

## Primary Gaps In Current Implementation

1. Line-level unmatch deletes matches and recomputes actuals, but it does not reverse direct adjustment writes that were applied to the base schedule.
2. Neither unmatch path currently reverses `applyToFuture` schedule mutations.
3. Finalized/reconciled protection is inconsistent. Current line-level unmatch does not explicitly block reconciled lines.
4. Line-level and bulk unmatch do not share one engine, so semantics can drift.
5. Current persistence does not provide durable provenance for reversing future-schedule deltas.

## Implementation Strategy

## Phase 1: Inventory And Provenance Design

### Goals

- Confirm every persisted write introduced by the matching lifecycle.
- Separate recomputable state from write-once state that needs explicit rollback data.
- Decide how to persist reversible mutation provenance.

### Deliverables

- final side-effect inventory
- provenance design for reversible mutations
- schema change list if needed

### Proposed approach

Create a durable reversal journal rather than trying to infer rollbacks later from audit logs.

Recommended model shape:

- `ReconciliationMutationLog` or equivalent table keyed to:
  - `tenantId`
  - `depositId`
  - `depositLineItemId`
  - mutation type
  - target entity type
  - target entity id
  - field name or mutation payload
  - previous value
  - next value
  - source action
  - createdById
  - createdAt

Minimum mutations that should be logged:

- base schedule adjustment changes
- future schedule adjustment changes
- flex schedule creation
- flex-related parent billing-status changes
- any created linked `OpportunityProduct` ids if those need retirement on reversal

This gives unmatch deterministic rollback without trying to reverse-engineer intent from current field values.

## Phase 2: Schema And Persistence Changes

### Goals

- Add the persistence needed for deterministic rollback.
- Keep the implementation scoped to reconciliation-unmatch concerns.

### Work

1. Add a new Prisma model for reversible reconciliation mutations.
2. Add migration(s).
3. Add typed helpers for recording mutation entries from:
   - within-tolerance base schedule adjustments
   - `applyToFuture`
   - flex schedule creation
   - flex parent billing-status changes
4. Add typed helpers for reading and replaying rollback entries by `depositLineItemId`.

### Notes

- Do not depend on generic audit logs for reversal logic.
- Keep audit logs for auditability, but use dedicated reversal records for correctness.

## Phase 3: Build Shared Reversal Engine

### Target

Create a shared service, likely under `lib/reconciliation` or `lib/matching`, for example:

- `lib/reconciliation/unmatch-reversal.ts`

### Service responsibilities

1. Validate deposit line and deposit state.
2. Enforce finalized/reconciled rule:
   - block if deposit or line is reconciled/finalized
   - return a clear error instructing the caller to unfinalize first
3. Collect all matches and affected schedule ids for the line(s).
4. Load all reversal journal entries associated with the target line(s).
5. Reverse non-derivable side effects in dependency-safe order.
6. Delete or retire created Flex schedules.
7. Retire or clean up dependent artifacts if required.
8. Delete relevant match rows.
9. Recompute:
   - deposit line allocations
   - deposit aggregates
   - revenue schedule actuals/status/billing status
10. Write audit events summarizing the reversal.

### Reversal order

Recommended sequence inside one transaction:

1. guard finalized/reconciled state
2. load reversal journal entries
3. reverse future-schedule adjustments
4. reverse base schedule direct adjustments
5. reverse flex-parent billing-status overrides if they were introduced by the matched flow
6. retire/delete created flex schedules and any dependent rows that are safe to remove
7. delete match rows
8. recompute affected schedules
9. recompute affected deposit lines
10. recompute deposit aggregates
11. mark journal entries reversed or delete them, depending on chosen model

### Important rule

Derived fields such as `actualUsage` and `actualCommission` should be restored by recomputation, not by direct manual overwrite.

## Phase 4: Normalize Both Unmatch Entry Points

### Goals

- Remove duplicated unmatch logic.
- Ensure bulk and line-level unmatch enforce the same rules.

### Work

1. Refactor `line-items/[lineId]/unmatch/route.ts` to call the shared reversal service.
2. Refactor `bulk/unmatch-allocations/route.ts` to call the same service in batch mode.
3. Standardize which match statuses are reversible:
   - confirm product rule for `Applied`
   - confirm product rule for `Suggested`
4. Standardize response payload shape enough for current UI callers.

### Constraint

Do not let one route continue to bypass finalized-state checks or flex cleanup rules that the other route enforces.

## Phase 5: Update Match-Time Mutation Recording

### Goals

- Ensure every reversible mutation is logged at the moment it is created.

### Work by path

#### `apply-match/route.ts`

- record direct within-tolerance writes to:
  - `usageAdjustment`
  - `expectedCommissionAdjustment`

#### `ai-adjustment/apply/route.ts`

- record flex adjustment split results
- record `applyToFuture` delta writes

#### `resolve-flex/route.ts`

- record adjustment split or flex-product split mutations
- record `applyToFuture` delta writes when action is `Adjust`

#### `within-tolerance/apply-to-future/route.ts`

- record future schedule delta writes

#### `lib/flex/revenue-schedule-flex-actions.ts`

- record:
  - created flex schedules
  - created opportunity products if cleanup is required
  - parent billing-status changes introduced by flex-product creation

## Phase 6: Tests

### Existing test files most likely to extend

- `tests/integration-reconciliation-match-flow.test.ts`
- `tests/integration-reconciliation-variance-flex.test.ts`
- `tests/integration-reconciliation-ai-adjustment.test.ts`
- add a dedicated unmatch regression test file if current files become too overloaded

### Required regression coverage

1. Simple 1:1 match then unmatch.
Expected:
- no remaining match rows
- deposit line returns to clean unallocated state
- schedule actuals/status return to pre-match values

2. Within-tolerance auto-adjust match then unmatch.
Expected:
- base schedule `usageAdjustment` restored
- base schedule `expectedCommissionAdjustment` restored
- actuals recomputed cleanly

3. Apply-to-future mutation then unmatch.
Expected:
- all future schedules touched by that flow have adjustment fields restored to their previous values
- rollback is limited to the mutation created by this line, not unrelated manual edits

4. Flex adjustment split then unmatch.
Expected:
- created flex schedule retired or removed
- base schedule restored
- no orphaned applied matches remain

5. Flex product split then unmatch.
Expected:
- created flex schedule retired or removed
- parent/base billing-status override is reversed if it originated from this flow
- dependent review artifacts are not left pointing at active nonexistent workflow state

6. Rematch after unmatch.
Expected:
- rematch behaves like first-time match
- no duplicate adjustments or duplicated future-schedule deltas

7. Reconciled/finalized behavior.
Expected:
- unmatch is blocked with clear error until explicit unfinalize occurs

8. Bulk unmatch parity.
Expected:
- bulk route and line route leave the same persisted state for equivalent scenarios

## Phase 7: Verification

### Targeted test run

Run only the reconciliation and flex-related integration tests touched by this change first, then expand if needed.

Suggested initial set:

- `tests/integration-reconciliation-match-flow.test.ts`
- `tests/integration-reconciliation-variance-flex.test.ts`
- `tests/integration-reconciliation-ai-adjustment.test.ts`
- any new dedicated unmatch regression test file

### Manual verification points

- unmatch after within-tolerance auto-adjust leaves no dirty adjustment values
- unmatch after `applyToFuture` restores future schedules correctly
- unmatch after flex creation removes the flex schedule from active data
- rematch does not double-apply deltas

## Risks And Decisions To Resolve During Implementation

1. Whether created `OpportunityProduct` rows for flex-product flows should be deleted, soft-deleted, or left in place but detached.
2. Whether flex review queue items should be closed, cancelled, or left as historical records when the flex schedule is retired.
3. Whether some `Suggested` matches should be included in reversal scope or handled separately.
4. Whether any current manual edits can happen after `applyToFuture` and before unmatch, which affects rollback conflict handling.

## Recommended Execution Order

1. Finalize mutation inventory.
2. Add reversal journal schema and helpers.
3. Wire mutation recording into all relevant match/flex/apply-to-future paths.
4. Implement shared reversal engine.
5. Refactor both unmatch routes to use it.
6. Add tests.
7. Run targeted verification.

## Definition Of Done

- unmatch restores pre-match persisted state for all supported match flows
- no adjustment fields remain dirty after unmatch
- future-schedule propagated deltas are reversible
- flex-created schedules are removed or retired correctly
- finalized/reconciled protection is enforced consistently
- line-level and bulk unmatch use one shared engine
- regression tests prove rematch-after-unmatch works cleanly
