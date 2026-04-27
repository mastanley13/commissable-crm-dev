import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function makeImportRequest(params: {
  sessionToken: string
  mapping: Record<string, string>
  rows: Array<Record<string, unknown>>
  fileName?: string
  entityOptions?: Record<string, unknown>
  upsertExisting?: boolean
  validateOnly?: boolean
}) {
  return new NextRequest("http://localhost/api/admin/data-settings/imports", {
    method: "POST",
    headers: {
      cookie: `session-token=${params.sessionToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      entityType: "deposit-transactions",
      upsertExisting: params.upsertExisting ?? false,
      validateOnly: params.validateOnly ?? false,
      fileName: params.fileName ?? "deposit-transactions.csv",
      entityOptions: params.entityOptions,
      mapping: params.mapping,
      rows: params.rows
    })
  })
}

function makeHistoryRequest(params: { sessionToken: string }) {
  return new NextRequest(
    "http://localhost/api/admin/data-settings/imports?entityType=deposit-transactions&pageSize=5",
    {
      method: "GET",
      headers: {
        cookie: `session-token=${params.sessionToken}`
      }
    }
  )
}

function makeReconciliationListRequest(params: {
  sessionToken: string
  includeSettledHistory?: boolean
}) {
  const search = new URLSearchParams({
    page: "1",
    pageSize: "10"
  })
  if (params.includeSettledHistory) {
    search.set("includeSettledHistory", "true")
  }
  return new NextRequest(`http://localhost/api/reconciliation/deposits?${search.toString()}`, {
    method: "GET",
    headers: {
      cookie: `session-token=${params.sessionToken}`
    }
  })
}

function makeAdminOverviewRequest(params: { sessionToken: string }) {
  return new NextRequest("http://localhost/api/admin/overview", {
    method: "GET",
    headers: {
      cookie: `session-token=${params.sessionToken}`
    }
  })
}

integrationTest(
  "ADMIN-IMPORT-DEPOSIT-01: settled-history import creates deposits, line items, and import history",
  async ctx => {
    const importRouteModule = await import("../app/api/admin/data-settings/imports/route")
    const POST = (importRouteModule as any).POST ?? (importRouteModule as any).default?.POST
    const GET = (importRouteModule as any).GET ?? (importRouteModule as any).default?.GET
    assert.equal(typeof POST, "function")
    assert.equal(typeof GET, "function")

    const dbModule = await import("../lib/db")
    const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

    const response = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        fileName: "settled-history.csv",
        entityOptions: {
          historicalBucket: "settled-history",
          sourceSystem: "Legacy CRM",
          idempotencyKey: "settled-history-wave-1",
          defaultDistributorAccountName: "Test Distributor",
          defaultVendorAccountName: "Test Vendor",
          notesPrefix: "Wave 1"
        },
        mapping: {
          "Source Deposit Key": "sourceDepositKey",
          "Source Transaction Key": "sourceTransactionKey",
          "Deposit Name": "depositName",
          "Commission Period": "commissionPeriod",
          "Payment Date": "paymentDate",
          "Line Item": "lineNumber",
          "Account Legal Name": "accountNameRaw",
          "Actual Commission": "commission"
        },
        rows: [
          {
            "Source Deposit Key": "DEP-001",
            "Source Transaction Key": "TX-001",
            "Deposit Name": "Legacy Deposit 001",
            "Commission Period": "2026-03",
            "Payment Date": "2026-03-15",
            "Line Item": "1",
            "Account Legal Name": "Acme Corp",
            "Actual Commission": "10.50"
          },
          {
            "Source Deposit Key": "DEP-001",
            "Source Transaction Key": "TX-002",
            "Deposit Name": "Legacy Deposit 001",
            "Commission Period": "2026-03",
            "Payment Date": "2026-03-16",
            "Line Item": "2",
            "Account Legal Name": "Acme Corp",
            "Actual Commission": "4.50"
          }
        ]
      })
    )

    assertStatus(response, 200)
    const payload = await readJson<{
      data?: { successRows: number; errorRows: number; importJobId?: string }
    }>(response)
    assert.equal(payload.data?.successRows, 2)
    assert.equal(payload.data?.errorRows, 0)
    assert.ok(payload.data?.importJobId)

    const deposit = await prisma.deposit.findFirst({
      where: { tenantId: ctx.tenantId, sourceSystem: "Legacy CRM", sourceDepositKey: "DEP-001" },
      select: {
        id: true,
        accountId: true,
        vendorAccountId: true,
        distributorAccountId: true,
        depositName: true,
        historicalBucket: true,
        importedViaAdmin: true,
        sourceSystem: true,
        sourceDepositKey: true,
        totalItems: true,
        totalCommissions: true,
        totalUsage: true,
        notes: true
      }
    })

    assert.ok(deposit?.id)
    assert.equal(deposit?.accountId, ctx.distributorAccountId)
    assert.equal(deposit?.distributorAccountId, ctx.distributorAccountId)
    assert.equal(deposit?.vendorAccountId, ctx.vendorAccountId)
    assert.equal(deposit?.depositName, "Legacy Deposit 001")
    assert.equal(deposit?.historicalBucket, "SettledHistory")
    assert.equal(deposit?.importedViaAdmin, true)
    assert.equal(deposit?.sourceSystem, "Legacy CRM")
    assert.equal(deposit?.sourceDepositKey, "DEP-001")
    assert.equal(deposit?.totalItems, 2)
    assert.equal(Number(deposit?.totalCommissions ?? 0), 15)
    assert.equal(Number(deposit?.totalUsage ?? 0), 15)
    assert.match(deposit?.notes ?? "", /Wave 1/)

    const lineItems = await prisma.depositLineItem.findMany({
      where: { tenantId: ctx.tenantId, depositId: deposit!.id },
      orderBy: { lineNumber: "asc" },
      select: {
        sourceSystem: true,
        sourceTransactionKey: true,
        usage: true,
        commission: true,
        lineNumber: true
      }
    })

    assert.equal(lineItems.length, 2)
    assert.equal(lineItems[0]?.sourceSystem, "Legacy CRM")
    assert.equal(lineItems[0]?.sourceTransactionKey, "TX-001")
    assert.equal(lineItems[0]?.lineNumber, 1)
    assert.equal(Number(lineItems[0]?.usage ?? 0), 10.5)
    assert.equal(Number(lineItems[0]?.commission ?? 0), 10.5)
    assert.equal(lineItems[1]?.sourceTransactionKey, "TX-002")

    const historyResponse = await GET(makeHistoryRequest({ sessionToken: ctx.sessionToken }))
    assertStatus(historyResponse, 200)
    const historyPayload = await readJson<{
      data?: Array<{ entityType: string; fileName: string; status: string }>
    }>(historyResponse)
    assert.equal(historyPayload.data?.[0]?.entityType, "deposit-transactions")
    assert.equal(historyPayload.data?.[0]?.fileName, "settled-history.csv")
    assert.equal(historyPayload.data?.[0]?.status, "Completed")
  }
)

