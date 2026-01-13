type UnknownRecord = Record<string, unknown>

const COLUMN_ID_ALIASES: Record<string, string> = {
  // "Other" columns reuse legacy vendor IDs internally; map distributor IDs to the unified vendor ID.
  accountIdDistributor: "accountIdVendor",
  customerIdDistributor: "customerIdVendor",
  orderIdDistributor: "orderIdVendor",
  distributorOrderId: "orderIdVendor",

  // Product distributor fields (unified into Other using vendor-first precedence).
  productNameDistributor: "productNameVendor",
  partNumberDistributor: "partNumberVendor",
  productDescriptionDistributor: "productDescriptionVendor",

  // If a caller ever persisted explicit *Other IDs, map them back to the canonical (legacy) column IDs.
  accountIdOther: "accountIdVendor",
  customerIdOther: "customerIdVendor",
  orderIdOther: "orderIdVendor",
  productNameOther: "productNameVendor",
  partNumberOther: "partNumberVendor",
  productDescriptionOther: "productDescriptionVendor",
}

export function aliasColumnId(columnId: string): string {
  return COLUMN_ID_ALIASES[columnId] ?? columnId
}

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    if (seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

function mapColumnIdArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const mapped = value
    .map((id) => (typeof id === "string" ? aliasColumnId(id) : ""))
    .filter((id) => id.length > 0)
  return dedupePreserveOrder(mapped)
}

function mapColumnWidths(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object") return null
  const widths = value as Record<string, unknown>
  const result: Record<string, number> = {}

  for (const [rawKey, rawWidth] of Object.entries(widths)) {
    if (typeof rawKey !== "string") continue
    const key = aliasColumnId(rawKey)
    if (typeof rawWidth !== "number" || !Number.isFinite(rawWidth) || rawWidth <= 0) continue

    // Prefer widths already set for the canonical id.
    if (!(key in result)) {
      result[key] = rawWidth
    }
  }

  return Object.keys(result).length > 0 ? result : null
}

function mapColumnIdInUnknownObject(value: unknown): unknown {
  if (!value || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(mapColumnIdInUnknownObject)

  const record = value as UnknownRecord
  if (typeof record.columnId === "string") {
    return { ...record, columnId: aliasColumnId(record.columnId) }
  }

  return value
}

export function migrateTablePreferencePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload
  const record = payload as UnknownRecord

  const migrated: UnknownRecord = { ...record }
  const columnOrder = mapColumnIdArray(record.columnOrder)
  const hiddenColumns = mapColumnIdArray(record.hiddenColumns)
  const columnWidths = mapColumnWidths(record.columnWidths)

  if (columnOrder) migrated.columnOrder = columnOrder
  if (hiddenColumns) migrated.hiddenColumns = hiddenColumns
  if (columnWidths) migrated.columnWidths = columnWidths

  if (record.sortState !== undefined) migrated.sortState = mapColumnIdInUnknownObject(record.sortState)
  if (record.filters !== undefined) migrated.filters = mapColumnIdInUnknownObject(record.filters)

  return migrated
}

export function normalizeTablePreferencePayloadForColumns<T extends { id: string }>(
  payload: unknown,
  columns: T[]
): unknown {
  const migrated = migrateTablePreferencePayload(payload)
  if (!migrated || typeof migrated !== "object") return migrated

  const record = migrated as UnknownRecord
  const validIds = new Set(columns.map((c) => c.id))

  const normalized: UnknownRecord = { ...record }

  if (Array.isArray(record.columnOrder)) {
    const filtered = (record.columnOrder as unknown[])
      .map((id) => (typeof id === "string" ? id : ""))
      .filter((id) => id.length > 0 && validIds.has(id))
    normalized.columnOrder = dedupePreserveOrder(filtered)
  }

  if (Array.isArray(record.hiddenColumns)) {
    const filtered = (record.hiddenColumns as unknown[])
      .map((id) => (typeof id === "string" ? id : ""))
      .filter((id) => id.length > 0 && validIds.has(id))
    normalized.hiddenColumns = dedupePreserveOrder(filtered)
  }

  if (record.columnWidths && typeof record.columnWidths === "object" && !Array.isArray(record.columnWidths)) {
    const widths = record.columnWidths as Record<string, unknown>
    const next: Record<string, number> = {}
    for (const [key, rawWidth] of Object.entries(widths)) {
      if (!validIds.has(key)) continue
      if (typeof rawWidth !== "number" || !Number.isFinite(rawWidth) || rawWidth <= 0) continue
      next[key] = rawWidth
    }
    normalized.columnWidths = Object.keys(next).length > 0 ? next : null
  }

  return normalized
}

