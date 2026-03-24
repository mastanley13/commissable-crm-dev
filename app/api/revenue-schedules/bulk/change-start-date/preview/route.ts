import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { buildChangeStartDatePreview } from "@/lib/revenue-schedule-change-start-date"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BULK_CHANGE_START_DATE_PERMISSIONS = ["revenue-schedules.manage", "opportunities.manage"]

type ChangeStartDatePreviewBody = {
  scheduleIds?: string[]
  newStartDate?: string
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export async function POST(request: NextRequest) {
  return withPermissions(request, BULK_CHANGE_START_DATE_PERMISSIONS, async req => {
    try {
      const body = (await req.json().catch(() => null)) as ChangeStartDatePreviewBody | null
      if (!body || typeof body !== "object") {
        return createErrorResponse("Invalid request payload", 400)
      }

      const scheduleIds = Array.isArray(body.scheduleIds)
        ? Array.from(new Set(body.scheduleIds.filter(id => typeof id === "string" && id.trim().length > 0)))
        : []

      if (scheduleIds.length === 0) {
        return createErrorResponse("scheduleIds must be a non-empty array of ids", 400)
      }

      const tenantId = req.user.tenantId

      const schedules = await prisma.revenueSchedule.findMany({
        where: {
          tenantId,
          deletedAt: null,
          id: { in: scheduleIds },
        },
        select: {
          id: true,
          scheduleNumber: true,
          scheduleDate: true,
          opportunityProductId: true,
          actualUsage: true,
          actualCommission: true,
          status: true,
          billingStatus: true,
          product: { select: { productNameVendor: true } },
          distributor: { select: { accountName: true } },
          vendor: { select: { accountName: true } },
          opportunity: { select: { name: true } },
        },
      })

      if (schedules.length !== scheduleIds.length) {
        return NextResponse.json(
          { error: "Some selected schedules were not found." },
          { status: 404 },
        )
      }

      const preview = await buildChangeStartDatePreview({
        selectedSchedules: schedules.map(schedule => ({
          id: schedule.id,
          scheduleNumber: schedule.scheduleNumber ?? null,
          scheduleDate: schedule.scheduleDate ?? null,
          opportunityProductId: schedule.opportunityProductId ?? null,
          productNameVendor: schedule.product?.productNameVendor ?? null,
          distributorName: schedule.distributor?.accountName ?? null,
          vendorName: schedule.vendor?.accountName ?? null,
          opportunityName: schedule.opportunity?.name ?? null,
          actualUsage: toNullableNumber(schedule.actualUsage),
          actualCommission: toNullableNumber(schedule.actualCommission),
          scheduleStatus: schedule.status ?? null,
          billingStatus: schedule.billingStatus ?? null,
        })),
        newStartDateText: typeof body.newStartDate === "string" ? body.newStartDate : "",
        requireReason: false,
        loadExistingSchedulesForDates: async ({ opportunityProductId, selectedScheduleIds, proposedDates }) => {
          const existingSchedules = await prisma.revenueSchedule.findMany({
            where: {
              tenantId,
              deletedAt: null,
              opportunityProductId,
              id: { notIn: selectedScheduleIds },
              scheduleDate: { in: proposedDates },
            },
            select: {
              id: true,
              scheduleNumber: true,
              scheduleDate: true,
            },
          })

          return existingSchedules.filter(
            (schedule): schedule is { id: string; scheduleNumber: string | null; scheduleDate: Date } =>
              Boolean(schedule.scheduleDate)
          )
        },
      })

      return NextResponse.json(preview)
    } catch (error) {
      console.error("Failed to preview revenue schedule start date changes", error)
      return NextResponse.json({ error: "Unable to preview start date changes" }, { status: 500 })
    }
  })
}
