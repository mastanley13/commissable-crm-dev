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

async function seedBasicMatchScenario(prisma: any, ctx: any, params: {
  usage: number
  commission: number
  expectedUsage: number
  expectedCommission: number
  scheduleDate?: string
  productId?: string | null
}) {
  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Unmatch Regression Deposit",
      paymentDate: new Date("2026-01-02T00:00:00Z"),
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      createdByUserId: ctx.userId,
    },
    select: { id: true },
  })

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      productId: params.productId ?? undefined,
      scheduleNumber: `RS-${Date.now()}-${Math.random()}`,
      scheduleDate: new Date(params.scheduleDate ?? "2026-01-01T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: params.expectedUsage,
      expectedCommission: params.expectedCommission,
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
      accountNameRaw: "Acme Co",
      productNameRaw: "Internet",
    },
    select: { id: true },
  })

  return {
    depositId: deposit.id,
    scheduleId: schedule.id,
    lineId: line.id,
  }
}

integrationTest("REC-UNMATCH-01: within-tolerance adjustments are rolled back on unmatch", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await prisma.systemSetting.upsert({
    where: { tenantId_key: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance" } },
    update: { value: 0.1 },
    create: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance", value: 0.1, scope: "Tenant" },
  })

  const { depositId, scheduleId, lineId } = await seedBasicMatchScenario(prisma, ctx, {
    usage: 105,
    commission: 10,
    expectedUsage: 100,
    expectedCommission: 10,
  })

  const applyMatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route"
  )
  const applyPOST = (applyMatchModule as any).POST ?? (applyMatchModule as any).default?.POST

  const applyResponse = await applyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/apply-match`,
      { revenueScheduleId: scheduleId, usageAmount: 105, commissionAmount: 10, confidenceScore: 0.9 },
    ),
    { params: { depositId, lineId } },
  )
  assertStatus(applyResponse, 200)

  const afterApply = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: scheduleId },
    select: { usageAdjustment: true, expectedCommissionAdjustment: true },
  })
  assert.equal(Number(afterApply?.usageAdjustment ?? 0), 5)
  assert.equal(Number(afterApply?.expectedCommissionAdjustment ?? 0), 0)

  const unmatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route"
  )
  const unmatchPOST = (unmatchModule as any).POST ?? (unmatchModule as any).default?.POST

  const unmatchResponse = await unmatchPOST(
    new NextRequest(`http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/unmatch`, {
      method: "POST",
      headers: { cookie: `session-token=${ctx.sessionToken}` },
    }),
    { params: { depositId, lineId } },
  )
  assertStatus(unmatchResponse, 200)

  const afterUnmatch = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: scheduleId },
    select: {
      usageAdjustment: true,
      expectedCommissionAdjustment: true,
      actualUsage: true,
      actualCommission: true,
    },
  })
  assert.equal(afterUnmatch?.usageAdjustment, null)
  assert.equal(afterUnmatch?.expectedCommissionAdjustment, null)
  assert.equal(Number(afterUnmatch?.actualUsage ?? 0), 0)
  assert.equal(Number(afterUnmatch?.actualCommission ?? 0), 0)
})

integrationTest("REC-UNMATCH-02: apply-to-future adjustments are rolled back on unmatch", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await prisma.systemSetting.upsert({
    where: { tenantId_key: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance" } },
    update: { value: 0.1 },
    create: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance", value: 0.1, scope: "Tenant" },
  })

  const product = await prisma.product.create({
    data: {
      tenantId: ctx.tenantId,
      productCode: "UNMATCH-FUTURE",
      productNameHouse: "Unmatch Future Product",
      revenueType: "Recurring",
      vendorAccountId: ctx.vendorAccountId,
      distributorAccountId: ctx.distributorAccountId,
    },
    select: { id: true },
  })

  const { depositId, scheduleId, lineId } = await seedBasicMatchScenario(prisma, ctx, {
    usage: 105,
    commission: 10,
    expectedUsage: 100,
    expectedCommission: 10,
    productId: product.id,
  })

  const futureSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      productId: product.id,
      scheduleNumber: "RS-FUTURE-UNMATCH",
      scheduleDate: new Date("2026-02-01T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 100,
      expectedCommission: 10,
    },
    select: { id: true },
  })

  const applyMatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route"
  )
  const applyPOST = (applyMatchModule as any).POST ?? (applyMatchModule as any).default?.POST

  const applyResponse = await applyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/apply-match`,
      { revenueScheduleId: scheduleId, usageAmount: 105, commissionAmount: 10, confidenceScore: 0.8 },
    ),
    { params: { depositId, lineId } },
  )
  assertStatus(applyResponse, 200)

  const futureApplyModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/within-tolerance/apply-to-future/route"
  )
  const futureApplyPOST = (futureApplyModule as any).POST ?? (futureApplyModule as any).default?.POST

  const futureApplyResponse = await futureApplyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/within-tolerance/apply-to-future`,
      { revenueScheduleId: scheduleId, usageDelta: 5, commissionDelta: 0 },
    ),
    { params: { depositId, lineId } },
  )
  assertStatus(futureApplyResponse, 200)

  const futureAfterApply = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: futureSchedule.id },
    select: { usageAdjustment: true, expectedCommissionAdjustment: true },
  })
  assert.equal(Number(futureAfterApply?.usageAdjustment ?? 0), 5)
  assert.equal(Number(futureAfterApply?.expectedCommissionAdjustment ?? 0), 0)

  const unmatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route"
  )
  const unmatchPOST = (unmatchModule as any).POST ?? (unmatchModule as any).default?.POST

  const unmatchResponse = await unmatchPOST(
    new NextRequest(`http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/unmatch`, {
      method: "POST",
      headers: { cookie: `session-token=${ctx.sessionToken}` },
    }),
    { params: { depositId, lineId } },
  )
  assertStatus(unmatchResponse, 200)

  const futureAfterUnmatch = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: futureSchedule.id },
    select: { usageAdjustment: true, expectedCommissionAdjustment: true },
  })
  assert.equal(futureAfterUnmatch?.usageAdjustment, null)
  assert.equal(futureAfterUnmatch?.expectedCommissionAdjustment, null)
})

integrationTest("REC-UNMATCH-03: unmatch is blocked while the deposit is finalized", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const { depositId, scheduleId, lineId } = await seedBasicMatchScenario(prisma, ctx, {
    usage: 100,
    commission: 10,
    expectedUsage: 100,
    expectedCommission: 10,
  })

  const applyMatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route"
  )
  const applyPOST = (applyMatchModule as any).POST ?? (applyMatchModule as any).default?.POST

  const applyResponse = await applyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/apply-match`,
      { revenueScheduleId: scheduleId, usageAmount: 100, commissionAmount: 10, confidenceScore: 0.99 },
    ),
    { params: { depositId, lineId } },
  )
  assertStatus(applyResponse, 200)

  const finalizeModule = await import("../app/api/reconciliation/deposits/[depositId]/finalize/route")
  const finalizePOST = (finalizeModule as any).POST ?? (finalizeModule as any).default?.POST

  const finalizeResponse = await finalizePOST(
    new NextRequest(`http://localhost/api/reconciliation/deposits/${depositId}/finalize`, {
      method: "POST",
      headers: { cookie: `session-token=${ctx.sessionToken}` },
    }),
    { params: { depositId } },
  )
  assertStatus(finalizeResponse, 200)

  const unmatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route"
  )
  const unmatchPOST = (unmatchModule as any).POST ?? (unmatchModule as any).default?.POST

  const unmatchResponse = await unmatchPOST(
    new NextRequest(`http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/unmatch`, {
      method: "POST",
      headers: { cookie: `session-token=${ctx.sessionToken}` },
    }),
    { params: { depositId, lineId } },
  )
  assertStatus(unmatchResponse, 400)

  const remainingMatches = await prisma.depositLineMatch.count({
    where: { tenantId: ctx.tenantId, depositLineItemId: lineId },
  })
  assert.equal(remainingMatches, 1)
})

