export interface LockableColumnLike {
  id: string
  width: number
  hidden?: boolean
  locked?: boolean
}

export interface LockedColumnLayout<T extends LockableColumnLike> {
  visibleColumns: T[]
  lockedColumns: T[]
  unlockedColumns: T[]
  renderColumns: T[]
  lockedLeftOffsets: Record<string, number>
  lastLockedColumnId: string | null
}

export function getLockedColumnLayout<T extends LockableColumnLike>(columns: readonly T[]): LockedColumnLayout<T> {
  const visibleColumns = columns.filter(column => !column.hidden)
  const lockedColumns = visibleColumns.filter(column => column.locked)
  const unlockedColumns = visibleColumns.filter(column => !column.locked)
  const renderColumns = [...lockedColumns, ...unlockedColumns]
  const lockedLeftOffsets: Record<string, number> = {}

  let runningLeft = 0
  for (const column of lockedColumns) {
    lockedLeftOffsets[column.id] = runningLeft
    runningLeft += Math.max(0, Math.round(column.width))
  }

  return {
    visibleColumns,
    lockedColumns,
    unlockedColumns,
    renderColumns,
    lockedLeftOffsets,
    lastLockedColumnId: lockedColumns.length > 0 ? lockedColumns[lockedColumns.length - 1].id : null,
  }
}
