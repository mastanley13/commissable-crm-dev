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

integrationTest("REC-AUTO-13/14: AI adjustment preview/apply contracts (overage -> adjust + optional applyToFuture)", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const product = await prisma.product.create({
    data: {
      tenantId: ctx.tenantId,
      productCode: "TEST-PROD",
      productNameHouse: "Test Product",
      revenueType: "Recurring",
      vendorAccountId: ctx.vendorAccountId,
      distributorAccountId: ctx.distributorAccountId,
    },
    select: { id: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "AI Adjustment Deposit",
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
      status: "Matched",
      paymentDate: new Date("2026-01-02T00:00:00Z"),
      usage: 110,
      usageAllocated: 110,
      usageUnallocated: 0,
      commission: 11,
      commissionAllocated: 11,
      commissionUnallocated: 0,
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
      scheduleNumber: "RS-AI-BASE",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 100,
      expectedCommission: 10,
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
      scheduleNumber: "RS-AI-FUTURE",
      scheduleDate: new Date("2026-02-01T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 100,
      expectedCommission: 10,
    },
    select: { id: true },
  })

  await prisma.depositLineMatch.create({
    data: {
      tenantId: ctx.tenantId,
      depositLineItemId: line.id,
      revenueScheduleId: baseSchedule.id,
      usageAmount: 110,
      commissionAmount: 11,
      status: "Applied",
      source: "Manual",
      confidenceScore: 0.9,
    },
  })

  const previewModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/ai-adjustment/preview/route"
  )
  const previewPOST = (previewModule as any).POST ?? (previewModule as any).default?.POST
  assert.equal(typeof previewPOST, "function")

  const previewResponse = await previewPOST(
    authedPost(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/ai-adjustment/preview`,
      { revenueScheduleId: baseSchedule.id },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(previewResponse, 200)
  const previewPayload = await readJson<any>(previewResponse)
  assert.ok(previewPayload?.data?.suggestion)
  assert.equal(previewPayload.data.base.scheduleId, baseSchedule.id)
  assert.equal(previewPayload.data.future.count, 1)
  assert.equal(previewPayload.data.future.schedules?.[0]?.id, futureSchedule.id)

  const applyModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/ai-adjustment/apply/route"
  )
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const applyResponse = await applyPOST(
    authedPost(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/ai-adjustment/apply`,
      { revenueScheduleId: baseSchedule.id, applyToFuture: true },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(applyResponse, 200)
  const applyPayload = await readJson<any>(applyResponse)
  assert.ok(applyPayload?.data?.flexExecution)
  assert.ok(Array.isArray(applyPayload?.data?.futureUpdate?.updatedScheduleIds))
  assert.ok(applyPayload.data.futureUpdate.updatedScheduleIds.includes(futureSchedule.id))
})

integrationTest("REC-AUTO-15: absorb-overage apply uses ledger rows and preserves unit price for odd amounts", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const product = await prisma.product.create({
    data: {
      tenantId: ctx.tenantId,
      productCode: "TEST-PROD-ODD",
      productNameHouse: "Odd Amount Product",
      revenueType: "Recurring",
      vendorAccountId: ctx.vendorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      priceEach: 299.17,
      commissionPercent: 16,
    },
    select: { id: true },
  })

  const opportunity = await prisma.opportunity.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      name: "Odd Amount Opportunity",
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
      quantity: 2,
      unitPrice: 299.17,
      expectedUsage: 598.33,
      expectedCommission: 95.73,
    },
    select: { id: true, unitPrice: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Absorb Overage Ledger Deposit",
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
      status: "Matched",
      paymentDate: new Date("2026-01-02T00:00:00Z"),
      usage: 600.66,
      usageAllocated: 600.66,
      usageUnallocated: 0,
      commission: 96.10,
      commissionAllocated: 96.10,
      commissionUnallocated: 0,
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
      opportunityId: opportunity.id,
      opportunityProductId: opportunityProduct.id,
      productId: product.id,
      scheduleNumber: "RS-ABSORB-BASE",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 598.33,
      expectedCommission: 95.73,
    },
    select: { id: true },
  })

  await prisma.depositLineMatch.create({
    data: {
      tenantId: ctx.tenantId,
      depositLineItemId: line.id,
      revenueScheduleId: baseSchedule.id,
      usageAmount: 600.66,
      commissionAmount: 96.10,
      status: "Applied",
      source: "Manual",
      confidenceScore: 0.9,
    },
  })

  const applyModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/absorb-overage/apply/route"
  )
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const applyResponse = await applyPOST(
    authedPost(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/absorb-overage/apply`,
      { revenueScheduleId: baseSchedule.id, applyToFuture: false },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(applyResponse, 200)
  const applyPayload = await readJson<any>(applyResponse)
  assert.deepEqual(applyPayload?.data?.updatedScheduleIds, [baseSchedule.id])
  assert.equal(Number(applyPayload?.data?.usageOverage ?? 0), 2.33)
  assert.equal(Number(applyPayload?.data?.commissionOverage ?? 0), 0.37)
  assert.equal((applyPayload?.data?.createdAdjustmentIds?.length ?? 0), 1)

  const updatedOpportunityProduct = await prisma.opportunityProduct.findFirst({
    where: { id: opportunityProduct.id },
    select: { unitPrice: true },
  })
  assert.equal(Number(updatedOpportunityProduct?.unitPrice ?? 0), Number(opportunityProduct.unitPrice ?? 0))

  const adjustments = await (prisma as any).revenueScheduleAdjustment.findMany({
    where: { tenantId: ctx.tenantId, revenueScheduleId: baseSchedule.id },
    select: {
      id: true,
      adjustmentType: true,
      applicationScope: true,
      usageAmount: true,
      commissionAmount: true,
      sourceDepositId: true,
      sourceDepositLineItemId: true,
    },
  })
  assert.equal(adjustments.length, 1)
  assert.equal(adjustments[0].adjustmentType, "adjustment_single")
  assert.equal(adjustments[0].applicationScope, "this_schedule_only")
  assert.equal(Number(adjustments[0].usageAmount ?? 0), 2.33)
  assert.equal(Number(adjustments[0].commissionAmount ?? 0), 0.37)
  assert.equal(adjustments[0].sourceDepositId, deposit.id)
  assert.equal(adjustments[0].sourceDepositLineItemId, line.id)
})
