import { NextRequest, NextResponse } from "next/server"

import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import {
  getTenantRateDiscrepancyTolerancePercent,
  getTenantVarianceTolerance,
} from "@/lib/matching/settings"
import { buildCommissionAmountReview } from "@/lib/reconciliation/commission-amount-review"
import { getLowRateExceptionState } from "@/lib/reconciliation/low-rate-exceptions"
import {
  buildRateDiscrepancySummary,
  deriveReceivedRatePercent,
  normalizeRatePercent,
} from "@/lib/reconciliation/rate-discrepancy"

interface CommissionAmountReviewRequestBody {
  revenueScheduleId: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { depositId: string; lineId: string } },
) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const depositId = params?.depositId?.trim()
    const lineId = params?.lineId?.trim()
    const tenantId = req.user.tenantId

    if (!depositId || !lineId) {
      return createErrorResponse("Deposit id and line id are required", 400)
    }

    const body = (await request.json().catch(() => null)) as CommissionAmountReviewRequestBody | null
    if (!body?.revenueScheduleId?.trim()) {
      return createErrorResponse("revenueScheduleId is required", 400)
    }

    const revenueScheduleId = body.revenueScheduleId.trim()

    const lineItem = await prisma.depositLineItem.findFirst({
      where: { id: lineId, depositId, tenantId },
      select: { id: true, reconciled: true },
    })
    if (!lineItem) {
      return createErrorResponse("Deposit line item not found", 404)
    }
    if (lineItem.reconciled) {
      return createErrorResponse("Reconciled line items cannot be changed", 400)
    }

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)
    const rateDiscrepancyTolerancePercent = await getTenantRateDiscrepancyTolerancePercent(tenantId)

    const [recompute, scheduleContext, lowRateState] = await Promise.all([
      recomputeRevenueScheduleFromMatches(prisma, revenueScheduleId, tenantId, {
        varianceTolerance,
      }),
      prisma.revenueSchedule.findFirst({
        where: { id: revenueScheduleId, tenantId, deletedAt: null },
        select: {
          id: true,
          scheduleNumber: true,
          scheduleDate: true,
          expectedCommissionRatePercent: true,
          product: {
            select: {
              commissionPercent: true,
            },
          },
        },
      }),
      getLowRateExceptionState(prisma, { tenantId, revenueScheduleId }),
    ])

    if (!scheduleContext) {
      return createErrorResponse("Revenue schedule not found", 404)
    }

    const expectedRatePercent = normalizeRatePercent(
      (scheduleContext as any).expectedCommissionRatePercent ?? scheduleContext.product?.commissionPercent ?? null,
    )
    const receivedRatePercent = deriveReceivedRatePercent({
      usageAmount: recompute.schedule.actualUsage,
      commissionAmount: recompute.schedule.actualCommission,
    })
    const rateDiscrepancy = buildRateDiscrepancySummary({
      expectedRatePercent,
      receivedRatePercent,
      tolerancePercent: rateDiscrepancyTolerancePercent,
    })

    const review = buildCommissionAmountReview({
      revenueScheduleId,
      scheduleNumber: (scheduleContext.scheduleNumber ?? scheduleContext.id).trim() || scheduleContext.id,
      scheduleDate: scheduleContext.scheduleDate ? scheduleContext.scheduleDate.toISOString() : null,
      remainingCommissionDifference: recompute.commissionDifference,
      hasPendingRateResolution: Boolean(rateDiscrepancy?.isMaterial && !lowRateState.routed),
      lowRateExceptionRouted: lowRateState.routed,
      queuePath: lowRateState.routed ? "/reconciliation/low-rate-exceptions" : null,
      ticketId: lowRateState.ticket?.id ?? null,
    })

    return NextResponse.json({
      data: {
        review,
      },
    })
  })
}
