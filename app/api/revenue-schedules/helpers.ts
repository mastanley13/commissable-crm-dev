import { Prisma, RevenueScheduleStatus } from "@prisma/client"
import { getRevenueTypeLabel } from "@/lib/revenue-types"
import { computeRevenueScheduleMetrics } from "@/lib/revenue-schedule-math"
import { type OtherSource, resolveOtherSource, resolveOtherValue } from "@/lib/other-field"

export type RevenueScheduleWithRelations = Prisma.RevenueScheduleGetPayload<{
  include: {
    account: {
      select: {
        id: true
        accountName: true
        accountLegalName: true
        accountNumber: true
        shippingAddress: {
          select: {
            line1: true
            line2: true
            city: true
            state: true
            postalCode: true
            country: true
          }
        }
        billingAddress: {
          select: {
            line1: true
            line2: true
            city: true
            state: true
            postalCode: true
            country: true
          }
        }
      }
    }
    distributor: {
      select: {
        id: true
        accountName: true
        accountNumber: true
      }
    }
    vendor: {
      select: {
        id: true
        accountName: true
        accountNumber: true
      }
    }
    product: {
      select: {
        id: true
        productNameHouse: true
        productNameVendor: true
        productDescriptionVendor: true
        revenueType: true
        commissionPercent: true
        priceEach: true
      }
    }
    opportunityProduct: {
      select: {
        id: true
        productNameHouseSnapshot: true
        quantity: true
        unitPrice: true
        expectedUsage: true
        expectedCommission: true
        revenueStartDate: true
      }
    }
    opportunity: {
      select: {
        id: true
        name: true
        orderIdHouse: true
        orderIdVendor: true
        orderIdDistributor: true
        customerIdHouse: true
        customerIdVendor: true
        customerIdDistributor: true
        locationId: true
        houseSplitPercent: true
        houseRepPercent: true
        subagentPercent: true
        distributorName: true
        vendorName: true
        billingAddress: true
        shippingAddress: true
        description: true
        owner: {
          select: {
            fullName: true
          }
        }
      }
    }
  }
}>

export interface RevenueScheduleListItem {
  id: string
  revenueScheduleName: string
  revenueSchedule?: string | null
  revenueScheduleDate: string | null
  revenueMonth?: string | null
  flexClassification?: string | null
  flexReasonCode?: string | null
  flexSourceDepositId?: string | null
  flexSourceDepositLineItemId?: string | null
  productNameVendor: string | null
  productNameHouse?: string | null
  distributorName: string | null
  vendorName: string | null
  accountName: string | null
  opportunityId: string | null
  opportunityName: string | null
  opportunityOwnerName?: string | null
  houseRepName?: string | null
  billingMonth?: string | null
  scheduleStatus: string
  inDispute: boolean
  deletedAt: string | null
  quantity: string | null
  quantityRaw?: number | null
  priceEach: string | null
  unitPriceRaw?: number | null
  expectedUsageGross: string | null
  expectedUsageAdjustment: string | null
  usageAdjustmentRaw?: number | null
  expectedUsage?: string | null
  usageAdjustment?: string | null
  expectedUsageNet: string | null
  actualUsage: string | null
  usageBalance: string | null
  expectedCommissionGross: string | null
  expectedCommissionAdjustment: string | null
  expectedCommissionNet: string | null
  actualCommission: string | null
  commissionDifference: string | null
  customerIdDistributor: string | null
  customerIdOther?: string | null
  customerIdHouse?: string | null
  distributorId?: string | null
  vendorId?: string | null
  accountId?: string | null
  productId?: string | null
  customerIdVendor: string | null
  orderIdDistributor: string | null
  orderIdVendor: string | null
  orderIdOther?: string | null
  orderIdHouse: string | null
  locationId: string | null
  otherSource?: OtherSource | null
  active: boolean
}

