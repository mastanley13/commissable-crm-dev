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

