import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { AuditAction, DataEntity, Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withBotAuth, type BotAuthenticatedRequest, logBotAuditEvent } from "@/lib/bot-auth"
import {
  OPENCLAW_READ_ONLY_TOOL_DEFINITIONS,
  OPENCLAW_V1_CAPABILITY_REGISTRY_VERSION,
  OPENCLAW_V1_INTENT_CAPABILITIES,
  buildOpenClawRuntimeContract,
  rankTopUsageAccounts,
  resolveIntentFromMessage,
  resolveCalendarDateRange,
} from "@/lib/openclaw/read-only-tools"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: {
    path?: string[]
  }
}

const ACCOUNT_READ_PERMISSIONS = ["accounts.read", "accounts.manage"]
const CONTACT_READ_PERMISSIONS = ["contacts.read", "contacts.manage"]
const PRODUCT_READ_PERMISSIONS = ["products.read", "products.update", "products.create", "products.delete"]
const OPPORTUNITY_READ_PERMISSIONS = [
  "opportunities.read",
  "opportunities.view.all",
  "opportunities.view.assigned",
  "opportunities.edit.all",
  "opportunities.edit.assigned",
  "opportunities.manage",
  "accounts.read",
  "accounts.manage",
]
const SCHEDULE_READ_PERMISSIONS = ["reconciliation.view", "revenue-schedules.manage"]
const RECONCILIATION_READ_PERMISSIONS = ["reconciliation.view"]
const IMPORT_READ_PERMISSIONS = ["admin.data_settings.manage", "system.settings.read", "system.settings.write"]
const TICKET_DRAFT_PERMISSIONS = ["reconciliation.view", "accounts.read", "contacts.read", "tickets.read", "tickets.manage"]

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 25

function normalizePath(params: RouteContext["params"]) {
  return Array.isArray(params.path) ? params.path.filter(Boolean) : []
}

