import test from "node:test"
import assert from "node:assert/strict"

import {
  createEmptyDepositMapping,
  extractDepositMappingFromTemplateConfig,
  seedDepositMapping,
  serializeDepositMappingForTemplate,
  setColumnSelection,
} from "../lib/deposit-import/template-mapping"

test("DU-AUTO-06: serializeDepositMappingForTemplate + extractDepositMappingFromTemplateConfig roundtrip preserves mapping content", () => {
  const mapping = createEmptyDepositMapping()
  mapping.line.usage = "Usage Column"
  mapping.line.commission = "Commission Column"
  mapping.columns["Extra Column"] = { mode: "custom", customKey: "cf_1" }
  mapping.customFields["cf_1"] = { label: "External ID", section: "additional" }

  const serialized = serializeDepositMappingForTemplate(mapping)
  const extracted = extractDepositMappingFromTemplateConfig(serialized)

  assert.equal(extracted.version, 1)
  assert.equal(extracted.line.usage, "Usage Column")
  assert.equal(extracted.line.commission, "Commission Column")
  assert.deepEqual(extracted.columns["Extra Column"], { mode: "custom", customKey: "cf_1" })
  assert.deepEqual(extracted.customFields["cf_1"], { label: "External ID", section: "additional" })
})

test("DU-AUTO-06: extractDepositMappingFromTemplateConfig normalizes/filters invalid config content", () => {
  const extracted = extractDepositMappingFromTemplateConfig({
    depositMapping: {
      version: 1,
      line: {
        usage: "  Usage  ",
        commission: "",
        notAField: "ignored",
      },
      columns: {
        "": { mode: "custom", customKey: "cf_ignored" },
        "Extra Column": { mode: "custom", customKey: "  cf_1  " },
        "Bad Mode": { mode: "nope" },
      },
      customFields: {
        cf_1: { label: "  External ID  ", section: "product" },
        cf_empty: { label: "   ", section: "additional" },
      },
      header: {
        depositName: 123,
        paymentDateColumn: "Payment Date",
      },
      options: {
        hasHeaderRow: "true",
        dateFormatHint: "MDY",
        numberFormatHint: 42,
      },
    },
  })

  assert.equal(extracted.version, 1)
  assert.deepEqual(extracted.line, { usage: "Usage" })
  assert.deepEqual(extracted.columns, { "Extra Column": { mode: "custom", customKey: "cf_1" } })
  assert.deepEqual(extracted.customFields, { cf_1: { label: "External ID", section: "product" } })
  assert.deepEqual(extracted.header, { depositName: null, paymentDateColumn: "Payment Date", customerAccountColumn: null })
  assert.deepEqual(extracted.options, { hasHeaderRow: undefined, dateFormatHint: "MDY", numberFormatHint: undefined })
})

test("DU-AUTO-06: setColumnSelection enforces 1:1 canonical field/column mapping", () => {
  let mapping = createEmptyDepositMapping()

  mapping = setColumnSelection(mapping, "Col A", { type: "canonical", fieldId: "usage" })
  mapping = setColumnSelection(mapping, "Col A", { type: "canonical", fieldId: "commission" })

  assert.equal(mapping.line.usage, undefined)
  assert.equal(mapping.line.commission, "Col A")

  mapping = setColumnSelection(mapping, "Col B", { type: "canonical", fieldId: "commission" })
  assert.equal(mapping.line.commission, "Col B")
  assert.ok(!Object.values(mapping.line).includes("Col A"))
})

test("DU-AUTO-06: seedDepositMapping drops template mappings for missing headers and resolves case-insensitive matches", () => {
  const seeded = seedDepositMapping({
    headers: ["Total Bill", "Some Other Column"],
    templateMapping: {
      version: 1,
      line: {
        usage: "TOTAL BILL",
        commission: "Missing Column",
      },
      columns: {},
      customFields: {},
    },
  })

  assert.equal(seeded.line.usage, "Total Bill")
  assert.equal(seeded.line.commission, undefined)
})

