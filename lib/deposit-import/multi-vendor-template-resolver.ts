import { createEmptyDepositMappingV2, extractDepositMappingV2FromTemplateConfig, type DepositMappingConfigV2 } from "@/lib/deposit-import/template-mapping-v2"
import {
  extractTelarusTemplateFieldsFromTemplateConfig,
  stripTelarusGeneratedCustomFieldsV2,
  type TelarusTemplateFieldsV1,
} from "@/lib/deposit-import/telarus-template-fields"
import {
  rowHasTotalsLabel,
  shouldSkipMultiVendorRow,
} from "@/lib/deposit-import/multi-vendor"
import { normalizeKey } from "@/lib/deposit-import/normalize"

export interface MultiVendorRowGroup {
  vendorKey: string
  vendorName: string
  rows: string[][]
}

export interface GroupRowsByVendorResult {
  groups: MultiVendorRowGroup[]
  missingVendorRows: number[]
}

export interface FilterMultiVendorPreviewRowsParams {
  rows: string[][]
  vendorNameIndex: number
  vendorNamesInFile: string[]
  usageIndex?: number
  commissionIndex?: number
  maxRows?: number
}

export interface MultiVendorResolvedTemplate {
  vendorNameInFile: string
  vendorKey: string
  vendorAccountId: string
  vendorAccountName: string
  templateId: string
  templateName: string
  templateUpdatedAt: string
  templateConfig: unknown
}

export interface MultiVendorTemplatesUsedItem {
  vendorNameInFile: string
  vendorAccountId: string
  vendorAccountName: string
  templateId: string
  templateName: string
  templateUpdatedAt: string
}

export interface MultiVendorTemplateOption {
  templateId: string
  templateName: string
  templateUpdatedAt: string
  vendorAccountId: string
  vendorAccountName: string
  vendorNamesInFile: string[]
  depositMappingV2: DepositMappingConfigV2 | null
  telarusTemplateFields: TelarusTemplateFieldsV1 | null
}

export interface ResolveMultiVendorTemplatesResult {
  byVendorKey: Map<string, MultiVendorResolvedTemplate>
  templatesUsed: MultiVendorTemplatesUsedItem[]
  missingVendors: string[]
  vendorsMissingTemplates: string[]
}

export interface MultiVendorResolverDbClient {
  account: {
    findMany: (args: any) => Promise<any[]>
  }
  reconciliationTemplate: {
    findMany: (args: any) => Promise<any[]>
  }
}

export interface MergedTemplateConfigResult {
  depositMappingV2: DepositMappingConfigV2 | null
  telarusTemplateFields: TelarusTemplateFieldsV1 | null
}