function parseLimit(searchParams: URLSearchParams, fallback = DEFAULT_LIMIT, max = MAX_LIMIT) {
  const parsed = Number.parseInt(searchParams.get("limit") ?? searchParams.get("pageSize") ?? "", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

function parsePage(searchParams: URLSearchParams) {
  const parsed = Number.parseInt(searchParams.get("page") ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function pagination(searchParams: URLSearchParams, max = MAX_LIMIT) {
  const page = parsePage(searchParams)
  const limit = parseLimit(searchParams, DEFAULT_LIMIT, max)
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  }
}

function stringParam(searchParams: URLSearchParams, ...keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key)?.trim()
    if (value) return value
  }
  return ""
}

function dateParam(searchParams: URLSearchParams, ...keys: string[]) {
  const raw = stringParam(searchParams, ...keys)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (typeof value === "object" && value && "toNumber" in value) {
    try {
      const parsed = (value as { toNumber: () => number }).toNumber()
      return Number.isFinite(parsed) ? parsed : 0
    } catch {
      return 0
    }
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function dateOnly(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function dateTime(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function jsonList(data: unknown[], page: number, limit: number, total: number, context: Record<string, unknown>) {
  return NextResponse.json({
    status: "success",
    data,
    pagination: {
      page,
      limit,
      total,
      hasMore: page * limit < total,
    },
    context,
  })
}

function jsonData(data: unknown, context: Record<string, unknown> = {}) {
  return NextResponse.json({
    status: "success",
    data,
    context,
  })
}

async function logToolRead(request: BotAuthenticatedRequest, toolName: string, resultCount?: number) {
  await logBotAuditEvent({
    request,
    action: AuditAction.Export,
    entityName: "OpenClawTool",
    entityId: toolName,
    metadata: {
      botTool: toolName,
      resultCount: resultCount ?? null,
      readOnly: true,
    },
  })
}

function recordLink(baseUrl: string, entityType: string, id: string) {
  const origin = baseUrl.replace(/\/+$/, "")
  switch (entityType) {
    case "account":
      return `${origin}/accounts/${id}`
    case "contact":
      return `${origin}/contacts/${id}`
    case "opportunity":
      return `${origin}/opportunities/${id}`
    case "product":
      return `${origin}/products/${id}`
    case "revenueSchedule":
      return `${origin}/revenue-schedules/${id}`
    case "deposit":
      return `${origin}/reconciliation/${id}`
    case "ticket":
      return `${origin}/tickets/${id}`
    default:
      return null
  }
}

function mapSchedule(schedule: any) {
  const expectedUsage = toNumber(schedule.expectedUsage)
  const usageAdjustment = toNumber(schedule.usageAdjustment)
  const actualUsage = toNumber(schedule.actualUsage)
  const actualUsageAdjustment = toNumber(schedule.actualUsageAdjustment)
  const expectedCommission = toNumber(schedule.expectedCommission)
  const expectedCommissionAdjustment = toNumber(schedule.expectedCommissionAdjustment)
  const actualCommission = toNumber(schedule.actualCommission)
  const actualCommissionAdjustment = toNumber(schedule.actualCommissionAdjustment)

  return {
    id: schedule.id,
    scheduleNumber: schedule.scheduleNumber,
    scheduleDate: dateOnly(schedule.scheduleDate),
    scheduleType: schedule.scheduleType,
    status: schedule.status,
    billingStatus: schedule.billingStatus,
    flexClassification: schedule.flexClassification,
    account: schedule.account ? { id: schedule.account.id, accountName: schedule.account.accountName } : null,
    vendor: schedule.vendor ? { id: schedule.vendor.id, accountName: schedule.vendor.accountName } : null,
    distributor: schedule.distributor ? { id: schedule.distributor.id, accountName: schedule.distributor.accountName } : null,
    product: schedule.product
      ? {
          id: schedule.product.id,
          productCode: schedule.product.productCode,
          productNameHouse: schedule.product.productNameHouse,
          productNameVendor: schedule.product.productNameVendor,
          revenueType: schedule.product.revenueType,
        }
      : null,
    opportunity: schedule.opportunity ? { id: schedule.opportunity.id, name: schedule.opportunity.name } : null,
    balances: {
      expectedUsage,
      usageAdjustment,
      expectedUsageNet: round(expectedUsage + usageAdjustment),
      actualUsage,
      actualUsageAdjustment,
      actualUsageNet: round(actualUsage + actualUsageAdjustment),
      usageBalance: round(expectedUsage + usageAdjustment - actualUsage - actualUsageAdjustment),
      expectedCommission,
      expectedCommissionAdjustment,
      expectedCommissionNet: round(expectedCommission + expectedCommissionAdjustment),
      actualCommission,
      actualCommissionAdjustment,
      actualCommissionNet: round(actualCommission + actualCommissionAdjustment),
      commissionBalance: round(expectedCommission + expectedCommissionAdjustment - actualCommission - actualCommissionAdjustment),
      expectedCommissionRatePercent: toNumber(schedule.expectedCommissionRatePercent),
    },
    updatedAt: dateTime(schedule.updatedAt),
  }
}

async function handleManifest(request: BotAuthenticatedRequest) {
  const tools = OPENCLAW_READ_ONLY_TOOL_DEFINITIONS.map((tool) => tool.path)
  const runtimeContract = buildOpenClawRuntimeContract("/api/bot/v1/tools")

  await logToolRead(request, "manifest", tools.length)
  return jsonData({
    name: "Commissable OpenClaw Read-Only Tool Gateway",
    version: "v1",
    basePath: "/api/bot/v1/tools",
    auth: "Authorization: Bearer <OPENCLAW_API_KEY>",
    tools,
    toolDefinitions: OPENCLAW_READ_ONLY_TOOL_DEFINITIONS,
    capabilityRegistry: {
      version: OPENCLAW_V1_CAPABILITY_REGISTRY_VERSION,
      path: "/api/bot/v1/tools/capabilities",
      intentCount: OPENCLAW_V1_INTENT_CAPABILITIES.length,
    },
    capabilityResolver: {
      path: runtimeContract.capabilityResolverPath,
      routeDiscoveryAllowed: runtimeContract.routeDiscoveryAllowed,
    },
    runtimeContract,
  })
}

async function handleCapabilities(request: BotAuthenticatedRequest) {
  await logToolRead(request, "capabilities", OPENCLAW_V1_INTENT_CAPABILITIES.length)
  return jsonData({
    version: OPENCLAW_V1_CAPABILITY_REGISTRY_VERSION,
    basePath: "/api/bot/v1/tools",
    runtimeContract: buildOpenClawRuntimeContract("/api/bot/v1/tools"),
    tools: OPENCLAW_READ_ONLY_TOOL_DEFINITIONS,
    capabilities: OPENCLAW_V1_INTENT_CAPABILITIES,
  })
}

async function handleCapabilityResolution(request: BotAuthenticatedRequest) {
  const params = request.nextUrl.searchParams
  const message = stringParam(params, "message", "q", "utterance")
  if (!message) {
    return NextResponse.json(
      { status: "error", error: "message is required" },
      { status: 400 },
    )
  }

  const resolution = resolveIntentFromMessage({ message })
  await logToolRead(request, "capabilities/resolve", resolution.matches.length)
  return jsonData(
    resolution,
    {
      tenant_id: request.user.tenantId,
      resolverPath: "/api/bot/v1/tools/capabilities/resolve",
      routeDiscoveryAllowed: false,
    },
  )
}

async function handleAccountSearch(request: BotAuthenticatedRequest) {
  const params = request.nextUrl.searchParams
  const { page, limit, skip } = pagination(params)
  const query = stringParam(params, "q", "search")
  const status = stringParam(params, "status")
  const accountTypeId = stringParam(params, "accountTypeId")

  const where: Prisma.AccountWhereInput = {
    tenantId: request.user.tenantId,
    mergedIntoAccountId: null,
    ...(status ? { status: status as any } : {}),
    ...(accountTypeId ? { accountTypeId } : {}),
  }

  if (query) {
    const contains = { contains: query, mode: "insensitive" as const }
    where.OR = [{ accountName: contains }, { accountLegalName: contains }, { accountNumber: contains }]
  }

  const [total, rows] = await Promise.all([
    prisma.account.count({ where }),
    prisma.account.findMany({
      where,
      select: {
        id: true,
        accountName: true,
        accountLegalName: true,
        accountNumber: true,
        status: true,
        websiteUrl: true,
        accountType: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true } },
        updatedAt: true,
      },
      orderBy: [{ accountName: "asc" }],
      skip,
      take: limit,
    }),
  ])

  await logToolRead(request, "accounts/search", rows.length)
  return jsonList(
    rows.map((row) => ({
      id: row.id,
      accountName: row.accountName,
      accountLegalName: row.accountLegalName,
      accountNumber: row.accountNumber,
      status: row.status,
      websiteUrl: row.websiteUrl,
      accountType: row.accountType,
      owner: row.owner,
      updatedAt: dateTime(row.updatedAt),
    })),
    page,
    limit,
    total,
    { tenant_id: request.user.tenantId, query },
  )
}

async function handleAccountContext(request: BotAuthenticatedRequest, accountId: string) {
  const account = (await prisma.account.findFirst({
    where: { id: accountId, tenantId: request.user.tenantId, mergedIntoAccountId: null },
    select: {
      id: true,
      accountName: true,
      accountLegalName: true,
      accountNumber: true,
      status: true,
      websiteUrl: true,
      accountType: { select: { id: true, name: true } },
      owner: { select: { id: true, fullName: true } },
      contacts: {
        where: { deletedAt: null, mergedIntoContactId: null },
        select: { id: true, fullName: true, jobTitle: true, emailAddress: true, isPrimary: true },
        orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }],
        take: 10,
      },
      opportunities: {
        where: { active: true },
        select: { id: true, name: true, stage: true, status: true, expectedCommission: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }],
        take: 10,
      },
      revenueSchedules: {
        where: { deletedAt: null },
        select: { id: true, scheduleNumber: true, scheduleDate: true, status: true, billingStatus: true, expectedUsage: true, actualUsage: true },
        orderBy: [{ scheduleDate: "desc" }],
        take: 10,
      },
      tickets: {
        select: { id: true, issue: true, status: true, priority: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }],
        take: 10,
      },
      _count: {
        select: {
          contacts: true,
          opportunities: true,
          revenueSchedules: true,
          tickets: true,
          deposits: true,
        },
      },
    },
  })) as any

  if (!account) {
    return NextResponse.json({ status: "error", error: "Account not found" }, { status: 404 })
  }

  await logToolRead(request, "accounts/context", 1)
  return jsonData(
    {
      ...account,
      opportunities: account.opportunities.map((row: any) => ({
        ...row,
        expectedCommission: toNumber(row.expectedCommission),
        updatedAt: dateTime(row.updatedAt),
      })),
      revenueSchedules: account.revenueSchedules.map((row: any) => ({
        ...row,
        scheduleDate: dateOnly(row.scheduleDate),
        expectedUsage: toNumber(row.expectedUsage),
        actualUsage: toNumber(row.actualUsage),
      })),
      tickets: account.tickets.map((row: any) => ({ ...row, updatedAt: dateTime(row.updatedAt) })),
    },
    { tenant_id: request.user.tenantId, account_id: account.id },
  )
}

