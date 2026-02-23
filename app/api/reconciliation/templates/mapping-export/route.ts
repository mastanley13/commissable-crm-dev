import { FieldModule, type Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { resolveSpreadsheetHeader } from "@/lib/deposit-import/resolve-header"
import {
  buildDepositImportFieldCatalog,
  buildDepositImportFieldCatalogIndex,
  type DepositImportFieldTarget,
} from "@/lib/deposit-import/field-catalog"
import { extractDepositMappingV2FromTemplateConfig } from "@/lib/deposit-import/template-mapping-v2"
import { extractTelarusTemplateFieldsFromTemplateConfig } from "@/lib/deposit-import/telarus-template-fields"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function normalizeQuery(value: string | null): string {
  return (value ?? "").trim()
}

function toCsvValue(value: unknown): string {
  if (value == null) return ""
  const text = String(value)
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function stableJoin(values: string[], separator = "; "): string {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    unique.push(trimmed)
  }
  return unique.join(separator)
}

function buildUniqueHeaderList(values: string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const value of values) {
    if (typeof value !== "string") continue
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    unique.push(trimmed)
  }
  return unique
}

function resolveMappedHeader(mappingHeaders: string[], requestedHeader: string): string | null {
  const resolved = resolveSpreadsheetHeader(mappingHeaders, requestedHeader)
  return resolved.ok ? resolved.header : null
}

function summarizeTemplateColumn(params: {
  columnName: string
  mapping: ReturnType<typeof extractDepositMappingV2FromTemplateConfig>
  fieldCatalogIndex: Map<string, DepositImportFieldTarget>
}) {
  const { columnName, mapping, fieldCatalogIndex } = params

  const columnConfig = mapping.columns?.[columnName] ?? null
  const targetIds: string[] = []

  if (columnConfig?.mode === "target" && columnConfig.targetId) {
    targetIds.push(columnConfig.targetId)
  }

  for (const [targetId, mappedColumn] of Object.entries(mapping.targets ?? {})) {
    if (mappedColumn === columnName) {
      targetIds.push(targetId)
    }
  }

  const resolvedTargetIds = buildUniqueHeaderList(targetIds)
  const targets = resolvedTargetIds
    .map(targetId => fieldCatalogIndex.get(targetId))
    .filter(Boolean) as DepositImportFieldTarget[]

  const mode = columnConfig?.mode ?? (resolvedTargetIds.length ? "target" : "unmapped")

  const customKey = columnConfig?.mode === "custom" ? (columnConfig.customKey ?? "") : ""
  const customDefinition = customKey ? mapping.customFields?.[customKey] ?? null : null

  return {
    mode,
    targetIds: stableJoin(resolvedTargetIds),
    targetLabels: stableJoin(targets.map(target => target.label || target.id).filter(Boolean)),
    targetEntities: stableJoin(targets.map(target => target.entity).filter(Boolean)),
    targetDataTypes: stableJoin(targets.map(target => target.dataType).filter(Boolean)),
    targetPersistence: stableJoin(targets.map(target => target.persistence).filter(Boolean)),
    targetColumnNames: stableJoin(targets.map(target => target.columnName ?? "").filter(Boolean)),
    targetMetadataPaths: stableJoin(
      targets.map(target => (Array.isArray(target.metadataPath) ? target.metadataPath.join(".") : "")).filter(Boolean),
    ),
    customKey,
    customLabel: customDefinition?.label ?? "",
    customSection: customDefinition?.section ?? "",
  }
}

