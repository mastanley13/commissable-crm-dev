# OpenClaw Bot Use Cases, Required Connections, And Meeting Agenda

Date: 2026-03-12
Status: Draft for developer meeting
Purpose: Provide a clear implementation discussion document focused on the first bot use cases, the technical connections required, and a practical meeting agenda.

## Goal

Define the clearest initial use cases for the OpenClaw bot layer and identify the application connections required to support them safely.

This document is intended to help a senior developer quickly understand:

- what the bot is supposed to do first
- what systems it must connect to
- what infrastructure and application changes are required
- what the implementation meeting needs to decide

## Recommended V1 Bot Position

Recommended v1:

- internal users only
- embedded in CRM or internal assistant panel first
- API-first integration
- read, preview, and draft actions only
- no direct writes in v1

## Core Use Cases

These are the clearest first use cases based on current CRM value and current repo capabilities.

### Use Case 1: Deposit reconciliation assistant

User need:

- A user wants help understanding a deposit and what to do next without manually opening every line and candidate.

What the bot should do:

- retrieve deposit detail
- summarize unresolved lines
- identify lines with suggested matches
- explain which lines appear blocked or risky
- suggest the next best review action

Example prompts:

- "Summarize this deposit for me."
- "Which lines still need manual review?"
- "What should I look at first on this deposit?"

Why this is a strong first use case:

- high client value
- read-safe
- uses existing reconciliation data structures
- gives immediate operational help without mutation risk

### Use Case 2: Candidate schedule explainer

User need:

- A user wants to understand which revenue schedules are likely candidates for a deposit line and why.

What the bot should do:

- fetch candidate schedules for a selected line
- rank or summarize top candidates
- explain confidence and reasoning in plain language
- call out why a candidate may be unsafe

Example prompts:

- "What schedule is the best candidate for line 7?"
- "Why is this line not auto-matching?"
- "What are the top 3 options for this line?"

Why this is a strong first use case:

- high explainability value
- directly supports reconciliation work
- builds trust in the bot

### Use Case 3: Match issue preview assistant

User need:

- A user wants to know what would happen if a deposit line were matched to a selected schedule before committing any action.

What the bot should do:

- preview match issues for a proposed line-to-schedule pairing
- explain cross-deal guard failures
- explain usage variance or commission-rate concerns
- explain future schedule implications
- recommend whether the user should proceed manually

Example prompts:

- "Preview what happens if line 7 is matched to RS-10492."
- "Why is this pairing being blocked?"
- "Would this create a future adjustment issue?"

Why this is a strong first use case:

- still non-persistent
- highly useful operationally
- aligns with preview-first product direction

### Use Case 4: Ticket draft assistant

User need:

- A user finds an exception and wants a clean ticket draft prepared quickly.

What the bot should do:

- gather the available facts from CRM context
- produce a structured ticket draft
- identify missing required fields
- return a ready-for-review payload

Example prompts:

- "Draft a ticket for this low-rate discrepancy."
- "Create a follow-up draft for this unresolved reconciliation issue."
- "Prepare a vendor issue ticket from this schedule."

Why this is a strong first use case:

- high operational value
- avoids autonomous writes
- helps bridge from AI assistance to human workflow

### Use Case 5: Revenue schedule lookup assistant

User need:

- A user wants to find a revenue schedule by account, order id, customer id, product, or date without manually filtering tables.

What the bot should do:

- search revenue schedules
- return compact relevant matches
- explain why a result is relevant
- support follow-up navigation or next actions

Example prompts:

- "Find schedules for Edge Business from February."
- "Look up schedules with order id 45691."
- "Show unreconciled schedules for this account."

Why this is a strong first use case:

- broad usefulness
- low risk
- supports multiple teams, not just reconciliation users

## Use Cases We Should Not Start With

These are legitimate future use cases, but not the right first implementation targets.

