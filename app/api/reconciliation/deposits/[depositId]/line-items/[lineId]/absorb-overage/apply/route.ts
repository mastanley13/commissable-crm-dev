import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"

import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import { getClientIP, getUserAgent, logAudit } from "@/lib/audit"
import { normalizeRatePercent } from "@/lib/reconciliation/rate-discrepancy"

interface ApplyAbsorbRequestBody {
  revenueScheduleId: string
  applyToFuture?: boolean
}

const EPSILON = 0.005

function toNumber(value: unknown): number | null {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
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

    const body = (await request.json().catch(() => null)) as ApplyAbsorbRequestBody | null
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
        where: { id: revenueScheduleId, tenantId, deletedAt: null },
        select: {
          id: true,
          scheduleDate: true,
          opportunityProductId: true,
          expectedUsage: true,
          expectedCommission: true,
          expectedCommissionRatePercent: true,
          opportunityProduct: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              expectedUsage: true,
              expectedCommission: true,
            },
          },
          product: {
            select: {
              commissionPercent: true,
              priceEach: true,
            },
          },
        },
      })

      if (!baseSchedule) {
        throw new Error("Revenue schedule not found")
      }
      if (!baseSchedule.opportunityProductId) {
        throw new Error("Absorb into Price Each requires an opportunity product-backed schedule")
      }

      const quantity = toNumber(baseSchedule.opportunityProduct?.quantity)
      if (quantity === null || quantity <= EPSILON) {
        throw new Error("Absorb into Price Each requires a schedule quantity greater than zero")
      }

      const recompute = await recomputeRevenueScheduleFromMatches(tx, revenueScheduleId, tenantId, {
        varianceTolerance,
      })

      const usageOverage = recompute.usageBalance < 0 ? Math.abs(recompute.usageBalance) : 0
      if (usageOverage <= EPSILON) {
        throw new Error("No usage overage found to absorb")
      }

      const currentExpectedUsage =
        toNumber(baseSchedule.expectedUsage) ??
        toNumber(baseSchedule.opportunityProduct?.expectedUsage) ??
        roundCurrency(quantity * (toNumber(baseSchedule.opportunityProduct?.unitPrice) ?? toNumber(baseSchedule.product?.priceEach) ?? 0))

      const nextPriceEach = roundCurrency((currentExpectedUsage + usageOverage) / quantity)
      const targetSchedules = applyToFuture
        ? await tx.revenueSchedule.findMany({
            where: {
              tenantId,
              deletedAt: null,
              opportunityProductId: baseSchedule.opportunityProductId,
              scheduleDate: baseSchedule.scheduleDate ? { gte: baseSchedule.scheduleDate } : undefined,
              status: { not: "Reconciled" as any },
            },
            select: {
              id: true,
              expectedCommissionRatePercent: true,
              opportunityProduct: {
                select: {
                  quantity: true,
                },
              },
              product: {
                select: {
                  commissionPercent: true,
                },
              },
            },
          })
        : [
            {
              id: baseSchedule.id,
              expectedCommissionRatePercent: baseSchedule.expectedCommissionRatePercent,
              opportunityProduct: { quantity: baseSchedule.opportunityProduct?.quantity },
              product: { commissionPercent: baseSchedule.product?.commissionPercent },
            },
          ]

      await tx.opportunityProduct.update({
        where: { id: baseSchedule.opportunityProductId },
        data: { unitPrice: nextPriceEach },
      })

      const updatedScheduleIds: string[] = []
      for (const schedule of targetSchedules) {
        const scheduleQuantity = toNumber(schedule.opportunityProduct?.quantity) ?? quantity
        const nextExpectedUsage = roundCurrency(scheduleQuantity * nextPriceEach)
        const ratePercent = normalizeRatePercent(
          schedule.expectedCommissionRatePercent ?? schedule.product?.commissionPercent ?? null,
        )
        const nextExpectedCommission =
          ratePercent !== null ? roundCurrency(nextExpectedUsage * (ratePercent / 100)) : null

        await tx.revenueSchedule.update({
          where: { id: schedule.id },
          data: {
            expectedUsage: nextExpectedUsage,
            ...(nextExpectedCommission !== null ? { expectedCommission: nextExpectedCommission } : {}),
          } as any,
        })
        updatedScheduleIds.push(schedule.id)
      }

      return {
        updatedScheduleIds,
        nextPriceEach,
        usageOverage: roundCurrency(usageOverage),
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
        action: "AbsorbUsageOverageIntoPriceEach",
        depositId,
        revenueScheduleId,
        applyToFuture,
        nextPriceEach: result.nextPriceEach,
        usageOverage: result.usageOverage,
        updatedScheduleIds: result.updatedScheduleIds,
      },
    })

    return NextResponse.json({ data: result })
  })
}
