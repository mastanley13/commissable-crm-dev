# Milestone 3 Client-Critical Reconciliation Implementation Plan

Date: 2026-03-12
Owner: Engineering / Product
Status: Planning
Scope: Deliver the remaining client-critical reconciliation gaps required for Milestone 3 completion and UAT readiness.

## Purpose

Milestone 3 is not complete yet. The remaining work is client-critical because it affects:

- the reconciliation workflow order
- financial exception handling
- the UX Rob will use to judge whether the milestone is actually done
- UAT readiness under the milestone acceptance standard

This plan intentionally avoids broad cleanup, side refactors, and nonessential polish. It is narrowed to the required delivery gaps plus integration validation.

## Governing Delivery Standard

This pass is only complete when all of the following are true:

1. Reconciliation is visibly and functionally a 3-step flow from the client perspective.
2. Lower-rate discrepancies create a flag, a ticket, and a report/queue artifact.
3. Many-to-one uses the new simplified modal/layout rather than the legacy wizard shell.
4. Integration tests run against a disposable Postgres database and cover the missing client-critical scenarios.
5. No regression is introduced in:
   - usage variance handling
   - unmatch/reversal behavior
   - search
   - cross-deal blocking

## Priority Order

Implementation must proceed in this exact order:

1. True 3-step reconciliation flow
2. Lower-rate exception workflow
3. Many-to-one modal redesign
4. Disposable-DB integration validation

## In Scope

- Reconciliation alert/modal workflow
- Server-backed step gating and step completion state
- Commission-rate path split for higher-rate vs lower-rate scenarios
- Low-rate exception persistence, ticket creation, and review/report surfacing
- Many-to-one reconciliation modal redesign
- Reconciliation integration coverage and disposable Postgres execution

## Out of Scope

Do not expand this pass into:

- broader AI bot implementation
- unrelated reconciliation polish
- side refactors
- speculative architecture changes
- nonessential visual cleanup outside the required modal/workflow work

## Current State Summary

Based on the current working tree:

1. Usage variance handling is largely in place and should be preserved where possible.
2. Revenue schedule search, stale selection cleanup, and cross-deal validation are close to acceptable and should only be touched if regression requires it.
3. The reconciliation alert currently behaves as a 2-step UX, not a true 3-step client-facing workflow.
4. Rate discrepancy handling currently treats material deltas as one generalized path instead of higher-rate and lower-rate control paths.
5. Many-to-one logic is partially strong at the backend level, but the UX still uses the older wizard shell.
6. Full gated integration validation is currently blocked locally by missing disposable Postgres configuration.

## Workstream 1: True 3-Step Reconciliation Flow

### Objective

Implement a real sequential reconciliation workflow that the client experiences as:

1. Usage
2. Commission Rate
3. Commission Amount

This must be both visually clear and server-backed.

### Required Outcome

- Later steps are locked until earlier steps are resolved.
- Users cannot bypass sequence by manually switching tabs.
- Step state is backed by server-evaluated workflow status, not only frontend state.
- The modal shows visible completion state for each step.
- Step 3 exists clearly in the UX even if it is partly a final validation/result stage rather than a large independent correction engine.

### Recommended Product/Technical Approach

#### Backend

Add a reconciliation workflow evaluation layer that returns a structured step-state payload for a selected line/schedule pair. Suggested payload shape:

- `workflow.currentStep`
- `workflow.steps[]`
- `workflow.steps[].id`
- `workflow.steps[].status` (`locked | active | complete | blocked`)
- `workflow.steps[].resolutionRequired`
- `workflow.steps[].availableActions`
- `workflow.steps[].summary`

Recommended step semantics:

1. `usage`
   - Detect overage/underage/tolerance state.
   - Reuse current approved usage outcomes where possible.
2. `commissionRate`
   - Only active after usage is resolved or explicitly determined to require no action.
3. `commissionAmount`
   - Final explicit stage in the workflow.
   - Can initially act as a server-backed validation/result step if there is no separate correction path yet.
   - Must clearly tell the user whether any remaining commission-amount exception still requires action.