integrationTest(
  "ADMIN-IMPORT-DEPOSIT-02: settled-history is hidden from default reconciliation list while open-or-disputed stays visible",
  async ctx => {
    const importRouteModule = await import("../app/api/admin/data-settings/imports/route")
    const reconciliationRouteModule = await import("../app/api/reconciliation/deposits/route")
    const POST = (importRouteModule as any).POST ?? (importRouteModule as any).default?.POST
    const GET_RECONCILIATION =
      (reconciliationRouteModule as any).GET ?? (reconciliationRouteModule as any).default?.GET

    assert.equal(typeof POST, "function")
    assert.equal(typeof GET_RECONCILIATION, "function")

    const baseMapping = {
      "Source Deposit Key": "sourceDepositKey",
      "Source Transaction Key": "sourceTransactionKey",
      "Deposit Name": "depositName",
      "Payment Date": "paymentDate",
      "Actual Commission": "commission"
    }

    const settledResponse = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        fileName: "settled-only.csv",
        entityOptions: {
          historicalBucket: "settled-history",
          sourceSystem: "Archive",
          idempotencyKey: "archive-settled",
          defaultDistributorAccountName: "Test Distributor",
          defaultVendorAccountName: "Test Vendor"
        },
        mapping: baseMapping,
        rows: [
          {
            "Source Deposit Key": "ARCHIVE-DEP-1",
            "Source Transaction Key": "ARCHIVE-TX-1",
            "Deposit Name": "Archive Deposit",
            "Payment Date": "2026-02-01",
            "Actual Commission": "8"
          }
        ]
      })
    )
    assertStatus(settledResponse, 200)

    const openResponse = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        fileName: "open-disputed.csv",
        entityOptions: {
          historicalBucket: "open-or-disputed",
          sourceSystem: "Archive",
          idempotencyKey: "archive-open",
          defaultDistributorAccountName: "Test Distributor",
          defaultVendorAccountName: "Test Vendor"
        },
        mapping: baseMapping,
        rows: [
          {
            "Source Deposit Key": "OPEN-DEP-1",
            "Source Transaction Key": "OPEN-TX-1",
            "Deposit Name": "Open Deposit",
            "Payment Date": "2026-02-05",
            "Actual Commission": "12"
          }
        ]
      })
    )
    assertStatus(openResponse, 200)

    const defaultListResponse = await GET_RECONCILIATION(
      makeReconciliationListRequest({ sessionToken: ctx.sessionToken })
    )
    assertStatus(defaultListResponse, 200)
    const defaultListPayload = await readJson<{ data?: Array<{ depositName: string }> }>(
      defaultListResponse
    )

    const defaultNames = (defaultListPayload.data ?? []).map(item => item.depositName)
    assert.equal(defaultNames.includes("Open Deposit"), true)
    assert.equal(defaultNames.includes("Archive Deposit"), false)

    const includeSettledResponse = await GET_RECONCILIATION(
      makeReconciliationListRequest({
        sessionToken: ctx.sessionToken,
        includeSettledHistory: true
      })
    )
    assertStatus(includeSettledResponse, 200)
    const includeSettledPayload = await readJson<{ data?: Array<{ depositName: string }> }>(
      includeSettledResponse
    )
    const allNames = (includeSettledPayload.data ?? []).map(item => item.depositName)
    assert.equal(allNames.includes("Open Deposit"), true)
    assert.equal(allNames.includes("Archive Deposit"), true)
  }
)

