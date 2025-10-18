import { NextRequest, NextResponse } from "next/server"
import { AccountStatus, AuditAction, ActivityStatus } from "@prisma/client"
import { isActivityOpen } from "@/lib/activity-status"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { mapAccountToListRow, accountIncludeForList } from "../helpers"
import { mapOpportunityToRow } from "../../opportunities/helpers"
import { logAccountAudit } from "@/lib/audit"
import { revalidatePath } from "next/cache"
import { checkDeletionConstraints, softDeleteEntity, permanentDeleteEntity, restoreEntity } from "@/lib/deletion"
import { ensureActiveOwnerOrNull } from "@/lib/validation"

type AddressInput = {
  line1: string
  city: string
  line2?: string
  state?: string
  postalCode?: string
  country?: string
}

function parseAddress(raw: unknown): AddressInput | null {
  if (!raw || typeof raw !== "object") {
    return null
  }

  const candidate = raw as Record<string, unknown>
  const line1 = typeof candidate.line1 === "string" ? candidate.line1.trim() : ""
  const city = typeof candidate.city === "string" ? candidate.city.trim() : ""

  if (!line1 || !city) {
    return null
  }

  const line2 = typeof candidate.line2 === "string" ? candidate.line2.trim() : ""
  const state = typeof candidate.state === "string" ? candidate.state.trim() : ""
  const postalCode = typeof candidate.postalCode === "string" ? candidate.postalCode.trim() : ""
  const country = typeof candidate.country === "string" ? candidate.country.trim() : ""

  return {
    line1,
    city,
    line2: line2 || undefined,
    state: state || undefined,
    postalCode: postalCode || undefined,
    country: country || undefined
  }
}

async function createOrUpdateAddressRecord(tenantId: string, input: AddressInput | null, existingId?: string | null): Promise<string | null> {
  if (!input) {
    return null
  }

  const addressData = {
    tenantId,
    line1: input.line1,
    line2: input.line2 ?? null,
    city: input.city,
    state: input.state ?? null,
    postalCode: input.postalCode ?? null,
    country: input.country ?? null
  }

  if (existingId) {
    // Update existing address
    const address = await prisma.address.update({
      where: { id: existingId },
      data: addressData
    })
    return address.id
  } else {
    // Create new address
    const address = await prisma.address.create({
      data: addressData
    })
    return address.id
  }
}
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

