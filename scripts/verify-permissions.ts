import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyPermissions() {
  try {
    console.log('🔍 Verifying Admin Permissions...')
    
    // Get the admin role
    const adminRole = await prisma.role.findFirst({
      where: { code: 'ADMIN' },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    })

    if (adminRole) {
      console.log('✅ Admin Role Found:', adminRole.name, '(' + adminRole.code + ')')
      console.log('📊 Total permissions:', adminRole.permissions.length)
      
      // Check for data management permissions
      const dataMgmtPerms = adminRole.permissions.filter(rp => 
        rp.permission.code.includes('data_management') || 
        rp.permission.code.includes('admin.backup') ||
        rp.permission.code.includes('admin.restore')
      )
      
      console.log('\n📋 Data Management Permissions:')
      dataMgmtPerms.forEach(rp => {
        console.log('  ✓', rp.permission.code, '-', rp.permission.name)
      })
      
      // Check specifically for the required permissions
      const hasDataMgmt = adminRole.permissions.some(rp => rp.permission.code === 'admin.data_management')
      const hasDataMgmtView = adminRole.permissions.some(rp => rp.permission.code === 'admin.data_management.view')
      
      console.log('\n🎯 Required Permissions Check:')
      console.log('  admin.data_management:', hasDataMgmt ? '✅' : '❌')
      console.log('  admin.data_management.view:', hasDataMgmtView ? '✅' : '❌')
      
      if (hasDataMgmt && hasDataMgmtView) {
        console.log('\n🎉 SUCCESS: Admin has all required Data Management permissions!')
        console.log('   You should now be able to access the Data Management Center.')
      } else {
        console.log('\n❌ ISSUE: Admin is missing required permissions.')
      }
      
    } else {
      console.log('❌ Admin role not found')
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyPermissions()
