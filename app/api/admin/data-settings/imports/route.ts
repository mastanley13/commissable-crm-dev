import { NextRequest, NextResponse } from "next/server"
import {
  AccountStatus,
  ContactMethod,
  DataEntity,
  ImportExportSource,
  ImportJobRecordOperation,
  ImportJobUndoAction,
  ImportJobUndoStatus,
  JobStatus,
  LeadSource,
  OpportunityProductStatus,
  Prisma,
  OpportunityStage,
  RevenueScheduleType
} from "@prisma/client"
import { createErrorResponse, withPermissions } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { formatPhoneNumber, normalizeEmail } from "@/lib/validation"
import { normalizePhoneExtension } from "@/lib/phone-extension"
import { getEnabledRevenueTypeOptions } from "@/lib/server-revenue-types"
import {
  ensureNoneDirectDistributorAccount,
  NONE_DIRECT_DISTRIBUTOR_NAME
} from "@/lib/none-direct-distributor"
import { isHouseAccountType } from "@/lib/account-type"
import { formatAddressRecord } from "@/lib/address-format"
import { canonicalizeMultiValueString } from "@/lib/multi-value"
import { recalculateOpportunityStage } from "@/lib/opportunities/stage"
import { assertVendorDistributorConsistentForOpportunity } from "@/lib/opportunities/vendor-distributor"
import {
  importDepositTransactionRow,
  parseDepositTransactionEntityOptions,
  type DepositTransactionEntityOptions,
  type DepositTransactionImportState
} from "@/lib/deposit-import/admin-deposit-transactions"
import {
  getDataImportEntityDefinition,
  isDataImportEntityType,
  type DataImportEntityType
} from "@/lib/data-import/catalog"
import { isValidSalesforceId, normalizeSalesforceIdInput } from "@/lib/salesforce-id"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MANAGE_PERMISSIONS = ["admin.data_settings.manage"]
const MAX_IMPORT_ROWS = 5000
const MAX_ERROR_ROWS = 500

interface ImportError {
  rowNumber: number
  field: string
  errorType: "validation" | "business_rule" | "system"
  message: string
  accountName?: string
}

interface ImportResult {
  totalRows: number
  successRows: number
  skippedRows: number
  errorRows: number
  errors: ImportError[]
  mode?: "import" | "validate-only"
  importJobId?: string
  storedErrorCount?: number
}

interface ImportRequestBody {
  entityType: DataImportEntityType
  upsertExisting: boolean
  validateOnly?: boolean
  mapping: Record<string, string>
  rows: Array<Record<string, unknown>>
  fileName?: string
  entityOptions?: Record<string, unknown>
}

interface RowFailure {
  field: string
  errorType: "validation" | "business_rule" | "system"
  message: string
}

type RowOutcome =
  | { status: "success"; mutations?: ImportedRecordMutation[] }
  | { status: "skipped" }
  | { status: "error"; failure: RowFailure }

interface ImportedRecordMutation {
  entityName: string
  entityId: string
  operation: ImportJobRecordOperation
  undoAction: ImportJobUndoAction
  undoOrder: number
  previousValues?: Prisma.InputJsonValue
  newValues?: Prisma.InputJsonValue
}

interface AccountLookup {
  id: string
  accountName: string
  salesforceId: string | null
  accountTypeId: string | null
  accountTypeName: string | null
  accountTypeAssignableToContacts: boolean | null
  shippingAddressId: string | null
  billingAddressId: string | null
  shippingAddressFormatted: string | null
  billingAddressFormatted: string | null
}

interface ProductLookup {
  id: string
  distributorAccountId: string | null
  vendorAccountId: string | null
  productCode: string
  productNameHouse: string
  productNameVendor: string | null
  description: string | null
  revenueType: string
  priceEach: Prisma.Decimal | null
  commissionPercent: Prisma.Decimal | null
  productFamilyHouse: string | null
  productSubtypeHouse: string | null
  productFamilyVendor: string | null
  productSubtypeVendor: string | null
  productNameDistributor: string | null
  partNumberVendor: string | null
  partNumberDistributor: string | null
  distributorProductFamily: string | null
  distributorProductSubtype: string | null
  productDescriptionVendor: string | null
  productDescriptionDistributor: string | null
  distributorAccountName: string | null
  vendorAccountName: string | null
}

interface OpportunityRoleContactLookup {
  id: string
  fullName: string
  jobTitle: string | null
  emailAddress: string | null
  workPhone: string | null
  workPhoneExt: string | null
  mobilePhone: string | null
}

interface ImportContext {
  tenantId: string
  userId: string
  accountByNameCache: Map<string, AccountLookup | null>
  accountBySalesforceIdCache: Map<string, AccountLookup | null>
  accountImportNames: Set<string>
  accountTypeIdByNameCache: Map<string, string | null>
  industryIdByNameCache: Map<string, string | null>
  activeUserIdByEmailCache: Map<string, string | null>
  opportunityIdByNameCache: Map<string, string | null>
  contactIdByMatchKeyCache: Map<string, string | null>
  productByCodeCache: Map<string, ProductLookup | null>
  enabledRevenueTypeCodeByNormalizedCode: Map<string, string>
  enabledRevenueTypeCodeByNormalizedLabel: Map<string, string>
  depositTransactionState: DepositTransactionImportState | null
}

interface ImportOptions {
  upsertExisting: boolean
  validateOnly: boolean
}

interface StructuredAddressInput {
  line1: string
  city: string
  line2?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
}

interface RecentImportJobSummary {
  id: string
  entityType: DataImportEntityType
  status: JobStatus
  undoStatus: ImportJobUndoStatus
  fileName: string
  totalRows: number | null
  processedRows: number | null
  successCount: number | null
  errorCount: number | null
  trackedRecordCount: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
}

function normalizeEnumKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]/g, "")
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

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue
}

function parseOptionalDate(value: string): { value: Date | null; valid: boolean } {
  const trimmed = value.trim()
  if (!trimmed) {
    return { value: null, valid: true }
  }
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    return { value: null, valid: false }
  }
  return { value: date, valid: true }
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

function parseOptionalBoolean(value: string): { value: boolean | null; valid: boolean } {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) {
    return { value: null, valid: true }
  }
  if (["true", "1", "yes", "y"].includes(trimmed)) {
    return { value: true, valid: true }
  }
  if (["false", "0", "no", "n"].includes(trimmed)) {
    return { value: false, valid: true }
  }
  return { value: null, valid: false }
}

function isValidOpportunityProductStatus(value: unknown): value is OpportunityProductStatus {
  return typeof value === "string" && (Object.values(OpportunityProductStatus) as string[]).includes(value)
}

function buildStructuredAddressInput(
  values: Record<string, string>,
  prefix: "shipping" | "billing"
): { input: StructuredAddressInput | null; provided: boolean; error?: string } {
  const line1 = asTrimmedString(values[`${prefix}Street`])
  const line2 = asOptionalString(asTrimmedString(values[`${prefix}Street2`]))
  const city = asTrimmedString(values[`${prefix}City`])
  const state = asOptionalString(asTrimmedString(values[`${prefix}State`]))
  const postalCode = asOptionalString(asTrimmedString(values[`${prefix}Zip`]))
  const country = asOptionalString(asTrimmedString(values[`${prefix}Country`]))

  const provided = Boolean(line1 || line2 || city || state || postalCode || country)
  if (!provided) {
    return { input: null, provided: false }
  }

  if (!line1 || !city) {
    return {
      input: null,
      provided: true,
      error: `${prefix === "shipping" ? "Shipping" : "Billing"} address requires both street and city.`
    }
  }

  return {
    provided: true,
    input: {
      line1,
      city,
      line2,
      state,
      postalCode,
      country
    }
  }
}

async function saveAddressInput(
  tx: Prisma.TransactionClient,
  tenantId: string,
  existingAddressId: string | null,
  input: StructuredAddressInput
): Promise<{ id: string; created: boolean }> {
  if (existingAddressId) {
    await tx.address.update({
      where: { id: existingAddressId },
      data: {
        line1: input.line1,
        line2: input.line2 ?? null,
        city: input.city,
        state: input.state ?? null,
        postalCode: input.postalCode ?? null,
        country: input.country ?? null
      }
    })
    return { id: existingAddressId, created: false }
  }

  const created = await tx.address.create({
    data: {
      tenantId,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      state: input.state ?? null,
      postalCode: input.postalCode ?? null,
      country: input.country ?? null
    },
    select: { id: true }
  })

  return { id: created.id, created: true }
}

function createEnumLookup<T extends string>(values: readonly T[]) {
  const lookup = new Map<string, T>()
  for (const value of values) {
    lookup.set(normalizeEnumKey(value), value)
  }
  return lookup
}

const ACCOUNT_STATUS_LOOKUP = createEnumLookup(Object.values(AccountStatus))
ACCOUNT_STATUS_LOOKUP.set("deleted", AccountStatus.Archived)

const CONTACT_METHOD_LOOKUP = createEnumLookup(Object.values(ContactMethod))
const OPPORTUNITY_STAGE_LOOKUP = createEnumLookup(Object.values(OpportunityStage))
const LEAD_SOURCE_LOOKUP = createEnumLookup(Object.values(LeadSource))
const REVENUE_SCHEDULE_TYPE_LOOKUP = createEnumLookup(Object.values(RevenueScheduleType))
const OPPORTUNITY_STAGE_ALIAS_LOOKUP = new Map<string, OpportunityStage>([
  ["closedwon", OpportunityStage.ClosedWon],
  ["closedwonlegacy", OpportunityStage.ClosedWon],
  ["closedprovisioning", OpportunityStage.ClosedWon_Provisioning],
  ["closedwonprovisioning", OpportunityStage.ClosedWon_Provisioning],
  ["closedwonbilling", OpportunityStage.ClosedWon_Billing],
  ["closedbilling", OpportunityStage.ClosedWon_Billing],
  ["closedbillingandcommissioning", OpportunityStage.ClosedWon_Billing],
  ["closedwonbillingandcommissioning", OpportunityStage.ClosedWon_Billing],
  ["closedwonbillingended", OpportunityStage.ClosedWon_BillingEnded],
  ["closedbillingended", OpportunityStage.ClosedWon_BillingEnded]
])
const OPPORTUNITY_STAGE_OPTIONS_FOR_ERROR = [
  "Qualification",
  "Discovery",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Won - Provisioning",
  "Closed Won - Billing",
  "Closed Won - Billing Ended",
  "Closed Lost"
]

function resolveEnumValue<T extends string>(lookup: Map<string, T>, value: string): T | null {
  const key = normalizeEnumKey(value)
  if (!key) {
    return null
  }
  return lookup.get(key) ?? null
}

function resolveOpportunityStageValue(value: string): OpportunityStage | null {
  const normalizedValue = normalizeEnumKey(value)
  if (!normalizedValue) {
    return null
  }
  return (
    OPPORTUNITY_STAGE_ALIAS_LOOKUP.get(normalizedValue) ??
    resolveEnumValue(OPPORTUNITY_STAGE_LOOKUP, value)
  )
}

function getMappedColumnName(mapping: Record<string, string>, fieldId: string): string | null {
  for (const [columnName, mappedFieldId] of Object.entries(mapping)) {
    if (mappedFieldId === fieldId) {
      return columnName
    }
  }
  return null
}

function getFieldLabel(
  definition: ReturnType<typeof getDataImportEntityDefinition>,
  fieldId: string
): string {
  return definition?.fields.find(field => field.id === fieldId)?.label ?? fieldId
}

