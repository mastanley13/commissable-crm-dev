# OpenClaw Bot Auth And API Architecture

Date: 2026-03-12
Status: Draft for implementation planning
Purpose: Define the recommended authentication model and API architecture for integrating an OpenClaw bot layer into the Commissable CRM.

## Goal

Provide an implementation-ready architecture for how OpenClaw should connect to this CRM safely.

This document answers:

- how the bot should authenticate
- how bot requests should reach CRM business logic
- how human user context should be represented
- how auditability and approval should work
- what we should not expose directly

## Executive Recommendation

Recommended architecture for v1:

1. OpenClaw runs as a separate agent runtime.
2. OpenClaw never uses a human `session-token` cookie.
3. CRM exposes a dedicated bot-facing API layer under `/api/bot/...`.
4. Bot requests use a dedicated bot identity.
5. User-initiated bot sessions carry a separate short-lived human context token.
6. Bot authorization is the intersection of:
   - bot allowlisted actions
   - tenant scope
   - human user context, when present
7. Preview and draft actions ship first.
8. Write actions require an explicit approval record bound to a structured action payload.

This is the safest path that still keeps the build small enough for a first release.

## Why The Current Auth Model Is Not Enough

The current application primarily authenticates API routes by reading the `session-token` cookie and loading a `UserSession`.

Relevant local behavior:

- `lib/auth.ts` loads user identity from `UserSession`
- `lib/api-auth.ts` powers `withAuth()` and `withPermissions()`
- many existing routes are intended for browser users, not external service callers

This creates three problems for a bot integration:

### 1. Shared browser sessions are the wrong trust boundary

If OpenClaw reuses a human browser session:

- session theft risk is higher
- user intent and bot intent are blurred
- revocation and rotation are awkward
- the integration becomes fragile and hard to reason about

### 2. Some current routes are too broad for direct bot exposure

Many routes use:

- `withAuth()` only, or
- broad ANY-of permission checks through `withPermissions()`

That is acceptable for many human UI paths, but not a clean external contract for an agent.

### 3. We need two kinds of identity, not one

The system needs to know:

- which bot runtime is calling
- which human user initiated the request, if any

Those are separate concerns and should be represented separately.

## Recommended Auth Model: Dual-Context Auth

Use two layers of identity for bot-originated requests.

### Layer 1: Bot principal

This identifies the OpenClaw runtime or specific CRM bot integration.

It answers:

- which agent integration is calling
- which tenant it belongs to
- which action ids it may invoke
- whether it is active

### Layer 2: Human context

This is optional for some future external channels, but recommended for v1 if the bot is internal-user initiated.

It answers:

- which user asked the bot to do something
- which permissions that user has
- which tenant context applies
- whether a later approval is tied to that user

### Why both are needed

Without bot identity:

- the CRM cannot distinguish one integration from another

Without human context:

- the bot can become an overpowered service actor
- approval and accountability become weaker

## Recommended Request Flow

### In-app flow for v1

Recommended v1 channel: embedded CRM chat or internal assistant panel.

Flow:

1. User opens bot session in CRM.
2. CRM authenticates the user normally via browser session.
3. CRM creates a short-lived human-context token for bot use.
4. OpenClaw receives:
   - bot principal credential
   - short-lived human-context token
5. OpenClaw invokes `/api/bot/...` routes.
6. CRM validates:
   - bot principal
   - tenant
   - action allowlist
   - human context token
7. CRM executes only the allowed read/preview/draft action.
8. CRM logs the call with bot and human metadata.

### Write flow later

For write actions:

1. Bot generates structured preview payload.
2. User approves the preview.
3. CRM issues an approval record with an approval id.
4. Bot executes using that approval id.
5. CRM verifies the approval id matches:
   - tenant
   - user
   - bot principal
   - action id
   - payload hash
6. CRM applies the action.
7. CRM logs the applied mutation as bot-originated plus user-approved.

## Recommended API Shape

Do not connect OpenClaw directly to the existing internal routes.

Recommended bot gateway namespace:

- `/api/bot/revenue-schedules/search`
- `/api/bot/reconciliation/deposits/:depositId/detail`
- `/api/bot/reconciliation/deposits/:depositId/lines/:lineId/candidates`
- `/api/bot/reconciliation/deposits/:depositId/lines/:lineId/match-issues-preview`
- `/api/bot/reconciliation/deposits/:depositId/lines/:lineId/ai-adjustment-preview`
- `/api/bot/tickets/draft`

