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
      accountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      accountNameRaw: "Test Distributor",
      vendorNameRaw: "Test Vendor",
      distributorNameRaw: "Test Distributor",
      productNameRaw: "Internet",
    },
    select: { id: true },
  })

  // Candidate within month window.
  const inWindow = await prisma.revenueSchedule.create({
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
    select: { id: true },
  })

  // Candidate well before the previous lower-bound window (now allowed).
  const oldSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-CAND-OLD",
      scheduleDate: new Date("2025-10-15T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 100,
      expectedCommission: 10,
    },
    select: { id: true },
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
  assert.ok(legacyNoFuturePayload.data!.some(row => row.id === inWindow.id))
  assert.ok(legacyNoFuturePayload.data!.some(row => row.id === oldSchedule.id))
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

integrationTest("REC-AUTO-16: strong ID evidence boosts valid fuzzy candidates above default suggestion threshold", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const opportunity = await prisma.opportunity.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      name: "Strong ID Opportunity",
      customerIdVendor: "CID-100",
      orderIdVendor: "ORD-100",
      distributorName: "Test Distributor",
      vendorName: "Test Vendor",
    },
    select: { id: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Strong ID Confidence Deposit",
      paymentDate: new Date("2026-01-15T00:00:00Z"),
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
      paymentDate: new Date("2026-01-15T00:00:00Z"),
      usage: 100,
      usageAllocated: 0,
      usageUnallocated: 100,
      commission: 10,
      commissionAllocated: 0,
      commissionUnallocated: 10,
      accountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      customerIdVendor: "CID-100",
      orderIdVendor: "ORD-100",
      accountNameRaw: "Test Distributor",
      vendorNameRaw: "Test Vendor",
      distributorNameRaw: "Test Distributor",
    },
    select: { id: true },
  })

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      opportunityId: opportunity.id,
      scheduleNumber: "RS-STRONG-ID-1",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 150,
      expectedCommission: 15,
    },
    select: { id: true },
  })

  const candidatesModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route")
  const GET = (candidatesModule as any).GET ?? (candidatesModule as any).default?.GET
  assert.equal(typeof GET, "function")

  const response = await GET(
    authedGet(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/candidates?useHierarchicalMatching=true&includeFutureSchedules=false`,
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(response, 200)
  const payload = await readJson<{ data?: any[] }>(response)

  assert.ok(Array.isArray(payload.data))
  const candidate = payload.data!.find(row => row.id === schedule.id)
  assert.ok(candidate, "Expected schedule with matching strong IDs to appear in suggested candidates")
  assert.equal(candidate.matchType, "fuzzy")
  assert.ok(
    candidate.matchConfidence >= 0.7,
    `Expected strong-ID fuzzy confidence >= 0.7, got ${candidate.matchConfidence}`,
  )
})

integrationTest("REC-AUTO-17: hierarchical candidate ordering keeps FIFO for confidence ties", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-06-01T00:00:00Z"),
      status: "InReview",
      depositName: "FIFO Tie-Break Deposit",
      paymentDate: new Date("2026-06-15T00:00:00Z"),
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
      paymentDate: new Date("2026-06-15T00:00:00Z"),
      usage: 100,
      usageAllocated: 0,
      usageUnallocated: 100,
      commission: 10,
      commissionAllocated: 0,
      commissionUnallocated: 10,
      accountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      accountNameRaw: "Test Distributor",
    },
    select: { id: true },
  })

  const olderSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-FIFO-OLDER",
      scheduleDate: new Date("2025-01-01T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 100,
      expectedCommission: 10,
    },
    select: { id: true },
  })

  const newerSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-FIFO-NEWER",
      scheduleDate: new Date("2025-02-01T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 100,
      expectedCommission: 10,
    },
    select: { id: true },
  })

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

  const candidatesModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route")
  const GET = (candidatesModule as any).GET ?? (candidatesModule as any).default?.GET
  assert.equal(typeof GET, "function")

  const response = await GET(
    authedGet(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/candidates?useHierarchicalMatching=true&includeFutureSchedules=false`,
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(response, 200)
  const payload = await readJson<{ data?: any[] }>(response)
  assert.ok(Array.isArray(payload.data))

  const older = payload.data!.find(row => row.id === olderSchedule.id)
  const newer = payload.data!.find(row => row.id === newerSchedule.id)
  assert.ok(older, "Expected older schedule to be present")
  assert.ok(newer, "Expected newer schedule to be present")
  assert.equal(older.matchConfidence, newer.matchConfidence)

  const olderIndex = payload.data!.findIndex(row => row.id === olderSchedule.id)
  const newerIndex = payload.data!.findIndex(row => row.id === newerSchedule.id)
  assert.ok(olderIndex < newerIndex, "Expected FIFO ordering to prefer older schedule on confidence tie")
})

integrationTest("REC-AUTO-18: candidates endpoint hides soft-deleted applied schedules", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Deleted Schedule Candidate Deposit",
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
      status: "Matched",
      paymentDate: new Date("2026-01-02T00:00:00Z"),
      usage: 100,
      usageAllocated: 100,
      usageUnallocated: 0,
      commission: 10,
      commissionAllocated: 10,
      commissionUnallocated: 0,
      accountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      accountNameRaw: "Test Distributor",
      vendorNameRaw: "Test Vendor",
      distributorNameRaw: "Test Distributor",
      productNameRaw: "Internet",
    },
    select: { id: true },
  })

  const deletedSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      scheduleNumber: "RS-DELETED-MATCHED",
      scheduleDate: new Date("2026-01-05T00:00:00Z"),
      status: "Unreconciled",
      expectedUsage: 100,
      expectedCommission: 10,
      deletedAt: new Date("2026-03-09T00:00:00Z"),
    },
    select: { id: true },
  })

  await prisma.depositLineMatch.create({
    data: {
      tenantId: ctx.tenantId,
      depositId: deposit.id,
      depositLineItemId: line.id,
      revenueScheduleId: deletedSchedule.id,
      status: "Applied",
      usageAmount: 100,
      commissionAmount: 10,
      source: "Manual",
    },
  })

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

  const candidatesModule = await import("../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/candidates/route")
  const GET = (candidatesModule as any).GET ?? (candidatesModule as any).default?.GET
  assert.equal(typeof GET, "function")

  const response = await GET(
    authedGet(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/candidates?useHierarchicalMatching=false&includeFutureSchedules=false`,
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(response, 200)

  const payload = await readJson<{ data?: Array<{ id: string }> }>(response)
  assert.ok(Array.isArray(payload.data))
  assert.ok(payload.data!.every(row => row.id !== deletedSchedule.id))
})
