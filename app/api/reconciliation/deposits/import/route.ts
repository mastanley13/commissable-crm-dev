import { NextRequest, NextResponse } from "next/server"
import { DataEntity, ImportExportSource, JobStatus } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { parseSpreadsheetFile } from "@/lib/deposit-import/parse-file"
import { depositFieldDefinitions, requiredDepositFieldIds } from "@/lib/deposit-import/fields"

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

function buildColumnIndex(headers: string[], mapping: Record<string, string>) {
  const columnIndex: Record<string, number> = {}
  for (const [fieldId, columnName] of Object.entries(mapping)) {
    if (!columnName) continue
    const index = headers.findIndex(header => header === columnName)
    if (index === -1) {
      throw new Error(`Column "${columnName}" not found in uploaded file`)
    }
    columnIndex[fieldId] = index
  }
  return columnIndex
}

export async function POST(request: NextRequest) {
  return withPermissions(request, ["reconciliation.manage", "reconciliation.view"], async req => {
    const formData = await request.formData()
    const tenantId = req.user.tenantId

    const file = formData.get("file")
    if (!(file instanceof File)) {
      return createErrorResponse("File upload is required", 400)
    }

    const depositName = (formData.get("depositName") as string | null) ?? ""
    const paymentDateInput = (formData.get("paymentDate") as string | null) ?? ""
    const customerAccountId = ((formData.get("customerAccountId") as string | null) ?? "").trim()
    const distributorAccountId = ((formData.get("distributorAccountId") as string | null) ?? "").trim() || null
    const vendorAccountId = ((formData.get("vendorAccountId") as string | null) ?? "").trim() || null
    const templateId = ((formData.get("templateId") as string | null) ?? "").trim() || null
    const createdByContactId = ((formData.get("createdByContactId") as string | null) ?? "").trim() || null

    if (!customerAccountId) {
      return createErrorResponse("Customer is required", 400)
    }

    const commissionPeriodInput = (formData.get("commissionPeriod") as string | null) ?? ""
    const mappingRaw = formData.get("mapping")
    if (!mappingRaw || typeof mappingRaw !== "string") {
      return createErrorResponse("Field mapping is required", 400)
    }

    let mapping: Record<string, string>
    try {
      mapping = JSON.parse(mappingRaw) as Record<string, string>
    } catch {
      return createErrorResponse("Invalid mapping payload", 400)
    }

    const missingMappings = requiredDepositFieldIds.filter(fieldId => !mapping[fieldId])
    if (missingMappings.length > 0) {
      const missingLabels = missingMappings
        .map(fieldId => depositFieldDefinitions.find(field => field.id === fieldId)?.label ?? fieldId)
        .join(", ")
      return createErrorResponse(`Missing mapping for required fields: ${missingLabels}`, 400)
    }

    const depositDate = paymentDateInput ? new Date(paymentDateInput) : new Date()
    if (Number.isNaN(depositDate.getTime())) {
      return createErrorResponse("Invalid payment date provided", 400)
    }
    const commissionPeriodDate = parseCommissionPeriod(commissionPeriodInput)

    const parsedFile = await parseSpreadsheetFile(file, file.name, file.type)
    if (!parsedFile.headers.length || parsedFile.rows.length === 0) {
      return createErrorResponse("Uploaded file did not contain any data rows", 400)
    }

    let columnIndex: Record<string, number>
    try {
      columnIndex = buildColumnIndex(parsedFile.headers, mapping)
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : "Mapping failed", 400)
    }

const result = await prisma.$transaction(async tx => {
      const deposit = await tx.deposit.create({
        data: {
          tenantId,
          accountId: customerAccountId,
          month: commissionPeriodDate ?? startOfMonth(depositDate),
          depositName: depositName || null,
          paymentDate: depositDate,
          distributorAccountId,
          vendorAccountId,
          createdByUserId: req.user.id,
          createdByContactId: createdByContactId || null,
        },
      })

      const lineItemsData = parsedFile.rows
        .map((row, index) => {
          const usageValue = normalizeNumber(row[columnIndex.usage])
          const commissionValue = normalizeNumber(row[columnIndex.commission])
          if (usageValue === null && commissionValue === null) {
            return null
          }

          const resolveString = (fieldId: string) => normalizeString(row[columnIndex[fieldId]])
          const paymentDateValue = parseDateValue(row[columnIndex.paymentDate], depositDate)

          const commissionRateValue = normalizeNumber(row[columnIndex.commissionRate])

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
          filters: {
            templateId,
            mapping,
            commissionPeriod: commissionPeriodInput || null,
          },
        },
      })

      if (templateId) {
        const template = await tx.reconciliationTemplate.findFirst({
          where: { id: templateId, tenantId },
          select: { config: true },
        })
        if (template) {
          const previousConfig = (template.config as Record<string, any> | null) ?? {}
          await tx.reconciliationTemplate.update({
            where: { id: templateId },
            data: {
              config: {
                ...previousConfig,
                depositMapping: {
                  ...(previousConfig.depositMapping ?? {}),
                  line: mapping,
                },
              },
            },
          })
        }
      }

      return {
        depositId: deposit.id,
        lineCount: lineItemsData.length,
      }
    })

    return NextResponse.json({
      data: result,
    })
  })
}
