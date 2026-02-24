import test from "node:test"
import assert from "node:assert/strict"

import { rowHasTotalsLabel, shouldSkipMultiVendorRow } from "@/lib/deposit-import/multi-vendor"

test("rowHasTotalsLabel detects Totals labels anywhere in the row", () => {
  assert.equal(rowHasTotalsLabel(["Vendor A", "Totals", "123"]), true)
  assert.equal(rowHasTotalsLabel(["Vendor A", "Grand Totals:", "123"]), true)
  assert.equal(rowHasTotalsLabel(["Vendor A", "Sub-total", "123"]), true)
  assert.equal(rowHasTotalsLabel(["Vendor A", "Total Telecom", "123"]), false)
})

test("rowHasTotalsLabel supports suffix-based summary rows", () => {
  assert.equal(rowHasTotalsLabel(["ACC Business Total", "123"], true), true)
  assert.equal(rowHasTotalsLabel(["AT&T Total", "123"], true), true)
  assert.equal(rowHasTotalsLabel(["Grand Total", "123"], true), true)
  assert.equal(rowHasTotalsLabel(["Total Telecom", "123"], true), false)
})

test("shouldSkipMultiVendorRow skips empty/blank rows", () => {
  assert.equal(shouldSkipMultiVendorRow([], null), true)
  assert.equal(shouldSkipMultiVendorRow(["", "   "], "Vendor A"), true)
})

test("shouldSkipMultiVendorRow skips Totals rows even when amounts exist", () => {
  assert.equal(shouldSkipMultiVendorRow(["", "Totals", "100.00"], null), true)
  assert.equal(shouldSkipMultiVendorRow(["Totals", "100.00"], "Totals"), true)
  assert.equal(shouldSkipMultiVendorRow(["Vendor A", "Grand Total", "100.00"], "Vendor A"), true)
})

test("shouldSkipMultiVendorRow does not skip normal transactional rows", () => {
  assert.equal(shouldSkipMultiVendorRow(["Vendor A", "Line 1", "100.00"], "Vendor A"), false)
  assert.equal(shouldSkipMultiVendorRow(["Total Telecom", "Line 1", "100.00"], "Total Telecom"), false)
})

test("shouldSkipMultiVendorRow skips suffix-based summary labels by default", () => {
  assert.equal(shouldSkipMultiVendorRow(["ACC Business Total", "100.00"], "ACC Business Total"), true)
  assert.equal(shouldSkipMultiVendorRow(["AT&T Total", "100.00"], "AT&T Total"), true)
  assert.equal(shouldSkipMultiVendorRow(["Grand Total:", "100.00"], "Grand Total:"), true)
  assert.equal(shouldSkipMultiVendorRow(["Total Telecom", "100.00"], "Total Telecom"), false)
})