integrationTest("REC-UNMATCH-04: bulk unmatch removes suggested flex matches and restores normalized line state", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await prisma.systemSetting.upsert({
    where: { tenantId_key: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance" } },
    update: { value: 0.1 },
    create: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance", value: 0.1, scope: "Tenant" },
  })

  const { depositId, scheduleId, lineId } = await seedBasicMatchScenario(prisma, ctx, {
    usage: 0,
    commission: -5,
    expectedUsage: 5,
    expectedCommission: 5,
  })

  const applyMatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route"
  )
  const applyPOST = (applyMatchModule as any).POST ?? (applyMatchModule as any).default?.POST

  const applyResponse = await applyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/apply-match`,
      { revenueScheduleId: scheduleId, usageAmount: 0, commissionAmount: -5, confidenceScore: 0.5 },
    ),
    { params: { depositId, lineId } },
  )
  assertStatus(applyResponse, 200)
  const applyPayload = await readJson<any>(applyResponse)
  assert.equal(applyPayload?.data?.match ?? null, null)

  const createdFlex = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, flexSourceDepositLineItemId: lineId, deletedAt: null },
    select: { id: true, deletedAt: true },
  })
  assert.ok(createdFlex?.id)

  const bulkUnmatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/bulk/unmatch-allocations/route"
  )
  const bulkUnmatchPOST = (bulkUnmatchModule as any).POST ?? (bulkUnmatchModule as any).default?.POST

  const bulkUnmatchResponse = await bulkUnmatchPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${depositId}/bulk/unmatch-allocations`,
      { lineItemIds: [lineId], revenueScheduleIds: [createdFlex!.id] },
    ),
    { params: { depositId } },
  )
  assertStatus(bulkUnmatchResponse, 200)

  const updatedLine = await prisma.depositLineItem.findFirst({
    where: { tenantId: ctx.tenantId, id: lineId },
    select: { usage: true, commissionRate: true, status: true },
  })
  assert.equal(Number(updatedLine?.usage ?? 0), 0)
  assert.equal(updatedLine?.commissionRate, null)
  assert.equal(updatedLine?.status, "Unmatched")

  const deletedFlex = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: createdFlex!.id },
    select: { deletedAt: true },
  })
  assert.ok(deletedFlex?.deletedAt)

  const reviewItem = await prisma.flexReviewItem.findFirst({
    where: { tenantId: ctx.tenantId, revenueScheduleId: createdFlex!.id },
    select: { status: true, resolvedAt: true },
  })
  assert.equal(reviewItem?.status, "Resolved")
  assert.ok(reviewItem?.resolvedAt)
})