#### Frontend

Replace the current tab model with a step model:

- Show 3 named steps in order.
- Allow navigation only to the active step and completed prior steps.
- Prevent direct access to locked future steps.
- Show completion state visually.
- Preserve current usage option previews and future-impact previews where valid.

#### State model

Recommended state split:

- `workflowSnapshot` from server
- `selectedResolutionByStep`
- `pendingServerAction`
- `postActionWorkflowRefresh`

Do not trust the client alone to decide whether a later step is available.

### Implementation Tasks

1. Create a server-side workflow evaluator for line/schedule reconciliation state.
2. Refactor the alert modal to render a 3-step shell instead of two switchable tabs.
3. Lock future steps until server says they are active.
4. Add explicit step completion indicators.
5. Define Step 3 UX copy and result state so the client sees a true 3-step process.
6. Ensure confirm/apply actions refresh workflow state after each step resolution.
7. Add regression coverage for step ordering and gating.

### Acceptance Criteria

- Usage always appears first when multiple issues exist.
- Commission Rate is inaccessible until Usage is resolved.
- Commission Amount is inaccessible until the first two steps are resolved.
- The match cannot be finalized while an earlier required step is unresolved.
- Rob sees an explicit 3-step flow, not a 2-step modal.

## Workstream 2: Lower-Rate Exception Workflow

### Objective

Split commission-rate discrepancy handling into two distinct business-control paths:

- Higher-than-expected rate
- Lower-than-expected rate

### Required Outcome

#### Higher-than-expected rate

- Allow one-time acceptance on current schedule.
- Allow apply-to-future update.

#### Lower-than-expected rate

- Do not silently normalize.
- Do not expose a normal future-update path.
- Auto-flag the schedule as a low-rate exception.
- Auto-create a ticket.
- Send the item to a report/queue/review surface.

### Recommended Product/Technical Approach

#### Backend rule split

Refactor rate discrepancy classification so it returns direction, not only absolute variance:

- `direction = higher | lower | none`
- `differencePercent`
- `isMaterial`
- `allowedActions`

Recommended behavior:

1. `higher`
   - permit `accept_current`
   - permit `apply_to_future`
2. `lower`
   - permit `flag_exception`
   - auto-create ticket as part of handling
   - persist review/report artifact
   - do not offer `apply_to_future`

#### Persistence

Recommended persisted exception artifacts:

- low-rate exception flag on schedule or dedicated reconciliation exception record
- linked ticket id
- reason metadata
- source deposit id / deposit line id
- expected rate
- received rate
- difference
- status for investigation workflow

If possible, prefer a dedicated structured exception record over burying this in freeform audit metadata.

#### Report/queue surface

Recommended near-term implementation:

- create a reportable queue surface using either:
  - a dedicated low-rate exception table and list page, or
  - a report entry model filtered to low-rate exceptions, or
  - a queue surfaced from structured exception records

This does not need broad reporting redesign, but it must be a real review surface the client can use.

### Implementation Tasks

1. Refactor rate discrepancy summary logic to classify higher vs lower direction.
2. Restrict future-update behavior to higher-rate path only.
3. Add low-rate exception persistence.
4. Add automatic ticket creation for low-rate cases.
5. Surface low-rate items in a report/queue/review view.
6. Update the reconciliation modal so lower-rate cases present exception language rather than normalization language.
7. Add automated coverage for:
   - lower-rate exception path
   - higher-rate one-time path
   - higher-rate future-update path
   - prohibition of future-update for lower-rate path

### Acceptance Criteria

- Lower-rate discrepancies cannot disappear without an exception artifact.
- A ticket is created automatically for lower-rate cases.
- Lower-rate cases appear in a review surface.
- Higher-rate cases retain one-time and apply-to-future behavior.

## Workstream 3: Many-to-One Simplified Modal Redesign

### Objective

Keep the working mixed-rate protection and rip/replace logic, but replace the legacy many-to-one wizard shell with the simplified redesign expected by the client.

### Required Outcome

