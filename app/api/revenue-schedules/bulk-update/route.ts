import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"

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

export async function POST(request: NextRequest) {
  return withPermissions(request, BULK_UPDATE_PERMISSIONS, async req => {
    try {
      const body = (await request.json().catch(() => null)) as BulkUpdateBody | null
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const ids = Array.isArray(body.ids) ? body.ids.filter(id => typeof id === "string" && id.trim().length > 0) : []
      if (ids.length === 0) {
        return NextResponse.json({ error: "ids must be a non-empty array of schedule ids" }, { status: 400 })
      }

      const patch = body.patch ?? {}
      const hasPatchFields = Object.values(patch).some(value => value !== undefined && value !== null)
      if (!hasPatchFields) {
        return NextResponse.json({ error: "patch must include at least one supported field" }, { status: 400 })
      }

      const tenantId = req.user.tenantId
      const schedules = await prisma.revenueSchedule.findMany({
        where: { id: { in: ids }, tenantId },
        include: {
          opportunityProduct: true,
          product: { select: { id: true } }
        }
      })

      const foundIds = new Set(schedules.map(s => s.id))
      const failed: string[] = ids.filter(id => !foundIds.has(id))
      let updated = 0
      const errors: Record<string, string> = {}

      for (const schedule of schedules) {
        const txOps: any[] = []

        // Update OpportunityProduct (quantity / price)
        if (schedule.opportunityProductId) {
          const oppProductUpdate: Record<string, number> = {}
          if (isFiniteNumber(patch.quantity)) {
            oppProductUpdate.quantity = patch.quantity
          }
          if (isFiniteNumber(patch.priceEach)) {
            oppProductUpdate.unitPrice = patch.priceEach
          }
          if (Object.keys(oppProductUpdate).length > 0) {
            txOps.push(
              prisma.opportunityProduct.update({
                where: { id: schedule.opportunityProductId },
                data: oppProductUpdate
              })
            )
          }
        }

        // Update RevenueSchedule fields (usage adjustment)
        const scheduleUpdate: Record<string, number> = {}
        if (isFiniteNumber(patch.expectedUsageAdjustment)) {
          scheduleUpdate.usageAdjustment = patch.expectedUsageAdjustment
        }
        if (Object.keys(scheduleUpdate).length > 0) {
          txOps.push(
            prisma.revenueSchedule.update({
              where: { id: schedule.id },
              data: scheduleUpdate
            })
          )
        }

        // Update Product commission percent (expectedCommissionRatePercent)
        if (schedule.product?.id && isFiniteNumber(patch.expectedCommissionRatePercent)) {
          txOps.push(
            prisma.product.update({
              where: { id: schedule.product.id },
              data: { commissionPercent: patch.expectedCommissionRatePercent }
            })
          )
        }

        // Note: expectedCommissionAdjustment is not persisted yet; ignore safely.

        if (txOps.length === 0) {
          // Nothing to update for this schedule
          continue
        }

        try {
          await prisma.$transaction(txOps)
          updated += 1
        } catch (error) {
          errors[schedule.id] = error instanceof Error ? error.message : "Failed to update schedule"
          failed.push(schedule.id)
        }
      }

      return NextResponse.json({ updated, failed, errors })
    } catch (error) {
      console.error("Failed to bulk update revenue schedules", error)
      return NextResponse.json({ error: "Failed to update revenue schedules" }, { status: 500 })
    }
  })
}
