import { NextRequest, NextResponse } from "next/server"
import { AccountStatus, AuditAction, type Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { mapAccountToListRow, accountIncludeForList } from "./helpers"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { logAccountAudit } from "@/lib/audit"
import { validateAccountData, createValidationErrorResponse, normalizeEmail, normalizeState, formatPhoneNumber, ensureActiveOwnerOrNull } from "@/lib/validation"
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

async function createAddressRecord(tenantId: string, input: AddressInput | null) {
  if (!input) {
    return null
  }

  const address = await prisma.address.create({
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
        const ownerId = searchParams.get("ownerId")?.trim() ?? ""
        const sortBy = searchParams.get("sortBy")?.trim() ?? ""
        const sortDir = searchParams.get("sortDir")?.trim() ?? ""
        const filtersRaw = searchParams.get("filters")?.trim() ?? ""

        const whereClause: Record<string, unknown> = { tenantId }
        const normalizedStatus = status.toLowerCase()
        const archivedOnly = normalizedStatus === "archived" || normalizedStatus === "deleted"

        if (query.length > 0) {
          whereClause.OR = [
            { accountName: { contains: query, mode: "insensitive" } },
            { accountLegalName: { contains: query, mode: "insensitive" } },
            { owner: { is: { fullName: { contains: query, mode: "insensitive" } } } }
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
                "accountType",
                "accountOwner",
                "status",
              ])

              const andClauses: Array<Record<string, unknown>> = []

              for (const entry of parsed) {
                const columnId = typeof entry?.columnId === "string" ? entry.columnId : ""
                const value = typeof entry?.value === "string" ? entry.value.trim() : ""
                const operator = typeof entry?.operator === "string" ? entry.operator : "contains"

                if (!columnId || !value || !allowedColumns.has(columnId)) continue

                const stringOp = (() => {
                  if (operator === "equals") return { equals: value, mode: "insensitive" as const }
                  if (operator === "starts_with") return { startsWith: value, mode: "insensitive" as const }
                  if (operator === "ends_with") return { endsWith: value, mode: "insensitive" as const }
                  return { contains: value, mode: "insensitive" as const }
                })()

                if (columnId === "accountName") {
                  andClauses.push({ accountName: stringOp })
                  continue
                }

                if (columnId === "accountLegalName") {
                  andClauses.push({ accountLegalName: stringOp })
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

                if (columnId === "status") {
                  const normalized = value.toLowerCase()
                  if (normalized === "active") {
                    andClauses.push({ status: AccountStatus.Active })
                  } else if (normalized === "inactive") {
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
          if (normalizedSortBy === "updatedat") return [{ updatedAt: sortDirection }, { id: "asc" }]
          if (normalizedSortBy === "createdat") return [{ createdAt: sortDirection }, { id: "asc" }]
          if (normalizedSortBy === "status") return [{ status: sortDirection }, { id: "asc" }]
          if (normalizedSortBy === "accounttype") {
            return [{ accountType: { name: sortDirection } }, { id: "asc" }]
          }
          if (normalizedSortBy === "accountowner") {
            return [{ owner: { fullName: sortDirection } }, { id: "asc" }]
          }
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

        const tenantId = req.user.tenantId
        const userId = req.user.id

    if (accountTypeId) {
      const accountTypeExists = await prisma.accountType.findFirst({
        where: { id: accountTypeId, tenantId },
        select: { id: true }
      })

      if (!accountTypeExists) {
        return NextResponse.json({ error: "Invalid account type" }, { status: 400 })
      }
    }

    let parentAccountId = coerceOptionalId(payload.parentAccountId)
    
    // If newParentAccountName is provided and no parentAccountId, create a new parent account
    const newParentAccountName = typeof payload.newParentAccountName === "string" 
      ? payload.newParentAccountName.trim() 
      : ""
    
    if (!parentAccountId && newParentAccountName.length > 0 && accountTypeId) {
      // Create a minimal parent account with the same account type
      const parentAccount = await prisma.account.create({
        data: {
          tenantId,
          accountName: newParentAccountName,
          accountTypeId: accountTypeId,
          status: AccountStatus.Active,
          createdById: userId,
          updatedById: userId
        }
      })
      parentAccountId = parentAccount.id
      
      // Log audit event for parent account creation
      await logAccountAudit(
        AuditAction.Create,
        parentAccount.id,
        userId,
        tenantId,
        request,
        undefined,
        {
          accountName: parentAccount.accountName,
          accountTypeId: parentAccount.accountTypeId,
          status: parentAccount.status,
          note: "Created as parent account during account creation"
        }
      )
    }
    
    // Validate owner must be Active if provided
    const ownerId = await ensureActiveOwnerOrNull(payload.ownerId, tenantId)
    const industryId = coerceOptionalId(payload.industryId)

    const isActive = typeof payload.active === "boolean" ? payload.active : true
    const syncBillingWithShipping = Boolean(
      payload.syncBillingWithShipping ?? payload.billingSameAsShipping
    )

    const shippingAddressInput = parseAddress(payload.shippingAddress)
    const billingAddressInput = syncBillingWithShipping
      ? shippingAddressInput
      : parseAddress(payload.billingAddress)

    const [shippingAddressId, billingAddressIdIfAny] = await Promise.all([
      createAddressRecord(tenantId, shippingAddressInput),
      syncBillingWithShipping
        ? Promise.resolve<string | null>(null)
        : createAddressRecord(tenantId, billingAddressInput)
    ])

    const billingAddressId = syncBillingWithShipping ? shippingAddressId : billingAddressIdIfAny

    const account = await prisma.account.create({
      data: {
        tenantId,
        accountTypeId: accountTypeId!,
        ...(parentAccountId && { parentAccountId }),
        ...(ownerId && { ownerId }),
        ...(industryId && { industryId }),
        accountName,
        accountLegalName:
          typeof payload.accountLegalName === "string" && payload.accountLegalName.trim().length > 0
            ? payload.accountLegalName.trim()
            : null,
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

        // Log audit event for account creation
        await logAccountAudit(
          AuditAction.Create,
          account.id,
          userId,
          tenantId,
          request,
          undefined,
          {
            accountName: account.accountName,
            accountLegalName: account.accountLegalName,
            accountTypeId: account.accountTypeId,
            status: account.status,
            websiteUrl: account.websiteUrl,
            description: account.description
          }
        )

        // Invalidate cache to ensure UI updates immediately
        revalidatePath('/accounts')
        revalidatePath('/dashboard')

        return NextResponse.json({ data: mapAccountToListRow(account) }, { status: 201 })
      } catch (error: any) {
        console.error("Failed to create account", error)
        const message = error?.message ?? "Failed to create account"
        return NextResponse.json({ error: message }, { status: 500 })
      }
    }
  )
}

