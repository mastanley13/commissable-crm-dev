import test from "node:test"
import assert from "node:assert/strict"
import { formatRevenueScheduleDisplayName } from "../lib/flex/revenue-schedule-display"

test("formatRevenueScheduleDisplayName keeps -flex suffix for FlexProduct", () => {
  const result = formatRevenueScheduleDisplayName({
    scheduleNumber: "12582-flex",
    fallbackId: "fallback",
    flexClassification: "FlexProduct",
  })
  assert.equal(result, "12582-flex")
})

test("formatRevenueScheduleDisplayName appends -F when FlexProduct has no suffix", () => {
  const result = formatRevenueScheduleDisplayName({
    scheduleNumber: "12582",
    fallbackId: "fallback",
    flexClassification: "FlexProduct",
  })
  assert.equal(result, "12582-F")
})

test("formatRevenueScheduleDisplayName preserves child-number style FlexProduct scheduleNumber", () => {
  const result = formatRevenueScheduleDisplayName({
    scheduleNumber: "12582.1",
    fallbackId: "fallback",
    flexClassification: "FlexProduct",
  })
  assert.equal(result, "12582.1")
})