function describeFieldForMessage(
  definition: ReturnType<typeof getDataImportEntityDefinition>,
  mapping: Record<string, string>,
  fieldId: string
): string {
  const label = getFieldLabel(definition, fieldId)
  const columnName = getMappedColumnName(mapping, fieldId)
  if (!columnName) {
    return label
  }
  return `${label} (column "${columnName}")`
}

function withFieldContext(
  message: string,
  definition: ReturnType<typeof getDataImportEntityDefinition>,
  mapping: Record<string, string>,
  fieldId: string
): string {
  if (!fieldId || fieldId === "row") {
    return message
  }
  const context = describeFieldForMessage(definition, mapping, fieldId)
  return `${message} Blocking field: ${context}.`
}

function getImportErrorAccountName(values: Record<string, string>): string | undefined {
  const accountName = asTrimmedString(values.accountName)
  if (accountName) {
    return accountName
  }

  const accountNameRaw = asTrimmedString(values.accountNameRaw)
  if (accountNameRaw) {
    return accountNameRaw
  }

  const customerName = asTrimmedString(values.customerName)
  return customerName || undefined
}

function mapRowByField(
  row: Record<string, unknown>,
  mapping: Record<string, string>
): Record<string, string> {
  const next: Record<string, string> = {}
  for (const [columnName, fieldId] of Object.entries(mapping)) {
    const raw = row[columnName]
    next[fieldId] = asTrimmedString(raw)
  }
  return next
}

function importEntityToDataEntity(entityType: DataImportEntityType): DataEntity {
  switch (entityType) {
    case "accounts":
      return DataEntity.Accounts
    case "contacts":
      return DataEntity.Contacts
    case "opportunity-line-items":
      return DataEntity.OpportunityLineItems
    case "deposit-transactions":
      return DataEntity.DepositTransactions
    case "opportunities":
      return DataEntity.Opportunities
    case "products":
      return DataEntity.Products
    case "revenue-schedules":
      return DataEntity.RevenueSchedules
    default:
      throw new Error(`Unsupported import entity: ${String(entityType)}`)
  }
}

function dataEntityToImportEntity(entity: DataEntity): DataImportEntityType | null {
  switch (entity) {
    case DataEntity.Accounts:
      return "accounts"
    case DataEntity.Contacts:
      return "contacts"
    case DataEntity.OpportunityLineItems:
      return "opportunity-line-items"
    case DataEntity.DepositTransactions:
      return "deposit-transactions"
    case DataEntity.Opportunities:
      return "opportunities"
    case DataEntity.Products:
      return "products"
    case DataEntity.RevenueSchedules:
      return "revenue-schedules"
    default:
      return null
  }
}

function buildStoredErrorRecord(
  rowNumber: number,
  field: string,
  errorType: ImportError["errorType"],
  message: string,
  rawRow: unknown,
  accountName?: string
) {
  return {
    rowNumber,
    fieldName: field,
    message,
    rawData: toJsonValue({
      errorType,
      accountName,
      row: rawRow
    })
  }
}

function readStoredErrorType(rawData: unknown): ImportError["errorType"] {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return "system"
  }
  const errorType = "errorType" in rawData ? (rawData as { errorType?: unknown }).errorType : null
  if (errorType === "validation" || errorType === "business_rule" || errorType === "system") {
    return errorType
  }
  return "system"
}

function readStoredErrorAccountName(rawData: unknown): string | undefined {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return undefined
  }

  const accountName =
    "accountName" in rawData ? (rawData as { accountName?: unknown }).accountName : null
  return asOptionalString(accountName) ?? undefined
}

function normalizePageSize(rawValue: string | null) {
  const parsed = Number(rawValue ?? "")
  if (!Number.isFinite(parsed)) {
    return 8
  }
  return Math.min(25, Math.max(1, Math.floor(parsed)))
}

function getImportUndoOrder(entityName: string) {
  switch (entityName) {
    case "DepositLineItem":
      return 10
    case "Deposit":
      return 20
    case "RevenueSchedule":
      return 30
    case "OpportunityProduct":
      return 40
    case "OpportunityRole":
      return 50
    case "Contact":
      return 60
    case "Product":
      return 70
    case "Account":
      return 80
    case "Address":
      return 90
    default:
      return 100
  }
}

function createdMutation(entityName: string, entityId: string): ImportedRecordMutation {
  return {
    entityName,
    entityId,
    operation: ImportJobRecordOperation.Created,
    undoAction: ImportJobUndoAction.DeleteCreatedRecord,
    undoOrder: getImportUndoOrder(entityName)
  }
}

function updatedMutation(
  entityName: string,
  entityId: string,
  previousValues?: Prisma.InputJsonValue,
  newValues?: Prisma.InputJsonValue
): ImportedRecordMutation {
  return {
    entityName,
    entityId,
    operation: ImportJobRecordOperation.Updated,
    undoAction: ImportJobUndoAction.None,
    undoOrder: getImportUndoOrder(entityName),
    previousValues,
    newValues
  }
}

async function getAccountByName(
  context: ImportContext,
  accountName: string
): Promise<AccountLookup | null> {
  const key = normalizeLookupKey(accountName)
  if (!key) {
    return null
  }
  if (context.accountByNameCache.has(key)) {
    return context.accountByNameCache.get(key) ?? null
  }

  const account = await prisma.account.findFirst({
    where: {
      tenantId: context.tenantId,
      accountName: { equals: accountName.trim(), mode: "insensitive" }
    },
    select: {
      id: true,
      accountName: true,
      salesforceId: true,
      accountTypeId: true,
      accountType: {
        select: {
          name: true,
          isAssignableToContacts: true
        }
      },
      shippingAddressId: true,
      billingAddressId: true,
      shippingAddress: {
        select: {
          line1: true,
          line2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true
        }
      },
      billingAddress: {
        select: {
          line1: true,
          line2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true
        }
      }
    }
  })

  const result = account
    ? {
        id: account.id,
        accountName: account.accountName,
        salesforceId: account.salesforceId,
        accountTypeId: account.accountTypeId,
        accountTypeName: account.accountType?.name ?? null,
        accountTypeAssignableToContacts: account.accountType?.isAssignableToContacts ?? null,
        shippingAddressId: account.shippingAddressId,
        billingAddressId: account.billingAddressId,
        shippingAddressFormatted: formatAddressRecord(account.shippingAddress),
        billingAddressFormatted: formatAddressRecord(account.billingAddress)
      }
    : null
  context.accountByNameCache.set(key, result)
  return result
}

async function getAccountBySalesforceId(
  context: ImportContext,
  salesforceId: string
): Promise<AccountLookup | null> {
  const key = salesforceId.trim()
  if (!key) {
    return null
  }
  if (context.accountBySalesforceIdCache.has(key)) {
    return context.accountBySalesforceIdCache.get(key) ?? null
  }

  const account = await prisma.account.findFirst({
    where: {
      tenantId: context.tenantId,
      salesforceId: key
    },
    select: {
      id: true,
      accountName: true,
      salesforceId: true,
      accountTypeId: true,
      accountType: {
        select: {
          name: true,
          isAssignableToContacts: true
        }
      },
      shippingAddressId: true,
      billingAddressId: true,
      shippingAddress: {
        select: {
          line1: true,
          line2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true
        }
      },
      billingAddress: {
        select: {
          line1: true,
          line2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true
        }
      }
    }
  })

  const result = account
    ? {
        id: account.id,
        accountName: account.accountName,
        salesforceId: account.salesforceId,
        accountTypeId: account.accountTypeId,
        accountTypeName: account.accountType?.name ?? null,
        accountTypeAssignableToContacts: account.accountType?.isAssignableToContacts ?? null,
        shippingAddressId: account.shippingAddressId,
        billingAddressId: account.billingAddressId,
        shippingAddressFormatted: formatAddressRecord(account.shippingAddress),
        billingAddressFormatted: formatAddressRecord(account.billingAddress)
      }
    : null

  context.accountBySalesforceIdCache.set(key, result)
  return result
}

async function getAccountTypeIdByName(context: ImportContext, accountTypeName: string) {
  const key = normalizeLookupKey(accountTypeName)
  if (!key) {
    return null
  }
  if (context.accountTypeIdByNameCache.has(key)) {
    return context.accountTypeIdByNameCache.get(key) ?? null
  }

  const accountType = await prisma.accountType.findFirst({
    where: {
      tenantId: context.tenantId,
      name: { equals: accountTypeName.trim(), mode: "insensitive" }
    },
    select: { id: true }
  })

  const id = accountType?.id ?? null
  context.accountTypeIdByNameCache.set(key, id)
  return id
}

async function getIndustryIdByName(context: ImportContext, industryName: string) {
  const key = normalizeLookupKey(industryName)
  if (!key) {
    return null
  }
  if (context.industryIdByNameCache.has(key)) {
    return context.industryIdByNameCache.get(key) ?? null
  }

  const industry = await prisma.industry.findFirst({
    where: {
      tenantId: context.tenantId,
      name: { equals: industryName.trim(), mode: "insensitive" }
    },
    select: { id: true }
  })

  const id = industry?.id ?? null
  context.industryIdByNameCache.set(key, id)
  return id
}

async function getActiveUserIdByOwnerIdentifier(
  context: ImportContext,
  ownerIdentifier: string
): Promise<{ id: string | null; error?: string }> {
  const trimmedIdentifier = asTrimmedString(ownerIdentifier)
  if (!trimmedIdentifier) {
    return { id: null }
  }
  const key = normalizeLookupKey(trimmedIdentifier)
  if (context.activeUserIdByEmailCache.has(key)) {
    return { id: context.activeUserIdByEmailCache.get(key) ?? null }
  }

  const normalizedEmail = normalizeEmail(trimmedIdentifier)
  const userByEmail = await prisma.user.findFirst({
    where: {
      tenantId: context.tenantId,
      email: { equals: normalizedEmail, mode: "insensitive" },
      status: "Active"
    },
    select: { id: true }
  })

  if (userByEmail) {
    context.activeUserIdByEmailCache.set(key, userByEmail.id)
    return { id: userByEmail.id }
  }

  const usersByFullName = await prisma.user.findMany({
    where: {
      tenantId: context.tenantId,
      fullName: { equals: trimmedIdentifier, mode: "insensitive" },
      status: "Active"
    },
    select: { id: true },
    take: 2
  })

  if (usersByFullName.length > 1) {
    return {
      id: null,
      error: `Owner "${trimmedIdentifier}" matches multiple active users. Use the owner email instead.`
    }
  }

  const id = usersByFullName[0]?.id ?? null
  context.activeUserIdByEmailCache.set(key, id)
  return { id }
}

async function getOpportunityIdByName(
  context: ImportContext,
  opportunityName: string,
  accountId: string
) {
  const key = `${accountId}:${normalizeLookupKey(opportunityName)}`
  if (!key.endsWith(":")) {
    if (context.opportunityIdByNameCache.has(key)) {
      return context.opportunityIdByNameCache.get(key) ?? null
    }
  }

  const opportunity = await prisma.opportunity.findFirst({
    where: {
      tenantId: context.tenantId,
      accountId,
      name: { equals: opportunityName.trim(), mode: "insensitive" }
    },
    select: { id: true }
  })

  const id = opportunity?.id ?? null
  context.opportunityIdByNameCache.set(key, id)
  return id
}

function buildContactMatchKey(
  accountId: string,
  emailAddress: string | null,
  firstName: string,
  lastName: string
) {
  const normalizedEmail = emailAddress ? emailAddress.trim().toLowerCase() : ""
  if (normalizedEmail) {
    return `email:${accountId}:${normalizedEmail}`
  }
  return `name:${accountId}:${normalizeLookupKey(firstName)}:${normalizeLookupKey(lastName)}`
}

