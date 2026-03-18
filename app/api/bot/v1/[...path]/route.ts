import { NextRequest, NextResponse } from "next/server"
import {
  AccountStatus,
  AuditAction,
  DepositLineItemStatus,
  DepositLineMatchSource,
  DepositLineMatchStatus,
  LeadSource,
  OpportunityStage,
  OpportunityStatus,
  OpportunityType,
  Prisma,
  ReconciliationStatus,
  RevenueScheduleBillingStatus,
  RevenueScheduleBillingStatusSource,
  RevenueScheduleFlexClassification,
  RevenueScheduleFlexReasonCode,
  RevenueScheduleType,
} from "@prisma/client"
import { prisma } from "@/lib/db"
import { withBotAuth, type BotAuthenticatedRequest, logBotAuditEvent } from "@/lib/bot-auth"
import { accountIncludeForList, mapAccountToListRow } from "@/app/api/accounts/helpers"
import { mapOpportunityToDetail, mapOpportunityToRow } from "@/app/api/opportunities/helpers"
import { mapProductToRow } from "@/app/api/products/helpers"
import { ensureActiveOwnerOrNull } from "@/lib/validation"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { recomputeDepositLineItemAllocations } from "@/lib/matching/deposit-line-allocations"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import { executeUnmatchReversal } from "@/lib/reconciliation/unmatch-reversal"
import { generateRevenueScheduleName } from "@/lib/revenue-schedule-number"
import { roundCurrency } from "@/lib/revenue-schedule-calculations"
import { getChangedFields, getClientIP, getUserAgent, logAudit } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ACCOUNT_PERMISSIONS = ["accounts.manage", "accounts.read"]
const ACCOUNT_WRITE_PERMISSIONS = ["accounts.manage"]
const OPPORTUNITY_READ_PERMISSIONS = [
  "opportunities.view.all",
  "opportunities.edit.all",
  "opportunities.manage",
  "accounts.manage",
  "accounts.read",
  "opportunities.read",
  "opportunities.view.assigned",
  "opportunities.edit.assigned",
]
const OPPORTUNITY_WRITE_PERMISSIONS = [
  "opportunities.create",
  "opportunities.manage",
  "accounts.manage",
  "accounts.create",
  "contacts.manage",
  "opportunities.edit.all",
  "opportunities.edit.assigned",
  "accounts.update",
]
const PRODUCT_PERMISSIONS = ["products.read", "products.create", "products.update", "products.delete"]
const SCHEDULE_PERMISSIONS = ["revenue-schedules.manage"]
const DEPOSIT_READ_PERMISSIONS = ["reconciliation.view"]
const DEPOSIT_WRITE_PERMISSIONS = ["reconciliation.manage"]

type RouteContext = {
  params: {
    path?: string[]
  }
}

type AddressInput = {
  line1: string
  city: string
  line2?: string
  state?: string
  postalCode?: string
  country?: string
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "object" && value && "toNumber" in (value as Record<string, unknown>)) {
    try {
      const parsed = (value as { toNumber: () => number }).toNumber()
      return Number.isFinite(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function toDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function toDateTime(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function decimal(value: number | null | undefined): Prisma.Decimal | null {
  return value === null || value === undefined ? null : new Prisma.Decimal(value)
}

function pagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? searchParams.get("pageSize") ?? "25")))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

function jsonList(data: unknown, page: number, limit: number, total: number) {
  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total,
    },
  })
}

function jsonMutation(request: BotAuthenticatedRequest, data: unknown, status = 200) {
  return NextResponse.json(
    {
      data,
      transactionId: request.bot.transactionId,
    },
    { status },
  )
}

function parseJsonField<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }
  if (typeof value === "object") {
    return value as T
  }
  return null
}

function parseAddress(raw: unknown): AddressInput | null {
  if (!raw || typeof raw !== "object") return null
  const candidate = raw as Record<string, unknown>
  const line1 = typeof candidate.line1 === "string" ? candidate.line1.trim() : ""
  const city = typeof candidate.city === "string" ? candidate.city.trim() : ""

  if (!line1 || !city) {
    return null
  }

  return {
    line1,
    city,
    line2: typeof candidate.line2 === "string" ? candidate.line2.trim() || undefined : undefined,
    state: typeof candidate.state === "string" ? candidate.state.trim() || undefined : undefined,
    postalCode: typeof candidate.postalCode === "string" ? candidate.postalCode.trim() || undefined : undefined,
    country: typeof candidate.country === "string" ? candidate.country.trim() || undefined : undefined,
  }
}

async function createAddress(tenantId: string, input: AddressInput | null) {
  if (!input) return null
  const address = await prisma.address.create({
    data: {
      tenantId,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      state: input.state ?? null,
      postalCode: input.postalCode ?? null,
      country: input.country ?? null,
    },
  })

  return address.id
}

function pickSearch(searchParams: URLSearchParams, ...keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key)?.trim()
    if (value) {
      return value
    }
  }
  return ""
}

function mapBotDepositStatus(deposit: {
  status: ReconciliationStatus
  reconciled: boolean
}): "unmatched" | "in-progress" | "finalized" {
  if (deposit.reconciled || deposit.status === ReconciliationStatus.Completed) {
    return "finalized"
  }

  if (deposit.status === ReconciliationStatus.InReview) {
    return "in-progress"
  }

  return "unmatched"
}

function mapDepositSummary(deposit: any) {
  return {
    id: deposit.id,
    depositName: deposit.depositName ?? deposit.id,
    accountId: deposit.accountId,
    accountName: deposit.account?.accountName ?? "",
    distributorAccountId: deposit.distributorAccountId ?? null,
    distributorName: deposit.distributor?.accountName ?? "",
    vendorAccountId: deposit.vendorAccountId ?? null,
    vendorName: deposit.vendor?.accountName ?? "",
    month: toDateOnly(deposit.month),
    paymentDate: toDateOnly(deposit.paymentDate),
    paymentType: deposit.paymentType ?? null,
    totalRevenue: toNumber(deposit.totalRevenue),
    totalCommissions: toNumber(deposit.totalCommissions),
    totalUsage: toNumber(deposit.totalUsage),
    usageAllocated: toNumber(deposit.usageAllocated),
    usageUnallocated: toNumber(deposit.usageUnallocated),
    commissionAllocated: toNumber(deposit.commissionAllocated),
    commissionUnallocated: toNumber(deposit.commissionUnallocated),
    totalItems: deposit.totalItems ?? 0,
    totalReconciledItems: deposit.totalReconciledItems ?? 0,
    itemsReconciled: deposit.itemsReconciled ?? 0,
    itemsUnreconciled: deposit.itemsUnreconciled ?? 0,
    status: mapBotDepositStatus(deposit),
    rawStatus: deposit.status,
    reconciled: Boolean(deposit.reconciled),
    reconciledAt: toDateTime(deposit.reconciledAt),
    notes: deposit.notes ?? null,
    createdAt: toDateTime(deposit.createdAt),
    updatedAt: toDateTime(deposit.updatedAt),
  }
}

function mapDepositLine(line: any) {
  const metadata = parseJsonField<Record<string, unknown>>(line.metadata) ?? {}
  return {
    id: line.id,
    lineNumber: line.lineNumber ?? null,
    status: String(line.status),
    primaryRevenueScheduleId: line.primaryRevenueScheduleId ?? null,
    paymentDate: toDateOnly(line.paymentDate),
    accountId: line.accountId ?? null,
    accountName: line.account?.accountName ?? line.accountNameRaw ?? "",
    accountLegalName: line.account?.accountLegalName ?? null,
    vendorAccountId: line.vendorAccountId ?? null,
    vendorName: line.vendorAccount?.accountName ?? line.vendorNameRaw ?? "",
    productId: line.productId ?? null,
    productName: line.product?.productNameVendor ?? line.productNameRaw ?? "",
    partNumber: line.product?.partNumberVendor ?? line.partNumberRaw ?? "",
    distributorName: line.distributorNameRaw ?? null,
    locationId: line.locationId ?? null,
    customerPurchaseOrder: line.customerPurchaseOrder ?? null,
    accountIdVendor: line.accountIdVendor ?? null,
    customerIdVendor: line.customerIdVendor ?? null,
    orderIdVendor: line.orderIdVendor ?? null,
    usage: toNumber(line.usage),
    usageAllocated: toNumber(line.usageAllocated),
    usageUnallocated: toNumber(line.usageUnallocated),
    commission: toNumber(line.commission),
    commissionAllocated: toNumber(line.commissionAllocated),
    commissionUnallocated: toNumber(line.commissionUnallocated),
    commissionRate: toNumber(line.commissionRate),
    reconciled: Boolean(line.reconciled),
    reconciledAt: toDateTime(line.reconciledAt),
    hasSuggestedMatches: Boolean(line.hasSuggestedMatches),
    notes: typeof metadata.notes === "string" ? metadata.notes : null,
    metadata,
    createdAt: toDateTime(line.createdAt),
    updatedAt: toDateTime(line.updatedAt),
  }
}

