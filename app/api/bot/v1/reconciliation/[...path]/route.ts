import { NextRequest, NextResponse } from "next/server"
import { AuditAction, DepositLineItemStatus, DepositLineMatchStatus } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withBotAuth, type BotAuthenticatedRequest, logBotAuditEvent } from "@/lib/bot-auth"
import { candidatesToSuggestedRows, matchDepositLine } from "@/lib/matching/deposit-matcher"
import { getTenantMatchingPreferences } from "@/lib/matching/settings"
import { getUserReconciliationConfidencePreferences } from "@/lib/matching/user-confidence-settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: {
    path?: string[]
  }
}

const DEPOSIT_READ_PERMISSIONS = ["reconciliation.view"]
const EPSILON = 0.005

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function mapLine(line: any, index: number) {
  return {
    id: line.id,
    lineNumber: line.lineNumber ?? index + 1,
    status: line.status,
    accountId: line.accountId ?? null,
    accountName: line.account?.accountName ?? line.accountNameRaw ?? null,
    accountLegalName: line.account?.accountLegalName ?? null,
    vendorName: line.vendorAccount?.accountName ?? line.vendorNameRaw ?? null,
    productName: line.product?.productNameVendor ?? line.productNameRaw ?? null,
    partNumber: line.product?.partNumberVendor ?? line.product?.partNumberHouse ?? line.partNumberRaw ?? null,
    usage: numberValue(line.usage),
    usageAllocated: numberValue(line.usageAllocated),
    usageUnallocated: numberValue(line.usageUnallocated),
    commission: numberValue(line.commission),
    commissionAllocated: numberValue(line.commissionAllocated),
    commissionUnallocated: numberValue(line.commissionUnallocated),
    commissionRate: numberValue(line.commissionRate),
    customerIdVendor: line.customerIdVendor ?? null,
    orderIdVendor: line.orderIdVendor ?? null,
    locationId: line.locationId ?? null,
    customerPurchaseOrder: line.customerPurchaseOrder ?? null,
    hasSuggestedMatches: Boolean(line.hasSuggestedMatches),
    reconciled: Boolean(line.reconciled),
    reconciledAt: dateValue(line.reconciledAt),
  }
}

async function handleDepositDetail(request: BotAuthenticatedRequest, depositId: string) {
  const deposit = await prisma.deposit.findFirst({
    where: { id: depositId, tenantId: request.user.tenantId },
    include: {
      account: { select: { id: true, accountName: true, accountLegalName: true } },
      distributor: { select: { id: true, accountName: true } },
      vendor: { select: { id: true, accountName: true } },
      lineItems: {
        include: {
          account: { select: { id: true, accountName: true, accountLegalName: true } },
          vendorAccount: { select: { id: true, accountName: true } },
          product: { select: { id: true, productNameVendor: true, partNumberVendor: true, partNumberHouse: true } },
        },
        orderBy: [{ lineNumber: "asc" }, { createdAt: "asc" }],
      },
    },
  })

  if (!deposit) {
    return NextResponse.json({ status: "error", error: "Deposit not found" }, { status: 404 })
  }

  await logBotAuditEvent({
    request,
    action: AuditAction.Export,
    entityName: "Deposit",
    entityId: deposit.id,
    metadata: { botRoute: "reconciliation.deposit.detail" },
  })

  return NextResponse.json({
    status: "success",
    data: {
      id: deposit.id,
      depositName: deposit.depositName ?? deposit.id,
      account: deposit.account,
      distributor: deposit.distributor,
      vendor: deposit.vendor,
      month: dateValue(deposit.month),
      paymentDate: dateValue(deposit.paymentDate),
      paymentType: deposit.paymentType ?? null,
      totalRevenue: numberValue(deposit.totalRevenue),
      totalUsage: numberValue(deposit.totalUsage),
      totalCommissions: numberValue(deposit.totalCommissions),
      usageAllocated: numberValue(deposit.usageAllocated),
      usageUnallocated: numberValue(deposit.usageUnallocated),
      commissionAllocated: numberValue(deposit.commissionAllocated),
      commissionUnallocated: numberValue(deposit.commissionUnallocated),
      status: deposit.status,
      reconciled: Boolean(deposit.reconciled),
      reconciledAt: dateValue(deposit.reconciledAt),
      lineItems: deposit.lineItems.map(mapLine),
    },
    context: {
      deposit_id: deposit.id,
      tenant_id: request.user.tenantId,
    },
  })
}

