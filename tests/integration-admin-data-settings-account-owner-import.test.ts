import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { assertStatus, integrationTest, readJson } from "./integration-test-helpers"

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
      entityType: "accounts",
      upsertExisting: params.upsertExisting ?? true,
      mapping: params.mapping,
      rows: params.rows
    })
  })
}

integrationTest(
  "ADMIN-IMPORT-ACCT-OWNER-01: account import resolves Account Owner by active user full name",
  async ctx => {
    const routeModule = await import("../app/api/admin/data-settings/imports/route")
    const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
    assert.equal(typeof POST, "function")

    const dbModule = await import("../lib/db")
    const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

    const owner = await prisma.user.create({
      data: {
        tenantId: ctx.tenantId,
        roleId: ctx.roleId,
        email: `rob-hootselle-${Date.now()}@example.com`,
        firstName: "Rob",
        lastName: "Hootselle",
        fullName: "Rob Hootselle",
        status: "Active"
      },
      select: { id: true }
    })

    const response = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        mapping: {
          "Account Name": "accountName",
          "Account Type": "accountTypeName",
          "Account Owner": "ownerEmail"
        },
        rows: [
          {
            "Account Name": "Imported Owner Account",
            "Account Type": "Customer",
            "Account Owner": "Rob Hootselle"
          }
        ]
      })
    )

    assertStatus(response, 200)
    const payload = await readJson<{ data?: { successRows: number; errorRows: number } }>(response)
    assert.equal(payload.data?.successRows, 1)
    assert.equal(payload.data?.errorRows, 0)

    const account = await prisma.account.findFirst({
      where: { tenantId: ctx.tenantId, accountName: "Imported Owner Account" },
      select: { ownerId: true }
    })

    assert.equal(account?.ownerId, owner.id)
  }
)
