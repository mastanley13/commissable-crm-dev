export function normalizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "")
  const [intPart, ...rest] = cleaned.split(".")
  const fractional = rest.join("")
  return rest.length ? `${intPart}.${fractional}` : intPart
}

export function formatDecimalToFixed(value: string, decimals = 2): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const num = Number(trimmed)
  if (!Number.isFinite(num)) return trimmed
  return num.toFixed(decimals)
}

export function formatCurrencyDisplay(raw: string, opts: { alwaysSymbol?: boolean } = {}): string {
  const value = raw.trim()
  if (!value) return ""

  const ensureSymbol = (text: string) => {
    if (text.startsWith("$")) return text
    return `$${text}`
  }

  const parsed = Number(value.replace(/[^0-9.]/g, ""))
  if (!Number.isFinite(parsed)) {
    return opts.alwaysSymbol ? ensureSymbol(value) : value
  }

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(parsed)

  return opts.alwaysSymbol ? formatted : formatted
}

export function formatPercentDisplay(raw: string, opts: { alwaysSymbol?: boolean } = {}): string {
  const value = raw.trim()
  if (!value) return ""

  const ensurePercent = (text: string) => {
    if (text.endsWith("%")) return text
    return `${text}%`
  }

  const parsed = Number(value.replace(/[^0-9.]/g, ""))
  if (!Number.isFinite(parsed)) {
    return opts.alwaysSymbol ? ensurePercent(value) : value
  }

  const formatted = `${parsed.toFixed(2)}%`
  return opts.alwaysSymbol ? formatted : formatted
}

export function normalizePercentFractionValue(value: number | null | undefined): number {
  const numeric = typeof value === "number" ? value : Number(value ?? 0)
  if (!Number.isFinite(numeric)) return 0

  // Most of the app treats percent values as *fractions* (0.16 => 16%).
  // Some upstream sources provide whole-percent values (16 => 16%).
  // Heuristic: treat unusually-large values as whole-percent and convert.
  const abs = Math.abs(numeric)
  return abs > 3 ? numeric / 100 : numeric
}

