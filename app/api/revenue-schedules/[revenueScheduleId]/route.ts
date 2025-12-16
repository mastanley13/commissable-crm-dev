import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAuth, withPermissions } from "@/lib/api-auth"
import { mapRevenueScheduleToDetail, type RevenueScheduleWithRelations } from "../helpers"
import { isRevenueTypeCode } from "@/lib/revenue-types"
import { Activity, Ticket, DepositLineMatchStatus, DepositPaymentType } from "@prisma/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function formatDepositPaymentType(value: DepositPaymentType | null | undefined): string | null {
  if (!value) return null
  // Field IDs: 06.02.003 / 06.07.003 (Payment Type)
  switch (value) {
    case DepositPaymentType.ACH:
      return "Bank Transfer"
    case DepositPaymentType.Wire:
      return "Wire Transfer"
    case DepositPaymentType.Check:
      return "Check"
    case DepositPaymentType.CreditCard:
      return "Credit Card"
    case DepositPaymentType.Other:
      return "Other"
    default:
      return String(value)
  }
}

async function getRevenueSchedulePaymentType(tenantId: string, revenueScheduleId: string): Promise<string | null> {
  const matches = await prisma.depositLineMatch.findMany({
    where: {
      tenantId,
      revenueScheduleId,
      status: DepositLineMatchStatus.Applied
    },
    select: {
      depositLineItem: {
        select: {
          deposit: {
            select: {
              paymentType: true
            }
          }
        }
      }
    }
  })

  const values = matches
    .map(match => match.depositLineItem?.deposit?.paymentType ?? null)
    .filter((value): value is DepositPaymentType => Boolean(value))

  const unique = Array.from(new Set(values))
    .map(formatDepositPaymentType)
    .filter((value): value is string => Boolean(value))

  if (unique.length === 0) return null
  if (unique.length === 1) return unique[0]
  return unique.join(", ")
}

async function getRevenueScheduleBillingMonth(tenantId: string, revenueScheduleId: string): Promise<string | null> {
  const matches = await prisma.depositLineMatch.findMany({
    where: {
      tenantId,
      revenueScheduleId,
      status: DepositLineMatchStatus.Applied
    },
    select: {
      depositLineItem: {
        select: {
          deposit: {
            select: {
              month: true
            }
          }
        }
      }
    }
  })

  const months = matches
    .map(match => match.depositLineItem?.deposit?.month ?? null)
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  const first = months[0]
  if (!first) return null
  return first.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest, { params }: { params: { revenueScheduleId: string } }) {
  return withAuth(request, async (req) => {
    try {
      const { revenueScheduleId } = params
      if (!revenueScheduleId) {
        return NextResponse.json({ error: "Revenue schedule id is required" }, { status: 400 })
      }

      const schedule = await prisma.revenueSchedule.findFirst({
        where: {
          id: revenueScheduleId,
          tenantId: req.user.tenantId
        },
        include: {
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
                  country: true
                }
              },
              billingAddress: {
                select: {
                  line1: true,
                  line2: true,
                  city: true,
                  state: true,
                  postalCode: true,
                  country: true
                }
              }
            }
          },
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
          product: {
            select: {
              id: true,
              productNameHouse: true,
              commissionPercent: true,
              priceEach: true
            }
          },
          opportunityProduct: {
            select: {
              id: true,
              productNameHouseSnapshot: true,
              quantity: true,
              unitPrice: true,
              expectedUsage: true,
              expectedCommission: true,
              revenueStartDate: true
            }
          },
          opportunity: {
            select: {
              id: true,
              name: true,
              // orderIdHouse intentionally omitted; use schedule.orderIdHouse instead
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
              owner: {
                select: {
                  fullName: true
                }
              }
            }
          }
        }
      })

      if (!schedule) {
        return NextResponse.json({ error: "Revenue schedule not found" }, { status: 404 })
      }

      const detail = mapRevenueScheduleToDetail(schedule as RevenueScheduleWithRelations)
      // Populate Payment Type from matched deposits, when available.
      detail.paymentType = await getRevenueSchedulePaymentType(req.user.tenantId, revenueScheduleId)
      // Billing Month is derived from the earliest matched deposit month, when available.
      detail.billingMonth = await getRevenueScheduleBillingMonth(req.user.tenantId, revenueScheduleId)

      return NextResponse.json({ data: detail })
    } catch (error) {
      console.error("Failed to load revenue schedule", error)
      return NextResponse.json({ error: "Failed to load revenue schedule" }, { status: 500 })
    }
  })
}

