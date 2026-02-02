const TOTAL_LABEL_PATTERN = /^(?:grand\s+)?totals?$|^sub[- ]?totals?$/i

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function isTotalsLabel(value: unknown) {
  const raw = normalizeCell(value)
  if (!raw) return false
  if (raw.length > 32) return false
  const candidate = raw.replace(/[:\u2014\u2013-]+$/g, "").trim()
  if (!candidate) return false
  if (candidate.length > 32) return false
  return TOTAL_LABEL_PATTERN.test(candidate)
}

export function rowHasTotalsLabel(row: readonly unknown[]) {
  for (const cell of row) {
    if (isTotalsLabel(cell)) return true
  }
  return false
}

export function shouldSkipMultiVendorRow(row: readonly unknown[], vendorName: string | null | undefined) {
  if (!row.length) return true
  if (row.every(value => !normalizeCell(value))) return true
  if (isTotalsLabel(vendorName)) return true
  if (rowHasTotalsLabel(row)) return true
  return false
}

