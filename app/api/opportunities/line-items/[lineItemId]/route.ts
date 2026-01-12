import { NextRequest, NextResponse } from "next/server"
import { AuditAction, Prisma, OpportunityProductStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { hasAnyPermission } from "@/lib/auth"
import { mapOpportunityProductToDetail } from "../../helpers"
import { revalidateOpportunityPaths } from "../../revalidate"
import { recalculateOpportunityStage } from "@/lib/opportunities/stage"
import { assertVendorDistributorConsistentForOpportunity } from "@/lib/opportunities/vendor-distributor"
import { logOpportunityProductAudit } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const OPPORTUNITY_LINE_ITEM_VIEW_ANY_PERMISSIONS = [
  "opportunities.view.all",
  "opportunities.edit.all",
  "opportunities.manage",
  "accounts.manage",
  "accounts.read",
  "opportunities.read"
]

const OPPORTUNITY_LINE_ITEM_VIEW_ASSIGNED_PERMISSIONS = [
  "opportunities.view.assigned",
  "opportunities.edit.assigned"
]

const OPPORTUNITY_LINE_ITEM_VIEW_PERMISSIONS = Array.from(
  new Set([
    ...OPPORTUNITY_LINE_ITEM_VIEW_ANY_PERMISSIONS,
    ...OPPORTUNITY_LINE_ITEM_VIEW_ASSIGNED_PERMISSIONS
  ])
)

const OPPORTUNITY_LINE_ITEM_EDIT_ANY_PERMISSIONS = [
  "opportunities.edit.all",
  "opportunities.manage",
  "accounts.manage",
  "accounts.update"
]

const OPPORTUNITY_LINE_ITEM_EDIT_ASSIGNED_PERMISSIONS = ["opportunities.edit.assigned"]

const OPPORTUNITY_LINE_ITEM_EDIT_PERMISSIONS = Array.from(
  new Set([
    ...OPPORTUNITY_LINE_ITEM_EDIT_ANY_PERMISSIONS,
    ...OPPORTUNITY_LINE_ITEM_EDIT_ASSIGNED_PERMISSIONS
  ])
)

export async function GET(
  request: NextRequest,
  { params }: { params: { lineItemId: string } }
) {
  return withPermissions(request, OPPORTUNITY_LINE_ITEM_VIEW_PERMISSIONS, async req => {
    try {
      const { lineItemId } = params
      if (!lineItemId) {
        return NextResponse.json({ error: "Line item id is required" }, { status: 400 })
      }

      const tenantId = req.user.tenantId
      const canViewAny = hasAnyPermission(req.user, OPPORTUNITY_LINE_ITEM_VIEW_ANY_PERMISSIONS)
      const canViewAssigned = hasAnyPermission(req.user, OPPORTUNITY_LINE_ITEM_VIEW_ASSIGNED_PERMISSIONS)

      if (!canViewAny && !canViewAssigned) {
        return NextResponse.json({ error: "Insufficient permissions to view opportunity products" }, { status: 403 })
      }

      const lineItem = await prisma.opportunityProduct.findFirst({
        where: { id: lineItemId, tenantId },
        include: {
          opportunity: { select: { id: true, name: true, ownerId: true } },
          product: {
            select: {
              id: true,
              productNameHouse: true,
              productNameVendor: true,
              productCode: true,
              revenueType: true,
              commissionPercent: true,
              priceEach: true,
              description: true,
              productFamilyHouse: true,
              productSubtypeHouse: true,
              productFamilyVendor: true,
              productSubtypeVendor: true,
              productNameDistributor: true,
              partNumberVendor: true,
              partNumberDistributor: true,
              distributorProductFamily: true,
              distributorProductSubtype: true,
              productDescriptionVendor: true,
              productDescriptionDistributor: true,
              distributorAccountId: true,
              vendorAccountId: true,
              distributor: { select: { id: true, accountName: true, accountNumber: true } },
              vendor: { select: { id: true, accountName: true, accountNumber: true } }
            }
          }
        }
      })

      if (!lineItem) {
        return NextResponse.json({ error: "Line item not found" }, { status: 404 })
      }

      if (!canViewAny) {
        if (!canViewAssigned || lineItem.opportunity?.ownerId !== req.user.id) {
          return NextResponse.json(
            { error: "Insufficient permissions to view this opportunity" },
            { status: 403 }
          )
        }
      }

      const anyLineItem = lineItem as any
      const product = lineItem.product
      const toNumber = (value: unknown): number | null => {
        if (value === null || value === undefined) return null
        if (typeof value === "number") return Number.isFinite(value) ? value : null
        if (typeof value === "string") {
          const parsed = Number(value)
          return Number.isFinite(parsed) ? parsed : null
        }
        if (typeof value === "object" && value && "toString" in value) {
          const parsed = Number(String((value as any).toString()))
          return Number.isFinite(parsed) ? parsed : null
        }
        return null
      }

      const distributorAccountId =
        anyLineItem.distributorAccountIdSnapshot ?? product?.distributorAccountId ?? null
      const vendorAccountId =
        anyLineItem.vendorAccountIdSnapshot ?? product?.vendorAccountId ?? null

      const [distributorAccount, vendorAccount] = await Promise.all([
        distributorAccountId
          ? prisma.account.findFirst({
              where: { id: distributorAccountId, tenantId },
              select: { id: true, accountName: true, accountNumber: true }
            })
          : Promise.resolve(null),
        vendorAccountId
          ? prisma.account.findFirst({
              where: { id: vendorAccountId, tenantId },
              select: { id: true, accountName: true, accountNumber: true }
            })
          : Promise.resolve(null)
      ])

      const data = {
        id: lineItem.id,
        opportunity: {
          id: lineItem.opportunity?.id ?? "",
          name: lineItem.opportunity?.name ?? ""
        },
        opportunityOwnerId: lineItem.opportunity?.ownerId ?? null,
        catalogProductId: lineItem.productId,
        productCode: lineItem.productCodeSnapshot ?? product?.productCode ?? "",
        productNameHouse: lineItem.productNameHouseSnapshot ?? product?.productNameHouse ?? "",
        productNameVendor: lineItem.productNameVendorSnapshot ?? product?.productNameVendor ?? null,
        description: anyLineItem.descriptionSnapshot ?? product?.description ?? null,
        productDescriptionHouse: anyLineItem.descriptionSnapshot ?? product?.description ?? null,
        revenueType: lineItem.revenueTypeSnapshot ?? product?.revenueType ?? "",
        commissionPercent: toNumber(lineItem.commissionPercentSnapshot ?? product?.commissionPercent ?? null),
        priceEach: toNumber(lineItem.priceEachSnapshot ?? product?.priceEach ?? null),
        isActive: lineItem.active !== false,
        createdBy: null,
        updatedBy: null,
        distributor: distributorAccount
          ? {
              id: distributorAccount.id,
              accountName: distributorAccount.accountName,
              accountNumber: distributorAccount.accountNumber
            }
          : distributorAccountId
            ? {
                id: distributorAccountId,
                accountName: anyLineItem.distributorNameSnapshot ?? "",
                accountNumber: null
              }
            : product?.distributor
              ? {
                  id: product.distributor.id,
                  accountName: product.distributor.accountName,
                  accountNumber: product.distributor.accountNumber
                }
              : null,
        vendor: vendorAccount
          ? {
              id: vendorAccount.id,
              accountName: vendorAccount.accountName,
              accountNumber: vendorAccount.accountNumber
            }
          : vendorAccountId
            ? {
                id: vendorAccountId,
                accountName: anyLineItem.vendorNameSnapshot ?? "",
                accountNumber: null
              }
            : product?.vendor
              ? {
                  id: product.vendor.id,
                  accountName: product.vendor.accountName,
                  accountNumber: product.vendor.accountNumber
                }
              : null,
        productFamilyHouse:
          anyLineItem.productFamilyHouseSnapshot ?? product?.productFamilyHouse ?? null,
        productSubtypeHouse:
          anyLineItem.productSubtypeHouseSnapshot ?? product?.productSubtypeHouse ?? null,
        productFamilyVendor:
          anyLineItem.productFamilyVendorSnapshot ?? product?.productFamilyVendor ?? null,
        productSubtypeVendor:
          anyLineItem.productSubtypeVendorSnapshot ?? product?.productSubtypeVendor ?? null,
        productNameDistributor:
          anyLineItem.productNameDistributorSnapshot ?? product?.productNameDistributor ?? null,
        partNumberVendor:
          anyLineItem.partNumberVendorSnapshot ?? product?.partNumberVendor ?? null,
        partNumberDistributor:
          anyLineItem.partNumberDistributorSnapshot ?? product?.partNumberDistributor ?? null,
        distributorProductFamily:
          anyLineItem.distributorProductFamilySnapshot ?? product?.distributorProductFamily ?? null,
        distributorProductSubtype:
          anyLineItem.distributorProductSubtypeSnapshot ?? product?.distributorProductSubtype ?? null,
        productDescriptionVendor:
          anyLineItem.productDescriptionVendorSnapshot ?? product?.productDescriptionVendor ?? null,
        productDescriptionDistributor:
          anyLineItem.productDescriptionDistributorSnapshot ?? product?.productDescriptionDistributor ?? null,
        createdAt: lineItem.createdAt.toISOString(),
        updatedAt: lineItem.updatedAt.toISOString()
      }

      return NextResponse.json({ success: true, data })
    } catch (error) {
      console.error("Failed to load opportunity product", error)
      return NextResponse.json({ error: "Failed to load opportunity product" }, { status: 500 })
    }
  })
}

function isValidProductStatus(value: unknown): value is OpportunityProductStatus {
  return typeof value === "string" && (Object.values(OpportunityProductStatus) as string[]).includes(value)
}

function parseNumberInput(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN

  if (!Number.isFinite(numeric)) {
    return null
  }

  return numeric
}

function decimalFromNumber(value: number | null): Prisma.Decimal | null {
  if (value === null) {
    return null
  }
  return new Prisma.Decimal(value)
}

function parseDateInput(value: unknown): Date | null {
  if (!value) {
    return null
  }

  const date = new Date(value as string)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { lineItemId: string } }
) {
  return withPermissions(request, OPPORTUNITY_LINE_ITEM_EDIT_PERMISSIONS, async req => {
    try {
      const { lineItemId } = params
      if (!lineItemId) {
        return NextResponse.json({ error: "Line item id is required" }, { status: 400 })
      }

      const tenantId = req.user.tenantId
      const payload = await request.json().catch(() => null)

      if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

    const existingLineItem = await prisma.opportunityProduct.findFirst({
      where: { id: lineItemId, tenantId },
      include: {
        opportunity: { select: { id: true, accountId: true, ownerId: true } },
        product: {
            select: {
              id: true,
              productNameHouse: true,
              productNameVendor: true,
              productCode: true,
              revenueType: true,
              priceEach: true,
              distributor: { select: { id: true, accountName: true } },
              vendor: { select: { id: true, accountName: true } }
            }
          }
        }
      })

      if (!existingLineItem) {
        return NextResponse.json({ error: "Line item not found" }, { status: 404 })
      }

      const canEditAny = hasAnyPermission(req.user, OPPORTUNITY_LINE_ITEM_EDIT_ANY_PERMISSIONS)
      const canEditAssigned = hasAnyPermission(
        req.user,
        OPPORTUNITY_LINE_ITEM_EDIT_ASSIGNED_PERMISSIONS
      )

      if (!canEditAny) {
        if (!canEditAssigned || existingLineItem.opportunity?.ownerId !== req.user.id) {
          return NextResponse.json(
            { error: "Insufficient permissions to modify this opportunity" },
            { status: 403 }
          )
        }
      }

      const updateData: any = {}
      let activeUpdate: boolean | undefined
      let statusUpdate: OpportunityProductStatus | undefined

      if ("productId" in payload) {
        const productId =
          typeof payload.productId === "string" ? payload.productId.trim() : ""

        if (!productId) {
          return NextResponse.json({ error: "Product is required" }, { status: 400 })
        }

        const product = await prisma.product.findFirst({
          where: { id: productId, tenantId },
          select: {
            id: true,
            productCode: true,
            productNameHouse: true,
            productNameVendor: true,
            description: true,
            revenueType: true,
            priceEach: true,
            commissionPercent: true,
            productFamilyHouse: true,
            productSubtypeHouse: true,
            productFamilyVendor: true,
            productSubtypeVendor: true,
            productNameDistributor: true,
            partNumberVendor: true,
            partNumberDistributor: true,
            distributorProductFamily: true,
            distributorProductSubtype: true,
            productDescriptionVendor: true,
            productDescriptionDistributor: true,
            distributorAccountId: true,
            vendorAccountId: true,
            distributor: { select: { id: true, accountName: true } },
            vendor: { select: { id: true, accountName: true } }
          }
        })

        if (!product) {
          return NextResponse.json({ error: "Product not found" }, { status: 404 })
        }

        // Enforce single Distributor/Vendor per Opportunity when changing product.
        const newPair = {
          distributorAccountId: product.distributorAccountId ?? null,
          vendorAccountId: product.vendorAccountId ?? null
        }

        if (existingLineItem.opportunity) {
          await assertVendorDistributorConsistentForOpportunity(
            prisma,
            tenantId,
            existingLineItem.opportunity.id,
            newPair
          )
        }

        updateData.product = { connect: { id: product.id } }
        updateData.productCodeSnapshot = product.productCode
        updateData.productNameHouseSnapshot = product.productNameHouse
        updateData.productNameVendorSnapshot = product.productNameVendor
        updateData.revenueTypeSnapshot = product.revenueType
        updateData.priceEachSnapshot = product.priceEach
        updateData.commissionPercentSnapshot = product.commissionPercent
        updateData.distributorNameSnapshot = product.distributor?.accountName ?? null
        updateData.vendorNameSnapshot = product.vendor?.accountName ?? null
        updateData.distributorAccountIdSnapshot = product.distributorAccountId ?? null
        updateData.vendorAccountIdSnapshot = product.vendorAccountId ?? null
        updateData.descriptionSnapshot = product.description ?? null
        updateData.productFamilyHouseSnapshot = product.productFamilyHouse ?? null
        updateData.productSubtypeHouseSnapshot = product.productSubtypeHouse ?? null
        updateData.productFamilyVendorSnapshot = product.productFamilyVendor ?? null
        updateData.productSubtypeVendorSnapshot = product.productSubtypeVendor ?? null
        updateData.productNameDistributorSnapshot = product.productNameDistributor ?? null
        updateData.partNumberVendorSnapshot = product.partNumberVendor ?? null
        updateData.partNumberDistributorSnapshot = product.partNumberDistributor ?? null
        updateData.distributorProductFamilySnapshot = product.distributorProductFamily ?? null
        updateData.distributorProductSubtypeSnapshot = product.distributorProductSubtype ?? null
        updateData.productDescriptionVendorSnapshot = product.productDescriptionVendor ?? null
        updateData.productDescriptionDistributorSnapshot = product.productDescriptionDistributor ?? null
      }

      if ("productNameHouse" in payload) {
        const value = typeof payload.productNameHouse === "string" ? payload.productNameHouse.trim() : ""
        updateData.productNameHouseSnapshot = value || null
      }

      if ("productNameVendor" in payload) {
        const value = typeof payload.productNameVendor === "string" ? payload.productNameVendor.trim() : ""
        updateData.productNameVendorSnapshot = value || null
      }

      if ("productCode" in payload) {
        const value = typeof payload.productCode === "string" ? payload.productCode.trim() : ""
        updateData.productCodeSnapshot = value || null
      }

      if ("productFamilyHouse" in payload) {
        const value = typeof payload.productFamilyHouse === "string" ? payload.productFamilyHouse.trim() : ""
        updateData.productFamilyHouseSnapshot = value || null
      }

      if ("productSubtypeHouse" in payload) {
        const value = typeof payload.productSubtypeHouse === "string" ? payload.productSubtypeHouse.trim() : ""
        updateData.productSubtypeHouseSnapshot = value || null
      }

      if ("productFamilyVendor" in payload) {
        const value = typeof payload.productFamilyVendor === "string" ? payload.productFamilyVendor.trim() : ""
        updateData.productFamilyVendorSnapshot = value || null
      }

      if ("productSubtypeVendor" in payload) {
        const value = typeof payload.productSubtypeVendor === "string" ? payload.productSubtypeVendor.trim() : ""
        updateData.productSubtypeVendorSnapshot = value || null
      }

      if ("productNameDistributor" in payload) {
        const value = typeof payload.productNameDistributor === "string" ? payload.productNameDistributor.trim() : ""
        updateData.productNameDistributorSnapshot = value || null
      }

      if ("partNumberVendor" in payload) {
        const value = typeof payload.partNumberVendor === "string" ? payload.partNumberVendor.trim() : ""
        updateData.partNumberVendorSnapshot = value || null
      }

      if ("partNumberDistributor" in payload) {
        const value = typeof payload.partNumberDistributor === "string" ? payload.partNumberDistributor.trim() : ""
        updateData.partNumberDistributorSnapshot = value || null
      }

      if ("distributorProductFamily" in payload) {
        const value = typeof payload.distributorProductFamily === "string" ? payload.distributorProductFamily.trim() : ""
        updateData.distributorProductFamilySnapshot = value || null
      }

      if ("distributorProductSubtype" in payload) {
        const value = typeof payload.distributorProductSubtype === "string" ? payload.distributorProductSubtype.trim() : ""
        updateData.distributorProductSubtypeSnapshot = value || null
      }

      if ("productDescriptionVendor" in payload) {
        const value = typeof payload.productDescriptionVendor === "string" ? payload.productDescriptionVendor.trim() : ""
        updateData.productDescriptionVendorSnapshot = value || null
      }

      if ("productDescriptionDistributor" in payload) {
        const value = typeof payload.productDescriptionDistributor === "string" ? payload.productDescriptionDistributor.trim() : ""
        updateData.productDescriptionDistributorSnapshot = value || null
      }

      if ("description" in payload) {
        const value = typeof payload.description === "string" ? payload.description.trim() : ""
        updateData.descriptionSnapshot = value || null
      }

      if ("revenueType" in payload) {
        updateData.revenueTypeSnapshot = typeof payload.revenueType === "string" ? payload.revenueType : null
      }

      if ("priceEach" in payload) {
        updateData.priceEachSnapshot = decimalFromNumber(parseNumberInput(payload.priceEach))
      }

      if ("commissionPercent" in payload) {
        updateData.commissionPercentSnapshot = decimalFromNumber(parseNumberInput(payload.commissionPercent))
      }

      if ("vendorAccountId" in payload) {
        const value = typeof payload.vendorAccountId === "string" ? payload.vendorAccountId.trim() : ""
        const vendorId = value.length > 0 ? value : null
        if (vendorId) {
          const vendor = await prisma.account.findFirst({
            where: { id: vendorId, tenantId },
            select: { id: true, accountName: true }
          })
          if (!vendor) {
            return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
          }
          updateData.vendorAccountIdSnapshot = vendor.id
          updateData.vendorNameSnapshot = vendor.accountName ?? null
        } else {
          updateData.vendorAccountIdSnapshot = null
          updateData.vendorNameSnapshot = null
        }
      }

      if ("distributorAccountId" in payload) {
        const value = typeof payload.distributorAccountId === "string" ? payload.distributorAccountId.trim() : ""
        const distributorId = value.length > 0 ? value : null
        if (distributorId) {
          const distributor = await prisma.account.findFirst({
            where: { id: distributorId, tenantId },
            select: { id: true, accountName: true }
          })
          if (!distributor) {
            return NextResponse.json({ error: "Distributor not found" }, { status: 404 })
          }
          updateData.distributorAccountIdSnapshot = distributor.id
          updateData.distributorNameSnapshot = distributor.accountName ?? null
        } else {
          updateData.distributorAccountIdSnapshot = null
          updateData.distributorNameSnapshot = null
        }
      }

      if (
        ("vendorAccountId" in payload || "distributorAccountId" in payload) &&
        existingLineItem.opportunity
      ) {
        const anyExisting = existingLineItem as any
        const nextPair = {
          distributorAccountId:
            ("distributorAccountId" in payload
              ? updateData.distributorAccountIdSnapshot ?? null
              : anyExisting.distributorAccountIdSnapshot ?? existingLineItem.product?.distributorAccountId ?? null),
          vendorAccountId:
            ("vendorAccountId" in payload
              ? updateData.vendorAccountIdSnapshot ?? null
              : anyExisting.vendorAccountIdSnapshot ?? existingLineItem.product?.vendorAccountId ?? null)
        }

        await assertVendorDistributorConsistentForOpportunity(
          prisma,
          tenantId,
          existingLineItem.opportunity.id,
          nextPair
        )
      }

      if ("quantity" in payload) {
        const quantityNumber = parseNumberInput(payload.quantity)
        if (quantityNumber === null || quantityNumber <= 0) {
          return NextResponse.json({ error: "Quantity must be a positive number" }, { status: 400 })
        }
        updateData.quantity = decimalFromNumber(quantityNumber)
      }

      if ("unitPrice" in payload) {
        updateData.unitPrice = decimalFromNumber(parseNumberInput(payload.unitPrice))
      }

      if ("expectedUsage" in payload) {
        updateData.expectedUsage = decimalFromNumber(parseNumberInput(payload.expectedUsage))
      }

      if ("expectedRevenue" in payload) {
        let expectedRevenueNumber = parseNumberInput(payload.expectedRevenue)

        if (
          expectedRevenueNumber === null &&
          ("quantity" in payload || "unitPrice" in payload)
        ) {
          const quantityNumber =
            "quantity" in payload
              ? parseNumberInput(payload.quantity)
              : existingLineItem.quantity
                ? Number(existingLineItem.quantity)
                : null

          const unitPriceNumber =
            "unitPrice" in payload
              ? parseNumberInput(payload.unitPrice)
              : existingLineItem.unitPrice
                ? Number(existingLineItem.unitPrice)
                : null

          if (quantityNumber !== null && unitPriceNumber !== null) {
            expectedRevenueNumber = Number((quantityNumber * unitPriceNumber).toFixed(2))
          }
        }

        updateData.expectedRevenue = decimalFromNumber(expectedRevenueNumber)
      }

      if ("expectedCommission" in payload) {
        updateData.expectedCommission = decimalFromNumber(
          parseNumberInput(payload.expectedCommission)
        )
      }

      if ("revenueStartDate" in payload) {
        updateData.revenueStartDate = parseDateInput(payload.revenueStartDate)
      }

      if ("revenueEndDate" in payload) {
        updateData.revenueEndDate = parseDateInput(payload.revenueEndDate)
      }

      if ("status" in payload) {
        if (!isValidProductStatus(payload.status)) {
          return NextResponse.json({ error: "Invalid product status" }, { status: 400 })
        }
        statusUpdate = payload.status
      }

      if ("active" in payload) {
        if (typeof payload.active !== "boolean") {
          return NextResponse.json({ error: "Active must be a boolean value" }, { status: 400 })
        }
        activeUpdate = payload.active
      }

      if (Object.keys(updateData).length === 0 && activeUpdate === undefined && statusUpdate === undefined) {
        return NextResponse.json({ error: "No updates provided" }, { status: 400 })
      }

      const finalData: any = { ...updateData }
      if (activeUpdate !== undefined) {
        finalData.active = activeUpdate
      }
      if (statusUpdate !== undefined) {
        finalData.status = statusUpdate
      }

      const previousValues = {
        productCode: existingLineItem.productCodeSnapshot,
        productNameHouse: existingLineItem.productNameHouseSnapshot,
        productNameVendor: existingLineItem.productNameVendorSnapshot,
        description: (existingLineItem as any).descriptionSnapshot ?? null,
        revenueType: existingLineItem.revenueTypeSnapshot,
        priceEach: existingLineItem.priceEachSnapshot ?? null,
        commissionPercent: existingLineItem.commissionPercentSnapshot ?? null,
        distributorAccountId: (existingLineItem as any).distributorAccountIdSnapshot ?? null,
        vendorAccountId: (existingLineItem as any).vendorAccountIdSnapshot ?? null,
        distributorName: existingLineItem.distributorNameSnapshot ?? null,
        vendorName: existingLineItem.vendorNameSnapshot ?? null,
        productFamilyHouse: (existingLineItem as any).productFamilyHouseSnapshot ?? null,
        productSubtypeHouse: (existingLineItem as any).productSubtypeHouseSnapshot ?? null,
        productFamilyVendor: (existingLineItem as any).productFamilyVendorSnapshot ?? null,
        productSubtypeVendor: (existingLineItem as any).productSubtypeVendorSnapshot ?? null,
        productNameDistributor: (existingLineItem as any).productNameDistributorSnapshot ?? null,
        partNumberVendor: (existingLineItem as any).partNumberVendorSnapshot ?? null,
        partNumberDistributor: (existingLineItem as any).partNumberDistributorSnapshot ?? null,
        distributorProductFamily: (existingLineItem as any).distributorProductFamilySnapshot ?? null,
        distributorProductSubtype: (existingLineItem as any).distributorProductSubtypeSnapshot ?? null,
        productDescriptionVendor: (existingLineItem as any).productDescriptionVendorSnapshot ?? null,
        productDescriptionDistributor: (existingLineItem as any).productDescriptionDistributorSnapshot ?? null,
        isActive: existingLineItem.active !== false
      }

      const updatedLineItem = await prisma.opportunityProduct.update({
        where: { id: existingLineItem.id },
        data: finalData,
        include: {
          product: {
            select: {
              id: true,
              productNameHouse: true,
              productNameVendor: true,
              productCode: true,
              revenueType: true,
              priceEach: true,
              distributor: { select: { id: true, accountName: true } },
              vendor: { select: { id: true, accountName: true } }
            }
          }
        }
      })

      const newValues = {
        productCode: updatedLineItem.productCodeSnapshot,
        productNameHouse: updatedLineItem.productNameHouseSnapshot,
        productNameVendor: updatedLineItem.productNameVendorSnapshot,
        description: (updatedLineItem as any).descriptionSnapshot ?? null,
        revenueType: updatedLineItem.revenueTypeSnapshot,
        priceEach: updatedLineItem.priceEachSnapshot ?? null,
        commissionPercent: updatedLineItem.commissionPercentSnapshot ?? null,
        distributorAccountId: (updatedLineItem as any).distributorAccountIdSnapshot ?? null,
        vendorAccountId: (updatedLineItem as any).vendorAccountIdSnapshot ?? null,
        distributorName: updatedLineItem.distributorNameSnapshot ?? null,
        vendorName: updatedLineItem.vendorNameSnapshot ?? null,
        productFamilyHouse: (updatedLineItem as any).productFamilyHouseSnapshot ?? null,
        productSubtypeHouse: (updatedLineItem as any).productSubtypeHouseSnapshot ?? null,
        productFamilyVendor: (updatedLineItem as any).productFamilyVendorSnapshot ?? null,
        productSubtypeVendor: (updatedLineItem as any).productSubtypeVendorSnapshot ?? null,
        productNameDistributor: (updatedLineItem as any).productNameDistributorSnapshot ?? null,
        partNumberVendor: (updatedLineItem as any).partNumberVendorSnapshot ?? null,
        partNumberDistributor: (updatedLineItem as any).partNumberDistributorSnapshot ?? null,
        distributorProductFamily: (updatedLineItem as any).distributorProductFamilySnapshot ?? null,
        distributorProductSubtype: (updatedLineItem as any).distributorProductSubtypeSnapshot ?? null,
        productDescriptionVendor: (updatedLineItem as any).productDescriptionVendorSnapshot ?? null,
        productDescriptionDistributor: (updatedLineItem as any).productDescriptionDistributorSnapshot ?? null,
        isActive: updatedLineItem.active !== false
      }

      await logOpportunityProductAudit(
        AuditAction.Update,
        updatedLineItem.id,
        req.user.id,
        tenantId,
        request,
        previousValues,
        newValues
      )

      await revalidateOpportunityPaths(existingLineItem.opportunity?.accountId ?? null)
      if (existingLineItem.opportunity) {
        try {
          await recalculateOpportunityStage(existingLineItem.opportunity.id)
        } catch (error) {
          console.error("Failed to recalculate opportunity stage after line item update", error)
        }
      }

      return NextResponse.json({ data: mapOpportunityProductToDetail(updatedLineItem) })
    } catch (error: any) {
      if (
        error &&
        typeof error === "object" &&
        (error as any).code === "OPPORTUNITY_VENDOR_DISTRIBUTOR_MISMATCH"
      ) {
        return NextResponse.json(
          { error: "Cannot have more than one Distributor/Vendor on the same Opportunity." },
          { status: 400 }
        )
      }

      console.error("Failed to update opportunity line item", error)
      return NextResponse.json(
        { error: "Failed to update opportunity line item" },
        { status: 500 }
      )
    }
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { lineItemId: string } }
) {
  return withPermissions(request, OPPORTUNITY_LINE_ITEM_EDIT_PERMISSIONS, async req => {
    try {
      const { lineItemId } = params
      if (!lineItemId) {
        return NextResponse.json({ error: "Line item id is required" }, { status: 400 })
      }

      const tenantId = req.user.tenantId

      const existingLineItem = await prisma.opportunityProduct.findFirst({
        where: { id: lineItemId, tenantId },
        include: {
          opportunity: { select: { id: true, accountId: true, ownerId: true } }
        }
      })

      if (!existingLineItem) {
        return NextResponse.json({ error: "Line item not found" }, { status: 404 })
      }

      const canEditAny = hasAnyPermission(req.user, OPPORTUNITY_LINE_ITEM_EDIT_ANY_PERMISSIONS)
      const canEditAssigned = hasAnyPermission(
        req.user,
        OPPORTUNITY_LINE_ITEM_EDIT_ASSIGNED_PERMISSIONS
      )

      if (!canEditAny) {
        if (!canEditAssigned || existingLineItem.opportunity?.ownerId !== req.user.id) {
          return NextResponse.json(
            { error: "Insufficient permissions to modify this opportunity" },
            { status: 403 }
          )
        }
      }

      // Ensure no monies have been applied to related revenue schedules before deleting.
      const relatedSchedules = await prisma.revenueSchedule.findMany({
        where: { tenantId, opportunityProductId: existingLineItem.id },
        select: {
          id: true,
          scheduleNumber: true,
          actualUsage: true,
          actualUsageAdjustment: true,
          actualCommission: true,
          actualCommissionAdjustment: true
        }
      })

      const scheduleIds = relatedSchedules.map(s => s.id)

      if (scheduleIds.length > 0) {
        const [matchCount, reconCount, primaryDepositCount] = await Promise.all([
          prisma.depositLineMatch.count({ where: { tenantId, revenueScheduleId: { in: scheduleIds } } }),
          prisma.reconciliationItem.count({ where: { tenantId, revenueScheduleId: { in: scheduleIds } } }),
          prisma.depositLineItem.count({ where: { tenantId, primaryRevenueScheduleId: { in: scheduleIds } } })
        ])

        const blockingSchedule = relatedSchedules.find(schedule => {
          const usage = Number(schedule.actualUsage ?? 0)
          const usageAdj = Number(schedule.actualUsageAdjustment ?? 0)
          const commission = Number(schedule.actualCommission ?? 0)
          const commissionAdj = Number(schedule.actualCommissionAdjustment ?? 0)
          const hasAppliedMonies =
            (Number.isFinite(usage) && Math.abs(usage) > 0.0001) ||
            (Number.isFinite(usageAdj) && Math.abs(usageAdj) > 0.0001) ||
            (Number.isFinite(commission) && Math.abs(commission) > 0.0001) ||
            (Number.isFinite(commissionAdj) && Math.abs(commissionAdj) > 0.0001)
          return hasAppliedMonies
        })

        if (blockingSchedule || matchCount > 0 || reconCount > 0 || primaryDepositCount > 0) {
          const label = blockingSchedule?.scheduleNumber ?? blockingSchedule?.id ?? relatedSchedules[0]?.scheduleNumber ?? relatedSchedules[0]?.id
          const reason =
            blockingSchedule && (Number(blockingSchedule.actualUsage ?? 0) !== 0 || Number(blockingSchedule.actualCommission ?? 0) !== 0)
              ? "has applied monies"
              : matchCount > 0
                ? "has deposit matches"
                : reconCount > 0
                  ? "has reconciliation items"
                  : "has linked deposit lines"
          return NextResponse.json(
            { error: `Cannot delete product because revenue schedule ${label} ${reason}.` },
            { status: 409 }
          )
        }
      }

      await prisma.$transaction(async tx => {
        if (scheduleIds.length > 0) {
          // Remove non-monetary dependents to satisfy FKs
          await tx.activity.deleteMany({ where: { tenantId, revenueScheduleId: { in: scheduleIds } } })
          await tx.ticket.deleteMany({ where: { tenantId, revenueScheduleId: { in: scheduleIds } } })
          await tx.depositLineMatch.deleteMany({ where: { tenantId, revenueScheduleId: { in: scheduleIds } } })
          await tx.reconciliationItem.deleteMany({ where: { tenantId, revenueScheduleId: { in: scheduleIds } } })
          await tx.depositLineItem.updateMany({
            where: { tenantId, primaryRevenueScheduleId: { in: scheduleIds } },
            data: { primaryRevenueScheduleId: null }
          })

          await tx.revenueSchedule.deleteMany({
            where: { tenantId, id: { in: scheduleIds } }
          })
        }

        await tx.opportunityProduct.delete({
          where: { id: existingLineItem.id }
        })
      })

      await revalidateOpportunityPaths(existingLineItem.opportunity?.accountId ?? null)
      if (existingLineItem.opportunity) {
        try {
          await recalculateOpportunityStage(existingLineItem.opportunity.id)
        } catch (error) {
          console.error("Failed to recalculate opportunity stage after line item delete", error)
        }
      }

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Failed to delete opportunity line item", error)
      return NextResponse.json(
        { error: "Failed to delete opportunity line item" },
        { status: 500 }
      )
    }
  })
}
