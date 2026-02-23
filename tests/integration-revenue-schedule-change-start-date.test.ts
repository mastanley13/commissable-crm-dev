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

integrationTest("REV-CHANGE-START-DATE: resolves productId via opportunityProduct + ignores other accounts", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const permission = await prisma.permission.upsert({
    where: { code: "revenue-schedules.manage" },
    update: {},
    create: {
      code: "revenue-schedules.manage",
      name: "Revenue Schedules Manage",
      category: "Finance",
    },
    select: { id: true },
  })

  await prisma.rolePermission.create({
    data: {
      tenantId: ctx.tenantId,
      roleId: ctx.roleId,
      permissionId: permission.id,
      grantedById: ctx.userId,
    },
    select: { id: true },
  })

  const product = await prisma.product.create({
    data: {
      tenantId: ctx.tenantId,
      productCode: `PROD-${Date.now()}`,
      productNameHouse: "Test Product",
      revenueType: "Recurring",
    },
    select: { id: true },
  })

  const opportunity = await prisma.opportunity.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      ownerId: ctx.userId,
      name: "Change Start Date Opportunity",
    },
    select: { id: true },
  })

  const opportunityProduct = await prisma.opportunityProduct.create({
    data: {
      tenantId: ctx.tenantId,
      opportunityId: opportunity.id,
      productId: product.id,
    },
    select: { id: true },
  })

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      opportunityId: opportunity.id,
      opportunityProductId: opportunityProduct.id,
      productId: null,
      scheduleNumber: "RS-CHANGE-1",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      expectedUsage: 100,
      expectedCommission: 10,
    },
    select: { id: true },
  })

  await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.vendorAccountId,
      productId: product.id,
      scheduleNumber: "RS-OTHER-ACCOUNT",
      scheduleDate: new Date("2026-02-01T00:00:00Z"),
      expectedUsage: 50,
      expectedCommission: 5,
    },
    select: { id: true },
  })

  const changeStartDateModule = await import("../app/api/revenue-schedules/bulk/change-start-date/route")
  const post = (changeStartDateModule as any).POST ?? (changeStartDateModule as any).default?.POST
  assert.equal(typeof post, "function")

  const response = await post(
    authedJson(ctx.sessionToken, "http://localhost/api/revenue-schedules/bulk/change-start-date", {
      scheduleIds: [schedule.id],
      newStartDate: "2026-02-01",
      reason: "Integration test",
    }),
  )

  assertStatus(response, 200)
  const payload = await readJson<any>(response)
  assert.equal(payload.updated, 1)
  assert.equal(payload.failed?.length ?? 0, 0)
  assert.equal(payload.deltaMonths, 1)

  const updated = await prisma.revenueSchedule.findFirst({
    where: { id: schedule.id, tenantId: ctx.tenantId },
    select: { scheduleDate: true },
  })
  assert.ok(updated?.scheduleDate)
  assert.equal(updated.scheduleDate.toISOString().slice(0, 10), "2026-02-01")
})

