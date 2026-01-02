import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { revalidateOpportunityPaths } from "../../revalidate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const OPPORTUNITY_ROLE_DELETE_PERMISSIONS = ["opportunities.edit.all", "opportunities.manage"]

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

      const tenantId = req.user.tenantId
      const existingRole = await prisma.opportunityRole.findFirst({
        where: { id: roleId, tenantId },
        select: {
          id: true,
          opportunityId: true,
          opportunity: { select: { accountId: true } }
        }
      })

      if (!existingRole) {
        return NextResponse.json({ error: "Role not found" }, { status: 404 })
      }

      await prisma.opportunityRole.delete({ where: { id: existingRole.id } })
      await revalidateOpportunityPaths(existingRole.opportunity.accountId)

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Failed to delete opportunity role", error)
      return NextResponse.json({ error: "Failed to delete opportunity role" }, { status: 500 })
    }
  })
}

