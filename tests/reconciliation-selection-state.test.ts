import assert from "node:assert/strict"
import test from "node:test"

import {
  filterVisibleSelections,
  resetReconciliationSelectionState,
} from "../lib/matching/reconciliation-selection-state"

test("REC-UI-12: resetReconciliationSelectionState clears all visible and hidden match selections", () => {
  assert.deepEqual(resetReconciliationSelectionState(), {
    selectedLineId: null,
    selectedLineItems: [],
    selectedSchedules: [],
  })
})

test("REC-UI-12: filterVisibleSelections drops stale hidden ids and does not re-add cleared rows on refresh", () => {
  assert.deepEqual(filterVisibleSelections(["line-1", "line-2"], ["line-2", "line-3"]), ["line-2"])
  assert.deepEqual(filterVisibleSelections([], ["line-1", "line-2"]), [])
})
