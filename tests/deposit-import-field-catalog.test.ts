import test from "node:test"
import assert from "node:assert/strict"

import { buildDepositImportFieldCatalog } from "../lib/deposit-import/field-catalog"

test("deposit import field catalog: includes Account Legal Name mapping option", () => {
  const catalog = buildDepositImportFieldCatalog({ opportunityFieldDefinitions: [] })
  const accountNameTarget = catalog.find(target => target.id === "depositLineItem.accountNameRaw")
  assert.ok(accountNameTarget, "Expected depositLineItem.accountNameRaw target")
  assert.equal(accountNameTarget.label, "Account Legal Name")
})

