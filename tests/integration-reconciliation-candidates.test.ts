import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function authedGet(sessionToken: string, url: string) {
  return new NextRequest(url, { method: "GET", headers: { cookie: `session-token=${sessionToken}` } })
}

integrationTest("REC-AUTO-05/06: candidates endpoint honors engine mode + user confidence filtering + includeFutureSchedules", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Candidates Deposit",
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
      vendorNameRaw: "Test Vendor",
      distributorNameRaw: "Test Distributor",
      productNameRaw: "Internet",
    },
    select: { id: true },
  })

  // Candidate within month window.
  await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-CAND-1",
      scheduleDate: new Date("2026-01-05T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 100,
      expectedCommission: 10,
    },
  })

  // Candidate outside end-of-month (future), should only show when includeFutureSchedules=true.
  await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-CAND-2",
      scheduleDate: new Date("2026-02-15T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 100,
      expectedCommission: 10,
    },
  })

  const candidatesModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route")
  const GET = (candidatesModule as any).GET ?? (candidatesModule as any).default?.GET
  assert.equal(typeof GET, "function")

  // High threshold => likely filters all Suggested rows.
  await prisma.userSetting.upsert({
    where: { userId_key: { userId: ctx.userId, key: "reconciliation.suggestedMatchesMinConfidence" } },
    update: { tenantId: ctx.tenantId, value: 1 },
    create: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      key: "reconciliation.suggestedMatchesMinConfidence",
      value: 1,
      description: "Integration test",
    },
  })

  const legacyHigh = await GET(
    authedGet(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/candidates?useHierarchicalMatching=false&includeFutureSchedules=false`,
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(legacyHigh, 200)
  const legacyHighPayload = await readJson<{ data?: any[] }>(legacyHigh)
  assert.ok(Array.isArray(legacyHighPayload.data))
  assert.equal(legacyHighPayload.data!.length, 0)

  // Low threshold => allow all suggestions through.
  await prisma.userSetting.upsert({
    where: { userId_key: { userId: ctx.userId, key: "reconciliation.suggestedMatchesMinConfidence" } },
    update: { tenantId: ctx.tenantId, value: 0 },
    create: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      key: "reconciliation.suggestedMatchesMinConfidence",
      value: 0,
      description: "Integration test",
    },
  })

  const legacyNoFuture = await GET(
    authedGet(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/candidates?useHierarchicalMatching=false&includeFutureSchedules=false`,
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(legacyNoFuture, 200)
  const legacyNoFuturePayload = await readJson<{ data?: any[] }>(legacyNoFuture)
  assert.ok((legacyNoFuturePayload.data?.length ?? 0) >= 1)
  assert.ok(legacyNoFuturePayload.data!.every(row => row.matchType === "legacy"))

  const legacyWithFuture = await GET(
    authedGet(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/candidates?useHierarchicalMatching=false&includeFutureSchedules=true`,
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(legacyWithFuture, 200)
  const legacyWithFuturePayload = await readJson<{ data?: any[] }>(legacyWithFuture)
  assert.ok((legacyWithFuturePayload.data?.length ?? 0) >= (legacyNoFuturePayload.data?.length ?? 0))

  const hierarchical = await GET(
    authedGet(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/candidates?useHierarchicalMatching=true&includeFutureSchedules=false`,
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(hierarchical, 200)
  const hierarchicalPayload = await readJson<{ data?: any[] }>(hierarchical)
  assert.ok((hierarchicalPayload.data?.length ?? 0) >= 1)
  assert.notEqual(hierarchicalPayload.data![0]!.matchType, "legacy")
})

