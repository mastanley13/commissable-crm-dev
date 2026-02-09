import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function authedGet(sessionToken: string, url: string) {
  return new NextRequest(url, {
    method: "GET",
    headers: { cookie: `session-token=${sessionToken}` },
  })
}

integrationTest("CRM-RS-002: RS detail Revenue Type sources from product catalog (not deposits)", async (ctx) => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const product = await prisma.product.create({
    data: {
      tenantId: ctx.tenantId,
      productCode: `PROD-${Date.now()}`,
      productNameHouse: "Test Product",
      revenueType: "MRC_ThirdParty",
    },
    select: { id: true, revenueType: true },
  })

  const opportunity = await prisma.opportunity.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      name: "Test Opportunity",
    },
    select: { id: true },
  })

  const opportunityProduct = await prisma.opportunityProduct.create({
    data: {
      tenantId: ctx.tenantId,
      opportunityId: opportunity.id,
      productId: product.id,
      revenueTypeSnapshot: "NRC_PerItem",
    },
    select: { id: true },
  })

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      opportunityId: opportunity.id,
      opportunityProductId: opportunityProduct.id,
      // Intentionally omit productId to ensure we still source Revenue Type from the product catalog.
      scheduleNumber: "RS-TEST-1",
    },
    select: { id: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      paymentType: "ACH",
    },
    select: { id: true },
  })

  const depositLineItem = await prisma.depositLineItem.create({
    data: {
      tenantId: ctx.tenantId,
      depositId: deposit.id,
    },
    select: { id: true },
  })

  await prisma.depositLineMatch.create({
    data: {
      tenantId: ctx.tenantId,
      depositLineItemId: depositLineItem.id,
      revenueScheduleId: schedule.id,
      status: "Applied",
    },
    select: { id: true },
  })

  const routeModule = await import("../app/api/revenue-schedules/[revenueScheduleId]/route")
  const GET = (routeModule as any).GET ?? (routeModule as any).default?.GET
  assert.equal(typeof GET, "function")

  const response = await GET(
    authedGet(ctx.sessionToken, `http://localhost/api/revenue-schedules/${schedule.id}`),
    { params: { revenueScheduleId: schedule.id } },
  )
  assertStatus(response, 200)

  const payload = await readJson<{ data?: any }>(response)
  assert.equal(payload.data?.productRevenueType, product.revenueType)
  assert.equal(payload.data?.productRevenueTypeLabel, "MRC - 3rd Party")
  assert.equal(payload.data?.billingMonth, "2026-01-01")
  assert.notEqual(payload.data?.paymentType, "Bank Transfer")
})
