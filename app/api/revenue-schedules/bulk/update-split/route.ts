import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { logRevenueScheduleAudit } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BULK_UPDATE_SPLIT_PERMISSIONS = ["revenue-schedules.manage", "opportunities.manage"]

type SplitBody = {
  scheduleIds?: string[]
  effectiveDate?: string
  splits?: {
    house?: number | null
    houseRep?: number | null
    subagent?: number | null
  }
  scope?: "selection" | "series"
}

function parsePercent(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }
  if (numeric < 0 || numeric > 100) {
    return null
  }
  return numeric
}

export async function POST(request: NextRequest) {
  return withPermissions(request, BULK_UPDATE_SPLIT_PERMISSIONS, async req => {
    try {
      const body = (await request.json().catch(() => null)) as SplitBody | null
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const scheduleIds = Array.isArray(body.scheduleIds)
        ? body.scheduleIds.filter(id => typeof id === "string" && id.trim().length > 0)
        : []

      if (scheduleIds.length === 0) {
        return NextResponse.json(
          { error: "scheduleIds must be a non-empty array of ids" },
          { status: 400 }
        )
      }

      const splits = body.splits ?? {}
      const house = parsePercent(splits.house)
      const houseRep = parsePercent(splits.houseRep)
      const subagent = parsePercent(splits.subagent)

      if (splits.house !== undefined && house === null) {
        return NextResponse.json(
          { error: "House % must be between 0 and 100" },
          { status: 400 }
        )
      }

      if (splits.houseRep !== undefined && houseRep === null) {
        return NextResponse.json(
          { error: "House Rep % must be between 0 and 100" },
          { status: 400 }
        )
      }

      if (splits.subagent !== undefined && subagent === null) {
        return NextResponse.json(
          { error: "Subagent % must be between 0 and 100" },
          { status: 400 }
        )
      }

      const resolvedHouse = house ?? 0
      const resolvedHouseRep = houseRep ?? 0
      const resolvedSubagent = subagent ?? 0
      const total = resolvedHouse + resolvedHouseRep + resolvedSubagent

      if (Math.abs(total - 100) > 0.01) {
        return NextResponse.json(
          { error: "Commission splits must total 100%" },
          { status: 400 }
        )
      }

      const tenantId = req.user.tenantId

      const schedules = await prisma.revenueSchedule.findMany({
        where: {
          id: { in: scheduleIds },
          tenantId
        },
        select: {
          id: true,
          houseSplitPercentOverride: true,
          houseRepSplitPercentOverride: true,
          subagentSplitPercentOverride: true,
          opportunity: {
            select: {
              houseSplitPercent: true,
              houseRepPercent: true,
              subagentPercent: true
            }
          }
        }
      })

      const errors: Record<string, string> = {}
      const failed: string[] = []
      let updated = 0

      const houseFraction = resolvedHouse / 100
      const houseRepFraction = resolvedHouseRep / 100
      const subagentFraction = resolvedSubagent / 100

      for (const schedule of schedules) {
        const previousSplits = {
          houseSplitPercent:
            schedule.houseSplitPercentOverride ?? schedule.opportunity?.houseSplitPercent ?? null,
          houseRepSplitPercent:
            schedule.houseRepSplitPercentOverride ?? schedule.opportunity?.houseRepPercent ?? null,
          subagentSplitPercent:
            schedule.subagentSplitPercentOverride ?? schedule.opportunity?.subagentPercent ?? null
        }

        try {
          await prisma.revenueSchedule.update({
            where: { id: schedule.id },
            data: {
              houseSplitPercentOverride: houseFraction,
              houseRepSplitPercentOverride: houseRepFraction,
              subagentSplitPercentOverride: subagentFraction,
              updatedById: req.user.id
            }
          })
          updated += 1

          await logRevenueScheduleAudit(
            AuditAction.Update,
            schedule.id,
            req.user.id,
            tenantId,
            request,
            previousSplits,
            {
              houseSplitPercent: houseFraction,
              houseRepSplitPercent: houseRepFraction,
              subagentSplitPercent: subagentFraction
            }
          )
        } catch (error) {
          failed.push(schedule.id)
          errors[schedule.id] =
            error instanceof Error ? error.message : "Failed to update commission splits"
        }
      }

      return NextResponse.json({ updated, failed, errors })
    } catch (error) {
      console.error("Failed to bulk update commission splits", error)
      return NextResponse.json(
        { error: "Unable to update commission splits" },
        { status: 500 }
      )
    }
  })
}
