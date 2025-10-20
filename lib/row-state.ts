// Small shared helpers for determining row state across dynamic tables

export type RowStateOptions = {
  // When true (default), rows with isPrimary = true are treated as active
  // This is primarily for Contacts, where a primary contact should not be deleted
  treatPrimaryAsActive?: boolean
}

/**
 * Determine whether a row should be considered inactive for the purpose of showing delete controls.
 * A row is considered active if either `active` is true or (optionally) `isPrimary` is true.
 */
export function isRowInactive(row: any, opts?: RowStateOptions): boolean {
  const options: RowStateOptions = { treatPrimaryAsActive: true, ...(opts || {}) }
  const activeLike = Boolean(row?.active)
  const primaryLike = options.treatPrimaryAsActive ? Boolean(row?.isPrimary) : false
  return !(activeLike || primaryLike)
}


