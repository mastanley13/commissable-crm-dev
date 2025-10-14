import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { hasAnyPermission } from "@/lib/auth"

const PRODUCT_MUTATION_PERMISSIONS = [
  "products.update",
  "products.delete",
  "products.create",
  "products.read"
]

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, { params }: { params: { productId: string } }) {
  return withAuth(request, async (req) => {
    try {
      const roleCode = req.user.role?.code?.toLowerCase() ?? ""
      const isAdmin = roleCode === "admin" || roleCode.includes("admin")
      const canMutate = isAdmin || hasAnyPermission(req.user, PRODUCT_MUTATION_PERMISSIONS)

      if (!canMutate) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
      }

      const { productId } = params
      if (!productId) {
        return NextResponse.json({ error: "Product id is required" }, { status: 400 })
      }

      const payload = await request.json().catch(() => null)
      if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const tenantId = req.user.tenantId

      const existing = await prisma.product.findFirst({
        where: { id: productId, tenantId },
        select: { id: true }
      })

      if (!existing) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 })
      }

      const data: Record<string, unknown> = {}
      let hasChanges = false

      if (typeof payload.active === "boolean") {
        data.isActive = payload.active
        hasChanges = true
      }

      if (!hasChanges) {
        return NextResponse.json({ error: "No changes supplied" }, { status: 400 })
      }

      const updated = await prisma.product.update({
        where: { id: productId },
        data: {
          ...data,
          updatedById: req.user.id,
        },
        include: {
          distributor: { select: { accountName: true } },
          vendor: { select: { accountName: true } },
        }
      })

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("Failed to update product", error)
      return NextResponse.json({ error: "Failed to update product" }, { status: 500 })
    }
  })
}

export async function DELETE(request: NextRequest, { params }: { params: { productId: string } }) {
  return withAuth(request, async (req) => {
    try {
      const roleCode = req.user.role?.code?.toLowerCase() ?? ""
      const isAdmin = roleCode === "admin" || roleCode.includes("admin")
      const canMutate = isAdmin || hasAnyPermission(req.user, PRODUCT_MUTATION_PERMISSIONS)

      if (!canMutate) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
      }

      const { productId } = params
      if (!productId) {
        return NextResponse.json({ error: "Product id is required" }, { status: 400 })
      }

      const tenantId = req.user.tenantId
      const existing = await prisma.product.findFirst({
        where: { id: productId, tenantId },
        select: { id: true }
      })

      if (!existing) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 })
      }

      await prisma.product.delete({ where: { id: productId } })
      return NextResponse.json({ data: { id: productId } })
    } catch (error) {
      console.error("Failed to delete product", error)
      return NextResponse.json({ error: "Failed to delete product" }, { status: 500 })
    }
  })
}