async function handleContactSearch(request: BotAuthenticatedRequest) {
  const params = request.nextUrl.searchParams
  const { page, limit, skip } = pagination(params)
  const query = stringParam(params, "q", "search")
  const accountId = stringParam(params, "accountId")

  const where: Prisma.ContactWhereInput = {
    tenantId: request.user.tenantId,
    deletedAt: null,
    mergedIntoContactId: null,
    ...(accountId ? { accountId } : {}),
  }

  if (query) {
    const contains = { contains: query, mode: "insensitive" as const }
    where.OR = [{ fullName: contains }, { firstName: contains }, { lastName: contains }, { emailAddress: contains }, { account: { accountName: contains } }]
  }

  const [total, rows] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        jobTitle: true,
        emailAddress: true,
        workPhone: true,
        isPrimary: true,
        account: { select: { id: true, accountName: true } },
        owner: { select: { id: true, fullName: true } },
        updatedAt: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take: limit,
    }),
  ])

  await logToolRead(request, "contacts/search", rows.length)
  return jsonList(
    rows.map((row) => ({ ...row, updatedAt: dateTime(row.updatedAt) })),
    page,
    limit,
    total,
    { tenant_id: request.user.tenantId, query, account_id: accountId || null },
  )
}

async function handleProductSearch(request: BotAuthenticatedRequest) {
  const params = request.nextUrl.searchParams
  const { page, limit, skip } = pagination(params)
  const query = stringParam(params, "q", "search")
  const vendorAccountId = stringParam(params, "vendorAccountId")
  const distributorAccountId = stringParam(params, "distributorAccountId")
  const active = stringParam(params, "active")

  const where: Prisma.ProductWhereInput = {
    tenantId: request.user.tenantId,
    ...(vendorAccountId ? { vendorAccountId } : {}),
    ...(distributorAccountId ? { distributorAccountId } : {}),
    ...(active ? { isActive: active === "true" } : {}),
  }

  if (query) {
    const contains = { contains: query, mode: "insensitive" as const }
    where.OR = [
      { productCode: contains },
      { productNameHouse: contains },
      { productNameVendor: contains },
      { productNameDistributor: contains },
      { partNumberHouse: contains },
      { partNumberVendor: contains },
      { partNumberDistributor: contains },
      { vendor: { accountName: contains } },
      { distributor: { accountName: contains } },
    ]
  }

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: {
        id: true,
        productCode: true,
        productNameHouse: true,
        productNameVendor: true,
        productNameDistributor: true,
        revenueType: true,
        commissionPercent: true,
        priceEach: true,
        partNumberHouse: true,
        partNumberVendor: true,
        partNumberDistributor: true,
        isActive: true,
        isFlex: true,
        vendor: { select: { id: true, accountName: true } },
        distributor: { select: { id: true, accountName: true } },
        updatedAt: true,
      },
      orderBy: [{ productNameHouse: "asc" }],
      skip,
      take: limit,
    }),
  ])

  await logToolRead(request, "products/search", rows.length)
  return jsonList(
    rows.map((row) => ({
      ...row,
      commissionPercent: toNumber(row.commissionPercent),
      priceEach: toNumber(row.priceEach),
      updatedAt: dateTime(row.updatedAt),
    })),
    page,
    limit,
    total,
    { tenant_id: request.user.tenantId, query },
  )
}

