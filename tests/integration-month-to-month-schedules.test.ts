import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, assertStatus, readJson } from "./integration-test-helpers"

async function seedOpportunityProductWithSchedule(
  prisma: any,
  ctx: any,
  params: {
    status: string
    lastScheduleMonth: string
    expectedUsage?: number
    expectedCommission?: number
  },
) {
  const product = await prisma.product.create({
    data: {
      tenantId: ctx.tenantId,
      productCode: `M2M-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      productNameHouse: "M2M Product",
      revenueType: "MRC_ThirdParty",
      isActive: true,
      vendorAccountId: ctx.vendorAccountId,
      distributorAccountId: ctx.distributorAccountId,
    },
    select: { id: true },
  })

  const opportunity = await prisma.opportunity.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      name: `M2M Opportunity ${Date.now()}`,
      stage: "ClosedWon_Billing",
      status: "Won",
      active: true,
      type: "Renewal",
      leadSource: "Referral",
    },
    select: { id: true },
  })

  const opportunityProduct = await prisma.opportunityProduct.create({
    data: {
      tenantId: ctx.tenantId,
      opportunityId: opportunity.id,
      productId: product.id,
      status: params.status as any,
      active: true,
      expectedUsage: params.expectedUsage ?? 100,
      expectedCommission: params.expectedCommission ?? 10,
    },
    select: { id: true },
  })

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      opportunityId: opportunity.id,
      opportunityProductId: opportunityProduct.id,
      productId: product.id,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: `RS-M2M-${Date.now()}`,
      scheduleDate: new Date(params.lastScheduleMonth),
      scheduleType: "Recurring",
      expectedUsage: params.expectedUsage ?? 100,
      expectedCommission: params.expectedCommission ?? 10,
      status: "Unreconciled",
    },
    select: { id: true },
  })

  return {
    opportunityId: opportunity.id,
    opportunityProductId: opportunityProduct.id,
    scheduleId: schedule.id,
  }
}

async function addAppliedDepositMatch(
  prisma: any,
  ctx: any,
  revenueScheduleId: string,
  depositMonthIso: string,
) {
  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date(depositMonthIso),
      status: "InReview",
      depositName: `M2M Deposit ${Date.now()}`,
      paymentDate: new Date(depositMonthIso),
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
      paymentDate: new Date(depositMonthIso),
      usage: 100,
      usageAllocated: 100,
      usageUnallocated: 0,
      commission: 10,
      commissionAllocated: 10,
      commissionUnallocated: 0,
      vendorAccountId: ctx.vendorAccountId,
    },
    select: { id: true },
  })

  await prisma.depositLineMatch.create({
    data: {
      tenantId: ctx.tenantId,
      depositLineItemId: line.id,
      revenueScheduleId,
      usageAmount: 100,
      commissionAmount: 10,
      status: "Applied",
      source: "Manual",
      confidenceScore: 1,
    },
  })
}

integrationTest("M2M-AUTO-01: creates target-month schedule and transitions ActiveBilling -> BillingM2M", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const { opportunityProductId } = await seedOpportunityProductWithSchedule(prisma, ctx, {
    status: "ActiveBilling",
    lastScheduleMonth: "2026-01-01T00:00:00Z",
  })

  const m2mModule = await import("../jobs/month-to-month-schedule-runner")
  const processMonthToMonthSchedules =
    (m2mModule as any).processMonthToMonthSchedules ?? (m2mModule as any).default?.processMonthToMonthSchedules
  assert.equal(typeof processMonthToMonthSchedules, "function")

  const result = await processMonthToMonthSchedules(new Date("2026-02-15T00:00:00Z"))
  assert.equal(result.createdCount, 1)
  assert.equal(result.transitionedToM2MCount, 1)
  assert.equal(result.transitionedToBillingEndedCount, 0)

  const createdCount = await prisma.revenueSchedule.count({
    where: {
      tenantId: ctx.tenantId,
      opportunityProductId,
      scheduleDate: new Date("2026-02-01T00:00:00Z"),
      deletedAt: null,
    },
  })
  assert.equal(createdCount, 1)

  const opportunityProduct = await prisma.opportunityProduct.findFirst({
    where: { tenantId: ctx.tenantId, id: opportunityProductId },
    select: { status: true },
  })
  assert.equal(opportunityProduct?.status, "BillingM2M")
})

integrationTest("M2M-AUTO-02: running again in the same month does not create duplicates", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const { opportunityProductId, scheduleId } = await seedOpportunityProductWithSchedule(prisma, ctx, {
    status: "ActiveBilling",
    lastScheduleMonth: "2026-01-01T00:00:00Z",
  })

  await addAppliedDepositMatch(prisma, ctx, scheduleId, "2026-01-01T00:00:00Z")

  const m2mModule = await import("../jobs/month-to-month-schedule-runner")
  const processMonthToMonthSchedules =
    (m2mModule as any).processMonthToMonthSchedules ?? (m2mModule as any).default?.processMonthToMonthSchedules

  const first = await processMonthToMonthSchedules(new Date("2026-02-05T00:00:00Z"))
  assert.equal(first.createdCount, 1)

  const second = await processMonthToMonthSchedules(new Date("2026-02-20T00:00:00Z"))
  assert.equal(second.createdCount, 0)
  assert.equal(second.skippedExistingCount >= 1, true)

  const count = await prisma.revenueSchedule.count({
    where: {
      tenantId: ctx.tenantId,
      opportunityProductId,
      scheduleDate: new Date("2026-02-01T00:00:00Z"),
      deletedAt: null,
    },
  })
  assert.equal(count, 1)
})

integrationTest("M2M-AUTO-03: BillingM2M products with no deposits transition to BillingEnded", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const { opportunityProductId } = await seedOpportunityProductWithSchedule(prisma, ctx, {
    status: "BillingM2M",
    lastScheduleMonth: "2026-01-01T00:00:00Z",
  })

  const m2mModule = await import("../jobs/month-to-month-schedule-runner")
  const processMonthToMonthSchedules =
    (m2mModule as any).processMonthToMonthSchedules ?? (m2mModule as any).default?.processMonthToMonthSchedules

  const result = await processMonthToMonthSchedules(new Date("2026-03-10T00:00:00Z"), {
    noDepositThresholdMonths: 1,
  })
  assert.equal(result.createdCount, 0)
  assert.equal(result.transitionedToBillingEndedCount, 1)

  const opportunityProduct = await prisma.opportunityProduct.findFirst({
    where: { tenantId: ctx.tenantId, id: opportunityProductId },
    select: { status: true },
  })
  assert.equal(opportunityProduct?.status, "BillingEnded")
})

integrationTest("M2M-AUTO-04: endpoint dryRun returns telemetry and does not write", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const { opportunityProductId } = await seedOpportunityProductWithSchedule(prisma, ctx, {
    status: "ActiveBilling",
    lastScheduleMonth: "2026-01-01T00:00:00Z",
  })

  process.env.JOB_SECRET = "integration-job-secret"

  const routeModule = await import("../app/api/jobs/month-to-month-schedules/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const request = new NextRequest(
    "http://localhost/api/jobs/month-to-month-schedules?date=2026-02-01&dryRun=true&noDepositThresholdMonths=2",
    {
      method: "POST",
      headers: { "x-job-secret": "integration-job-secret" },
    },
  )
  const response = await POST(request)
  assertStatus(response, 200)

  const payload = await readJson<any>(response)
  assert.equal(payload?.data?.dryRun, true)
  assert.equal(payload?.data?.createdCount, 1)
  assert.equal(payload?.data?.noDepositThresholdMonths, 2)

  const createdCount = await prisma.revenueSchedule.count({
    where: {
      tenantId: ctx.tenantId,
      opportunityProductId,
      scheduleDate: new Date("2026-02-01T00:00:00Z"),
      deletedAt: null,
    },
  })
  assert.equal(createdCount, 0)
})

