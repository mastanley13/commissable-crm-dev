import { NextRequest, NextResponse } from "next/server"
import { AuditAction, DepositLineMatchStatus, RevenueScheduleFlexClassification } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { recomputeDepositLineItemAllocations } from "@/lib/matching/deposit-line-allocations"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { getClientIP, getUserAgent, logAudit, logRevenueScheduleAudit } from "@/lib/audit"

interface ApproveFlexRequestBody {
  revenueScheduleId?: string
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

    const body = (await request.json().catch(() => null)) as ApproveFlexRequestBody | null
    const requestedScheduleId = body?.revenueScheduleId?.trim() || null

    const line = await prisma.depositLineItem.findFirst({
      where: { tenantId, id: lineId, depositId },
      select: { id: true, reconciled: true },
    })
    if (!line) {
      return createErrorResponse("Deposit line item not found", 404)
    }
    if (line.reconciled) {
      return createErrorResponse("Reconciled line items cannot be changed", 400)
    }

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)

    try {
      const result = await prisma.$transaction(async tx => {
        const match = await tx.depositLineMatch.findFirst({
          where: {
            tenantId,
            depositLineItemId: lineId,
            status: DepositLineMatchStatus.Suggested,
            ...(requestedScheduleId ? { revenueScheduleId: requestedScheduleId } : {}),
          },
          select: {
            id: true,
            revenueScheduleId: true,
            revenueSchedule: { select: { flexClassification: true } },
          },
        })
        if (!match) {
          throw new Error("No pending FLEX match found to approve")
        }

        const scheduleBefore = await tx.revenueSchedule.findFirst({
          where: { tenantId, id: match.revenueScheduleId, deletedAt: null },
          select: {
            status: true,
            billingStatus: true,
            billingStatusSource: true,
            expectedUsage: true,
            usageAdjustment: true,
            expectedCommission: true,
          },
        })

        const flexClassification = (match.revenueSchedule as any)?.flexClassification ?? null
        const isApprovable =
          flexClassification === RevenueScheduleFlexClassification.FlexChargeback ||
          flexClassification === RevenueScheduleFlexClassification.FlexChargebackReversal
        if (!isApprovable) {
          throw new Error("Only pending chargebacks / chargeback reversals can be approved")
        }

        await tx.depositLineMatch.update({
          where: { id: match.id },
          data: { status: DepositLineMatchStatus.Applied },
        })

        const revenueSchedule = await recomputeRevenueScheduleFromMatches(tx, match.revenueScheduleId, tenantId, {
          varianceTolerance,
        })
        const updatedLine = await recomputeDepositLineItemAllocations(tx, lineId, tenantId)
        const deposit = await recomputeDepositAggregates(tx, depositId, tenantId)

        return {
          revenueSchedule,
          lineItem: updatedLine.line,
          deposit,
          approvedMatchId: match.id,
          scheduleBefore,
          scheduleId: match.revenueScheduleId,
        }
      })

      await logAudit({
        userId: req.user.id,
        tenantId,
        action: AuditAction.Update,
        entityName: "DepositLineItem",
        entityId: lineId,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        metadata: {
          action: "ApproveFlex",
          depositId,
          revenueScheduleId: requestedScheduleId,
          approvedMatchId: result.approvedMatchId,
        },
      })

      if (result.scheduleId) {
        await logRevenueScheduleAudit(
          AuditAction.Update,
          result.scheduleId,
          req.user.id,
          tenantId,
          request,
          result.scheduleBefore ?? undefined,
          {
            action: "ApproveFlex",
            depositId,
            depositLineItemId: lineId,
            approvedMatchId: result.approvedMatchId,
            status: result.revenueSchedule?.schedule?.status ?? null,
            billingStatus: result.revenueSchedule?.schedule?.billingStatus ?? null,
          },
        )
      }

      return NextResponse.json({ data: result })
    } catch (error) {
      console.error("Failed to approve flex match", error)
      return createErrorResponse(
        error instanceof Error ? error.message : "Failed to approve flex match",
        400,
      )
    }
  })
}