export interface RevenueScheduleDetail extends RevenueScheduleListItem {
  legalName: string | null
  shippingAddress: string | null
  billingAddress: string | null
  expectedCommissionRatePercent: string | null
  actualCommissionRatePercent: string | null
  commissionRateDifference: string | null
  houseSplitPercent: string | null
  houseRepSplitPercent: string | null
  subagentSplitPercent: string | null
  subagentName: string | null
   paymentType: string | null
   // "Comments" in the UI map to the existing `notes` column on RevenueSchedule.
   comments: string | null
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2
})

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4
})

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  try {
    // Prisma Decimal implements valueOf
    return Number(value as number)
  } catch {
    return 0
  }
}

function formatCurrency(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const numeric = toNumber(value)
  return currencyFormatter.format(numeric)
}

function formatPercent(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const numeric = toNumber(value)
  if (!Number.isFinite(numeric)) return null
  return percentFormatter.format(numeric)
}

function formatPercentFromFraction(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const numeric = toNumber(value)
  if (!Number.isFinite(numeric)) return null
  return percentFormatter.format(numeric)
}

function formatNumber(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const numeric = toNumber(value)
  if (!Number.isFinite(numeric)) return null
  return numberFormatter.format(numeric)
}

function formatDate(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.toISOString().slice(0, 10)
}

function formatAddress(address?: {
  line1: string | null
  line2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
} | null): string | null {
  if (!address) return null
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postalCode,
    address.country
  ]
    .map(part => (part ?? "").trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return null
  }
  return parts.join(", ")
}

function mapStatus(
  status: RevenueScheduleStatus | null | undefined,
  usageBalance: number,
  commissionDifference: number,
): {
  status: string
  inDispute: boolean
} {
  const hasVariance = Math.abs(usageBalance) > 0.005 || Math.abs(commissionDifference) > 0.005

  if (status === RevenueScheduleStatus.Reconciled) {
    return { status: "Reconciled", inDispute: false }
  }

  if (status === RevenueScheduleStatus.Overpaid) {
    return { status: "Overpaid", inDispute: true }
  }

  if (status === RevenueScheduleStatus.Underpaid) {
    return { status: "Underpaid", inDispute: hasVariance }
  }

  return { status: "Unreconciled", inDispute: hasVariance }
}

function extractSubagentName(description: string | null | undefined): string | null {
  if (!description) return null
  const match = description.match(/^Subagent:\s*(.+)$/im)
  return match?.[1]?.trim() ?? null
}

function getEffectiveSplitFractions(schedule: RevenueScheduleWithRelations): {
  house: number | null
  houseRep: number | null
  subagent: number | null
} {
  const houseOverride = schedule.houseSplitPercentOverride
  const houseRepOverride = schedule.houseRepSplitPercentOverride
  const subagentOverride = schedule.subagentSplitPercentOverride

  const houseBase = schedule.opportunity?.houseSplitPercent ?? null
  const houseRepBase = schedule.opportunity?.houseRepPercent ?? null
  const subagentBase = schedule.opportunity?.subagentPercent ?? null

  const resolve = (override: unknown, base: unknown): number | null => {
    if (override !== null && override !== undefined) {
      const numeric = toNumber(override)
      return Number.isFinite(numeric) ? numeric : null
    }
    if (base !== null && base !== undefined) {
      const numeric = toNumber(base)
      return Number.isFinite(numeric) ? numeric : null
    }
    return null
  }

  return {
    house: resolve(houseOverride, houseBase),
    houseRep: resolve(houseRepOverride, houseRepBase),
    subagent: resolve(subagentOverride, subagentBase)
  }
}