integrationTest(
  "ADMIN-IMPORT-DEPOSIT-03: duplicate source transaction keys in one request return row errors",
  async ctx => {
    const importRouteModule = await import("../app/api/admin/data-settings/imports/route")
    const POST = (importRouteModule as any).POST ?? (importRouteModule as any).default?.POST
    assert.equal(typeof POST, "function")

    const dbModule = await import("../lib/db")
    const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

    const response = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        fileName: "duplicate-transactions.csv",
        entityOptions: {
          historicalBucket: "open-or-disputed",
          sourceSystem: "Legacy CRM",
          idempotencyKey: "duplicate-transaction-wave",
          defaultDistributorAccountName: "Test Distributor",
          defaultVendorAccountName: "Test Vendor"
        },
        mapping: {
          "Source Deposit Key": "sourceDepositKey",
          "Source Transaction Key": "sourceTransactionKey",
          "Payment Date": "paymentDate",
          "Actual Commission": "commission"
        },
        rows: [
          {
            "Source Deposit Key": "DEP-DUP-1",
            "Source Transaction Key": "DUP-TX-1",
            "Payment Date": "2026-03-10",
            "Actual Commission": "7"
          },
          {
            "Source Deposit Key": "DEP-DUP-1",
            "Source Transaction Key": "DUP-TX-1",
            "Payment Date": "2026-03-10",
            "Actual Commission": "9"
          }
        ]
      })
    )

    assertStatus(response, 200)
    const payload = await readJson<{
      data?: {
        successRows: number
        errorRows: number
        errors: Array<{ field: string; message: string }>
      }
    }>(response)
    assert.equal(payload.data?.successRows, 1)
    assert.equal(payload.data?.errorRows, 1)
    assert.equal(payload.data?.errors?.[0]?.field, "sourceTransactionKey")
    assert.match(payload.data?.errors?.[0]?.message ?? "", /duplicated in this import file/i)

    const lineItems = await prisma.depositLineItem.findMany({
      where: { tenantId: ctx.tenantId, sourceSystem: "Legacy CRM", sourceTransactionKey: "DUP-TX-1" },
      select: { id: true }
    })
    assert.equal(lineItems.length, 1)
  }
)

