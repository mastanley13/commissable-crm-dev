import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function refreshUserSession() {
  try {
    console.log('🔄 Refreshing user sessions to load new permissions...')
    
    // Get all active sessions for admin users
    const adminUsers = await prisma.user.findMany({
      where: {
        role: {
          code: 'ADMIN'
        }
      },
      include: {
        sessions: {
          where: {
            terminatedAt: null,
            expiresAt: { gt: new Date() }
          }
        }
      }
    })

    console.log(`📊 Found ${adminUsers.length} admin users`)

    for (const user of adminUsers) {
      console.log(`\n👤 Processing user: ${user.fullName} (${user.email})`)
      console.log(`   Active sessions: ${user.sessions.length}`)

      // Terminate all existing sessions for this user
      if (user.sessions.length > 0) {
        await prisma.userSession.updateMany({
          where: {
            userId: user.id,
            terminatedAt: null
          },
          data: {
            terminatedAt: new Date()
          }
        })
        console.log(`   ✅ Terminated ${user.sessions.length} existing sessions`)
      }
    }

    console.log('\n🎉 Session refresh completed!')
    console.log('📋 Next steps:')
    console.log('   1. Log out of your browser')
    console.log('   2. Log back in')
    console.log('   3. Navigate to Admin > Data Management Center')
    console.log('   4. You should now see the full Data Management Center!')

  } catch (error) {
    console.error('❌ Error refreshing sessions:', error)
  } finally {
    await prisma.$disconnect()
  }
}

refreshUserSession()
