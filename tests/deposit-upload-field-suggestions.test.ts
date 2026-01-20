import test from "node:test"
import assert from "node:assert/strict"

import { suggestDepositFieldMatches } from "../lib/deposit-import/field-suggestions"

test("suggestDepositFieldMatches: suggests Customer ID (Vendor) for Customer Id", () => {
  const suggestions = suggestDepositFieldMatches("Customer Id", { limit: 1 })
  assert.equal(suggestions[0]?.fieldId, "customerIdVendor")
})

test("suggestDepositFieldMatches: suggests Commission Rate (%) for Commission Rate headers", () => {
  const suggestions = suggestDepositFieldMatches("Commission Rate (%)", { limit: 1 })
  assert.equal(suggestions[0]?.fieldId, "commissionRate")
})

test("suggestDepositFieldMatches: suggests Commission Amount for commission amount headers", () => {
  const suggestions = suggestDepositFieldMatches("Total Commission", { limit: 1 })
  assert.equal(suggestions[0]?.fieldId, "commission")
})

test("suggestDepositFieldMatches: suggests Distributor Name (raw) for Acquired Master Agency Name", () => {
  const suggestions = suggestDepositFieldMatches("Acquired Master Agency Name", { limit: 1 })
  assert.equal(suggestions[0]?.fieldId, "distributorNameRaw")
})

