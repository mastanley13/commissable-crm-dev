import { NextRequest, NextResponse } from "next/server"
import {
  DepositLineItemStatus,
  DepositLineMatchSource,
  DepositLineMatchStatus,
  AuditAction,
  RevenueScheduleFlexReasonCode,
} from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { logMatchingMetric } from "@/lib/matching/metrics"
import { getClientIP, getUserAgent, logAudit, logRevenueScheduleAudit } from "@/lib/audit"
import { evaluateFlexDecision } from "@/lib/flex/revenue-schedule-flex-decision"
import { recomputeDepositLineItemAllocations } from "@/lib/matching/deposit-line-allocations"
import { autoFillFromDepositMatch } from "@/lib/matching/auto-fill"
import {
  createFlexChargebackForNegativeLine,
  executeFlexAdjustmentSplit,
} from "@/lib/flex/revenue-schedule-flex-actions"
import { isBonusLikeProduct } from "@/lib/flex/bonus-detection"

interface ApplyMatchRequestBody {
  revenueScheduleId: string
  usageAmount?: number
  commissionAmount?: number
  confidenceScore?: number
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

    const body = (await request.json().catch(() => null)) as ApplyMatchRequestBody | null
    if (!body || !body.revenueScheduleId) {
      return createErrorResponse("revenueScheduleId is required", 400)
    }

    const revenueScheduleId = body.revenueScheduleId.trim()
    const usageAmount = Number.isFinite(body.usageAmount) ? Number(body.usageAmount) : undefined
    const commissionAmount = Number.isFinite(body.commissionAmount)
      ? Number(body.commissionAmount)
      : undefined
    const confidenceScore =
      typeof body.confidenceScore === "number" ? body.confidenceScore : undefined

    const lineItem = await prisma.depositLineItem.findFirst({
      where: { id: lineId, depositId, tenantId },
      include: { deposit: true },
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
    })
    if (!schedule) {
      return createErrorResponse("Revenue schedule not found", 404)
    }

