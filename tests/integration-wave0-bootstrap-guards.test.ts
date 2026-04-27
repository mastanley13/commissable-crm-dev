import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function authedGet(sessionToken: string, url: string) {
  return new NextRequest(url, {
    method: "GET",
    headers: { cookie: `session-token=${sessionToken}` },
  })
}

function authedJson(sessionToken: string, url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      cookie: `session-token=${sessionToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

integrationTest("WAVE0-01: deposit detail resolves a unique customer account without overwriting raw Other account id", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const accountType = await prisma.accountType.findFirst({ where: { tenantId: ctx.tenantId } })
  assert.ok(accountType, "Expected seeded account type")

  const customer = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "Win-Tech",
      accountLegalName: "Win-Tech, Inc.",
    },
    select: { id: true, accountName: true, accountLegalName: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-04-01T00:00:00Z"),
      depositName: "Wave 0 Detail Deposit",
      paymentDate: new Date("2026-04-06T00:00:00Z"),
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
      paymentDate: new Date("2026-04-06T00:00:00Z"),
      usage: 145,
      usageAllocated: 0,
      usageUnallocated: 145,
      commission: 24.65,
      commissionAllocated: 0,
      commissionUnallocated: 24.65,
      vendorAccountId: ctx.vendorAccountId,
      accountNameRaw: customer.accountLegalName,
      vendorNameRaw: "ACC Business",
      distributorNameRaw: "Telarus",
      productNameRaw: "HSIA Internet Access",
    },
  })

  const routeModule = await import("../app/api/reconciliation/deposits/[depositId]/detail/route")
  const GET = (routeModule as any).GET ?? (routeModule as any).default?.GET
  assert.equal(typeof GET, "function")

  const response = await GET(
    authedGet(ctx.sessionToken, `http://localhost/api/reconciliation/deposits/${deposit.id}/detail`),
    { params: { depositId: deposit.id } },
  )
  assertStatus(response, 200)

  const payload = await readJson<{ data?: { lineItems?: any[] } }>(response)
  const line = payload.data?.lineItems?.[0]
  assert.ok(line)
  assert.equal(line.accountId, "")
  assert.equal(line.resolvedAccountId, customer.id)
  assert.equal(line.accountName, customer.accountName)
  assert.equal(line.accountLegalName, customer.accountLegalName)
})

integrationTest("WAVE0-02: create-flex for a uniquely resolved customer line creates the flex schedule under that customer account", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const accountType = await prisma.accountType.findFirst({ where: { tenantId: ctx.tenantId } })
  assert.ok(accountType, "Expected seeded account type")

  const customer = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "Win-Tech",
      accountLegalName: "Win-Tech, Inc.",
    },
    select: { id: true, accountLegalName: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-04-01T00:00:00Z"),
      depositName: "Wave 0 Flex Deposit",
      paymentDate: new Date("2026-04-06T00:00:00Z"),
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      status: "InReview",
      createdByUserId: ctx.userId,
    },
    select: { id: true },
  })

  const line = await prisma.depositLineItem.create({
    data: {
      tenantId: ctx.tenantId,
      depositId: deposit.id,
      lineNumber: 1,
      status: "Unmatched",
      paymentDate: new Date("2026-04-06T00:00:00Z"),
      usage: 190,
      usageAllocated: 0,
      usageUnallocated: 190,
      commission: 30.4,
      commissionAllocated: 0,
      commissionUnallocated: 30.4,
      vendorAccountId: ctx.vendorAccountId,
      accountNameRaw: customer.accountLegalName,
      vendorNameRaw: "ACC Business",
      distributorNameRaw: "Telarus",
      productNameRaw: "HSIA Internet Access",
    },
    select: { id: true },
  })

  const routeModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/create-flex/route"
  )
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const response = await POST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/create-flex`,
      { kind: "FlexProduct" },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(response, 200)

  const payload = await readJson<any>(response)
  const createdScheduleId = payload?.data?.createdRevenueScheduleIds?.[0]
  assert.ok(createdScheduleId)

  const schedule = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: createdScheduleId },
    select: { accountId: true, flexClassification: true, flexReasonCode: true },
  })
  assert.ok(schedule)
  assert.equal(schedule!.accountId, customer.id)
  assert.equal(schedule!.flexClassification, "FlexProduct")
  assert.equal(schedule!.flexReasonCode, "UnknownProduct")
})

integrationTest("WAVE0-03: create-flex for a fully unknown customer line is blocked before any distributor-owned flex schedule is created", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-04-01T00:00:00Z"),
      depositName: "Wave 0 Unknown Deposit",
      paymentDate: new Date("2026-04-06T00:00:00Z"),
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      status: "InReview",
      createdByUserId: ctx.userId,
    },
    select: { id: true },
  })

  const line = await prisma.depositLineItem.create({
    data: {
      tenantId: ctx.tenantId,
      depositId: deposit.id,
      lineNumber: 1,
      status: "Unmatched",
      paymentDate: new Date("2026-04-06T00:00:00Z"),
      usage: 160,
      usageAllocated: 0,
      usageUnallocated: 160,
      commission: 27.2,
      commissionAllocated: 0,
      commissionUnallocated: 27.2,
      vendorAccountId: ctx.vendorAccountId,
      accountNameRaw: "Plan Professional",
      vendorNameRaw: "ACC Business",
      distributorNameRaw: "Telarus",
      productNameRaw: "HSIA Internet Access",
    },
    select: { id: true },
  })

  const routeModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/create-flex/route"
  )
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const response = await POST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/create-flex`,
      { kind: "FlexProduct" },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(response, 400)

  const payload = await readJson<{ error?: string }>(response)
  assert.match(payload.error ?? "", /Unable to resolve a customer account/i)

  const createdCount = await prisma.revenueSchedule.count({
    where: {
      tenantId: ctx.tenantId,
      flexSourceDepositId: deposit.id,
      flexSourceDepositLineItemId: line.id,
      deletedAt: null,
    },
  })
  assert.equal(createdCount, 0)
})
