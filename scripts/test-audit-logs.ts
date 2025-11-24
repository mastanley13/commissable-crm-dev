import { PrismaClient, type AuditLog } from '@prisma/client'

const prisma = new PrismaClient()

function parseJsonField(field: any) {
  if (field === null || field === undefined) return null
  if (typeof field === 'string') {
    try {
      return JSON.parse(field)
    } catch {
      return field
    }
  }
  return field
}

async function dumpSampleOpportunityAudit() {
  console.log('Testing audit logs...\n')

  const totalLogs = await prisma.auditLog.count()
  console.log(`Total audit logs in database: ${totalLogs}`)

  const oppLogs = await prisma.auditLog.count({
    where: { entityName: 'Opportunity' }
  })
  console.log(`Opportunity audit logs: ${oppLogs}`)

  const sampleOpp = await prisma.opportunity.findFirst({
    select: { id: true, name: true, tenantId: true }
  })

  if (!sampleOpp) {
    console.log('No opportunities found in database')
    return
  }

  console.log(`\nChecking audit logs for opportunity: ${sampleOpp.name} (${sampleOpp.id})`)

  const logs = await prisma.auditLog.findMany({
    where: {
      entityName: 'Opportunity',
      entityId: sampleOpp.id
    },
    include: {
      user: { select: { fullName: true, email: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  console.log(`Found ${logs.length} audit log(s):\n`)

  const printLog = (log: AuditLog & { user: { fullName: string | null; email: string | null } | null }) => {
    console.log(`• ${log.action} at ${log.createdAt.toISOString()}`)
    console.log(`  User: ${log.user?.fullName || log.user?.email || 'Unknown'}`)
    console.log('  changedFields:', log.changedFields)
    console.log('  previousValues:', log.previousValues)
    console.log('  newValues:', log.newValues)
    console.log('  metadata:', log.metadata)
    console.log('')
  }

  logs.forEach(printLog)

  console.log('Testing API-style transaction + JSON payload...\n')

  const page = 1
  const pageSize = 50

  const [apiLogs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where: {
        tenantId: sampleOpp.tenantId,
        entityName: 'Opportunity',
        entityId: sampleOpp.id
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.auditLog.count({
      where: {
        tenantId: sampleOpp.tenantId,
        entityName: 'Opportunity',
        entityId: sampleOpp.id
      }
    })
  ])

  console.log(`[Debug] Transaction returned ${apiLogs.length} logs, total=${total}`)

  const responsePayload = {
    data: apiLogs.map(log => ({
      id: log.id,
      entityName: log.entityName,
      entityId: log.entityId,
      action: log.action,
      createdAt: log.createdAt.toISOString(),
      userId: log.userId,
      userName: log.user?.fullName ?? log.user?.email ?? null,
      changedFields: parseJsonField(log.changedFields),
      previousValues: parseJsonField(log.previousValues),
      newValues: parseJsonField(log.newValues),
      metadata: parseJsonField(log.metadata)
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  }

  try {
    const json = JSON.stringify(responsePayload)
    console.log('JSON serialization for API payload succeeded. Sample:')
    console.log(json.slice(0, 400), '...\n')
  } catch (err) {
    console.error('JSON serialization for API payload failed:', err)
    throw err
  }
}

async function main() {
  try {
    await dumpSampleOpportunityAudit()
  } catch (error) {
    console.error('Fatal error while testing audit logs:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  // eslint-disable-next-line no-console
  main()
}

export { dumpSampleOpportunityAudit }
