import test from "node:test"
import assert from "node:assert/strict"

import { rowHasTotalsLabel, shouldSkipMultiVendorRow } from "@/lib/deposit-import/multi-vendor"

test("rowHasTotalsLabel detects Totals labels anywhere in the row", () => {
  assert.equal(rowHasTotalsLabel(["Vendor A", "Totals", "123"]), true)
  assert.equal(rowHasTotalsLabel(["Vendor A", "Grand Totals:", "123"]), true)
  assert.equal(rowHasTotalsLabel(["Vendor A", "Sub-total", "123"]), true)
  assert.equal(rowHasTotalsLabel(["Vendor A", "Total Telecom", "123"]), false)
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