async function handleOpportunitySearch(request: BotAuthenticatedRequest) {
  const params = request.nextUrl.searchParams
  const { page, limit, skip } = pagination(params)
  const query = stringParam(params, "q", "search")
  const accountId = stringParam(params, "accountId")
  const stage = stringParam(params, "stage")
  const status = stringParam(params, "status")

  const where: Prisma.OpportunityWhereInput = {
    tenantId: request.user.tenantId,
    ...(accountId ? { accountId } : {}),
    ...(stage ? { stage: stage as any } : {}),
    ...(status ? { status: status as any } : {}),
  }

  if (query) {
    const contains = { contains: query, mode: "insensitive" as const }
    where.OR = [{ name: contains }, { orderIdHouse: contains }, { account: { accountName: contains } }, { vendorName: contains }, { distributorName: contains }]
  }

  const [total, rows] = await Promise.all([
    prisma.opportunity.count({ where }),
    prisma.opportunity.findMany({
      where,
      select: {
        id: true,
        name: true,
        stage: true,
        status: true,
        active: true,
        type: true,
        expectedCommission: true,
        amount: true,
        estimatedCloseDate: true,
        account: { select: { id: true, accountName: true } },
        owner: { select: { id: true, fullName: true } },
        _count: { select: { products: true, revenueSchedules: true, tickets: true } },
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      skip,
      take: limit,
    }),
  ])

  await logToolRead(request, "opportunities/search", rows.length)
  return jsonList(
    rows.map((row) => ({
      ...row,
      expectedCommission: toNumber(row.expectedCommission),
      amount: toNumber(row.amount),
      estimatedCloseDate: dateOnly(row.estimatedCloseDate),
      updatedAt: dateTime(row.updatedAt),
    })),
    page,
    limit,
    total,
    { tenant_id: request.user.tenantId, query, account_id: accountId || null },
  )
}

async function handleOpportunityContext(request: BotAuthenticatedRequest, opportunityId: string) {
  const opportunity = await prisma.opportunity.findFirst({
    where: { id: opportunityId, tenantId: request.user.tenantId },
    select: {
      id: true,
      name: true,
      stage: true,
      status: true,
      active: true,
      type: true,
      leadSource: true,
      expectedCommission: true,
      amount: true,
      estimatedCloseDate: true,
      actualCloseDate: true,
      account: { select: { id: true, accountName: true, accountLegalName: true } },
      owner: { select: { id: true, fullName: true } },
      roles: {
        where: { active: true },
        select: { id: true, role: true, fullName: true, jobTitle: true, email: true },
        take: 10,
      },
      products: {
        where: { active: true },
        select: {
          id: true,
          quantity: true,
          expectedUsage: true,
          expectedCommission: true,
          revenueStartDate: true,
          revenueEndDate: true,
          product: { select: { id: true, productCode: true, productNameHouse: true, productNameVendor: true, revenueType: true } },
        },
        take: 20,
      },
      revenueSchedules: {
        where: { deletedAt: null },
        select: {
          id: true,
          scheduleNumber: true,
          scheduleDate: true,
          status: true,
          billingStatus: true,
          expectedUsage: true,
          actualUsage: true,
          expectedCommission: true,
          actualCommission: true,
        },
        orderBy: [{ scheduleDate: "desc" }],
        take: 20,
      },
      _count: { select: { products: true, revenueSchedules: true, tickets: true, activities: true } },
      updatedAt: true,
    },
  })

  if (!opportunity) {
    return NextResponse.json({ status: "error", error: "Opportunity not found" }, { status: 404 })
  }

  await logToolRead(request, "opportunities/context", 1)
  return jsonData(
    {
      ...opportunity,
      expectedCommission: toNumber(opportunity.expectedCommission),
      amount: toNumber(opportunity.amount),
      estimatedCloseDate: dateOnly(opportunity.estimatedCloseDate),
      actualCloseDate: dateOnly(opportunity.actualCloseDate),
      products: opportunity.products.map((row) => ({
        ...row,
        quantity: toNumber(row.quantity),
        expectedUsage: toNumber(row.expectedUsage),
        expectedCommission: toNumber(row.expectedCommission),
        revenueStartDate: dateOnly(row.revenueStartDate),
        revenueEndDate: dateOnly(row.revenueEndDate),
      })),
      revenueSchedules: opportunity.revenueSchedules.map((row) => ({
        ...row,
        scheduleDate: dateOnly(row.scheduleDate),
        expectedUsage: toNumber(row.expectedUsage),
        actualUsage: toNumber(row.actualUsage),
        expectedCommission: toNumber(row.expectedCommission),
        actualCommission: toNumber(row.actualCommission),
      })),
      updatedAt: dateTime(opportunity.updatedAt),
    },
    { tenant_id: request.user.tenantId, opportunity_id: opportunity.id },
  )
}

async function handleScheduleSearch(request: BotAuthenticatedRequest) {
  const params = request.nextUrl.searchParams
  const query = stringParam(params, "q", "search")
  const accountId = stringParam(params, "accountId")
  const vendorAccountId = stringParam(params, "vendorAccountId")
  const distributorAccountId = stringParam(params, "distributorAccountId")
  const productId = stringParam(params, "productId")
  const status = stringParam(params, "status")
  const billingStatus = stringParam(params, "billingStatus")
  const from = dateParam(params, "from", "dateFrom")
  const to = dateParam(params, "to", "dateTo")
  const limit = parseLimit(params, DEFAULT_LIMIT, MAX_LIMIT)

  const and: Prisma.RevenueScheduleWhereInput[] = [{ tenantId: request.user.tenantId, deletedAt: null }]
  if (accountId) and.push({ accountId })
  if (vendorAccountId) and.push({ vendorAccountId })
  if (distributorAccountId) and.push({ distributorAccountId })
  if (productId) and.push({ productId })
  if (status) and.push({ status: status as any })
  if (billingStatus) and.push({ billingStatus: billingStatus as any })
  if (from || to) {
    and.push({ scheduleDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } })
  }
  if (query) {
    const contains = { contains: query, mode: "insensitive" as const }
    and.push({
      OR: [
        { scheduleNumber: contains },
        { orderIdHouse: contains },
        { distributorOrderId: contains },
        { account: { accountName: contains } },
        { vendor: { accountName: contains } },
        { distributor: { accountName: contains } },
        { product: { productNameHouse: contains } },
        { product: { productNameVendor: contains } },
        { opportunity: { name: contains } },
      ],
    })
  }

  const rows = await prisma.revenueSchedule.findMany({
    where: { AND: and },
    include: {
      account: { select: { id: true, accountName: true } },
      vendor: { select: { id: true, accountName: true } },
      distributor: { select: { id: true, accountName: true } },
      product: { select: { id: true, productCode: true, productNameHouse: true, productNameVendor: true, revenueType: true } },
      opportunity: { select: { id: true, name: true } },
    },
    orderBy: [{ scheduleDate: "desc" }, { updatedAt: "desc" }],
    take: limit,
  })

  await logToolRead(request, "revenue-schedules/search", rows.length)
  return jsonData(rows.map(mapSchedule), { tenant_id: request.user.tenantId, limit, query })
}

