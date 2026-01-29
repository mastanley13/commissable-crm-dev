# Billing Status Lifecycle (Spec) — Implementation Checklist

This checklist turns the Billing Status lifecycle requirements from:
- `Reconciliation System.docx.md`
- `docs/guides/reconciliation-system-comparison.md`

into concrete repo work items tied to the current reconciliation routes and matching/flex modules.

## Target behavior (what “done” means)

Billing Status is a **schedule-level lifecycle** with values:
- `Open`
- `Reconciled`
- `In Dispute`

The system **auto-sets and clears** Billing Status during:
- reconciliation (apply match / allocation + variance evaluation),
- flex creation (Flex Product),
- chargebacks (Flex Chargeback + approval flow),
- and (if adopted) “parent + flex both In Dispute” semantics.

Manual editing remains allowed, but must be treated as an explicit “settlement/override” action (not a random UI toggle).

## Decisions to lock in before coding (blockers)

- [x] **Parent dispute rule:** when a Flex Product schedule is created for an overage, does the **parent schedule** also become `In Dispute` (spec), even if the parent’s remaining variance is now balanced after splitting? (`docs/guides/reconciliation-system-comparison.md`)
  - Decision (P0): **YES** — set both the Flex schedule and its parent/base schedule to `In Dispute` when a Flex Product is created.
  - Why: prevents the base schedule from appearing “clean” while an overage investigation is still active; matches the spec’s “parent + flex both In Dispute” model.
- [x] **What makes a schedule `Reconciled`?**
  - [x] Strict: `billingStatus=Reconciled` only when the schedule is financially settled **and** the deposit batch is finalized/reconciled.
  - [ ] Lenient: `billingStatus=Reconciled` whenever `RevenueSchedule.status=Reconciled`.
  - Why: treat Billing Status as the operational end-state (reports/collections truth), not a mid-stream mirror of `RevenueSchedule.status`.
- [x] **“Clear dispute” semantics:** which actions clear `In Dispute`?
  - [ ] Auto-adjust within tolerance
  - [x] Admin “Accept Actual” (settlement/override; clears dispute if it produces an explicitly settled outcome)
  - [x] Admin “Write Off” (settlement/override; clears dispute if it produces an explicitly settled outcome)
  - [x] Flex “resolved” (rename/assign product) (future phase; clears dispute once resolution produces a settled outcome)
  - Note: do **not** use auto-adjust-within-tolerance to clear disputes; tolerance handling should generally prevent disputes from being created in the first place (disputes are reserved for true exception workflows like Flex/Chargeback/research).
- [x] **Chargeback governance:** do we set `billingStatus=InDispute` immediately on chargeback schedule creation (spec), even though allocation application is approval-gated today?
  - Decision (P0): **YES** — set `billingStatus` to In Dispute immediately on chargeback schedule creation, even if approval gates applying the allocation.
- [x] **Manual overrides:** do we need metadata to preserve intent (recommended)?
  - [x] Add fields: `billingStatusUpdatedById`, `billingStatusUpdatedAt`, `billingStatusReason`
  - [x] Recommended: add `billingStatusSource = Auto | Manual | Settlement` so auto-rules do not clobber manual/settlement decisions.
  - Status: implemented (schema + migration + API behavior) and recompute respects `billingStatusSource` (2026-01-29).

- [x] **P0 complete:** Decisions locked (2026-01-29).

## Implementation approach (recommended)

- Prefer a **single “Billing Status Engine”** function that is:
  - deterministic/idempotent,
  - runs after any reconciliation mutations,
  - and can be called from both API routes and background matching code.
- Keep `billingStatus` as the **operational truth** for Dispute/Collections reporting (per spec), not as a cosmetic UI label.

Suggested module placement:
- [x] Add `lib/reconciliation/billing-status.ts` (or `lib/matching/billing-status.ts`) exporting:
  - `computeNextBillingStatus(...)`
  - `applyBillingStatusTransitions(tx, scheduleIds, ...)`
  - Status: implemented and wired into schedule recompute (2026-01-29).

## Checklist by flow (repo-specific)

### A) Apply Match (normal allocations)

