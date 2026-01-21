import test from "node:test"
import assert from "node:assert/strict"

import { parseSpreadsheetFile } from "../lib/deposit-import/parse-file"

function csvFile(contents: string, name = "upload.csv") {
  const blob = new Blob([contents], { type: "text/csv" })
  return { blob, name }
}

test("DU-AUTO-07: CSV parsing rejects empty/no-header CSV", async () => {
  const { blob, name } = csvFile("")
  await assert.rejects(() => parseSpreadsheetFile(blob, name, "text/csv"), /missing a header row/i)
})

test("DU-AUTO-07: CSV parsing returns headers + rows and skips empty lines", async () => {
  const { blob, name } = csvFile(
    [
      "Usage,Commission,Notes",
      "100,25,ok",
      "",
      "   ",
      "200,50,  spaced  ",
    ].join("\n"),
  )

  const parsed = await parseSpreadsheetFile(blob, name, "text/csv")
  assert.deepEqual(parsed.headers, ["Usage", "Commission", "Notes"])
  assert.equal(parsed.rows.length, 2)
  assert.deepEqual(parsed.rows[0], ["100", "25", "ok"])
  assert.deepEqual(parsed.rows[1], ["200", "50", "  spaced  "])
})

