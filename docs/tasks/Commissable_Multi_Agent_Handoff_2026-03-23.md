# Commissable CRM — Multi-Agent Execution Handoff
_Date: March 23, 2026_

## 1) What this handoff is for

This handoff turns the revised merged plan into a practical multi-agent execution model you can use immediately with several coding agents. It is designed around the latest March 2026 client feedback and the March 23 execution-plan draft.

The working principle is:

- Run the **contained Change Start Date package** in parallel with the **reconciliation foundation**.
- Do **not** let UI polish outrun the ledger / match-group / undo foundations.
- Ship **undo / reversal with the A/B/C variance scenarios**, not afterward.
- Treat `12710` as an **investigation item**, not a blocker, until it is proven duplicate.
- Treat the March 2026 reconciliation docs as the governing spec for this pass.

## 2) Source-of-truth rules for all agents

Every agent must follow these rules:

1. **Use only the project docs / summaries / notes as the source of truth.**
2. If two documents conflict, **prefer the most recent March 2026 reconciliation feedback** over older January–March workflow ideas.
3. Do **not** assume older flex behavior still applies.
4. Label any implementation guess as **ASSUMED** and explain why.
5. Never change business logic beyond the scope of the assigned tickets.
6. Do not mark work complete without code changes, regression notes, and evidence.

### Non-negotiable business rules
- Flex schedules are **user-initiated only** and must never be auto-created during preview or intermediate matching steps.
- `price_each` must **not** be modified to absorb usage variance; the current model is an **adjustment ledger**.
- Undo must remove only artifacts created by the same match group.
- Change Start Date must show live collision states, plain-English errors, and disable Apply while conflicts exist.

## 3) Recommended owner model

Use these owner lanes even if the “owners” are separate coding agents rather than people.

### PM / Integrator (you)
Owns:
- backlog order
- acceptance review
- merge sequencing
- handoff between lanes
- final go / no-go

### Agent A — Revenue Schedule / Start-Date lane
Owns:
- `CRM-RS-101`
- `CRM-RS-102`
- `CRM-RS-103`
- `CRM-RS-104`

### Agent B — Reconciliation foundation / data model lane
Owns:
- `CRM-REC-105`
- `CRM-REC-101`
- `CRM-REC-110`
- `CRM-REC-102` (inventory + migration planning portion only)
- `CRM-REC-104` (investigation only)

### Agent C — Reconciliation scenario flow lane
Owns:
- `CRM-REC-106`
- `CRM-REC-107`
- `CRM-REC-108`
- `CRM-REC-109`

### Agent D — Undo / cleanup / follow-through lane
Owns:
- `CRM-REC-103`
- `CRM-REC-102` (live cleanup script + legacy follow-through)
- `CRM-REC-104` (suppression only if duplicate is confirmed)

### Agent E — QA / regression lane
Owns:
- scenario fixtures
- regression matrix
- disposable-db or isolated-env verification
- proof package per wave

## 4) Revised merged ordering

## Wave 0 — Guardrails and discovery (short, parallel-safe)
**Owner:** Agent B + Agent E  
**Tickets:** `CRM-REC-104` investigation only, `CRM-REC-102` inventory only

### Goal
Create safe visibility before deeper code changes.

### Outputs
- written finding on whether `12710` is duplicate vs legitimate alternate
- inventory of orphan `.N` child schedules and legacy `FLEX-*` rows
- fixture list for test data / regression cases
- cleanup impact notes

### Exit criteria
- `12710` is documented as **duplicate / legitimate / unresolved**
- legacy flex inventory exists with counts and examples
- no production-facing suppression or deletes have happened yet

---

## Wave 1A — Change Start Date package
**Owner:** Agent A  
**Tickets:** `CRM-RS-101`, `CRM-RS-102`, `CRM-RS-103`, `CRM-RS-104`

### Goal
Deliver the entire start-date shift modal as one cohesive package.

### Required outcomes
- current and new date shown side by side
- per-row Ready / Collision states
- live collision detection
- plain-English collision errors
- Apply disabled when any collision exists
- redesigned two-column layout with persistent preview

### Exit criteria
- all 4 RS tickets complete together
- one happy-path demo
- one collision demo
- one resolved-collision demo
- no UUIDs visible in any user-facing error state

---

## Wave 1B — Reconciliation foundation
**Owner:** Agent B  
**Tickets:** `CRM-REC-105`, `CRM-REC-101`, `CRM-REC-110`

### Goal
Lock the rules that make variance resolution and undo safe.

