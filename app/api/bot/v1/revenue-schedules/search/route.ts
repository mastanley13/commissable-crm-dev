import { NextRequest, NextResponse } from "next/server"
import { AuditAction, Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withBotAuth, type BotAuthenticatedRequest, logBotAuditEvent } from "@/lib/bot-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SCHEDULE_READ_PERMISSIONS = ["revenue-schedules.manage", "reconciliation.view"]

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function dateOnly(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function scheduleNumbers(schedule: {
  expectedUsage: unknown
  usageAdjustment?: unknown
  actualUsage: unknown
  actualUsageAdjustment?: unknown
  expectedCommission: unknown
  expectedCommissionAdjustment?: unknown
  actualCommission: unknown
  actualCommissionAdjustment?: unknown
}) {
  const expectedUsage = numberValue(schedule.expectedUsage)
  const usageAdjustment = numberValue(schedule.usageAdjustment)
  const actualUsage = numberValue(schedule.actualUsage)
  const actualUsageAdjustment = numberValue(schedule.actualUsageAdjustment)
  const expectedCommission = numberValue(schedule.expectedCommission)
  const expectedCommissionAdjustment = numberValue(schedule.expectedCommissionAdjustment)
  const actualCommission = numberValue(schedule.actualCommission)
  const actualCommissionAdjustment = numberValue(schedule.actualCommissionAdjustment)

  const expectedUsageNet = expectedUsage + usageAdjustment
  const actualUsageNet = actualUsage + actualUsageAdjustment
  const expectedCommissionNet = expectedCommission + expectedCommissionAdjustment
  const actualCommissionNet = actualCommission + actualCommissionAdjustment

  return {
    expectedUsage,
    actualUsage,
    usageBalance: roundCurrency(expectedUsageNet - actualUsageNet),
    expectedCommission,
    actualCommission,
    commissionDifference: roundCurrency(expectedCommissionNet - actualCommissionNet),
  }
}

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 10
  return Math.min(parsed, 25)
}

function parseDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

async function handleSearch(request: BotAuthenticatedRequest) {
  const params = request.nextUrl.searchParams
  const query = params.get("q")?.trim()
  const accountId = params.get("accountId")?.trim()
  const vendorId = params.get("vendorAccountId")?.trim()
  const productId = params.get("productId")?.trim()
  const status = params.get("status")?.trim()
  const from = parseDate(params.get("from") ?? params.get("dateFrom"))
  const to = parseDate(params.get("to") ?? params.get("dateTo"))
  const limit = parseLimit(params.get("limit"))

  const andFilters: Prisma.RevenueScheduleWhereInput[] = [
    {
      tenantId: request.user.tenantId,
      deletedAt: null,
    },
  ]

  if (accountId) andFilters.push({ accountId })
  if (vendorId) andFilters.push({ vendorAccountId: vendorId })
  if (productId) andFilters.push({ productId })
  if (status) andFilters.push({ status: status as any })
  if (from || to) {
    andFilters.push({
      scheduleDate: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    })
  }
  if (query) {
    const contains = { contains: query, mode: "insensitive" as const }
    andFilters.push({
      OR: [
        { scheduleNumber: contains },
        { account: { accountName: contains } },
        { account: { accountLegalName: contains } },
        { vendor: { accountName: contains } },
        { distributor: { accountName: contains } },
        { product: { productNameHouse: contains } },
        { product: { productNameVendor: contains } },
        { opportunity: { name: contains } },
      ],
    })
  }

  const schedules = await prisma.revenueSchedule.findMany({
    where: { AND: andFilters },
    include: {
      account: { select: { id: true, accountName: true, accountLegalName: true } },
      vendor: { select: { id: true, accountName: true } },
      distributor: { select: { id: true, accountName: true } },
      product: { select: { id: true, productNameHouse: true, productNameVendor: true, commissionPercent: true } },
      opportunity: { select: { id: true, name: true } },
    },
    orderBy: [{ scheduleDate: "desc" }, { updatedAt: "desc" }],
    take: limit,
  })

  await logBotAuditEvent({
    request,
    action: AuditAction.Export,
    entityName: "RevenueSchedule",
    entityId: "search",
    metadata: {
      botRoute: "revenueSchedules.search",
      resultCount: schedules.length,
      hasQuery: Boolean(query),
    },
  })

  return NextResponse.json({
    status: "success",
    data: schedules.map(schedule => {
      const numbers = scheduleNumbers(schedule as any)

      return {
        id: schedule.id,
        scheduleNumber: schedule.scheduleNumber,
        scheduleDate: dateOnly(schedule.scheduleDate),
        scheduleType: schedule.scheduleType,
        status: schedule.status,
        billingStatus: schedule.billingStatus,
        account: schedule.account,
        vendor: schedule.vendor,
        distributor: schedule.distributor,
        product: schedule.product,
        opportunity: schedule.opportunity,
        expectedUsage: numbers.expectedUsage,
        actualUsage: numbers.actualUsage,
        usageBalance: numbers.usageBalance,
        expectedCommission: numbers.expectedCommission,
        actualCommission: numbers.actualCommission,
        expectedCommissionRatePercent: numberValue((schedule as any).expectedCommissionRatePercent),
        commissionDifference: numbers.commissionDifference,
        notes: schedule.notes ?? null,
      }
    }),
    context: {
      tenant_id: request.user.tenantId,
      limit,
    },
  })
}

export async function GET(request: NextRequest) {
  return withBotAuth(request, SCHEDULE_READ_PERMISSIONS, handleSearch)
}
