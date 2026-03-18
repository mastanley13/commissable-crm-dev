import { NextRequest, NextResponse } from "next/server"

import { Prisma, AuditAction } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { hasAnyPermission } from "@/lib/auth"
import { dedupeColumnFilters } from "@/lib/filter-utils"
import { mapProductToRow } from "./helpers"
import { logProductAudit } from "@/lib/audit"
import { ensureNoneDirectDistributorAccount } from "@/lib/none-direct-distributor"
import { REVENUE_TYPE_DEFINITIONS } from "@/lib/revenue-types"
import { isEnabledRevenueType } from "@/lib/server-revenue-types"
import { canonicalizeMultiValueString } from "@/lib/multi-value"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PRODUCT_MUTATION_PERMISSIONS = [
  "products.create",
  "products.update",
  "products.delete",
  "products.read",
]

function resolveSortOrder(sortColumn: string, direction: "asc" | "desc"): Prisma.ProductOrderByWithRelationInput[] {
  const orderByMap: Record<string, Prisma.ProductOrderByWithRelationInput> = {
    productNameHouse: { productNameHouse: direction },
    productNameVendor: { productNameVendor: direction },
    distributorName: { distributor: { accountName: direction } },
    vendorName: { vendor: { accountName: direction } },
    partNumberVendor: { partNumberVendor: direction },
    commissionPercent: { commissionPercent: direction },
    priceEach: { priceEach: direction },
    revenueType: { revenueType: direction },
    active: { isActive: direction },
  }

  const resolved = orderByMap[sortColumn] ?? null
  const fallbacks: Prisma.ProductOrderByWithRelationInput[] = []

  if (resolved) {
    fallbacks.push(resolved)
  }

  if (!resolved || !("productNameHouse" in resolved)) {
    fallbacks.push({ productNameHouse: direction })
  }

  if (!resolved || !("createdAt" in resolved)) {
    fallbacks.push({ createdAt: direction })
  }

  return fallbacks
}

