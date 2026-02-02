import test from "node:test"
import assert from "node:assert/strict"

import {
  canonicalizeMultiValueString,
  hasMultiValueIntersection,
  parseMultiValueInput,
  parseMultiValueMatchSet,
} from "../lib/multi-value"

test("parseMultiValueInput splits on commas/semicolons/newlines", () => {
  const { values, warnings } = parseMultiValueInput("A, b;C\nD\rE")
  assert.deepEqual(values, ["A", "b", "C", "D", "E"])
  assert.deepEqual(warnings, [])
})

test("parseMultiValueInput supports quoted values with separators", () => {
  const { values, warnings } = parseMultiValueInput('A,"B, C";D')
  assert.deepEqual(values, ["A", "B, C", "D"])
  assert.deepEqual(warnings, [])
})

test("parseMultiValueInput supports escaped quotes", () => {
  const { values } = parseMultiValueInput('"A ""quoted"" value",B')
  assert.deepEqual(values, ['A "quoted" value', "B"])
})

test("parseMultiValueInput dedupes case-insensitively but preserves first casing", () => {
  const { values } = parseMultiValueInput("abc,ABC, Abc")
  assert.deepEqual(values, ["abc"])
  assert.equal(canonicalizeMultiValueString("abc,ABC, Abc"), "abc")
})

test("parseMultiValueInput skips placeholder values", () => {
  const { values } = parseMultiValueInput("N/A, --, null, foo")
  assert.deepEqual(values, ["foo"])
})

test("parseMultiValueInput enforces maxItems and emits warning", () => {
  const { values, warnings } = parseMultiValueInput("a,b,c", { maxItems: 2 })
  assert.deepEqual(values, ["a", "b"])
  assert.ok(warnings.some(warning => warning.includes("Trimmed to first 2 values.")))
})

test("parseMultiValueMatchSet normalizes values for case-insensitive matching", () => {
  const set = parseMultiValueMatchSet("a,B")
  assert.equal(set.has("A"), true)
  assert.equal(set.has("B"), true)
})

test("hasMultiValueIntersection detects overlap across separators", () => {
  assert.equal(hasMultiValueIntersection("a, b", "B; c"), true)
  assert.equal(hasMultiValueIntersection("a, b", "c, d"), false)
})