function scheduleNumbers(schedule: any) {
  const expectedUsage = toNumber(schedule.expectedUsage) ?? toNumber(schedule.opportunityProduct?.expectedUsage) ?? 0
  const usageAdjustment = toNumber(schedule.usageAdjustment) ?? 0
  const actualUsage = toNumber(schedule.actualUsage) ?? 0
  const actualUsageAdjustment = toNumber((schedule as any).actualUsageAdjustment) ?? 0

  let expectedCommission = toNumber(schedule.expectedCommission) ?? toNumber(schedule.opportunityProduct?.expectedCommission) ?? 0
  const expectedCommissionRatePercent =
    toNumber((schedule as any).expectedCommissionRatePercent) ??
    toNumber(schedule.product?.commissionPercent) ??
    null
  const expectedCommissionAdjustment = toNumber((schedule as any).expectedCommissionAdjustment) ?? 0
  const actualCommission = toNumber(schedule.actualCommission) ?? 0
  const actualCommissionAdjustment = toNumber((schedule as any).actualCommissionAdjustment) ?? 0

  if (expectedCommission === 0 && expectedCommissionRatePercent !== null && expectedUsage !== 0) {
    expectedCommission = roundCurrency(expectedUsage * (expectedCommissionRatePercent / 100))
  }

  const expectedUsageNet = roundCurrency(expectedUsage + usageAdjustment)
  const expectedCommissionNet = roundCurrency(expectedCommission + expectedCommissionAdjustment)
  const usageBalance = roundCurrency(expectedUsageNet - actualUsage)
  const commissionBalance = roundCurrency(expectedCommissionNet - actualCommission)
  const actualCommissionRatePercent =
    actualUsage !== 0
      ? roundCurrency((actualCommission / actualUsage) * 100)
      : null

  return {
    expectedUsage,
    usageAdjustment,
    expectedUsageNet,
    actualUsage,
    actualUsageAdjustment,
    usageBalance,
    expectedCommission,
    expectedCommissionRatePercent,
    expectedCommissionAdjustment,
    expectedCommissionNet,
    actualCommission,
    actualCommissionAdjustment,
    actualCommissionRatePercent,
    commissionBalance,
  }
}

function mapScheduleSummary(schedule: any) {
  const numbers = scheduleNumbers(schedule)
  return {
    id: schedule.id,
    opportunityId: schedule.opportunityId ?? null,
    opportunityProductId: schedule.opportunityProductId ?? null,
    accountId: schedule.accountId,
    accountName: schedule.account?.accountName ?? "",
    productId: schedule.productId ?? null,
    productNameHouse: schedule.product?.productNameHouse ?? null,
    productNameVendor: schedule.product?.productNameVendor ?? null,
    vendorAccountId: schedule.vendorAccountId ?? null,
    vendorName: schedule.vendor?.accountName ?? null,
    distributorAccountId: schedule.distributorAccountId ?? null,
    distributorName: schedule.distributor?.accountName ?? null,
    scheduleNumber: schedule.scheduleNumber ?? null,
    scheduleDate: toDateOnly(schedule.scheduleDate),
    scheduleType: schedule.scheduleType,
    status: schedule.status,
    billingStatus: schedule.billingStatus,
    flexClassification: schedule.flexClassification,
    flexReasonCode: schedule.flexReasonCode ?? null,
    flexSourceDepositId: schedule.flexSourceDepositId ?? null,
    flexSourceDepositLineItemId: schedule.flexSourceDepositLineItemId ?? null,
    parentRevenueScheduleId: schedule.parentRevenueScheduleId ?? null,
    deletedAt: toDateTime(schedule.deletedAt),
    notes: schedule.notes ?? null,
    createdAt: toDateTime(schedule.createdAt),
    updatedAt: toDateTime(schedule.updatedAt),
    balances: {
      expectedUsage: numbers.expectedUsage,
      usageAdjustment: numbers.usageAdjustment,
      expectedUsageNet: numbers.expectedUsageNet,
      actualUsage: numbers.actualUsage,
      actualUsageAdjustment: numbers.actualUsageAdjustment,
      usageBalance: numbers.usageBalance,
      expectedCommission: numbers.expectedCommission,
      expectedCommissionRatePercent: numbers.expectedCommissionRatePercent,
      expectedCommissionAdjustment: numbers.expectedCommissionAdjustment,
      expectedCommissionNet: numbers.expectedCommissionNet,
      actualCommission: numbers.actualCommission,
      actualCommissionAdjustment: numbers.actualCommissionAdjustment,
      actualCommissionRatePercent: numbers.actualCommissionRatePercent,
      commissionBalance: numbers.commissionBalance,
    },
  }
}

function mapAuditRecord(row: any) {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityName,
    entityId: row.entityId,
    userId: row.userId ?? null,
    requestId: row.requestId ?? null,
    before: parseJsonField<Record<string, unknown>>(row.previousValues),
    after: parseJsonField<Record<string, unknown>>(row.newValues),
    changedFields: parseJsonField<Record<string, unknown>>(row.changedFields),
    metadata: parseJsonField<Record<string, unknown>>(row.metadata),
    ipAddress: row.ipAddress ?? null,
    userAgent: row.userAgent ?? null,
    createdAt: toDateTime(row.createdAt),
  }
}

async function readBody(request: NextRequest) {
  return request.json().catch(() => null)
}

function normalizePath(params: RouteContext["params"]) {
  return Array.isArray(params.path) ? params.path.filter(Boolean) : []
}