### Required outcomes
- first-class match-group ownership metadata exists
- no flex child can be created during preview
- total-dollar adjustment ledger exists for odd-amount / multi-unit handling
- `price_each` is not the core adjustment mechanism

### Exit criteria
- schema / persistence changes are in place
- preview path proves no child flex schedule is persisted
- odd-amount example can be represented without repricing or rounding into per-unit math
- implementation notes document created ids needed for reversal

---

## Wave 2 — Reconciliation A/B/C flow
**Owner:** Agent C, with Agent B support if contract / schema adjustments are needed  
**Tickets:** `CRM-REC-106`, `CRM-REC-107`, `CRM-REC-108`, `CRM-REC-109`

### Goal
Implement the full variance-resolution experience end to end on top of the new ledger model.

### Required outcomes
- Scenario A = one schedule only
- Scenario B = current + future schedule chain
- Scenario C = child flex schedule on confirm only
- Step 2 / Step 3 copy matches the March ledger wording
- Option B explicitly names 12699
- Option C shows proposed child schedule number before confirm

### Exit criteria
- all 4 tickets demoed together
- no scenario mutates `price_each`
- Option C child is created only after confirm
- Step 3 always shows total-dollar adjustments, not per-unit math

---

## Wave 3 — Undo and cleanup
**Owner:** Agent D  
**Tickets:** `CRM-REC-103`, `CRM-REC-102` follow-through, `CRM-REC-104` follow-through only if confirmed

### Goal
Make reversal safe and clean up legacy artifacts without breaking current matching.

### Required outcomes
- undo removes only artifacts created by the same match group
- child flex schedules are deleted on undo
- adjustment records are deleted on undo
- cleanup script supports dry-run and live mode
- `12710` suppression only happens if the investigation proved duplicate status

### Exit criteria
- undo regression passes for A, B, and C
- dry-run cleanup report exists before live cleanup
- normal suggested matches exclude orphan / legacy flex rows after cleanup
- no legitimate schedule is removed without investigation proof

## 5) Owner / ticket matrix

| Ticket ID | Owner | Wave | Depends On | Exit signal |
|---|---|---|---|---|
| CRM-RS-101 | Agent A | 1A | none | inline current/new date columns working |
| CRM-RS-102 | Agent A | 1A | RS-101 | live collision detection working |
| CRM-RS-103 | Agent A | 1A | RS-102 | Apply disabled on collision |
| CRM-RS-104 | Agent A | 1A | RS-101/102/103 | two-column layout + preview complete |
| CRM-REC-104 (investigation) | Agent B | 0 | none | written conclusion only |
| CRM-REC-102 (inventory) | Agent B | 0 | none | legacy/orphan flex inventory complete |
| CRM-REC-105 | Agent B | 1B | none | match-group metadata persisted |
| CRM-REC-101 | Agent B | 1B | REC-105 recommended | no flex persisted during preview |
| CRM-REC-110 | Agent B | 1B | none | total-dollar adjustment ledger working |
| CRM-REC-106 | Agent C | 2 | REC-105, REC-110 | Scenario A passes |
| CRM-REC-107 | Agent C | 2 | REC-105, REC-110 | Scenario B passes |
| CRM-REC-108 | Agent C | 2 | REC-105, REC-101 | Scenario C passes |
| CRM-REC-109 | Agent C | 2 | REC-106/107/108 | shared copy/state layer complete |
| CRM-REC-103 | Agent D | 3 | REC-105, REC-106/107/108 | undo removes match-group artifacts only |
| CRM-REC-102 (cleanup) | Agent D | 3 | REC-103, Wave 0 inventory | cleanup dry-run + live mode ready |
| CRM-REC-104 (suppression) | Agent D | 3 | Wave 0 investigation proof | suppress only if duplicate confirmed |

## 6) Definition of done for every agent

An agent cannot mark a ticket done unless it returns all of the following:

1. **What changed**
   - files changed
   - schema / migration changes
   - services / contracts added or modified

2. **Why the implementation matches the spec**
   - map code behavior to ticket acceptance criteria
   - mention any ASSUMED decisions explicitly

3. **Regression check**
   - what was tested
   - what was intentionally not tested
   - any known risk left open

4. **Evidence**
   - screenshots, logs, or test output
   - before / after behavior summary
   - exact edge case exercised

5. **Merge warning**
   - anything another agent must know before integrating

## 7) Handoff rules between agents

### Agent A → PM
Hand off only when the full Change Start Date package is coherent. Do not merge 101 without 102/103/104 unless you intentionally want a partial feature branch.

