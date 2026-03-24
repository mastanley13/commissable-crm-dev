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

async function grantChangeStartDatePermission(prisma: any, ctx: { tenantId: string; roleId: string; userId: string }) {
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
}

async function seedProductAndChain(
  prisma: any,
  ctx: { tenantId: string; distributorAccountId: string; userId: string },
  args: { productId?: string; opportunityName: string }
) {
  const productId = args.productId ?? (await prisma.product.create({
    data: {
      tenantId: ctx.tenantId,
      productCode: `PROD-${Date.now()}-${Math.random()}`,
      productNameHouse: "Test Product",
      revenueType: "Recurring",
    },
    select: { id: true },
  })).id

  const opportunity = await prisma.opportunity.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      ownerId: ctx.userId,
      name: args.opportunityName,
    },
    select: { id: true },
  })

  const opportunityProduct = await prisma.opportunityProduct.create({
    data: {
      tenantId: ctx.tenantId,
      opportunityId: opportunity.id,
      productId,
    },
    select: { id: true },
  })

  return { productId, opportunityId: opportunity.id, opportunityProductId: opportunityProduct.id }
}

async function createSchedule(
  prisma: any,
  ctx: { tenantId: string; distributorAccountId: string },
  args: {
    opportunityId?: string | null
    opportunityProductId?: string | null
    productId?: string | null
    scheduleNumber: string
    scheduleDate: string
  }
) {
  return prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      opportunityId: args.opportunityId ?? null,
      opportunityProductId: args.opportunityProductId ?? null,
      productId: args.productId ?? null,
      scheduleNumber: args.scheduleNumber,
      scheduleDate: new Date(`${args.scheduleDate}T00:00:00.000Z`),
      expectedUsage: 100,
      expectedCommission: 10,
    },
    select: { id: true },
  })
}

integrationTest("REV-CHANGE-START-DATE: shifts by opportunity product chain and ignores same-product schedules outside that chain", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await grantChangeStartDatePermission(prisma, ctx)

  const primary = await seedProductAndChain(prisma, ctx, {
    opportunityName: "Primary Chain",
  })
  const secondary = await seedProductAndChain(prisma, ctx, {
    productId: primary.productId,
    opportunityName: "Secondary Chain",
  })

  const selected = await createSchedule(prisma, ctx, {
    opportunityId: primary.opportunityId,
    opportunityProductId: primary.opportunityProductId,
    productId: null,
    scheduleNumber: "RS-CHAIN-1",
    scheduleDate: "2026-01-01",
  })

  await createSchedule(prisma, ctx, {
    opportunityId: secondary.opportunityId,
    opportunityProductId: secondary.opportunityProductId,
    productId: primary.productId,
    scheduleNumber: "RS-OTHER-CHAIN",
    scheduleDate: "2026-02-01",
  })

  const changeStartDateModule = await import("../app/api/revenue-schedules/bulk/change-start-date/route")
  const post = (changeStartDateModule as any).POST ?? (changeStartDateModule as any).default?.POST
  assert.equal(typeof post, "function")

  const response = await post(
    authedJson(ctx.sessionToken, "http://localhost/api/revenue-schedules/bulk/change-start-date", {
      scheduleIds: [selected.id],
      newStartDate: "2026-02-01",
      reason: "Integration test",
    }),
  )

  assertStatus(response, 200)
  const payload = await readJson<any>(response)
  assert.equal(payload.updated, 1)
  assert.equal(payload.deltaMonths, 1)

  const updated = await prisma.revenueSchedule.findFirst({
    where: { id: selected.id, tenantId: ctx.tenantId },
    select: { scheduleDate: true },
  })
  assert.equal(updated?.scheduleDate?.toISOString().slice(0, 10), "2026-02-01")
})

integrationTest("REV-CHANGE-START-DATE: blocks collisions against existing schedules in the same opportunity product chain", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await grantChangeStartDatePermission(prisma, ctx)

  const chain = await seedProductAndChain(prisma, ctx, {
    opportunityName: "Collision Chain",
  })

  const selected = await createSchedule(prisma, ctx, {
    opportunityId: chain.opportunityId,
    opportunityProductId: chain.opportunityProductId,
    productId: null,
    scheduleNumber: "RS-CHAIN-10",
    scheduleDate: "2026-01-01",
  })

  const conflicting = await createSchedule(prisma, ctx, {
    opportunityId: chain.opportunityId,
    opportunityProductId: chain.opportunityProductId,
    productId: null,
    scheduleNumber: "RS-CHAIN-11",
    scheduleDate: "2026-02-01",
  })

  const changeStartDateModule = await import("../app/api/revenue-schedules/bulk/change-start-date/route")
  const post = (changeStartDateModule as any).POST ?? (changeStartDateModule as any).default?.POST

  const response = await post(
    authedJson(ctx.sessionToken, "http://localhost/api/revenue-schedules/bulk/change-start-date", {
      scheduleIds: [selected.id],
      newStartDate: "2026-02-01",
      reason: "Integration test",
    }),
  )

  assertStatus(response, 400)
  const payload = await readJson<any>(response)
  assert.match(payload.error ?? "", /RS-CHAIN-11/)
  assert.equal(String(payload.error ?? "").includes(conflicting.id), false)
  assert.equal(Array.isArray(payload.preview?.conflictSummaries), true)
})

