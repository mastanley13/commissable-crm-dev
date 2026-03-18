import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"
import { formatRevenueScheduleDisplayName } from "../lib/flex/revenue-schedule-display"

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

function parseAuditPayload<T>(value: unknown): T | null {
  if (value == null) return null
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }
  if (typeof value === "object") {
    return value as T
  }
  return null
}

integrationTest("CHARGEBACK-01: negative usage + commission creates Flex Chargeback and Suggested match", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-CB-1",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      expectedUsage: 1,
      expectedCommission: 1,
    },
    select: { id: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Chargeback Deposit",
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

  const applyMatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route"
  )
  const applyPOST = (applyMatchModule as any).POST ?? (applyMatchModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const response = await applyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/apply-match`,
      { revenueScheduleId: schedule.id, usageAmount: -50, commissionAmount: -5 },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(response, 200)
  const payload = await readJson<any>(response)

  const createdScheduleId = payload?.data?.flexExecution?.createdRevenueScheduleIds?.[0]
  assert.ok(createdScheduleId)
  assert.equal(payload?.data?.flexExecution?.applied, false)
  assert.equal(payload?.data?.flexExecution?.action, "ChargebackPending")
  assert.equal(payload?.data?.match, null)

  const createdSchedule = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: createdScheduleId },
    select: { flexClassification: true, flexReasonCode: true, expectedUsage: true, expectedCommission: true },
  })
  assert.ok(createdSchedule)
  assert.equal(createdSchedule!.flexClassification, "FlexChargeback")
  assert.equal(createdSchedule!.flexReasonCode, "ChargebackNegative")
  assert.equal(Number(createdSchedule!.expectedUsage ?? 0), -50)
  assert.equal(Number(createdSchedule!.expectedCommission ?? 0), -5)

  const match = await prisma.depositLineMatch.findFirst({
    where: { tenantId: ctx.tenantId, depositLineItemId: line.id, revenueScheduleId: createdScheduleId },
    select: { status: true, source: true, usageAmount: true, commissionAmount: true },
  })
  assert.ok(match)
  assert.equal(match!.status, "Suggested")
  assert.equal(match!.source, "Auto")
  assert.equal(Number(match!.usageAmount ?? 0), -50)
  assert.equal(Number(match!.commissionAmount ?? 0), -5)

  const updatedLine = await prisma.depositLineItem.findFirst({
    where: { tenantId: ctx.tenantId, id: line.id },
    select: { status: true, usage: true, usageAllocated: true, usageUnallocated: true, commissionAllocated: true, commissionUnallocated: true },
  })
  assert.ok(updatedLine)
  assert.equal(updatedLine!.status, "Suggested")
  assert.equal(Number(updatedLine!.usage ?? 0), -50)
  assert.equal(Number(updatedLine!.usageAllocated ?? 0), 0)
  assert.equal(Number(updatedLine!.usageUnallocated ?? 0), -50)
  assert.equal(Number(updatedLine!.commissionAllocated ?? 0), 0)
  assert.equal(Number(updatedLine!.commissionUnallocated ?? 0), -5)

  const flexReviewCount = await prisma.flexReviewItem.count({
    where: { tenantId: ctx.tenantId, sourceDepositId: deposit.id, sourceDepositLineItemId: line.id },
  })
  assert.equal(flexReviewCount, 1)
})

integrationTest("CHARGEBACK-02: negative commission only normalizes usage and creates Flex Chargeback", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-CB-2",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      expectedUsage: 1,
      expectedCommission: 1,
    },
    select: { id: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Chargeback Deposit (Commission Only)",
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
      usage: 0,
      usageAllocated: 0,
      usageUnallocated: 0,
      commission: -5,
      commissionAllocated: 0,
      commissionUnallocated: -5,
      vendorAccountId: ctx.vendorAccountId,
    },
    select: { id: true },
  })

  const applyMatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route"
  )
  const applyPOST = (applyMatchModule as any).POST ?? (applyMatchModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const response = await applyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/apply-match`,
      { revenueScheduleId: schedule.id, usageAmount: 0, commissionAmount: -5 },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(response, 200)
  const payload = await readJson<any>(response)

  const createdScheduleId = payload?.data?.flexExecution?.createdRevenueScheduleIds?.[0]
  assert.ok(createdScheduleId)
  assert.equal(payload?.data?.flexExecution?.applied, false)
  assert.equal(payload?.data?.flexExecution?.action, "ChargebackPending")

  const createdSchedule = await prisma.revenueSchedule.findFirst({
    where: { tenantId: ctx.tenantId, id: createdScheduleId },
    select: { flexClassification: true, expectedUsage: true, expectedCommission: true },
  })
  assert.ok(createdSchedule)
  assert.equal(createdSchedule!.flexClassification, "FlexChargeback")
  assert.equal(Number(createdSchedule!.expectedUsage ?? 0), 5)
  assert.equal(Number(createdSchedule!.expectedCommission ?? 0), -5)

  const updatedLine = await prisma.depositLineItem.findFirst({
    where: { tenantId: ctx.tenantId, id: line.id },
    select: { status: true, usage: true, commissionRate: true, usageUnallocated: true, commissionUnallocated: true },
  })
  assert.ok(updatedLine)
  assert.equal(updatedLine!.status, "Suggested")
  assert.equal(Number(updatedLine!.usage ?? 0), 5)
  assert.equal(Number(updatedLine!.commissionRate ?? 0), 1)
  assert.equal(Number(updatedLine!.usageUnallocated ?? 0), 5)
  assert.equal(Number(updatedLine!.commissionUnallocated ?? 0), -5)
})