function formatGroupLabel(value?: string | null) {
  if (!value) return ""
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function formatVisibilityLabel(value?: string | null) {
  if (!value) return ""
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}



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

function mapActivityAttachmentSummary(attachment: any) {
  const uploadedByName = attachment.uploadedBy
    ? `${attachment.uploadedBy.firstName ?? ""} ${attachment.uploadedBy.lastName ?? ""}`.trim()
    : ""

  return {
    id: attachment.id,
    fileName: attachment.fileName,
    fileSize: attachment.fileSize ?? 0,
    mimeType: attachment.mimeType ?? "application/octet-stream",
    uploadedAt: attachment.uploadedAt,
    uploadedByName: uploadedByName || "Unknown"
  }
}


// Define include shape without hard-typing to Prisma's generated types.
// Some build environments (e.g., Vercel) may have a different generated client
// that does not surface the 'attachments' relation in ActivityInclude typing.
// Using a plain object here avoids excess property checks on object literals.
const recentActivityInclude = {
  creator: { select: { firstName: true, lastName: true } },
  attachments: {
    include: {
      uploadedBy: { select: { firstName: true, lastName: true } }
    }
  }
} as const;
function mapAccountContactRow(contact: any) {
  return {
    id: contact.id,
    active: !contact.deletedAt, // Contact is active if not soft deleted
    suffix: contact.suffix ?? "",
    firstName: contact.firstName ?? "",
    lastName: contact.lastName ?? "",
    fullName: contact.fullName,
    jobTitle: contact.jobTitle ?? "",
    contactType: contact.accountType?.name ?? contact.contactType ?? "",
    emailAddress: contact.emailAddress ?? "",
    workPhone: contact.workPhone ?? "",
    mobile: contact.mobilePhone ?? "",
    extension: contact.workPhoneExt ?? "",
    isPrimary: Boolean(contact.isPrimary), // Keep isPrimary as a separate field
    isDeleted: Boolean(contact.deletedAt),
    deletedAt: contact.deletedAt
  }
}


function mapAccountGroupRow(member: any) {
  const ownerName = member.group.owner
    ? `${member.group.owner.firstName ?? ""} ${member.group.owner.lastName ?? ""}`.trim()
    : ""

  return {
    id: member.group.id,
    active: member.group.isActive !== false,
    groupName: member.group.name,
    groupType: formatGroupLabel(member.group.groupType),
    visibility: formatVisibilityLabel(member.group.visibility),
    description: member.group.description ?? "",
    ownerId: member.group.ownerId ?? null,
    owner: ownerName
  }
}

function mapAccountActivityRow(accountName: string, activity: any) {
  const creatorName = activity.creator
    ? `${activity.creator.firstName ?? ""} ${activity.creator.lastName ?? ""}`.trim()
    : ""

  const attachments = Array.isArray(activity.attachments)
    ? activity.attachments.map(mapActivityAttachmentSummary)
    : []

  const attachmentCount = attachments.length
  const attachmentLabel = attachmentCount === 0
    ? "None"
    : `${attachmentCount} file${attachmentCount === 1 ? "" : "s"}`
  const primaryFileName = attachments[0]?.fileName ?? ""

  return {
    id: activity.id,
    active: isActivityOpen(activity.status as ActivityStatus),
    activityDate: activity.dueDate ?? activity.createdAt,
    activityType: activity.activityType,
    activityStatus: activity.status,
    description: activity.subject,
    accountName,
    attachment: attachmentLabel,
    fileName: primaryFileName,
    createdBy: creatorName,
    attachments
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
        where: { 
          tenantId, 
          accountId,
          deletedAt: null  // Only fetch non-deleted contacts
        },
        include: { accountType: { select: { name: true } } },
        orderBy: { createdAt: "desc" }
      }),
      prisma.opportunity.findMany({
        where: { tenantId, accountId },
        include: { owner: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" }
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
        orderBy: { addedAt: "desc" }
      }),
      prisma.activity.findMany({
        where: { tenantId, accountId },
        // Cast to any to accommodate potential client type differences during build
        include: recentActivityInclude as any,
        orderBy: [
          { dueDate: "desc" },
          { createdAt: "desc" }
        ]
      })
    ])

    const data = {
      id: account.id,
      accountName: account.accountName,
      accountLegalName: account.accountLegalName ?? "",
      parentAccount: account.parent?.accountName ?? "",
      parentAccountId: account.parentAccountId ?? null,
      accountType: account.accountType?.name ?? "",
      accountTypeId: account.accountTypeId ?? null,
      active: account.status === AccountStatus.Active,
      accountOwner: account.owner
        ? `${account.owner.firstName ?? ""} ${account.owner.lastName ?? ""}`.trim()
        : "",
      ownerId: account.ownerId ?? null,
      industry: account.industry?.name ?? "",
      industryId: account.industryId ?? null,
      orderIdHouse: account.accountNumber ?? "",
      websiteUrl: account.websiteUrl ?? "",
      description: account.description ?? "",
      shippingAddress: mapAddressForDetail(account.shippingAddress),
      billingAddress: mapAddressForDetail(account.billingAddress),
      billingSameAsShipping:
        Boolean(account.shippingSyncBilling) ||
        (!account.billingAddressId && Boolean(account.shippingAddressId)),
      contacts: contacts.map(mapAccountContactRow),
      opportunities: opportunities.map(mapOpportunityToRow),
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

    const data: Record<string, any> = {
      updatedById: userId
    }

    let hasChanges = false

    // Handle basic account fields
    if (typeof payload?.accountName === "string" && payload.accountName.trim()) {
      data.accountName = payload.accountName.trim()
      hasChanges = true
    }

    if (typeof payload?.accountLegalName === "string") {
      data.accountLegalName = payload.accountLegalName.trim() || null
      hasChanges = true
    }

    if (typeof payload?.parentAccountId === "string") {
      data.parentAccountId = payload.parentAccountId.trim() || null
      hasChanges = true
    }

    if (typeof payload?.accountTypeId === "string" && payload.accountTypeId.trim()) {
      data.accountTypeId = payload.accountTypeId.trim()
      hasChanges = true
    }

    if (payload?.ownerId !== undefined) {
      const nextOwnerId = await ensureActiveOwnerOrNull(payload.ownerId, tenantId)
      data.ownerId = nextOwnerId
      hasChanges = true
    }

    if (typeof payload?.industryId === "string") {
      data.industryId = payload.industryId.trim() || null
      hasChanges = true
    }

    if (typeof payload?.websiteUrl === "string") {
      data.websiteUrl = payload.websiteUrl.trim() || null
      hasChanges = true
    }

    if (typeof payload?.description === "string") {
      data.description = payload.description.trim() || null
      hasChanges = true
    }

    if (typeof payload?.active === "boolean") {
      data.status = payload.active ? AccountStatus.Active : AccountStatus.Inactive
      hasChanges = true
    }

    // Get existing account with addresses for address updates
    const existingAccount = await prisma.account.findFirst({
      where: { id: accountId, tenantId },
      select: { 
        id: true, 
        status: true, 
        shippingAddressId: true, 
        billingAddressId: true,
        shippingSyncBilling: true
      }
    })

    if (!existingAccount) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    // Handle address updates
    let shippingAddressId = existingAccount.shippingAddressId
    let billingAddressId = existingAccount.billingAddressId
    let shippingSyncBilling = existingAccount.shippingSyncBilling

    if (payload?.shippingAddress && typeof payload.shippingAddress === "object") {
      const shippingAddressInput = parseAddress(payload.shippingAddress)
      if (shippingAddressInput) {
        shippingAddressId = await createOrUpdateAddressRecord(tenantId, shippingAddressInput, existingAccount.shippingAddressId)
        if (shippingAddressId) {
          data.shippingAddressId = shippingAddressId
          hasChanges = true
        }
      }
    }

    if (payload?.billingAddress && typeof payload.billingAddress === "object") {
      const billingAddressInput = parseAddress(payload.billingAddress)
      if (billingAddressInput) {
        billingAddressId = await createOrUpdateAddressRecord(tenantId, billingAddressInput, existingAccount.billingAddressId)
        if (billingAddressId) {
          data.billingAddressId = billingAddressId
          hasChanges = true
        }
      }
    }

    // Handle billing sync with shipping
    if (typeof payload?.billingSameAsShipping === "boolean") {
      shippingSyncBilling = payload.billingSameAsShipping
      data.shippingSyncBilling = shippingSyncBilling
      
      if (shippingSyncBilling && shippingAddressId) {
        data.billingAddressId = shippingAddressId
      }
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
        { status: existingAccount.status },
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
          { status: existingAccount.status },
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
