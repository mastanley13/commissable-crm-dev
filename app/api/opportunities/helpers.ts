import { ActivityStatus, OpportunityStatus, OpportunityStage, OpportunityType } from "@prisma/client"
import { isActivityOpen } from "@/lib/activity-status"

type RelatedAccount = {
  id?: string
  accountName?: string | null
  accountLegalName?: string | null
  shippingAddress?: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
    country?: string | null
  } | null
  billingAddress?: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
    country?: string | null
  } | null
}

type RelatedProduct = {
  expectedUsage?: unknown
  expectedCommission?: unknown
  product?: {
    distributor?: { accountName?: string | null } | null
    vendor?: { accountName?: string | null } | null
  } | null
}

type ActivityAttachmentWithRelations = {
  id: string
  fileName: string
  fileSize?: number | null
  mimeType?: string | null
  uploadedAt?: string | Date | null
  uploadedBy?: { firstName?: string | null; lastName?: string | null } | null
}

type ActivityWithRelations = {
  id: string
  subject?: string | null
  description?: string | null
  status?: ActivityStatus | string | null
  activityType?: string | null
  dueDate?: string | Date | null
  createdAt?: string | Date | null
  creator?: { firstName?: string | null; lastName?: string | null } | null
  assignee?: { firstName?: string | null; lastName?: string | null } | null
  attachments?: ActivityAttachmentWithRelations[] | null
}

