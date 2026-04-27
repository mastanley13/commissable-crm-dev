import {
  HistoricalDepositBucket,
  ImportJobRecordOperation,
  ImportJobUndoAction
} from "@prisma/client"

import { prisma } from "@/lib/db"
import {
  normalizeDepositExternalKey,
  normalizeDepositImportString,
  parseDepositCommissionPeriodInput,
  parseDepositImportBooleanInput,
  parseDepositImportDateInput,
  refreshDepositAggregateTotals,
  startOfDepositMonth,
  toDepositImportJsonValue
} from "@/lib/deposit-import/shared"

export type DepositTransactionHistoricalBucket = "settled-history" | "open-or-disputed"

export interface DepositTransactionEntityOptions {
  historicalBucket: DepositTransactionHistoricalBucket
  sourceSystem: string
  idempotencyKey: string
  defaultDistributorAccountName: string | null
  defaultVendorAccountName: string | null
  notesPrefix: string | null
}

export interface DepositTransactionImportState {
  config: DepositTransactionEntityOptions
  seenSourceTransactionKeys: Set<string>
  depositBySourceKey: Map<
    string,
    {
      id: string
      distributorAccountId: string
      vendorAccountId: string
      monthIsoDate: string
    }
  >
}

type RowFailure = {
  field: string
  errorType: "validation" | "business_rule" | "system"
  message: string
}

type RowOutcome =
  | { status: "success"; mutations?: ImportedRecordMutation[] }
  | { status: "skipped" }
  | { status: "error"; failure: RowFailure }

type ImportedRecordMutation = {
  entityName: string
  entityId: string
  operation: ImportJobRecordOperation
  undoAction: ImportJobUndoAction
  undoOrder: number
}

type ResolvedAccount = {
  id: string
}

interface DepositTransactionImportContext {
  tenantId: string
  userId: string
  state: DepositTransactionImportState
  validateOnly?: boolean
  values: Record<string, string>
  resolveAccountByName: (accountName: string) => Promise<ResolvedAccount | null>
}

function asTrimmedString(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }
  return String(value).trim()
}

function asOptionalString(value: unknown): string | null {
  const trimmed = asTrimmedString(value)
  return trimmed.length > 0 ? trimmed : null
}

function parseOptionalNumber(value: string): { value: number | null; valid: boolean } {
  const trimmed = value.trim()
  if (!trimmed) {
    return { value: null, valid: true }
  }

  const normalized = trimmed.replace(/,/g, "").replace(/%$/g, "")
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    return { value: null, valid: false }
  }

  return { value: parsed, valid: true }
}

function isDepositTransactionHistoricalBucket(
  value: unknown
): value is DepositTransactionHistoricalBucket {
  return value === "settled-history" || value === "open-or-disputed"
}

function toHistoricalDepositBucket(value: DepositTransactionHistoricalBucket) {
  return value === "settled-history"
    ? HistoricalDepositBucket.SettledHistory
    : HistoricalDepositBucket.OpenOrDisputed
}

function createdMutation(entityName: "Deposit" | "DepositLineItem", entityId: string) {
  return {
    entityName,
    entityId,
    operation: ImportJobRecordOperation.Created,
    undoAction: ImportJobUndoAction.DeleteCreatedRecord,
    undoOrder: entityName === "DepositLineItem" ? 10 : 20
  }
}

async function resolveDepositTransactionAccountByName(
  params: {
    field: "distributorAccountName" | "vendorAccountName"
    rowValue: string
    fallbackValue: string | null
    resolveAccountByName: (accountName: string) => Promise<ResolvedAccount | null>
  }
): Promise<
  | { status: "success"; accountId: string; accountName: string }
  | { status: "error"; failure: RowFailure }
> {
  const accountName = params.rowValue || params.fallbackValue || ""
  if (!accountName) {
    return {
      status: "error",
      failure: {
        field: params.field,
        errorType: "validation",
        message: `${params.field === "distributorAccountName" ? "Distributor" : "Vendor"} is required.`
      }
    }
  }

  const account = await params.resolveAccountByName(accountName)
  if (!account) {
    return {
      status: "error",
      failure: {
        field: params.field,
        errorType: "business_rule",
        message: `${params.field === "distributorAccountName" ? "Distributor" : "Vendor"} "${accountName}" was not found.`
      }
    }
  }

  return {
    status: "success",
    accountId: account.id,
    accountName
  }
}

