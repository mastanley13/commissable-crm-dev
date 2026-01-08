import { NextRequest, NextResponse } from "next/server"
import {
  DepositLineItemStatus,
  DepositLineMatchSource,
  DepositLineMatchStatus,
} from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { matchDepositLine } from "@/lib/matching/deposit-matcher"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { getTenantMatchingPreferences } from "@/lib/matching/settings"
import { getUserReconciliationConfidencePreferences } from "@/lib/matching/user-confidence-settings"
import { logMatchingMetric } from "@/lib/matching/metrics"

interface AutoMatchSummary {
  processed: number
  autoMatched: number
  alreadyMatched: number
  belowThreshold: number
  noCandidates: number
  errors: number
}

export async function POST(request: NextRequest, { params }: { params: { depositId: string } }) {
  return withPermissions(request, ["reconciliation.manage", "reconciliation.view"], async req => {
    const depositId = params?.depositId?.trim()
    const tenantId = req.user.tenantId

    if (!depositId) {
      return createErrorResponse("Deposit id is required", 400)
    }

    const deposit = await prisma.deposit.findFirst({
      where: { id: depositId, tenantId },
      select: { id: true },
    })

    if (!deposit) {
      return createErrorResponse("Deposit not found", 404)
    }

    const lineItems = await prisma.depositLineItem.findMany({
      where: { depositId, tenantId },
      select: {
        id: true,
        lineNumber: true,
        status: true,
        usage: true,
        commission: true,
        depositId: true,
      },
      orderBy: { lineNumber: "asc" },
    })

    const prefs = await getTenantMatchingPreferences(tenantId)
    const userPrefs = await getUserReconciliationConfidencePreferences(tenantId, req.user.id)

    const summary: AutoMatchSummary = {
      processed: lineItems.length,
      autoMatched: 0,
      alreadyMatched: 0,
      belowThreshold: 0,
      noCandidates: 0,
      errors: 0,
    }

    for (const line of lineItems) {
      if (
        line.status === DepositLineItemStatus.Matched ||
        line.status === DepositLineItemStatus.PartiallyMatched
      ) {
        summary.alreadyMatched += 1
        continue
      }

      let topCandidateId: string | null = null
      let topCandidateConfidence = 0
      let topMatchType: string | null = null
      try {
        const result = await matchDepositLine(line.id, {
          limit: 1,
          useHierarchicalMatching: prefs.engineMode === "legacy" ? false : true,
          includeFutureSchedules: prefs.includeFutureSchedulesDefault,
          varianceTolerance: prefs.varianceTolerance,
        })
        const top = result.candidates[0]
        if (!top) {
          summary.noCandidates += 1
          continue
        }
        if (top.matchConfidence < userPrefs.autoMatchMinConfidence) {
          summary.belowThreshold += 1
          continue
        }
        topCandidateId = top.revenueScheduleId
        topCandidateConfidence = top.matchConfidence
        topMatchType = top.matchType
      } catch (error) {
        console.error("Failed to compute auto-match candidates for line", line.id, error)
        summary.errors += 1
        continue
      }

      if (!topCandidateId || !topMatchType) continue

      try {
        await applyAutoMatch(
          line,
          topCandidateId,
          topCandidateConfidence,
          tenantId,
          req.user.id,
          request,
          topMatchType,
        )
        summary.autoMatched += 1
      } catch (error) {
        console.error("Failed to auto-match line", line.id, error)
        summary.errors += 1
      }
    }

    return NextResponse.json({ data: summary })
  })
}

async function applyAutoMatch(
  line: { id: string; usage: unknown; commission: unknown; depositId: string },
  scheduleId: string,
  confidenceScore: number,
  tenantId: string,
  userId: string,
  request: NextRequest,
  matchType?: string,
) {
  const allocationUsage = Number(line.usage ?? 0)
  const allocationCommission = Number(line.commission ?? 0)

  await prisma.$transaction(async tx => {
    await tx.depositLineMatch.upsert({
      where: {
        depositLineItemId_revenueScheduleId: {
          depositLineItemId: line.id,
          revenueScheduleId: scheduleId,
        },
      },
      create: {
        tenantId,
        depositLineItemId: line.id,
        revenueScheduleId: scheduleId,
        usageAmount: allocationUsage,
        commissionAmount: allocationCommission,
        confidenceScore,
        status: DepositLineMatchStatus.Applied,
        source: DepositLineMatchSource.Auto,
      },
      update: {
        usageAmount: allocationUsage,
        commissionAmount: allocationCommission,
        confidenceScore,
        status: DepositLineMatchStatus.Applied,
        source: DepositLineMatchSource.Auto,
      },
    })

    await tx.depositLineItem.update({
      where: { id: line.id },
      data: {
        status:
          allocationUsage >= Number(line.usage ?? 0) &&
          allocationCommission >= Number(line.commission ?? 0)
            ? DepositLineItemStatus.Matched
            : DepositLineItemStatus.PartiallyMatched,
        primaryRevenueScheduleId: scheduleId,
        usageAllocated: allocationUsage,
        usageUnallocated: Math.max(Number(line.usage ?? 0) - allocationUsage, 0),
        commissionAllocated: allocationCommission,
        commissionUnallocated: Math.max(Number(line.commission ?? 0) - allocationCommission, 0),
      },
    })

    await recomputeDepositAggregates(tx, line.depositId, tenantId)
  })

  await logMatchingMetric({
    tenantId,
    userId,
    event: "auto_match",
    depositId: line.depositId,
    lineItemId: line.id,
    scheduleId,
    confidence: confidenceScore,
    matchType,
    source: DepositLineMatchSource.Auto,
    request,
  })
}
