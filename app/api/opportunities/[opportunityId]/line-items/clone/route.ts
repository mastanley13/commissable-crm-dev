import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { hasAnyPermission } from "@/lib/auth"
import { revalidateOpportunityPaths } from "../../../revalidate"
import { recalculateOpportunityStage } from "@/lib/opportunities/stage"
import { OpportunityProductStatus } from "@prisma/client"

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

      const rawIds = Array.isArray((payload as any)?.lineItemIds) ? (payload as any).lineItemIds : []
      const lineItemIds: string[] = rawIds
        .map((value: unknown) => (typeof value === "string" ? value.trim() : ""))
        .filter((value: string) => value.length > 0)

      if (lineItemIds.length === 0) {
        return NextResponse.json(
          { error: "At least one line item id is required" },
          { status: 400 }
        )
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

      const sourceLineItems = await prisma.opportunityProduct.findMany({
        where: {
          tenantId,
          opportunityId: existingOpportunity.id,
          id: { in: lineItemIds }
        }
      })

      if (sourceLineItems.length === 0) {
        return NextResponse.json(
          { error: "No matching line items found for this opportunity" },
          { status: 404 }
        )
      }

      await prisma.$transaction(async tx => {
        for (const src of sourceLineItems) {
          await tx.opportunityProduct.create({
            data: {
              tenantId: src.tenantId,
              opportunityId: src.opportunityId,
              productId: src.productId,
              productCodeSnapshot: src.productCodeSnapshot,
              productNameHouseSnapshot: src.productNameHouseSnapshot,
              productNameVendorSnapshot: src.productNameVendorSnapshot,
              revenueTypeSnapshot: src.revenueTypeSnapshot,
              priceEachSnapshot: src.priceEachSnapshot,
              commissionPercentSnapshot: src.commissionPercentSnapshot,
              distributorNameSnapshot: src.distributorNameSnapshot,
              vendorNameSnapshot: src.vendorNameSnapshot,
              quantity: src.quantity,
              unitPrice: src.unitPrice,
              expectedUsage: src.expectedUsage,
              expectedRevenue: src.expectedRevenue,
              expectedCommission: src.expectedCommission,
              revenueStartDate: src.revenueStartDate,
              revenueEndDate: src.revenueEndDate,
              active: src.active,
              status: src.status ?? OpportunityProductStatus.Provisioning
            }
          })
        }
      })

      await revalidateOpportunityPaths(existingOpportunity.accountId ?? null)
      try {
        await recalculateOpportunityStage(existingOpportunity.id)
      } catch (error) {
        console.error("Failed to recalculate opportunity stage after line item clone", error)
      }

      return NextResponse.json({ success: true, clonedCount: sourceLineItems.length })
    } catch (error) {
      console.error("Failed to clone opportunity line items", error)
      return NextResponse.json(
        { error: "Failed to clone opportunity line items" },
        { status: 500 }
      )
    }
  })
}

