import assert from "node:assert/strict"
import test from "node:test"

import {
  buildInlineActualTargets,
  deriveAllocationDraftFromActualTarget,
  supportsInlineActualEditing,
} from "../lib/matching/match-wizard-inline-actuals"

test("inline actual editing is only enabled for 1:1 and 1:M", () => {
  assert.equal(supportsInlineActualEditing("OneToOne"), true)
  assert.equal(supportsInlineActualEditing("OneToMany"), true)
  assert.equal(supportsInlineActualEditing("ManyToOne"), false)
  assert.equal(supportsInlineActualEditing("ManyToMany"), false)
})

test("builds inline actual targets from existing allocation drafts", () => {
  const targets = buildInlineActualTargets({
    matchType: "OneToMany",
    selectedLines: [{ id: "line-1" }] as any,
    selectedSchedules: [
      { id: "sched-1", actualUsage: 10, actualCommission: 2 },
      { id: "sched-2", actualUsage: 5, actualCommission: 1.5 },
    ] as any,
    allocations: {
      "line-1:sched-1": { usage: "3.25", commission: "0.75" },
      "line-1:sched-2": { usage: "1.00", commission: "0.25" },
    },
  })

  assert.deepEqual(targets.get("sched-1"), { usage: 13.25, commission: 2.75 })
  assert.deepEqual(targets.get("sched-2"), { usage: 6, commission: 1.75 })
})

test("translates edited actuals back into positive allocation deltas", () => {
  assert.equal(
    deriveAllocationDraftFromActualTarget({
      currentActual: 12.5,
      rawTarget: "15.75",
    }),
    "3.25",
  )
})

test("does not create negative allocations when edited actual is below current", () => {
  assert.equal(
    deriveAllocationDraftFromActualTarget({
      currentActual: 12.5,
      rawTarget: "10.00",
    }),
    "",
  )
})
