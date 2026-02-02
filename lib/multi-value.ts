export type MultiValueKind = "id" | "text"

export type MultiValueParseOptions = {
  supportQuotes?: boolean
  maxItems?: number
  kind?: MultiValueKind
}

const DEFAULT_SUPPORT_QUOTES = true
const DEFAULT_MAX_ITEMS = 25

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function isPlaceholder(value: string) {
  if (!value) return true
  if (/^null$/i.test(value)) return true
  if (/^n\/a$/i.test(value)) return true
  if (/^na$/i.test(value)) return true
  if (value === "--") return true
  return false
}

export function normalizeMultiValueToken(value: string, kind: MultiValueKind = "text") {
  const cleaned = normalizeWhitespace(value)
  if (!cleaned || isPlaceholder(cleaned)) return ""

  // Preserve original casing for storage/display; normalization is only for comparisons.
  if (kind === "id") {
    return cleaned
  }
  return cleaned
}

export function normalizeMultiValueTokenForMatch(value: string, kind: MultiValueKind = "text") {
  const cleaned = normalizeMultiValueToken(value, kind)
  if (!cleaned) return ""
  return cleaned.toUpperCase()
}

export function parseMultiValueInput(
  raw: string | null | undefined,
  options: MultiValueParseOptions = {},
): { values: string[]; warnings: string[] } {
  const supportQuotes = options.supportQuotes ?? DEFAULT_SUPPORT_QUOTES
  const maxItems = Math.max(0, Math.floor(options.maxItems ?? DEFAULT_MAX_ITEMS))
  const kind: MultiValueKind = options.kind ?? "text"

  const input = raw ?? ""
  const warnings: string[] = []

  const chunks: string[] = []
  let buffer = ""
  let inQuotes = false

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]

    if (supportQuotes && character === "\"") {
      const next = input[index + 1]
      if (inQuotes && next === "\"") {
        buffer += "\""
        index += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }

    const isSeparator = character === "," || character === ";" || character === "\n" || character === "\r"
    if (!inQuotes && isSeparator) {
      chunks.push(buffer)
      buffer = ""
      continue
    }

    buffer += character
  }
  chunks.push(buffer)

  if (inQuotes) {
    warnings.push("Unclosed quote detected. Parsing continued anyway.")
  }

  const seen = new Set<string>()
  const values: string[] = []

  for (const chunk of chunks) {
    if (values.length >= maxItems) break

    const cleaned = normalizeMultiValueToken(chunk, kind)
    if (!cleaned) continue

    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    values.push(cleaned)
  }

  if (chunks.length > maxItems) {
    warnings.push(`Trimmed to first ${maxItems} values.`)
  }

  return { values, warnings }
}

export function formatMultiValue(values: string[]) {
  return values.join(", ")
}

export function canonicalizeMultiValueString(
  raw: string | null | undefined,
  options: MultiValueParseOptions = {},
): string | null {
  const { values } = parseMultiValueInput(raw, options)
  if (values.length === 0) return null
  return formatMultiValue(values)
}

export function isMultiValueEmpty(raw: string | null | undefined, options: MultiValueParseOptions = {}) {
  const { values } = parseMultiValueInput(raw, options)
  return values.length === 0
}

export function parseMultiValueMatchSet(
  raw: string | null | undefined,
  options: MultiValueParseOptions = {},
): Set<string> {
  const kind: MultiValueKind = options.kind ?? "text"
  const { values } = parseMultiValueInput(raw, options)
  const set = new Set<string>()
  for (const value of values) {
    const normalized = normalizeMultiValueTokenForMatch(value, kind)
    if (normalized) set.add(normalized)
  }
  return set
}

export function hasMultiValueIntersection(
  a: string | null | undefined,
  b: string | null | undefined,
  options: MultiValueParseOptions = {},
) {
  const aSet = parseMultiValueMatchSet(a, options)
  if (aSet.size === 0) return false
  const bSet = parseMultiValueMatchSet(b, options)
  if (bSet.size === 0) return false
  for (const token of aSet) {
    if (bSet.has(token)) return true
  }
  return false
}

