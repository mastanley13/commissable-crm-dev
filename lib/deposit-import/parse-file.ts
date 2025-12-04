import Papa from "papaparse"
import * as XLSX from "xlsx"

export interface ParsedSpreadsheet {
  headers: string[]
  rows: string[][]
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

  throw new Error("Unsupported file type. Please upload a CSV or Excel file.")
}
