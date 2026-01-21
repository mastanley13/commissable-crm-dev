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

integrationTest("REC-AUTO-07/08/17/18/19: apply-match, unmatch, finalize, unfinalize state transitions", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-1",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      expectedUsage: 100,
      expectedCommission: 10,
    },
    select: { id: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Match Flow Deposit",
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
      productNameRaw: "Internet",
    },
    select: { id: true },
  })

  const finalizeModule = await import("../app/api/reconciliation/deposits/[depositId]/finalize/route")
  const finalizePOST = (finalizeModule as any).POST ?? (finalizeModule as any).default?.POST
  assert.equal(typeof finalizePOST, "function")

  const finalizeBlocked = await finalizePOST(
    new NextRequest(`http://localhost/api/reconciliation/deposits/${deposit.id}/finalize`, {
      method: "POST",
      headers: { cookie: `session-token=${ctx.sessionToken}` },
    }),
    { params: { depositId: deposit.id } },
  )
  assertStatus(finalizeBlocked, 400)

  const applyMatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route"
  )
  const applyPOST = (applyMatchModule as any).POST ?? (applyMatchModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const applyResponse = await applyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/apply-match`,
      { revenueScheduleId: schedule.id, usageAmount: 100, commissionAmount: 10, confidenceScore: 0.99 },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(applyResponse, 200)
  const applyPayload = await readJson<any>(applyResponse)
  assert.ok(applyPayload?.data)

  const updatedLine = await prisma.depositLineItem.findFirst({
    where: { id: line.id, tenantId: ctx.tenantId },
    select: { status: true, usageAllocated: true, usageUnallocated: true, commissionAllocated: true, commissionUnallocated: true },
  })
  assert.ok(updatedLine)
  assert.ok(["Matched", "PartiallyMatched", "Suggested"].includes(updatedLine!.status))
  assert.equal(Number(updatedLine!.usageAllocated ?? 0), 100)
  assert.equal(Number(updatedLine!.usageUnallocated ?? 0), 0)
  assert.equal(Number(updatedLine!.commissionAllocated ?? 0), 10)
  assert.equal(Number(updatedLine!.commissionUnallocated ?? 0), 0)

  const finalizeOk = await finalizePOST(
    new NextRequest(`http://localhost/api/reconciliation/deposits/${deposit.id}/finalize`, {
      method: "POST",
      headers: { cookie: `session-token=${ctx.sessionToken}` },
    }),
    { params: { depositId: deposit.id } },
  )
  assertStatus(finalizeOk, 200)

  const finalizedDeposit = await prisma.deposit.findFirst({
    where: { id: deposit.id, tenantId: ctx.tenantId },
    select: { status: true, reconciled: true, reconciledAt: true },
  })
  assert.equal(finalizedDeposit?.status, "Completed")
  assert.equal(Boolean(finalizedDeposit?.reconciled), true)
  assert.ok(finalizedDeposit?.reconciledAt)

  const reconciledLine = await prisma.depositLineItem.findFirst({
    where: { id: line.id, tenantId: ctx.tenantId },
    select: { reconciled: true, reconciledAt: true },
  })
  assert.equal(Boolean(reconciledLine?.reconciled), true)
  assert.ok(reconciledLine?.reconciledAt)

  const unfinalizeModule = await import("../app/api/reconciliation/deposits/[depositId]/unfinalize/route")
  const unfinalizePOST = (unfinalizeModule as any).POST ?? (unfinalizeModule as any).default?.POST
  assert.equal(typeof unfinalizePOST, "function")

  const unfinalizeOk = await unfinalizePOST(
    new NextRequest(`http://localhost/api/reconciliation/deposits/${deposit.id}/unfinalize`, {
      method: "POST",
      headers: { cookie: `session-token=${ctx.sessionToken}` },
    }),
    { params: { depositId: deposit.id } },
  )
  assertStatus(unfinalizeOk, 200)

  const reopenedDeposit = await prisma.deposit.findFirst({
    where: { id: deposit.id, tenantId: ctx.tenantId },
    select: { status: true, reconciled: true, reconciledAt: true },
  })
  assert.equal(reopenedDeposit?.status, "InReview")
  assert.equal(Boolean(reopenedDeposit?.reconciled), false)
  assert.equal(reopenedDeposit?.reconciledAt, null)

  const unmatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/unmatch/route"
  )
  const unmatchPOST = (unmatchModule as any).POST ?? (unmatchModule as any).default?.POST
  assert.equal(typeof unmatchPOST, "function")

  const unmatchResponse = await unmatchPOST(
    new NextRequest(`http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/unmatch`, {
      method: "POST",
      headers: { cookie: `session-token=${ctx.sessionToken}` },
    }),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(unmatchResponse, 200)

  const afterUnmatch = await prisma.depositLineItem.findFirst({
    where: { id: line.id, tenantId: ctx.tenantId },
    select: { status: true, primaryRevenueScheduleId: true, usageAllocated: true, usageUnallocated: true, commissionAllocated: true, commissionUnallocated: true },
  })
  assert.equal(afterUnmatch?.status, "Unmatched")
  assert.equal(afterUnmatch?.primaryRevenueScheduleId, null)
  assert.equal(Number(afterUnmatch?.usageAllocated ?? 0), 0)
  assert.equal(Number(afterUnmatch?.usageUnallocated ?? 0), 100)
  assert.equal(Number(afterUnmatch?.commissionAllocated ?? 0), 0)
  assert.equal(Number(afterUnmatch?.commissionUnallocated ?? 0), 10)

  const remainingMatches = await prisma.depositLineMatch.count({
    where: { tenantId: ctx.tenantId, depositLineItemId: line.id },
  })
  assert.equal(remainingMatches, 0)
})