async function handleLineCandidates(request: BotAuthenticatedRequest, lineId: string) {
  const line = await prisma.depositLineItem.findFirst({
    where: { id: lineId, tenantId: request.user.tenantId },
    select: { id: true, depositId: true },
  })

  if (!line) {
    return NextResponse.json({ status: "error", error: "Deposit line item not found" }, { status: 404 })
  }

  const matchingPrefs = await getTenantMatchingPreferences(request.user.tenantId)
  const includeFutureSchedulesParam = request.nextUrl.searchParams.get("includeFutureSchedules")
  const useHierarchicalMatchingParam = request.nextUrl.searchParams.get("useHierarchicalMatching")
  const includeFutureSchedules =
    includeFutureSchedulesParam === null
      ? matchingPrefs.includeFutureSchedulesDefault
      : includeFutureSchedulesParam === "true"
  const resolvedEngineMode =
    useHierarchicalMatchingParam === null
      ? matchingPrefs.engineMode
      : useHierarchicalMatchingParam === "true"
        ? "hierarchical"
        : "legacy"

  const matchResult = await matchDepositLine(line.id, {
    limit: 10,
    includeFutureSchedules,
    useHierarchicalMatching: resolvedEngineMode !== "legacy",
    varianceTolerance: matchingPrefs.varianceTolerance,
  })
  const mapped = candidatesToSuggestedRows(matchResult.lineItem, matchResult.candidates)
  const userPrefs = await getUserReconciliationConfidencePreferences(request.user.tenantId, request.user.id)
  const filtered = mapped.filter(
    row => row.status !== "Suggested" || row.matchConfidence >= userPrefs.suggestedMatchesMinConfidence,
  )

  await logBotAuditEvent({
    request,
    action: AuditAction.Export,
    entityName: "DepositLineItem",
    entityId: line.id,
    metadata: {
      botRoute: "reconciliation.line.candidates",
      candidateCount: filtered.length,
    },
  })

  return NextResponse.json({
    status: "success",
    data: filtered,
    context: {
      deposit_id: line.depositId,
      line_id: line.id,
      tenant_id: request.user.tenantId,
    },
  })
}

