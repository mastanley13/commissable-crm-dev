import test from "node:test"
import assert from "node:assert/strict"

import {
  canMoveItemWithinLockGroup,
  moveItemWithinLockGroup,
  normalizeLockedColumnGroup,
  setItemLocked,
} from "../lib/column-chooser-ordering"

test("locking an unlocked item appends it to the end of the locked group", () => {
  const result = setItemLocked(
    [
      { id: "lineItem", locked: true },
      { id: "otherProductName", locked: true },
      { id: "usageAllocated", locked: false },
      { id: "vendorName", locked: false },
    ],
    "usageAllocated",
    true
  )

  assert.deepEqual(result.map(item => item.id), [
    "lineItem",
    "otherProductName",
    "usageAllocated",
    "vendorName",
  ])
})

test("unlocking a locked item moves it to the top of the unlocked group", () => {
  const result = setItemLocked(
    [
      { id: "lineItem", locked: true },
      { id: "otherProductName", locked: true },
      { id: "usageAllocated", locked: false },
      { id: "vendorName", locked: false },
    ],
    "otherProductName",
    false
  )

  assert.deepEqual(result.map(item => item.id), [
    "lineItem",
    "otherProductName",
    "usageAllocated",
    "vendorName",
  ])
  assert.deepEqual(result.map(item => item.locked), [true, false, false, false])
})

test("manual moves stay within the item lock group", () => {
  const items = [
    { id: "lineItem", locked: true },
    { id: "otherProductName", locked: true },
    { id: "usageAllocated", locked: false },
    { id: "vendorName", locked: false },
  ]

  assert.equal(canMoveItemWithinLockGroup(items, "otherProductName", 1), false)
  assert.equal(canMoveItemWithinLockGroup(items, "usageAllocated", -1), false)

  const movedLocked = moveItemWithinLockGroup(items, "otherProductName", -1)
  assert.deepEqual(movedLocked.map(item => item.id), [
    "otherProductName",
    "lineItem",
    "usageAllocated",
    "vendorName",
  ])

  const movedUnlocked = moveItemWithinLockGroup(items, "vendorName", -1)
  assert.deepEqual(movedUnlocked.map(item => item.id), [
    "lineItem",
    "otherProductName",
    "vendorName",
    "usageAllocated",
  ])
})

test("normalization keeps locked items first while preserving order within each group", () => {
  const result = normalizeLockedColumnGroup([
    { id: "usageAllocated", locked: false },
    { id: "lineItem", locked: true },
    { id: "vendorName", locked: false },
    { id: "otherProductName", locked: true },
  ])

  assert.deepEqual(result.map(item => item.id), [
    "lineItem",
    "otherProductName",
    "usageAllocated",
    "vendorName",
  ])
})
