import type { Prisma, RevenueScheduleStatus } from "@prisma/client"

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
        quantity: true
        unitPrice: true
        expectedUsage: true
        expectedCommission: true
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
      }
    }
  }
}>

export interface RevenueScheduleListItem {
  id: string
  revenueScheduleName: string
  revenueSchedule?: string | null
  revenueScheduleDate: string | null
  productNameVendor: string | null
  distributorName: string | null
  vendorName: string | null
  accountName: string | null
  opportunityId: string | null
  opportunityName: string | null
  scheduleStatus: string
  inDispute: boolean
  quantity: string | null
  priceEach: string | null
  expectedUsageGross: string | null
  expectedUsageAdjustment: string | null
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
  distributorId?: string | null
  customerIdVendor: string | null
  orderIdDistributor: string | null
  orderIdVendor: string | null
  orderIdHouse: string | null
  locationId: string | null
  active: boolean
}

export interface RevenueScheduleDetail extends RevenueScheduleListItem {
  productDescriptionVendor: string | null
  productRevenueType: string | null
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

function mapStatus(status: RevenueScheduleStatus | null | undefined, usageBalance: number, commissionDifference: number): {
  status: string
  inDispute: boolean
} {
  const hasVariance = Math.abs(usageBalance) > 0.005 || Math.abs(commissionDifference) > 0.005
  if (status === "Paid") {
    return { status: "Reconciled", inDispute: false }
  }

  if (status === "Cancelled") {
    return { status: "In Dispute", inDispute: true }
  }

  return { status: "Open", inDispute: hasVariance }
}

function extractSubagentName(description: string | null | undefined): string | null {
  if (!description) return null
  const match = description.match(/^Subagent:\s*(.+)$/im)
  return match?.[1]?.trim() ?? null
}

export function mapRevenueScheduleToListItem(schedule: RevenueScheduleWithRelations): RevenueScheduleListItem {
  const expectedUsage = toNumber(schedule.expectedUsage ?? schedule.opportunityProduct?.expectedUsage)
  const usageAdjustment = toNumber(schedule.usageAdjustment)
  const expectedUsageNet = expectedUsage + usageAdjustment
  const actualUsage = toNumber(schedule.actualUsage)
  const usageBalance = expectedUsageNet - actualUsage

  const expectedCommission = toNumber(schedule.expectedCommission ?? schedule.opportunityProduct?.expectedCommission)
  const actualCommission = toNumber(schedule.actualCommission)
  const commissionDifference = expectedCommission - actualCommission

  const statusInfo = mapStatus(schedule.status, usageBalance, commissionDifference)

  const quantity = schedule.opportunityProduct?.quantity ?? null
  const quantityValue = quantity !== null ? formatNumber(quantity) : null
  const unitPrice = schedule.opportunityProduct?.unitPrice ?? schedule.product?.priceEach ?? null

  return {
    id: schedule.id,
    revenueScheduleName: schedule.scheduleNumber ?? schedule.id,
    revenueSchedule: schedule.scheduleNumber ?? schedule.id,
    revenueScheduleDate: formatDate(schedule.scheduleDate),
    productNameVendor: schedule.product?.productNameVendor ?? null,
    distributorName: schedule.distributor?.accountName ?? schedule.opportunity?.distributorName ?? null,
    vendorName: schedule.vendor?.accountName ?? schedule.opportunity?.vendorName ?? null,
    accountName: schedule.account?.accountName ?? null,
    opportunityId: schedule.opportunity?.id ?? null,
    opportunityName: schedule.opportunity?.name ?? null,
    scheduleStatus: statusInfo.status,
    inDispute: statusInfo.inDispute,
    quantity: quantityValue,
    priceEach: formatCurrency(unitPrice),
    expectedUsageGross: formatCurrency(expectedUsage),
    expectedUsageAdjustment: formatCurrency(usageAdjustment),
    expectedUsage: formatCurrency(expectedUsage),
    usageAdjustment: formatCurrency(usageAdjustment),
    expectedUsageNet: formatCurrency(expectedUsageNet),
    actualUsage: formatCurrency(actualUsage),
    usageBalance: formatCurrency(usageBalance),
    expectedCommissionGross: formatCurrency(expectedCommission),
    expectedCommissionAdjustment: formatCurrency(0),
    expectedCommissionNet: formatCurrency(expectedCommission),
    actualCommission: formatCurrency(actualCommission),
    commissionDifference: formatCurrency(commissionDifference),
    customerIdDistributor: schedule.opportunity?.customerIdDistributor ?? schedule.distributor?.accountNumber ?? null,
    distributorId: schedule.opportunity?.customerIdDistributor ?? schedule.distributor?.accountNumber ?? null,
    customerIdVendor: schedule.opportunity?.customerIdVendor ?? schedule.vendor?.accountNumber ?? null,
    orderIdDistributor: schedule.distributorOrderId ?? schedule.opportunity?.orderIdDistributor ?? null,
    orderIdVendor: schedule.opportunity?.orderIdVendor ?? null,
    orderIdHouse: schedule.orderIdHouse ?? schedule.opportunity?.orderIdHouse ?? null,
    locationId: schedule.opportunity?.locationId ?? schedule.account?.accountNumber ?? null,
    active: schedule.status !== "Cancelled"
  }
}

export function mapRevenueScheduleToDetail(schedule: RevenueScheduleWithRelations): RevenueScheduleDetail {
  const listValues = mapRevenueScheduleToListItem(schedule)
  const expectedCommissionRate = schedule.product?.commissionPercent ?? null

  const actualCommissionNumber = toNumber(schedule.actualCommission)
  const actualUsageNumber = toNumber(schedule.actualUsage)

  const actualCommissionRate = actualUsageNumber > 0 ? actualCommissionNumber / actualUsageNumber : null
  const expectedCommissionRateFraction = expectedCommissionRate ? toNumber(expectedCommissionRate) / 100 : null
  const commissionRateDifference =
    expectedCommissionRateFraction !== null && actualCommissionRate !== null
      ? expectedCommissionRateFraction - actualCommissionRate
      : null

  return {
    ...listValues,
    productDescriptionVendor: schedule.product?.productDescriptionVendor ?? null,
    productRevenueType: schedule.product?.revenueType ?? null,
    legalName: schedule.account?.accountLegalName ?? null,
    shippingAddress: formatAddress(schedule.account?.shippingAddress),
    billingAddress: formatAddress(schedule.account?.billingAddress),
    expectedCommissionRatePercent: formatPercent(expectedCommissionRateFraction),
    actualCommissionRatePercent: formatPercent(actualCommissionRate),
    commissionRateDifference: formatPercent(commissionRateDifference),
    houseSplitPercent: formatPercentFromFraction(schedule.opportunity?.houseSplitPercent),
    houseRepSplitPercent: formatPercentFromFraction(schedule.opportunity?.houseRepPercent),
    subagentSplitPercent: formatPercentFromFraction(schedule.opportunity?.subagentPercent),
    subagentName: extractSubagentName(schedule.opportunity?.description) ?? null
  }
}
