import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { logRevenueScheduleAudit } from "@/lib/audit"
import { roundCurrency } from "@/lib/revenue-schedule-calculations"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BULK_UPDATE_PERMISSIONS = ["revenue-schedules.manage", "opportunities.manage"]

type BulkUpdatePatch = {
  quantity?: number
  priceEach?: number
  expectedUsageAdjustment?: number
  expectedCommissionRatePercent?: number
  expectedCommissionAdjustment?: number
}

type BulkUpdateBody = {
  ids: string[]
  patch: BulkUpdatePatch
  effectiveDate?: string
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const parseEffectiveDate = (value: unknown): Date | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function POST(request: NextRequest) {
  return withPermissions(request, BULK_UPDATE_PERMISSIONS, async (req) => {
    try {
      const body = (await request.json().catch(() => null)) as BulkUpdateBody | null
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const ids = Array.isArray(body.ids)
        ? body.ids.filter((id) => typeof id === "string" && id.trim().length > 0)
        : []

      if (ids.length === 0) {
        return NextResponse.json(
          { error: "ids must be a non-empty array of schedule ids" },
          { status: 400 },
        )
      }

      const patch = body.patch ?? {}
      const hasPatchFields = Object.values(patch).some(
        (value) => value !== undefined && value !== null,
      )
      if (!hasPatchFields) {
        return NextResponse.json(
          { error: "patch must include at least one supported field" },
          { status: 400 },
        )
      }

      const effectiveDate = parseEffectiveDate(body.effectiveDate)
      if (body.effectiveDate !== undefined && body.effectiveDate !== null && effectiveDate === null) {
        return NextResponse.json(
          { error: "effectiveDate must be a valid date (YYYY-MM-DD)" },
          { status: 400 },
        )
      }

      const tenantId = req.user.tenantId
      const schedules = await prisma.revenueSchedule.findMany({
        where: { id: { in: ids }, tenantId },
        include: {
          opportunityProduct: {
            select: { id: true, quantity: true, unitPrice: true, expectedUsage: true },
          },
          product: {
            select: { id: true, commissionPercent: true, priceEach: true },
          },
        },
      })

      const foundIds = new Set(schedules.map((s) => s.id))
      const failed: string[] = ids.filter((id) => !foundIds.has(id))
      const skipped: string[] = []
      const errors: Record<string, string> = {}
      let updated = 0

      for (const schedule of schedules) {
        if (effectiveDate) {
          const scheduleDate = (schedule as any).scheduleDate as Date | null | undefined
          if (!scheduleDate || scheduleDate.getTime() < effectiveDate.getTime()) {
            skipped.push(schedule.id)
            continue
          }
        }

        const nextQuantity = isFiniteNumber(patch.quantity) ? patch.quantity : null
        const nextPriceEach = isFiniteNumber(patch.priceEach) ? patch.priceEach : null
        const nextUsageAdj = isFiniteNumber(patch.expectedUsageAdjustment) ? patch.expectedUsageAdjustment : null
        const nextRatePercent = isFiniteNumber(patch.expectedCommissionRatePercent)
          ? patch.expectedCommissionRatePercent
          : null
        const nextCommissionAdj = isFiniteNumber(patch.expectedCommissionAdjustment)
          ? patch.expectedCommissionAdjustment
          : null

        if (!schedule.opportunityProductId && (nextQuantity !== null || nextPriceEach !== null)) {
          errors[schedule.id] = "Cannot apply quantity/price updates: schedule has no opportunityProductId"
          failed.push(schedule.id)
          continue
        }

        const previousAuditValues: Record<string, unknown> = {}
        const nextAuditValues: Record<string, unknown> = {}
        const txOps: any[] = []

        // Update OpportunityProduct (quantity / price). This is shared across schedules for the same line item,
        // but qty/unit price are used as inputs for recomputing schedule expected values.
        if (schedule.opportunityProductId) {
          const oppProductUpdate: Record<string, number> = {}

          if (nextQuantity !== null) {
            oppProductUpdate.quantity = nextQuantity
            previousAuditValues.quantity = toNullableNumber((schedule.opportunityProduct as any)?.quantity)
            nextAuditValues.quantity = nextQuantity
          }

          if (nextPriceEach !== null) {
            oppProductUpdate.unitPrice = nextPriceEach
            previousAuditValues.priceEach = toNullableNumber((schedule.opportunityProduct as any)?.unitPrice)
            nextAuditValues.priceEach = nextPriceEach
          }

          if (Object.keys(oppProductUpdate).length > 0) {
            txOps.push(
              prisma.opportunityProduct.update({
                where: { id: schedule.opportunityProductId },
                data: oppProductUpdate,
              }),
            )
          }
        }

        const scheduleUpdate: Record<string, any> = {}

        // Schedule-owned inputs
        if (nextUsageAdj !== null) {
          scheduleUpdate.usageAdjustment = nextUsageAdj
          previousAuditValues.expectedUsageAdjustment = toNullableNumber((schedule as any)?.usageAdjustment)
          nextAuditValues.expectedUsageAdjustment = nextUsageAdj
        }

        if (nextRatePercent !== null) {
          scheduleUpdate.expectedCommissionRatePercent = nextRatePercent
          previousAuditValues.expectedCommissionRatePercent = toNullableNumber(
            (schedule as any)?.expectedCommissionRatePercent,
          )
          nextAuditValues.expectedCommissionRatePercent = nextRatePercent
        }

        if (nextCommissionAdj !== null) {
          scheduleUpdate.expectedCommissionAdjustment = nextCommissionAdj
          previousAuditValues.expectedCommissionAdjustment = toNullableNumber(
            (schedule as any)?.expectedCommissionAdjustment,
          )
          nextAuditValues.expectedCommissionAdjustment = nextCommissionAdj
        }

        // Recompute persisted derived fields when upstream inputs change.
        const shouldRecomputeUsage = nextQuantity !== null || nextPriceEach !== null
        const shouldRecomputeCommission = shouldRecomputeUsage || nextRatePercent !== null

        const resolvedQuantity =
          nextQuantity !== null
            ? nextQuantity
            : toNullableNumber((schedule.opportunityProduct as any)?.quantity)

        const resolvedUnitPrice =
          nextPriceEach !== null
            ? nextPriceEach
            : toNullableNumber((schedule.opportunityProduct as any)?.unitPrice) ??
              toNullableNumber((schedule.product as any)?.priceEach)

        if (shouldRecomputeUsage) {
          if (!isFiniteNumber(resolvedQuantity) || !isFiniteNumber(resolvedUnitPrice)) {
            errors[schedule.id] = "Unable to recompute expected usage: missing quantity or price"
            failed.push(schedule.id)
            continue
          }

          const expectedUsageGross = roundCurrency(resolvedQuantity * resolvedUnitPrice)
          scheduleUpdate.expectedUsage = expectedUsageGross
          previousAuditValues.expectedUsage = toNullableNumber((schedule as any)?.expectedUsage)
          nextAuditValues.expectedUsage = expectedUsageGross
        }

        if (shouldRecomputeCommission) {
          const baseUsage =
            toNullableNumber(scheduleUpdate.expectedUsage) ??
            toNullableNumber((schedule as any)?.expectedUsage) ??
            toNullableNumber((schedule.opportunityProduct as any)?.expectedUsage)

          const resolvedRatePercent = nextRatePercent !== null
            ? nextRatePercent
            : toNullableNumber((schedule as any)?.expectedCommissionRatePercent) ??
              toNullableNumber((schedule.product as any)?.commissionPercent)

          if (isFiniteNumber(baseUsage) && isFiniteNumber(resolvedRatePercent)) {
            const expectedCommissionGross = roundCurrency(baseUsage * (resolvedRatePercent / 100))
            scheduleUpdate.expectedCommission = expectedCommissionGross
            previousAuditValues.expectedCommission = toNullableNumber((schedule as any)?.expectedCommission)
            nextAuditValues.expectedCommission = expectedCommissionGross
          }
        }

        if (Object.keys(scheduleUpdate).length > 0) {
          scheduleUpdate.updatedById = req.user.id
          txOps.push(
            prisma.revenueSchedule.update({
              where: { id: schedule.id },
              data: scheduleUpdate,
            }),
          )
        }

        if (txOps.length === 0) {
          continue
        }

        try {
          await prisma.$transaction(txOps)
          updated += 1

          if (Object.keys(nextAuditValues).length > 0) {
            await logRevenueScheduleAudit(
              AuditAction.Update,
              schedule.id,
              req.user.id,
              tenantId,
              request,
              previousAuditValues,
              { action: "BulkUpdate", ...nextAuditValues },
            )
          }
        } catch (error) {
          errors[schedule.id] = error instanceof Error ? error.message : "Failed to update schedule"
          failed.push(schedule.id)
        }
      }

      return NextResponse.json({ updated, failed, skipped, errors })
    } catch (error) {
      console.error("Failed to bulk update revenue schedules", error)
      return NextResponse.json({ error: "Failed to bulk update revenue schedules" }, { status: 500 })
    }
  })
}
