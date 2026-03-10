import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function authedPost(sessionToken: string, url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { cookie: `session-token=${sessionToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function upsertReconciliationSettings(prisma: any, tenantId: string, params: {
  varianceTolerance?: number
  rateDiscrepancyTolerancePercent?: number
}) {
  if (params.varianceTolerance != null) {
    await prisma.systemSetting.upsert({
      where: { tenantId_key: { tenantId, key: "reconciliation.varianceTolerance" } },
      update: { value: params.varianceTolerance },
      create: {
        tenantId,
        key: "reconciliation.varianceTolerance",
        value: params.varianceTolerance,
        scope: "Tenant",
      },
    })
  }

  if (params.rateDiscrepancyTolerancePercent != null) {
    await prisma.systemSetting.upsert({
      where: { tenantId_key: { tenantId, key: "reconciliation.rateDiscrepancyTolerancePercent" } },
      update: { value: params.rateDiscrepancyTolerancePercent },
      create: {
        tenantId,
        key: "reconciliation.rateDiscrepancyTolerancePercent",
        value: params.rateDiscrepancyTolerancePercent,
        scope: "Tenant",
      },
    })
  }
}

async function seedRateDiscrepancyScenario(prisma: any, ctx: any, params: {
  lineUsage: number
  lineCommission: number
  expectedRatePercent?: number
}) {
  const expectedRatePercent = params.expectedRatePercent ?? 10

  const product = await prisma.product.create({
    data: {
      tenantId: ctx.tenantId,
      productCode: `RATE-${Date.now()}`,
      productNameHouse: "Rate Discrepancy Product",
      revenueType: "Recurring",
      vendorAccountId: ctx.vendorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      commissionPercent: expectedRatePercent,
    },
    select: { id: true },
  })

  const otherProduct = await prisma.product.create({
    data: {
      tenantId: ctx.tenantId,
      productCode: `RATE-OTHER-${Date.now()}`,
      productNameHouse: "Other Product",
      revenueType: "Recurring",
      vendorAccountId: ctx.vendorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      commissionPercent: expectedRatePercent,
    },
    select: { id: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Rate Discrepancy Deposit",
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
      usage: params.lineUsage,
      usageAllocated: 0,
      usageUnallocated: params.lineUsage,
      commission: params.lineCommission,
      commissionAllocated: 0,
      commissionUnallocated: params.lineCommission,
      vendorAccountId: ctx.vendorAccountId,
    },
    select: { id: true },
  })

  const baseSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      productId: product.id,
      scheduleNumber: "RS-RATE-BASE",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 100,
      expectedCommission: 10,
      expectedCommissionRatePercent: expectedRatePercent,
    },
    select: { id: true },
  })

  const futureSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      productId: product.id,
      scheduleNumber: "RS-RATE-FUTURE",
      scheduleDate: new Date("2026-02-01T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 100,
      expectedCommission: 10,
      expectedCommissionRatePercent: expectedRatePercent,
    },
    select: { id: true },
  })

  const reconciledFutureSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      productId: product.id,
      scheduleNumber: "RS-RATE-RECONCILED",
      scheduleDate: new Date("2026-03-01T00:00:00Z"),
      status: "Reconciled",
      expectedUsage: 100,
      expectedCommission: 10,
      expectedCommissionRatePercent: expectedRatePercent,
    },
    select: { id: true },
  })

  const unrelatedFutureSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      productId: otherProduct.id,
      scheduleNumber: "RS-RATE-OTHER",
      scheduleDate: new Date("2026-02-01T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 100,
      expectedCommission: 10,
      expectedCommissionRatePercent: expectedRatePercent,
    },
    select: { id: true },
  })

  return {
    depositId: deposit.id,
    lineId: line.id,
    baseScheduleId: baseSchedule.id,
    futureScheduleId: futureSchedule.id,
    reconciledFutureScheduleId: reconciledFutureSchedule.id,
    unrelatedFutureScheduleId: unrelatedFutureSchedule.id,
  }
}

integrationTest("REC-RATE-01: apply-match does not raise a prompt when expected and received rates match", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await upsertReconciliationSettings(prisma, ctx.tenantId, {
    varianceTolerance: 0.01,
    rateDiscrepancyTolerancePercent: 0.05,
  })

  const scenario = await seedRateDiscrepancyScenario(prisma, ctx, {
    lineUsage: 100,
    lineCommission: 10,
  })

  const applyModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route")
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST

  const response = await applyPOST(
    authedPost(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${scenario.depositId}/line-items/${scenario.lineId}/apply-match`,
      { revenueScheduleId: scenario.baseScheduleId, usageAmount: 100, commissionAmount: 10 },
    ),
    { params: { depositId: scenario.depositId, lineId: scenario.lineId } },
  )

  assertStatus(response, 200)
  const payload = await readJson<any>(response)
  assert.equal(payload?.data?.rateDiscrepancy ?? null, null)
})

