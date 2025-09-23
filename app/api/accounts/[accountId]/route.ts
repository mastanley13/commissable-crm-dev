import { NextRequest, NextResponse } from "next/server"
import { AccountStatus, AuditAction } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { mapAccountToListRow, accountIncludeForList } from "../helpers"
import { logAccountAudit } from "@/lib/audit"
import { revalidatePath } from "next/cache"
import { checkDeletionConstraints, softDeleteEntity, permanentDeleteEntity, restoreEntity } from "@/lib/deletion"
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

function mapAddressForDetail(address: any | null) {
  if (!address) {
    return null
  }

  return {
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    postalCode: address.postalCode ?? "",
    country: address.country ?? ""
  }
}

function mapAccountContactRow(contact: any) {
  return {
    id: contact.id,
    active: Boolean(contact.isPrimary),
    suffix: contact.suffix ?? "",
    fullName: contact.fullName,
    jobTitle: contact.jobTitle ?? "",
    contactType: contact.accountType?.name ?? contact.contactType ?? "",
    emailAddress: contact.emailAddress ?? "",
    workPhone: contact.workPhone ?? "",
    extension: contact.workPhoneExt ?? ""
  }
}

function mapAccountOpportunityRow(opportunity: any) {
  const ownerName = opportunity.owner
    ? `${opportunity.owner.firstName ?? ""} ${opportunity.owner.lastName ?? ""}`.trim()
    : ""

  return {
    id: opportunity.id,
    active: opportunity.status === "Open" || opportunity.status === "OnHold",
    orderIdHouse: opportunity.id.slice(0, 8).toUpperCase(),
    opportunityName: opportunity.name,
    stage: opportunity.stage,
    owner: ownerName,
    estimatedCloseDate: opportunity.estimatedCloseDate,
    referredBy: opportunity.leadSource
  }
}

function mapAccountGroupRow(member: any) {
  const ownerName = member.group.owner
    ? `${member.group.owner.firstName ?? ""} ${member.group.owner.lastName ?? ""}`.trim()
    : ""

  return {
    id: member.group.id,
    active: true,
    groupName: member.group.name,
    visibility: member.group.visibility,
    description: member.group.description ?? "",
    owner: ownerName
  }
}

