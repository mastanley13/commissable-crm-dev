import test from "node:test"
import assert from "node:assert/strict"

import { parseSpreadsheetFile } from "../lib/deposit-import/parse-file"

function pad10(value: number) {
  return String(value).padStart(10, "0")
}

function buildSimpleTablePdf() {
  const contentLines = [
    "BT",
    "/F1 12 Tf",
    "1 0 0 1 72 720 Tm",
    "(Usage) Tj",
    "1 0 0 1 200 720 Tm",
    "(Commission) Tj",
    "1 0 0 1 72 700 Tm",
    "(100) Tj",
    "1 0 0 1 200 700 Tm",
    "(25) Tj",
    "1 0 0 1 72 680 Tm",
    "(200) Tj",
    "1 0 0 1 200 680 Tm",
    "(50) Tj",
    "ET",
  ]
  const stream = `${contentLines.join("\n")}\n`
  const streamLength = Buffer.byteLength(stream, "utf8")

  const objects: string[] = []
  objects[1] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
  objects[2] = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
  objects[3] =
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
  objects[4] = "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
  objects[5] = `5 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}endstream\nendobj\n`

  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []
  offsets[0] = 0
  for (let objectNumber = 1; objectNumber <= 5; objectNumber += 1) {
    offsets[objectNumber] = Buffer.byteLength(pdf, "utf8")
    pdf += objects[objectNumber]
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8")
  pdf += "xref\n0 6\n"
  pdf += "0000000000 65535 f \n"
  for (let objectNumber = 1; objectNumber <= 5; objectNumber += 1) {
    pdf += `${pad10(offsets[objectNumber])} 00000 n \n`
  }
  pdf += "trailer\n<< /Size 6 /Root 1 0 R >>\n"
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, "utf8")
}

test("DU-AUTO-10: PDF parsing returns headers + rows for table-style, text-based PDFs", async () => {
  const buffer = buildSimpleTablePdf()
  const blob = new Blob([buffer], { type: "application/pdf" })
  const parsed = await parseSpreadsheetFile(blob, "upload.pdf", "application/pdf")

  assert.deepEqual(parsed.headers, ["Usage", "Commission"])
  assert.equal(parsed.rows.length, 2)
  assert.deepEqual(parsed.rows[0], ["100", "25"])
  assert.deepEqual(parsed.rows[1], ["200", "50"])
})

test("DU-AUTO-10: PDF parsing rejects PDFs with no readable text", async () => {
  const blob = new Blob(["%PDF-1.4\n%empty\n"], { type: "application/pdf" })
  await assert.rejects(
    () => parseSpreadsheetFile(blob, "upload.pdf", "application/pdf"),
    /(unable to read pdf|no readable text|text-based pdf)/i,
  )
})

