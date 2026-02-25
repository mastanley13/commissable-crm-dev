import { NextRequest, NextResponse } from "next/server"
import {
  AccountStatus,
  ContactMethod,
  LeadSource,
  OpportunityStage,
  RevenueScheduleType
} from "@prisma/client"
import { createErrorResponse, withPermissions } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { formatPhoneNumber, normalizeEmail } from "@/lib/validation"
import { getEnabledRevenueTypeOptions } from "@/lib/server-revenue-types"
import {
  getDataImportEntityDefinition,
  isDataImportEntityType,
  type DataImportEntityType
} from "@/lib/data-import/catalog"

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
}

interface ImportResult {
  totalRows: number
  successRows: number
  skippedRows: number
  errorRows: number
  errors: ImportError[]
}

interface ImportRequestBody {
  entityType: DataImportEntityType
  upsertExisting: boolean
  mapping: Record<string, string>
  rows: Array<Record<string, unknown>>
}

interface RowFailure {
  field: string
  errorType: "validation" | "business_rule" | "system"
  message: string
}

type RowOutcome =
  | { status: "success" }
  | { status: "skipped" }
  | { status: "error"; failure: RowFailure }

interface AccountLookup {
  id: string
  accountTypeId: string | null
  accountTypeName: string | null
}

interface ProductLookup {
  id: string
  distributorAccountId: string | null
  vendorAccountId: string | null
}

interface ImportContext {
  tenantId: string
  userId: string
  accountByNameCache: Map<string, AccountLookup | null>
  accountTypeIdByNameCache: Map<string, string | null>
  industryIdByNameCache: Map<string, string | null>
  activeUserIdByEmailCache: Map<string, string | null>
  opportunityIdByNameCache: Map<string, string | null>
  contactIdByMatchKeyCache: Map<string, string | null>
  productByCodeCache: Map<string, ProductLookup | null>
  enabledRevenueTypeCodeByNormalizedCode: Map<string, string>
  enabledRevenueTypeCodeByNormalizedLabel: Map<string, string>
}

interface ImportOptions {
  upsertExisting: boolean
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

function asOptionalString(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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

function resolveEnumValue<T extends string>(lookup: Map<string, T>, value: string): T | null {
  const key = normalizeEnumKey(value)
  if (!key) {
    return null
  }
  return lookup.get(key) ?? null
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
      accountTypeId: true,
      accountType: { select: { name: true } }
    }
  })

  const result = account
    ? {
        id: account.id,
        accountTypeId: account.accountTypeId,
        accountTypeName: account.accountType?.name ?? null
      }
    : null
  context.accountByNameCache.set(key, result)
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

async function getActiveUserIdByEmail(context: ImportContext, email: string) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) {
    return null
  }
  const key = normalizeLookupKey(normalizedEmail)
  if (context.activeUserIdByEmailCache.has(key)) {
    return context.activeUserIdByEmailCache.get(key) ?? null
  }

  const user = await prisma.user.findFirst({
    where: {
      tenantId: context.tenantId,
      email: { equals: normalizedEmail, mode: "insensitive" },
      status: "Active"
    },
    select: { id: true }
  })

  const id = user?.id ?? null
  context.activeUserIdByEmailCache.set(key, id)
  return id
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
      vendorAccountId: true
    }
  })

  const result = product
    ? {
        id: product.id,
        distributorAccountId: product.distributorAccountId,
        vendorAccountId: product.vendorAccountId
      }
    : null
  context.productByCodeCache.set(key, result)
  return result
}