function equalsIgnoreCase(left: string | null | undefined, right: string | null | undefined): boolean {
  const normalizedLeft = (left ?? "").trim().toLowerCase()
  const normalizedRight = (right ?? "").trim().toLowerCase()
  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      const searchParams = request.nextUrl.searchParams
      const tenantId = req.user.tenantId

      const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
      const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "25")))
      const query = searchParams.get("q")?.trim() ?? ""
      const statusParam = (searchParams.get("status") ?? "active").toLowerCase()
      const createdById = searchParams.get("createdById")?.trim() ?? ""
      const hasRevenueSchedulesParamRaw = searchParams.get("hasRevenueSchedules")
      const sortColumn = searchParams.get("sort") ?? "productNameHouse"
      const sortDirection: "asc" | "desc" = searchParams.get("direction") === "asc" ? "asc" : "desc"

      // Define locally instead of importing from a client component to avoid bundling issues
      type ColumnFilter = { columnId: string; value: string; operator?: "equals" | "contains" | "starts_with" | "ends_with" }
      let columnFilters: ColumnFilter[] = []
      const filtersParam = searchParams.get("filters")
      if (filtersParam) {
        try {
          const parsed = JSON.parse(filtersParam)
          if (Array.isArray(parsed)) {
            columnFilters = parsed
          }
        } catch {
          columnFilters = []
        }
      }

      const dedupedFilters = dedupeColumnFilters(columnFilters)

      const where: Prisma.ProductWhereInput = {
        tenantId,
      }

      if (createdById) {
        where.createdById = createdById
      }

      if (statusParam === "inactive") {
        where.isActive = false
      } else if (statusParam === "all") {
        // leave undefined to include all
      } else {
        where.isActive = true
      }

      const andConditions: Prisma.ProductWhereInput[] = []

      if (query.length > 0) {
        const queryFilter = { contains: query, mode: "insensitive" as const }
        andConditions.push({
          OR: [
            { productNameHouse: queryFilter },
            { productNameVendor: queryFilter },
            { productCode: queryFilter },
            { partNumberVendor: queryFilter },
            { productDescriptionVendor: queryFilter },
            { productFamilyVendor: queryFilter },
            { productFamilyHouse: queryFilter },
            { productSubtypeVendor: queryFilter },
            { productSubtypeHouse: queryFilter },
            { distributorProductFamily: queryFilter },
            { distributorProductSubtype: queryFilter },
            { revenueType: queryFilter },
            { distributor: { accountName: queryFilter } },
            { vendor: { accountName: queryFilter } },
          ]
        })
      }

      if (dedupedFilters.length > 0) {
        dedupedFilters.forEach((filter) => {
          const rawValue = (filter.value ?? "").trim()
          if (!rawValue) {
            return
          }

          switch (filter.columnId) {
            case "productNameHouse":
              andConditions.push({ productNameHouse: { contains: rawValue, mode: "insensitive" } })
              break
            case "productNameVendor":
              andConditions.push({ productNameVendor: { contains: rawValue, mode: "insensitive" } })
              break
            case "distributorName":
              andConditions.push({ distributor: { accountName: { contains: rawValue, mode: "insensitive" } } })
              break
            case "vendorName":
              andConditions.push({ vendor: { accountName: { contains: rawValue, mode: "insensitive" } } })
              break
            case "productFamilyVendor":
              andConditions.push({ productFamilyVendor: { contains: rawValue, mode: "insensitive" } })
              break
            case "productFamilyHouse":
              andConditions.push({ productFamilyHouse: { contains: rawValue, mode: "insensitive" } })
              break
            case "productSubtypeVendor":
              andConditions.push({ productSubtypeVendor: { contains: rawValue, mode: "insensitive" } })
              break
            case "productSubtypeHouse":
              andConditions.push({ productSubtypeHouse: { contains: rawValue, mode: "insensitive" } })
              break
            case "vendorId":
            case "vendorAccountId":
              // Strict match by vendor account id
              andConditions.push({ vendorAccountId: rawValue })
              break
            case "distributorId":
            case "distributorAccountId":
              // Strict match by distributor account id
              andConditions.push({ distributorAccountId: rawValue })
              break
            case "partNumberVendor":
              andConditions.push({ partNumberVendor: { contains: rawValue, mode: "insensitive" } })
              break
            case "revenueType": {
              const valueLower = rawValue.toLowerCase()
              const matches = REVENUE_TYPE_DEFINITIONS
                .map(def => def.code)
                .filter(code => code.toLowerCase().includes(valueLower))
              if (matches.length > 0) {
                andConditions.push({ revenueType: { in: matches as any[] } })
              }
              break
            }
            case "hasRevenueSchedules": {
              const valueLower = rawValue.toLowerCase()
              if (["yes", "y", "true", "with"].includes(valueLower)) {
                andConditions.push({ revenueSchedules: { some: {} } })
              } else if (["no", "n", "false", "without"].includes(valueLower)) {
                andConditions.push({ revenueSchedules: { none: {} } })
              }
              break
            }
            case "active":
              if (rawValue.toLowerCase() === "yes" || rawValue.toLowerCase() === "true") {
                andConditions.push({ isActive: true })
              } else if (rawValue.toLowerCase() === "no" || rawValue.toLowerCase() === "false") {
                andConditions.push({ isActive: false })
              }
              break
            default:
              break
          }
        })
      }

      if (hasRevenueSchedulesParamRaw) {
        const valueLower = hasRevenueSchedulesParamRaw.trim().toLowerCase()
        if (["true", "1", "yes", "y", "with"].includes(valueLower)) {
          andConditions.push({ revenueSchedules: { some: {} } })
        } else if (["false", "0", "no", "n", "without"].includes(valueLower)) {
          andConditions.push({ revenueSchedules: { none: {} } })
        }
      }

      if (andConditions.length > 0) {
        if (where.AND) {
          const existing = Array.isArray(where.AND) ? where.AND : [where.AND]
          where.AND = [...existing, ...andConditions]
        } else {
          where.AND = andConditions
        }
      }

      const orderBy = resolveSortOrder(sortColumn, sortDirection)

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            distributor: { select: { id: true, accountName: true } },
            vendor: { select: { id: true, accountName: true } },
            _count: { select: { revenueSchedules: true } },
          },
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.product.count({ where }),
      ])

      const totalPages = Math.max(1, Math.ceil(total / pageSize))

      return NextResponse.json({
        data: products.map(mapProductToRow),
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
      })
    } catch (error) {
      // Improve diagnostics in development
      const message = process.env.NODE_ENV === "development" && error instanceof Error
        ? `Failed to load products: ${error.message}`
        : "Failed to load products"
      console.error("Failed to load products", error)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  })
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      const roleCode = req.user.role?.code?.toLowerCase() ?? ""
      const isAdmin = roleCode === "admin" || roleCode.includes("admin")
      const canMutate = isAdmin || hasAnyPermission(req.user, PRODUCT_MUTATION_PERMISSIONS)

      if (!canMutate) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
      }

      const payload = await request.json().catch(() => null)
      if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const getString = (val: unknown) => (typeof val === "string" ? val.trim() : "")
      const getOptionalString = (val: unknown) => {
        if (val === null || val === undefined) return null
        if (typeof val !== "string") return null
        const v = val.trim()
        return v.length > 0 ? v : null
      }
      const getOptionalNumber = (val: unknown) => {
        if (val === null || val === undefined || val === "") return null
        const num = typeof val === "number" ? val : Number(val)
        return Number.isFinite(num) ? num : null
      }

      const errors: Record<string, string> = {}

      const productNameHouse = getString((payload as any).productNameHouse)
      if (!productNameHouse) errors.productNameHouse = "Product name is required"

      const productCodeInput = getString((payload as any).productCode)
      const canonicalProductNameVendor = canonicalizeMultiValueString(getOptionalString((payload as any).productNameVendor), { kind: "text" })
      const canonicalPartNumberVendor = canonicalizeMultiValueString(getOptionalString((payload as any).partNumberVendor), { kind: "id" })

      const revenueTypeValue = getString((payload as any).revenueType)
      if (!revenueTypeValue) {
        errors.revenueType = "Revenue type is required"
      } else {
        const allowed = await isEnabledRevenueType(req.user.tenantId, revenueTypeValue)
        if (!allowed) {
          errors.revenueType = "Select a valid Revenue Type managed in Data Settings."
        }
      }

      const priceEach = getOptionalNumber((payload as any).priceEach)
      if ((payload as any).priceEach !== undefined && priceEach !== null && priceEach < 0) {
        errors.priceEach = "Price must be a positive number"
      }

      const commissionPercent = getOptionalNumber((payload as any).commissionPercent)
      if ((payload as any).commissionPercent !== undefined && commissionPercent !== null) {
        if (commissionPercent < 0 || commissionPercent > 100) {
          errors.commissionPercent = "Commission percent must be between 0 and 100"
        }
      }

      const productFamilyHouse = getOptionalString((payload as any).productFamilyHouse)
      const productSubtypeHouse = getOptionalString((payload as any).productSubtypeHouse)
      const productFamilyVendor = getOptionalString((payload as any).productFamilyVendor)
      const productSubtypeVendor = getOptionalString((payload as any).productSubtypeVendor)
      const distributorProductFamily = getOptionalString((payload as any).distributorProductFamily)
      const distributorProductSubtype = getOptionalString((payload as any).distributorProductSubtype)

      const hasPicklistValues = Boolean(
        productFamilyHouse ||
          productSubtypeHouse ||
          productFamilyVendor ||
          productSubtypeVendor ||
          distributorProductFamily ||
          distributorProductSubtype
      )

      if (hasPicklistValues) {
        try {
          const tenantId = req.user.tenantId
          const [families, subtypes] = await Promise.all([
            prisma.productFamily.findMany({
              where: { tenantId, isActive: true },
              select: { id: true, name: true }
            }),
            prisma.productSubtype.findMany({
              where: { tenantId, isActive: true },
              select: {
                name: true,
                productFamilyId: true,
                family: { select: { name: true } }
              }
            })
          ])

          const familyNames = new Set(families.map((f) => f.name))
          const familyIdByName = new Map(families.map((f) => [f.name, f.id] as const))
          const subtypeByName = new Map(
            subtypes.map((s) => [
              s.name,
              { productFamilyId: s.productFamilyId, familyName: s.family?.name ?? null }
            ] as const)
          )

          const validateFamily = (field: string, value: string | null) => {
            if (!value) return
            if (!familyNames.has(value)) {
              errors[field] = "Select a valid value managed in Data Settings."
            }
          }

          const validateSubtype = (
            subtypeField: string,
            subtypeValue: string | null,
            familyValue: string | null
          ) => {
            if (!subtypeValue) return
            const record = subtypeByName.get(subtypeValue)
            if (!record) {
              errors[subtypeField] = "Select a valid value managed in Data Settings."
              return
            }
            if (!familyValue) return
            const familyId = familyIdByName.get(familyValue) ?? null
            if (record.productFamilyId && familyId && record.productFamilyId !== familyId) {
              errors[subtypeField] = "Subtype does not belong to the selected Product Family."
            }
          }

          validateFamily("productFamilyHouse", productFamilyHouse)
          validateFamily("productFamilyVendor", productFamilyVendor)
          validateFamily("distributorProductFamily", distributorProductFamily)

          validateSubtype("productSubtypeHouse", productSubtypeHouse, productFamilyHouse)
          validateSubtype("productSubtypeVendor", productSubtypeVendor, productFamilyVendor)
          validateSubtype("distributorProductSubtype", distributorProductSubtype, distributorProductFamily)
        } catch (error) {
          console.error("Failed to validate product picklists", error)
          errors.productFamilyVendor = "Unable to validate picklist values. Please try again."
        }
      }

      if (Object.keys(errors).length > 0) {
        return NextResponse.json({ error: "Validation failed", errors }, { status: 400 })
      }

      const duplicateConditions: Prisma.ProductWhereInput[] = [
        { productNameHouse: { equals: productNameHouse, mode: "insensitive" } },
      ]
      if (canonicalProductNameVendor) {
        duplicateConditions.push({ productNameVendor: { equals: canonicalProductNameVendor, mode: "insensitive" } })
      }
      if (canonicalPartNumberVendor) {
        duplicateConditions.push({ partNumberVendor: { equals: canonicalPartNumberVendor, mode: "insensitive" } })
      }

      const exactDuplicate = await prisma.product.findFirst({
        where: {
          tenantId: req.user.tenantId,
          isActive: true,
          OR: duplicateConditions,
        },
        select: {
          id: true,
          productCode: true,
          productNameHouse: true,
          productNameVendor: true,
          partNumberVendor: true,
          productFamilyVendor: true,
          distributor: { select: { accountName: true } },
          vendor: { select: { accountName: true } },
        },
      })

      if (exactDuplicate) {
        const matchReasons: string[] = []
        if (
          equalsIgnoreCase(exactDuplicate.productNameHouse, productNameHouse) ||
          equalsIgnoreCase(exactDuplicate.productNameVendor, productNameHouse) ||
          (canonicalProductNameVendor &&
            (equalsIgnoreCase(exactDuplicate.productNameHouse, canonicalProductNameVendor) ||
              equalsIgnoreCase(exactDuplicate.productNameVendor, canonicalProductNameVendor)))
        ) {
          matchReasons.push("Exact Product Name")
        }
        if (canonicalPartNumberVendor && equalsIgnoreCase(exactDuplicate.partNumberVendor, canonicalPartNumberVendor)) {
          matchReasons.push("Exact Part Number")
        }

        return NextResponse.json(
          {
            error:
              "A product with the same Product Name or Other - Part Number already exists. Use the existing product instead of creating a duplicate.",
            code: "PRODUCT_EXACT_DUPLICATE",
            matchReasons,
            duplicate: {
              id: exactDuplicate.id,
              productCode: exactDuplicate.productCode,
              productNameHouse: exactDuplicate.productNameHouse,
              productNameVendor: exactDuplicate.productNameVendor,
              partNumberVendor: exactDuplicate.partNumberVendor,
              productFamilyVendor: exactDuplicate.productFamilyVendor,
              distributorName: exactDuplicate.distributor?.accountName ?? null,
              vendorName: exactDuplicate.vendor?.accountName ?? null,
            },
          },
          { status: 409 }
        )
      }

      let distributorAccountId = getOptionalString((payload as any).distributorAccountId)
      const vendorAccountId = getOptionalString((payload as any).vendorAccountId)

      if (!distributorAccountId && vendorAccountId) {
        const noneDirect = await ensureNoneDirectDistributorAccount(req.user.tenantId)
        distributorAccountId = noneDirect.id
      }

      const generateProductCode = () =>
        (`AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`).slice(0, 64)

      const providedProductCode = productCodeInput.trim()
      const shouldRetryProductCode = providedProductCode.length === 0
      let productCode = providedProductCode || generateProductCode()

      const createProduct = async (nextCode: string) =>
        prisma.product.create({
          // Cast to any to allow recently added nullable metadata fields
          data: {
            tenantId: req.user.tenantId,
            productCode: nextCode,
            productNameHouse,
            productNameDistributor: getOptionalString((payload as any).productNameDistributor),
            productFamilyHouse,
            productSubtypeHouse,
            productNameVendor: canonicalProductNameVendor,
            productFamilyVendor,
            productSubtypeVendor,
            distributorProductFamily,
            distributorProductSubtype,
            partNumberHouse: getOptionalString((payload as any).partNumberHouse),
            partNumberVendor: canonicalPartNumberVendor,
            productDescriptionVendor: getOptionalString((payload as any).productDescriptionVendor),
            description: getOptionalString((payload as any).description),
            revenueType: revenueTypeValue as any,
            priceEach,
            commissionPercent,
            isActive: Boolean((payload as any).isActive),
            vendorAccountId: vendorAccountId,
            distributorAccountId: distributorAccountId,
            createdById: req.user.id ?? null,
            updatedById: req.user.id ?? null,
          } as any,
          include: {
            distributor: { select: { id: true, accountName: true } },
            vendor: { select: { id: true, accountName: true } },
          }
        })

      let created: Awaited<ReturnType<typeof createProduct>> | null = null
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          created = await createProduct(productCode)
          break
        } catch (error: any) {
          if (error?.code === "P2002" && shouldRetryProductCode) {
            productCode = generateProductCode()
            continue
          }
          throw error
        }
      }

      if (!created) {
        return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
      }

      // Log product creation to audit history
      await logProductAudit(
        AuditAction.Create,
        created.id,
        req.user.id,
        req.user.tenantId,
        request,
        undefined,
        {
          productCode: created.productCode,
          productNameHouse: created.productNameHouse,
          productNameVendor: created.productNameVendor,
          partNumberVendor: (created as any).partNumberVendor ?? null,
          isActive: created.isActive,
          priceEach: created.priceEach,
          commissionPercent: created.commissionPercent,
          revenueType: created.revenueType,
        }
      )

      return NextResponse.json({ data: mapProductToRow(created) }, { status: 201 })
    } catch (error: any) {
      if (error?.code === "P2002") {
        return NextResponse.json({ error: "A product with this product code already exists" }, { status: 409 })
      }

      if (error?.code === "P2003") {
        const meta = typeof error?.meta === "object" && error.meta ? error.meta : null
        const fieldName = typeof (meta as any)?.field_name === "string" ? (meta as any).field_name : ""
        const hint =
          fieldName.includes("vendorAccountId") || fieldName.includes("distributorAccountId")
            ? "Re-select Vendor/Distributor from the dropdown and try again."
            : fieldName.includes("createdById") || fieldName.includes("updatedById")
              ? "Your user record may be missing in the database. Try logging out/in or reseeding dev data."
              : "Please try again."

        return NextResponse.json(
          {
            error: "Invalid reference on product create.",
            details:
              process.env.NODE_ENV !== "production"
                ? { code: error.code, message: error.message, meta: error.meta }
                : undefined,
            hint
          },
          { status: 400 }
        )
      }

      console.error("Failed to create product", error)
      return NextResponse.json(
        {
          error: "Failed to create product",
          details:
            process.env.NODE_ENV !== "production"
              ? { code: error?.code, message: error?.message, meta: error?.meta }
              : undefined
        },
        { status: 500 }
      )
    }
  })
}
