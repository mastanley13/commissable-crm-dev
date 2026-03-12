# OpenClaw Bot First Implementation Slice Plan

Date: 2026-03-12
Status: Draft implementation plan
Purpose: Define the smallest useful build slice for the OpenClaw bot layer after meeting decisions are made.

## Goal

Build the first real bot integration slice without taking on direct write risk.

Recommended first slice:

- bot principal auth
- bot gateway route pattern
- one read route
- one reconciliation read route
- one draft route
- bot audit metadata logging

This is enough to validate the architecture, connect OpenClaw, and demonstrate real CRM value.

## Recommended Scope

### Include

- bot principal credential validation
- bot route helper
- tenant-scoped bot request context
- bot audit metadata
- read-safe bot routes
- ticket draft route

### Exclude

- human approval execution flow
- direct writes
- preview-to-apply mutation flows
- destructive actions
- browser automation
- memory-heavy agent features

## Proposed Deliverables

### 1. Bot principal model and credential validation

Build:

- new bot principal storage model or equivalent
- credential lookup and validation
- tenant scoping
- active/inactive state
- allowed action ids

Output:

- a bot runtime can authenticate without using a human session cookie

### 2. `withBotAuth()` helper

Build:

- auth helper for `/api/bot/...` routes
- request context attachment
- action allowlist enforcement

Output:

- one reusable gateway auth pattern

### 3. Bot audit metadata logging

Build:

- helper or extension around existing audit logging
- metadata fields for bot identity and action id

Output:

- every bot action is traceable

### 4. First bot routes

Recommended route set:

- `/api/bot/reconciliation/deposits/:depositId/detail`
- `/api/bot/reconciliation/deposits/:depositId/lines/:lineId/candidates`
- `/api/bot/tickets/draft`

Why this route set:

- strong client value
- safe enough for first release
- touches both retrieval and useful operational assistance

### 5. OpenClaw skill stubs

Build:

- `crm_deposit_detail`
- `crm_reconciliation_candidates`
- `crm_ticket_draft`

Output:

- first usable OpenClaw skill pack for the CRM

## Suggested Implementation Order

1. Add bot principal storage and validation
2. Add `withBotAuth()` helper
3. Add bot audit metadata helper
4. Implement first read route
5. Implement second reconciliation route
6. Implement ticket draft route
7. Wire OpenClaw skills to those routes
8. Test in staging

## Suggested Technical Shape

### CRM side

- `lib/bot-auth.ts`
- `lib/bot-audit.ts`
- `app/api/bot/...`

Possible files:

- `app/api/bot/reconciliation/deposits/[depositId]/detail/route.ts`
- `app/api/bot/reconciliation/deposits/[depositId]/lines/[lineId]/candidates/route.ts`
- `app/api/bot/tickets/draft/route.ts`

### OpenClaw side

- one CRM skill pack
- 3 narrow tools only
- no generic "do anything in CRM" tool

## Dependencies

These decisions should be finalized before implementation starts:

- v1 action catalog
- auth model
- prohibited action policy
- initial audit metadata contract

## Recommended Acceptance Criteria

### Auth

- OpenClaw can call the bot gateway without a browser session
- invalid or expired bot credentials are rejected
- tenant mismatch is rejected

### Authorization

- non-allowlisted actions are rejected
- blocked actions cannot be invoked through the bot gateway

### Audit

- each bot route writes identifiable bot metadata to CRM audit logs or equivalent tracking

### Functionality

- deposit detail route returns shaped deposit summary and line items
- candidate route returns ranked candidate schedules and reasons
- ticket draft route returns a structured draft without persisting a ticket

## Risks In This Slice

### 1. Overbuilding auth too early

Mitigation:

- keep the first bot principal model minimal

### 2. Accidentally exposing broad internal routes

Mitigation:

- use new `/api/bot/...` routes only

### 3. Draft route quietly becoming a write route

Mitigation:

- enforce non-persistence in the first ticket draft endpoint

## Recommended Task Breakdown

| Task | Owner | Notes |
| --- | --- | --- |
| Define bot principal storage shape |  | Can start minimal |
| Build bot auth helper |  | Central piece for all bot routes |
| Define bot audit metadata contract |  | Reuse `AuditLog.metadata` where possible |
| Build deposit detail bot route |  | Reuse existing business logic carefully |
| Build candidate schedules bot route |  | Keep response agent-friendly |
| Build ticket draft bot route |  | Draft only, no DB write |
| Create OpenClaw skill definitions |  | Keep tool set narrow |
| Stage and test with seed scenarios |  | Validate tenant safety and denied actions |

## What To Demo After This Slice

After the first slice, the team should be able to demo:

1. OpenClaw retrieves a deposit summary.
2. OpenClaw explains likely candidate schedules for a line.
3. OpenClaw drafts a ticket from exception context.
4. CRM logs the bot activity with bot-specific metadata.

That is enough to prove the architecture without opening the door to unsafe writes.