export async function PATCH(request: NextRequest, { params }: { params: { revenueScheduleId: string } }) {
  return withPermissions(request, ["revenue-schedules.manage"], async (req) => {
    try {
      const { revenueScheduleId } = params
      if (!revenueScheduleId) {
        return NextResponse.json({ error: "Revenue schedule id is required" }, { status: 400 })
      }

      const payload = await request.json().catch(() => ({}))
      const tenantId = req.user.tenantId

      // Ensure the schedule exists and belongs to tenant
      const existing = await prisma.revenueSchedule.findFirst({
        where: { id: revenueScheduleId, tenantId },
        include: {
          product: { select: { id: true, priceEach: true, commissionPercent: true } },
          opportunityProduct: { select: { id: true, quantity: true, unitPrice: true } },
          opportunity: { select: { id: true, houseSplitPercent: true, houseRepPercent: true, subagentPercent: true } }
        }
      })

      if (!existing) {
        return NextResponse.json({ error: "Revenue schedule not found" }, { status: 404 })
      }

      const data: Record<string, any> = { updatedById: req.user.id }
      let hasChanges = false
      const errors: Record<string, string> = {}

      const parseNumberInput = (value: string): number | null => {
        const cleaned = value.replace(/[^0-9.-]/g, "")
        const numeric = Number(cleaned)
        return Number.isFinite(numeric) ? numeric : null
      }

      const parsePercentInput = (value: string): number | null => {
        const raw = value.trim()
        if (!raw) return null
        if (raw.endsWith("%")) {
          const num = Number(raw.slice(0, -1).trim())
          return Number.isFinite(num) ? num : null
        }
        const num = Number(raw.replace(/[^0-9.-]/g, ""))
        if (!Number.isFinite(num)) return null
        return num <= 1 ? num * 100 : num
      }

      const getTrimmedInput = (value: unknown): string => {
        if (typeof value === "string") return value.trim()
        if (typeof value === "number" && Number.isFinite(value)) return String(value)
        return ""
      }

      const productId = (existing as any)?.product?.id as string | undefined

      if (typeof (payload as any)?.revenueScheduleName === "string") {
        data.scheduleNumber = (payload as any).revenueScheduleName.trim() || null
        hasChanges = true
      }

      if (typeof (payload as any)?.revenueScheduleDate === "string") {
        const text: string = (payload as any).revenueScheduleDate.trim()
        if (text.length > 0) {
          const date = new Date(text)
          if (Number.isNaN(date.getTime())) {
            errors.revenueScheduleDate = "Invalid date. Use YYYY-MM-DD."
          } else {
            data.scheduleDate = date
            hasChanges = true
          }
        } else {
          data.scheduleDate = null
          hasChanges = true
        }
      }

      if (typeof (payload as any)?.comments === "string") {
        data.notes = (payload as any).comments.trim() || null
        hasChanges = true
      }

      const quantityInput = getTrimmedInput((payload as any)?.quantity)
      const priceEachInput = getTrimmedInput((payload as any)?.priceEach)
      const expectedUsageAdjustmentInput = getTrimmedInput((payload as any)?.expectedUsageAdjustment)
      const expectedCommissionAdjustmentInput = getTrimmedInput((payload as any)?.expectedCommissionAdjustment)

      const quantityValue = quantityInput ? parseNumberInput(quantityInput) : null
      const unitPriceValue = priceEachInput ? parseNumberInput(priceEachInput) : null

      if (quantityInput) {
        if (quantityValue === null) {
          errors.quantity = "Enter a valid number."
        } else if (quantityValue < 0) {
          errors.quantity = "Quantity must be 0 or greater."
        }
      }

      if (priceEachInput) {
        if (unitPriceValue === null) {
          errors.priceEach = "Enter a valid amount."
        } else if (unitPriceValue < 0) {
          errors.priceEach = "Price per must be 0 or greater."
        }
      }

      if (expectedUsageAdjustmentInput) {
        const adjustment = parseNumberInput(expectedUsageAdjustmentInput)
        if (adjustment === null) {
          errors.expectedUsageAdjustment = "Enter a valid amount."
        }
      }

      if (expectedCommissionAdjustmentInput) {
        const adjustment = parseNumberInput(expectedCommissionAdjustmentInput)
        if (adjustment === null) {
          errors.expectedCommissionAdjustment = "Enter a valid amount."
        }
      }

      const expectedRateInput = getTrimmedInput((payload as any)?.expectedCommissionRatePercent)
      const expectedRateValue = expectedRateInput ? parsePercentInput(expectedRateInput) : null
      if (expectedRateInput) {
        if (expectedRateValue === null) {
          errors.expectedCommissionRatePercent = "Enter a valid percent."
        } else if (expectedRateValue < 0 || expectedRateValue > 100) {
          errors.expectedCommissionRatePercent = "Expected rate must be between 0 and 100."
        }
      }

      const houseSplitInput = getTrimmedInput((payload as any)?.houseSplitPercent)
      const houseRepSplitInput = getTrimmedInput((payload as any)?.houseRepSplitPercent)
      const subagentSplitInput = getTrimmedInput((payload as any)?.subagentSplitPercent)

      const houseSplitPercentValue = houseSplitInput ? parsePercentInput(houseSplitInput) : null
      const houseRepSplitPercentValue = houseRepSplitInput ? parsePercentInput(houseRepSplitInput) : null
      const subagentSplitPercentValue = subagentSplitInput ? parsePercentInput(subagentSplitInput) : null

      if (houseSplitInput && houseSplitPercentValue === null) errors.houseSplitPercent = "Enter a valid percent."
      if (houseRepSplitInput && houseRepSplitPercentValue === null) errors.houseRepSplitPercent = "Enter a valid percent."
      if (subagentSplitInput && subagentSplitPercentValue === null) errors.subagentSplitPercent = "Enter a valid percent."

      const anySplitTouched = Boolean(houseSplitInput || houseRepSplitInput || subagentSplitInput)
      if (anySplitTouched) {
        const nextHouse =
          houseSplitPercentValue !== null
            ? houseSplitPercentValue / 100
            : (existing as any)?.opportunity?.houseSplitPercent ?? null
        const nextHouseRep =
          houseRepSplitPercentValue !== null
            ? houseRepSplitPercentValue / 100
            : (existing as any)?.opportunity?.houseRepPercent ?? null
        const nextSubagent =
          subagentSplitPercentValue !== null
            ? subagentSplitPercentValue / 100
            : (existing as any)?.opportunity?.subagentPercent ?? null

        const splits: Array<[string, number | null]> = [
          ["houseSplitPercent", nextHouse],
          ["houseRepSplitPercent", nextHouseRep],
          ["subagentSplitPercent", nextSubagent]
        ]

        for (const [key, value] of splits) {
          if (value === null || typeof value !== "number" || !Number.isFinite(value)) {
            errors[key] = errors[key] ?? "Provide all split percents."
            continue
          }
          if (value < 0 || value > 1) {
            errors[key] = errors[key] ?? "Split percent must be between 0 and 100."
          }
        }

        const total = [nextHouse, nextHouseRep, nextSubagent].reduce((sum, value) => sum + (value ?? 0), 0)
        if (Number.isFinite(total) && Math.abs(total - 1) > 0.0001) {
          const message = "Split total must equal 100%."
          errors.houseSplitPercent = errors.houseSplitPercent ?? message
          errors.houseRepSplitPercent = errors.houseRepSplitPercent ?? message
          errors.subagentSplitPercent = errors.subagentSplitPercent ?? message
        }
      }

      const oppProductId = (existing as any)?.opportunityProduct?.id as string | undefined

      // Update Quantity and Price Per on the Opportunity Product (preferred per-opportunity values).
      // Also recompute expectedUsage/expectedCommission when possible.
      const oppProductData: Record<string, any> = {}

      if (Object.keys(errors).length > 0) {
        return NextResponse.json({ error: "Invalid input", errors }, { status: 400 })
      }

      if (quantityInput && quantityValue !== null && oppProductId) {
        oppProductData.quantity = quantityValue
      }

      if (priceEachInput && unitPriceValue !== null) {
        if (oppProductId) {
          oppProductData.unitPrice = unitPriceValue
        } else if (productId) {
          // Fallback: if there is no opportunity product, update the product default.
          await prisma.product.update({ where: { id: productId }, data: { priceEach: unitPriceValue } })
          hasChanges = true
        }
      }

      const resolvedQuantity =
        quantityValue !== null
          ? quantityValue
          : oppProductId
            ? Number((existing as any)?.opportunityProduct?.quantity ?? NaN)
            : null

      const resolvedUnitPrice =
        unitPriceValue !== null
          ? unitPriceValue
          : oppProductId
            ? Number((existing as any)?.opportunityProduct?.unitPrice ?? NaN)
            : Number((existing as any)?.product?.priceEach ?? NaN)

      if (Number.isFinite(resolvedQuantity as number) && Number.isFinite(resolvedUnitPrice as number)) {
        const expectedUsage = (resolvedQuantity as number) * (resolvedUnitPrice as number)
        data.expectedUsage = expectedUsage

        const commissionPercent = Number((existing as any)?.product?.commissionPercent ?? NaN)
        if (Number.isFinite(commissionPercent)) {
          data.expectedCommission = expectedUsage * (commissionPercent / 100)
          if (oppProductId) {
            oppProductData.expectedCommission = data.expectedCommission
          }
        }

        if (oppProductId) {
          oppProductData.expectedUsage = expectedUsage
        }
      }

      if (oppProductId && Object.keys(oppProductData).length > 0) {
        await prisma.opportunityProduct.update({ where: { id: oppProductId }, data: oppProductData })
        hasChanges = true
      }

      // Expected Usage Adjustment maps to RevenueSchedule.usageAdjustment
      if (expectedUsageAdjustmentInput) {
        const adjustment = parseNumberInput(expectedUsageAdjustmentInput)
        if (adjustment !== null) {
          data.usageAdjustment = adjustment
          hasChanges = true
        }
      }

      // Expected Commission Adjustment maps to RevenueSchedule.actualCommissionAdjustment (current schema field).
      if (expectedCommissionAdjustmentInput) {
        const adjustment = parseNumberInput(expectedCommissionAdjustmentInput)
        if (adjustment !== null) {
          data.actualCommissionAdjustment = adjustment
          hasChanges = true
        }
      }

      if (!hasChanges) {
        // continue; we may still update related entities below
      }

      // Update related Product fields
      if (productId) {
        const productData: Record<string, any> = {}
        if (expectedRateInput && expectedRateValue !== null) {
          productData.commissionPercent = expectedRateValue
        }
        if (Object.keys(productData).length > 0) {
          await prisma.product.update({ where: { id: productId }, data: productData })
          hasChanges = true
        }
      }

      // Update related Opportunity split percents (fractions)
      const oppId = (existing as any)?.opportunity?.id as string | undefined
      if (oppId) {
        const oppData: Record<string, any> = {}
        if (anySplitTouched) {
          if (houseSplitPercentValue !== null) oppData.houseSplitPercent = houseSplitPercentValue / 100
          if (houseRepSplitPercentValue !== null) oppData.houseRepPercent = houseRepSplitPercentValue / 100
          if (subagentSplitPercentValue !== null) oppData.subagentPercent = subagentSplitPercentValue / 100
        }
        if (Object.keys(oppData).length > 0) {
          await prisma.opportunity.update({ where: { id: oppId }, data: oppData })
          hasChanges = true
        }
      }

      // Write schedule changes if present
      if (Object.keys(data).length > 1) {
        await prisma.revenueSchedule.update({ where: { id: revenueScheduleId }, data })
        hasChanges = true
      }

      // No updates detected across schedule, product, or opportunity
      if (!hasChanges) {
        return NextResponse.json({ error: "No changes to apply" }, { status: 400 })
      }

      // Return updated detail payload
      const updated = await prisma.revenueSchedule.findFirst({
        where: { id: revenueScheduleId, tenantId },
        include: {
          account: {
            select: {
              id: true,
              accountName: true,
              accountLegalName: true,
              accountNumber: true,
              shippingAddress: { select: { line1: true, line2: true, city: true, state: true, postalCode: true, country: true } },
              billingAddress: { select: { line1: true, line2: true, city: true, state: true, postalCode: true, country: true } }
            }
          },
          distributor: { select: { id: true, accountName: true, accountNumber: true } },
          vendor: { select: { id: true, accountName: true, accountNumber: true } },
          product: { select: { id: true, productNameHouse: true, commissionPercent: true, priceEach: true } },
          opportunityProduct: { select: { id: true, productNameHouseSnapshot: true, quantity: true, unitPrice: true, expectedUsage: true, expectedCommission: true, revenueStartDate: true } },
          opportunity: { select: { id: true, name: true, orderIdHouse: true, orderIdVendor: true, orderIdDistributor: true, customerIdHouse: true, customerIdVendor: true, customerIdDistributor: true, locationId: true, houseSplitPercent: true, houseRepPercent: true, subagentPercent: true, distributorName: true, vendorName: true, billingAddress: true, shippingAddress: true, description: true, owner: { select: { fullName: true } } } }
        }
      })

      if (!updated) {
        return NextResponse.json({ error: "Revenue schedule not found after update" }, { status: 404 })
      }

      const detail = mapRevenueScheduleToDetail(updated as RevenueScheduleWithRelations)
      detail.paymentType = await getRevenueSchedulePaymentType(tenantId, revenueScheduleId)
      detail.billingMonth = await getRevenueScheduleBillingMonth(tenantId, revenueScheduleId)
      return NextResponse.json({ data: detail })
    } catch (error) {
      console.error("Failed to update revenue schedule", error)
      return NextResponse.json({ error: "Failed to update revenue schedule" }, { status: 500 })
    }
  })
}

