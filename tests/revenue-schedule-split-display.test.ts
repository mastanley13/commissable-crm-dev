import test from "node:test"
import assert from "node:assert/strict"

import { computeRevenueScheduleSplitDisplay } from "../lib/revenue-schedule-math"

test("computeRevenueScheduleSplitDisplay keeps percent and amount totals aligned", () => {
  const result = computeRevenueScheduleSplitDisplay({
    houseSplitPercent: "20.00%",
    houseRepSplitPercent: "30.00%",
    subagentSplitPercent: "50.00%",
    totalCommission: 1000
  })

  assert.equal(result.housePercent, "20.00%")
  assert.equal(result.houseRepPercent, "30.00%")
  assert.equal(result.subagentPercent, "50.00%")
  assert.equal(result.totalPercent, "100.00%")
  assert.equal(result.houseAmount, "$200.00")
  assert.equal(result.houseRepAmount, "$300.00")
  assert.equal(result.subagentAmount, "$500.00")
  assert.equal(result.totalAmount, "$1,000.00")
})

test("computeRevenueScheduleSplitDisplay supports legacy fraction-style split inputs", () => {
  const result = computeRevenueScheduleSplitDisplay({
    houseSplitPercent: "0.2",
    houseRepSplitPercent: "0.3",
    subagentSplitPercent: "0.5",
    totalCommission: 250
  })

  assert.equal(result.totalPercent, "100.00%")
  assert.equal(result.houseAmount, "$50.00")
  assert.equal(result.houseRepAmount, "$75.00")
  assert.equal(result.subagentAmount, "$125.00")
  assert.equal(result.totalAmount, "$250.00")
})

test("computeRevenueScheduleSplitDisplay leaves totals blank when no split values are present", () => {
  const result = computeRevenueScheduleSplitDisplay({
    houseSplitPercent: null,
    houseRepSplitPercent: null,
    subagentSplitPercent: null,
    totalCommission: 500
  })

  assert.equal(result.totalPercent, "--")
  assert.equal(result.houseAmount, "--")
  assert.equal(result.houseRepAmount, "--")
  assert.equal(result.subagentAmount, "--")
  assert.equal(result.totalAmount, "--")
})
