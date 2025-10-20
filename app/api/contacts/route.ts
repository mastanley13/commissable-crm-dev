import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { logContactAudit } from "@/lib/audit"
import { validateContactData, createValidationErrorResponse, normalizeEmail, formatPhoneNumber, ensureActiveOwnerOrNull } from "@/lib/validation"
import { revalidatePath } from "next/cache"
export const runtime = 'nodejs'
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
    createdAt: contact.createdAt,
    // Deletion status
    deletedAt: contact.deletedAt,
    isDeleted: Boolean(contact.deletedAt)
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
interface ColumnFilterInput {
  columnId: string
  value: string
  operator?: string
}

interface FilterGroupInput {
  logic?: "AND" | "OR"
  filters?: ColumnFilterInput[]
}

function makeStringFilter(operator: string | undefined, value: string) {
  const normalized = (operator ?? "contains").toLowerCase();
  switch (normalized) {
    case "equals":
      return { equals: value, mode: "insensitive" as const };
    case "starts_with":
      return { startsWith: value, mode: "insensitive" as const };
    case "ends_with":
      return { endsWith: value, mode: "insensitive" as const };
    default:
      return { contains: value, mode: "insensitive" as const };
  }
}

function buildNestedCondition(path: string[], operator: string | undefined, value: string) {
  const initial = makeStringFilter(operator, value) as Record<string, unknown>
  return path.reduceRight<Record<string, unknown>>((acc, key) => ({ [key]: acc }), initial)
}

function buildFilterCondition(filter: ColumnFilterInput | null | undefined) {
  if (!filter || typeof filter.columnId !== "string" || typeof filter.value !== "string") {
    return null;
  }

  const trimmedValue = filter.value.trim();
  if (!trimmedValue) {
    return null;
  }

  const operator = filter.operator;

  switch (filter.columnId) {
    case "fullName":
    case "suffix":
    case "jobTitle":
    case "emailAddress":
      return buildNestedCondition([filter.columnId], operator, trimmedValue);
    case "accountName":
      return buildNestedCondition(["account", "accountName"], operator, trimmedValue);
    case "contactType":
      return buildNestedCondition(["accountType", "name"], operator, trimmedValue);
    case "mobile":
      return buildNestedCondition(["mobilePhone"], operator, trimmedValue);
    case "workPhone":
      return buildNestedCondition(["workPhone"], operator, trimmedValue);
    case "extension":
      return buildNestedCondition(["workPhoneExt"], operator, trimmedValue);
    case "ownerName": {
      const nested = makeStringFilter(operator, trimmedValue);
      return {
        OR: [
          { owner: { firstName: nested } },
          { owner: { lastName: nested } },
        ],
      };
    }
    default:
      return null;
  }
}

function buildGroupCondition(group: FilterGroupInput | null | undefined) {
  if (!group || !Array.isArray(group.filters)) {
    return null;
  }

  const conditions = group.filters
    .map(buildFilterCondition)
    .filter((condition): condition is Record<string, unknown> => Boolean(condition));

  if (conditions.length === 0) {
    return null;
  }

  const logic = (group.logic ?? "AND").toUpperCase() === "OR" ? "OR" : "AND";
  return logic === "OR" ? { OR: conditions } : { AND: conditions };
}

function parseJsonArray<T>(value: string | null): T[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to parse filter payload", error);
    return [];
  }
}


export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ['contacts.read', 'contacts.manage'],
    async (req) => {
      try {
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
        const columnFiltersParam = searchParams.get("columnFilters")
        const filterGroupsParam = searchParams.get("filterGroups")

        const columnFiltersInput = parseJsonArray<ColumnFilterInput>(columnFiltersParam)
        const filterGroupsInput = parseJsonArray<FilterGroupInput>(filterGroupsParam)
        const includeDeleted = searchParams.get("includeDeleted") === "true"

        // Build where clause
        const whereClause: any = { tenantId }

        // Exclude soft-deleted contacts by default
        if (!includeDeleted) {
          whereClause.deletedAt = null
        }

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

        const additionalConditions: any[] = []
        const groupedColumnFilters = new Map<string, ColumnFilterInput[]>()

        for (const filterInput of columnFiltersInput) {
          if (!filterInput || typeof filterInput.columnId !== "string") {
            continue
          }

          const key = filterInput.columnId

          if (!groupedColumnFilters.has(key)) {
            groupedColumnFilters.set(key, [])
          }

          groupedColumnFilters.get(key)!.push(filterInput)
        }

        for (const filtersForColumn of Array.from(groupedColumnFilters.values())) {
          const conditions = filtersForColumn
            .map(buildFilterCondition)
            .filter((condition): condition is Record<string, unknown> => Boolean(condition))
            .flatMap((condition) => {
              if (
                condition &&
                typeof condition === "object" &&
                'OR' in condition &&
                Array.isArray((condition as any).OR) &&
                Object.keys(condition).length === 1
              ) {
                return (condition as any).OR as Record<string, unknown>[]
              }

              return [condition]
            })

          if (conditions.length === 0) {
            continue
          }

          if (conditions.length === 1) {
            additionalConditions.push(conditions[0])
          } else {
            additionalConditions.push({ OR: conditions })
          }
        }

        for (const groupInput of filterGroupsInput) {
          const condition = buildGroupCondition(groupInput)
          if (condition) {
            additionalConditions.push(condition)
          }
        }

        if (additionalConditions.length > 0) {
          whereClause.AND = [
            ...(Array.isArray(whereClause.AND) ? whereClause.AND : []),
            ...additionalConditions
          ]
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
      } catch (error) {
        console.error("Failed to load contacts", error)
        return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 })
      }
    }
  )
}

export async function POST(request: NextRequest) {
  return withPermissions(
    request,
    ['contacts.create', 'contacts.manage'],
    async (req) => {
      const body = await request.json()
      const tenantId = req.user.tenantId
      const userId = req.user.id

      // Validate contact data according to contract requirements
      const validationResult = validateContactData(body)
      if (!validationResult.isValid) {
        return createValidationErrorResponse(validationResult.errors)
      }

      const { accountId, firstName, lastName, suffix, jobTitle, workPhone, workPhoneExt, mobilePhone, emailAddress,
              ownerId, isPrimary, isDecisionMaker, preferredContactMethod } = body

      const account = await prisma.account.findFirst({
        where: {
          id: accountId,
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

      const derivedAccountTypeId = account.accountTypeId
      const derivedContactTypeName = account.accountType?.name ?? ""

      // Derive fullName
      const fullName = `${firstName} ${lastName}`

      // Validate owner if provided
      const validatedOwnerId = await ensureActiveOwnerOrNull(ownerId, tenantId)

      // Create contact
      const contact = await prisma.contact.create({
        data: {
          tenantId,
          accountId,
          firstName,
          lastName,
          suffix,
          fullName,
          jobTitle,
          workPhone: workPhone ? formatPhoneNumber(workPhone) : null,
          workPhoneExt,
          mobilePhone: mobilePhone ? formatPhoneNumber(mobilePhone) : null,
          emailAddress: emailAddress ? normalizeEmail(emailAddress) : null,
          accountTypeId: derivedAccountTypeId,
          contactType: derivedContactTypeName || null,
          ownerId: validatedOwnerId,
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