integrationTest(
  "ADMIN-IMPORT-DEPOSIT-04: repeating the same idempotency key returns the original completed result",
  async ctx => {
    const importRouteModule = await import("../app/api/admin/data-settings/imports/route")
    const POST = (importRouteModule as any).POST ?? (importRouteModule as any).default?.POST
    assert.equal(typeof POST, "function")

    const request = makeImportRequest({
      sessionToken: ctx.sessionToken,
      fileName: "idempotent-deposit.csv",
      entityOptions: {
        historicalBucket: "open-or-disputed",
        sourceSystem: "Legacy CRM",
        idempotencyKey: "repeatable-admin-import",
        defaultDistributorAccountName: "Test Distributor",
        defaultVendorAccountName: "Test Vendor"
      },
      mapping: {
        "Source Deposit Key": "sourceDepositKey",
        "Source Transaction Key": "sourceTransactionKey",
        "Payment Date": "paymentDate",
        "Actual Commission": "commission"
      },
      rows: [
        {
          "Source Deposit Key": "REPLAY-DEP-1",
          "Source Transaction Key": "REPLAY-TX-1",
          "Payment Date": "2026-03-20",
          "Actual Commission": "11"
        }
      ]
    })

    const firstResponse = await POST(request)
    assertStatus(firstResponse, 200)
    const firstPayload = await readJson<{ data?: { importJobId?: string; successRows: number } }>(
      firstResponse
    )
    assert.equal(firstPayload.data?.successRows, 1)
    assert.ok(firstPayload.data?.importJobId)

    const secondResponse = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        fileName: "idempotent-deposit.csv",
        entityOptions: {
          historicalBucket: "open-or-disputed",
          sourceSystem: "Legacy CRM",
          idempotencyKey: "repeatable-admin-import",
          defaultDistributorAccountName: "Test Distributor",
          defaultVendorAccountName: "Test Vendor"
        },
        mapping: {
          "Source Deposit Key": "sourceDepositKey",
          "Source Transaction Key": "sourceTransactionKey",
          "Payment Date": "paymentDate",
          "Actual Commission": "commission"
        },
        rows: [
          {
            "Source Deposit Key": "REPLAY-DEP-1",
            "Source Transaction Key": "REPLAY-TX-1",
            "Payment Date": "2026-03-20",
            "Actual Commission": "11"
          }
        ]
      })
    )
    assertStatus(secondResponse, 200)
    const secondPayload = await readJson<{ data?: { importJobId?: string; successRows: number } }>(
      secondResponse
    )
    assert.equal(secondPayload.data?.successRows, 1)
    assert.equal(secondPayload.data?.importJobId, firstPayload.data?.importJobId)
  }
)

