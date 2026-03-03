import { normalizeKey } from "./normalize"
import type { DepositMappingConfigV2, DepositColumnSelectionV2 } from "./template-mapping-v2"
import type { TelarusTemplateFieldsV1 } from "./telarus-template-fields"

export type DepositMappingBucketId = "template" | "new" | "exclude"

export interface DepositColumnBucketResult {
  bucket: DepositMappingBucketId
  reason:
    | "ignored"
    | "blank"
    | "template_known"
    | "needs_mapping"
    | "mapped_not_saved"
    | "unmapped_no_values"
}

function buildNormalizedHeaderLookup(headers: string[]) {
  const lookup = new Map<string, string>()
  for (const header of headers) {
    const key = normalizeKey(header)
    if (key && !lookup.has(key)) lookup.set(key, header)
  }
  return lookup
}

export function resolveTemplateKnownHeaders(params: {
  headers: string[]
  templateMapping: DepositMappingConfigV2 | null
  templateFields: TelarusTemplateFieldsV1 | null
}): Set<string> {
  const { headers, templateMapping, templateFields } = params

  const normalizedHeaderLookup = buildNormalizedHeaderLookup(headers)

  const candidates = new Set<string>()
  if (templateMapping) {
    for (const columnName of Object.values(templateMapping.targets ?? {})) {
      if (typeof columnName === "string" && columnName.trim()) candidates.add(columnName)
    }
    for (const columnName of Object.keys(templateMapping.columns ?? {})) {
      if (columnName.trim()) candidates.add(columnName)
    }
  }

  if (templateFields?.fields?.length) {
    for (const field of templateFields.fields) {
      if (field.telarusFieldName?.trim()) candidates.add(field.telarusFieldName)
    }
  }

  const resolved = new Set<string>()
  for (const candidate of candidates) {
    if (headers.includes(candidate)) {
      resolved.add(candidate)
      continue
    }
    const match = normalizedHeaderLookup.get(normalizeKey(candidate))
    if (match) resolved.add(match)
  }

  return resolved
}

export function classifyDepositColumnBucket(params: {
  header: string
  selection: DepositColumnSelectionV2
  hasAnyValue: boolean
  templateKnownHeaders: Set<string>
}): DepositColumnBucketResult {
  const { header, selection, hasAnyValue, templateKnownHeaders } = params

  if (selection.type === "ignore") return { bucket: "exclude", reason: "ignored" }
  if (!hasAnyValue) return { bucket: "exclude", reason: "blank" }

  if (templateKnownHeaders.has(header)) {
    return { bucket: "template", reason: "template_known" }
  }

  if (selection.type === "additional") {
    return { bucket: "new", reason: "needs_mapping" }
  }

  return { bucket: "exclude", reason: "mapped_not_saved" }
}

