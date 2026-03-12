import test from "node:test"
import assert from "node:assert/strict"

import { buildCommissionAmountReview } from "../lib/reconciliation/commission-amount-review"
import { buildRateDiscrepancySummary } from "../lib/reconciliation/rate-discrepancy"

test("buildRateDiscrepancySummary: classifies higher and lower material directions", () => {
  const higher = buildRateDiscrepancySummary({
    expectedRatePercent: 10,
    receivedRatePercent: 12,
    tolerancePercent: 0.05,
  })
  const lower = buildRateDiscrepancySummary({
    expectedRatePercent: 10,
    receivedRatePercent: 8,
    tolerancePercent: 0.05,
  })

  assert.equal(higher?.direction, "higher")
  assert.equal(lower?.direction, "lower")
})

test("buildCommissionAmountReview: returns routed_low_rate when the exception is already queued", () => {
  const review = buildCommissionAmountReview({
    revenueScheduleId: "schedule-1",
    scheduleNumber: "RS-1",
    scheduleDate: "2026-03-01T00:00:00.000Z",
    remainingCommissionDifference: -2,
    hasPendingRateResolution: false,
    lowRateExceptionRouted: true,
    queuePath: "/reconciliation/low-rate-exceptions",
    ticketId: "ticket-1",
  })

  assert.equal(review.status, "routed_low_rate")
  assert.equal(review.requiresAction, false)
  assert.equal(review.queuePath, "/reconciliation/low-rate-exceptions")
  assert.equal(review.ticketId, "ticket-1")
})

test("buildCommissionAmountReview: requires flex action only for unresolved residual commission overage", () => {
  const review = buildCommissionAmountReview({
    revenueScheduleId: "schedule-1",
    scheduleNumber: "RS-1",
    scheduleDate: null,
    remainingCommissionDifference: -4.25,
    hasPendingRateResolution: false,
    lowRateExceptionRouted: false,
  })

  assert.equal(review.status, "action_required")
  assert.equal(review.requiresAction, true)
  assert.equal(review.recommendedAction, "adjust")
})
