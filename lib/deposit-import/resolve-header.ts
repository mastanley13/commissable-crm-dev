import { normalizeKey } from "./normalize"

export type ResolveHeaderResult =
  | { ok: true; index: number; header: string }
  | { ok: false; reason: "not_found" | "ambiguous"; matches?: string[] }

function resolveUniqueMatch(headers: string[], predicate: (header: string) => boolean): ResolveHeaderResult {
  const matches: Array<{ index: number; header: string }> = []

  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index] ?? ""
    if (predicate(header)) {
      matches.push({ index, header })
      if (matches.length > 1) break
    }
  }

  if (matches.length === 1) {
    return { ok: true, index: matches[0]!.index, header: matches[0]!.header }
  }

  if (matches.length > 1) {
    return { ok: false, reason: "ambiguous", matches: matches.map(match => match.header) }
  }

  return { ok: false, reason: "not_found" }
}

export function resolveSpreadsheetHeader(headers: string[], requestedHeader: string): ResolveHeaderResult {
  if (!requestedHeader) return { ok: false, reason: "not_found" }

  const exactIndex = headers.indexOf(requestedHeader)
  if (exactIndex !== -1) {
    return { ok: true, index: exactIndex, header: headers[exactIndex]! }
  }

  const trimmedRequested = requestedHeader.trim()
  if (!trimmedRequested) return { ok: false, reason: "not_found" }

  const byTrim = resolveUniqueMatch(headers, header => header.trim() === trimmedRequested)
  if (byTrim.ok || byTrim.reason === "ambiguous") return byTrim

  const loweredRequested = trimmedRequested.toLowerCase()
  const byCaseInsensitiveTrim = resolveUniqueMatch(
    headers,
    header => header.trim().toLowerCase() === loweredRequested,
  )
  if (byCaseInsensitiveTrim.ok || byCaseInsensitiveTrim.reason === "ambiguous") return byCaseInsensitiveTrim

  const normalizedRequested = normalizeKey(trimmedRequested)
  if (!normalizedRequested) return { ok: false, reason: "not_found" }

  return resolveUniqueMatch(headers, header => normalizeKey(header) === normalizedRequested)
}

