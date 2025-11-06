const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    const rows = await prisma.revenueSchedule.findMany({
      take: 25,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        scheduleNumber: true,
        scheduleDate: true,
        expectedUsage: true,
        usageAdjustment: true,
        actualUsage: true,
        actualUsageAdjustment: true,
        expectedCommission: true,
        actualCommission: true,
        actualCommissionAdjustment: true,
        opportunity: { select: { id: true, name: true } },
        account: { select: { id: true, accountName: true } },
      }
    })
    console.log(JSON.stringify(rows, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => {
  console.error('list failed:', err)
  process.exit(1)
})

