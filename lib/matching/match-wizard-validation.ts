export type MatchWizardValidationIssue = {
  level: "error" | "warning"
}

export type MatchWizardValidationPreview = {
  ok: boolean
  issues: MatchWizardValidationIssue[]
}

export type MatchWizardValidationState =
  | "idle"
  | "running"
  | "valid"
  | "warning"
  | "error"
  | "stale"
  | "system_error"

export function deriveMatchWizardValidationState(params: {
  canValidate: boolean
  validationLoading: boolean
  validationUpToDate: boolean
  validationError: string | null
  preview: MatchWizardValidationPreview | null
}): MatchWizardValidationState {
  const { canValidate, validationLoading, validationUpToDate, validationError, preview } = params

  if (validationError) return "system_error"
  if (validationLoading) return "running"
  if (!preview) return canValidate ? "running" : "idle"
  if (!validationUpToDate) return "stale"
  if (!preview.ok || preview.issues.some(issue => issue.level === "error")) return "error"
  if (preview.issues.some(issue => issue.level === "warning")) return "warning"
  return "valid"
}
