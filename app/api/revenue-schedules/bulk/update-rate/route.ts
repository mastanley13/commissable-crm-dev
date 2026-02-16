import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { logRevenueScheduleAudit } from "@/lib/audit"
import { roundCurrency } from "@/lib/revenue-schedule-calculations"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BULK_UPDATE_RATE_PERMISSIONS = ["revenue-schedules.manage", "opportunities.manage"]

type BulkUpdateRateBody = {
  scheduleIds?: string[]
  effectiveDate?: string
  ratePercent?: number | null
  scope?: "selection" | "series"
}

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export async function POST(request: NextRequest) {
  return withPermissions(request, BULK_UPDATE_RATE_PERMISSIONS, async (req) => {
    try {
      const body = (await request.json().catch(() => null)) as BulkUpdateRateBody | null
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const scheduleIds = Array.isArray(body.scheduleIds)
        ? body.scheduleIds.filter((id) => typeof id === "string" && id.trim().length > 0)
        : []

      if (scheduleIds.length === 0) {
        return NextResponse.json(
          { error: "scheduleIds must be a non-empty array of ids" },
          { status: 400 },
        )
      }

      const effectiveDateText = typeof body.effectiveDate === "string" ? body.effectiveDate.trim() : ""
      if (!effectiveDateText) {
        return NextResponse.json({ error: "effectiveDate is required" }, { status: 400 })
      }

      const effectiveDate = new Date(effectiveDateText)
      if (Number.isNaN(effectiveDate.getTime())) {
        return NextResponse.json({ error: "effectiveDate must be a valid date" }, { status: 400 })
      }

      const ratePercentRaw = body.ratePercent
      const ratePercent =
        typeof ratePercentRaw === "number" && Number.isFinite(ratePercentRaw) ? ratePercentRaw : null

      if (ratePercent === null) {
        return NextResponse.json({ error: "ratePercent must be a finite number" }, { status: 400 })
      }

      if (ratePercent < 0 || ratePercent > 100) {
        return NextResponse.json({ error: "ratePercent must be between 0 and 100" }, { status: 400 })
      }

      const tenantId = req.user.tenantId
      const schedules = await prisma.revenueSchedule.findMany({
        where: {
          id: { in: scheduleIds },
          tenantId,
          scheduleDate: { gte: effectiveDate },
        },
        include: {
          opportunityProduct: { select: { quantity: true, unitPrice: true, expectedUsage: true } },
          product: { select: { commissionPercent: true, priceEach: true } },
        },
      })

      if (schedules.length === 0) {
        return NextResponse.json({
          updated: 0,
          failed: scheduleIds,
          errors: Object.fromEntries(scheduleIds.map((id) => [id, "No schedules on or after effective date"])),
        })
      }

      const errors: Record<string, string> = {}
      const failed: string[] = []
      let updated = 0

      for (const schedule of schedules) {
        try {
          const previous: Record<string, unknown> = {
            expectedCommissionRatePercent: toNullableNumber((schedule as any).expectedCommissionRatePercent),
            expectedCommission: toNullableNumber((schedule as any).expectedCommission),
            expectedUsage: toNullableNumber((schedule as any).expectedUsage),
          }

          const fallbackQuantity = toNullableNumber((schedule.opportunityProduct as any)?.quantity)
          const fallbackUnitPrice =
            toNullableNumber((schedule.opportunityProduct as any)?.unitPrice) ??
            toNullableNumber((schedule.product as any)?.priceEach)

          const existingUsage = toNullableNumber((schedule as any).expectedUsage)
          const derivedUsage =
            fallbackQuantity !== null &&
            fallbackUnitPrice !== null &&
            Number.isFinite(fallbackQuantity) &&
            Number.isFinite(fallbackUnitPrice)
              ? roundCurrency(fallbackQuantity * fallbackUnitPrice)
              : null

          const expectedUsageGross = existingUsage ?? derivedUsage
          if (expectedUsageGross === null) {
            throw new Error("Unable to recompute commission: missing expected usage (qty/price)")
          }

          const expectedCommissionGross = roundCurrency(expectedUsageGross * (ratePercent / 100))

          await prisma.revenueSchedule.update({
            where: { id: schedule.id, tenantId },
            data: {
              expectedCommissionRatePercent: ratePercent,
              expectedCommission: expectedCommissionGross,
              ...(existingUsage === null && derivedUsage !== null ? { expectedUsage: derivedUsage } : {}),
              updatedById: req.user.id,
            } as any,
            select: { id: true },
          })

          updated += 1

          const next: Record<string, unknown> = {
            expectedCommissionRatePercent: ratePercent,
            expectedCommission: expectedCommissionGross,
            ...(existingUsage === null && derivedUsage !== null ? { expectedUsage: derivedUsage } : {}),
          }

          await logRevenueScheduleAudit(
            AuditAction.Update,
            schedule.id,
            req.user.id,
            tenantId,
            request,
            previous,
            { action: "BulkUpdateRate", ...next },
          )
        } catch (error) {
          failed.push(schedule.id)
          errors[schedule.id] = error instanceof Error ? error.message : "Failed to update commission rate"
        }
      }

      return NextResponse.json({ updated, failed, errors })
    } catch (error) {
      console.error("Failed to bulk update commission rates", error)
      return NextResponse.json({ error: "Unable to update commission rates" }, { status: 500 })
    }
  })
}

