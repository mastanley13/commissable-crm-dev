const EPSILON = 0.005

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

export type CommissionAmountReviewStatus =
  | "clear"
  | "action_required"
  | "routed_low_rate"
  | "pending_rate_resolution"

export type CommissionAmountReviewPayload = {
  revenueScheduleId: string
  scheduleNumber: string
  scheduleDate: string | null
  status: CommissionAmountReviewStatus
  requiresAction: boolean
  remainingCommissionDifference: number
  message: string
  recommendedAction: "none" | "adjust" | "flex-product"
  queuePath: string | null
  ticketId: string | null
}

export function buildCommissionAmountReview(params: {
  revenueScheduleId: string
  scheduleNumber: string
  scheduleDate: string | null
  remainingCommissionDifference: number
  hasPendingRateResolution: boolean
  lowRateExceptionRouted: boolean
  queuePath?: string | null
  ticketId?: string | null
}) {
  const remainingCommissionDifference = roundCurrency(params.remainingCommissionDifference)
  const remainingAmount = Math.abs(remainingCommissionDifference)

  if (params.hasPendingRateResolution) {
    return {
      revenueScheduleId: params.revenueScheduleId,
      scheduleNumber: params.scheduleNumber,
      scheduleDate: params.scheduleDate,
      status: "pending_rate_resolution",
      requiresAction: false,
      remainingCommissionDifference,
      message: "Complete commission-rate review first. Commission amount validation unlocks after Step 2.",
      recommendedAction: "none",
      queuePath: params.queuePath ?? null,
      ticketId: params.ticketId ?? null,
    } satisfies CommissionAmountReviewPayload
  }

  if (params.lowRateExceptionRouted) {
    return {
      revenueScheduleId: params.revenueScheduleId,
      scheduleNumber: params.scheduleNumber,
      scheduleDate: params.scheduleDate,
      status: "routed_low_rate",
      requiresAction: false,
      remainingCommissionDifference,
      message:
        "This remaining commission amount is already preserved in the low-rate exception workflow. No separate Step 3 action is required.",
      recommendedAction: "none",
      queuePath: params.queuePath ?? null,
      ticketId: params.ticketId ?? null,
    } satisfies CommissionAmountReviewPayload
  }

  if (remainingCommissionDifference < -EPSILON) {
    return {
      revenueScheduleId: params.revenueScheduleId,
      scheduleNumber: params.scheduleNumber,
      scheduleDate: params.scheduleDate,
      status: "action_required",
      requiresAction: true,
      remainingCommissionDifference,
      message: `A remaining commission overage of $${remainingAmount.toFixed(2)} still needs handling through the flex-adjustment path.`,
      recommendedAction: "adjust",
      queuePath: params.queuePath ?? null,
      ticketId: params.ticketId ?? null,
    } satisfies CommissionAmountReviewPayload
  }

  return {
    revenueScheduleId: params.revenueScheduleId,
    scheduleNumber: params.scheduleNumber,
    scheduleDate: params.scheduleDate,
    status: "clear",
    requiresAction: false,
    remainingCommissionDifference,
    message: "No remaining commission amount exception is left after the earlier reconciliation steps.",
    recommendedAction: "none",
    queuePath: params.queuePath ?? null,
    ticketId: params.ticketId ?? null,
  } satisfies CommissionAmountReviewPayload
}
