import type { DepositMappingConfigV1 } from "./template-mapping"

export type TelarusTemplateFieldBlock = "common" | "template"

export interface TelarusTemplateFieldV1 {
  telarusFieldName: string
  commissableFieldLabel: string
  fieldId?: string | null
  commissionType?: string | null
  block?: TelarusTemplateFieldBlock
}

export interface TelarusTemplateFieldsV1 {
  version: 1
  templateMapName: string
  origin: string
  companyName: string
  templateId: string | null
  fields: TelarusTemplateFieldV1[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function extractTelarusTemplateFieldsFromTemplateConfig(config: unknown): TelarusTemplateFieldsV1 | null {
  if (!isPlainObject(config)) return null
  const candidate = config["telarusTemplateFields"]
  if (!isPlainObject(candidate)) return null
  if (candidate["version"] !== 1) return null

  const templateMapName = typeof candidate["templateMapName"] === "string" ? candidate["templateMapName"].trim() : ""
  const origin = typeof candidate["origin"] === "string" ? candidate["origin"].trim() : ""
  const companyName = typeof candidate["companyName"] === "string" ? candidate["companyName"].trim() : ""
  const templateId = typeof candidate["templateId"] === "string" ? candidate["templateId"].trim() : null

  const rawFields = Array.isArray(candidate["fields"]) ? candidate["fields"] : []
  const fields: TelarusTemplateFieldV1[] = []

  for (const raw of rawFields) {
    if (!isPlainObject(raw)) continue
    const telarusFieldName = typeof raw["telarusFieldName"] === "string" ? raw["telarusFieldName"].trim() : ""
    const commissableFieldLabel =
      typeof raw["commissableFieldLabel"] === "string" ? raw["commissableFieldLabel"].trim() : ""
    if (!telarusFieldName || !commissableFieldLabel) continue
    const fieldId = typeof raw["fieldId"] === "string" ? raw["fieldId"].trim() : null
    const commissionType = typeof raw["commissionType"] === "string" ? raw["commissionType"].trim() : null
    const block = raw["block"] === "common" || raw["block"] === "template" ? raw["block"] : undefined
    fields.push({ telarusFieldName, commissableFieldLabel, fieldId, commissionType, block })
  }

  return {
    version: 1,
    templateMapName,
    origin,
    companyName,
    templateId: templateId || null,
    fields,
  }
}

export function serializeTelarusTemplateFieldsForTemplate(value: TelarusTemplateFieldsV1): {
  telarusTemplateFields: TelarusTemplateFieldsV1
} {
  return { telarusTemplateFields: value }
}

export function stripTelarusGeneratedCustomFields(mapping: DepositMappingConfigV1): DepositMappingConfigV1 {
  const telarusKeys = Object.keys(mapping.customFields ?? {}).filter(key => key.startsWith("cf_telarus_"))
  if (telarusKeys.length === 0) return mapping

  const next: DepositMappingConfigV1 = {
    ...mapping,
    line: { ...(mapping.line ?? {}) },
    columns: { ...(mapping.columns ?? {}) },
    customFields: { ...(mapping.customFields ?? {}) },
  }

  for (const key of telarusKeys) {
    delete next.customFields[key]
  }

  for (const [columnName, config] of Object.entries(next.columns)) {
    if (config?.mode !== "custom") continue
    if (!config.customKey || !config.customKey.startsWith("cf_telarus_")) continue
    delete next.columns[columnName]
  }

  return next
}

