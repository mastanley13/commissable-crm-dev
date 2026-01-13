import { NextRequest, NextResponse } from "next/server"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { formatRevenueScheduleDisplayName } from "@/lib/flex/revenue-schedule-display"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    try {
      const tenantId = req.user.tenantId

      const items = await prisma.flexReviewItem.findMany({
        where: { tenantId },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          revenueSchedule: { select: { id: true, scheduleNumber: true, flexClassification: true } },
        },
        take: 500,
      })

      return NextResponse.json({
        data: items.map(item => {
          const schedule = (item as any).revenueSchedule
          const scheduleName = formatRevenueScheduleDisplayName({
            scheduleNumber: schedule?.scheduleNumber ?? null,
            fallbackId: schedule?.id ?? item.revenueScheduleId,
            flexClassification: schedule?.flexClassification ?? item.flexClassification ?? null,
          })

          return {
            id: item.id,
            status: item.status,
            flexClassification: item.flexClassification,
            flexReasonCode: item.flexReasonCode ?? null,
            revenueScheduleId: item.revenueScheduleId,
            revenueScheduleName: scheduleName,
            sourceDepositId: item.sourceDepositId ?? null,
            sourceDepositLineItemId: item.sourceDepositLineItemId ?? null,
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