function parseAuditAction(value: unknown): AuditAction {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : ""
  switch (raw) {
    case "create":
      return AuditAction.Create
    case "delete":
      return AuditAction.Delete
    case "import":
      return AuditAction.Import
    case "export":
      return AuditAction.Export
    case "merge":
      return AuditAction.Merge
    case "login":
      return AuditAction.Login
    default:
      return AuditAction.Update
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

async function handleListDeposits(request: BotAuthenticatedRequest) {
  const searchParams = request.nextUrl.searchParams
  const { page, limit, skip } = pagination(searchParams)
  const tenantId = request.user.tenantId
  const status = searchParams.get("status")?.trim().toLowerCase()
  const query = pickSearch(searchParams, "search", "q")

  const where: Prisma.DepositWhereInput = { tenantId }

  if (status === "finalized") {
    where.OR = [{ reconciled: true }, { status: ReconciliationStatus.Completed }]
  } else if (status === "in-progress") {
    where.AND = [{ reconciled: false }, { status: ReconciliationStatus.InReview }]
  } else if (status === "unmatched") {
    where.AND = [{ reconciled: false }, { status: ReconciliationStatus.Pending }]
  }

  if (query) {
    const queryFilter = { contains: query, mode: "insensitive" as const }
    const queryClause: Prisma.DepositWhereInput = {
      OR: [
        { depositName: queryFilter },
        { account: { accountName: queryFilter } },
        { distributor: { accountName: queryFilter } },
        { vendor: { accountName: queryFilter } },
      ],
    }

    const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []
    where.AND = [...existingAnd, queryClause]
  }

  const [total, deposits] = await Promise.all([
    prisma.deposit.count({ where }),
    prisma.deposit.findMany({
      where,
      include: {
        account: { select: { accountName: true } },
        distributor: { select: { accountName: true } },
        vendor: { select: { accountName: true } },
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
  ])

  return jsonList(deposits.map(mapDepositSummary), page, limit, total)
}

async function handleGetDeposit(request: BotAuthenticatedRequest, depositId: string) {
  const deposit = await prisma.deposit.findFirst({
    where: { id: depositId, tenantId: request.user.tenantId },
    include: {
      account: { select: { accountName: true } },
      distributor: { select: { accountName: true } },
      vendor: { select: { accountName: true } },
      lineItems: {
        include: {
          account: { select: { accountName: true, accountLegalName: true } },
          vendorAccount: { select: { accountName: true } },
          product: { select: { productNameVendor: true, partNumberVendor: true } },
        },
        orderBy: [{ lineNumber: "asc" }, { createdAt: "asc" }],
      },
    },
  })

  if (!deposit) {
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 })
  }

  return NextResponse.json({
    data: {
      ...mapDepositSummary(deposit),
      lineItems: deposit.lineItems.map(mapDepositLine),
    },
  })
}

async function handlePatchDepositLine(request: BotAuthenticatedRequest, depositId: string, lineId: string) {
  const body = await readBody(request)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
  }

  const desiredStatus = typeof body.matchStatus === "string" ? body.matchStatus.trim().toLowerCase() : ""
  const linkedScheduleId = typeof body.linkedScheduleId === "string" ? body.linkedScheduleId.trim() : ""
  const usageAmount = toNumber((body as Record<string, unknown>).usageAmount)
  const commissionAmount = toNumber((body as Record<string, unknown>).commissionAmount)
  const notes = typeof body.notes === "string" ? body.notes.trim() : null
  const tenantId = request.user.tenantId

  const lineItem = await prisma.depositLineItem.findFirst({
    where: { id: lineId, depositId, tenantId },
    include: {
      matches: {
        where: { status: DepositLineMatchStatus.Applied },
        select: { id: true, revenueScheduleId: true },
      },
    },
  })

  if (!lineItem) {
    return NextResponse.json({ error: "Deposit line not found" }, { status: 404 })
  }

  const metadata = parseJsonField<Record<string, unknown>>(lineItem.metadata) ?? {}
  if (notes) {
    metadata.notes = notes
  }

  if (desiredStatus === "unmatched") {
    const result = await prisma.$transaction(async (tx) => {
      const reversal = await executeUnmatchReversal(tx, {
        tenantId,
        depositId,
        lineItemIds: [lineId],
        userId: request.user.id,
        varianceTolerance: await getTenantVarianceTolerance(tenantId),
      })

      if (notes) {
        await tx.depositLineItem.update({
          where: { id: lineId },
          data: { metadata: toJsonValue(metadata) },
        })
      }

      return reversal
    })

    await logBotAuditEvent({
      request,
      action: AuditAction.Update,
      entityName: "DepositLineItem",
      entityId: lineId,
      previousValues: {
        status: lineItem.status,
        primaryRevenueScheduleId: lineItem.primaryRevenueScheduleId,
        notes: (parseJsonField<Record<string, unknown>>(lineItem.metadata) ?? {}).notes ?? null,
      },
      newValues: {
        status: DepositLineItemStatus.Unmatched,
        primaryRevenueScheduleId: null,
        notes,
      },
      metadata: {
        action: "BotUnmatchDepositLine",
        depositId,
      },
    })

    const updatedLine = await prisma.depositLineItem.findFirst({ where: { id: lineId, tenantId } })
    return jsonMutation(
      request,
      {
        depositId,
        lineItem: updatedLine ? mapDepositLine(updatedLine) : null,
        reversalSummary: {
          reversedUndoLogCount: (result as any).reversedUndoLogCount ?? 0,
          scheduleCount: Array.isArray((result as any).revenueSchedules) ? (result as any).revenueSchedules.length : 0,
        },
      },
    )
  }

  if (desiredStatus === "ignored") {
    if (lineItem.matches.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot ignore a matched line. Unmatch it first.",
          duplicates: [],
        },
        { status: 409 },
      )
    }

    const updated = await prisma.depositLineItem.update({
      where: { id: lineId },
      data: {
        status: DepositLineItemStatus.Ignored,
        primaryRevenueScheduleId: null,
        metadata: toJsonValue(metadata),
      },
    })

    await logBotAuditEvent({
      request,
      action: AuditAction.Update,
      entityName: "DepositLineItem",
      entityId: lineId,
      previousValues: {
        status: lineItem.status,
        primaryRevenueScheduleId: lineItem.primaryRevenueScheduleId,
      },
      newValues: {
        status: updated.status,
        primaryRevenueScheduleId: updated.primaryRevenueScheduleId,
        notes,
      },
      metadata: {
        action: "BotIgnoreDepositLine",
        depositId,
      },
    })

    return jsonMutation(request, mapDepositLine(updated))
  }

  if (desiredStatus !== "matched" || !linkedScheduleId) {
    return NextResponse.json({ error: "matchStatus=matched and linkedScheduleId are required" }, { status: 400 })
  }

  const baseUsage = usageAmount ?? toNumber(lineItem.usage) ?? 0
  const baseCommission = commissionAmount ?? toNumber(lineItem.commission) ?? 0

  if (baseUsage < 0 || baseCommission < 0) {
    return NextResponse.json(
      { error: "Negative / chargeback lines require the dedicated Flex workflow and are not supported by this bot endpoint." },
      { status: 400 },
    )
  }

  const schedule = await prisma.revenueSchedule.findFirst({
    where: { id: linkedScheduleId, tenantId, deletedAt: null },
    select: {
      id: true,
      status: true,
      actualUsage: true,
      actualCommission: true,
    },
  })

  if (!schedule) {
    return NextResponse.json({ error: "Linked schedule not found" }, { status: 404 })
  }

  const previousMetadata = parseJsonField<Record<string, unknown>>(lineItem.metadata) ?? {}

  const result = await prisma.$transaction(async (tx) => {
    const match = await tx.depositLineMatch.upsert({
      where: {
        depositLineItemId_revenueScheduleId: {
          depositLineItemId: lineId,
          revenueScheduleId: linkedScheduleId,
        },
      },
      create: {
        tenantId,
        depositLineItemId: lineId,
        revenueScheduleId: linkedScheduleId,
        usageAmount: decimal(baseUsage),
        commissionAmount: decimal(baseCommission),
        status: DepositLineMatchStatus.Applied,
        source: DepositLineMatchSource.Manual,
      },
      update: {
        usageAmount: decimal(baseUsage),
        commissionAmount: decimal(baseCommission),
        status: DepositLineMatchStatus.Applied,
        source: DepositLineMatchSource.Manual,
      },
    })

    await tx.depositLineItem.update({
      where: { id: lineId },
      data: {
        primaryRevenueScheduleId: linkedScheduleId,
        metadata: toJsonValue(metadata),
      },
    })

    const recomputedLine = await recomputeDepositLineItemAllocations(tx, lineId, tenantId)
    const deposit = await recomputeDepositAggregates(tx, depositId, tenantId)
    const recomputedSchedule = await recomputeRevenueScheduleFromMatches(tx, linkedScheduleId, tenantId, {
      varianceTolerance: await getTenantVarianceTolerance(tenantId),
    })

    return {
      match,
      deposit,
      line: recomputedLine.line,
      schedule: recomputedSchedule.schedule,
    }
  })

  if (!result.line) {
    return NextResponse.json({ error: "Failed to recompute deposit line allocations" }, { status: 500 })
  }

  await logBotAuditEvent({
    request,
    action: AuditAction.Update,
    entityName: "DepositLineItem",
    entityId: lineId,
    previousValues: {
      status: lineItem.status,
      primaryRevenueScheduleId: lineItem.primaryRevenueScheduleId,
      notes: previousMetadata.notes ?? null,
    },
    newValues: {
      status: result.line.status,
      primaryRevenueScheduleId: linkedScheduleId,
      notes,
    },
    metadata: {
      action: "BotMatchDepositLine",
      depositId,
      depositLineMatchId: result.match.id,
      linkedScheduleId,
      usageAmount: baseUsage,
      commissionAmount: baseCommission,
    },
  })

  return jsonMutation(request, {
    lineItem: mapDepositLine(result.line),
    deposit: {
      id: depositId,
      status: result.deposit.status === ReconciliationStatus.InReview ? "in-progress" : "unmatched",
      usageAllocated: result.deposit.totals.usageAllocated,
      usageUnallocated: result.deposit.totals.usageUnallocated,
      commissionAllocated: result.deposit.totals.commissionAllocated,
      commissionUnallocated: result.deposit.totals.commissionUnallocated,
    },
    linkedSchedule: {
      id: linkedScheduleId,
      status: result.schedule.status,
      actualUsage: toNumber(result.schedule.actualUsage),
      actualCommission: toNumber(result.schedule.actualCommission),
    },
  })
}

