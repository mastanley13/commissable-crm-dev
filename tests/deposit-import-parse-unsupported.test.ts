import test from "node:test"
import assert from "node:assert/strict"

import { parseSpreadsheetFile } from "../lib/deposit-import/parse-file"

test("DU-AUTO-09: Unsupported file type rejection is consistent", async () => {
  const blob = new Blob(["%PDF-1.7"], { type: "application/pdf" })
  await assert.rejects(() => parseSpreadsheetFile(blob, "upload.pdf", "application/pdf"), /unsupported file type/i)
})

