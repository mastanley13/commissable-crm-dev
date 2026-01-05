import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { ensureNoneDirectDistributorAccount } from "@/lib/none-direct-distributor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const OPPORTUNITY_VENDOR_DISTRIBUTOR_VIEW_PERMISSIONS = [
  "opportunities.edit.all",
  "opportunities.edit.assigned",
  "opportunities.manage",
  "accounts.manage",
  "accounts.update",
]

type CanonicalVendorDistributor = {
  locked: boolean
  distributorAccountId: string | null
  distributorName: string | null
  vendorAccountId: string | null
  vendorName: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: { opportunityId: string } }
) {
  return withPermissions(request, OPPORTUNITY_VENDOR_DISTRIBUTOR_VIEW_PERMISSIONS, async (req) => {
    try {
      const { opportunityId } = params
      if (!opportunityId) {
        return NextResponse.json({ error: "Opportunity id is required" }, { status: 400 })
      }

      const tenantId = req.user.tenantId

      const exists = await prisma.opportunity.findFirst({
        where: { id: opportunityId, tenantId },
        select: { id: true },
      })

      if (!exists) {
        return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
      }

      const lineItems = await prisma.opportunityProduct.findMany({
        where: { tenantId, opportunityId },
        select: {
          product: {
            select: {
              distributorAccountId: true,
              vendorAccountId: true,
              distributor: { select: { accountName: true } },
              vendor: { select: { accountName: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 50,
      })

      let canonical: CanonicalVendorDistributor | null = null

      for (const item of lineItems) {
        const distributorAccountId = item.product?.distributorAccountId ?? null
        const vendorAccountId = item.product?.vendorAccountId ?? null

        if (!distributorAccountId && !vendorAccountId) {
          continue
        }

        let effectiveDistributorAccountId = distributorAccountId
        let distributorName = item.product?.distributor?.accountName ?? null

        if (!effectiveDistributorAccountId && vendorAccountId) {
          const noneDirect = await ensureNoneDirectDistributorAccount(tenantId)
          effectiveDistributorAccountId = noneDirect.id
          distributorName = noneDirect.accountName
        }

        canonical = {
          locked: true,
          distributorAccountId: effectiveDistributorAccountId,
          distributorName,
          vendorAccountId,
          vendorName: item.product?.vendor?.accountName ?? null,
        }
        break
      }

      if (!canonical) {
        return NextResponse.json({
          data: {
            locked: false,
            distributorAccountId: null,
            distributorName: null,
            vendorAccountId: null,
            vendorName: null,
          } satisfies CanonicalVendorDistributor,
        })
      }

      return NextResponse.json({ data: canonical })
    } catch (error) {
      console.error("Failed to load opportunity vendor/distributor context", error)
      return NextResponse.json(
        { error: "Failed to load opportunity vendor/distributor context" },
        { status: 500 }
      )
    }
  })
}