async function importAccountRow(
  context: ImportContext,
  values: Record<string, string>,
  options: ImportOptions
): Promise<RowOutcome> {
  const accountName = asTrimmedString(values.accountName)
  const existing = await getAccountByName(context, accountName)
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
    ownerId = await getActiveUserIdByEmail(context, ownerEmail)
    if (!ownerId) {
      return {
        status: "error",
        failure: {
          field: "ownerEmail",
          errorType: "business_rule",
          message: `Owner "${ownerEmail}" was not found as an active user.`
        }
      }
    }
  }

  const parentAccountName = asTrimmedString(values.parentAccountName)
  let parentAccountId: string | null = null
  if (parentAccountName) {
    const parent = await getAccountByName(context, parentAccountName)
    if (!parent) {
      return {
        status: "error",
        failure: {
          field: "parentAccountName",
          errorType: "business_rule",
          message: `Parent Account "${parentAccountName}" was not found.`
        }
      }
    }
    parentAccountId = parent.id
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

  const payload = {
    accountName,
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

  if (existing) {
    await prisma.account.update({
      where: { id: existing.id },
      data: payload
    })
  } else {
    await prisma.account.create({
      data: {
        tenantId: context.tenantId,
        ...payload,
        createdById: context.userId
      }
    })
  }

  context.accountByNameCache.delete(normalizeLookupKey(accountName))
  return { status: "success" }
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
    ownerId = await getActiveUserIdByEmail(context, ownerEmail)
    if (!ownerId) {
      return {
        status: "error",
        failure: {
          field: "ownerEmail",
          errorType: "business_rule",
          message: `Owner "${ownerEmail}" was not found as an active user.`
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
    workPhoneExt: asOptionalString(values.workPhoneExt),
    mobilePhone: asOptionalString(values.mobilePhone) ? formatPhoneNumber(values.mobilePhone) : null,
    emailAddress: normalizedEmail,
    ownerId,
    isPrimary: isPrimary.value ?? false,
    isDecisionMaker: isDecisionMaker.value ?? false,
    preferredContactMethod: preferredContactMethod ?? ContactMethod.Email,
    description: asOptionalString(values.description),
    updatedById: context.userId
  }

  if (existingId) {
    await prisma.contact.update({
      where: { id: existingId },
      data: payload
    })
  } else {
    await prisma.contact.create({
      data: {
        tenantId: context.tenantId,
        ...payload,
        createdById: context.userId
      }
    })
  }

  context.contactIdByMatchKeyCache.delete(
    buildContactMatchKey(account.id, normalizedEmail, firstName, lastName)
  )
  return { status: "success" }
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

  const ownerEmail = asTrimmedString(values.ownerEmail)
  let ownerId = context.userId
  if (ownerEmail) {
    const userId = await getActiveUserIdByEmail(context, ownerEmail)
    if (!userId) {
      return {
        status: "error",
        failure: {
          field: "ownerEmail",
          errorType: "business_rule",
          message: `Owner "${ownerEmail}" was not found as an active user.`
        }
      }
    }
    ownerId = userId
  }

  const stageRaw = asTrimmedString(values.stage)
  const stage = stageRaw ? resolveEnumValue(OPPORTUNITY_STAGE_LOOKUP, stageRaw) : null
  if (stageRaw && !stage) {
    return {
      status: "error",
      failure: {
        field: "stage",
        errorType: "validation",
        message: `Stage "${stageRaw}" is invalid.`
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

  const payload = {
    accountId: account.id,
    ownerId,
    name,
    stage: stage ?? OpportunityStage.Qualification,
    leadSource: leadSource ?? LeadSource.Referral,
    estimatedCloseDate: estimatedCloseDate.value,
    amount: amount.value,
    expectedCommission: expectedCommission.value,
    description: asOptionalString(values.description),
    updatedById: context.userId
  }

  if (existingId) {
    await prisma.opportunity.update({
      where: { id: existingId },
      data: payload
    })
  } else {
    await prisma.opportunity.create({
      data: {
        tenantId: context.tenantId,
        ...payload,
        createdById: context.userId
      }
    })
  }

  context.opportunityIdByNameCache.delete(`${account.id}:${normalizeLookupKey(name)}`)
  return { status: "success" }
}

async function importRevenueScheduleRow(
  context: ImportContext,
  values: Record<string, string>
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

  await prisma.revenueSchedule.create({
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
    }
  })

  return { status: "success" }
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
  }

  const payload = {
    productCode,
    productNameHouse,
    revenueType: resolvedRevenueType,
    productNameVendor: asOptionalString(values.productNameVendor),
    description: asOptionalString(values.description),
    priceEach: priceEach.value,
    commissionPercent: commissionPercent.value,
    isActive: activeValue.value ?? true,
    vendorAccountId,
    distributorAccountId,
    productFamilyHouse: asOptionalString(values.productFamilyHouse),
    productSubtypeHouse: asOptionalString(values.productSubtypeHouse),
    productFamilyVendor: asOptionalString(values.productFamilyVendor),
    productSubtypeVendor: asOptionalString(values.productSubtypeVendor),
    updatedById: context.userId
  }

  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: payload
    })
  } else {
    await prisma.product.create({
      data: {
        tenantId: context.tenantId,
        ...payload,
        createdById: context.userId
      }
    })
  }

  context.productByCodeCache.delete(normalizeLookupKey(productCode))
  return { status: "success" }
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
    case "opportunities":
      return importOpportunityRow(context, values, options)
    case "revenue-schedules":
      return importRevenueScheduleRow(context, values)
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

    const upsertExisting = payload.upsertExisting === undefined ? true : payload.upsertExisting
    if (typeof upsertExisting !== "boolean") {
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
        `Missing required field mappings: ${missingRequiredMappings.join(", ")}`,
        400
      )
    }

    const revenueTypeOptions = await getEnabledRevenueTypeOptions(req.user.tenantId)
    const context: ImportContext = {
      tenantId: req.user.tenantId,
      userId: req.user.id,
      accountByNameCache: new Map(),
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
      )
    }

    const result: ImportResult = {
      totalRows: rows.length,
      successRows: 0,
      skippedRows: 0,
      errorRows: 0,
      errors: []
    }

    const options: ImportOptions = { upsertExisting }

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
        continue
      }

      const values = mapRowByField(rawRow, mapping)
      const missingRequiredValues = requiredFieldIds.filter(fieldId => !asTrimmedString(values[fieldId]))
      if (missingRequiredValues.length > 0) {
        result.errorRows += 1
        if (result.errors.length < MAX_ERROR_ROWS) {
          result.errors.push({
            rowNumber,
            field: missingRequiredValues[0],
            errorType: "validation",
            message: `Missing required value for: ${missingRequiredValues.join(", ")}`
          })
        }
        continue
      }

      try {
        const outcome = await processRowByEntity(entityType, context, values, options)
        if (outcome.status === "error") {
          result.errorRows += 1
          if (result.errors.length < MAX_ERROR_ROWS) {
            result.errors.push({
              rowNumber,
              field: outcome.failure.field,
              errorType: outcome.failure.errorType,
              message: outcome.failure.message
            })
          }
          continue
        }
        if (outcome.status === "skipped") {
          result.skippedRows += 1
          continue
        }
        result.successRows += 1
      } catch (error) {
        result.errorRows += 1
        console.error("Import row failed", { entityType, rowNumber, error })
        if (result.errors.length < MAX_ERROR_ROWS) {
          result.errors.push({
            rowNumber,
            field: "row",
            errorType: "system",
            message: error instanceof Error ? error.message : "Unexpected error while importing row."
          })
        }
      }
    }

    return NextResponse.json({ data: result })
  })
}
