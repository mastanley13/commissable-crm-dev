import { prisma } from "@/lib/db"
import { getTenantMatchingPreferences } from "@/lib/matching/settings"
import { matchDepositLine, candidatesToSuggestedRows } from "@/lib/matching/deposit-matcher"

async function main() {
  const depositId = process.argv[2]
  const lineId = process.argv[3]
  const tenantId = process.argv[4]

  if (!depositId || !lineId || !tenantId) {
    console.error(
      "Usage: tsx scripts/debug-candidates-route.ts <depositId> <lineId> <tenantId>",
    )
    process.exit(1)
  }

  console.info("[debug-candidates-route] Input:", { depositId, lineId, tenantId })

  try {
    const lineItem = await prisma.depositLineItem.findFirst({
      where: { id: lineId, depositId, tenantId },
    })

    if (!lineItem) {
      console.error("[debug-candidates-route] Deposit line item not found")
      process.exit(1)
    }

    console.info("[debug-candidates-route] Found line item", {
      id: lineItem.id,
      hasSuggestedMatches: lineItem.hasSuggestedMatches,
      lastMatchCheckAt: lineItem.lastMatchCheckAt,
    })

    const matchingPrefs = await getTenantMatchingPreferences(tenantId)

    const includeFutureSchedules = matchingPrefs.includeFutureSchedulesDefault
    const resolvedEngineMode = matchingPrefs.engineMode
    const useHierarchicalMatching =
      resolvedEngineMode === "env" ? undefined : resolvedEngineMode === "hierarchical"
    const varianceTolerance = matchingPrefs.varianceTolerance

    console.info("[debug-candidates-route] Matching prefs", {
      includeFutureSchedules,
      resolvedEngineMode,
      useHierarchicalMatching,
      varianceTolerance,
    })

    const matchResult = await matchDepositLine(lineId, {
      limit: 10,
      includeFutureSchedules,
      useHierarchicalMatching,
      varianceTolerance,
    })

    console.info("[debug-candidates-route] matchDepositLine result", {
      lineItemId: matchResult.lineItem.id,
      candidatesCount: matchResult.candidates.length,
      appliedMatchScheduleId: matchResult.appliedMatchScheduleId,
      appliedMatchReconciled: matchResult.appliedMatchReconciled,
    })

    if (matchResult.candidates.length > 0 && !lineItem.hasSuggestedMatches) {
      console.info("[debug-candidates-route] Updating hasSuggestedMatches flag on line item")
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

    console.info("[debug-candidates-route] Mapped candidates:", mapped.length)
    console.dir(mapped, { depth: null })
  } catch (error) {
    console.error("[debug-candidates-route] Error while executing route logic:", error)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error("[debug-candidates-route] Unhandled error:", error)
  process.exit(1)
})
