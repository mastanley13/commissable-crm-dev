import test from "node:test"
import assert from "node:assert/strict"

import {
  computeRevenueScheduleMetricsFromDisplay,
  formatSignedCurrencyDiff,
  formatSignedPercentDiff,
  isBlankDisplay,
  parseCurrencyDisplay,
  parsePercentFractionDisplay
} from "../lib/revenue-schedule-math"

test("isBlankDisplay treats placeholders as blank", () => {
  assert.equal(isBlankDisplay(null), true)
  assert.equal(isBlankDisplay(undefined), true)
  assert.equal(isBlankDisplay(""), true)
  assert.equal(isBlankDisplay("   "), true)
  assert.equal(isBlankDisplay("-"), true)
  assert.equal(isBlankDisplay("--"), true)
  assert.equal(isBlankDisplay("$0.00"), false)
})

test("parseCurrencyDisplay supports parentheses negatives", () => {
  assert.equal(parseCurrencyDisplay("$1,234.56"), 1234.56)
  assert.equal(parseCurrencyDisplay("($1,234.56)"), -1234.56)
  assert.equal(parseCurrencyDisplay("-$1,234.56"), -1234.56)
  assert.equal(parseCurrencyDisplay("--"), null)
})

test("parsePercentFractionDisplay accepts %, whole, and fraction inputs", () => {
  assert.equal(parsePercentFractionDisplay("18%"), 0.18)
  assert.equal(parsePercentFractionDisplay("18"), 0.18)
  assert.equal(parsePercentFractionDisplay("0.18"), 0.18)
  assert.equal(parsePercentFractionDisplay("(18.00%)"), -0.18)
})

test("computeRevenueScheduleMetricsFromDisplay computes usage gross/net and diffs", () => {
  const computed = computeRevenueScheduleMetricsFromDisplay({
    quantity: "2",
    priceEach: "$10.00",
    expectedUsageAdjustment: "$1.00",
    actualUsage: "$0.00"
  })

  assert.equal(computed.expectedUsageGross, 20)
  assert.equal(computed.expectedUsageNet, 21)
  assert.equal(computed.usageDifference, 21)
})

test("computeRevenueScheduleMetricsFromDisplay derives expected/actual rates when fields missing", () => {
  const computed = computeRevenueScheduleMetricsFromDisplay({
    expectedUsageGross: "$100.00",
    expectedUsageAdjustment: "$0.00",
    expectedCommissionNet: "$10.00",
    actualUsage: "$50.00",
    actualCommission: "$4.00"
  })

  assert.equal(computed.expectedUsageNet, 100)
  assert.equal(computed.expectedRateFraction, 0.1)
  assert.equal(computed.actualRateFraction, 0.08)
  assert.ok(Math.abs((computed.commissionRateDifferenceFraction ?? 0) - 0.02) < 1e-12)
})

test("computeRevenueScheduleMetricsFromDisplay returns null diffs when nothing present", () => {
  const computed = computeRevenueScheduleMetricsFromDisplay({})
  assert.equal(computed.hasUsageInputs, false)
  assert.equal(computed.hasCommissionInputs, false)
  assert.equal(computed.usageDifference, null)
  assert.equal(computed.commissionDifference, null)
  assert.equal(computed.commissionRateDifferenceFraction, null)
})

test("formatSignedCurrencyDiff and formatSignedPercentDiff", () => {
  assert.equal(formatSignedCurrencyDiff(null), "--")
  assert.equal(formatSignedCurrencyDiff(0), "$0.00")
  assert.equal(formatSignedCurrencyDiff(5), "+$5.00")
  assert.equal(formatSignedCurrencyDiff(-5), "-$5.00")

  assert.equal(formatSignedPercentDiff(null), "--")
  assert.equal(formatSignedPercentDiff(0), "0.00%")
  assert.equal(formatSignedPercentDiff(0.1), "+10.00%")
  assert.equal(formatSignedPercentDiff(-0.1), "-10.00%")
})
