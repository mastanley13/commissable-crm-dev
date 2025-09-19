import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { logContactAudit } from "@/lib/audit"
import { validateContactData, createValidationErrorResponse, normalizeEmail, formatPhoneNumber } from "@/lib/validation"
import { revalidatePath } from "next/cache"
export const dynamic = 'force-dynamic';

function mapContactToListRow(contact: any) {
  return {
    id: contact.id,
    select: false,
    active: contact.isPrimary, // Use isPrimary as the "active" indicator
    suffix: contact.suffix ?? "",
    fullName: contact.fullName,
    jobTitle: contact.jobTitle ?? "",
    contactType: contact.accountType?.name ?? "",
    mobile: contact.mobilePhone ?? "",
    workPhone: contact.workPhone ?? "",
    emailAddress: contact.emailAddress ?? "",
    extension: contact.workPhoneExt ?? "",
    // Additional fields for filtering
    accountId: contact.accountId,
    accountName: contact.account?.accountName ?? "",
    ownerId: contact.ownerId,
    ownerName: contact.owner ? `${contact.owner.firstName} ${contact.owner.lastName}` : "",
    isPrimary: contact.isPrimary,
    isDecisionMaker: contact.isDecisionMaker,
    preferredContactMethod: contact.preferredContactMethod,
    createdAt: contact.createdAt
  }
}

// Whitelist of sortable fields
const SORTABLE_FIELDS = {
  fullName: "fullName",
  jobTitle: "jobTitle", 
  emailAddress: "emailAddress",
  createdAt: "createdAt",
  contactType: "accountType.name"
}

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ['contacts.manage', 'contacts.read'],
    async (req) => {
      const searchParams = request.nextUrl.searchParams
      const tenantId = req.user.tenantId

    // Pagination
    const page = Number(searchParams.get("page") ?? "1")
    const pageSize = Math.min(Number(searchParams.get("pageSize") ?? "25"), 100) // Cap at 100

    // Search
    const query = searchParams.get("q")?.trim() ?? ""

    // Sorting
    const sortBy = searchParams.get("sortBy") ?? "createdAt"
    const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc"
    
    // Validate sort field
    const sortField = SORTABLE_FIELDS[sortBy as keyof typeof SORTABLE_FIELDS] || "createdAt"
    
    // Filters
    const accountTypeId = searchParams.get("accountTypeId")
    const ownerId = searchParams.get("ownerId") 
    const isPrimary = searchParams.get("isPrimary")
    const isDecisionMaker = searchParams.get("isDecisionMaker")
    const preferredContactMethod = searchParams.get("preferredContactMethod")

    // Build where clause
    const whereClause: any = { tenantId }

    // Search across multiple fields
    if (query.length > 0) {
      whereClause.OR = [
        { fullName: { contains: query, mode: "insensitive" } },
        { jobTitle: { contains: query, mode: "insensitive" } },
        { emailAddress: { contains: query, mode: "insensitive" } },
        { mobilePhone: { contains: query, mode: "insensitive" } },
        { workPhone: { contains: query, mode: "insensitive" } }
      ]
    }

    // Apply filters
    if (accountTypeId) {
      whereClause.accountTypeId = accountTypeId
    }
    if (ownerId) {
      whereClause.ownerId = ownerId
    }
    if (isPrimary !== null && isPrimary !== undefined && isPrimary !== "") {
      whereClause.isPrimary = isPrimary === "true"
    }
    if (isDecisionMaker !== null && isDecisionMaker !== undefined && isDecisionMaker !== "") {
      whereClause.isDecisionMaker = isDecisionMaker === "true"
    }
    if (preferredContactMethod) {
      whereClause.preferredContactMethod = preferredContactMethod
    }

    // Build orderBy clause
    let orderBy: any = {}
    if (sortField === "accountType.name") {
      orderBy = { accountType: { name: sortDir } }
    } else {
      orderBy[sortField] = sortDir
    }

      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where: whereClause,
          include: {
            accountType: { select: { name: true } },
            account: { select: { accountName: true } },
            owner: { select: { firstName: true, lastName: true } }
          },
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.contact.count({ where: whereClause })
      ])

      return NextResponse.json({
        data: contacts.map(mapContactToListRow),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      })
    }
  )
}

export async function POST(request: NextRequest) {
  return withPermissions(
    request,
    ['contacts.manage'],
    async (req) => {
      const body = await request.json()
      const tenantId = req.user.tenantId
      const userId = req.user.id

      // Validate contact data according to contract requirements
      const validationResult = validateContactData(body)
      if (!validationResult.isValid) {
        return createValidationErrorResponse(validationResult.errors)
      }

      const { accountId, firstName, lastName, jobTitle, workPhone, mobilePhone, emailAddress,
              accountTypeId, ownerId, isPrimary, isDecisionMaker, preferredContactMethod, mailingAddress } = body

      // Derive fullName
      const fullName = `${firstName} ${lastName}`

      // Create contact
      const contact = await prisma.contact.create({
        data: {
          tenantId,
          accountId,
          firstName,
          lastName,
          fullName,
          jobTitle,
          workPhone: workPhone ? formatPhoneNumber(workPhone) : null,
          mobilePhone: mobilePhone ? formatPhoneNumber(mobilePhone) : null,
          emailAddress: emailAddress ? normalizeEmail(emailAddress) : null,
          accountTypeId,
          ownerId,
          isPrimary: isPrimary ?? false,
          isDecisionMaker: isDecisionMaker ?? false,
          preferredContactMethod: preferredContactMethod ?? "Email",
          createdById: userId,
          updatedById: userId
        },
        include: {
          accountType: { select: { name: true } },
          account: { select: { accountName: true } },
          owner: { select: { firstName: true, lastName: true } }
        }
      })

      // Log audit event for contact creation
      await logContactAudit(
        AuditAction.Create,
        contact.id,
        userId,
        tenantId,
        request,
        undefined,
        {
          firstName: contact.firstName,
          lastName: contact.lastName,
          fullName: contact.fullName,
          jobTitle: contact.jobTitle,
          emailAddress: contact.emailAddress,
          workPhone: contact.workPhone,
          mobilePhone: contact.mobilePhone,
          accountId: contact.accountId,
          isPrimary: contact.isPrimary,
          isDecisionMaker: contact.isDecisionMaker
        }
      )

      // Invalidate cache to ensure UI updates immediately
      revalidatePath('/contacts')
      revalidatePath('/dashboard')
      if (contact.accountId) {
        revalidatePath(`/accounts/${contact.accountId}`)
      }

      return NextResponse.json({
        data: mapContactToListRow(contact),
        message: "Contact created successfully"
      }, { status: 201 })
    }
  )
}

