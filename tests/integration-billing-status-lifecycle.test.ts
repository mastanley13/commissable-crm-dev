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

integrationTest("BILL-STATUS-01: apply-match keeps billingStatus Open until finalize, then Reconciled", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-BS-1",
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
      depositName: "Billing Status Deposit",
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

  const scheduleAfterApply = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: schedule.id },
    select: { billingStatus: true },
  })
  assert.ok(scheduleAfterApply)
  assert.equal(scheduleAfterApply!.billingStatus, "Open")

  const finalizeModule = await import("../app/api/reconciliation/deposits/[depositId]/finalize/route")
  const finalizePOST = (finalizeModule as any).POST ?? (finalizeModule as any).default?.POST
  assert.equal(typeof finalizePOST, "function")

  const finalizeOk = await finalizePOST(
    new NextRequest(`http://localhost/api/reconciliation/deposits/${deposit.id}/finalize`, {
      method: "POST",
      headers: { cookie: `session-token=${ctx.sessionToken}` },
    }),
    { params: { depositId: deposit.id } },
  )
  assertStatus(finalizeOk, 200)

  const scheduleAfterFinalize = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: schedule.id },
    select: { billingStatus: true },
  })
  assert.ok(scheduleAfterFinalize)
  assert.equal(scheduleAfterFinalize!.billingStatus, "Reconciled")
})

integrationTest("BILL-STATUS-02: resolve-flex (FlexProduct) sets base+flex schedules to InDispute", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-BS-2",
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
      depositName: "Flex Billing Status Deposit",
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
      usage: 120,
      usageAllocated: 0,
      usageUnallocated: 120,
      commission: 12,
      commissionAllocated: 0,
      commissionUnallocated: 12,
      vendorAccountId: ctx.vendorAccountId,
      accountNameRaw: "Acme Co",
      productNameRaw: "Internet",
    },
    select: { id: true },
  })

  const applyMatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route"
  )
  const applyPOST = (applyMatchModule as any).POST ?? (applyMatchModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const applyResponse = await applyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/apply-match`,
      { revenueScheduleId: schedule.id, usageAmount: 120, commissionAmount: 12, confidenceScore: 0.99 },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(applyResponse, 200)

  const resolveFlexModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/resolve-flex/route"
  )
  const resolvePOST = (resolveFlexModule as any).POST ?? (resolveFlexModule as any).default?.POST
  assert.equal(typeof resolvePOST, "function")

  const resolveResponse = await resolvePOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/resolve-flex`,
      { revenueScheduleId: schedule.id, action: "FlexProduct" },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(resolveResponse, 200)
  const resolvePayload = await readJson<any>(resolveResponse)
  assert.ok(resolvePayload?.data)

  const baseAfter = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: schedule.id },
    select: { billingStatus: true },
  })
  assert.ok(baseAfter)
  assert.equal(baseAfter!.billingStatus, "InDispute")

  const flexAfter = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, parentRevenueScheduleId: schedule.id, deletedAt: null },
    select: { billingStatus: true },
  })
  assert.ok(flexAfter)
  assert.equal(flexAfter!.billingStatus, "InDispute")
})

integrationTest("BILL-STATUS-03: chargeback approve keeps billingStatus InDispute", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Chargeback Billing Status Deposit",
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
      usage: -10,
      usageAllocated: 0,
      usageUnallocated: -10,
      commission: -10,
      commissionAllocated: 0,
      commissionUnallocated: -10,
      vendorAccountId: ctx.vendorAccountId,
      accountNameRaw: "Acme Co",
      productNameRaw: "Chargeback",
    },
    select: { id: true },
  })

  const createFlexModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/create-flex/route"
  )
  const createPOST = (createFlexModule as any).POST ?? (createFlexModule as any).default?.POST
  assert.equal(typeof createPOST, "function")

  const createResponse = await createPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/create-flex`,
      { kind: "Chargeback" },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(createResponse, 200)
  const createdPayload = await readJson<any>(createResponse)
  const createdScheduleId = createdPayload?.data?.createdRevenueScheduleIds?.[0] ?? null
  assert.ok(createdScheduleId, "Expected createdRevenueScheduleIds[0]")

  const approveFlexModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/approve-flex/route"
  )
  const approvePOST = (approveFlexModule as any).POST ?? (approveFlexModule as any).default?.POST
  assert.equal(typeof approvePOST, "function")

  const approveResponse = await approvePOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/approve-flex`,
      { revenueScheduleId: createdScheduleId },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(approveResponse, 200)

  const scheduleAfter = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: createdScheduleId },
    select: { billingStatus: true },
  })
  assert.ok(scheduleAfter)
  assert.equal(scheduleAfter!.billingStatus, "InDispute")
})