Reasons:

- clear contract boundary
- safer response shaping for LLM consumption
- easier rate limiting
- easier action allowlisting
- easier audit instrumentation
- avoids exposing routes that are `withAuth()` only

## Recommended Placement

Recommended v1:

- keep the bot gateway inside the existing Next.js app

Why:

- fastest implementation
- direct access to current Prisma/business logic
- fewer moving pieces for the first milestone

Possible phase 2:

- extract to a dedicated integration service if volume, scaling, or security policy later requires it

## Auth Option Comparison

### Option A: Reuse browser session cookie

Pros:

- lowest short-term effort

Cons:

- poor separation of concerns
- unsafe for external runtime use
- hard to rotate and revoke safely
- not recommended

Verdict:

- reject

### Option B: Static API key only

Pros:

- simple first implementation
- easy for service-to-service calls

Cons:

- weak user-context story
- weak approval story
- coarse-grained access control unless heavily wrapped

Verdict:

- acceptable only as a temporary internal prototype

### Option C: Bot principal plus short-lived human-context token

Pros:

- best fit for internal-user initiated v1
- cleanly separates service identity from user identity
- strong auditability
- better revocation and least privilege

Cons:

- requires new auth plumbing

Verdict:

- recommended

### Option D: Full OAuth/OIDC service integration

Pros:

- strongest standards alignment
- strong future external-channel story

Cons:

- more implementation overhead than v1 likely needs

Verdict:

- good future direction, not required for first milestone

## Recommended Credential Design

### Bot principal credential

Recommended format:

- Bearer token or API key for the OpenClaw integration itself

Recommended storage:

- hashed in the database, not stored in plaintext after issuance

Recommended fields for a new model such as `BotPrincipal` or `IntegrationClient`:

- `id`
- `tenantId`
- `name`
- `status`
- `keyPrefix`
- `keyHash`
- `allowedActions` JSON or related table
- `createdById`
- `lastUsedAt`
- `lastUsedIp`
- `expiresAt`
- `rotatedAt`
- `createdAt`
- `updatedAt`

### Human-context token

Recommended format:

- short-lived signed token minted by CRM

Recommended contents:

- `userId`
- `tenantId`
- `botPrincipalId`
- `allowedActionIds`
- `issuedAt`
- `expiresAt`
- `sessionId` or session reference

Recommended TTL:

- 5 to 15 minutes

Reason:

- enough for an active interaction
- short enough to reduce replay risk

## Authorization Rules

For every bot call, authorization should check all of the following:

1. `Bot principal is valid`
2. `Bot principal is active`
3. `Bot principal is allowed to call this action id`
4. `Tenant is valid and consistent`
5. `Human-context token is valid`, if required by the action
6. `Human user has the required permission`, if human-scoped
7. `Approval record exists`, if action class requires approval

Recommended rule:

- effective permission = bot allowlist AND tenant scope AND human permission, when human context exists

This avoids turning the bot into a privileged bypass.

## Recommended Helper Layer

Add a dedicated auth helper stack for bot routes rather than extending the browser helpers directly.

Recommended new helpers:

- `authenticateBotPrincipal(request)`
- `authenticateBotUserContext(request)`
- `withBotAuth(request, actionId, handler)`
- `requireBotApproval(request, actionId, payloadHash)`
- `logBotAuditEvent(...)`

What `withBotAuth()` should do:

- validate bot credential
- validate tenant
- validate action allowlist
- resolve optional human context
- attach normalized bot context to request

Example bot request context:

```ts
type BotRequestContext = {
  tenantId: string
  botPrincipalId: string
  botName: string
  actionId: string
  humanUserId?: string
  humanSessionId?: string
  openclawConversationId?: string
  openclawChannelId?: string
}
```

## Recommended Route Design Rules

Every bot route should:

- map to exactly one action id
- take narrow typed inputs
- return shaped output optimized for agent use
- avoid leaking unnecessary fields
- avoid passing raw DB objects through
- avoid chaining to broad internal routes without validation

Recommended pattern:

- bot route validates request
- bot route calls shared business logic directly, or a thin internal service
- bot route returns structured output plus next-action hints

Avoid:

- bot route proxying arbitrary internal URLs
- generic "run action" endpoints
- exposing `withAuth()` routes directly

## Audit And Traceability Design

