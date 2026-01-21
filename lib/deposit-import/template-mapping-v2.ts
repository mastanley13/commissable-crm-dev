import { normalizeKey } from "./normalize"
import { AUTO_FIELD_SYNONYMS, extractDepositMappingFromTemplateConfig, type DepositFieldId, type DepositMappingConfigV1 } from "./template-mapping"
import {
  LEGACY_FIELD_ID_TO_TARGET_ID,
  type DepositImportFieldTarget,
} from "./field-catalog"
import type { DepositCustomFieldDefinition, DepositCustomFieldSection } from "./template-mapping"

export type DepositMappingColumnModeV2 = "target" | "custom" | "additional" | "ignore"

export interface DepositMappingColumnConfigV2 {
  mode: DepositMappingColumnModeV2
  targetId?: string
  customKey?: string
}

export interface DepositMappingConfigV2 {
  version: 2
  targets: Record<string, string>
  columns: Record<string, DepositMappingColumnConfigV2>
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

export type DepositColumnSelectionV2 =
  | { type: "target"; targetId: string }
  | { type: "custom"; customKey: string }
  | { type: "additional" }
  | { type: "ignore" }

const DEFAULT_MAPPING: DepositMappingConfigV2 = {
  version: 2,
  targets: {},
  columns: {},
  customFields: {},
}

export function createEmptyDepositMappingV2(): DepositMappingConfigV2 {
  return {
    version: 2,
    targets: {},
    columns: {},
    customFields: {},
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeColumns(
  columns: Record<string, unknown>,
): Record<string, DepositMappingColumnConfigV2> {
  const normalized: Record<string, DepositMappingColumnConfigV2> = {}
  for (const [columnName, raw] of Object.entries(columns)) {
    if (!columnName.trim() || !isPlainObject(raw)) continue
    const mode = raw["mode"]
    if (mode !== "target" && mode !== "custom" && mode !== "additional" && mode !== "ignore") continue
    const configEntry: DepositMappingColumnConfigV2 = { mode }
    const customKey = raw["customKey"]
    if (typeof customKey === "string" && customKey.trim()) {
      configEntry.customKey = customKey.trim()
    }
    const targetId = raw["targetId"]
    if (typeof targetId === "string" && targetId.trim()) {
      configEntry.targetId = targetId.trim()
    }
    normalized[columnName] = configEntry
  }
  return normalized
}

function normalizeTargets(targets: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {}
  for (const [targetId, raw] of Object.entries(targets)) {
    const columnName = typeof raw === "string" ? raw.trim() : ""
    if (!targetId.trim() || !columnName) continue
    normalized[targetId.trim()] = columnName
  }
  return normalized
}

function normalizeCustomFields(customFields: Record<string, unknown>): Record<string, DepositCustomFieldDefinition> {
  const normalized: Record<string, DepositCustomFieldDefinition> = {}
  for (const [customKey, raw] of Object.entries(customFields)) {
    if (!customKey.trim() || !isPlainObject(raw)) continue
    const label = typeof raw["label"] === "string" ? raw["label"].trim() : ""
    const section = raw["section"] === "product" ? "product" : "additional"
    if (!label) continue
    normalized[customKey] = { label, section }
  }
  return normalized
}

function ensureColumnsForTargets(mapping: DepositMappingConfigV2): DepositMappingConfigV2 {
  const next: DepositMappingConfigV2 = {
    ...mapping,
    targets: { ...(mapping.targets ?? {}) },
    columns: { ...(mapping.columns ?? {}) },
    customFields: { ...(mapping.customFields ?? {}) },
  }
  for (const [targetId, columnName] of Object.entries(next.targets)) {
    if (!columnName.trim()) continue
    const existing = next.columns[columnName]
    if (existing?.mode === "target" && existing.targetId === targetId) continue
    next.columns[columnName] = { mode: "target", targetId }
  }
  return next
}

export function extractDepositMappingV2FromTemplateConfig(config: unknown): DepositMappingConfigV2 {
  if (!isPlainObject(config)) return createEmptyDepositMappingV2()
  const depositMapping = (config as Record<string, unknown>)["depositMapping"]
  if (!isPlainObject(depositMapping)) return createEmptyDepositMappingV2()

  if (depositMapping["version"] === 2) {
    const targets = isPlainObject(depositMapping["targets"])
      ? normalizeTargets(depositMapping["targets"] as Record<string, unknown>)
      : {}
    const columns = isPlainObject(depositMapping["columns"])
      ? normalizeColumns(depositMapping["columns"] as Record<string, unknown>)
      : {}
    const customFields = isPlainObject(depositMapping["customFields"])
      ? normalizeCustomFields(depositMapping["customFields"] as Record<string, unknown>)
      : {}
    const header = isPlainObject(depositMapping["header"]) ? (depositMapping["header"] as Record<string, unknown>) : {}
    const options = isPlainObject(depositMapping["options"])
      ? (depositMapping["options"] as Record<string, unknown>)
      : {}

    return ensureColumnsForTargets({
      version: 2,
      targets,
      columns,
      customFields,
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
    })
  }

  if (depositMapping["version"] === 1) {
    return convertDepositMappingV1ToV2(extractDepositMappingFromTemplateConfig(config))
  }

  return createEmptyDepositMappingV2()
}

export function serializeDepositMappingForTemplateV2(mapping: DepositMappingConfigV2): { depositMapping: DepositMappingConfigV2 } {
  return {
    depositMapping: {
      ...DEFAULT_MAPPING,
      ...mapping,
      version: 2,
      targets: mapping.targets ?? {},
      columns: mapping.columns ?? {},
      customFields: mapping.customFields ?? {},
    },
  }
}

export function convertDepositMappingV1ToV2(mapping: DepositMappingConfigV1): DepositMappingConfigV2 {
  const targets: Record<string, string> = {}
  for (const [fieldId, columnName] of Object.entries(mapping.line ?? {})) {
    const targetId = LEGACY_FIELD_ID_TO_TARGET_ID[fieldId]
    if (!targetId) continue
    if (typeof columnName === "string" && columnName.trim()) {
      targets[targetId] = columnName.trim()
    }
  }

  const columns: Record<string, DepositMappingColumnConfigV2> = {}
  for (const [columnName, config] of Object.entries(mapping.columns ?? {})) {
    if (!columnName.trim() || !config) continue
    if (config.mode === "custom") {
      columns[columnName] = { mode: "custom", customKey: config.customKey }
    } else if (config.mode === "ignore") {
      columns[columnName] = { mode: "ignore" }
    } else {
      columns[columnName] = { mode: "additional" }
    }
  }

  const next: DepositMappingConfigV2 = {
    version: 2,
    targets,
    columns,
    customFields: { ...(mapping.customFields ?? {}) },
    header: mapping.header,
    options: mapping.options,
  }

  return ensureColumnsForTargets(next)
}

function headerLooksLikeCommissionRate(normalizedHeader: string) {
  return normalizedHeader.includes("rate") || normalizedHeader.includes("percent") || normalizedHeader.includes("%")
}

function findBestHeader(
  headers: string[],
  candidates: string[],
  used: Set<string>,
  predicate?: (normalizedHeader: string) => boolean,
) {
  const normalizedCandidates = candidates.map(normalizeKey).filter(Boolean) as string[]

  for (const candidate of normalizedCandidates) {
    for (const header of headers) {
      if (used.has(header)) continue
      const normalized = normalizeKey(header)
      if (!normalized || normalized !== candidate) continue
      if (predicate && !predicate(normalized)) continue
      return header
    }
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

const AUTO_MAPPING_PRIORITY: DepositFieldId[] = [
  "usage",
  "commission",
  "accountNameRaw",
  "accountIdVendor",
  "commissionRate",
  "productNameRaw",
  "partNumberRaw",
  "paymentDate",
  "customerIdVendor",
  "orderIdVendor",
  "locationId",
  "customerPurchaseOrder",
  "vendorNameRaw",
  "distributorNameRaw",
  "lineNumber",
]

export function applyAutoMappingV2(headers: string[], mapping: DepositMappingConfigV2): DepositMappingConfigV2 {
  const next = {
    ...mapping,
    targets: { ...(mapping.targets ?? {}) },
    columns: { ...(mapping.columns ?? {}) },
    customFields: { ...(mapping.customFields ?? {}) },
  }
  const used = new Set(Object.values(next.targets).filter(Boolean) as string[])

  for (const fieldId of AUTO_MAPPING_PRIORITY) {
    const targetId = LEGACY_FIELD_ID_TO_TARGET_ID[fieldId]
    if (!targetId || next.targets[targetId]) continue
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
    next.targets[targetId] = match
    used.add(match)
  }

  return ensureColumnsForTargets(next)
}

function cloneMapping(mapping: DepositMappingConfigV2): DepositMappingConfigV2 {
  return {
    ...mapping,
    targets: { ...(mapping.targets ?? {}) },
    columns: { ...(mapping.columns ?? {}) },
    customFields: { ...(mapping.customFields ?? {}) },
  }
}

export function getColumnSelectionV2(mapping: DepositMappingConfigV2, columnName: string): DepositColumnSelectionV2 {
  const columnConfig = mapping.columns?.[columnName]
  if (columnConfig?.mode === "target" && columnConfig.targetId) {
    return { type: "target", targetId: columnConfig.targetId }
  }

  const mappedTargetId = Object.entries(mapping.targets ?? {}).find(([, col]) => col === columnName)?.[0]
  if (mappedTargetId) {
    return { type: "target", targetId: mappedTargetId }
  }

  if (columnConfig?.mode === "custom") {
    const key = columnConfig.customKey
    if (key && mapping.customFields?.[key]) {
      return { type: "custom", customKey: key }
    }
    return { type: "additional" }
  }

  if (columnConfig?.mode === "ignore") return { type: "ignore" }
  if (columnConfig?.mode === "additional") return { type: "additional" }
  return { type: "additional" }
}

export function setColumnSelectionV2(
  mapping: DepositMappingConfigV2,
  columnName: string,
  selection: DepositColumnSelectionV2,
): DepositMappingConfigV2 {
  const next = cloneMapping(mapping)

  for (const [targetId, mappedColumn] of Object.entries(next.targets)) {
    if (mappedColumn === columnName) {
      delete next.targets[targetId]
    }
  }

  if (selection.type === "target") {
    delete next.targets[selection.targetId]
    next.targets[selection.targetId] = columnName
    next.columns[columnName] = { mode: "target", targetId: selection.targetId }
    return next
  }

  if (selection.type === "custom") {
    next.columns[columnName] = { mode: "custom", customKey: selection.customKey }
    return next
  }

  if (selection.type === "ignore") {
    next.columns[columnName] = { mode: "ignore" }
    return next
  }

  next.columns[columnName] = { mode: "additional" }
  return next
}

export function createCustomFieldForColumnV2(
  mapping: DepositMappingConfigV2,
  columnName: string,
  input: { label: string; section: DepositCustomFieldSection },
): { nextMapping: DepositMappingConfigV2; customKey: string } {
  const next = cloneMapping(mapping)
  const baseKey = `cf_${normalizeKey(input.label) || "field"}`
  let customKey = baseKey
  let counter = 1
  while (next.customFields[customKey]) {
    counter += 1
    customKey = `${baseKey}_${counter}`
  }

  next.customFields[customKey] = { label: input.label.trim(), section: input.section }
  next.columns[columnName] = { mode: "custom", customKey }
  for (const [targetId, mappedColumn] of Object.entries(next.targets)) {
    if (mappedColumn === columnName) {
      delete next.targets[targetId]
    }
  }

  return { nextMapping: next, customKey }
}

export function seedDepositMappingV2(params: {
  headers: string[]
  templateMapping: DepositMappingConfigV2 | null
}): DepositMappingConfigV2 {
  const base = createEmptyDepositMappingV2()
  if (!params.templateMapping) {
    return applyAutoMappingV2(params.headers, base)
  }

  const normalizedMap = buildNormalizedHeaderMap(params.headers)
  const next = cloneMapping(params.templateMapping)
  const nextTargets: Record<string, string> = {}

  for (const [targetId, columnName] of Object.entries(next.targets ?? {})) {
    if (!columnName.trim()) continue
    const resolved = resolveHeaderFromTemplate(params.headers, normalizedMap, columnName)
    if (resolved) nextTargets[targetId] = resolved
  }

  const nextColumns: Record<string, DepositMappingColumnConfigV2> = {}
  for (const [columnName, config] of Object.entries(next.columns ?? {})) {
    if (!columnName.trim()) continue
    const resolved = resolveHeaderFromTemplate(params.headers, normalizedMap, columnName)
    if (!resolved) continue
    nextColumns[resolved] = { ...config }
  }

  const merged: DepositMappingConfigV2 = {
    ...base,
    ...next,
    targets: nextTargets,
    columns: nextColumns,
  }

  return applyAutoMappingV2(params.headers, merged)
}

export function getMappedTargets(
  mapping: DepositMappingConfigV2,
  targets: DepositImportFieldTarget[],
): Record<string, string> {
  const lookup = new Map(targets.map(target => [target.id, target]))
  const mapped: Record<string, string> = {}
  for (const [targetId, columnName] of Object.entries(mapping.targets ?? {})) {
    if (!columnName) continue
    const target = lookup.get(targetId)
    const label = target?.label ?? targetId
    mapped[label] = columnName
  }
  return mapped
}