export function mapRevenueScheduleToListItem(schedule: RevenueScheduleWithRelations): RevenueScheduleListItem {
  const flexClassification = (schedule as any).flexClassification ?? null
  const flexReasonCode = (schedule as any).flexReasonCode ?? null
  const flexSourceDepositId = (schedule as any).flexSourceDepositId ?? null
  const flexSourceDepositLineItemId = (schedule as any).flexSourceDepositLineItemId ?? null

  const expectedUsage = toNumber(schedule.expectedUsage ?? schedule.opportunityProduct?.expectedUsage)
  const usageAdjustment = toNumber(schedule.usageAdjustment)
  const actualUsage = toNumber(schedule.actualUsage)

  const expectedCommission = toNumber(schedule.expectedCommission ?? schedule.opportunityProduct?.expectedCommission)
  const expectedCommissionAdjustment = toNumber(schedule.actualCommissionAdjustment)
  const actualCommission = toNumber(schedule.actualCommission)

  const metrics = computeRevenueScheduleMetrics({
    expectedUsageGross: expectedUsage,
    expectedUsageAdjustment: usageAdjustment,
    actualUsage,
    expectedCommissionGross: expectedCommission,
    expectedCommissionAdjustment,
    actualCommission
  })

  const expectedUsageNet = metrics.expectedUsageNet ?? expectedUsage + usageAdjustment
  const usageBalance = metrics.usageDifference ?? expectedUsageNet - actualUsage
  const expectedCommissionNet =
    metrics.expectedCommissionNet ?? expectedCommission + expectedCommissionAdjustment
  const commissionDifference = metrics.commissionDifference ?? expectedCommissionNet - actualCommission

  const statusInfo = mapStatus(schedule.status, usageBalance, commissionDifference)

  const quantity = schedule.opportunityProduct?.quantity ?? null
  const quantityNumber = quantity !== null ? toNumber(quantity) : null
  const quantityValue = quantityNumber !== null ? formatNumber(quantityNumber) : null
  const unitPrice = schedule.opportunityProduct?.unitPrice ?? schedule.product?.priceEach ?? null
  const unitPriceNumber = unitPrice !== null ? toNumber(unitPrice) : null

  const revenueMonthDate = schedule.opportunityProduct?.revenueStartDate ?? null
  const revenueMonth = revenueMonthDate ? formatDate(revenueMonthDate)?.slice(0, 7) ?? null : null

  const productNameHouse =
    schedule.opportunityProduct?.productNameHouseSnapshot ?? schedule.product?.productNameHouse ?? null

  const opportunityOwnerName = schedule.opportunity?.owner?.fullName ?? null
  const houseRepName = opportunityOwnerName

  const customerIdVendor = schedule.opportunity?.customerIdVendor ?? schedule.vendor?.accountNumber ?? null
  const customerIdDistributor = schedule.opportunity?.customerIdDistributor ?? schedule.distributor?.accountNumber ?? null
  const customerIdOther = resolveOtherValue(customerIdVendor, customerIdDistributor).value

  const orderIdVendor = schedule.opportunity?.orderIdVendor ?? null
  const orderIdDistributor = schedule.distributorOrderId ?? schedule.opportunity?.orderIdDistributor ?? null
  const orderIdOther = resolveOtherValue(orderIdVendor, orderIdDistributor).value

  const otherSource = resolveOtherSource([
    [customerIdVendor, customerIdDistributor],
    [orderIdVendor, orderIdDistributor],
  ])

  return {
    id: schedule.id,
    revenueScheduleName: schedule.scheduleNumber ?? schedule.id,
    revenueSchedule: schedule.scheduleNumber ?? schedule.id,
    revenueScheduleDate: formatDate(schedule.scheduleDate),
    productNameVendor: schedule.product?.productNameVendor ?? null,
    revenueMonth,
    flexClassification,
    flexReasonCode,
    flexSourceDepositId,
    flexSourceDepositLineItemId,
    productNameHouse,
    distributorName: schedule.distributor?.accountName ?? schedule.opportunity?.distributorName ?? null,
    vendorName: schedule.vendor?.accountName ?? schedule.opportunity?.vendorName ?? null,
    accountName: schedule.account?.accountName ?? null,
    opportunityId: schedule.opportunity?.id ?? null,
    opportunityName: schedule.opportunity?.name ?? null,
    opportunityOwnerName,
    houseRepName,
    billingMonth: null,
    scheduleStatus: statusInfo.status,
    inDispute: statusInfo.inDispute,
    deletedAt: schedule.deletedAt ? schedule.deletedAt.toISOString() : null,
      quantity: quantityValue,
      quantityRaw: quantityNumber,
      priceEach: formatCurrency(unitPriceNumber),
      unitPriceRaw: unitPriceNumber,
      expectedUsageGross: formatCurrency(expectedUsage),
      expectedUsageAdjustment: formatCurrency(usageAdjustment),
      usageAdjustmentRaw: usageAdjustment,
    expectedUsage: formatCurrency(expectedUsage),
    usageAdjustment: formatCurrency(usageAdjustment),
    expectedUsageNet: formatCurrency(expectedUsageNet),
    actualUsage: formatCurrency(actualUsage),
    usageBalance: formatCurrency(usageBalance),
    expectedCommissionGross: formatCurrency(expectedCommission),
    expectedCommissionAdjustment: formatCurrency(expectedCommissionAdjustment),
    expectedCommissionNet: formatCurrency(expectedCommissionNet),
    actualCommission: formatCurrency(actualCommission),
    commissionDifference: formatCurrency(commissionDifference),
    customerIdDistributor,
    customerIdOther,
    customerIdHouse: schedule.opportunity?.customerIdHouse ?? null,
    distributorId: schedule.distributor?.id ?? null,
    vendorId: schedule.vendor?.id ?? null,
    accountId: schedule.account?.id ?? null,
    productId: schedule.product?.id ?? null,
    customerIdVendor,
    orderIdDistributor,
    orderIdVendor,
    orderIdOther,
    orderIdHouse: schedule.orderIdHouse ?? schedule.opportunity?.orderIdHouse ?? null,
    locationId: schedule.opportunity?.locationId ?? schedule.account?.accountNumber ?? null,
    otherSource,
    active: schedule.status !== RevenueScheduleStatus.Reconciled
  }
}