async function getContactIdByMatchKey(
  context: ImportContext,
  accountId: string,
  emailAddress: string | null,
  firstName: string,
  lastName: string
) {
  const cacheKey = buildContactMatchKey(accountId, emailAddress, firstName, lastName)
  if (context.contactIdByMatchKeyCache.has(cacheKey)) {
    return context.contactIdByMatchKeyCache.get(cacheKey) ?? null
  }

  const contact = await prisma.contact.findFirst({
    where: {
      tenantId: context.tenantId,
      accountId,
      deletedAt: null,
      ...(emailAddress
        ? { emailAddress: { equals: emailAddress.trim(), mode: "insensitive" } }
        : {
            firstName: { equals: firstName.trim(), mode: "insensitive" },
            lastName: { equals: lastName.trim(), mode: "insensitive" }
          })
    },
    select: { id: true }
  })

  const id = contact?.id ?? null
  context.contactIdByMatchKeyCache.set(cacheKey, id)
  return id
}

async function getOpportunityRoleContactByEmail(
  context: ImportContext,
  accountId: string,
  emailAddress: string
): Promise<OpportunityRoleContactLookup | null> {
  const normalizedEmail = normalizeEmail(emailAddress)
  if (!normalizedEmail) {
    return null
  }

  const contact = await prisma.contact.findFirst({
    where: {
      tenantId: context.tenantId,
      accountId,
      deletedAt: null,
      emailAddress: { equals: normalizedEmail, mode: "insensitive" }
    },
    select: {
      id: true,
      fullName: true,
      jobTitle: true,
      emailAddress: true,
      workPhone: true,
      workPhoneExt: true,
      mobilePhone: true
    }
  })

  if (!contact) {
    return null
  }

  return {
    id: contact.id,
    fullName: contact.fullName,
    jobTitle: contact.jobTitle,
    emailAddress: contact.emailAddress,
    workPhone: contact.workPhone,
    workPhoneExt: contact.workPhoneExt,
    mobilePhone: contact.mobilePhone
  }
}

async function getProductByCode(context: ImportContext, productCode: string): Promise<ProductLookup | null> {
  const key = normalizeLookupKey(productCode)
  if (!key) {
    return null
  }
  if (context.productByCodeCache.has(key)) {
    return context.productByCodeCache.get(key) ?? null
  }

  const product = await prisma.product.findFirst({
    where: {
      tenantId: context.tenantId,
      productCode: { equals: productCode.trim(), mode: "insensitive" }
    },
    select: {
      id: true,
      distributorAccountId: true,
      vendorAccountId: true,
      productCode: true,
      productNameHouse: true,
      productNameVendor: true,
      description: true,
      revenueType: true,
      priceEach: true,
      commissionPercent: true,
      productFamilyHouse: true,
      productSubtypeHouse: true,
      productFamilyVendor: true,
      productSubtypeVendor: true,
      productNameDistributor: true,
      partNumberVendor: true,
      partNumberDistributor: true,
      distributorProductFamily: true,
      distributorProductSubtype: true,
      productDescriptionVendor: true,
      productDescriptionDistributor: true,
      distributor: { select: { accountName: true } },
      vendor: { select: { accountName: true } }
    }
  })

  const result = product
    ? {
        id: product.id,
        distributorAccountId: product.distributorAccountId,
        vendorAccountId: product.vendorAccountId,
        productCode: product.productCode,
        productNameHouse: product.productNameHouse,
        productNameVendor: product.productNameVendor,
        description: product.description,
        revenueType: product.revenueType,
        priceEach: product.priceEach,
        commissionPercent: product.commissionPercent,
        productFamilyHouse: product.productFamilyHouse,
        productSubtypeHouse: product.productSubtypeHouse,
        productFamilyVendor: product.productFamilyVendor,
        productSubtypeVendor: product.productSubtypeVendor,
        productNameDistributor: product.productNameDistributor,
        partNumberVendor: product.partNumberVendor,
        partNumberDistributor: product.partNumberDistributor,
        distributorProductFamily: product.distributorProductFamily,
        distributorProductSubtype: product.distributorProductSubtype,
        productDescriptionVendor: product.productDescriptionVendor,
        productDescriptionDistributor: product.productDescriptionDistributor,
        distributorAccountName: product.distributor?.accountName ?? null,
        vendorAccountName: product.vendor?.accountName ?? null
      }
    : null
  context.productByCodeCache.set(key, result)
  return result
}

async function importOpportunityLineItemRow(
  context: ImportContext,
  values: Record<string, string>,
  options: ImportOptions
): Promise<RowOutcome> {
  const accountName = asTrimmedString(values.accountName)
  const account = await getAccountByName(context, accountName)
  if (!account) {
    return {
      status: "error",
      failure: {
        field: "accountName",
        errorType: "business_rule",
        message: `Account "${accountName}" was not found.`
      }
    }
  }

  const opportunityName = asTrimmedString(values.opportunityName)
  const opportunityId = await getOpportunityIdByName(context, opportunityName, account.id)
  if (!opportunityId) {
    return {
      status: "error",
      failure: {
        field: "opportunityName",
        errorType: "business_rule",
        message: `Opportunity "${opportunityName}" was not found for account "${accountName}".`
      }
    }
  }

  const productCode = asTrimmedString(values.productCode)
  const product = await getProductByCode(context, productCode)
  if (!product) {
    return {
      status: "error",
      failure: {
        field: "productCode",
        errorType: "business_rule",
        message: `Product "${productCode}" was not found.`
      }
    }
  }

  const quantity = parseOptionalNumber(asTrimmedString(values.quantity))
  if (!quantity.valid || quantity.value === null || quantity.value <= 0) {
    return {
      status: "error",
      failure: {
        field: "quantity",
        errorType: "validation",
        message: "Quantity must be a positive number."
      }
    }
  }

  const unitPrice = parseOptionalNumber(asTrimmedString(values.unitPrice))
  if (!unitPrice.valid) {
    return {
      status: "error",
      failure: {
        field: "unitPrice",
        errorType: "validation",
        message: `Unit Price "${values.unitPrice}" is invalid.`
      }
    }
  }

  const expectedUsage = parseOptionalNumber(asTrimmedString(values.expectedUsage))
  if (!expectedUsage.valid) {
    return {
      status: "error",
      failure: {
        field: "expectedUsage",
        errorType: "validation",
        message: `Expected Usage "${values.expectedUsage}" is invalid.`
      }
    }
  }

  const expectedRevenue = parseOptionalNumber(asTrimmedString(values.expectedRevenue))
  if (!expectedRevenue.valid) {
    return {
      status: "error",
      failure: {
        field: "expectedRevenue",
        errorType: "validation",
        message: `Expected Revenue "${values.expectedRevenue}" is invalid.`
      }
    }
  }

  const expectedCommission = parseOptionalNumber(asTrimmedString(values.expectedCommission))
  if (!expectedCommission.valid) {
    return {
      status: "error",
      failure: {
        field: "expectedCommission",
        errorType: "validation",
        message: `Expected Commission "${values.expectedCommission}" is invalid.`
      }
    }
  }

  const subjectMatterExpertPercent = parseOptionalNumber(asTrimmedString(values.subjectMatterExpertPercent))
  if (!subjectMatterExpertPercent.valid) {
    return {
      status: "error",
      failure: {
        field: "subjectMatterExpertPercent",
        errorType: "validation",
        message: `SME % "${values.subjectMatterExpertPercent}" is invalid.`
      }
    }
  }
  if (
    subjectMatterExpertPercent.value !== null &&
    (subjectMatterExpertPercent.value < 0 || subjectMatterExpertPercent.value > 100)
  ) {
    return {
      status: "error",
      failure: {
        field: "subjectMatterExpertPercent",
        errorType: "validation",
        message: "SME % must be between 0 and 100."
      }
    }
  }

  const statusRaw = asTrimmedString(values.status)
  let statusValue: OpportunityProductStatus | undefined
  if (statusRaw) {
    if (!isValidOpportunityProductStatus(statusRaw)) {
      return {
        status: "error",
        failure: {
          field: "status",
          errorType: "validation",
          message: `Status "${statusRaw}" is invalid.`
        }
      }
    }
    statusValue = statusRaw
  }

  const revenueStartDate = parseOptionalDate(asTrimmedString(values.revenueStartDate))
  if (!revenueStartDate.valid) {
    return {
      status: "error",
      failure: {
        field: "revenueStartDate",
        errorType: "validation",
        message: `Revenue Start Date "${values.revenueStartDate}" is invalid.`
      }
    }
  }

  const revenueEndDate = parseOptionalDate(asTrimmedString(values.revenueEndDate))
  if (!revenueEndDate.valid) {
    return {
      status: "error",
      failure: {
        field: "revenueEndDate",
        errorType: "validation",
        message: `Revenue End Date "${values.revenueEndDate}" is invalid.`
      }
    }
  }

  const resolvedExpectedRevenue =
    expectedRevenue.value === null && quantity.value !== null && unitPrice.value !== null
      ? Number((quantity.value * unitPrice.value).toFixed(2))
      : expectedRevenue.value

  let resolvedDistributorAccountId = product.distributorAccountId ?? null
  let resolvedDistributorName = product.distributorAccountName ?? null
  if (!resolvedDistributorAccountId && product.vendorAccountId) {
    if (options.validateOnly) {
      resolvedDistributorAccountId = null
      resolvedDistributorName = NONE_DIRECT_DISTRIBUTOR_NAME
    } else {
      const noneDirect = await ensureNoneDirectDistributorAccount(context.tenantId)
      resolvedDistributorAccountId = noneDirect.id
      resolvedDistributorName = noneDirect.accountName
    }
  }

  if (options.validateOnly) {
    try {
      await prisma.$transaction(async tx => {
        await assertVendorDistributorConsistentForOpportunity(tx, context.tenantId, opportunityId, {
          distributorAccountId: resolvedDistributorAccountId,
          vendorAccountId: product.vendorAccountId ?? null
        })
      })
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        (error as { code?: string }).code === "OPPORTUNITY_VENDOR_DISTRIBUTOR_MISMATCH"
      ) {
        return {
          status: "error",
          failure: {
            field: "productCode",
            errorType: "business_rule",
            message: "Cannot have more than one Distributor/Vendor on the same Opportunity."
          }
        }
      }
      throw error
    }

    return { status: "success" }
  }

  let mutations: ImportedRecordMutation[] = []
  try {
    mutations = await prisma.$transaction(async tx => {
      const mutations: ImportedRecordMutation[] = []
      await assertVendorDistributorConsistentForOpportunity(tx, context.tenantId, opportunityId, {
        distributorAccountId: resolvedDistributorAccountId,
        vendorAccountId: product.vendorAccountId ?? null
      })

      if (!product.distributorAccountId && resolvedDistributorAccountId) {
        await tx.product.update({
          where: { id: product.id },
          data: {
            distributorAccountId: resolvedDistributorAccountId,
            updatedById: context.userId
          }
        })
        mutations.push(updatedMutation("Product", product.id))
      }

      const created = await (tx.opportunityProduct as any).create({
        data: {
          tenantId: context.tenantId,
          opportunityId,
          productId: product.id,
          productCodeSnapshot: product.productCode,
          productNameHouseSnapshot: product.productNameHouse,
          productNameVendorSnapshot: product.productNameVendor,
          revenueTypeSnapshot: product.revenueType,
          priceEachSnapshot: product.priceEach,
          commissionPercentSnapshot: product.commissionPercent,
          subjectMatterExpertPercent: subjectMatterExpertPercent.value,
          distributorNameSnapshot: resolvedDistributorName ?? null,
          vendorNameSnapshot: product.vendorAccountName ?? null,
          distributorAccountIdSnapshot: resolvedDistributorAccountId ?? null,
          vendorAccountIdSnapshot: product.vendorAccountId ?? null,
          descriptionSnapshot: product.description ?? null,
          productFamilyHouseSnapshot: product.productFamilyHouse ?? null,
          productSubtypeHouseSnapshot: product.productSubtypeHouse ?? null,
          productFamilyVendorSnapshot: product.productFamilyVendor ?? null,
          productSubtypeVendorSnapshot: product.productSubtypeVendor ?? null,
          productNameDistributorSnapshot: product.productNameDistributor ?? null,
          partNumberVendorSnapshot: product.partNumberVendor ?? null,
          partNumberDistributorSnapshot: product.partNumberDistributor ?? null,
          distributorProductFamilySnapshot: product.distributorProductFamily ?? null,
          distributorProductSubtypeSnapshot: product.distributorProductSubtype ?? null,
          productDescriptionVendorSnapshot: product.productDescriptionVendor ?? null,
          productDescriptionDistributorSnapshot: product.productDescriptionDistributor ?? null,
          quantity: quantity.value,
          unitPrice: unitPrice.value,
          expectedUsage: expectedUsage.value,
          expectedRevenue: resolvedExpectedRevenue,
          expectedCommission: expectedCommission.value,
          revenueStartDate: revenueStartDate.value,
          revenueEndDate: revenueEndDate.value,
          ...(statusValue ? { status: statusValue } : {})
        },
        select: { id: true }
      })
      mutations.push(createdMutation("OpportunityProduct", created.id))
      return mutations
    })
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      (error as { code?: string }).code === "OPPORTUNITY_VENDOR_DISTRIBUTOR_MISMATCH"
    ) {
      return {
        status: "error",
        failure: {
          field: "productCode",
          errorType: "business_rule",
          message: "Cannot have more than one Distributor/Vendor on the same Opportunity."
        }
      }
    }

    throw error
  }

  try {
    await recalculateOpportunityStage(opportunityId)
  } catch (error) {
    console.error("Failed to recalculate opportunity stage after admin line item import", error)
  }

  return { status: "success", mutations }
}

