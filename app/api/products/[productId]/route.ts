import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { AuditAction, OpportunityStatus, RevenueScheduleStatus, Prisma } from "@prisma/client"
import { withAuth } from "@/lib/api-auth"
import { hasAnyPermission } from "@/lib/auth"
import { logProductAudit } from "@/lib/audit"
import { ensureNoneDirectDistributorAccount } from "@/lib/none-direct-distributor"
import { isEnabledRevenueType } from "@/lib/server-revenue-types"

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
      const anyProduct = product as any
      const data = {
        id: product.id,
        productCode: product.productCode,
        productNameHouse: product.productNameHouse,
        productNameVendor: product.productNameVendor,
        partNumberHouse: (anyProduct.partNumberHouse ?? null) as string | null,
        description: product.description,
        productDescriptionHouse: product.description,
        productFamilyHouse: anyProduct.productFamilyHouse ?? null,
        productSubtypeHouse: anyProduct.productSubtypeHouse ?? null,
        productFamilyVendor: anyProduct.productFamilyVendor ?? null,
        productSubtypeVendor: anyProduct.productSubtypeVendor ?? null,
        productNameDistributor: anyProduct.productNameDistributor ?? null,
        partNumberVendor: anyProduct.partNumberVendor ?? null,
        partNumberDistributor: anyProduct.partNumberDistributor ?? null,
        distributorProductFamily: anyProduct.distributorProductFamily ?? null,
        distributorProductSubtype: anyProduct.distributorProductSubtype ?? null,
        productDescriptionVendor: anyProduct.productDescriptionVendor ?? null,
        productDescriptionDistributor: anyProduct.productDescriptionDistributor ?? null,
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

      if (!isAdmin) {
        return NextResponse.json(
          { error: "Only Admins can edit product details" },
          { status: 403 }
        )
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
        select: {
          id: true,
          productCode: true,
          productNameHouse: true,
          productNameVendor: true,
          isActive: true,
          priceEach: true,
          commissionPercent: true,
          revenueType: true,
          vendorAccountId: true,
          distributorAccountId: true,
        }
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

      if (typeof payload.productNameHouse === "string") {
        const value = payload.productNameHouse.trim()
        if (!value) {
          return NextResponse.json({ error: "Product name is required" }, { status: 400 })
        }
        data.productNameHouse = value
        hasChanges = true
      }

      if ("productNameVendor" in payload) {
        const raw = payload.productNameVendor
        if (raw === null) {
          data.productNameVendor = null
          hasChanges = true
        } else if (typeof raw === "string") {
          data.productNameVendor = raw.trim() || null
          hasChanges = true
        }
      }

      if (typeof payload.productCode === "string") {
        const value = payload.productCode.trim()
        if (!value) {
          return NextResponse.json({ error: "Product code is required" }, { status: 400 })
        }
        data.productCode = value
        hasChanges = true
      }

      if (typeof payload.revenueType === "string") {
        const allowed = await isEnabledRevenueType(req.user.tenantId, payload.revenueType)
        if (!allowed) {
          return NextResponse.json(
            { error: "Select a valid Revenue Type managed in Data Settings." },
            { status: 400 }
          )
        }
        data.revenueType = payload.revenueType
        hasChanges = true
      }

      if ("priceEach" in payload) {
        const raw = payload.priceEach
        if (raw === null || raw === "") {
          data.priceEach = null
          hasChanges = true
        } else if (typeof raw === "number") {
          if (!Number.isFinite(raw) || raw < 0) {
            return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 })
          }
          data.priceEach = raw
          hasChanges = true
        } else if (typeof raw === "string") {
          const parsed = Number(raw)
          if (!Number.isFinite(parsed) || parsed < 0) {
            return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 })
          }
          data.priceEach = parsed
          hasChanges = true
        }
      }

      if ("commissionPercent" in payload) {
        const raw = payload.commissionPercent
        if (raw === null || raw === "") {
          data.commissionPercent = null
          hasChanges = true
        } else if (typeof raw === "number") {
          if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
            return NextResponse.json({ error: "Commission percent must be between 0 and 100" }, { status: 400 })
          }
          data.commissionPercent = raw
          hasChanges = true
        } else if (typeof raw === "string") {
          const parsed = Number(raw)
          if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
            return NextResponse.json({ error: "Commission percent must be between 0 and 100" }, { status: 400 })
          }
          data.commissionPercent = parsed
          hasChanges = true
        }
      }

      if ("description" in payload) {
        const raw = payload.description
        if (raw === null) {
          data.description = null
          hasChanges = true
        } else if (typeof raw === "string") {
          data.description = raw.trim() || null
          hasChanges = true
        }
      }

      // Extended product metadata fields
      const stringFields = [
        "productFamilyHouse",
        "productFamilyVendor",
        "productSubtypeHouse",
        "productSubtypeVendor",
        "productNameDistributor",
        "partNumberVendor",
        "partNumberDistributor",
        "distributorProductFamily",
        "distributorProductSubtype",
        "productDescriptionVendor",
        "productDescriptionDistributor",
      ] as const

      for (const key of stringFields) {
        if (key in payload) {
          const raw = (payload as Record<string, unknown>)[key]
          if (raw === null) {
            ;(data as Record<string, unknown>)[key] = null
            hasChanges = true
          } else if (typeof raw === "string") {
            ;(data as Record<string, unknown>)[key] = raw.trim() || null
            hasChanges = true
          }
        }
      }

      const PICKLIST_FIELDS = [
        "productFamilyHouse",
        "productSubtypeHouse",
        "productFamilyVendor",
        "productSubtypeVendor",
        "distributorProductFamily",
        "distributorProductSubtype",
      ] as const

      const touchesPicklists = PICKLIST_FIELDS.some((field) => field in payload)
      if (touchesPicklists) {
        try {
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

          const errors: Record<string, string> = {}

          const getNext = (field: (typeof PICKLIST_FIELDS)[number]) => {
            if (Object.prototype.hasOwnProperty.call(data, field)) {
              return (data as any)[field] as string | null
            }
            return (existing as any)[field] as string | null
          }

          const validateFamily = (field: "productFamilyHouse" | "productFamilyVendor" | "distributorProductFamily") => {
            if (!(field in payload)) return
            const value = getNext(field)
            if (!value) return
            if (!familyNames.has(value)) {
              errors[field] = "Select a valid value managed in Data Settings."
            }
          }

          const validateSubtype = (
            subtypeField: "productSubtypeHouse" | "productSubtypeVendor" | "distributorProductSubtype",
            familyField: "productFamilyHouse" | "productFamilyVendor" | "distributorProductFamily"
          ) => {
            const subtypeTouched = subtypeField in payload
            const familyTouched = familyField in payload
            if (!subtypeTouched && !familyTouched) return

            const subtypeValue = getNext(subtypeField)
            const familyValue = getNext(familyField)
            if (!subtypeValue) return

            const record = subtypeByName.get(subtypeValue)
            if (!record) {
              errors[subtypeField] = "Select a valid value managed in Data Settings (or clear the field)."
              return
            }

            if (!familyValue) return
            const familyId = familyIdByName.get(familyValue) ?? null
            if (record.productFamilyId && familyId && record.productFamilyId !== familyId) {
              errors[subtypeField] = "Subtype does not belong to the selected Product Family."
            }
          }

          validateFamily("productFamilyHouse")
          validateFamily("productFamilyVendor")
          validateFamily("distributorProductFamily")

          validateSubtype("productSubtypeHouse", "productFamilyHouse")
          validateSubtype("productSubtypeVendor", "productFamilyVendor")
          validateSubtype("distributorProductSubtype", "distributorProductFamily")

          if (Object.keys(errors).length > 0) {
            return NextResponse.json({ error: "Validation failed", errors }, { status: 400 })
          }
        } catch (error) {
          console.error("Failed to validate product picklists", error)
          return NextResponse.json({ error: "Failed to validate picklist values" }, { status: 500 })
        }
      }

      let nextVendorAccountId = existing.vendorAccountId ?? null
      let nextDistributorAccountId = existing.distributorAccountId ?? null

      if ("vendorAccountId" in payload) {
        const raw = payload.vendorAccountId
        if (raw === null || raw === "") {
          nextVendorAccountId = null
        } else if (typeof raw === "string") {
          nextVendorAccountId = raw.trim()
        }
      }

      if ("distributorAccountId" in payload) {
        const raw = payload.distributorAccountId
        if (raw === null || raw === "") {
          nextDistributorAccountId = null
        } else if (typeof raw === "string") {
          nextDistributorAccountId = raw.trim()
        }
      }

      if (nextVendorAccountId && !nextDistributorAccountId) {
        const noneDirect = await ensureNoneDirectDistributorAccount(tenantId)
        nextDistributorAccountId = noneDirect.id
      }

      if (nextVendorAccountId !== existing.vendorAccountId) {
        ;(data as any).vendorAccountId = nextVendorAccountId
        hasChanges = true
      }

      if (nextDistributorAccountId !== existing.distributorAccountId) {
        ;(data as any).distributorAccountId = nextDistributorAccountId
        hasChanges = true
      }

      if (!hasChanges) {
        return NextResponse.json({ error: "No changes supplied" }, { status: 400 })
      }

      const updated = await prisma.product.update({
        where: { id: productId },
        data: {
          ...data,
          updatedById: req.user.id
        },
        include: {
          distributor: { select: { accountName: true } },
          vendor: { select: { accountName: true } },
        }
      })

      // Log updates (including activation / inactivation) to audit history
      const previousValues = {
        productCode: existing.productCode,
        productNameHouse: existing.productNameHouse,
        productNameVendor: existing.productNameVendor,
        isActive: existing.isActive,
        priceEach: existing.priceEach,
        commissionPercent: existing.commissionPercent,
        revenueType: existing.revenueType,
      }

      const newValues = {
        productCode: updated.productCode,
        productNameHouse: updated.productNameHouse,
        productNameVendor: updated.productNameVendor,
        isActive: updated.isActive,
        priceEach: updated.priceEach,
        commissionPercent: updated.commissionPercent,
        revenueType: updated.revenueType,
      }

      await logProductAudit(
        AuditAction.Update,
        productId,
        req.user.id,
        tenantId,
        request,
        previousValues,
        newValues
      )

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

      let reason: string | null = null
      try {
        const body = await request.json().catch(() => null) as any
        if (body && typeof body.reason === "string") {
          reason = body.reason.trim() || null
        }
      } catch (_) {
        // ignore missing/invalid JSON bodies
      }

      const tenantId = req.user.tenantId
      const existing = await prisma.product.findFirst({
        where: { id: productId, tenantId },
        select: {
          id: true,
          productCode: true,
          productNameHouse: true,
          productNameVendor: true,
          isActive: true,
          priceEach: true,
          commissionPercent: true,
        }
      })

      if (!existing) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 })
      }

      if (existing.isActive) {
        return NextResponse.json(
          { error: "Cannot delete an active product. Inactivate the product instead." },
          { status: 409 }
        )
      }

      const activeRevenueScheduleWhere = {
        tenantId,
        productId,
        deletedAt: null,
        status: { not: RevenueScheduleStatus.Reconciled },
      } satisfies Prisma.RevenueScheduleWhereInput

      // Block deletion only when the product is referenced by active (non-deleted, non-reconciled) schedules.
      const activeScheduleCount = await prisma.revenueSchedule.count({
        where: activeRevenueScheduleWhere,
      })

      if (activeScheduleCount > 0) {
        const blockingSchedules = await prisma.revenueSchedule.findMany({
          where: activeRevenueScheduleWhere,
          select: { id: true, scheduleNumber: true, status: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        })

        const labels = blockingSchedules.map((s) => s.scheduleNumber ?? s.id)
        const suffix = activeScheduleCount > labels.length ? ` and ${activeScheduleCount - labels.length} more` : ""
        const list = labels.length > 0 ? ` (${labels.join(", ")}${suffix})` : ""

        return NextResponse.json(
          { error: `Cannot delete product because it is used by active revenue schedules${list}. Delete or reconcile those schedules first.` },
          { status: 409 }
        )
      }

      // Block deletion when the product is used on active opportunities (open/on-hold).
      const activeOpportunityLineItemWhere = {
        tenantId,
        productId,
        active: true,
        opportunity: {
          active: true,
          status: { in: [OpportunityStatus.Open, OpportunityStatus.OnHold] },
        },
      } satisfies Prisma.OpportunityProductWhereInput

      const activeOpportunityLineItemCount = await prisma.opportunityProduct.count({
        where: activeOpportunityLineItemWhere,
      })

      if (activeOpportunityLineItemCount > 0) {
        const blockingLineItems = await prisma.opportunityProduct.findMany({
          where: activeOpportunityLineItemWhere,
          select: {
            id: true,
            opportunity: { select: { id: true, name: true, status: true, stage: true } },
          },
          take: 5,
        })
        const names = blockingLineItems
          .map((li) => li.opportunity?.name ?? li.opportunity?.id ?? "Opportunity")
          .filter(Boolean)
        const suffix =
          activeOpportunityLineItemCount > names.length ? ` and ${activeOpportunityLineItemCount - names.length} more` : ""
        const list = names.length > 0 ? ` (${names.join(", ")}${suffix})` : ""

        return NextResponse.json(
          { error: `Cannot delete product because it is used on active opportunities${list}. Remove the product from those opportunities first.` },
          { status: 409 }
        )
      }

      const [relatedLineItems, detachableScheduleIds] = await Promise.all([
        prisma.opportunityProduct.findMany({
          where: { tenantId, productId },
          select: { id: true },
        }),
        prisma.revenueSchedule.findMany({
          where: {
            tenantId,
            productId,
            OR: [{ deletedAt: { not: null } }, { status: RevenueScheduleStatus.Reconciled }],
          },
          select: { id: true },
        }),
      ])

      await prisma.$transaction(async tx => {
        if (detachableScheduleIds.length > 0) {
          const ids = detachableScheduleIds.map((s) => s.id)
          await tx.revenueSchedule.updateMany({
            where: { tenantId, id: { in: ids } },
            data: { productId: null, opportunityProductId: null },
          })
        }

        if (relatedLineItems.length > 0) {
          await tx.opportunityProduct.deleteMany({
            where: { tenantId, productId }
          })
        }

        await tx.product.delete({ where: { id: productId } })
      })

      // Log deletion into audit history
      await logProductAudit(
        AuditAction.Delete,
        productId,
        req.user.id,
        tenantId,
        request,
        {
          productCode: existing.productCode,
          productNameHouse: existing.productNameHouse,
          productNameVendor: existing.productNameVendor,
          isActive: existing.isActive,
          priceEach: existing.priceEach,
          commissionPercent: existing.commissionPercent,
          reason,
        },
        undefined
      )

      return NextResponse.json({ data: { id: productId } })
    } catch (error) {
      console.error("Failed to delete product", error)
      return NextResponse.json({ error: "Failed to delete product" }, { status: 500 })
    }
  })
}
