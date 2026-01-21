import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function authedGet(sessionToken: string, url: string) {
  return new NextRequest(url, {
    method: "GET",
    headers: { cookie: `session-token=${sessionToken}` },
  })
}

integrationTest("REC-AUTO-03: deposits list filtering + pagination contract", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await prisma.deposit.createMany({
    data: [
      {
        tenantId: ctx.tenantId,
        accountId: ctx.distributorAccountId,
        month: new Date("2026-01-01T00:00:00Z"),
        depositName: "Alpha Deposit",
        paymentDate: new Date("2026-01-15T00:00:00Z"),
        paymentType: "ACH",
        distributorAccountId: ctx.distributorAccountId,
        vendorAccountId: ctx.vendorAccountId,
        status: "Pending",
      },
      {
        tenantId: ctx.tenantId,
        accountId: ctx.distributorAccountId,
        month: new Date("2026-01-01T00:00:00Z"),
        depositName: "Beta Deposit",
        paymentDate: new Date("2026-01-20T00:00:00Z"),
        paymentType: "Wire",
        distributorAccountId: ctx.distributorAccountId,
        vendorAccountId: ctx.vendorAccountId,
        status: "Completed",
        reconciled: true,
        reconciledAt: new Date("2026-01-21T00:00:00Z"),
      },
    ],
  })

  const routeModule = await import("../app/api/reconciliation/deposits/route")
  const GET = (routeModule as any).GET ?? (routeModule as any).default?.GET
  assert.equal(typeof GET, "function")

  const page1 = await GET(
    authedGet(ctx.sessionToken, "http://localhost/api/reconciliation/deposits?page=1&pageSize=1&q=Deposit"),
  )
  assertStatus(page1, 200)
  const page1Payload = await readJson<{ data?: any[]; pagination?: any }>(page1)
  assert.equal(page1Payload.pagination?.pageSize, 1)
  assert.equal(page1Payload.pagination?.total, 2)
  assert.equal(page1Payload.data?.length, 1)

  const completed = await GET(
    authedGet(ctx.sessionToken, "http://localhost/api/reconciliation/deposits?status=Completed"),
  )
  assertStatus(completed, 200)
  const completedPayload = await readJson<{ data?: any[] }>(completed)
  assert.equal(completedPayload.data?.length, 1)
  assert.equal(completedPayload.data?.[0]?.status, "Completed")

  const invalidStatus = await GET(
    authedGet(ctx.sessionToken, "http://localhost/api/reconciliation/deposits?status=Nope"),
  )
  assertStatus(invalidStatus, 400)
})

integrationTest("REC-AUTO-04: deposit detail contract returns metadata + lineItems shapes", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      depositName: "Detail Deposit",
      paymentDate: new Date("2026-01-02T00:00:00Z"),
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      status: "InReview",
      createdByUserId: ctx.userId,
    },
    select: { id: true },
  })

  await prisma.depositLineItem.create({
    data: {
      tenantId: ctx.tenantId,
      depositId: deposit.id,
      lineNumber: 1,
      status: "Unmatched",
      paymentDate: new Date("2026-01-02T00:00:00Z"),
      usage: 100,
      usageAllocated: 0,
      usageUnallocated: 100,
      commission: 10,
      commissionAllocated: 0,
      commissionUnallocated: 10,
      vendorAccountId: ctx.vendorAccountId,
      accountNameRaw: "Acme Co",
      productNameRaw: "Internet",
      vendorNameRaw: "Test Vendor",
      distributorNameRaw: "Test Distributor",
    },
    select: { id: true },
  })

  const routeModule = await import("../app/api/reconciliation/deposits/[depositId]/detail/route")
  const GET = (routeModule as any).GET ?? (routeModule as any).default?.GET
  assert.equal(typeof GET, "function")

  const response = await GET(
    authedGet(ctx.sessionToken, `http://localhost/api/reconciliation/deposits/${deposit.id}/detail`),
    { params: { depositId: deposit.id } },
  )
  assertStatus(response, 200)

  const payload = await readJson<{ data?: { metadata?: any; lineItems?: any[] } }>(response)
  assert.ok(payload.data?.metadata)
  assert.ok(Array.isArray(payload.data?.lineItems))
  assert.equal(payload.data?.lineItems?.length, 1)

  const metadata = payload.data!.metadata
  assert.ok(metadata.id)
  assert.equal(typeof metadata.depositName, "string")
  assert.equal(typeof metadata.depositDate, "string")
  assert.equal(typeof metadata.status, "string")

  const line = payload.data!.lineItems![0]!
  assert.ok(line.id)
  assert.equal(typeof line.status, "string")
  assert.equal(typeof line.paymentDate, "string")
  assert.equal(typeof line.accountName, "string")
  assert.equal(typeof line.usage, "number")
  assert.equal(typeof line.commission, "number")
})

