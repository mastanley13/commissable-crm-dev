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

async function seedBundleScenario(prisma: any, ctx: any) {
  const baseProduct = await prisma.product.create({
    data: {
      tenantId: ctx.tenantId,
      productCode: `BASE-${Date.now()}`,
      productNameHouse: "Bundle Base Product",
      productNameVendor: "Bundle Base Product",
      revenueType: "Recurring",
      commissionPercent: 10,
      vendorAccountId: ctx.vendorAccountId,
      distributorAccountId: ctx.distributorAccountId,
    },
    select: { id: true, productCode: true, productNameHouse: true, productNameVendor: true, revenueType: true },
  })

  const opportunity = await prisma.opportunity.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      name: `Bundle Opportunity ${Date.now()}`,
    },
    select: { id: true },
  })

  const opportunityProduct = await prisma.opportunityProduct.create({
    data: {
      tenantId: ctx.tenantId,
      opportunityId: opportunity.id,
      productId: baseProduct.id,
      productCodeSnapshot: baseProduct.productCode,
      productNameHouseSnapshot: baseProduct.productNameHouse,
      productNameVendorSnapshot: baseProduct.productNameVendor,
      revenueTypeSnapshot: baseProduct.revenueType,
    },
    select: { id: true },
  })

  const baseDate = new Date("2026-01-01T00:00:00Z")
  const futureDate = new Date("2026-02-01T00:00:00Z")

  const baseSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-BUNDLE-BASE",
      scheduleDate: baseDate,
      expectedUsage: 200,
      expectedCommission: 20,
      opportunityId: opportunity.id,
      opportunityProductId: opportunityProduct.id,
      productId: baseProduct.id,
      status: "Unreconciled",
    },
    select: { id: true },
  })

  const futureSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-BUNDLE-FUTURE",
      scheduleDate: futureDate,
      expectedUsage: 200,
      expectedCommission: 20,
      opportunityId: opportunity.id,
      opportunityProductId: opportunityProduct.id,
      productId: baseProduct.id,
      status: "Unreconciled",
    },
    select: { id: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: baseDate,
      status: "InReview",
      depositName: `Bundle Deposit ${Date.now()}`,
      paymentDate: new Date("2026-01-02T00:00:00Z"),
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      createdByUserId: ctx.userId,
    },
    select: { id: true },
  })

  const line1 = await prisma.depositLineItem.create({
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
      productNameRaw: "Bundle Item 1",
    },
    select: { id: true },
  })

  const line2 = await prisma.depositLineItem.create({
    data: {
      tenantId: ctx.tenantId,
      depositId: deposit.id,
      lineNumber: 2,
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
      productNameRaw: "Bundle Item 2",
    },
    select: { id: true },
  })

  return { baseProduct, opportunity, opportunityProduct, baseSchedule, futureSchedule, deposit, line1, line2, baseDate }
}

integrationTest("REC-AUTO-BUNDLE-01: bundle apply is idempotent (no duplicates on retry)", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const { opportunity, opportunityProduct, baseSchedule, deposit, line1, line2 } = await seedBundleScenario(prisma, ctx)

  const routeModule = await import("../app/api/reconciliation/deposits/[depositId]/bundle-rip-replace/apply/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const url = `http://localhost/api/reconciliation/deposits/${deposit.id}/bundle-rip-replace/apply`
  const body = { lineIds: [line1.id, line2.id], revenueScheduleId: baseSchedule.id, mode: "keep_old", reason: "test" }

  const firstResponse = await POST(authedJson(ctx.sessionToken, url, body), { params: { depositId: deposit.id } })
  assertStatus(firstResponse, 200)
  const firstPayload = await readJson<any>(firstResponse)
  assert.ok(firstPayload?.data?.bundleAuditLogId)
  assert.equal(firstPayload?.data?.lineToScheduleMap?.length, 2)
  assert.equal(firstPayload?.data?.createdRevenueScheduleIds?.length, 4)

  const secondResponse = await POST(authedJson(ctx.sessionToken, url, body), { params: { depositId: deposit.id } })
  assertStatus(secondResponse, 200)
  const secondPayload = await readJson<any>(secondResponse)

  assert.equal(secondPayload?.data?.bundleAuditLogId, firstPayload?.data?.bundleAuditLogId)
  assert.deepEqual(secondPayload?.data?.createdRevenueScheduleIds, firstPayload?.data?.createdRevenueScheduleIds)

  const bundleProductCount = await prisma.product.count({
    where: { tenantId: ctx.tenantId, productCode: { startsWith: "BUNDLE_" } },
  })
  assert.equal(bundleProductCount, 2)

  const createdScheduleCount = await prisma.revenueSchedule.count({
    where: {
      tenantId: ctx.tenantId,
      opportunityId: opportunity.id,
      opportunityProductId: { not: opportunityProduct.id },
      deletedAt: null,
    },
  })
  assert.equal(createdScheduleCount, 4)

  const operationCount = await prisma.bundleOperation.count({ where: { tenantId: ctx.tenantId, depositId: deposit.id } })
  assert.equal(operationCount, 1)
})

