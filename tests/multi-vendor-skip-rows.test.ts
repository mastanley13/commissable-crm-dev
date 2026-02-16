import test from "node:test"
import assert from "node:assert/strict"

import { rowHasTotalsLabel, shouldSkipMultiVendorRow } from "@/lib/deposit-import/multi-vendor"

test("rowHasTotalsLabel detects Totals labels anywhere in the row", () => {
  assert.equal(rowHasTotalsLabel(["Vendor A", "Totals", "123"]), true)
  assert.equal(rowHasTotalsLabel(["Vendor A", "Grand Totals:", "123"]), true)
  assert.equal(rowHasTotalsLabel(["Vendor A", "Sub-total", "123"]), true)
  assert.equal(rowHasTotalsLabel(["Vendor A", "Total Telecom", "123"]), false)
})

test("rowHasTotalsLabel supports suffix-based summary rows when strict mode is enabled", () => {
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

test("shouldSkipMultiVendorRow respects DEPOSIT_IMPORT_SKIP_SUMMARY_ROWS flag", () => {
  const previous = process.env.DEPOSIT_IMPORT_SKIP_SUMMARY_ROWS
  try {
    process.env.DEPOSIT_IMPORT_SKIP_SUMMARY_ROWS = "0"
    assert.equal(shouldSkipMultiVendorRow(["ACC Business Total", "100.00"], "ACC Business Total"), false)

    process.env.DEPOSIT_IMPORT_SKIP_SUMMARY_ROWS = "1"
    assert.equal(shouldSkipMultiVendorRow(["ACC Business Total", "100.00"], "ACC Business Total"), true)
    assert.equal(shouldSkipMultiVendorRow(["Total Telecom", "100.00"], "Total Telecom"), false)
  } finally {
    if (previous === undefined) {
      delete process.env.DEPOSIT_IMPORT_SKIP_SUMMARY_ROWS
    } else {
      process.env.DEPOSIT_IMPORT_SKIP_SUMMARY_ROWS = previous
    }
  }
})
