import { NextRequest, NextResponse } from "next/server"
import {
  AuditAction,
  DepositLineMatchStatus,
  RevenueScheduleFlexClassification,
} from "@prisma/client"
import { withRole, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { recomputeDepositLineItemAllocations } from "@/lib/matching/deposit-line-allocations"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { getClientIP, getUserAgent, logAudit } from "@/lib/audit"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: { itemId: string } },
) {
  return withRole(request, ["ADMIN"], async req => {
    const itemId = params?.itemId?.trim()
    const tenantId = req.user.tenantId

    if (!itemId) {
      return createErrorResponse("itemId is required", 400)
    }

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)

    try {
      const result = await prisma.$transaction(async tx => {
        const item = await tx.flexReviewItem.findFirst({
          where: { tenantId, id: itemId },
          select: {
            id: true,
            status: true,
            revenueScheduleId: true,
            flexClassification: true,
            sourceDepositId: true,
            sourceDepositLineItemId: true,
          },
        })
        if (!item) {
          throw new Error("Flex review item not found")
        }
        if (!item.sourceDepositId || !item.sourceDepositLineItemId) {
          throw new Error("Flex review item is missing source deposit context")
        }

        const isApprovable =
          item.flexClassification === RevenueScheduleFlexClassification.FlexChargeback ||
          item.flexClassification === RevenueScheduleFlexClassification.FlexChargebackReversal

        if (isApprovable) {
          const pending = await tx.depositLineMatch.findFirst({
            where: {
              tenantId,
              depositLineItemId: item.sourceDepositLineItemId,
              revenueScheduleId: item.revenueScheduleId,
              status: DepositLineMatchStatus.Suggested,
            },
            select: { id: true },
          })
          if (!pending) {
            throw new Error("No pending match found to approve for this item")
          }

          await tx.depositLineMatch.update({
            where: { id: pending.id },
            data: { status: DepositLineMatchStatus.Applied },
          })

          await recomputeRevenueScheduleFromMatches(tx, item.revenueScheduleId, tenantId, { varianceTolerance })
          await recomputeDepositLineItemAllocations(tx, item.sourceDepositLineItemId, tenantId)
          await recomputeDepositAggregates(tx, item.sourceDepositId, tenantId)
        }

        const updated = await tx.flexReviewItem.update({
          where: { id: item.id },
          data: {
            status: "Approved",
            resolvedAt: new Date(),
          },
          select: { id: true, status: true, resolvedAt: true },
        })

        return { item: updated, applied: isApprovable }
      })

      await logAudit({
        userId: req.user.id,
        tenantId,
        action: AuditAction.Update,
        entityName: "FlexReviewItem",
        entityId: itemId,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        metadata: {
          action: "ApproveAndApplyFlex",
          flexReviewItemId: itemId,
          applied: result.applied,
        },
      })

      return NextResponse.json({ data: result })
    } catch (error) {
      console.error("Failed to approve/apply flex review item", error)
      return createErrorResponse(
        error instanceof Error ? error.message : "Failed to approve/apply flex review item",
        400,
      )
    }
  })
}
