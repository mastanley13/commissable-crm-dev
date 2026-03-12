import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { assertStatus, integrationTest, readJson } from "./integration-test-helpers"

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

integrationTest("REC-GUARD-09: cross-deal matches are blocked in preview and apply flows with a plain-language explanation", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const accountType = await prisma.accountType.findFirst({
    where: { tenantId: ctx.tenantId },
    select: { id: true },
  })
  assert.ok(accountType, "Expected a seeded account type")

  const dwAccount = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "DW Realty GA, LLC",
      accountLegalName: "DW Realty GA, LLC",
    },
    select: { id: true },
  })

  const edgeAccount = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "Edge Business",
      accountLegalName: "Edge Business",
    },
    select: { id: true },
  })

  const edgeOpportunity = await prisma.opportunity.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: edgeAccount.id,
      name: "Edge Business - NorthMeadow",
      distributorName: "Test Distributor",
      vendorName: "Test Vendor",
    },
    select: { id: true },
  })

  await prisma.opportunity.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: dwAccount.id,
      name: "DW Realty - Fiber",
      distributorName: "Test Distributor",
      vendorName: "Test Vendor",
    },
    select: { id: true },
  })

  const edgeSchedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: edgeAccount.id,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      opportunityId: edgeOpportunity.id,
      scheduleNumber: "RS-EDGE-01",
      scheduleDate: new Date("2026-01-01T00:00:00Z"),
      expectedUsage: 100,
      expectedCommission: 10,
      status: "Unreconciled",
    },
    select: { id: true },
  })

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "InReview",
      depositName: "Cross Deal Guard Deposit",
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
      accountId: dwAccount.id,
      accountNameRaw: "DW Realty GA, LLC",
      vendorAccountId: ctx.vendorAccountId,
      vendorNameRaw: "Test Vendor",
      distributorNameRaw: "Test Distributor",
      productNameRaw: "Fiber ADI",
      usage: 100,
      usageAllocated: 0,
      usageUnallocated: 100,
      commission: 10,
      commissionAllocated: 0,
      commissionUnallocated: 10,
    },
    select: { id: true },
  })

  const previewModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/match-issues-preview/route"
  )
  const previewPOST = (previewModule as any).POST ?? (previewModule as any).default?.POST
  assert.equal(typeof previewPOST, "function")

  const previewResponse = await previewPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/match-issues-preview`,
      { revenueScheduleId: edgeSchedule.id, usageAmount: 100, commissionAmount: 10 },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(previewResponse, 400)
  const previewPayload = await readJson<{ error?: string }>(previewResponse)
  assert.match(previewPayload.error ?? "", /DW Realty/i)
  assert.match(previewPayload.error ?? "", /Edge Business/i)

  const applyModule = await import(
    "../app/api/reconciliation/deposits/[depositId]/line-items/[lineId]/apply-match/route"
  )
  const applyPOST = (applyModule as any).POST ?? (applyModule as any).default?.POST
  assert.equal(typeof applyPOST, "function")

  const applyResponse = await applyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/line-items/${line.id}/apply-match`,
      { revenueScheduleId: edgeSchedule.id, usageAmount: 100, commissionAmount: 10 },
    ),
    { params: { depositId: deposit.id, lineId: line.id } },
  )
  assertStatus(applyResponse, 400)
  const applyPayload = await readJson<{ error?: string }>(applyResponse)
  assert.match(applyPayload.error ?? "", /DW Realty/i)
  assert.match(applyPayload.error ?? "", /Edge Business/i)

  const groupPreviewModule = await import("../app/api/reconciliation/deposits/[depositId]/matches/preview/route")
  const groupPreviewPOST = (groupPreviewModule as any).POST ?? (groupPreviewModule as any).default?.POST
  assert.equal(typeof groupPreviewPOST, "function")

  const groupPreviewResponse = await groupPreviewPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/matches/preview`,
      { matchType: "OneToOne", lineIds: [line.id], scheduleIds: [edgeSchedule.id] },
    ),
    { params: { depositId: deposit.id } },
  )
  assertStatus(groupPreviewResponse, 200)
  const groupPreviewPayload = await readJson<{ data?: { ok?: boolean; issues?: Array<{ message?: string }> } }>(
    groupPreviewResponse,
  )
  assert.equal(groupPreviewPayload.data?.ok, false)
  assert.ok(groupPreviewPayload.data?.issues?.some(issue => /DW Realty/i.test(issue.message ?? "")))
  assert.ok(groupPreviewPayload.data?.issues?.some(issue => /Edge Business/i.test(issue.message ?? "")))

  const groupApplyModule = await import("../app/api/reconciliation/deposits/[depositId]/matches/apply/route")
  const groupApplyPOST = (groupApplyModule as any).POST ?? (groupApplyModule as any).default?.POST
  assert.equal(typeof groupApplyPOST, "function")

  const groupApplyResponse = await groupApplyPOST(
    authedJson(
      ctx.sessionToken,
      `http://localhost/api/reconciliation/deposits/${deposit.id}/matches/apply`,
      { matchType: "OneToOne", lineIds: [line.id], scheduleIds: [edgeSchedule.id] },
    ),
    { params: { depositId: deposit.id } },
  )
  assertStatus(groupApplyResponse, 400)
  const groupApplyPayload = await readJson<{ error?: string; issues?: Array<{ message?: string }> }>(groupApplyResponse)
  assert.equal(groupApplyPayload.error, "Preview validation failed")
  assert.ok(groupApplyPayload.issues?.some(issue => /DW Realty/i.test(issue.message ?? "")))
  assert.ok(groupApplyPayload.issues?.some(issue => /Edge Business/i.test(issue.message ?? "")))
})
