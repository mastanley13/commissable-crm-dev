import { NextRequest, NextResponse } from "next/server"
import { DepositLineMatchSource, DepositLineMatchStatus, DepositMatchGroupStatus, DepositMatchType } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { recomputeDepositLineItemAllocations } from "@/lib/matching/deposit-line-allocations"
import { recomputeRevenueSchedules } from "@/lib/matching/revenue-schedule-status"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { buildMatchGroupPreview, type MatchGroupAllocationInput } from "@/lib/matching/match-group-preview"
import type { MatchSelectionType } from "@/lib/matching/match-selection"

type ApplyRequestBody = {
  matchType: MatchSelectionType
  lineIds: string[]
  scheduleIds: string[]
  allocations?: MatchGroupAllocationInput[] | null
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

    const result = await prisma.$transaction(async tx => {
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

      for (const allocation of allocations) {
        await tx.depositLineMatch.upsert({
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
        })
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
      }
    })

    return NextResponse.json({ data: result })
  })
}

