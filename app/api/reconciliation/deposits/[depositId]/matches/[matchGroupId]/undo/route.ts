import { NextRequest, NextResponse } from "next/server"
import { DepositMatchGroupStatus } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { recomputeDepositLineItemAllocations } from "@/lib/matching/deposit-line-allocations"
import { recomputeRevenueSchedules } from "@/lib/matching/revenue-schedule-status"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"

type UndoRequestBody = {
  reason?: string | null
}

export async function POST(
  request: NextRequest,
  { params }: { params: { depositId: string; matchGroupId: string } },
) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const depositId = params?.depositId?.trim()
    const matchGroupId = params?.matchGroupId?.trim()
    const tenantId = req.user.tenantId

    if (!depositId || !matchGroupId) {
      return createErrorResponse("depositId and matchGroupId are required", 400)
    }

    const body = (await request.json().catch(() => null)) as UndoRequestBody | null
    const undoReason = body?.reason?.trim() || null

    const group = await prisma.depositMatchGroup.findFirst({
      where: { id: matchGroupId, tenantId, depositId },
      select: { id: true, status: true },
    })
    if (!group) {
      return createErrorResponse("Match group not found", 404)
    }
    if (group.status === DepositMatchGroupStatus.Undone) {
      return createErrorResponse("Match group is already undone", 400)
    }

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)

    const result = await prisma.$transaction(async tx => {
      const matches = await tx.depositLineMatch.findMany({
        where: { tenantId, matchGroupId },
        select: { depositLineItemId: true, revenueScheduleId: true },
      })

      const lineIds = Array.from(new Set(matches.map(match => match.depositLineItemId)))
      const scheduleIds = Array.from(new Set(matches.map(match => match.revenueScheduleId)))

      await tx.depositLineMatch.deleteMany({ where: { tenantId, matchGroupId } })

      await tx.depositMatchGroup.update({
        where: { id: matchGroupId },
        data: {
          status: DepositMatchGroupStatus.Undone,
          undoneAt: new Date(),
          undoneByUserId: req.user.id,
          undoReason: undoReason ?? undefined,
        },
        select: { id: true },
      })

      const recomputedLines = []
      for (const lineId of lineIds) {
        const updated = await recomputeDepositLineItemAllocations(tx, lineId, tenantId)
        recomputedLines.push(updated)
      }

      const recomputedSchedules = await recomputeRevenueSchedules(tx, scheduleIds, tenantId, {
        varianceTolerance,
      })

      const deposit = await recomputeDepositAggregates(tx, depositId, tenantId)

      return { deposit, lineIds, scheduleIds, lines: recomputedLines, schedules: recomputedSchedules }
    })

    return NextResponse.json({ data: result })
  })
}

