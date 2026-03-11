export interface LockGroupedItem {
  id: string
  locked: boolean
}

export function normalizeLockedColumnGroup<T extends LockGroupedItem>(items: readonly T[]): T[] {
  const lockedItems: T[] = []
  const unlockedItems: T[] = []

  for (const item of items) {
    if (item.locked) {
      lockedItems.push(item)
    } else {
      unlockedItems.push(item)
    }
  }

  return [...lockedItems, ...unlockedItems]
}

export function setItemLocked<T extends LockGroupedItem>(
  items: readonly T[],
  itemId: string,
  locked: boolean
): T[] {
  let changed = false

  const next = items.map(item => {
    if (item.id !== itemId) return item
    if (item.locked === locked) return item
    changed = true
    return { ...item, locked }
  })

  return changed ? normalizeLockedColumnGroup(next) : [...items]
}

export function canMoveItemWithinLockGroup<T extends LockGroupedItem>(
  items: readonly T[],
  itemId: string,
  direction: -1 | 1
): boolean {
  const sourceIndex = items.findIndex(item => item.id === itemId)
  if (sourceIndex === -1) return false

  const sourceItem = items[sourceIndex]
  const groupIndexes = items.reduce<number[]>((indexes, item, index) => {
    if (item.locked === sourceItem.locked) {
      indexes.push(index)
    }
    return indexes
  }, [])

  const groupPosition = groupIndexes.indexOf(sourceIndex)
  const targetPosition = groupPosition + direction

  return targetPosition >= 0 && targetPosition < groupIndexes.length
}

export function moveItemWithinLockGroup<T extends LockGroupedItem>(
  items: readonly T[],
  itemId: string,
  direction: -1 | 1
): T[] {
  const sourceIndex = items.findIndex(item => item.id === itemId)
  if (sourceIndex === -1) return [...items]

  const sourceItem = items[sourceIndex]
  const groupIndexes = items.reduce<number[]>((indexes, item, index) => {
    if (item.locked === sourceItem.locked) {
      indexes.push(index)
    }
    return indexes
  }, [])

  const groupPosition = groupIndexes.indexOf(sourceIndex)
  const targetPosition = groupPosition + direction
  if (targetPosition < 0 || targetPosition >= groupIndexes.length) {
    return [...items]
  }

  const targetIndex = groupIndexes[targetPosition]
  const next = [...items]
  const [moved] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, moved)

  return normalizeLockedColumnGroup(next)
}
