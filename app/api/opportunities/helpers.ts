import { OpportunityStatus, OpportunityStage, OpportunityType } from "@prisma/client"

type RelatedAccount = {
  id?: string
  accountName?: string | null
  accountLegalName?: string | null
}

type RelatedProduct = {
  expectedUsage?: unknown
  expectedCommission?: unknown
  product?: {
    distributor?: { accountName?: string | null } | null
    vendor?: { accountName?: string | null } | null
  } | null
}

type RevenueScheduleWithRelations = {
  id: string
  scheduleNumber?: string | null
  scheduleDate?: string | Date | null
  status?: string | null
  expectedUsage?: unknown
  usageAdjustment?: unknown
  actualUsage?: unknown
  expectedCommission?: unknown
  actualCommission?: unknown
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
  distributor?: { accountName?: string | null } | null
  vendor?: { accountName?: string | null } | null
  product?: {
    productNameVendor?: string | null
    commissionPercent?: unknown
    priceEach?: unknown
  } | null
  opportunityProduct?: {
    quantity?: unknown
    unitPrice?: unknown
  } | null
}

type OpportunityWithRelations = {
  id: string
  status?: OpportunityStatus | string | null
  name?: string | null
  orderIdHouse?: string | null
  stage?: OpportunityStage | string | null
  type?: OpportunityType | string | null
  distributorName?: string | null
  vendorName?: string | null
  referredBy?: string | null
  shippingAddress?: string | null
  billingAddress?: string | null
  subagentPercent?: unknown
  houseRepPercent?: unknown
  houseSplitPercent?: unknown
  owner?: { firstName?: string | null; lastName?: string | null; fullName?: string | null } | null
  ownerId?: string | null
  leadSource?: string | null
  estimatedCloseDate?: string | Date | null
  closeDate?: string | Date | null
  description?: string | null
  account?: RelatedAccount | null
  products?: (RelatedProduct | OpportunityProductWithRelations)[] | null
  revenueSchedules?: RevenueScheduleWithRelations[] | null
  expectedCommission?: unknown
  amount?: unknown
  probability?: unknown
  forecastCategory?: string | null
  nextStep?: string | null
  competitors?: string | null
  lossReason?: string | null
  actualCloseDate?: string | Date | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
  createdBy?: { id: string; fullName?: string | null } | null
  updatedBy?: { id: string; fullName?: string | null } | null
}

type OpportunityProductWithRelations = {
  id: string
  productId: string
  quantity?: unknown
  unitPrice?: unknown
  expectedUsage?: unknown
  expectedRevenue?: unknown
  expectedCommission?: unknown
  revenueStartDate?: string | Date | null
  revenueEndDate?: string | Date | null
  active?: boolean | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
  product?: {
    id: string
    productCode?: string | null
    productNameHouse?: string | null
    productNameVendor?: string | null
    revenueType?: string | null
    priceEach?: unknown
    distributor?: { id: string; accountName?: string | null } | null
    vendor?: { id: string; accountName?: string | null } | null
  } | null
}

export type OpportunityLineItemDetail = {
  id: string
  productId: string
  productName: string
  productCode?: string | null
  revenueType?: string | null
  quantity: number
  unitPrice: number
  expectedUsage: number
  expectedRevenue: number
  expectedCommission: number
  revenueStartDate: string | null
  revenueEndDate: string | null
  distributorName?: string | null
  vendorName?: string | null
  priceEach: number | null
  createdAt?: string | null
  updatedAt?: string | null
  active?: boolean
}

export type OpportunityDetailSummary = {
  id: string
  name: string
  stage: OpportunityStage
  status: OpportunityStatus
  type: OpportunityType
  leadSource: string | null
  referredBy?: string | null
  amount: number
  probability: number
  expectedCommission: number
  forecastCategory: string | null
  estimatedCloseDate: string | null
  actualCloseDate: string | null
  nextStep: string | null
  competitors: string | null
  lossReason: string | null
  description: string | null
  subAgent: string
  shippingAddress?: string | null
  billingAddress?: string | null
  subagentPercent?: number | null
  houseRepPercent?: number | null
  houseSplitPercent?: number | null
  account: {
    id: string
    accountName: string
    accountLegalName: string | null
  } | null
  owner: {
    id: string | null
    name: string | null
  }
  createdBy?: {
    id: string
    name: string | null
  } | null
  updatedBy?: {
    id: string
    name: string | null
  } | null
  createdAt: string | null
  updatedAt: string | null
  totals: {
    lineItemCount: number
    quantityTotal: number
    expectedRevenueTotal: number
    expectedCommissionTotal: number
    weightedAmount: number | null
    expectedUsageTotal: number
  }
  lineItems: OpportunityLineItemDetail[]
  revenueSchedules: OpportunityRevenueScheduleDetail[]
}

