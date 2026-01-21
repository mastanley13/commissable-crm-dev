import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function authedPost(sessionToken: string, url: string, body?: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { cookie: `session-token=${sessionToken}`, "content-type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  })
}

integrationTest("REC-AUTO-15/16: auto-match preview/apply respects user confidence threshold and persists Auto matches", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Auto Match Deposit",
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
      usage: 100,
      usageAllocated: 0,
      usageUnallocated: 100,
      commission: 10,
      commissionAllocated: 0,
      commissionUnallocated: 10,
      vendorAccountId: ctx.vendorAccountId,
      accountNameRaw: "Acme Co",
      vendorNameRaw: "Test Vendor",
      distributorNameRaw: "Test Distributor",
      productNameRaw: "Internet",
    },
    select: { id: true },
  })

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-AUTO-1",
      scheduleDate: new Date("2026-01-05T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 100,
      expectedCommission: 10,
    },
    select: { id: true },
  })

  const previewModule = await import("../app/api/reconciliation/deposits/[depositId]/auto-match/preview/route")
  const previewPOST = (previewModule as any).POST ?? (previewModule as any).default?.POST
  assert.equal(typeof previewPOST, "function")

  // Force threshold high enough that we should get zero candidates.
  await prisma.userSetting.upsert({
    where: { userId_key: { userId: ctx.userId, key: "reconciliation.autoMatchMinConfidence" } },
    update: { tenantId: ctx.tenantId, value: 1 },
    create: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      key: "reconciliation.autoMatchMinConfidence",
      value: 1,
      description: "Integration test",
    },
  })

  const previewHigh = await previewPOST(
    authedPost(ctx.sessionToken, `http://localhost/api/reconciliation/deposits/${deposit.id}/auto-match/preview`),
    { params: { depositId: deposit.id } },
  )
  assertStatus(previewHigh, 200)
  const highPayload = await readJson<any>(previewHigh)
  assert.equal(Array.isArray(highPayload.data?.autoMatchCandidates), true)
  assert.equal(highPayload.data.autoMatchCandidates.length, 0)

  // Lower threshold so any candidate is eligible.
  await prisma.userSetting.upsert({
    where: { userId_key: { userId: ctx.userId, key: "reconciliation.autoMatchMinConfidence" } },
    update: { tenantId: ctx.tenantId, value: 0 },
    create: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      key: "reconciliation.autoMatchMinConfidence",
      value: 0,
      description: "Integration test",
    },
  })

  const previewLow = await previewPOST(
    authedPost(ctx.sessionToken, `http://localhost/api/reconciliation/deposits/${deposit.id}/auto-match/preview`),
    { params: { depositId: deposit.id } },
  )
  assertStatus(previewLow, 200)
  const lowPayload = await readJson<any>(previewLow)
  assert.ok(lowPayload.data.autoMatchCandidates.length >= 1)
  assert.equal(lowPayload.data.autoMatchCandidates[0].lineId, line.id)
  assert.equal(lowPayload.data.autoMatchCandidates[0].scheduleId, schedule.id)

  const applyModule = await import("../app/api/reconciliation/deposits/[depositId]/auto-match/route")
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const applyResponse = await applyPOST(
    authedPost(ctx.sessionToken, `http://localhost/api/reconciliation/deposits/${deposit.id}/auto-match`),
    { params: { depositId: deposit.id } },
  )
  assertStatus(applyResponse, 200)

  const match = await prisma.depositLineMatch.findFirst({
    where: { tenantId: ctx.tenantId, depositLineItemId: line.id, revenueScheduleId: schedule.id },
    select: { status: true, source: true },
  })
  assert.equal(match?.status, "Applied")
  assert.equal(match?.source, "Auto")
})

