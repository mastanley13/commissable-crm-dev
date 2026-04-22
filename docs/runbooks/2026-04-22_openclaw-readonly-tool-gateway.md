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

## Tools

All tools are tenant-scoped through the configured bot user and use existing CRM permissions.

```text
GET  /manifest
GET  /accounts/search?q=&limit=
GET  /accounts/:id/context
GET  /contacts/search?q=&accountId=&limit=
GET  /products/search?q=&vendorAccountId=&distributorAccountId=&active=&limit=
GET  /opportunities/search?q=&accountId=&stage=&status=&limit=
GET  /opportunities/:id/context
GET  /revenue-schedules/search?q=&accountId=&vendorAccountId=&productId=&from=&to=&limit=
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

Top usage account query:

```bash
curl -i \
  -H "Authorization: Bearer $COMMISSABLE_API_KEY" \
  "$COMMISSABLE_API_URL/revenue-schedules/top-usage-accounts?from=2026-03-01&to=2026-03-31&limit=5"
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

Then restart OpenClaw using the clean stop/start sequence.
