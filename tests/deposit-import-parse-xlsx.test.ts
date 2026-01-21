import test from "node:test"
import assert from "node:assert/strict"

import * as XLSX from "xlsx"

import { parseSpreadsheetFile } from "../lib/deposit-import/parse-file"

function xlsxBlobFromAoa(aoa: unknown[][]) {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1")
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

test("DU-AUTO-08: Excel parsing rejects missing header row", async () => {
  const blob = xlsxBlobFromAoa([])
  await assert.rejects(() => parseSpreadsheetFile(blob, "upload.xlsx"), /missing a header row/i)
})

test("DU-AUTO-08: Excel parsing returns headers + normalized rows and skips empty rows", async () => {
  const blob = xlsxBlobFromAoa([
    ["Usage", "Commission", "Notes"],
    [100, 25, "ok"],
    ["", "", ""],
    [null, null, null],
    [200, 50, "spaced"],
  ])

  const parsed = await parseSpreadsheetFile(blob, "upload.xlsx")
  assert.deepEqual(parsed.headers, ["Usage", "Commission", "Notes"])
  assert.equal(parsed.rows.length, 2)
  assert.deepEqual(parsed.rows[0], ["100", "25", "ok"])
  assert.deepEqual(parsed.rows[1], ["200", "50", "spaced"])
})

