# OpenClaw Read-Only Tool Gateway

Date: 2026-04-22

## Purpose

Expose a broader CRM read-only tool surface for OpenClaw without connecting the agent to the write-capable `/api/bot/v1/[...path]` route.

Base URL:

```text
https://commissable-crm-dev.vercel.app/api/bot/v1/tools
```

Authentication:

```text
Authorization: Bearer <OPENCLAW_API_KEY>
Content-Type: application/json
```

The OpenClaw droplet can keep `COMMISSABLE_API_URL=https://commissable-crm-dev.vercel.app/api/bot/v1/tools` and send `COMMISSABLE_API_KEY` as the bearer token.

Runtime source of truth:

- Fetch `/manifest` for the approved tool surface.
- Fetch `/capabilities` for the business intent to capability registry.
- Fetch `/capabilities/resolve?message=...` to resolve supported user questions into business intents and suggested params before tool calls.
- Do not treat the legacy `/api/bot/v1` OpenAPI file as the client-facing v1 question-answering contract.

## Tools

All tools are tenant-scoped through the configured bot user and use existing CRM permissions.

```text
GET  /manifest
GET  /capabilities
GET  /capabilities/resolve?message=
GET  /accounts/search?q=&limit=
GET  /accounts/:id/context
GET  /contacts/search?q=&accountId=&limit=
GET  /products/search?q=&vendorAccountId=&distributorAccountId=&active=&limit=
GET  /opportunities/search?q=&accountId=&stage=&status=&limit=
GET  /opportunities/:id/context
GET  /revenue-schedules/search?q=&accountId=&vendorAccountId=&productId=&from=&to=&limit=
GET  /revenue-schedules/top-usage-accounts?month=2026-03&limit=5
GET  /revenue-schedules/top-usage-accounts?from=2026-03-01&to=2026-03-31&limit=5
GET  /reconciliation/deposits/search?q=&status=&from=&to=&limit=
GET  /reconciliation/deposits/:id/detail
GET  /reconciliation/summary?from=&to=
GET  /imports/readiness
GET  /imports/recent?entity=&status=&limit=
GET  /imports/:id/errors?limit=
GET  /records/link?entityType=&id=
POST /tickets/draft
```

Blocked methods:

```text
PUT, PATCH, DELETE
```

## Runtime Routing Rules

- Resolve supported business questions through `/capabilities`, not by guessing internal routes.
- Prefer `/capabilities/resolve?message=...` as the first runtime step for natural-language business questions.
- For top-usage account questions, prefer `month=YYYY-MM` for calendar-month requests.
- If using explicit dates, send both `from` and `to` in `YYYY-MM-DD` format.
- Do not send both `month` and `from`/`to` in the same request.
- Any write-style user request stays read-only in v1 and should convert to preview/guidance behavior.

## Smoke Tests

Bad key should reach bot auth and fail with `Invalid API token`:

```bash
curl -i \
  -H "Authorization: Bearer wrong" \
  "https://commissable-crm-dev.vercel.app/api/bot/v1/tools/manifest"
```

Real key from the droplet:

```bash
set -a
. /root/.openclaw/.env
set +a

curl -i \
  -H "Authorization: Bearer $COMMISSABLE_API_KEY" \
  "$COMMISSABLE_API_URL/manifest"
```

Capability registry:

```bash
curl -i \
  -H "Authorization: Bearer $COMMISSABLE_API_KEY" \
  "$COMMISSABLE_API_URL/capabilities"
```

Capability resolution for a realistic business question:

```bash
curl -i \
  -H "Authorization: Bearer $COMMISSABLE_API_KEY" \
  --get \
  --data-urlencode "message=What are the top 5 usage accounts for March 2026?" \
  "$COMMISSABLE_API_URL/capabilities/resolve"
```

Top usage account query:

```bash
curl -i \
  -H "Authorization: Bearer $COMMISSABLE_API_KEY" \
  "$COMMISSABLE_API_URL/revenue-schedules/top-usage-accounts?month=2026-03&limit=5"
```

Expected outcomes:

- `200 OK`: OpenClaw can authenticate and call the tool.
- `401 Invalid API token`: Vercel `OPENCLAW_API_KEY` and droplet `COMMISSABLE_API_KEY` do not match.
- `500 Bot auth configuration error`: Vercel is missing `OPENCLAW_API_KEY` or `OPENCLAW_BOT_USER_ID`.
- `403 Permission denied`: bot user exists but its role is missing the route's required read permission.

## Required OpenClaw Update

Update the droplet environment:

```text
COMMISSABLE_API_URL=https://commissable-crm-dev.vercel.app/api/bot/v1/tools
```

Operational expectation:

- OpenClaw should refresh `/manifest`, `/capabilities`, and `/capabilities/resolve` behavior whenever the prompt pack or tool docs are updated.

Then restart OpenClaw using the clean stop/start sequence.
