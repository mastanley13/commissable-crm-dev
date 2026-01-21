import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function authedJsonRequest(sessionToken: string, url: string, body?: unknown, method = "POST") {
  return new NextRequest(url, {
    method,
    headers: {
      cookie: `session-token=${sessionToken}`,
      "content-type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
  })
}

integrationTest("REC-AUTO-02: reconciliation settings persist and re-load via API", async ctx => {
  const routeModule = await import("../app/api/reconciliation/settings/route")
  const GET = (routeModule as any).GET ?? (routeModule as any).default?.GET
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof GET, "function")
  assert.equal(typeof POST, "function")

  const getInitial = await GET(
    authedJsonRequest(ctx.sessionToken, "http://localhost/api/reconciliation/settings", undefined, "GET"),
  )
  assertStatus(getInitial, 200)
  const initialPayload = await readJson<{ data?: any }>(getInitial)
  assert.equal(typeof initialPayload.data?.varianceTolerance, "number")
  assert.equal(typeof initialPayload.data?.includeFutureSchedulesDefault, "boolean")

  const update = await POST(
    authedJsonRequest(ctx.sessionToken, "http://localhost/api/reconciliation/settings", {
      varianceTolerance: 0.15,
      includeFutureSchedulesDefault: true,
      engineMode: "legacy",
    }),
  )
  assertStatus(update, 200)
  const updatePayload = await readJson<{ data?: any }>(update)
  assert.equal(updatePayload.data?.varianceTolerance, 0.15)
  assert.equal(updatePayload.data?.includeFutureSchedulesDefault, true)
  assert.equal(updatePayload.data?.engineMode, "legacy")

  const getAfter = await GET(
    authedJsonRequest(ctx.sessionToken, "http://localhost/api/reconciliation/settings", undefined, "GET"),
  )
  assertStatus(getAfter, 200)
  const afterPayload = await readJson<{ data?: any }>(getAfter)
  assert.equal(afterPayload.data?.varianceTolerance, 0.15)
  assert.equal(afterPayload.data?.includeFutureSchedulesDefault, true)
  assert.equal(afterPayload.data?.engineMode, "legacy")
})