function mapAccountActivityRow(accountName: string, activity: any) {
  const creatorName = activity.creator
    ? `${activity.creator.firstName ?? ""} ${activity.creator.lastName ?? ""}`.trim()
    : ""

  return {
    id: activity.id,
    active: activity.status === 'Open',
    activityDate: activity.dueDate ?? activity.createdAt,
    activityType: activity.activityType,
    activityStatus: activity.status,
    description: activity.subject,
    accountName,
    attachment: "-",
    fileName: "-",
    createdBy: creatorName
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  return withPermissions(
    request,
    ['accounts.manage', 'accounts.read'],
    async (req) => {
      try {
        const { accountId } = params
        if (!accountId) {
          return NextResponse.json({ error: "Account id is required" }, { status: 400 })
        }

        const tenantId = req.user.tenantId

    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        tenantId
      },
      include: {
        accountType: { select: { name: true } },
        parent: { select: { accountName: true } },
        owner: { select: { firstName: true, lastName: true } },
        industry: { select: { name: true } },
        shippingAddress: true,
        billingAddress: true
      }
    })

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    const [contacts, opportunities, groupMembers, activities] = await Promise.all([
      prisma.contact.findMany({
        where: { tenantId, accountId },
        include: { accountType: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      prisma.opportunity.findMany({
        where: { tenantId, accountId },
        include: { owner: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      prisma.groupMember.findMany({
        where: { tenantId, accountId },
        include: {
          group: {
            include: {
              owner: { select: { firstName: true, lastName: true } }
            }
          }
        },
        orderBy: { addedAt: "desc" },
        take: 5
      }),
      prisma.activity.findMany({
        where: { tenantId, accountId },
        include: {
          creator: { select: { firstName: true, lastName: true } }
        },
        orderBy: [
          { dueDate: "desc" },
          { createdAt: "desc" }
        ],
        take: 5
      })
    ])

    const data = {
      id: account.id,
      accountName: account.accountName,
      accountLegalName: account.accountLegalName ?? "",
      parentAccount: account.parent?.accountName ?? "",
      accountType: account.accountType?.name ?? "",
      active: account.status === AccountStatus.Active,
      accountOwner: account.owner
        ? `${account.owner.firstName ?? ""} ${account.owner.lastName ?? ""}`.trim()
        : "",
      industry: account.industry?.name ?? "",
      orderIdHouse: account.accountNumber ?? "",
      websiteUrl: account.websiteUrl ?? "",
      description: account.description ?? "",
      shippingAddress: mapAddressForDetail(account.shippingAddress),
      billingAddress: mapAddressForDetail(account.billingAddress),
      billingSameAsShipping:
        Boolean(account.shippingSyncBilling) ||
        (!account.billingAddressId && Boolean(account.shippingAddressId)),
      contacts: contacts.map(mapAccountContactRow),
      opportunities: opportunities.map(mapAccountOpportunityRow),
      groups: groupMembers.map(mapAccountGroupRow),
      activities: activities.map(activity => mapAccountActivityRow(account.accountName, activity))
    }

        return NextResponse.json({ data })
      } catch (error) {
        console.error("Failed to load account", error)
        return NextResponse.json({ error: "Failed to load account" }, { status: 500 })
      }
    }
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  return withPermissions(
    request,
    ['accounts.manage'],
    async (req) => {
      try {
        const { accountId } = params
        if (!accountId) {
          return NextResponse.json({ error: "Account id is required" }, { status: 400 })
        }

        const payload = await request.json().catch(() => ({}))
        const tenantId = req.user.tenantId
        const userId = req.user.id

    const existing = await prisma.account.findFirst({
      where: { id: accountId, tenantId },
      select: { id: true, status: true }
    })

    if (!existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    const data: Record<string, any> = {
      updatedById: userId
    }

    let hasChanges = false

    if (typeof payload?.active === "boolean") {
      data.status = payload.active ? AccountStatus.Active : AccountStatus.Inactive
      hasChanges = true
    }

    // Handle restore operation
    if (payload?.action === "restore") {
      const result = await restoreEntity('Account', accountId, tenantId, userId)
      
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      await logAccountAudit(
        AuditAction.Update,
        accountId,
        userId,
        tenantId,
        request,
        { status: existing.status },
        { status: AccountStatus.Active, action: 'restore' }
      )

      // Invalidate cache
      revalidatePath('/accounts')
      revalidatePath('/dashboard')
      revalidatePath(`/accounts/${accountId}`)

      const updated = await prisma.account.findFirst({
        where: { id: accountId },
        include: accountIncludeForList
      })

      return NextResponse.json({ data: updated ? mapAccountToListRow(updated) : null })
    }

    if (!hasChanges) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 })
    }

    const updated = await prisma.account.update({
      where: { id: accountId },
      data,
      include: accountIncludeForList
    })

        await logAccountAudit(
          AuditAction.Update,
          accountId,
          userId,
          tenantId,
          request,
          { status: existing.status },
          { status: updated.status }
        )

        // Invalidate cache to ensure UI updates immediately
        revalidatePath('/accounts')
        revalidatePath('/dashboard')
        revalidatePath(`/accounts/${accountId}`)

        return NextResponse.json({ data: mapAccountToListRow(updated) })
      } catch (error) {
        console.error("Failed to update account", error)
        return NextResponse.json({ error: "Failed to update account" }, { status: 500 })
      }
    }
  )
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  return withPermissions(
    request,
    ['accounts.manage'],
    async (req) => {
      try {
        const { accountId } = params
        if (!accountId) {
          return NextResponse.json({ error: "Account id is required" }, { status: 400 })
        }

        const url = new URL(request.url)
        const stage = url.searchParams.get('stage') || 'soft'
        const bypassConstraints = url.searchParams.get('bypassConstraints') === 'true'

        const tenantId = req.user.tenantId
        const userId = req.user.id

        const existing = await prisma.account.findFirst({
          where: { id: accountId, tenantId },
          select: { id: true, accountName: true, accountLegalName: true, status: true }
        })

        if (!existing) {
          return NextResponse.json({ error: "Account not found" }, { status: 404 })
        }

        if (stage === 'check') {
          // Just check constraints without performing deletion
          const constraints = await checkDeletionConstraints('Account', accountId, tenantId)
          return NextResponse.json({ constraints })
        }

        if (stage === 'permanent') {
          // Permanent deletion - requires admin permissions
          if (!(req.user as any).permissions?.includes('accounts.permanent_delete')) {
            return NextResponse.json({ error: "Insufficient permissions for permanent deletion" }, { status: 403 })
          }

          const result = await permanentDeleteEntity('Account', accountId, tenantId, userId)
          
          if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 })
          }

          await logAccountAudit(
            AuditAction.Delete,
            accountId,
            userId,
            tenantId,
            request,
            {
              accountName: existing.accountName,
              accountLegalName: existing.accountLegalName,
              stage: 'permanent'
            },
            undefined
          )

          // Invalidate cache
          revalidatePath('/accounts')
          revalidatePath('/dashboard')

          return NextResponse.json({ success: true, stage: 'permanent' })
        }

        // Default: Soft deletion
        const result = await softDeleteEntity('Account', accountId, tenantId, userId, bypassConstraints)
        
        if (!result.success) {
          if (result.constraints) {
            return NextResponse.json({ 
              success: false, 
              constraints: result.constraints 
            }, { status: 409 })
          }
          return NextResponse.json({ error: result.error }, { status: 400 })
        }

        await logAccountAudit(
          AuditAction.Delete,
          accountId,
          userId,
          tenantId,
          request,
          {
            accountName: existing.accountName,
            accountLegalName: existing.accountLegalName,
            stage: 'soft',
            bypassConstraints
          },
          { status: AccountStatus.Inactive }
        )

        // Invalidate cache
        revalidatePath('/accounts')
        revalidatePath('/dashboard')
        revalidatePath(`/accounts/${accountId}`)

        return NextResponse.json({ success: true, stage: 'soft' })
      } catch (error) {
        console.error("Failed to delete account", error)
        return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
      }
    }
  )
}

