import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

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

integrationTest("CHARGEBACK-01: negative usage + commission creates Flex Chargeback and Suggested match", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-CB-1",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      expectedUsage: 1,
      expectedCommission: 1,
    },
    select: { id: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Chargeback Deposit",
      paymentDate: new Date("2026-01-02T00:00:00Z"),
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
      paymentDate: new Date("2026-01-02T00:00:00Z"),
      usage: -50,
      usageAllocated: 0,
      usageUnallocated: -50,
      commission: -5,
      commissionAllocated: 0,
      commissionUnallocated: -5,
      vendorAccountId: ctx.vendorAccountId,
    },
    select: { id: true },
  })

  const applyMatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route"
  )
  const applyPOST = (applyMatchModule as any).POST ?? (applyMatchModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const response = await applyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/apply-match`,
      { revenueScheduleId: schedule.id, usageAmount: -50, commissionAmount: -5 },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(response, 200)
  const payload = await readJson<any>(response)

  const createdScheduleId = payload?.data?.flexExecution?.createdRevenueScheduleIds?.[0]
  assert.ok(createdScheduleId)
  assert.equal(payload?.data?.flexExecution?.applied, false)
  assert.equal(payload?.data?.flexExecution?.action, "ChargebackPending")
  assert.equal(payload?.data?.match, null)

  const createdSchedule = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: createdScheduleId },
    select: { flexClassification: true, flexReasonCode: true, expectedUsage: true, expectedCommission: true },
  })
  assert.ok(createdSchedule)
  assert.equal(createdSchedule!.flexClassification, "FlexChargeback")
  assert.equal(createdSchedule!.flexReasonCode, "ChargebackNegative")
  assert.equal(Number(createdSchedule!.expectedUsage ?? 0), -50)
  assert.equal(Number(createdSchedule!.expectedCommission ?? 0), -5)

  const match = await prisma.depositLineMatch.findFirst({
    where: { tenantId: ctx.tenantId, depositLineItemId: line.id, revenueScheduleId: createdScheduleId },
    select: { status: true, source: true, usageAmount: true, commissionAmount: true },
  })
  assert.ok(match)
  assert.equal(match!.status, "Suggested")
  assert.equal(match!.source, "Auto")
  assert.equal(Number(match!.usageAmount ?? 0), -50)
  assert.equal(Number(match!.commissionAmount ?? 0), -5)

  const updatedLine = await prisma.depositLineItem.findFirst({
    where: { tenantId: ctx.tenantId, id: line.id },
    select: { status: true, usage: true, usageAllocated: true, usageUnallocated: true, commissionAllocated: true, commissionUnallocated: true },
  })
  assert.ok(updatedLine)
  assert.equal(updatedLine!.status, "Suggested")
  assert.equal(Number(updatedLine!.usage ?? 0), -50)
  assert.equal(Number(updatedLine!.usageAllocated ?? 0), 0)
  assert.equal(Number(updatedLine!.usageUnallocated ?? 0), -50)
  assert.equal(Number(updatedLine!.commissionAllocated ?? 0), 0)
  assert.equal(Number(updatedLine!.commissionUnallocated ?? 0), -5)

  const flexReviewCount = await prisma.flexReviewItem.count({
    where: { tenantId: ctx.tenantId, sourceDepositId: deposit.id, sourceDepositLineItemId: line.id },
  })
  assert.equal(flexReviewCount, 1)
})

integrationTest("CHARGEBACK-02: negative commission only normalizes usage and creates Flex Chargeback", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-CB-2",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      expectedUsage: 1,
      expectedCommission: 1,
    },
    select: { id: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Chargeback Deposit (Commission Only)",
      paymentDate: new Date("2026-01-02T00:00:00Z"),
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
      paymentDate: new Date("2026-01-02T00:00:00Z"),
      usage: 0,
      usageAllocated: 0,
      usageUnallocated: 0,
      commission: -5,
      commissionAllocated: 0,
      commissionUnallocated: -5,
      vendorAccountId: ctx.vendorAccountId,
    },
    select: { id: true },
  })

  const applyMatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route"
  )
  const applyPOST = (applyMatchModule as any).POST ?? (applyMatchModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const response = await applyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/apply-match`,
      { revenueScheduleId: schedule.id, usageAmount: 0, commissionAmount: -5 },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(response, 200)
  const payload = await readJson<any>(response)

  const createdScheduleId = payload?.data?.flexExecution?.createdRevenueScheduleIds?.[0]
  assert.ok(createdScheduleId)
  assert.equal(payload?.data?.flexExecution?.applied, false)
  assert.equal(payload?.data?.flexExecution?.action, "ChargebackPending")

  const createdSchedule = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: createdScheduleId },
    select: { flexClassification: true, expectedUsage: true, expectedCommission: true },
  })
  assert.ok(createdSchedule)
  assert.equal(createdSchedule!.flexClassification, "FlexChargeback")
  assert.equal(Number(createdSchedule!.expectedUsage ?? 0), 5)
  assert.equal(Number(createdSchedule!.expectedCommission ?? 0), -5)

  const updatedLine = await prisma.depositLineItem.findFirst({
    where: { tenantId: ctx.tenantId, id: line.id },
    select: { status: true, usage: true, commissionRate: true, usageUnallocated: true, commissionUnallocated: true },
  })
  assert.ok(updatedLine)
  assert.equal(updatedLine!.status, "Suggested")
  assert.equal(Number(updatedLine!.usage ?? 0), 5)
  assert.equal(Number(updatedLine!.commissionRate ?? 0), 1)
  assert.equal(Number(updatedLine!.usageUnallocated ?? 0), 5)
  assert.equal(Number(updatedLine!.commissionUnallocated ?? 0), -5)
})

