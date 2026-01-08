import { NextRequest, NextResponse } from "next/server"
import { DepositLineItemStatus } from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { matchDepositLine } from "@/lib/matching/deposit-matcher"
import { getTenantMatchingPreferences } from "@/lib/matching/settings"
import { getUserReconciliationConfidencePreferences } from "@/lib/matching/user-confidence-settings"

interface AutoMatchPreviewLine {
  lineId: string
  lineNumber: number | null
  accountName: string
  usage: number
  commission: number
  scheduleId: string
  scheduleName: string
  confidence: number
  reasons: string[]
}

interface AutoMatchPreviewSummary {
  processed: number
  alreadyMatched: number
  belowThreshold: number
  noCandidates: number
  errors: number
  autoMatchCandidates: AutoMatchPreviewLine[]
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
        accountNameRaw: true,
        account: { select: { accountName: true } },
        usage: true,
        commission: true,
      },
      orderBy: { lineNumber: "asc" },
    })

    const prefs = await getTenantMatchingPreferences(tenantId)
    const userPrefs = await getUserReconciliationConfidencePreferences(tenantId, req.user.id)

    const summary: AutoMatchPreviewSummary = {
      processed: lineItems.length,
      alreadyMatched: 0,
      belowThreshold: 0,
      noCandidates: 0,
      errors: 0,
      autoMatchCandidates: [],
    }

    for (const line of lineItems) {
      if (
        line.status === DepositLineItemStatus.Matched ||
        line.status === DepositLineItemStatus.PartiallyMatched
      ) {
        summary.alreadyMatched += 1
        continue
      }

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
        summary.autoMatchCandidates.push({
          lineId: line.id,
          lineNumber: line.lineNumber ?? null,
          accountName: line.accountNameRaw ?? line.account?.accountName ?? "Unknown Account",
          usage: Number(line.usage ?? 0),
          commission: Number(line.commission ?? 0),
          scheduleId: top.revenueScheduleId,
          scheduleName: top.revenueScheduleName,
          confidence: top.matchConfidence,
          reasons: top.reasons,
        })
      } catch (error) {
        console.error("Auto-match preview failed for line", line.id, error)
        summary.errors += 1
      }
    }

    return NextResponse.json({ data: summary })
  })
}
