import { NextRequest, NextResponse } from "next/server"
import { AuditAction, DepositLineMatchStatus } from "@prisma/client"

import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { recomputeDepositLineItemAllocations } from "@/lib/matching/deposit-line-allocations"
import { recomputeRevenueSchedules } from "@/lib/matching/revenue-schedule-status"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { getClientIP, getUserAgent, logAudit, logRevenueScheduleAudit } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type BulkUnmatchAllocationsBody = {
  lineItemIds?: string[]
  revenueScheduleIds?: string[]
}

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map(item => item.trim())
    .filter(Boolean)
  return Array.from(new Set(normalized))
}

export async function POST(
  request: NextRequest,
  { params }: { params: { depositId: string } },
) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const depositId = params?.depositId?.trim()
    if (!depositId) {
      return createErrorResponse("Deposit id is required", 400)
    }

    const body = (await request.json().catch(() => null)) as BulkUnmatchAllocationsBody | null
    if (!body || typeof body !== "object") {
      return createErrorResponse("Invalid request payload", 400)
    }

    const lineItemIds = normalizeIdList(body.lineItemIds)
    const revenueScheduleIds = normalizeIdList(body.revenueScheduleIds)
    if (lineItemIds.length === 0 || revenueScheduleIds.length === 0) {
      return createErrorResponse("lineItemIds and revenueScheduleIds must be non-empty arrays of ids", 400)
    }

    const tenantId = req.user.tenantId

    const lineItems = await prisma.depositLineItem.findMany({
      where: { tenantId, depositId, id: { in: lineItemIds } },
      select: { id: true, reconciled: true },
    })

    const foundLineIds = new Set(lineItems.map(item => item.id))
    const missingLineIds = lineItemIds.filter(id => !foundLineIds.has(id))
    if (missingLineIds.length > 0) {
      return NextResponse.json(
        { error: `Unknown deposit line item id(s): ${missingLineIds.join(", ")}` },
        { status: 404 },
      )
    }

    const lockedLineIds = lineItems.filter(item => item.reconciled).map(item => item.id)
    if (lockedLineIds.length > 0) {
      return NextResponse.json(
        { error: `Reconciled line items cannot be changed: ${lockedLineIds.join(", ")}` },
        { status: 409 },
      )
    }

    const schedules = await prisma.revenueSchedule.findMany({
      // Cast to any to allow recently added nullable metadata fields.
      where: { tenantId, id: { in: revenueScheduleIds }, deletedAt: null } as any,
      select: { id: true } as any,
    })
    const foundScheduleIds = new Set(schedules.map(item => item.id))
    const missingScheduleIds = revenueScheduleIds.filter(id => !foundScheduleIds.has(id))
    if (missingScheduleIds.length > 0) {
      return NextResponse.json(
        { error: `Unknown revenue schedule id(s): ${missingScheduleIds.join(", ")}` },
        { status: 404 },
      )
    }

    const matches = await prisma.depositLineMatch.findMany({
      where: {
        tenantId,
        depositLineItemId: { in: lineItemIds },
        revenueScheduleId: { in: revenueScheduleIds },
        status: DepositLineMatchStatus.Applied,
      },
      select: {
        id: true,
        depositLineItemId: true,
        revenueScheduleId: true,
      },
    })

    if (matches.length === 0) {
      return NextResponse.json({
        data: {
          deletedMatchCount: 0,
          affectedLineItemIds: [],
          affectedScheduleIds: [],
        },
      })
    }

    const affectedLineItemIds = Array.from(new Set(matches.map(match => match.depositLineItemId).filter(Boolean)))
    const affectedScheduleIds = Array.from(new Set(matches.map(match => match.revenueScheduleId).filter(Boolean)))

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)

    const result = await prisma.$transaction(async tx => {
      const schedulesBefore =
        affectedScheduleIds.length > 0
          ? await tx.revenueSchedule.findMany({
              where: { tenantId, id: { in: affectedScheduleIds } },
              select: {
                id: true,
                status: true,
                actualUsage: true,
                actualCommission: true,
                flexSourceDepositLineItemId: true,
                deletedAt: true,
              } as any,
            })
          : []

      const deleteResult = await tx.depositLineMatch.deleteMany({
        where: {
          tenantId,
          depositLineItemId: { in: affectedLineItemIds },
          revenueScheduleId: { in: affectedScheduleIds },
          status: DepositLineMatchStatus.Applied,
        },
      })

      const updatedLines = []
      for (const lineId of affectedLineItemIds) {
        const { line } = await recomputeDepositLineItemAllocations(tx, lineId, tenantId)
        updatedLines.push(line)
      }

      const deposit = await recomputeDepositAggregates(tx, depositId, tenantId)

      const revenueSchedules =
        affectedScheduleIds.length > 0
          ? await recomputeRevenueSchedules(tx, affectedScheduleIds, tenantId, { varianceTolerance })
          : []

      // Soft-delete auto-created flex schedules that were sourced from an affected line and now have no matches.
      const candidateFlexIds = (schedulesBefore ?? [])
        .filter(
          schedule =>
            schedule.deletedAt == null &&
            schedule.flexSourceDepositLineItemId &&
            affectedLineItemIds.includes(String(schedule.flexSourceDepositLineItemId)),
        )
        .map(schedule => schedule.id)

      for (const flexId of candidateFlexIds) {
        const stillUsed = await tx.depositLineMatch.findFirst({
          where: { tenantId, revenueScheduleId: flexId },
          select: { id: true },
        })
        if (stillUsed) continue
        await tx.revenueSchedule.update({
          where: { id: flexId },
          data: { deletedAt: new Date() },
          select: { id: true },
        })
      }

      return { deleteResult, updatedLines, deposit, revenueSchedules, schedulesBefore }
    })

    for (const scheduleResult of result.revenueSchedules ?? []) {
      const before = (result.schedulesBefore ?? []).find(row => row.id === scheduleResult.schedule.id)
      await logRevenueScheduleAudit(
        AuditAction.Update,
        scheduleResult.schedule.id,
        req.user.id,
        tenantId,
        request,
        {
          status: before?.status ?? null,
          actualUsage: before?.actualUsage ?? null,
          actualCommission: before?.actualCommission ?? null,
        },
        {
          action: "UnmatchDepositAllocations",
          depositId,
          depositLineItemIds: affectedLineItemIds,
          revenueScheduleIds: affectedScheduleIds,
          status: scheduleResult.schedule.status,
          actualUsage: scheduleResult.schedule.actualUsage,
          actualCommission: scheduleResult.schedule.actualCommission,
          usageBalance: scheduleResult.usageBalance,
          commissionDifference: scheduleResult.commissionDifference,
          matchCount: scheduleResult.matchCount,
        },
      )
    }

    await logAudit({
      userId: req.user.id,
      tenantId,
      action: AuditAction.Delete,
      entityName: "DepositLineMatch",
      entityId: depositId,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
      metadata: {
        action: "RemoveAllocations",
        depositId,
        depositLineItemIds: affectedLineItemIds,
        revenueScheduleIds: affectedScheduleIds,
        deletedMatchCount: result.deleteResult.count,
      },
    })

    const { schedulesBefore: _schedulesBefore, ...responseData } = result as any

    return NextResponse.json({
      data: {
        deletedMatchCount: result.deleteResult.count,
        affectedLineItemIds,
        affectedScheduleIds,
        ...responseData,
      },
    })
  })
}

