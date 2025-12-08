import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { Prisma, PrismaClient } from "@prisma/client"
import { withPermissions } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CommissionOption = "transferToNewRep" | "transferToHouse"

interface UserReassignmentRequest {
  previousUserId: string
  newUserId: string
  effectiveDate: string
  commissionOption?: CommissionOption
}

interface EntityCounts {
  accounts: number
  contacts: number
  groups: number
  products: number
  opportunities: number
  tasks: number
  tickets: number
  activities: number
  notes: number
  revenueSchedules: number
}

const DEFAULT_COMMISSION_OPTION: CommissionOption = "transferToNewRep"

function parseEffectiveDate(value?: string | null): Date {
  if (!value) {
    return getDefaultEffectiveDate()
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? getDefaultEffectiveDate() : parsed
}

function getDefaultEffectiveDate(): Date {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  if (now.getDate() === 1) {
    return new Date(year, month, 1)
  }
  return new Date(year, month + 1, 1)
}

async function ensureNoHouseRepContactId(tenantId: string) {
  const contact = await prisma.contact.findFirst({
    where: { tenantId, fullName: "No House Rep" },
    select: { id: true }
  })
  if (contact?.id) return contact.id

  const fallbackAccount =
    (await prisma.account.findFirst({
      where: { tenantId, accountName: "Agency Parent Account" },
      orderBy: { createdAt: "asc" }
    })) ??
    (await prisma.account.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "asc" }
    }))

  if (!fallbackAccount) {
    return null
  }

  const created = await prisma.contact.create({
    data: {
      tenantId,
      accountId: fallbackAccount.id,
      accountTypeId: fallbackAccount.accountTypeId,
      ownerId: fallbackAccount.ownerId,
      firstName: "No House",
      lastName: "Rep",
      fullName: "No House Rep",
      preferredContactMethod: "Email",
      isPrimary: false,
      isDecisionMaker: false,
      description:
        "System dummy contact used when House receives commissions without an assigned rep.",
    },
    select: { id: true },
  })

  return created.id
}

type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient

