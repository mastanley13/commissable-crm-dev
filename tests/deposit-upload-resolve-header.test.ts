import test from "node:test"
import assert from "node:assert/strict"

import { resolveSpreadsheetHeader } from "../lib/deposit-import/resolve-header"

test("resolveSpreadsheetHeader: matches headers with leading/trailing spaces", () => {
  const headers = ["Supplier Name", " Total Bill ", " Total Commission "]

  const resolved = resolveSpreadsheetHeader(headers, "Total Bill")
  assert.deepEqual(resolved, { ok: true, index: 1, header: " Total Bill " })
})

test("resolveSpreadsheetHeader: matches case-insensitively", () => {
  const headers = ["total bill", "Total Commission"]

  const resolved = resolveSpreadsheetHeader(headers, "TOTAL BILL")
  assert.deepEqual(resolved, { ok: true, index: 0, header: "total bill" })
})

test("resolveSpreadsheetHeader: matches via normalization (punctuation)", () => {
  const headers = ["Total Bill ($)", "Total Commission"]

  const resolved = resolveSpreadsheetHeader(headers, "Total Bill")
  assert.deepEqual(resolved, { ok: true, index: 0, header: "Total Bill ($)" })
})

test("resolveSpreadsheetHeader: returns ambiguous when multiple headers match", () => {
  const headers = [" Total Bill ", "Total Bill", "Other"]

  // No exact match; trim-based match hits both headers.
  const resolved = resolveSpreadsheetHeader(headers, "Total Bill ")
  assert.equal(resolved.ok, false)
  if (!resolved.ok) {
    assert.equal(resolved.reason, "ambiguous")
  }
})
