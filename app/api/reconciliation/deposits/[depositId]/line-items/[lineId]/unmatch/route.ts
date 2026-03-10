import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { getClientIP, getUserAgent, logAudit, logRevenueScheduleAudit } from "@/lib/audit"
import { executeUnmatchReversal } from "@/lib/reconciliation/unmatch-reversal"

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

    const lineItem = await prisma.depositLineItem.findFirst({
      where: { id: lineId, depositId, tenantId },
    })
    if (!lineItem) {
      return createErrorResponse("Deposit line item not found", 404)
    }

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)

    let result
    try {
      result = await prisma.$transaction(async tx => {
        return executeUnmatchReversal(tx, {
          tenantId,
          depositId,
          lineItemIds: [lineItem.id],
          userId: req.user.id,
          varianceTolerance,
        })
      })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : "Unable to unmatch deposit line", 400)
    }

    for (const scheduleResult of result.revenueSchedules ?? []) {
      const before = (result.schedulesBefore ?? []).find(row => row.id === scheduleResult.schedule.id)
      await logRevenueScheduleAudit(
        AuditAction.Update,
        scheduleResult.schedule.id,
        req.user.id,
        tenantId,
        request,
        {
          status: before?.status ?? null,
          actualUsage: before?.actualUsage ?? null,
          actualCommission: before?.actualCommission ?? null,
        },
        {
          action: "UnmatchDepositLine",
          depositId,
          depositLineItemId: lineItem.id,
          status: scheduleResult.schedule.status,
          actualUsage: scheduleResult.schedule.actualUsage,
          actualCommission: scheduleResult.schedule.actualCommission,
          usageBalance: scheduleResult.usageBalance,
          commissionDifference: scheduleResult.commissionDifference,
          matchCount: scheduleResult.matchCount,
        },
      )
    }

    await logAudit({
      userId: req.user.id,
      tenantId,
      action: AuditAction.Delete,
      entityName: "DepositLineMatch",
      entityId: lineItem.id,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
      metadata: {
        action: "RemoveAllocation",
        depositId,
        depositLineItemId: lineItem.id,
        scheduleCount: (result.revenueSchedules ?? []).length,
        reversedUndoLogCount: result.reversedUndoLogCount ?? 0,
      },
    })

    const { schedulesBefore: _schedulesBefore, lineItems, ...responseData } = result as any
    const lineResponse = Array.isArray(lineItems) ? lineItems[0] ?? null : null
    const data = {
      ...responseData,
      lineItem: lineResponse,
      lineItems,
    }
    return NextResponse.json({ data })
  })
}
