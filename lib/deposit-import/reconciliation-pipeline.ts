import { Prisma } from "@prisma/client"

import {
  DEPOSIT_IMPORT_TARGET_IDS,
  LEGACY_FIELD_ID_TO_TARGET_ID,
  type DepositImportFieldTarget,
} from "@/lib/deposit-import/field-catalog"
import { rowHasTotalsLabel } from "@/lib/deposit-import/multi-vendor"
import type { DepositMappingConfigV2 } from "@/lib/deposit-import/template-mapping-v2"
import {
  isDepositImportPlainObject,
  normalizeDepositImportNumber,
  normalizeDepositImportString,
  parseDepositImportBoolean,
  parseDepositImportDate,
  setDepositImportMetadataValue,
  startOfDepositMonth,
  toDepositImportJsonValue,
} from "@/lib/deposit-import/shared"

function parseMappedValueByType(dataType: string, value: string | undefined, fallbackDate?: Date) {
  if (dataType === "number") return normalizeDepositImportNumber(value)
  if (dataType === "date") return parseDepositImportDate(value, fallbackDate)
  if (dataType === "boolean") return parseDepositImportBoolean(value)
  return normalizeDepositImportString(value)
}

export async function createReconciliationImportedDeposit(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string
    distributorAccountId: string
    vendorAccountId: string
    reconciliationTemplateId?: string | null
    depositName: string | null
    resolvedDepositDate: Date
    commissionPeriodDate: Date | null
    createdByUserId: string
    createdByContactId: string | null
  }
) {
  return tx.deposit.create({
    data: {
      tenantId: params.tenantId,
      accountId: params.distributorAccountId,
      month: params.commissionPeriodDate ?? startOfDepositMonth(params.resolvedDepositDate),
      depositName: params.depositName,
      paymentDate: params.resolvedDepositDate,
      distributorAccountId: params.distributorAccountId,
      vendorAccountId: params.vendorAccountId,
      reconciliationTemplateId: params.reconciliationTemplateId ?? null,
      createdByUserId: params.createdByUserId,
      createdByContactId: params.createdByContactId || null,
    },
  })
}

export function buildMappedDepositLineItems(params: {
  tenantId: string
  depositId: string
  vendorAccountId: string
  rows: string[][]
  mappingConfig: DepositMappingConfigV2
  columnIndex: Record<string, number>
  customColumnIndex: Record<string, number>
  fieldCatalogIndex: Map<string, DepositImportFieldTarget>
  resolvedDepositDate: Date
  shouldSkipSummaryRows?: boolean
}) {
  return params.rows
    .map((row, index) => {
      if (params.shouldSkipSummaryRows && rowHasTotalsLabel(row, true)) {
        return null
      }

      const metadata: Record<string, unknown> = {}
      const usageIndex = params.columnIndex[DEPOSIT_IMPORT_TARGET_IDS.usage]
      const commissionIndex = params.columnIndex[DEPOSIT_IMPORT_TARGET_IDS.commission]
      const usageValueRaw =
        usageIndex !== undefined ? normalizeDepositImportNumber(row[usageIndex]) : null
      const commissionValue =
        commissionIndex !== undefined ? normalizeDepositImportNumber(row[commissionIndex]) : null
      if (usageValueRaw === null && commissionValue === null) {
        return null
      }

      const paymentDateTargetId = LEGACY_FIELD_ID_TO_TARGET_ID.paymentDate
      const paymentDateIndex =
        paymentDateTargetId ? params.columnIndex[paymentDateTargetId] : undefined
      const paymentDateValue =
        paymentDateIndex !== undefined
          ? parseDepositImportDate(row[paymentDateIndex], params.resolvedDepositDate)
          : params.resolvedDepositDate

      const isCommissionOnly = usageValueRaw === null && commissionValue !== null
      const usageValue = isCommissionOnly ? commissionValue : usageValueRaw

      const commissionRateIndex = params.columnIndex[DEPOSIT_IMPORT_TARGET_IDS.commissionRate]
      const commissionRateValueRaw =
        commissionRateIndex !== undefined
          ? normalizeDepositImportNumber(row[commissionRateIndex])
          : null
      const commissionRateValue = isCommissionOnly ? 1 : commissionRateValueRaw

      const lineNumberTargetId = LEGACY_FIELD_ID_TO_TARGET_ID.lineNumber
      const lineNumberIndex =
        lineNumberTargetId ? params.columnIndex[lineNumberTargetId] : undefined
      const lineNumberValue =
        lineNumberIndex !== undefined
          ? normalizeDepositImportNumber(row[lineNumberIndex]) ?? index + 1
          : index + 1

      const lineItem: Prisma.DepositLineItemCreateManyInput = {
        tenantId: params.tenantId,
        depositId: params.depositId,
        lineNumber: lineNumberValue,
        paymentDate: paymentDateValue ?? params.resolvedDepositDate,
        usage: usageValue,
        usageAllocated: 0,
        usageUnallocated: usageValue ?? 0,
        commission: commissionValue,
        commissionAllocated: 0,
        commissionUnallocated: commissionValue ?? 0,
        commissionRate: commissionRateValue,
        vendorAccountId: params.vendorAccountId,
      }

      for (const [targetId] of Object.entries(params.mappingConfig.targets ?? {})) {
        const target = params.fieldCatalogIndex.get(targetId)
        if (!target || target.persistence !== "depositLineItemColumn" || !target.columnName) continue
        if (["usage", "commission", "commissionRate", "lineNumber", "paymentDate"].includes(target.columnName)) {
          continue
        }
        const indexValue = params.columnIndex[targetId]
        if (indexValue === undefined) continue
        const parsedValue = parseMappedValueByType(target.dataType, row[indexValue])
        if (parsedValue === null || parsedValue === undefined) continue
        ;(lineItem as Record<string, unknown>)[target.columnName] = parsedValue
      }

      for (const [targetId] of Object.entries(params.mappingConfig.targets ?? {})) {
        const target = params.fieldCatalogIndex.get(targetId)
        if (!target || target.persistence !== "metadata" || !target.metadataPath) continue
        const indexValue = params.columnIndex[targetId]
        if (indexValue === undefined) continue
        const parsedValue = parseMappedValueByType(
          target.dataType,
          row[indexValue],
          params.resolvedDepositDate,
        )
        if (parsedValue === null || parsedValue === undefined) continue
        setDepositImportMetadataValue(metadata, target.metadataPath, parsedValue)
      }

      for (const [customKey, indexValue] of Object.entries(params.customColumnIndex)) {
        const rawValue = row[indexValue]
        const parsedValue = normalizeDepositImportString(rawValue)
        if (!parsedValue) continue
        const definition = params.mappingConfig.customFields?.[customKey]
        const customBucket = isDepositImportPlainObject(metadata["custom"])
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
        lineItem.metadata = toDepositImportJsonValue(metadata)
      }

      return lineItem
    })
    .filter((line): line is Prisma.DepositLineItemCreateManyInput => Boolean(line))
}
