import { depositFieldDefinitions } from "./fields"
import { normalizeKey } from "./normalize"

export type DepositFieldId = (typeof depositFieldDefinitions)[number]["id"]

export type DepositMappingColumnMode = "custom" | "additional" | "product" | "ignore"

export interface DepositMappingColumnConfig {
  mode: DepositMappingColumnMode
  customKey?: string
}

export type DepositCustomFieldSection = "additional" | "product"

export interface DepositCustomFieldDefinition {
  label: string
  section: DepositCustomFieldSection
}

export interface DepositMappingConfigV1 {
  version: 1
  line: Partial<Record<DepositFieldId, string>>
  columns: Record<string, DepositMappingColumnConfig>
  customFields: Record<string, DepositCustomFieldDefinition>
  header?: {
    depositName?: string | null
    paymentDateColumn?: string | null
    customerAccountColumn?: string | null
  }
  options?: {
    hasHeaderRow?: boolean
    dateFormatHint?: string
    numberFormatHint?: string
  }
}

export type DepositColumnSelection =
  | { type: "canonical"; fieldId: DepositFieldId }
  | { type: "custom"; customKey: string }
  | { type: "additional" }
  | { type: "product" }
  | { type: "ignore" }

const DEFAULT_MAPPING: DepositMappingConfigV1 = {
  version: 1,
  line: {},
  columns: {},
  customFields: {},
}

