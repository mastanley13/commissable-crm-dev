import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function authedGet(sessionToken: string, url: string) {
  return new NextRequest(url, { method: "GET", headers: { cookie: `session-token=${sessionToken}` } })
}

integrationTest("REC-AUTO: account legal name resolves customer account for candidate fetch", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const customerCorrect = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: (await prisma.accountType.findFirst({ where: { tenantId: ctx.tenantId } })).id,
      accountName: "Acme",
      accountLegalName: "Acme Co",
    },
    select: { id: true, accountLegalName: true },
  })

  const customerWrong = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: (await prisma.accountType.findFirst({ where: { tenantId: ctx.tenantId } })).id,
      accountName: "Wrong Customer",
      accountLegalName: "Wrong Customer LLC",
    },
    select: { id: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Account Legal Filter Deposit",
      paymentDate: new Date("2026-01-15T00:00:00Z"),
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
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
      paymentDate: new Date("2026-01-15T00:00:00Z"),
      usage: 100,
      usageAllocated: 0,
      usageUnallocated: 100,
      commission: 10,
      commissionAllocated: 0,
      commissionUnallocated: 10,
      vendorAccountId: ctx.vendorAccountId,
      accountNameRaw: customerCorrect.accountLegalName,
      vendorNameRaw: "Test Vendor",
      distributorNameRaw: "Test Distributor",
      productNameRaw: "Internet",
    },
    select: { id: true },
  })

  for (let i = 0; i < 35; i += 1) {
    await prisma.revenueSchedule.create({
      data: {
        tenantId: ctx.tenantId,
        accountId: customerWrong.id,
        distributorAccountId: ctx.distributorAccountId,
        vendorAccountId: ctx.vendorAccountId,
        scheduleNumber: `RS-WRONG-${i + 1}`,
        scheduleDate: new Date(`2026-01-${String(1 + (i % 20)).padStart(2, "0")}T00:00:00Z`),
        status: "Unreconciled",
        expectedUsage: 100,
        expectedCommission: 10,
      },
    })
  }

  await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: customerCorrect.id,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-CORRECT-1",
      scheduleDate: new Date("2026-01-31T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 100,
      expectedCommission: 10,
    },
  })

  await prisma.userSetting.upsert({
    where: { userId_key: { userId: ctx.userId, key: "reconciliation.suggestedMatchesMinConfidence" } },
    update: { tenantId: ctx.tenantId, value: 0 },
    create: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      key: "reconciliation.suggestedMatchesMinConfidence",
      value: 0,
      description: "Integration test",
    },
  })

  const candidatesModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route"
  )
  const GET = (candidatesModule as any).GET ?? (candidatesModule as any).default?.GET
  assert.equal(typeof GET, "function")

  const response = await GET(
    authedGet(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/candidates?useHierarchicalMatching=true&includeFutureSchedules=false`,
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )

  assertStatus(response, 200)
  const payload = await readJson<{ data?: any[] }>(response)
  assert.ok(Array.isArray(payload.data))
  assert.ok((payload.data?.length ?? 0) >= 1)
  assert.ok(payload.data!.every(row => row.legalName === customerCorrect.accountLegalName))
})
