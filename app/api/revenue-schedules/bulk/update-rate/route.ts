import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { logProductAudit, logRevenueScheduleAudit } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BULK_UPDATE_RATE_PERMISSIONS = ["revenue-schedules.manage", "opportunities.manage"]

type BulkUpdateRateBody = {
  scheduleIds?: string[]
  effectiveDate?: string
  ratePercent?: number | null
  scope?: "selection" | "series"
}

export async function POST(request: NextRequest) {
  return withPermissions(request, BULK_UPDATE_RATE_PERMISSIONS, async req => {
    try {
      const body = (await request.json().catch(() => null)) as BulkUpdateRateBody | null
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const scheduleIds = Array.isArray(body.scheduleIds)
        ? body.scheduleIds.filter(id => typeof id === "string" && id.trim().length > 0)
        : []

      if (scheduleIds.length === 0) {
        return NextResponse.json(
          { error: "scheduleIds must be a non-empty array of ids" },
          { status: 400 },
        )
      }

      const effectiveDateText =
        typeof body.effectiveDate === "string" ? body.effectiveDate.trim() : ""
      if (!effectiveDateText) {
        return NextResponse.json(
          { error: "effectiveDate is required" },
          { status: 400 },
        )
      }

      const effectiveDate = new Date(effectiveDateText)
      if (Number.isNaN(effectiveDate.getTime())) {
        return NextResponse.json(
          { error: "effectiveDate must be a valid date" },
          { status: 400 },
        )
      }

      const ratePercentRaw = body.ratePercent
      const ratePercent =
        typeof ratePercentRaw === "number" && Number.isFinite(ratePercentRaw)
          ? ratePercentRaw
          : null

      if (ratePercent === null) {
        return NextResponse.json(
          { error: "ratePercent must be a finite number" },
          { status: 400 },
        )
      }

      if (ratePercent < 0 || ratePercent > 100) {
        return NextResponse.json(
          { error: "ratePercent must be between 0 and 100" },
          { status: 400 },
        )
      }

      const tenantId = req.user.tenantId

      const schedules = await prisma.revenueSchedule.findMany({
        where: {
          id: { in: scheduleIds },
          tenantId,
          scheduleDate: { gte: effectiveDate },
        },
        select: {
          id: true,
          productId: true,
        },
      })

      if (schedules.length === 0) {
        return NextResponse.json({
          updated: 0,
          failed: scheduleIds,
          errors: Object.fromEntries(
            scheduleIds.map(id => [id, "No schedules on or after effective date"]),
          ),
        })
      }

      const productIds = Array.from(
        new Set(
          schedules
            .map(schedule => schedule.productId)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      )

      const products = await prisma.product.findMany({
        where: { id: { in: productIds }, tenantId },
        select: { id: true, commissionPercent: true },
      })

      const productById = new Map(
        products.map(product => [
          product.id,
          {
            id: product.id,
            commissionPercent:
              product.commissionPercent !== null && product.commissionPercent !== undefined
                ? Number(product.commissionPercent)
                : null,
          },
        ]),
      )

      const errors: Record<string, string> = {}
      const failed: string[] = []
      let updated = 0

      for (const productId of productIds) {
        const product = productById.get(productId)
        const previousPercent = product?.commissionPercent ?? null

        try {
          await prisma.product.update({
            where: { id: productId, tenantId },
            data: {
              commissionPercent: ratePercent,
            },
          })
          updated += 1

          if (previousPercent !== null && previousPercent !== ratePercent) {
            await logProductAudit(
              AuditAction.Update,
              productId,
              req.user.id,
              tenantId,
              request,
              { commissionPercent: previousPercent },
              { commissionPercent: ratePercent },
            )

            const affectedSchedules = schedules.filter(
              schedule => schedule.productId === productId,
            )

            for (const schedule of affectedSchedules) {
              await logRevenueScheduleAudit(
                AuditAction.Update,
                schedule.id,
                req.user.id,
                tenantId,
                request,
                { expectedCommissionRatePercent: previousPercent },
                { expectedCommissionRatePercent: ratePercent },
              )
            }
          }
        } catch (error) {
          failed.push(productId)
          errors[productId] =
            error instanceof Error ? error.message : "Failed to update commission rate"
        }
      }

      return NextResponse.json({ updated, failed, errors })
    } catch (error) {
      console.error("Failed to bulk update commission rates", error)
      return NextResponse.json(
        { error: "Unable to update commission rates" },
        { status: 500 },
      )
    }
  })
}
