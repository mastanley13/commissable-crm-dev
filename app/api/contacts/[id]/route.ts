import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { logContactAudit } from "@/lib/audit"
import { revalidatePath } from "next/cache"
export const dynamic = 'force-dynamic';

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
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt
  }
}

function mapContactActivityRow(activity: any) {
  const creatorName = activity.creator
    ? `${activity.creator.firstName ?? ""} ${activity.creator.lastName ?? ""}`.trim()
    : ""

  return {
    id: activity.id,
    active: activity.status !== "Completed" && activity.status !== "Cancelled",
    activityDate: activity.dueDate ?? activity.createdAt,
    activityType: activity.activityType,
    activityStatus: activity.status,
    description: activity.subject,
    accountName: activity.account?.accountName ?? "",
    attachment: "-",
    fileName: "-",
    createdBy: creatorName
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
    active: true,
    groupName: member.group.name,
    visibility: member.group.visibility,
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
        include: {
          creator: { select: { firstName: true, lastName: true } },
          account: { select: { accountName: true } }
        },
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
      opportunities: opportunities.map(mapContactOpportunityRow),
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

    const updateData: Record<string, any> = {
      updatedById: userId
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
    if (body.contactType !== undefined) updateData.contactType = body.contactType
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
    if (body.accountTypeId !== undefined) updateData.accountTypeId = body.accountTypeId
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

        const existingContact = await prisma.contact.findFirst({
          where: {
            id: contactId,
            tenantId
          }
        })

        if (!existingContact) {
          return NextResponse.json({ error: "Contact not found" }, { status: 404 })
        }

        const userId = req.user.id

        await prisma.contact.delete({ where: { id: contactId } })

        // Log audit event for contact deletion
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
            accountId: existingContact.accountId
          },
          undefined
        )

        // Invalidate cache to ensure UI updates immediately
        revalidatePath('/contacts')
        revalidatePath('/dashboard')
        if (existingContact.accountId) {
          revalidatePath(`/accounts/${existingContact.accountId}`)
        }

        return NextResponse.json({
          message: "Contact deleted successfully"
        })
      } catch (error) {
        console.error("Failed to delete contact", error)
        return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 })
      }
    }
  )
}