async function handleListAccounts(request: BotAuthenticatedRequest) {
  const searchParams = request.nextUrl.searchParams
  const { page, limit, skip } = pagination(searchParams)
  const search = pickSearch(searchParams, "search", "q")
  const tenantId = request.user.tenantId

  const where: Prisma.AccountWhereInput = {
    tenantId,
    status: { not: AccountStatus.Archived },
    mergedIntoAccountId: null,
  }

  if (search) {
    const queryFilter = { contains: search, mode: "insensitive" as const }
    where.OR = [
      { accountName: queryFilter },
      { accountLegalName: queryFilter },
      { accountNumber: queryFilter },
    ]
  }

  const [total, accounts] = await Promise.all([
    prisma.account.count({ where }),
    prisma.account.findMany({
      where,
      include: accountIncludeForList,
      orderBy: [{ accountName: "asc" }],
      skip,
      take: limit,
    }),
  ])

  return jsonList(accounts.map(mapAccountToListRow), page, limit, total)
}

async function handleGetAccount(request: BotAuthenticatedRequest, accountId: string) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, tenantId: request.user.tenantId },
    include: {
      accountType: { select: { id: true, name: true } },
      owner: { select: { id: true, fullName: true } },
      parent: { select: { id: true, accountName: true } },
      industry: { select: { id: true, name: true } },
      shippingAddress: true,
      billingAddress: true,
    },
  })

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  return NextResponse.json({
    data: {
      id: account.id,
      accountName: account.accountName,
      accountLegalName: account.accountLegalName ?? null,
      status: account.status,
      accountNumber: account.accountNumber ?? null,
      accountType: account.accountType ? { id: account.accountType.id, name: account.accountType.name } : null,
      owner: account.owner ? { id: account.owner.id, name: account.owner.fullName } : null,
      parentAccount: account.parent ? { id: account.parent.id, accountName: account.parent.accountName } : null,
      industry: account.industry ? { id: account.industry.id, name: account.industry.name } : null,
      websiteUrl: account.websiteUrl ?? null,
      description: account.description ?? null,
      shippingAddress: account.shippingAddress,
      billingAddress: account.billingAddress,
      createdAt: toDateTime(account.createdAt),
      updatedAt: toDateTime(account.updatedAt),
    },
  })
}