### Agent B → Agent C
Must provide:
- data model summary
- persistence contract for adjustment rows
- match-group metadata contract
- rules for flex child preview vs confirm
- any migration / seed requirements

### Agent C → Agent D
Must provide:
- resolution types used in match groups
- created ids for each scenario
- exact undo expectations per scenario
- known orphan / legacy edge cases discovered

### Agent D → PM / QA
Must provide:
- undo matrix by scenario
- cleanup dry-run report
- live cleanup plan
- confirmation on whether `12710` was suppressed or left unchanged

## 8) Copy/paste prompt — Agent A (Change Start Date lane)

```text
You are the implementation owner for the Commissable CRM Change Start Date package.

Scope:
- CRM-RS-101
- CRM-RS-102
- CRM-RS-103
- CRM-RS-104

Source of truth:
- March 2026 “Changing Rev Sch Start Dates Error” memo
- March 20 client feedback summary
- Do not use older behavior if it conflicts with the March 2026 memo.

Business rules you must preserve:
- The user must see Current Schedule Date and New Schedule Date side by side.
- Collision detection runs live as the user edits New Start Date.
- Each colliding row shows a red New Schedule Date state and Collision status badge.
- Error text must be plain English and must not expose UUIDs.
- Apply Change must be disabled while any collision exists.
- Layout is two-column: left = New Start Date + Reason, right = Date shift preview summary.
- Preview section label is “Date shift preview — confirm before applying.”

Deliverables:
1. Implement the full RS package in one branch.
2. Return a completion note with:
   - files changed
   - behavior summary
   - screenshots / proof for happy path and collision path
   - any ASSUMED decisions
   - regression risks

Do not stop at partial UI changes. The package is only done when all four tickets work together.
```

## 9) Copy/paste prompt — Agent B (Reconciliation foundation lane)

```text
You are the implementation owner for the Commissable CRM reconciliation foundation.

Scope:
- CRM-REC-105
- CRM-REC-101
- CRM-REC-110
- plus Wave 0 investigation/inventory for CRM-REC-102 and CRM-REC-104

Source of truth:
- March 2026 “Reconciliation Maching Issues and Workflow”
- March 20 Rob feedback summary
- March 23 execution-plan draft

Business rules you must preserve:
- Flex schedules are user-initiated only.
- No flex child schedule may be persisted during preview, option selection, or any intermediate step.
- `price_each` is never modified directly to absorb usage adjustment.
- Adjustments are stored as separate total-dollar records.
- Odd-amount / multi-unit adjustments stay as total-dollar records and must not be rounded into per-unit math.
- Match-group metadata must be sufficient for scenario-specific undo later.

Required outputs:
1. Inventory legacy FLEX-* rows and orphan .N child schedules.
2. Investigate schedule 12710 and document whether it is duplicate, legitimate, or unresolved.
3. Implement/extend the adjustment ledger persistence and match-group ownership metadata.
4. Prevent flex-child persistence during preview.
5. Return:
   - schema changes
   - persistence contract
   - preview vs confirm behavior summary
   - test evidence
   - open assumptions

Do not implement scenario-specific UI copy; focus on safe foundation contracts and behavior.
```

## 10) Copy/paste prompt — Agent C (A/B/C scenario lane)

```text
You are the implementation owner for the Commissable CRM variance-resolution workflow.

Scope:
- CRM-REC-106
- CRM-REC-107
- CRM-REC-108
- CRM-REC-109

Dependencies you must respect:
- match-group metadata from REC-105
- no preview-time flex creation from REC-101
- total-dollar adjustment ledger model from REC-110

Source of truth:
- March 2026 “Reconciliation Maching Issues and Workflow”
- March 20 Rob feedback summary
- Use the March ledger wording, not older price-each adjustment wording.

Required scenario behavior:
- Option A: one adjustment record on the current schedule only.
- Option B: one adjustment record per current/future schedule in the same opportunity-product chain.
- Option C: proposed child number shown during preview; actual child schedule created only after confirm.
- Option B must explicitly name 12699 in button/copy/confirmation.
- Step 2 and Step 3 copy must say adjustment record created and must keep price_each unchanged.
- Step 3 must show total-dollar amounts only, never per-unit math.

Return:
- implementation summary by ticket
- screenshots / logs for A, B, and C
- any copy assumptions
- integration notes for undo lane
```

## 11) Copy/paste prompt — Agent D (Undo / cleanup lane)

