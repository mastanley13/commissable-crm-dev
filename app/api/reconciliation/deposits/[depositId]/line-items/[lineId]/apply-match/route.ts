import { NextRequest, NextResponse } from "next/server"
import {
  DepositLineItemStatus,
  DepositLineMatchSource,
  DepositLineMatchStatus,
  AuditAction,
} from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import {
  getTenantRateDiscrepancyTolerancePercent,
  getTenantVarianceTolerance,
} from "@/lib/matching/settings"
import { logMatchingMetric } from "@/lib/matching/metrics"
import { getClientIP, getUserAgent, logAudit, logRevenueScheduleAudit } from "@/lib/audit"
import { evaluateFlexDecision } from "@/lib/flex/revenue-schedule-flex-decision"
import { recomputeDepositLineItemAllocations } from "@/lib/matching/deposit-line-allocations"
import { autoFillFromDepositMatch } from "@/lib/matching/auto-fill"
import { findCrossDealGuardIssues } from "@/lib/matching/cross-deal-guard"
import { createFlexChargebackForNegativeLine } from "@/lib/flex/revenue-schedule-flex-actions"
import { isBonusLikeProduct } from "@/lib/flex/bonus-detection"
import {
  findFutureSchedulesInScope,
  resolveScheduleScopeKey,
} from "@/lib/reconciliation/future-schedules"
import { recordFieldUndoLog } from "@/lib/reconciliation/undo-log"
import {
  buildRateDiscrepancySummary,
  deriveReceivedRatePercent,
  normalizeRatePercent,
} from "@/lib/reconciliation/rate-discrepancy"

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
      include: {
        deposit: true,
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
      include: {
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

    const allocationUsage = usageAmount ?? Number(lineItem.usage ?? 0)
    const allocationCommission = commissionAmount ?? Number(lineItem.commission ?? 0)

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)
    const rateDiscrepancyTolerancePercent = await getTenantRateDiscrepancyTolerancePercent(tenantId)
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

      const scheduleContext = await tx.revenueSchedule.findFirst({
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
          vendor: { select: { accountName: true } },
          distributor: { select: { accountName: true } },
          usageAdjustment: true,
          expectedCommissionAdjustment: true,
          expectedCommissionRatePercent: true,
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
        throw new Error("Revenue schedule not found")
      }

      const isBonusLike = isBonusLikeProduct({
        revenueType: scheduleContext.product?.revenueType ?? null,
        productFamilyHouse: scheduleContext.product?.productFamilyHouse ?? null,
        productNameHouse: scheduleContext.product?.productNameHouse ?? null,
      })

      const expectedRatePercent = normalizeRatePercent(
        (scheduleContext as any).expectedCommissionRatePercent ?? scheduleContext.product?.commissionPercent ?? null,
      )
      const receivedRatePercent = deriveReceivedRatePercent({
        usageAmount: revenueSchedule.schedule.actualUsage,
        commissionAmount: revenueSchedule.schedule.actualCommission,
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
            const futureSchedules = await findFutureSchedulesInScope(tx, {
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
            console.warn("Failed to compute future schedule scope for commission rate discrepancy prompt", error)
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

      const flexDecision = evaluateFlexDecision({
        expectedUsageNet: revenueSchedule.expectedUsageNet,
        usageBalance: revenueSchedule.usageBalance,
        varianceTolerance,
        hasNegativeLine: false,
        isBonusLike,
        expectedCommissionNet: revenueSchedule.expectedCommissionNet,
        commissionDifference: rateDiscrepancy ? 0 : revenueSchedule.commissionDifference,
      })

      let flexExecution = null as any
      let withinToleranceAdjustment = null as any

      if (flexDecision.action === "auto_adjust") {
        const usageOverage = flexDecision.usageOverage
        const commissionOverage =
          rateDiscrepancy
            ? 0
            : revenueSchedule.commissionDifference < 0
              ? Math.abs(revenueSchedule.commissionDifference)
              : 0

        if (usageOverage > EPSILON || commissionOverage > EPSILON) {
          const previousUsageAdjustment = toNumber(scheduleContext.usageAdjustment)
          const previousExpectedCommissionAdjustment = toNumber(scheduleContext.expectedCommissionAdjustment)

          const nextUsageAdjustment =
            usageOverage > EPSILON ? Number((previousUsageAdjustment + usageOverage).toFixed(2)) : previousUsageAdjustment
          const nextExpectedCommissionAdjustment =
            commissionOverage > EPSILON
              ? Number((previousExpectedCommissionAdjustment + commissionOverage).toFixed(2))
              : previousExpectedCommissionAdjustment

          if (
            Math.abs(nextUsageAdjustment - previousUsageAdjustment) > EPSILON ||
            Math.abs(nextExpectedCommissionAdjustment - previousExpectedCommissionAdjustment) > EPSILON
          ) {
            await tx.revenueSchedule.update({
              where: { id: revenueScheduleId },
              data: {
                usageAdjustment: nextUsageAdjustment,
                expectedCommissionAdjustment: nextExpectedCommissionAdjustment,
              },
            })

            await recordFieldUndoLog(tx, {
              tenantId,
              depositId,
              depositLineItemId: lineItem.id,
              targetEntityName: "RevenueSchedule",
              targetEntityId: revenueScheduleId,
              relatedRevenueScheduleIds: [revenueScheduleId],
              createdById: req.user.id,
              fields: {
                usageAdjustment: {
                  previousValue: scheduleContext.usageAdjustment ?? null,
                  nextValue: nextUsageAdjustment,
                },
                expectedCommissionAdjustment: {
                  previousValue: scheduleContext.expectedCommissionAdjustment ?? null,
                  nextValue: nextExpectedCommissionAdjustment,
                },
              },
            })

            await logRevenueScheduleAudit(
              AuditAction.Update,
              revenueScheduleId,
              req.user.id,
              tenantId,
              request,
              {
                usageAdjustment: scheduleContext.usageAdjustment ?? null,
                expectedCommissionAdjustment: scheduleContext.expectedCommissionAdjustment ?? null,
              },
              {
                action: "WithinToleranceVarianceAutoAdjustment",
                depositId,
                depositLineItemId: lineItem.id,
                usageDelta: usageOverage,
                commissionDelta: commissionOverage,
                usageAdjustment: nextUsageAdjustment,
                expectedCommissionAdjustment: nextExpectedCommissionAdjustment,
              },
            )
          }

          revenueSchedule = await recomputeRevenueScheduleFromMatches(tx, revenueScheduleId, tenantId, {
            varianceTolerance,
          })

          let future = { count: 0, schedules: [] as Array<{ id: string; scheduleNumber: string | null; scheduleDate: string | null }> }
          let scope = null as any
          if (scheduleContext.scheduleDate) {
            try {
              scope = resolveScheduleScopeKey(scheduleContext)
              const futureSchedules = await findFutureSchedulesInScope(tx, {
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
              console.warn("Failed to compute future schedule scope for within-tolerance adjustment prompt", error)
            }
          }

          withinToleranceAdjustment = {
            applied: true,
            revenueScheduleId,
            scheduleNumber: (scheduleContext.scheduleNumber ?? scheduleContext.id ?? "").trim() || scheduleContext.id,
            scheduleDate: scheduleContext.scheduleDate ? scheduleContext.scheduleDate.toISOString() : null,
            usageDelta: usageOverage,
            commissionDelta: commissionOverage,
            future,
            scope,
          }
        }
      }

      const deposit = await recomputeDepositAggregates(tx, depositId, tenantId)

      return {
        match,
        updatedLine: updatedLine.line,
        deposit,
        revenueSchedule,
        flexDecision,
        flexExecution,
        withinToleranceAdjustment,
        rateDiscrepancy,
      }
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
          rateDiscrepancy: result?.rateDiscrepancy ? JSON.parse(JSON.stringify(result.rateDiscrepancy)) : null,
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
        rateDiscrepancy: result?.rateDiscrepancy ? JSON.parse(JSON.stringify(result.rateDiscrepancy)) : null,
      },
    })

    return NextResponse.json({ data: result })
  })
}