    const allocationUsage = usageAmount ?? Number(lineItem.usage ?? 0)
    const allocationCommission = commissionAmount ?? Number(lineItem.commission ?? 0)

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)
    const ipAddress = getClientIP(request)
    const userAgent = getUserAgent(request)

    const result = await prisma.$transaction(async tx => {
      const hasNegativeLine =
        allocationUsage < 0 ||
        allocationCommission < 0 ||
        Number(lineItem.usage ?? 0) < 0 ||
        Number(lineItem.commission ?? 0) < 0

      if (hasNegativeLine) {
        const flexExecution = await createFlexChargebackForNegativeLine(tx, {
          tenantId,
          userId: req.user.id,
          depositId,
          lineItemId: lineItem.id,
          varianceTolerance,
          request,
        })

        const updatedLine = await tx.depositLineItem.findFirst({ where: { id: lineItem.id } })
        const deposit = await recomputeDepositAggregates(tx, depositId, tenantId)

        return {
          match: null,
          updatedLine,
          deposit,
          revenueSchedule: null,
          flexExecution,
        }
      }

      const existingAppliedMatches = await tx.depositLineMatch.findMany({
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
        throw new Error("Usage allocation exceeds the remaining unallocated usage amount")
      }
      if (allocationCommission > remainingCommission + EPSILON) {
        throw new Error("Commission allocation exceeds the remaining unallocated commission amount")
      }

      const match = await tx.depositLineMatch.upsert({
        where: {
          depositLineItemId_revenueScheduleId: {
            depositLineItemId: lineItem.id,
            revenueScheduleId,
          },
        },
        create: {
          tenantId,
          depositLineItemId: lineItem.id,
          revenueScheduleId,
          usageAmount: allocationUsage,
          commissionAmount: allocationCommission,
          confidenceScore,
          status: DepositLineMatchStatus.Applied,
          source: DepositLineMatchSource.Manual,
        },
        update: {
          usageAmount: allocationUsage,
          commissionAmount: allocationCommission,
          confidenceScore,
          status: DepositLineMatchStatus.Applied,
          source: DepositLineMatchSource.Manual,
        },
      })

      const updatedLine = await recomputeDepositLineItemAllocations(tx, lineItem.id, tenantId)

      try {
        await autoFillFromDepositMatch(tx, {
          tenantId,
          userId: req.user.id,
          depositId,
          depositLineItemId: lineItem.id,
          revenueScheduleId,
          depositLineMatchId: match.id,
          ipAddress,
          userAgent,
        })
      } catch (error) {
        console.error("Failed to auto-fill IDs/metadata from matched deposit line", error)
      }

      let revenueSchedule = await recomputeRevenueScheduleFromMatches(tx, revenueScheduleId, tenantId, {
        varianceTolerance,
      })

      const scheduleMeta = await tx.revenueSchedule.findFirst({
        where: { tenantId, id: revenueScheduleId },
        select: {
          product: {
            select: {
              revenueType: true,
              productFamilyHouse: true,
              productNameHouse: true,
            },
          },
        },
      })
      const isBonusLike = isBonusLikeProduct({
        revenueType: scheduleMeta?.product?.revenueType ?? null,
        productFamilyHouse: scheduleMeta?.product?.productFamilyHouse ?? null,
        productNameHouse: scheduleMeta?.product?.productNameHouse ?? null,
      })

      const flexDecision = evaluateFlexDecision({
        expectedUsageNet: revenueSchedule.expectedUsageNet,
        usageBalance: revenueSchedule.usageBalance,
        varianceTolerance,
        hasNegativeLine: false,
        isBonusLike,
        expectedCommissionNet: revenueSchedule.expectedCommissionNet,
        commissionDifference: revenueSchedule.commissionDifference,
      })

      let flexExecution = null as any

      if (flexDecision.action === "auto_adjust") {
        const usageOverage = flexDecision.usageOverage
        const commissionOverage = revenueSchedule.commissionDifference < 0 ? Math.abs(revenueSchedule.commissionDifference) : 0

        flexExecution = await executeFlexAdjustmentSplit(tx, {
          tenantId,
          userId: req.user.id,
          depositId,
          lineItemId: lineItem.id,
          baseScheduleId: revenueScheduleId,
          splitUsage: usageOverage,
          splitCommission: commissionOverage,
          varianceTolerance,
          request,
          reasonCode: RevenueScheduleFlexReasonCode.OverageWithinTolerance,
        })

        revenueSchedule = await recomputeRevenueScheduleFromMatches(tx, revenueScheduleId, tenantId, {
          varianceTolerance,
        })
      }

      const deposit = await recomputeDepositAggregates(tx, depositId, tenantId)

      return { match, updatedLine: updatedLine.line, deposit, revenueSchedule, flexDecision, flexExecution }
    })

    await logMatchingMetric({
      tenantId,
      userId: req.user.id,
      event: "manual_match",
      depositId,
      lineItemId: lineItem.id,
      scheduleId: revenueScheduleId,
      confidence: confidenceScore,
      source: DepositLineMatchSource.Manual,
      request,
    })

    if (result?.match?.id && result?.revenueSchedule?.schedule) {
      await logRevenueScheduleAudit(
        AuditAction.Update,
        revenueScheduleId,
        req.user.id,
        tenantId,
        request,
        {
          status: schedule.status ?? null,
          actualUsage: schedule.actualUsage ?? null,
          actualCommission: schedule.actualCommission ?? null,
        },
        {
          action: "ApplyDepositMatch",
          depositId,
          depositLineItemId: lineItem.id,
          depositLineMatchId: result.match.id,
          allocatedUsage: allocationUsage,
          allocatedCommission: allocationCommission,
          status: result.revenueSchedule.schedule.status,
          actualUsage: result.revenueSchedule.schedule.actualUsage,
          actualCommission: result.revenueSchedule.schedule.actualCommission,
          usageBalance: result.revenueSchedule.usageBalance,
          commissionDifference: result.revenueSchedule.commissionDifference,
          matchCount: result.revenueSchedule.matchCount,
        },
      )
    }

    await logAudit({
      userId: req.user.id,
      tenantId,
      action: result?.match?.id ? AuditAction.Update : AuditAction.Create,
      entityName: "DepositLineMatch",
      entityId: result?.match?.id ?? lineItem.id,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
      metadata: {
        action: result?.match?.id ? "Allocate" : "FlexChargeback",
        depositId,
        depositLineItemId: lineItem.id,
        revenueScheduleId,
        usageAmount: allocationUsage,
        commissionAmount: allocationCommission,
        confidenceScore,
        source: DepositLineMatchSource.Manual,
        flexDecision: result?.flexDecision ? JSON.parse(JSON.stringify(result.flexDecision)) : null,
        flexExecution: result?.flexExecution ? JSON.parse(JSON.stringify(result.flexExecution)) : null,
      },
    })

    return NextResponse.json({ data: result })
  })
}