async function handleCreateAccount(request: BotAuthenticatedRequest) {
  const body = await readBody(request)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const accountName = typeof payload.accountName === "string" ? payload.accountName.trim() : ""
  const accountLegalName = typeof payload.accountLegalName === "string" ? payload.accountLegalName.trim() : ""
  if (!accountName) {
    return NextResponse.json({ error: "accountName is required" }, { status: 400 })
  }

  const tenantId = request.user.tenantId
  const duplicateWhere: Prisma.AccountWhereInput = {
    tenantId,
    mergedIntoAccountId: null,
    OR: [
      { accountName: { equals: accountName, mode: "insensitive" } },
      ...(accountLegalName ? [{ accountLegalName: { equals: accountLegalName, mode: "insensitive" as const } }] : []),
    ],
  }

  const duplicates = await prisma.account.findMany({
    where: duplicateWhere,
    select: {
      id: true,
      accountName: true,
      accountLegalName: true,
      status: true,
      updatedAt: true,
    },
    take: 10,
    orderBy: [{ updatedAt: "desc" }],
  })

  if (duplicates.length > 0) {
    return NextResponse.json(
      {
        error: "Duplicate account detected",
        duplicates: duplicates.map((row) => ({
          id: row.id,
          accountName: row.accountName,
          accountLegalName: row.accountLegalName ?? null,
          status: row.status,
          updatedAt: toDateTime(row.updatedAt),
        })),
      },
      { status: 409 },
    )
  }

  let accountTypeId = typeof payload.accountTypeId === "string" ? payload.accountTypeId.trim() : ""
  if (!accountTypeId) {
    const defaultType = await prisma.accountType.findFirst({
      where: { tenantId, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    })

    if (!defaultType) {
      return NextResponse.json({ error: "No active account type is available" }, { status: 400 })
    }

    accountTypeId = defaultType.id
  }

  const ownerId = payload.ownerId !== undefined
    ? await ensureActiveOwnerOrNull(payload.ownerId, tenantId)
    : request.user.id

  const [shippingAddressId, billingAddressId] = await Promise.all([
    createAddress(tenantId, parseAddress(payload.shippingAddress)),
    createAddress(tenantId, parseAddress(payload.billingAddress)),
  ])

  const account = await prisma.account.create({
    data: {
      tenantId,
      accountName,
      accountLegalName: accountLegalName || null,
      accountTypeId,
      ownerId,
      industryId: typeof payload.industryId === "string" ? payload.industryId.trim() || null : null,
      websiteUrl: typeof payload.websiteUrl === "string" ? payload.websiteUrl.trim() || null : null,
      description: typeof payload.description === "string" ? payload.description.trim() || null : null,
      status: payload.active === false ? AccountStatus.Inactive : AccountStatus.Active,
      shippingAddressId,
      billingAddressId,
      createdById: request.user.id,
      updatedById: request.user.id,
    },
    include: accountIncludeForList,
  })

  await logBotAuditEvent({
    request,
    action: AuditAction.Create,
    entityName: "Account",
    entityId: account.id,
    newValues: {
      accountName: account.accountName,
      accountLegalName: account.accountLegalName,
      accountTypeId: account.accountTypeId,
      ownerId: account.ownerId,
      status: account.status,
    },
    metadata: {
      action: "BotCreateAccount",
    },
  })

  return jsonMutation(request, mapAccountToListRow(account), 201)
}

async function handleListOpportunities(request: BotAuthenticatedRequest) {
  const searchParams = request.nextUrl.searchParams
  const { page, limit, skip } = pagination(searchParams)
  const search = pickSearch(searchParams, "search", "q")
  const accountId = searchParams.get("accountId")?.trim() ?? ""
  const tenantId = request.user.tenantId

  const where: Prisma.OpportunityWhereInput = { tenantId }
  const andFilters: Prisma.OpportunityWhereInput[] = []

  if (accountId) {
    andFilters.push({ accountId })
  }

  if (search) {
    const filter = { contains: search, mode: "insensitive" as const }
    andFilters.push({
      OR: [
        { name: filter },
        { account: { accountName: filter } },
        { account: { accountLegalName: filter } },
        { orderIdHouse: filter },
        { orderIdVendor: filter },
        { customerIdVendor: filter },
        { customerIdDistributor: filter },
        { locationId: filter },
      ],
    })
  }

  if (andFilters.length > 0) {
    where.AND = andFilters
  }

  const [total, opportunities] = await Promise.all([
    prisma.opportunity.count({ where }),
    prisma.opportunity.findMany({
      where,
      include: {
        owner: { select: { firstName: true, lastName: true, fullName: true } },
        account: { select: { id: true, accountName: true, accountLegalName: true } },
        products: {
          select: {
            expectedUsage: true,
            expectedCommission: true,
            product: {
              select: {
                distributor: { select: { id: true, accountName: true } },
                vendor: { select: { id: true, accountName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      skip,
      take: limit,
    }),
  ])

  return jsonList(opportunities.map(mapOpportunityToRow), page, limit, total)
}

async function handleGetOpportunity(request: BotAuthenticatedRequest, opportunityId: string) {
  const opportunity = await prisma.opportunity.findFirst({
    where: { id: opportunityId, tenantId: request.user.tenantId },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true, fullName: true } },
      account: {
        select: {
          id: true,
          accountName: true,
          accountLegalName: true,
          shippingAddress: {
            select: { line1: true, line2: true, city: true, state: true, postalCode: true, country: true },
          },
          billingAddress: {
            select: { line1: true, line2: true, city: true, state: true, postalCode: true, country: true },
          },
        },
      },
      createdBy: { select: { id: true, fullName: true } },
      updatedBy: { select: { id: true, fullName: true } },
      products: {
        include: {
          product: {
            select: {
              id: true,
              productCode: true,
              productNameHouse: true,
              productNameVendor: true,
              revenueType: true,
              priceEach: true,
              distributor: { select: { id: true, accountName: true } },
              vendor: { select: { id: true, accountName: true } },
            },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
      revenueSchedules: {
        where: { deletedAt: null },
        include: {
          product: {
            select: {
              id: true,
              productNameVendor: true,
              commissionPercent: true,
              priceEach: true,
            },
          },
          distributor: { select: { id: true, accountName: true } },
          vendor: { select: { id: true, accountName: true } },
          account: { select: { id: true, accountName: true } },
          opportunity: { select: { id: true, name: true } },
          opportunityProduct: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              unitPrice: true,
            },
          },
        },
        orderBy: [{ scheduleDate: "asc" }],
      },
      activities: {
        include: {
          creator: { select: { firstName: true, lastName: true } },
          assignee: { select: { firstName: true, lastName: true } },
          attachments: {
            include: {
              uploadedBy: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
      },
    },
  })

  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
  }

  return NextResponse.json({ data: mapOpportunityToDetail(opportunity as any) })
}

async function handleCreateOpportunity(request: BotAuthenticatedRequest) {
  const body = await readBody(request)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const tenantId = request.user.tenantId
  const accountId = typeof payload.accountId === "string" ? payload.accountId.trim() : ""
  const name = typeof payload.name === "string" ? payload.name.trim() : ""

  if (!accountId || !name) {
    return NextResponse.json({ error: "accountId and name are required" }, { status: 400 })
  }

  const account = await prisma.account.findFirst({
    where: { id: accountId, tenantId },
    select: { id: true },
  })

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  const stage = typeof payload.stage === "string" && (Object.values(OpportunityStage) as string[]).includes(payload.stage)
    ? (payload.stage as OpportunityStage)
    : OpportunityStage.Qualification

  const leadSource = typeof payload.leadSource === "string" && (Object.values(LeadSource) as string[]).includes(payload.leadSource)
    ? (payload.leadSource as LeadSource)
    : LeadSource.Referral

  const ownerId = payload.ownerId !== undefined
    ? await ensureActiveOwnerOrNull(payload.ownerId, tenantId)
    : request.user.id

  const estimatedCloseDate =
    typeof payload.estimatedCloseDate === "string" && payload.estimatedCloseDate.trim().length > 0
      ? new Date(payload.estimatedCloseDate)
      : null

  if (estimatedCloseDate && Number.isNaN(estimatedCloseDate.getTime())) {
    return NextResponse.json({ error: "estimatedCloseDate must be a valid date" }, { status: 400 })
  }

  const opportunity = await prisma.opportunity.create({
    data: {
      tenantId,
      accountId,
      ownerId,
      name,
      stage,
      status: stage === OpportunityStage.ClosedLost ? OpportunityStatus.Lost : OpportunityStatus.Open,
      type:
        typeof payload.type === "string" && (Object.values(OpportunityType) as string[]).includes(payload.type)
          ? (payload.type as OpportunityType)
          : OpportunityType.NewBusiness,
      leadSource,
      estimatedCloseDate,
      description: typeof payload.description === "string" ? payload.description.trim() || null : null,
      referredBy: typeof payload.referredBy === "string" ? payload.referredBy.trim() || null : null,
      accountIdHouse: typeof payload.accountIdHouse === "string" ? payload.accountIdHouse.trim() || null : null,
      accountIdVendor: typeof payload.accountIdVendor === "string" ? payload.accountIdVendor.trim() || null : null,
      accountIdDistributor: typeof payload.accountIdDistributor === "string" ? payload.accountIdDistributor.trim() || null : null,
      customerIdHouse: typeof payload.customerIdHouse === "string" ? payload.customerIdHouse.trim() || null : null,
      customerIdVendor: typeof payload.customerIdVendor === "string" ? payload.customerIdVendor.trim() || null : null,
      customerIdDistributor: typeof payload.customerIdDistributor === "string" ? payload.customerIdDistributor.trim() || null : null,
      locationId: typeof payload.locationId === "string" ? payload.locationId.trim() || null : null,
      orderIdHouse: typeof payload.orderIdHouse === "string" ? payload.orderIdHouse.trim() || null : null,
      orderIdVendor: typeof payload.orderIdVendor === "string" ? payload.orderIdVendor.trim() || null : null,
      orderIdDistributor: typeof payload.orderIdDistributor === "string" ? payload.orderIdDistributor.trim() || null : null,
      customerPurchaseOrder:
        typeof payload.customerPurchaseOrder === "string" ? payload.customerPurchaseOrder.trim() || null : null,
      subagentPercent: decimal(toNumber(payload.subagentPercent)),
      houseRepPercent: decimal(toNumber(payload.houseRepPercent)),
      houseSplitPercent: decimal(toNumber(payload.houseSplitPercent)),
      createdById: request.user.id,
      updatedById: request.user.id,
    },
  })

  await logBotAuditEvent({
    request,
    action: AuditAction.Create,
    entityName: "Opportunity",
    entityId: opportunity.id,
    newValues: {
      accountId: opportunity.accountId,
      ownerId: opportunity.ownerId,
      name: opportunity.name,
      stage: opportunity.stage,
      leadSource: opportunity.leadSource,
      estimatedCloseDate: opportunity.estimatedCloseDate,
    },
    metadata: {
      action: "BotCreateOpportunity",
    },
  })

  return jsonMutation(request, {
    id: opportunity.id,
    accountId: opportunity.accountId,
    ownerId: opportunity.ownerId,
    name: opportunity.name,
    stage: opportunity.stage,
    status: opportunity.status,
    estimatedCloseDate: toDateTime(opportunity.estimatedCloseDate),
    createdAt: toDateTime(opportunity.createdAt),
  }, 201)
}

async function handleListProducts(request: BotAuthenticatedRequest) {
  const searchParams = request.nextUrl.searchParams
  const { page, limit, skip } = pagination(searchParams)
  const search = pickSearch(searchParams, "search", "q")
  const tenantId = request.user.tenantId

  const where: Prisma.ProductWhereInput = {
    tenantId,
    isActive: searchParams.get("status")?.trim().toLowerCase() === "inactive" ? false : true,
  }

  if (search) {
    const filter = { contains: search, mode: "insensitive" as const }
    where.OR = [
      { productNameHouse: filter },
      { productNameVendor: filter },
      { productCode: filter },
      { partNumberVendor: filter },
      { productDescriptionVendor: filter },
      { distributor: { accountName: filter } },
      { vendor: { accountName: filter } },
    ]
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        distributor: { select: { id: true, accountName: true } },
        vendor: { select: { id: true, accountName: true } },
        _count: { select: { revenueSchedules: true } },
      },
      orderBy: [{ productNameHouse: "asc" }],
      skip,
      take: limit,
    }),
  ])

  return jsonList(products.map(mapProductToRow), page, limit, total)
}

async function handleAttachProduct(request: BotAuthenticatedRequest, opportunityId: string) {
  const body = await readBody(request)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const productId = typeof payload.productId === "string" ? payload.productId.trim() : ""
  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 })
  }

  const tenantId = request.user.tenantId
  const [opportunity, product] = await Promise.all([
    prisma.opportunity.findFirst({
      where: { id: opportunityId, tenantId },
      select: { id: true, accountId: true },
    }),
    prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: {
        distributor: { select: { id: true, accountName: true } },
        vendor: { select: { id: true, accountName: true } },
      },
    }),
  ])

  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
  }

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  const quantity = toNumber(payload.quantity) ?? 1
  const unitPrice = toNumber(payload.unitPrice) ?? toNumber(product.priceEach) ?? 0
  const expectedUsage = toNumber(payload.expectedUsage) ?? roundCurrency(quantity * unitPrice)
  const expectedRevenue = toNumber(payload.expectedRevenue) ?? expectedUsage
  const ratePercent = toNumber(payload.commissionPercent) ?? toNumber(product.commissionPercent) ?? 0
  const expectedCommission = toNumber(payload.expectedCommission) ?? roundCurrency(expectedUsage * (ratePercent / 100))

  const lineItem = await prisma.opportunityProduct.create({
    data: {
      tenantId,
      opportunityId: opportunity.id,
      productId: product.id,
      productCodeSnapshot: product.productCode,
      productNameHouseSnapshot: product.productNameHouse,
      productNameVendorSnapshot: product.productNameVendor,
      revenueTypeSnapshot: product.revenueType,
      priceEachSnapshot: product.priceEach,
      commissionPercentSnapshot: product.commissionPercent,
      distributorNameSnapshot: product.distributor?.accountName ?? null,
      vendorNameSnapshot: product.vendor?.accountName ?? null,
      distributorAccountIdSnapshot: product.distributorAccountId ?? null,
      vendorAccountIdSnapshot: product.vendorAccountId ?? null,
      descriptionSnapshot: product.description ?? null,
      quantity: decimal(quantity),
      unitPrice: decimal(unitPrice),
      expectedUsage: decimal(expectedUsage),
      expectedRevenue: decimal(expectedRevenue),
      expectedCommission: decimal(expectedCommission),
      revenueStartDate:
        typeof payload.revenueStartDate === "string" && payload.revenueStartDate.trim()
          ? new Date(payload.revenueStartDate)
          : null,
      revenueEndDate:
        typeof payload.revenueEndDate === "string" && payload.revenueEndDate.trim()
          ? new Date(payload.revenueEndDate)
          : null,
    },
  })

  await logBotAuditEvent({
    request,
    action: AuditAction.Create,
    entityName: "OpportunityProduct",
    entityId: lineItem.id,
    newValues: {
      opportunityId: lineItem.opportunityId,
      productId: lineItem.productId,
      quantity,
      unitPrice,
      expectedUsage,
      expectedCommission,
    },
    metadata: {
      action: "BotAttachProductToOpportunity",
    },
  })

  return jsonMutation(request, {
    id: lineItem.id,
    opportunityId: lineItem.opportunityId,
    productId: lineItem.productId,
    quantity,
    unitPrice,
    expectedUsage,
    expectedRevenue,
    expectedCommission,
    createdAt: toDateTime(lineItem.createdAt),
  }, 201)
}

