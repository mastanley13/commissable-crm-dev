import { NextRequest, NextResponse } from "next/server"
import { AuditAction, DepositLineItemStatus } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { recomputeRevenueSchedules } from "@/lib/matching/revenue-schedule-status"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { logRevenueScheduleAudit } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UNDO_MATCH_PERMISSIONS = ["revenue-schedules.manage", "opportunities.manage"]

type UndoMatchBody = {
  matchIds?: string[]
}

export async function POST(request: NextRequest) {
  return withPermissions(request, UNDO_MATCH_PERMISSIONS, async req => {
    try {
      const body = (await request.json().catch(() => null)) as UndoMatchBody | null
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const matchIds = Array.isArray(body.matchIds)
        ? body.matchIds.filter(id => typeof id === "string" && id.trim().length > 0)
        : []

      if (matchIds.length === 0) {
        return NextResponse.json(
          { error: "matchIds must be a non-empty array of ids" },
          { status: 400 },
        )
      }

      const tenantId = req.user.tenantId

      const matches = await prisma.depositLineMatch.findMany({
        where: {
          id: { in: matchIds },
          tenantId,
        },
        select: {
          id: true,
          depositLineItemId: true,
          revenueScheduleId: true,
        },
      })

      if (matches.length === 0) {
        return NextResponse.json({
          updated: 0,
          failed: matchIds,
          errors: Object.fromEntries(
            matchIds.map(id => [id, "Deposit match not found for tenant"]),
          ),
        })
      }

      const lineIds = Array.from(
        new Set(matches.map(match => match.depositLineItemId).filter(Boolean)),
      )

      const varianceTolerance = await getTenantVarianceTolerance(tenantId)

      const errors: Record<string, string> = {}
      const failed: string[] = []
      let updated = 0

      for (const lineId of lineIds) {
        try {
          const scheduleIdsForLine = matches
            .filter(match => match.depositLineItemId === lineId)
            .map(match => match.revenueScheduleId)
            .filter((id): id is string => typeof id === "string" && id.length > 0)

          await prisma.$transaction(async tx => {
            const lineItem = await tx.depositLineItem.findFirst({
              where: { id: lineId, tenantId },
            })

            if (!lineItem) {
              throw new Error("Deposit line item not found")
            }

            const existingMatches = await tx.depositLineMatch.findMany({
              where: { depositLineItemId: lineItem.id, tenantId },
              select: { revenueScheduleId: true },
            })

            await tx.depositLineMatch.deleteMany({
              where: { depositLineItemId: lineItem.id, tenantId },
            })

            await tx.depositLineItem.update({
              where: { id: lineItem.id },
              data: {
                status: DepositLineItemStatus.Unmatched,
                primaryRevenueScheduleId: null,
                usageAllocated: 0,
                usageUnallocated: lineItem.usage ?? 0,
                commissionAllocated: 0,
                commissionUnallocated: lineItem.commission ?? 0,
              },
            })

            await recomputeDepositAggregates(tx, lineItem.depositId, tenantId)

            if (existingMatches.length > 0) {
              const scheduleIds = existingMatches.map(match => match.revenueScheduleId)
              const results = await recomputeRevenueSchedules(
                tx,
                scheduleIds,
                tenantId,
                { varianceTolerance },
              )

              for (const result of results) {
                const scheduleId = result.schedule.id

                await logRevenueScheduleAudit(
                  AuditAction.Update,
                  scheduleId,
                  req.user.id,
                  tenantId,
                  request,
                  {},
                  {
                    action: "UndoDepositMatch",
                    actualUsage: result.schedule.actualUsage,
                    actualCommission: result.schedule.actualCommission,
                    usageBalance: result.usageBalance,
                    commissionDifference: result.commissionDifference,
                  },
                )
              }
            }
          })

          if (scheduleIdsForLine.length > 0) {
            updated += 1
          }
        } catch (error) {
          failed.push(lineId)
          errors[lineId] =
            error instanceof Error ? error.message : "Failed to undo deposit match"
        }
      }

      return NextResponse.json({ updated, failed, errors })
    } catch (error) {
      console.error("Failed to undo deposit matches", error)
      return NextResponse.json(
        { error: "Unable to undo deposit matches" },
        { status: 500 },
      )
    }
  })
}