async function handleTopUsageAccounts(request: BotAuthenticatedRequest) {
  const params = request.nextUrl.searchParams
  const rangeResult = resolveCalendarDateRange({ searchParams: params })
  if (!rangeResult.ok) {
    return NextResponse.json({ status: "error", error: rangeResult.error }, { status: 400 })
  }

  const range = rangeResult.value
  const limit = parseLimit(params, 5, 25)

  const grouped = await prisma.revenueSchedule.groupBy({
    by: ["accountId"],
    where: {
      tenantId: request.user.tenantId,
      deletedAt: null,
      scheduleDate: { gte: range.from, lt: range.toExclusive },
    },
    _sum: {
      expectedUsage: true,
      usageAdjustment: true,
      actualUsage: true,
      actualUsageAdjustment: true,
      expectedCommission: true,
      actualCommission: true,
    },
    _count: { _all: true },
  })

  const accounts = await prisma.account.findMany({
    where: { tenantId: request.user.tenantId, id: { in: grouped.map((row) => row.accountId) } },
    select: { id: true, accountName: true, accountLegalName: true, accountNumber: true },
  })
  const accountById = new Map(accounts.map((account) => [account.id, account]))

  const data = rankTopUsageAccounts(
    grouped.map((row) => ({
      accountId: row.accountId,
      account: accountById.get(row.accountId) ?? null,
      scheduleCount: row._count._all,
      expectedUsage: row._sum.expectedUsage,
      usageAdjustment: row._sum.usageAdjustment,
      actualUsage: row._sum.actualUsage,
      actualUsageAdjustment: row._sum.actualUsageAdjustment,
      expectedCommission: row._sum.expectedCommission,
      actualCommission: row._sum.actualCommission,
    })),
  ).slice(0, limit)

  await logToolRead(request, "revenue-schedules/top-usage-accounts", data.length)
  return jsonData(data, {
    tenant_id: request.user.tenantId,
    month: range.month,
    from: range.fromDate,
    to: range.toDate,
    dateFilterMode: range.mode,
    limit,
    rankingPolicy: "actual_usage_net_else_expected_usage_net",
  })
}