export type OpportunityRevenueScheduleDetail = {
  id: string
  distributorName: string | null
  vendorName: string | null
  scheduleNumber: string | null
  scheduleDate: string | null
  status: string | null
  productNameVendor: string | null
  quantity: number
  unitPrice: number
  expectedUsageGross: number
  expectedUsageAdjustment: number
  expectedUsageNet: number
  actualUsage: number
  usageBalance: number
  expectedCommissionGross: number
  expectedCommissionAdjustment: number
  expectedCommissionNet: number
  actualCommission: number
  commissionDifference: number
  expectedCommissionRatePercent: number
  actualCommissionRatePercent: number
  commissionRateDifferencePercent: number
  createdAt: string | null
  updatedAt: string | null
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "bigint") {
    return Number(value)
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  if (typeof value === "object" && "toNumber" in (value as Record<string, unknown>) && typeof (value as { toNumber: () => number }).toNumber === "function") {
    try {
      const parsed = (value as { toNumber: () => number }).toNumber()
      return Number.isFinite(parsed) ? parsed : 0
    } catch {
      return 0
    }
  }

  return 0
}

function formatDateValue(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null
  }

  const candidate = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(candidate.getTime())) {
    return null
  }

  return candidate.toISOString()
}

function extractSubAgent(description: string | null | undefined) {
  if (!description) {
    return ""
  }

  const match = description.match(/Subagent:\s*(.*)/i)
  return match?.[1]?.trim() ?? ""
}

function normalizeStatus(status?: OpportunityStatus | string | null): OpportunityStatus {
  if (!status) {
    return OpportunityStatus.Open
  }

  if (typeof status === "string") {
    const values = Object.values(OpportunityStatus) as string[]
    const normalized = values.find(candidate => candidate === status || candidate.toLowerCase() === status.toLowerCase())
    if (normalized) {
      return normalized as OpportunityStatus
    }
  }

  return OpportunityStatus.Open
}

export function mapOpportunityToRow(opportunity: OpportunityWithRelations) {
  const ownerName = opportunity.owner?.fullName
    ?? `${opportunity.owner?.firstName ?? ""} ${opportunity.owner?.lastName ?? ""}`.trim()

  const status = normalizeStatus(opportunity.status)
  const isActive = status === OpportunityStatus.Open || status === OpportunityStatus.OnHold

  const subAgent = extractSubAgent(opportunity.description ?? "")
  const estimatedCloseDate = formatDateValue(opportunity.estimatedCloseDate)
  const closeDate = formatDateValue(opportunity.closeDate) ?? estimatedCloseDate

  const products = Array.isArray(opportunity.products) ? opportunity.products : []
  const expectedUsageGrossTotal = products.reduce((total, item) => total + toNumber(item.expectedUsage), 0)
  const expectedCommissionFromProducts = products.reduce((total, item) => total + toNumber(item.expectedCommission), 0)
  const expectedCommissionGrossTotalCandidate = toNumber(opportunity.expectedCommission)
  const expectedCommissionGrossTotal = expectedCommissionGrossTotalCandidate > 0
    ? expectedCommissionGrossTotalCandidate
    : expectedCommissionFromProducts

  const firstProduct = products[0]
  const distributorName =
    opportunity.distributorName
    ?? firstProduct?.product?.distributor?.accountName
    ?? opportunity.account?.accountName
    ?? ""

  const vendorName =
    opportunity.vendorName
    ?? firstProduct?.product?.vendor?.accountName
    ?? ""

  const derivedOrderId = typeof opportunity.id === "string"
    ? opportunity.id.slice(0, 8).toUpperCase()
    : ""

  const accountLegalName = opportunity.account?.accountLegalName ?? ""
  const formattedOpportunityId = typeof opportunity.id === "string"
    ? opportunity.id.slice(0, 8).toUpperCase()
    : ""

  return {
    id: opportunity.id,
    select: false,
    active: isActive,
    status,
    type: opportunity.type ?? OpportunityType.NewBusiness,
    orderIdHouse: opportunity.orderIdHouse ?? derivedOrderId,
    accountLegalName,
    opportunityName: opportunity.name ?? "",
    stage: opportunity.stage ?? "",
    distributorName,
    vendorName,
    referredBy: opportunity.referredBy ?? opportunity.leadSource ?? "",
    owner: ownerName,
    ownerId: opportunity.ownerId ?? null,
    estimatedCloseDate,
    closeDate,
    expectedUsageGrossTotal,
    expectedCommissionGrossTotal,
    subAgent,
    accountIdVendor: "",
    customerIdVendor: "",
    locationId: "",
    orderIdVendor: "",
    opportunityId: formattedOpportunityId,
    isDeleted: !isActive
  }
}

