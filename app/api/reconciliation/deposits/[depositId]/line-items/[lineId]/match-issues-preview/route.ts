import { NextRequest, NextResponse } from "next/server"
import { DepositLineItemStatus, DepositLineMatchStatus } from "@prisma/client"

import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import {
  getTenantRateDiscrepancyTolerancePercent,
  getTenantVarianceTolerance,
} from "@/lib/matching/settings"
import { evaluateFlexDecision } from "@/lib/flex/revenue-schedule-flex-decision"
import { isBonusLikeProduct } from "@/lib/flex/bonus-detection"
import { findCrossDealGuardIssues } from "@/lib/matching/cross-deal-guard"
import {
  findFutureSchedulesInScope,
  resolveScheduleScopeKey,
} from "@/lib/reconciliation/future-schedules"
import {
  buildRateDiscrepancySummary,
  deriveReceivedRatePercent,
  normalizeRatePercent,
} from "@/lib/reconciliation/rate-discrepancy"

interface PreviewMatchIssuesRequestBody {
  revenueScheduleId: string
  usageAmount?: number
  commissionAmount?: number
}

const EPSILON = 0.005

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
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

    const body = (await request.json().catch(() => null)) as PreviewMatchIssuesRequestBody | null
    if (!body?.revenueScheduleId?.trim()) {
      return createErrorResponse("revenueScheduleId is required", 400)
    }

    const revenueScheduleId = body.revenueScheduleId.trim()

    const lineItem = await prisma.depositLineItem.findFirst({
      where: { id: lineId, depositId, tenantId },
      select: {
        id: true,
        accountId: true,
        accountIdVendor: true,
        accountNameRaw: true,
        customerIdVendor: true,
        orderIdVendor: true,
        locationId: true,
        customerPurchaseOrder: true,
        usage: true,
        commission: true,
        reconciled: true,
        status: true,
        account: {
          select: {
            accountName: true,
            accountLegalName: true,
          },
        },
      },
    })
    if (!lineItem) {
      return createErrorResponse("Deposit line item not found", 404)
    }
    if (lineItem.reconciled) {
      return createErrorResponse("Reconciled line items cannot be changed", 400)
    }
    if (lineItem.status === DepositLineItemStatus.Ignored) {
      return createErrorResponse("Ignored line items cannot be allocated", 400)
    }

    const schedule = await prisma.revenueSchedule.findFirst({
      where: { id: revenueScheduleId, tenantId },
      select: {
        id: true,
        accountId: true,
        opportunityId: true,
        account: {
          select: {
            accountName: true,
            accountLegalName: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
    if (!schedule) {
      return createErrorResponse("Revenue schedule not found", 404)
    }

    const crossDealIssues = await findCrossDealGuardIssues(prisma, {
      tenantId,
      lines: [lineItem],
      schedules: [schedule],
    })
    if (crossDealIssues.length > 0) {
      return createErrorResponse(crossDealIssues[0]!.message, 400)
    }

    const allocationUsage = Number.isFinite(body.usageAmount) ? Number(body.usageAmount) : Number(lineItem.usage ?? 0)
    const allocationCommission = Number.isFinite(body.commissionAmount)
      ? Number(body.commissionAmount)
      : Number(lineItem.commission ?? 0)

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)
    const rateDiscrepancyTolerancePercent = await getTenantRateDiscrepancyTolerancePercent(tenantId)

    const existingAppliedMatches = await prisma.depositLineMatch.findMany({
      where: {
        tenantId,
        depositLineItemId: lineItem.id,
        status: DepositLineMatchStatus.Applied,
      },
      select: {
        revenueScheduleId: true,
        usageAmount: true,
        commissionAmount: true,
      },
    })

    const currentPair = existingAppliedMatches.find(match => match.revenueScheduleId === revenueScheduleId)
    const currentPairUsage = toNumber(currentPair?.usageAmount)
    const currentPairCommission = toNumber(currentPair?.commissionAmount)

    const otherUsageAllocated = existingAppliedMatches
      .filter(match => match.revenueScheduleId !== revenueScheduleId)
      .reduce((acc, match) => acc + toNumber(match.usageAmount), 0)
    const otherCommissionAllocated = existingAppliedMatches
      .filter(match => match.revenueScheduleId !== revenueScheduleId)
      .reduce((acc, match) => acc + toNumber(match.commissionAmount), 0)

    const lineUsage = toNumber(lineItem.usage)
    const lineCommission = toNumber(lineItem.commission)
    const remainingUsage = lineUsage - otherUsageAllocated
    const remainingCommission = lineCommission - otherCommissionAllocated

    if (allocationUsage > remainingUsage + EPSILON) {
      return createErrorResponse("Usage allocation exceeds the remaining unallocated usage amount", 400)
    }
    if (allocationCommission > remainingCommission + EPSILON) {
      return createErrorResponse("Commission allocation exceeds the remaining unallocated commission amount", 400)
    }

    const scheduleProjection = await recomputeRevenueScheduleFromMatches(prisma, revenueScheduleId, tenantId, {
      varianceTolerance,
    })

    const scheduleContext = await prisma.revenueSchedule.findFirst({
      where: { tenantId, id: revenueScheduleId, deletedAt: null },
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
            revenueType: true,
            productFamilyHouse: true,
            productNameHouse: true,
          },
        },
      },
    })
    if (!scheduleContext) {
      return createErrorResponse("Revenue schedule not found", 404)
    }

    const usageDelta = roundCurrency(allocationUsage - currentPairUsage)
    const commissionDelta = roundCurrency(allocationCommission - currentPairCommission)

    const projectedActualUsage = roundCurrency(toNumber(scheduleProjection.schedule.actualUsage) + usageDelta)
    const projectedActualCommission = roundCurrency(toNumber(scheduleProjection.schedule.actualCommission) + commissionDelta)
    const projectedUsageBalance = roundCurrency(scheduleProjection.usageBalance - usageDelta)
    const projectedCommissionDifference = roundCurrency(
      scheduleProjection.commissionDifference - commissionDelta,
    )

    const expectedRatePercent = normalizeRatePercent(
      (scheduleContext as any).expectedCommissionRatePercent ?? scheduleContext.product?.commissionPercent ?? null,
    )
    const receivedRatePercent = deriveReceivedRatePercent({
      usageAmount: projectedActualUsage,
      commissionAmount: projectedActualCommission,
    })
    const rateDiscrepancySummary = buildRateDiscrepancySummary({
      expectedRatePercent,
      receivedRatePercent,
      tolerancePercent: rateDiscrepancyTolerancePercent,
    })

    let rateDiscrepancy = null as null | {
      revenueScheduleId: string
      scheduleNumber: string
      scheduleDate: string | null
      expectedRatePercent: number
      receivedRatePercent: number
      differencePercent: number
      tolerancePercent: number
      future: {
        count: number
        schedules: Array<{ id: string; scheduleNumber: string | null; scheduleDate: string | null }>
      }
    }

    if (rateDiscrepancySummary?.isMaterial) {
      let future = {
        count: 0,
        schedules: [] as Array<{ id: string; scheduleNumber: string | null; scheduleDate: string | null }>,
      }

      if (scheduleContext.scheduleDate) {
        try {
          const scope = resolveScheduleScopeKey(scheduleContext)
          const futureSchedules = await findFutureSchedulesInScope(prisma, {
            tenantId,
            baseScheduleId: scheduleContext.id,
            baseScheduleDate: scheduleContext.scheduleDate,
            scope,
            excludeAllocated: true,
          })

          future = {
            count: futureSchedules.length,
            schedules: futureSchedules.slice(0, 5).map(row => ({
              id: row.id,
              scheduleNumber: row.scheduleNumber ?? null,
              scheduleDate: row.scheduleDate ? row.scheduleDate.toISOString() : null,
            })),
          }
        } catch (error) {
          console.warn("Failed to compute future schedule scope for commission rate discrepancy preview", error)
        }
      }

      rateDiscrepancy = {
        revenueScheduleId,
        scheduleNumber: (scheduleContext.scheduleNumber ?? scheduleContext.id ?? "").trim() || scheduleContext.id,
        scheduleDate: scheduleContext.scheduleDate ? scheduleContext.scheduleDate.toISOString() : null,
        expectedRatePercent: rateDiscrepancySummary.expectedRatePercent,
        receivedRatePercent: rateDiscrepancySummary.receivedRatePercent,
        differencePercent: rateDiscrepancySummary.differencePercent,
        tolerancePercent: rateDiscrepancySummary.tolerancePercent,
        future,
      }
    }

    const isBonusLike = isBonusLikeProduct({
      revenueType: scheduleContext.product?.revenueType ?? null,
      productFamilyHouse: scheduleContext.product?.productFamilyHouse ?? null,
      productNameHouse: scheduleContext.product?.productNameHouse ?? null,
    })

    const flexDecision = evaluateFlexDecision({
      expectedUsageNet: scheduleProjection.expectedUsageNet,
      usageBalance: projectedUsageBalance,
      varianceTolerance,
      hasNegativeLine: allocationUsage < 0 || allocationCommission < 0 || lineUsage < 0 || lineCommission < 0,
      isBonusLike,
      expectedCommissionNet: scheduleProjection.expectedCommissionNet,
      commissionDifference: rateDiscrepancy ? 0 : projectedCommissionDifference,
    })

    return NextResponse.json({
      data: {
        requiresConfirmation: Boolean(rateDiscrepancy) || flexDecision.action === "prompt",
        allocationUsage,
        allocationCommission,
        usageDelta,
        commissionDelta,
        projected: {
          actualUsage: projectedActualUsage,
          actualCommission: projectedActualCommission,
          usageBalance: projectedUsageBalance,
          commissionDifference: projectedCommissionDifference,
        },
        flexDecision,
        rateDiscrepancy,
      },
    })
  })
}
