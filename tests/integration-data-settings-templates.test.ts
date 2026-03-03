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

integrationTest("ADM-DS-TPL-01: manage reconciliation templates via Data Settings API", async ctx => {
  const templatesModule = await import("../app/api/admin/data-settings/templates/route")
  const listGET = (templatesModule as any).GET
  const createPOST = (templatesModule as any).POST
  assert.equal(typeof listGET, "function")
  assert.equal(typeof createPOST, "function")

  const detailModule = await import("../app/api/admin/data-settings/templates/[templateId]/route")
  const detailGET = (detailModule as any).GET
  const detailPATCH = (detailModule as any).PATCH
  assert.equal(typeof detailGET, "function")
  assert.equal(typeof detailPATCH, "function")

  const cloneModule = await import("../app/api/admin/data-settings/templates/[templateId]/clone/route")
  const clonePOST = (cloneModule as any).POST
  assert.equal(typeof clonePOST, "function")

  const initialList = await listGET(
    authedJsonRequest(ctx.sessionToken, "http://localhost/api/admin/data-settings/templates?page=1&pageSize=25", undefined, "GET"),
  )
  assertStatus(initialList, 200)
  const initialPayload = await readJson<{ data?: any[]; pagination?: any }>(initialList)
  assert.ok(Array.isArray(initialPayload.data))

  const createConfig = {
    depositMapping: {
      version: 2,
      targets: { "depositLineItem.usage": "Usage" },
      columns: { Usage: { mode: "target", targetId: "depositLineItem.usage" } },
      customFields: {},
    },
  }

  const createdRes = await createPOST(
    authedJsonRequest(ctx.sessionToken, "http://localhost/api/admin/data-settings/templates", {
      name: "Test Template",
      description: "Created via integration test",
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      config: createConfig,
    }),
  )
  assertStatus(createdRes, 200)
  const createdPayload = await readJson<{ data?: any }>(createdRes)
  assert.equal(createdPayload.data?.name, "Test Template")
  const templateId = createdPayload.data?.id as string
  assert.ok(templateId)

  const listAfterCreate = await listGET(
    authedJsonRequest(
      ctx.sessionToken,
      `http://localhost/api/admin/data-settings/templates?page=1&pageSize=25&q=Test&distributorAccountId=${ctx.distributorAccountId}&vendorAccountId=${ctx.vendorAccountId}`,
      undefined,
      "GET",
    ),
  )
  assertStatus(listAfterCreate, 200)
  const listPayload = await readJson<{ data?: any[] }>(listAfterCreate)
  assert.ok((listPayload.data ?? []).some(item => item.id === templateId))

  const detailRes = await detailGET(
    authedJsonRequest(ctx.sessionToken, `http://localhost/api/admin/data-settings/templates/${templateId}`, undefined, "GET"),
    { params: { templateId } },
  )
  assertStatus(detailRes, 200)
  const detailPayload = await readJson<{ data?: any }>(detailRes)
  assert.equal(detailPayload.data?.id, templateId)
  assert.equal(detailPayload.data?.config?.depositMapping?.version, 2)

  const patchRes = await detailPATCH(
    authedJsonRequest(ctx.sessionToken, `http://localhost/api/admin/data-settings/templates/${templateId}`, {
      name: "Test Template Renamed",
    }, "PATCH"),
    { params: { templateId } },
  )
  assertStatus(patchRes, 200)
  const patchedPayload = await readJson<{ data?: any }>(patchRes)
  assert.equal(patchedPayload.data?.name, "Test Template Renamed")

  const cloneRes = await clonePOST(
    authedJsonRequest(ctx.sessionToken, `http://localhost/api/admin/data-settings/templates/${templateId}/clone`, undefined, "POST"),
    { params: { templateId } },
  )
  assertStatus(cloneRes, 200)
  const clonePayload = await readJson<{ data?: any }>(cloneRes)
  assert.ok(typeof clonePayload.data?.id === "string")
  assert.ok(String(clonePayload.data?.name ?? "").includes("(Copy)"))
  assert.equal(clonePayload.data?.config?.depositMapping?.version, 2)
})

