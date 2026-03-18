import type { DepositLineItemRow, SuggestedMatchScheduleRow } from "@/lib/mock-data"

import type { MatchSelectionType } from "./match-selection"

export type MatchWizardAllocationDraft = {
  usage: string
  commission: string
}

export type InlineActualTargets = {
  usage: number
  commission: number
}

function roundAmount(value: number) {
  return Math.round(value * 100) / 100
}

export function parseMatchWizardAmount(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric)) return null
  return roundAmount(numeric)
}

export function supportsInlineActualEditing(matchType: MatchSelectionType) {
  return matchType === "OneToOne" || matchType === "OneToMany"
}

export function buildInlineActualTargets(params: {
  matchType: MatchSelectionType
  selectedLines: DepositLineItemRow[]
  selectedSchedules: SuggestedMatchScheduleRow[]
  allocations: Record<string, MatchWizardAllocationDraft>
}) {
  const targets = new Map<string, InlineActualTargets>()
  if (!supportsInlineActualEditing(params.matchType)) return targets

  const lineId = params.selectedLines[0]?.id
  if (!lineId) return targets

  for (const schedule of params.selectedSchedules) {
    const allocation = params.allocations[`${lineId}:${schedule.id}`]
    const usageDelta = parseMatchWizardAmount(allocation?.usage ?? "") ?? 0
    const commissionDelta = parseMatchWizardAmount(allocation?.commission ?? "") ?? 0

    targets.set(schedule.id, {
      usage: roundAmount(Math.max(0, Number(schedule.actualUsage ?? 0) + usageDelta)),
      commission: roundAmount(Math.max(0, Number(schedule.actualCommission ?? 0) + commissionDelta)),
    })
  }

  return targets
}

export function deriveAllocationDraftFromActualTarget(params: {
  currentActual: number | null | undefined
  rawTarget: string
}) {
  const target = parseMatchWizardAmount(params.rawTarget)
  if (target === null) return ""

  const currentActual = roundAmount(Math.max(0, Number(params.currentActual ?? 0)))
  const delta = roundAmount(Math.max(0, target - currentActual))
  return delta > 0.005 ? delta.toFixed(2) : ""
}