async function handleListSchedules(request: BotAuthenticatedRequest) {
  const searchParams = request.nextUrl.searchParams
  const { page, limit, skip } = pagination(searchParams)
  const tenantId = request.user.tenantId
  const opportunityId = searchParams.get("opportunityId")?.trim() ?? ""

  const where: Prisma.RevenueScheduleWhereInput = {
    tenantId,
    deletedAt: null,
    ...(opportunityId ? { opportunityId } : {}),
  }

  const [total, schedules] = await Promise.all([
    prisma.revenueSchedule.count({ where }),
    prisma.revenueSchedule.findMany({
      where,
      include: {
        account: { select: { id: true, accountName: true, accountLegalName: true } },
        distributor: { select: { id: true, accountName: true } },
        vendor: { select: { id: true, accountName: true } },
        product: {
          select: {
            id: true,
            productNameHouse: true,
            productNameVendor: true,
            commissionPercent: true,
            priceEach: true,
          },
        },
        opportunityProduct: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            unitPrice: true,
            expectedUsage: true,
            expectedCommission: true,
          },
        },
        opportunity: { select: { id: true, name: true } },
      },
      orderBy: [{ scheduleDate: "asc" }, { createdAt: "asc" }],
      skip,
      take: limit,
    }),
  ])

  return jsonList(schedules.map(mapScheduleSummary), page, limit, total)
}

async function handleGetSchedule(request: BotAuthenticatedRequest, scheduleId: string) {
  const schedule = await prisma.revenueSchedule.findFirst({
    where: { id: scheduleId, tenantId: request.user.tenantId },
    include: {
      account: {
        select: {
          id: true,
          accountName: true,
          accountLegalName: true,
        },
      },
      distributor: { select: { id: true, accountName: true } },
      vendor: { select: { id: true, accountName: true } },
      product: {
        select: {
          id: true,
          productNameHouse: true,
          productNameVendor: true,
          productDescriptionVendor: true,
          revenueType: true,
          commissionPercent: true,
          priceEach: true,
        },
      },
      opportunityProduct: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          unitPrice: true,
          expectedUsage: true,
          expectedCommission: true,
        },
      },
      opportunity: {
        select: {
          id: true,
          name: true,
          owner: { select: { fullName: true } },
        },
      },
      childRevenueSchedules: {
        where: { deletedAt: null },
        select: {
          id: true,
          scheduleNumber: true,
          scheduleDate: true,
          flexClassification: true,
        },
        orderBy: [{ scheduleDate: "asc" }],
      },
      depositLineMatches: {
        where: { status: DepositLineMatchStatus.Applied },
        select: {
          id: true,
          usageAmount: true,
          commissionAmount: true,
          depositLineItemId: true,
        },
      },
    },
  })

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
  }

  const history = await prisma.auditLog.findMany({
    where: {
      tenantId: request.user.tenantId,
      entityName: "RevenueSchedule",
      entityId: scheduleId,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  })

  return NextResponse.json({
    data: {
      ...mapScheduleSummary(schedule),
      details: {
        opportunityOwnerName: schedule.opportunity?.owner?.fullName ?? null,
        productRevenueType: schedule.product?.revenueType ?? null,
        productDescriptionVendor: schedule.product?.productDescriptionVendor ?? null,
        orderIdHouse: schedule.orderIdHouse ?? null,
        distributorOrderId: schedule.distributorOrderId ?? null,
        notes: schedule.notes ?? null,
        comments: schedule.comments ?? null,
      },
      childSchedules: schedule.childRevenueSchedules.map((row) => ({
        id: row.id,
        scheduleNumber: row.scheduleNumber ?? null,
        scheduleDate: toDateOnly(row.scheduleDate),
        flexClassification: row.flexClassification,
      })),
      matches: schedule.depositLineMatches.map((row) => ({
        id: row.id,
        depositLineItemId: row.depositLineItemId,
        usageAmount: toNumber(row.usageAmount),
        commissionAmount: toNumber(row.commissionAmount),
      })),
      history: history.map(mapAuditRecord),
    },
  })
}

