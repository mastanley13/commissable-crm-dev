import { OpportunityStage } from "@prisma/client"

export type FutureOpportunityStage =
  | "OnHold"
  | "ClosedWon_Provisioning"
  | "ClosedWon_Billing"
  | "ClosedWon_BillingEnded"

export type OpportunityStageValue = OpportunityStage | FutureOpportunityStage

export type OpportunityStageOption = {
  value: OpportunityStageValue
  label: string
  disabled: boolean
  disabledReason?: string
  autoManaged: boolean
}

const STAGE_ORDER: OpportunityStageValue[] = [
  OpportunityStage.Qualification,
  OpportunityStage.Discovery,
  OpportunityStage.Proposal,
  OpportunityStage.Negotiation,
  "OnHold",
  OpportunityStage.ClosedLost,
  "ClosedWon_Provisioning",
  "ClosedWon_Billing",
  "ClosedWon_BillingEnded"
]

const STAGE_LABEL_OVERRIDES: Partial<Record<OpportunityStageValue, string>> = {
  ClosedWon: "Closed Won - Provisioning (Legacy)",
  ClosedLost: "Closed Lost",
  OnHold: "On Hold",
  ClosedWon_Provisioning: "Closed Won - Provisioning",
  ClosedWon_Billing: "Closed Won - Billing",
  ClosedWon_BillingEnded: "Closed Won - Billing Ended"
}

const AUTO_MANAGED_STAGES = new Set<OpportunityStageValue>([
  "ClosedWon_Billing",
  "ClosedWon_BillingEnded"
])

const ALL_STAGE_VALUES = new Set<OpportunityStageValue>([...STAGE_ORDER, OpportunityStage.ClosedWon])

function defaultStageLabel(stage: OpportunityStageValue): string {
  return stage
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
}

export function getOpportunityStageLabel(stage: OpportunityStageValue): string {
  return STAGE_LABEL_OVERRIDES[stage] ?? defaultStageLabel(stage)
}

export function isOpportunityStageAutoManaged(stage: OpportunityStageValue): boolean {
  return AUTO_MANAGED_STAGES.has(stage)
}

export function isOpportunityStageValue(value: string | null | undefined): value is OpportunityStageValue {
  if (!value) {
    return false
  }
  return ALL_STAGE_VALUES.has(value as OpportunityStageValue)
}

function resolveDisabledReason(stage: OpportunityStageValue): string | undefined {
  if (!isOpportunityStageAutoManaged(stage)) {
    return undefined
  }
  return "Stage is automatically updated based on product billing"
}

export function getOpportunityStageOptions(
  params?: { includeFuture?: boolean }
): OpportunityStageOption[] {
  const includeLegacy = params?.includeFuture ?? true
  const stageOrder = includeLegacy ? STAGE_ORDER : STAGE_ORDER
  return stageOrder.map(value => {
    const autoManaged = isOpportunityStageAutoManaged(value)
    const disabled = autoManaged
    return {
      value,
      label: getOpportunityStageLabel(value),
      disabled,
      disabledReason: disabled ? resolveDisabledReason(value) : undefined,
      autoManaged
    }
  })
}

export function getOpportunityStageOrder(
  params?: { includeFuture?: boolean }
): OpportunityStageValue[] {
  const includeFuture = params?.includeFuture ?? true
  return includeFuture ? STAGE_ORDER.slice() : STAGE_ORDER.slice()
}