function normalizeString(value: unknown) {
  if (value === null || value === undefined) return null
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeNumber(value: unknown) {
  if (value === undefined || value === null) return null
  const normalized = String(value).replace(/[^0-9.\-]/g, "")
  if (!normalized) return null
  const numeric = Number(normalized)
  if (Number.isNaN(numeric)) return null
  return numeric
}

function normalizeVendorKey(value: string) {
  return value.trim().toLowerCase()
}

export function groupRowsByVendor(params: {
  rows: string[][]
  vendorNameIndex: number
  usageIndex?: number
  commissionIndex?: number
}): GroupRowsByVendorResult {
  const groups = new Map<string, MultiVendorRowGroup>()
  const missingVendorRows: number[] = []
  const shouldFilterByAmounts = params.usageIndex !== undefined || params.commissionIndex !== undefined

  for (let rowIndex = 0; rowIndex < params.rows.length; rowIndex += 1) {
    const row = params.rows[rowIndex] ?? []

    if (shouldFilterByAmounts) {
      const usageValueRaw =
        params.usageIndex !== undefined ? normalizeNumber(row[params.usageIndex]) : null
      const commissionValue =
        params.commissionIndex !== undefined ? normalizeNumber(row[params.commissionIndex]) : null
      if (usageValueRaw === null && commissionValue === null) {
        continue
      }
    }

    const vendorNameRaw = normalizeString(row[params.vendorNameIndex])
    if (shouldSkipMultiVendorRow(row, vendorNameRaw)) {
      continue
    }

    if (!vendorNameRaw) {
      if (shouldFilterByAmounts) {
        if (missingVendorRows.length < 25) {
          missingVendorRows.push(rowIndex + 2)
        }
      }
      continue
    }

    const vendorKey = normalizeVendorKey(vendorNameRaw)
    const existing = groups.get(vendorKey)
    if (existing) {
      existing.rows.push(row)
      continue
    }
    groups.set(vendorKey, {
      vendorKey,
      vendorName: vendorNameRaw,
      rows: [row],
    })
  }

  return {
    groups: Array.from(groups.values()),
    missingVendorRows,
  }
}

export function filterMultiVendorPreviewRows(params: FilterMultiVendorPreviewRowsParams): string[][] {
  const vendorKeys = new Set(
    params.vendorNamesInFile
      .map(normalizeString)
      .filter((value): value is string => Boolean(value))
      .map(normalizeVendorKey),
  )

  if (vendorKeys.size === 0 || params.vendorNameIndex < 0) {
    return []
  }

  const rows: string[][] = []
  const shouldFilterByAmounts = params.usageIndex !== undefined || params.commissionIndex !== undefined
  const maxRows = params.maxRows ?? Number.POSITIVE_INFINITY

  for (let rowIndex = 0; rowIndex < params.rows.length; rowIndex += 1) {
    if (rows.length >= maxRows) {
      break
    }

    const row = params.rows[rowIndex] ?? []

    if (shouldFilterByAmounts) {
      const usageValue =
        params.usageIndex !== undefined ? normalizeNumber(row[params.usageIndex]) : null
      const commissionValue =
        params.commissionIndex !== undefined ? normalizeNumber(row[params.commissionIndex]) : null
      if (usageValue === null && commissionValue === null) {
        continue
      }
    }

    const vendorNameRaw = normalizeString(row[params.vendorNameIndex])
    if (shouldSkipMultiVendorRow(row, vendorNameRaw)) {
      continue
    }
    if (!vendorNameRaw) {
      continue
    }
    if (!vendorKeys.has(normalizeVendorKey(vendorNameRaw))) {
      continue
    }

    rows.push(row)
  }

  return rows
}

export async function resolveMultiVendorTemplates(params: {
  db: MultiVendorResolverDbClient
  tenantId: string
  distributorAccountId: string
  vendorNamesInFile: string[]
}): Promise<ResolveMultiVendorTemplatesResult> {
  const vendorNameByKey = new Map<string, string>()
  for (const rawName of params.vendorNamesInFile) {
    const vendorName = normalizeString(rawName)
    if (!vendorName) continue
    if (rowHasTotalsLabel([vendorName], true)) {
      continue
    }
    const key = normalizeVendorKey(vendorName)
    if (!vendorNameByKey.has(key)) {
      vendorNameByKey.set(key, vendorName)
    }
  }

  if (vendorNameByKey.size === 0) {
    return {
      byVendorKey: new Map(),
      templatesUsed: [],
      missingVendors: [],
      vendorsMissingTemplates: [],
    }
  }

  const vendorNames = Array.from(vendorNameByKey.values())
  const vendorAccounts = await params.db.account.findMany({
    where: {
      tenantId: params.tenantId,
      accountType: { is: { name: { equals: "Vendor", mode: "insensitive" } } },
      OR: vendorNames.flatMap(name => [
        { accountName: { equals: name, mode: "insensitive" } },
        { accountLegalName: { equals: name, mode: "insensitive" } },
      ]),
    },
    select: {
      id: true,
      accountName: true,
      accountLegalName: true,
    },
    orderBy: [{ accountName: "asc" }, { id: "asc" }],
  })

  const accountByExactNameKey = new Map<string, { id: string; accountName: string }>()
  const accountByLegalNameKey = new Map<string, { id: string; accountName: string }>()
  for (const account of vendorAccounts) {
    const accountName = normalizeString(account.accountName)
    const accountLegalName = normalizeString(account.accountLegalName)
    if (accountName) {
      const key = normalizeVendorKey(accountName)
      if (!accountByExactNameKey.has(key)) {
        accountByExactNameKey.set(key, { id: account.id, accountName: accountName })
      }
    }
    if (accountLegalName) {
      const key = normalizeVendorKey(accountLegalName)
      if (!accountByLegalNameKey.has(key)) {
        accountByLegalNameKey.set(key, {
          id: account.id,
          accountName: accountName ?? accountLegalName,
        })
      }
    }
  }

  const missingVendors: string[] = []
  const vendorAccountByKey = new Map<string, { id: string; accountName: string }>()
  for (const [vendorKey, vendorName] of vendorNameByKey.entries()) {
    const account = accountByExactNameKey.get(vendorKey) ?? accountByLegalNameKey.get(vendorKey)
    if (!account) {
      missingVendors.push(vendorName)
      continue
    }
    vendorAccountByKey.set(vendorKey, account)
  }

  const vendorAccountIds = Array.from(new Set(Array.from(vendorAccountByKey.values()).map(item => item.id)))
  const templateByVendorAccountId = new Map<
    string,
    { id: string; name: string; updatedAt: Date; config: unknown }
  >()

  if (vendorAccountIds.length > 0) {
    const templates = await params.db.reconciliationTemplate.findMany({
      where: {
        tenantId: params.tenantId,
        distributorAccountId: params.distributorAccountId,
        vendorAccountId: { in: vendorAccountIds },
      },
      select: {
        id: true,
        name: true,
        vendorAccountId: true,
        updatedAt: true,
        createdAt: true,
        config: true,
      },
      orderBy: [
        { vendorAccountId: "asc" },
        { updatedAt: "desc" },
        { createdAt: "desc" },
        { name: "asc" },
      ],
    })

    for (const template of templates) {
      if (!templateByVendorAccountId.has(template.vendorAccountId)) {
        templateByVendorAccountId.set(template.vendorAccountId, {
          id: template.id,
          name: template.name,
          updatedAt: template.updatedAt,
          config: template.config,
        })
      }
    }
  }

  const vendorsMissingTemplates: string[] = []
  const byVendorKey = new Map<string, MultiVendorResolvedTemplate>()
  const templatesUsed: MultiVendorTemplatesUsedItem[] = []

  for (const [vendorKey, vendorNameInFile] of vendorNameByKey.entries()) {
    const vendorAccount = vendorAccountByKey.get(vendorKey)
    if (!vendorAccount) continue
    const selectedTemplate = templateByVendorAccountId.get(vendorAccount.id)
    if (!selectedTemplate) {
      vendorsMissingTemplates.push(vendorNameInFile)
      continue
    }

    const resolved: MultiVendorResolvedTemplate = {
      vendorNameInFile,
      vendorKey,
      vendorAccountId: vendorAccount.id,
      vendorAccountName: vendorAccount.accountName,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      templateUpdatedAt: selectedTemplate.updatedAt.toISOString(),
      templateConfig: selectedTemplate.config,
    }

    byVendorKey.set(vendorKey, resolved)
    templatesUsed.push({
      vendorNameInFile,
      vendorAccountId: resolved.vendorAccountId,
      vendorAccountName: resolved.vendorAccountName,
      templateId: resolved.templateId,
      templateName: resolved.templateName,
      templateUpdatedAt: resolved.templateUpdatedAt,
    })
  }

  return {
    byVendorKey,
    templatesUsed,
    missingVendors,
    vendorsMissingTemplates,
  }
}

export function mergeMultiVendorTemplateConfigs(
  resolvedTemplates: MultiVendorResolvedTemplate[],
): MergedTemplateConfigResult {
  const mergedMapping = createEmptyDepositMappingV2()
  let hasMergedMapping = false

  for (const resolved of resolvedTemplates) {
    const extracted = stripTelarusGeneratedCustomFieldsV2(
      extractDepositMappingV2FromTemplateConfig(resolved.templateConfig),
    )
    const hasAnyContent =
      Object.keys(extracted.targets ?? {}).length > 0 ||
      Object.keys(extracted.columns ?? {}).length > 0 ||
      Object.keys(extracted.customFields ?? {}).length > 0
    if (!hasAnyContent) {
      continue
    }

    hasMergedMapping = true
    for (const [targetId, columnName] of Object.entries(extracted.targets ?? {})) {
      if (!targetId || !columnName) continue
      if (!mergedMapping.targets[targetId]) {
        mergedMapping.targets[targetId] = columnName
      }
    }

    for (const [columnName, config] of Object.entries(extracted.columns ?? {})) {
      if (!columnName || !config) continue
      if (!mergedMapping.columns[columnName]) {
        mergedMapping.columns[columnName] = {
          mode: config.mode,
          targetId: config.targetId,
          customKey: config.customKey,
        }
      }
    }

    for (const [customKey, definition] of Object.entries(extracted.customFields ?? {})) {
      if (!customKey || !definition) continue
      if (!mergedMapping.customFields[customKey]) {
        mergedMapping.customFields[customKey] = {
          label: definition.label,
          section: definition.section,
        }
      }
    }

    if (!mergedMapping.header && extracted.header) {
      mergedMapping.header = extracted.header
    }
    if (!mergedMapping.options && extracted.options) {
      mergedMapping.options = extracted.options
    }
  }

  for (const [targetId, columnName] of Object.entries(mergedMapping.targets ?? {})) {
    if (!columnName.trim()) continue
    if (!mergedMapping.columns[columnName]) {
      mergedMapping.columns[columnName] = {
        mode: "target",
        targetId,
      }
    }
  }

  const mergedTemplateFieldsByKey = new Map<string, TelarusTemplateFieldsV1["fields"][number]>()
  let templateFieldsMetadata: Pick<
    TelarusTemplateFieldsV1,
    "templateMapName" | "origin" | "companyName" | "templateId"
  > | null = null

  for (const resolved of resolvedTemplates) {
    const telarusTemplateFields = extractTelarusTemplateFieldsFromTemplateConfig(resolved.templateConfig)
    if (!telarusTemplateFields) continue
    if (!templateFieldsMetadata) {
      templateFieldsMetadata = {
        templateMapName: telarusTemplateFields.templateMapName || "Multi-vendor merged templates",
        origin: telarusTemplateFields.origin || "multi-vendor-preview",
        companyName: telarusTemplateFields.companyName || "Multiple vendors",
        templateId: null,
      }
    }
    for (const field of telarusTemplateFields.fields) {
      const key = normalizeKey(field.telarusFieldName) || field.telarusFieldName.trim().toLowerCase()
      if (!key || mergedTemplateFieldsByKey.has(key)) continue
      mergedTemplateFieldsByKey.set(key, field)
    }
  }

  const mergedTelarusTemplateFields: TelarusTemplateFieldsV1 | null =
    mergedTemplateFieldsByKey.size > 0
      ? {
          version: 1,
          templateMapName: templateFieldsMetadata?.templateMapName || "Multi-vendor merged templates",
          origin: templateFieldsMetadata?.origin || "multi-vendor-preview",
          companyName: templateFieldsMetadata?.companyName || "Multiple vendors",
          templateId: templateFieldsMetadata?.templateId ?? null,
          fields: Array.from(mergedTemplateFieldsByKey.values()),
        }
      : null

  return {
    depositMappingV2: hasMergedMapping ? mergedMapping : null,
    telarusTemplateFields: mergedTelarusTemplateFields,
  }
}

export function buildMultiVendorTemplateOptions(
  resolvedTemplates: MultiVendorResolvedTemplate[],
): MultiVendorTemplateOption[] {
  const byTemplateId = new Map<string, MultiVendorTemplateOption>()
  const vendorNamesByTemplateId = new Map<string, Set<string>>()

  for (const resolved of resolvedTemplates) {
    if (!resolved.templateId) continue
    if (!byTemplateId.has(resolved.templateId)) {
      const extractedMapping = stripTelarusGeneratedCustomFieldsV2(
        extractDepositMappingV2FromTemplateConfig(resolved.templateConfig),
      )
      const hasAnyMapping =
        Object.keys(extractedMapping.targets ?? {}).length > 0 ||
        Object.keys(extractedMapping.columns ?? {}).length > 0 ||
        Object.keys(extractedMapping.customFields ?? {}).length > 0
      const depositMappingV2 = hasAnyMapping ? extractedMapping : null
      const telarusTemplateFields = extractTelarusTemplateFieldsFromTemplateConfig(resolved.templateConfig)

      byTemplateId.set(resolved.templateId, {
        templateId: resolved.templateId,
        templateName: resolved.templateName,
        templateUpdatedAt: resolved.templateUpdatedAt,
        vendorAccountId: resolved.vendorAccountId,
        vendorAccountName: resolved.vendorAccountName,
        vendorNamesInFile: [],
        depositMappingV2,
        telarusTemplateFields,
      })
    }

    const set = vendorNamesByTemplateId.get(resolved.templateId) ?? new Set<string>()
    set.add(resolved.vendorNameInFile)
    vendorNamesByTemplateId.set(resolved.templateId, set)
  }

  const options = Array.from(byTemplateId.values())
  for (const option of options) {
    const names = vendorNamesByTemplateId.get(option.templateId)
    option.vendorNamesInFile = names ? Array.from(names).sort((a, b) => a.localeCompare(b)) : []
  }

  options.sort((a, b) => {
    const vendorCompare = a.vendorAccountName.localeCompare(b.vendorAccountName)
    if (vendorCompare !== 0) return vendorCompare
    const templateCompare = a.templateName.localeCompare(b.templateName)
    if (templateCompare !== 0) return templateCompare
    return a.templateId.localeCompare(b.templateId)
  })

  return options
}
