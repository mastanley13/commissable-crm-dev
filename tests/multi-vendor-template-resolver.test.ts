import test from "node:test"
import assert from "node:assert/strict"

import {
  buildMultiVendorTemplateOptions,
  filterMultiVendorPreviewRows,
  groupRowsByVendor,
  mergeMultiVendorTemplateConfigs,
  resolveMultiVendorTemplates,
  type MultiVendorResolverDbClient,
  type MultiVendorResolvedTemplate,
} from "@/lib/deposit-import/multi-vendor-template-resolver"

test("groupRowsByVendor groups usable rows and reports missing vendor rows", () => {
  const rows = [
    ["Vendor Name", "Usage", "Commission"],
    ["Vendor A", "100", ""],
    ["Vendor B", "", "25"],
    ["", "120", ""],
    ["Totals", "220", "25"],
    ["Vendor A", "50", ""],
  ]

  const result = groupRowsByVendor({
    rows,
    vendorNameIndex: 0,
    usageIndex: 1,
    commissionIndex: 2,
  })

  assert.equal(result.groups.length, 2)
  assert.equal(result.groups[0]?.vendorName, "Vendor A")
  assert.equal(result.groups[0]?.rows.length, 2)
  assert.equal(result.groups[1]?.vendorName, "Vendor B")
  assert.deepEqual(result.missingVendorRows, [5])
})

test("filterMultiVendorPreviewRows returns only rows for the selected template vendors", () => {
  const rows = [
    ["ACC Business", "155.00", "21.70", "Edge Business"],
    ["ACC Business", "29.90", "4.78", "Edge Business"],
    ["ACC Business Total", "184.90", "26.48", ""],
    ["Advantix", "640.00", "102.40", "Walton Communities Inc"],
    ["Grand Total", "824.90", "128.88", ""],
  ]

  const result = filterMultiVendorPreviewRows({
    rows,
    vendorNameIndex: 0,
    vendorNamesInFile: ["Advantix"],
    usageIndex: 1,
    commissionIndex: 2,
  })

  assert.deepEqual(result, [["Advantix", "640.00", "102.40", "Walton Communities Inc"]])
})

test("filterMultiVendorPreviewRows preserves file order and skips rows without usable amounts", () => {
  const rows = [
    ["Vendor A", "", "", "ignore"],
    ["Vendor B", "50", "", "first"],
    ["Vendor A", "25", "", "second"],
    ["Vendor B", "", "10", "third"],
  ]

  const result = filterMultiVendorPreviewRows({
    rows,
    vendorNameIndex: 0,
    vendorNamesInFile: ["Vendor B"],
    usageIndex: 1,
    commissionIndex: 2,
  })

  assert.deepEqual(result, [
    ["Vendor B", "50", "", "first"],
    ["Vendor B", "", "10", "third"],
  ])
})

test("resolveMultiVendorTemplates selects most-recent template per vendor deterministically", async () => {
  const mockDb: MultiVendorResolverDbClient = {
    account: {
      findMany: async () => [
        { id: "acct-1", accountName: "Vendor A", accountLegalName: "Vendor A LLC" },
        { id: "acct-2", accountName: "Vendor B", accountLegalName: "Vendor B LLC" },
      ],
    },
    reconciliationTemplate: {
      findMany: async () => [
        {
          id: "tmpl-a-new",
          name: "Template A (new)",
          vendorAccountId: "acct-1",
          updatedAt: new Date("2026-02-08T00:00:00.000Z"),
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          config: {},
        },
        {
          id: "tmpl-a-old",
          name: "Template A (old)",
          vendorAccountId: "acct-1",
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          createdAt: new Date("2025-12-01T00:00:00.000Z"),
          config: {},
        },
      ],
    },
  }

  const result = await resolveMultiVendorTemplates({
    db: mockDb,
    tenantId: "tenant-1",
    distributorAccountId: "dist-1",
    vendorNamesInFile: ["Vendor A", "Vendor B", "Unknown Vendor"],
  })

  assert.equal(result.templatesUsed.length, 1)
  assert.equal(result.templatesUsed[0]?.vendorNameInFile, "Vendor A")
  assert.equal(result.templatesUsed[0]?.templateId, "tmpl-a-new")
  assert.deepEqual(result.vendorsMissingTemplates, ["Vendor B"])
  assert.deepEqual(result.missingVendors, ["Unknown Vendor"])
})