integrationTest(
  "ADMIN-IMPORT-DEPOSIT-05: admin overview excludes settled-history deposits from active finance counts",
  async ctx => {
    const importRouteModule = await import("../app/api/admin/data-settings/imports/route")
    const adminOverviewRouteModule = await import("../app/api/admin/overview/route")
    const POST = (importRouteModule as any).POST ?? (importRouteModule as any).default?.POST
    const GET_OVERVIEW =
      (adminOverviewRouteModule as any).GET ?? (adminOverviewRouteModule as any).default?.GET

    assert.equal(typeof POST, "function")
    assert.equal(typeof GET_OVERVIEW, "function")

    const mapping = {
      "Source Deposit Key": "sourceDepositKey",
      "Source Transaction Key": "sourceTransactionKey",
      "Payment Date": "paymentDate",
      "Actual Commission": "commission"
    }

    const settledResponse = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        fileName: "overview-settled.csv",
        entityOptions: {
          historicalBucket: "settled-history",
          sourceSystem: "Overview Source",
          idempotencyKey: "overview-settled",
          defaultDistributorAccountName: "Test Distributor",
          defaultVendorAccountName: "Test Vendor"
        },
        mapping,
        rows: [
          {
            "Source Deposit Key": "OV-SETTLED-1",
            "Source Transaction Key": "OV-SETTLED-TX-1",
            "Payment Date": "2026-03-01",
            "Actual Commission": "9"
          }
        ]
      })
    )
    assertStatus(settledResponse, 200)

    const openResponse = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        fileName: "overview-open.csv",
        entityOptions: {
          historicalBucket: "open-or-disputed",
          sourceSystem: "Overview Source",
          idempotencyKey: "overview-open",
          defaultDistributorAccountName: "Test Distributor",
          defaultVendorAccountName: "Test Vendor"
        },
        mapping,
        rows: [
          {
            "Source Deposit Key": "OV-OPEN-1",
            "Source Transaction Key": "OV-OPEN-TX-1",
            "Payment Date": "2026-03-01",
            "Actual Commission": "13"
          }
        ]
      })
    )
    assertStatus(openResponse, 200)

    const overviewResponse = await GET_OVERVIEW(makeAdminOverviewRequest({ sessionToken: ctx.sessionToken }))
    assertStatus(overviewResponse, 200)
    const overviewPayload = await readJson<{
      data?: {
        revenueFinance?: {
          totalDeposits?: number
          unmatchedItems?: number
        }
      }
    }>(overviewResponse)

    assert.equal(overviewPayload.data?.revenueFinance?.totalDeposits, 1)
    assert.equal(overviewPayload.data?.revenueFinance?.unmatchedItems, 1)
  }
)

integrationTest(
  "ADMIN-IMPORT-DEPOSIT-06: validate-only returns validation results without writing deposits or import history",
  async ctx => {
    const importRouteModule = await import("../app/api/admin/data-settings/imports/route")
    const POST = (importRouteModule as any).POST ?? (importRouteModule as any).default?.POST
    const GET = (importRouteModule as any).GET ?? (importRouteModule as any).default?.GET
    assert.equal(typeof POST, "function")
    assert.equal(typeof GET, "function")

    const dbModule = await import("../lib/db")
    const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

    const response = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        validateOnly: true,
        fileName: "validate-only-deposit.csv",
        entityOptions: {
          historicalBucket: "open-or-disputed",
          sourceSystem: "Validate Only",
          idempotencyKey: "validate-only-wave",
          defaultDistributorAccountName: "Test Distributor",
          defaultVendorAccountName: "Test Vendor"
        },
        mapping: {
          "Source Deposit Key": "sourceDepositKey",
          "Source Transaction Key": "sourceTransactionKey",
          "Payment Date": "paymentDate",
          "Actual Commission": "commission"
        },
        rows: [
          {
            "Source Deposit Key": "VALIDATE-DEP-1",
            "Source Transaction Key": "VALIDATE-TX-1",
            "Payment Date": "2026-03-20",
            "Actual Commission": "11"
          }
        ]
      })
    )

    assertStatus(response, 200)
    const payload = await readJson<{
      data?: { mode?: string; successRows: number; errorRows: number; importJobId?: string }
    }>(response)
    assert.equal(payload.data?.mode, "validate-only")
    assert.equal(payload.data?.successRows, 1)
    assert.equal(payload.data?.errorRows, 0)
    assert.equal(payload.data?.importJobId, undefined)

    const depositCount = await prisma.deposit.count({
      where: { tenantId: ctx.tenantId, sourceSystem: "Validate Only" }
    })
    assert.equal(depositCount, 0)

    const importJobCount = await prisma.importJob.count({
      where: { tenantId: ctx.tenantId }
    })
    assert.equal(importJobCount, 0)

    const historyResponse = await GET(makeHistoryRequest({ sessionToken: ctx.sessionToken }))
    assertStatus(historyResponse, 200)
    const historyPayload = await readJson<{ data?: Array<unknown> }>(historyResponse)
    assert.equal(historyPayload.data?.length ?? 0, 0)
  }
)
