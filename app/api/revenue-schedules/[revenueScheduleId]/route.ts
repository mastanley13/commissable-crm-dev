import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAuth, withPermissions } from "@/lib/api-auth"
import { mapRevenueScheduleToDetail, type RevenueScheduleWithRelations } from "../helpers"
import {
  DepositLineMatchStatus,
  AuditAction,
  RevenueScheduleBillingStatus,
  RevenueScheduleBillingStatusSource,
} from "@prisma/client"
import { logProductAudit, logRevenueScheduleAudit } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function toMonthStartUtc(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
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

      const roleCode = (req.user.role?.code ?? "").toLowerCase()
      const isAdmin = roleCode === "admin"

      const schedule = await prisma.revenueSchedule.findFirst({
        where: {
          id: revenueScheduleId,
          tenantId: req.user.tenantId,
          ...(isAdmin ? {} : { deletedAt: null })
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
              productNameVendor: true,
              productDescriptionVendor: true,
              revenueType: true,
              commissionPercent: true,
              priceEach: true
            }
          },
          opportunityProduct: {
            select: {
              id: true,
              productNameHouseSnapshot: true,
              revenueTypeSnapshot: true,
              product: { select: { revenueType: true } },
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
        where: { id: revenueScheduleId, tenantId, deletedAt: null },
        include: {
          product: { select: { id: true, priceEach: true, commissionPercent: true } },
          opportunityProduct: { select: { id: true, quantity: true, unitPrice: true } },
          opportunity: { select: { id: true, houseSplitPercent: true, houseRepPercent: true, subagentPercent: true } }
        }
      })

      if (!existing) {
        return NextResponse.json({ error: "Revenue schedule not found" }, { status: 404 })
      }

      const previousProductCommission =
        existing.product?.commissionPercent !== null &&
        existing.product?.commissionPercent !== undefined
          ? Number(existing.product.commissionPercent)
          : null

      const toNullableNumber = (value: unknown): number | null => {
        if (value === null || value === undefined) return null
        const numeric = typeof value === "number" ? value : Number(value)
        return Number.isFinite(numeric) ? numeric : null
      }

      const previousEffectiveSplitsRaw = {
        houseSplitPercent: toNullableNumber(
          (existing as any).houseSplitPercentOverride ??
            existing.opportunity?.houseSplitPercent ??
            null
        ),
        houseRepSplitPercent: toNullableNumber(
          (existing as any).houseRepSplitPercentOverride ??
            existing.opportunity?.houseRepPercent ??
            null
        ),
        subagentSplitPercent: toNullableNumber(
          (existing as any).subagentSplitPercentOverride ??
            existing.opportunity?.subagentPercent ??
            null
        ),
      }

      const previousEffectiveSplits = (() => {
        const finite = [
          previousEffectiveSplitsRaw.houseSplitPercent,
          previousEffectiveSplitsRaw.houseRepSplitPercent,
          previousEffectiveSplitsRaw.subagentSplitPercent,
        ].filter((v) => v !== null && Number.isFinite(v)) as number[]
        const sum = finite.reduce((a, b) => a + b, 0)
        const maxAbs = finite.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
        const looksLikeFractions = finite.length > 0 && maxAbs <= 1.5 && sum <= 1.5
        const factor = looksLikeFractions ? 100 : 1
        return {
          houseSplitPercent:
            previousEffectiveSplitsRaw.houseSplitPercent === null
              ? null
              : previousEffectiveSplitsRaw.houseSplitPercent * factor,
          houseRepSplitPercent:
            previousEffectiveSplitsRaw.houseRepSplitPercent === null
              ? null
              : previousEffectiveSplitsRaw.houseRepSplitPercent * factor,
          subagentSplitPercent:
            previousEffectiveSplitsRaw.subagentSplitPercent === null
              ? null
              : previousEffectiveSplitsRaw.subagentSplitPercent * factor,
        }
      })()

      const previousScheduleValues: Record<string, unknown> = {
        scheduleNumber: (existing as any).scheduleNumber ?? null,
        scheduleDate: (existing as any).scheduleDate ?? null,
        expectedUsage: (existing as any).expectedUsage ?? null,
        expectedCommission: (existing as any).expectedCommission ?? null,
        usageAdjustment: (existing as any).usageAdjustment ?? null,
        actualCommissionAdjustment: (existing as any).actualCommissionAdjustment ?? null,
        notes: (existing as any).notes ?? null,
        billingStatus: (existing as any).billingStatus ?? null,
        expectedCommissionRatePercent: previousProductCommission,
        houseSplitPercent: previousEffectiveSplits.houseSplitPercent,
        houseRepSplitPercent: previousEffectiveSplits.houseRepSplitPercent,
        subagentSplitPercent: previousEffectiveSplits.subagentSplitPercent,
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
        return num
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
            data.scheduleDate = toMonthStartUtc(date)
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

      if (typeof (payload as any)?.billingStatus === "string") {
        const raw = (payload as any).billingStatus.trim()
        if (raw.length > 0) {
          const key = raw.toLowerCase().replace(/[\s_-]/g, "")
          const map: Record<string, RevenueScheduleBillingStatus> = {
            open: RevenueScheduleBillingStatus.Open,
            reconciled: RevenueScheduleBillingStatus.Reconciled,
            indispute: RevenueScheduleBillingStatus.InDispute,
          }
          const parsed = map[key]
          if (!parsed) {
            errors.billingStatus = "Billing Status must be Open, Reconciled, or In Dispute."
          } else {
            data.billingStatus = parsed
            data.billingStatusSource = RevenueScheduleBillingStatusSource.Manual
            data.billingStatusUpdatedById = req.user.id
            data.billingStatusUpdatedAt = new Date()
            data.billingStatusReason = "ManualEdit"
            hasChanges = true
          }
        }
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
        const currentHouse = previousEffectiveSplits.houseSplitPercent
        const currentHouseRep = previousEffectiveSplits.houseRepSplitPercent
        const currentSubagent = previousEffectiveSplits.subagentSplitPercent

        const nextHouse = houseSplitPercentValue !== null ? houseSplitPercentValue : currentHouse
        const nextHouseRep = houseRepSplitPercentValue !== null ? houseRepSplitPercentValue : currentHouseRep
        const nextSubagent = subagentSplitPercentValue !== null ? subagentSplitPercentValue : currentSubagent

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
          if (value < 0 || value > 100) {
            errors[key] = errors[key] ?? "Split percent must be between 0 and 100."
          }
        }

        const total = [nextHouse, nextHouseRep, nextSubagent].reduce<number>(
          (sum, value) => sum + (value ?? 0),
          0
        )
        if (Number.isFinite(total) && Math.abs(total - 100) > 0.01) {
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

          if (typeof productData.commissionPercent === "number") {
            const nextCommission = productData.commissionPercent
            if (previousProductCommission !== nextCommission) {
              await logProductAudit(
                AuditAction.Update,
                productId,
                req.user.id,
                tenantId,
                request,
                { commissionPercent: previousProductCommission },
                { commissionPercent: nextCommission },
              )
            }
          }
        }
      }

      // Apply per-schedule commission split overrides when provided.
      if (anySplitTouched) {
        const splitOverrideData: Record<string, any> = {}
        if (houseSplitPercentValue !== null) {
          splitOverrideData.houseSplitPercentOverride = houseSplitPercentValue
        }
        if (houseRepSplitPercentValue !== null) {
          splitOverrideData.houseRepSplitPercentOverride = houseRepSplitPercentValue
        }
        if (subagentSplitPercentValue !== null) {
          splitOverrideData.subagentSplitPercentOverride = subagentSplitPercentValue
        }

        if (Object.keys(splitOverrideData).length > 0) {
          Object.assign(data, splitOverrideData)
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
          product: { select: { id: true, productNameHouse: true, productNameVendor: true, productDescriptionVendor: true, revenueType: true, commissionPercent: true, priceEach: true } },
          opportunityProduct: { select: { id: true, productNameHouseSnapshot: true, revenueTypeSnapshot: true, product: { select: { revenueType: true } }, quantity: true, unitPrice: true, expectedUsage: true, expectedCommission: true, revenueStartDate: true } },
          opportunity: { select: { id: true, name: true, orderIdHouse: true, orderIdVendor: true, orderIdDistributor: true, customerIdHouse: true, customerIdVendor: true, customerIdDistributor: true, locationId: true, houseSplitPercent: true, houseRepPercent: true, subagentPercent: true, distributorName: true, vendorName: true, billingAddress: true, shippingAddress: true, description: true, owner: { select: { fullName: true } } } }
        }
      })

      if (!updated) {
        return NextResponse.json({ error: "Revenue schedule not found after update" }, { status: 404 })
      }

      const nextProductCommission =
        updated.product?.commissionPercent !== null &&
        updated.product?.commissionPercent !== undefined
          ? Number(updated.product.commissionPercent)
          : null

      const nextEffectiveSplits = {
        houseSplitPercent:
          (updated as any).houseSplitPercentOverride ??
          updated.opportunity?.houseSplitPercent ??
          null,
        houseRepSplitPercent:
          (updated as any).houseRepSplitPercentOverride ??
          updated.opportunity?.houseRepPercent ??
          null,
        subagentSplitPercent:
          (updated as any).subagentSplitPercentOverride ??
          updated.opportunity?.subagentPercent ??
          null,
      }

      const newScheduleValues: Record<string, unknown> = {
        scheduleNumber: (updated as any).scheduleNumber ?? null,
        scheduleDate: (updated as any).scheduleDate ?? null,
        expectedUsage: (updated as any).expectedUsage ?? null,
        expectedCommission: (updated as any).expectedCommission ?? null,
        usageAdjustment: (updated as any).usageAdjustment ?? null,
        actualCommissionAdjustment: (updated as any).actualCommissionAdjustment ?? null,
        notes: (updated as any).notes ?? null,
        billingStatus: (updated as any).billingStatus ?? null,
        expectedCommissionRatePercent: nextProductCommission,
        houseSplitPercent: nextEffectiveSplits.houseSplitPercent,
        houseRepSplitPercent: nextEffectiveSplits.houseRepSplitPercent,
        subagentSplitPercent: nextEffectiveSplits.subagentSplitPercent,
      }

      await logRevenueScheduleAudit(
        AuditAction.Update,
        revenueScheduleId,
        req.user.id,
        tenantId,
        request,
        previousScheduleValues,
        newScheduleValues,
      )

      const detail = mapRevenueScheduleToDetail(updated as RevenueScheduleWithRelations)
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

      const url = new URL(request.url)
      const stage = (url.searchParams.get("stage") ?? "soft").toLowerCase()

      let deleteReason: string | null = null
      try {
        const body = await request.json().catch(() => null) as any
        if (body && typeof body.reason === "string") {
          deleteReason = body.reason.trim() || null
        }
      } catch (_) {
        // ignore missing/invalid JSON bodies
      }

      if (!deleteReason) {
        const queryReason = url.searchParams.get("reason")
        deleteReason = typeof queryReason === "string" && queryReason.trim().length > 0 ? queryReason.trim() : null
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
          scheduleDate: true,
          expectedUsage: true,
          expectedCommission: true,
          usageAdjustment: true,
          actualUsage: true,
          actualUsageAdjustment: true,
          actualCommission: true,
          actualCommissionAdjustment: true,
          deletedAt: true,
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

      const [matchCount, reconCount, primaryDepositCount, activityCount, ticketCount, payoutCount] = await Promise.all([
        prisma.depositLineMatch.count({ where: { tenantId, revenueScheduleId } }),
        prisma.reconciliationItem.count({ where: { tenantId, revenueScheduleId } }),
        prisma.depositLineItem.count({ where: { tenantId, primaryRevenueScheduleId: revenueScheduleId } }),
        prisma.activity.count({ where: { tenantId, revenueScheduleId } }),
        prisma.ticket.count({ where: { tenantId, revenueScheduleId } }),
        prisma.commissionPayout.count({ where: { tenantId, revenueScheduleId } }),
      ])

      const label = schedule.scheduleNumber ?? schedule.id

      if (stage === "permanent") {
        if (!isAdmin) {
          return NextResponse.json({ error: "Only Admin role can permanently delete revenue schedules" }, { status: 403 })
        }

        if (!schedule.deletedAt) {
          return NextResponse.json(
            { error: "Revenue schedule must be deleted (archived) before permanent deletion" },
            { status: 400 }
          )
        }

        if (
          hasAppliedMonies ||
          matchCount > 0 ||
          reconCount > 0 ||
          primaryDepositCount > 0 ||
          activityCount > 0 ||
          ticketCount > 0 ||
          payoutCount > 0
        ) {
          const reason =
            hasAppliedMonies
              ? "has usage or commission applied"
              : matchCount > 0
                ? "has deposit matches"
                : reconCount > 0
                  ? "is in reconciliation"
                  : primaryDepositCount > 0
                    ? "is linked to deposit lines"
                    : activityCount > 0
                      ? "has activities"
                      : ticketCount > 0
                        ? "has tickets"
                        : "has commission payouts"

          return NextResponse.json(
            { error: `Cannot permanently delete revenue schedule ${label} because it ${reason}.` },
            { status: 409 }
          )
        }

        const previousValues: Record<string, unknown> = {
          deletedAt: schedule.deletedAt,
          deleteReason,
          stage: "permanent"
        }

        await prisma.revenueSchedule.delete({ where: { id: revenueScheduleId } })

        await logRevenueScheduleAudit(
          AuditAction.Delete,
          revenueScheduleId,
          req.user.id,
          tenantId,
          request,
          previousValues,
          undefined,
        )

        return NextResponse.json({ success: true, stage: "permanent" })
      }

      // Default: soft delete (archive)
      if (schedule.deletedAt) {
        return NextResponse.json({ success: true, stage: "soft" })
      }

      if (hasAppliedMonies || matchCount > 0 || reconCount > 0 || primaryDepositCount > 0) {
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

      const deletedAt = new Date()

      const previousValues: Record<string, unknown> = {
        deletedAt: schedule.deletedAt,
        deleteReason,
        stage: "soft"
      }

      const newValues: Record<string, unknown> = {
        deletedAt,
        deleteReason,
        stage: "soft"
      }

      await prisma.revenueSchedule.update({
        where: { id: revenueScheduleId },
        data: {
          deletedAt,
          updatedById: req.user.id
        }
      })

      await logRevenueScheduleAudit(
        AuditAction.Delete,
        revenueScheduleId,
        req.user.id,
        tenantId,
        request,
        previousValues,
        newValues,
      )

      return NextResponse.json({ success: true, stage: "soft" })
    } catch (error) {
      console.error("Failed to delete revenue schedule", error)
      return NextResponse.json(
        { error: "Failed to delete revenue schedule" },
        { status: 500 }
      )
    }
  })
}
