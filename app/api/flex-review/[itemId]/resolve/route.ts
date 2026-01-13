import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getClientIP, getUserAgent, logAudit } from "@/lib/audit"

export const dynamic = "force-dynamic"

interface ResolveFlexReviewRequestBody {
  status?: "Resolved" | "Rejected"
  notes?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { itemId: string } },
) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const itemId = params?.itemId?.trim()
    const tenantId = req.user.tenantId

    if (!itemId) {
      return createErrorResponse("itemId is required", 400)
    }

    const body = (await request.json().catch(() => null)) as ResolveFlexReviewRequestBody | null
    const status = body?.status === "Rejected" ? "Rejected" : "Resolved"
    const notes = typeof body?.notes === "string" ? body?.notes.trim() : ""

    try {
      const updated = await prisma.flexReviewItem.findFirst({
        where: { tenantId, id: itemId },
        select: { id: true },
      })
      if (!updated) {
        return createErrorResponse("Flex review item not found", 404)
      }

      const saved = await prisma.flexReviewItem.update({
        where: { id: updated.id },
        data: {
          status,
          notes: notes || undefined,
          resolvedAt: new Date(),
        },
        select: { id: true, status: true, resolvedAt: true },
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
          action: "ResolveFlexReviewItem",
          flexReviewItemId: itemId,
          status: saved.status,
        },
      })

      return NextResponse.json({ data: saved })
    } catch (error) {
      console.error("Failed to resolve flex review item", error)
      return createErrorResponse(
        error instanceof Error ? error.message : "Failed to resolve flex review item",
        400,
      )
    }
  })
}
