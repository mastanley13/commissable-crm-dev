import test from "node:test"
import assert from "node:assert/strict"

import { classifyMatchSelection } from "../lib/matching/match-selection"

test("MATCH-002: classifyMatchSelection rejects empty selections", () => {
  const result = classifyMatchSelection({ lineIds: [], scheduleIds: [] })
  assert.equal(result.ok, false)
})

test("MATCH-002: classifyMatchSelection detects OneToOne", () => {
  const result = classifyMatchSelection({ lineIds: ["l1"], scheduleIds: ["s1"] })
  assert.deepEqual(result, { ok: true, type: "OneToOne", lineCount: 1, scheduleCount: 1 })
})

test("MATCH-002: classifyMatchSelection detects OneToMany", () => {
  const result = classifyMatchSelection({ lineIds: ["l1"], scheduleIds: ["s1", "s2"] })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.type, "OneToMany")
})

test("MATCH-002: classifyMatchSelection detects ManyToOne", () => {
  const result = classifyMatchSelection({ lineIds: ["l1", "l2"], scheduleIds: ["s1"] })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.type, "ManyToOne")
})

test("MATCH-002: classifyMatchSelection detects ManyToMany", () => {
  const result = classifyMatchSelection({ lineIds: ["l1", "l2"], scheduleIds: ["s1", "s2"] })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.type, "ManyToMany")
})

