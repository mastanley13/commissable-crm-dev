import Papa from "papaparse"
import * as XLSX from "xlsx"

export interface ParsedSpreadsheet {
  headers: string[]
  rows: string[][]
}

type PdfTextItem = {
  str?: string
  transform?: number[]
  width?: number
}

function normalizeRow(row: unknown[] | undefined): string[] {
  if (!row) return []
  return row.map(value => {
    if (value === null || value === undefined) return ""
    if (typeof value === "string") return value
    return String(value)
  })
}

function isCsvFile(fileName: string, mimeType?: string) {
  const lowered = fileName.toLowerCase()
  return lowered.endsWith(".csv") || mimeType === "text/csv"
}

function isExcelFile(fileName: string) {
  const lowered = fileName.toLowerCase()
  return lowered.endsWith(".xls") || lowered.endsWith(".xlsx")
}

function isPdfFile(fileName: string, mimeType?: string) {
  const lowered = fileName.toLowerCase()
  return lowered.endsWith(".pdf") || mimeType === "application/pdf"
}

function normalizePdfCellText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim()
  return normalized.length > 0 ? normalized : ""
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

async function parsePdfFile(file: File | Blob, fileName: string) : Promise<ParsedSpreadsheet> {
  const buffer = await file.arrayBuffer()
  if (!buffer || buffer.byteLength === 0) {
    throw new Error(`PDF file "${fileName}" is empty`)
  }

  let pdfjs: any
  try {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  } catch (error) {
    console.error("Unable to load PDF parser", error)
    throw new Error("PDF support is unavailable on this deployment")
  }

  const bytes = new Uint8Array(buffer)
  let doc: any
  try {
    const task = pdfjs.getDocument({ data: bytes, disableWorker: true })
    doc = await task.promise
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error ?? "")
    if (/password/i.test(message)) {
      throw new Error("PDF is password-protected. Please upload an unlocked PDF or export as CSV/Excel.")
    }
    throw new Error("Unable to read PDF. Please upload a text-based PDF (not a scanned image).")
  }

  const fragments: { text: string; x: number; y: number; endX: number }[] = []
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber)
    const content = await page.getTextContent()
    const items = (content?.items ?? []) as PdfTextItem[]
    for (const item of items) {
      const raw = typeof item?.str === "string" ? item.str : ""
      const text = normalizePdfCellText(raw)
      if (!text) continue
      const transform = Array.isArray(item?.transform) ? item.transform : null
      const x = transform && typeof transform[4] === "number" ? transform[4] : 0
      const y = transform && typeof transform[5] === "number" ? transform[5] : 0
      const width = typeof item?.width === "number" && Number.isFinite(item.width) ? item.width : Math.max(1, text.length) * 5
      fragments.push({ text, x, y, endX: x + width })
    }
  }

  if (!fragments.length) {
    throw new Error("PDF contains no readable text. Please upload a text-based PDF or export as CSV/Excel.")
  }

  fragments.sort((a, b) => (b.y - a.y) || (a.x - b.x))
  const yTolerance = 2
  const lines: { y: number; fragments: typeof fragments }[] = []
  for (const fragment of fragments) {
    const last = lines[lines.length - 1]
    if (!last || Math.abs(fragment.y - last.y) > yTolerance) {
      lines.push({ y: fragment.y, fragments: [fragment] })
    } else {
      last.fragments.push(fragment)
      last.y = (last.y + fragment.y) / 2
    }
  }

  const splitLineIntoCells = (lineFragments: typeof fragments) => {
    const sorted = [...lineFragments].sort((a, b) => a.x - b.x)
    const gaps: number[] = []
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const gap = sorted[index + 1].x - sorted[index].endX
      if (Number.isFinite(gap) && gap > 0) gaps.push(gap)
    }
    const gapThreshold = gaps.length < 4 ? 24 : Math.max(24, median(gaps) * 3)

    const cells: { text: string; startX: number }[] = []
    let currentText = ""
    let currentStartX = 0
    let currentEndX = 0
    for (const frag of sorted) {
      if (!currentText) {
        currentText = frag.text
        currentStartX = frag.x
        currentEndX = frag.endX
        continue
      }
      const gap = frag.x - currentEndX
      if (gap > gapThreshold) {
        cells.push({ text: normalizePdfCellText(currentText), startX: currentStartX })
        currentText = frag.text
        currentStartX = frag.x
        currentEndX = frag.endX
      } else {
        currentText = `${currentText} ${frag.text}`
        currentEndX = Math.max(currentEndX, frag.endX)
      }
    }
    if (currentText) {
      cells.push({ text: normalizePdfCellText(currentText), startX: currentStartX })
    }
    return cells.filter(cell => cell.text.length > 0)
  }

  const headerLineIndex = lines.findIndex(line => splitLineIntoCells(line.fragments).length >= 2)
  if (headerLineIndex === -1) {
    throw new Error("Unable to detect a table header in the PDF. Please upload a CSV/Excel or a table-style PDF.")
  }

  const headerCells = splitLineIntoCells(lines[headerLineIndex].fragments)
  const headers = headerCells.map(cell => cell.text)
  if (!headers.length) {
    throw new Error("Unable to detect a header row in the PDF.")
  }

  const startXs = headerCells.map(cell => cell.startX).sort((a, b) => a - b)
  const boundaries: number[] = []
  for (let index = 0; index < startXs.length - 1; index += 1) {
    boundaries.push((startXs[index] + startXs[index + 1]) / 2)
  }

  const rows: string[][] = []
  for (let lineIndex = headerLineIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]
    const cells = new Array(headers.length).fill("")
    const sorted = [...line.fragments].sort((a, b) => a.x - b.x)
    for (const frag of sorted) {
      let col = 0
      for (let boundaryIndex = 0; boundaryIndex < boundaries.length; boundaryIndex += 1) {
        if (frag.x >= boundaries[boundaryIndex]) col = boundaryIndex + 1
        else break
      }
      const next = cells[col] ? `${cells[col]} ${frag.text}` : frag.text
      cells[col] = normalizePdfCellText(next)
    }
    const normalized = cells.map(value => normalizePdfCellText(value))
    if (normalized.every(value => !value)) continue
    if (normalized.length === headers.length && normalized.every((value, idx) => value === headers[idx])) continue
    rows.push(normalized)
  }

  if (rows.length === 0) {
    throw new Error("PDF did not contain any data rows. Please export as CSV/Excel or verify the PDF includes a table.")
  }

  return { headers, rows }
}

