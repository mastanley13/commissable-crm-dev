import { NextRequest, NextResponse } from "next/server"

import { Prisma, RevenueType } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { hasAnyPermission } from "@/lib/auth"
import { dedupeColumnFilters } from "@/lib/filter-utils"
import { mapProductToRow } from "./helpers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PRODUCT_VIEW_PERMISSIONS = [
  "products.read",
  "products.update",
  "products.create",
  "products.delete"
]

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
    partNumberVendor: { productCode: direction },
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

export async function GET(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      const roleCode = req.user.role?.code?.toLowerCase() ?? ""
      const isAdmin = roleCode === "admin" || roleCode.includes("admin")
      const canView = isAdmin || hasAnyPermission(req.user, PRODUCT_VIEW_PERMISSIONS)

      if (!canView) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
      }

      const searchParams = request.nextUrl.searchParams
      const tenantId = req.user.tenantId

      const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
      const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "25")))
      const query = searchParams.get("q")?.trim() ?? ""
      const statusParam = (searchParams.get("status") ?? "active").toLowerCase()
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

      if (statusParam === "inactive") {
        where.isActive = false
      } else if (statusParam === "all") {
        // leave undefined to include all
      } else {
        where.isActive = true
      }

      const andConditions: Prisma.ProductWhereInput[] = []

      if (query.length > 0) {
        andConditions.push({
          OR: [
            { productNameHouse: { contains: query, mode: "insensitive" } },
            { productNameVendor: { contains: query, mode: "insensitive" } },
            { productCode: { contains: query, mode: "insensitive" } },
            { distributor: { accountName: { contains: query, mode: "insensitive" } } },
            { vendor: { accountName: { contains: query, mode: "insensitive" } } },
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
            case "partNumberVendor":
              andConditions.push({ productCode: { contains: rawValue, mode: "insensitive" } })
              break
            case "revenueType": {
              const valueLower = rawValue.toLowerCase()
              const matches = (Object.values(RevenueType) as string[]).filter((rt) =>
                rt.toLowerCase().includes(valueLower)
              )
              if (matches.length > 0) {
                andConditions.push({ revenueType: { in: matches as RevenueType[] } })
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
            distributor: { select: { accountName: true } },
            vendor: { select: { accountName: true } },
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

      const productCode = getString((payload as any).productCode)
      if (!productCode) errors.productCode = "Vendor part number is required"

      const revenueTypeValue = getString((payload as any).revenueType)
      if (!revenueTypeValue) {
        errors.revenueType = "Revenue type is required"
      } else if (!(Object.values(RevenueType) as string[]).includes(revenueTypeValue)) {
        errors.revenueType = "Invalid revenue type"
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

      if (Object.keys(errors).length > 0) {
        return NextResponse.json({ error: "Validation failed", errors }, { status: 400 })
      }

      const distributorAccountId = getOptionalString((payload as any).distributorAccountId)
      const vendorAccountId = getOptionalString((payload as any).vendorAccountId)

      const created = await prisma.product.create({
        data: {
          tenantId: req.user.tenantId,
          productCode,
          productNameHouse,
          productNameVendor: getOptionalString((payload as any).productNameVendor),
          productFamilyVendor: getOptionalString((payload as any).productFamilyVendor),
          productSubtypeVendor: getOptionalString((payload as any).productSubtypeVendor),
          partNumberHouse: getOptionalString((payload as any).partNumberHouse),
          productDescriptionVendor: getOptionalString((payload as any).productDescriptionVendor),
          description: getOptionalString((payload as any).description),
          revenueType: revenueTypeValue as RevenueType,
          priceEach,
          commissionPercent,
          isActive: Boolean((payload as any).isActive),
          vendorAccountId: vendorAccountId,
          distributorAccountId: distributorAccountId,
          createdById: req.user.id ?? null,
          updatedById: req.user.id ?? null,
        },
        include: {
          distributor: { select: { accountName: true } },
          vendor: { select: { accountName: true } },
        }
      })

      return NextResponse.json({ data: mapProductToRow(created) }, { status: 201 })
    } catch (error: any) {
      if (error?.code === "P2002") {
        return NextResponse.json({ error: "A product with this vendor part number already exists" }, { status: 409 })
      }
      console.error("Failed to create product", error)
      return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
    }
  })
}
