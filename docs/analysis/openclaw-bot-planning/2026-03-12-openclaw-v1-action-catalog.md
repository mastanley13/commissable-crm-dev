# OpenClaw Bot V1 Action Catalog

Date: 2026-03-12
Status: Draft for implementation planning
Purpose: Define the first bot action set for the Commissable CRM so the implementation meeting can make concrete scope and architecture decisions.

## Goal

Define a narrow, safe, high-value action catalog for the first OpenClaw bot release.

This document is not the final product spec. It is the implementation decision document for:

- what the bot is allowed to do in v1
- what requires a wrapper or approval flow first
- what must remain blocked

## Recommended V1 Contract

Recommended v1 policy:

- Internal users only
- API-first integration
- Read-only plus preview/draft actions
- No direct destructive actions
- No raw access to the full internal API surface
- All bot actions logged with bot-specific audit metadata

## Action Classification Model

Use these classifications during implementation:

- `Read`: fetch or summarize CRM data only
- `Preview`: calculate or simulate an outcome without persisting changes
- `Draft`: prepare content or a structured payload for later review
- `Write`: persists a change
- `Destructive`: delete, undo, deactivate, finalize, bulk-change, or otherwise alter financial/admin state materially

Recommended approval policy:

- `Read`: no human approval required
- `Preview`: no approval required if no persistence occurs
- `Draft`: approval required only before conversion into a persisted change
- `Write`: explicit structured approval required
- `Destructive`: blocked from v1

## Repo Constraints That Affect The Catalog

These are implementation-relevant constraints from the current codebase:

- Current API auth is primarily session-cookie based via `session-token`, which is not suitable as the long-term auth contract for an external bot.
- Some routes use `withAuth()` rather than strict permission checks, so they should not be exposed directly to the bot without review.
- `withPermissions()` defaults to ANY-of semantics unless `requireAll: true` is passed, so permission reuse must be deliberate.
- The app already has strong preview/apply patterns in reconciliation, which makes reconciliation a good first domain.
- The app already writes audit logs in many mutation flows, which should be extended for bot traceability.

## Recommended V1 Action Set

These are the actions I recommend approving first.

| Action ID | Action Name | Class | User Value | Existing Capability | Bot Exposure Status | Required Permissions | Approval | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BOT-R1 | Lookup revenue schedules by query/filter | Read | High | Existing list/search route | Approve for v1 via bot wrapper | `revenue-schedules.read` equivalent or reviewed replacement | No | Good for account/order/date lookup and support questions |
| BOT-R2 | Retrieve deposit detail and line items | Read | High | Existing deposit detail route | Approve for v1 via bot wrapper | `reconciliation.view` | No | Good base action for reconciliation assistant |
| BOT-R3 | Retrieve candidate schedules for a deposit line | Read | High | Existing candidates route | Approve for v1 via bot wrapper | `reconciliation.view` | No | Strong explainability tool for reconciliation |
| BOT-P1 | Preview reconciliation issues for proposed line-to-schedule match | Preview | High | Existing match-issues preview route | Approve for v1 via bot wrapper | `reconciliation.manage` | No | Should return structured warnings, not apply changes |
| BOT-P2 | Preview future-schedule adjustment suggestion | Preview | Medium | Existing AI adjustment preview route | Approve for v1 via bot wrapper | `reconciliation.view` | No | Useful when bot is explaining expected downstream impact |
| BOT-D1 | Draft ticket from exception context | Draft | High | Existing ticket creation path can be adapted | Approve for v1 as draft-only first | reviewed ticket create permission set | Review before save | Bot should prepare structured draft, not create immediately |

## Detailed V1 Action Definitions

### BOT-R1: Lookup revenue schedules by query/filter

Intent:

- Let a user ask for schedules by account, customer id, order id, product, status, or date range.

Why it belongs in v1:

- High-value lookup workflow
- Low risk when kept read-only
- Useful across support, reconciliation, and QA

Current implementation notes:

