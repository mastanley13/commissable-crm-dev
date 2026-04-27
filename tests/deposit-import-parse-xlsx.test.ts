import test from "node:test"
import assert from "node:assert/strict"

import * as XLSX from "xlsx"

import { parseSpreadsheetFile } from "../lib/deposit-import/parse-file"

function xlsxBlobFromAoa(aoa: unknown[][]) {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1")
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
  return new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

function xlsxBlobFromSheets(sheets: Array<{ name: string; rows: unknown[][] }>) {
  const workbook = XLSX.utils.book_new()
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name)
  }
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
  return new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

test("DU-AUTO-08: Excel parsing rejects missing header row", async () => {
  const blob = xlsxBlobFromAoa([])
  await assert.rejects(() => parseSpreadsheetFile(blob, "upload.xlsx"), /sheet is empty|missing a header row/i)
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

test("DU-AUTO-08: Excel parsing uses the first worksheet when a workbook has multiple sheets", async () => {
  const blob = xlsxBlobFromSheets([
    {
      name: "Accounts",
      rows: [
        ["Name", "Type"],
        ["Acme", "Customer"]
      ]
    },
    {
      name: "Contacts",
      rows: [
        ["First Name", "Last Name"],
        ["Ada", "Lovelace"]
      ]
    }
  ])

  const parsed = await parseSpreadsheetFile(blob, "upload.xlsx")
  assert.deepEqual(parsed.headers, ["Name", "Type"])
  assert.deepEqual(parsed.rows, [["Acme", "Customer"]])
  assert.equal(parsed.selectedWorksheetName, "Accounts")
  assert.equal(parsed.worksheets?.length, 2)
  assert.deepEqual(
    parsed.worksheets?.map(sheet => ({
      name: sheet.name,
      isSelectable: sheet.isSelectable,
      rows: sheet.rows.length
    })),
    [
      { name: "Accounts", isSelectable: true, rows: 1 },
      { name: "Contacts", isSelectable: true, rows: 1 }
    ]
  )
})

test("DU-AUTO-08: Excel parsing skips non-importable cover sheets and defaults to the first importable worksheet", async () => {
  const blob = xlsxBlobFromSheets([
    {
      name: "Instructions",
      rows: [["Migration workbook for Wave 1"]]
    },
    {
      name: "Accounts",
      rows: [
        ["Name", "Type"],
        ["Acme", "Customer"]
      ]
    }
  ])

  const parsed = await parseSpreadsheetFile(blob, "upload.xlsx")
  assert.equal(parsed.selectedWorksheetName, "Accounts")
  assert.deepEqual(parsed.headers, ["Name", "Type"])
  assert.deepEqual(parsed.rows, [["Acme", "Customer"]])
  assert.deepEqual(
    parsed.worksheets?.map(sheet => ({
      name: sheet.name,
      isSelectable: sheet.isSelectable,
      error: sheet.error ?? null
    })),
    [
      { name: "Instructions", isSelectable: false, error: "Sheet contains no data rows" },
      { name: "Accounts", isSelectable: true, error: null }
    ]
  )
})
