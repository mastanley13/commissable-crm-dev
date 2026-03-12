# OpenClaw Bot Layer Brainstorm

Date: 2026-03-12
Status: Working brainstorm note
Purpose: Ongoing planning document for adding an OpenClaw-powered AI bot layer to the Commissable CRM.

## Goal

Add an AI bot layer to the CRM so a connected OpenClaw agent can safely answer questions, retrieve CRM context, and eventually perform approved CRM actions with clear permissions, auditability, and human control.

This note is intentionally practical. It focuses on process, architecture choices, preparation work, risks, and a recommended path to a controlled v1.

## Current Understanding

- OpenClaw is a self-hosted agent platform with agents, channels, memory, tools, skills, and sandboxed permissions.
- OpenClaw supports external models, custom skills, and browser automation.
- The CRM is a Next.js 14 + Prisma application with a large internal API surface and an existing RBAC model.
- The CRM already uses audit logs in many mutation paths, which is a major advantage for bot work.
- The CRM also already has a pattern of preview/apply flows in reconciliation, which is a strong foundation for safe bot actions.

## Repo-Specific Observations

These are important because they change the best integration approach.

### 1. Current API auth is browser-session oriented

`lib/api-auth.ts` and `lib/auth.ts` show that most protected API routes authenticate via the `session-token` cookie and then load a user session.

Implication:

- This is fine for human browser use.
- It is not a good long-term contract for an external OpenClaw runtime.
- We should not make the bot pretend to be a browser user by sharing a human session cookie.

Recommendation:

- Add a dedicated bot/service auth path for agent-originated requests.

### 2. Current permission helper defaults to ANY-of

`withPermissions()` defaults `requireAll` to `false`.

Implication:

- A bot can accidentally receive broader access than intended if we simply reuse mixed permission sets without reviewing them.
- Bot endpoints should use explicit, narrow permission checks, not inherited broad route groupings.

Recommendation:

- Create a bot-facing action layer with explicit permission mapping per action.

### 3. Audit logging already exists in many mutation flows

This is a strength.

Implication:

- We already have a partial foundation for bot accountability.
- We should extend this so agent actions are clearly labeled as bot-originated, with bot id, conversation id, and approval context.

### 4. Reconciliation already has preview/apply patterns

This matters more than it looks.

Implication:

- The bot should use preview-first action design wherever possible.
- Reconciliation is a strong candidate domain for assisted workflows because users can inspect a proposed outcome before commit.

## Recommended Architecture

### Recommendation: API-first bot, not browser-first bot

Best v1 shape:

1. OpenClaw runs as a separate agent runtime.
2. OpenClaw uses a small set of custom CRM skills.
3. Those skills call a dedicated bot-safe CRM API layer.
4. The bot is initially limited to read-only and draft/preview actions.
5. Write actions require explicit approval and route through preview/apply endpoints with audit logging.

Why this is the best approach:

- More reliable than browser automation.
- Easier to permission and monitor.
- Easier to test.
- Easier to keep tenant-safe.
- Easier to make deterministic where needed.

### Why not browser-first

Browser automation is useful for demos and fallback workflows, but it should not be the primary CRM integration pattern.

Problems with browser-first:

- Fragile to UI changes.
- Harder to scope precisely.
- Harder to validate inputs before action.
- Harder to audit intent versus result.
- More exposed to prompt injection through rendered page content.

Best use of browser automation:

- Limited fallback for internal QA or unsupported read-only tasks.
- Never as the primary write path for production CRM mutations.

## Architecture Options

### Option A: Browser-only agent

Pros:

- Fastest demo.
- No new API layer required at first.

Cons:

- Highest fragility.
- Weakest permission model.
- Hardest to test and maintain.

Verdict:

- Acceptable only for prototype experiments, not recommended for production v1.

### Option B: API-first OpenClaw skill pack

Pros:

- Cleanest permissions story.
- Best reliability.
- Best auditability.
- Best long-term maintainability.

Cons:

- Requires upfront CRM prep work.
- Requires designing bot-safe endpoints or wrappers.

Verdict:

- Recommended.

### Option C: Hybrid API-first with browser fallback

Pros:

- Gives flexibility for gaps in the API.
- Lets us phase in support.

Cons:

- More operational complexity.
- Higher security surface area.

Verdict:

- Good phase 2 design, but do not start here.

## Recommended Delivery Process

### Phase 0: Decide the v1 bot contract

Before setup, define:

- Who the bot serves: internal team only, client-facing users, or both.
- Where the bot lives: embedded in CRM, Slack, Teams, web chat, or internal console.
- Whether the first version is read-only, draft-assist, or write-capable.
- Which business domain goes first: reconciliation, tickets, revenue schedules, or general CRM lookup.

