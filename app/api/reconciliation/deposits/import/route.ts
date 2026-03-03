import { NextRequest, NextResponse } from "next/server"
import { AuditAction, DataEntity, FieldModule, ImportExportSource, JobStatus } from "@prisma/client"
import type { Prisma } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { parseSpreadsheetFile } from "@/lib/deposit-import/parse-file"
import {
  buildDepositImportFieldCatalog,
  buildDepositImportFieldCatalogIndex,
  DEPOSIT_IMPORT_TARGET_IDS,
  LEGACY_FIELD_ID_TO_TARGET_ID,
} from "@/lib/deposit-import/field-catalog"
import { getClientIP, getUserAgent, logAudit } from "@/lib/audit"
import { resolveSpreadsheetHeader } from "@/lib/deposit-import/resolve-header"
import {
  extractDepositMappingV2FromTemplateConfig,
  sanitizeDepositMappingForTemplateV2,
  serializeDepositMappingForTemplateV2,
  type DepositMappingConfigV2,
} from "@/lib/deposit-import/template-mapping-v2"
import { groupRowsByVendor, resolveMultiVendorTemplates } from "@/lib/deposit-import/multi-vendor-template-resolver"
import { rowHasTotalsLabel } from "@/lib/deposit-import/multi-vendor"

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function parseCommissionPeriod(value: string | null) {
  if (!value) return null
  const [yearString, monthString] = value.split("-")
  const year = Number(yearString)
  const month = Number(monthString)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null
  if (month < 1 || month > 12) return null
  return new Date(Date.UTC(year, month - 1, 1))
}

function normalizeNumber(value: string | undefined) {
  if (value === undefined || value === null) {
    return null
  }
  const normalized = value.replace(/[^0-9.\-]/g, "")
  if (!normalized) return null
  const numeric = Number(normalized)
  if (Number.isNaN(numeric)) return null
  return numeric
}

function normalizeString(value: string | undefined) {
  return value && value.trim().length > 0 ? value.trim() : null
}

function parseDateValue(value: string | undefined, fallback?: Date) {
  if (!value) return fallback ?? null
  const trimmed = value.trim()
  if (!trimmed) return fallback ?? null
  const numeric = Number(trimmed)
  if (!Number.isNaN(numeric) && numeric > 20000 && numeric < 60000) {
    // Excel serial number
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    return new Date(excelEpoch.getTime() + numeric * 24 * 60 * 60 * 1000)
  }
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? fallback ?? null : parsed
}

function parseBoolean(value: string | undefined) {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (["true", "yes", "1", "y"].includes(normalized)) return true
  if (["false", "no", "0", "n"].includes(normalized)) return false
  return null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseValueByType(dataType: string, value: string | undefined, fallbackDate?: Date) {
  if (dataType === "number") return normalizeNumber(value)
  if (dataType === "date") return parseDateValue(value, fallbackDate)
  if (dataType === "boolean") return parseBoolean(value)
  return normalizeString(value)
}

function setMetadataValue(
  metadata: Record<string, unknown>,
  path: string[],
  value: unknown,
) {
  if (!path.length) return
  let cursor: Record<string, unknown> = metadata
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index]
    if (!isPlainObject(cursor[key])) {
      cursor[key] = {}
    }
    cursor = cursor[key] as Record<string, unknown>
  }
  cursor[path[path.length - 1]] = value
}

function buildColumnIndex(headers: string[], mapping: Record<string, string>) {
  const columnIndex: Record<string, number> = {}
  for (const [fieldId, columnName] of Object.entries(mapping)) {
    if (!columnName) continue

    const resolved = resolveSpreadsheetHeader(headers, columnName)
    if (!resolved.ok) {
      if (resolved.reason === "ambiguous") {
        const suffix = resolved.matches?.length ? ` (matches: ${resolved.matches.join(", ")})` : ""
        throw new Error(`Column "${columnName}" is ambiguous in uploaded file${suffix}`)
      }
      throw new Error(`Column "${columnName}" not found in uploaded file`)
    }

    columnIndex[fieldId] = resolved.index
  }
  return columnIndex
}

function findFirstNonEmptyValue(rows: string[][], columnIndex: number) {
  for (const row of rows) {
    const raw = row[columnIndex]
    if (raw === undefined || raw === null) continue
    const value = String(raw).trim()
    if (value.length > 0) return value
  }
  return null
}

