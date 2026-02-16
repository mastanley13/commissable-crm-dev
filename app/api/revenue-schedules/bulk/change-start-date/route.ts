import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { logRevenueScheduleAudit } from "@/lib/audit"
import { formatDateOnlyUtc } from "@/lib/date-only"
import {
  diffMonthsUtc,
  parseDateInputToUtcDate,
  shiftScheduleDateMonthStartUtc,
  toMonthStartUtc,
} from "@/lib/revenue-schedule-date-shift"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BULK_CHANGE_START_DATE_PERMISSIONS = ["revenue-schedules.manage", "opportunities.manage"]

type ChangeStartDateBody = {
  scheduleIds?: string[]
  newStartDate?: string
  reason?: string
}

export async function POST(request: NextRequest) {
  return withPermissions(request, BULK_CHANGE_START_DATE_PERMISSIONS, async (req) => {
    try {
      const body = (await request.json().catch(() => null)) as ChangeStartDateBody | null
      if (!body || typeof body !== "object") {
        return createErrorResponse("Invalid request payload", 400)
      }

      const scheduleIds = Array.isArray(body.scheduleIds)
        ? body.scheduleIds.filter((id) => typeof id === "string" && id.trim().length > 0)
        : []

      if (scheduleIds.length === 0) {
        return createErrorResponse("scheduleIds must be a non-empty array of ids", 400)
      }

      const reason = typeof body.reason === "string" ? body.reason.trim() : ""
      if (!reason) {
        return createErrorResponse("reason is required", 400)
      }

      const newStartDateText = typeof body.newStartDate === "string" ? body.newStartDate.trim() : ""
      const newStartDateRaw = newStartDateText ? parseDateInputToUtcDate(newStartDateText) : null
      if (!newStartDateRaw) {
        return createErrorResponse("newStartDate must be a valid date (YYYY-MM-DD)", 400)
      }

      const newStartDate = toMonthStartUtc(newStartDateRaw)
      const tenantId = req.user.tenantId

      const schedules = await prisma.revenueSchedule.findMany({
        where: { id: { in: scheduleIds }, tenantId },
        select: {
          id: true,
          productId: true,
          scheduleDate: true,
        },
      })

      const foundIds = new Set(schedules.map((s) => s.id))
      const missing = scheduleIds.filter((id) => !foundIds.has(id))
      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: "Some schedules were not found.",
            updated: 0,
            failed: missing,
            errors: Object.fromEntries(missing.map((id) => [id, "Not found"])),
          },
          { status: 404 },
        )
      }

      const productIds = new Set<string>()
      const schedulesMissingProduct: string[] = []
      const schedulesMissingDates: string[] = []

      for (const schedule of schedules) {
        if (!schedule.productId) {
          schedulesMissingProduct.push(schedule.id)
        } else {
          productIds.add(schedule.productId)
        }
        if (!schedule.scheduleDate || Number.isNaN(schedule.scheduleDate.getTime())) {
          schedulesMissingDates.push(schedule.id)
        }
      }

      if (schedulesMissingProduct.length > 0) {
        return createErrorResponse(
          `All selected schedules must belong to a single product (missing productId for ${schedulesMissingProduct.length} schedule${schedulesMissingProduct.length === 1 ? "" : "s"}).`,
          400,
        )
      }

      if (productIds.size !== 1) {
        return createErrorResponse("All selected schedules must belong to a single product.", 400)
      }

      if (schedulesMissingDates.length > 0) {
        return createErrorResponse(
          `Some selected schedules are missing schedule dates and cannot be shifted (${schedulesMissingDates.length}).`,
          400,
        )
      }

      const baselineDateRaw = schedules
        .map((s) => s.scheduleDate as Date)
        .sort((a, b) => a.getTime() - b.getTime())[0]

      const baselineDate = toMonthStartUtc(baselineDateRaw!)
      const deltaMonths = diffMonthsUtc(baselineDate, newStartDate)

      const proposedById = new Map<string, Date>()
      const proposedDates: Date[] = []
      const bucket: Record<string, string[]> = {}

      for (const schedule of schedules) {
        const nextDate = shiftScheduleDateMonthStartUtc(schedule.scheduleDate as Date, deltaMonths)
        proposedById.set(schedule.id, nextDate)
        proposedDates.push(nextDate)
        const key = formatDateOnlyUtc(nextDate)
        bucket[key] = bucket[key] ? [...bucket[key]!, schedule.id] : [schedule.id]
      }

      const internalCollisions = Object.entries(bucket).filter(([, ids]) => ids.length > 1)
      if (internalCollisions.length > 0) {
        const examples = internalCollisions
          .slice(0, 3)
          .map(([date, ids]) => `${date} (${ids.length})`)
          .join(", ")
        return createErrorResponse(
          `Shifting would create duplicate schedule dates within the selection. Example collisions: ${examples}`,
          400,
        )
      }

      const productId = Array.from(productIds)[0]!
      const externalCollisions = await prisma.revenueSchedule.findMany({
        where: {
          tenantId,
          productId,
          id: { notIn: scheduleIds },
          scheduleDate: { in: proposedDates },
        },
        select: { id: true, scheduleDate: true },
        take: 10,
      })

      if (externalCollisions.length > 0) {
        const examples = externalCollisions
          .slice(0, 3)
          .map((row) => `${formatDateOnlyUtc(row.scheduleDate)} (${row.id})`)
          .join(", ")
        return createErrorResponse(
          `Shifting would collide with existing schedules for this product. Example collisions: ${examples}`,
          400,
        )
      }

      const errors: Record<string, string> = {}
      const failed: string[] = []
      let updated = 0

      for (const schedule of schedules) {
        const nextDate = proposedById.get(schedule.id)!
        try {
          await prisma.revenueSchedule.update({
            where: { id: schedule.id, tenantId },
            data: {
              scheduleDate: nextDate,
              updatedById: req.user.id,
            },
            select: { id: true },
          })

          updated += 1

          await logRevenueScheduleAudit(
            AuditAction.Update,
            schedule.id,
            req.user.id,
            tenantId,
            request,
            { scheduleDate: schedule.scheduleDate ?? null },
            {
              scheduleDate: nextDate,
              action: "ChangeStartDate",
              reason,
              deltaMonths,
              baselineDate: formatDateOnlyUtc(baselineDate),
              newStartDate: formatDateOnlyUtc(newStartDate),
            },
          )
        } catch (error) {
          failed.push(schedule.id)
          errors[schedule.id] =
            error instanceof Error ? error.message : "Failed to update schedule date"
        }
      }

      return NextResponse.json({ updated, failed, errors, deltaMonths })
    } catch (error) {
      console.error("Failed to change revenue schedule start dates", error)
      return NextResponse.json({ error: "Unable to change start dates" }, { status: 500 })
    }
  })
}

