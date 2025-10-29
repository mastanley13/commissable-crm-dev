import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { GroupMemberType } from "@prisma/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST /api/groups/[id]/members
// Adds a contact or account to an existing group
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withPermissions(
    request,
    ["groups.manage", "contacts.manage", "accounts.manage"],
    async (req) => {
      try {
        const body = await request.json().catch(() => null)
        const contactId: string | null = typeof body?.contactId === "string" ? body.contactId : null
        const accountId: string | null = typeof body?.accountId === "string" ? body.accountId : null
        const groupId = params.id

        if (!contactId && !accountId) {
          return createErrorResponse("contactId or accountId is required", 400)
        }

        // Verify group and selected entity belong to tenant
        const group = await prisma.group.findFirst({ where: { id: groupId, tenantId: req.user.tenantId }, select: { id: true } })
        if (!group) return createErrorResponse("Group not found", 404)

        if (contactId) {
          const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId: req.user.tenantId }, select: { id: true } })
          if (!contact) return createErrorResponse("Contact not found", 404)
          try {
            await prisma.$transaction(async (tx) => {
              await tx.groupMember.create({
                data: {
                  tenantId: req.user.tenantId,
                  groupId,
                  memberType: GroupMemberType.Contact,
                  contactId,
                  addedById: req.user.id
                }
              })
              await tx.group.update({ where: { id: groupId }, data: { memberCount: { increment: 1 } } })
            })
          } catch (err: any) {
            if (err?.code === "P2002") return createErrorResponse("This contact is already a member of the group", 409)
            throw err
          }
          return NextResponse.json({ message: "Contact added to group" })
        }

        if (accountId) {
          const account = await prisma.account.findFirst({ where: { id: accountId, tenantId: req.user.tenantId }, select: { id: true } })
          if (!account) return createErrorResponse("Account not found", 404)
          try {
            await prisma.$transaction(async (tx) => {
              await tx.groupMember.create({
                data: {
                  tenantId: req.user.tenantId,
                  groupId,
                  memberType: GroupMemberType.Account,
                  accountId,
                  addedById: req.user.id
                }
              })
              await tx.group.update({ where: { id: groupId }, data: { memberCount: { increment: 1 } } })
            })
          } catch (err: any) {
            if (err?.code === "P2002") return createErrorResponse("This account is already a member of the group", 409)
            throw err
          }
          return NextResponse.json({ message: "Account added to group" })
        }

        return createErrorResponse("Unsupported request", 400)
      } catch (error) {
        console.error("Failed to add group member", error)
        return createErrorResponse("Failed to add contact to group", 500)
      }
    }
  )
}
