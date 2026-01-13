import test from "node:test"
import assert from "node:assert/strict"

import { evaluateFlexDecision } from "../lib/flex/revenue-schedule-flex-decision"

test("evaluateFlexDecision returns none for underpayment or exact match", () => {
  const underpaid = evaluateFlexDecision({
    expectedUsageNet: 100,
    usageBalance: 5,
    varianceTolerance: 0.1,
    hasNegativeLine: false,
    expectedCommissionNet: 10,
    commissionDifference: 2,
  })
  assert.equal(underpaid.action, "none")

  const exact = evaluateFlexDecision({
    expectedUsageNet: 100,
    usageBalance: 0,
    varianceTolerance: 0.1,
    hasNegativeLine: false,
    expectedCommissionNet: 10,
    commissionDifference: 0,
  })
  assert.equal(exact.action, "none")
})

test("evaluateFlexDecision returns auto_adjust for overage within tolerance", () => {
  // expected 100, actual 105 => usageBalance = -5 (overage 5)
  const result = evaluateFlexDecision({
    expectedUsageNet: 100,
    usageBalance: -5,
    varianceTolerance: 0.1, // tolerance amount 10
    hasNegativeLine: false,
    expectedCommissionNet: 10,
    commissionDifference: -0.2,
  })

  assert.equal(result.action, "auto_adjust")
  assert.equal(result.overageAboveTolerance, false)
  assert.equal(result.usageOverage, 5)
})

test("evaluateFlexDecision returns prompt for overage above tolerance", () => {
  // expected 100, actual 120 => usageBalance = -20 (overage 20)
  const result = evaluateFlexDecision({
    expectedUsageNet: 100,
    usageBalance: -20,
    varianceTolerance: 0.1, // tolerance amount 10
    hasNegativeLine: false,
    expectedCommissionNet: 10,
    commissionDifference: -0.5,
  })

  assert.equal(result.action, "prompt")
  assert.equal(result.overageAboveTolerance, true)
  assert.deepEqual(result.allowedPromptOptions, ["Adjust", "Manual", "FlexProduct"])
})

test("evaluateFlexDecision considers commission overage when usage has no overage", () => {
  const result = evaluateFlexDecision({
    expectedUsageNet: 0,
    usageBalance: 0,
    varianceTolerance: 0.1,
    hasNegativeLine: false,
    expectedCommissionNet: 100,
    commissionDifference: -5, // overage 5, within tolerance 10
  })

  assert.equal(result.action, "auto_adjust")
  assert.equal(result.overageAboveTolerance, false)
})

test("evaluateFlexDecision prompts when commission overage exceeds tolerance", () => {
  const result = evaluateFlexDecision({
    expectedUsageNet: 0,
    usageBalance: 0,
    varianceTolerance: 0.1,
    hasNegativeLine: false,
    expectedCommissionNet: 100,
    commissionDifference: -25, // overage 25, tolerance 10
  })

  assert.equal(result.action, "prompt")
  assert.equal(result.overageAboveTolerance, true)
})

test("evaluateFlexDecision removes FlexProduct option for bonus-like schedules", () => {
  const result = evaluateFlexDecision({
    expectedUsageNet: 100,
    usageBalance: -20,
    varianceTolerance: 0.1,
    hasNegativeLine: false,
    isBonusLike: true,
    expectedCommissionNet: 10,
    commissionDifference: -0.5,
  })

  assert.equal(result.action, "prompt")
  assert.deepEqual(result.allowedPromptOptions, ["Adjust", "Manual"])
})

test("evaluateFlexDecision returns auto_chargeback when a negative line is detected", () => {
  const result = evaluateFlexDecision({
    expectedUsageNet: 100,
    usageBalance: -2,
    varianceTolerance: 0.1,
    hasNegativeLine: true,
  })

  assert.equal(result.action, "auto_chargeback")
})