async function readExistingImportJobResult(
  tenantId: string,
  entityType: DataImportEntityType,
  idempotencyKey: string
): Promise<ImportResult | "processing" | null> {
  const existingJob = await prisma.importJob.findFirst({
    where: {
      tenantId,
      entity: importEntityToDataEntity(entityType),
      idempotencyKey
    },
    select: {
      id: true,
      status: true,
      totalRows: true,
      successCount: true,
      errorCount: true,
      errors: {
        orderBy: [{ rowNumber: "asc" }, { createdAt: "asc" }],
        take: MAX_ERROR_ROWS,
        select: {
          rowNumber: true,
          fieldName: true,
          message: true,
          rawData: true
        }
      }
    }
  })

  if (!existingJob) {
    return null
  }

  if (existingJob.status === JobStatus.Processing || existingJob.status === JobStatus.Pending) {
    return "processing"
  }

  return {
    totalRows: existingJob.totalRows ?? 0,
    successRows: existingJob.successCount ?? 0,
    skippedRows: 0,
    errorRows: existingJob.errorCount ?? 0,
    errors: existingJob.errors.map(error => ({
      rowNumber: error.rowNumber,
      field: error.fieldName ?? "row",
      errorType: readStoredErrorType(error.rawData),
      message: error.message,
      accountName: readStoredErrorAccountName(error.rawData)
    })),
    importJobId: existingJob.id,
    storedErrorCount: existingJob.errors.length
  }
}

async function importAccountRow(
  context: ImportContext,
  values: Record<string, string>,
  options: ImportOptions
): Promise<RowOutcome> {
  const accountName = asTrimmedString(values.accountName)
  const salesforceId = normalizeSalesforceIdInput(values.salesforceId)
  if (salesforceId && !isValidSalesforceId(salesforceId)) {
    return {
      status: "error",
      failure: {
        field: "salesforceId",
        errorType: "validation",
        message: `Salesforce ID "${salesforceId}" is invalid. Use a 15 or 18 character alphanumeric Salesforce ID.`
      }
    }
  }

  const existingBySalesforceId = salesforceId
    ? await getAccountBySalesforceId(context, salesforceId)
    : null
  const existingByName = await getAccountByName(context, accountName)

  if (existingBySalesforceId && existingByName && existingBySalesforceId.id !== existingByName.id) {
    return {
      status: "error",
      failure: {
        field: "salesforceId",
        errorType: "business_rule",
        message:
          `Salesforce ID "${salesforceId}" already belongs to "${existingBySalesforceId.accountName}", but Account Name "${accountName}" matches a different account.`
      }
    }
  }

  const existing = existingBySalesforceId ?? existingByName
  if (existing && !options.upsertExisting) {
    return { status: "skipped" }
  }

  const accountTypeName = asTrimmedString(values.accountTypeName)

  const accountTypeId = await getAccountTypeIdByName(context, accountTypeName)
  if (!accountTypeId) {
    return {
      status: "error",
      failure: {
        field: "accountTypeName",
        errorType: "business_rule",
        message: `Account Type "${accountTypeName}" was not found in Data Settings.`
      }
    }
  }

  const ownerEmail = asTrimmedString(values.ownerEmail)
  let ownerId: string | null = null
  if (ownerEmail) {
    const ownerResolution = await getActiveUserIdByOwnerIdentifier(context, ownerEmail)
    ownerId = ownerResolution.id
    if (!ownerId) {
      return {
        status: "error",
        failure: {
          field: "ownerEmail",
          errorType: "business_rule",
          message:
            ownerResolution.error ??
            `Owner "${ownerEmail}" was not found as an active user by email or full name.`
        }
      }
    }
  }

  const parentAccountName = asTrimmedString(values.parentAccountName)
  let parentAccountId: string | null = null
  if (parentAccountName) {
    const parent = await getAccountByName(context, parentAccountName)
    if (!parent) {
      if (options.validateOnly && context.accountImportNames.has(normalizeLookupKey(parentAccountName))) {
        parentAccountId = null
      } else {
        return {
          status: "error",
          failure: {
            field: "parentAccountName",
            errorType: "business_rule",
            message: `Parent Account "${parentAccountName}" was not found.`
          }
        }
      }
    } else {
      parentAccountId = parent.id
    }
  }

  const industryName = asTrimmedString(values.industryName)
  let industryId: string | null = null
  if (industryName) {
    industryId = await getIndustryIdByName(context, industryName)
    if (!industryId) {
      return {
        status: "error",
        failure: {
          field: "industryName",
          errorType: "business_rule",
          message: `Industry "${industryName}" was not found.`
        }
      }
    }
  }

  const statusRaw = asTrimmedString(values.status)
  const parsedStatus = statusRaw ? resolveEnumValue(ACCOUNT_STATUS_LOOKUP, statusRaw) : null
  if (statusRaw && !parsedStatus) {
    return {
      status: "error",
      failure: {
        field: "status",
        errorType: "validation",
        message: `Status "${statusRaw}" is invalid.`
      }
    }
  }

  const billingSameAsShipping = parseOptionalBoolean(asTrimmedString(values.billingSameAsShipping))
  if (!billingSameAsShipping.valid) {
    return {
      status: "error",
      failure: {
        field: "billingSameAsShipping",
        errorType: "validation",
        message: `Billing Same As Shipping "${values.billingSameAsShipping}" is invalid. Use true/false.`
      }
    }
  }

  const shippingAddress = buildStructuredAddressInput(values, "shipping")
  if (shippingAddress.error) {
    return {
      status: "error",
      failure: {
        field: "shippingStreet",
        errorType: "validation",
        message: shippingAddress.error
      }
    }
  }

  const billingAddress = buildStructuredAddressInput(values, "billing")
  if (billingAddress.error) {
    return {
      status: "error",
      failure: {
        field: "billingStreet",
        errorType: "validation",
        message: billingAddress.error
      }
    }
  }

  const payload = {
    accountName,
    accountNumber: asOptionalString(values.accountNumber),
    accountTypeId,
    accountLegalName: asOptionalString(values.accountLegalName),
    websiteUrl: asOptionalString(values.websiteUrl),
    description: asOptionalString(values.description),
    parentAccountId,
    ownerId,
    industryId,
    status: parsedStatus ?? AccountStatus.Active,
    updatedById: context.userId
  }
  if (salesforceId) {
    Object.assign(payload, { salesforceId })
  }

  const shouldManageAddresses =
    billingSameAsShipping.value !== null || shippingAddress.provided || billingAddress.provided
  const existingSyncBilling = existing
    ? existing.shippingAddressId !== null && existing.shippingAddressId === existing.billingAddressId
    : false

  if (options.validateOnly) {
    return { status: "success" }
  }

  const mutations = await prisma.$transaction(async tx => {
    const mutations: ImportedRecordMutation[] = []
    let shippingAddressId = existing?.shippingAddressId ?? null
    let billingAddressId = existing?.billingAddressId ?? null
    let shippingSyncBilling = billingSameAsShipping.value ?? existingSyncBilling

    if (shouldManageAddresses) {
      shippingSyncBilling = billingSameAsShipping.value ?? existingSyncBilling

      if (shippingAddress.input) {
        const savedAddress = await saveAddressInput(
          tx,
          context.tenantId,
          existing?.shippingAddressId ?? null,
          shippingAddress.input
        )
        shippingAddressId = savedAddress.id
        if (savedAddress.created) {
          mutations.push(createdMutation("Address", savedAddress.id))
        }
      }

      if (shippingSyncBilling) {
        billingAddressId = shippingAddressId
      } else if (billingAddress.input) {
        const savedAddress = await saveAddressInput(
          tx,
          context.tenantId,
          existing?.billingAddressId ?? null,
          billingAddress.input
        )
        billingAddressId = savedAddress.id
        if (savedAddress.created) {
          mutations.push(createdMutation("Address", savedAddress.id))
        }
      }
    }

    const data = shouldManageAddresses
      ? {
          ...payload,
          shippingAddressId,
          billingAddressId,
          shippingSyncBilling
        }
      : payload

    if (existing) {
      await tx.account.update({
        where: { id: existing.id },
        data
      })
      mutations.push(updatedMutation("Account", existing.id))
      return mutations
    }

    const created = await tx.account.create({
      data: {
        tenantId: context.tenantId,
        ...data,
        createdById: context.userId
      },
      select: { id: true }
    })
    mutations.push(createdMutation("Account", created.id))
    return mutations
  })

  context.accountByNameCache.delete(normalizeLookupKey(accountName))
  if (salesforceId) {
    context.accountBySalesforceIdCache.delete(salesforceId)
  }
  return { status: "success", mutations }
}