test("resolveMultiVendorTemplates skips summary vendor labels", async () => {
  const mockDb: MultiVendorResolverDbClient = {
    account: {
      findMany: async () => [{ id: "acct-1", accountName: "Vendor A", accountLegalName: "Vendor A LLC" }],
    },
    reconciliationTemplate: {
      findMany: async () => [
        {
          id: "tmpl-a",
          name: "Template A",
          vendorAccountId: "acct-1",
          updatedAt: new Date("2026-02-08T00:00:00.000Z"),
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          config: {},
        },
      ],
    },
  }

  const result = await resolveMultiVendorTemplates({
    db: mockDb,
    tenantId: "tenant-1",
    distributorAccountId: "dist-1",
    vendorNamesInFile: ["Vendor A", "Vendor A Total", "Grand Total:", "Total Telecom"],
  })

  assert.equal(result.templatesUsed.length, 1)
  assert.equal(result.templatesUsed[0]?.vendorNameInFile, "Vendor A")
  assert.deepEqual(result.missingVendors, ["Total Telecom"])
  assert.deepEqual(result.vendorsMissingTemplates, [])
})

test("resolveMultiVendorTemplates prefers exact accountName over accountLegalName alias collisions", async () => {
  const mockDb: MultiVendorResolverDbClient = {
    account: {
      findMany: async () => [
        { id: "acct-acc", accountName: "ACC Business", accountLegalName: "AT&T" },
        { id: "acct-att", accountName: "AT&T", accountLegalName: "AT&T, Inc." },
      ],
    },
    reconciliationTemplate: {
      findMany: async () => [
        {
          id: "tmpl-acc",
          name: "Template ACC",
          vendorAccountId: "acct-acc",
          updatedAt: new Date("2026-02-08T00:00:00.000Z"),
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          config: {},
        },
        {
          id: "tmpl-att",
          name: "Template ATT",
          vendorAccountId: "acct-att",
          updatedAt: new Date("2026-02-09T00:00:00.000Z"),
          createdAt: new Date("2026-02-02T00:00:00.000Z"),
          config: {},
        },
      ],
    },
  }

  const result = await resolveMultiVendorTemplates({
    db: mockDb,
    tenantId: "tenant-1",
    distributorAccountId: "dist-1",
    vendorNamesInFile: ["AT&T", "ACC Business"],
  })

  assert.equal(result.templatesUsed.length, 2)
  assert.equal(result.byVendorKey.get("at&t")?.vendorAccountId, "acct-att")
  assert.equal(result.byVendorKey.get("at&t")?.vendorAccountName, "AT&T")
  assert.equal(result.byVendorKey.get("at&t")?.templateId, "tmpl-att")
  assert.equal(result.byVendorKey.get("acc business")?.vendorAccountId, "acct-acc")
  assert.equal(result.byVendorKey.get("acc business")?.templateId, "tmpl-acc")
})

