import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { logContactAudit } from "@/lib/audit"
import { mapOpportunityToRow } from "../../opportunities/helpers"
import { revalidatePath } from "next/cache"
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

function mapContactToDetail(contact: any) {
  return {
    id: contact.id,
    accountId: contact.accountId,
    accountName: contact.account?.accountName ?? "",
    accountTypeId: contact.accountTypeId,
    accountTypeName: contact.accountType?.name ?? "",
    ownerId: contact.ownerId,
    ownerName: contact.owner ? `${contact.owner.firstName ?? ""} ${contact.owner.lastName ?? ""}`.trim() : "",
    suffix: contact.suffix ?? "",
    prefix: contact.prefix ?? "",
    firstName: contact.firstName,
    middleName: contact.middleName ?? "",
    lastName: contact.lastName,
    fullName: contact.fullName,
    jobTitle: contact.jobTitle ?? "",
    department: contact.department ?? "",
    contactType: contact.contactType ?? "",
    active: contact.deletedAt === null,
    workPhone: contact.workPhone ?? "",
    workPhoneExt: contact.workPhoneExt ?? "",
    mobilePhone: contact.mobilePhone ?? "",
    otherPhone: contact.otherPhone ?? "",
    fax: contact.fax ?? "",
    emailAddress: contact.emailAddress ?? "",
    alternateEmail: contact.alternateEmail ?? "",
    preferredContactMethod: contact.preferredContactMethod,
    isPrimary: contact.isPrimary,
    isDecisionMaker: contact.isDecisionMaker,
    assistantName: contact.assistantName ?? "",
    assistantPhone: contact.assistantPhone ?? "",
    linkedinUrl: contact.linkedinUrl ?? "",
    websiteUrl: contact.websiteUrl ?? "",
    birthdate: contact.birthdate,
    anniversary: contact.anniversary,
    description: contact.description ?? "",
    notes: contact.notes ?? "",
    syncAddressWithAccount: contact.syncAddressWithAccount,
    mailingAddress: contact.mailingAddress
      ? {
          id: contact.mailingAddress.id,
          line1: contact.mailingAddress.line1,
          line2: contact.mailingAddress.line2,
          city: contact.mailingAddress.city,
          state: contact.mailingAddress.state,
          postalCode: contact.mailingAddress.postalCode,
          country: contact.mailingAddress.country
        }
      : null,
    reportsToContactId: contact.reportsToContactId,
    reportsToContactName: contact.reportsTo ? `${contact.reportsTo.firstName ?? ""} ${contact.reportsTo.lastName ?? ""}`.trim() : "",
    deletedAt: contact.deletedAt,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt
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

const contactActivityInclude = {
  creator: { select: { firstName: true, lastName: true } },
  account: { select: { accountName: true } },
  attachments: {
    include: {
      uploadedBy: { select: { firstName: true, lastName: true } }
    }
  }
} satisfies Prisma.ActivityInclude;
function mapContactActivityRow(activity: any) {
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
    active: activity.status === 'Open',
    activityDate: activity.dueDate ?? activity.createdAt,
    activityType: activity.activityType,
    activityStatus: activity.status,
    description: activity.subject,
    accountName: activity.account?.accountName ?? "",
    attachment: attachmentLabel,
    fileName: primaryFileName,
    createdBy: creatorName,
    attachments
  }
}

function mapContactOpportunityRow(opportunity: any) {
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

function mapContactGroupRow(member: any) {
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
    owner: ownerName
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withPermissions(
    request,
    ['contacts.manage', 'contacts.read'],
    async (req) => {
      try {
        const contactId = params.id
        const tenantId = req.user.tenantId

    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        tenantId
      },
      include: {
        accountType: { select: { name: true } },
        account: { select: { accountName: true } },
        owner: { select: { firstName: true, lastName: true } },
        reportsTo: { select: { firstName: true, lastName: true } },
        mailingAddress: true
      }
    })

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    const [activities, opportunities, groupMemberships] = await Promise.all([
      prisma.activity.findMany({
        where: { tenantId, contactId: contact.id },
        include: contactActivityInclude,
        orderBy: [
          { dueDate: "desc" },
          { createdAt: "desc" }
        ],
        take: 5
      }),
      prisma.opportunity.findMany({
        where: { tenantId, accountId: contact.accountId },
        include: { owner: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      prisma.groupMember.findMany({
        where: { tenantId, contactId: contact.id },
        include: {
          group: {
            include: {
              owner: { select: { firstName: true, lastName: true } }
            }
          }
        },
        orderBy: { addedAt: "desc" },
        take: 5
      })
    ])

    const data = {
      ...mapContactToDetail(contact),
      activities: activities.map(mapContactActivityRow),
      opportunities: opportunities.map(mapOpportunityToRow),
      groups: groupMemberships.map(mapContactGroupRow)
    }

        return NextResponse.json({ data })
      } catch (error) {
        console.error("Failed to load contact", error)
        return NextResponse.json({ error: "Failed to load contact" }, { status: 500 })
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
    ['contacts.manage'],
    async (req) => {
      try {
        const body = await request.json()
        const contactId = params.id
        const tenantId = req.user.tenantId
        const userId = req.user.id

    const existingContact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        tenantId
      }
    })

            if (!existingContact) {
          return NextResponse.json({ error: "Contact not found" }, { status: 404 })
        }

        const opportunityCount = await prisma.opportunity.count({
          where: {
            tenantId,
            accountId: existingContact.accountId
          }
        })
    // Handle restore action
    if (body.action === "restore") {
      const restoredContact = await prisma.contact.update({
        where: { id: contactId },
        data: {
          deletedAt: null,
          deletedById: null,
          updatedById: userId
        },
        include: {
          accountType: { select: { name: true } },
          account: { select: { accountName: true } },
          owner: { select: { firstName: true, lastName: true } },
          reportsTo: { select: { firstName: true, lastName: true } },
          mailingAddress: true
        }
      })

      // Log audit event for contact restore
      await logContactAudit(
        AuditAction.Update,
        contactId,
        userId,
        tenantId,
        request,
        { deletedAt: existingContact.deletedAt },
        { deletedAt: null }
      )

      // Invalidate cache
      revalidatePath('/contacts')
      revalidatePath('/dashboard')
      revalidatePath(`/contacts/${contactId}`)
      if (restoredContact.accountId) {
        revalidatePath(`/accounts/${restoredContact.accountId}`)
      }

      return NextResponse.json({
        data: mapContactToDetail(restoredContact),
        message: "Contact restored successfully"
      })
    }

    const updateData: Record<string, any> = {
      updatedById: userId
    }

    if (body.contactType !== undefined && body.accountId === undefined) {
      return NextResponse.json({ error: "Contact type inherits from the selected account and cannot be modified directly" }, { status: 422 })
    }

    if (body.accountTypeId !== undefined && body.accountId === undefined) {
      return NextResponse.json({ error: "Contact type inherits from the selected account and cannot be modified directly" }, { status: 422 })
    }

    if (body.accountId !== undefined) {
      const account = await prisma.account.findFirst({
        where: {
          id: body.accountId,
          tenantId
        },
        select: {
          id: true,
          accountTypeId: true,
          accountType: {
            select: {
              name: true,
              isAssignableToContacts: true
            }
          }
        }
      })

      if (!account) {
        return createErrorResponse("Account not found", 404)
      }

      if (!account.accountTypeId) {
        return createErrorResponse("Selected account does not have an account type configured", 422)
      }

      if (account.accountType && account.accountType.isAssignableToContacts === false) {
        return createErrorResponse("Selected account type cannot be assigned to contacts", 422)
      }

      updateData.accountId = body.accountId
      updateData.accountTypeId = account.accountTypeId
      updateData.contactType = account.accountType?.name ?? existingContact.contactType ?? null
    }

    if (body.firstName || body.lastName) {
      const firstName = body.firstName ?? existingContact.firstName
      const lastName = body.lastName ?? existingContact.lastName
      updateData.firstName = firstName
      updateData.lastName = lastName
      updateData.fullName = `${firstName} ${lastName}`
    }

    if (body.suffix !== undefined) updateData.suffix = body.suffix
    if (body.prefix !== undefined) updateData.prefix = body.prefix
    if (body.middleName !== undefined) updateData.middleName = body.middleName
    if (body.jobTitle !== undefined) updateData.jobTitle = body.jobTitle
    if (body.department !== undefined) updateData.department = body.department
    if (body.workPhone !== undefined) updateData.workPhone = body.workPhone
    if (body.workPhoneExt !== undefined) updateData.workPhoneExt = body.workPhoneExt
    if (body.mobilePhone !== undefined) updateData.mobilePhone = body.mobilePhone
    if (body.otherPhone !== undefined) updateData.otherPhone = body.otherPhone
    if (body.fax !== undefined) updateData.fax = body.fax
    if (body.emailAddress !== undefined) updateData.emailAddress = body.emailAddress
    if (body.alternateEmail !== undefined) updateData.alternateEmail = body.alternateEmail
    if (body.preferredContactMethod !== undefined) updateData.preferredContactMethod = body.preferredContactMethod
    if (body.isPrimary !== undefined) updateData.isPrimary = body.isPrimary
    if (body.isDecisionMaker !== undefined) updateData.isDecisionMaker = body.isDecisionMaker
    if (body.assistantName !== undefined) updateData.assistantName = body.assistantName
    if (body.assistantPhone !== undefined) updateData.assistantPhone = body.assistantPhone
    if (body.linkedinUrl !== undefined) updateData.linkedinUrl = body.linkedinUrl
    if (body.websiteUrl !== undefined) updateData.websiteUrl = body.websiteUrl
    if (body.birthdate !== undefined) updateData.birthdate = body.birthdate ? new Date(body.birthdate) : null
    if (body.anniversary !== undefined) updateData.anniversary = body.anniversary ? new Date(body.anniversary) : null
    if (body.description !== undefined) updateData.description = body.description
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.syncAddressWithAccount !== undefined) updateData.syncAddressWithAccount = body.syncAddressWithAccount
    if (body.ownerId !== undefined) updateData.ownerId = body.ownerId
    if (body.reportsToContactId !== undefined) updateData.reportsToContactId = body.reportsToContactId

    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
      include: {
        accountType: { select: { name: true } },
        account: { select: { accountName: true } },
        owner: { select: { firstName: true, lastName: true } },
        reportsTo: { select: { firstName: true, lastName: true } },
        mailingAddress: true
      }
    })

        // Log audit event for contact update
        await logContactAudit(
          AuditAction.Update,
          contactId,
          userId,
          tenantId,
          request,
          {
            firstName: existingContact.firstName,
            lastName: existingContact.lastName,
            fullName: existingContact.fullName,
            jobTitle: existingContact.jobTitle,
            emailAddress: existingContact.emailAddress,
            workPhone: existingContact.workPhone,
            mobilePhone: existingContact.mobilePhone,
            isPrimary: existingContact.isPrimary,
            isDecisionMaker: existingContact.isDecisionMaker
          },
          {
            firstName: updatedContact.firstName,
            lastName: updatedContact.lastName,
            fullName: updatedContact.fullName,
            jobTitle: updatedContact.jobTitle,
            emailAddress: updatedContact.emailAddress,
            workPhone: updatedContact.workPhone,
            mobilePhone: updatedContact.mobilePhone,
            isPrimary: updatedContact.isPrimary,
            isDecisionMaker: updatedContact.isDecisionMaker
          }
        )

        // Invalidate cache to ensure UI updates immediately
        revalidatePath('/contacts')
        revalidatePath('/dashboard')
        revalidatePath(`/contacts/${contactId}`)
        if (updatedContact.accountId) {
          revalidatePath(`/accounts/${updatedContact.accountId}`)
        }

        return NextResponse.json({
          data: mapContactToDetail(updatedContact),
          message: "Contact updated successfully"
        })
      } catch (error) {
        console.error("Failed to update contact", error)
        return NextResponse.json({ error: "Failed to update contact" }, { status: 500 })
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
    ['contacts.manage'],
    async (req) => {
      try {
        const contactId = params.id
        const tenantId = req.user.tenantId
        const userId = req.user.id
        const url = new URL(request.url)
        const stage = url.searchParams.get('stage') || 'soft'
        const bypassConstraints = url.searchParams.get('bypassConstraints') === 'true'

        const existingContact = await prisma.contact.findFirst({
          where: {
            id: contactId,
            tenantId
          },
          include: {
            activities: { select: { id: true } },
            groupMembers: { select: { id: true } }
          }
        })

        if (!existingContact) {
          return NextResponse.json({ error: "Contact not found" }, { status: 404 })
        }

        const opportunityCount = await prisma.opportunity.count({
          where: {
            tenantId,
            accountId: existingContact.accountId
          }
        })
        if (stage === 'soft') {
          // Check for dependencies unless bypassing constraints
          if (!bypassConstraints) {
            const constraints = []
            
            if (existingContact.activities.length > 0) {
              constraints.push({
                type: 'activities',
                count: existingContact.activities.length,
                message: `This contact has ${existingContact.activities.length} associated activities`
              })
            }
            
            if (opportunityCount > 0) {
              constraints.push({
                type: 'opportunities', 
                count: opportunityCount,
                message: `This contact has ${opportunityCount} associated opportunities`
              })
            }
            
            if (existingContact.groupMembers.length > 0) {
              constraints.push({
                type: 'groups',
                count: existingContact.groupMembers.length, 
                message: `This contact belongs to ${existingContact.groupMembers.length} groups`
              })
            }

            if (constraints.length > 0) {
              return NextResponse.json({
                error: "Contact has dependencies that must be handled first",
                constraints
              }, { status: 409 })
            }
          }

          // Perform soft delete
          await prisma.contact.update({
            where: { id: contactId },
            data: {
              deletedAt: new Date(),
              deletedById: userId,
              updatedById: userId
            }
          })

          // Log audit event for soft deletion
          await logContactAudit(
            AuditAction.Delete,
            contactId,
            userId,
            tenantId,
            request,
            {
              firstName: existingContact.firstName,
              lastName: existingContact.lastName,
              fullName: existingContact.fullName,
              jobTitle: existingContact.jobTitle,
              emailAddress: existingContact.emailAddress,
              workPhone: existingContact.workPhone,
              mobilePhone: existingContact.mobilePhone,
              accountId: existingContact.accountId,
              deletedAt: null
            },
            { deletedAt: new Date() }
      )

          // Invalidate cache
          revalidatePath('/contacts')
          revalidatePath('/dashboard')
          if (existingContact.accountId) {
            revalidatePath(`/accounts/${existingContact.accountId}`)
          }

          return NextResponse.json({
            message: "Contact soft deleted successfully"
          })

        } else if (stage === 'permanent') {
          // Check if contact is already soft deleted
          if (!existingContact.deletedAt) {
            return NextResponse.json({ 
              error: "Contact must be soft deleted before permanent deletion" 
            }, { status: 400 })
          }

          // Perform permanent deletion with cascades
          await prisma.$transaction(async (tx) => {
            // Delete associated activities
            await tx.activity.deleteMany({
              where: { contactId: contactId, tenantId }
            })

            // Remove from groups
            await tx.groupMember.deleteMany({
              where: { contactId: contactId, tenantId }
            })

            // Delete the contact permanently
            await tx.contact.delete({
              where: { id: contactId }
            })
          })

          // Log audit event for permanent deletion
          await logContactAudit(
            AuditAction.Delete,
            contactId,
            userId,
            tenantId,
            request,
            {
              firstName: existingContact.firstName,
              lastName: existingContact.lastName,
              fullName: existingContact.fullName,
              jobTitle: existingContact.jobTitle,
              emailAddress: existingContact.emailAddress,
              workPhone: existingContact.workPhone,
              mobilePhone: existingContact.mobilePhone,
              accountId: existingContact.accountId,
              deletedAt: existingContact.deletedAt
            },
            undefined
      )

          // Invalidate cache
          revalidatePath('/contacts')
          revalidatePath('/dashboard')
          if (existingContact.accountId) {
            revalidatePath(`/accounts/${existingContact.accountId}`)
          }

          return NextResponse.json({
            message: "Contact permanently deleted successfully"
          })
        }

        return NextResponse.json({ error: "Invalid deletion stage" }, { status: 400 })
      } catch (error) {
        console.error("Failed to delete contact", error)
        return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 })
      }
    }
  )
}
























