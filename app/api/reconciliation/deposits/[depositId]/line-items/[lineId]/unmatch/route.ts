import { NextRequest, NextResponse } from "next/server"
import { AuditAction, DepositLineItemStatus } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { recomputeRevenueSchedules } from "@/lib/matching/revenue-schedule-status"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { logRevenueScheduleAudit } from "@/lib/audit"

export async function POST(
  request: NextRequest,
  { params }: { params: { depositId: string; lineId: string } },
) {
  return withPermissions(request, ["reconciliation.view"], async req => {
    const depositId = params?.depositId?.trim()
    const lineId = params?.lineId?.trim()
    const tenantId = req.user.tenantId

    if (!depositId || !lineId) {
      return createErrorResponse("Deposit id and line id are required", 400)
    }

    const lineItem = await prisma.depositLineItem.findFirst({
      where: { id: lineId, depositId, tenantId },
    })
    if (!lineItem) {
      return createErrorResponse("Deposit line item not found", 404)
    }

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)

    const result = await prisma.$transaction(async tx => {
      const existingMatches = await tx.depositLineMatch.findMany({
        where: { depositLineItemId: lineItem.id, tenantId },
        select: { revenueScheduleId: true },
      })

      const scheduleIds = Array.from(new Set(existingMatches.map(match => match.revenueScheduleId).filter(Boolean)))
      const schedulesBefore =
        scheduleIds.length > 0
          ? await tx.revenueSchedule.findMany({
              where: { tenantId, id: { in: scheduleIds } },
              select: { id: true, status: true, actualUsage: true, actualCommission: true },
            })
          : []

      await tx.depositLineMatch.deleteMany({
        where: { depositLineItemId: lineItem.id },
      })

      const updatedLine = await tx.depositLineItem.update({
        where: { id: lineItem.id },
        data: {
          status: DepositLineItemStatus.Unmatched,
          primaryRevenueScheduleId: null,
          usageAllocated: 0,
          usageUnallocated: lineItem.usage ?? 0,
          commissionAllocated: 0,
          commissionUnallocated: lineItem.commission ?? 0,
        },
      })

      const deposit = await recomputeDepositAggregates(tx, depositId, tenantId)
      const revenueSchedules =
        scheduleIds.length > 0
          ? await recomputeRevenueSchedules(
              tx,
              scheduleIds,
              tenantId,
              { varianceTolerance },
            )
          : []

      return { lineItem: updatedLine, deposit, revenueSchedules, schedulesBefore }
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
          action: "UnmatchDepositLine",
          depositId,
          depositLineItemId: lineItem.id,
          status: scheduleResult.schedule.status,
          actualUsage: scheduleResult.schedule.actualUsage,
          actualCommission: scheduleResult.schedule.actualCommission,
          usageBalance: scheduleResult.usageBalance,
          commissionDifference: scheduleResult.commissionDifference,
          matchCount: scheduleResult.matchCount,
        },
      )
    }

    const { schedulesBefore: _schedulesBefore, ...responseData } = result as any
    return NextResponse.json({ data: responseData })
  })
}
