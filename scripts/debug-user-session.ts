import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugUserSession() {
  try {
    console.log('🔍 Debugging User Session Data...')
    
    // Get the admin user with full data
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
        },
        sessions: {
          where: {
            terminatedAt: null,
            expiresAt: { gt: new Date() }
          }
        }
      }
    })

    if (!adminUser) {
      console.log('❌ Admin user not found')
      return
    }

    console.log(`\n👤 Admin User: ${adminUser.fullName} (${adminUser.email})`)
    console.log(`🏢 Tenant ID: ${adminUser.tenantId}`)
    console.log(`👑 Role: ${adminUser.role?.name} (${adminUser.role?.code})`)
    console.log(`📊 Total Permissions: ${adminUser.role?.permissions.length || 0}`)
    console.log(`🔐 Active Sessions: ${adminUser.sessions.length}`)

    // Check for data management permissions specifically
    const dataMgmtPerms = adminUser.role?.permissions.filter(rp => 
      rp.permission.code.includes('data_management')
    ) || []

    console.log(`\n📋 Data Management Permissions Found:`)
    if (dataMgmtPerms.length > 0) {
      dataMgmtPerms.forEach(rp => {
        console.log(`   ✅ ${rp.permission.code} - ${rp.permission.name}`)
      })
    } else {
      console.log('   ❌ No data management permissions found')
    }

    // Check all admin permissions
    const adminPerms = adminUser.role?.permissions.filter(rp => 
      rp.permission.code.startsWith('admin.')
    ) || []

    console.log(`\n🔐 All Admin Permissions (${adminPerms.length} total):`)
    adminPerms.forEach(rp => {
      const isDataMgmt = rp.permission.code.includes('data_management')
      const marker = isDataMgmt ? '🎯' : '  '
      console.log(`   ${marker} ${rp.permission.code} - ${rp.permission.name}`)
    })

    // Check active sessions
    if (adminUser.sessions.length > 0) {
      console.log(`\n🔐 Active Sessions:`)
      adminUser.sessions.forEach(session => {
        console.log(`   Session ID: ${session.id}`)
        console.log(`   Created: ${session.createdAt}`)
        console.log(`   Last Seen: ${session.lastSeenAt}`)
        console.log(`   Expires: ${session.expiresAt}`)
        console.log(`   IP: ${session.ipAddress || 'Unknown'}`)
        console.log('   ---')
      })
    } else {
      console.log('\n❌ No active sessions found')
    }

    // Test the exact permission check logic
    console.log(`\n🧪 Testing Permission Logic:`)
    const hasDataMgmt = adminUser.role?.permissions.some(rp => rp.permission.code === 'admin.data_management') || false
    const hasDataMgmtView = adminUser.role?.permissions.some(rp => rp.permission.code === 'admin.data_management.view') || false
    
    console.log(`   admin.data_management: ${hasDataMgmt ? '✅' : '❌'}`)
    console.log(`   admin.data_management.view: ${hasDataMgmtView ? '✅' : '❌'}`)
    console.log(`   Can Access Data Management: ${(hasDataMgmt || hasDataMgmtView) ? '✅' : '❌'}`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugUserSession()
