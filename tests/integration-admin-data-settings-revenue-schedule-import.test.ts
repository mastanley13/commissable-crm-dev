import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function makeImportRequest(params: {
  sessionToken: string
  mapping: Record<string, string>
  rows: Array<Record<string, unknown>>
  upsertExisting?: boolean
}) {
  return new NextRequest("http://localhost/api/admin/data-settings/imports", {
    method: "POST",
    headers: {
      cookie: `session-token=${params.sessionToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      entityType: "revenue-schedules",
      upsertExisting: params.upsertExisting ?? false,
      mapping: params.mapping,
      rows: params.rows
    })
  })
}

integrationTest(
  "ADMIN-IMPORT-REV-01: revenue schedule imports reject upsert mode and explain rerun safety",
  async ctx => {
    const routeModule = await import("../app/api/admin/data-settings/imports/route")
    const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
    assert.equal(typeof POST, "function")

    const response = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        upsertExisting: true,
        mapping: {
          "Account Name": "accountName"
        },
        rows: [
          {
            "Account Name": "Any Account"
          }
        ]
      })
    )

    assertStatus(response, 400)
    const payload = await readJson<{ error?: string }>(response)
    assert.match(payload.error ?? "", /create-only/i)
    assert.match(payload.error ?? "", /Reset or remove previously imported revenue schedules/i)
  }
)
