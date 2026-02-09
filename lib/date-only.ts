const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

export function isDateOnlyString(value: string): boolean {
  return DATE_ONLY_PATTERN.test(value)
}

export function formatDateOnlyUtc(value: Date | string | null | undefined): string {
  if (!value) return ""
  if (typeof value === "string" && isDateOnlyString(value)) return value
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  return `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}-${pad2(parsed.getUTCDate())}`
}

export function parseDateSortValue(value: string | null | undefined): number {
  if (!value) return 0
  if (isDateOnlyString(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}
