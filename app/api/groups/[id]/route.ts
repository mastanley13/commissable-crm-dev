import { NextRequest, NextResponse } from "next/server"
import { AuditAction, GroupType, GroupVisibility } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { revalidatePath } from "next/cache"

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function mapGroupToDetail(group: any) {
  return {
    id: group.id,
    name: group.name,
    groupType: group.groupType,
    visibility: group.visibility,
    description: group.description,
    isActive: group.isActive,
    ownerId: group.ownerId,
    ownerName: group.owner ? `${group.owner.firstName ?? ""} ${group.owner.lastName ?? ""}`.trim() : "",
    memberCount: group._count?.members ?? 0,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withPermissions(
    request,
    ['groups.manage', 'groups.read'],
    async (req) => {
      try {
        const groupId = params.id
        const tenantId = req.user.tenantId

        const group = await prisma.group.findFirst({
          where: {
            id: groupId,
            tenantId
          },
          include: {
            owner: { select: { firstName: true, lastName: true } },
            _count: {
              select: { members: true }
            }
          }
        })

        if (!group) {
          return NextResponse.json({ error: "Group not found" }, { status: 404 })
        }

        const data = mapGroupToDetail(group)
        return NextResponse.json({ data })
      } catch (error) {
        console.error("Failed to load group", error)
        return NextResponse.json({ error: "Failed to load group" }, { status: 500 })
      }
    }
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withPermissions(
    request,
    ['groups.manage'],
    async (req) => {
      try {
        const body = await request.json()
        const groupId = params.id
        const tenantId = req.user.tenantId
        const userId = req.user.id

        const existingGroup = await prisma.group.findFirst({
          where: {
            id: groupId,
            tenantId
          }
        })

        if (!existingGroup) {
          return NextResponse.json({ error: "Group not found" }, { status: 404 })
        }

        const updateData: Record<string, any> = {}

        if (typeof body.name === "string" && body.name.trim().length > 0) {
          updateData.name = body.name.trim()
        }

        if (body.groupType && Object.values(GroupType).includes(body.groupType)) {
          updateData.groupType = body.groupType
        }

        if (body.visibility && Object.values(GroupVisibility).includes(body.visibility)) {
          updateData.visibility = body.visibility
        }

        if (typeof body.description === "string") {
          updateData.description = body.description.trim() || null
        }

        if (typeof body.isActive === "boolean") {
          updateData.isActive = body.isActive
        }

        if (typeof body.ownerId === "string" && body.ownerId.trim().length > 0) {
          // Verify the owner exists
          const ownerExists = await prisma.user.findFirst({
            where: { id: body.ownerId, tenantId }
          })
          if (!ownerExists) {
            return createErrorResponse("Invalid owner selected", 400)
          }
          updateData.ownerId = body.ownerId
        }

        // Only update if there are changes
        if (Object.keys(updateData).length === 0) {
          return NextResponse.json({ 
            data: mapGroupToDetail(existingGroup),
            message: "No changes detected"
          })
        }

        const updatedGroup = await prisma.group.update({
          where: { id: groupId },
          data: updateData,
          include: {
            owner: { select: { firstName: true, lastName: true } },
            _count: {
              select: { members: true }
            }
          }
        })

        // Invalidate cache to ensure UI updates immediately
        revalidatePath('/groups')
        revalidatePath('/dashboard')
        revalidatePath(`/groups/${groupId}`)
        revalidatePath(`/accounts`)

        return NextResponse.json({
          data: mapGroupToDetail(updatedGroup),
          message: "Group updated successfully"
        })
      } catch (error) {
        console.error("Failed to update group", error)
        return NextResponse.json({ error: "Failed to update group" }, { status: 500 })
      }
    }
  )
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withPermissions(
    request,
    ['groups.manage'],
    async (req) => {
      try {
        const groupId = params.id
        const tenantId = req.user.tenantId
        const userId = req.user.id
        const url = new URL(request.url)
        const force = url.searchParams.get('force') === 'true'

        const existingGroup = await prisma.group.findFirst({
          where: {
            id: groupId,
            tenantId
          },
          include: {
            members: { select: { id: true } }
          }
        })

        if (!existingGroup) {
          return NextResponse.json({ error: "Group not found" }, { status: 404 })
        }

        // Check for members unless forcing deletion
        if (!force && existingGroup.members.length > 0) {
          return NextResponse.json({
            error: "Group has members that must be removed first",
            constraints: [{
              type: 'members',
              count: existingGroup.members.length,
              message: `This group has ${existingGroup.members.length} members`
            }]
          }, { status: 409 })
        }

        // Delete group and all its memberships
        await prisma.$transaction(async (tx) => {
          // Remove all members first
          await tx.groupMember.deleteMany({
            where: { groupId: groupId, tenantId }
          })

          // Delete the group
          await tx.group.delete({
            where: { id: groupId }
          })
        })

        // Invalidate cache
        revalidatePath('/groups')
        revalidatePath('/dashboard')
        revalidatePath(`/accounts`)

        return NextResponse.json({
          message: "Group deleted successfully"
        })
      } catch (error) {
        console.error("Failed to delete group", error)
        return NextResponse.json({ error: "Failed to delete group" }, { status: 500 })
      }
    }
  )
}