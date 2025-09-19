import { PrismaClient } from '@prisma/client'
import { getAuthenticatedUser } from '../lib/auth'

const prisma = new PrismaClient()

async function testAuthAPI() {
  try {
    console.log('🧪 Testing Auth API Logic...')
    
    // Get the admin user directly from database
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
      console.log('❌ Admin user not found in database')
      return
    }

    console.log(`\n👤 Database User: ${adminUser.fullName}`)
    console.log(`📊 Database Permissions: ${adminUser.role?.permissions.length || 0}`)
    
    const dataMgmtPerms = adminUser.role?.permissions.filter(rp => 
      rp.permission.code.includes('data_management')
    ) || []
    
    console.log(`🎯 Data Management Permissions in DB: ${dataMgmtPerms.length}`)
    dataMgmtPerms.forEach(rp => {
      console.log(`   ✅ ${rp.permission.code}`)
    })

    // Test the getAuthenticatedUser function (this is what /api/auth/me uses)
    console.log(`\n🔍 Testing getAuthenticatedUser function...`)
    
    // Since there are no active sessions, this should return null
    const authUser = await getAuthenticatedUser()
    
    if (authUser) {
      console.log(`👤 Auth User: ${authUser.fullName}`)
      console.log(`📊 Auth Permissions: ${authUser.role?.permissions.length || 0}`)
      
      const authDataMgmtPerms = authUser.role?.permissions.filter(p => 
        p.code.includes('data_management')
      ) || []
      
      console.log(`🎯 Data Management Permissions in Auth: ${authDataMgmtPerms.length}`)
      authDataMgmtPerms.forEach(p => {
        console.log(`   ✅ ${p.code}`)
      })
    } else {
      console.log(`❌ getAuthenticatedUser returned null (no active session)`)
    }

    // Test permission check functions
    if (authUser) {
      console.log(`\n🧪 Testing Permission Check Functions:`)
      
      const hasDataMgmt = authUser.role?.permissions.some(p => p.code === 'admin.data_management') || false
      const hasDataMgmtView = authUser.role?.permissions.some(p => p.code === 'admin.data_management.view') || false
      
      console.log(`   hasPermission('admin.data_management'): ${hasDataMgmt ? '✅' : '❌'}`)
      console.log(`   hasPermission('admin.data_management.view'): ${hasDataMgmtView ? '✅' : '❌'}`)
      console.log(`   Can Access Data Management: ${(hasDataMgmt || hasDataMgmtView) ? '✅' : '❌'}`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAuthAPI()