My recommendation:

- Internal-only first.
- Read-only plus draft/preview actions first.
- Reconciliation and ticketing are the best initial domains.

### Phase 1: Define the bot action catalog

Create a strict inventory with these columns:

- Action name
- Domain
- Read / draft / write / destructive classification
- Required CRM permissions
- Required inputs
- Validation rules
- Preview available? yes/no
- Requires human approval? yes/no
- Audit requirements
- Allowed in v1? yes/no

Examples of strong v1 actions:

- Find revenue schedule by account / order / date.
- Summarize why a deposit line did not auto-match.
- Show reconciliation candidate schedules for a line.
- Draft a ticket from a detected exception.
- Prepare a preview of an allowed reconciliation adjustment.

Examples to keep out of v1:

- User / role / permission changes.
- Deletes or permanent archival actions.
- Bulk financial edits without preview.
- Cross-tenant or cross-account merge actions.
- Schema or settings changes.

### Phase 2: Create a bot-safe CRM integration layer

Do not expose the entire current API surface directly to the bot.

Instead create one of these:

- `/api/bot/...` routes inside the app, or
- a separate internal service that wraps CRM logic.

This layer should:

- Authenticate the bot with a dedicated service identity.
- Resolve tenant explicitly.
- Enforce bot action allowlists.
- Validate all arguments strictly.
- Convert ambiguous natural-language intent into narrow, typed commands.
- Log every request and result.
- Support dry-run / preview where possible.

### Phase 3: Build custom OpenClaw skills

Use OpenClaw skills as the agent-facing capability layer.

The skill set should be small at first:

- `crm_lookup`
- `reconciliation_preview`
- `ticket_draft`
- `crm_help` or `policy_lookup`

Keep each skill narrow. Do not make one giant `crm_do_anything` skill.

### Phase 4: Add human approval gates

For any write action:

- The bot should summarize intended changes.
- The user should explicitly approve.
- The system should preserve preview payload and approval record.
- The bot should execute only the approved action payload, not re-interpret the natural-language instruction from scratch.

This is critical. Approval should be against structured intent, not against a fresh model-generated guess.

### Phase 5: Pilot with one constrained workflow

Recommended pilot:

- Reconciliation assistant that can explain matches, fetch candidates, preview approved adjustments, and draft tickets.

Why this is a strong pilot:

- High client value.
- Existing preview/apply patterns already exist.
- Human review is natural in this workflow.
- The work is measurable.

### Phase 6: Expand only after instrumentation is in place

Do not broaden capabilities until you have:

- action success metrics
- error rates
- approval conversion rates
- audit review process
- prompt injection incident handling
- rollback / undo strategy

## What We Should Prepare Before Setup

### Product / workflow prep

- Define the top 5 bot use cases.
- Define the exact users for v1.
- Define what the bot must never do.
- Decide whether bot responses should be advisory only, or allowed to commit changes after approval.

### Security prep

- Dedicated bot identity, not a shared human login.
- Separate permission group for the bot.
- Domain/network allowlist for any outbound OpenClaw tools.
- No shell access unless there is a hard requirement.
- No browser tool by default.
- Secret storage plan for OpenClaw and CRM credentials.

### CRM platform prep

- Bot auth design: API key, signed token, service account, or mutual auth.
- Bot-safe endpoint list.
- Idempotency rules for write actions.
- Standard preview/apply contract for bot mutations.
- Standard bot audit log fields.

### Data / prompt prep

- Canonical business glossary.
- Entity naming rules and synonyms.
- Known bad phrases or dangerous commands.
- Few-shot examples for high-value workflows.
- A clear fallback response when confidence is low.

### QA prep

- Staging tenant for bot testing.
- Seed data for safe scenarios and edge cases.
- Golden test scripts.
- Failure test cases.
- Approval-flow test cases.

## Key Issues and Risks

### 1. Prompt injection

Risk:

- User or page content attempts to override policy and cause unsafe actions.

Mitigation:

- Keep tools narrow.
- Avoid browser-first write flows.
- Use explicit allowlisted actions.
- Require approvals for writes.

### 2. Over-broad permissions

Risk:

- Bot gets access through existing route permission groupings that were designed for humans.

Mitigation:

- Bot-specific auth and bot-specific action layer.
- Do not expose raw internal APIs directly.

### 3. Tenant leakage

Risk:

- The bot retrieves or acts on the wrong tenant's data.

Mitigation:

- Tenant must be explicit in auth context and request resolution.
- No fallback behavior that crosses tenant boundaries.

### 4. Unsafe memory

