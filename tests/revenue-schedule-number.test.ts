import test from "node:test"
import assert from "node:assert/strict"

import { deriveNextChildRevenueScheduleName } from "../lib/revenue-schedule-number"

test("deriveNextChildRevenueScheduleName returns .1 when no children exist", () => {
  const result = deriveNextChildRevenueScheduleName("12698", [])
  assert.equal(result, "12698.1")
})

test("deriveNextChildRevenueScheduleName increments the highest numeric suffix", () => {
  const result = deriveNextChildRevenueScheduleName("12698", ["12698.1", "12698.3", "12698.2"])
  assert.equal(result, "12698.4")
})

test("deriveNextChildRevenueScheduleName ignores unrelated child schedule formats", () => {
  const result = deriveNextChildRevenueScheduleName("12698", ["12698.1", "FLEX-12698", "12698.child", "12700.1"])
  assert.equal(result, "12698.2")
})

test("deriveNextChildRevenueScheduleName returns null without a parent schedule number", () => {
  const result = deriveNextChildRevenueScheduleName("", ["12698.1"])
  assert.equal(result, null)
})
