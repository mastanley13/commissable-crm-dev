import { OpportunityStatus } from "@prisma/client"

type OpportunityWithRelations = {
  id: string
  status?: OpportunityStatus | string | null
  name?: string | null
  stage?: string | null
  owner?: { firstName?: string | null; lastName?: string | null } | null
  ownerId?: string | null
  leadSource?: string | null
  estimatedCloseDate?: string | Date | null
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

  return {
    id: opportunity.id,
    select: false,
    active: isActive,
    status,
    orderIdHouse: opportunity.id?.slice(0, 8)?.toUpperCase?.() ?? "",
    opportunityName: opportunity.name ?? "",
    stage: opportunity.stage ?? "",
    owner: ownerName,
    ownerId: opportunity.ownerId ?? null,
    estimatedCloseDate: opportunity.estimatedCloseDate ?? null,
    referredBy: opportunity.leadSource ?? "",
    isDeleted: !isActive
  }
}
