import { prisma } from "@/lib/db"
import { matchDepositLine } from "@/lib/matching/deposit-matcher"

async function main() {
  const lineId = process.argv[2]

  if (!lineId) {
    console.error("Usage: tsx scripts/debug-candidates.ts <depositLineItemId>")
    process.exit(1)
  }

  console.info("[debug-candidates] Running matchDepositLine for lineId:", lineId)

  try {
    const result = await matchDepositLine(lineId, {
      limit: 10,
    })

    console.info("[debug-candidates] Line item:", {
      id: result.lineItem.id,
      depositId: result.lineItem.depositId,
      tenantId: (result.lineItem as any).tenantId,
      paymentDate: result.lineItem.paymentDate,
    })

    console.info(
      "[debug-candidates] Candidates:",
      result.candidates.map((c) => ({
        id: c.revenueScheduleId,
        name: c.revenueScheduleName,
        confidence: c.matchConfidence,
        type: c.matchType,
        confidenceLevel: c.confidenceLevel,
      })),
    )
  } catch (error) {
    console.error("[debug-candidates] Error while matching deposit line:", error)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error("[debug-candidates] Unhandled error:", error)
  process.exit(1)
})

