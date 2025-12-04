import { NextRequest, NextResponse } from "next/server"
import { candidatesToSuggestedRows, matchDepositLine } from "@/lib/matching/deposit-matcher"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getTenantMatchingPreferences } from "@/lib/matching/settings"

export async function GET(request: NextRequest, { params }: { params: { depositId: string; lineId: string } }) {
  return withPermissions(request, ["reconciliation.view"], async (req) => {
    const depositId = params?.depositId?.trim()
    const lineId = params?.lineId?.trim()
    const tenantId = req.user.tenantId
    const searchParams = request.nextUrl.searchParams
    const includeFutureSchedulesParam = searchParams.get("includeFutureSchedules")
    const useHierarchicalMatchingParam = searchParams.get("useHierarchicalMatching")

    if (!depositId || !lineId) {
      return createErrorResponse("Deposit id and line id are required", 400)
    }

    const lineItem = await prisma.depositLineItem.findFirst({
      where: { id: lineId, depositId, tenantId },
    })

    if (!lineItem) {
      return createErrorResponse("Deposit line item not found", 404)
    }

    const matchingPrefs = await getTenantMatchingPreferences(tenantId)
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

    // Treat hierarchical matching as the default engine:
    // - explicit "hierarchical" -> hierarchical scoring
    // - explicit "legacy"       -> legacy scoring
    // - "env"                   -> hierarchical scoring (no longer gated by env var)
    const useHierarchicalMatching = resolvedEngineMode !== "legacy"

    const varianceTolerance = matchingPrefs.varianceTolerance

    const matchResult = await matchDepositLine(lineId, {
      limit: 10,
      includeFutureSchedules,
      useHierarchicalMatching,
      varianceTolerance,
    })

    // Update cache flag if suggestions found
    if (matchResult.candidates.length > 0 && !lineItem.hasSuggestedMatches) {
      await prisma.depositLineItem.update({
        where: { id: lineId },
        data: {
          hasSuggestedMatches: true,
          lastMatchCheckAt: new Date(),
        },
      })
    }

    const mapped = candidatesToSuggestedRows(
      matchResult.lineItem,
      matchResult.candidates,
      {
        scheduleId: matchResult.appliedMatchScheduleId,
        reconciled: matchResult.appliedMatchReconciled,
      },
    )

    return NextResponse.json({
      data: mapped,
    })
  })
}