export function mapRevenueScheduleToDetail(schedule: RevenueScheduleWithRelations): RevenueScheduleDetail {
  const listValues = mapRevenueScheduleToListItem(schedule)
  const expectedCommissionRate = schedule.product?.commissionPercent ?? null
  const productRevenueType = schedule.product?.revenueType ?? null

  const expectedCommissionRateFraction = expectedCommissionRate !== null ? toNumber(expectedCommissionRate) / 100 : null
  const metrics = computeRevenueScheduleMetrics({
    expectedUsageGross: toNumber(schedule.expectedUsage ?? schedule.opportunityProduct?.expectedUsage),
    expectedUsageAdjustment: toNumber(schedule.usageAdjustment),
    expectedUsageNet: null,
    actualUsage: toNumber(schedule.actualUsage),
    expectedCommissionGross: toNumber(schedule.expectedCommission ?? schedule.opportunityProduct?.expectedCommission),
    expectedCommissionAdjustment: toNumber(schedule.actualCommissionAdjustment),
    expectedCommissionNet: null,
    actualCommission: toNumber(schedule.actualCommission),
    expectedRateFraction: expectedCommissionRateFraction,
    actualRateFraction: null
  })

  const splits = getEffectiveSplitFractions(schedule)

  return {
    ...listValues,
    legalName: schedule.account?.accountLegalName ?? null,
    shippingAddress: formatAddress(schedule.account?.shippingAddress),
    billingAddress: formatAddress(schedule.account?.billingAddress),
    expectedCommissionRatePercent: formatPercent(metrics.expectedRateFraction),
    actualCommissionRatePercent: formatPercent(metrics.actualRateFraction),
    commissionRateDifference: formatPercent(metrics.commissionRateDifferenceFraction),
    houseSplitPercent: formatPercentFromFraction(splits.house),
    houseRepSplitPercent: formatPercentFromFraction(splits.houseRep),
    subagentSplitPercent: formatPercentFromFraction(splits.subagent),
    subagentName: extractSubagentName(schedule.opportunity?.description) ?? null,
    // Payment type is derived from deposit matches in the API route.
    paymentType: null,
    comments: schedule.notes ?? null
  }
}
