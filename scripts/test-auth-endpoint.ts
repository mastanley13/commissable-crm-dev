import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testAuthEndpoint() {
  try {
    console.log('🧪 Testing Auth Endpoint Logic...')
    
    // Get the active session
    const session = await prisma.userSession.findFirst({
      where: {
        terminatedAt: null,
        expiresAt: { gt: new Date() }
      },
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

    if (!session) {
      console.log('❌ No active sessions found')
      return
    }

    console.log(`🔐 Active Session Found:`)
    console.log(`   Session ID: ${session.id}`)
    console.log(`   Session Token: ${session.sessionToken.substring(0, 20)}...`)
    console.log(`   User: ${session.user.fullName}`)
    console.log(`   Permissions: ${session.user.role?.permissions.length || 0}`)
    console.log(`   Expires: ${session.expiresAt}`)
    console.log(`   IP: ${session.ipAddress}`)

    // Check data management permissions in this session
    const dataMgmtPerms = session.user.role?.permissions.filter(rp => 
      rp.permission.code.includes('data_management')
    ) || []

    console.log(`\n🎯 Data Management Permissions in Session:`)
    if (dataMgmtPerms.length > 0) {
      dataMgmtPerms.forEach(rp => {
        console.log(`   ✅ ${rp.permission.code} - ${rp.permission.name}`)
      })
    } else {
      console.log('   ❌ No data management permissions found')
    }

    // Test the exact logic that /api/auth/me uses
    console.log(`\n🔍 Testing /api/auth/me Logic:`)
    
    // This simulates what getAuthenticatedUser does
    const testSession = await prisma.userSession.findFirst({
      where: {
        sessionToken: session.sessionToken,
        expiresAt: { gt: new Date() },
        terminatedAt: null
      }
    })

    if (testSession) {
      console.log('   ✅ Session token validation: PASSED')
      
      const testUser = await prisma.user.findFirst({
        where: {
          id: testSession.userId,
          tenantId: testSession.tenantId,
          status: { in: ['Active', 'Invited'] }
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

      if (testUser) {
        console.log('   ✅ User lookup: PASSED')
        console.log(`   ✅ User permissions: ${testUser.role?.permissions.length || 0}`)
        
        const testDataMgmtPerms = testUser.role?.permissions.filter(rp => 
          rp.permission.code.includes('data_management')
        ) || []
        
        console.log(`   ✅ Data management permissions: ${testDataMgmtPerms.length}`)
        testDataMgmtPerms.forEach(rp => {
          console.log(`     ✅ ${rp.permission.code}`)
        })
      } else {
        console.log('   ❌ User lookup: FAILED')
      }
    } else {
      console.log('   ❌ Session token validation: FAILED')
    }

    // Check if there are any issues with the session
    console.log(`\n🔍 Session Health Check:`)
    const now = new Date()
    const timeUntilExpiry = session.expiresAt.getTime() - now.getTime()
    const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60)
    
    console.log(`   Current time: ${now}`)
    console.log(`   Session expires: ${session.expiresAt}`)
    console.log(`   Time until expiry: ${hoursUntilExpiry.toFixed(2)} hours`)
    
    if (hoursUntilExpiry < 0) {
      console.log('   ❌ Session has expired!')
    } else if (hoursUntilExpiry < 1) {
      console.log('   ⚠️  Session expires within 1 hour')
    } else {
      console.log('   ✅ Session is valid and has time remaining')
    }

    console.log(`\n📋 Debugging Information:`)
    console.log(`   If the frontend is getting 401 errors, possible causes:`)
    console.log(`   1. Session cookie not being sent with requests`)
    console.log(`   2. Session cookie name mismatch (should be 'session-token')`)
    console.log(`   3. Cookie domain/path issues`)
    console.log(`   4. CORS issues`)
    console.log(`   5. Session token corruption during transmission`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAuthEndpoint()
