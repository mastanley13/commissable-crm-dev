import { NextRequest, NextResponse } from "next/server"
import { AuditAction, DepositLineMatchSource, DepositLineMatchStatus, DepositMatchGroupStatus, DepositMatchType } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { recomputeDepositLineItemAllocations } from "@/lib/matching/deposit-line-allocations"
import { recomputeRevenueSchedules } from "@/lib/matching/revenue-schedule-status"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { buildMatchGroupPreview, type MatchGroupAllocationInput } from "@/lib/matching/match-group-preview"
import type { MatchSelectionType } from "@/lib/matching/match-selection"
import { autoFillFromDepositMatch } from "@/lib/matching/auto-fill"
import { getClientIP, getUserAgent, logAudit, logRevenueScheduleAudit } from "@/lib/audit"
import { logMatchingMetric } from "@/lib/matching/metrics"

type ApplyRequestBody = {
  matchType: MatchSelectionType
  lineIds: string[]
  scheduleIds: string[]
  allocations?: MatchGroupAllocationInput[] | null
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

export async function POST(
  request: NextRequest,
  { params }: { params: { depositId: string } },
) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const depositId = params?.depositId?.trim()
    const tenantId = req.user.tenantId

    if (!depositId) {
      return createErrorResponse("depositId is required", 400)
    }

    const body = (await request.json().catch(() => null)) as ApplyRequestBody | null
    if (!body) {
      return createErrorResponse("Request body is required", 400)
    }
    if (!body.matchType) {
      return createErrorResponse("matchType is required", 400)
    }
    if (!Array.isArray(body.lineIds) || body.lineIds.length === 0) {
      return createErrorResponse("lineIds is required", 400)
    }
    if (!Array.isArray(body.scheduleIds) || body.scheduleIds.length === 0) {
      return createErrorResponse("scheduleIds is required", 400)
    }

    const preview = await buildMatchGroupPreview(prisma, {
      tenantId,
      depositId,
      matchType: body.matchType,
      lineIds: body.lineIds,
      scheduleIds: body.scheduleIds,
      allocations: body.allocations,
    })

    if (!preview.ok) {
      return NextResponse.json({ error: "Preview validation failed", issues: preview.issues }, { status: 400 })
    }

    const allocations = preview.normalizedAllocations.filter(
      allocation => allocation.usageAmount !== 0 || allocation.commissionAmount !== 0,
    )
    if (allocations.length === 0) {
      return NextResponse.json({ error: "No non-zero allocations provided." }, { status: 400 })
    }

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)
    const ipAddress = getClientIP(request)
    const userAgent = getUserAgent(request)

    const result = await prisma.$transaction(async tx => {
      const schedulesBefore =
        preview.scheduleIds.length > 0
          ? await tx.revenueSchedule.findMany({
              where: { tenantId, id: { in: preview.scheduleIds } },
              select: { id: true, status: true, actualUsage: true, actualCommission: true },
            })
          : []

      const group = await tx.depositMatchGroup.create({
        data: {
          tenantId,
          depositId,
          matchType: body.matchType as unknown as DepositMatchType,
          status: DepositMatchGroupStatus.Applied,
          createdByUserId: req.user.id,
        },
        select: { id: true, matchType: true, status: true, createdAt: true },
      })

      const existingMatchesBefore: Array<{
        id: string
        depositLineItemId: string
        revenueScheduleId: string
        usageAmount: number
        commissionAmount: number
        status: DepositLineMatchStatus
        source: DepositLineMatchSource
        matchGroupId: string | null
      }> = []

      const existingMatchByPairKey = new Map<
        string,
        {
          id: string
          depositLineItemId: string
          revenueScheduleId: string
          usageAmount: unknown
          commissionAmount: unknown
          status: DepositLineMatchStatus
          source: DepositLineMatchSource
          matchGroupId: string | null
        }
      >()

      if (allocations.length > 0) {
        const allocationLineIds = Array.from(new Set(allocations.map(allocation => allocation.lineId)))
        const allocationScheduleIds = Array.from(new Set(allocations.map(allocation => allocation.scheduleId)))

        const existingPairs = await tx.depositLineMatch.findMany({
          where: {
            tenantId,
            depositLineItemId: { in: allocationLineIds },
            revenueScheduleId: { in: allocationScheduleIds },
          },
          select: {
            id: true,
            depositLineItemId: true,
            revenueScheduleId: true,
            usageAmount: true,
            commissionAmount: true,
            status: true,
            source: true,
            matchGroupId: true,
          },
        })

        for (const row of existingPairs) {
          existingMatchByPairKey.set(`${row.depositLineItemId}:${row.revenueScheduleId}`, row)
        }
      }

      const autoFillAuditLogIds: string[] = []

      const capturedExistingMatchKeys = new Set<string>()
      for (const allocation of allocations) {
        const pairKey = `${allocation.lineId}:${allocation.scheduleId}`
        const existing = existingMatchByPairKey.get(pairKey)
        if (existing && !capturedExistingMatchKeys.has(pairKey)) {
          capturedExistingMatchKeys.add(pairKey)
          existingMatchesBefore.push({
            id: existing.id,
            depositLineItemId: existing.depositLineItemId,
            revenueScheduleId: existing.revenueScheduleId,
            usageAmount: toNumber(existing.usageAmount),
            commissionAmount: toNumber(existing.commissionAmount),
            status: existing.status,
            source: existing.source,
            matchGroupId: existing.matchGroupId ?? null,
          })
        }

        const match = await tx.depositLineMatch.upsert({
          where: {
            depositLineItemId_revenueScheduleId: {
              depositLineItemId: allocation.lineId,
              revenueScheduleId: allocation.scheduleId,
            },
          },
          create: {
            tenantId,
            depositLineItemId: allocation.lineId,
            revenueScheduleId: allocation.scheduleId,
            usageAmount: allocation.usageAmount,
            commissionAmount: allocation.commissionAmount,
            status: DepositLineMatchStatus.Applied,
            source: DepositLineMatchSource.Manual,
            matchGroupId: group.id,
          },
          update: {
            usageAmount: allocation.usageAmount,
            commissionAmount: allocation.commissionAmount,
            status: DepositLineMatchStatus.Applied,
            source: DepositLineMatchSource.Manual,
            matchGroupId: group.id,
          },
          select: { id: true, depositLineItemId: true, revenueScheduleId: true },
        })

        try {
          const autoFill = await autoFillFromDepositMatch(tx, {
            tenantId,
            userId: req.user.id,
            depositId,
            depositLineItemId: match.depositLineItemId,
            revenueScheduleId: match.revenueScheduleId,
            depositLineMatchId: match.id,
            ipAddress,
            userAgent,
          })
          autoFillAuditLogIds.push(...(autoFill.auditLogIds ?? []))
        } catch (error) {
          console.error("Failed to auto-fill IDs/metadata from grouped deposit match", error)
        }
      }

      const recomputedLines = []
      for (const lineId of preview.lineIds) {
        const updated = await recomputeDepositLineItemAllocations(tx, lineId, tenantId)
        recomputedLines.push(updated)
      }

      const recomputedSchedules = await recomputeRevenueSchedules(tx, preview.scheduleIds, tenantId, {
        varianceTolerance,
      })

      const deposit = await recomputeDepositAggregates(tx, depositId, tenantId)

      return {
        group,
        deposit,
        lines: recomputedLines,
        schedules: recomputedSchedules,
        schedulesBefore,
        autoFillAuditLogIds,
        existingMatchesBefore,
      }
    })

    await logMatchingMetric({
      tenantId,
      userId: req.user.id,
      event: "manual_match",
      depositId,
      request,
      metadata: {
        matchGroupId: result.group.id,
        matchType: String(preview.matchType),
        lineCount: preview.lineIds.length,
        scheduleCount: preview.scheduleIds.length,
        allocationCount: allocations.length,
      },
    })

    for (const scheduleResult of result.schedules ?? []) {
      const before = (result.schedulesBefore ?? []).find(row => row.id === scheduleResult.schedule.id)
      await logRevenueScheduleAudit(
        AuditAction.Update,
        scheduleResult.schedule.id,
        req.user.id,
        tenantId,
        request,
        {
          status: before?.status ?? null,
          actualUsage: before?.actualUsage ?? null,
          actualCommission: before?.actualCommission ?? null,
        },
        {
          action: "ApplyMatchGroup",
          depositId,
          matchGroupId: result.group.id,
          status: scheduleResult.schedule.status,
          actualUsage: scheduleResult.schedule.actualUsage,
          actualCommission: scheduleResult.schedule.actualCommission,
          usageBalance: scheduleResult.usageBalance,
          commissionDifference: scheduleResult.commissionDifference,
          matchCount: scheduleResult.matchCount,
        },
      )
    }

    await logAudit({
      userId: req.user.id,
      tenantId,
      action: AuditAction.Create,
      entityName: "DepositMatchGroup",
      entityId: result.group.id,
      ipAddress,
      userAgent,
      metadata: {
        action: "ApplyMatchGroup",
        depositId,
        matchGroupId: result.group.id,
        matchType: String(preview.matchType),
        lineIds: preview.lineIds,
        scheduleIds: preview.scheduleIds,
        allocationCount: allocations.length,
        existingMatchCount: (result as any).existingMatchesBefore?.length ?? 0,
        existingMatchesBefore: (result as any).existingMatchesBefore ?? [],
        autoFillAuditLogIds: (result as any).autoFillAuditLogIds ?? [],
      },
    })

    const { schedulesBefore: _schedulesBefore, existingMatchesBefore: _existingMatchesBefore, ...responseData } =
      result as any
    return NextResponse.json({ data: responseData })
  })
}
