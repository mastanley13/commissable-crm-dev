export interface NormalizedOpportunityRoleDraft {
  contactId: string
  role: string
}

export function normalizeRoleDrafts(input: unknown): {
  complete: NormalizedOpportunityRoleDraft[]
  hasIncomplete: boolean
} {
  if (!Array.isArray(input)) {
    return { complete: [], hasIncomplete: false }
  }

  const complete: NormalizedOpportunityRoleDraft[] = []
  let hasIncomplete = false

  for (const row of input) {
    if (!row || typeof row !== "object") continue
    const record = row as Record<string, unknown>
    const contactId = typeof record.contactId === "string" ? record.contactId.trim() : ""
    const role = typeof record.role === "string" ? record.role.trim() : ""

    const meaningful = contactId.length > 0 || role.length > 0
    if (!meaningful) continue

    if (contactId.length > 0 && role.length > 0) {
      complete.push({ contactId, role })
    } else {
      hasIncomplete = true
    }
  }

  return { complete, hasIncomplete }
}

export function requireAtLeastOneRole(
  complete: NormalizedOpportunityRoleDraft[],
  hasIncomplete: boolean
): { ok: true } | { ok: false; error: string } {
  if (hasIncomplete) {
    return { ok: false, error: "Please complete or remove incomplete role rows." }
  }
  if (!Array.isArray(complete) || complete.length === 0) {
    return { ok: false, error: "At least one role contact is required." }
  }
  return { ok: true }
}

