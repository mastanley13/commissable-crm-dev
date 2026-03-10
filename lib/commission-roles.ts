export const COMMISSION_ROLE_OPTIONS = [
  "Master Agent Recruiter Override",
  "Closer Recruiter Override",
  "Lead Generator Recruiter Override",
  "Var Recruiter Override",
  "Subagent Recruiter Override",
  "Closer",
  "Subject Matter Expert",
  "Var Management",
  "Lead Generator",
  "Cognigen Lead Generator Upline Override",
  "Var",
  "MVAR",
  "SVAR",
  "Original VAR Customer Lead Generator",
  "Subagent",
  "Master Agent",
] as const

export type CommissionRole = (typeof COMMISSION_ROLE_OPTIONS)[number]

export function normalizeCommissionRole(value: unknown): CommissionRole | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  return COMMISSION_ROLE_OPTIONS.find((role) => role.toLowerCase() === trimmed.toLowerCase()) ?? null
}

export function isSubjectMatterExpertCommissionRole(value: unknown): boolean {
  return normalizeCommissionRole(value) === "Subject Matter Expert"
}

export function resolveCommissionRole(
  commissionRole: unknown,
  isSubjectMatterExpertDeal?: boolean | null
): CommissionRole | null {
  return normalizeCommissionRole(commissionRole) ?? (isSubjectMatterExpertDeal ? "Subject Matter Expert" : null)
}
