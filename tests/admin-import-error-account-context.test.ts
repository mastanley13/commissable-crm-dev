import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { assertStatus, integrationTest, readJson } from "./integration-test-helpers"

function makeAccountImportRequest(params: {
  sessionToken: string
  mapping: Record<string, string>
  rows: Array<Record<string, unknown>>
}) {
  return new NextRequest("http://localhost/api/admin/data-settings/imports", {
    method: "POST",
    headers: {
      cookie: `session-token=${params.sessionToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      entityType: "accounts",
      upsertExisting: true,
      mapping: params.mapping,
      rows: params.rows
    })
  })
}

integrationTest("ADMIN-IMPORT-ERROR-CONTEXT-01: row errors include mapped account context", async ctx => {
  const routeModule = await import("../app/api/admin/data-settings/imports/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const response = await POST(
    makeAccountImportRequest({
      sessionToken: ctx.sessionToken,
      mapping: {
        "Account Name": "accountName",
        "Salesforce ID": "salesforceId",
        "Account Type": "accountTypeName"
      },
      rows: [
        {
          "Account Name": "Bayshore",
          "Salesforce ID": "not-a-salesforce-id",
          "Account Type": "Customer"
        }
      ]
    })
  )

  assertStatus(response, 200)
  const payload = await readJson<{
    data?: {
      errorRows: number
      errors: Array<{ rowNumber: number; field: string; message: string; accountName?: string }>
    }
  }>(response)

  assert.equal(payload.data?.errorRows, 1)
  assert.equal(payload.data?.errors[0]?.rowNumber, 2)
  assert.equal(payload.data?.errors[0]?.field, "salesforceId")
  assert.equal(payload.data?.errors[0]?.accountName, "Bayshore")
  assert.match(payload.data?.errors[0]?.message ?? "", /Salesforce ID/)
})

integrationTest("ADMIN-IMPORT-ERROR-CONTEXT-02: blank account context falls back to row-only errors", async ctx => {
  const routeModule = await import("../app/api/admin/data-settings/imports/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const response = await POST(
    makeAccountImportRequest({
      sessionToken: ctx.sessionToken,
      mapping: {
        "Account Name": "accountName",
        "Account Type": "accountTypeName"
      },
      rows: [
        {
          "Account Name": "",
          "Account Type": "Customer"
        }
      ]
    })
  )

  assertStatus(response, 200)
  const payload = await readJson<{
    data?: {
      errorRows: number
      errors: Array<{ rowNumber: number; field: string; message: string; accountName?: string }>
    }
  }>(response)

  assert.equal(payload.data?.errorRows, 1)
  assert.equal(payload.data?.errors[0]?.rowNumber, 2)
  assert.equal(payload.data?.errors[0]?.field, "accountName")
  assert.equal(payload.data?.errors[0]?.accountName, undefined)
  assert.match(payload.data?.errors[0]?.message ?? "", /Missing required value/)
})
