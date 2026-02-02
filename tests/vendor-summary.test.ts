import test from "node:test"
import assert from "node:assert/strict"

import type { DepositLineItemRow } from "@/lib/mock-data"
import { buildVendorSummary } from "@/lib/reconciliation/vendor-summary"

function makeLine(overrides: Partial<DepositLineItemRow>): DepositLineItemRow {
  return {
    id: "line-1",
    status: "Unmatched",
    paymentDate: "2026-02-01",
    accountName: "Account",
    vendorName: "Vendor",
    lineItem: 1,
    productName: "Product",
    partNumber: "PN",
    usage: 0,
    usageAllocated: 0,
    usageUnallocated: 0,
    commission: 0,
    commissionAllocated: 0,
    commissionUnallocated: 0,
    commissionRate: 0,
    accountId: "A1",
    customerIdVendor: "",
    orderIdVendor: "",
    distributorName: "Distributor",
    ...overrides,
  }
}

test("buildVendorSummary groups by vendor and sums allocated/unallocated", () => {
  const summary = buildVendorSummary([
    makeLine({
      id: "a",
      vendorName: "Lingo",
      usageAllocated: 100,
      usageUnallocated: 25,
      commissionAllocated: 10,
      commissionUnallocated: 2,
    }),
    makeLine({
      id: "b",
      vendorName: "Lingo",
      usageAllocated: 50,
      usageUnallocated: 0,
      commissionAllocated: 5,
      commissionUnallocated: 0,
    }),
    makeLine({
      id: "c",
      vendorName: "Telarus",
      usageAllocated: 0,
      usageUnallocated: 300,
      commissionAllocated: 0,
      commissionUnallocated: 30,
    }),
  ])

  assert.equal(summary.totals.vendorCount, 2)
  assert.equal(summary.totals.lineCount, 3)
  assert.equal(summary.totals.lineCountWithUnallocated, 2)
  assert.equal(summary.totals.usageAllocated, 150)
  assert.equal(summary.totals.usageUnallocated, 325)
  assert.equal(summary.totals.commissionAllocated, 15)
  assert.equal(summary.totals.commissionUnallocated, 32)

  const lingo = summary.rows.find(r => r.vendorName === "Lingo")
  assert.ok(lingo)
  assert.equal(lingo.lineCount, 2)
  assert.equal(lingo.lineCountWithUnallocated, 1)
  assert.equal(lingo.usageAllocated, 150)
  assert.equal(lingo.usageUnallocated, 25)
  assert.equal(lingo.commissionAllocated, 15)
  assert.equal(lingo.commissionUnallocated, 2)
})

test("buildVendorSummary sorts by commissionUnallocated desc then usageUnallocated desc", () => {
  const summary = buildVendorSummary([
    makeLine({ id: "a", vendorName: "A", commissionUnallocated: 5, usageUnallocated: 10 }),
    makeLine({ id: "b", vendorName: "B", commissionUnallocated: 10, usageUnallocated: 0 }),
    makeLine({ id: "c", vendorName: "C", commissionUnallocated: 10, usageUnallocated: 20 }),
  ])

  assert.deepEqual(
    summary.rows.map(r => r.vendorName),
    ["C", "B", "A"],
  )
})

test("buildVendorSummary normalizes blank vendorName to Unknown Vendor", () => {
  const summary = buildVendorSummary([
    makeLine({ id: "a", vendorName: "   ", usageUnallocated: 1 }),
    makeLine({ id: "b", vendorName: "", usageUnallocated: 2 }),
  ])

  assert.equal(summary.totals.vendorCount, 1)
  assert.equal(summary.rows[0]?.vendorName, "Unknown Vendor")
  assert.equal(summary.rows[0]?.lineCount, 2)
  assert.equal(summary.rows[0]?.lineCountWithUnallocated, 2)
})

