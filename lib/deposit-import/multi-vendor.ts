const TOTAL_LABEL_PATTERN = /^(?:grand\s+)?totals?$|^sub[- ]?totals?$/i
const TOTAL_LABEL_SUFFIX_PATTERN = /^(?:.*\s+)?(?:grand\s+)?(?:totals?|sub[- ]?totals?)$/i

function isSummaryRowSkipEnabled() {
  const value = process.env.DEPOSIT_IMPORT_SKIP_SUMMARY_ROWS
  if (!value) return false
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function isTotalsLabel(value: unknown, allowSuffixMatch = false) {
  const raw = normalizeCell(value)
  if (!raw) return false
  if (raw.length > 32) return false
  const candidate = raw.replace(/[:\u2014\u2013-]+$/g, "").trim()
  if (!candidate) return false
  if (candidate.length > 32) return false
  if (TOTAL_LABEL_PATTERN.test(candidate)) return true
  return allowSuffixMatch && TOTAL_LABEL_SUFFIX_PATTERN.test(candidate)
}

export function rowHasTotalsLabel(row: readonly unknown[], useSuffixMatch = false) {
  for (const cell of row) {
    if (isTotalsLabel(cell, useSuffixMatch)) return true
  }
  return false
}

export function shouldSkipMultiVendorRow(row: readonly unknown[], vendorName: string | null | undefined) {
  const useSuffixMatch = isSummaryRowSkipEnabled()
  if (!row.length) return true
  if (row.every(value => !normalizeCell(value))) return true
  if (isTotalsLabel(vendorName, useSuffixMatch)) return true
  if (rowHasTotalsLabel(row, useSuffixMatch)) return true
  return false
}

export function isSummaryRowSkipEnabledForImport() {
  return isSummaryRowSkipEnabled()
}
