import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import {
  getTenantRateDiscrepancyTolerancePercent,
  getTenantVarianceTolerance,
} from "@/lib/matching/settings"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import { getClientIP, getUserAgent, logAudit } from "@/lib/audit"
import {
  applyReceivedRateToSchedule,
  applyReceivedRateToFutureSchedules,
  findFutureSchedulesInScope,
  resolveScheduleScopeKey,
} from "@/lib/reconciliation/future-schedules"
import {
  buildRateDiscrepancySummary,
  deriveReceivedRatePercent,
  isUsageWithinTolerance,
  normalizeRatePercent,
} from "@/lib/reconciliation/rate-discrepancy"

interface ApplyRateDiscrepancyRequestBody {
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

    const body = (await request.json().catch(() => null)) as ApplyRateDiscrepancyRequestBody | null
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

    const result = await prisma.$transaction(async tx => {
      const baseSchedule = await tx.revenueSchedule.findFirst({
        where: { id: revenueScheduleId, tenantId, deletedAt: null },
        select: {
          id: true,
          scheduleNumber: true,
          scheduleDate: true,
          accountId: true,
          opportunityProductId: true,
          productId: true,
          vendorAccountId: true,
          distributorAccountId: true,
          expectedCommissionRatePercent: true,
          vendor: { select: { accountName: true } },
          distributor: { select: { accountName: true } },
          product: {
            select: {
              commissionPercent: true,
              productCode: true,
              partNumberVendor: true,
              partNumberDistributor: true,
              partNumberHouse: true,
            },
          },
        },
      })

      if (!baseSchedule) {
        throw new Error("Revenue schedule not found")
      }
      if (!baseSchedule.scheduleDate) {
        throw new Error("Revenue schedule date is required to update future schedule rates")
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

      if (!rateDiscrepancy?.isMaterial) {
        throw new Error("No material commission rate discrepancy found")
      }
      if (rateDiscrepancy.direction !== "higher") {
        throw new Error("Future schedule rate updates are only allowed for higher-than-expected commission rates")
      }

      const usageAligned = isUsageWithinTolerance({
        expectedUsageNet: recompute.expectedUsageNet,
        usageBalance: recompute.usageBalance,
        varianceTolerance,
      })
      if (!usageAligned) {
        throw new Error("Commission rate discrepancy updates only apply when usage is within tolerance")
      }

      const scope = resolveScheduleScopeKey(baseSchedule)
      const futureSchedules = await findFutureSchedulesInScope(tx, {
        tenantId,
        baseScheduleId: baseSchedule.id,
        baseScheduleDate: baseSchedule.scheduleDate,
        scope,
        excludeAllocated: true,
      })

      const currentUpdate = await applyReceivedRateToSchedule(tx, {
        tenantId,
        userId: req.user.id,
        request,
        scheduleId: baseSchedule.id,
        receivedRatePercent: rateDiscrepancy.receivedRatePercent,
        sourceScheduleId: baseSchedule.id,
        depositId,
        depositLineItemId: lineId,
        auditAction: "ApplyReceivedCommissionRateToCurrentSchedule",
      })

      const futureUpdate = await applyReceivedRateToFutureSchedules(tx, {
        tenantId,
        userId: req.user.id,
        request,
        schedules: futureSchedules,
        receivedRatePercent: rateDiscrepancy.receivedRatePercent,
        sourceScheduleId: baseSchedule.id,
        depositId,
        depositLineItemId: lineId,
      })

      return {
        currentUpdate,
        futureUpdate,
        rateDiscrepancy: {
          expectedRatePercent: rateDiscrepancy.expectedRatePercent,
          receivedRatePercent: rateDiscrepancy.receivedRatePercent,
          differencePercent: rateDiscrepancy.differencePercent,
          tolerancePercent: rateDiscrepancy.tolerancePercent,
          direction: rateDiscrepancy.direction,
        },
      }
    })

    await logAudit({
      userId: req.user.id,
      tenantId,
      action: AuditAction.Update,
      entityName: "DepositLineItem",
      entityId: lineId,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
      metadata: {
        action: "ApplyCommissionRateDiscrepancyToFutureSchedules",
        depositId,
        depositLineItemId: lineId,
        revenueScheduleId,
        rateDiscrepancy: result.rateDiscrepancy,
        currentUpdatedScheduleId: result.currentUpdate?.updatedScheduleId ?? null,
        futureUpdatedCount: result.futureUpdate?.updatedScheduleIds?.length ?? 0,
        futureUpdatedScheduleIds: result.futureUpdate?.updatedScheduleIds ?? [],
      },
    })

    return NextResponse.json({ data: result })
  })
}