integrationTest("REV-CHANGE-START-DATE: preview route returns plain-English collisions without raw ids", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await grantChangeStartDatePermission(prisma, ctx)

  const chain = await seedProductAndChain(prisma, ctx, {
    opportunityName: "Preview Collision Chain",
  })

  const selected = await createSchedule(prisma, ctx, {
    opportunityId: chain.opportunityId,
    opportunityProductId: chain.opportunityProductId,
    productId: null,
    scheduleNumber: "RS-PREVIEW-10",
    scheduleDate: "2026-01-01",
  })

  const conflicting = await createSchedule(prisma, ctx, {
    opportunityId: chain.opportunityId,
    opportunityProductId: chain.opportunityProductId,
    productId: null,
    scheduleNumber: "RS-PREVIEW-11",
    scheduleDate: "2026-02-01",
  })

  const previewModule = await import("../app/api/revenue-schedules/bulk/change-start-date/preview/route")
  const post = (previewModule as any).POST ?? (previewModule as any).default?.POST

  const response = await post(
    authedJson(ctx.sessionToken, "http://localhost/api/revenue-schedules/bulk/change-start-date/preview", {
      scheduleIds: [selected.id],
      newStartDate: "2026-02-01",
    }),
  )

  assertStatus(response, 200)
  const payload = await readJson<any>(response)
  assert.equal(payload.canApply, false)
  assert.equal(payload.rows?.[0]?.status, "collision")
  assert.match(payload.conflictSummaries?.[0] ?? "", /RS-PREVIEW-11/)
  assert.equal(String(payload.conflictSummaries?.[0] ?? "").includes(conflicting.id), false)
})

integrationTest("REV-CHANGE-START-DATE: blocks mixed selections across opportunity product chains", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await grantChangeStartDatePermission(prisma, ctx)

  const primary = await seedProductAndChain(prisma, ctx, {
    opportunityName: "Mixed Primary",
  })
  const secondary = await seedProductAndChain(prisma, ctx, {
    productId: primary.productId,
    opportunityName: "Mixed Secondary",
  })

  const first = await createSchedule(prisma, ctx, {
    opportunityId: primary.opportunityId,
    opportunityProductId: primary.opportunityProductId,
    productId: null,
    scheduleNumber: "RS-MIX-1",
    scheduleDate: "2026-01-01",
  })

  const second = await createSchedule(prisma, ctx, {
    opportunityId: secondary.opportunityId,
    opportunityProductId: secondary.opportunityProductId,
    productId: null,
    scheduleNumber: "RS-MIX-2",
    scheduleDate: "2026-02-01",
  })

  const changeStartDateModule = await import("../app/api/revenue-schedules/bulk/change-start-date/route")
  const post = (changeStartDateModule as any).POST ?? (changeStartDateModule as any).default?.POST

  const response = await post(
    authedJson(ctx.sessionToken, "http://localhost/api/revenue-schedules/bulk/change-start-date", {
      scheduleIds: [first.id, second.id],
      newStartDate: "2026-03-01",
      reason: "Integration test",
    }),
  )

  assertStatus(response, 400)
  const payload = await readJson<any>(response)
  assert.match(payload.error ?? "", /same opportunity product chain/i)
})

integrationTest("REV-CHANGE-START-DATE: blocks schedules that are missing opportunityProductId", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  await grantChangeStartDatePermission(prisma, ctx)

  const product = await prisma.product.create({
    data: {
      tenantId: ctx.tenantId,
      productCode: `PROD-${Date.now()}`,
      productNameHouse: "Test Product",
      revenueType: "Recurring",
    },
    select: { id: true },
  })

  const orphanSchedule = await createSchedule(prisma, ctx, {
    productId: product.id,
    scheduleNumber: "RS-ORPHAN-1",
    scheduleDate: "2026-01-01",
  })

  const changeStartDateModule = await import("../app/api/revenue-schedules/bulk/change-start-date/route")
  const post = (changeStartDateModule as any).POST ?? (changeStartDateModule as any).default?.POST

  const response = await post(
    authedJson(ctx.sessionToken, "http://localhost/api/revenue-schedules/bulk/change-start-date", {
      scheduleIds: [orphanSchedule.id],
      newStartDate: "2026-02-01",
      reason: "Integration test",
    }),
  )

  assertStatus(response, 400)
  const payload = await readJson<any>(response)
  assert.match(payload.error ?? "", /opportunity product chain/i)
})
