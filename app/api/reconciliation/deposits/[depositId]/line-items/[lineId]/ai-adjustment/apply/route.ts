import { NextRequest, NextResponse } from "next/server"
import { AuditAction, RevenueScheduleFlexReasonCode } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import { executeFlexAdjustmentSplit } from "@/lib/flex/revenue-schedule-flex-actions"
import { getClientIP, getUserAgent, logAudit } from "@/lib/audit"
import {
  applyExpectedDeltasToFutureSchedules,
  findFutureSchedulesInScope,
  resolveScheduleScopeKey,
} from "@/lib/reconciliation/future-schedules"

interface ApplyRequestBody {
  revenueScheduleId: string
  applyToFuture?: boolean
}

const EPSILON = 0.005

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

    const body = (await request.json().catch(() => null)) as ApplyRequestBody | null
    if (!body?.revenueScheduleId?.trim()) {
      return createErrorResponse("revenueScheduleId is required", 400)
    }

    const revenueScheduleId = body.revenueScheduleId.trim()
    const applyToFuture = Boolean(body.applyToFuture)

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

    const result = await prisma.$transaction(async tx => {
      const baseSchedule = await tx.revenueSchedule.findFirst({
        where: { id: revenueScheduleId, tenantId },
        select: {
          id: true,
          accountId: true,
          scheduleDate: true,
          opportunityProductId: true,
          productId: true,
          vendorAccountId: true,
          distributorAccountId: true,
          vendor: { select: { accountName: true } },
          distributor: { select: { accountName: true } },
          product: {
            select: {
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
        throw new Error("Revenue schedule date is required to apply future adjustments")
      }

      const recompute = await recomputeRevenueScheduleFromMatches(tx, revenueScheduleId, tenantId, {
        varianceTolerance,
      })

      const usageOverage = recompute.usageBalance < 0 ? Math.abs(recompute.usageBalance) : 0
      const commissionOverage = recompute.commissionDifference < 0 ? Math.abs(recompute.commissionDifference) : 0

      if (usageOverage <= EPSILON && commissionOverage <= EPSILON) {
        throw new Error("No overage found to adjust")
      }

      const flexExecution = await executeFlexAdjustmentSplit(tx, {
        tenantId,
        userId: req.user.id,
        depositId,
        lineItemId: lineId,
        baseScheduleId: revenueScheduleId,
        splitUsage: usageOverage,
        splitCommission: commissionOverage,
        varianceTolerance,
        request,
        reasonCode: RevenueScheduleFlexReasonCode.OverageOutsideTolerance,
      })

      let futureUpdate = { updatedScheduleIds: [] as string[] }
      if (applyToFuture) {
        const scope = resolveScheduleScopeKey(baseSchedule)
        const futureSchedules = await findFutureSchedulesInScope(tx, {
          tenantId,
          baseScheduleId: baseSchedule.id,
          baseScheduleDate: baseSchedule.scheduleDate,
          scope,
          excludeAllocated: true,
        })

        futureUpdate = await applyExpectedDeltasToFutureSchedules(tx, {
          tenantId,
          userId: req.user.id,
          request,
          schedules: futureSchedules,
          usageDelta: usageOverage,
          commissionDelta: commissionOverage,
          sourceScheduleId: baseSchedule.id,
          depositId,
          depositLineItemId: lineId,
        })
      }

      return {
        flexExecution,
        futureUpdate,
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
        action: "ApplyAIAdjustment",
        depositId,
        revenueScheduleId,
        applyToFuture,
        futureUpdatedCount: result.futureUpdate?.updatedScheduleIds?.length ?? 0,
        futureUpdatedScheduleIds: result.futureUpdate?.updatedScheduleIds ?? [],
        flexExecution: result.flexExecution ?? null,
      },
    })

    return NextResponse.json({ data: result })
  })
}