export function mapOpportunityProductToDetail(item: OpportunityProductWithRelations): OpportunityLineItemDetail {
  const quantity = toNumber(item.quantity)
  const unitPrice = toNumber(item.unitPrice)
  const expectedUsage = toNumber(item.expectedUsage)
  const expectedRevenue = toNumber(item.expectedRevenue)
  const expectedCommission = toNumber(item.expectedCommission)
  const revenueStartDate = formatDateValue(item.revenueStartDate)
  const revenueEndDate = formatDateValue(item.revenueEndDate)
  const priceEach = item.product ? toNumber(item.product.priceEach) : null

  return {
    id: item.id,
    productId: item.productId,
    productName: item.product?.productNameHouse ?? item.product?.productNameVendor ?? "Product",
    productCode: item.product?.productCode ?? null,
    revenueType: item.product?.revenueType ?? null,
    quantity,
    unitPrice,
    expectedUsage,
    expectedRevenue: expectedRevenue > 0 ? expectedRevenue : quantity * unitPrice,
    expectedCommission,
    revenueStartDate,
    revenueEndDate,
    distributorName: item.product?.distributor?.accountName ?? null,
    vendorName: item.product?.vendor?.accountName ?? null,
    priceEach,
    createdAt: formatDateValue(item.createdAt ?? null),
    updatedAt: formatDateValue(item.updatedAt ?? null),
    active: item.active !== false
  }
}

function mapRevenueScheduleToDetail(schedule: RevenueScheduleWithRelations): OpportunityRevenueScheduleDetail {
  const distributorName = schedule.distributor?.accountName ?? null
  const vendorName = schedule.vendor?.accountName ?? null
  const scheduleNumber = schedule.scheduleNumber ?? null
  const scheduleDate = formatDateValue(schedule.scheduleDate)
  const status = schedule.status ?? null
  const productNameVendor = schedule.product?.productNameVendor ?? null

  const quantity = toNumber(schedule.opportunityProduct?.quantity)
  const unitPriceCandidate = toNumber(schedule.opportunityProduct?.unitPrice)
  const fallbackUnitPrice = toNumber(schedule.product?.priceEach)
  const unitPrice = unitPriceCandidate > 0 ? unitPriceCandidate : fallbackUnitPrice

  const expectedUsageRaw = toNumber(schedule.expectedUsage)
  const expectedUsageGross = expectedUsageRaw > 0 ? expectedUsageRaw : quantity * unitPrice
  const expectedUsageAdjustment = toNumber(schedule.usageAdjustment)
  const expectedUsageNet = expectedUsageGross + expectedUsageAdjustment

  const actualUsage = toNumber(schedule.actualUsage)
  const usageBalance = expectedUsageNet - actualUsage

  const expectedCommissionRaw = toNumber(schedule.expectedCommission)
  const commissionPercentCandidate = toNumber(schedule.product?.commissionPercent)
  const commissionPercentDecimal = commissionPercentCandidate > 1 ? commissionPercentCandidate / 100 : commissionPercentCandidate
  const derivedCommissionFromRate = expectedUsageNet > 0 ? expectedUsageNet * commissionPercentDecimal : 0
  const expectedCommissionGross = expectedCommissionRaw > 0 ? expectedCommissionRaw : derivedCommissionFromRate
  const expectedCommissionAdjustment = 0
  const expectedCommissionNet = expectedCommissionGross + expectedCommissionAdjustment

  const actualCommission = toNumber(schedule.actualCommission)
  const commissionDifference = expectedCommissionNet - actualCommission

  const derivedExpectedRateDecimal =
    expectedUsageNet !== 0 ? expectedCommissionNet / expectedUsageNet : commissionPercentDecimal
  const expectedCommissionRateDecimal =
    commissionPercentDecimal > 0 && Number.isFinite(commissionPercentDecimal)
      ? commissionPercentDecimal
      : Number.isFinite(derivedExpectedRateDecimal)
        ? derivedExpectedRateDecimal
        : 0

  const actualCommissionRateDecimal =
    actualUsage !== 0 ? actualCommission / actualUsage : 0
  const commissionRateDifferenceDecimal = expectedCommissionRateDecimal - actualCommissionRateDecimal

  return {
    id: schedule.id,
    distributorName,
    vendorName,
    scheduleNumber,
    scheduleDate,
    status,
    productNameVendor,
    quantity,
    unitPrice,
    expectedUsageGross,
    expectedUsageAdjustment,
    expectedUsageNet,
    actualUsage,
    usageBalance,
    expectedCommissionGross,
    expectedCommissionAdjustment,
    expectedCommissionNet,
    actualCommission,
    commissionDifference,
    expectedCommissionRatePercent: expectedCommissionRateDecimal,
    actualCommissionRatePercent: actualCommissionRateDecimal,
    commissionRateDifferencePercent: commissionRateDifferenceDecimal,
    createdAt: formatDateValue(schedule.createdAt ?? null),
    updatedAt: formatDateValue(schedule.updatedAt ?? null)
  }
}

