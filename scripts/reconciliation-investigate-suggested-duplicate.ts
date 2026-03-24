import { prisma } from "../lib/db"

async function main() {
  const tenantId = process.argv[2]?.trim()
  const primaryScheduleNumber = process.argv[3]?.trim() || "12698"
  const comparisonScheduleNumber = process.argv[4]?.trim() || "12710"

  if (!tenantId) {
    throw new Error(
      "Usage: tsx scripts/reconciliation-investigate-suggested-duplicate.ts <tenantId> [primaryScheduleNumber] [comparisonScheduleNumber]",
    )
  }

  const rows = await prisma.revenueSchedule.findMany({
    where: {
      tenantId,
      scheduleNumber: {
        in: [primaryScheduleNumber, comparisonScheduleNumber],
      },
    },
    select: {
      id: true,
      scheduleNumber: true,
      scheduleDate: true,
      accountId: true,
      opportunityId: true,
      opportunityProductId: true,
      productId: true,
      vendorAccountId: true,
      distributorAccountId: true,
      flexClassification: true,
      deletedAt: true,
    },
    orderBy: [{ scheduleNumber: "asc" }, { createdAt: "asc" }],
  })

  const grouped = rows.reduce<Record<string, unknown[]>>((acc, row) => {
    const key = row.scheduleNumber ?? "(blank)"
    if (!acc[key]) acc[key] = []
    acc[key]!.push(row)
    return acc
  }, {})

  console.log(JSON.stringify({ tenantId, primaryScheduleNumber, comparisonScheduleNumber, grouped }, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null)
  })
