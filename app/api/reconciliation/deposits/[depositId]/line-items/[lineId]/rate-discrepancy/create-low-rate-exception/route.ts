import { AuditAction } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { getClientIP, getUserAgent, logAudit, logRevenueScheduleAudit } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import {
  getTenantRateDiscrepancyTolerancePercent,
  getTenantVarianceTolerance,
} from "@/lib/matching/settings"
import { buildCommissionAmountReview } from "@/lib/reconciliation/commission-amount-review"
import {
  ensureLowRateException,
  LOW_RATE_EXCEPTION_QUEUE_PATH,
} from "@/lib/reconciliation/low-rate-exceptions"
import {
  buildRateDiscrepancySummary,
  deriveReceivedRatePercent,
  isUsageWithinTolerance,
  normalizeRatePercent,
} from "@/lib/reconciliation/rate-discrepancy"

interface CreateLowRateExceptionRequestBody {
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

    const body = (await request.json().catch(() => null)) as CreateLowRateExceptionRequestBody | null
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

    try {
      const result = await prisma.$transaction(async tx => {
        const baseSchedule = await tx.revenueSchedule.findFirst({
          where: { id: revenueScheduleId, tenantId, deletedAt: null },
          select: {
            id: true,
            scheduleNumber: true,
            scheduleDate: true,
            accountId: true,
            opportunityId: true,
            distributorAccountId: true,
            vendorAccountId: true,
            billingStatus: true,
            billingStatusSource: true,
            billingStatusReason: true,
            expectedCommissionRatePercent: true,
            product: {
              select: {
                commissionPercent: true,
              },
            },
          },
        })

        if (!baseSchedule) {
          throw new Error("Revenue schedule not found")
        }

        const recompute = await recomputeRevenueScheduleFromMatches(tx, revenueScheduleId, tenantId, {
          varianceTolerance,
        })

        const expectedRatePercent = normalizeRatePercent(
          (baseSchedule as any).expectedCommissionRatePercent ?? baseSchedule.product?.commissionPercent ?? null,
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

        if (!rateDiscrepancy?.isMaterial || rateDiscrepancy.direction !== "lower") {
          throw new Error("No lower-than-expected commission rate discrepancy found")
        }

        const usageAligned = isUsageWithinTolerance({
          expectedUsageNet: recompute.expectedUsageNet,
          usageBalance: recompute.usageBalance,
          varianceTolerance,
        })
        if (!usageAligned) {
          throw new Error("Low-rate exceptions can only be routed after usage is within tolerance")
        }

        const lowRateException = await ensureLowRateException(tx, {
          tenantId,
          userId: req.user.id,
          revenueScheduleId: baseSchedule.id,
          scheduleNumber: (baseSchedule.scheduleNumber ?? baseSchedule.id).trim() || baseSchedule.id,
          depositId,
          depositLineItemId: lineId,
          opportunityId: baseSchedule.opportunityId ?? null,
          accountId: baseSchedule.accountId ?? null,
          distributorAccountId: baseSchedule.distributorAccountId ?? null,
          vendorAccountId: baseSchedule.vendorAccountId ?? null,
          expectedRatePercent: rateDiscrepancy.expectedRatePercent,
          receivedRatePercent: rateDiscrepancy.receivedRatePercent,
          differencePercent: rateDiscrepancy.differencePercent,
          remainingCommissionDifference: recompute.commissionDifference,
        })

        const review = buildCommissionAmountReview({
          revenueScheduleId: baseSchedule.id,
          scheduleNumber: (baseSchedule.scheduleNumber ?? baseSchedule.id).trim() || baseSchedule.id,
          scheduleDate: baseSchedule.scheduleDate ? baseSchedule.scheduleDate.toISOString() : null,
          remainingCommissionDifference: recompute.commissionDifference,
          hasPendingRateResolution: false,
          lowRateExceptionRouted: true,
          queuePath: LOW_RATE_EXCEPTION_QUEUE_PATH,
          ticketId: lowRateException.ticketId,
        })

        return {
          previousScheduleValues: {
            billingStatus: baseSchedule.billingStatus,
            billingStatusSource: baseSchedule.billingStatusSource,
            billingStatusReason: baseSchedule.billingStatusReason,
          },
          rateDiscrepancy,
          lowRateException,
          review,
        }
      })

      await logRevenueScheduleAudit(
        AuditAction.Update,
        revenueScheduleId,
        req.user.id,
        tenantId,
        request,
        result.previousScheduleValues,
        {
          billingStatus: "InDispute",
          billingStatusSource: "Auto",
          billingStatusReason: `LowRateException:${lineId}`,
        },
      )

      await logAudit({
        userId: req.user.id,
        tenantId,
        action: AuditAction.Update,
        entityName: "DepositLineItem",
        entityId: lineId,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        metadata: {
          action: "CreateLowRateCommissionException",
          depositId,
          depositLineItemId: lineId,
          revenueScheduleId,
          ticketId: result.lowRateException.ticketId,
          queuePath: result.lowRateException.queuePath,
          reusedTicket: result.lowRateException.reusedTicket,
          rateDiscrepancy: result.rateDiscrepancy,
        },
      })

      return NextResponse.json({
        data: {
          rateDiscrepancy: result.rateDiscrepancy,
          lowRateException: result.lowRateException,
          commissionAmountReview: result.review,
        },
      })
    } catch (error) {
      console.error("Failed to create low-rate exception", error)
      return createErrorResponse(error instanceof Error ? error.message : "Failed to create low-rate exception", 400)
    }
  })
}