```text
You are the implementation owner for reversal and cleanup in the Commissable CRM reconciliation flow.

Scope:
- CRM-REC-103
- CRM-REC-102 follow-through
- CRM-REC-104 follow-through only if duplicate is proven

Dependencies:
- match-group metadata must already exist
- A/B/C scenario flows must already create owned artifacts in a deterministic way

Business rules:
- Undo must delete only artifacts created by the same match group.
- Undo must remove schedule_adjustments created by that match group.
- Undo must delete any child flex schedule created by that match group.
- Cleanup must support dry-run before live execution.
- 12710 must remain untouched unless investigation proved it is duplicate.

Deliverables:
1. Undo implementation with regression proof for A/B/C.
2. Cleanup script with dry-run and live mode.
3. Suppression logic for 12710 only if justified by investigation result.
4. Completion note with:
   - undo matrix
   - cleanup report
   - data safety notes
   - rollback considerations
```

## 12) Copy/paste prompt — Agent E (QA / verifier lane)

```text
You are the QA / regression owner for the current Commissable CRM wave plan.

Your job is not to invent requirements. Your job is to validate the implementation against the documented behavior.

Please build and/or run a regression matrix covering:

Change Start Date
- happy path
- internal collision
- external collision on same opportunity product
- no UUIDs in errors
- Apply disabled on collision

Reconciliation A/B/C
- Option A single-schedule adjustment
- Option B current + future adjustments
- Option C child created only on confirm
- Step 2 / Step 3 copy reflects selected option
- odd-amount total-dollar adjustment behavior

Undo / cleanup
- undo removes only owned artifacts
- child flex deleted on undo
- candidate search excludes orphan / legacy flex rows afterward

Match quality
- 12710 investigation result recorded
- regression on whichever branch is correct

Return:
- pass / fail by scenario
- exact repro steps for failures
- screenshots / logs
- recommendation: merge / block / conditional-merge
```

## 13) Prompt for the PM / integrator (for use with a general agent)

```text
Act as release integrator for the Commissable CRM multi-agent build.

Use this sequencing:
1. Wave 0 discovery
2. Wave 1A Change Start Date
3. Wave 1B reconciliation foundation
4. Wave 2 reconciliation A/B/C
5. Wave 3 undo and cleanup

Your job:
- review each agent’s completion note
- check that dependencies are satisfied before merge
- reject any work that violates March 2026 source-of-truth rules
- specifically block any implementation that:
  - changes price_each to absorb usage variances
  - creates flex schedules during preview
  - leaves undo until after scenario rollout
  - suppresses 12710 without investigation proof

For each wave, output:
- merge-ready items
- blocked items
- open risks
- next agent handoff
```

## 14) Suggested working cadence

### Daily structure
- Morning: Agent A + Agent B active in parallel
- Midday: PM review of contracts / edge cases
- Afternoon: Agent C begins only after Agent B publishes foundation summary
- End of day: Agent E verifies finished items and opens any blockers

### Review checkpoints
- After Wave 0: decide whether 12710 stays visible
- After Wave 1A: demo full start-date package
- After Wave 1B: confirm ledger model and no-preview flex creation
- After Wave 2: demo A/B/C + Step 2/3 copy
- After Wave 3: run undo matrix and cleanup dry-run before any live cleanup

## 15) What you should tell every agent up front

Use this short instruction block at the top of every prompt:

```text
Important constraints:
- Use only the uploaded Commissable project docs / transcripts / summaries as source of truth.
- If the March 2026 docs conflict with older notes, the March 2026 docs win.
- Mark any assumption as ASSUMED.
- Do not mutate price_each to absorb usage variances.
- Do not create flex children during preview.
- Do not mark work done without regression notes and proof.
```

## 16) PM recommendation on how many agents to run at once

### Best case: 4 active agents
- Agent A: Start Date package
- Agent B: Foundation / investigation / inventory
- Agent C: A/B/C scenarios (starts after B publishes contract summary)
- Agent D: Undo / cleanup (starts after C publishes created-artifact map)

### Safe case: 3 active agents
- A and B in parallel
- C after B
- D after C

### Avoid
- letting two agents change the same reconciliation service layer at the same time
- letting cleanup run before undo metadata is proven
- letting UI copy agents invent workflow logic

## 17) Final release gate

Do not call this wave complete until:
- Change Start Date is shippable as one package
- reconciliation uses the ledger model
- flex creation is confirm-only
- undo removes owned artifacts only
- legacy cleanup has a dry-run report
- 12710 is either documented as legitimate or suppressed with proof
