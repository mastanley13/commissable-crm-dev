// Quick DB check script using Prisma Client
// Prints counts of revenue schedules and how many have non-zero actuals/adjustments

const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    const total = await prisma.revenueSchedule.count()
    const nonZeroActuals = await prisma.revenueSchedule.count({
      where: {
        OR: [
          { actualUsage: { not: 0 } },
          { actualCommission: { not: 0 } },
          { actualUsageAdjustment: { not: 0 } },
          { actualCommissionAdjustment: { not: 0 } },
        ],
      },
    })

    const nonZeroAdjustments = await prisma.revenueSchedule.count({
      where: {
        OR: [
          { actualUsageAdjustment: { not: 0 } },
          { actualCommissionAdjustment: { not: 0 } },
        ],
      },
    })

    console.log(JSON.stringify({
      ok: true,
      totals: { total, nonZeroActuals, nonZeroAdjustments },
    }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => {
  console.error('DB check failed:', err)
  process.exit(1)
})