Risk:

- Persistent agent memory stores sensitive CRM data too broadly or reuses it across users or tenants.

Mitigation:

- Treat long-term memory as opt-in and heavily scoped.
- Prefer stateless skills for sensitive operations.
- Store references and summaries where possible, not raw sensitive payloads.

### 5. Weak approval semantics

Risk:

- User approves vague text, but the bot executes a different underlying action.

Mitigation:

- Approval should bind to a structured action payload and preview id.

### 6. Browser fragility

Risk:

- UI changes silently break workflows.

Mitigation:

- Prefer APIs for business actions.
- Keep browser automation as a last resort.

### 7. Model unpredictability

Risk:

- Bot chooses wrong action or fills parameters incorrectly.

Mitigation:

- Typed tools.
- Validation.
- Preview-first.
- Narrow v1 scope.
- Strong refusal behavior when data is missing or ambiguous.

## Strong v1 Design Principles

- Read-first, write-later.
- Preview before apply.
- One narrow skill per capability.
- Dedicated bot identity.
- Bot-safe APIs, not raw internal APIs.
- Least privilege by default.
- Every bot action is auditable.
- Human approval for anything that mutates financial, customer, or admin data.
- Keep the first release internal.

## Proposed v1 Scope

### Recommended v1 capabilities

- Answer CRM questions using approved read APIs.
- Retrieve account, opportunity, ticket, and revenue schedule context.
- Explain reconciliation candidate reasoning.
- Draft tickets or exception notes.
- Generate preview payloads for selected reconciliation actions.

### Explicitly exclude from v1

- Permission administration.
- User administration.
- Deletes and permanent destructive actions.
- Direct database operations.
- Bulk updates without approval.
- High-risk financial commits without preview and approval.

## Suggested Implementation Sequence

1. Finalize the v1 action catalog.
2. Define prohibited actions and security policy.
3. Define bot identity and auth approach.
4. Build bot-safe read endpoints.
5. Build one preview-capable write workflow.
6. Add bot-specific audit fields and logs.
7. Create initial OpenClaw skills.
8. Test in staging with seeded scenarios.
9. Pilot with internal users only.
10. Review logs, tighten controls, then expand.

## Decisions We Still Need

- What is the first channel: in-app chat, Slack, Teams, or another interface?
- Do we want the bot embedded inside the CRM UI first, or external first?
- Should the bot have persistent memory in v1?
- Which first write-capable workflow is worth the risk?
- Do we want a single general bot, or separate bots by domain?
- Should the bot be able to draft internal notes and tickets automatically?
- What is the escalation path when the bot is uncertain?

## My Current Recommendation

If we want the best balance of speed, safety, and client value:

- Build an internal-only OpenClaw bot first.
- Make it API-first, not browser-first.
- Start with read-only and draft/preview workflows.
- Focus the first domain on reconciliation support and ticket drafting.
- Add write execution only after structured approval, audit metadata, and bot-safe endpoints exist.

This path avoids the worst failure modes while still delivering a visible, useful AI layer quickly.

## Working Checklist

- [ ] Define the first 5 bot use cases.
- [ ] Define the prohibited action list.
- [ ] Choose the first user-facing channel.
- [ ] Choose bot auth strategy.
- [ ] Design bot-safe endpoint namespace.
- [ ] Define bot audit log schema additions.
- [ ] Define approval UX for write actions.
- [ ] Decide whether long-term memory is enabled in v1.
- [ ] Choose the first 2-4 OpenClaw skills.
- [ ] Prepare staging test scenarios.

## Notes for Future Brainstorm Sessions

- Keep this file as the running working note.
- Append confirmed decisions rather than rewriting history.
- When product decisions arrive from transcript review, map them into:
  - use case
  - action
  - permission
  - preview requirement
  - approval requirement
  - audit requirement

## Sources

External references used for this note:

- OpenClaw docs overview: https://openclawdoc.com/docs/intro/
- OpenClaw agents overview: https://www.openclawdoc.com/docs/agents/overview/
- OpenClaw built-in tools: https://openclawdoc.com/docs/agents/tools/
- OpenClaw browser automation: https://openclawdoc.com/docs/agents/browser-automation/
- OpenClaw skills overview: https://openclawdoc.com/docs/skills/overview/
- OpenClaw security overview: https://openclawdoc.com/docs/security/overview/
- OpenClaw configuration guide: https://www.openclawdoc.com/en/docs/configuration/

Local repo references that informed the CRM-specific recommendations:

- `lib/api-auth.ts`
- `lib/auth.ts`
- `app/api/admin/permissions/route.ts`
- `docs/reconciliation-ai-matching-current.md`
