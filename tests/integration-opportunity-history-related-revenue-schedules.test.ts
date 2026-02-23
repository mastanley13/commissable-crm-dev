import assert from "node:assert/strict"

import { NextRequest } from "next/server"
import { AuditAction } from "@prisma/client"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"
import { logRevenueScheduleAudit } from "../lib/audit"

function authedGet(sessionToken: string, url: string) {
  return new NextRequest(url, {
    method: "GET",
    headers: {
      cookie: `session-token=${sessionToken}`,
    },
  })
}

integrationTest("OPP-HISTORY: includes RevenueSchedule audit logs when requested", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const permission = await prisma.permission.upsert({
    where: { code: "auditLogs.read" },
    update: {},
    create: {
      code: "auditLogs.read",
      name: "Audit Logs Read",
      category: "Admin",
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

  const opportunity = await prisma.opportunity.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      ownerId: ctx.userId,
      name: "Opportunity History - Related Revenue Schedules",
    },
    select: { id: true },
  })

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      opportunityId: opportunity.id,
      scheduleNumber: "RS-OPP-HISTORY-1",
      scheduleDate: new Date("2026-02-23T00:00:00Z"),
      expectedUsage: 100,
      expectedCommission: 10,
      createdById: ctx.userId,
      updatedById: ctx.userId,
    },
    select: { id: true, scheduleNumber: true },
  })

  await logRevenueScheduleAudit(
    AuditAction.Update,
    schedule.id,
    ctx.userId,
    ctx.tenantId,
    undefined,
    { expectedUsage: 100 },
    { expectedUsage: 120 },
  )

  const auditLogsModule = await import("../app/api/audit-logs/route")
  const get = (auditLogsModule as any).GET ?? (auditLogsModule as any).default?.GET
  assert.equal(typeof get, "function")

  const response = await get(
    authedGet(
      ctx.sessionToken,
      `http://localhost/api/audit-logs?entityName=Opportunity&entityId=${opportunity.id}&includeRelatedRevenueSchedules=true&pageSize=200&summaryOnly=true`,
    ),
  )

  assertStatus(response, 200)
  const payload = await readJson<any>(response)

  assert.ok(Array.isArray(payload.data))
  const found = payload.data.find(
    (row: any) => row.entityName === "RevenueSchedule" && row.entityId === schedule.id,
  )
  assert.ok(found, "Expected RevenueSchedule audit row in Opportunity history feed")
  assert.equal(found.entityLabel, schedule.scheduleNumber)
})