- The repo has `app/api/revenue-schedules/route.ts`.
- That route currently uses `withAuth()` rather than a tighter bot-safe permission contract.
- It should be wrapped or replaced for bot access rather than exposed directly.

Recommended bot input contract:

- query string
- optional status
- optional billing status
- optional date range
- optional page size with strict max

Recommended output:

- compact schedule list
- top matched fields
- links or ids for follow-up actions

### BOT-R2: Retrieve deposit detail and line items

Intent:

- Let the bot summarize a deposit, its line items, statuses, usage, commission, and unresolved work.

Why it belongs in v1:

- Core entry point for a reconciliation assistant
- Safe read path
- Supports many follow-up actions

Current implementation notes:

- Existing route: `app/api/reconciliation/deposits/[depositId]/detail/route.ts`
- Permission: `reconciliation.view`

Recommended bot input contract:

- deposit id

Recommended output:

- deposit summary
- line item list
- unresolved counts
- candidate next steps

### BOT-R3: Retrieve candidate schedules for a deposit line

Intent:

- Let the bot answer, "What schedules are likely candidates for this deposit line?"

Why it belongs in v1:

- High explainability value
- Strong foundation for later preview/apply workflows
- Helps users trust the bot

Current implementation notes:

- Existing route: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route.ts`
- Permission: `reconciliation.view`

Recommended bot input contract:

- deposit id
- line id
- optional include future schedules flag

Recommended output:

- ranked candidates
- confidence
- reasons
- whether candidate is safe to preview next

### BOT-P1: Preview reconciliation issues for a proposed match

Intent:

- Let the bot preview what issues would exist if a specific deposit line were matched to a chosen revenue schedule.

Why it belongs in v1:

- High-value assistant behavior
- Uses existing preview semantics
- Gives meaningful help without committing changes

Current implementation notes:

- Existing route: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/match-issues-preview/route.ts`
- Permission: `reconciliation.manage`
- This route already includes cross-deal guard logic and variance analysis

Recommended bot input contract:

- deposit id
- line id
- revenue schedule id
- optional usage amount
- optional commission amount

Recommended output:

- structured issue summary
- cross-deal guard result
- usage variance result
- rate discrepancy result
- future schedule implications
- safe next actions

### BOT-P2: Preview future-schedule adjustment suggestion

Intent:

- Let the bot explain whether a selected situation should allocate to prior open schedules or suggest future adjustment behavior.

Why it belongs in v1:

- Useful advisor action
- Still non-persistent
- Helps bridge into later write workflows

Current implementation notes:

- Existing route: `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/ai-adjustment/preview/route.ts`
- Permission: `reconciliation.view`

Recommended bot input contract:

- deposit id
- line id
- revenue schedule id

Recommended output:

- suggestion type
- reason
- affected scope
- future schedule count

### BOT-D1: Draft ticket from exception context

Intent:

- Let the bot prepare a ticket draft when it finds a low-rate issue, unresolved discrepancy, or follow-up item.

Why it belongs in v1:

- Delivers high operational value
- Keeps the bot useful without giving it full autonomous write power
- Pairs well with reconciliation exception workflows

Current implementation notes:

- Existing route: `app/api/tickets/route.ts`
- Current create path uses `withAuth()` and directly persists the ticket
- For bot use, this should become a draft-first wrapper, not direct POST exposure

Recommended bot input contract:

- issue type
- linked schedule id or opportunity id when available
- summary
- supporting facts
- suggested priority

Recommended output:

- structured ticket draft payload
- human-readable summary
- missing required fields
- explicit "ready to create" or "needs review" status

## Actions To Defer Until After V1 Foundations Exist

These may be valuable, but they should not be in the first release unless the meeting explicitly chooses a more aggressive scope.

