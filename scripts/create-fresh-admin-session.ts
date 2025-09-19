import { PrismaClient } from '@prisma/client'
import { createUserSession } from '../lib/auth'

const prisma = new PrismaClient()

async function createFreshAdminSession() {
  try {
    console.log('🔄 Creating fresh admin session...')
    
    // Get the admin user
    const adminUser = await prisma.user.findFirst({
      where: {
        email: 'admin@commissable.test'
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
      console.log('❌ Admin user not found')
      return
    }

    console.log(`👤 Admin User: ${adminUser.fullName} (${adminUser.email})`)
    console.log(`📊 Total Permissions: ${adminUser.role?.permissions.length || 0}`)
    
    // Check data management permissions
    const dataMgmtPerms = adminUser.role?.permissions.filter(rp => 
      rp.permission.code.includes('data_management')
    ) || []
    
    console.log(`🎯 Data Management Permissions: ${dataMgmtPerms.length}`)
    dataMgmtPerms.forEach(rp => {
      console.log(`   ✅ ${rp.permission.code} - ${rp.permission.name}`)
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

    // Create a new session
    const { sessionToken, sessionId, expiresAt } = await createUserSession(
      adminUser.id,
      adminUser.tenantId,
      '127.0.0.1',
      'Fresh-Session-Script'
    )

    console.log('✅ Created new session')
    console.log(`🔐 Session ID: ${sessionId}`)
    console.log(`🎫 Session Token: ${sessionToken.substring(0, 20)}...`)
    console.log(`⏰ Expires: ${expiresAt}`)

    // Verify the session was created
    const newSession = await prisma.userSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
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
        }
      }
    })

    if (newSession) {
      console.log('\n✅ Session Verification:')
      console.log(`   User: ${newSession.user.fullName}`)
      console.log(`   Permissions: ${newSession.user.role?.permissions.length || 0}`)
      
      const sessionDataMgmtPerms = newSession.user.role?.permissions.filter(rp => 
        rp.permission.code.includes('data_management')
      ) || []
      
      console.log(`   Data Management Permissions: ${sessionDataMgmtPerms.length}`)
      sessionDataMgmtPerms.forEach(rp => {
        console.log(`     ✅ ${rp.permission.code}`)
      })
    }

    console.log('\n🎉 Fresh session created successfully!')
    console.log('\n📋 Next steps:')
    console.log('   1. Clear your browser cookies/cache completely')
    console.log('   2. Log in again with admin@commissable.test')
    console.log('   3. Navigate to Admin > Data Management Center')
    console.log('   4. Click the "🔄 Refresh Auth Data" button if needed')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createFreshAdminSession()