async function importContactRow(
  context: ImportContext,
  values: Record<string, string>,
  options: ImportOptions
): Promise<RowOutcome> {
  const accountName = asTrimmedString(values.accountName)
  const firstName = asTrimmedString(values.firstName)
  const lastName = asTrimmedString(values.lastName)

  const account = await getAccountByName(context, accountName)
  if (!account) {
    return {
      status: "error",
      failure: {
        field: "accountName",
        errorType: "business_rule",
        message: `Account "${accountName}" was not found.`
      }
    }
  }

  if (account.accountTypeAssignableToContacts === false) {
    return {
      status: "error",
      failure: {
        field: "accountName",
        errorType: "business_rule",
        message: `Account "${accountName}" has an account type that cannot be assigned to contacts.`
      }
    }
  }

  const emailAddress = asOptionalString(values.emailAddress)
  const normalizedEmail = emailAddress ? normalizeEmail(emailAddress) : null

  const existingId = await getContactIdByMatchKey(
    context,
    account.id,
    normalizedEmail,
    firstName,
    lastName
  )

  if (existingId && !options.upsertExisting) {
    return { status: "skipped" }
  }

  if (!account.accountTypeId) {
    return {
      status: "error",
      failure: {
        field: "accountName",
        errorType: "business_rule",
        message: `Account "${accountName}" does not have an account type configured.`
      }
    }
  }

  const ownerEmail = asTrimmedString(values.ownerEmail)
  let ownerId: string | null = null
  if (ownerEmail) {
    const ownerResolution = await getActiveUserIdByOwnerIdentifier(context, ownerEmail)
    ownerId = ownerResolution.id
    if (!ownerId) {
      return {
        status: "error",
        failure: {
          field: "ownerEmail",
          errorType: "business_rule",
          message:
            ownerResolution.error ??
            `Owner "${ownerEmail}" was not found as an active user by email or full name.`
        }
      }
    }
  }

  const preferredContactMethodRaw = asTrimmedString(values.preferredContactMethod)
  const preferredContactMethod = preferredContactMethodRaw
    ? resolveEnumValue(CONTACT_METHOD_LOOKUP, preferredContactMethodRaw)
    : null
  if (preferredContactMethodRaw && !preferredContactMethod) {
    return {
      status: "error",
      failure: {
        field: "preferredContactMethod",
        errorType: "validation",
        message: `Preferred Contact Method "${preferredContactMethodRaw}" is invalid.`
      }
    }
  }

  const isPrimary = parseOptionalBoolean(asTrimmedString(values.isPrimary))
  if (!isPrimary.valid) {
    return {
      status: "error",
      failure: {
        field: "isPrimary",
        errorType: "validation",
        message: `Is Primary "${values.isPrimary}" is invalid. Use true/false.`
      }
    }
  }

  const isDecisionMaker = parseOptionalBoolean(asTrimmedString(values.isDecisionMaker))
  if (!isDecisionMaker.valid) {
    return {
      status: "error",
      failure: {
        field: "isDecisionMaker",
        errorType: "validation",
        message: `Is Decision Maker "${values.isDecisionMaker}" is invalid. Use true/false.`
      }
    }
  }

  const payload = {
    accountId: account.id,
    accountTypeId: account.accountTypeId,
    contactType: account.accountTypeName,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    suffix: asOptionalString(values.suffix),
    jobTitle: asOptionalString(values.jobTitle),
    workPhone: asOptionalString(values.workPhone) ? formatPhoneNumber(values.workPhone) : null,
    workPhoneExt: normalizePhoneExtension(values.workPhoneExt),
    mobilePhone: asOptionalString(values.mobilePhone) ? formatPhoneNumber(values.mobilePhone) : null,
    emailAddress: normalizedEmail,
    ownerId,
    isPrimary: isPrimary.value ?? false,
    isDecisionMaker: isDecisionMaker.value ?? false,
    preferredContactMethod: preferredContactMethod ?? ContactMethod.Email,
    description: asOptionalString(values.description),
    updatedById: context.userId
  }

  if (options.validateOnly) {
    return { status: "success" }
  }

  if (existingId) {
    await prisma.contact.update({
      where: { id: existingId },
      data: payload
    })
    context.contactIdByMatchKeyCache.delete(
      buildContactMatchKey(account.id, normalizedEmail, firstName, lastName)
    )
    return { status: "success", mutations: [updatedMutation("Contact", existingId)] }
  } else {
    const created = await prisma.contact.create({
      data: {
        tenantId: context.tenantId,
        ...payload,
        createdById: context.userId
      },
      select: { id: true }
    })
    context.contactIdByMatchKeyCache.delete(
      buildContactMatchKey(account.id, normalizedEmail, firstName, lastName)
    )
    return { status: "success", mutations: [createdMutation("Contact", created.id)] }
  }
}

async function importOpportunityRow(
  context: ImportContext,
  values: Record<string, string>,
  options: ImportOptions
): Promise<RowOutcome> {
  const accountName = asTrimmedString(values.accountName)
  const name = asTrimmedString(values.name)

  const account = await getAccountByName(context, accountName)
  if (!account) {
    return {
      status: "error",
      failure: {
        field: "accountName",
        errorType: "business_rule",
        message: `Account "${accountName}" was not found.`
      }
    }
  }

  const existingId = await getOpportunityIdByName(context, name, account.id)
  if (existingId && !options.upsertExisting) {
    return { status: "skipped" }
  }

  if (isHouseAccountType(account.accountTypeName)) {
    return {
      status: "error",
      failure: {
        field: "accountName",
        errorType: "business_rule",
        message: `Account "${accountName}" is a House account. Opportunities cannot be created or updated for House accounts.`
      }
    }
  }

  const roleName = asTrimmedString(values.roleName)
  const roleContactEmailInput = asTrimmedString(values.roleContactEmail)
  const normalizedRoleContactEmail = roleContactEmailInput ? normalizeEmail(roleContactEmailInput) : null

  if (roleContactEmailInput && !normalizedRoleContactEmail) {
    return {
      status: "error",
      failure: {
        field: "roleContactEmail",
        errorType: "validation",
        message: `Role Contact Email "${values.roleContactEmail}" is invalid.`
      }
    }
  }

  const roleContact = normalizedRoleContactEmail
    ? await getOpportunityRoleContactByEmail(
        context,
        account.id,
        normalizedRoleContactEmail
      )
    : null

  const snapshotRoleContactName = asTrimmedString(values.roleContactName)
  const roleFullName = roleContact?.fullName.trim() || snapshotRoleContactName
  if (!roleFullName) {
    return {
      status: "error",
      failure: {
        field: "roleContactName",
        errorType: "validation",
        message:
          "Role Contact Name is required when Role Contact Email is blank or does not match an existing contact for the account."
      }
    }
  }

  const snapshotRoleContactTitle = asOptionalString(values.roleContactTitle)
  const snapshotRoleContactPhone = asOptionalString(values.roleContactPhone)
    ? formatPhoneNumber(values.roleContactPhone)
    : null
  const snapshotRoleContactPhoneExt = normalizePhoneExtension(values.roleContactPhoneExt)

  const ownerEmail = asTrimmedString(values.ownerEmail)
  let ownerId = context.userId
  if (ownerEmail) {
    const ownerResolution = await getActiveUserIdByOwnerIdentifier(context, ownerEmail)
    const userId = ownerResolution.id
    if (!userId) {
      return {
        status: "error",
        failure: {
          field: "ownerEmail",
          errorType: "business_rule",
          message:
            ownerResolution.error ??
            `Owner "${ownerEmail}" was not found as an active user by email or full name.`
        }
      }
    }
    ownerId = userId
  }

  const stageRaw = asTrimmedString(values.stage)
  const stage = stageRaw ? resolveOpportunityStageValue(stageRaw) : null
  if (stageRaw && !stage) {
    return {
      status: "error",
      failure: {
        field: "stage",
        errorType: "validation",
        message: `Stage "${stageRaw}" is invalid. Accepted values: ${OPPORTUNITY_STAGE_OPTIONS_FOR_ERROR.join(", ")}.`
      }
    }
  }

  const leadSourceRaw = asTrimmedString(values.leadSource)
  const leadSource = leadSourceRaw ? resolveEnumValue(LEAD_SOURCE_LOOKUP, leadSourceRaw) : null
  if (leadSourceRaw && !leadSource) {
    return {
      status: "error",
      failure: {
        field: "leadSource",
        errorType: "validation",
        message: `Lead Source "${leadSourceRaw}" is invalid.`
      }
    }
  }

  const estimatedCloseDate = parseOptionalDate(asTrimmedString(values.estimatedCloseDate))
  if (!estimatedCloseDate.valid) {
    return {
      status: "error",
      failure: {
        field: "estimatedCloseDate",
        errorType: "validation",
        message: `Estimated Close Date "${values.estimatedCloseDate}" is invalid.`
      }
    }
  }

  const amount = parseOptionalNumber(asTrimmedString(values.amount))
  if (!amount.valid) {
    return {
      status: "error",
      failure: {
        field: "amount",
        errorType: "validation",
        message: `Amount "${values.amount}" is invalid.`
      }
    }
  }

  const expectedCommission = parseOptionalNumber(asTrimmedString(values.expectedCommission))
  if (!expectedCommission.valid) {
    return {
      status: "error",
      failure: {
        field: "expectedCommission",
        errorType: "validation",
        message: `Expected Commission "${values.expectedCommission}" is invalid.`
      }
    }
  }

  const subAgent = asOptionalString(values.subAgent)

  const subagentPercent = parseOptionalNumber(asTrimmedString(values.subagentPercent))
  if (!subagentPercent.valid) {
    return {
      status: "error",
      failure: {
        field: "subagentPercent",
        errorType: "validation",
        message: `Subagent Percent "${values.subagentPercent}" is invalid.`
      }
    }
  }

  if (!subAgent) {
    if ((subagentPercent.value ?? 0) > 0) {
      return {
        status: "error",
        failure: {
          field: "subAgent",
          errorType: "business_rule",
          message: "Subagent must be provided when Subagent Percent is greater than 0."
        }
      }
    }
  } else {
    if (subagentPercent.value === null) {
      return {
        status: "error",
        failure: {
          field: "subagentPercent",
          errorType: "validation",
          message: "Subagent Percent is required when Subagent is provided."
        }
      }
    }

    if (subagentPercent.value < 0.01 || subagentPercent.value > 99.99) {
      return {
        status: "error",
        failure: {
          field: "subagentPercent",
          errorType: "validation",
          message: "Subagent Percent must be between 0.01 and 99.99."
        }
      }
    }
  }

  const houseRepPercent = parseOptionalNumber(asTrimmedString(values.houseRepPercent))
  if (!houseRepPercent.valid) {
    return {
      status: "error",
      failure: {
        field: "houseRepPercent",
        errorType: "validation",
        message: `House Rep Percent "${values.houseRepPercent}" is invalid.`
      }
    }
  }
  if (
    houseRepPercent.value !== null &&
    (houseRepPercent.value < 0 || houseRepPercent.value > 100)
  ) {
    return {
      status: "error",
      failure: {
        field: "houseRepPercent",
        errorType: "validation",
        message: "House Rep Percent must be between 0 and 100."
      }
    }
  }

  const houseSplitPercent = parseOptionalNumber(asTrimmedString(values.houseSplitPercent))
  if (!houseSplitPercent.valid) {
    return {
      status: "error",
      failure: {
        field: "houseSplitPercent",
        errorType: "validation",
        message: `House Split Percent "${values.houseSplitPercent}" is invalid.`
      }
    }
  }
  if (
    houseSplitPercent.value !== null &&
    (houseSplitPercent.value < 0 || houseSplitPercent.value > 100)
  ) {
    return {
      status: "error",
      failure: {
        field: "houseSplitPercent",
        errorType: "validation",
        message: "House Split Percent must be between 0 and 100."
      }
    }
  }

  const referredBy = asOptionalString(values.referredBy)
  let shippingAddress = asOptionalString(values.shippingAddress) ?? account.shippingAddressFormatted
  let billingAddress = asOptionalString(values.billingAddress) ?? account.billingAddressFormatted

  const accountIdVendor = canonicalizeMultiValueString(asOptionalString(values.accountIdVendor), {
    kind: "id"
  })
  const customerIdVendor = canonicalizeMultiValueString(asOptionalString(values.customerIdVendor), {
    kind: "id"
  })
  const orderIdVendor = canonicalizeMultiValueString(asOptionalString(values.orderIdVendor), {
    kind: "id"
  })

  let finalDescription = asOptionalString(values.description)
  if (subAgent) {
    finalDescription = finalDescription
      ? `Subagent: ${subAgent}\n\n${finalDescription}`
      : `Subagent: ${subAgent}`
  }

  let effectiveHouseSplitPercent = houseSplitPercent.value
  if (
    effectiveHouseSplitPercent === null &&
    subagentPercent.value !== null &&
    houseRepPercent.value !== null
  ) {
    const computed = 100 - (subagentPercent.value + houseRepPercent.value)
    effectiveHouseSplitPercent = computed >= 0 ? computed : 0
  }

  const payload = {
    accountId: account.id,
    ownerId,
    name,
    stage: stage ?? OpportunityStage.Qualification,
    leadSource: leadSource ?? LeadSource.Referral,
    estimatedCloseDate: estimatedCloseDate.value,
    amount: amount.value,
    expectedCommission: expectedCommission.value,
    description: finalDescription,
    referredBy,
    shippingAddress,
    billingAddress,
    subagentPercent: subagentPercent.value,
    houseRepPercent: houseRepPercent.value,
    houseSplitPercent: effectiveHouseSplitPercent,
    accountIdHouse: asOptionalString(values.accountIdHouse),
    accountIdVendor,
    accountIdDistributor: asOptionalString(values.accountIdDistributor),
    customerIdHouse: asOptionalString(values.customerIdHouse),
    customerIdVendor,
    customerIdDistributor: asOptionalString(values.customerIdDistributor),
    locationId: asOptionalString(values.locationId),
    orderIdHouse: asOptionalString(values.orderIdHouse),
    orderIdVendor,
    orderIdDistributor: asOptionalString(values.orderIdDistributor),
    customerPurchaseOrder: asOptionalString(values.customerPurchaseOrder),
    updatedById: context.userId
  }

  if (options.validateOnly) {
    return { status: "success" }
  }

  const mutations = await prisma.$transaction(async tx => {
    const mutations: ImportedRecordMutation[] = []
    const opportunity = existingId
      ? await tx.opportunity.update({
          where: { id: existingId },
          data: payload,
          select: { id: true }
        })
      : await tx.opportunity.create({
          data: {
            tenantId: context.tenantId,
            ...payload,
            createdById: context.userId
          },
          select: { id: true }
        })

    mutations.push(
      existingId
        ? updatedMutation("Opportunity", opportunity.id)
        : createdMutation("Opportunity", opportunity.id)
    )

    const rolePayload = {
      contactId: roleContact?.id ?? null,
      role: roleName,
      fullName: roleFullName,
      jobTitle: roleContact?.jobTitle ?? snapshotRoleContactTitle,
      email: roleContact?.emailAddress ?? normalizedRoleContactEmail,
      workPhone: roleContact?.workPhone ?? snapshotRoleContactPhone,
      phoneExtension: roleContact?.workPhoneExt ?? snapshotRoleContactPhoneExt,
      mobile: roleContact?.mobilePhone ?? null,
      active: true,
      updatedById: context.userId
    }

    const existingRole = await tx.opportunityRole.findFirst({
      where: {
        tenantId: context.tenantId,
        opportunityId: opportunity.id,
        role: { equals: roleName, mode: "insensitive" },
        active: true,
        ...(roleContact
          ? { contactId: roleContact.id }
          : rolePayload.email
            ? {
                contactId: null,
                email: { equals: rolePayload.email, mode: "insensitive" }
              }
            : {
                contactId: null,
                fullName: { equals: roleFullName, mode: "insensitive" }
              })
      },
      select: { id: true }
    })

    if (existingRole) {
      await tx.opportunityRole.update({
        where: { id: existingRole.id },
        data: rolePayload
      })
      mutations.push(updatedMutation("OpportunityRole", existingRole.id))
      return mutations
    }

    const createdRole = await tx.opportunityRole.create({
      data: {
        tenantId: context.tenantId,
        opportunityId: opportunity.id,
        createdById: context.userId,
        ...rolePayload
      },
      select: { id: true }
    })
    mutations.push(createdMutation("OpportunityRole", createdRole.id))
    return mutations
  })

  context.opportunityIdByNameCache.delete(`${account.id}:${normalizeLookupKey(name)}`)
  return { status: "success", mutations }
}

