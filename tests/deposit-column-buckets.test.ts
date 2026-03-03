import test from "node:test"
import assert from "node:assert/strict"

import { resolveTemplateKnownHeaders, classifyDepositColumnBucket } from "../lib/deposit-import/deposit-column-buckets"
import { sanitizeDepositMappingForTemplateV2 } from "../lib/deposit-import/template-mapping-v2"

test("deposit buckets: resolves template-known headers from mapping + telarus fields (normalizes)", () => {
  const headers = ["Template Col", "TELARUS FIELD", "Other"]
  const templateKnown = resolveTemplateKnownHeaders({
    headers,
    templateMapping: {
      version: 2,
      targets: { "depositLineItem.usage": "Template Col" },
      columns: {},
      customFields: {},
    },
    templateFields: {
      version: 1,
      templateMapName: "x",
      origin: "x",
      companyName: "x",
      templateId: null,
      fields: [{ telarusFieldName: "Telarus Field", commissableFieldLabel: "Telarus Field" }],
    },
  })

  assert.ok(templateKnown.has("Template Col"))
  assert.ok(templateKnown.has("TELARUS FIELD"))
  assert.ok(!templateKnown.has("Other"))
})

test("deposit buckets: bucket rules match acceptance criteria", () => {
  const templateKnownHeaders = new Set(["Known"])

  assert.deepEqual(
    classifyDepositColumnBucket({
      header: "Known",
      selection: { type: "ignore" },
      hasAnyValue: true,
      templateKnownHeaders,
    }),
    { bucket: "exclude", reason: "ignored" },
  )

  assert.deepEqual(
    classifyDepositColumnBucket({
      header: "Known",
      selection: { type: "additional" },
      hasAnyValue: false,
      templateKnownHeaders,
    }),
    { bucket: "exclude", reason: "blank" },
  )

  assert.deepEqual(
    classifyDepositColumnBucket({
      header: "Known",
      selection: { type: "additional" },
      hasAnyValue: true,
      templateKnownHeaders,
    }),
    { bucket: "template", reason: "template_known" },
  )

  assert.deepEqual(
    classifyDepositColumnBucket({
      header: "NewCol",
      selection: { type: "additional" },
      hasAnyValue: true,
      templateKnownHeaders,
    }),
    { bucket: "new", reason: "needs_mapping" },
  )

  assert.deepEqual(
    classifyDepositColumnBucket({
      header: "MappedCol",
      selection: { type: "target", targetId: "depositLineItem.usage" },
      hasAnyValue: true,
      templateKnownHeaders,
    }),
    { bucket: "exclude", reason: "mapped_not_saved" },
  )
})

test("deposit templates: sanitizeDepositMappingForTemplateV2 persists only target/custom mappings", () => {
  const sanitized = sanitizeDepositMappingForTemplateV2({
    version: 2,
    targets: {
      "depositLineItem.usage": "Usage",
      "depositLineItem.commission": "Commission",
    },
    columns: {
      Usage: { mode: "additional" },
      Commission: { mode: "ignore" },
      "Extra 1": { mode: "additional" },
      "Custom 1": { mode: "custom", customKey: "cf_units" },
      "Custom 2": { mode: "custom", customKey: "cf_missing" },
    },
    customFields: {
      cf_units: { label: "Units", section: "additional" },
      cf_unused: { label: "Unused", section: "product" },
    },
  })

  assert.deepEqual(sanitized.targets, {
    "depositLineItem.usage": "Usage",
    "depositLineItem.commission": "Commission",
  })

  assert.deepEqual(sanitized.columns["Usage"], { mode: "target", targetId: "depositLineItem.usage" })
  assert.deepEqual(sanitized.columns["Commission"], { mode: "target", targetId: "depositLineItem.commission" })
  assert.deepEqual(sanitized.columns["Custom 1"], { mode: "custom", customKey: "cf_units" })

  assert.ok(!("Extra 1" in sanitized.columns))
  assert.ok(!("Custom 2" in sanitized.columns))
  assert.deepEqual(sanitized.customFields, { cf_units: { label: "Units", section: "additional" } })
})

