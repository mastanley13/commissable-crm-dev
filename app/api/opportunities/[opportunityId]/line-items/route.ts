import { NextRequest, NextResponse } from "next/server"
import { Prisma, OpportunityProductStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { hasAnyPermission } from "@/lib/auth"
import { mapOpportunityProductToDetail } from "../../helpers"
import { revalidateOpportunityPaths } from "../../revalidate"
import { recalculateOpportunityStage } from "@/lib/opportunities/stage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

export async function POST(
  request: NextRequest,
  { params }: { params: { opportunityId: string } }
) {
  return withPermissions(request, OPPORTUNITY_LINE_ITEM_EDIT_PERMISSIONS, async req => {
    try {
      const { opportunityId } = params
      if (!opportunityId) {
        return NextResponse.json({ error: "Opportunity id is required" }, { status: 400 })
      }

      const tenantId = req.user.tenantId
      const payload = await request.json().catch(() => null)

      if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const productId = typeof payload.productId === "string" ? payload.productId.trim() : ""
      if (!productId) {
        return NextResponse.json({ error: "Product is required" }, { status: 400 })
      }

      const quantityNumber = parseNumberInput(payload.quantity)
      if (quantityNumber === null || quantityNumber <= 0) {
        return NextResponse.json({ error: "Quantity must be a positive number" }, { status: 400 })
      }

      const unitPriceNumber = parseNumberInput(payload.unitPrice)
      const expectedUsageNumber = parseNumberInput(payload.expectedUsage)
      let expectedRevenueNumber = parseNumberInput(payload.expectedRevenue)
      const expectedCommissionNumber = parseNumberInput(payload.expectedCommission)

      if (
        expectedRevenueNumber === null &&
        quantityNumber !== null &&
        unitPriceNumber !== null
      ) {
        expectedRevenueNumber = Number((quantityNumber * unitPriceNumber).toFixed(2))
      }

      const existingOpportunity = await prisma.opportunity.findFirst({
        where: { id: opportunityId, tenantId },
        select: { id: true, accountId: true, ownerId: true }
      })

      if (!existingOpportunity) {
        return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
      }

      const canEditAny = hasAnyPermission(req.user, OPPORTUNITY_LINE_ITEM_EDIT_ANY_PERMISSIONS)
      const canEditAssigned = hasAnyPermission(
        req.user,
        OPPORTUNITY_LINE_ITEM_EDIT_ASSIGNED_PERMISSIONS
      )

      if (!canEditAny) {
        if (!canEditAssigned || existingOpportunity.ownerId !== req.user.id) {
          return NextResponse.json(
            { error: "Insufficient permissions to modify this opportunity" },
            { status: 403 }
          )
        }
      }

      const product = await prisma.product.findFirst({
        where: { id: productId, tenantId },
        select: { id: true }
      })

      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 })
      }

      let statusValue: OpportunityProductStatus | undefined
      if ("status" in payload) {
        if (!isValidProductStatus(payload.status)) {
          return NextResponse.json({ error: "Invalid product status" }, { status: 400 })
        }
        statusValue = payload.status
      }

      const lineItem = await prisma.opportunityProduct.create({
        data: {
          tenantId,
          opportunityId: existingOpportunity.id,
          productId: product.id,
          quantity: decimalFromNumber(quantityNumber),
          unitPrice: decimalFromNumber(unitPriceNumber),
          expectedUsage: decimalFromNumber(expectedUsageNumber),
          expectedRevenue: decimalFromNumber(expectedRevenueNumber),
          expectedCommission: decimalFromNumber(expectedCommissionNumber),
          revenueStartDate: parseDateInput(payload.revenueStartDate),
          revenueEndDate: parseDateInput(payload.revenueEndDate),
          ...(statusValue ? { status: statusValue } : {})
        },
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

      await revalidateOpportunityPaths(existingOpportunity.accountId ?? null)
      try {
        await recalculateOpportunityStage(existingOpportunity.id)
      } catch (error) {
        console.error("Failed to recalculate opportunity stage after line item create", error)
      }

      return NextResponse.json({ data: mapOpportunityProductToDetail(lineItem) }, { status: 201 })
    } catch (error) {
      console.error("Failed to create opportunity line item", error)
      return NextResponse.json(
        { error: "Failed to create opportunity line item" },
        { status: 500 }
      )
    }
  })
}