async function importRevenueScheduleRow(
  context: ImportContext,
  values: Record<string, string>,
  options: ImportOptions
): Promise<RowOutcome> {
  const accountName = asTrimmedString(values.accountName)
  const account = await getAccountByName(context, accountName)
  if (!account) {
    return {
      status: "error",
      failure: {
        field: "accountName",
        errorType: "business_rule",
        message: `Account "${accountName}" was not found.`
      }
    }
  }

  const scheduleDate = parseOptionalDate(asTrimmedString(values.scheduleDate))
  if (!scheduleDate.valid) {
    return {
      status: "error",
      failure: {
        field: "scheduleDate",
        errorType: "validation",
        message: `Schedule Date "${values.scheduleDate}" is invalid.`
      }
    }
  }

  const scheduleTypeRaw = asTrimmedString(values.scheduleType)
  const scheduleType = scheduleTypeRaw
    ? resolveEnumValue(REVENUE_SCHEDULE_TYPE_LOOKUP, scheduleTypeRaw)
    : null
  if (scheduleTypeRaw && !scheduleType) {
    return {
      status: "error",
      failure: {
        field: "scheduleType",
        errorType: "validation",
        message: `Schedule Type "${scheduleTypeRaw}" is invalid.`
      }
    }
  }

  const opportunityName = asTrimmedString(values.opportunityName)
  let opportunityId: string | null = null
  if (opportunityName) {
    opportunityId = await getOpportunityIdByName(context, opportunityName, account.id)
    if (!opportunityId) {
      return {
        status: "error",
        failure: {
          field: "opportunityName",
          errorType: "business_rule",
          message: `Opportunity "${opportunityName}" was not found for account "${accountName}".`
        }
      }
    }
  }

  const productCode = asTrimmedString(values.productCode)
  let product: ProductLookup | null = null
  if (productCode) {
    product = await getProductByCode(context, productCode)
    if (!product) {
      return {
        status: "error",
        failure: {
          field: "productCode",
          errorType: "business_rule",
          message: `Product "${productCode}" was not found.`
        }
      }
    }
  }

  const expectedUsage = parseOptionalNumber(asTrimmedString(values.expectedUsage))
  if (!expectedUsage.valid) {
    return {
      status: "error",
      failure: {
        field: "expectedUsage",
        errorType: "validation",
        message: `Expected Usage "${values.expectedUsage}" is invalid.`
      }
    }
  }

  const actualUsage = parseOptionalNumber(asTrimmedString(values.actualUsage))
  if (!actualUsage.valid) {
    return {
      status: "error",
      failure: {
        field: "actualUsage",
        errorType: "validation",
        message: `Actual Usage "${values.actualUsage}" is invalid.`
      }
    }
  }

  const expectedCommission = parseOptionalNumber(asTrimmedString(values.expectedCommission))
  if (!expectedCommission.valid) {
    return {
      status: "error",
      failure: {
        field: "expectedCommission",
        errorType: "validation",
        message: `Expected Commission "${values.expectedCommission}" is invalid.`
      }
    }
  }

  const actualCommission = parseOptionalNumber(asTrimmedString(values.actualCommission))
  if (!actualCommission.valid) {
    return {
      status: "error",
      failure: {
        field: "actualCommission",
        errorType: "validation",
        message: `Actual Commission "${values.actualCommission}" is invalid.`
      }
    }
  }

  if (options.validateOnly) {
    return { status: "success" }
  }

  const created = await prisma.revenueSchedule.create({
    data: {
      tenantId: context.tenantId,
      accountId: account.id,
      opportunityId,
      productId: product?.id ?? null,
      distributorAccountId: product?.distributorAccountId ?? null,
      vendorAccountId: product?.vendorAccountId ?? null,
      scheduleDate: scheduleDate.value,
      scheduleType: scheduleType ?? RevenueScheduleType.Recurring,
      expectedUsage: expectedUsage.value,
      actualUsage: actualUsage.value,
      expectedCommission: expectedCommission.value,
      actualCommission: actualCommission.value,
      orderIdHouse: asOptionalString(values.orderIdHouse),
      distributorOrderId: asOptionalString(values.distributorOrderId),
      notes: asOptionalString(values.notes),
      createdById: context.userId,
      updatedById: context.userId
    },
    select: { id: true }
  })

  return { status: "success", mutations: [createdMutation("RevenueSchedule", created.id)] }
}

