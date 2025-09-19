import { PrismaClient } from '@prisma/client'
import { createUserSession, setSessionCookie } from '../lib/auth'

const prisma = new PrismaClient()

async function forceSessionRefresh() {
  try {
    console.log('🔄 Force refreshing admin user session...')
    
    // Get the admin user
    const adminUser = await prisma.user.findFirst({
      where: {
        role: {
          code: 'ADMIN'
        }
      },
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

    if (!adminUser) {
      console.log('❌ No admin user found')
      return
    }

    console.log(`👤 Found admin user: ${adminUser.fullName} (${adminUser.email})`)
    console.log(`📊 Total permissions: ${adminUser.role?.permissions.length || 0}`)

    // Check for data management permissions
    const dataMgmtPerms = adminUser.role?.permissions.filter(rp => 
      rp.permission.code.includes('data_management')
    ) || []

    console.log(`🔍 Data Management permissions: ${dataMgmtPerms.length}`)
    dataMgmtPerms.forEach(rp => {
      console.log(`   ✓ ${rp.permission.code}`)
    })

    // Terminate all existing sessions
    await prisma.userSession.updateMany({
      where: {
        userId: adminUser.id,
        terminatedAt: null
      },
      data: {
        terminatedAt: new Date()
      }
    })

    console.log('✅ Terminated all existing sessions')
    console.log('\n🎉 Session refresh completed!')
    console.log('📋 Next steps:')
    console.log('   1. Log out of your browser (if still logged in)')
    console.log('   2. Log back in with your admin credentials')
    console.log('   3. Navigate to Admin > Data Management Center')
    console.log('   4. You should now see the Import/Export section and Mock Graphs!')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

forceSessionRefresh()
