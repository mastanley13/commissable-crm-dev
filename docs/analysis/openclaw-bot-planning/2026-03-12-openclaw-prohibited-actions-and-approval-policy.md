# OpenClaw Bot Prohibited Actions And Approval Policy

Date: 2026-03-12
Status: Draft for implementation planning
Purpose: Define what the OpenClaw bot must not do in v1, what requires explicit approval, and what safety rules must govern any future write-capable bot actions.

## Goal

Create a hard policy boundary for the bot layer so implementation decisions do not drift into unsafe territory.

This document is intended to be used as:

- a meeting decision aid
- a bot gateway policy reference
- a first-pass allow/deny framework for implementation

## Executive Policy

Recommended v1 policy:

- The bot may perform `read`, `preview`, and `draft` actions only.
- The bot may not perform direct `write` or `destructive` actions in v1.
- The bot must not call internal mutation routes directly.
- The bot must not be granted broad admin or bulk-update capability.
- Any future write action must require a structured approval record tied to the exact action payload.

## Policy Principles

These principles should govern the implementation:

- Least privilege first
- Preview before apply
- No destructive autonomy
- No approval by vague chat text alone
- No bypass of human permissions
- No bypass of tenant boundaries
- CRM audit logs are the source of truth

## Action Classes And Policy

### `Read`

Definition:

- fetch or summarize CRM data without persistence

Policy:

- allowed in v1 if the action is explicitly allowlisted

Approval:

- not required

### `Preview`

Definition:

- simulate or calculate an outcome without persistence

Policy:

- allowed in v1 if the action is explicitly allowlisted

Approval:

- not required, but the result should still be logged

### `Draft`

Definition:

- generate a structured draft payload for later human review

Policy:

- allowed in v1 if explicitly allowlisted

Approval:

- required before converting the draft into a persisted action

### `Write`

Definition:

- any action that creates, updates, assigns, resolves, or otherwise persists data

Policy:

- blocked in v1 by default
- may be allowed later only through approved bot-safe endpoints and structured approval records

Approval:

- always required

### `Destructive`

Definition:

- delete, restore, archive, undo, finalize, unfinalize, bulk-change, or other high-blast-radius action

Policy:

- blocked in v1
- strongly recommended to remain blocked for multiple phases

Approval:

- even if later allowed, requires stronger controls than ordinary writes

## Explicitly Prohibited Action Categories In V1

These categories should be treated as hard denials in the first release.

### 1. Admin and permission management

Blocked examples:

- create, update, disable, or delete users
- create, update, or delete roles
- create, update, or delete permissions
- update system settings
- modify data settings

Why blocked:

- high privilege escalation risk
- low tolerance for ambiguity
- too much blast radius

Relevant route examples in this repo:

- `app/api/admin/users/...`
- `app/api/admin/roles/...`
- `app/api/admin/permissions/route.ts`
- `app/api/system-settings/route.ts`

### 2. Finalization state changes

Blocked examples:

- finalize deposit
- unfinalize deposit
- finalize any other high-consequence workflow

Why blocked:

- changes financial workflow state materially
- difficult to reverse safely
- may impact dispute handling and audit expectations

Relevant route examples:

- `app/api/reconciliation/deposits/[depositId]/finalize/route.ts`
- `app/api/reconciliation/deposits/[depositId]/unfinalize/route.ts`

### 3. Undo and rollback actions

Blocked examples:

- undo audit-backed auto-fill
- undo reconciliation actions
- reverse prior system-applied operations

Why blocked:

- requires deep historical correctness
- conflict-prone
- can silently break assumptions if applied incorrectly

Relevant route examples:

- `app/api/audit-logs/[auditLogId]/undo/route.ts`
- `app/api/reconciliation/deposits/[depositId]/matches/[matchGroupId]/undo/route.ts`
- `app/api/reconciliation/deposits/[depositId]/bundle-rip-replace/[bundleAuditLogId]/undo/route.ts`

### 4. Delete, archive, restore, and permanent removal actions

Blocked examples:

- delete revenue schedules
- restore archived revenue schedules
- delete contacts
- delete tickets
- delete products

Why blocked:

- destructive
- easy to cause large-scale data loss or workflow breakage
- often role-sensitive beyond ordinary CRUD permissions

Relevant route examples:

- `app/api/revenue-schedules/[revenueScheduleId]/route.ts`
- `app/api/revenue-schedules/[revenueScheduleId]/restore/route.ts`
- `app/api/contacts/[id]/route.ts`
- `app/api/tickets/[ticketId]/route.ts`
- `app/api/products/[productId]/route.ts`

### 5. Bulk update actions

Blocked examples:

- bulk revenue schedule updates
- bulk rate changes
- bulk change start date
- bulk deactivate
- bulk undo match

Why blocked:

- maximum blast radius
- too difficult to verify safely through natural language
- strong chance of user misunderstanding

Relevant route examples:

- `app/api/revenue-schedules/bulk-update/route.ts`
- `app/api/revenue-schedules/bulk/update-rate/route.ts`
- `app/api/revenue-schedules/bulk/change-start-date/route.ts`
- `app/api/revenue-schedules/bulk/deactivate/route.ts`
- `app/api/revenue-schedules/bulk/undo-deposit-match/route.ts`

### 6. Direct financial mutation actions

Blocked examples:

- apply a match
- apply to future schedules
- create flex entry
- resolve flex entry
- settle revenue schedule

Why blocked in v1:

- these are legitimate future candidate workflows, but they are still write actions with financial impact
- they need approval records and payload binding first

Relevant route examples:

- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/within-tolerance/apply-to-future/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/rate-discrepancy/apply-to-future/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/create-flex/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/resolve-flex/route.ts`
- `app/api/revenue-schedules/[revenueScheduleId]/settlement/route.ts`

## Allowed In V1 Without Approval

Allowed only if explicitly exposed via bot-safe routes:

- revenue schedule lookup
- deposit detail retrieval
- candidate schedule retrieval
- reconciliation issue previews
- future-adjustment previews
- ticket draft generation

Important:

- These are allowed as bot actions, but still must be allowlisted individually.
- Allowed does not mean "all existing internal read endpoints are exposed."

## Actions That May Be Allowed Later With Approval

These are candidate phase-2 or later write actions, not v1 actions.

### 1. Create ticket from approved draft

Why it may be acceptable earlier than others:

- lower blast radius than financial mutations
- more operational than financial

Required controls:

- draft payload
- approval id
- payload hash binding
- audit metadata

### 2. Apply one deposit-line match

Why it is more dangerous:

- direct financial reconciliation state change

Required controls:

- preview first
- exact schedule id
- exact allocation amounts
- approval id
- post-apply audit event

### 3. Apply approved reconciliation adjustment

Why it is dangerous:

- can affect future schedules and expected values

Required controls:

- preview first
- explicit scope display
- approval id
- clear future-schedule impact summary

## Approval Policy For Future Writes

Any future write-capable action should follow this policy.

### Rule 1: Approval must be tied to structured payload

The user must approve:

- action id
- target entity ids
- exact payload
- summarized consequences

The user must not be asked to approve only a freeform sentence like:

- "Yes, go ahead"

### Rule 2: Approval must expire

Recommended approval TTL:

- 10 to 30 minutes

Why:

- reduces replay risk
- keeps approval tied to current user intent

### Rule 3: Approval must be single-purpose

One approval record should map to:

- one action id
- one payload hash
- one tenant
- one user
- one bot principal

### Rule 4: Preview must precede approval

The sequence should be:

1. bot generates preview
2. CRM stores preview payload
3. user approves
4. bot submits execution with approval id
5. CRM re-verifies payload hash and permissions
6. CRM executes

### Rule 5: Approval does not bypass permissions

Even with approval:

- the bot principal must still be allowed
- the human user must still have required permissions
- the tenant must still match

### Rule 6: Destructive actions need stronger review than ordinary writes

Even in future phases, destructive actions should require:

- separate product approval
- likely manager-only approval
- likely additional operational safeguards

## Recommended Enforcement Model

The bot gateway should enforce policy in three layers.

### Layer 1: Action allowlist

Each bot route should map to exactly one action id.

If an action id is not allowlisted:

- reject immediately

### Layer 2: Action class policy

Each action should declare:

- `read`
- `preview`
- `draft`
- `write`
- `destructive`

The policy engine should then apply default rules:

- allow `read` and `preview` only if explicitly enabled
- require approval for `draft -> persist`
- reject `write` in v1 unless explicitly enabled later
- reject `destructive` in v1 always

### Layer 3: Tenant and identity checks

Every request must validate:

- bot principal
- tenant
- human context if required
- approval id if required

## Recommended Default Deny Rule

The bot layer should be `default deny`.

Meaning:

- if an action is not explicitly approved in the bot catalog, it is blocked
- if a route is not part of `/api/bot/...`, it is not callable by OpenClaw
- if approval data is missing for a required action, it is blocked

## Example Approval Matrix

| Action Type | Example | V1 Policy | Approval Required | Notes |
| --- | --- | --- | --- | --- |
| Read | schedule lookup | Allowed if allowlisted | No | Must still use bot gateway |
| Preview | match issues preview | Allowed if allowlisted | No | Log preview event |
| Draft | ticket draft | Allowed if allowlisted | No for draft generation | Yes before actual create |
| Write | apply one match | Blocked in v1 | Yes in future | Needs preview + payload binding |
| Destructive | finalize deposit | Blocked in v1 | Even future approval not enough by itself | Needs product and security review |

## Minimum Implementation Requirements For This Policy

If the team wants this policy to be enforceable, not aspirational, implementation should include:

1. action ids for every bot route
2. action class metadata for every bot route
3. central bot auth helper that checks action allowlist
4. central approval checker for any future writes
5. bot audit metadata on every route
6. default-deny bot route registry

## Open Decisions For The Meeting

The meeting should explicitly resolve:

1. Are all write and destructive actions blocked in v1 with no exceptions?
2. Is ticket creation kept draft-only in v1?
3. Do we want any preview route to require human context always, even if it does not persist?
4. Which future write action would be the first candidate after approvals are built?

## Recommended Meeting Outcome

The cleanest decision outcome is:

- approve `read`, `preview`, and `draft-only` actions for v1
- block all writes in v1
- block all destructive actions in v1
- require structured approval records before any future bot writes
- keep finalize, unfinalize, undo, delete, restore, and bulk-update actions out of scope

That gives the implementation team a clear policy line and prevents accidental privilege creep during development.

## Local References

Local files reviewed while preparing this note:

- `app/api/reconciliation/deposits/[depositId]/finalize/route.ts`
- `app/api/reconciliation/deposits/[depositId]/unfinalize/route.ts`
- `app/api/audit-logs/[auditLogId]/undo/route.ts`
- `app/api/revenue-schedules/bulk-update/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/create-flex/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/within-tolerance/apply-to-future/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/rate-discrepancy/apply-to-future/route.ts`
- `app/api/tickets/[ticketId]/route.ts`
- `app/api/contacts/[id]/route.ts`
- `app/api/revenue-schedules/[revenueScheduleId]/route.ts`
- `app/api/revenue-schedules/[revenueScheduleId]/restore/route.ts`
- `app/api/admin/users/[userId]/route.ts`
- `app/api/admin/roles/[id]/route.ts`
- `app/api/admin/permissions/route.ts`