async function importProductRow(
  context: ImportContext,
  values: Record<string, string>,
  options: ImportOptions
): Promise<RowOutcome> {
  const productCode = asTrimmedString(values.productCode)
  const existing = await getProductByCode(context, productCode)
  if (existing && !options.upsertExisting) {
    return { status: "skipped" }
  }

  const productNameHouse = asTrimmedString(values.productNameHouse)
  const revenueTypeInput = asTrimmedString(values.revenueType)
  const normalizedRevenueType = normalizeLookupKey(revenueTypeInput)

  const resolvedRevenueType =
    context.enabledRevenueTypeCodeByNormalizedCode.get(normalizedRevenueType) ??
    context.enabledRevenueTypeCodeByNormalizedLabel.get(normalizedRevenueType) ??
    null

  if (!resolvedRevenueType) {
    return {
      status: "error",
      failure: {
        field: "revenueType",
        errorType: "business_rule",
        message: `Revenue Type "${revenueTypeInput}" is not enabled in Data Settings.`
      }
    }
  }

  const priceEach = parseOptionalNumber(asTrimmedString(values.priceEach))
  if (!priceEach.valid) {
    return {
      status: "error",
      failure: {
        field: "priceEach",
        errorType: "validation",
        message: `Price Each "${values.priceEach}" is invalid.`
      }
    }
  }

  const commissionPercent = parseOptionalNumber(asTrimmedString(values.commissionPercent))
  if (!commissionPercent.valid) {
    return {
      status: "error",
      failure: {
        field: "commissionPercent",
        errorType: "validation",
        message: `Commission Percent "${values.commissionPercent}" is invalid.`
      }
    }
  }
  if (
    commissionPercent.value !== null &&
    (commissionPercent.value < 0 || commissionPercent.value > 100)
  ) {
    return {
      status: "error",
      failure: {
        field: "commissionPercent",
        errorType: "validation",
        message: "Commission Percent must be between 0 and 100."
      }
    }
  }

  const productFamilyHouse = asOptionalString(values.productFamilyHouse)
  const productSubtypeHouse = asOptionalString(values.productSubtypeHouse)
  const productFamilyVendor = asOptionalString(values.productFamilyVendor)
  const productSubtypeVendor = asOptionalString(values.productSubtypeVendor)
  const distributorProductFamily = asOptionalString(values.distributorProductFamily)
  const distributorProductSubtype = asOptionalString(values.distributorProductSubtype)

  const hasPicklistValues = Boolean(
    productFamilyHouse ||
      productSubtypeHouse ||
      productFamilyVendor ||
      productSubtypeVendor ||
      distributorProductFamily ||
      distributorProductSubtype
  )

  if (hasPicklistValues) {
    const [families, subtypes] = await Promise.all([
      prisma.productFamily.findMany({
        where: { tenantId: context.tenantId, isActive: true },
        select: { id: true, name: true }
      }),
      prisma.productSubtype.findMany({
        where: { tenantId: context.tenantId, isActive: true },
        select: {
          name: true,
          productFamilyId: true
        }
      })
    ])

    const familyIdByName = new Map(families.map(family => [family.name, family.id] as const))
    const subtypeByName = new Map(
      subtypes.map(subtype => [
        subtype.name,
        { productFamilyId: subtype.productFamilyId }
      ] as const)
    )

    const validateFamily = (field: string, value: string | null): RowOutcome | null => {
      if (!value) return null
      if (familyIdByName.has(value)) return null
      return {
        status: "error",
        failure: {
          field,
          errorType: "business_rule",
          message: `Value "${value}" is not an active Product Family in Data Settings.`
        }
      }
    }

    const validateSubtype = (
      subtypeField: string,
      subtypeValue: string | null,
      familyField: string,
      familyValue: string | null
    ): RowOutcome | null => {
      if (!subtypeValue) return null
      const subtype = subtypeByName.get(subtypeValue)
      if (!subtype) {
        return {
          status: "error",
          failure: {
            field: subtypeField,
            errorType: "business_rule",
            message: `Value "${subtypeValue}" is not an active Product Subtype in Data Settings.`
          }
        }
      }
      if (!familyValue) return null
      const familyId = familyIdByName.get(familyValue) ?? null
      if (subtype.productFamilyId && familyId && subtype.productFamilyId !== familyId) {
        return {
          status: "error",
          failure: {
            field: subtypeField,
            errorType: "business_rule",
            message: `${subtypeField} does not belong to the selected ${familyField}.`
          }
        }
      }
      return null
    }

    const familyValidation =
      validateFamily("productFamilyHouse", productFamilyHouse) ??
      validateFamily("productFamilyVendor", productFamilyVendor) ??
      validateFamily("distributorProductFamily", distributorProductFamily)
    if (familyValidation) {
      return familyValidation
    }

    const subtypeValidation =
      validateSubtype("productSubtypeHouse", productSubtypeHouse, "productFamilyHouse", productFamilyHouse) ??
      validateSubtype("productSubtypeVendor", productSubtypeVendor, "productFamilyVendor", productFamilyVendor) ??
      validateSubtype(
        "distributorProductSubtype",
        distributorProductSubtype,
        "distributorProductFamily",
        distributorProductFamily
      )
    if (subtypeValidation) {
      return subtypeValidation
    }
  }

  const activeValue = parseOptionalBoolean(asTrimmedString(values.isActive))
  if (!activeValue.valid) {
    return {
      status: "error",
      failure: {
        field: "isActive",
        errorType: "validation",
        message: `Is Active "${values.isActive}" is invalid. Use true/false.`
      }
    }
  }

  const vendorAccountName = asTrimmedString(values.vendorAccountName)
  let vendorAccountId: string | null = null
  if (vendorAccountName) {
    const vendor = await getAccountByName(context, vendorAccountName)
    if (!vendor) {
      return {
        status: "error",
        failure: {
          field: "vendorAccountName",
          errorType: "business_rule",
          message: `Vendor Account "${vendorAccountName}" was not found.`
        }
      }
    }
    vendorAccountId = vendor.id
  }

  const distributorAccountName = asTrimmedString(values.distributorAccountName)
  let distributorAccountId: string | null = null
  if (distributorAccountName) {
    const distributor = await getAccountByName(context, distributorAccountName)
    if (!distributor) {
      return {
        status: "error",
        failure: {
          field: "distributorAccountName",
          errorType: "business_rule",
          message: `Distributor Account "${distributorAccountName}" was not found.`
        }
      }
    }
    distributorAccountId = distributor.id
  } else if (vendorAccountId) {
    if (options.validateOnly) {
      distributorAccountId = null
    } else {
      const noneDirect = await ensureNoneDirectDistributorAccount(context.tenantId)
      distributorAccountId = noneDirect.id
    }
  }

  const payload = {
    productCode,
    productNameHouse,
    revenueType: resolvedRevenueType,
    productNameVendor: canonicalizeMultiValueString(asOptionalString(values.productNameVendor), {
      kind: "text"
    }),
    productNameDistributor: asOptionalString(values.productNameDistributor),
    description: asOptionalString(values.description),
    productDescriptionVendor: asOptionalString(values.productDescriptionVendor),
    priceEach: priceEach.value,
    commissionPercent: commissionPercent.value,
    isActive: activeValue.value ?? true,
    partNumberHouse: asOptionalString(values.partNumberHouse),
    partNumberVendor: canonicalizeMultiValueString(asOptionalString(values.partNumberVendor), {
      kind: "id"
    }),
    vendorAccountId,
    distributorAccountId,
    productFamilyHouse,
    productSubtypeHouse,
    productFamilyVendor,
    productSubtypeVendor,
    distributorProductFamily,
    distributorProductSubtype,
    updatedById: context.userId
  }

  if (options.validateOnly) {
    return { status: "success" }
  }

  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: payload
    })
    context.productByCodeCache.delete(normalizeLookupKey(productCode))
    return { status: "success", mutations: [updatedMutation("Product", existing.id)] }
  } else {
    const created = await prisma.product.create({
      data: {
        tenantId: context.tenantId,
        ...payload,
        createdById: context.userId
      },
      select: { id: true }
    })
    context.productByCodeCache.delete(normalizeLookupKey(productCode))
    return { status: "success", mutations: [createdMutation("Product", created.id)] }
  }
}

async function processRowByEntity(
  entityType: DataImportEntityType,
  context: ImportContext,
  values: Record<string, string>,
  options: ImportOptions
) {
  switch (entityType) {
    case "accounts":
      return importAccountRow(context, values, options)
    case "contacts":
      return importContactRow(context, values, options)
    case "opportunity-line-items":
      return importOpportunityLineItemRow(context, values, options)
    case "deposit-transactions":
      if (!context.depositTransactionState) {
        return {
          status: "error",
          failure: {
            field: "entityOptions",
            errorType: "validation",
            message: "Deposit transaction import is missing request configuration."
          }
        } satisfies RowOutcome
      }
      return importDepositTransactionRow({
        tenantId: context.tenantId,
        userId: context.userId,
        state: context.depositTransactionState,
        validateOnly: options.validateOnly,
        values,
        resolveAccountByName: async accountName => {
          const account = await getAccountByName(context, accountName)
          return account ? { id: account.id } : null
        }
      })
    case "opportunities":
      return importOpportunityRow(context, values, options)
    case "revenue-schedules":
      return importRevenueScheduleRow(context, values, options)
    case "products":
      return importProductRow(context, values, options)
    default:
      return {
        status: "error",
        failure: {
          field: "entityType",
          errorType: "validation",
          message: "Unsupported entity type."
        }
      } satisfies RowOutcome
  }
}

