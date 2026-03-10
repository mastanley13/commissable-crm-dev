import test from "node:test"
import assert from "node:assert/strict"

import { getLockedColumnLayout } from "../lib/table-column-locking"

test("locked columns render before unlocked columns and preserve saved order within each group", () => {
  const result = getLockedColumnLayout([
    { id: "vendor", width: 180, locked: false },
    { id: "status", width: 120, locked: true },
    { id: "account", width: 220, locked: false },
    { id: "line", width: 100, locked: true },
  ])

  assert.deepEqual(result.renderColumns.map(column => column.id), ["status", "line", "vendor", "account"])
  assert.deepEqual(result.lockedLeftOffsets, { status: 0, line: 120 })
  assert.equal(result.lastLockedColumnId, "line")
})

test("hidden locked columns are excluded from rendered pinned layout", () => {
  const result = getLockedColumnLayout([
    { id: "vendor", width: 180, locked: false },
    { id: "status", width: 120, locked: true, hidden: true },
    { id: "account", width: 220, locked: true },
  ])

  assert.deepEqual(result.renderColumns.map(column => column.id), ["account", "vendor"])
  assert.deepEqual(result.lockedLeftOffsets, { account: 0 })
  assert.equal(result.lastLockedColumnId, "account")
})
