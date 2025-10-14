import { OpportunityStatus, OpportunityStage } from "@prisma/client"

type RelatedAccount = {
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

type OpportunityWithRelations = {
  id: string
  status?: OpportunityStatus | string | null
  name?: string | null
  orderIdHouse?: string | null
  stage?: OpportunityStage | string | null
  distributorName?: string | null
  vendorName?: string | null
  referredBy?: string | null
  owner?: { firstName?: string | null; lastName?: string | null; fullName?: string | null } | null
  ownerId?: string | null
  leadSource?: string | null
  estimatedCloseDate?: string | Date | null
  closeDate?: string | Date | null
  description?: string | null
  account?: RelatedAccount | null
  products?: RelatedProduct[] | null
  expectedCommission?: unknown
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
