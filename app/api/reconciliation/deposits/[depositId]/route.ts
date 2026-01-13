import { NextRequest, NextResponse } from "next/server"
import { AuditAction, ReconciliationStatus } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeRevenueSchedules } from "@/lib/matching/revenue-schedule-status"
import { getTenantMatchingPreferences } from "@/lib/matching/settings"
import { logMatchingMetric } from "@/lib/matching/metrics"
import { getClientIP, getUserAgent, logAudit, logRevenueScheduleAudit } from "@/lib/audit"

export async function DELETE(request: NextRequest, { params }: { params: { depositId: string } }) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const depositId = params?.depositId?.trim()
    const tenantId = req.user.tenantId

    if (!depositId) {
      return createErrorResponse("Deposit id is required", 400)
    }

    const deposit = await prisma.deposit.findFirst({
      where: { id: depositId, tenantId },
      select: { id: true, status: true, reconciled: true },
    })

    if (!deposit) {
      return createErrorResponse("Deposit not found", 404)
    }

    if (deposit.reconciled || deposit.status === ReconciliationStatus.Completed) {
      return createErrorResponse("Cannot delete a reconciled deposit", 400)
    }

    const prefs = await getTenantMatchingPreferences(tenantId)

    const result = await prisma.$transaction(async tx => {
      // Gather schedule ids linked to this deposit via matches
      const matchedSchedules = await tx.depositLineMatch.findMany({
        where: { tenantId, depositLineItem: { depositId } },
        select: { revenueScheduleId: true },
      })
      const scheduleIds = Array.from(new Set(matchedSchedules.map(m => m.revenueScheduleId).filter(Boolean)))

      const schedulesBefore =
        scheduleIds.length > 0
          ? await tx.revenueSchedule.findMany({
              where: { tenantId, id: { in: scheduleIds } },
              select: { id: true, status: true, actualUsage: true, actualCommission: true },
            })
          : []

      // Remove matches
      await tx.depositLineMatch.deleteMany({
        where: { tenantId, depositLineItem: { depositId } },
      })

      // Remove line items
      await tx.depositLineItem.deleteMany({
        where: { tenantId, depositId },
      })

      // Recompute linked revenue schedules to restore balances
      const revenueSchedules =
        scheduleIds.length > 0
          ? await recomputeRevenueSchedules(tx, scheduleIds, tenantId, {
          varianceTolerance: prefs.varianceTolerance,
        })
          : []

      // Delete deposit
      await tx.deposit.delete({
        where: { id: depositId },
      })

      return { id: depositId, schedulesRecomputed: scheduleIds.length, schedulesBefore, revenueSchedules }
    })

    await logMatchingMetric({
      tenantId,
      userId: req.user.id,
      event: "delete_deposit",
      depositId,
      request,
      metadata: {
        varianceTolerance: prefs.varianceTolerance,
        includeFutureSchedulesDefault: prefs.includeFutureSchedulesDefault,
        engineMode: prefs.engineMode,
      },
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
          action: "DeleteDeposit",
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

    await logAudit({
      userId: req.user.id,
      tenantId,
      action: AuditAction.Delete,
      entityName: "Deposit",
      entityId: depositId,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
      metadata: {
        action: "DeleteDeposit",
        schedulesRecomputed: result.schedulesRecomputed ?? 0,
      },
    })

    const { schedulesBefore: _schedulesBefore, revenueSchedules: _revenueSchedules, ...responseData } = result as any
    return NextResponse.json({ data: responseData })
  })
}

