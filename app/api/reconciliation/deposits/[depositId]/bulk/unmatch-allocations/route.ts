import { NextRequest, NextResponse } from "next/server"
import { AuditAction, DepositLineMatchStatus } from "@prisma/client"

import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { getClientIP, getUserAgent, logAudit, logRevenueScheduleAudit } from "@/lib/audit"
import { executeUnmatchReversal } from "@/lib/reconciliation/unmatch-reversal"

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

    const matches = await prisma.depositLineMatch.findMany({
      where: {
        tenantId,
        depositLineItemId: { in: lineItemIds },
        revenueScheduleId: { in: revenueScheduleIds },
        status: { in: [DepositLineMatchStatus.Applied, DepositLineMatchStatus.Suggested] },
      },
      select: {
        id: true,
        depositLineItemId: true,
        revenueScheduleId: true,
      },
    })

    const matchedScheduleIds = new Set(
      matches.map(match => match.revenueScheduleId).filter((id): id is string => typeof id === "string" && id.length > 0),
    )
    const missingScheduleIds = revenueScheduleIds.filter(id => !matchedScheduleIds.has(id))
    if (missingScheduleIds.length > 0) {
      const activeSchedules = await prisma.revenueSchedule.findMany({
        where: { tenantId, id: { in: missingScheduleIds }, deletedAt: null },
        select: { id: true },
      })
      const activeScheduleIds = new Set(activeSchedules.map(item => item.id))
      const unknownScheduleIds = missingScheduleIds.filter(id => !activeScheduleIds.has(id))
      const unmatchedScheduleIds = missingScheduleIds.filter(id => activeScheduleIds.has(id))

      const messages: string[] = []
      if (unknownScheduleIds.length > 0) {
        messages.push(`Unknown revenue schedule id(s): ${unknownScheduleIds.join(", ")}`)
      }
      if (unmatchedScheduleIds.length > 0) {
        messages.push(`Selected schedules are not matched to the selected line items: ${unmatchedScheduleIds.join(", ")}`)
      }

      return NextResponse.json({ error: messages.join(". ") }, { status: 404 })
    }

    if (matches.length === 0) {
      return NextResponse.json({
        data: {
          deletedMatchCount: 0,
          affectedLineItemIds: [],
          affectedScheduleIds: [],
        },
      })
    }

    const affectedLineItemIds = Array.from(
      new Set(matches.map(match => match.depositLineItemId).filter((id): id is string => Boolean(id))),
    )
    const affectedScheduleIds = Array.from(
      new Set(matches.map(match => match.revenueScheduleId).filter((id): id is string => Boolean(id))),
    )

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)

    let result
    try {
      result = await prisma.$transaction(async tx => {
        return executeUnmatchReversal(tx, {
          tenantId,
          depositId,
          lineItemIds: affectedLineItemIds,
          revenueScheduleIds: affectedScheduleIds,
          userId: req.user.id,
          varianceTolerance,
        })
      })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : "Unable to unmatch allocations", 400)
    }

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
        deletedMatchCount: result.deletedMatchCount,
        reversedUndoLogCount: result.reversedUndoLogCount ?? 0,
      },
    })

    const { schedulesBefore: _schedulesBefore, ...responseData } = result as any

    return NextResponse.json({
      data: {
        deletedMatchCount: result.deletedMatchCount,
        affectedLineItemIds: result.affectedLineItemIds ?? affectedLineItemIds,
        affectedScheduleIds: result.affectedScheduleIds ?? affectedScheduleIds,
        ...responseData,
      },
    })
  })
}