export function parseDepositTransactionEntityOptions(
  rawOptions: unknown
): { options: DepositTransactionEntityOptions | null; error?: string } {
  if (!rawOptions || typeof rawOptions !== "object" || Array.isArray(rawOptions)) {
    return { options: null, error: "Deposit transaction imports require entityOptions." }
  }

  const options = rawOptions as Record<string, unknown>
  const historicalBucket = options.historicalBucket
  if (!isDepositTransactionHistoricalBucket(historicalBucket)) {
    return { options: null, error: "Deposit transaction imports require a valid historical bucket." }
  }

  const sourceSystem = asTrimmedString(options.sourceSystem)
  if (!sourceSystem) {
    return { options: null, error: "Deposit transaction imports require a source system." }
  }

  const idempotencyKey = asTrimmedString(options.idempotencyKey)
  if (!idempotencyKey) {
    return { options: null, error: "Deposit transaction imports require an idempotency key." }
  }

  return {
    options: {
      historicalBucket,
      sourceSystem,
      idempotencyKey,
      defaultDistributorAccountName: asOptionalString(
        asTrimmedString(options.defaultDistributorAccountName)
      ),
      defaultVendorAccountName: asOptionalString(asTrimmedString(options.defaultVendorAccountName)),
      notesPrefix: asOptionalString(asTrimmedString(options.notesPrefix))
    }
  }
}

