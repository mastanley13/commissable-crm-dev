import { OpportunityStatus, OpportunityStage, OpportunityProductStatus } from "@prisma/client"

import { prisma } from "@/lib/db"
import { getOpportunityStageLabel, OpportunityStageValue, isOpportunityStageAutoManaged } from "@/lib/opportunity-stage"

export interface StageSummary {
  stage: OpportunityStageValue
  status: OpportunityStatus
}

function normalizeStage(stage: OpportunityStage | string | null | undefined): OpportunityStageValue {
  if (!stage) {
    return OpportunityStage.Qualification
  }

  const candidate = stage as OpportunityStageValue
  if (candidate === "OnHold" || candidate === "ClosedWon_Provisioning" || candidate === "ClosedWon_Billing" || candidate === "ClosedWon_BillingEnded") {
    return candidate
  }

  if ((Object.values(OpportunityStage) as string[]).includes(candidate)) {
    return candidate as OpportunityStage
  }

  return OpportunityStage.Qualification
}

export function deriveStatusFromStage(stage: OpportunityStageValue): OpportunityStatus {
  switch (stage) {
    case "OnHold":
      return OpportunityStatus.OnHold
    case "ClosedWon_Provisioning":
    case "ClosedWon_Billing":
    case "ClosedWon_BillingEnded":
    case OpportunityStage.ClosedWon:
      return OpportunityStatus.Won
    case OpportunityStage.ClosedLost:
      return OpportunityStatus.Lost
    default:
      return OpportunityStatus.Open
  }
}

function mapProductStatuses(products: Array<{ status: OpportunityProductStatus | null | undefined }>): OpportunityProductStatus[] {
  return products
    .map(item => item.status ?? OpportunityProductStatus.Provisioning)
}

function deriveStageFromProductStatuses(statuses: OpportunityProductStatus[], existingStage: OpportunityStageValue): OpportunityStageValue {
  if (statuses.length === 0) {
    if (existingStage === OpportunityStage.ClosedWon || existingStage === "ClosedWon_Billing" || existingStage === "ClosedWon_BillingEnded") {
      return "ClosedWon_Provisioning"
    }
    return existingStage
  }

  const hasActive = statuses.some(status => status === OpportunityProductStatus.ActiveBilling)
  if (hasActive) {
    return "ClosedWon_Billing"
  }

  const relevantStatuses = statuses.filter(status => status !== OpportunityProductStatus.Cancelled)
  if (relevantStatuses.length > 0 && relevantStatuses.every(status => status === OpportunityProductStatus.BillingEnded)) {
    return "ClosedWon_BillingEnded"
  }

  return "ClosedWon_Provisioning"
}

export async function deriveStageFromProducts(opportunityId: string): Promise<OpportunityStageValue> {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      stage: true,
      status: true,
      products: {
        select: { status: true }
      }
    }
  })

  if (!opportunity) {
    return OpportunityStage.Qualification
  }

  const currentStage = normalizeStage(opportunity.stage)
  const productStatuses = mapProductStatuses(opportunity.products ?? [])

  if (productStatuses.length === 0) {
    return currentStage
  }

  return deriveStageFromProductStatuses(productStatuses, currentStage)
}

export async function recalculateOpportunityStage(opportunityId: string): Promise<StageSummary | null> {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      id: true,
      stage: true,
      status: true,
      products: {
        select: { status: true }
      }
    }
  })

  if (!opportunity) {
    return null
  }

  const currentStage = normalizeStage(opportunity.stage)
  const productStatuses = mapProductStatuses(opportunity.products ?? [])

  if (productStatuses.length === 0) {
    if (currentStage === OpportunityStage.ClosedWon) {
      const stage = "ClosedWon_Provisioning"
      const status = deriveStatusFromStage(stage)
      await prisma.opportunity.update({
        where: { id: opportunityId },
        data: { stage, status }
      })
      return { stage, status }
    }
    return { stage: currentStage, status: deriveStatusFromStage(currentStage) }
  }

  const nextStage = deriveStageFromProductStatuses(productStatuses, currentStage)
  const nextStatus = deriveStatusFromStage(nextStage)

  if (nextStage === currentStage && nextStatus === opportunity.status) {
    return { stage: currentStage, status: nextStatus }
  }

  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { stage: nextStage, status: nextStatus }
  })

  return { stage: nextStage, status: nextStatus }
}

export function validateStageTransition(
  desiredStage: OpportunityStageValue,
  existingStage: OpportunityStageValue,
  productStatuses: OpportunityProductStatus[]
) {
  const hasActiveBilling = productStatuses.some(status => status === OpportunityProductStatus.ActiveBilling)
  if (hasActiveBilling && desiredStage !== "ClosedWon_Billing") {
    throw new Error("Stage is locked to Closed Won - Billing while products are Active - Billing")
  }

  const relevantStatuses = productStatuses.filter(status => status !== OpportunityProductStatus.Cancelled)
  const allBillingEnded = relevantStatuses.length > 0 && relevantStatuses.every(status => status === OpportunityProductStatus.BillingEnded)
  if (allBillingEnded && desiredStage !== "ClosedWon_BillingEnded") {
    throw new Error("Stage is locked to Closed Won - Billing Ended once all products have ended billing")
  }

  if (isOpportunityStageAutoManaged(desiredStage)) {
    throw new Error(`${getOpportunityStageLabel(desiredStage)} is managed automatically by product billing status`)
  }

  if (desiredStage === "ClosedWon_Provisioning") {
    return
  }

  if (desiredStage === "ClosedWon_Billing" || desiredStage === "ClosedWon_BillingEnded") {
    throw new Error(`${getOpportunityStageLabel(desiredStage)} is managed automatically by product billing status`)
  }

  if (desiredStage === "OnHold" && deriveStatusFromStage(existingStage) === OpportunityStatus.Won) {
    throw new Error("Cannot move won opportunities to On Hold without reopening them")
  }
}

export async function fetchOpportunityProductStatuses(opportunityId: string): Promise<OpportunityProductStatus[]> {
  const products = await prisma.opportunityProduct.findMany({
    where: { opportunityId },
    select: { status: true }
  })
  return mapProductStatuses(products)
}