async function handleDepositSearch(request: BotAuthenticatedRequest) {
  const params = request.nextUrl.searchParams
  const { page, limit, skip } = pagination(params)
  const query = stringParam(params, "q", "search")
  const status = stringParam(params, "status")
  const from = dateParam(params, "from", "dateFrom")
  const to = dateParam(params, "to", "dateTo")

  const where: Prisma.DepositWhereInput = { tenantId: request.user.tenantId }
  if (status) where.status = status as any
  if (from || to) where.paymentDate = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
  if (query) {
    const contains = { contains: query, mode: "insensitive" as const }
    where.OR = [{ depositName: contains }, { account: { accountName: contains } }, { vendor: { accountName: contains } }, { distributor: { accountName: contains } }]
  }

  const [total, rows] = await Promise.all([
    prisma.deposit.count({ where }),
    prisma.deposit.findMany({
      where,
      select: {
        id: true,
        depositName: true,
        month: true,
        paymentDate: true,
        paymentType: true,
        status: true,
        reconciled: true,
        totalUsage: true,
        totalCommissions: true,
        totalItems: true,
        itemsReconciled: true,
        itemsUnreconciled: true,
        usageAllocated: true,
        usageUnallocated: true,
        commissionAllocated: true,
        commissionUnallocated: true,
        account: { select: { id: true, accountName: true } },
        vendor: { select: { id: true, accountName: true } },
        distributor: { select: { id: true, accountName: true } },
        updatedAt: true,
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
  ])

  await logToolRead(request, "reconciliation/deposits/search", rows.length)
  return jsonList(
    rows.map((row) => ({
      ...row,
      month: dateOnly(row.month),
      paymentDate: dateOnly(row.paymentDate),
      totalUsage: toNumber(row.totalUsage),
      totalCommissions: toNumber(row.totalCommissions),
      usageAllocated: toNumber(row.usageAllocated),
      usageUnallocated: toNumber(row.usageUnallocated),
      commissionAllocated: toNumber(row.commissionAllocated),
      commissionUnallocated: toNumber(row.commissionUnallocated),
      updatedAt: dateTime(row.updatedAt),
    })),
    page,
    limit,
    total,
    { tenant_id: request.user.tenantId, query },
  )
}

async function handleDepositDetail(request: BotAuthenticatedRequest, depositId: string) {
  const deposit = await prisma.deposit.findFirst({
    where: { id: depositId, tenantId: request.user.tenantId },
    select: {
      id: true,
      depositName: true,
      month: true,
      paymentDate: true,
      paymentType: true,
      status: true,
      reconciled: true,
      totalUsage: true,
      totalCommissions: true,
      usageAllocated: true,
      usageUnallocated: true,
      commissionAllocated: true,
      commissionUnallocated: true,
      account: { select: { id: true, accountName: true } },
      vendor: { select: { id: true, accountName: true } },
      distributor: { select: { id: true, accountName: true } },
      lineItems: {
        select: {
          id: true,
          lineNumber: true,
          status: true,
          accountNameRaw: true,
          vendorNameRaw: true,
          productNameRaw: true,
          partNumberRaw: true,
          usage: true,
          usageAllocated: true,
          usageUnallocated: true,
          commission: true,
          commissionAllocated: true,
          commissionUnallocated: true,
          commissionRate: true,
          reconciled: true,
          hasSuggestedMatches: true,
          account: { select: { id: true, accountName: true } },
          vendorAccount: { select: { id: true, accountName: true } },
          product: { select: { id: true, productNameHouse: true, productNameVendor: true, productCode: true } },
        },
        orderBy: [{ lineNumber: "asc" }, { createdAt: "asc" }],
        take: 100,
      },
    },
  })

  if (!deposit) {
    return NextResponse.json({ status: "error", error: "Deposit not found" }, { status: 404 })
  }

  await logToolRead(request, "reconciliation/deposits/detail", 1)
  return jsonData(
    {
      ...deposit,
      month: dateOnly(deposit.month),
      paymentDate: dateOnly(deposit.paymentDate),
      totalUsage: toNumber(deposit.totalUsage),
      totalCommissions: toNumber(deposit.totalCommissions),
      usageAllocated: toNumber(deposit.usageAllocated),
      usageUnallocated: toNumber(deposit.usageUnallocated),
      commissionAllocated: toNumber(deposit.commissionAllocated),
      commissionUnallocated: toNumber(deposit.commissionUnallocated),
      lineItems: deposit.lineItems.map((line) => ({
        ...line,
        usage: toNumber(line.usage),
        usageAllocated: toNumber(line.usageAllocated),
        usageUnallocated: toNumber(line.usageUnallocated),
        commission: toNumber(line.commission),
        commissionAllocated: toNumber(line.commissionAllocated),
        commissionUnallocated: toNumber(line.commissionUnallocated),
        commissionRate: toNumber(line.commissionRate),
      })),
    },
    { tenant_id: request.user.tenantId, deposit_id: deposit.id },
  )
}

async function handleReconciliationSummary(request: BotAuthenticatedRequest) {
  const params = request.nextUrl.searchParams
  const from = dateParam(params, "from", "dateFrom")
  const to = dateParam(params, "to", "dateTo")
  const where: Prisma.DepositWhereInput = {
    tenantId: request.user.tenantId,
    ...(from || to ? { paymentDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  }

  const [total, reconciled, unreconciled, statusGroups, sums] = await Promise.all([
    prisma.deposit.count({ where }),
    prisma.deposit.count({ where: { ...where, reconciled: true } }),
    prisma.deposit.count({ where: { ...where, reconciled: false } }),
    prisma.deposit.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.deposit.aggregate({
      where,
      _sum: {
        totalUsage: true,
        totalCommissions: true,
        usageAllocated: true,
        usageUnallocated: true,
        commissionAllocated: true,
        commissionUnallocated: true,
      },
    }),
  ])

  await logToolRead(request, "reconciliation/summary", total)
  return jsonData(
    {
      depositCount: total,
      reconciledCount: reconciled,
      unreconciledCount: unreconciled,
      byStatus: statusGroups.map((row) => ({ status: row.status, count: row._count._all })),
      totals: {
        totalUsage: round(toNumber(sums._sum.totalUsage)),
        totalCommissions: round(toNumber(sums._sum.totalCommissions)),
        usageAllocated: round(toNumber(sums._sum.usageAllocated)),
        usageUnallocated: round(toNumber(sums._sum.usageUnallocated)),
        commissionAllocated: round(toNumber(sums._sum.commissionAllocated)),
        commissionUnallocated: round(toNumber(sums._sum.commissionUnallocated)),
      },
    },
    { tenant_id: request.user.tenantId, from: from ? dateOnly(from) : null, to: to ? dateOnly(to) : null },
  )
}

async function handleImportsRecent(request: BotAuthenticatedRequest) {
  const params = request.nextUrl.searchParams
  const entity = stringParam(params, "entity")
  const status = stringParam(params, "status")
  const limit = parseLimit(params, DEFAULT_LIMIT, MAX_LIMIT)

  const where: Prisma.ImportJobWhereInput = {
    tenantId: request.user.tenantId,
    ...(entity && (Object.values(DataEntity) as string[]).includes(entity) ? { entity: entity as DataEntity } : {}),
    ...(status ? { status: status as any } : {}),
  }

  const rows = await prisma.importJob.findMany({
    where,
    select: {
      id: true,
      entity: true,
      source: true,
      status: true,
      fileName: true,
      totalRows: true,
      processedRows: true,
      successCount: true,
      errorCount: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, fullName: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
  })

  await logToolRead(request, "imports/recent", rows.length)
  return jsonData(
    rows.map((row) => ({
      ...row,
      startedAt: dateTime(row.startedAt),
      completedAt: dateTime(row.completedAt),
      createdAt: dateTime(row.createdAt),
      updatedAt: dateTime(row.updatedAt),
    })),
    { tenant_id: request.user.tenantId, limit },
  )
}

async function handleImportErrors(request: BotAuthenticatedRequest, importJobId: string) {
  const params = request.nextUrl.searchParams
  const limit = parseLimit(params, DEFAULT_LIMIT, MAX_LIMIT)

  const job = await prisma.importJob.findFirst({
    where: { id: importJobId, tenantId: request.user.tenantId },
    select: { id: true, entity: true, status: true, fileName: true },
  })

  if (!job) {
    return NextResponse.json({ status: "error", error: "Import job not found" }, { status: 404 })
  }

  const rows = await prisma.importError.findMany({
    where: { importJobId },
    select: { id: true, rowNumber: true, fieldName: true, message: true, createdAt: true },
    orderBy: [{ rowNumber: "asc" }, { createdAt: "asc" }],
    take: limit,
  })

  await logToolRead(request, "imports/errors", rows.length)
  return jsonData(
    {
      job,
      errors: rows.map((row) => ({ ...row, createdAt: dateTime(row.createdAt) })),
    },
    { tenant_id: request.user.tenantId, import_job_id: job.id, limit },
  )
}

async function handleImportReadiness(request: BotAuthenticatedRequest) {
  const jobs = await prisma.importJob.groupBy({
    by: ["entity", "status"],
    where: { tenantId: request.user.tenantId },
    _count: { _all: true },
    _sum: { totalRows: true, successCount: true, errorCount: true },
  })

  const latest = await prisma.importJob.findMany({
    where: { tenantId: request.user.tenantId },
    select: {
      id: true,
      entity: true,
      status: true,
      fileName: true,
      totalRows: true,
      successCount: true,
      errorCount: true,
      completedAt: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 10,
  })

  await logToolRead(request, "imports/readiness", latest.length)
  return jsonData(
    {
      byEntityStatus: jobs.map((row) => ({
        entity: row.entity,
        status: row.status,
        jobCount: row._count._all,
        totalRows: row._sum.totalRows ?? 0,
        successCount: row._sum.successCount ?? 0,
        errorCount: row._sum.errorCount ?? 0,
      })),
      latest: latest.map((row) => ({
        ...row,
        completedAt: dateTime(row.completedAt),
        createdAt: dateTime(row.createdAt),
      })),
    },
    { tenant_id: request.user.tenantId },
  )
}

async function handleRecordLink(request: BotAuthenticatedRequest) {
  const params = request.nextUrl.searchParams
  const entityType = stringParam(params, "entityType", "type")
  const id = stringParam(params, "id", "recordId")
  if (!entityType || !id) {
    return NextResponse.json({ status: "error", error: "entityType and id are required" }, { status: 400 })
  }

  const baseUrl = process.env.NEXTAUTH_URL?.trim() || request.nextUrl.origin
  const url = recordLink(baseUrl, entityType, id)
  if (!url) {
    return NextResponse.json({ status: "error", error: "Unsupported entityType" }, { status: 400 })
  }

  await logToolRead(request, "records/link", 1)
  return jsonData({ entityType, id, url }, { tenant_id: request.user.tenantId })
}

async function handleTicketDraft(request: BotAuthenticatedRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const issue = typeof body?.issue === "string" ? body.issue.trim() : typeof body?.summary === "string" ? body.summary.trim() : ""
  const recommendation = typeof body?.recommendation === "string" ? body.recommendation.trim() : ""
  const title =
    typeof body?.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 160)
      : issue
        ? `Review: ${issue.slice(0, 80)}`
        : "Review CRM item"

  const draftId = crypto.randomUUID()
  const description = [
    issue ? `Issue: ${issue}` : null,
    recommendation ? `Recommendation: ${recommendation}` : null,
    "Draft generated by Commissable Bot. No ticket was created.",
  ]
    .filter(Boolean)
    .join("\n")

  await logToolRead(request, "tickets/draft", 1)
  return jsonData(
    {
      id: draftId,
      title,
      description,
      priority: typeof body?.priority === "string" ? body.priority.trim() || "Medium" : "Medium",
      persisted: false,
    },
    { tenant_id: request.user.tenantId },
  )
}

async function dispatchGet(request: NextRequest, path: string[]) {
  if (path.length === 0 || (path.length === 1 && path[0] === "manifest")) {
    return withBotAuth(request, [], handleManifest)
  }
  if (path.length === 1 && path[0] === "capabilities") {
    return withBotAuth(request, [], handleCapabilities)
  }
  if (path.length === 2 && path[0] === "capabilities" && path[1] === "resolve") {
    return withBotAuth(request, [], handleCapabilityResolution)
  }
  if (path.length === 2 && path[0] === "accounts" && path[1] === "search") {
    return withBotAuth(request, ACCOUNT_READ_PERMISSIONS, handleAccountSearch)
  }
  if (path.length === 3 && path[0] === "accounts" && path[2] === "context") {
    return withBotAuth(request, ACCOUNT_READ_PERMISSIONS, (req) => handleAccountContext(req, path[1]!))
  }
  if (path.length === 2 && path[0] === "contacts" && path[1] === "search") {
    return withBotAuth(request, CONTACT_READ_PERMISSIONS, handleContactSearch)
  }
  if (path.length === 2 && path[0] === "products" && path[1] === "search") {
    return withBotAuth(request, PRODUCT_READ_PERMISSIONS, handleProductSearch)
  }
  if (path.length === 2 && path[0] === "opportunities" && path[1] === "search") {
    return withBotAuth(request, OPPORTUNITY_READ_PERMISSIONS, handleOpportunitySearch)
  }
  if (path.length === 3 && path[0] === "opportunities" && path[2] === "context") {
    return withBotAuth(request, OPPORTUNITY_READ_PERMISSIONS, (req) => handleOpportunityContext(req, path[1]!))
  }
  if (path.length === 2 && path[0] === "revenue-schedules" && path[1] === "search") {
    return withBotAuth(request, SCHEDULE_READ_PERMISSIONS, handleScheduleSearch)
  }
  if (path.length === 2 && path[0] === "revenue-schedules" && path[1] === "top-usage-accounts") {
    return withBotAuth(request, SCHEDULE_READ_PERMISSIONS, handleTopUsageAccounts)
  }
  if (path.length === 3 && path[0] === "reconciliation" && path[1] === "deposits" && path[2] === "search") {
    return withBotAuth(request, RECONCILIATION_READ_PERMISSIONS, handleDepositSearch)
  }
  if (path.length === 4 && path[0] === "reconciliation" && path[1] === "deposits" && path[3] === "detail") {
    return withBotAuth(request, RECONCILIATION_READ_PERMISSIONS, (req) => handleDepositDetail(req, path[2]!))
  }
  if (path.length === 2 && path[0] === "reconciliation" && path[1] === "summary") {
    return withBotAuth(request, RECONCILIATION_READ_PERMISSIONS, handleReconciliationSummary)
  }
  if (path.length === 2 && path[0] === "imports" && path[1] === "readiness") {
    return withBotAuth(request, IMPORT_READ_PERMISSIONS, handleImportReadiness)
  }
  if (path.length === 2 && path[0] === "imports" && path[1] === "recent") {
    return withBotAuth(request, IMPORT_READ_PERMISSIONS, handleImportsRecent)
  }
  if (path.length === 3 && path[0] === "imports" && path[2] === "errors") {
    return withBotAuth(request, IMPORT_READ_PERMISSIONS, (req) => handleImportErrors(req, path[1]!))
  }
  if (path.length === 2 && path[0] === "records" && path[1] === "link") {
    return withBotAuth(request, [], handleRecordLink)
  }

  return NextResponse.json({ status: "error", error: "OpenClaw read-only tool route not found" }, { status: 404 })
}

async function dispatchPost(request: NextRequest, path: string[]) {
  if (path.length === 2 && path[0] === "tickets" && path[1] === "draft") {
    return withBotAuth(request, TICKET_DRAFT_PERMISSIONS, handleTicketDraft)
  }

  return NextResponse.json({ status: "error", error: "OpenClaw read-only tool route not found" }, { status: 404 })
}

export async function GET(request: NextRequest, context: RouteContext) {
  return dispatchGet(request, normalizePath(context.params))
}

export async function POST(request: NextRequest, context: RouteContext) {
  return dispatchPost(request, normalizePath(context.params))
}

export async function PUT() {
  return NextResponse.json({ status: "error", error: "Method not allowed for read-only OpenClaw tools" }, { status: 405 })
}

export async function PATCH() {
  return NextResponse.json({ status: "error", error: "Method not allowed for read-only OpenClaw tools" }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ status: "error", error: "Method not allowed for read-only OpenClaw tools" }, { status: 405 })
}
