import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function makePostRequest(params: {
  sessionToken: string
  entityType: "accounts" | "opportunities"
  mapping: Record<string, string>
  rows: Array<Record<string, unknown>>
  fileName?: string
  upsertExisting?: boolean
}) {
  return new NextRequest("http://localhost/api/admin/data-settings/imports", {
    method: "POST",
    headers: {
      cookie: `session-token=${params.sessionToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      entityType: params.entityType,
      upsertExisting: params.upsertExisting ?? true,
      fileName: params.fileName ?? "opportunities-observability.csv",
      mapping: params.mapping,
      rows: params.rows
    })
  })
}

function makeHistoryRequest(params: { sessionToken: string; entityType: "accounts" | "opportunities" }) {
  return new NextRequest(
    `http://localhost/api/admin/data-settings/imports?entityType=${params.entityType}&pageSize=5`,
    {
      method: "GET",
      headers: {
        cookie: `session-token=${params.sessionToken}`
      }
    }
  )
}

function makeErrorsRequest(params: { sessionToken: string; importJobId: string }) {
  return new NextRequest(
    `http://localhost/api/admin/data-settings/imports/${params.importJobId}/errors`,
    {
      method: "GET",
      headers: {
        cookie: `session-token=${params.sessionToken}`
      }
    }
  )
}

function makeUndoRequest(params: { sessionToken: string; importJobId: string; method: "GET" | "POST" }) {
  return new NextRequest(
    `http://localhost/api/admin/data-settings/imports/${params.importJobId}/undo`,
    {
      method: params.method,
      headers: {
        cookie: `session-token=${params.sessionToken}`,
        ...(params.method === "POST" ? { "content-type": "application/json" } : {})
      },
      body: params.method === "POST" ? JSON.stringify({}) : undefined
    }
  )
}

integrationTest(
  "ADMIN-IMPORT-JOBS-01: admin import records history and exposes stored error CSV",
  async ctx => {
    const importRouteModule = await import("../app/api/admin/data-settings/imports/route")
    const errorsRouteModule = await import(
      "../app/api/admin/data-settings/imports/[importJobId]/errors/route"
    )
    const POST = (importRouteModule as any).POST ?? (importRouteModule as any).default?.POST
    const GET = (importRouteModule as any).GET ?? (importRouteModule as any).default?.GET
    const GET_ERRORS = (errorsRouteModule as any).GET ?? (errorsRouteModule as any).default?.GET

    assert.equal(typeof POST, "function")
    assert.equal(typeof GET, "function")
    assert.equal(typeof GET_ERRORS, "function")

    const dbModule = await import("../lib/db")
    const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

    const accountType = await prisma.accountType.findFirst({
      where: { tenantId: ctx.tenantId, code: "CUSTOMER" },
      select: { id: true }
    })
    assert.ok(accountType?.id)

    await prisma.account.create({
      data: {
        tenantId: ctx.tenantId,
        accountTypeId: accountType.id,
        accountName: "Observability Opportunity Account"
      }
    })

    const postResponse = await POST(
      makePostRequest({
        sessionToken: ctx.sessionToken,
        entityType: "opportunities",
        fileName: "opportunities-observability.csv",
        mapping: {
          "Account Name": "accountName",
          "Opportunity Name": "name",
          "Role": "roleName",
          "Role Contact Email": "roleContactEmail"
        },
        rows: [
          {
            "Account Name": "Observability Opportunity Account",
            "Opportunity Name": "Observability Opportunity",
            "Role": "Decision Maker",
            "Role Contact Email": "missing.role@example.com"
          }
        ]
      })
    )

    assertStatus(postResponse, 200)
    const importPayload = await readJson<{
      data?: {
        errorRows: number
        storedErrorCount?: number
        importJobId?: string
      }
    }>(postResponse)
    assert.equal(importPayload.data?.errorRows, 1)
    assert.equal(importPayload.data?.storedErrorCount, 1)
    assert.ok(importPayload.data?.importJobId)

    const historyResponse = await GET(
      makeHistoryRequest({
        sessionToken: ctx.sessionToken,
        entityType: "opportunities"
      })
    )

    assertStatus(historyResponse, 200)
    const historyPayload = await readJson<{
      data?: Array<{
        id: string
        entityType: string
        fileName: string
        errorCount: number | null
        status: string
      }>
    }>(historyResponse)
    assert.equal(historyPayload.data?.length, 1)
    assert.equal(historyPayload.data?.[0]?.id, importPayload.data?.importJobId)
    assert.equal(historyPayload.data?.[0]?.entityType, "opportunities")
    assert.equal(historyPayload.data?.[0]?.fileName, "opportunities-observability.csv")
    assert.equal(historyPayload.data?.[0]?.errorCount, 1)
    assert.equal(historyPayload.data?.[0]?.status, "Completed")

    const errorsResponse = await GET_ERRORS(
      makeErrorsRequest({
        sessionToken: ctx.sessionToken,
        importJobId: importPayload.data!.importJobId!
      }),
      { params: Promise.resolve({ importJobId: importPayload.data!.importJobId! }) }
    )

    assertStatus(errorsResponse, 200)
    assert.match(errorsResponse.headers.get("content-type") ?? "", /text\/csv/i)
    assert.match(
      errorsResponse.headers.get("content-disposition") ?? "",
      /opportunities-observability-errors\.csv/i
    )

    const csv = await errorsResponse.text()
    assert.match(csv, /Row Number/i)
    assert.match(csv, /roleContactEmail/i)
    assert.match(csv, /missing\.role@example\.com/i)
  }
)

integrationTest(
  "ADMIN-IMPORT-JOBS-02: admin import undo deletes created records and marks job undone",
  async ctx => {
    const importRouteModule = await import("../app/api/admin/data-settings/imports/route")
    const undoRouteModule = await import(
      "../app/api/admin/data-settings/imports/[importJobId]/undo/route"
    )
    const POST = (importRouteModule as any).POST ?? (importRouteModule as any).default?.POST
    const GET = (importRouteModule as any).GET ?? (importRouteModule as any).default?.GET
    const GET_UNDO = (undoRouteModule as any).GET ?? (undoRouteModule as any).default?.GET
    const POST_UNDO = (undoRouteModule as any).POST ?? (undoRouteModule as any).default?.POST

    assert.equal(typeof POST, "function")
    assert.equal(typeof GET, "function")
    assert.equal(typeof GET_UNDO, "function")
    assert.equal(typeof POST_UNDO, "function")

    const dbModule = await import("../lib/db")
    const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

    const postResponse = await POST(
      makePostRequest({
        sessionToken: ctx.sessionToken,
        entityType: "accounts",
        fileName: "accounts-undo.csv",
        upsertExisting: false,
        mapping: {
          "Account Name": "accountName",
          "Account Type": "accountTypeName"
        },
        rows: [
          {
            "Account Name": "Undo Created Account",
            "Account Type": "Customer"
          }
        ]
      })
    )

    assertStatus(postResponse, 200)
    const importPayload = await readJson<{
      data?: {
        successRows: number
        importJobId?: string
      }
    }>(postResponse)
    assert.equal(importPayload.data?.successRows, 1)
    assert.ok(importPayload.data?.importJobId)

    const createdAccount = await prisma.account.findFirst({
      where: { tenantId: ctx.tenantId, accountName: "Undo Created Account" },
      select: { id: true }
    })
    assert.ok(createdAccount?.id)

    const recordCount = await prisma.importJobRecord.count({
      where: { importJobId: importPayload.data!.importJobId! }
    })
    assert.equal(recordCount, 1)

    const historyResponse = await GET(
      makeHistoryRequest({
        sessionToken: ctx.sessionToken,
        entityType: "accounts"
      })
    )
    assertStatus(historyResponse, 200)
    const historyPayload = await readJson<{
      data?: Array<{ id: string; undoStatus: string; trackedRecordCount: number }>
    }>(historyResponse)
    assert.equal(historyPayload.data?.[0]?.id, importPayload.data?.importJobId)
    assert.equal(historyPayload.data?.[0]?.undoStatus, "Undoable")
    assert.equal(historyPayload.data?.[0]?.trackedRecordCount, 1)

    const previewResponse = await GET_UNDO(
      makeUndoRequest({
        sessionToken: ctx.sessionToken,
        importJobId: importPayload.data!.importJobId!,
        method: "GET"
      }),
      { params: Promise.resolve({ importJobId: importPayload.data!.importJobId! }) }
    )
    assertStatus(previewResponse, 200)
    const previewPayload = await readJson<{
      data?: { canUndo: boolean; recordCount: number; countsByEntity: Record<string, number> }
    }>(previewResponse)
    assert.equal(previewPayload.data?.canUndo, true)
    assert.equal(previewPayload.data?.recordCount, 1)
    assert.equal(previewPayload.data?.countsByEntity.Account, 1)

    const undoResponse = await POST_UNDO(
      makeUndoRequest({
        sessionToken: ctx.sessionToken,
        importJobId: importPayload.data!.importJobId!,
        method: "POST"
      }),
      { params: Promise.resolve({ importJobId: importPayload.data!.importJobId! }) }
    )
    assertStatus(undoResponse, 200)

    const remainingAccount = await prisma.account.findFirst({
      where: { tenantId: ctx.tenantId, accountName: "Undo Created Account" },
      select: { id: true }
    })
    assert.equal(remainingAccount, null)

    const importJob = await prisma.importJob.findUnique({
      where: { id: importPayload.data!.importJobId! },
      select: { undoStatus: true, undoCompletedAt: true, undoSummary: true }
    })
    assert.equal(importJob?.undoStatus, "Undone")
    assert.ok(importJob?.undoCompletedAt)
    assert.deepEqual((importJob?.undoSummary as any)?.countsByEntity, { Account: 1 })
  }
)

integrationTest(
  "ADMIN-IMPORT-JOBS-03: admin import undo blocks jobs that updated existing records",
  async ctx => {
    const importRouteModule = await import("../app/api/admin/data-settings/imports/route")
    const undoRouteModule = await import(
      "../app/api/admin/data-settings/imports/[importJobId]/undo/route"
    )
    const POST = (importRouteModule as any).POST ?? (importRouteModule as any).default?.POST
    const GET_UNDO = (undoRouteModule as any).GET ?? (undoRouteModule as any).default?.GET

    assert.equal(typeof POST, "function")
    assert.equal(typeof GET_UNDO, "function")

    const dbModule = await import("../lib/db")
    const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma
    const accountType = await prisma.accountType.findFirst({
      where: { tenantId: ctx.tenantId, code: "CUSTOMER" },
      select: { id: true }
    })
    assert.ok(accountType?.id)

    await prisma.account.create({
      data: {
        tenantId: ctx.tenantId,
        accountTypeId: accountType.id,
        accountName: "Undo Blocked Account",
        description: "Before"
      }
    })

    const postResponse = await POST(
      makePostRequest({
        sessionToken: ctx.sessionToken,
        entityType: "accounts",
        fileName: "accounts-update-blocked.csv",
        upsertExisting: true,
        mapping: {
          "Account Name": "accountName",
          "Account Type": "accountTypeName",
          Description: "description"
        },
        rows: [
          {
            "Account Name": "Undo Blocked Account",
            "Account Type": "Customer",
            Description: "After"
          }
        ]
      })
    )

    assertStatus(postResponse, 200)
    const importPayload = await readJson<{ data?: { importJobId?: string } }>(postResponse)
    assert.ok(importPayload.data?.importJobId)

    const importJob = await prisma.importJob.findUnique({
      where: { id: importPayload.data.importJobId },
      select: { undoStatus: true }
    })
    assert.equal(importJob?.undoStatus, "Blocked")

    const previewResponse = await GET_UNDO(
      makeUndoRequest({
        sessionToken: ctx.sessionToken,
        importJobId: importPayload.data.importJobId,
        method: "GET"
      }),
      { params: Promise.resolve({ importJobId: importPayload.data.importJobId }) }
    )
    assertStatus(previewResponse, 200)
    const previewPayload = await readJson<{ data?: { canUndo: boolean; blockers: string[] } }>(
      previewResponse
    )
    assert.equal(previewPayload.data?.canUndo, false)
    assert.match(previewPayload.data?.blockers.join(" ") ?? "", /updated existing records/i)
  }
)
