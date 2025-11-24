import { prisma } from '@/lib/db'

async function main() {
  try {
    // Pick a single opportunity + tenant from the DB using the shared prisma proxy
    const opp = await prisma.opportunity.findFirst({
      select: { id: true, tenantId: true, name: true }
    })

    if (!opp) {
      console.log('No opportunity found.')
      return
    }

    console.log('Using opportunity:', opp.id, opp.name, 'tenant:', opp.tenantId)

    const page = 1
    const pageSize = 50

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where: {
          tenantId: opp.tenantId,
          entityName: 'Opportunity',
          entityId: opp.id
        },
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize
      }),
      prisma.auditLog.count({
        where: {
          tenantId: opp.tenantId,
          entityName: 'Opportunity',
          entityId: opp.id
        }
      })
    ])

    console.log('Transaction completed. Logs:', logs.length, 'Total:', total)
  } catch (error) {
    console.error('Transaction test failed:', error)
  }
}

if (require.main === module) {
  // eslint-disable-next-line no-console
  main().then(() => process.exit(0))
}