- applying matches automatically
- creating flex schedules directly
- applying future schedule adjustments
- finalizing or unfinalizing deposits
- undoing matches or audit operations
- deleting or restoring records
- admin or permission changes

Reason:

- these actions have financial, operational, or security blast radius

## Required Connections

These are the actual connections the bot layer will need in order to support the use cases above.

## 1. OpenClaw runtime connection to CRM

Purpose:

- allow OpenClaw to call bot-safe CRM endpoints

What is needed:

- network path from OpenClaw runtime to the CRM app
- secure credential for the bot principal
- environment configuration for base URL and secrets

Questions to resolve:

- where is OpenClaw hosted?
- is CRM reachable privately or publicly?
- how will secrets be stored and rotated?

## 2. Bot auth connection

Purpose:

- allow the CRM to authenticate the bot separately from human users

What is needed:

- bot principal credential
- bot principal storage or configuration
- action allowlist
- tenant scoping

Recommended shape:

- dedicated bot principal
- optional human-context token for in-app initiated sessions

Questions to resolve:

- database-backed bot principal now, or env-based prototype first?
- do we require human-context tokens in phase 1?

## 3. CRM bot gateway connection

Purpose:

- give OpenClaw a narrow and safe contract into CRM logic

What is needed:

- `/api/bot/...` route namespace
- route-level action ids
- request validation
- response shaping for agent/tool use

Recommended first routes:

- `/api/bot/reconciliation/deposits/:depositId/detail`
- `/api/bot/reconciliation/deposits/:depositId/lines/:lineId/candidates`
- `/api/bot/reconciliation/deposits/:depositId/lines/:lineId/match-issues-preview`
- `/api/bot/revenue-schedules/search`
- `/api/bot/tickets/draft`

Questions to resolve:

- do we build this inside the Next app now?
- do we wrap existing logic directly or create a thin service layer first?

## 4. Reconciliation domain connection

Purpose:

- support deposit summary, candidate explanation, and preview flows

What is needed:

- access to deposit detail data
- access to candidate schedule logic
- access to preview logic for match issues and adjustments

Existing repo capabilities:

- deposit detail route
- candidate schedules route
- match issues preview route
- AI adjustment preview route

Questions to resolve:

- which preview actions stay in v1?
- do any preview routes need narrower permission boundaries before exposure?

## 5. Revenue schedule lookup connection

Purpose:

- support search and contextual answers around schedules

What is needed:

- bot-safe search endpoint for schedules
- shaped response format
- pagination and guardrails

Existing repo capabilities:

- revenue schedules list/search route exists, but should not be exposed directly

Questions to resolve:

- do we introduce a dedicated bot-safe read permission?
- what fields should be returned to the bot by default?

## 6. Ticket drafting connection

Purpose:

- let the bot prepare tickets from CRM context

What is needed:

- ticket draft route that does not persist
- normalized input schema
- validation for required fields

Existing repo capabilities:

- ticket create route exists, but it writes directly and uses `withAuth()`

Questions to resolve:

- what exact ticket draft shape should the bot return?
- do we want the draft saved anywhere, or returned only in memory at first?

## 7. Audit and observability connection

Purpose:

- make every bot action traceable

What is needed:

- bot-specific audit metadata
- action id logging
- result status logging
- conversation/session identifiers where available

Existing repo capabilities:

- `AuditLog`
- `lib/audit.ts`

Questions to resolve:

- do previews and drafts log to `AuditLog`, a separate bot event table, or both?
- what minimum metadata is required for v1?

## 8. OpenClaw skill/tool connection

Purpose:

- give OpenClaw narrow skills that map to CRM bot routes

What is needed:

- one skill per bot capability
- tool definitions with strict inputs
- refusal behavior when data is missing or unsafe

Recommended first skill set:

- `crm_deposit_detail`
- `crm_reconciliation_candidates`
- `crm_match_issues_preview`
- `crm_schedule_lookup`
- `crm_ticket_draft`

