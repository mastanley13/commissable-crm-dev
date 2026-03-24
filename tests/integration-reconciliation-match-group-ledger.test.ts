import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { assertStatus, integrationTest, readJson } from "./integration-test-helpers"

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

integrationTest("REC-GROUP-LEDGER-01: grouped match apply persists forward-adjustment metadata and ledger ids", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await prisma.systemSetting.upsert({
    where: { tenantId_key: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance" } },
    update: { value: 0.01 },
    create: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance", value: 0.01, scope: "Tenant" },
  })

  const product = await prisma.product.create({
    data: {
      tenantId: ctx.tenantId,
      productCode: "MATCH-GROUP-LEDGER",
      productNameHouse: "Match Group Ledger Product",
      revenueType: "Recurring",
      vendorAccountId: ctx.vendorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      priceEach: 100,
      commissionPercent: 10,
    },
    select: { id: true },
  })

  const opportunity = await prisma.opportunity.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      name: "Match Group Ledger Opportunity",
      distributorName: "Test Distributor",
      vendorName: "Test Vendor",
    },
    select: { id: true },
  })

  const opportunityProduct = await prisma.opportunityProduct.create({
    data: {
      tenantId: ctx.tenantId,
      opportunityId: opportunity.id,
      productId: product.id,
      quantity: 1,
      unitPrice: 100,
      expectedUsage: 100,
      expectedCommission: 10,
    },
    select: { id: true, unitPrice: true },
  })

  const baseSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      opportunityId: opportunity.id,
      opportunityProductId: opportunityProduct.id,
      productId: product.id,
      scheduleNumber: "RS-GROUP-BASE",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      expectedUsage: 100,
      expectedCommission: 10,
      status: "Unreconciled",
    },
    select: { id: true, scheduleNumber: true },
  })

  const futureSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      opportunityId: opportunity.id,
      opportunityProductId: opportunityProduct.id,
      productId: product.id,
      scheduleNumber: "RS-GROUP-FUTURE",
      scheduleDate: new Date("2026-02-01T00:00:00Z"),
      expectedUsage: 100,
      expectedCommission: 10,
      status: "Unreconciled",
    },
    select: { id: true, scheduleNumber: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Match Group Ledger Deposit",
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
      usage: 110,
      usageAllocated: 0,
      usageUnallocated: 110,
      commission: 11,
      commissionAllocated: 0,
      commissionUnallocated: 11,
      vendorAccountId: ctx.vendorAccountId,
    },
    select: { id: true },
  })

  const previewModule = await import("../app/api/reconciliation/deposits/[depositId]/matches/preview/route")
  const previewPOST = (previewModule as any).POST ?? (previewModule as any).default?.POST
  assert.equal(typeof previewPOST, "function")

  const previewResponse = await previewPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/matches/preview`,
      {
        matchType: "OneToOne",
        lineIds: [line.id],
        scheduleIds: [baseSchedule.id],
        allocations: [{ lineId: line.id, scheduleId: baseSchedule.id, usageAmount: 110, commissionAmount: 11 }],
      },
    ),
    { params: { depositId: deposit.id } },
  )
  assertStatus(previewResponse, 200)
  const previewPayload = await readJson<any>(previewResponse)
  assert.equal(previewPayload?.data?.ok, true)
  assert.equal(previewPayload?.data?.variancePrompts?.length, 1)
  assert.deepEqual(previewPayload.data.variancePrompts[0].allowedPromptOptions, [
    "AdjustCurrent",
    "AdjustCurrentAndFuture",
    "FlexChild",
  ])
  assert.equal(previewPayload.data.variancePrompts[0].nextFutureScheduleNumber, futureSchedule.scheduleNumber)

  const applyModule = await import("../app/api/reconciliation/deposits/[depositId]/matches/apply/route")
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const applyResponse = await applyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/matches/apply`,
      {
        matchType: "OneToOne",
        lineIds: [line.id],
        scheduleIds: [baseSchedule.id],
        allocations: [{ lineId: line.id, scheduleId: baseSchedule.id, usageAmount: 110, commissionAmount: 11 }],
        varianceResolutions: [{ scheduleId: baseSchedule.id, action: "AdjustCurrentAndFuture" }],
      },
    ),
    { params: { depositId: deposit.id } },
  )
  assertStatus(applyResponse, 200)
  const applyPayload = await readJson<any>(applyResponse)
  assert.equal(applyPayload?.data?.resolutionType, "adjustment_forward")
  assert.equal(applyPayload?.data?.createdAdjustmentIds?.length, 2)
  assert.deepEqual(
    [...(applyPayload?.data?.affectedRevenueScheduleIds ?? [])].sort(),
    [baseSchedule.id, futureSchedule.id].sort(),
  )

  const matchGroup = await prisma.depositMatchGroup.findFirst({
    where: { tenantId: ctx.tenantId, depositId: deposit.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      resolutionType: true,
      createdAdjustmentIds: true,
      affectedRevenueScheduleIds: true,
    },
  })
  assert.ok(matchGroup?.id)
  assert.equal(matchGroup?.resolutionType, "adjustment_forward")
  assert.deepEqual(
    [...(((matchGroup?.createdAdjustmentIds as string[] | null) ?? []))].sort(),
    [...(applyPayload?.data?.createdAdjustmentIds ?? [])].sort(),
  )
  assert.deepEqual(
    [...(((matchGroup?.affectedRevenueScheduleIds as string[] | null) ?? []))].sort(),
    [baseSchedule.id, futureSchedule.id].sort(),
  )

  const adjustments = await (prisma as any).revenueScheduleAdjustment.findMany({
    where: { tenantId: ctx.tenantId, matchGroupId: matchGroup.id },
    select: {
      revenueScheduleId: true,
      adjustmentType: true,
      applicationScope: true,
      usageAmount: true,
      commissionAmount: true,
    },
    orderBy: [{ effectiveScheduleDate: "asc" }, { revenueScheduleId: "asc" }],
  })
  assert.equal(adjustments.length, 2)
  assert.deepEqual(
    adjustments.map((row: any) => row.revenueScheduleId).sort(),
    [baseSchedule.id, futureSchedule.id].sort(),
  )
  assert.ok(
    adjustments.some((row: any) => row.revenueScheduleId === baseSchedule.id && row.applicationScope === "this_schedule_only"),
  )
  assert.ok(
    adjustments.some(
      (row: any) => row.revenueScheduleId === futureSchedule.id && row.applicationScope === "forward_adjustment",
    ),
  )
  assert.ok(adjustments.every((row: any) => Number(row.usageAmount ?? 0) === 10))
  assert.ok(adjustments.every((row: any) => Number(row.commissionAmount ?? 0) === 1))

  const updatedOpportunityProduct = await prisma.opportunityProduct.findFirst({
    where: { id: opportunityProduct.id },
    select: { unitPrice: true },
  })
  assert.equal(Number(updatedOpportunityProduct?.unitPrice ?? 0), Number(opportunityProduct.unitPrice ?? 0))
})
