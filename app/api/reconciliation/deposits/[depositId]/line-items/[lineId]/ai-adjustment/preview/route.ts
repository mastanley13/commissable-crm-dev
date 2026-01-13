import { NextRequest, NextResponse } from "next/server"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import {
  findFutureSchedulesInScope,
  findPriorOpenSchedulesInScope,
  resolveScheduleScopeKey,
} from "@/lib/reconciliation/future-schedules"

interface PreviewRequestBody {
  revenueScheduleId: string
}

const EPSILON = 0.005

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

    const body = (await request.json().catch(() => null)) as PreviewRequestBody | null
    if (!body?.revenueScheduleId?.trim()) {
      return createErrorResponse("revenueScheduleId is required", 400)
    }

    const revenueScheduleId = body.revenueScheduleId.trim()

    const lineItem = await prisma.depositLineItem.findFirst({
      where: { id: lineId, depositId, tenantId },
      select: { id: true },
    })
    if (!lineItem) {
      return createErrorResponse("Deposit line item not found", 404)
    }

    const baseSchedule = await prisma.revenueSchedule.findFirst({
      where: { id: revenueScheduleId, tenantId },
      select: {
        id: true,
        accountId: true,
        scheduleDate: true,
        status: true,
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
      return createErrorResponse("Revenue schedule not found", 404)
    }

    if (!baseSchedule.scheduleDate) {
      return createErrorResponse("Revenue schedule date is required to preview future adjustments", 400)
    }

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)
    const recompute = await recomputeRevenueScheduleFromMatches(prisma, revenueScheduleId, tenantId, {
      varianceTolerance,
    })

    const usageOverage = recompute.usageBalance < 0 ? Math.abs(recompute.usageBalance) : 0
    const commissionOverage = recompute.commissionDifference < 0 ? Math.abs(recompute.commissionDifference) : 0

    const scope = resolveScheduleScopeKey(baseSchedule)

    const [futureSchedules, priorSchedules] = await Promise.all([
      findFutureSchedulesInScope(prisma, {
        tenantId,
        baseScheduleId: baseSchedule.id,
        baseScheduleDate: baseSchedule.scheduleDate,
        scope,
        excludeAllocated: true,
      }),
      findPriorOpenSchedulesInScope(prisma, {
        tenantId,
        baseScheduleId: baseSchedule.id,
        baseScheduleDate: baseSchedule.scheduleDate,
        scope,
      }),
    ])

    const priorOpenScheduleIds = priorSchedules
      .filter(row => row.usageBalance > EPSILON || row.commissionDifference > EPSILON)
      .map(row => row.id)

    const suggestion =
      priorOpenScheduleIds.length > 0
        ? {
            type: "allocate" as const,
            reason: "Prior open schedules exist with remaining balance. Allocate across open schedules instead of adjusting expected.",
            priorOpenScheduleIds,
          }
        : {
            type: "adjust" as const,
            reason: "No prior open schedules detected. Create an adjustment to align expected with the observed payment.",
            priorOpenScheduleIds: [],
          }

    return NextResponse.json({
      data: {
        suggestion,
        base: {
          scheduleId: baseSchedule.id,
          scheduleDate: baseSchedule.scheduleDate.toISOString(),
          expectedUsageNet: recompute.expectedUsageNet,
          actualUsageNet: recompute.actualUsageNet,
          usageOverage,
          expectedCommissionNet: recompute.expectedCommissionNet,
          actualCommissionNet: recompute.actualCommissionNet,
          commissionOverage,
        },
        scope: {
          kind: scope.kind,
        },
        future: {
          count: futureSchedules.length,
          schedules: futureSchedules.map(schedule => ({
            id: schedule.id,
            scheduleNumber: schedule.scheduleNumber,
            scheduleDate: schedule.scheduleDate ? schedule.scheduleDate.toISOString() : null,
          })),
        },
      },
    })
  })
}