Questions to resolve:

- are skills implemented as direct HTTP tools, custom wrappers, or both?
- what prompt/skill instructions will govern refusal and escalation behavior?

## 9. Staging and test data connection

Purpose:

- safely validate the bot before any production-facing usage

What is needed:

- staging tenant
- sample deposits
- sample unresolved lines
- sample candidate schedules
- sample ticket scenarios

Questions to resolve:

- do we already have enough staging data for reconciliation demos?
- who owns test scenario setup?

## Recommended First Technical Connection Set

If the team wants the smallest viable first integration, the minimum connection set is:

1. OpenClaw runtime to CRM over authenticated bot-safe HTTP
2. bot principal auth
3. `/api/bot/...` route namespace
4. deposit detail bot route
5. candidate schedules bot route
6. ticket draft bot route
7. bot audit logging

That is enough to prove the architecture and demo meaningful value.

## Meeting Agenda

Purpose:

- leave with implementation decisions, not just discussion

### 1. Opening and meeting goal

Talking points:

- confirm the goal of the bot initiative
- confirm this meeting is for implementation decisions
- confirm the target outcome is an agreed first build slice

Desired result:

- everyone agrees what decision must be made today

### 2. Confirm the first use cases

Talking points:

- which use cases deliver the most value with the least risk?
- do we agree the first use cases are:
  - deposit reconciliation assistant
  - candidate schedule explainer
  - match issue preview assistant
  - ticket draft assistant
  - revenue schedule lookup assistant
- are any of these out of scope for the first milestone?

Desired result:

- approved v1 use case list

### 3. Confirm what is explicitly out of scope

Talking points:

- no direct writes in v1
- no finalize/unfinalize
- no delete/restore
- no undo
- no admin actions
- no bulk changes

Desired result:

- clear blocked list

### 4. Confirm architecture direction

Talking points:

- API-first vs browser-first
- bot gateway inside Next app vs separate wrapper service
- OpenClaw as external runtime
- no direct access to current internal mutation routes

Desired result:

- architecture direction approved

### 5. Confirm auth and identity model

Talking points:

- bot principal
- whether to include short-lived human-context token in phase 1
- tenant scoping rules
- action allowlist rules

Desired result:

- auth model approved

### 6. Confirm the first technical connections

Talking points:

- OpenClaw runtime to CRM
- bot auth layer
- `/api/bot/...` routes
- reconciliation data access
- ticket draft support
- audit logging

Desired result:

- approved first connection set

### 7. Confirm the first implementation slice

Talking points:

- what do we build first?
- what is excluded from the first slice?
- what can be demoed after the first slice?

Recommended first slice:

- bot principal auth
- bot gateway
- deposit detail route
- candidate schedules route
- ticket draft route
- bot audit logging

Desired result:

- agreed first milestone

### 8. Confirm owners and next steps

Talking points:

- who owns auth?
- who owns bot routes?
- who owns OpenClaw skill wiring?
- who owns product acceptance criteria?
- what is the next check-in date?

Desired result:

- named owners and next actions

## Suggested Meeting Questions

Use these if discussion gets vague:

1. Which 3 use cases are definitely in the first milestone?
2. Are we allowing any write behavior in v1, yes or no?
3. Is the bot gateway inside the current app?
4. Are we creating a dedicated bot principal now?
5. Do we require human-context tokens in the first implementation?
6. What routes will exist at the end of the first slice?
7. What exact demo do we want to show after the first slice?

## Recommended Meeting Outcome

The strongest outcome is:

- 3 to 5 approved first use cases
- explicit blocked list
- approved auth model
- approved bot gateway pattern
- approved first connection set
- approved first implementation slice
- named owners

## Notes

- This document should be used together with the action catalog and auth/API architecture notes in this planning folder.
- If the transcript-derived product outcome document becomes available before the meeting, use it to refine the approved use cases and acceptance criteria.