export async function GET(request: NextRequest) {
  return withPermissions(request, ["reconciliation.view"], async req => {
    try {
      const tenantId = req.user.tenantId
      const searchParams = request.nextUrl.searchParams

      const distributorAccountId = normalizeQuery(searchParams.get("distributorAccountId"))
      const vendorAccountId = normalizeQuery(searchParams.get("vendorAccountId"))
      const templateId = normalizeQuery(searchParams.get("templateId"))
      const onlyTelarus = normalizeQuery(searchParams.get("onlyTelarus")).toLowerCase() === "true"

      const where: Prisma.ReconciliationTemplateWhereInput = { tenantId }
      if (templateId) where.id = templateId
      if (distributorAccountId) where.distributorAccountId = distributorAccountId
      if (vendorAccountId) where.vendorAccountId = vendorAccountId

      const [templates, opportunityFields] = await Promise.all([
        prisma.reconciliationTemplate.findMany({
          where,
          include: {
            distributor: { select: { accountName: true } },
            vendor: { select: { accountName: true } },
          },
        }),
        prisma.fieldDefinition.findMany({
          where: { tenantId, module: FieldModule.Opportunities },
          select: { fieldCode: true, label: true, dataType: true },
          orderBy: { displayOrder: "asc" },
        }),
      ])

      const catalog = buildDepositImportFieldCatalog({ opportunityFieldDefinitions: opportunityFields })
      const fieldCatalogIndex = buildDepositImportFieldCatalogIndex(catalog)

      templates.sort((a, b) => {
        const distributorA = (a.distributor?.accountName ?? "").toLowerCase()
        const distributorB = (b.distributor?.accountName ?? "").toLowerCase()
        if (distributorA !== distributorB) return distributorA.localeCompare(distributorB)
        const vendorA = (a.vendor?.accountName ?? "").toLowerCase()
        const vendorB = (b.vendor?.accountName ?? "").toLowerCase()
        if (vendorA !== vendorB) return vendorA.localeCompare(vendorB)
        return (a.name ?? "").toLowerCase().localeCompare((b.name ?? "").toLowerCase())
      })

      const header = [
        "Template Id",
        "Template Name",
        "Template Updated At",
        "Distributor Id",
        "Distributor Name",
        "Vendor Id",
        "Vendor Name",
        "Source System",
        "Telarus Field Name",
        "Telarus Commissable Field Label",
        "Telarus Block",
        "Template Column Name",
        "Mapping Mode",
        "Target Id",
        "Target Label",
        "Target Entity",
        "Target Data Type",
        "Target Persistence",
        "Target Column Name",
        "Target Metadata Path",
        "Custom Key",
        "Custom Label",
        "Custom Section",
      ]

      const rows: string[][] = []

      for (const template of templates) {
        const config = template.config ?? null
        const telarus = extractTelarusTemplateFieldsFromTemplateConfig(config)
        if (onlyTelarus && !telarus) continue

        const mapping = extractDepositMappingV2FromTemplateConfig(config)

        const mappingHeaders = buildUniqueHeaderList([
          ...Object.keys(mapping.columns ?? {}),
          ...Object.values(mapping.targets ?? {}),
        ])

        const matchedMappingHeaders = new Set<string>()

        if (telarus) {
          const telarusFields = [...telarus.fields]
          telarusFields.sort((a, b) => a.telarusFieldName.localeCompare(b.telarusFieldName))

          for (const field of telarusFields) {
            const expectedHeader = field.telarusFieldName
            const mappedHeader = resolveMappedHeader(mappingHeaders, expectedHeader)
            if (mappedHeader) matchedMappingHeaders.add(mappedHeader)

            const summary = mappedHeader
              ? summarizeTemplateColumn({ columnName: mappedHeader, mapping, fieldCatalogIndex })
              : {
                  mode: "unmapped",
                  targetIds: "",
                  targetLabels: "",
                  targetEntities: "",
                  targetDataTypes: "",
                  targetPersistence: "",
                  targetColumnNames: "",
                  targetMetadataPaths: "",
                  customKey: "",
                  customLabel: "",
                  customSection: "",
                }

            rows.push([
              template.id,
              template.name,
              template.updatedAt?.toISOString?.() ?? "",
              template.distributorAccountId,
              template.distributor?.accountName ?? "",
              template.vendorAccountId,
              template.vendor?.accountName ?? "",
              "Telarus",
              field.telarusFieldName,
              field.commissableFieldLabel,
              field.block ?? "",
              mappedHeader ?? "",
              summary.mode,
              summary.targetIds,
              summary.targetLabels,
              summary.targetEntities,
              summary.targetDataTypes,
              summary.targetPersistence,
              summary.targetColumnNames,
              summary.targetMetadataPaths,
              summary.customKey,
              summary.customLabel,
              summary.customSection,
            ])
          }
        }

        const extraHeaders = mappingHeaders
          .filter(headerName => !matchedMappingHeaders.has(headerName))
          .sort((a, b) => a.localeCompare(b))

        for (const columnName of extraHeaders) {
          const summary = summarizeTemplateColumn({ columnName, mapping, fieldCatalogIndex })
          rows.push([
            template.id,
            template.name,
            template.updatedAt?.toISOString?.() ?? "",
            template.distributorAccountId,
            template.distributor?.accountName ?? "",
            template.vendorAccountId,
            template.vendor?.accountName ?? "",
            "Template",
            "",
            "",
            "",
            columnName,
            summary.mode,
            summary.targetIds,
            summary.targetLabels,
            summary.targetEntities,
            summary.targetDataTypes,
            summary.targetPersistence,
            summary.targetColumnNames,
            summary.targetMetadataPaths,
            summary.customKey,
            summary.customLabel,
            summary.customSection,
          ])
        }
      }

      const csv = [header, ...rows].map(line => line.map(toCsvValue).join(",")).join("\n")
      const dateStamp = new Date().toISOString().slice(0, 10)
      const filename = `template-mapping-export-${dateStamp}.csv`

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    } catch (error) {
      console.error("Failed to export reconciliation template mappings", error)
      return createErrorResponse(
        error instanceof Error ? error.message : "Failed to export reconciliation template mappings",
        500,
      )
    }
  })
}
