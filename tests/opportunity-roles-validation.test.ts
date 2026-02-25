import test from "node:test"
import assert from "node:assert/strict"

import { normalizeRoleDrafts, requireAtLeastOneRole } from "../lib/opportunities/roles-validation"

test("normalizeRoleDrafts returns empty when input is missing or not an array", () => {
  assert.deepEqual(normalizeRoleDrafts(undefined), { complete: [], hasIncomplete: false })
  assert.deepEqual(normalizeRoleDrafts(null), { complete: [], hasIncomplete: false })
  assert.deepEqual(normalizeRoleDrafts({}), { complete: [], hasIncomplete: false })
})

test("normalizeRoleDrafts ignores empty rows, flags incomplete meaningful rows", () => {
  const result = normalizeRoleDrafts([
    { contactId: "", role: "" },
    { contactId: "   ", role: "   " },
    { contactId: "c1", role: "" },
    { contactId: "", role: "Decision Maker" }
  ])

  assert.equal(result.complete.length, 0)
  assert.equal(result.hasIncomplete, true)
})

test("normalizeRoleDrafts trims and returns complete rows", () => {
  const result = normalizeRoleDrafts([
    { contactId: " c1 ", role: " Decision Maker " },
    { contactId: "c2", role: "Buyer" }
  ])

  assert.deepEqual(result.complete, [
    { contactId: "c1", role: "Decision Maker" },
    { contactId: "c2", role: "Buyer" }
  ])
  assert.equal(result.hasIncomplete, false)
})

test("requireAtLeastOneRole returns correct errors", () => {
  assert.deepEqual(requireAtLeastOneRole([], false), { ok: false, error: "At least one role contact is required." })
  assert.deepEqual(requireAtLeastOneRole([{ contactId: "c1", role: "R" }], true), {
    ok: false,
    error: "Please complete or remove incomplete role rows."
  })
  assert.deepEqual(requireAtLeastOneRole([{ contactId: "c1", role: "R" }], false), { ok: true })
})

