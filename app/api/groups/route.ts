import { NextRequest, NextResponse } from "next/server"
import { GroupMemberType, GroupType, GroupVisibility } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions, withAuth } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      const searchParams = request.nextUrl.searchParams
      const tenantId = req.user.tenantId
      const ownerId = searchParams.get("ownerId")?.trim() ?? ""
      const includeInactive = searchParams.get("includeInactive") === "true"

      const where: any = { tenantId }

      if (ownerId) {
        where.ownerId = ownerId
      }

      if (!includeInactive) {
        where.isActive = true
      }

      const groups = await prisma.group.findMany({
        where,
        orderBy: { name: "asc" }
      })

      return NextResponse.json({
        data: groups.map(group => ({
          id: group.id,
          name: group.name,
          groupType: group.groupType,
          visibility: group.visibility,
          memberCount: group.memberCount,
          isActive: group.isActive,
          description: group.description,
          createdAt: group.createdAt
        }))
      })
    } catch (error) {
      console.error("Failed to load groups", error)
      return NextResponse.json({ error: "Failed to load groups" }, { status: 500 })
    }
  })
}

function isValidGroupType(value: string): value is GroupType {
  return Object.values(GroupType).includes(value as GroupType)
}

function isValidGroupVisibility(value: string): value is GroupVisibility {
  return Object.values(GroupVisibility).includes(value as GroupVisibility)
}

export async function POST(request: NextRequest) {
  return withPermissions(request, ["groups.manage", "contacts.manage", "accounts.manage"], async (req) => {
    try {
      const payload = await request.json().catch(() => null)

      if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const name = typeof payload.name === "string" ? payload.name.trim() : ""
      const groupTypeValue = typeof payload.groupType === "string" ? payload.groupType : ""
      const visibilityValue = typeof payload.visibility === "string" ? payload.visibility : ""
      const ownerId = typeof payload.ownerId === "string" ? payload.ownerId : ""
      const description = typeof payload.description === "string" ? payload.description.trim() : ""
      const isActive = typeof payload.isActive === "boolean" ? payload.isActive : true
      const accountId = typeof payload.accountId === "string" && payload.accountId.length > 0 ? payload.accountId : null
      const contactId = typeof payload.contactId === "string" && payload.contactId.length > 0 ? payload.contactId : null
      const addContactAsMember = payload.addContactAsMember !== false

      if (!name || !ownerId) {
        return NextResponse.json({ error: "Group name and owner are required" }, { status: 400 })
      }

      const groupType = isValidGroupType(groupTypeValue) ? groupTypeValue : GroupType.SalesTeam
      const visibility = isValidGroupVisibility(visibilityValue) ? visibilityValue : GroupVisibility.Private

      const existing = await prisma.group.findFirst({
        where: {
          tenantId: req.user.tenantId,
          name
        },
        select: { id: true }
      })

      if (existing) {
        return NextResponse.json({ error: "A group with this name already exists" }, { status: 409 })
      }

      if (contactId) {
        const contactExists = await prisma.contact.findFirst({
          where: {
            id: contactId,
            tenantId: req.user.tenantId
          },
          select: { id: true }
        })

        if (!contactExists) {
          return NextResponse.json({ error: "Contact not found" }, { status: 404 })
        }
      }

      const group = await prisma.$transaction(async (tx) => {
        const createdGroup = await tx.group.create({
          data: {
            tenantId: req.user.tenantId,
            name,
            groupType,
            visibility,
            ownerId,
            description: description || null
          }
        })

        let membersAdded = 0

        if (accountId && isActive) {
          await tx.groupMember.create({
            data: {
              tenantId: req.user.tenantId,
              groupId: createdGroup.id,
              memberType: GroupMemberType.Account,
              accountId,
              addedById: req.user.id
            }
          })
          membersAdded += 1
        }

        if (contactId && addContactAsMember) {
          await tx.groupMember.create({
            data: {
              tenantId: req.user.tenantId,
              groupId: createdGroup.id,
              memberType: GroupMemberType.Contact,
              contactId,
              addedById: req.user.id
            }
          })
          membersAdded += 1
        }

        if (membersAdded > 0) {
          await tx.group.update({
            where: { id: createdGroup.id },
            data: { memberCount: { increment: membersAdded } }
          })
        }

        return createdGroup
      })

      return NextResponse.json({ data: group })
    } catch (error) {
      console.error("Failed to create group", error)
      return NextResponse.json({ error: "Failed to create group" }, { status: 500 })
    }
  })
}