async function handlePatchSchedule(request: BotAuthenticatedRequest, scheduleId: string) {
  const body = await readBody(request)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const existing = await prisma.revenueSchedule.findFirst({
    where: { id: scheduleId, tenantId: request.user.tenantId, deletedAt: null },
    select: {
      id: true,
      scheduleDate: true,
      expectedUsage: true,
      usageAdjustment: true,
      expectedCommission: true,
      expectedCommissionRatePercent: true,
      expectedCommissionAdjustment: true,
      notes: true,
      billingStatus: true,
    },
  })

  if (!existing) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
  }

  const data: Prisma.RevenueScheduleUpdateInput = {
    updatedBy: { connect: { id: request.user.id } },
  }

  if ("scheduleDate" in payload) {
    const parsed = typeof payload.scheduleDate === "string" ? new Date(payload.scheduleDate) : null
    if (!parsed || Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "scheduleDate must be a valid date" }, { status: 400 })
    }
    data.scheduleDate = parsed
  }

  if ("expectedUsage" in payload) {
    const value = toNumber(payload.expectedUsage)
    if (value === null) return NextResponse.json({ error: "expectedUsage must be numeric" }, { status: 400 })
    data.expectedUsage = decimal(value)
  }

  if ("usageAdjustment" in payload || "adjustmentUsage" in payload) {
    const value = toNumber(payload.usageAdjustment ?? payload.adjustmentUsage)
    if (value === null) return NextResponse.json({ error: "usageAdjustment must be numeric" }, { status: 400 })
    data.usageAdjustment = decimal(value)
  }

  if ("expectedCommission" in payload) {
    const value = toNumber(payload.expectedCommission)
    if (value === null) return NextResponse.json({ error: "expectedCommission must be numeric" }, { status: 400 })
    data.expectedCommission = decimal(value)
  }

  if ("expectedCommissionRatePercent" in payload || "commissionRatePercent" in payload) {
    const value = toNumber(payload.expectedCommissionRatePercent ?? payload.commissionRatePercent)
    if (value === null) {
      return NextResponse.json({ error: "expectedCommissionRatePercent must be numeric" }, { status: 400 })
    }
    data.expectedCommissionRatePercent = decimal(value)
  }

  if ("expectedCommissionAdjustment" in payload || "adjustmentCommission" in payload || "amountAdjustment" in payload) {
    const value = toNumber(payload.expectedCommissionAdjustment ?? payload.adjustmentCommission ?? payload.amountAdjustment)
    if (value === null) {
      return NextResponse.json({ error: "expectedCommissionAdjustment must be numeric" }, { status: 400 })
    }
    data.expectedCommissionAdjustment = decimal(value)
  }

  if ("notes" in payload) {
    data.notes = typeof payload.notes === "string" ? payload.notes.trim() || null : null
  }

  if ("billingStatus" in payload) {
    const value = typeof payload.billingStatus === "string" ? payload.billingStatus.trim() : ""
    if (!(Object.values(RevenueScheduleBillingStatus) as string[]).includes(value)) {
      return NextResponse.json({ error: "Invalid billingStatus" }, { status: 400 })
    }
    data.billingStatus = value as RevenueScheduleBillingStatus
    data.billingStatusSource = RevenueScheduleBillingStatusSource.Manual
    data.billingStatusUpdatedAt = new Date()
    data.billingStatusUpdatedBy = { connect: { id: request.user.id } }
  }

  const updated = await prisma.revenueSchedule.update({
    where: { id: scheduleId },
    data,
    include: {
      account: { select: { id: true, accountName: true, accountLegalName: true } },
      distributor: { select: { id: true, accountName: true } },
      vendor: { select: { id: true, accountName: true } },
      product: {
        select: {
          id: true,
          productNameHouse: true,
          productNameVendor: true,
          commissionPercent: true,
          priceEach: true,
        },
      },
      opportunityProduct: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          unitPrice: true,
          expectedUsage: true,
          expectedCommission: true,
        },
      },
      opportunity: { select: { id: true, name: true } },
    },
  })

  await logBotAuditEvent({
    request,
    action: AuditAction.Update,
    entityName: "RevenueSchedule",
    entityId: scheduleId,
    previousValues: {
      scheduleDate: existing.scheduleDate,
      expectedUsage: existing.expectedUsage,
      usageAdjustment: existing.usageAdjustment,
      expectedCommission: existing.expectedCommission,
      expectedCommissionRatePercent: existing.expectedCommissionRatePercent,
      expectedCommissionAdjustment: existing.expectedCommissionAdjustment,
      notes: existing.notes,
      billingStatus: existing.billingStatus,
    },
    newValues: {
      scheduleDate: updated.scheduleDate,
      expectedUsage: updated.expectedUsage,
      usageAdjustment: updated.usageAdjustment,
      expectedCommission: updated.expectedCommission,
      expectedCommissionRatePercent: (updated as any).expectedCommissionRatePercent ?? null,
      expectedCommissionAdjustment: (updated as any).expectedCommissionAdjustment ?? null,
      notes: updated.notes,
      billingStatus: updated.billingStatus,
    },
    metadata: {
      action: "BotPatchSchedule",
    },
  })

  return jsonMutation(request, mapScheduleSummary(updated))
}

async function handleCreateSchedule(request: BotAuthenticatedRequest) {
  const body = await readBody(request)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const tenantId = request.user.tenantId
  let accountId = typeof payload.accountId === "string" ? payload.accountId.trim() : ""
  const opportunityId = typeof payload.opportunityId === "string" ? payload.opportunityId.trim() : ""
  const opportunityProductId = typeof payload.opportunityProductId === "string" ? payload.opportunityProductId.trim() : ""
  let productId = typeof payload.productId === "string" ? payload.productId.trim() : ""

  let opportunity: { id: string; accountId: string } | null = null
  if (opportunityId) {
    opportunity = await prisma.opportunity.findFirst({
      where: { id: opportunityId, tenantId },
      select: { id: true, accountId: true },
    })

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
    }

    accountId = accountId || opportunity.accountId
  }

  if (opportunityProductId) {
    const oppProduct = await prisma.opportunityProduct.findFirst({
      where: { id: opportunityProductId, tenantId },
      select: {
        id: true,
        productId: true,
        opportunityId: true,
      },
    })

    if (!oppProduct) {
      return NextResponse.json({ error: "Opportunity product not found" }, { status: 404 })
    }

    productId = productId || oppProduct.productId
  }

  if (!accountId) {
    return NextResponse.json({ error: "accountId or opportunityId is required" }, { status: 400 })
  }

  const product = productId
    ? await prisma.product.findFirst({
        where: { id: productId, tenantId },
        select: {
          id: true,
          commissionPercent: true,
          vendorAccountId: true,
          distributorAccountId: true,
        },
      })
    : null

  if (productId && !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  const scheduleDate =
    typeof payload.scheduleDate === "string" && payload.scheduleDate.trim()
      ? new Date(payload.scheduleDate)
      : null

  if (!scheduleDate || Number.isNaN(scheduleDate.getTime())) {
    return NextResponse.json({ error: "scheduleDate is required and must be valid" }, { status: 400 })
  }

  const expectedUsage = toNumber(payload.expectedUsage)
  const expectedCommissionRatePercent =
    toNumber(payload.expectedCommissionRatePercent) ?? toNumber(product?.commissionPercent)
  const expectedCommission =
    toNumber(payload.expectedCommission) ??
    (expectedUsage !== null && expectedCommissionRatePercent !== null
      ? roundCurrency(expectedUsage * (expectedCommissionRatePercent / 100))
      : null)

  const created = await prisma.revenueSchedule.create({
    data: {
      tenantId,
      opportunityId: opportunity?.id ?? (opportunityId || null),
      opportunityProductId: opportunityProductId || null,
      accountId,
      productId: productId || null,
      parentRevenueScheduleId:
        typeof payload.parentRevenueScheduleId === "string" ? payload.parentRevenueScheduleId.trim() || null : null,
      distributorAccountId:
        typeof payload.distributorAccountId === "string"
          ? payload.distributorAccountId.trim() || null
          : product?.distributorAccountId ?? null,
      vendorAccountId:
        typeof payload.vendorAccountId === "string"
          ? payload.vendorAccountId.trim() || null
          : product?.vendorAccountId ?? null,
      scheduleNumber: await generateRevenueScheduleName(prisma),
      scheduleDate,
      scheduleType:
        typeof payload.scheduleType === "string" && (Object.values(RevenueScheduleType) as string[]).includes(payload.scheduleType)
          ? (payload.scheduleType as RevenueScheduleType)
          : RevenueScheduleType.Recurring,
      flexClassification:
        typeof payload.flexClassification === "string" &&
        (Object.values(RevenueScheduleFlexClassification) as string[]).includes(payload.flexClassification)
          ? (payload.flexClassification as RevenueScheduleFlexClassification)
          : RevenueScheduleFlexClassification.Normal,
      flexReasonCode:
        typeof payload.flexReasonCode === "string" &&
        (Object.values(RevenueScheduleFlexReasonCode) as string[]).includes(payload.flexReasonCode)
          ? (payload.flexReasonCode as RevenueScheduleFlexReasonCode)
          : null,
      flexSourceDepositId:
        typeof payload.flexSourceDepositId === "string" ? payload.flexSourceDepositId.trim() || null : null,
      flexSourceDepositLineItemId:
        typeof payload.flexSourceDepositLineItemId === "string"
          ? payload.flexSourceDepositLineItemId.trim() || null
          : null,
      expectedUsage: decimal(expectedUsage),
      expectedCommission: decimal(expectedCommission),
      expectedCommissionRatePercent: decimal(expectedCommissionRatePercent),
      notes: typeof payload.notes === "string" ? payload.notes.trim() || null : null,
      createdById: request.user.id,
      updatedById: request.user.id,
    },
    include: {
      account: { select: { id: true, accountName: true, accountLegalName: true } },
      distributor: { select: { id: true, accountName: true } },
      vendor: { select: { id: true, accountName: true } },
      product: {
        select: {
          id: true,
          productNameHouse: true,
          productNameVendor: true,
          commissionPercent: true,
          priceEach: true,
        },
      },
      opportunityProduct: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          unitPrice: true,
          expectedUsage: true,
          expectedCommission: true,
        },
      },
      opportunity: { select: { id: true, name: true } },
    },
  })

  await logBotAuditEvent({
    request,
    action: AuditAction.Create,
    entityName: "RevenueSchedule",
    entityId: created.id,
    newValues: {
      opportunityId: created.opportunityId,
      accountId: created.accountId,
      productId: created.productId,
      scheduleNumber: created.scheduleNumber,
      scheduleDate: created.scheduleDate,
      flexClassification: created.flexClassification,
      flexReasonCode: created.flexReasonCode,
      expectedUsage: created.expectedUsage,
      expectedCommission: created.expectedCommission,
    },
    metadata: {
      action: "BotCreateSchedule",
    },
  })

  return jsonMutation(request, mapScheduleSummary(created), 201)
}