test("mergeMultiVendorTemplateConfigs merges mapping and telarus fields", () => {
  const merged = mergeMultiVendorTemplateConfigs([
    {
      vendorNameInFile: "Vendor A",
      vendorKey: "vendor a",
      vendorAccountId: "acct-1",
      vendorAccountName: "Vendor A",
      templateId: "tmpl-a",
      templateName: "Template A",
      templateUpdatedAt: "2026-02-08T00:00:00.000Z",
      templateConfig: {
        depositMapping: {
          version: 2,
          targets: {
            "depositLineItem.usage": "Usage",
          },
          columns: {
            Usage: { mode: "target", targetId: "depositLineItem.usage" },
          },
          customFields: {},
        },
        telarusTemplateFields: {
          version: 1,
          templateMapName: "Template A",
          origin: "seed",
          companyName: "Commissable",
          templateId: "tmpl-a",
          fields: [
            {
              telarusFieldName: "Usage",
              commissableFieldLabel: "Actual Usage",
            },
          ],
        },
      },
    },
    {
      vendorNameInFile: "Vendor B",
      vendorKey: "vendor b",
      vendorAccountId: "acct-2",
      vendorAccountName: "Vendor B",
      templateId: "tmpl-b",
      templateName: "Template B",
      templateUpdatedAt: "2026-02-08T00:00:00.000Z",
      templateConfig: {
        depositMapping: {
          version: 2,
          targets: {
            "depositLineItem.commission": "Commission",
          },
          columns: {
            Commission: { mode: "target", targetId: "depositLineItem.commission" },
          },
          customFields: {},
        },
        telarusTemplateFields: {
          version: 1,
          templateMapName: "Template B",
          origin: "seed",
          companyName: "Commissable",
          templateId: "tmpl-b",
          fields: [
            {
              telarusFieldName: "Commission",
              commissableFieldLabel: "Actual Commission",
            },
          ],
        },
      },
    },
  ])

  assert.ok(merged.depositMappingV2)
  assert.equal(merged.depositMappingV2?.targets["depositLineItem.usage"], "Usage")
  assert.equal(merged.depositMappingV2?.targets["depositLineItem.commission"], "Commission")
  assert.ok(merged.telarusTemplateFields)
  assert.equal(merged.telarusTemplateFields?.fields.length, 2)
})

test("buildMultiVendorTemplateOptions dedupes by templateId and aggregates vendor names", () => {
  const resolvedTemplates: MultiVendorResolvedTemplate[] = [
    {
      vendorNameInFile: "Vendor A",
      vendorKey: "vendor a",
      vendorAccountId: "acct-a",
      vendorAccountName: "Vendor A",
      templateId: "tmpl-a",
      templateName: "Template A",
      templateUpdatedAt: "2026-02-08T00:00:00.000Z",
      templateConfig: {
        depositMapping: {
          version: 2,
          targets: {
            "depositLineItem.usage": "Usage",
          },
          columns: {
            Usage: { mode: "target", targetId: "depositLineItem.usage" },
          },
          customFields: {},
        },
        telarusTemplateFields: {
          version: 1,
          templateMapName: "Template A",
          origin: "seed",
          companyName: "Commissable",
          templateId: "tmpl-a",
          fields: [
            {
              telarusFieldName: "Usage",
              commissableFieldLabel: "Actual Usage",
            },
          ],
        },
      },
    },
    {
      vendorNameInFile: "Vendor A Secondary",
      vendorKey: "vendor a secondary",
      vendorAccountId: "acct-a",
      vendorAccountName: "Vendor A",
      templateId: "tmpl-a",
      templateName: "Template A",
      templateUpdatedAt: "2026-02-08T00:00:00.000Z",
      templateConfig: {
        depositMapping: {
          version: 2,
          targets: {
            "depositLineItem.usage": "Usage",
          },
          columns: {
            Usage: { mode: "target", targetId: "depositLineItem.usage" },
          },
          customFields: {},
        },
      },
    },
    {
      vendorNameInFile: "Vendor B",
      vendorKey: "vendor b",
      vendorAccountId: "acct-b",
      vendorAccountName: "Vendor B",
      templateId: "tmpl-b",
      templateName: "Template B",
      templateUpdatedAt: "2026-02-08T00:00:00.000Z",
      templateConfig: {},
    },
  ]

  const options = buildMultiVendorTemplateOptions(resolvedTemplates)
  assert.equal(options.length, 2)

  const optionA = options.find(option => option.templateId === "tmpl-a") ?? null
  assert.ok(optionA)
  assert.equal(optionA!.vendorAccountName, "Vendor A")
  assert.equal(optionA!.templateName, "Template A")
  assert.deepEqual(optionA!.vendorNamesInFile, ["Vendor A", "Vendor A Secondary"])
  assert.ok(optionA!.depositMappingV2)
  assert.equal(optionA!.depositMappingV2?.targets["depositLineItem.usage"], "Usage")
  assert.ok(optionA!.telarusTemplateFields)

  const optionB = options.find(option => option.templateId === "tmpl-b") ?? null
  assert.ok(optionB)
  assert.equal(optionB!.vendorAccountName, "Vendor B")
  assert.equal(optionB!.depositMappingV2, null)
  assert.equal(optionB!.telarusTemplateFields, null)
})
