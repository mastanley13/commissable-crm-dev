import { OpportunityProductStatus } from "@prisma/client"

import { getPrisma, disconnect } from "../lib/db"
import { recalculateOpportunityStage } from "../lib/opportunities/stage"

const BATCH_SIZE = 25

async function main() {
  const prisma = await getPrisma()

  console.log("\n[Backfill] Starting opportunity stage/status backfill…")

  const activeToBilling = await prisma.opportunityProduct.updateMany({
    where: {
      active: true,
      status: OpportunityProductStatus.Provisioning
    },
    data: { status: OpportunityProductStatus.ActiveBilling }
  })

  const activeBillingFix = await prisma.opportunityProduct.updateMany({
    where: {
      active: true,
      status: OpportunityProductStatus.BillingEnded
    },
    data: { status: OpportunityProductStatus.ActiveBilling }
  })

  const inactiveToEnded = await prisma.opportunityProduct.updateMany({
    where: {
      active: false,
      status: OpportunityProductStatus.Provisioning
    },
    data: { status: OpportunityProductStatus.BillingEnded }
  })

  const activeBillingToEnded = await prisma.opportunityProduct.updateMany({
    where: {
      active: false,
      status: OpportunityProductStatus.ActiveBilling
    },
    data: { status: OpportunityProductStatus.BillingEnded }
  })

  console.log(
    `[Backfill] OpportunityProduct.status updates => active→billing: ${
      activeToBilling.count + activeBillingFix.count
    }, inactive→ended: ${inactiveToEnded.count + activeBillingToEnded.count}`
  )

  const closedWonConverted = await prisma.$executeRawUnsafe(`
    UPDATE "Opportunity"
    SET "stage" = 'ClosedWon_Provisioning'
    WHERE "stage" = 'ClosedWon'
  `)

  console.log(`[Backfill] Opportunities converted from ClosedWon → ClosedWon_Provisioning: ${closedWonConverted}`)

  const recalculationTargets = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Opportunity" WHERE "status" = 'Won' OR "stage" IN ('ClosedWon', 'ClosedWon_Provisioning', 'ClosedWon_Billing', 'ClosedWon_BillingEnded')`

  console.log(`[Backfill] Recalculating stages for ${recalculationTargets.length} opportunities…`)

  for (let i = 0; i < recalculationTargets.length; i += BATCH_SIZE) {
    const chunk = recalculationTargets.slice(i, i + BATCH_SIZE)
    await Promise.all(
      chunk.map(async ({ id }) => {
        try {
          await recalculateOpportunityStage(id)
        } catch (error) {
          console.error(`[Backfill] Failed to recalculate stage for opportunity ${id}:`, error)
        }
      })
    )
  }

  console.log("[Backfill] Opportunity stage/status recalculation complete.")
}

main()
  .catch(error => {
    console.error("[Backfill] Fatal error while running backfill:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnect()
  })