async function handleDeleteSchedule(request: BotAuthenticatedRequest, scheduleId: string) {
  const schedule = await prisma.revenueSchedule.findFirst({
    where: { id: scheduleId, tenantId: request.user.tenantId },
    select: {
      id: true,
      flexClassification: true,
      deletedAt: true,
    },
  })

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
  }

  if (schedule.flexClassification === RevenueScheduleFlexClassification.Normal) {
    return NextResponse.json({ error: "Only Flex schedules can be deleted via the bot endpoint." }, { status: 400 })
  }

  const [matchCount, ticketCount, payoutCount] = await Promise.all([
    prisma.depositLineMatch.count({
      where: { tenantId: request.user.tenantId, revenueScheduleId: scheduleId, status: DepositLineMatchStatus.Applied },
    }),
    prisma.ticket.count({ where: { tenantId: request.user.tenantId, revenueScheduleId: scheduleId } }),
    prisma.commissionPayout.count({ where: { tenantId: request.user.tenantId, revenueScheduleId: scheduleId } }),
  ])

  if (matchCount > 0 || ticketCount > 0 || payoutCount > 0) {
    return NextResponse.json(
      {
        error: "Cannot delete a schedule that still has applied matches, tickets, or payouts.",
        duplicates: [],
      },
      { status: 409 },
    )
  }

  const deletedAt = schedule.deletedAt ?? new Date()
  await prisma.revenueSchedule.update({
    where: { id: scheduleId },
    data: {
      deletedAt,
      updatedById: request.user.id,
    },
  })

  await logBotAuditEvent({
    request,
    action: AuditAction.Delete,
    entityName: "RevenueSchedule",
    entityId: scheduleId,
    previousValues: {
      deletedAt: schedule.deletedAt,
      flexClassification: schedule.flexClassification,
    },
    newValues: {
      deletedAt,
      flexClassification: schedule.flexClassification,
    },
    metadata: {
      action: "BotDeleteFlexSchedule",
    },
  })

  return jsonMutation(request, { id: scheduleId, deletedAt: toDateTime(deletedAt) })
}

async function handleGetAudit(request: BotAuthenticatedRequest) {
  const searchParams = request.nextUrl.searchParams
  const entityId = searchParams.get("entityId")?.trim() ?? ""
  const entityType = searchParams.get("entityType")?.trim() ?? ""
  const { page, limit, skip } = pagination(searchParams)

  if (!entityId || !entityType) {
    return NextResponse.json({ error: "entityId and entityType are required" }, { status: 400 })
  }

  const where = {
    tenantId: request.user.tenantId,
    entityId,
    entityName: entityType,
  }

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: limit,
    }),
  ])

  return jsonList(rows.map(mapAuditRecord), page, limit, total)
}

async function handleCreateAudit(request: BotAuthenticatedRequest) {
  const body = await readBody(request)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const entityType = typeof payload.entityType === "string" ? payload.entityType.trim() : ""
  const entityId = typeof payload.entityId === "string" ? payload.entityId.trim() : ""

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 })
  }

  const before = payload.before && typeof payload.before === "object" ? (payload.before as Record<string, unknown>) : undefined
  const after = payload.after && typeof payload.after === "object" ? (payload.after as Record<string, unknown>) : undefined
  const changedFields = before && after ? getChangedFields(before, after) : undefined

  await logAudit({
    userId: request.user.id,
    tenantId: request.user.tenantId,
    action: parseAuditAction(payload.action),
    entityName: entityType,
    entityId,
    requestId: request.bot.transactionId,
    changedFields,
    previousValues: before,
    newValues: after,
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request),
    metadata: {
      actorType: "bot",
      botProvider: "openclaw",
      requestedBy: request.bot.requestedBy,
      user: payload.user ?? null,
      timestamp: payload.timestamp ?? null,
      payloadDiff: payload.payloadDiff ?? null,
      ...(payload.metadata && typeof payload.metadata === "object" ? (payload.metadata as Record<string, unknown>) : {}),
    },
  })

  return jsonMutation(request, {
    entityType,
    entityId,
    action: parseAuditAction(payload.action),
  }, 201)
}

async function dispatchGet(request: NextRequest, path: string[]) {
  if (path.length === 1 && path[0] === "deposits") {
    return withBotAuth(request, DEPOSIT_READ_PERMISSIONS, handleListDeposits)
  }
  if (path.length === 2 && path[0] === "deposits") {
    return withBotAuth(request, DEPOSIT_READ_PERMISSIONS, (req) => handleGetDeposit(req, path[1]!))
  }
  if (path.length === 1 && path[0] === "accounts") {
    return withBotAuth(request, ACCOUNT_PERMISSIONS, handleListAccounts)
  }
  if (path.length === 2 && path[0] === "accounts") {
    return withBotAuth(request, ACCOUNT_PERMISSIONS, (req) => handleGetAccount(req, path[1]!))
  }
  if (path.length === 1 && path[0] === "opportunities") {
    return withBotAuth(request, OPPORTUNITY_READ_PERMISSIONS, handleListOpportunities)
  }
  if (path.length === 2 && path[0] === "opportunities") {
    return withBotAuth(request, OPPORTUNITY_READ_PERMISSIONS, (req) => handleGetOpportunity(req, path[1]!))
  }
  if (path.length === 1 && path[0] === "products") {
    return withBotAuth(request, PRODUCT_PERMISSIONS, handleListProducts)
  }
  if (path.length === 1 && path[0] === "schedules") {
    return withBotAuth(request, SCHEDULE_PERMISSIONS, handleListSchedules)
  }
  if (path.length === 2 && path[0] === "schedules") {
    return withBotAuth(request, SCHEDULE_PERMISSIONS, (req) => handleGetSchedule(req, path[1]!))
  }
  if (path.length === 1 && path[0] === "audit") {
    return withBotAuth(request, [], handleGetAudit)
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

async function dispatchPost(request: NextRequest, path: string[]) {
  if (path.length === 1 && path[0] === "accounts") {
    return withBotAuth(request, ACCOUNT_WRITE_PERMISSIONS, handleCreateAccount)
  }
  if (path.length === 1 && path[0] === "opportunities") {
    return withBotAuth(request, OPPORTUNITY_WRITE_PERMISSIONS, handleCreateOpportunity)
  }
  if (path.length === 3 && path[0] === "opportunities" && path[2] === "products") {
    return withBotAuth(request, OPPORTUNITY_WRITE_PERMISSIONS, (req) => handleAttachProduct(req, path[1]!))
  }
  if (path.length === 1 && path[0] === "schedules") {
    return withBotAuth(request, SCHEDULE_PERMISSIONS, handleCreateSchedule)
  }
  if (path.length === 1 && path[0] === "audit") {
    return withBotAuth(request, [], handleCreateAudit)
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

async function dispatchPatch(request: NextRequest, path: string[]) {
  if (path.length === 4 && path[0] === "deposits" && path[2] === "lines") {
    return withBotAuth(request, DEPOSIT_WRITE_PERMISSIONS, (req) => handlePatchDepositLine(req, path[1]!, path[3]!))
  }
  if (path.length === 2 && path[0] === "schedules") {
    return withBotAuth(request, SCHEDULE_PERMISSIONS, (req) => handlePatchSchedule(req, path[1]!))
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

async function dispatchDelete(request: NextRequest, path: string[]) {
  if (path.length === 2 && path[0] === "schedules") {
    return withBotAuth(request, SCHEDULE_PERMISSIONS, (req) => handleDeleteSchedule(req, path[1]!))
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function GET(request: NextRequest, context: RouteContext) {
  return dispatchGet(request, normalizePath(context.params))
}

export async function POST(request: NextRequest, context: RouteContext) {
  return dispatchPost(request, normalizePath(context.params))
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return dispatchPatch(request, normalizePath(context.params))
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return dispatchDelete(request, normalizePath(context.params))
}
