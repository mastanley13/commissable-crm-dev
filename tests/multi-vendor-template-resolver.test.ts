import test from "node:test"
import assert from "node:assert/strict"

import {
  groupRowsByVendor,
  mergeMultiVendorTemplateConfigs,
  resolveMultiVendorTemplates,
  type MultiVendorResolverDbClient,
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