export async function parseSpreadsheetFile(file: File | Blob, fileName?: string, mimeType?: string): Promise<ParsedSpreadsheet> {
  const effectiveName = fileName ?? (file as File)?.name ?? "upload"
  const effectiveType = mimeType ?? (file as File)?.type

  if (isCsvFile(effectiveName, effectiveType)) {
    const text = await file.text()
    const parsed = Papa.parse<string[]>(text, {
      skipEmptyLines: "greedy",
    })
    if (parsed.errors.length > 0) {
      throw new Error(parsed.errors[0]?.message || "Unable to parse CSV file")
    }
    const rows = parsed.data.filter(row => row && row.some(cell => cell?.trim()))
    const headers = normalizeRow(rows.shift())
    if (!headers.length) {
      throw new Error("CSV file is missing a header row")
    }
    return { headers, rows: rows.map(normalizeRow) }
  }

  if (isExcelFile(effectiveName)) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = (XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][])
      .map(normalizeRow)
      .filter(row => row.length > 0 && row.some(cell => cell.trim()))
    const headers = normalizeRow(rows.shift())
    if (!headers.length) {
      throw new Error("Spreadsheet is missing a header row")
    }
    return { headers, rows }
  }

  if (isPdfFile(effectiveName, effectiveType)) {
    return parsePdfFile(file, effectiveName)
  }

  throw new Error("Unsupported file type. Please upload a CSV, Excel, or PDF file.")
}
