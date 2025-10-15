import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { hasAnyPermission } from "@/lib/auth"

const PRODUCT_VIEW_PERMISSIONS = [
  "products.read",
  "products.update",
  "products.delete",
  "products.create"
]

const PRODUCT_MUTATION_PERMISSIONS = [
  "products.update",
  "products.delete",
  "products.create",
  "products.read"
]

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: { productId: string } }) {
  return withAuth(request, async (req) => {
    try {
      const roleCode = req.user.role?.code?.toLowerCase() ?? ""
      const isAdmin = roleCode === "admin" || roleCode.includes("admin")
      const canView = isAdmin || hasAnyPermission(req.user, PRODUCT_VIEW_PERMISSIONS)

      if (!canView) {
        return NextResponse.json({ error: "Insufficient permissions to view products" }, { status: 403 })
      }

      const { productId } = params
      if (!productId) {
        return NextResponse.json({ error: "Product id is required" }, { status: 400 })
      }

      const tenantId = req.user.tenantId

      // Fetch product with all related data
      const product = await prisma.product.findFirst({
        where: { id: productId, tenantId },
        include: {
          distributor: {
            select: {
              id: true,
              accountName: true,
              accountNumber: true
            }
          },
          vendor: {
            select: {
              id: true,
              accountName: true,
              accountNumber: true
            }
          },
          createdBy: {
            select: {
              id: true,
              fullName: true
            }
          },
          updatedBy: {
            select: {
              id: true,
              fullName: true
            }
          },
          opportunityProducts: {
            include: {
              opportunity: {
                select: {
                  id: true,
                  name: true,
                  stage: true,
                  estimatedCloseDate: true,
                  account: {
                    select: {
                      id: true,
                      accountName: true
                    }
                  }
                }
              }
            }
          },
          revenueSchedules: {
            select: {
              id: true,
              scheduleNumber: true,
              scheduleDate: true,
              expectedUsage: true,
              actualUsage: true,
              expectedCommission: true,
              actualCommission: true,
              status: true,
              account: {
                select: {
                  id: true,
                  accountName: true
                }
              }
            },
            orderBy: { scheduleDate: "desc" }
          }
        }
      })

      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 })
      }

      // Format usage data - opportunities
      const opportunities = product.opportunityProducts.map(op => ({
        id: op.opportunity.id,
        name: op.opportunity.name ?? "Untitled Opportunity",
        accountId: op.opportunity.account?.id ?? "",
        accountName: op.opportunity.account?.accountName ?? "Unknown Account",
        stage: op.opportunity.stage ?? "Unknown",
        quantity: op.quantity !== null ? Number(op.quantity) : null,
        unitPrice: op.unitPrice !== null ? Number(op.unitPrice) : null,
        expectedRevenue: op.expectedRevenue !== null ? Number(op.expectedRevenue) : null,
        estimatedCloseDate: op.opportunity.estimatedCloseDate?.toISOString() ?? null
      }))

      // Format usage data - revenue schedules
      const revenueSchedules = product.revenueSchedules.map(schedule => ({
        id: schedule.id,
        scheduleNumber: schedule.scheduleNumber,
        scheduleDate: schedule.scheduleDate?.toISOString() ?? null,
        accountId: schedule.account.id,
        accountName: schedule.account.accountName,
        expectedUsage: schedule.expectedUsage !== null ? Number(schedule.expectedUsage) : null,
        actualUsage: schedule.actualUsage !== null ? Number(schedule.actualUsage) : null,
        expectedCommission: schedule.expectedCommission !== null ? Number(schedule.expectedCommission) : null,
        actualCommission: schedule.actualCommission !== null ? Number(schedule.actualCommission) : null,
        status: schedule.status
      }))

      // TODO: Fetch audit log entries when audit logging is implemented
      // For now, return empty array
      const auditLog: any[] = []

      // Build response
      const data = {
        id: product.id,
        productCode: product.productCode,
        productNameHouse: product.productNameHouse,
        productNameVendor: product.productNameVendor,
        description: product.description,
        productDescriptionHouse: product.description,
        productFamilyHouse: null,
        productFamilyVendor: null,
        productSubtypeVendor: null,
        productNameDistributor: null,
        partNumberVendor: null,
        partNumberDistributor: null,
        distributorProductFamily: null,
        productDescriptionVendor: null,
        productDescriptionDistributor: null,
        revenueType: product.revenueType,
        commissionPercent: product.commissionPercent !== null ? Number(product.commissionPercent) : null,
        priceEach: product.priceEach !== null ? Number(product.priceEach) : null,
        isActive: product.isActive,
        distributor: product.distributor ? {
          id: product.distributor.id,
          accountName: product.distributor.accountName,
          accountNumber: product.distributor.accountNumber
        } : null,
        vendor: product.vendor ? {
          id: product.vendor.id,
          accountName: product.vendor.accountName,
          accountNumber: product.vendor.accountNumber
        } : null,
        createdBy: product.createdBy ? {
          id: product.createdBy.id,
          name: product.createdBy.fullName ?? "Unknown"
        } : null,
        updatedBy: product.updatedBy ? {
          id: product.updatedBy.id,
          name: product.updatedBy.fullName ?? "Unknown"
        } : null,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        usage: {
          opportunities,
          revenueSchedules
        },
        auditLog
      }

      return NextResponse.json({ success: true, data })
    } catch (error) {
      console.error("Failed to load product", error)
      return NextResponse.json({ error: "Failed to load product" }, { status: 500 })
    }
  })
}

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
