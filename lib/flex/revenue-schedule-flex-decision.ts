export type FlexDecisionAction = "none" | "auto_adjust" | "prompt" | "auto_chargeback"

export type FlexPromptOption = "Adjust" | "Manual" | "FlexProduct"

export interface FlexDecisionInput {
  expectedUsageNet: number
  usageBalance: number
  varianceTolerance: number
  hasNegativeLine: boolean
  isBonusLike?: boolean
  expectedCommissionNet?: number
  commissionDifference?: number
}

export interface FlexDecisionResult {
  action: FlexDecisionAction
  usageOverage: number
  usageUnderpayment: number
  usageToleranceAmount: number
  overageAboveTolerance: boolean
  allowedPromptOptions: FlexPromptOption[]
}

const EPSILON = 0.005

function normalizeTolerance(raw: unknown): number {
  const numeric = Number(raw ?? 0)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(1, numeric))
}

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

export function evaluateFlexDecision(input: FlexDecisionInput): FlexDecisionResult {
  const expectedUsageNet = toFiniteNumber(input.expectedUsageNet)
  const usageBalance = toFiniteNumber(input.usageBalance)
  const tolerance = normalizeTolerance(input.varianceTolerance)
  const isBonusLike = Boolean(input.isBonusLike)

  const usageToleranceAmount = Math.max(Math.abs(expectedUsageNet) * tolerance, EPSILON)
  const usageOverage = usageBalance < 0 ? Math.abs(usageBalance) : 0
  const usageUnderpayment = usageBalance > 0 ? usageBalance : 0

  const overageAboveTolerance = usageOverage > usageToleranceAmount + EPSILON

  if (input.hasNegativeLine) {
    return {
      action: "auto_chargeback",
      usageOverage,
      usageUnderpayment,
      usageToleranceAmount,
      overageAboveTolerance,
      allowedPromptOptions: [],
    }
  }

  if (usageOverage <= EPSILON) {
    return {
      action: "none",
      usageOverage,
      usageUnderpayment,
      usageToleranceAmount,
      overageAboveTolerance: false,
      allowedPromptOptions: [],
    }
  }

  if (!overageAboveTolerance) {
    return {
      action: "auto_adjust",
      usageOverage,
      usageUnderpayment,
      usageToleranceAmount,
      overageAboveTolerance: false,
      allowedPromptOptions: [],
    }
  }

  return {
    action: "prompt",
    usageOverage,
    usageUnderpayment,
    usageToleranceAmount,
    overageAboveTolerance: true,
    allowedPromptOptions: isBonusLike ? ["Adjust", "Manual"] : ["Adjust", "Manual", "FlexProduct"],
  }
}