integrationTest("REC-UNMATCH-05: line-level unmatch retires flex schedules created from overage splits", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await prisma.systemSetting.upsert({
    where: { tenantId_key: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance" } },
    update: { value: 0.01 },
    create: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance", value: 0.01, scope: "Tenant" },
  })

  const { depositId, scheduleId, lineId } = await seedBasicMatchScenario(prisma, ctx, {
    usage: 130,
    commission: 10,
    expectedUsage: 100,
    expectedCommission: 10,
  })

  const applyMatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route"
  )
  const applyPOST = (applyMatchModule as any).POST ?? (applyMatchModule as any).default?.POST

  const applyResponse = await applyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/apply-match`,
      { revenueScheduleId: scheduleId, usageAmount: 130, commissionAmount: 10, confidenceScore: 0.7 },
    ),
    { params: { depositId, lineId } },
  )
  assertStatus(applyResponse, 200)

  const resolveModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/resolve-flex/route"
  )
  const resolvePOST = (resolveModule as any).POST ?? (resolveModule as any).default?.POST

  const resolveResponse = await resolvePOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/resolve-flex`,
      { revenueScheduleId: scheduleId, action: "Adjust", applyToFuture: false },
    ),
    { params: { depositId, lineId } },
  )
  assertStatus(resolveResponse, 200)

  const createdFlex = await prisma.revenueSchedule.findFirst({
    where: {
      tenantId: ctx.tenantId,
      flexSourceDepositLineItemId: lineId,
      parentRevenueScheduleId: null,
      deletedAt: null,
      id: { not: scheduleId },
    },
    select: { id: true },
  })
  assert.ok(createdFlex?.id)

  const unmatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route"
  )
  const unmatchPOST = (unmatchModule as any).POST ?? (unmatchModule as any).default?.POST

  const unmatchResponse = await unmatchPOST(
    new NextRequest(`http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/unmatch`, {
      method: "POST",
      headers: { cookie: `session-token=${ctx.sessionToken}` },
    }),
    { params: { depositId, lineId } },
  )
  assertStatus(unmatchResponse, 200)

  const retiredFlex = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: createdFlex!.id },
    select: { deletedAt: true },
  })
  assert.ok(retiredFlex?.deletedAt)
})

integrationTest("REC-UNMATCH-06: bulk unmatch cleans up matches tied to soft-deleted schedules", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const { depositId, scheduleId, lineId } = await seedBasicMatchScenario(prisma, ctx, {
    usage: 100,
    commission: 10,
    expectedUsage: 100,
    expectedCommission: 10,
  })

  const applyMatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route"
  )
  const applyPOST = (applyMatchModule as any).POST ?? (applyMatchModule as any).default?.POST

  const applyResponse = await applyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${depositId}/line-items/${lineId}/apply-match`,
      { revenueScheduleId: scheduleId, usageAmount: 100, commissionAmount: 10, confidenceScore: 0.99 },
    ),
    { params: { depositId, lineId } },
  )
  assertStatus(applyResponse, 200)

  await prisma.revenueSchedule.update({
    where: { id: scheduleId },
    data: { deletedAt: new Date("2026-03-09T00:00:00Z") },
  })

  const bulkUnmatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/bulk/unmatch-allocations/route"
  )
  const bulkUnmatchPOST = (bulkUnmatchModule as any).POST ?? (bulkUnmatchModule as any).default?.POST

  const bulkUnmatchResponse = await bulkUnmatchPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${depositId}/bulk/unmatch-allocations`,
      { lineItemIds: [lineId], revenueScheduleIds: [scheduleId] },
    ),
    { params: { depositId } },
  )
  assertStatus(bulkUnmatchResponse, 200)

  const remainingMatches = await prisma.depositLineMatch.count({
    where: { tenantId: ctx.tenantId, depositLineItemId: lineId, revenueScheduleId: scheduleId },
  })
  assert.equal(remainingMatches, 0)

  const line = await prisma.depositLineItem.findFirst({
    where: { tenantId: ctx.tenantId, id: lineId },
    select: {
      status: true,
      usageAllocated: true,
      usageUnallocated: true,
      commissionAllocated: true,
      commissionUnallocated: true,
    },
  })
  assert.equal(line?.status, "Unmatched")
  assert.equal(Number(line?.usageAllocated ?? 0), 0)
  assert.equal(Number(line?.usageUnallocated ?? 0), 100)
  assert.equal(Number(line?.commissionAllocated ?? 0), 0)
  assert.equal(Number(line?.commissionUnallocated ?? 0), 10)
})
