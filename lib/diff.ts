type PlainObject = Record<string, unknown>

const hasStructuredClone = typeof structuredClone === "function"

export function cloneDeep<T>(value: T): T {
  if (hasStructuredClone) {
    try {
      return structuredClone(value)
    } catch (error) {
      // fall back below
    }
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as unknown as T
  }

  if (Array.isArray(value)) {
    return value.map(item => cloneDeep(item)) as unknown as T
  }

  if (value && typeof value === "object") {
    const result: PlainObject = {}
    for (const [key, entry] of Object.entries(value as PlainObject)) {
      result[key] = cloneDeep(entry)
    }
    return result as T
  }

  return value
}

function isPlainObject(value: unknown): value is PlainObject {
  return Object.prototype.toString.call(value) === "[object Object]"
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => isEqual(item, b[index]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)])
    for (const key of Array.from(keys)) {
      if (!isEqual(a[key], b[key])) return false
    }
    return true
  }
  return false
}

export type DiffResult<T> = Partial<T>

export function diffPatch<T>(original: T | null | undefined, updated: T | null | undefined): DiffResult<T> {
  if (original === undefined || original === null) {
    return (updated == null ? {} : cloneDeep(updated)) as DiffResult<T>
  }

  if (updated === undefined || updated === null) {
    return {} as DiffResult<T>
  }

  if (isEqual(original, updated)) {
    return {} as DiffResult<T>
  }

  if (Array.isArray(original) && Array.isArray(updated)) {
    return cloneDeep(updated) as DiffResult<T>
  }

  if (isPlainObject(original) && isPlainObject(updated)) {
    const patch: PlainObject = {}
    const keys = new Set<string>([...Object.keys(original), ...Object.keys(updated)])

    for (const key of Array.from(keys)) {
      const originalValue = original[key]
      const updatedValue = updated[key]
      if (isEqual(originalValue, updatedValue)) {
        continue
      }

      if (isPlainObject(originalValue) && isPlainObject(updatedValue)) {
        const childPatch = diffPatch(originalValue, updatedValue)
        if (Object.keys(childPatch as PlainObject).length > 0) {
          patch[key] = childPatch as unknown
        }
        continue
      }

      if (Array.isArray(originalValue) && Array.isArray(updatedValue)) {
        if (!isEqual(originalValue, updatedValue)) {
          patch[key] = cloneDeep(updatedValue)
        }
        continue
      }

      patch[key] = cloneDeep(updatedValue)
    }

    return patch as DiffResult<T>
  }

  return cloneDeep(updated) as DiffResult<T>
}

export function hasChanges<T>(original: T | null | undefined, updated: T | null | undefined): boolean {
  const patch = diffPatch(original, updated)
  if (Array.isArray(patch)) {
    return patch.length > 0
  }
  return Object.keys(patch as PlainObject).length > 0
}