export function mapOpportunityToDetail(opportunity: OpportunityWithRelations): OpportunityDetailSummary {
  const amount = toNumber(opportunity.amount)
  const probability = toNumber(opportunity.probability)
  const expectedCommission = toNumber(opportunity.expectedCommission)

  const products = Array.isArray(opportunity.products) ? opportunity.products : []
  const detailedProducts = products
    .filter((item): item is OpportunityProductWithRelations => Boolean(item && "id" in item))
    .map(mapOpportunityProductToDetail)

  const revenueSchedules = Array.isArray(opportunity.revenueSchedules)
    ? opportunity.revenueSchedules.map(mapRevenueScheduleToDetail)
    : []

  const expectedRevenueTotals = detailedProducts.reduce((total, item) => total + item.expectedRevenue, 0)
  const expectedCommissionTotal = detailedProducts.reduce((total, item) => total + item.expectedCommission, 0)
  const quantityTotal = detailedProducts.reduce((total, item) => total + item.quantity, 0)
  const expectedUsageTotal = detailedProducts.reduce((total, item) => total + item.expectedUsage, 0)
  const weightedAmount = amount > 0 && probability > 0 ? amount * (probability > 1 ? probability / 100 : probability) : null

  const account = opportunity.account
    ? {
        id: (opportunity as { account?: { id?: string } }).account?.id ?? "",
        accountName: opportunity.account.accountName ?? "",
        accountLegalName: opportunity.account.accountLegalName ?? ""
      }
    : null

  const owner = {
    id: opportunity.ownerId ?? null,
    name: opportunity.owner?.fullName
      ?? `${opportunity.owner?.firstName ?? ""} ${opportunity.owner?.lastName ?? ""}`.trim()
      ?? null
  }

  return {
    id: opportunity.id,
    name: opportunity.name ?? "",
    stage: (opportunity.stage as OpportunityStage) ?? OpportunityStage.Qualification,
    status: normalizeStatus(opportunity.status),
    type: (opportunity.type as OpportunityType) ?? OpportunityType.NewBusiness,
    leadSource: opportunity.leadSource ?? null,
    referredBy: opportunity.referredBy ?? null,
    amount,
    probability,
    expectedCommission,
    forecastCategory: opportunity.forecastCategory ?? null,
    estimatedCloseDate: formatDateValue(opportunity.estimatedCloseDate),
    actualCloseDate: formatDateValue(opportunity.actualCloseDate),
    nextStep: opportunity.nextStep ?? null,
    competitors: opportunity.competitors ?? null,
    lossReason: opportunity.lossReason ?? null,
    description: opportunity.description ?? null,
    subAgent: extractSubAgent(opportunity.description),
    shippingAddress: opportunity.shippingAddress ?? null,
    billingAddress: opportunity.billingAddress ?? null,
    subagentPercent: Number.isFinite(toNumber(opportunity.subagentPercent)) ? toNumber(opportunity.subagentPercent) : null,
    houseRepPercent: Number.isFinite(toNumber(opportunity.houseRepPercent)) ? toNumber(opportunity.houseRepPercent) : null,
    houseSplitPercent: Number.isFinite(toNumber(opportunity.houseSplitPercent)) ? toNumber(opportunity.houseSplitPercent) : null,
    account,
    owner,
    createdBy: opportunity.createdBy
      ? { id: opportunity.createdBy.id, name: opportunity.createdBy.fullName ?? null }
      : null,
    updatedBy: opportunity.updatedBy
      ? { id: opportunity.updatedBy.id, name: opportunity.updatedBy.fullName ?? null }
      : null,
    createdAt: formatDateValue(opportunity.createdAt ?? null),
    updatedAt: formatDateValue(opportunity.updatedAt ?? null),
    totals: {
      lineItemCount: detailedProducts.length,
      quantityTotal,
      expectedRevenueTotal: expectedRevenueTotals,
      expectedCommissionTotal,
      weightedAmount,
      expectedUsageTotal
    },
    lineItems: detailedProducts,
    revenueSchedules
  }
}
