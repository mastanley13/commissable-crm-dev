import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getClientIP, getUserAgent, logAudit } from "@/lib/audit"
import {
  applyExpectedDeltasToFutureSchedules,
  findFutureSchedulesInScope,
  resolveScheduleScopeKey,
} from "@/lib/reconciliation/future-schedules"

interface ApplyWithinToleranceToFutureRequestBody {
  revenueScheduleId: string
  usageDelta: number
  commissionDelta: number
}

const EPSILON = 0.005

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
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

    const body = (await request.json().catch(() => null)) as ApplyWithinToleranceToFutureRequestBody | null
    if (!body?.revenueScheduleId?.trim()) {
      return createErrorResponse("revenueScheduleId is required", 400)
    }

    const revenueScheduleId = body.revenueScheduleId.trim()
    const usageDelta = toNumber(body.usageDelta)
    const commissionDelta = toNumber(body.commissionDelta)

    if (usageDelta < -EPSILON || commissionDelta < -EPSILON) {
      return createErrorResponse("Deltas cannot be negative", 400)
    }
    if (Math.abs(usageDelta) <= EPSILON && Math.abs(commissionDelta) <= EPSILON) {
      return createErrorResponse("No delta found to apply", 400)
    }

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

    const result = await prisma.$transaction(async tx => {
      const baseSchedule = await tx.revenueSchedule.findFirst({
        where: { id: revenueScheduleId, tenantId, deletedAt: null },
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

      const scope = resolveScheduleScopeKey(baseSchedule)
      const futureSchedules = await findFutureSchedulesInScope(tx, {
        tenantId,
        baseScheduleId: baseSchedule.id,
        baseScheduleDate: baseSchedule.scheduleDate,
        scope,
        excludeAllocated: true,
      })

      const futureUpdate = await applyExpectedDeltasToFutureSchedules(tx, {
        tenantId,
        userId: req.user.id,
        request,
        schedules: futureSchedules,
        usageDelta,
        commissionDelta,
        sourceScheduleId: baseSchedule.id,
        depositId,
        depositLineItemId: lineId,
      })

      return { futureUpdate }
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
        action: "ApplyWithinToleranceExpectedDeltaToFutureSchedules",
        depositId,
        depositLineItemId: lineId,
        revenueScheduleId,
        usageDelta,
        commissionDelta,
        futureUpdatedCount: result.futureUpdate?.updatedScheduleIds?.length ?? 0,
        futureUpdatedScheduleIds: result.futureUpdate?.updatedScheduleIds ?? [],
      },
    })

    return NextResponse.json({ data: result })
  })
}
