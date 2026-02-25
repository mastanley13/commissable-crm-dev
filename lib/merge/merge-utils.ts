import type { MergeWinner } from "./merge-types"

export function isBlankString(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "")
}

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.trim() === ""
  return false
}

export function resolveMergedFieldValue<T>(
  key: string,
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  fieldWinners: Record<string, MergeWinner | undefined>
): T | undefined {
  const winner = fieldWinners[key]
  const targetValue = target[key]
  const sourceValue = source[key]

  if (winner === "target") return targetValue as T
  if (winner === "source") return sourceValue as T

  if (isEmptyValue(targetValue) && !isEmptyValue(sourceValue)) {
    return sourceValue as T
  }

  return targetValue as T
}

export function buildFieldConflicts(
  keys: string[],
  target: Record<string, unknown>,
  source: Record<string, unknown>
) {
  return keys
    .map(key => ({ field: key, target: target[key], source: source[key] }))
    .filter(entry => {
      const t = entry.target
      const s = entry.source
      if (isEmptyValue(t) && isEmptyValue(s)) return false
      if (t === null && s === null) return false
      if (t === undefined && s === undefined) return false
      return JSON.stringify(t) !== JSON.stringify(s)
    })
}