type RevenueScheduleWithRelations = {
  id: string
  scheduleNumber?: string | null
  scheduleDate?: string | Date | null
  status?: string | null
  expectedUsage?: unknown
  usageAdjustment?: unknown
  actualUsage?: unknown
  actualUsageAdjustment?: unknown
  expectedCommission?: unknown
  actualCommission?: unknown
  actualCommissionAdjustment?: unknown
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
  accountIdHouse?: string | null
  accountIdVendor?: string | null
  accountIdDistributor?: string | null
  customerIdHouse?: string | null
  customerIdVendor?: string | null
  customerIdDistributor?: string | null
  locationId?: string | null
  orderIdVendor?: string | null
  orderIdDistributor?: string | null
  customerPurchaseOrder?: string | null
  owner?: { firstName?: string | null; lastName?: string | null; fullName?: string | null } | null
  ownerId?: string | null
  leadSource?: string | null
  estimatedCloseDate?: string | Date | null
  closeDate?: string | Date | null
  description?: string | null
  account?: RelatedAccount | null
  products?: (RelatedProduct | OpportunityProductWithRelations)[] | null
  revenueSchedules?: RevenueScheduleWithRelations[] | null
  activities?: ActivityWithRelations[] | null
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

export type OpportunityActivityAttachment = {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  uploadedAt: string | null
  uploadedByName: string
}

export type OpportunityActivityDetail = {
  id: string
  active: boolean
  activityDate: string | Date | null
  activityType: string | null
  activityStatus: string | null
  description: string | null
  activityOwner: string | null
  createdBy: string | null
  attachment: string
  fileName: string | null
  attachments: OpportunityActivityAttachment[]
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
  identifiers?: {
    accountIdHouse?: string | null
    accountIdVendor?: string | null
    accountIdDistributor?: string | null
    customerIdHouse?: string | null
    customerIdVendor?: string | null
    customerIdDistributor?: string | null
    locationId?: string | null
    orderIdHouse?: string | null
    orderIdVendor?: string | null
    orderIdDistributor?: string | null
    customerPurchaseOrder?: string | null
  }
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
  activities: OpportunityActivityDetail[]
  summaryMetrics?: {
    expectedUsageGrossTotal?: number
    expectedUsageAdjustmentsGrossTotal?: number
    actualUsageGrossTotal?: number
    actualUsageAdjustmentsGrossTotal?: number
    remainingUsageGrossTotal?: number
    remainingUsageAdjustmentsGrossTotal?: number
    expectedCommissionGrossTotal?: number
    expectedCommissionAdjustmentsGrossTotal?: number
    actualCommissionGrossTotal?: number
    actualCommissionAdjustmentsGrossTotal?: number
    remainingCommissionGrossTotal?: number
    remainingCommissionAdjustmentsGrossTotal?: number
    expectedCommissionHouseRepTotal?: number
    expectedCommissionSubAgentTotal?: number
    expectedCommissionHouseTotal?: number
    actualCommissionHouseRepTotal?: number
    actualCommissionSubAgentTotal?: number
    actualCommissionHouseTotal?: number
    remainingCommissionHouseRepTotal?: number
    remainingCommissionSubAgentTotal?: number
    remainingCommissionHouseTotal?: number
  }
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
  actualUsageAdjustment: number
  actualCommissionAdjustment: number
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
  const accountName = opportunity.account?.accountName ?? ""
  const formattedOpportunityId = typeof opportunity.id === "string"
    ? opportunity.id.slice(0, 8).toUpperCase()
    : ""

  // Convert percentage fields from Decimal to number
  const subagentPercent = opportunity.subagentPercent != null ? toNumber(opportunity.subagentPercent) : null
  const houseRepPercent = opportunity.houseRepPercent != null ? toNumber(opportunity.houseRepPercent) : null
  const houseSplitPercent = opportunity.houseSplitPercent != null ? toNumber(opportunity.houseSplitPercent) : null

  return {
    id: opportunity.id,
    select: false,
    active: isActive,
    status,
    type: opportunity.type ?? OpportunityType.NewBusiness,
    orderIdHouse: opportunity.orderIdHouse ?? derivedOrderId,
    accountLegalName,
    accountName,
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
    subagentPercent,
    houseRepPercent,
    houseSplitPercent,
    accountIdHouse: opportunity.accountIdHouse ?? "",
    accountIdVendor: opportunity.accountIdVendor ?? "",
    accountIdDistributor: opportunity.accountIdDistributor ?? "",
    customerIdHouse: opportunity.customerIdHouse ?? "",
    customerIdVendor: opportunity.customerIdVendor ?? "",
    customerIdDistributor: opportunity.customerIdDistributor ?? "",
    locationId: opportunity.locationId ?? "",
    orderIdVendor: opportunity.orderIdVendor ?? "",
    orderIdDistributor: opportunity.orderIdDistributor ?? "",
    customerPurchaseOrder: opportunity.customerPurchaseOrder ?? "",
    opportunityId: formattedOpportunityId,
    description: opportunity.description ?? "",
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
  const actualUsageAdjustment = toNumber((schedule as any).actualUsageAdjustment)
  const usageBalance = expectedUsageNet - actualUsage

  const expectedCommissionRaw = toNumber(schedule.expectedCommission)
  const commissionPercentCandidate = toNumber(schedule.product?.commissionPercent)
  const commissionPercentDecimal = commissionPercentCandidate > 1 ? commissionPercentCandidate / 100 : commissionPercentCandidate
  const derivedCommissionFromRate = expectedUsageNet > 0 ? expectedUsageNet * commissionPercentDecimal : 0
  const expectedCommissionGross = expectedCommissionRaw > 0 ? expectedCommissionRaw : derivedCommissionFromRate
  const expectedCommissionAdjustment = 0
  const expectedCommissionNet = expectedCommissionGross + expectedCommissionAdjustment

  const actualCommission = toNumber(schedule.actualCommission)
  const actualCommissionAdjustment = toNumber((schedule as any).actualCommissionAdjustment)
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
    actualUsageAdjustment,
    usageBalance,
    expectedCommissionGross,
    expectedCommissionAdjustment,
    expectedCommissionNet,
    actualCommission,
    actualCommissionAdjustment,
    commissionDifference,
    expectedCommissionRatePercent: expectedCommissionRateDecimal,
    actualCommissionRatePercent: actualCommissionRateDecimal,
    commissionRateDifferencePercent: commissionRateDifferenceDecimal,
    createdAt: formatDateValue(schedule.createdAt ?? null),
    updatedAt: formatDateValue(schedule.updatedAt ?? null)
  }
}

function mapActivityAttachmentSummary(attachment: ActivityAttachmentWithRelations): OpportunityActivityAttachment {
  const uploadedByName = attachment.uploadedBy
    ? `${attachment.uploadedBy.firstName ?? ""} ${attachment.uploadedBy.lastName ?? ""}`.trim()
    : ""

  return {
    id: attachment.id,
    fileName: attachment.fileName,
    fileSize: Number.isFinite(Number(attachment.fileSize)) ? Number(attachment.fileSize) : 0,
    mimeType: attachment.mimeType ?? "application/octet-stream",
    uploadedAt: formatDateValue(attachment.uploadedAt ?? null),
    uploadedByName: uploadedByName || "Unknown"
  }
}

function mapOpportunityActivity(activity: ActivityWithRelations): OpportunityActivityDetail {
  const ownerName = activity.assignee
    ? `${activity.assignee.firstName ?? ""} ${activity.assignee.lastName ?? ""}`.trim()
    : ""

  const creatorName = activity.creator
    ? `${activity.creator.firstName ?? ""} ${activity.creator.lastName ?? ""}`.trim()
    : ""

  const attachments = Array.isArray(activity.attachments)
    ? activity.attachments.map(mapActivityAttachmentSummary)
    : []

  const attachmentCount = attachments.length
  const attachmentLabel = attachmentCount === 0 ? "None" : `${attachmentCount} file${attachmentCount === 1 ? "" : "s"}`
  const primaryFileName = attachments[0]?.fileName ?? null

  const rawStatus = activity.status ?? null
  let normalizedStatus: ActivityStatus | null = null
  if (rawStatus && typeof rawStatus === "string") {
    const match = (Object.values(ActivityStatus) as string[]).find(
      candidate => candidate === rawStatus || candidate.toLowerCase() === rawStatus.toLowerCase()
    )
    normalizedStatus = match ? (match as ActivityStatus) : null
  } else if (rawStatus && typeof rawStatus === "object") {
    normalizedStatus = rawStatus as ActivityStatus
  }

  const isActive = normalizedStatus ? isActivityOpen(normalizedStatus) : false

  return {
    id: activity.id,
    active: isActive,
    activityDate: (activity.dueDate ?? activity.createdAt) ?? null,
    activityType: activity.activityType ?? null,
    activityStatus: typeof rawStatus === "string" ? rawStatus : normalizedStatus ?? null,
    description: activity.subject ?? activity.description ?? null,
    activityOwner: ownerName || null,
    createdBy: creatorName || null,
    attachment: attachmentLabel,
    fileName: primaryFileName,
    attachments
  }
}

function normalisePercent(value: unknown): number {
  const n = toNumber(value)
  if (!Number.isFinite(n)) return 0
  return n > 1 ? n / 100 : n
}

function computeSummaryMetrics(opportunity: OpportunityWithRelations, revenueSchedules: OpportunityRevenueScheduleDetail[]) {
  const sum = (arr: number[]) => arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)

  const expectedUsageGrossTotal = sum(revenueSchedules.map(r => r.expectedUsageGross))
  const expectedUsageAdjustmentsGrossTotal = sum(revenueSchedules.map(r => r.expectedUsageAdjustment))
  const actualUsageGrossTotal = sum(revenueSchedules.map(r => r.actualUsage))
  const actualUsageAdjustmentsGrossTotal = sum(revenueSchedules.map(r => r.actualUsageAdjustment ?? 0))
  const remainingUsageGrossTotal = expectedUsageGrossTotal - actualUsageGrossTotal
  const remainingUsageAdjustmentsGrossTotal = expectedUsageAdjustmentsGrossTotal - actualUsageAdjustmentsGrossTotal

  const expectedCommissionGrossTotal = sum(revenueSchedules.map(r => r.expectedCommissionGross))
  const expectedCommissionAdjustmentsGrossTotal = sum(revenueSchedules.map(r => r.expectedCommissionAdjustment))
  const actualCommissionGrossTotal = sum(revenueSchedules.map(r => r.actualCommission))
  const actualCommissionAdjustmentsGrossTotal = sum(revenueSchedules.map(r => r.actualCommissionAdjustment ?? 0))
  const remainingCommissionGrossTotal = expectedCommissionGrossTotal - actualCommissionGrossTotal
  const remainingCommissionAdjustmentsGrossTotal = expectedCommissionAdjustmentsGrossTotal - actualCommissionAdjustmentsGrossTotal

  // Allocation totals
  const repPct = normalisePercent(opportunity.houseRepPercent)
  const subPct = normalisePercent(opportunity.subagentPercent)
  const housePct = (() => {
    const explicit = normalisePercent(opportunity.houseSplitPercent)
    if (explicit > 0) return explicit
    const computed = 1 - (repPct + subPct)
    return Math.max(0, Math.min(1, computed))
  })()

  const expectedCommissionNetTotal = sum(revenueSchedules.map(r => r.expectedCommissionNet))
  const actualCommissionNetTotal = sum(revenueSchedules.map(r => r.actualCommission))

  const expectedCommissionHouseRepTotal = expectedCommissionNetTotal * repPct
  const expectedCommissionSubAgentTotal = expectedCommissionNetTotal * subPct
  const expectedCommissionHouseTotal = expectedCommissionNetTotal * housePct

  const actualCommissionHouseRepTotal = actualCommissionNetTotal * repPct
  const actualCommissionSubAgentTotal = actualCommissionNetTotal * subPct
  const actualCommissionHouseTotal = actualCommissionNetTotal * housePct

  const remainingCommissionHouseRepTotal = expectedCommissionHouseRepTotal - actualCommissionHouseRepTotal
  const remainingCommissionSubAgentTotal = expectedCommissionSubAgentTotal - actualCommissionSubAgentTotal
  const remainingCommissionHouseTotal = expectedCommissionHouseTotal - actualCommissionHouseTotal

  return {
    expectedUsageGrossTotal,
    expectedUsageAdjustmentsGrossTotal,
    actualUsageGrossTotal,
    actualUsageAdjustmentsGrossTotal,
    remainingUsageGrossTotal,
    remainingUsageAdjustmentsGrossTotal,
    expectedCommissionGrossTotal,
    expectedCommissionAdjustmentsGrossTotal,
    actualCommissionGrossTotal,
    actualCommissionAdjustmentsGrossTotal,
    remainingCommissionGrossTotal,
    remainingCommissionAdjustmentsGrossTotal,
    expectedCommissionHouseRepTotal,
    expectedCommissionSubAgentTotal,
    expectedCommissionHouseTotal,
    actualCommissionHouseRepTotal,
    actualCommissionSubAgentTotal,
    actualCommissionHouseTotal,
    remainingCommissionHouseRepTotal,
    remainingCommissionSubAgentTotal,
    remainingCommissionHouseTotal
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

  const activities = Array.isArray(opportunity.activities)
    ? opportunity.activities.map(mapOpportunityActivity)
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

  const formatAccountAddress = (addr?: RelatedAccount["shippingAddress"]): string | null => {
    if (!addr) return null
    const parts = [addr.line1, addr.line2, addr.city, addr.state, addr.postalCode]
      .map(v => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean)
    if (parts.length === 0) return null
    return parts.join(", ")
  }

  const normalizeStringOrNull = (value: unknown): string | null => {
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  const owner = {
    id: opportunity.ownerId ?? null,
    name: opportunity.owner?.fullName
      ?? `${opportunity.owner?.firstName ?? ""} ${opportunity.owner?.lastName ?? ""}`.trim()
      ?? null
  }

  const identifiers = {
    accountIdHouse: opportunity.accountIdHouse ?? null,
    accountIdVendor: opportunity.accountIdVendor ?? null,
    accountIdDistributor: opportunity.accountIdDistributor ?? null,
    customerIdHouse: opportunity.customerIdHouse ?? null,
    customerIdVendor: opportunity.customerIdVendor ?? null,
    customerIdDistributor: opportunity.customerIdDistributor ?? null,
    locationId: opportunity.locationId ?? null,
    orderIdHouse: opportunity.orderIdHouse ?? null,
    orderIdVendor: opportunity.orderIdVendor ?? null,
    orderIdDistributor: opportunity.orderIdDistributor ?? null,
    customerPurchaseOrder: opportunity.customerPurchaseOrder ?? null
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
    shippingAddress: normalizeStringOrNull(opportunity.shippingAddress) ?? formatAccountAddress(opportunity.account?.shippingAddress) ?? null,
    billingAddress: normalizeStringOrNull(opportunity.billingAddress) ?? formatAccountAddress(opportunity.account?.billingAddress) ?? null,
    subagentPercent: Number.isFinite(toNumber(opportunity.subagentPercent)) ? toNumber(opportunity.subagentPercent) : null,
    houseRepPercent: Number.isFinite(toNumber(opportunity.houseRepPercent)) ? toNumber(opportunity.houseRepPercent) : null,
    houseSplitPercent: Number.isFinite(toNumber(opportunity.houseSplitPercent)) ? toNumber(opportunity.houseSplitPercent) : null,
    account,
    owner,
    identifiers,
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
    revenueSchedules,
    summaryMetrics: computeSummaryMetrics(opportunity, revenueSchedules),
    activities
  }
}
