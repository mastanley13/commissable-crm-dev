import test from "node:test"
import assert from "node:assert/strict"

import { normalizePercentFractionValue } from "../lib/number-format"

test("normalizePercentFractionValue: keeps fraction values", () => {
  assert.equal(normalizePercentFractionValue(0.16), 0.16)
  assert.equal(normalizePercentFractionValue(1.2), 1.2)
})

test("normalizePercentFractionValue: converts whole-percent values to fractions", () => {
  assert.equal(normalizePercentFractionValue(16), 0.16)
  assert.equal(normalizePercentFractionValue(-16), -0.16)
})

