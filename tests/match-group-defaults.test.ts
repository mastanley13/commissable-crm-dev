import test from "node:test"
import assert from "node:assert/strict"

import { buildDefaultAllocationsForMatchGroup } from "../lib/matching/match-group-preview"

test("MATCH-GROUP: ManyToMany defaults allocate FIFO across schedules", () => {
  const allocations = buildDefaultAllocationsForMatchGroup({
    matchType: "ManyToMany",
    lines: [
      { id: "l1", usageUnallocated: 100, commissionUnallocated: 10, lineNumber: 1, createdAt: new Date("2026-01-01") },
      { id: "l2", usageUnallocated: 50, commissionUnallocated: 5, lineNumber: 2, createdAt: new Date("2026-01-01") },
    ],
    schedules: [
      { id: "s1", expectedUsageNet: 80, expectedCommissionNet: 8, scheduleDate: new Date("2025-01-01"), createdAt: new Date("2025-01-01") },
      { id: "s2", expectedUsageNet: 70, expectedCommissionNet: 7, scheduleDate: new Date("2025-02-01"), createdAt: new Date("2025-02-01") },
    ],
  })

  assert.deepEqual(allocations, [
    { lineId: "l1", scheduleId: "s1", usageAmount: 80, commissionAmount: 8 },
    { lineId: "l1", scheduleId: "s2", usageAmount: 20, commissionAmount: 2 },
    { lineId: "l2", scheduleId: "s2", usageAmount: 50, commissionAmount: 5 },
  ])
})

test("MATCH-GROUP: ManyToMany defaults fall back when capacities are zero", () => {
  const allocations = buildDefaultAllocationsForMatchGroup({
    matchType: "ManyToMany",
    lines: [{ id: "l1", usageUnallocated: 10, commissionUnallocated: 0 }],
    schedules: [{ id: "s1", expectedUsageNet: 0, expectedCommissionNet: 0 }],
  })

  assert.deepEqual(allocations, [{ lineId: "l1", scheduleId: "s1", usageAmount: 10, commissionAmount: 0 }])
})

