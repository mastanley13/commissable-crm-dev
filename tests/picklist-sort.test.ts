import test from "node:test"
import assert from "node:assert/strict"

import { comparePicklistLabels, sortByPicklistName, sortPicklistLabels } from "../lib/picklist-sort"

test("sortPicklistLabels sorts A–Z case-insensitively", () => {
  assert.deepEqual(sortPicklistLabels(["beta", "Alpha", "charlie"]), [
    "Alpha",
    "beta",
    "charlie",
  ])
})

test("sortPicklistLabels sorts with numeric ordering", () => {
  assert.deepEqual(sortPicklistLabels(["Tier 2", "Tier 10", "Tier 1"]), [
    "Tier 1",
    "Tier 2",
    "Tier 10",
  ])
})

test("comparePicklistLabels ignores surrounding whitespace", () => {
  assert.equal(comparePicklistLabels("  Alpha", "Alpha  "), 0)
})

test("sortByPicklistName sorts by name then id", () => {
  const sorted = sortByPicklistName([
    { id: "b", name: "Alpha" },
    { id: "a", name: "Alpha" },
    { id: "c", name: "Beta" },
  ])
  assert.deepEqual(
    sorted.map((x) => `${x.name}:${(x as any).id}`),
    ["Alpha:a", "Alpha:b", "Beta:c"]
  )
})
