import { NextRequest, NextResponse } from "next/server"
import { Prisma, RevenueScheduleStatus } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { mapRevenueScheduleToDetail, type RevenueScheduleWithRelations } from "../../helpers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const revenueScheduleDetailInclude = {
  account: {
    select: {
      id: true,
      accountName: true,
      accountLegalName: true,
      accountNumber: true,
      shippingAddress: {
        select: {
          line1: true,
          line2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
        },
      },
      billingAddress: {
        select: {
          line1: true,
          line2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
        },
      },
    },
  },
  distributor: {
    select: {
      id: true,
      accountName: true,
      accountNumber: true,
    },
  },
  vendor: {
    select: {
      id: true,
      accountName: true,
      accountNumber: true,
    },
  },
  product: {
    select: {
      id: true,
      productNameVendor: true,
      productDescriptionVendor: true,
      revenueType: true,
      commissionPercent: true,
      priceEach: true,
    },
  },
  opportunityProduct: {
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      expectedUsage: true,
      expectedCommission: true,
    },
  },
  opportunity: {
    select: {
      id: true,
      name: true,
      orderIdHouse: true,
      orderIdVendor: true,
      orderIdDistributor: true,
      customerIdHouse: true,
      customerIdVendor: true,
      customerIdDistributor: true,
      locationId: true,
      houseSplitPercent: true,
      houseRepPercent: true,
      subagentPercent: true,
      distributorName: true,
      vendorName: true,
      billingAddress: true,
      shippingAddress: true,
      description: true,
    },
  },
} satisfies Prisma.RevenueScheduleInclude

function buildCloneScheduleNumber(originalNumber?: string | null): string | null {
  if (!originalNumber) return null
  const trimmed = originalNumber.trim()
  if (!trimmed) return null
  if (trimmed.toLowerCase().endsWith("(copy)")) {
    return trimmed
  }
  return `${trimmed} (Copy)`
}

export async function POST(request: NextRequest, { params }: { params: { revenueScheduleId: string } }) {
  return withPermissions(request, ["revenue-schedules.manage"], async req => {
    try {
      const { revenueScheduleId } = params
      if (!revenueScheduleId) {
        return NextResponse.json({ error: "Revenue schedule id is required" }, { status: 400 })
      }

      const tenantId = req.user.tenantId

      const source = await prisma.revenueSchedule.findFirst({
        where: { id: revenueScheduleId, tenantId },
      })

      if (!source) {
        return NextResponse.json({ error: "Revenue schedule not found" }, { status: 404 })
      }

      const scheduleNumber = buildCloneScheduleNumber(source.scheduleNumber)
      let effectiveDate: Date | null = source.scheduleDate ?? null

      const rawBody = await request.text()
      if (rawBody) {
        try {
          const parsed = JSON.parse(rawBody)
          const input = typeof parsed?.effectiveDate === "string" ? parsed.effectiveDate.trim() : ""
          if (input) {
            const candidate = new Date(input)
            if (!Number.isNaN(candidate.getTime())) {
              effectiveDate = candidate
            }
          }
        } catch {
          // Ignore malformed JSON and fall back to defaults
        }
      }

      const cloned = await prisma.revenueSchedule.create({
        data: {
          tenantId,
          accountId: source.accountId,
          opportunityId: source.opportunityId,
          opportunityProductId: source.opportunityProductId,
          productId: source.productId,
          distributorAccountId: source.distributorAccountId,
          vendorAccountId: source.vendorAccountId,
          scheduleNumber,
          scheduleDate: effectiveDate,
          scheduleType: source.scheduleType,
          expectedUsage: source.expectedUsage,
          usageAdjustment: source.usageAdjustment,
          expectedCommission: source.expectedCommission,
          orderIdHouse: source.orderIdHouse,
          distributorOrderId: source.distributorOrderId,
          notes: source.notes,
          status: RevenueScheduleStatus.Projected,
          isSelected: false,
          createdById: req.user.id,
          updatedById: req.user.id,
          actualUsage: null,
          actualUsageAdjustment: null,
          actualCommission: null,
          actualCommissionAdjustment: null,
        },
        include: revenueScheduleDetailInclude,
      })

      const detail = mapRevenueScheduleToDetail(cloned as RevenueScheduleWithRelations)
      return NextResponse.json({ data: detail }, { status: 201 })
    } catch (error) {
      console.error("Failed to clone revenue schedule", error)
      const message =
        process.env.NODE_ENV === "development" && error instanceof Error
          ? `Unable to clone revenue schedule: ${error.message}`
          : "Unable to clone revenue schedule"
      return NextResponse.json({ error: message }, { status: 500 })
    }
  })
}
