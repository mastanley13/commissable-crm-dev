export type ReconciliationSelectionState = {
  selectedLineId: string | null
  selectedLineItems: string[]
  selectedSchedules: string[]
}

export function resetReconciliationSelectionState(): ReconciliationSelectionState {
  return {
    selectedLineId: null,
    selectedLineItems: [],
    selectedSchedules: [],
  }
}

export function filterVisibleSelections(
  selectedIds: readonly string[],
  availableIds: readonly string[],
): string[] {
  const available = new Set(availableIds)
  return selectedIds.filter(id => available.has(id))
}