Files:
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route.ts`
- `lib/matching/revenue-schedule-status.ts`
- `lib/flex/revenue-schedule-flex-decision.ts`
- `lib/flex/revenue-schedule-flex-actions.ts`

Checklist:
- [x] After a non-negative allocation is applied and `recomputeRevenueScheduleFromMatches(...)` runs, apply Billing Status rules:
  - [x] **STRICT rule implemented:** a schedule only becomes `billingStatus=Reconciled` after deposit finalize (i.e., no unreconciled applied matches remain).
  - [x] If overage exceeds tolerance and the system returns a “prompt” decision, do **not** auto-set `In Dispute` yet (only set on Flex creation).
- [ ] Ensure any existing `inDispute` UI flags and filters switch to `billingStatus === InDispute` everywhere they represent “Dispute”.
- [ ] Add audit log event for automated Billing Status transitions (who/why). (Partial: Flex Product parent/base auto-set emits an audit entry.)

### B) Create Flex (manual creation)

Files:
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/create-flex/route.ts`
- `lib/flex/revenue-schedule-flex-actions.ts`

Checklist:
- [x] For `kind === "FlexProduct"`:
  - [x] Ensure the created flex schedule has `billingStatus=InDispute`.
  - [x] Spec semantics (P0): also set the **parent/base schedule** `billingStatus=InDispute` when a Flex Product is created as an overage split.
- [x] For `kind === "Chargeback"`:
  - [x] Ensure the created chargeback schedule has `billingStatus=InDispute` immediately, even if match remains pending approval.
- [x] For `kind === "ChargebackReversal"`:
  - [x] Decision (Phase 1): reversal is `InDispute` on creation (pending approval) and remains `InDispute` unless explicitly settled.

### C) Resolve Flex (Adjust / FlexProduct / Manual)

Files:
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/resolve-flex/route.ts`
- `lib/flex/revenue-schedule-flex-actions.ts`
- `lib/matching/revenue-schedule-status.ts`
- `lib/reconciliation/future-schedules.ts` (apply-forward path)

Checklist:
- [x] After `executeFlexAdjustmentSplit(...)` or `executeFlexProductSplit(...)`, apply Billing Status transitions:
  - [x] Base schedule: Flex Product overage creation sets base schedule to `In Dispute` (P0).
  - [ ] Base schedule: clearing `In Dispute` only via explicit settlement actions (“Accept Actual” / “Write Off” / Flex resolved) (not implemented yet).
  - [x] Flex schedule: Flex Product / Chargeback / Chargeback Reversal schedules are created as `In Dispute`.
  - [ ] Flex schedule: clear when “resolved” (future rename/assign UX).
- [ ] If `applyToFuture` mutates expectations, ensure Billing Status changes are limited to the intended scope (don’t accidentally flip already-settled periods).

### D) Chargeback approval flow

Files:
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/approve-flex/route.ts`
- `lib/flex/revenue-schedule-flex-actions.ts` (chargeback creation)
- `lib/matching/revenue-schedule-status.ts`

Checklist:
- [x] On chargeback creation: set `billingStatus=InDispute` (spec).
- [x] On approval (match becomes Applied) and recompute runs:
  - [x] ensure Billing Status remains `InDispute` unless explicitly settled (chargebacks remain placeholders).
- [ ] Add audit events that distinguish “auto-set on chargeback detection” vs “approval applied”.

### E) Matcher / status recompute (the “source of truth” layer)

Files:
- `lib/matching/revenue-schedule-status.ts`
- `lib/matching/deposit-matcher.ts`

Checklist:
- [x] Extend recompute to update *both*:
  - [x] `RevenueSchedule.status` (existing variance result)
  - [x] `RevenueSchedule.billingStatus` (operational lifecycle per spec)
- [x] Ensure recompute is idempotent and safe to call repeatedly (deposit matching calls it often).
- [ ] Decide precedence rules: if a user manually sets `billingStatus`, does recompute override it?
  - [x] Recommended: store `billingStatusSource` (`Auto|Manual|Settlement`) or similar and only auto-update when source is `Auto`.

## Test plan (repo-specific)

Unit tests (fast, deterministic):
- [x] Add tests for the Billing Status Engine mapping:
  - [x] Flex schedule created → InDispute
  - [x] Chargeback schedule created → InDispute
  - [x] STRICT rule: “settled” + “finalized matches” → Reconciled; otherwise → Open

Integration tests (DB-backed, existing patterns):
- [ ] Apply-match non-negative line → recompute → Billing Status updates.
- [ ] Create-flex (FlexProduct) → parent/flex Billing Status updates as chosen.
- [ ] Chargeback → approve-flex → recompute → Billing Status stays/changes per rule.

## Rollout checklist

- [ ] Add a feature flag for “spec billing status automation” if you want to roll out safely.
- [ ] Run reports/filters side-by-side (old “Overpaid => dispute” vs new `billingStatus`) until validated.
- [x] Provide a one-time backfill migration for legacy schedules if rule set changes (already started with Billing Status backfill; adjust if rules change).
