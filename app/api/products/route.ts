import { NextRequest, NextResponse } from "next/server"

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { hasAnyPermission } from "@/lib/auth"
import { dedupeColumnFilters } from "@/lib/filter-utils"
import type { ColumnFilter } from "@/components/list-header"
import { mapProductToRow } from "./helpers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PRODUCT_VIEW_PERMISSIONS = [
  "products.read",
  "products.update",
  "products.create",
  "products.delete"
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
            case "revenueType":
              andConditions.push({ revenueType: { contains: rawValue, mode: "insensitive" } })
              break
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
      console.error("Failed to load products", error)
      return NextResponse.json({ error: "Failed to load products" }, { status: 500 })
    }
  })
}