async function handleMatchIssuesPreview(request: BotAuthenticatedRequest, lineId: string) {
  const revenueScheduleId = request.nextUrl.searchParams.get("revenueScheduleId")?.trim()
  if (!revenueScheduleId) {
    return NextResponse.json(
      { status: "error", error: "revenueScheduleId is required" },
      { status: 400 },
    )
  }

  const line = await prisma.depositLineItem.findFirst({
    where: { id: lineId, tenantId: request.user.tenantId },
    include: {
      account: { select: { id: true, accountName: true, accountLegalName: true } },
      deposit: { select: { id: true, depositName: true } },
    },
  })
  if (!line) {
    return NextResponse.json({ status: "error", error: "Deposit line item not found" }, { status: 404 })
  }

  const schedule = await prisma.revenueSchedule.findFirst({
    where: { id: revenueScheduleId, tenantId: request.user.tenantId, deletedAt: null },
    include: {
      account: { select: { id: true, accountName: true, accountLegalName: true } },
      product: { select: { id: true, productNameHouse: true, productNameVendor: true, commissionPercent: true } },
      opportunity: { select: { id: true, name: true } },
    },
  })
  if (!schedule) {
    return NextResponse.json({ status: "error", error: "Revenue schedule not found" }, { status: 404 })
  }

  const usageAmountParam = request.nextUrl.searchParams.get("usageAmount")
  const commissionAmountParam = request.nextUrl.searchParams.get("commissionAmount")
  const usageAmount =
    usageAmountParam === null ? numberValue(line.usageUnallocated || line.usage) : numberValue(usageAmountParam)
  const commissionAmount =
    commissionAmountParam === null ? numberValue(line.commissionUnallocated || line.commission) : numberValue(commissionAmountParam)

  const existingMatches = await prisma.depositLineMatch.findMany({
    where: {
      tenantId: request.user.tenantId,
      depositLineItemId: line.id,
      status: DepositLineMatchStatus.Applied,
    },
    select: {
      revenueScheduleId: true,
      usageAmount: true,
      commissionAmount: true,
    },
  })

  const otherUsageAllocated = existingMatches
    .filter(match => match.revenueScheduleId !== schedule.id)
    .reduce((sum, match) => sum + numberValue(match.usageAmount), 0)
  const otherCommissionAllocated = existingMatches
    .filter(match => match.revenueScheduleId !== schedule.id)
    .reduce((sum, match) => sum + numberValue(match.commissionAmount), 0)
  const remainingUsage = Math.max(0, numberValue(line.usage) - otherUsageAllocated)
  const remainingCommission = Math.max(0, numberValue(line.commission) - otherCommissionAllocated)

  const issues: Array<{ level: "error" | "warning"; code: string; message: string }> = []
  if (line.reconciled) {
    issues.push({ level: "error", code: "line_reconciled", message: "This line is already reconciled." })
  }
  if (line.status === DepositLineItemStatus.Ignored) {
    issues.push({ level: "error", code: "line_ignored", message: "This line is ignored and should not be matched." })
  }
  if (line.accountId && schedule.accountId !== line.accountId) {
    issues.push({
      level: "warning",
      code: "account_mismatch",
      message: `Deposit line account ${line.account?.accountName ?? line.accountId} differs from schedule account ${schedule.account?.accountName ?? schedule.accountId}.`,
    })
  }
  if (usageAmount > remainingUsage + EPSILON) {
    issues.push({ level: "error", code: "usage_overallocated", message: "Usage allocation exceeds remaining line usage." })
  }
  if (commissionAmount > remainingCommission + EPSILON) {
    issues.push({
      level: "error",
      code: "commission_overallocated",
      message: "Commission allocation exceeds remaining line commission.",
    })
  }

  const expectedRate = numberValue((schedule as any).expectedCommissionRatePercent ?? schedule.product?.commissionPercent)
  const receivedRate = usageAmount > EPSILON ? (commissionAmount / usageAmount) * 100 : 0
  const rateDifference = Math.abs(expectedRate - receivedRate)
  if (expectedRate > 0 && rateDifference >= 1) {
    issues.push({
      level: "warning",
      code: "rate_variance",
      message: `Received rate ${receivedRate.toFixed(2)}% differs from expected ${expectedRate.toFixed(2)}%.`,
    })
  }

  await logBotAuditEvent({
    request,
    action: AuditAction.Export,
    entityName: "DepositLineItem",
    entityId: line.id,
    metadata: {
      botRoute: "reconciliation.line.matchIssuesPreview",
      revenueScheduleId: schedule.id,
      issueCount: issues.length,
    },
  })

  return NextResponse.json({
    status: "success",
    data: {
      ok: !issues.some(issue => issue.level === "error"),
      requiresConfirmation: issues.length > 0,
      issues,
      allocation: {
        usageAmount,
        commissionAmount,
        remainingUsage,
        remainingCommission,
      },
      rateDiscrepancy:
        expectedRate > 0
          ? {
              expectedRatePercent: expectedRate,
              receivedRatePercent: Number(receivedRate.toFixed(4)),
              differencePercent: Number((receivedRate - expectedRate).toFixed(4)),
            }
          : null,
      schedule: {
        id: schedule.id,
        scheduleNumber: schedule.scheduleNumber,
        accountName: schedule.account?.accountName ?? null,
        productName: schedule.product?.productNameHouse ?? schedule.product?.productNameVendor ?? null,
        opportunityName: schedule.opportunity?.name ?? null,
      },
    },
    context: {
      deposit_id: line.depositId,
      line_id: line.id,
      revenue_schedule_id: schedule.id,
      tenant_id: request.user.tenantId,
    },
  })
}

export async function GET(request: NextRequest, context: RouteContext) {
  const path = context.params.path ?? []

  if (path.length === 3 && path[0] === "deposits" && path[2] === "detail") {
    return withBotAuth(request, DEPOSIT_READ_PERMISSIONS, req => handleDepositDetail(req, path[1]!))
  }

  if (path.length === 3 && path[0] === "deposits" && path[2] === "candidates") {
    return withBotAuth(request, DEPOSIT_READ_PERMISSIONS, req => handleLineCandidates(req, path[1]!))
  }

  if (path.length === 3 && path[0] === "deposits" && path[2] === "match-issues-preview") {
    return withBotAuth(request, DEPOSIT_READ_PERMISSIONS, req => handleMatchIssuesPreview(req, path[1]!))
  }

  return NextResponse.json({ status: "error", error: "Bot reconciliation route not found" }, { status: 404 })
}
