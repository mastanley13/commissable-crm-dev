import { depositFieldDefinitions } from "./fields"
import { normalizeKey } from "./normalize"
import { AUTO_FIELD_SYNONYMS, type DepositFieldId } from "./template-mapping"

export interface DepositFieldSuggestion {
  fieldId: DepositFieldId
  label: string
  score: number
}

function tokenize(normalized: string) {
  return normalized.split(" ").filter(Boolean)
}

function isSubset(a: Set<string>, b: Set<string>) {
  for (const token of a) {
    if (!b.has(token)) return false
  }
  return true
}

function headerLooksLikeCommissionRate(normalizedHeader: string) {
  return normalizedHeader.includes("rate") || normalizedHeader.includes("percent") || normalizedHeader.includes("%")
}

function scoreNormalized(headerNormalized: string, candidateNormalized: string) {
  if (!headerNormalized || !candidateNormalized) return 0
  if (headerNormalized === candidateNormalized) return 1

  const headerTokens = new Set(tokenize(headerNormalized))
  const candidateTokens = new Set(tokenize(candidateNormalized))

  if (headerTokens.size === 0 || candidateTokens.size === 0) return 0
  if (isSubset(candidateTokens, headerTokens) || isSubset(headerTokens, candidateTokens)) return 0.92

  if (headerNormalized.includes(candidateNormalized) || candidateNormalized.includes(headerNormalized)) return 0.86

  let intersection = 0
  for (const token of candidateTokens) {
    if (headerTokens.has(token)) intersection += 1
  }
  if (intersection === 0) return 0

  const union = headerTokens.size + candidateTokens.size - intersection
  const jaccard = union === 0 ? 0 : intersection / union
  const candidateCoverage = intersection / candidateTokens.size
  return 0.55 * candidateCoverage + 0.45 * jaccard
}

export function suggestDepositFieldMatches(
  header: string,
  options?: { limit?: number; minScore?: number },
): DepositFieldSuggestion[] {
  const limit = options?.limit ?? 3
  const minScore = options?.minScore ?? 0.82

  const headerNormalized = normalizeKey(header)
  if (!headerNormalized) return []

  const suggestions: DepositFieldSuggestion[] = []

  for (const field of depositFieldDefinitions) {
    const candidates = new Set<string>()
    candidates.add(field.label)
    candidates.add(field.id)
    for (const candidate of AUTO_FIELD_SYNONYMS[field.id] ?? []) {
      candidates.add(candidate)
    }

    let best = 0
    for (const candidate of candidates) {
      const candidateNormalized = normalizeKey(candidate)
      if (!candidateNormalized) continue
      const score = scoreNormalized(headerNormalized, candidateNormalized)
      if (score > best) best = score
    }

    if (field.id === "commission" && headerLooksLikeCommissionRate(headerNormalized)) {
      best *= 0.25
    }
    if (field.id === "usage" && headerNormalized.includes("rate")) {
      best *= 0.3
    }

    if (best >= minScore) {
      suggestions.push({ fieldId: field.id as DepositFieldId, label: field.label, score: best })
    }
  }

  suggestions.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
  return suggestions.slice(0, limit)
}

