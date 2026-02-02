import { NextRequest, NextResponse } from "next/server"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { formatRevenueScheduleDisplayName } from "@/lib/flex/revenue-schedule-display"

export const dynamic = "force-dynamic"

function toNumber(value: unknown): number {
  if (value == null) return 0
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const decimal = value as { toNumber?: () => number; toString?: () => string }
  if (typeof decimal.toNumber === "function") {
    const parsed = decimal.toNumber()
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (typeof decimal.toString === "function") {
    const parsed = Number(decimal.toString())
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export async function GET(request: NextRequest) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    try {
      const tenantId = req.user.tenantId

      const items = await prisma.flexReviewItem.findMany({
        where: { tenantId },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          assignedToUser: { select: { id: true, fullName: true } },
          revenueSchedule: {
            select: {
              id: true,
              scheduleNumber: true,
              flexClassification: true,
              scheduleDate: true,
              expectedUsage: true,
              expectedCommission: true,
              parentRevenueScheduleId: true,
              opportunityId: true,
              productId: true,
              distributorAccountId: true,
              vendorAccountId: true,
              parentRevenueSchedule: {
                select: {
                  id: true,
                  scheduleNumber: true,
                  flexClassification: true,
                },
              },
              distributor: {
                select: { id: true, accountName: true },
              },
              vendor: {
                select: { id: true, accountName: true },
              },
            },
          },
        },
        take: 500,
      })

      return NextResponse.json({
        data: items.map(item => {
          const schedule = item.revenueSchedule
          const parent = schedule?.parentRevenueSchedule ?? null
          const scheduleName = formatRevenueScheduleDisplayName({
            scheduleNumber: schedule?.scheduleNumber ?? null,
            fallbackId: schedule?.id ?? item.revenueScheduleId,
            flexClassification: schedule?.flexClassification ?? item.flexClassification ?? null,
          })
          const parentScheduleName = parent
            ? formatRevenueScheduleDisplayName({
                scheduleNumber: parent.scheduleNumber ?? null,
                fallbackId: parent.id,
                flexClassification: parent.flexClassification ?? null,
              })
            : null

          return {
            id: item.id,
            status: item.status,
            flexClassification: item.flexClassification,
            flexReasonCode: item.flexReasonCode ?? null,
            revenueScheduleId: item.revenueScheduleId,
            revenueScheduleName: scheduleName,
            parentRevenueScheduleId: schedule?.parentRevenueScheduleId ?? null,
            parentRevenueScheduleName: parentScheduleName,
            scheduleDate: schedule?.scheduleDate ? schedule.scheduleDate.toISOString() : null,
            opportunityId: schedule?.opportunityId ?? null,
            productId: schedule?.productId ?? null,
            distributorAccountId: schedule?.distributorAccountId ?? null,
            distributorName: schedule?.distributor?.accountName ?? null,
            vendorAccountId: schedule?.vendorAccountId ?? null,
            vendorName: schedule?.vendor?.accountName ?? null,
            sourceDepositId: item.sourceDepositId ?? null,
            sourceDepositLineItemId: item.sourceDepositLineItemId ?? null,
            expectedUsage: schedule?.expectedUsage == null ? null : toNumber(schedule.expectedUsage),
            expectedCommission: schedule?.expectedCommission == null ? null : toNumber(schedule.expectedCommission),
            assignedToUserId: item.assignedToUserId ?? null,
            assignedToName: item.assignedToUser?.fullName ?? null,
            createdAt: item.createdAt.toISOString(),
            resolvedAt: item.resolvedAt?.toISOString() ?? null,
          }
        }),
      })
    } catch (error) {
      console.error("Failed to load flex review queue", error)
      return createErrorResponse(
        error instanceof Error ? error.message : "Failed to load flex review queue",
        500,
      )
    }
  })
}
