import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { hasAnyPermission } from "@/lib/auth"
import { ensureNoneDirectDistributorAccount } from "@/lib/none-direct-distributor"
import { assertVendorDistributorConsistentForOpportunity } from "@/lib/opportunities/vendor-distributor"

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

      if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const existingOpportunity = await prisma.opportunity.findFirst({
        where: { id: opportunityId, tenantId },
        select: { id: true, ownerId: true }
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

      const getOptionalString = (value: unknown): string | null => {
        if (typeof value !== "string") return null
        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : null
      }

      // Bulk-aware handling: if "items" is present and is an array, validate all of them.
      const items = Array.isArray((payload as any).items) ? (payload as any).items : null

      if (items) {
        let localCanonical:
          | {
              distributorAccountId: string | null
              vendorAccountId: string | null
            }
          | null = null

        for (let index = 0; index < items.length; index += 1) {
          const item = items[index] ?? {}

          let distributorAccountId = getOptionalString((item as any).distributorAccountId)
          const vendorAccountId = getOptionalString((item as any).vendorAccountId)

          if (!distributorAccountId && vendorAccountId) {
            const noneDirect = await ensureNoneDirectDistributorAccount(tenantId)
            distributorAccountId = noneDirect.id
          }

          const pair = {
            distributorAccountId,
            vendorAccountId
          }

          if (!localCanonical) {
            localCanonical = pair
          } else if (
            localCanonical.distributorAccountId !== pair.distributorAccountId ||
            localCanonical.vendorAccountId !== pair.vendorAccountId
          ) {
            return NextResponse.json(
              {
                error:
                  "Cannot have more than one Distributor/Vendor on the same Opportunity.",
                index: index
              },
              { status: 400 }
            )
          }

          await assertVendorDistributorConsistentForOpportunity(
            prisma,
            tenantId,
            existingOpportunity.id,
            pair
          )
        }

        return NextResponse.json({ ok: true })
      }

      // Single-pair validation (existing behavior)
      let distributorAccountId = getOptionalString((payload as any).distributorAccountId)
      const vendorAccountId = getOptionalString((payload as any).vendorAccountId)

      if (!distributorAccountId && vendorAccountId) {
        const noneDirect = await ensureNoneDirectDistributorAccount(tenantId)
        distributorAccountId = noneDirect.id
      }

      await assertVendorDistributorConsistentForOpportunity(
        prisma,
        tenantId,
        existingOpportunity.id,
        {
          distributorAccountId,
          vendorAccountId
        }
      )

      return NextResponse.json({ ok: true })
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

      console.error("Failed to validate vendor/distributor pair for opportunity", error)
      return NextResponse.json(
        { error: "Failed to validate vendor/distributor pair for opportunity" },
        { status: 500 }
      )
    }
  })
}
