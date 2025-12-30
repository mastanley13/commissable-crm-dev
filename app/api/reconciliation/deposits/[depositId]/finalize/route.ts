import { NextRequest, NextResponse } from "next/server"
import { AuditAction, DepositLineItemStatus, DepositLineMatchStatus, ReconciliationStatus } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeRevenueSchedules } from "@/lib/matching/revenue-schedule-status"
import { getTenantMatchingPreferences } from "@/lib/matching/settings"
import { logMatchingMetric } from "@/lib/matching/metrics"
import { logRevenueScheduleAudit } from "@/lib/audit"

export async function POST(request: NextRequest, { params }: { params: { depositId: string } }) {
  return withPermissions(request, ["reconciliation.manage", "reconciliation.view"], async req => {
    const depositId = params?.depositId?.trim()
    const tenantId = req.user.tenantId

    if (!depositId) {
      return createErrorResponse("Deposit id is required", 400)
    }

    const deposit = await prisma.deposit.findFirst({
      where: { id: depositId, tenantId },
    })
    if (!deposit) {
      return createErrorResponse("Deposit not found", 404)
    }
    if (deposit.status === ReconciliationStatus.Completed) {
      return createErrorResponse("Deposit is already finalized", 400)
    }

    const openLines = await prisma.depositLineItem.count({
      where: {
        depositId,
        tenantId,
        status: { in: [DepositLineItemStatus.Unmatched, DepositLineItemStatus.Suggested] },
      },
    })
    if (openLines > 0) {
      return createErrorResponse("Cannot finalize while lines remain Unreconciled", 400)
    }

    const prefs = await getTenantMatchingPreferences(tenantId)

    const updated = await prisma.$transaction(async (tx) => {
      // Mark all matched lines as reconciled
      await tx.depositLineItem.updateMany({
        where: {
          depositId,
          tenantId,
          status: { in: [DepositLineItemStatus.Matched, DepositLineItemStatus.PartiallyMatched] },
        },
        data: {
          reconciled: true,
          reconciledAt: new Date(),
        },
      })

      // Mark all applied matches as reconciled
      await tx.depositLineMatch.updateMany({
        where: {
          tenantId,
          depositLineItem: { depositId },
          status: DepositLineMatchStatus.Applied,
        },
        data: {
          reconciled: true,
          reconciledAt: new Date(),
        },
      })

      const matchedScheduleIds = await tx.depositLineMatch.findMany({
        where: {
          tenantId,
          depositLineItem: { depositId },
          status: DepositLineMatchStatus.Applied,
        },
        select: { revenueScheduleId: true },
      })

      const scheduleIds = Array.from(
        new Set(matchedScheduleIds.map(match => match.revenueScheduleId).filter(Boolean)),
      )
      const schedulesBefore =
        scheduleIds.length > 0
          ? await tx.revenueSchedule.findMany({
              where: { tenantId, id: { in: scheduleIds } },
              select: { id: true, status: true, actualUsage: true, actualCommission: true },
            })
          : []

      const revenueSchedules =
        scheduleIds.length > 0
          ? await recomputeRevenueSchedules(
              tx,
              scheduleIds,
              tenantId,
              { varianceTolerance: prefs.varianceTolerance },
            )
          : []

      // Mark deposit as reconciled
      const depositUpdate = await tx.deposit.update({
        where: { id: depositId },
        data: {
          status: ReconciliationStatus.Completed,
          reconciled: true,
          reconciledAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          reconciled: true,
          reconciledAt: true,
        },
      })

      return { deposit: depositUpdate, revenueSchedules, schedulesBefore }
    })

    await logMatchingMetric({
      tenantId,
      userId: req.user.id,
      event: "finalize",
      depositId,
      request,
      metadata: {
        varianceTolerance: prefs.varianceTolerance,
        includeFutureSchedulesDefault: prefs.includeFutureSchedulesDefault,
        engineMode: prefs.engineMode,
      },
    })

    for (const scheduleResult of updated.revenueSchedules ?? []) {
      const before = (updated.schedulesBefore ?? []).find(row => row.id === scheduleResult.schedule.id)
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
          action: "FinalizeDeposit",
          depositId,
          status: scheduleResult.schedule.status,
          actualUsage: scheduleResult.schedule.actualUsage,
          actualCommission: scheduleResult.schedule.actualCommission,
          usageBalance: scheduleResult.usageBalance,
          commissionDifference: scheduleResult.commissionDifference,
          matchCount: scheduleResult.matchCount,
        },
      )
    }

    const { schedulesBefore: _schedulesBefore, ...responseData } = updated as any
    return NextResponse.json({ data: responseData })
  })
}