The app already has an `AuditLog` model and `lib/audit.ts`, which is a major advantage.

Current `AuditLog` already supports:

- `tenantId`
- `userId`
- `action`
- `entityName`
- `entityId`
- `requestId`
- `metadata`
- `ipAddress`
- `userAgent`

That means we can add bot traceability without redesigning the entire audit system.

### Recommended bot audit metadata

Store in `AuditLog.metadata`:

- `actorType: "bot"`
- `botPrincipalId`
- `botName`
- `botActionId`
- `humanUserId`
- `humanSessionId`
- `approvalId`
- `openclawConversationId`
- `openclawChannelId`
- `payloadHash`
- `dryRun: true/false`

### Important rule

Do not rely only on OpenClaw logs.

The CRM must remain the source of truth for:

- what was requested
- who initiated it
- whether it was preview or write
- what was actually applied

## Approval Architecture

Write actions should not rely on natural-language approval alone.

Recommended model:

1. Bot produces structured action payload.
2. CRM stores preview payload and generates `approvalId`.
3. User approves inside CRM.
4. Bot submits:
   - `approvalId`
   - exact payload hash
5. CRM verifies match and TTL.
6. CRM executes write.

Recommended approval record fields:

- `id`
- `tenantId`
- `botPrincipalId`
- `userId`
- `actionId`
- `payload`
- `payloadHash`
- `status`
- `expiresAt`
- `approvedAt`
- `executedAt`

## Tenant Isolation Rules

These rules should be non-negotiable:

- every bot principal is tenant-scoped
- every human-context token is tenant-scoped
- every bot route resolves tenant from auth context, not request body alone
- no cross-tenant fallback logic
- no shared global bot principal across tenants in production

## What Not To Expose In The Bot Layer

Do not expose these directly to OpenClaw in v1:

- any admin route
- any role or permission management route
- any delete / restore / archive route
- bulk update routes
- finalize / unfinalize routes
- undo routes
- raw generic search endpoints with mixed entity semantics unless filtered and reshaped first

## Implementation Sequence

### Phase 1: Auth foundation

- define `BotPrincipal` or `IntegrationClient` model
- add bot credential issuance and rotation process
- add `withBotAuth()` helper
- add short-lived human-context token minting

### Phase 2: Bot gateway

- add `/api/bot/...` route namespace
- implement first read and preview routes
- add bot audit metadata logging

### Phase 3: OpenClaw skills

- connect a small OpenClaw skill pack to those routes
- test read and preview actions only

### Phase 4: Approval system

- add approval records
- bind write actions to approval ids and payload hashes

### Phase 5: Limited write actions

- only after read/preview flows are stable
- only for explicitly approved actions

## Minimum Technical Deliverables For The First Implementation Slice

If the team wants a small but real first milestone, build this:

1. `BotPrincipal` storage and credential validation
2. `withBotAuth()` helper
3. short-lived human-context token minting
4. `/api/bot/reconciliation/deposits/:depositId/detail`
5. `/api/bot/reconciliation/deposits/:depositId/lines/:lineId/candidates`
6. `/api/bot/tickets/draft`
7. bot audit metadata logging

That is enough to prove the architecture without touching high-risk mutations.

## Open Decisions For The Implementation Meeting

The meeting should answer:

1. Do we want to store bot principals in the database now, or use an env-based prototype first?
2. Is the first channel embedded in CRM, or external console first?
3. Do we want short-lived signed human-context tokens in phase 1, or only bot principal auth for a narrower prototype?
4. Should approval records be built before any write-capable routes are considered?
5. Do we want the bot gateway inside the Next app for v1?

## My Recommendation For The Meeting

If the objective is to start implementation quickly without painting ourselves into a corner:

- choose `bot principal + short-lived human context token`
- keep the bot gateway inside the Next app
- ship only read, preview, and draft routes first
- add bot-specific audit metadata immediately
- delay any direct write execution until approval records exist

That gives a strong architectural base without requiring a full platform rebuild.

## Local References

Local files reviewed while preparing this note:

- `lib/api-auth.ts`
- `lib/auth.ts`
- `lib/audit.ts`
- `prisma/schema.prisma`
- `app/api/revenue-schedules/route.ts`
- `app/api/reconciliation/deposits/[depositId]/detail/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/match-issues-preview/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/ai-adjustment/preview/route.ts`
- `app/api/tickets/route.ts`
