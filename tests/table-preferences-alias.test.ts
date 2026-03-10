import test from "node:test"
import assert from "node:assert/strict"

import { migrateTablePreferencePayload, normalizeTablePreferencePayloadForColumns } from "../lib/table-preferences-alias"

test("table preference migration aliases locked column ids", () => {
  const migrated = migrateTablePreferencePayload({
    lockedColumns: ["accountIdDistributor", "customerIdOther"],
  }) as { lockedColumns?: string[] }

  assert.deepEqual(migrated.lockedColumns, ["accountIdVendor", "customerIdVendor"])
})

test("table preference normalization filters unknown locked columns", () => {
  const normalized = normalizeTablePreferencePayloadForColumns(
    {
      lockedColumns: ["vendorName", "missingColumn"],
      hiddenColumns: ["otherSource"],
    },
    [
      { id: "vendorName" },
      { id: "otherSource" },
    ]
  ) as { lockedColumns?: string[]; hiddenColumns?: string[] }

  assert.deepEqual(normalized.lockedColumns, ["vendorName"])
  assert.deepEqual(normalized.hiddenColumns, ["otherSource"])
})