- Remove the old `Selection / Allocation / Validation / Apply` progress-pill structure.
- Replace it with the simplified comparison layout discussed with Rob.
- Make `Edit Allocation` the primary visible user action.
- Keep preview data central and readable.
- Preserve current mixed-rate detection and replacement logic.
- Align the shell with the newer reconciliation modal standards.

### Recommended Product/Technical Approach

#### Preserve existing logic

Keep these areas unless regression forces change:

- mixed-rate detection
- replacement-required blocking
- rip/replace creation and undo logic
- cross-deal safeguards
- validation backend

#### Replace UX shell

Move from wizard framing to comparison framing:

1. Header
   - reconciliation-standard modal shell
   - concise explanation of selected lines vs selected schedule(s)
2. Unified comparison block
   - deposit line data
   - previewed target schedule state
   - temporary actual usage / actual commission impact
3. Primary action area
   - `Edit Allocation`
4. Secondary action area
   - bundle / rip-and-replace only when relevant
5. Validation summary
   - inline and subordinate, not a top-level wizard phase

### Implementation Tasks

1. Remove wizard-style progress pills and section framing.
2. Rebuild the modal around a comparison-first layout.
3. Promote `Edit Allocation` as the primary action.
4. Keep bundle visibility when applicable.
5. Preserve replacement-required messaging for mixed-rate scenarios.
6. Align layout with reconciliation modal standards:
   - consistent header treatment
   - staged actions
   - readable preview emphasis

### Acceptance Criteria

- The client no longer sees the legacy wizard shell.
- Edit Allocation is the obvious primary action.
- Mixed-rate protection still works.
- Bundle/replacement remains available where valid.
- The modal feels like the newer reconciliation UX, not the older wizard.

## Workstream 4: Disposable-DB Integration Validation

### Objective

Run the reconciliation suite against a real disposable Postgres database after the three delivery workstreams are implemented.

### Required Outcome

The environment issue around `TEST_DATABASE_URL` must be treated as a real blocker to resolve, not as a reason to mark the work complete.

### Required Test Coverage

1. 3-step workflow ordering and gating
2. lower-rate exception path
3. higher-rate update path
4. many-to-one redesigned flow
5. stale-selection cleanup
6. search
7. cross-deal validation
8. unmatch/reversal behavior after workflow changes

### Recommended Execution Plan

1. Stand up disposable Postgres environment for test execution.
2. Run targeted reconciliation integration tests first.
3. Run the broader reconciliation regression group second.
4. Fix regressions before expanding any unrelated work.
5. Capture test results in implementation summary before calling the pass complete.

### Test Work Items

#### Add or update tests for:

- ordered step gating when usage and rate issues coexist
- Step 3 commission-amount presence and completion semantics
- lower-rate auto-flag + auto-ticket + queue/report artifact
- higher-rate current-only acceptance
- higher-rate future propagation
- many-to-one modal-driven flow behavior where applicable
- unmatch behavior after new workflow state writes

#### Re-run existing regression areas:

- usage variance handling
- revenue schedule search
- stale selection cleanup
- cross-deal validation

## Implementation Sequence

### Phase 1: True 3-Step Flow

Target outcome:

- server-backed workflow snapshot
- frontend 3-step shell
- locked future steps
- visible completion state

### Phase 2: Lower-Rate Exception Workflow

Target outcome:

- higher-rate and lower-rate split
- low-rate exception persistence
- automatic ticket creation
- report/queue surfacing

### Phase 3: Many-to-One Redesign

Target outcome:

- simplified modal shell
- preserved mixed-rate safety
- comparison-first layout

### Phase 4: Disposable-DB Integration Validation

Target outcome:

- disposable Postgres setup confirmed
- new and existing critical tests executed
- failures resolved or documented as blockers

## Recommended File/Area Touch Map

Expected primary touch points during implementation:

- `components/reconciliation-alert-modal.tsx`
- `components/deposit-reconciliation-detail-view.tsx`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/match-issues-preview/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/rate-discrepancy/apply-to-future/route.ts`
- new backend workflow-evaluation helper(s)
- possible new exception persistence area
- report/queue UI and API surface for low-rate exceptions
- `components/reconciliation-match-wizard-modal.tsx`
- reconciliation integration tests

## Risks

1. Workflow-state expansion can accidentally break existing usage variance behavior if step resolution writes are coupled too tightly.
2. Auto-ticket creation for low-rate scenarios can create duplicate artifacts if idempotency is not designed up front.
3. Many-to-one redesign can regress working mixed-rate replacement if UX rewrite also changes payload structure.
4. Step 3 can be implemented too weakly and still fail client perception if it feels like a hidden no-op rather than a real stage.
5. Disposable DB setup can delay completion if the environment issue is left until the end.

## Clarifications Needed

These should be answered before implementation hardens behavior.

### Clarification 1: Step 3 exact product meaning

Need clarification:

- Is Step 3 intended to be:
  - a true commission-amount correction engine,
  - a final commission-amount exception review/confirmation stage,
  - or a hybrid where some cases are validation-only and some require action?

Recommended assumption if no answer arrives:

- implement Step 3 as a real server-backed commission-amount validation/result stage first, with explicit action only when a remaining exception exists.

### Clarification 2: Low-rate review surface choice

Need clarification:

- Should the required review surface be:
  - a dedicated low-rate queue page,
  - a filtered Reports entry/list,
  - the Tickets list with structured low-rate metadata,
  - or a combination of ticket + report row?

Recommended assumption if no answer arrives:

- create a dedicated structured low-rate exception queue or report surface tied to the schedule and ticket, because that most directly satisfies the client requirement.

### Clarification 3: Auto-ticket creation ownership and defaults

Need clarification:

- What should default ticket values be for:
  - issue/category
  - assignee
  - priority
  - severity
  - status

Recommended assumption if no answer arrives:

- create an open investigation ticket with deterministic low-rate issue text and leave assignment unowned unless current business rules already define a default assignee.

### Clarification 4: Low-rate flag location

Need clarification:

- Should low-rate state live on:
  - the revenue schedule,
  - a dedicated reconciliation exception record,
  - or both?

Recommended assumption if no answer arrives:

- use a dedicated exception record plus a lightweight schedule-level boolean/status indicator if the UI needs fast filtering.

### Clarification 5: Many-to-one final layout reference

Need clarification:

- Is there a latest approved mockup or screenshot for the simplified many-to-one modal, or should implementation be based on the March 11 direction summary alone?

Recommended assumption if no answer arrives:

- implement the simplified comparison-first layout from the March 11 notes and keep bundle as a conditional secondary action.

### Clarification 6: Scope of “commission amount” exceptions

Need clarification:

- Which remaining commission-amount mismatches should Step 3 treat as:
  - informational only
  - resolvable
  - exception-worthy

Recommended assumption if no answer arrives:

- treat Step 3 as the final explicit checkpoint for any remaining commission difference after usage and rate are resolved, and only allow completion when the remaining state is either within approved tolerance or has produced the required exception artifact.

## Recommended Definition of Done Checklist

- [ ] Reconciliation modal is visibly 3-step from the client perspective.
- [ ] Later steps are locked until earlier ones are resolved.
- [ ] Step gating is server-backed.
- [ ] Higher-rate and lower-rate discrepancy paths are split.
- [ ] Lower-rate path auto-flags, auto-creates ticket, and lands in review surface.
- [ ] Higher-rate future update is limited to the higher-rate path only.
- [ ] Many-to-one legacy wizard shell is removed.
- [ ] Many-to-one simplified comparison layout is in place.
- [ ] Mixed-rate replacement logic still works.
- [ ] Disposable Postgres integration environment is configured.
- [ ] Required reconciliation integration tests run.
- [ ] No regressions in usage variance handling, unmatch behavior, search, or cross-deal blocking.

## Delivery Output Required After Implementation

After execution, the implementation summary should report:

1. what is fully implemented
2. what remains incomplete, if anything
3. any open ambiguity still requiring product clarification
4. test results, including failing cases