integrationTest("CHARGEBACK-03: chargeback reversal creates linked CB-REV history and preserves original schedule balances", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const originalSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-CB-REV-BASE",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      expectedUsage: 50,
      expectedCommission: 5,
    },
    select: { id: true, scheduleNumber: true },
  })

  const chargebackDeposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Chargeback Deposit (Reversal Flow)",
      paymentDate: new Date("2026-01-02T00:00:00Z"),
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      createdByUserId: ctx.userId,
    },
    select: { id: true },
  })

  const chargebackLine = await prisma.depositLineItem.create({
    data: {
      tenantId: ctx.tenantId,
      depositId: chargebackDeposit.id,
      lineNumber: 1,
      status: "Unmatched",
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

  const applyMatchModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route"
  )
  const applyPOST = (applyMatchModule as any).POST ?? (applyMatchModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const applyResponse = await applyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${chargebackDeposit.id}/line-items/${chargebackLine.id}/apply-match`,
      { revenueScheduleId: originalSchedule.id, usageAmount: -50, commissionAmount: -5, confidenceScore: 0.5 },
    ),
    { params: { depositId: chargebackDeposit.id, lineId: chargebackLine.id } },
  )
  assertStatus(applyResponse, 200)
  const applyPayload = await readJson<any>(applyResponse)

  const chargebackScheduleId = applyPayload?.data?.flexExecution?.createdRevenueScheduleIds?.[0]
  assert.ok(chargebackScheduleId)
  assert.equal(applyPayload?.data?.flexExecution?.action, "ChargebackPending")
  assert.equal(applyPayload?.data?.match ?? null, null)

  const approveFlexModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/approve-flex/route"
  )
  const approvePOST = (approveFlexModule as any).POST ?? (approveFlexModule as any).default?.POST
  assert.equal(typeof approvePOST, "function")

  const approveChargebackResponse = await approvePOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${chargebackDeposit.id}/line-items/${chargebackLine.id}/approve-flex`,
      { revenueScheduleId: chargebackScheduleId },
    ),
    { params: { depositId: chargebackDeposit.id, lineId: chargebackLine.id } },
  )
  assertStatus(approveChargebackResponse, 200)

  const reversalDeposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-02-01T00:00:00Z"),
      status: "InReview",
      depositName: "Chargeback Reversal Deposit",
      paymentDate: new Date("2026-02-02T00:00:00Z"),
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      createdByUserId: ctx.userId,
    },
    select: { id: true },
  })

  const reversalLine = await prisma.depositLineItem.create({
    data: {
      tenantId: ctx.tenantId,
      depositId: reversalDeposit.id,
      lineNumber: 1,
      status: "Unmatched",
      paymentDate: new Date("2026-02-02T00:00:00Z"),
      usage: 50,
      usageAllocated: 0,
      usageUnallocated: 50,
      commission: 5,
      commissionAllocated: 0,
      commissionUnallocated: 5,
      vendorAccountId: ctx.vendorAccountId,
    },
    select: { id: true },
  })

  const createFlexModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/create-flex/route"
  )
  const createPOST = (createFlexModule as any).POST ?? (createFlexModule as any).default?.POST
  assert.equal(typeof createPOST, "function")

  const createReversalResponse = await createPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${reversalDeposit.id}/line-items/${reversalLine.id}/create-flex`,
      { kind: "ChargebackReversal", attachRevenueScheduleId: chargebackScheduleId },
    ),
    { params: { depositId: reversalDeposit.id, lineId: reversalLine.id } },
  )
  assertStatus(createReversalResponse, 200)
  const createReversalPayload = await readJson<any>(createReversalResponse)

  const reversalScheduleId = createReversalPayload?.data?.createdRevenueScheduleIds?.[0]
  assert.ok(reversalScheduleId)
  assert.equal(createReversalPayload?.data?.action, "ChargebackReversalPending")

  const approveReversalResponse = await approvePOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${reversalDeposit.id}/line-items/${reversalLine.id}/approve-flex`,
      { revenueScheduleId: reversalScheduleId },
    ),
    { params: { depositId: reversalDeposit.id, lineId: reversalLine.id } },
  )
  assertStatus(approveReversalResponse, 200)

  const [originalScheduleAfter, chargebackSchedule, reversalSchedule, chargebackMatch, reversalMatch, chargebackLineAfter, reversalLineAfter] =
    await Promise.all([
      prisma.revenueSchedule.findFirst({
        where: { tenantId: ctx.tenantId, id: originalSchedule.id },
        select: { id: true, status: true, actualUsage: true, actualCommission: true },
      }),
      prisma.revenueSchedule.findFirst({
        where: { tenantId: ctx.tenantId, id: chargebackScheduleId },
        select: {
          id: true,
          scheduleNumber: true,
          parentRevenueScheduleId: true,
          flexClassification: true,
          flexReasonCode: true,
          status: true,
          actualUsage: true,
          actualCommission: true,
        },
      }),
      prisma.revenueSchedule.findFirst({
        where: { tenantId: ctx.tenantId, id: reversalScheduleId },
        select: {
          id: true,
          scheduleNumber: true,
          parentRevenueScheduleId: true,
          flexClassification: true,
          flexReasonCode: true,
          status: true,
          actualUsage: true,
          actualCommission: true,
        },
      }),
      prisma.depositLineMatch.findFirst({
        where: { tenantId: ctx.tenantId, depositLineItemId: chargebackLine.id, revenueScheduleId: chargebackScheduleId },
        select: { status: true, usageAmount: true, commissionAmount: true },
      }),
      prisma.depositLineMatch.findFirst({
        where: { tenantId: ctx.tenantId, depositLineItemId: reversalLine.id, revenueScheduleId: reversalScheduleId },
        select: { status: true, usageAmount: true, commissionAmount: true },
      }),
      prisma.depositLineItem.findFirst({
        where: { tenantId: ctx.tenantId, id: chargebackLine.id },
        select: { status: true, usageAllocated: true, usageUnallocated: true, commissionAllocated: true, commissionUnallocated: true },
      }),
      prisma.depositLineItem.findFirst({
        where: { tenantId: ctx.tenantId, id: reversalLine.id },
        select: { status: true, usageAllocated: true, usageUnallocated: true, commissionAllocated: true, commissionUnallocated: true },
      }),
    ])

  assert.ok(originalScheduleAfter)
  assert.equal(Number(originalScheduleAfter!.actualUsage ?? 0), 0)
  assert.equal(Number(originalScheduleAfter!.actualCommission ?? 0), 0)

  const originalAppliedMatchCount = await prisma.depositLineMatch.count({
    where: { tenantId: ctx.tenantId, revenueScheduleId: originalSchedule.id, status: "Applied" },
  })
  assert.equal(originalAppliedMatchCount, 0)

  assert.ok(chargebackSchedule)
  assert.equal(chargebackSchedule!.parentRevenueScheduleId, null)
  assert.equal(chargebackSchedule!.flexClassification, "FlexChargeback")
  assert.equal(chargebackSchedule!.flexReasonCode, "ChargebackNegative")
  assert.equal(chargebackSchedule!.status, "Reconciled")
  assert.equal(Number(chargebackSchedule!.actualUsage ?? 0), -50)
  assert.equal(Number(chargebackSchedule!.actualCommission ?? 0), -5)

  assert.ok(reversalSchedule)
  assert.equal(reversalSchedule!.parentRevenueScheduleId, chargebackScheduleId)
  assert.equal(reversalSchedule!.flexClassification, "FlexChargebackReversal")
  assert.equal(reversalSchedule!.flexReasonCode, "ChargebackReversal")
  assert.equal(reversalSchedule!.status, "Reconciled")
  assert.equal(Number(reversalSchedule!.actualUsage ?? 0), 50)
  assert.equal(Number(reversalSchedule!.actualCommission ?? 0), 5)

  assert.match(
    formatRevenueScheduleDisplayName({
      scheduleNumber: chargebackSchedule!.scheduleNumber,
      fallbackId: chargebackSchedule!.id,
      flexClassification: chargebackSchedule!.flexClassification,
    }),
    /-CB$/,
  )
  assert.match(
    formatRevenueScheduleDisplayName({
      scheduleNumber: reversalSchedule!.scheduleNumber,
      fallbackId: reversalSchedule!.id,
      flexClassification: reversalSchedule!.flexClassification,
    }),
    /-CB-REV$/,
  )

  assert.ok(chargebackMatch)
  assert.equal(chargebackMatch!.status, "Applied")
  assert.equal(Number(chargebackMatch!.usageAmount ?? 0), -50)
  assert.equal(Number(chargebackMatch!.commissionAmount ?? 0), -5)

  assert.ok(reversalMatch)
  assert.equal(reversalMatch!.status, "Applied")
  assert.equal(Number(reversalMatch!.usageAmount ?? 0), 50)
  assert.equal(Number(reversalMatch!.commissionAmount ?? 0), 5)

  assert.equal(chargebackLineAfter?.status, "Matched")
  assert.equal(Number(chargebackLineAfter?.usageAllocated ?? 0), -50)
  assert.equal(Number(chargebackLineAfter?.usageUnallocated ?? 0), 0)
  assert.equal(Number(chargebackLineAfter?.commissionAllocated ?? 0), -5)
  assert.equal(Number(chargebackLineAfter?.commissionUnallocated ?? 0), 0)

  assert.equal(reversalLineAfter?.status, "Matched")
  assert.equal(Number(reversalLineAfter?.usageAllocated ?? 0), 50)
  assert.equal(Number(reversalLineAfter?.usageUnallocated ?? 0), 0)
  assert.equal(Number(reversalLineAfter?.commissionAllocated ?? 0), 5)
  assert.equal(Number(reversalLineAfter?.commissionUnallocated ?? 0), 0)

  assert.equal(
    Number(chargebackSchedule!.actualUsage ?? 0) + Number(reversalSchedule!.actualUsage ?? 0),
    0,
  )
  assert.equal(
    Number(chargebackSchedule!.actualCommission ?? 0) + Number(reversalSchedule!.actualCommission ?? 0),
    0,
  )

  const flexReviewItems = await prisma.flexReviewItem.findMany({
    where: { tenantId: ctx.tenantId, revenueScheduleId: { in: [chargebackScheduleId, reversalScheduleId] } },
    select: { revenueScheduleId: true, flexClassification: true, status: true },
    orderBy: { createdAt: "asc" },
  })
  assert.equal(flexReviewItems.length, 2)
  assert.deepEqual(
    flexReviewItems.map(item => [item.revenueScheduleId, item.flexClassification]),
    [
      [chargebackScheduleId, "FlexChargeback"],
      [reversalScheduleId, "FlexChargebackReversal"],
    ],
  )

  const revenueScheduleAudits = await prisma.auditLog.findMany({
    where: {
      tenantId: ctx.tenantId,
      entityName: "RevenueSchedule",
      entityId: { in: [chargebackScheduleId, reversalScheduleId] },
    },
    select: { entityId: true, action: true, newValues: true },
    orderBy: { createdAt: "asc" },
  })

  const chargebackAudits = revenueScheduleAudits.filter(entry => entry.entityId === chargebackScheduleId)
  const reversalAudits = revenueScheduleAudits.filter(entry => entry.entityId === reversalScheduleId)

  const chargebackCreateAudit = chargebackAudits.find(entry => {
    const payload = parseAuditPayload<Record<string, unknown>>(entry.newValues)
    return entry.action === "Create" && payload?.action === "FlexCreateChargeback"
  })
  const chargebackApproveAudit = chargebackAudits.find(entry => {
    const payload = parseAuditPayload<Record<string, unknown>>(entry.newValues)
    return entry.action === "Update" && payload?.action === "ApproveFlex"
  })
  const reversalCreateAudit = reversalAudits.find(entry => {
    const payload = parseAuditPayload<Record<string, unknown>>(entry.newValues)
    return entry.action === "Create" && payload?.action === "FlexCreateChargebackReversal"
  })
  const reversalApproveAudit = reversalAudits.find(entry => {
    const payload = parseAuditPayload<Record<string, unknown>>(entry.newValues)
    return entry.action === "Update" && payload?.action === "ApproveFlex"
  })

  assert.ok(chargebackCreateAudit)
  assert.ok(chargebackApproveAudit)
  assert.ok(reversalCreateAudit)
  assert.ok(reversalApproveAudit)

  const reversalCreatePayload = parseAuditPayload<Record<string, unknown>>(reversalCreateAudit!.newValues)
  assert.equal(reversalCreatePayload?.parentChargebackScheduleId, chargebackScheduleId)
})