export async function GET(request: NextRequest) {
  return withPermissions(request, MANAGE_PERMISSIONS, async req => {
    const entityTypeParam = request.nextUrl.searchParams.get("entityType")
    if (entityTypeParam && !isDataImportEntityType(entityTypeParam)) {
      return createErrorResponse("Invalid entityType filter", 400)
    }

    const pageSize = normalizePageSize(request.nextUrl.searchParams.get("pageSize"))
    const entityFilter = entityTypeParam && isDataImportEntityType(entityTypeParam)
      ? importEntityToDataEntity(entityTypeParam)
      : undefined

    const jobs = await prisma.importJob.findMany({
      where: {
        tenantId: req.user.tenantId,
        source: ImportExportSource.UI,
        entity: entityFilter
          ? entityFilter
          : {
              in: [
                DataEntity.Accounts,
                DataEntity.Contacts,
                DataEntity.OpportunityLineItems,
                DataEntity.DepositTransactions,
                DataEntity.Opportunities,
                DataEntity.Products,
                DataEntity.RevenueSchedules
              ]
            }
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      select: {
        id: true,
        entity: true,
        status: true,
        undoStatus: true,
        fileName: true,
        totalRows: true,
        processedRows: true,
        successCount: true,
        errorCount: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        _count: {
          select: { records: true }
        }
      }
    })

    const data: RecentImportJobSummary[] = jobs
      .map(job => {
        const mappedEntityType = dataEntityToImportEntity(job.entity)
        if (!mappedEntityType) {
          return null
        }

        return {
          id: job.id,
          entityType: mappedEntityType,
          status: job.status,
          undoStatus: job.undoStatus,
          fileName: job.fileName,
          totalRows: job.totalRows,
          processedRows: job.processedRows,
          successCount: job.successCount,
          errorCount: job.errorCount,
          trackedRecordCount: job._count.records,
          startedAt: job.startedAt?.toISOString() ?? null,
          completedAt: job.completedAt?.toISOString() ?? null,
          createdAt: job.createdAt.toISOString()
        }
      })
      .filter((job): job is RecentImportJobSummary => Boolean(job))

    return NextResponse.json({ data })
  })
}

export async function POST(request: NextRequest) {
  return withPermissions(request, MANAGE_PERMISSIONS, async req => {
    const payload = (await request.json().catch(() => null)) as Partial<ImportRequestBody> | null
    if (!payload || typeof payload !== "object") {
      return createErrorResponse("Invalid request payload", 400)
    }

    if (!isDataImportEntityType(payload.entityType)) {
      return createErrorResponse("Invalid or missing entityType", 400)
    }

    const entityType = payload.entityType
    const definition = getDataImportEntityDefinition(entityType)
    if (!definition) {
      return createErrorResponse("Unsupported import target", 400)
    }

    if (payload.validateOnly !== undefined && typeof payload.validateOnly !== "boolean") {
      return createErrorResponse("Invalid validateOnly flag", 400)
    }
    const validateOnly = payload.validateOnly === true

    let depositTransactionOptions: DepositTransactionEntityOptions | null = null
    if (entityType === "deposit-transactions") {
      const parsed = parseDepositTransactionEntityOptions(payload.entityOptions)
      if (!parsed.options) {
        return createErrorResponse(parsed.error ?? "Invalid deposit transaction import options", 400)
      }
      depositTransactionOptions = parsed.options
    }

    const upsertExisting =
      entityType === "deposit-transactions" ||
      entityType === "opportunity-line-items" ||
      entityType === "revenue-schedules"
      ? false
      : payload.upsertExisting === undefined
        ? true
        : payload.upsertExisting

    if (entityType === "deposit-transactions" && payload.upsertExisting === true) {
      return createErrorResponse("Deposit transaction imports are create-only.", 400)
    }

    if (entityType === "opportunity-line-items" && payload.upsertExisting === true) {
      return createErrorResponse("Opportunity line item imports are create-only.", 400)
    }

    if (entityType === "revenue-schedules" && payload.upsertExisting === true) {
      return createErrorResponse(
        "Revenue schedule imports are create-only. Reset or remove previously imported revenue schedules before rerunning the same file.",
        400
      )
    }

    if (
      entityType !== "deposit-transactions" &&
      entityType !== "opportunity-line-items" &&
      entityType !== "revenue-schedules" &&
      typeof upsertExisting !== "boolean"
    ) {
      return createErrorResponse("Invalid upsertExisting flag", 400)
    }

    if (!payload.mapping || typeof payload.mapping !== "object" || Array.isArray(payload.mapping)) {
      return createErrorResponse("Mapping is required", 400)
    }

    if (!Array.isArray(payload.rows)) {
      return createErrorResponse("Rows are required", 400)
    }

    const rows = payload.rows
    if (rows.length === 0) {
      return createErrorResponse("At least one row is required", 400)
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      return createErrorResponse(`Import is limited to ${MAX_IMPORT_ROWS} rows per request`, 400)
    }

    const allowedFieldIds = new Set(definition.fields.map(field => field.id))
    const mapping: Record<string, string> = {}
    for (const [columnName, rawFieldId] of Object.entries(payload.mapping)) {
      if (typeof rawFieldId !== "string") {
        continue
      }
      const fieldId = rawFieldId.trim()
      if (!fieldId) {
        continue
      }
      if (!allowedFieldIds.has(fieldId)) {
        return createErrorResponse(`Mapping contains unsupported field "${fieldId}"`, 400)
      }
      mapping[columnName] = fieldId
    }

    if (Object.keys(mapping).length === 0) {
      return createErrorResponse("At least one column must be mapped", 400)
    }

    const requiredFieldIds = definition.fields.filter(field => field.required).map(field => field.id)
    const mappedFieldIds = new Set(Object.values(mapping))
    const missingRequiredMappings = requiredFieldIds.filter(fieldId => !mappedFieldIds.has(fieldId))
    if (missingRequiredMappings.length > 0) {
      return createErrorResponse(
        `Missing required field mappings: ${missingRequiredMappings
          .map(fieldId => `${getFieldLabel(definition, fieldId)} (${fieldId})`)
          .join(", ")}`,
        400
      )
    }

    if (entityType === "deposit-transactions") {
      if (!mappedFieldIds.has("usage") && !mappedFieldIds.has("commission")) {
        return createErrorResponse(
          'Deposit transaction imports require mapping "Actual Usage" or "Actual Commission".',
          400
        )
      }

      if (
        !depositTransactionOptions?.defaultDistributorAccountName &&
        !mappedFieldIds.has("distributorAccountName")
      ) {
        return createErrorResponse(
          'Deposit transaction imports require a Distributor Name column or a default distributor.',
          400
        )
      }

      if (
        !depositTransactionOptions?.defaultVendorAccountName &&
        !mappedFieldIds.has("vendorAccountName")
      ) {
        return createErrorResponse(
          'Deposit transaction imports require a Vendor Name column or a default vendor.',
          400
        )
      }

      if (!validateOnly) {
        const existingResult = await readExistingImportJobResult(
          req.user.tenantId,
          entityType,
          depositTransactionOptions!.idempotencyKey
        )
        if (existingResult === "processing") {
          return createErrorResponse("An import with this idempotency key is already running.", 409)
        }
        if (existingResult) {
          return NextResponse.json({ data: existingResult })
        }
      }
    }

    const revenueTypeOptions = await getEnabledRevenueTypeOptions(req.user.tenantId)
    const context: ImportContext = {
      tenantId: req.user.tenantId,
      userId: req.user.id,
      accountByNameCache: new Map(),
      accountBySalesforceIdCache: new Map(),
      accountImportNames: new Set(
        entityType === "accounts"
          ? rows
              .map(row => {
                if (!row || typeof row !== "object" || Array.isArray(row)) {
                  return ""
                }
                return normalizeLookupKey(mapRowByField(row, mapping).accountName ?? "")
              })
              .filter(Boolean)
          : []
      ),
      accountTypeIdByNameCache: new Map(),
      industryIdByNameCache: new Map(),
      activeUserIdByEmailCache: new Map(),
      opportunityIdByNameCache: new Map(),
      contactIdByMatchKeyCache: new Map(),
      productByCodeCache: new Map(),
      enabledRevenueTypeCodeByNormalizedCode: new Map(
        revenueTypeOptions.map(option => [normalizeLookupKey(option.value), option.value])
      ),
      enabledRevenueTypeCodeByNormalizedLabel: new Map(
        revenueTypeOptions.map(option => [normalizeLookupKey(option.label), option.value])
      ),
      depositTransactionState: depositTransactionOptions
        ? {
            config: depositTransactionOptions,
            seenSourceTransactionKeys: new Set(),
            depositBySourceKey: new Map()
          }
        : null
    }

    const result: ImportResult = {
      totalRows: rows.length,
      successRows: 0,
      skippedRows: 0,
      errorRows: 0,
      errors: [],
      mode: validateOnly ? "validate-only" : "import"
    }

    const options: ImportOptions = { upsertExisting, validateOnly }
    const importJob = validateOnly
      ? null
      : await prisma.importJob.create({
          data: {
            tenantId: req.user.tenantId,
            createdById: req.user.id,
            entity: importEntityToDataEntity(entityType),
            idempotencyKey: depositTransactionOptions?.idempotencyKey ?? null,
            source: ImportExportSource.UI,
            status: JobStatus.Processing,
            fileName: asOptionalString(payload.fileName ?? "") ?? `${entityType}-import`,
            totalRows: rows.length,
            processedRows: 0,
            successCount: 0,
            errorCount: 0,
            startedAt: new Date(),
            filters: toJsonValue({
              entityType,
              upsertExisting,
              validateOnly,
              mapping,
              entityOptions: depositTransactionOptions
            })
          }
        })
    const storedErrors: Array<{
      rowNumber: number
      fieldName: string
      message: string
      rawData: Prisma.InputJsonValue
    }> = []
    const importRecords: Array<ImportedRecordMutation & { rowNumber: number }> = []

    try {
      for (let index = 0; index < rows.length; index += 1) {
        const rowNumber = index + 2
        const rawRow = rows[index]
        if (!rawRow || typeof rawRow !== "object" || Array.isArray(rawRow)) {
          result.errorRows += 1
          if (result.errors.length < MAX_ERROR_ROWS) {
            result.errors.push({
              rowNumber,
              field: "row",
              errorType: "validation",
              message: "Row is not a valid object."
            })
          }
          if (storedErrors.length < MAX_ERROR_ROWS) {
            storedErrors.push(
              buildStoredErrorRecord(
                rowNumber,
                "row",
                "validation",
                "Row is not a valid object.",
                rawRow
              )
            )
          }
          continue
        }

        const values = mapRowByField(rawRow, mapping)
        const errorAccountName = getImportErrorAccountName(values)
        const missingRequiredValues = requiredFieldIds.filter(fieldId => !asTrimmedString(values[fieldId]))
        if (missingRequiredValues.length > 0) {
          const message = `Missing required value(s): ${missingRequiredValues
            .map(fieldId => describeFieldForMessage(definition, mapping, fieldId))
            .join(", ")}`
          result.errorRows += 1
          if (result.errors.length < MAX_ERROR_ROWS) {
            result.errors.push({
              rowNumber,
              field: missingRequiredValues[0],
              errorType: "validation",
              message,
              accountName: errorAccountName
            })
          }
          if (storedErrors.length < MAX_ERROR_ROWS) {
            storedErrors.push(
              buildStoredErrorRecord(
                rowNumber,
                missingRequiredValues[0] ?? "row",
                "validation",
                message,
                rawRow,
                errorAccountName
              )
            )
          }
          continue
        }

        try {
          const outcome = await processRowByEntity(entityType, context, values, options)
          if (outcome.status === "error") {
            const message = withFieldContext(
              outcome.failure.message,
              definition,
              mapping,
              outcome.failure.field
            )
            result.errorRows += 1
            if (result.errors.length < MAX_ERROR_ROWS) {
              result.errors.push({
                rowNumber,
                field: outcome.failure.field,
                errorType: outcome.failure.errorType,
                message,
                accountName: errorAccountName
              })
            }
            if (storedErrors.length < MAX_ERROR_ROWS) {
              storedErrors.push(
                buildStoredErrorRecord(
                  rowNumber,
                  outcome.failure.field,
                  outcome.failure.errorType,
                  message,
                  rawRow,
                  errorAccountName
                )
              )
            }
            continue
          }
          if (outcome.status === "skipped") {
            result.skippedRows += 1
            continue
          }
          if (outcome.mutations?.length) {
            importRecords.push(
              ...outcome.mutations.map(mutation => ({
                ...mutation,
                rowNumber
              }))
            )
          }
          result.successRows += 1
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unexpected error while importing row."
          result.errorRows += 1
          console.error("Import row failed", { entityType, rowNumber, error })
          if (result.errors.length < MAX_ERROR_ROWS) {
            result.errors.push({
              rowNumber,
              field: "row",
              errorType: "system",
              message,
              accountName: errorAccountName
            })
          }
          if (storedErrors.length < MAX_ERROR_ROWS) {
            storedErrors.push(
              buildStoredErrorRecord(rowNumber, "row", "system", message, rawRow, errorAccountName)
            )
          }
        }
      }

      if (importJob) {
        await prisma.$transaction(async tx => {
          if (importRecords.length > 0) {
            await tx.importJobRecord.createMany({
              data: importRecords.map(record => ({
                importJobId: importJob.id,
                tenantId: req.user.tenantId,
                rowNumber: record.rowNumber,
                entityName: record.entityName,
                entityId: record.entityId,
                operation: record.operation,
                undoAction: record.undoAction,
                undoOrder: record.undoOrder,
                previousValues: record.previousValues,
                newValues: record.newValues
              })),
              skipDuplicates: true
            })
          }

          const hasUpdatedRecords = importRecords.some(
            record => record.operation === ImportJobRecordOperation.Updated
          )
          const hasUndoableCreatedRecords = importRecords.some(
            record => record.undoAction === ImportJobUndoAction.DeleteCreatedRecord
          )

          if (storedErrors.length > 0) {
            await tx.importError.createMany({
              data: storedErrors.map(error => ({
                importJobId: importJob.id,
                rowNumber: error.rowNumber,
                fieldName: error.fieldName,
                message: error.message,
                rawData: error.rawData
              }))
            })
          }

          await tx.importJob.update({
            where: { id: importJob.id },
            data: {
              status: JobStatus.Completed,
              processedRows: rows.length,
              successCount: result.successRows,
              errorCount: result.errorRows,
              undoStatus: hasUpdatedRecords
                ? ImportJobUndoStatus.Blocked
                : hasUndoableCreatedRecords
                  ? ImportJobUndoStatus.Undoable
                  : ImportJobUndoStatus.NotTracked,
              completedAt: new Date(),
              filters: toJsonValue({
                entityType,
                upsertExisting,
                validateOnly,
                mapping,
                entityOptions: depositTransactionOptions,
                storedErrorCount: storedErrors.length,
                trackedRecordCount: importRecords.length,
                undoBlockedReason: hasUpdatedRecords
                  ? "This import updated existing records. Update rollback is not supported in import undo v1."
                  : undefined
              })
            }
          })
        })
      }
    } catch (error) {
      if (importJob) {
        await prisma.importJob.update({
          where: { id: importJob.id },
          data: {
            status: JobStatus.Failed,
            processedRows: result.successRows + result.skippedRows + result.errorRows,
            successCount: result.successRows,
            errorCount: result.errorRows,
            completedAt: new Date(),
            filters: toJsonValue({
              entityType,
              upsertExisting,
              validateOnly,
              mapping,
              entityOptions: depositTransactionOptions,
              storedErrorCount: storedErrors.length,
              failureMessage: error instanceof Error ? error.message : "Import failed"
            })
          }
        })
      }
      throw error
    }

    if (importJob) {
      result.importJobId = importJob.id
      result.storedErrorCount = storedErrors.length
    }
    return NextResponse.json({ data: result })
  })
}