async function getEntityCounts(
  db: PrismaClientOrTransaction,
  tenantId: string,
  previousUserId: string,
  effectiveDate: Date
): Promise<EntityCounts> {
  const [
    accounts,
    contacts,
    groups,
    products,
    opportunities,
    tasks,
    tickets,
    activities,
    notes,
    revenueSchedules
  ] = await Promise.all([
    db.account.count({ where: { tenantId, ownerId: previousUserId } }),
    db.contact.count({
      where: { tenantId, ownerId: previousUserId, deletedAt: null }
    }),
    db.group.count({ where: { tenantId, ownerId: previousUserId } }),
    db.product.count({ where: { tenantId, createdById: previousUserId } }),
    db.opportunity.count({
      where: {
        tenantId,
        ownerId: previousUserId,
        status: "Open"
      }
    }),
    db.activity.count({
      where: {
        tenantId,
        assigneeId: previousUserId,
        status: "Open",
        activityType: "ToDo"
      }
    }),
    db.ticket.count({
      where: { tenantId, assignedToId: previousUserId }
    }),
    db.activity.count({
      where: {
        tenantId,
        assigneeId: previousUserId,
        status: "Open"
      }
    }),
    db.activity.count({
      where: {
        tenantId,
        creatorId: previousUserId,
        activityType: "Note"
      }
    }),
    db.revenueSchedule.count({
      where: {
        tenantId,
        scheduleDate: { gte: effectiveDate },
        account: { ownerId: previousUserId }
      }
    })
  ])

  return {
    accounts,
    contacts,
    groups,
    products,
    opportunities,
    tasks,
    tickets,
    activities,
    notes,
    revenueSchedules
  }
}

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ["accounts.reassign", "accounts.bulk"],
    async (req) => {
      const { searchParams } = new URL(request.url)
      const previousUserId = searchParams.get("previousUserId")
      const effectiveDate = parseEffectiveDate(searchParams.get("effectiveDate"))

      if (!previousUserId) {
        return NextResponse.json(
          { error: "previousUserId is required" },
          { status: 400 }
        )
      }

      const tenantId = req.user.tenantId

      const counts = await getEntityCounts(prisma, tenantId, previousUserId, effectiveDate)
      const noHouseRepContactId = await ensureNoHouseRepContactId(tenantId)

      return NextResponse.json({
        counts,
        effectiveDate: effectiveDate.toISOString(),
        commissionOptions: ["transferToNewRep", "transferToHouse"],
        noHouseRepContactId
      })
    }
  )
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

        const { previousUserId, newUserId } = body
        const commissionOption = (body.commissionOption as CommissionOption) || DEFAULT_COMMISSION_OPTION
        const effective = parseEffectiveDate(body.effectiveDate)

        if (!previousUserId || !newUserId) {
          return NextResponse.json(
            { error: "previousUserId and newUserId are required" },
            { status: 400 }
          )
        }

        if (previousUserId === newUserId) {
          return NextResponse.json(
            { error: "Previous user and new user must be different" },
            { status: 400 }
          )
        }

        const tenantId = req.user.tenantId
        const actingUserId = req.user.id

        const summary = await prisma.$transaction(async (tx) => {
          const counts = await getEntityCounts(tx, tenantId, previousUserId, effective)

          const accountsUpdated = await tx.account.updateMany({
            where: { tenantId, ownerId: previousUserId },
            data: { ownerId: newUserId, updatedById: actingUserId, updatedAt: new Date() }
          })

          const contactsUpdated = await tx.contact.updateMany({
            where: { tenantId, ownerId: previousUserId, deletedAt: null },
            data: { ownerId: newUserId, updatedById: actingUserId, updatedAt: new Date() }
          })

          const groupsUpdated = await tx.group.updateMany({
            where: { tenantId, ownerId: previousUserId },
            data: { ownerId: newUserId, updatedAt: new Date() }
          })

          const productsUpdated = await tx.product.updateMany({
            where: { tenantId, createdById: previousUserId },
            data: {
              createdById: newUserId,
              updatedById: actingUserId,
              updatedAt: new Date()
            }
          })

          const opportunitiesUpdated = await tx.opportunity.updateMany({
            where: { tenantId, ownerId: previousUserId, status: "Open" },
            data: {
              ownerId: newUserId,
              updatedById: actingUserId,
              updatedAt: new Date()
            }
          })

          const tasksUpdated = await tx.activity.updateMany({
            where: {
              tenantId,
              assigneeId: previousUserId,
              status: "Open",
              activityType: "ToDo"
            },
            data: { assigneeId: newUserId, updatedById: actingUserId, updatedAt: new Date() }
          })

          const ticketsUpdated = await tx.ticket.updateMany({
            where: { tenantId, assignedToId: previousUserId },
            data: { assignedToId: newUserId, updatedAt: new Date() }
          })

          const activitiesUpdated = await tx.activity.updateMany({
            where: { tenantId, assigneeId: previousUserId, status: "Open" },
            data: { assigneeId: newUserId, updatedById: actingUserId, updatedAt: new Date() }
          })

          const notesUpdated = await tx.activity.updateMany({
            where: { tenantId, creatorId: previousUserId, activityType: "Note" },
            data: { updatedById: actingUserId, updatedAt: new Date() }
          })

          const noHouseRepContactId =
            commissionOption === "transferToHouse"
              ? await ensureNoHouseRepContactId(tenantId)
              : null

          return {
            counts,
            accountsUpdated: accountsUpdated.count,
            contactsUpdated: contactsUpdated.count,
            groupsUpdated: groupsUpdated.count,
            productsUpdated: productsUpdated.count,
            opportunitiesUpdated: opportunitiesUpdated.count,
            tasksUpdated: tasksUpdated.count,
            ticketsUpdated: ticketsUpdated.count,
            activitiesUpdated: activitiesUpdated.count,
            notesUpdated: notesUpdated.count,
            revenueSchedulesUpdated: 0,
            commissionSplitsAdjusted: 0,
            commissionOption,
            noHouseRepContactId
          }
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
