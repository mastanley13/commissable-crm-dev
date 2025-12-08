import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PRODUCT_BULK_UPDATE_PERMISSIONS = ["products.update", "products.manage", "products.admin"]

type ProductBulkPatch = {
  priceEach?: number
  commissionPercent?: number
}

type ProductBulkBody = {
  ids: string[]
  patch: ProductBulkPatch
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

export async function POST(request: NextRequest) {
  return withPermissions(request, PRODUCT_BULK_UPDATE_PERMISSIONS, async req => {
    try {
      const body = (await request.json().catch(() => null)) as ProductBulkBody | null
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const ids = Array.isArray(body.ids)
        ? Array.from(
            new Set(
              body.ids
                .filter(id => typeof id === "string")
                .map(id => id.trim())
                .filter(id => id.length > 0)
            )
          )
        : []

      if (ids.length === 0) {
        return NextResponse.json({ error: "ids must be a non-empty array of product ids" }, { status: 400 })
      }

      const patch = body.patch ?? {}
      const hasPatchFields = Object.values(patch).some(value => value !== undefined && value !== null)
      if (!hasPatchFields) {
        return NextResponse.json({ error: "patch must include at least one supported field" }, { status: 400 })
      }

      const updates: ProductBulkPatch = {}

      if ("priceEach" in patch) {
        const raw = patch.priceEach
        if (raw === null || raw === undefined) {
          updates.priceEach = null as any
        } else if (isFiniteNumber(raw)) {
          if (raw < 0) {
            return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 })
          }
          updates.priceEach = raw
        } else {
          return NextResponse.json({ error: "Price must be a number" }, { status: 400 })
        }
      }

      if ("commissionPercent" in patch) {
        const raw = patch.commissionPercent
        if (raw === null || raw === undefined) {
          updates.commissionPercent = null as any
        } else if (isFiniteNumber(raw)) {
          if (raw < 0 || raw > 1) {
            return NextResponse.json({ error: "Commission percent must be between 0 and 100" }, { status: 400 })
          }
          updates.commissionPercent = raw
        } else {
          return NextResponse.json({ error: "Commission percent must be a number" }, { status: 400 })
        }
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No valid fields supplied in patch" }, { status: 400 })
      }

      const tenantId = req.user.tenantId

      const products = await prisma.product.findMany({
        where: {
          id: { in: ids },
          tenantId
        },
        select: {
          id: true
        }
      })

      if (products.length === 0) {
        return NextResponse.json(
          { error: "No matching products found for the current tenant", failed: ids },
          { status: 404 }
        )
      }

      const foundIds = new Set(products.map(product => product.id))
      const failed: string[] = ids.filter(id => !foundIds.has(id))
      const errors: Record<string, string> = {}
      let updated = 0

      for (const product of products) {
        try {
          await prisma.product.update({
            where: { id: product.id },
            data: {
              ...updates,
              updatedById: req.user.id
            }
          })
          updated += 1
        } catch (error) {
          errors[product.id] =
            error instanceof Error ? error.message : "Failed to update product"
          failed.push(product.id)
        }
      }

      return NextResponse.json({ updated, failed, errors })
    } catch (error) {
      console.error("Failed to bulk update products", error)
      return NextResponse.json({ error: "Failed to bulk update products" }, { status: 500 })
    }
  })
}

