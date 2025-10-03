import { OpportunityStatus } from "@prisma/client"

type OpportunityWithRelations = {
  id: string
  status?: OpportunityStatus | string | null
  name?: string | null
  orderIdHouse?: string | null
  stage?: string | null
  distributorName?: string | null
  vendorName?: string | null
  referredBy?: string | null
  owner?: { firstName?: string | null; lastName?: string | null } | null
  ownerId?: string | null
  leadSource?: string | null
  estimatedCloseDate?: string | Date | null
  closeDate?: string | Date | null
  description?: string | null
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
    if (values.includes(status)) {
      return status as OpportunityStatus
    }
  }

  return OpportunityStatus.Open
}

export function mapOpportunityToRow(opportunity: OpportunityWithRelations) {
  const ownerName = opportunity.owner
    ? `${opportunity.owner.firstName ?? ""} ${opportunity.owner.lastName ?? ""}`.trim()
    : ""

  const status = normalizeStatus(opportunity.status)

  const isActive = status === OpportunityStatus.Open || status === OpportunityStatus.OnHold

  const subAgent = extractSubAgent(opportunity.description ?? "")

  return {
    id: opportunity.id,
    select: false,
    active: isActive,
    status,
    orderIdHouse: opportunity.orderIdHouse ?? "",
    opportunityName: opportunity.name ?? "",
    stage: opportunity.stage ?? "",
    distributorName: opportunity.distributorName ?? "",
    vendorName: opportunity.vendorName ?? "",
    referredBy: opportunity.referredBy ?? opportunity.leadSource ?? "",
    owner: ownerName,
    ownerId: opportunity.ownerId ?? null,
    closeDate: opportunity.closeDate ?? opportunity.estimatedCloseDate ?? null,
    subAgent,
    accountIdVendor: opportunity.vendorName ?? "",
    customerIdVendor: "",
    locationId: "",
    orderIdVendor: "",
    isDeleted: !isActive
  }
}
