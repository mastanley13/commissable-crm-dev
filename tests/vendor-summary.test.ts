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

test("buildVendorSummary computes commissionAllocatedPercent", () => {
  const summary = buildVendorSummary([
    makeLine({ id: "a", vendorName: "V1", commissionAllocated: 75, commissionUnallocated: 25 }),
    makeLine({ id: "b", vendorName: "V2", commissionAllocated: 0, commissionUnallocated: 100 }),
    makeLine({ id: "c", vendorName: "V3", commissionAllocated: 50, commissionUnallocated: 0 }),
  ])

  const v1 = summary.rows.find(r => r.vendorName === "V1")
  const v2 = summary.rows.find(r => r.vendorName === "V2")
  const v3 = summary.rows.find(r => r.vendorName === "V3")

  assert.ok(v1)
  assert.ok(v2)
  assert.ok(v3)

  assert.equal(v1.commissionAllocatedPercent, 75)
  assert.equal(v2.commissionAllocatedPercent, 0)
  assert.equal(v3.commissionAllocatedPercent, 100)

  // Total: 125 allocated out of 250 total = 50%
  assert.equal(summary.totals.commissionAllocatedPercent, 50)
})

test("buildVendorSummary computes commissionAllocatedPercent as 100 when no commission", () => {
  const summary = buildVendorSummary([
    makeLine({ id: "a", vendorName: "V1", commissionAllocated: 0, commissionUnallocated: 0 }),
  ])

  assert.equal(summary.rows[0]?.commissionAllocatedPercent, 100)
  assert.equal(summary.totals.commissionAllocatedPercent, 100)
})

test("buildVendorSummary tracks status counts per vendor", () => {
  const summary = buildVendorSummary([
    makeLine({ id: "a", vendorName: "V1", status: "Matched" }),
    makeLine({ id: "b", vendorName: "V1", status: "Matched" }),
    makeLine({ id: "c", vendorName: "V1", status: "Unmatched", usageUnallocated: 10 }),
    makeLine({ id: "d", vendorName: "V1", status: "Partially Matched", commissionUnallocated: 5 }),
    makeLine({ id: "e", vendorName: "V2", status: "Suggested" }),
    makeLine({ id: "f", vendorName: "V2", status: "Unmatched", reconciled: true }),
  ])

  const v1 = summary.rows.find(r => r.vendorName === "V1")
  const v2 = summary.rows.find(r => r.vendorName === "V2")
  assert.ok(v1)
  assert.ok(v2)

  assert.equal(v1.statusCounts.matched, 2)
  assert.equal(v1.statusCounts.unmatched, 1)
  assert.equal(v1.statusCounts.partiallyMatched, 1)
  assert.equal(v1.statusCounts.suggested, 0)
  assert.equal(v1.statusCounts.reconciled, 0)

  assert.equal(v2.statusCounts.suggested, 1)
  assert.equal(v2.statusCounts.reconciled, 1)
  assert.equal(v2.statusCounts.unmatched, 0)

  // Totals
  assert.equal(summary.totals.statusCounts.matched, 2)
  assert.equal(summary.totals.statusCounts.unmatched, 1)
  assert.equal(summary.totals.statusCounts.partiallyMatched, 1)
  assert.equal(summary.totals.statusCounts.suggested, 1)
  assert.equal(summary.totals.statusCounts.reconciled, 1)
})
