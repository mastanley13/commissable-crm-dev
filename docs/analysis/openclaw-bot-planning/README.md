# OpenClaw Bot Planning Packet

Date: 2026-03-12
Purpose: Central working folder for planning the OpenClaw bot layer for the Commissable CRM.

## Documents In This Folder

### Core planning docs

- `2026-03-12-openclaw-bot-layer-brainstorm.md`
  - Working brainstorm and overall strategy note
- `2026-03-12-openclaw-v1-action-catalog.md`
  - Proposed first bot action set
- `2026-03-12-openclaw-bot-auth-api-architecture.md`
  - Recommended auth model and bot gateway API architecture
- `2026-03-12-openclaw-prohibited-actions-and-approval-policy.md`
  - Hard boundaries for blocked actions and future approval rules

### Supporting docs

- `2026-03-12-openclaw-meeting-decision-log-template.md`
  - Structured template for your implementation meeting
- `2026-03-12-openclaw-first-implementation-slice-plan.md`
  - Recommended first build slice after architectural decisions are made

## Recommended Reading Order

1. `2026-03-12-openclaw-bot-layer-brainstorm.md`
2. `2026-03-12-openclaw-v1-action-catalog.md`
3. `2026-03-12-openclaw-bot-auth-api-architecture.md`
4. `2026-03-12-openclaw-prohibited-actions-and-approval-policy.md`
5. `2026-03-12-openclaw-meeting-decision-log-template.md`
6. `2026-03-12-openclaw-first-implementation-slice-plan.md`

## Recommended Meeting Flow

1. Confirm v1 goal and out-of-scope boundaries.
2. Approve the v1 action catalog.
3. Approve the bot auth and API architecture.
4. Approve the prohibited-actions and approval policy.
5. Capture open decisions in the meeting decision log.
6. Leave with an agreed first implementation slice and owners.

## Current Recommended V1 Position

- Internal users only
- API-first OpenClaw integration
- Bot gateway inside the existing Next.js app
- Read, preview, and draft actions only
- No direct writes in v1
- No destructive actions in v1

## Notes

- This folder is intended to stay as the central working packet for future OpenClaw planning sessions.
- If new notes are added, they should generally extend this packet rather than creating disconnected planning files elsewhere.
