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

integrationTest("REC-RATE-02A: preview and apply surface a material rate discrepancy even when usage overage also prompts", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await upsertReconciliationSettings(prisma, ctx.tenantId, {
    varianceTolerance: 0,
    rateDiscrepancyTolerancePercent: 0.05,
  })

  const scenario = await seedRateDiscrepancyScenario(prisma, ctx, {
    lineUsage: 110,
    lineCommission: 17.6,
    expectedRatePercent: 14,
  })

  const previewModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/match-issues-preview/route"
  )
  const previewPOST = (previewModule as any).POST ?? (previewModule as any).default?.POST

  const previewResponse = await previewPOST(
    authedPost(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${scenario.depositId}/line-items/${scenario.lineId}/match-issues-preview`,
      { revenueScheduleId: scenario.baseScheduleId, usageAmount: 110, commissionAmount: 17.6 },
    ),
    { params: { depositId: scenario.depositId, lineId: scenario.lineId } },
  )

  assertStatus(previewResponse, 200)
  const previewPayload = await readJson<any>(previewResponse)
  assert.equal(previewPayload?.data?.requiresConfirmation, true)
  assert.equal(previewPayload?.data?.flexDecision?.action, "prompt")
  assert.equal(previewPayload?.data?.rateDiscrepancy?.expectedRatePercent, 14)
  assert.equal(previewPayload?.data?.rateDiscrepancy?.receivedRatePercent, 16)
  assert.equal(previewPayload?.data?.rateDiscrepancy?.differencePercent, 2)

  const applyModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route")
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST

  const applyResponse = await applyPOST(
    authedPost(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${scenario.depositId}/line-items/${scenario.lineId}/apply-match`,
      { revenueScheduleId: scenario.baseScheduleId, usageAmount: 110, commissionAmount: 17.6 },
    ),
    { params: { depositId: scenario.depositId, lineId: scenario.lineId } },
  )

  assertStatus(applyResponse, 200)
  const applyPayload = await readJson<any>(applyResponse)
  assert.equal(applyPayload?.data?.flexDecision?.action, "prompt")
  assert.equal(applyPayload?.data?.rateDiscrepancy?.expectedRatePercent, 14)
  assert.equal(applyPayload?.data?.rateDiscrepancy?.receivedRatePercent, 16)
  assert.equal(applyPayload?.data?.rateDiscrepancy?.differencePercent, 2)
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

