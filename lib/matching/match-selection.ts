export type MatchSelectionType = "OneToOne" | "OneToMany" | "ManyToOne" | "ManyToMany"

export type MatchSelectionClassification =
  | {
      ok: true
      type: MatchSelectionType
      lineCount: number
      scheduleCount: number
    }
  | {
      ok: false
      error: string
      lineCount: number
      scheduleCount: number
    }

export function classifyMatchSelection(params: {
  lineIds: readonly string[]
  scheduleIds: readonly string[]
}): MatchSelectionClassification {
  const lineCount = params.lineIds.length
  const scheduleCount = params.scheduleIds.length

  if (lineCount <= 0 && scheduleCount <= 0) {
    return { ok: false, error: "Select at least one deposit line and one schedule.", lineCount, scheduleCount }
  }
  if (lineCount <= 0) {
    return { ok: false, error: "Select at least one deposit line.", lineCount, scheduleCount }
  }
  if (scheduleCount <= 0) {
    return { ok: false, error: "Select at least one schedule.", lineCount, scheduleCount }
  }

  if (lineCount === 1 && scheduleCount === 1) {
    return { ok: true, type: "OneToOne", lineCount, scheduleCount }
  }
  if (lineCount === 1 && scheduleCount > 1) {
    return { ok: true, type: "OneToMany", lineCount, scheduleCount }
  }
  if (lineCount > 1 && scheduleCount === 1) {
    return { ok: true, type: "ManyToOne", lineCount, scheduleCount }
  }

  return { ok: true, type: "ManyToMany", lineCount, scheduleCount }
}

export function isSelectionCompatibleWithType(params: {
  type: MatchSelectionType
  lineCount: number
  scheduleCount: number
}): boolean {
  const { type, lineCount, scheduleCount } = params
  if (lineCount <= 0 || scheduleCount <= 0) return false

  switch (type) {
    case "OneToOne":
      return lineCount === 1 && scheduleCount === 1
    case "OneToMany":
      return lineCount === 1 && scheduleCount > 1
    case "ManyToOne":
      return lineCount > 1 && scheduleCount === 1
    case "ManyToMany":
      return lineCount > 1 && scheduleCount > 1
    default: {
      const exhaustiveCheck: never = type
      return exhaustiveCheck
    }
  }
}