export async function importDepositTransactionRow(
  context: DepositTransactionImportContext
): Promise<RowOutcome> {
  const { state, values } = context
  const sourceDepositKey = asTrimmedString(values.sourceDepositKey)
  if (!sourceDepositKey) {
    return {
      status: "error",
      failure: {
        field: "sourceDepositKey",
        errorType: "validation",
        message: "Source Deposit Key is required."
      }
    }
  }

  const sourceTransactionKey = asTrimmedString(values.sourceTransactionKey)
  if (!sourceTransactionKey) {
    return {
      status: "error",
      failure: {
        field: "sourceTransactionKey",
        errorType: "validation",
        message: "Source Transaction Key is required."
      }
    }
  }

  const normalizedTransactionKey = normalizeDepositExternalKey(sourceTransactionKey)
  if (state.seenSourceTransactionKeys.has(normalizedTransactionKey)) {
    return {
      status: "error",
      failure: {
        field: "sourceTransactionKey",
        errorType: "validation",
        message: `Source Transaction Key "${sourceTransactionKey}" is duplicated in this import file.`
      }
    }
  }

  const paymentDate = parseDepositImportDateInput(asTrimmedString(values.paymentDate))
  if (!paymentDate.valid || !paymentDate.value) {
    return {
      status: "error",
      failure: {
        field: "paymentDate",
        errorType: "validation",
        message: `Payment Date "${values.paymentDate}" is invalid.`
      }
    }
  }

  const commissionPeriod = parseDepositCommissionPeriodInput(asTrimmedString(values.commissionPeriod))
  if (!commissionPeriod.valid) {
    return {
      status: "error",
      failure: {
        field: "commissionPeriod",
        errorType: "validation",
        message: `Commission Period "${values.commissionPeriod}" is invalid. Use YYYY-MM.`
      }
    }
  }

  const usage = parseOptionalNumber(asTrimmedString(values.usage))
  if (!usage.valid) {
    return {
      status: "error",
      failure: {
        field: "usage",
        errorType: "validation",
        message: `Actual Usage "${values.usage}" is invalid.`
      }
    }
  }

  const commission = parseOptionalNumber(asTrimmedString(values.commission))
  if (!commission.valid) {
    return {
      status: "error",
      failure: {
        field: "commission",
        errorType: "validation",
        message: `Actual Commission "${values.commission}" is invalid.`
      }
    }
  }

  if (usage.value === null && commission.value === null) {
    return {
      status: "error",
      failure: {
        field: "usage",
        errorType: "validation",
        message: "At least one of Actual Usage or Actual Commission is required."
      }
    }
  }

  const commissionRate = parseOptionalNumber(asTrimmedString(values.commissionRate))
  if (!commissionRate.valid) {
    return {
      status: "error",
      failure: {
        field: "commissionRate",
        errorType: "validation",
        message: `Actual Commission Rate "${values.commissionRate}" is invalid.`
      }
    }
  }

  const isChargeback = parseDepositImportBooleanInput(asTrimmedString(values.isChargeback))
  if (!isChargeback.valid) {
    return {
      status: "error",
      failure: {
        field: "isChargeback",
        errorType: "validation",
        message: `Is Chargeback "${values.isChargeback}" is invalid. Use true/false.`
      }
    }
  }

  const distributor = await resolveDepositTransactionAccountByName({
    field: "distributorAccountName",
    rowValue: asTrimmedString(values.distributorAccountName),
    fallbackValue: state.config.defaultDistributorAccountName,
    resolveAccountByName: context.resolveAccountByName
  })
  if (distributor.status === "error") {
    return distributor
  }

  const vendor = await resolveDepositTransactionAccountByName({
    field: "vendorAccountName",
    rowValue: asTrimmedString(values.vendorAccountName),
    fallbackValue: state.config.defaultVendorAccountName,
    resolveAccountByName: context.resolveAccountByName
  })
  if (vendor.status === "error") {
    return vendor
  }

  const sourceSystem = state.config.sourceSystem
  const existingDbTransaction = await prisma.depositLineItem.findFirst({
    where: {
      tenantId: context.tenantId,
      sourceSystem,
      sourceTransactionKey: { equals: sourceTransactionKey, mode: "insensitive" }
    },
    select: { id: true }
  })
  if (existingDbTransaction) {
    return {
      status: "error",
      failure: {
        field: "sourceTransactionKey",
        errorType: "business_rule",
        message: `Source Transaction Key "${sourceTransactionKey}" already exists for source system "${sourceSystem}".`
      }
    }
  }

  const effectiveUsage = usage.value === null && commission.value !== null ? commission.value : usage.value
  const effectiveCommissionRate =
    usage.value === null && commission.value !== null ? 1 : commissionRate.value
  const effectiveMonth = commissionPeriod.value ?? startOfDepositMonth(paymentDate.value)
  const depositName = normalizeDepositImportString(values.depositName) ?? sourceDepositKey
  const notesValue = asOptionalString(asTrimmedString(values.notes))
  const lineNumberRaw = parseOptionalNumber(asTrimmedString(values.lineNumber))
  if (!lineNumberRaw.valid) {
    return {
      status: "error",
      failure: {
        field: "lineNumber",
        errorType: "validation",
        message: `Line Item "${values.lineNumber}" is invalid.`
      }
    }
  }

  const commissionDate = parseDepositImportDateInput(asTrimmedString(values.commissionDate))
  if (!commissionDate.valid) {
    return {
      status: "error",
      failure: {
        field: "commissionDate",
        errorType: "validation",
        message: `Commission Date "${values.commissionDate}" is invalid.`
      }
    }
  }

  const normalizedSourceDepositKey = normalizeDepositExternalKey(sourceDepositKey)
  const depositCacheEntry = state.depositBySourceKey.get(normalizedSourceDepositKey) ?? null
  if (
    depositCacheEntry &&
    (depositCacheEntry.distributorAccountId !== distributor.accountId ||
      depositCacheEntry.vendorAccountId !== vendor.accountId ||
      depositCacheEntry.monthIsoDate !== effectiveMonth.toISOString())
  ) {
    return {
      status: "error",
      failure: {
        field: "sourceDepositKey",
        errorType: "business_rule",
        message: `All rows for Source Deposit Key "${sourceDepositKey}" must resolve to the same distributor, vendor, and commission period.`
      }
    }
  }

  const notesParts = [
    state.config.notesPrefix,
    `Historical bucket: ${state.config.historicalBucket}`,
    `Source system: ${state.config.sourceSystem}`,
    notesValue
  ].filter(Boolean)

  if (context.validateOnly) {
    if (!depositCacheEntry) {
      const existingDeposit = await prisma.deposit.findFirst({
        where: {
          tenantId: context.tenantId,
          sourceSystem,
          sourceDepositKey: { equals: sourceDepositKey, mode: "insensitive" }
        },
        select: { id: true }
      })
      if (existingDeposit) {
        return {
          status: "error",
          failure: {
            field: "sourceDepositKey",
            errorType: "business_rule",
            message: `A deposit with Source Deposit Key "${sourceDepositKey}" already exists for source system "${sourceSystem}".`
          }
        }
      }

      state.depositBySourceKey.set(normalizedSourceDepositKey, {
        id: `validate-only:${normalizedSourceDepositKey}`,
        distributorAccountId: distributor.accountId,
        vendorAccountId: vendor.accountId,
        monthIsoDate: effectiveMonth.toISOString()
      })
    }

    state.seenSourceTransactionKeys.add(normalizedTransactionKey)
    return { status: "success" }
  }

  let mutations: ImportedRecordMutation[] = []
  try {
    mutations = await prisma.$transaction(async tx => {
      const mutations: ImportedRecordMutation[] = []
      let depositId = depositCacheEntry?.id ?? null

      if (!depositId) {
        const existingDeposit = await tx.deposit.findFirst({
          where: {
            tenantId: context.tenantId,
            sourceSystem,
            sourceDepositKey: { equals: sourceDepositKey, mode: "insensitive" }
          },
          select: { id: true }
        })
        if (existingDeposit) {
          throw new Error(`duplicate-source-deposit:${sourceDepositKey}`)
        }

        const createdDeposit = await tx.deposit.create({
          data: {
            tenantId: context.tenantId,
            accountId: distributor.accountId,
            month: effectiveMonth,
            depositName,
            paymentDate: paymentDate.value,
            distributorAccountId: distributor.accountId,
            vendorAccountId: vendor.accountId,
            createdByUserId: context.userId,
            historicalBucket: toHistoricalDepositBucket(state.config.historicalBucket),
            sourceSystem,
            sourceDepositKey,
            importedViaAdmin: true,
            notes: notesParts.length > 0 ? notesParts.join("\n") : null,
            totalItems: 0,
            totalReconciledItems: 0,
            totalUsage: 0,
            usageAllocated: 0,
            usageUnallocated: 0,
            totalCommissions: 0,
            commissionAllocated: 0,
            commissionUnallocated: 0,
            itemsReconciled: 0,
            itemsUnreconciled: 0
          },
          select: { id: true }
        })

        depositId = createdDeposit.id
        mutations.push(createdMutation("Deposit", createdDeposit.id))
        state.depositBySourceKey.set(normalizedSourceDepositKey, {
          id: createdDeposit.id,
          distributorAccountId: distributor.accountId,
          vendorAccountId: vendor.accountId,
          monthIsoDate: effectiveMonth.toISOString()
        })
      }

      const metadata: Record<string, unknown> = {}
      const commissionType = asOptionalString(values.commissionType)
      const opportunityName = asOptionalString(values.opportunityName)
      const externalScheduleId = asOptionalString(values.externalScheduleId)

      if (commissionType) {
        metadata.depositLineItem = { commissionType }
      }
      if (commissionDate.value) {
        metadata.depositLineItem = {
          ...(metadata.depositLineItem as Record<string, unknown> | undefined),
          commissionDate: commissionDate.value.toISOString()
        }
      }
      if (opportunityName) {
        metadata.opportunity = { name: opportunityName }
      }
      if (externalScheduleId) {
        metadata.matching = { externalScheduleId }
      }

      const createdLineItem = await tx.depositLineItem.create({
        data: {
          tenantId: context.tenantId,
          depositId,
          lineNumber: lineNumberRaw.value === null ? null : Math.floor(lineNumberRaw.value),
          paymentDate: paymentDate.value,
          vendorAccountId: vendor.accountId,
          accountIdVendor: asOptionalString(values.accountIdVendor),
          customerIdVendor: asOptionalString(values.customerIdVendor),
          orderIdVendor: asOptionalString(values.orderIdVendor),
          accountNameRaw: asOptionalString(values.accountNameRaw),
          vendorNameRaw: vendor.accountName,
          distributorNameRaw: distributor.accountName,
          productNameRaw: asOptionalString(values.productNameRaw),
          partNumberRaw: asOptionalString(values.partNumberRaw),
          sourceSystem,
          sourceTransactionKey,
          locationId: asOptionalString(values.locationId),
          customerPurchaseOrder: asOptionalString(values.customerPurchaseOrder),
          metadata: Object.keys(metadata).length > 0 ? toDepositImportJsonValue(metadata) : undefined,
          usage: effectiveUsage,
          usageAllocated: 0,
          usageUnallocated: effectiveUsage ?? 0,
          commission: commission.value,
          commissionAllocated: 0,
          commissionUnallocated: commission.value ?? 0,
          commissionRate: effectiveCommissionRate,
          isChargeback: isChargeback.value ?? false
        },
        select: { id: true }
      })
      mutations.push(createdMutation("DepositLineItem", createdLineItem.id))

      await refreshDepositAggregateTotals(tx, context.tenantId, depositId)
      return mutations
    })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("duplicate-source-deposit:")) {
      return {
        status: "error",
        failure: {
          field: "sourceDepositKey",
          errorType: "business_rule",
          message: `A deposit with Source Deposit Key "${sourceDepositKey}" already exists for source system "${sourceSystem}".`
        }
      }
    }

    throw error
  }

  state.seenSourceTransactionKeys.add(normalizedTransactionKey)
  return { status: "success", mutations }
}
