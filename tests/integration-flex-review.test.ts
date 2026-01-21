import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function authedGet(sessionToken: string, url: string) {
  return new NextRequest(url, { method: "GET", headers: { cookie: `session-token=${sessionToken}` } })
}

function authedPost(sessionToken: string, url: string, body?: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { cookie: `session-token=${sessionToken}`, "content-type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  })
}

integrationTest("FLEX-AUTO-01: flex review queue contract returns stable fields", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      scheduleNumber: "RS-FLEX-1",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      expectedUsage: 100,
      expectedCommission: 10,
      flexClassification: "FlexChargeback",
    },
    select: { id: true },
  })

  const item = await prisma.flexReviewItem.create({
    data: {
      tenantId: ctx.tenantId,
      revenueScheduleId: schedule.id,
      flexClassification: "FlexChargeback",
      status: "Open",
    },
    select: { id: true },
  })

  const routeModule = await import("../app/api/flex-review/route")
  const GET = (routeModule as any).GET ?? (routeModule as any).default?.GET
  assert.equal(typeof GET, "function")

  const response = await GET(authedGet(ctx.sessionToken, "http://localhost/api/flex-review"))
  assertStatus(response, 200)
  const payload = await readJson<{ data?: any[] }>(response)
  assert.ok(Array.isArray(payload.data))
  const row = payload.data!.find(r => r.id === item.id)
  assert.ok(row)
  assert.ok(row.revenueScheduleId)
  assert.equal(row.status, "Open")
  assert.equal(row.flexClassification, "FlexChargeback")
  assert.equal(typeof row.createdAt, "string")
})

integrationTest("FLEX-AUTO-02: assign persists and creates notification for assignee", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      scheduleNumber: "RS-FLEX-2",
      flexClassification: "FlexChargeback",
    },
    select: { id: true },
  })

  const item = await prisma.flexReviewItem.create({
    data: {
      tenantId: ctx.tenantId,
      revenueScheduleId: schedule.id,
      flexClassification: "FlexChargeback",
      status: "Open",
    },
    select: { id: true },
  })

  const routeModule = await import("../app/api/flex-review/[itemId]/assign/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const response = await POST(
    authedPost(ctx.sessionToken, `http://localhost/api/flex-review/${item.id}/assign`, { assignToMe: true }),
    { params: { itemId: item.id } },
  )
  assertStatus(response, 200)

  const saved = await prisma.flexReviewItem.findFirst({
    where: { tenantId: ctx.tenantId, id: item.id },
    select: { assignedToUserId: true },
  })
  assert.equal(saved?.assignedToUserId, ctx.userId)

  const notificationCount = await prisma.notification.count({
    where: { tenantId: ctx.tenantId, userId: ctx.userId },
  })
  assert.equal(notificationCount, 1)
})

integrationTest("FLEX-AUTO-03: approve-and-apply upgrades Suggested match to Applied and marks item Approved", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      scheduleNumber: "RS-FLEX-3",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      expectedUsage: 50,
      expectedCommission: 5,
      flexClassification: "FlexChargeback",
    },
    select: { id: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Flex Approval Deposit",
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
      status: "Suggested",
      paymentDate: new Date("2026-01-02T00:00:00Z"),
      usage: -50,
      usageAllocated: 0,
      usageUnallocated: -50,
      commission: -5,
      commissionAllocated: 0,
      commissionUnallocated: -5,
      vendorAccountId: ctx.vendorAccountId,
    },
    select: { id: true },
  })

  const match = await prisma.depositLineMatch.create({
    data: {
      tenantId: ctx.tenantId,
      depositLineItemId: line.id,
      revenueScheduleId: schedule.id,
      usageAmount: -50,
      commissionAmount: -5,
      status: "Suggested",
      source: "Manual",
      confidenceScore: 0.5,
    },
    select: { id: true },
  })

  const item = await prisma.flexReviewItem.create({
    data: {
      tenantId: ctx.tenantId,
      revenueScheduleId: schedule.id,
      flexClassification: "FlexChargeback",
      flexReasonCode: "ChargebackNegative",
      status: "Open",
      sourceDepositId: deposit.id,
      sourceDepositLineItemId: line.id,
    },
    select: { id: true },
  })

  const routeModule = await import("../app/api/flex-review/[itemId]/approve-and-apply/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const response = await POST(
    authedPost(ctx.sessionToken, `http://localhost/api/flex-review/${item.id}/approve-and-apply`),
    { params: { itemId: item.id } },
  )
  assertStatus(response, 200)
  const payload = await readJson<{ data?: any }>(response)
  assert.equal(payload.data?.item?.status, "Approved")
  assert.equal(Boolean(payload.data?.applied), true)

  const updatedMatch = await prisma.depositLineMatch.findFirst({
    where: { tenantId: ctx.tenantId, id: match.id },
    select: { status: true },
  })
  assert.equal(updatedMatch?.status, "Applied")
})