export async function DELETE(request: NextRequest, { params }: { params: { revenueScheduleId: string } }) {
  return withAuth(request, async (req) => {
    try {
      const { revenueScheduleId } = params
      if (!revenueScheduleId) {
        return NextResponse.json({ error: "Revenue schedule id is required" }, { status: 400 })
      }

      const roleCode = (req.user.role?.code ?? "").toLowerCase()
      const isAdmin = roleCode === "admin"
      const isAccounting = roleCode === "accounting"

      if (!isAdmin && !isAccounting) {
        return NextResponse.json({ error: "Only Admin or Accounting roles can delete revenue schedules" }, { status: 403 })
      }

      const tenantId = req.user.tenantId

      const schedule = await prisma.revenueSchedule.findFirst({
        where: { id: revenueScheduleId, tenantId },
        select: {
          id: true,
          scheduleNumber: true,
          actualUsage: true,
          actualUsageAdjustment: true,
          actualCommission: true,
          actualCommissionAdjustment: true,
        }
      })

      if (!schedule) {
        return NextResponse.json({ error: "Revenue schedule not found" }, { status: 404 })
      }

      const usageFields = [
        schedule.actualUsage,
        schedule.actualUsageAdjustment,
        schedule.actualCommission,
        schedule.actualCommissionAdjustment
      ]
      const hasAppliedMonies = usageFields.some((val) => {
        if (val === null || val === undefined) return false
        const n = Number(val)
        return Number.isFinite(n) && Math.abs(n) > 0.0001
      })

      const [matchCount, reconCount, primaryDepositCount] = await Promise.all([
        prisma.depositLineMatch.count({ where: { tenantId, revenueScheduleId } }),
        prisma.reconciliationItem.count({ where: { tenantId, revenueScheduleId } }),
        prisma.depositLineItem.count({ where: { tenantId, primaryRevenueScheduleId: revenueScheduleId } })
      ])

      if (hasAppliedMonies || matchCount > 0 || reconCount > 0 || primaryDepositCount > 0) {
        const label = schedule.scheduleNumber ?? schedule.id
        const reason = hasAppliedMonies
          ? "has usage or commission applied"
          : matchCount > 0
            ? "has deposit matches"
            : reconCount > 0
              ? "is in reconciliation"
              : "is linked to deposit lines"

        return NextResponse.json(
          { error: `Cannot delete revenue schedule ${label} because it ${reason}.` },
          { status: 409 }
        )
      }

      await prisma.$transaction(async (tx) => {
        // Remove non-monetary dependents to satisfy FKs
        await tx.activity.deleteMany({ where: { tenantId, revenueScheduleId } })
        await tx.ticket.deleteMany({ where: { tenantId, revenueScheduleId } })
        await tx.depositLineMatch.deleteMany({ where: { tenantId, revenueScheduleId } })
        await tx.reconciliationItem.deleteMany({ where: { tenantId, revenueScheduleId } })
        await tx.depositLineItem.updateMany({
          where: { tenantId, primaryRevenueScheduleId: revenueScheduleId },
          data: { primaryRevenueScheduleId: null }
        })

        await tx.revenueSchedule.delete({ where: { id: revenueScheduleId } })
      })

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Failed to delete revenue schedule", error)
      return NextResponse.json(
        { error: "Failed to delete revenue schedule" },
        { status: 500 }
      )
    }
  })
}