export function createEmptyDepositMapping(): DepositMappingConfigV1 {
  return {
    version: 1,
    line: {},
    columns: {},
    customFields: {},
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function extractDepositMappingFromTemplateConfig(config: unknown): DepositMappingConfigV1 {
  if (!isPlainObject(config)) return createEmptyDepositMapping()
  const depositMapping = (config as Record<string, unknown>)["depositMapping"]
  if (!isPlainObject(depositMapping)) return createEmptyDepositMapping()
  if (depositMapping["version"] !== 1) return createEmptyDepositMapping()

  const line = isPlainObject(depositMapping["line"]) ? (depositMapping["line"] as Record<string, unknown>) : {}
  const columns = isPlainObject(depositMapping["columns"])
    ? (depositMapping["columns"] as Record<string, unknown>)
    : {}
  const customFields = isPlainObject(depositMapping["customFields"])
    ? (depositMapping["customFields"] as Record<string, unknown>)
    : {}

  const normalizedLine: Partial<Record<DepositFieldId, string>> = {}
  for (const field of depositFieldDefinitions) {
    const raw = line[field.id]
    if (typeof raw === "string" && raw.trim()) {
      normalizedLine[field.id] = raw.trim()
    }
  }

  const normalizedColumns: Record<string, DepositMappingColumnConfig> = {}
  for (const [columnName, raw] of Object.entries(columns)) {
    if (!columnName.trim() || !isPlainObject(raw)) continue
    const mode = raw["mode"]
    if (mode !== "custom" && mode !== "product" && mode !== "ignore" && mode !== "additional") continue
    const configEntry: DepositMappingColumnConfig = { mode }
    const customKey = raw["customKey"]
    if (typeof customKey === "string" && customKey.trim()) {
      configEntry.customKey = customKey.trim()
    }
    normalizedColumns[columnName] = configEntry
  }

  const normalizedCustomFields: Record<string, DepositCustomFieldDefinition> = {}
  for (const [customKey, raw] of Object.entries(customFields)) {
    if (!customKey.trim() || !isPlainObject(raw)) continue
    const label = typeof raw["label"] === "string" ? raw["label"].trim() : ""
    const section = raw["section"] === "product" ? "product" : "additional"
    if (!label) continue
    normalizedCustomFields[customKey] = { label, section }
  }

  const header = isPlainObject(depositMapping["header"]) ? (depositMapping["header"] as Record<string, unknown>) : {}
  const options = isPlainObject(depositMapping["options"])
    ? (depositMapping["options"] as Record<string, unknown>)
    : {}

  return {
    version: 1,
    line: normalizedLine,
    columns: normalizedColumns,
    customFields: normalizedCustomFields,
    header: {
      depositName: typeof header["depositName"] === "string" ? header["depositName"] : null,
      paymentDateColumn: typeof header["paymentDateColumn"] === "string" ? header["paymentDateColumn"] : null,
      customerAccountColumn: typeof header["customerAccountColumn"] === "string" ? header["customerAccountColumn"] : null,
    },
    options: {
      hasHeaderRow: typeof options["hasHeaderRow"] === "boolean" ? options["hasHeaderRow"] : undefined,
      dateFormatHint: typeof options["dateFormatHint"] === "string" ? options["dateFormatHint"] : undefined,
      numberFormatHint: typeof options["numberFormatHint"] === "string" ? options["numberFormatHint"] : undefined,
    },
  }
}

export function serializeDepositMappingForTemplate(mapping: DepositMappingConfigV1): { depositMapping: DepositMappingConfigV1 } {
  return {
    depositMapping: {
      ...DEFAULT_MAPPING,
      ...mapping,
      version: 1,
      line: mapping.line ?? {},
      columns: mapping.columns ?? {},
      customFields: mapping.customFields ?? {},
    },
  }
}

const AUTO_FIELD_SYNONYMS: Partial<Record<DepositFieldId, string[]>> = {
  usage: [
    "usage",
    "usage amount",
    "actual usage",
    "actual usage gross",
    "actual usage  gross",
    "gross usage",
    "mrc",
    "bill amount",
    "billing amount",
  ],
  commission: [
    "commission",
    "total commission",
    "actual commission",
    "commission amount",
    "commission due",
    "residual commission",
    "commission converted",
  ],
  accountNameRaw: ["customer name", "account legal name", "company name", "account", "customer"],
  accountIdVendor: [
    "vendor account id",
    "account id vendor",
    "account id",
    "customer account",
    "nav id",
    "nasp id",
    "account number",
    "former account number",
    "national account number",
  ],
  vendorNameRaw: ["vendor name", "vendor account", "vendor"],
  commissionRate: [
    "commission rate",
    "commission percent",
    "commission percentage",
    "residual percent",
    "residual rate",
    "rate",
    "mrc percent",
    "recurring comm rate",
    "usage rate",
  ],
  paymentDate: ["payment date", "deposit date", "date"],
  productNameRaw: ["product", "product name", "sku", "service", "plan"],
  customerIdVendor: ["customer id", "customer id vendor"],
  orderIdVendor: ["order id", "order number"],
  locationId: ["location id", "location"],
  customerPurchaseOrder: ["customer po", "purchase order", "po", "po number", "customer po #"],
  lineNumber: ["line", "line number", "row", "row number"],
}

function headerLooksLikeCommissionRate(normalizedHeader: string) {
  return normalizedHeader.includes("rate") || normalizedHeader.includes("percent") || normalizedHeader.includes("%")
}

function findBestHeader(headers: string[], candidates: string[], used: Set<string>, predicate?: (normalizedHeader: string) => boolean) {
  const normalizedCandidates = new Set(candidates.map(normalizeKey))
  for (const header of headers) {
    if (used.has(header)) continue
    const normalized = normalizeKey(header)
    if (!normalizedCandidates.has(normalized)) continue
    if (predicate && !predicate(normalized)) continue
    return header
  }
  return null
}

function buildNormalizedHeaderMap(headers: string[]) {
  const map = new Map<string, string | null>()
  for (const header of headers) {
    const key = normalizeKey(header)
    if (!key) continue
    if (!map.has(key)) {
      map.set(key, header)
      continue
    }
    // Mark ambiguous if multiple headers normalize to the same key.
    map.set(key, null)
  }
  return map
}

function resolveHeaderFromTemplate(headers: string[], normalizedMap: Map<string, string | null>, templateHeader: string) {
  if (headers.includes(templateHeader)) return templateHeader
  const lower = templateHeader.toLowerCase()
  const caseInsensitive = headers.find(header => header.toLowerCase() === lower)
  if (caseInsensitive) return caseInsensitive
  const normalized = normalizeKey(templateHeader)
  const normalizedMatch = normalized ? normalizedMap.get(normalized) ?? null : null
  return normalizedMatch
}

export function applyAutoMapping(headers: string[], mapping: DepositMappingConfigV1): DepositMappingConfigV1 {
  const next = { ...mapping, line: { ...mapping.line } }
  const used = new Set(Object.values(next.line).filter(Boolean) as string[])

  const priority: DepositFieldId[] = [
    "usage",
    "commission",
    "accountNameRaw",
    "accountIdVendor",
    "commissionRate",
    "productNameRaw",
    "paymentDate",
    "customerIdVendor",
    "orderIdVendor",
    "locationId",
    "customerPurchaseOrder",
    "vendorNameRaw",
    "distributorNameRaw",
    "lineNumber",
  ]

  for (const fieldId of priority) {
    if (next.line[fieldId]) continue
    const candidates = AUTO_FIELD_SYNONYMS[fieldId]
    if (!candidates || candidates.length === 0) continue

    const predicate =
      fieldId === "commission"
        ? (normalizedHeader: string) => !headerLooksLikeCommissionRate(normalizedHeader)
        : fieldId === "usage"
          ? (normalizedHeader: string) => !normalizedHeader.includes("rate")
          : undefined

    const match = findBestHeader(headers, candidates, used, predicate)
    if (!match) continue
    next.line[fieldId] = match
    used.add(match)
  }

  return next
}

function cloneMapping(mapping: DepositMappingConfigV1): DepositMappingConfigV1 {
  return {
    ...mapping,
    line: { ...(mapping.line ?? {}) },
    columns: { ...(mapping.columns ?? {}) },
    customFields: { ...(mapping.customFields ?? {}) },
  }
}

export function getColumnSelection(mapping: DepositMappingConfigV1, columnName: string): DepositColumnSelection {
  const mappedFieldId = Object.entries(mapping.line ?? {}).find(([, col]) => col === columnName)?.[0] as DepositFieldId | undefined
  if (mappedFieldId) {
    return { type: "canonical", fieldId: mappedFieldId }
  }

  const columnConfig = mapping.columns?.[columnName]
  if (!columnConfig) return { type: "additional" }

  if (columnConfig.mode === "custom") {
    const key = columnConfig.customKey
    if (key && mapping.customFields?.[key]) {
      return { type: "custom", customKey: key }
    }
    return { type: "additional" }
  }

  if (columnConfig.mode === "product") return { type: "product" }
  if (columnConfig.mode === "ignore") return { type: "ignore" }
  return { type: "additional" }
}

export function setColumnSelection(
  mapping: DepositMappingConfigV1,
  columnName: string,
  selection: DepositColumnSelection,
): DepositMappingConfigV1 {
  const next = cloneMapping(mapping)

  // If this column is currently mapped to a canonical field, clear it first.
  for (const [fieldId, mappedColumn] of Object.entries(next.line)) {
    if (mappedColumn === columnName) {
      delete next.line[fieldId as DepositFieldId]
    }
  }

  // Always clear explicit column config; re-add as needed.
  delete next.columns[columnName]

  if (selection.type === "canonical") {
    const { fieldId } = selection
    // Clear any other field that points at this column (enforce 1:1 column -> field).
    for (const [otherFieldId, mappedColumn] of Object.entries(next.line)) {
      if (otherFieldId !== fieldId && mappedColumn === columnName) {
        delete next.line[otherFieldId as DepositFieldId]
      }
    }
    // Clear any previous mapping for this fieldId (enforce 1:1 field -> column).
    delete next.line[fieldId]
    next.line[fieldId] = columnName
    return next
  }

  if (selection.type === "custom") {
    next.columns[columnName] = { mode: "custom", customKey: selection.customKey }
    return next
  }

  if (selection.type === "product") {
    next.columns[columnName] = { mode: "product" }
    return next
  }

  if (selection.type === "ignore") {
    next.columns[columnName] = { mode: "ignore" }
    return next
  }

  return next
}

function generateCustomKey() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `cf_${uuid}`
  const random = Math.random().toString(16).slice(2)
  return `cf_${Date.now().toString(16)}_${random}`
}

export function createCustomFieldForColumn(
  mapping: DepositMappingConfigV1,
  columnName: string,
  input: { label: string; section: DepositCustomFieldSection },
): { nextMapping: DepositMappingConfigV1; customKey: string } {
  const next = cloneMapping(mapping)
  for (const [fieldId, mappedColumn] of Object.entries(next.line)) {
    if (mappedColumn === columnName) {
      delete next.line[fieldId as DepositFieldId]
    }
  }
  delete next.columns[columnName]
  const customKey = generateCustomKey()
  next.customFields[customKey] = { label: input.label.trim(), section: input.section }
  next.columns[columnName] = { mode: "custom", customKey }
  return { nextMapping: next, customKey }
}

export function seedDepositMapping(params: {
  headers: string[]
  templateMapping: DepositMappingConfigV1 | null
}): DepositMappingConfigV1 {
  const base = createEmptyDepositMapping()

  if (params.templateMapping) {
    const merged = cloneMapping(params.templateMapping)
    const normalizedHeaders = buildNormalizedHeaderMap(params.headers)
    // Only keep line mappings that exist in the current upload.
    for (const [fieldId, columnName] of Object.entries(merged.line)) {
      if (!columnName) continue
      const resolved = resolveHeaderFromTemplate(params.headers, normalizedHeaders, columnName)
      if (!resolved) {
        delete merged.line[fieldId as DepositFieldId]
        continue
      }
      if (resolved !== columnName) {
        merged.line[fieldId as DepositFieldId] = resolved
      }
    }
    // Only keep column configs that exist in the current upload.
    for (const columnName of Object.keys(merged.columns)) {
      const resolved = resolveHeaderFromTemplate(params.headers, normalizedHeaders, columnName)
      if (!resolved) {
        delete merged.columns[columnName]
        continue
      }
      if (resolved !== columnName) {
        merged.columns[resolved] = merged.columns[columnName]!
        delete merged.columns[columnName]
      }
    }
    return applyAutoMapping(params.headers, { ...base, ...merged })
  }

  return applyAutoMapping(params.headers, base)
}
