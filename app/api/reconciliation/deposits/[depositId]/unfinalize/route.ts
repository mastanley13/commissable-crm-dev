import { NextRequest, NextResponse } from "next/server"
import { AuditAction, DepositLineMatchStatus, ReconciliationStatus } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getTenantMatchingPreferences } from "@/lib/matching/settings"
import { logMatchingMetric } from "@/lib/matching/metrics"
import { recomputeRevenueSchedules } from "@/lib/matching/revenue-schedule-status"
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
    if (deposit.status === ReconciliationStatus.InReview) {
      return createErrorResponse("Deposit is already open for review", 400)
    }

    const prefs = await getTenantMatchingPreferences(tenantId)

    const updated = await prisma.$transaction(async (tx) => {
      // Unmark all lines
      await tx.depositLineItem.updateMany({
        where: { depositId, tenantId, reconciled: true },
        data: {
          reconciled: false,
          reconciledAt: null,
        },
      })

      // Unmark all matches
      await tx.depositLineMatch.updateMany({
        where: {
          tenantId,
          depositLineItem: { depositId },
          reconciled: true,
        },
        data: {
          reconciled: false,
          reconciledAt: null,
        },
      })

      const matchedSchedules = await tx.depositLineMatch.findMany({
        where: {
          tenantId,
          depositLineItem: { depositId },
          status: DepositLineMatchStatus.Applied,
        },
        select: { revenueScheduleId: true },
      })

      const scheduleIds = Array.from(new Set(matchedSchedules.map(m => m.revenueScheduleId).filter(Boolean)))
      if (scheduleIds.length > 0) {
        const schedulesBefore = await tx.revenueSchedule.findMany({
          where: { tenantId, id: { in: scheduleIds } },
          select: { id: true, status: true, actualUsage: true, actualCommission: true },
        })

        const revenueSchedules = await recomputeRevenueSchedules(tx, scheduleIds, tenantId, {
          varianceTolerance: prefs.varianceTolerance,
        })

        return {
          deposit: await tx.deposit.update({
            where: { id: depositId },
            data: {
              status: ReconciliationStatus.InReview,
              reconciled: false,
              reconciledAt: null,
            },
            select: {
              id: true,
              status: true,
              reconciled: true,
              reconciledAt: true,
            },
          }),
          revenueSchedules,
          schedulesBefore,
        }
      }

      return {
        deposit: await tx.deposit.update({
          where: { id: depositId },
          data: {
            status: ReconciliationStatus.InReview,
            reconciled: false,
            reconciledAt: null,
          },
          select: {
            id: true,
            status: true,
            reconciled: true,
            reconciledAt: true,
          },
        }),
        revenueSchedules: [],
        schedulesBefore: [],
      }
    })

    await logMatchingMetric({
      tenantId,
      userId: req.user.id,
      event: "unfinalize",
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
          action: "UnfinalizeDeposit",
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

    return NextResponse.json({ data: updated.deposit })
  })
}
