import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function authedJson(sessionToken: string, url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { cookie: `session-token=${sessionToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function seedDepositLineAndSchedule(prisma: any, ctx: any, params: { usage: number; commission: number; expectedUsage: number; expectedCommission: number }) {
  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: `RS-${Date.now()}`,
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: params.expectedUsage,
      expectedCommission: params.expectedCommission,
    },
    select: { id: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Variance Flex Deposit",
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
      usage: params.usage,
      usageAllocated: 0,
      usageUnallocated: params.usage,
      commission: params.commission,
      commissionAllocated: 0,
      commissionUnallocated: params.commission,
      vendorAccountId: ctx.vendorAccountId,
    },
    select: { id: true },
  })

  return { depositId: deposit.id, lineId: line.id, scheduleId: schedule.id }
}

integrationTest("REC-AUTO-09: auto-adjust triggers when overage is within tolerance", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await prisma.systemSetting.upsert({
    where: { tenantId_key: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance" } },
    update: { value: 0.1 },
    create: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance", value: 0.1, scope: "Tenant" },
  })

  const { depositId, lineId, scheduleId } = await seedDepositLineAndSchedule(prisma, ctx, {
    usage: 105,
    commission: 10,
    expectedUsage: 100,
    expectedCommission: 10,
  })

  const applyModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route")
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const response = await applyPOST(
    authedJson(ctx.sessionToken, `http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/apply-match`, {
      revenueScheduleId: scheduleId,
      usageAmount: 105,
      commissionAmount: 10,
      confidenceScore: 0.5,
    }),
    { params: { depositId, lineId } },
  )
  assertStatus(response, 200)
  const payload = await readJson<any>(response)
  assert.equal(payload.data?.flexDecision?.action, "auto_adjust")
  assert.ok(payload.data?.flexExecution)
  assert.ok((payload.data.flexExecution.createdRevenueScheduleIds?.length ?? 0) >= 1)
})

integrationTest("REC-AUTO-10: prompt path returns flexDecision when overage exceeds tolerance", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await prisma.systemSetting.upsert({
    where: { tenantId_key: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance" } },
    update: { value: 0.01 },
    create: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance", value: 0.01, scope: "Tenant" },
  })

  const { depositId, lineId, scheduleId } = await seedDepositLineAndSchedule(prisma, ctx, {
    usage: 130,
    commission: 10,
    expectedUsage: 100,
    expectedCommission: 10,
  })

  const applyModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route")
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const response = await applyPOST(
    authedJson(ctx.sessionToken, `http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/apply-match`, {
      revenueScheduleId: scheduleId,
      usageAmount: 130,
      commissionAmount: 10,
      confidenceScore: 0.5,
    }),
    { params: { depositId, lineId } },
  )
  assertStatus(response, 200)
  const payload = await readJson<any>(response)
  assert.equal(payload.data?.flexDecision?.action, "prompt")
  assert.equal(payload.data?.flexExecution ?? null, null)
})

integrationTest("REC-AUTO-11: negative line triggers chargeback flow and enqueues flex review", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await prisma.systemSetting.upsert({
    where: { tenantId_key: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance" } },
    update: { value: 0.1 },
    create: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance", value: 0.1, scope: "Tenant" },
  })

  const { depositId, lineId, scheduleId } = await seedDepositLineAndSchedule(prisma, ctx, {
    usage: -50,
    commission: -5,
    expectedUsage: 50,
    expectedCommission: 5,
  })

  const applyModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route")
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const response = await applyPOST(
    authedJson(ctx.sessionToken, `http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/apply-match`, {
      revenueScheduleId: scheduleId,
      usageAmount: -50,
      commissionAmount: -5,
      confidenceScore: 0.5,
    }),
    { params: { depositId, lineId } },
  )
  assertStatus(response, 200)
  const payload = await readJson<any>(response)
  assert.equal(payload.data?.match ?? null, null)
  assert.ok(payload.data?.flexExecution)

  const flexCount = await prisma.flexReviewItem.count({ where: { tenantId: ctx.tenantId } })
  assert.ok(flexCount >= 1)
})

integrationTest("REC-AUTO-12: resolve-flex (Adjust) creates adjustment split for overage", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await prisma.systemSetting.upsert({
    where: { tenantId_key: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance" } },
    update: { value: 0.01 },
    create: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance", value: 0.01, scope: "Tenant" },
  })

  const { depositId, lineId, scheduleId } = await seedDepositLineAndSchedule(prisma, ctx, {
    usage: 130,
    commission: 10,
    expectedUsage: 100,
    expectedCommission: 10,
  })

  // Apply match first (should produce prompt).
  const applyModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route")
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const applyResponse = await applyPOST(
    authedJson(ctx.sessionToken, `http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/apply-match`, {
      revenueScheduleId: scheduleId,
      usageAmount: 130,
      commissionAmount: 10,
      confidenceScore: 0.5,
    }),
    { params: { depositId, lineId } },
  )
  assertStatus(applyResponse, 200)

  const resolveModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/resolve-flex/route")
  const resolvePOST = (resolveModule as any).POST ?? (resolveModule as any).default?.POST
  assert.equal(typeof resolvePOST, "function")

  const resolveResponse = await resolvePOST(
    authedJson(ctx.sessionToken, `http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/resolve-flex`, {
      revenueScheduleId: scheduleId,
      action: "Adjust",
      applyToFuture: false,
    }),
    { params: { depositId, lineId } },
  )
  assertStatus(resolveResponse, 200)
  const resolvePayload = await readJson<any>(resolveResponse)
  assert.ok(resolvePayload.data?.flexExecution)
  assert.ok((resolvePayload.data.flexExecution.createdRevenueScheduleIds?.length ?? 0) >= 1)
})

