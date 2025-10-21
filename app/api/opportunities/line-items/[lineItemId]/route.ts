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

      const updateData: Prisma.OpportunityProductUpdateInput = {}
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
          select: { id: true }
        })

        if (!product) {
          return NextResponse.json({ error: "Product not found" }, { status: 404 })
        }

        updateData.product = { connect: { id: product.id } }
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

      const finalData: Prisma.OpportunityProductUpdateInput = { ...updateData }
      if (activeUpdate !== undefined) {
        ;(finalData as Prisma.OpportunityProductUpdateInput & { active?: boolean }).active = activeUpdate
      }
      if (statusUpdate !== undefined) {
        ;(finalData as Prisma.OpportunityProductUpdateInput & { status?: OpportunityProductStatus }).status = statusUpdate
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

      await revalidateOpportunityPaths(existingLineItem.opportunity?.accountId ?? null)
      if (existingLineItem.opportunity) {
        try {
          await recalculateOpportunityStage(existingLineItem.opportunity.id)
        } catch (error) {
          console.error("Failed to recalculate opportunity stage after line item update", error)
        }
      }

      return NextResponse.json({ data: mapOpportunityProductToDetail(updatedLineItem) })
    } catch (error) {
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

      await prisma.opportunityProduct.delete({
        where: { id: existingLineItem.id }
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
