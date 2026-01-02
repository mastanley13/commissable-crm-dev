import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { revalidateOpportunityPaths } from "../../revalidate"
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const OPPORTUNITY_ROLE_DELETE_PERMISSIONS = ["opportunities.edit.all", "opportunities.manage"]

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { roleId: string } }
) {
  return withPermissions(request, OPPORTUNITY_ROLE_DELETE_PERMISSIONS, async (req) => {
    try {
      const { roleId } = params
      if (!roleId) {
        return NextResponse.json({ error: "Role id is required" }, { status: 400 })
      }
      if (!isUuid(roleId)) {
        return NextResponse.json({ error: "Role id must be a valid UUID" }, { status: 400 })
      }

      let reason: string | null = null
      try {
        const body = await request.json().catch(() => null) as any
        if (body && typeof body.reason === "string") {
          reason = body.reason.trim() || null
        }
      } catch (_) {
        // ignore missing/invalid JSON bodies
      }

      const tenantId = req.user.tenantId
      const existingRole = await prisma.opportunityRole.findFirst({
        where: { id: roleId, tenantId },
        select: {
          id: true,
          opportunityId: true,
          role: true,
          fullName: true,
          email: true,
          workPhone: true,
          phoneExtension: true,
          mobile: true,
          active: true,
          contactId: true,
          opportunity: { select: { accountId: true } }
        }
      })

      if (!existingRole) {
        return NextResponse.json({ error: "Role not found" }, { status: 404 })
      }

      await prisma.opportunityRole.delete({ where: { id: existingRole.id } })

      await logAudit({
        userId: req.user.id,
        tenantId,
        action: AuditAction.Delete,
        entityName: "OpportunityRole",
        entityId: existingRole.id,
        previousValues: {
          opportunityId: existingRole.opportunityId,
          contactId: existingRole.contactId,
          role: existingRole.role,
          fullName: existingRole.fullName,
          email: existingRole.email,
          workPhone: existingRole.workPhone,
          phoneExtension: existingRole.phoneExtension,
          mobile: existingRole.mobile,
          active: existingRole.active
        },
        newValues: {
          reason
        },
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request)
      })

      await revalidateOpportunityPaths(existingRole.opportunity.accountId)

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Failed to delete opportunity role", error)
      return NextResponse.json({ error: "Failed to delete opportunity role" }, { status: 500 })
    }
  })
}
