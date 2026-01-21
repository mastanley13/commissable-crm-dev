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
  convertDepositMappingV1ToV2,
  extractDepositMappingV2FromTemplateConfig,
  serializeDepositMappingForTemplateV2,
  type DepositMappingConfigV2,
} from "@/lib/deposit-import/template-mapping-v2"

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
    const idempotencyKeyRaw = ((formData.get("idempotencyKey") as string | null) ?? "").trim()
    const createdByContactId = ((formData.get("createdByContactId") as string | null) ?? "").trim() || null

    if (!distributorAccountIdRaw || !vendorAccountIdRaw) {
      return createErrorResponse("Distributor and vendor are required", 400)
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

    if (mappingPayload && isPlainObject(mappingPayload)) {
      const candidate = mappingPayload as Record<string, unknown>
      if (typeof candidate["version"] === "number" && (candidate["version"] === 1 || candidate["version"] === 2)) {
        mappingConfig = extractDepositMappingV2FromTemplateConfig({ depositMapping: mappingPayload })
        mappingConfigForTemplate = mappingConfig
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
          mappingConfigForTemplate = mappingConfig
        }
      }
    }

    if (!mappingConfig) {
      return createErrorResponse("Field mapping is required", 400)
    }

    const hasUsage = Boolean(mappingConfig.targets?.[DEPOSIT_IMPORT_TARGET_IDS.usage])
    const hasCommission = Boolean(mappingConfig.targets?.[DEPOSIT_IMPORT_TARGET_IDS.commission])
    if (!hasUsage && !hasCommission) {
      return createErrorResponse('Missing mapping for required fields: Usage Amount or Commission Amount', 400)
    }

    const opportunityFields = await prisma.fieldDefinition.findMany({
      where: { tenantId, module: FieldModule.Opportunities },
      select: { fieldCode: true, label: true, dataType: true },
      orderBy: { displayOrder: "asc" },
    })
    const fieldCatalog = buildDepositImportFieldCatalog({ opportunityFieldDefinitions: opportunityFields })
    const fieldCatalogIndex = buildDepositImportFieldCatalogIndex(fieldCatalog)
    const unknownTargets = Object.keys(mappingConfig.targets ?? {}).filter(targetId => !fieldCatalogIndex.has(targetId))
    if (unknownTargets.length > 0) {
      return createErrorResponse(`Unknown mapping targets: ${unknownTargets.join(", ")}`, 400)
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
        if (existingJob.status === JobStatus.Completed && existingDepositId) {
          return NextResponse.json({ data: { depositId: existingDepositId, idempotent: true } })
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

    let columnIndex: Record<string, number>
    let customColumnIndex: Record<string, number> = {}
    try {
      columnIndex = buildColumnIndex(parsedFile.headers, mappingConfig.targets ?? {})
      const customMapping: Record<string, string> = {}
      for (const [columnName, config] of Object.entries(mappingConfig.columns ?? {})) {
        if (config?.mode !== "custom" || !config.customKey) continue
        customMapping[config.customKey] = columnName
      }
      if (Object.keys(customMapping).length > 0) {
        customColumnIndex = buildColumnIndex(parsedFile.headers, customMapping)
      }
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : "Mapping failed", 400)
    }

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
        const deposit = await tx.deposit.create({
          data: {
            tenantId,
            accountId: distributorAccountId,
            month: commissionPeriodDate ?? startOfMonth(depositDate),
            depositName: depositName || null,
            paymentDate: depositDate,
            distributorAccountId,
            vendorAccountId,
            reconciliationTemplateId: selectedTemplate?.id ?? null,
            createdByUserId: req.user.id,
            createdByContactId: createdByContactId || null,
          },
        })

      const lineItemsData = parsedFile.rows
        .map((row, index) => {
          const usageValueRaw = normalizeNumber(row[columnIndex.usage])
          const commissionValue = normalizeNumber(row[columnIndex.commission])
          if (usageValueRaw === null && commissionValue === null) {
            return null
          }

          const resolveString = (fieldId: string) => normalizeString(row[columnIndex[fieldId]])
          const paymentDateValue = parseDateValue(row[columnIndex.paymentDate], depositDate)

          const isCommissionOnly = usageValueRaw === null && commissionValue !== null
          const usageValue = isCommissionOnly ? commissionValue : usageValueRaw

          // Spec: if a deposit line has commission but no usage, treat it as commission-only:
          // usage = commission and rate = 100% (fraction 1.0).
          const commissionRateValueRaw = normalizeNumber(row[columnIndex.commissionRate])
          const commissionRateValue = isCommissionOnly ? 1 : commissionRateValueRaw

          return {
            tenantId,
            depositId: deposit.id,
            lineNumber: normalizeNumber(row[columnIndex.lineNumber]) ?? index + 1,
            paymentDate: paymentDateValue ?? depositDate,
            accountNameRaw: resolveString('accountNameRaw'),
            accountIdVendor: resolveString('accountIdVendor'),
            customerIdVendor: resolveString('customerIdVendor'),
            orderIdVendor: resolveString('orderIdVendor'),
            productNameRaw: resolveString('productNameRaw'),
            partNumberRaw: resolveString('partNumberRaw'),
            vendorNameRaw: resolveString('vendorNameRaw'),
            distributorNameRaw: resolveString('distributorNameRaw'),
            locationId: resolveString('locationId'),
            customerPurchaseOrder: resolveString('customerPurchaseOrder'),
            usage: usageValue,
            usageAllocated: 0,
            usageUnallocated: usageValue ?? 0,
            commission: commissionValue,
            commissionAllocated: 0,
            commissionUnallocated: commissionValue ?? 0,
            commissionRate: commissionRateValue,
            vendorAccountId,
          }
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
          mapping: mappingPayload as Prisma.InputJsonValue,
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

      await logAudit({
        userId: req.user.id,
        tenantId,
        action: AuditAction.Create,
        entityName: "Deposit",
        entityId: result.depositId,
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
            depositId: result.depositId,
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
          if (existingJob?.status === JobStatus.Completed && existingDepositId) {
            return NextResponse.json({ data: { depositId: existingDepositId, idempotent: true } })
          }
        }
        return createErrorResponse("Duplicate import request", 409)
      }

      console.error("Deposit import failed", error)
      return createErrorResponse(error instanceof Error ? error.message : "Failed to import deposit", 500)
    }
  })
}
