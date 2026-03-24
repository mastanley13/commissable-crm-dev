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

integrationTest("REC-MATCH-GROUP-UNDO-01: grouped flex-child undo deletes created child schedule", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await prisma.systemSetting.upsert({
    where: { tenantId_key: { tenantId: ctx.tenantId, key: "reconciliation.varianceTolerance" } },
    update: { value: 0.01 },
    create: {
      tenantId: ctx.tenantId,
      key: "reconciliation.varianceTolerance",
      value: 0.01,
      scope: "Tenant",
    },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Grouped Match Undo Deposit",
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
      scheduleNumber: "RS-GROUP-UNDO-1",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 100,
      expectedCommission: 10,
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
      usage: 130,
      usageAllocated: 0,
      usageUnallocated: 130,
      commission: 13,
      commissionAllocated: 0,
      commissionUnallocated: 13,
      vendorAccountId: ctx.vendorAccountId,
      accountNameRaw: "Acme Co",
      productNameRaw: "Internet",
    },
    select: { id: true },
  })

  const groupApplyModule = await import("../app/api/reconciliation/deposits/[depositId]/matches/apply/route")
  const groupApplyPOST = (groupApplyModule as any).POST ?? (groupApplyModule as any).default?.POST
  assert.equal(typeof groupApplyPOST, "function")

  const promptResponse = await groupApplyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/matches/apply`,
      { matchType: "OneToOne", lineIds: [line.id], scheduleIds: [schedule.id] },
    ),
    { params: { depositId: deposit.id } },
  )
  assertStatus(promptResponse, 409)
  const promptPayload = await readJson<any>(promptResponse)
  const variancePrompt = promptPayload?.data?.variancePrompts?.[0]
  assert.ok(variancePrompt, "Expected variance prompt for over-tolerance grouped match")
  assert.ok(
    Array.isArray(variancePrompt.allowedPromptOptions) &&
      variancePrompt.allowedPromptOptions.includes("FlexChild"),
    "Expected FlexChild to be offered as a grouped variance resolution",
  )

  const applyResponse = await groupApplyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/matches/apply`,
      {
        matchType: "OneToOne",
        lineIds: [line.id],
        scheduleIds: [schedule.id],
        varianceResolutions: [{ scheduleId: schedule.id, action: "FlexChild" }],
      },
    ),
    { params: { depositId: deposit.id } },
  )
  assertStatus(applyResponse, 200)
  const applyPayload = await readJson<any>(applyResponse)

  const matchGroupId = applyPayload?.data?.group?.id ?? null
  assert.ok(matchGroupId, "Expected grouped apply to return a match group id")

  const createdRevenueScheduleIds = applyPayload?.data?.resolutionArtifacts?.createdRevenueScheduleIds ?? []
  assert.equal(createdRevenueScheduleIds.length, 1)
  const childScheduleId = createdRevenueScheduleIds[0]
  assert.ok(childScheduleId)

  const groupAfterApply = await prisma.depositMatchGroup.findFirst({
    where: { tenantId: ctx.tenantId, id: matchGroupId },
    select: { createdRevenueScheduleIds: true },
  })
  assert.deepEqual(groupAfterApply?.createdRevenueScheduleIds ?? [], [childScheduleId])

  const childBeforeUndo = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: childScheduleId, deletedAt: null },
    select: { id: true, parentRevenueScheduleId: true, scheduleNumber: true },
  })
  assert.ok(childBeforeUndo)
  assert.equal(childBeforeUndo?.parentRevenueScheduleId, schedule.id)
  assert.equal(childBeforeUndo?.scheduleNumber, "RS-GROUP-UNDO-1.1")

  const undoModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/matches/[matchGroupId]/undo/route"
  )
  const undoPOST = (undoModule as any).POST ?? (undoModule as any).default?.POST
  assert.equal(typeof undoPOST, "function")

  const undoResponse = await undoPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/matches/${matchGroupId}/undo`,
      { reason: "Regression test undo" },
    ),
    { params: { depositId: deposit.id, matchGroupId } },
  )
  assertStatus(undoResponse, 200)

  const childAfterUndo = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: childScheduleId },
    select: { id: true },
  })
  assert.equal(childAfterUndo, null)

  const remainingMatches = await prisma.depositLineMatch.count({
    where: { tenantId: ctx.tenantId, matchGroupId },
  })
  assert.equal(remainingMatches, 0)
})