export async function POST(request: NextRequest) {
  return withPermissions(request, ["reconciliation.manage", "reconciliation.view"], async req => {
    const formData = await request.formData()
    const tenantId = req.user.tenantId
    const totalStartMs = Date.now()

    const file = formData.get("file")
    if (!(file instanceof File)) {
      return createErrorResponse("File upload is required", 400)
    }

    const depositName = (formData.get("depositName") as string | null) ?? ""
    const paymentDateInput = (formData.get("paymentDate") as string | null) ?? ""
    const distributorAccountIdRaw = ((formData.get("distributorAccountId") as string | null) ?? "").trim()
    const vendorAccountIdRaw = ((formData.get("vendorAccountId") as string | null) ?? "").trim()
    const reconciliationTemplateIdRaw = ((formData.get("reconciliationTemplateId") as string | null) ?? "").trim()
    const saveTemplateMappingRaw = ((formData.get("saveTemplateMapping") as string | null) ?? "").trim().toLowerCase()
    const saveTemplateMapping = saveTemplateMappingRaw === "true" || saveTemplateMappingRaw === "1" || saveTemplateMappingRaw === "yes"
    const multiVendorRaw = ((formData.get("multiVendor") as string | null) ?? "").trim().toLowerCase()
    const multiVendor = multiVendorRaw === "true" || multiVendorRaw === "1" || multiVendorRaw === "yes"
    const idempotencyKeyRaw = ((formData.get("idempotencyKey") as string | null) ?? "").trim()
    const createdByContactId = ((formData.get("createdByContactId") as string | null) ?? "").trim() || null

    if (!distributorAccountIdRaw || (!vendorAccountIdRaw && !multiVendor)) {
      return createErrorResponse(multiVendor ? "Distributor is required" : "Distributor and vendor are required", 400)
    }

    const distributorAccountId = distributorAccountIdRaw
    const vendorAccountId = vendorAccountIdRaw
    const reconciliationTemplateId = reconciliationTemplateIdRaw || null
    const idempotencyKey = idempotencyKeyRaw || null

    const commissionPeriodInput = (formData.get("commissionPeriod") as string | null) ?? ""
    const mappingRaw = formData.get("mapping")
    if (!mappingRaw || typeof mappingRaw !== "string") {
      return createErrorResponse("Field mapping is required", 400)
    }

    let mappingPayload: unknown
    try {
      mappingPayload = JSON.parse(mappingRaw) as unknown
    } catch {
      return createErrorResponse("Invalid mapping payload", 400)
    }

    // Support both the original flat { fieldId: columnName } mapping and the v1/v2 configs.
    let mappingConfig: DepositMappingConfigV2 | null = null
    let mappingConfigForTemplate: DepositMappingConfigV2 | null = null
    let multiVendorMappingsByTemplateId: Record<string, DepositMappingConfigV2> | null = null
    let multiVendorSaveUpdatesByTemplateId: Record<string, boolean> = {}
    let multiVendorVendorNameColumn: string | null = null

    if (mappingPayload && isPlainObject(mappingPayload)) {
      const candidate = mappingPayload as Record<string, unknown>
	      if (candidate["version"] === "multiVendorV1") {
        if (!multiVendor) {
          return createErrorResponse("Multi-vendor mapping payload requires multi-vendor upload mode", 400)
        }

        const rawMappings = candidate["mappingsByTemplateId"]
        if (!isPlainObject(rawMappings)) {
          return createErrorResponse("Invalid multi-vendor mapping payload", 400)
        }

        const mappings: Record<string, DepositMappingConfigV2> = {}
        for (const [templateIdRaw, raw] of Object.entries(rawMappings)) {
          const templateId = templateIdRaw.trim()
          if (!templateId) continue
          mappings[templateId] = extractDepositMappingV2FromTemplateConfig({ depositMapping: raw })
        }

        if (Object.keys(mappings).length === 0) {
          return createErrorResponse("Field mapping is required", 400)
        }

        multiVendorMappingsByTemplateId = mappings

        const rawSaveUpdates = candidate["saveUpdatesByTemplateId"]
        if (isPlainObject(rawSaveUpdates)) {
          const parsed: Record<string, boolean> = {}
          for (const [templateIdRaw, value] of Object.entries(rawSaveUpdates)) {
            const templateId = templateIdRaw.trim()
            if (!templateId) continue
            if (value === true) {
              parsed[templateId] = true
              continue
            }
            if (typeof value === "string") {
              const normalized = value.trim().toLowerCase()
              if (normalized === "true" || normalized === "1" || normalized === "yes") {
                parsed[templateId] = true
              }
            }
          }
          multiVendorSaveUpdatesByTemplateId = parsed
        }

        const vendorColumnNames = new Map<string, string>()
        for (const config of Object.values(mappings)) {
          const vendorColumn = (config.targets?.["depositLineItem.vendorNameRaw"] ?? "").trim()
          if (!vendorColumn) continue
          vendorColumnNames.set(vendorColumn.toLowerCase(), vendorColumn)
        }

        if (vendorColumnNames.size === 0) {
          return createErrorResponse('Multi-vendor uploads require mapping the "Vendor Name" column.', 400)
        }

        if (vendorColumnNames.size > 1) {
          return createErrorResponse(
            'Multi-vendor uploads require using the same "Vendor Name" column for all templates.',
            400,
          )
        }

        multiVendorVendorNameColumn = Array.from(vendorColumnNames.values())[0] ?? null
	      } else if (typeof candidate["version"] === "number" && (candidate["version"] === 1 || candidate["version"] === 2)) {
	        mappingConfig = extractDepositMappingV2FromTemplateConfig({ depositMapping: mappingPayload })
	        mappingConfigForTemplate = sanitizeDepositMappingForTemplateV2(mappingConfig)
	      } else {
        const targets: Record<string, string> = {}
        for (const [fieldId, columnName] of Object.entries(candidate)) {
          if (typeof columnName !== "string" || !columnName.trim()) continue
          const targetId = LEGACY_FIELD_ID_TO_TARGET_ID[fieldId]
          if (!targetId) continue
          targets[targetId] = columnName.trim()
        }
	        if (Object.keys(targets).length > 0) {
	          mappingConfig = {
	            version: 2,
	            targets,
	            columns: {},
	            customFields: {},
	          }
	          mappingConfigForTemplate = sanitizeDepositMappingForTemplateV2(mappingConfig)
	        }
	      }
	    }

    if (!mappingConfig && !multiVendorMappingsByTemplateId) {
      return createErrorResponse("Field mapping is required", 400)
    }

    if (mappingConfig) {
      const hasUsage = Boolean(mappingConfig.targets?.[DEPOSIT_IMPORT_TARGET_IDS.usage])
      const hasCommission = Boolean(mappingConfig.targets?.[DEPOSIT_IMPORT_TARGET_IDS.commission])
      if (!hasUsage && !hasCommission) {
        return createErrorResponse('Missing mapping for required fields: Actual Usage or Actual Commission', 400)
      }
    }

    const opportunityFields = await prisma.fieldDefinition.findMany({
      where: { tenantId, module: FieldModule.Opportunities },
      select: { fieldCode: true, label: true, dataType: true },
      orderBy: { displayOrder: "asc" },
    })
    const fieldCatalog = buildDepositImportFieldCatalog({ opportunityFieldDefinitions: opportunityFields })
    const fieldCatalogIndex = buildDepositImportFieldCatalogIndex(fieldCatalog)

    if (mappingConfig) {
      const unknownTargets = Object.keys(mappingConfig.targets ?? {}).filter(targetId => !fieldCatalogIndex.has(targetId))
      if (unknownTargets.length > 0) {
        return createErrorResponse(`Unknown mapping targets: ${unknownTargets.join(", ")}`, 400)
      }
    } else if (multiVendorMappingsByTemplateId) {
      const unknownTargets = new Set<string>()
      for (const config of Object.values(multiVendorMappingsByTemplateId)) {
        for (const targetId of Object.keys(config.targets ?? {})) {
          if (!fieldCatalogIndex.has(targetId)) {
            unknownTargets.add(targetId)
          }
        }
      }
      if (unknownTargets.size > 0) {
        return createErrorResponse(`Unknown mapping targets: ${Array.from(unknownTargets).join(", ")}`, 400)
      }
    }

    const depositDate = paymentDateInput ? new Date(paymentDateInput) : new Date()
    if (Number.isNaN(depositDate.getTime())) {
      return createErrorResponse("Invalid payment date provided", 400)
    }
    const commissionPeriodDate = parseCommissionPeriod(commissionPeriodInput)

    if (idempotencyKey) {
      const existingJob = await prisma.importJob.findFirst({
        where: {
          tenantId,
          entity: DataEntity.Reconciliations,
          idempotencyKey,
        },
        select: { status: true, filters: true },
      })

      if (existingJob) {
        const existingDepositId = (existingJob.filters as any)?.depositId as string | undefined
        const existingDepositIds = (existingJob.filters as any)?.depositIds as string[] | undefined
        if (existingJob.status === JobStatus.Completed) {
          if (multiVendor && Array.isArray(existingDepositIds) && existingDepositIds.length > 0) {
            return NextResponse.json({ data: { depositIds: existingDepositIds, idempotent: true } })
          }
          if (!multiVendor && existingDepositId) {
            return NextResponse.json({ data: { depositId: existingDepositId, idempotent: true } })
          }
        }

        return createErrorResponse("An import with this idempotency key already exists", 409)
      }
    }

    const parseStartMs = Date.now()
    const parsedFile = await parseSpreadsheetFile(file, file.name, file.type)
    const parseDurationMs = Date.now() - parseStartMs
    if (!parsedFile.headers.length || parsedFile.rows.length === 0) {
      return createErrorResponse("Uploaded file did not contain any data rows", 400)
    }

    let columnIndex: Record<string, number> = {}
    let customColumnIndex: Record<string, number> = {}
    try {
      if (mappingConfig) {
        columnIndex = buildColumnIndex(parsedFile.headers, mappingConfig.targets ?? {})
        const customMapping: Record<string, string> = {}
        for (const [columnName, config] of Object.entries(mappingConfig.columns ?? {})) {
          if (config?.mode !== "custom" || !config.customKey) continue
          customMapping[config.customKey] = columnName
        }
        if (Object.keys(customMapping).length > 0) {
          customColumnIndex = buildColumnIndex(parsedFile.headers, customMapping)
        }
      } else if (multiVendorMappingsByTemplateId && multiVendorVendorNameColumn) {
        columnIndex = buildColumnIndex(parsedFile.headers, {
          "depositLineItem.vendorNameRaw": multiVendorVendorNameColumn,
        })
      }
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : "Mapping failed", 400)
    }

    const depositOverrides: { depositName?: string; paymentDate?: Date } = {}
    if (mappingConfig) {
      for (const [targetId, columnName] of Object.entries(mappingConfig.targets ?? {})) {
        const target = fieldCatalogIndex.get(targetId)
        if (!target || target.persistence !== "depositColumn" || !target.columnName) continue
        const index = columnIndex[targetId]
        if (index === undefined) continue
        const raw = findFirstNonEmptyValue(parsedFile.rows, index)
        const parsedValue = parseValueByType(target.dataType, raw ?? undefined)
        if (parsedValue === null || parsedValue === undefined) continue
        if (target.columnName === "depositName" && typeof parsedValue === "string") {
          depositOverrides.depositName = parsedValue.trim()
        }
        if (target.columnName === "paymentDate" && parsedValue instanceof Date) {
          depositOverrides.paymentDate = parsedValue
        }
      }
    }

    const resolvedDepositDate = depositOverrides.paymentDate ?? depositDate
    if (Number.isNaN(resolvedDepositDate.getTime())) {
      return createErrorResponse("Invalid payment date provided", 400)
    }
    const resolvedDepositName = depositOverrides.depositName || depositName || null

    const templateConfigToPersist: Prisma.InputJsonValue | null = mappingConfigForTemplate
      ? (serializeDepositMappingForTemplateV2(mappingConfigForTemplate) as unknown as Prisma.InputJsonValue)
      : null

    const selectedTemplate = reconciliationTemplateId
      ? await prisma.reconciliationTemplate.findFirst({
          where: { tenantId, id: reconciliationTemplateId },
          select: { id: true, distributorAccountId: true, vendorAccountId: true },
        })
      : null

    if (reconciliationTemplateId && !selectedTemplate) {
      return createErrorResponse("Selected template was not found", 404)
    }

    if (
      selectedTemplate &&
      (selectedTemplate.distributorAccountId !== distributorAccountId ||
        selectedTemplate.vendorAccountId !== vendorAccountId)
    ) {
      return createErrorResponse("Selected template does not match the chosen distributor/vendor", 400)
    }

    try {
      const txStartMs = Date.now()

      const result = await prisma.$transaction(async tx => {
        if (multiVendor) {
          if (multiVendorMappingsByTemplateId) {
            const vendorNameIndex = columnIndex["depositLineItem.vendorNameRaw"]
            if (vendorNameIndex === undefined) {
              throw new Error('Unable to locate the mapped "Vendor Name" column in the uploaded file.')
            }

            const amountColumnIndexes = new Set<number>()
            for (const config of Object.values(multiVendorMappingsByTemplateId)) {
              const usageColumn = (config.targets?.[DEPOSIT_IMPORT_TARGET_IDS.usage] ?? "").trim()
              if (usageColumn) {
                const resolved = resolveSpreadsheetHeader(parsedFile.headers, usageColumn)
                if (resolved.ok) {
                  amountColumnIndexes.add(resolved.index)
                }
              }
              const commissionColumn = (config.targets?.[DEPOSIT_IMPORT_TARGET_IDS.commission] ?? "").trim()
              if (commissionColumn) {
                const resolved = resolveSpreadsheetHeader(parsedFile.headers, commissionColumn)
                if (resolved.ok) {
                  amountColumnIndexes.add(resolved.index)
                }
              }
            }

            const missingVendorRows: number[] = []
            if (amountColumnIndexes.size > 0) {
              for (let rowIndex = 0; rowIndex < parsedFile.rows.length; rowIndex += 1) {
                const row = parsedFile.rows[rowIndex] ?? []
                const vendorValue = normalizeString(row[vendorNameIndex])
                if (vendorValue) continue
                if (row.every(value => !normalizeString(value))) continue
                if (rowHasTotalsLabel(row, true)) continue

                let hasAmount = false
                for (const indexValue of amountColumnIndexes) {
                  const raw = row[indexValue]
                  const numeric = normalizeNumber(typeof raw === "string" ? raw : raw === null || raw === undefined ? undefined : String(raw))
                  if (numeric !== null) {
                    hasAmount = true
                    break
                  }
                }

                if (!hasAmount) continue
                if (missingVendorRows.length < 25) {
                  missingVendorRows.push(rowIndex + 2)
                }
              }
            }

            if (missingVendorRows.length > 0) {
              const sample = missingVendorRows.slice(0, 10).join(", ")
              throw new Error(
                `Multi-vendor upload is missing vendor values in the mapped "Vendor Name" column (example row numbers: ${sample}).`,
              )
            }

            const groupedRows = groupRowsByVendor({
              rows: parsedFile.rows,
              vendorNameIndex,
            })

            if (groupedRows.groups.length === 0) {
              throw new Error("No usable rows were found in the uploaded file.")
            }

            const vendorGroups = groupedRows.groups
            const templateResolution = await resolveMultiVendorTemplates({
              db: tx,
              tenantId,
              distributorAccountId,
              vendorNamesInFile: vendorGroups.map(group => group.vendorName),
            })

            if (templateResolution.missingVendors.length > 0) {
              throw new Error(
                `Unable to resolve vendor account(s) from the uploaded file: ${templateResolution.missingVendors
                  .slice(0, 10)
                  .join(", ")}. Please ensure the Vendor names match CRM account names.`,
              )
            }

            if (templateResolution.vendorsMissingTemplates.length > 0) {
              throw new Error(
                `Missing reconciliation template(s) for vendor(s): ${templateResolution.vendorsMissingTemplates
                  .slice(0, 10)
                  .join(", ")}. Create templates for these vendors and retry the upload.`,
              )
            }

            const templateLabelsById = new Map<string, string>()
            for (const item of templateResolution.templatesUsed) {
              if (!templateLabelsById.has(item.templateId)) {
                templateLabelsById.set(item.templateId, `${item.vendorAccountName} — ${item.templateName}`)
              }
            }

            const missingRequiredByTemplate: string[] = []
            for (const [templateId, label] of templateLabelsById.entries()) {
              const config = multiVendorMappingsByTemplateId[templateId]
              if (!config) {
                missingRequiredByTemplate.push(`${label}: missing mapping payload`)
                continue
              }
              const hasUsage = Boolean(config.targets?.[DEPOSIT_IMPORT_TARGET_IDS.usage])
              const hasCommission = Boolean(config.targets?.[DEPOSIT_IMPORT_TARGET_IDS.commission])
              if (!hasUsage && !hasCommission) {
                missingRequiredByTemplate.push(`${label}: Actual Usage or Actual Commission`)
              }
            }

            if (missingRequiredByTemplate.length > 0) {
              const sample = missingRequiredByTemplate.slice(0, 5).join("; ")
              const suffix =
                missingRequiredByTemplate.length > 5 ? ` (+${missingRequiredByTemplate.length - 5} more)` : ""
              throw new Error(`Missing required mappings: ${sample}${suffix}`)
            }

            const templateDataById = new Map<
              string,
              {
                mappingConfig: DepositMappingConfigV2
                columnIndex: Record<string, number>
                customColumnIndex: Record<string, number>
                configToPersist: Prisma.InputJsonValue
              }
            >()

            for (const templateId of templateLabelsById.keys()) {
              const baseConfig = multiVendorMappingsByTemplateId[templateId]
              if (!baseConfig) continue

              const normalizedConfig: DepositMappingConfigV2 = {
                ...baseConfig,
                targets: { ...(baseConfig.targets ?? {}) },
                columns: { ...(baseConfig.columns ?? {}) },
                customFields: { ...(baseConfig.customFields ?? {}) },
              }

              if (multiVendorVendorNameColumn) {
                normalizedConfig.targets["depositLineItem.vendorNameRaw"] = multiVendorVendorNameColumn
              }

              const columnIndexForTemplate = buildColumnIndex(parsedFile.headers, normalizedConfig.targets ?? {})
              const customMapping: Record<string, string> = {}
              for (const [columnName, config] of Object.entries(normalizedConfig.columns ?? {})) {
                if (config?.mode !== "custom" || !config.customKey) continue
                customMapping[config.customKey] = columnName
              }
              const customColumnIndexForTemplate =
                Object.keys(customMapping).length > 0 ? buildColumnIndex(parsedFile.headers, customMapping) : {}

	              templateDataById.set(templateId, {
	                mappingConfig: normalizedConfig,
	                columnIndex: columnIndexForTemplate,
	                customColumnIndex: customColumnIndexForTemplate,
	                configToPersist: serializeDepositMappingForTemplateV2(
	                  sanitizeDepositMappingForTemplateV2(normalizedConfig),
	                ) as unknown as Prisma.InputJsonValue,
	              })
	            }

            const vendorAccountIds = Array.from(
              new Set(templateResolution.templatesUsed.map(item => item.vendorAccountId)),
            )

            const distributorAccount = await tx.account.findFirst({
              where: { tenantId, id: distributorAccountId },
              select: { accountName: true },
            })

            const depositsCreated: { depositId: string; vendorAccountId: string; templateId: string }[] = []
            let processedRows = 0

            for (const group of vendorGroups) {
              const resolvedVendor = templateResolution.byVendorKey.get(group.vendorKey)
              if (!resolvedVendor) {
                throw new Error(`Unable to resolve vendor template for "${group.vendorName}".`)
              }

              const vendorAccountId = resolvedVendor.vendorAccountId
              const reconciliationTemplateIdForVendor = resolvedVendor.templateId

              const templateData = templateDataById.get(reconciliationTemplateIdForVendor)
              if (!templateData) {
                throw new Error(`Missing mapping payload for template "${resolvedVendor.templateName}".`)
              }

              const generatedDepositName = [
                resolvedVendor.vendorAccountName,
                distributorAccount?.accountName ?? "",
                resolvedDepositDate.toISOString().slice(0, 10),
              ]
                .filter(Boolean)
                .join(" - ")

              const deposit = await tx.deposit.create({
                data: {
                  tenantId,
                  accountId: distributorAccountId,
                  month: commissionPeriodDate ?? startOfMonth(resolvedDepositDate),
                  depositName: depositOverrides.depositName || depositName || generatedDepositName || null,
                  paymentDate: resolvedDepositDate,
                  distributorAccountId,
                  vendorAccountId,
                  reconciliationTemplateId: reconciliationTemplateIdForVendor,
                  createdByUserId: req.user.id,
                  createdByContactId: createdByContactId || null,
                },
              })

              const lineItemsData = group.rows
                .map((row, index) => {
                  const metadata: Record<string, unknown> = {}
                  const usageIndex = templateData.columnIndex[DEPOSIT_IMPORT_TARGET_IDS.usage]
                  const commissionIndex = templateData.columnIndex[DEPOSIT_IMPORT_TARGET_IDS.commission]
                  const usageValueRaw = usageIndex !== undefined ? normalizeNumber(row[usageIndex]) : null
                  const commissionValue = commissionIndex !== undefined ? normalizeNumber(row[commissionIndex]) : null
                  if (usageValueRaw === null && commissionValue === null) {
                    return null
                  }

                  const paymentDateTargetId = LEGACY_FIELD_ID_TO_TARGET_ID.paymentDate
                  const paymentDateIndex = paymentDateTargetId ? templateData.columnIndex[paymentDateTargetId] : undefined
                  const paymentDateValue =
                    paymentDateIndex !== undefined
                      ? parseDateValue(row[paymentDateIndex], resolvedDepositDate)
                      : resolvedDepositDate

                  const isCommissionOnly = usageValueRaw === null && commissionValue !== null
                  const usageValue = isCommissionOnly ? commissionValue : usageValueRaw

                  const commissionRateIndex = templateData.columnIndex[DEPOSIT_IMPORT_TARGET_IDS.commissionRate]
                  const commissionRateValueRaw =
                    commissionRateIndex !== undefined ? normalizeNumber(row[commissionRateIndex]) : null
                  const commissionRateValue = isCommissionOnly ? 1 : commissionRateValueRaw

                  const lineNumberTargetId = LEGACY_FIELD_ID_TO_TARGET_ID.lineNumber
                  const lineNumberIndex = lineNumberTargetId ? templateData.columnIndex[lineNumberTargetId] : undefined
                  const lineNumberValue =
                    lineNumberIndex !== undefined ? normalizeNumber(row[lineNumberIndex]) ?? index + 1 : index + 1

                  const lineItem: Record<string, unknown> = {
                    tenantId,
                    depositId: deposit.id,
                    lineNumber: lineNumberValue,
                    paymentDate: paymentDateValue ?? resolvedDepositDate,
                    usage: usageValue,
                    usageAllocated: 0,
                    usageUnallocated: usageValue ?? 0,
                    commission: commissionValue,
                    commissionAllocated: 0,
                    commissionUnallocated: commissionValue ?? 0,
                    commissionRate: commissionRateValue,
                    vendorAccountId,
                  }

                  for (const [targetId] of Object.entries(templateData.mappingConfig.targets ?? {})) {
                    const target = fieldCatalogIndex.get(targetId)
                    if (!target || target.persistence !== "depositLineItemColumn" || !target.columnName) continue
                    if (["usage", "commission", "commissionRate", "lineNumber", "paymentDate"].includes(target.columnName)) {
                      continue
                    }
                    const indexValue = templateData.columnIndex[targetId]
                    if (indexValue === undefined) continue
                    const parsedValue = parseValueByType(target.dataType, row[indexValue])
                    if (parsedValue === null || parsedValue === undefined) continue
                    lineItem[target.columnName] = parsedValue
                  }

                  for (const [targetId] of Object.entries(templateData.mappingConfig.targets ?? {})) {
                    const target = fieldCatalogIndex.get(targetId)
                    if (!target || target.persistence !== "metadata" || !target.metadataPath) continue
                    const indexValue = templateData.columnIndex[targetId]
                    if (indexValue === undefined) continue
                    const parsedValue = parseValueByType(target.dataType, row[indexValue])
                    if (parsedValue === null || parsedValue === undefined) continue
                    setMetadataValue(metadata, target.metadataPath, parsedValue)
                  }

                  for (const [customKey, indexValue] of Object.entries(templateData.customColumnIndex)) {
                    const rawValue = row[indexValue]
                    const parsedValue = normalizeString(rawValue)
                    if (!parsedValue) continue
                    const definition = templateData.mappingConfig.customFields?.[customKey]
                    const customBucket = isPlainObject(metadata["custom"])
                      ? (metadata["custom"] as Record<string, unknown>)
                      : {}
                    customBucket[customKey] = {
                      label: definition?.label ?? customKey,
                      section: definition?.section ?? "additional",
                      value: parsedValue,
                    }
                    metadata["custom"] = customBucket
                  }

                  if (Object.keys(metadata).length > 0) {
                    lineItem.metadata = metadata
                  }

                  return lineItem
                })
                .filter(Boolean) as any[]

              if (!lineItemsData.length) {
                throw new Error(`No usable rows were found for vendor "${group.vendorName}".`)
              }

              await tx.depositLineItem.createMany({
                data: lineItemsData,
              })

              const totalUsage = lineItemsData.reduce((acc, line) => acc + (line.usage ?? 0), 0)
              const totalCommission = lineItemsData.reduce((acc, line) => acc + (line.commission ?? 0), 0)

              await tx.deposit.update({
                where: { id: deposit.id },
                data: {
                  totalItems: lineItemsData.length,
                  itemsUnreconciled: lineItemsData.length,
                  totalUsage,
                  usageAllocated: 0,
                  usageUnallocated: totalUsage,
                  totalCommissions: totalCommission,
                  commissionAllocated: 0,
                  commissionUnallocated: totalCommission,
                },
              })

              processedRows += lineItemsData.length
              depositsCreated.push({
                depositId: deposit.id,
                vendorAccountId,
                templateId: reconciliationTemplateIdForVendor,
              })

              if (multiVendorSaveUpdatesByTemplateId[reconciliationTemplateIdForVendor]) {
                await tx.reconciliationTemplate.update({
                  where: { id: reconciliationTemplateIdForVendor },
                  data: {
                    config: templateData.configToPersist,
                  },
                })
              }
            }

            const importFilters: Prisma.InputJsonValue = {
              distributorAccountId,
              multiVendor: true,
              vendorAccountIds,
              depositIds: depositsCreated.map(item => item.depositId),
              templatesUsed: templateResolution.templatesUsed.map(item => ({
                vendorNameInFile: item.vendorNameInFile,
                vendorAccountId: item.vendorAccountId,
                templateId: item.templateId,
                templateName: item.templateName,
              })) as unknown as Prisma.InputJsonValue,
              mappingVersion: "multiVendorV1",
              mappingByTemplateId: multiVendorMappingsByTemplateId as unknown as Prisma.InputJsonValue,
              saveTemplateMappingByTemplateId: multiVendorSaveUpdatesByTemplateId as unknown as Prisma.InputJsonValue,
              commissionPeriod: commissionPeriodInput || null,
              idempotencyKey,
            }

            await tx.importJob.create({
              data: {
                tenantId,
                createdById: req.user.id,
                entity: DataEntity.Reconciliations,
                source: ImportExportSource.UI,
                status: JobStatus.Completed,
                fileName: file.name || "deposit-upload",
                totalRows: parsedFile.rows.length,
                processedRows,
                successCount: processedRows,
                errorCount: 0,
                startedAt: new Date(),
                completedAt: new Date(),
                idempotencyKey,
                filters: importFilters,
              },
            })

            return {
              depositIds: depositsCreated.map(item => item.depositId),
              depositsCreated,
              processedRows,
            }
          }

          if (!mappingConfig) {
            throw new Error("Field mapping is required")
          }

          const vendorColumnName = mappingConfig.targets?.["depositLineItem.vendorNameRaw"]
          if (!vendorColumnName) {
            throw new Error('Multi-vendor uploads require mapping the "Vendor Name" column.')
          }
          const vendorNameIndex = columnIndex["depositLineItem.vendorNameRaw"]
          if (vendorNameIndex === undefined) {
            throw new Error('Unable to locate the mapped "Vendor Name" column in the uploaded file.')
          }

          const usageIndex = columnIndex[DEPOSIT_IMPORT_TARGET_IDS.usage]
          const commissionIndex = columnIndex[DEPOSIT_IMPORT_TARGET_IDS.commission]

          const groupedRows = groupRowsByVendor({
            rows: parsedFile.rows,
            vendorNameIndex,
            usageIndex,
            commissionIndex,
          })

          if (groupedRows.missingVendorRows.length > 0) {
            const sample = groupedRows.missingVendorRows.slice(0, 10).join(", ")
            throw new Error(
              `Multi-vendor upload is missing vendor values in the mapped "Vendor Name" column (example row numbers: ${sample}).`,
            )
          }

          if (groupedRows.groups.length === 0) {
            throw new Error("No usable rows were found in the uploaded file.")
          }

          const vendorGroups = groupedRows.groups
          const templateResolution = await resolveMultiVendorTemplates({
            db: tx,
            tenantId,
            distributorAccountId,
            vendorNamesInFile: vendorGroups.map(group => group.vendorName),
          })

          if (templateResolution.missingVendors.length > 0) {
            throw new Error(
              `Unable to resolve vendor account(s) from the uploaded file: ${templateResolution.missingVendors
                .slice(0, 10)
                .join(", ")}. Please ensure the Vendor names match CRM account names.`,
            )
          }

          if (templateResolution.vendorsMissingTemplates.length > 0) {
            throw new Error(
              `Missing reconciliation template(s) for vendor(s): ${templateResolution.vendorsMissingTemplates
                .slice(0, 10)
                .join(", ")}. Create templates for these vendors and retry the upload.`,
            )
          }
          const vendorAccountIds = Array.from(
            new Set(templateResolution.templatesUsed.map(item => item.vendorAccountId)),
          )

          const distributorAccount = await tx.account.findFirst({
            where: { tenantId, id: distributorAccountId },
            select: { accountName: true },
          })

          const depositsCreated: { depositId: string; vendorAccountId: string; templateId: string }[] = []
          let processedRows = 0

          for (const group of vendorGroups) {
            const resolvedVendor = templateResolution.byVendorKey.get(group.vendorKey)
            if (!resolvedVendor) {
              throw new Error(`Unable to resolve vendor template for "${group.vendorName}".`)
            }
            const vendorAccountId = resolvedVendor.vendorAccountId
            const reconciliationTemplateIdForVendor = resolvedVendor.templateId

            const generatedDepositName = [
              resolvedVendor.vendorAccountName,
              distributorAccount?.accountName ?? "",
              resolvedDepositDate.toISOString().slice(0, 10),
            ]
              .filter(Boolean)
              .join(" - ")

            const deposit = await tx.deposit.create({
              data: {
                tenantId,
                accountId: distributorAccountId,
                month: commissionPeriodDate ?? startOfMonth(resolvedDepositDate),
                depositName: depositOverrides.depositName || depositName || generatedDepositName || null,
                paymentDate: resolvedDepositDate,
                distributorAccountId,
                vendorAccountId,
                reconciliationTemplateId: reconciliationTemplateIdForVendor,
                createdByUserId: req.user.id,
                createdByContactId: createdByContactId || null,
              },
            })

            const lineItemsData = group.rows
              .map((row, index) => {
                const metadata: Record<string, unknown> = {}
                const usageIndex = columnIndex[DEPOSIT_IMPORT_TARGET_IDS.usage]
                const commissionIndex = columnIndex[DEPOSIT_IMPORT_TARGET_IDS.commission]
                const usageValueRaw = usageIndex !== undefined ? normalizeNumber(row[usageIndex]) : null
                const commissionValue = commissionIndex !== undefined ? normalizeNumber(row[commissionIndex]) : null
                if (usageValueRaw === null && commissionValue === null) {
                  return null
                }

                const paymentDateTargetId = LEGACY_FIELD_ID_TO_TARGET_ID.paymentDate
                const paymentDateIndex = paymentDateTargetId ? columnIndex[paymentDateTargetId] : undefined
                const paymentDateValue =
                  paymentDateIndex !== undefined
                    ? parseDateValue(row[paymentDateIndex], resolvedDepositDate)
                    : resolvedDepositDate

                const isCommissionOnly = usageValueRaw === null && commissionValue !== null
                const usageValue = isCommissionOnly ? commissionValue : usageValueRaw

                const commissionRateIndex = columnIndex[DEPOSIT_IMPORT_TARGET_IDS.commissionRate]
                const commissionRateValueRaw =
                  commissionRateIndex !== undefined ? normalizeNumber(row[commissionRateIndex]) : null
                const commissionRateValue = isCommissionOnly ? 1 : commissionRateValueRaw

                const lineNumberTargetId = LEGACY_FIELD_ID_TO_TARGET_ID.lineNumber
                const lineNumberIndex = lineNumberTargetId ? columnIndex[lineNumberTargetId] : undefined
                const lineNumberValue =
                  lineNumberIndex !== undefined ? normalizeNumber(row[lineNumberIndex]) ?? index + 1 : index + 1

                const lineItem: Record<string, unknown> = {
                  tenantId,
                  depositId: deposit.id,
                  lineNumber: lineNumberValue,
                  paymentDate: paymentDateValue ?? resolvedDepositDate,
                  usage: usageValue,
                  usageAllocated: 0,
                  usageUnallocated: usageValue ?? 0,
                  commission: commissionValue,
                  commissionAllocated: 0,
                  commissionUnallocated: commissionValue ?? 0,
                  commissionRate: commissionRateValue,
                  vendorAccountId,
                }

                for (const [targetId] of Object.entries(mappingConfig.targets ?? {})) {
                  const target = fieldCatalogIndex.get(targetId)
                  if (!target || target.persistence !== "depositLineItemColumn" || !target.columnName) continue
                  if (["usage", "commission", "commissionRate", "lineNumber", "paymentDate"].includes(target.columnName)) {
                    continue
                  }
                  const indexValue = columnIndex[targetId]
                  if (indexValue === undefined) continue
                  const parsedValue = parseValueByType(target.dataType, row[indexValue])
                  if (parsedValue === null || parsedValue === undefined) continue
                  lineItem[target.columnName] = parsedValue
                }

                for (const [targetId] of Object.entries(mappingConfig.targets ?? {})) {
                  const target = fieldCatalogIndex.get(targetId)
                  if (!target || target.persistence !== "metadata" || !target.metadataPath) continue
                  const indexValue = columnIndex[targetId]
                  if (indexValue === undefined) continue
                  const parsedValue = parseValueByType(target.dataType, row[indexValue])
                  if (parsedValue === null || parsedValue === undefined) continue
                  setMetadataValue(metadata, target.metadataPath, parsedValue)
                }

                for (const [customKey, indexValue] of Object.entries(customColumnIndex)) {
                  const rawValue = row[indexValue]
                  const parsedValue = normalizeString(rawValue)
                  if (!parsedValue) continue
                  const definition = mappingConfig.customFields?.[customKey]
                  const customBucket = isPlainObject(metadata["custom"])
                    ? (metadata["custom"] as Record<string, unknown>)
                    : {}
                  customBucket[customKey] = {
                    label: definition?.label ?? customKey,
                    section: definition?.section ?? "additional",
                    value: parsedValue,
                  }
                  metadata["custom"] = customBucket
                }

                if (Object.keys(metadata).length > 0) {
                  lineItem.metadata = metadata
                }

                return lineItem
              })
              .filter(Boolean) as any[]

            if (!lineItemsData.length) {
              throw new Error(`No usable rows were found for vendor "${group.vendorName}".`)
            }

            await tx.depositLineItem.createMany({
              data: lineItemsData,
            })

            const totalUsage = lineItemsData.reduce((acc, line) => acc + (line.usage ?? 0), 0)
            const totalCommission = lineItemsData.reduce((acc, line) => acc + (line.commission ?? 0), 0)

            await tx.deposit.update({
              where: { id: deposit.id },
              data: {
                totalItems: lineItemsData.length,
                itemsUnreconciled: lineItemsData.length,
                totalUsage,
                usageAllocated: 0,
                usageUnallocated: totalUsage,
                totalCommissions: totalCommission,
                commissionAllocated: 0,
                commissionUnallocated: totalCommission,
              },
            })

            depositsCreated.push({
              depositId: deposit.id,
              vendorAccountId,
              templateId: reconciliationTemplateIdForVendor,
            })
            processedRows += lineItemsData.length

            if (templateConfigToPersist && saveTemplateMapping && reconciliationTemplateIdForVendor) {
              await tx.reconciliationTemplate.update({
                where: { id: reconciliationTemplateIdForVendor },
                data: {
                  config: templateConfigToPersist,
                },
              })
            }
          }

          const importFilters: Prisma.InputJsonValue = {
            distributorAccountId,
            multiVendor: true,
            vendorAccountIds,
            depositIds: depositsCreated.map(item => item.depositId),
            templatesUsed: templateResolution.templatesUsed.map(item => ({
              vendorNameInFile: item.vendorNameInFile,
              vendorAccountId: item.vendorAccountId,
              templateId: item.templateId,
              templateName: item.templateName,
            })) as unknown as Prisma.InputJsonValue,
            mapping: mappingConfig as unknown as Prisma.InputJsonValue,
            commissionPeriod: commissionPeriodInput || null,
            saveTemplateMapping,
            idempotencyKey,
          }

          await tx.importJob.create({
            data: {
              tenantId,
              createdById: req.user.id,
              entity: DataEntity.Reconciliations,
              source: ImportExportSource.UI,
              status: JobStatus.Completed,
              fileName: file.name || "deposit-upload",
              totalRows: parsedFile.rows.length,
              processedRows,
              successCount: processedRows,
              errorCount: 0,
              startedAt: new Date(),
              completedAt: new Date(),
              idempotencyKey,
              filters: importFilters,
            },
          })

          return {
            depositIds: depositsCreated.map(item => item.depositId),
            depositsCreated,
            processedRows,
          }
        }

        const deposit = await tx.deposit.create({
          data: {
            tenantId,
            accountId: distributorAccountId,
            month: commissionPeriodDate ?? startOfMonth(resolvedDepositDate),
            depositName: resolvedDepositName,
            paymentDate: resolvedDepositDate,
            distributorAccountId,
            vendorAccountId,
            reconciliationTemplateId: selectedTemplate?.id ?? null,
            createdByUserId: req.user.id,
            createdByContactId: createdByContactId || null,
          },
        })

        if (!mappingConfig) {
          throw new Error("Field mapping is required")
        }
        const ensuredMappingConfig = mappingConfig

      const shouldSkipSummaryRows = true

      const lineItemsData = parsedFile.rows
        .map((row, index) => {
          if (rowHasTotalsLabel(row, shouldSkipSummaryRows)) {
            return null
          }

          const metadata: Record<string, unknown> = {}
          const usageIndex = columnIndex[DEPOSIT_IMPORT_TARGET_IDS.usage]
          const commissionIndex = columnIndex[DEPOSIT_IMPORT_TARGET_IDS.commission]
          const usageValueRaw = usageIndex !== undefined ? normalizeNumber(row[usageIndex]) : null
          const commissionValue = commissionIndex !== undefined ? normalizeNumber(row[commissionIndex]) : null
          if (usageValueRaw === null && commissionValue === null) {
            return null
          }

          const paymentDateTargetId = LEGACY_FIELD_ID_TO_TARGET_ID.paymentDate
          const paymentDateIndex = paymentDateTargetId ? columnIndex[paymentDateTargetId] : undefined
          const paymentDateValue =
            paymentDateIndex !== undefined
              ? parseDateValue(row[paymentDateIndex], resolvedDepositDate)
              : resolvedDepositDate

          const isCommissionOnly = usageValueRaw === null && commissionValue !== null
          const usageValue = isCommissionOnly ? commissionValue : usageValueRaw

          // Spec: if a deposit line has commission but no usage, treat it as commission-only:
          // usage = commission and rate = 100% (fraction 1.0).
          const commissionRateIndex = columnIndex[DEPOSIT_IMPORT_TARGET_IDS.commissionRate]
          const commissionRateValueRaw =
            commissionRateIndex !== undefined ? normalizeNumber(row[commissionRateIndex]) : null
          const commissionRateValue = isCommissionOnly ? 1 : commissionRateValueRaw

          const lineNumberTargetId = LEGACY_FIELD_ID_TO_TARGET_ID.lineNumber
          const lineNumberIndex = lineNumberTargetId ? columnIndex[lineNumberTargetId] : undefined
          const lineNumberValue =
            lineNumberIndex !== undefined ? normalizeNumber(row[lineNumberIndex]) ?? index + 1 : index + 1

          const lineItem: Record<string, unknown> = {
            tenantId,
            depositId: deposit.id,
            lineNumber: lineNumberValue,
            paymentDate: paymentDateValue ?? resolvedDepositDate,
            usage: usageValue,
            usageAllocated: 0,
            usageUnallocated: usageValue ?? 0,
            commission: commissionValue,
            commissionAllocated: 0,
            commissionUnallocated: commissionValue ?? 0,
            commissionRate: commissionRateValue,
            vendorAccountId,
          }

          for (const [targetId] of Object.entries(ensuredMappingConfig.targets ?? {})) {
            const target = fieldCatalogIndex.get(targetId)
            if (!target || target.persistence !== "depositLineItemColumn" || !target.columnName) continue
            if (
              ["usage", "commission", "commissionRate", "lineNumber", "paymentDate"].includes(target.columnName)
            ) {
              continue
            }
            const indexValue = columnIndex[targetId]
            if (indexValue === undefined) continue
            const parsedValue = parseValueByType(target.dataType, row[indexValue])
            if (parsedValue === null || parsedValue === undefined) continue
            lineItem[target.columnName] = parsedValue
          }

          for (const [targetId] of Object.entries(ensuredMappingConfig.targets ?? {})) {
            const target = fieldCatalogIndex.get(targetId)
            if (!target || target.persistence !== "metadata" || !target.metadataPath) continue
            const indexValue = columnIndex[targetId]
            if (indexValue === undefined) continue
            const parsedValue = parseValueByType(target.dataType, row[indexValue])
            if (parsedValue === null || parsedValue === undefined) continue
            setMetadataValue(metadata, target.metadataPath, parsedValue)
          }

          for (const [customKey, indexValue] of Object.entries(customColumnIndex)) {
            const rawValue = row[indexValue]
            const parsedValue = normalizeString(rawValue)
            if (!parsedValue) continue
            const definition = ensuredMappingConfig.customFields?.[customKey]
            const customBucket = isPlainObject(metadata["custom"]) ? (metadata["custom"] as Record<string, unknown>) : {}
            customBucket[customKey] = {
              label: definition?.label ?? customKey,
              section: definition?.section ?? "additional",
              value: parsedValue,
            }
            metadata["custom"] = customBucket
          }

          if (Object.keys(metadata).length > 0) {
            lineItem.metadata = metadata
          }

          return lineItem
        })
        .filter(Boolean) as any[]

      if (!lineItemsData.length) {
        throw new Error("No usable rows were found in the uploaded file.")
      }

      await tx.depositLineItem.createMany({
        data: lineItemsData,
      })

      const totalUsage = lineItemsData.reduce((acc, line) => acc + (line.usage ?? 0), 0)
      const totalCommission = lineItemsData.reduce((acc, line) => acc + (line.commission ?? 0), 0)

      await tx.deposit.update({
        where: { id: deposit.id },
        data: {
          totalItems: lineItemsData.length,
          itemsUnreconciled: lineItemsData.length,
          totalUsage,
          usageAllocated: 0,
          usageUnallocated: totalUsage,
          totalCommissions: totalCommission,
          commissionAllocated: 0,
          commissionUnallocated: totalCommission,
        },
      })

        const importFilters: Prisma.InputJsonValue = {
          distributorAccountId,
          vendorAccountId,
          mapping: mappingConfig as unknown as Prisma.InputJsonValue,
          commissionPeriod: commissionPeriodInput || null,
          reconciliationTemplateId: selectedTemplate?.id ?? reconciliationTemplateId,
          saveTemplateMapping,
          idempotencyKey,
          depositId: deposit.id,
        }

        await tx.importJob.create({
          data: {
            tenantId,
            createdById: req.user.id,
            entity: DataEntity.Reconciliations,
            source: ImportExportSource.UI,
            status: JobStatus.Completed,
            fileName: file.name || "deposit-upload",
            totalRows: parsedFile.rows.length,
            processedRows: lineItemsData.length,
            successCount: lineItemsData.length,
            errorCount: 0,
            startedAt: new Date(),
            completedAt: new Date(),
            idempotencyKey,
            filters: importFilters,
          },
        })

      if (templateConfigToPersist && saveTemplateMapping) {
        if (selectedTemplate) {
          await tx.reconciliationTemplate.update({
            where: { id: selectedTemplate.id },
            data: {
              config: templateConfigToPersist,
            },
          })
        } else {
          // Legacy fallback: update/create the distributor+vendor default template.
          const existingTemplate = await tx.reconciliationTemplate.findFirst({
            where: {
              tenantId,
              distributorAccountId,
              vendorAccountId,
            },
            select: { id: true },
          })

          if (existingTemplate) {
            await tx.reconciliationTemplate.update({
              where: { id: existingTemplate.id },
              data: {
                config: templateConfigToPersist,
              },
            })
          } else {
            await tx.reconciliationTemplate.create({
              data: {
                tenantId,
                name: "Default deposit mapping",
                description: "Auto-created from deposit upload mapping.",
                distributorAccountId,
                vendorAccountId,
                createdByUserId: req.user.id,
                createdByContactId,
                config: templateConfigToPersist,
              },
            })
          }
        }
      }

        return {
          depositId: deposit.id,
          lineCount: lineItemsData.length,
          templateId: selectedTemplate?.id ?? reconciliationTemplateId,
          templateSaved: Boolean(templateConfigToPersist && saveTemplateMapping),
        }
      })
      const txDurationMs = Date.now() - txStartMs
      const totalDurationMs = Date.now() - totalStartMs

      if (multiVendor) {
        const depositsCreated = (result as any)?.depositsCreated as
          | { depositId: string; vendorAccountId: string; templateId: string }[]
          | undefined
        if (Array.isArray(depositsCreated)) {
          for (const created of depositsCreated) {
            await logAudit({
              userId: req.user.id,
              tenantId,
              action: AuditAction.Create,
              entityName: "Deposit",
              entityId: created.depositId,
              ipAddress: getClientIP(request),
              userAgent: getUserAgent(request),
              metadata: {
                fileName: file.name || "deposit-upload",
                distributorAccountId,
                vendorAccountId: created.vendorAccountId,
                reconciliationTemplateId: created.templateId,
                multiVendor: true,
                idempotencyKey,
                performance: {
                  parseDurationMs,
                  transactionDurationMs: txDurationMs,
                  totalDurationMs,
                },
              },
            })
          }
        }

        return NextResponse.json({ data: { depositIds: (result as any).depositIds } })
      }

      const depositId = result.depositId
      if (!depositId) {
        throw new Error("Deposit import did not return a depositId.")
      }

      await logAudit({
        userId: req.user.id,
        tenantId,
        action: AuditAction.Create,
        entityName: "Deposit",
        entityId: depositId,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        metadata: {
          fileName: file.name || "deposit-upload",
          distributorAccountId,
          vendorAccountId,
          reconciliationTemplateId: result.templateId,
          saveTemplateMapping,
          idempotencyKey,
          lineCount: result.lineCount,
          performance: {
            parseDurationMs,
            transactionDurationMs: txDurationMs,
            totalDurationMs,
          },
        },
      })

      if (result.templateSaved && result.templateId) {
        await logAudit({
          userId: req.user.id,
          tenantId,
          action: AuditAction.Update,
          entityName: "ReconciliationTemplate",
          entityId: result.templateId,
          ipAddress: getClientIP(request),
          userAgent: getUserAgent(request),
          metadata: {
            reason: "DepositUploadSaveMapping",
            distributorAccountId,
            vendorAccountId,
            saveTemplateMapping,
            depositId,
            idempotencyKey,
          },
        })
      }

      return NextResponse.json({ data: result })
    } catch (error: any) {
      if (error?.code === "P2002") {
        // Unique constraint hit (likely idempotency). Return existing result if possible.
        if (idempotencyKey) {
          const existingJob = await prisma.importJob.findFirst({
            where: { tenantId, entity: DataEntity.Reconciliations, idempotencyKey },
            select: { status: true, filters: true },
          })
          const existingDepositId = (existingJob?.filters as any)?.depositId as string | undefined
          const existingDepositIds = (existingJob?.filters as any)?.depositIds as string[] | undefined
          if (existingJob?.status === JobStatus.Completed) {
            if (multiVendor && Array.isArray(existingDepositIds) && existingDepositIds.length > 0) {
              return NextResponse.json({ data: { depositIds: existingDepositIds, idempotent: true } })
            }
            if (!multiVendor && existingDepositId) {
              return NextResponse.json({ data: { depositId: existingDepositId, idempotent: true } })
            }
          }
        }
        return createErrorResponse("Duplicate import request", 409)
      }

      console.error("Deposit import failed", error)
      return createErrorResponse(error instanceof Error ? error.message : "Failed to import deposit", 500)
    }
  })
}
