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

function getSeriesBaseName(originalNumber?: string | null): string | null {
  if (!originalNumber) return null
  const trimmed = originalNumber.trim()
  if (!trimmed) return null

  const copyMatch = trimmed.match(/^(.*)\s+\(copy.*\)$/i)
  if (copyMatch && copyMatch[1]) {
    return copyMatch[1].trim()
  }

  const dashIndexMatch = trimmed.match(/^(.*)\s-\s\d+$/)
  if (dashIndexMatch && dashIndexMatch[1]) {
    return dashIndexMatch[1].trim()
  }

  return trimmed
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

      const rawBody = await request.text()
      let parsed: any = null
      if (rawBody) {
        try {
          parsed = JSON.parse(rawBody)
        } catch {
          // Ignore malformed JSON and fall back to defaults
        }
      }

      const rawMode = typeof parsed?.mode === "string" ? parsed.mode : null
      const mode: "clone" | "copyExtend" = rawMode === "copyExtend" ? "copyExtend" : "clone"

      // Parse effectiveDate
      let effectiveDate: Date | null = source.scheduleDate ?? null
      const dateInput = typeof parsed?.effectiveDate === "string" ? parsed.effectiveDate.trim() : ""
      if (dateInput) {
        const candidate = new Date(dateInput)
        if (!Number.isNaN(candidate.getTime())) {
          effectiveDate = candidate
        }
      }

      // Parse months
      let months = 1
      const rawMonths = parsed?.months
      const parsedMonths =
        typeof rawMonths === "string"
          ? Number.parseInt(rawMonths, 10)
          : typeof rawMonths === "number"
            ? rawMonths
            : NaN
      if (Number.isFinite(parsedMonths)) {
        months = parsedMonths
      }

      // Parse scheduleNumber override
      let scheduleNumberOverride: string | null = null
      if (parsed?.scheduleNumber && typeof parsed.scheduleNumber === "string") {
        const trimmed = parsed.scheduleNumber.trim()
        if (trimmed) {
          scheduleNumberOverride = trimmed
        }
      }

      // Parse quantity override
      let quantity: number | null = null
      if (parsed?.quantity !== undefined && parsed.quantity !== null) {
        const parsedQty =
          typeof parsed.quantity === "string"
            ? Number.parseFloat(parsed.quantity)
            : typeof parsed.quantity === "number"
              ? parsed.quantity
              : NaN
        if (Number.isFinite(parsedQty) && parsedQty > 0) {
          quantity = parsedQty
        } else if (Number.isFinite(parsedQty) && parsedQty <= 0) {
          return NextResponse.json({ error: "Quantity must be greater than 0" }, { status: 400 })
        }
      }

      // Parse unitPrice override
      let unitPrice: number | null = null
      if (parsed?.unitPrice !== undefined && parsed.unitPrice !== null) {
        const parsedPrice =
          typeof parsed.unitPrice === "string"
            ? Number.parseFloat(parsed.unitPrice)
            : typeof parsed.unitPrice === "number"
              ? parsed.unitPrice
              : NaN
        if (Number.isFinite(parsedPrice) && parsedPrice >= 0) {
          unitPrice = parsedPrice
        } else if (Number.isFinite(parsedPrice) && parsedPrice < 0) {
          return NextResponse.json({ error: "Unit price cannot be negative" }, { status: 400 })
        }
      }

      // Parse usageAdjustment override
      let usageAdjustment: number | null = null
      if (parsed?.usageAdjustment !== undefined && parsed.usageAdjustment !== null) {
        const parsedAdj =
          typeof parsed.usageAdjustment === "string"
            ? Number.parseFloat(parsed.usageAdjustment)
            : typeof parsed.usageAdjustment === "number"
              ? parsed.usageAdjustment
              : NaN
        if (Number.isFinite(parsedAdj)) {
          usageAdjustment = parsedAdj
        }
      }

      if (!effectiveDate) {
        effectiveDate = source.scheduleDate ?? new Date()
      }

      if (!Number.isFinite(months) || months < 1) {
        months = 1
      }

      // Cap months defensively to avoid runaway clones
      if (months > 60) {
        months = 60
      }

      let scheduleNumber: string | null = null

      if (mode === "clone") {
        scheduleNumber = scheduleNumberOverride ?? buildCloneScheduleNumber(source.scheduleNumber)
      } else {
        const baseName = getSeriesBaseName(scheduleNumberOverride ?? source.scheduleNumber)

        if (baseName) {
          const where: Prisma.RevenueScheduleWhereInput = {
            tenantId,
            scheduleNumber: { startsWith: baseName },
          }

          if (source.opportunityProductId) {
            where.opportunityProductId = source.opportunityProductId
          }

          const siblings = await prisma.revenueSchedule.findMany({
            where,
            select: { scheduleNumber: true },
          })

          let maxIndex = 0
          const suffixPattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s-\\s(\\d+)$`)

          for (const sibling of siblings) {
            const name = sibling.scheduleNumber?.trim()
            if (!name) continue
            const match = name.match(suffixPattern)
            if (match && match[1]) {
              const n = Number.parseInt(match[1], 10)
              if (Number.isFinite(n) && n > maxIndex) {
                maxIndex = n
              }
            }
          }

          const nextIndex = maxIndex + 1
          const padded = String(nextIndex).padStart(3, "0")
          scheduleNumber = `${baseName} - ${padded}`
        } else {
          scheduleNumber = scheduleNumberOverride ?? source.scheduleNumber ?? null
        }
      }

      const clones = await prisma.$transaction(async tx => {
        const results: RevenueScheduleWithRelations[] = []

        // Fetch related data if we need to recalculate
        let opportunityProduct = null
        let product = null
        if (quantity !== null || unitPrice !== null) {
          if (source.opportunityProductId) {
            opportunityProduct = await tx.opportunityProduct.findUnique({
              where: { id: source.opportunityProductId },
              select: {
                quantity: true,
                unitPrice: true,
                expectedUsage: true,
                expectedCommission: true,
              },
            })
          }
          if (source.productId) {
            product = await tx.product.findUnique({
              where: { id: source.productId },
              select: {
                priceEach: true,
                commissionPercent: true,
              },
            })
          }
        }

        // Calculate expectedUsage and expectedCommission with overrides
        let finalExpectedUsage = source.expectedUsage
        let finalUsageAdjustment = usageAdjustment !== null ? usageAdjustment : source.usageAdjustment
        let finalExpectedCommission = source.expectedCommission

        if (quantity !== null || unitPrice !== null) {
          // Get effective quantity and unit price
          const effectiveQuantity = quantity ?? (opportunityProduct?.quantity ? Number(opportunityProduct.quantity) : 0)
          const effectiveUnitPrice = unitPrice ?? (opportunityProduct?.unitPrice ? Number(opportunityProduct.unitPrice) : product?.priceEach ? Number(product.priceEach) : 0)
          const effectiveAdjustment = finalUsageAdjustment ? Number(finalUsageAdjustment) : 0

          // Recalculate expectedUsage: quantity * unitPrice + adjustment
          const baseUsage = effectiveQuantity * effectiveUnitPrice
          const calculatedExpectedUsage = baseUsage + effectiveAdjustment

          // Recalculate expectedCommission using commission rate
          const commissionRate = product?.commissionPercent ? Number(product.commissionPercent) / 100 : 0
          const calculatedExpectedCommission = calculatedExpectedUsage * commissionRate

          // Convert to Prisma Decimal
          finalExpectedUsage = new Prisma.Decimal(calculatedExpectedUsage)
          finalExpectedCommission = new Prisma.Decimal(calculatedExpectedCommission)
        }

        for (let i = 0; i < months; i++) {
          const scheduleDate =
            i === 0
              ? effectiveDate
              : new Date(
                  Date.UTC(
                    effectiveDate.getUTCFullYear(),
                    effectiveDate.getUTCMonth() + i,
                    effectiveDate.getUTCDate(),
                  ),
                )

          const created = await tx.revenueSchedule.create({
            data: {
              tenantId,
              accountId: source.accountId,
              opportunityId: source.opportunityId,
              opportunityProductId: source.opportunityProductId,
              productId: source.productId,
              distributorAccountId: source.distributorAccountId,
              vendorAccountId: source.vendorAccountId,
              scheduleNumber: scheduleNumber,
              scheduleDate,
              scheduleType: source.scheduleType,
              expectedUsage: finalExpectedUsage,
              usageAdjustment: finalUsageAdjustment,
              expectedCommission: finalExpectedCommission,
              orderIdHouse: source.orderIdHouse,
              distributorOrderId: source.distributorOrderId,
              notes: source.notes,
              status: RevenueScheduleStatus.Unreconciled,
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

          results.push(created as RevenueScheduleWithRelations)
        }

        return results
      })

      const primary = clones[0]
      const detail = mapRevenueScheduleToDetail(primary)
      return NextResponse.json(
        {
          data: detail,
          meta: { createdCount: clones.length },
        },
        { status: 201 },
      )
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
