import { NextRequest, NextResponse } from "next/server"
import { AuditAction, RevenueScheduleFlexClassification } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getClientIP, getUserAgent, logAudit } from "@/lib/audit"

export const dynamic = "force-dynamic"

interface BulkResolveRequestBody {
  itemIds?: string[]
  status?: "Resolved" | "Rejected"
  notes?: string
}

export async function POST(request: NextRequest) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const tenantId = req.user.tenantId

    const body = (await request.json().catch(() => null)) as BulkResolveRequestBody | null
    if (!body || typeof body !== "object") {
      return createErrorResponse("Invalid request payload", 400)
    }

    const status = body.status === "Rejected" ? "Rejected" : body.status === "Resolved" ? "Resolved" : null
    if (!status) {
      return createErrorResponse("status must be Resolved or Rejected", 400)
    }

    const itemIds = Array.isArray(body.itemIds)
      ? body.itemIds.filter(id => typeof id === "string" && id.trim().length > 0)
      : []
    if (itemIds.length === 0) {
      return createErrorResponse("itemIds must be a non-empty array", 400)
    }

    const notes = typeof body.notes === "string" ? body.notes.trim() : ""

    const failed: string[] = []
    const errors: Record<string, string> = {}
    let updated = 0

    for (const itemId of itemIds) {
      try {
        const item = await prisma.flexReviewItem.findFirst({
          where: { tenantId, id: itemId },
          select: { id: true, status: true, flexClassification: true },
        })
        if (!item) {
          failed.push(itemId)
          errors[itemId] = "Flex review item not found"
          continue
        }
        if (item.status !== "Open") {
          failed.push(itemId)
          errors[itemId] = "Flex review item is not open"
          continue
        }
        if (
          item.flexClassification === RevenueScheduleFlexClassification.FlexChargeback ||
          item.flexClassification === RevenueScheduleFlexClassification.FlexChargebackReversal
        ) {
          failed.push(itemId)
          errors[itemId] = "Chargeback items must be approved, not resolved"
          continue
        }

        await prisma.flexReviewItem.update({
          where: { id: item.id },
          data: {
            status,
            resolvedAt: new Date(),
            ...(notes ? { notes } : {}),
          },
          select: { id: true },
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
            action: "BulkResolveFlexReviewItem",
            flexReviewItemId: itemId,
            status,
          },
        })

        updated += 1
      } catch (error) {
        failed.push(itemId)
        errors[itemId] = error instanceof Error ? error.message : "Failed to resolve flex review item"
      }
    }

    return NextResponse.json({ updated, failed, errors })
  })
}