| Action ID | Action Name | Why Defer |
| --- | --- | --- |
| BOT-W1 | Apply a deposit-line match | This is a write action against financial reconciliation state and should wait for bot auth, approval UX, and bot audit metadata |
| BOT-W2 | Apply AI adjustment / apply to future schedules | Broad downstream impact and requires stronger approval semantics |
| BOT-W3 | Auto-run matching on a deposit | Useful, but should wait until bot approvals and execution controls are in place |
| BOT-W4 | Resolve flex / create flex directly | Financial workflow mutation with potentially non-obvious downstream effects |
| BOT-W5 | Create a ticket directly from the bot | Draft-first is safer than direct creation in v1 |

## Actions To Explicitly Block In V1

These should be out of scope for the first release.

| Action Category | Examples | Why Block |
| --- | --- | --- |
| Admin actions | users, roles, permissions, system settings | Too much blast radius |
| Destructive actions | delete, restore, archive, undo, unfinalize | High-risk and operationally sensitive |
| Bulk financial changes | bulk rate updates, bulk schedule changes, bulk deactivation | Too easy to cause large-scale damage |
| Finalization actions | finalize deposit, unfinalize deposit | Business-critical irreversible or semi-irreversible workflow edges |
| Schema/data-setting changes | templates, data settings, product family settings | Not appropriate for autonomous or semi-autonomous v1 bot access |

## Recommended Bot-Facing API Shape

Do not connect OpenClaw directly to the existing internal routes.

Recommended shape:

- `/api/bot/revenue-schedules/search`
- `/api/bot/reconciliation/deposits/:depositId/detail`
- `/api/bot/reconciliation/deposits/:depositId/lines/:lineId/candidates`
- `/api/bot/reconciliation/deposits/:depositId/lines/:lineId/match-issues-preview`
- `/api/bot/tickets/draft`

Why:

- Lets us enforce bot-specific auth
- Lets us reshape outputs for the agent
- Lets us hide routes that are too broad or too raw
- Lets us attach bot-specific audit and rate limiting

## Permission Model Recommendation For V1

Do not map the bot to a broad human role.

Instead:

- create a dedicated bot identity
- create a bot action allowlist
- evaluate each action against explicit permissions
- prefer read and preview permissions only in v1

Recommended minimum permission posture for the first release:

- `reconciliation.view`
- a reviewed read-safe revenue schedule lookup capability
- a reviewed ticket-draft capability

Avoid granting:

- `reconciliation.manage` broadly to the bot identity unless preview routes require it and cannot be safely split
- any admin permissions
- any bulk update permissions

## Audit Requirements Per Action

Every bot action should record:

- bot identity
- human user identity, if user-initiated
- tenant id
- conversation id or session id
- action id
- request payload hash or structured payload
- result status
- any approval id, if applicable

For preview and draft actions, still log the event even when no persistence occurs.

## Open Decisions For The Implementation Meeting

The meeting should resolve these:

1. Are we approving only the 6 recommended actions above for v1?
2. Does `BOT-D1` remain draft-only, or do we also want approved create in phase 1?
3. Do we want `BOT-P1` and `BOT-P2` in the first milestone, or only read actions first?
4. Do we want a dedicated `revenue-schedules.read` style permission for the bot layer instead of reusing broad existing route access?
5. Will the bot API live inside the Next app or as a wrapper service?

## Recommended Outcome For The Meeting

If the goal is fastest safe progress, leave the meeting with:

- approved v1 action list: `BOT-R1`, `BOT-R2`, `BOT-R3`, `BOT-P1`, `BOT-P2`, `BOT-D1`
- explicit blocked list for v1
- decision to build a bot-safe API wrapper
- decision to keep ticket creation draft-only initially

## Local References

Local files reviewed while creating this catalog:

- `app/api/revenue-schedules/route.ts`
- `app/api/reconciliation/deposits/[depositId]/detail/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/match-issues-preview/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/ai-adjustment/preview/route.ts`
- `app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route.ts`
- `app/api/reconciliation/deposits/[depositId]/auto-match/preview/route.ts`
- `app/api/tickets/route.ts`
- `app/api/search/route.ts`
- `lib/api-auth.ts`
- `lib/auth.ts`
