import { NextRequest, NextResponse } from "next/server"
import { AccountStatus, AuditAction, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { mapAccountToListRow, accountIncludeForList } from "./helpers"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { logAccountAudit } from "@/lib/audit"
import { validateAccountData, createValidationErrorResponse, normalizeEmail, normalizeState, formatPhoneNumber, ensureActiveOwnerOrNull } from "@/lib/validation"
import { isValidSalesforceId, normalizeSalesforceIdInput } from "@/lib/salesforce-id"
import { revalidatePath } from "next/cache"
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

type AddressInput = {
  line1: string
  city: string
  line2?: string
  state?: string
  postalCode?: string
  country?: string
}

function coerceOptionalId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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

async function createAddressRecordWithDb(
  db: {
    address: {
      create(args: {
        data: {
          tenantId: string
          line1: string
          line2: string | null
          city: string
          state: string | null
          postalCode: string | null
          country: string | null
        }
      }): Promise<{ id: string }>
    }
  },
  tenantId: string,
  input: AddressInput | null
) {
  if (!input) {
    return null
  }

  const address = await db.address.create({
    data: {
      tenantId,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      state: input.state ?? null,
      postalCode: input.postalCode ?? null,
      country: input.country ?? null
    }
  })

  return address.id
}

function normalizeAccountTypeCode(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase()
}

function buildStringOperator(operator: string, value: string) {
  if (operator === "equals") return { equals: value, mode: "insensitive" as const }
  if (operator === "starts_with") return { startsWith: value, mode: "insensitive" as const }
  if (operator === "ends_with") return { endsWith: value, mode: "insensitive" as const }
  return { contains: value, mode: "insensitive" as const }
}

function parseSalesforceIdForApi(value: unknown) {
  const salesforceId = normalizeSalesforceIdInput(value)
  if (salesforceId && !isValidSalesforceId(salesforceId)) {
    return {
      salesforceId: null,
      error: "Salesforce ID must be a 15 or 18 character alphanumeric Salesforce ID."
    }
  }

  return { salesforceId, error: null }
}

export async function GET(request: NextRequest) {
  return withPermissions(
    request,
    ['accounts.manage', 'accounts.read'],
    async (req) => {
      try {
        const searchParams = request.nextUrl.searchParams
        const tenantId = req.user.tenantId

        const page = Number(searchParams.get("page") ?? "1")
        const pageSize = Number(searchParams.get("pageSize") ?? "25")
        const query = searchParams.get("q")?.trim() ?? ""
        const accountTypeName = searchParams.get("accountType")?.trim() ?? ""
        const status = searchParams.get("status")?.trim() ?? ""
        const includeArchived = searchParams.get("includeArchived") === "true"
        const includeMerged = searchParams.get("includeMerged") === "true"
        const ownerId = searchParams.get("ownerId")?.trim() ?? ""
        const sortBy = searchParams.get("sortBy")?.trim() ?? ""
        const sortDir = searchParams.get("sortDir")?.trim() ?? ""
        const filtersRaw = searchParams.get("filters")?.trim() ?? ""

        const whereClause: Record<string, unknown> = { tenantId }
        if (!includeMerged) {
          // Default: hide records that have been merged into another record.
          whereClause.mergedIntoAccountId = null
        }
        const normalizedStatus = status.toLowerCase()
        const archivedOnly = normalizedStatus === "archived" || normalizedStatus === "deleted"

        if (query.length > 0) {
          const queryFilter = { contains: query, mode: "insensitive" as const }
          whereClause.OR = [
            { accountName: queryFilter },
            { accountLegalName: queryFilter },
            { accountNumber: queryFilter },
            { salesforceId: queryFilter },
            { owner: { is: { fullName: queryFilter } } },
            { parent: { is: { accountName: queryFilter } } },
            { industry: { is: { name: queryFilter } } },
            { shippingAddress: { is: { line1: queryFilter } } },
            { shippingAddress: { is: { line2: queryFilter } } },
            { shippingAddress: { is: { city: queryFilter } } },
            { shippingAddress: { is: { state: queryFilter } } },
            { shippingAddress: { is: { postalCode: queryFilter } } },
            { shippingAddress: { is: { country: queryFilter } } },
            { billingAddress: { is: { line1: queryFilter } } },
            { billingAddress: { is: { line2: queryFilter } } },
            { billingAddress: { is: { city: queryFilter } } },
            { billingAddress: { is: { state: queryFilter } } },
            { billingAddress: { is: { postalCode: queryFilter } } },
            { billingAddress: { is: { country: queryFilter } } },
            { websiteUrl: queryFilter },
            { description: queryFilter },
          ]
        }

        if (accountTypeName) {
          whereClause.accountType = {
            is: { name: { equals: accountTypeName, mode: "insensitive" } }
          }
        }

        if (status) {
          if (normalizedStatus === "active") {
            whereClause.status = AccountStatus.Active
          } else if (normalizedStatus === "inactive") {
            whereClause.status = AccountStatus.Inactive
          } else if (archivedOnly) {
            whereClause.status = AccountStatus.Archived
          }
        } else if (!includeArchived) {
          // Default: hide soft-deleted (Archived) records from the main Accounts list.
          whereClause.status = { not: AccountStatus.Archived }
        }

        if (ownerId) {
          whereClause.ownerId = ownerId
        }

        if (filtersRaw.length > 0) {
          try {
            const parsed = JSON.parse(filtersRaw)
            if (Array.isArray(parsed)) {
              const allowedColumns = new Set([
                "accountName",
                "accountLegalName",
                "accountNumber",
                "salesforceId",
                "accountType",
                "accountOwner",
                "parentAccount",
                "industry",
                "websiteUrl",
                "description",
                "shippingCity",
                "shippingState",
                "shippingZip",
                "shippingStreet",
                "shippingStreet2",
                "shippingCountry",
                "billingCity",
                "billingState",
                "billingZip",
                "billingStreet",
                "billingStreet2",
                "billingCountry",
                "status",
                "accountStatus",
                "active",
              ])

              const andClauses: Array<Record<string, unknown>> = []

              for (const entry of parsed) {
                const columnId = typeof entry?.columnId === "string" ? entry.columnId : ""
                const value = typeof entry?.value === "string" ? entry.value.trim() : ""
                const operator = typeof entry?.operator === "string" ? entry.operator : "contains"

                if (!columnId || !value || !allowedColumns.has(columnId)) continue

                const stringOp = buildStringOperator(operator, value)

                if (columnId === "accountName") {
                  andClauses.push({ accountName: stringOp })
                  continue
                }

                if (columnId === "accountLegalName") {
                  andClauses.push({ accountLegalName: stringOp })
                  continue
                }

                if (columnId === "accountNumber") {
                  andClauses.push({ accountNumber: stringOp })
                  continue
                }

                if (columnId === "salesforceId") {
                  andClauses.push({ salesforceId: stringOp })
                  continue
                }

                if (columnId === "accountType") {
                  andClauses.push({ accountType: { is: { name: stringOp } } })
                  continue
                }

                if (columnId === "accountOwner") {
                  andClauses.push({ owner: { is: { fullName: stringOp } } })
                  continue
                }

                if (columnId === "parentAccount") {
                  andClauses.push({ parent: { is: { accountName: stringOp } } })
                  continue
                }

                if (columnId === "industry") {
                  andClauses.push({ industry: { is: { name: stringOp } } })
                  continue
                }

                if (columnId === "websiteUrl") {
                  andClauses.push({ websiteUrl: stringOp })
                  continue
                }

                if (columnId === "description") {
                  andClauses.push({ description: stringOp })
                  continue
                }

                if (columnId === "shippingCity") {
                  andClauses.push({ shippingAddress: { is: { city: stringOp } } })
                  continue
                }

                if (columnId === "shippingState") {
                  andClauses.push({ shippingAddress: { is: { state: stringOp } } })
                  continue
                }

                if (columnId === "shippingZip") {
                  andClauses.push({ shippingAddress: { is: { postalCode: stringOp } } })
                  continue
                }

                if (columnId === "shippingStreet") {
                  andClauses.push({ shippingAddress: { is: { line1: stringOp } } })
                  continue
                }

                if (columnId === "shippingStreet2") {
                  andClauses.push({ shippingAddress: { is: { line2: stringOp } } })
                  continue
                }

                if (columnId === "shippingCountry") {
                  andClauses.push({ shippingAddress: { is: { country: stringOp } } })
                  continue
                }

                if (columnId === "billingCity") {
                  andClauses.push({ billingAddress: { is: { city: stringOp } } })
                  continue
                }

                if (columnId === "billingState") {
                  andClauses.push({ billingAddress: { is: { state: stringOp } } })
                  continue
                }

                if (columnId === "billingZip") {
                  andClauses.push({ billingAddress: { is: { postalCode: stringOp } } })
                  continue
                }

                if (columnId === "billingStreet") {
                  andClauses.push({ billingAddress: { is: { line1: stringOp } } })
                  continue
                }

                if (columnId === "billingStreet2") {
                  andClauses.push({ billingAddress: { is: { line2: stringOp } } })
                  continue
                }

                if (columnId === "billingCountry") {
                  andClauses.push({ billingAddress: { is: { country: stringOp } } })
                  continue
                }

                if (columnId === "status" || columnId === "accountStatus" || columnId === "active") {
                  const normalized = value.toLowerCase()
                  if (normalized === "active" || normalized === "yes" || normalized === "true" || normalized === "y") {
                    andClauses.push({ status: AccountStatus.Active })
                  } else if (normalized === "inactive" || normalized === "no" || normalized === "false" || normalized === "n") {
                    andClauses.push({ status: AccountStatus.Inactive })
                  } else if (normalized === "archived" || normalized === "deleted") {
                    andClauses.push({ status: AccountStatus.Archived })
                  }
                }
              }

              if (andClauses.length > 0) {
                const existingAnd = Array.isArray(whereClause.AND) ? (whereClause.AND as any[]) : []
                whereClause.AND = [...existingAnd, ...andClauses]
              }
            }
          } catch (err) {
            console.warn("Ignoring invalid accounts filters param", err)
          }
        }

        const normalizedSortBy = sortBy.toLowerCase()
        const normalizedSortDir = sortDir.toLowerCase()
        const sortDirection = normalizedSortDir === "asc" ? "asc" : "desc"

        const orderBy: Prisma.AccountOrderByWithRelationInput | Prisma.AccountOrderByWithRelationInput[] = (() => {
          if (normalizedSortBy === "accountname") return [{ accountName: sortDirection }, { id: "asc" }]
          if (normalizedSortBy === "accountlegalname") return [{ accountLegalName: sortDirection }, { id: "asc" }]
          if (normalizedSortBy === "accountnumber") return [{ accountNumber: sortDirection }, { id: "asc" }]
          if (normalizedSortBy === "salesforceid") return [{ salesforceId: sortDirection }, { id: "asc" }]
          if (normalizedSortBy === "updatedat") return [{ updatedAt: sortDirection }, { id: "asc" }]
          if (normalizedSortBy === "createdat") return [{ createdAt: sortDirection }, { id: "asc" }]
          if (normalizedSortBy === "status" || normalizedSortBy === "accountstatus" || normalizedSortBy === "active") {
            return [{ status: sortDirection }, { id: "asc" }]
          }
          if (normalizedSortBy === "accounttype") {
            return [{ accountType: { name: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "accountowner") {
            return [{ owner: { fullName: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "parentaccount") {
            return [{ parent: { accountName: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "industry") {
            return [{ industry: { name: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "shippingcity") {
            return [{ shippingAddress: { city: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "shippingstate") {
            return [{ shippingAddress: { state: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "shippingzip") {
            return [{ shippingAddress: { postalCode: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "shippingstreet") {
            return [{ shippingAddress: { line1: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "shippingstreet2") {
            return [{ shippingAddress: { line2: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "shippingcountry") {
            return [{ shippingAddress: { country: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "billingcity") {
            return [{ billingAddress: { city: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "billingstate") {
            return [{ billingAddress: { state: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "billingzip") {
            return [{ billingAddress: { postalCode: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "billingstreet") {
            return [{ billingAddress: { line1: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "billingstreet2") {
            return [{ billingAddress: { line2: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "billingcountry") {
            return [{ billingAddress: { country: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "websiteurl") return [{ websiteUrl: sortDirection }, { id: "asc" }]
          if (normalizedSortBy === "description") return [{ description: sortDirection }, { id: "asc" }]
          return archivedOnly ? { updatedAt: "desc" } : { createdAt: "desc" }
        })()

        const [accounts, total] = await Promise.all([
          prisma.account.findMany({
            where: whereClause,
            include: accountIncludeForList,
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize
          }),
          prisma.account.count({ where: whereClause })
        ])

        return NextResponse.json({
          data: accounts.map(mapAccountToListRow),
          pagination: {
            page,
            pageSize,
            total
          }
        })
      } catch (error) {
        console.error("Failed to load accounts", error)
        return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 })
      }
    }
  )
}

export async function POST(request: NextRequest) {
  return withPermissions(
    request,
    ['accounts.manage'],
    async (req) => {
      try {
        const payload = await request.json()
        
        // Validate account data according to contract requirements
        const validationResult = validateAccountData(payload)
        if (!validationResult.isValid) {
          return createValidationErrorResponse(validationResult.errors)
        }
        
        const accountName = typeof payload.accountName === "string" ? payload.accountName.trim() : ""
        const accountTypeId = coerceOptionalId(payload.accountTypeId)
        const parsedSalesforceId = parseSalesforceIdForApi(payload.salesforceId)
        if (parsedSalesforceId.error) {
          return NextResponse.json(
            {
              error: parsedSalesforceId.error,
              errors: { salesforceId: parsedSalesforceId.error }
            },
            { status: 400 }
          )
        }

        const tenantId = req.user.tenantId
        const userId = req.user.id

    const accountType = accountTypeId
      ? await prisma.accountType.findFirst({
          where: { id: accountTypeId, tenantId },
          select: { id: true, code: true, name: true }
        })
      : null

    if (accountTypeId && !accountType) {
      return NextResponse.json({ error: "Invalid account type" }, { status: 400 })
    }

    const parentAccountId = coerceOptionalId(payload.parentAccountId)

    const newParentAccountName = typeof payload.newParentAccountName === "string"
      ? payload.newParentAccountName.trim()
      : ""
    
    const isHouseAccountType =
      Boolean(accountType) &&
      normalizeAccountTypeCode(accountType?.code ?? accountType?.name ?? "") === "HOUSE_REP"

    const hasOwnerInPayload =
      payload.ownerId !== undefined &&
      payload.ownerId !== null &&
      String(payload.ownerId).trim().length > 0

    let ownerId: string | null = null

    if (hasOwnerInPayload) {
      ownerId = await ensureActiveOwnerOrNull(payload.ownerId, tenantId)
    } else if (isHouseAccountType) {
      const defaultAdminOwner = await prisma.user.findFirst({
        where: {
          tenantId,
          status: "Active",
          role: { is: { code: "ADMIN" } }
        },
        orderBy: { createdAt: "asc" },
        select: { id: true }
      })
      ownerId = defaultAdminOwner?.id ?? null

      if (!ownerId) {
        ownerId = await ensureActiveOwnerOrNull(userId, tenantId).catch(() => null)
      }
    }

    const industryId = coerceOptionalId(payload.industryId)

    const isActive = typeof payload.active === "boolean" ? payload.active : true
    const syncBillingWithShipping = Boolean(
      payload.syncBillingWithShipping ?? payload.billingSameAsShipping
    )

    const shippingAddressInput = parseAddress(payload.shippingAddress)
    const billingAddressInput = syncBillingWithShipping
      ? shippingAddressInput
      : parseAddress(payload.billingAddress)

    const creation = await prisma.$transaction(async tx => {
      let createdParentAccount: {
        id: string
        accountName: string
        accountTypeId: string
        status: AccountStatus
      } | null = null
      let resolvedParentAccountId = parentAccountId

      if (!resolvedParentAccountId && newParentAccountName.length > 0 && accountTypeId) {
        createdParentAccount = await tx.account.create({
          data: {
            tenantId,
            accountName: newParentAccountName,
            accountTypeId,
            status: AccountStatus.Active,
            createdById: userId,
            updatedById: userId
          },
          select: {
            id: true,
            accountName: true,
            accountTypeId: true,
            status: true
          }
        })
        resolvedParentAccountId = createdParentAccount.id
      }

      const [shippingAddressId, billingAddressIdIfAny] = await Promise.all([
        createAddressRecordWithDb(tx, tenantId, shippingAddressInput),
        syncBillingWithShipping
          ? Promise.resolve<string | null>(null)
          : createAddressRecordWithDb(tx, tenantId, billingAddressInput)
      ])

      const billingAddressId = syncBillingWithShipping ? shippingAddressId : billingAddressIdIfAny

      const account = await tx.account.create({
        data: {
          tenantId,
          accountTypeId: accountTypeId!,
          ...(resolvedParentAccountId && { parentAccountId: resolvedParentAccountId }),
          ...(ownerId && { ownerId }),
          ...(industryId && { industryId }),
          accountName,
          accountLegalName:
            typeof payload.accountLegalName === "string" && payload.accountLegalName.trim().length > 0
              ? payload.accountLegalName.trim()
              : null,
          salesforceId: parsedSalesforceId.salesforceId,
          status: isActive ? AccountStatus.Active : AccountStatus.Inactive,
          websiteUrl:
            typeof payload.websiteUrl === "string" && payload.websiteUrl.trim().length > 0
              ? payload.websiteUrl.trim()
              : null,
          description:
            typeof payload.description === "string" && payload.description.trim().length > 0
              ? payload.description.trim()
              : null,
          shippingAddressId,
          billingAddressId,
          shippingSyncBilling: syncBillingWithShipping,
          createdById: userId,
          updatedById: userId
        },
        include: accountIncludeForList
      })

      return { account, createdParentAccount }
    })

        if (creation.createdParentAccount) {
          await logAccountAudit(
            AuditAction.Create,
            creation.createdParentAccount.id,
            userId,
            tenantId,
            request,
            undefined,
            {
              accountName: creation.createdParentAccount.accountName,
              accountTypeId: creation.createdParentAccount.accountTypeId,
              status: creation.createdParentAccount.status,
              note: "Created as parent account during account creation"
            }
          )
        }

        await logAccountAudit(
          AuditAction.Create,
          creation.account.id,
          userId,
          tenantId,
          request,
          undefined,
          {
            accountName: creation.account.accountName,
            accountLegalName: creation.account.accountLegalName,
            salesforceId: creation.account.salesforceId,
            accountTypeId: creation.account.accountTypeId,
            status: creation.account.status,
            websiteUrl: creation.account.websiteUrl,
            description: creation.account.description
          }
        )

        // Invalidate cache to ensure UI updates immediately
        revalidatePath('/accounts')
        revalidatePath('/dashboard')

        return NextResponse.json({ data: mapAccountToListRow(creation.account) }, { status: 201 })
      } catch (error: any) {
        console.error("Failed to create account", error)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const targetRaw = error?.meta?.target as unknown
          const targetText = Array.isArray(targetRaw)
            ? targetRaw.join(",")
            : typeof targetRaw === "string"
              ? targetRaw
              : ""

          if (targetText.includes("tenantId") && targetText.includes("salesforceId")) {
            return NextResponse.json(
              {
                error: "Salesforce ID must be unique.",
                errors: { salesforceId: "Salesforce ID must be unique." }
              },
              { status: 409 }
            )
          }

          return NextResponse.json({ error: "An account with this name already exists." }, { status: 409 })
        }
        const message = error?.message ?? "Failed to create account"
        return NextResponse.json({ error: message }, { status: 500 })
      }
    }
  )
}

