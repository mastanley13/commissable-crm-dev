import test from "node:test"
import assert from "node:assert/strict"

import { parseSpreadsheetFile } from "../lib/deposit-import/parse-file"

test("DU-AUTO-09: Unsupported file type rejection is consistent", async () => {
  const blob = new Blob(["\u0089PNG\r\n\u001a\n"], { type: "image/png" })
  await assert.rejects(() => parseSpreadsheetFile(blob, "upload.png", "image/png"), /unsupported file type/i)
})
