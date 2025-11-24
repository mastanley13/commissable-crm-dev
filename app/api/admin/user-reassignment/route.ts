import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface UserReassignmentRequest {
  previousUserId: string
  newUserId: string
  effectiveDate: string
  accountIds?: string[]
  includeAccounts?: boolean
  includeContacts?: boolean
  includeGroups?: boolean
  includeProducts?: boolean
}

export async function POST(request: NextRequest) {
  return withPermissions(
    request,
    ["accounts.reassign", "accounts.bulk"],
    async (req) => {
      try {
        const body = (await request.json().catch(() => null)) as UserReassignmentRequest | null

        if (!body) {
          return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
        }

        const { previousUserId, newUserId, effectiveDate } = body

        if (!previousUserId || !newUserId || !effectiveDate) {
          return NextResponse.json(
            { error: "previousUserId, newUserId, and effectiveDate are required" },
            { status: 400 }
          )
        }

        if (previousUserId === newUserId) {
          return NextResponse.json(
            { error: "Previous user and new user must be different" },
            { status: 400 }
          )
        }

        const effective = new Date(effectiveDate)
        if (Number.isNaN(effective.getTime())) {
          return NextResponse.json({ error: "Invalid effectiveDate format" }, { status: 400 })
        }

        const tenantId = req.user.tenantId
        const actingUserId = req.user.id

        const includeAccounts = body.includeAccounts !== false
        const includeContacts = body.includeContacts !== false
        const includeGroups = body.includeGroups !== false
        const includeProducts = body.includeProducts !== false
        const accountIds = Array.isArray(body.accountIds) ? body.accountIds : []

        const summary = await prisma.$transaction(async (tx) => {
          const result = {
            accountsUpdated: 0,
            contactsUpdated: 0,
            groupsUpdated: 0,
            productsUpdated: 0
          }

          if (includeAccounts) {
            const where: any = {
              tenantId,
              ownerId: previousUserId
            }

            if (accountIds.length > 0) {
              where.id = { in: accountIds }
            }

            const updateResult = await tx.account.updateMany({
              where,
              data: {
                ownerId: newUserId,
                updatedById: actingUserId,
                updatedAt: new Date()
              }
            })

            result.accountsUpdated = updateResult.count
          }

          if (includeContacts) {
            const updateResult = await tx.contact.updateMany({
              where: {
                tenantId,
                ownerId: previousUserId,
                deletedAt: null
              },
              data: {
                ownerId: newUserId,
                updatedById: actingUserId,
                updatedAt: new Date()
              }
            })

            result.contactsUpdated = updateResult.count
          }

          if (includeGroups) {
            const updateResult = await tx.group.updateMany({
              where: {
                tenantId,
                ownerId: previousUserId
              },
              data: {
                ownerId: newUserId,
                updatedAt: new Date()
              }
            })

            result.groupsUpdated = updateResult.count
          }

          if (includeProducts) {
            const updateResult = await tx.product.updateMany({
              where: {
                tenantId,
                createdById: previousUserId
              },
              data: {
                createdById: newUserId,
                updatedById: actingUserId,
                updatedAt: new Date()
              }
            })

            result.productsUpdated = updateResult.count
          }

          return result
        })

        return NextResponse.json({
          success: true,
          effectiveDate: effective.toISOString(),
          summary
        })
      } catch (error) {
        console.error("User reassignment failed", error)
        return NextResponse.json(
          { error: "Failed to apply user reassignment" },
          { status: 500 }
        )
      }
    }
  )
}