integrationTest("REC-RATE-02: rounding-only rate differences stay below the prompt threshold", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await upsertReconciliationSettings(prisma, ctx.tenantId, {
    varianceTolerance: 0.01,
    rateDiscrepancyTolerancePercent: 0.05,
  })

  const scenario = await seedRateDiscrepancyScenario(prisma, ctx, {
    lineUsage: 100,
    lineCommission: 10.01,
  })

  const applyModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route")
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST

  const response = await applyPOST(
    authedPost(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${scenario.depositId}/line-items/${scenario.lineId}/apply-match`,
      { revenueScheduleId: scenario.baseScheduleId, usageAmount: 100, commissionAmount: 10.01 },
    ),
    { params: { depositId: scenario.depositId, lineId: scenario.lineId } },
  )

  assertStatus(response, 200)
  const payload = await readJson<any>(response)
  assert.equal(payload?.data?.rateDiscrepancy ?? null, null)
})

integrationTest("REC-RATE-03: material rate discrepancy returns prompt data and keep-current leaves future rates unchanged", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await upsertReconciliationSettings(prisma, ctx.tenantId, {
    varianceTolerance: 0.01,
    rateDiscrepancyTolerancePercent: 0.05,
  })

  const scenario = await seedRateDiscrepancyScenario(prisma, ctx, {
    lineUsage: 100,
    lineCommission: 12,
  })

  const applyModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route")
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST

  const response = await applyPOST(
    authedPost(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${scenario.depositId}/line-items/${scenario.lineId}/apply-match`,
      { revenueScheduleId: scenario.baseScheduleId, usageAmount: 100, commissionAmount: 12 },
    ),
    { params: { depositId: scenario.depositId, lineId: scenario.lineId } },
  )

  assertStatus(response, 200)
  const payload = await readJson<any>(response)
  assert.equal(payload?.data?.rateDiscrepancy?.expectedRatePercent, 10)
  assert.equal(payload?.data?.rateDiscrepancy?.receivedRatePercent, 12)
  assert.equal(payload?.data?.rateDiscrepancy?.future?.count, 1)

  const futureAfter = await prisma.revenueSchedule.findFirst({
    where: { id: scenario.futureScheduleId, tenantId: ctx.tenantId },
    select: { expectedCommissionRatePercent: true, expectedCommission: true },
  })
  assert.equal(Number(futureAfter?.expectedCommissionRatePercent ?? 0), 10)
  assert.equal(Number(futureAfter?.expectedCommission ?? 0), 10)
})

integrationTest("REC-RATE-04/05: updating future schedules applies received rate only to future unreconciled schedules and audits it", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await upsertReconciliationSettings(prisma, ctx.tenantId, {
    varianceTolerance: 0.01,
    rateDiscrepancyTolerancePercent: 0.05,
  })

  const scenario = await seedRateDiscrepancyScenario(prisma, ctx, {
    lineUsage: 100,
    lineCommission: 12,
  })

  const applyModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route")
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST
  const applyResponse = await applyPOST(
    authedPost(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${scenario.depositId}/line-items/${scenario.lineId}/apply-match`,
      { revenueScheduleId: scenario.baseScheduleId, usageAmount: 100, commissionAmount: 12 },
    ),
    { params: { depositId: scenario.depositId, lineId: scenario.lineId } },
  )
  assertStatus(applyResponse, 200)

  const rateRouteModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/rate-discrepancy/apply-to-future/route"
  )
  const ratePOST = (rateRouteModule as any).POST ?? (rateRouteModule as any).default?.POST
  assert.equal(typeof ratePOST, "function")

  const rateResponse = await ratePOST(
    authedPost(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${scenario.depositId}/line-items/${scenario.lineId}/rate-discrepancy/apply-to-future`,
      { revenueScheduleId: scenario.baseScheduleId },
    ),
    { params: { depositId: scenario.depositId, lineId: scenario.lineId } },
  )
  assertStatus(rateResponse, 200)
  const ratePayload = await readJson<any>(rateResponse)
  assert.ok(Array.isArray(ratePayload?.data?.futureUpdate?.updatedScheduleIds))
  assert.ok(ratePayload.data.futureUpdate.updatedScheduleIds.includes(scenario.futureScheduleId))
  assert.ok(!ratePayload.data.futureUpdate.updatedScheduleIds.includes(scenario.reconciledFutureScheduleId))
  assert.ok(!ratePayload.data.futureUpdate.updatedScheduleIds.includes(scenario.unrelatedFutureScheduleId))

  const updatedFuture = await prisma.revenueSchedule.findFirst({
    where: { id: scenario.futureScheduleId, tenantId: ctx.tenantId },
    select: { expectedCommissionRatePercent: true, expectedCommission: true },
  })
  const reconciledFuture = await prisma.revenueSchedule.findFirst({
    where: { id: scenario.reconciledFutureScheduleId, tenantId: ctx.tenantId },
    select: { expectedCommissionRatePercent: true, expectedCommission: true },
  })
  const unrelatedFuture = await prisma.revenueSchedule.findFirst({
    where: { id: scenario.unrelatedFutureScheduleId, tenantId: ctx.tenantId },
    select: { expectedCommissionRatePercent: true, expectedCommission: true },
  })

  assert.equal(Number(updatedFuture?.expectedCommissionRatePercent ?? 0), 12)
  assert.equal(Number(updatedFuture?.expectedCommission ?? 0), 12)
  assert.equal(Number(reconciledFuture?.expectedCommissionRatePercent ?? 0), 10)
  assert.equal(Number(reconciledFuture?.expectedCommission ?? 0), 10)
  assert.equal(Number(unrelatedFuture?.expectedCommissionRatePercent ?? 0), 10)
  assert.equal(Number(unrelatedFuture?.expectedCommission ?? 0), 10)

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      tenantId: ctx.tenantId,
      entityName: "RevenueSchedule",
      entityId: scenario.futureScheduleId,
    },
    select: { metadata: true },
  })
  assert.ok(
    auditLogs.some((entry: any) => entry?.metadata?.action === "ApplyReceivedCommissionRateToFutureSchedule"),
  )
})
