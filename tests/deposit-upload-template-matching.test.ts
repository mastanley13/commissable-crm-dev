import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { parseSpreadsheetFile } from "../lib/deposit-import/parse-file"
import { findTelarusTemplateMatch } from "../lib/deposit-import/telarus-template-master"
import { requiredDepositFieldIds } from "../lib/deposit-import/fields"
import { normalizeKey } from "../lib/deposit-import/normalize"
import { seedDepositMapping } from "../lib/deposit-import/template-mapping"

function normalizeNumber(value: string | undefined) {
  if (value === undefined || value === null) return null
  const normalized = String(value).replace(/[^0-9.\-]/g, "")
  if (!normalized) return null
  const numeric = Number(normalized)
  return Number.isNaN(numeric) ? null : numeric
}

async function loadTestCsv(fileName: string) {
  const filePath = path.join(process.cwd(), fileName)
  const buffer = fs.readFileSync(filePath)
  const blob = new Blob([buffer], { type: "text/csv" })
  return parseSpreadsheetFile(blob, fileName, "text/csv")
}

async function assertTemplateMatchAndMapping(params: {
  fileName: string
  expectedTemplateMapName: string
  expectedTemplateId: string
}) {
  const parsed = await loadTestCsv(params.fileName)

  const supplierNameIndex = parsed.headers.indexOf("Supplier Name")
  const acquiredMasterAgencyNameIndex = parsed.headers.indexOf("Acquired Master Agency Name")
  assert.notEqual(supplierNameIndex, -1, "Expected Supplier Name header")
  assert.notEqual(acquiredMasterAgencyNameIndex, -1, "Expected Acquired Master Agency Name header")

  const firstRow = parsed.rows[0] ?? []
  const vendorName = (firstRow[supplierNameIndex] ?? "").trim()
  const distributorName = (firstRow[acquiredMasterAgencyNameIndex] ?? "").trim()
  assert.ok(vendorName, "Expected vendor name in first row")
  assert.ok(distributorName, "Expected distributor name in first row")

  const match = findTelarusTemplateMatch({ distributorName, vendorName })
  assert.ok(match, "Expected a Telarus template match")
  assert.equal(match.templateMapName, params.expectedTemplateMapName)
  assert.equal(match.templateId, params.expectedTemplateId)

  const seeded = seedDepositMapping({ headers: parsed.headers, templateMapping: match.mapping })
  for (const requiredFieldId of requiredDepositFieldIds) {
    assert.ok(seeded.line[requiredFieldId], `Expected required mapping for ${requiredFieldId}`)
  }

  assert.equal(normalizeKey(seeded.line.usage ?? ""), "total bill")
  assert.equal(normalizeKey(seeded.line.commission ?? ""), "total commission")

  const usageIndex = parsed.headers.indexOf(seeded.line.usage ?? "")
  const commissionIndex = parsed.headers.indexOf(seeded.line.commission ?? "")
  assert.notEqual(usageIndex, -1, "Usage header exists in parsed file")
  assert.notEqual(commissionIndex, -1, "Commission header exists in parsed file")

  const usageValue = normalizeNumber(firstRow[usageIndex])
  const commissionValue = normalizeNumber(firstRow[commissionIndex])
  assert.ok(usageValue !== null && usageValue > 0, "Usage parses as a positive number")
  assert.ok(commissionValue !== null, "Commission parses as a number")
}

test("deposit upload: Telarus ACC Business mapping seeds required fields", async () => {
  await assertTemplateMatchAndMapping({
    fileName: "Test data Telarus Report_Commission-2_2025-09.xlsx - Sheet1.csv",
    expectedTemplateMapName: "Telarus-ACC Business",
    expectedTemplateId: "2364",
  })
})

test("deposit upload: Telarus Advantix mapping seeds required fields", async () => {
  await assertTemplateMatchAndMapping({
    fileName: "Test data Telarus Report_Commission-2_2025-09.xlsx - Sheet2.csv",
    expectedTemplateMapName: "Telarus-Advantix",
    expectedTemplateId: "2492",
  })
})

