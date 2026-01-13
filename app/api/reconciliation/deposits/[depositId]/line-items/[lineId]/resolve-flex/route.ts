import { NextRequest, NextResponse } from "next/server"
import { RevenueScheduleFlexReasonCode } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import {
  executeFlexAdjustmentSplit,
  executeFlexProductSplit,
  type FlexResolveAction,
} from "@/lib/flex/revenue-schedule-flex-actions"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import {
  applyExpectedDeltasToFutureSchedules,
  findFutureSchedulesInScope,
  resolveScheduleScopeKey,
} from "@/lib/reconciliation/future-schedules"

interface ResolveFlexRequestBody {
  revenueScheduleId: string
  action: FlexResolveAction
  applyToFuture?: boolean
}

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

    const body = (await request.json().catch(() => null)) as ResolveFlexRequestBody | null
    if (!body?.revenueScheduleId?.trim()) {
      return createErrorResponse("revenueScheduleId is required", 400)
    }
    const action = body.action
    if (action !== "Adjust" && action !== "FlexProduct" && action !== "Manual") {
      return createErrorResponse("Invalid action", 400)
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

    const schedule = await prisma.revenueSchedule.findFirst({
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
    if (!schedule) {
      return createErrorResponse("Revenue schedule not found", 404)
    }

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)

    const result = await prisma.$transaction(async tx => {
      const base = await recomputeRevenueScheduleFromMatches(tx, revenueScheduleId, tenantId, {
        varianceTolerance,
      })

      const usageOverage = base.usageBalance < 0 ? Math.abs(base.usageBalance) : 0
      const commissionOverage = base.commissionDifference < 0 ? Math.abs(base.commissionDifference) : 0

      if (action === "Manual") {
        return {
          flexExecution: { applied: false, action, createdRevenueScheduleIds: [], createdProductIds: [] },
          baseSchedule: base,
        }
      }

      if (usageOverage <= 0.005 && commissionOverage <= 0.005) {
        throw new Error("No overage found to resolve")
      }

      const reasonCode = RevenueScheduleFlexReasonCode.OverageOutsideTolerance

      const flexExecution =
        action === "Adjust"
          ? await executeFlexAdjustmentSplit(tx, {
              tenantId,
              userId: req.user.id,
              depositId,
              lineItemId: lineId,
              baseScheduleId: revenueScheduleId,
              splitUsage: usageOverage,
              splitCommission: commissionOverage,
              varianceTolerance,
              request,
              reasonCode,
            })
          : await executeFlexProductSplit(tx, {
              tenantId,
              userId: req.user.id,
              depositId,
              lineItemId: lineId,
              baseScheduleId: revenueScheduleId,
              splitUsage: usageOverage,
              splitCommission: commissionOverage,
              varianceTolerance,
              request,
              reasonCode,
            })

      const updatedBase = await recomputeRevenueScheduleFromMatches(tx, revenueScheduleId, tenantId, {
        varianceTolerance,
      })

      let futureUpdate = { updatedScheduleIds: [] as string[] }
      if (applyToFuture && action === "Adjust") {
        if (!schedule.scheduleDate) {
          throw new Error("Revenue schedule date is required to apply future adjustments")
        }
        const scope = resolveScheduleScopeKey(schedule)
        const futureSchedules = await findFutureSchedulesInScope(tx, {
          tenantId,
          baseScheduleId: schedule.id,
          baseScheduleDate: schedule.scheduleDate,
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
          sourceScheduleId: schedule.id,
          depositId,
          depositLineItemId: lineId,
        })
      }

      return { flexExecution, baseSchedule: updatedBase, futureUpdate }
    })

    return NextResponse.json({ data: result })
  })
}
