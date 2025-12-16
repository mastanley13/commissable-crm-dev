import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { AuditAction, RevenueScheduleStatus } from "@prisma/client"
import { logRevenueScheduleAudit } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BULK_DEACTIVATE_PERMISSIONS = ["revenue-schedules.manage", "opportunities.manage"]

type BulkDeactivateBody = {
  scheduleIds?: string[]
  reason?: string | null
  scope?: "selection" | "series"
}

export async function POST(request: NextRequest) {
  return withPermissions(request, BULK_DEACTIVATE_PERMISSIONS, async req => {
    try {
      const body = (await request.json().catch(() => null)) as BulkDeactivateBody | null
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const scheduleIds = Array.isArray(body.scheduleIds)
        ? body.scheduleIds.filter(id => typeof id === "string" && id.trim().length > 0)
        : []

      if (scheduleIds.length === 0) {
        return NextResponse.json({ error: "scheduleIds must be a non-empty array of ids" }, { status: 400 })
      }

      const tenantId = req.user.tenantId
      const reasonText = typeof body.reason === "string" ? body.reason.trim() : ""

      const schedules = await prisma.revenueSchedule.findMany({
        where: { id: { in: scheduleIds }, tenantId },
        select: {
          id: true,
          scheduleNumber: true,
          status: true,
          actualUsage: true,
          actualUsageAdjustment: true,
          actualCommission: true,
          actualCommissionAdjustment: true,
          notes: true
        }
      })

      const foundIds = new Set(schedules.map(s => s.id))
      const failed: string[] = scheduleIds.filter(id => !foundIds.has(id))
      const errors: Record<string, string> = {}
      let updated = 0

      for (const schedule of schedules) {
        const usageFields = [
          schedule.actualUsage,
          schedule.actualUsageAdjustment,
          schedule.actualCommission,
          schedule.actualCommissionAdjustment
        ]

        const hasAppliedMonies = usageFields.some(val => {
          if (val === null || val === undefined) return false
          const n = Number(val)
          return Number.isFinite(n) && Math.abs(n) > 0.0001
        })

        const [matchCount, reconCount, primaryDepositCount] = await Promise.all([
          prisma.depositLineMatch.count({ where: { tenantId, revenueScheduleId: schedule.id } }),
          prisma.reconciliationItem.count({ where: { tenantId, revenueScheduleId: schedule.id } }),
          prisma.depositLineItem.count({ where: { tenantId, primaryRevenueScheduleId: schedule.id } })
        ])

        if (hasAppliedMonies || matchCount > 0 || reconCount > 0 || primaryDepositCount > 0) {
          const label = schedule.scheduleNumber ?? schedule.id
          const reason = hasAppliedMonies
            ? "has usage or commission applied"
            : matchCount > 0
              ? "has deposit matches"
              : reconCount > 0
                ? "is in reconciliation"
                : "is linked to deposit lines"

          failed.push(schedule.id)
          errors[schedule.id] = `Cannot deactivate revenue schedule ${label} because it ${reason}.`
          continue
        }

        if (schedule.status === RevenueScheduleStatus.Reconciled) {
          // Already effectively inactive
          continue
        }

        try {
          const previousValues: Record<string, unknown> = {
            scheduleNumber: schedule.scheduleNumber ?? null,
            status: schedule.status,
            notes: schedule.notes ?? null
          }

          const updatedSchedule = await prisma.revenueSchedule.update({
            where: { id: schedule.id },
            data: {
              status: RevenueScheduleStatus.Reconciled,
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
            previousValues,
            {
              scheduleNumber: schedule.scheduleNumber ?? null,
              status: updatedSchedule.status,
              notes: schedule.notes ?? null,
              deactivationReason: reasonText || null
            }
          )
        } catch (error) {
          failed.push(schedule.id)
          errors[schedule.id] =
            error instanceof Error ? error.message : "Failed to deactivate revenue schedule"
        }
      }

      return NextResponse.json({ updated, failed, errors })
    } catch (error) {
      console.error("Failed to deactivate revenue schedules", error)
      return NextResponse.json({ error: "Failed to deactivate revenue schedules" }, { status: 500 })
    }
  })
}
