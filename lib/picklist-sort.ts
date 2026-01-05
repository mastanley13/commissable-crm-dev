const PICKLIST_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

export function comparePicklistLabels(a: string, b: string): number {
  const left = String(a ?? "").trim()
  const right = String(b ?? "").trim()

  const primary = PICKLIST_COLLATOR.compare(left, right)
  if (primary !== 0) return primary

  // Deterministic fallback (preserve case/punctuation ordering when equivalent under collator).
  return left.localeCompare(right)
}

export function sortPicklistLabels(values: string[]): string[] {
  return [...values].sort(comparePicklistLabels)
}

export function sortByPicklistName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const primary = comparePicklistLabels(a.name, b.name)
    if (primary !== 0) return primary
    const leftId = String((a as any).id ?? "")
    const rightId = String((b as any).id ?? "")
    return leftId.localeCompare(rightId)
  })
}