integrationTest("REC-AUTO-BUNDLE-02: soft_delete_old blocks if any target schedule has applied matches", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const { opportunity, opportunityProduct, baseSchedule, futureSchedule, deposit, line1, line2 } = await seedBundleScenario(prisma, ctx)

  const unrelatedLine = await prisma.depositLineItem.create({
    data: {
      tenantId: ctx.tenantId,
      depositId: deposit.id,
      lineNumber: 99,
      status: "Unmatched",
      paymentDate: new Date("2026-01-02T00:00:00Z"),
      usage: 1,
      usageAllocated: 0,
      usageUnallocated: 1,
      commission: 0,
      commissionAllocated: 0,
      commissionUnallocated: 0,
      vendorAccountId: ctx.vendorAccountId,
      accountNameRaw: "Acme Co",
      productNameRaw: "Unrelated",
    },
    select: { id: true },
  })

  await prisma.depositLineMatch.create({
    data: {
      tenantId: ctx.tenantId,
      depositLineItemId: unrelatedLine.id,
      revenueScheduleId: futureSchedule.id,
      status: "Applied",
      usageAmount: 1,
      commissionAmount: 0,
      source: "Manual",
    },
    select: { id: true },
  })

  const routeModule = await import("../app/api/reconciliation/deposits/[depositId]/bundle-rip-replace/apply/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const url = `http://localhost/api/reconciliation/deposits/${deposit.id}/bundle-rip-replace/apply`
  const response = await POST(
    authedJson(ctx.sessionToken, url, {
      lineIds: [line1.id, line2.id],
      revenueScheduleId: baseSchedule.id,
      mode: "soft_delete_old",
      reason: "test",
    }),
    { params: { depositId: deposit.id } },
  )

  assertStatus(response, 409)
  const payload = await readJson<any>(response)
  assert.match(payload?.error ?? "", /cannot be safely replaced/i)

  const operationCount = await prisma.bundleOperation.count({ where: { tenantId: ctx.tenantId, depositId: deposit.id } })
  assert.equal(operationCount, 0)

  const bundleProductCount = await prisma.product.count({
    where: { tenantId: ctx.tenantId, productCode: { startsWith: "BUNDLE_" } },
  })
  assert.equal(bundleProductCount, 0)

  const createdScheduleCount = await prisma.revenueSchedule.count({
    where: {
      tenantId: ctx.tenantId,
      opportunityId: opportunity.id,
      opportunityProductId: { not: opportunityProduct.id },
      deletedAt: null,
    },
  })
  assert.equal(createdScheduleCount, 0)
})

integrationTest("REC-AUTO-BUNDLE-03: bundle apply blocks if any selected line already has applied matches", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const { baseSchedule, deposit, line1, line2 } = await seedBundleScenario(prisma, ctx)

  await prisma.depositLineMatch.create({
    data: {
      tenantId: ctx.tenantId,
      depositLineItemId: line1.id,
      revenueScheduleId: baseSchedule.id,
      status: "Applied",
      usageAmount: 10,
      commissionAmount: 1,
      source: "Manual",
    },
    select: { id: true },
  })

  const routeModule = await import("../app/api/reconciliation/deposits/[depositId]/bundle-rip-replace/apply/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const url = `http://localhost/api/reconciliation/deposits/${deposit.id}/bundle-rip-replace/apply`
  const response = await POST(
    authedJson(ctx.sessionToken, url, {
      lineIds: [line1.id, line2.id],
      revenueScheduleId: baseSchedule.id,
      mode: "keep_old",
      reason: "test",
    }),
    { params: { depositId: deposit.id } },
  )

  assertStatus(response, 409)
  const payload = await readJson<any>(response)
  assert.match(payload?.error ?? "", /already have applied allocations/i)
})

integrationTest("REC-AUTO-BUNDLE-04: undo blocks when created schedules have applied allocations", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const { baseSchedule, deposit, line1, line2 } = await seedBundleScenario(prisma, ctx)

  const applyModule = await import("../app/api/reconciliation/deposits/[depositId]/bundle-rip-replace/apply/route")
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const applyUrl = `http://localhost/api/reconciliation/deposits/${deposit.id}/bundle-rip-replace/apply`
  const applyResponse = await applyPOST(
    authedJson(ctx.sessionToken, applyUrl, {
      lineIds: [line1.id, line2.id],
      revenueScheduleId: baseSchedule.id,
      mode: "keep_old",
      reason: "test",
    }),
    { params: { depositId: deposit.id } },
  )
  assertStatus(applyResponse, 200)
  const applyPayload = await readJson<any>(applyResponse)
  const bundleAuditLogId = applyPayload?.data?.bundleAuditLogId as string | undefined
  const createdRevenueScheduleIds = applyPayload?.data?.createdRevenueScheduleIds as string[] | undefined
  assert.ok(bundleAuditLogId)
  assert.ok(Array.isArray(createdRevenueScheduleIds) && createdRevenueScheduleIds.length > 0)

  await prisma.depositLineMatch.create({
    data: {
      tenantId: ctx.tenantId,
      depositLineItemId: line1.id,
      revenueScheduleId: createdRevenueScheduleIds![0]!,
      status: "Applied",
      usageAmount: 1,
      commissionAmount: 0,
      source: "Manual",
    },
    select: { id: true },
  })

  const undoModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/bundle-rip-replace/[bundleAuditLogId]/undo/route"
  )
  const undoPOST = (undoModule as any).POST ?? (undoModule as any).default?.POST
  assert.equal(typeof undoPOST, "function")

  const undoUrl = `http://localhost/api/reconciliation/deposits/${deposit.id}/bundle-rip-replace/${bundleAuditLogId}/undo`
  const undoResponse = await undoPOST(authedJson(ctx.sessionToken, undoUrl, { reason: "test" }), {
    params: { depositId: deposit.id, bundleAuditLogId },
  })
  assertStatus(undoResponse, 409)
  const undoPayload = await readJson<any>(undoResponse)
  assert.match(undoPayload?.error ?? "", /cannot be undone safely/i)
})

