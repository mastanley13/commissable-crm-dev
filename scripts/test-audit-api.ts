import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testAuditAPI() {
  console.log('Testing audit logs API endpoint...\n')

  try {
    // Get a user to authenticate as
    const user = await prisma.user.findFirst({
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    })

    if (!user) {
      console.error('❌ No user found')
      return
    }

    console.log(`Testing as user: ${user.fullName} (${user.email})`)
    console.log(`Role: ${user.role?.name || 'No role'}`)

    const permissions = user.role?.permissions.map(rp => rp.permission.code) || []
    console.log(`Permissions: ${permissions.join(', ')}\n`)

    // Check if user has audit permissions
    const hasAuditRead = permissions.includes('auditLogs.read')
    const hasOpportunitiesManage = permissions.includes('opportunities.manage')

    console.log(`Has auditLogs.read: ${hasAuditRead}`)
    console.log(`Has opportunities.manage: ${hasOpportunitiesManage}\n`)

    // Get test opportunity
    const opportunity = await prisma.opportunity.findFirst({
      where: { name: 'DW Realty GA, LLC' }
    })

    if (!opportunity) {
      console.error('❌ Test opportunity not found')
      return
    }

    console.log(`Test opportunity: ${opportunity.name}`)
    console.log(`Opportunity ID: ${opportunity.id}\n`)

    // Check audit logs directly from database
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityName: 'Opportunity',
        entityId: opportunity.id
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } }
      }
    })

    console.log(`✅ Direct database query found ${auditLogs.length} audit log(s)\n`)

    if (auditLogs.length > 0) {
      const log = auditLogs[0]
      console.log('Sample audit log:')
      console.log(`  ID: ${log.id}`)
      console.log(`  Action: ${log.action}`)
      console.log(`  User: ${log.user?.fullName || 'Unknown'}`)
      console.log(`  Changed fields type: ${typeof log.changedFields}`)
      console.log(`  Changed fields value:`, log.changedFields)
      console.log(`  Created at: ${log.createdAt}`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  }
}

async function main() {
  try {
    await testAuditAPI()
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

export { testAuditAPI }
