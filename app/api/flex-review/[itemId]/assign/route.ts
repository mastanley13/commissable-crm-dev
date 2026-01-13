import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getClientIP, getUserAgent, logAudit } from "@/lib/audit"

export const dynamic = "force-dynamic"

interface AssignFlexReviewRequestBody {
  assignToMe?: boolean
  assignedToUserId?: string | null
  unassign?: boolean
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

    const body = (await request.json().catch(() => null)) as AssignFlexReviewRequestBody | null
    const assignToMe = Boolean(body?.assignToMe)
    const unassign = Boolean(body?.unassign)
    const assignedToUserIdRaw = typeof body?.assignedToUserId === "string" ? body.assignedToUserId.trim() : null

    const targetAssignedToUserId = unassign ? null : assignToMe ? req.user.id : assignedToUserIdRaw

    try {
      const result = await prisma.$transaction(async tx => {
        const item = await tx.flexReviewItem.findFirst({
          where: { tenantId, id: itemId },
          select: { id: true, assignedToUserId: true },
        })
        if (!item) {
          throw new Error("Flex review item not found")
        }

        if (targetAssignedToUserId) {
          const targetUser = await tx.user.findFirst({
            where: {
              tenantId,
              id: targetAssignedToUserId,
              role: {
                permissions: {
                  some: { permission: { code: "reconciliation.manage" } },
                },
              },
            },
            select: { id: true },
          })
          if (!targetUser) {
            throw new Error("Assignee must be a reconciliation manager in this tenant")
          }
        }

        const updated = await tx.flexReviewItem.update({
          where: { id: item.id },
          data: { assignedToUserId: targetAssignedToUserId ?? null },
          select: { id: true, assignedToUserId: true, updatedAt: true },
        })

        const assignmentChanged = item.assignedToUserId !== updated.assignedToUserId
        if (assignmentChanged && updated.assignedToUserId) {
          await tx.notification.create({
            data: {
              tenantId,
              userId: updated.assignedToUserId,
              title: "Flex review item assigned",
              body: "A FLEX review item was assigned to you.",
              metadata: {
                flexReviewItemId: item.id,
              } as any,
            },
            select: { id: true },
          })
        }

        return updated
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
          action: "AssignFlexReviewItem",
          flexReviewItemId: itemId,
          assignedToUserId: result.assignedToUserId ?? null,
        },
      })

      return NextResponse.json({ data: result })
    } catch (error) {
      console.error("Failed to assign flex review item", error)
      return createErrorResponse(
        error instanceof Error ? error.message : "Failed to assign flex review item",
        400,
      )
    }
  })
}