integrationTest("REC-RATE-04/05: updating current and future schedules applies the received rate atomically and audits it", async ctx => {
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
  assert.equal(ratePayload?.data?.currentUpdate?.updatedScheduleId, scenario.baseScheduleId)
  assert.ok(Array.isArray(ratePayload?.data?.futureUpdate?.updatedScheduleIds))
  assert.ok(ratePayload.data.futureUpdate.updatedScheduleIds.includes(scenario.futureScheduleId))
  assert.ok(!ratePayload.data.futureUpdate.updatedScheduleIds.includes(scenario.reconciledFutureScheduleId))
  assert.ok(!ratePayload.data.futureUpdate.updatedScheduleIds.includes(scenario.unrelatedFutureScheduleId))

  const updatedCurrent = await prisma.revenueSchedule.findFirst({
    where: { id: scenario.baseScheduleId, tenantId: ctx.tenantId },
    select: { expectedCommissionRatePercent: true, expectedCommission: true },
  })
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

  assert.equal(Number(updatedCurrent?.expectedCommissionRatePercent ?? 0), 12)
  assert.equal(Number(updatedCurrent?.expectedCommission ?? 0), 12)
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

integrationTest("REC-RATE-06: apply-to-future rolls back current schedule changes when a future update fails", async ctx => {
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

  await prisma.revenueSchedule.update({
    where: { id: scenario.futureScheduleId },
    data: { expectedUsage: null, expectedCommission: 10, expectedCommissionRatePercent: 10 },
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

  const rateResponse = await ratePOST(
    authedPost(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${scenario.depositId}/line-items/${scenario.lineId}/rate-discrepancy/apply-to-future`,
      { revenueScheduleId: scenario.baseScheduleId },
    ),
    { params: { depositId: scenario.depositId, lineId: scenario.lineId } },
  )
  assertStatus(rateResponse, 500)

  const currentAfterFailure = await prisma.revenueSchedule.findFirst({
    where: { id: scenario.baseScheduleId, tenantId: ctx.tenantId },
    select: { expectedCommissionRatePercent: true, expectedCommission: true },
  })
  const futureAfterFailure = await prisma.revenueSchedule.findFirst({
    where: { id: scenario.futureScheduleId, tenantId: ctx.tenantId },
    select: { expectedCommissionRatePercent: true, expectedCommission: true },
  })

  assert.equal(Number(currentAfterFailure?.expectedCommissionRatePercent ?? 0), 10)
  assert.equal(Number(currentAfterFailure?.expectedCommission ?? 0), 10)
  assert.equal(Number(futureAfterFailure?.expectedCommissionRatePercent ?? 0), 10)
  assert.equal(Number(futureAfterFailure?.expectedCommission ?? 0), 10)
})

integrationTest("REC-RATE-07: lower-rate discrepancies route to the exception workflow instead of normalizing", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await upsertReconciliationSettings(prisma, ctx.tenantId, {
    varianceTolerance: 0.01,
    rateDiscrepancyTolerancePercent: 0.05,
  })

  const scenario = await seedRateDiscrepancyScenario(prisma, ctx, {
    lineUsage: 100,
    lineCommission: 8,
  })

  const applyModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route")
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST
  const applyResponse = await applyPOST(
    authedPost(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${scenario.depositId}/line-items/${scenario.lineId}/apply-match`,
      { revenueScheduleId: scenario.baseScheduleId, usageAmount: 100, commissionAmount: 8 },
    ),
    { params: { depositId: scenario.depositId, lineId: scenario.lineId } },
  )
  assertStatus(applyResponse, 200)
  const applyPayload = await readJson<any>(applyResponse)
  assert.equal(applyPayload?.data?.rateDiscrepancy?.direction, "lower")
  assert.equal(applyPayload?.data?.commissionAmountReview?.status, "pending_rate_resolution")

  const lowRateRouteModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/rate-discrepancy/create-low-rate-exception/route"
  )
  const lowRatePOST = (lowRateRouteModule as any).POST ?? (lowRateRouteModule as any).default?.POST

  const lowRateResponse = await lowRatePOST(
    authedPost(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${scenario.depositId}/line-items/${scenario.lineId}/rate-discrepancy/create-low-rate-exception`,
      { revenueScheduleId: scenario.baseScheduleId },
    ),
    { params: { depositId: scenario.depositId, lineId: scenario.lineId } },
  )
  assertStatus(lowRateResponse, 200)
  const lowRatePayload = await readJson<any>(lowRateResponse)
  assert.equal(lowRatePayload?.data?.commissionAmountReview?.status, "routed_low_rate")
  assert.ok(typeof lowRatePayload?.data?.lowRateException?.ticketId === "string")
  assert.equal(lowRatePayload?.data?.lowRateException?.queuePath, "/reconciliation/low-rate-exceptions")

  const scheduleAfter = await prisma.revenueSchedule.findFirst({
    where: { id: scenario.baseScheduleId, tenantId: ctx.tenantId },
    select: { billingStatus: true, billingStatusReason: true },
  })
  assert.equal(scheduleAfter?.billingStatus, "InDispute")
  assert.ok(String(scheduleAfter?.billingStatusReason ?? "").startsWith("LowRateException"))

  const tickets = await prisma.ticket.findMany({
    where: {
      tenantId: ctx.tenantId,
      revenueScheduleId: scenario.baseScheduleId,
      issue: "Low-rate commission exception",
    },
    select: { id: true, status: true },
  })
  assert.equal(tickets.length, 1)
  assert.equal(tickets[0]?.status, "Open")
})

integrationTest("REC-RATE-08: apply-to-future rejects lower-rate discrepancies", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await upsertReconciliationSettings(prisma, ctx.tenantId, {
    varianceTolerance: 0.01,
    rateDiscrepancyTolerancePercent: 0.05,
  })

  const scenario = await seedRateDiscrepancyScenario(prisma, ctx, {
    lineUsage: 100,
    lineCommission: 8,
  })

  const applyModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route")
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST
  const applyResponse = await applyPOST(
    authedPost(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${scenario.depositId}/line-items/${scenario.lineId}/apply-match`,
      { revenueScheduleId: scenario.baseScheduleId, usageAmount: 100, commissionAmount: 8 },
    ),
    { params: { depositId: scenario.depositId, lineId: scenario.lineId } },
  )
  assertStatus(applyResponse, 200)

  const rateRouteModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/rate-discrepancy/apply-to-future/route"
  )
  const ratePOST = (rateRouteModule as any).POST ?? (rateRouteModule as any).default?.POST
  const rateResponse = await ratePOST(
    authedPost(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${scenario.depositId}/line-items/${scenario.lineId}/rate-discrepancy/apply-to-future`,
      { revenueScheduleId: scenario.baseScheduleId },
    ),
    { params: { depositId: scenario.depositId, lineId: scenario.lineId } },
  )

  assert.equal(rateResponse.status >= 400, true)

  const currentAfter = await prisma.revenueSchedule.findFirst({
    where: { id: scenario.baseScheduleId, tenantId: ctx.tenantId },
    select: { expectedCommissionRatePercent: true, expectedCommission: true },
  })
  const futureAfter = await prisma.revenueSchedule.findFirst({
    where: { id: scenario.futureScheduleId, tenantId: ctx.tenantId },
    select: { expectedCommissionRatePercent: true, expectedCommission: true },
  })
  assert.equal(Number(currentAfter?.expectedCommissionRatePercent ?? 0), 10)
  assert.equal(Number(currentAfter?.expectedCommission ?? 0), 10)
  assert.equal(Number(futureAfter?.expectedCommissionRatePercent ?? 0), 10)
  assert.equal(Number(futureAfter?.expectedCommission ?? 0), 10)
})
