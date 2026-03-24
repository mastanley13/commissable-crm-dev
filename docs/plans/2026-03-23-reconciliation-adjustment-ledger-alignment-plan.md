---
title: Reconciliation Adjustment Ledger and Option A/B/C Alignment Plan
owner: Engineering / Product
status: Draft
last_updated: 2026-03-23
source_feedback:
  - docs/notes/Reconciliation Maching Issues and Workflow.docx.md
  - docs/analysis/2026-03-12-march-2026-spec-comparative-analysis.md
  - docs/plans/2026-03-12-milestone-3-client-critical-reconciliation-implementation-plan.md
---

# Reconciliation Adjustment Ledger and Option A/B/C Alignment Plan

## Goal

Decide whether the March 2026 client reconciliation spec is now the source of truth. If yes, replace the current mixed absorb-adjust-flex implementation with a true adjustment-ledger model and a spec-aligned Option A / B / C variance-resolution flow.

## Decision checkpoint

Recommended decision: adopt the March 2026 client spec as the source of truth for usage-variance resolution.

Why this decision is needed before coding:

- The current implementation materially diverges from the spec in both data model and UX.
- The current `Absorb into Price Each` path rewrites contractual pricing inputs, which the client explicitly rejected.
- The current UI splits the workflow across multiple actions and tabs, while the client expects three explicit resolution options with clear review and confirmation states.

If the spec is not adopted, the team should stop after Phase 0 and produce a client-facing variance memo plus a change-order decision. Implementing partial fixes without settling the source of truth will create another round of drift.

## Current-state summary

- `components/reconciliation-alert-modal.tsx` currently presents separate paths such as `Absorb into Price Each`, `Create Flex Product`, `Accept Higher Rate Once`, `Apply Higher Rate to Future`, and `Create Adjustment Entry`.
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/absorb-overage/apply/route.ts` directly rewrites pricing-related inputs for the matched schedule path.
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/ai-adjustment/apply/route.ts` and `resolve-flex/route.ts` use different adjustment and split semantics than the client's Option A / B / C model.
- `prisma/schema.prisma` has inline adjustment fields on `RevenueSchedule`, but there is no dedicated `schedule_adjustments` ledger table.
- `DepositMatchGroup` does not persist created adjustment ids or child schedule ids as first-class fields, which makes targeted undo and reporting harder than the client spec expects.

## Gap-to-root-cause map

| Required outcome | Current gap | Root cause | Planned fix |
| --- | --- | --- | --- |
| Price each must never be modified for variance resolution | The absorb path mutates pricing inputs directly | The first implementation optimized for quick normalization instead of an auditable ledger | Retire the absorb path and replace it with explicit ledger-backed options |
| Option A / B / C must be the visible operator choices | The current flow is split across multiple tabs and action types | The workflow evolved incrementally across separate routes and modals | Rebuild the variance popup around three explicit resolution options |
| Every usage adjustment must be a reversible record | The source of truth lives partly in inline fields and partly in flex child schedules | No dedicated adjustment table exists | Add a first-class `RevenueScheduleAdjustment` model |
| Undo must precisely delete what the match created | Match groups do not cleanly own created adjustments and child schedules | Created artifacts are tracked indirectly through logs and route-local behavior | Persist match-group resolution metadata and created artifact ids |
| Odd amounts and multi-unit quantities must stay auditable | The absorb path encourages per-unit repricing and rounding drift | Contractual price storage and adjustment storage are mixed together | Store total adjustment amounts as ledger rows and compute net totals from base plus adjustments |

## Remediation workstreams

### 0. Lock the governing rule set

- Decide whether the March 2026 client memo is authoritative for variance resolution.
- If yes, freeze any new feature work that expands the current absorb-based path.
- Define the exact resolution vocabulary:
  - Option A: adjust this schedule only
  - Option B: adjust this schedule and all future schedules in the same opportunity product chain
  - Option C: create flex child schedule
- Define which current workflows remain separate from this plan:
  - higher-rate and lower-rate commission discrepancy handling can remain their own flow
  - this plan is specifically for usage-variance resolution

Exit criteria:

- Product and engineering agree that the March memo is authoritative for usage-variance handling.

### 1. Introduce a true adjustment ledger

- Add a dedicated model, for example `RevenueScheduleAdjustment`, with fields such as:
  - `id`
  - `tenantId`
  - `revenueScheduleId`
  - `matchGroupId`
  - `sourceDepositId`
  - `sourceDepositLineItemId`
  - `adjustmentType`
  - `applicationScope`
  - `usageAmount`
  - `commissionAmount`
  - `effectiveScheduleDate`
  - `reason`
  - `createdById`
  - `createdAt`
  - `reversedAt`
  - `reversedByUserId`
- Keep contractual baseline fields separate from adjustment history.
- Treat net expected usage and net expected commission as:
  - base contractual amount
  - plus sum of ledger records for that schedule
- Decide whether existing inline adjustment fields on `RevenueSchedule` become:
  - fully deprecated, or
  - temporary denormalized cache fields derived from the ledger

Exit criteria:

- Adjustment history is stored as rows, not baked into price or overwritten baselines.
- One schedule can hold multiple dated adjustment records from different deposits.

