import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { getClientIP, getUserAgent, logAudit } from "@/lib/audit"
import { applyUsageVarianceAdjustment } from "@/lib/reconciliation/apply-usage-variance-adjustment"

interface ApplyRequestBody {
  revenueScheduleId: string
  applyToFuture?: boolean
}

export async function POST(
  request: NextRequest,
  { params }: { params: { depositId: string; lineId: string } },
) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const depositId = params?.depositId?.trim()
    const lineId = params?.lineId?.trim()
    const tenantId = req.user.tenantId

    if (!depositId || !lineId) {
      return createErrorResponse("Deposit id and line id are required", 400)
    }

    const body = (await request.json().catch(() => null)) as ApplyRequestBody | null
    if (!body?.revenueScheduleId?.trim()) {
      return createErrorResponse("revenueScheduleId is required", 400)
    }

    const revenueScheduleId = body.revenueScheduleId.trim()
    const applyToFuture = Boolean(body.applyToFuture)

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)

    let result: Awaited<ReturnType<typeof applyUsageVarianceAdjustment>>
    try {
      result = await prisma.$transaction(tx =>
        applyUsageVarianceAdjustment(tx, {
          tenantId,
          userId: req.user.id,
          request,
          depositId,
          depositLineItemId: lineId,
          revenueScheduleId,
          applyToFuture,
          varianceTolerance,
        }),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to apply adjustment"
      if (message === "Deposit line item not found") {
        return createErrorResponse(message, 404)
      }
      if (
        message === "Reconciled line items cannot be changed" ||
        message === "Revenue schedule not found" ||
        message === "Revenue schedule date is required to apply future adjustments" ||
        message === "No overage found to adjust"
      ) {
        return createErrorResponse(message, 400)
      }
      throw error
    }

    await logAudit({
      userId: req.user.id,
      tenantId,
      action: AuditAction.Update,
      entityName: "DepositLineItem",
      entityId: lineId,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
      metadata: {
        action: "ApplyAIAdjustment",
        depositId,
        revenueScheduleId,
        applyToFuture,
        futureUpdatedCount: result.futureUpdatedScheduleIds.length,
        futureUpdatedScheduleIds: result.futureUpdatedScheduleIds,
        updatedScheduleIds: result.updatedScheduleIds,
        flexExecution: result.flexExecution ? JSON.parse(JSON.stringify(result.flexExecution)) : null,
      },
    })

    return NextResponse.json({ data: result })
  })
}
