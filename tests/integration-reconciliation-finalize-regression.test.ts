import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

integrationTest("REC-AUTO-20: finalize treats status=Completed as finalized (documents current behavior)", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const deposit = await prisma.deposit.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      month: new Date("2026-01-01T00:00:00Z"),
      status: "Completed",
      reconciled: false,
      reconciledAt: null,
      depositName: "Finalize Regression Deposit",
      paymentDate: new Date("2026-01-02T00:00:00Z"),
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      createdByUserId: ctx.userId,
    },
    select: { id: true },
  })

  // Ensure there are no open lines that would fail earlier for the wrong reason.
  await prisma.depositLineItem.create({
    data: {
      tenantId: ctx.tenantId,
      depositId: deposit.id,
      lineNumber: 1,
      status: "Matched",
      paymentDate: new Date("2026-01-02T00:00:00Z"),
      usage: 10,
      usageAllocated: 10,
      usageUnallocated: 0,
      commission: 1,
      commissionAllocated: 1,
      commissionUnallocated: 0,
      vendorAccountId: ctx.vendorAccountId,
    },
  })

  const finalizeModule = await import("../app/api/reconciliation/deposits/[depositId]/finalize/route")
  const finalizePOST = (finalizeModule as any).POST ?? (finalizeModule as any).default?.POST
  assert.equal(typeof finalizePOST, "function")

  const response = await finalizePOST(
    new NextRequest(`http://localhost/api/reconciliation/deposits/${deposit.id}/finalize`, {
      method: "POST",
      headers: { cookie: `session-token=${ctx.sessionToken}` },
    }),
    { params: { depositId: deposit.id } },
  )

  assertStatus(response, 400)
  const payload = await readJson<{ error?: string }>(response)
  assert.match(payload.error ?? "", /already finalized/i)
})