### 2. Replace the absorb path with explicit resolution services

- Retire `Absorb into Price Each` as a user-facing option.
- Replace the usage-resolution backend with one shared service used by preview and apply routes.
- Implement three explicit actions:
  - `adjustment_single`
  - `adjustment_forward`
  - `flex_child`
- Option A behavior:
  - create one adjustment record on the current schedule
  - do not touch future schedules
- Option B behavior:
  - create one adjustment record per affected schedule in the same opportunity product chain
  - do not touch base price fields
- Option C behavior:
  - create a child flex schedule only after confirm-and-apply
  - do not create any adjustment rows on the base schedule
- Update grouped matching so match previews and applies can carry the same resolution type and artifact ownership metadata.

Exit criteria:

- No route in this flow mutates contractual pricing as the resolution mechanism.
- Preview and apply share the same Option A / B / C evaluation logic.

### 3. Collapse the popup UX into explicit Option A / B / C behavior

- Rebuild the usage-variance branch in `components/reconciliation-alert-modal.tsx` around three explicit option cards that match the client spec.
- Step 1:
  - show the detected variance
  - force a single choice among Option A, B, or C
  - keep Apply disabled until a choice is made
- Step 2:
  - show a line-by-line confirmation of what will change
  - show current schedule, future schedules, or child flex schedule as applicable
  - show price unchanged wherever relevant
- Step 3:
  - show a confirmation state with plain-English results
  - support Undo and return-to-reconciliation behavior
- Preserve the broader reconciliation shell, but stop mixing absorb-preview UI with adjustment/flex UI inside the same branch.

Exit criteria:

- The usage-resolution popup presents exactly three operator choices.
- The review step explains the change in plain English before commit.

### 4. Make undo, audit, and reporting match the new model

- Extend `DepositMatchGroup` ownership metadata so the system can locate:
  - created adjustment ids
  - created child schedule ids
  - resolution type
- On undo:
  - Option A deletes the created adjustment row for the current schedule
  - Option B deletes all forward adjustment rows created by that match group
  - Option C deletes the created flex child schedule
- Keep `ReconciliationUndoLog` in place if it still adds value, but do not rely on indirect log parsing as the only ownership mechanism.
- Ensure audit entries explain the chosen option, the adjustment amounts, and the schedule scope.

Exit criteria:

- Undo cleanly returns the system to the pre-match state for each option.
- Audits and reports can reconstruct which option was used and what artifacts were created.

### 5. Expand regression coverage

- Add integration tests for:
  - Option A creates one adjustment row and does not mutate price inputs
  - Option B creates one adjustment row per future schedule in the same opportunity product chain
  - Option C creates one child flex schedule and leaves the base schedule unchanged
  - undo removes all artifacts created by the selected option
  - odd total amounts and quantity greater than 1 do not require per-unit repricing
- Update existing variance and AI-adjustment tests so they validate the new ledger contract instead of the old absorb contract.

Exit criteria:

- The ledger model and Option A / B / C behavior are covered by automated tests.
- There is no remaining automated assertion that depends on absorb-style repricing.

## Suggested implementation order

1. Make the source-of-truth decision.
2. Design and migrate the adjustment-ledger schema.
3. Build shared preview/apply services for Option A / B / C.
4. Deprecate the absorb route and wire the popup to the new services.
5. Extend undo ownership metadata.
6. Add regression coverage.
7. Run the disposable-DB reconciliation suite before UAT.

## Expected file touchpoints

- `prisma/schema.prisma`
- `components/reconciliation-alert-modal.tsx`
- `components/deposit-reconciliation-detail-view.tsx`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/absorb-overage/apply/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/ai-adjustment/apply/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/ai-adjustment/preview/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/resolve-flex/route.ts`
- `app/api/reconciliation/deposits/[depositId]/matches/apply/route.ts`
- `app/api/reconciliation/deposits/[depositId]/matches/preview/route.ts`
- `lib/reconciliation`
- `tests/integration-reconciliation-variance-flex.test.ts`
- `tests/integration-reconciliation-ai-adjustment.test.ts`
- `tests/integration-reconciliation-unmatch-regression.test.ts`

## Acceptance criteria

- The March 2026 usage-variance spec is either adopted explicitly or rejected explicitly before implementation.
- No usage-variance resolution path changes contractual pricing inputs as the primary resolution mechanism.
- Option A, B, and C are visible and explicit in the operator workflow.
- Every usage adjustment is stored as a ledger row tied to a schedule, a source deposit line, and a match group.
- Option B creates one record per future schedule in the same opportunity product chain.
- Option C creates a child flex schedule only on confirm-and-apply.
- Undo deletes only the artifacts created by the selected match group resolution.
- Step 2 and Step 3 messaging are plain English and match the client memo.

## Risks and open decisions

- The team must decide whether existing inline adjustment fields stay as cached rollups or are fully deprecated.
- If some schedules are missing `opportunityProductId`, Option B scope rules need a documented fallback or a hard validation failure.
- If Product chooses not to adopt the March spec, this plan becomes a change-order assessment rather than an implementation plan.

