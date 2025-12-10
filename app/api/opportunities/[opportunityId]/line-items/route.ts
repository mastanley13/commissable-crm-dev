import { NextRequest, NextResponse } from "next/server"
import { Prisma, OpportunityProductStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { hasAnyPermission } from "@/lib/auth"
import { mapOpportunityProductToDetail } from "../../helpers"
import { revalidateOpportunityPaths } from "../../revalidate"
import { recalculateOpportunityStage } from "@/lib/opportunities/stage"
import { generateRevenueScheduleName } from "@/lib/revenue-schedule-number"
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
        select: {
          id: true,
          productCode: true,
          productNameHouse: true,
          productNameVendor: true,
          revenueType: true,
          priceEach: true,
          commissionPercent: true,
          distributorAccountId: true,
          vendorAccountId: true,
          distributor: { select: { id: true, accountName: true } },
          vendor: { select: { id: true, accountName: true } }
        }
      })

      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 })
      }

      let resolvedDistributorAccountId = product.distributorAccountId ?? null
      let resolvedDistributorName = product.distributor?.accountName ?? null

      if (!resolvedDistributorAccountId && product.vendorAccountId) {
        const noneDirect = await ensureNoneDirectDistributorAccount(tenantId)
        resolvedDistributorAccountId = noneDirect.id
        resolvedDistributorName = noneDirect.accountName
      }

      // Enforce single Distributor/Vendor per Opportunity.
      const newPair = {
        distributorAccountId: resolvedDistributorAccountId,
        vendorAccountId: product.vendorAccountId ?? null
      }
      await assertVendorDistributorConsistentForOpportunity(
        prisma,
        tenantId,
        existingOpportunity.id,
        newPair
      )

      let statusValue: OpportunityProductStatus | undefined
      if ("status" in payload) {
        if (!isValidProductStatus(payload.status)) {
          return NextResponse.json({ error: "Invalid product status" }, { status: 400 })
        }
        statusValue = payload.status
      }

      // Optional schedule generation inputs
      const schedulePeriodsRaw = (payload as any).schedulePeriods
      const schedulePeriods = typeof schedulePeriodsRaw === 'number' ? schedulePeriodsRaw : Number(schedulePeriodsRaw)
      const commissionStartDate = parseDateInput((payload as any).commissionStartDate)
      const commissionPercentOverrideRaw = (payload as any).commissionPercent
      const commissionPercentOverride = typeof commissionPercentOverrideRaw === 'number' ? commissionPercentOverrideRaw : Number(commissionPercentOverrideRaw)

      const hasAccountForSchedules = Boolean(existingOpportunity.accountId)
      const wantsSchedules =
        Number.isFinite(schedulePeriods) &&
        (schedulePeriods as number) > 0 &&
        commissionStartDate !== null

      if (wantsSchedules && !hasAccountForSchedules) {
        return NextResponse.json(
          { error: "Cannot generate revenue schedules because the opportunity is missing an account." },
          { status: 400 }
        )
      }

      // perform in a transaction so schedules and line item are in sync
      const lineItem = await prisma.$transaction(async (tx) => {
        if (!product.distributorAccountId && resolvedDistributorAccountId) {
          await tx.product.update({
            where: { id: product.id },
            data: {
              distributorAccountId: resolvedDistributorAccountId,
              updatedById: req.user.id ?? undefined
            }
          })
        }

        const created = await tx.opportunityProduct.create({
          data: {
            tenantId,
            opportunityId: existingOpportunity.id,
            productId: product.id,
            productCodeSnapshot: product.productCode,
            productNameHouseSnapshot: product.productNameHouse,
            productNameVendorSnapshot: product.productNameVendor,
            revenueTypeSnapshot: product.revenueType,
            priceEachSnapshot: product.priceEach,
            commissionPercentSnapshot: product.commissionPercent,
            distributorNameSnapshot: resolvedDistributorName ?? null,
            vendorNameSnapshot: product.vendor?.accountName ?? null,
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

        // Generate revenue schedules if instructed
        const shouldCreateSchedules = wantsSchedules && hasAccountForSchedules
        if (shouldCreateSchedules) {
          try {
            const nPeriods = Number(schedulePeriods)
            // Determine base amounts
            const totalExpectedRevenue = (expectedRevenueNumber ?? (quantityNumber && unitPriceNumber ? Number((quantityNumber * unitPriceNumber).toFixed(2)) : 0)) || 0
            const perPeriodExpectedUsage = nPeriods > 0 ? Number((totalExpectedRevenue / nPeriods).toFixed(2)) : 0
            const commissionPercent = Number.isFinite(commissionPercentOverride) && commissionPercentOverride! >= 0
              ? Number(commissionPercentOverride)
              : (product.commissionPercent !== null && product.commissionPercent !== undefined ? Number(product.commissionPercent) : 0)
            const commissionDecimal = commissionPercent > 1 ? commissionPercent / 100 : commissionPercent

            // Helper to add months preserving first-of-month
            const addMonths = (date: Date, months: number) => {
              const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
              return d
            }

            const scheduleData: Prisma.RevenueScheduleCreateManyInput[] = []
            for (let i = 0; i < nPeriods; i++) {
              const date = addMonths(commissionStartDate!, i)
              const expectedCommissionForPeriod = Number((perPeriodExpectedUsage * commissionDecimal).toFixed(2))
              const scheduleNumber = await generateRevenueScheduleName(tx)
              scheduleData.push({
                tenantId,
                opportunityId: existingOpportunity.id,
                opportunityProductId: created.id,
                accountId: existingOpportunity.accountId!,
                productId: product.id,
                distributorAccountId: resolvedDistributorAccountId ?? null,
                vendorAccountId: product.vendorAccountId ?? null,
                scheduleDate: date,
                expectedUsage: decimalFromNumber(perPeriodExpectedUsage),
                expectedCommission: decimalFromNumber(expectedCommissionForPeriod),
                scheduleNumber
              })
            }

            if (scheduleData.length > 0) {
              await tx.revenueSchedule.createMany({ data: scheduleData })
            }
          } catch (err: any) {
            console.error("Failed to create revenue schedules", {
              message: err?.message,
              accountId: existingOpportunity.accountId,
              schedulePeriods,
              commissionStartDate
            })
            throw err
          }
        }

        return created
      })

      await revalidateOpportunityPaths(existingOpportunity.accountId ?? null)
      try {
        await recalculateOpportunityStage(existingOpportunity.id)
      } catch (error) {
        console.error("Failed to recalculate opportunity stage after line item create", error)
      }

      return NextResponse.json({ data: mapOpportunityProductToDetail(lineItem) }, { status: 201 })
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

      console.error("Failed to create opportunity line item", error)
      return NextResponse.json(
        { error: "Failed to create opportunity line item" },
        { status: 500 }
      )
    }
  })
}
