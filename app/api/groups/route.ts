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
      const includeInactiveParam = searchParams.get("includeInactive")
      const pageParam = Number(searchParams.get("page") ?? "1")
      const pageSizeParam = Number(searchParams.get("pageSize") ?? "25")
      const query = searchParams.get("q")?.trim() ?? ""
      const statusInput = searchParams.get("status")?.toLowerCase() ?? ""
      const sortByParam = searchParams.get("sortBy") ?? "groupName"
      const sortDirParam = searchParams.get("sortDir") === "desc" ? "desc" : "asc"

      const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
      const pageSize = Number.isFinite(pageSizeParam)
        ? Math.min(100, Math.max(1, pageSizeParam))
        : 25
      const columnFiltersParam = searchParams.get("columnFilters")
      let columnFilters: Array<{ columnId: string; value: string }> = []

      if (columnFiltersParam) {
        try {
          const parsed = JSON.parse(columnFiltersParam)
          if (Array.isArray(parsed)) {
            columnFilters = parsed
              .map(filter => ({
                columnId: typeof filter?.columnId === "string" ? filter.columnId : "",
                value: typeof filter?.value === "string" ? filter.value : ""
              }))
              .filter(filter => filter.columnId && filter.value.trim().length > 0)
          }
        } catch (err) {
          console.warn("Invalid columnFilters payload", err)
        }
      }

      const where: any = { tenantId }

      if (ownerId) {
        where.ownerId = ownerId
      }

      let effectiveStatus = statusInput
      if (!effectiveStatus) {
        if (includeInactiveParam === "true") {
          effectiveStatus = "all"
        } else {
          effectiveStatus = "active"
        }
      }

      if (effectiveStatus === "active") {
        where.isActive = true
      } else if (effectiveStatus === "inactive") {
        where.isActive = false
      }

      if (query.length > 0) {
        where.OR = [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          {
            owner: {
              is: {
                fullName: { contains: query, mode: "insensitive" }
              }
            }
          }
        ]
      }

      if (columnFilters.length > 0) {
        where.AND = where.AND || []

        for (const filter of columnFilters) {
          const trimmedValue = filter.value.trim()
          if (!trimmedValue) continue
          switch (filter.columnId) {
            case "groupName":
            case "name":
              where.AND.push({ name: { contains: trimmedValue, mode: "insensitive" } })
              break
            case "groupType":
              where.AND.push({ groupType: { equals: trimmedValue, mode: "insensitive" } })
              break
            case "description":
              where.AND.push({ description: { contains: trimmedValue, mode: "insensitive" } })
              break
            case "ownerName":
              where.AND.push({
                owner: {
                  is: {
                    fullName: { contains: trimmedValue, mode: "insensitive" }
                  }
                }
              })
              break
            default:
              break
          }
        }
      }

      const sortableFields: Record<string, string> = {
        groupName: "name",
        name: "name",
        groupType: "groupType",
        memberCount: "memberCount",
        createdDate: "createdAt",
        createdAt: "createdAt"
      }
      const sortField = sortableFields[sortByParam] ?? "name"

      const [groups, total] = await Promise.all([
        prisma.group.findMany({
          where,
          orderBy: { [sortField]: sortDirParam },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }),
        prisma.group.count({ where })
      ])

      return NextResponse.json({
        data: groups.map(group => ({
          id: group.id,
          name: group.name,
          groupType: group.groupType,
          visibility: group.visibility,
          memberCount: group.memberCount,
          isActive: group.isActive,
          description: group.description,
          createdAt: group.createdAt,
          ownerId: group.ownerId,
          ownerName:
            group.owner?.fullName ||
            `${group.owner?.firstName ?? ""} ${group.owner?.lastName ?? ""}`.trim()
        })),
        pagination: {
          page,
          pageSize,
          total
        }
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

