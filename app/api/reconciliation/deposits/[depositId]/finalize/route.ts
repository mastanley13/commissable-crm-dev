import { NextRequest, NextResponse } from "next/server"
import { DepositLineItemStatus, DepositLineMatchStatus, ReconciliationStatus } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeRevenueSchedules } from "@/lib/matching/revenue-schedule-status"
import { getTenantMatchingPreferences } from "@/lib/matching/settings"
import { logMatchingMetric } from "@/lib/matching/metrics"

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

      const revenueSchedules =
        matchedScheduleIds.length > 0
          ? await recomputeRevenueSchedules(
              tx,
              matchedScheduleIds.map(match => match.revenueScheduleId),
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

      return { deposit: depositUpdate, revenueSchedules }
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

    return NextResponse.json({ data: updated })
  })
}
