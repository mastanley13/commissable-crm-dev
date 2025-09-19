import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// New permissions for data management and import/export
const NEW_PERMISSIONS = [
  // Data Management permissions
  { code: 'admin.data_management', name: 'Data Management Access', description: 'Can access the Data Management Center', category: 'Admin' },
  { code: 'admin.data_management.view', name: 'View Data Management', description: 'Can view data management options', category: 'Admin' },
  
  // Import/Export permissions (more granular)
  { code: 'accounts.import', name: 'Import Accounts', description: 'Can import account data from files', category: 'Accounts' },
  { code: 'contacts.import', name: 'Import Contacts', description: 'Can import contact data from files', category: 'Contacts' },
  { code: 'accounts.template', name: 'Download Account Templates', description: 'Can download import templates for accounts', category: 'Accounts' },
  { code: 'contacts.template', name: 'Download Contact Templates', description: 'Can download import templates for contacts', category: 'Contacts' },
  
  // Data Management specific permissions
  { code: 'admin.backup', name: 'System Backup', description: 'Can create and manage system backups', category: 'Admin' },
  { code: 'admin.restore', name: 'Data Restore', description: 'Can restore data from backups', category: 'Admin' },
  { code: 'admin.cleanup', name: 'Data Cleanup', description: 'Can clean up old or unused data', category: 'Admin' },
  { code: 'admin.database', name: 'Database Maintenance', description: 'Can perform database maintenance tasks', category: 'Admin' },
  { code: 'admin.migration', name: 'Data Migration', description: 'Can migrate data between systems', category: 'Admin' },
  { code: 'admin.validate', name: 'Data Validation', description: 'Can validate data integrity', category: 'Admin' },
  { code: 'admin.reports', name: 'System Reports', description: 'Can generate system reports', category: 'Admin' },
  { code: 'admin.cloud', name: 'Cloud Sync', description: 'Can synchronize data with cloud services', category: 'Admin' }
]

async function addDataManagementPermissions() {
  console.log('🔧 Adding data management permissions...')
  
  try {
    // Step 1: Create/update new permissions
    console.log('📝 Creating/updating new permissions...')
    for (const permission of NEW_PERMISSIONS) {
      await prisma.permission.upsert({
        where: { code: permission.code },
        update: {
          name: permission.name,
          description: permission.description,
          category: permission.category as any
        },
        create: {
          code: permission.code,
          name: permission.name,
          description: permission.description,
          category: permission.category as any
        }
      })
      console.log(`✓ Created/updated permission: ${permission.code}`)
    }
    console.log(`✅ Created/updated ${NEW_PERMISSIONS.length} new permissions`)

    // Step 2: Get all tenants
    const tenants = await prisma.tenant.findMany()
    console.log(`🏢 Found ${tenants.length} tenants`)

    for (const tenant of tenants) {
      console.log(`\n📋 Processing tenant: ${tenant.name}`)
      
      // Step 3: Find Administrator role
      const adminRole = await prisma.role.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [
            { code: 'ADMIN' },
            { code: 'Administrator' },
            { name: 'Administrator' }
          ]
        }
      })

      if (adminRole) {
        console.log(`   ✅ Found Administrator role: ${adminRole.name}`)
        
        // Step 4: Grant new permissions to admin role
        console.log('   🔐 Granting new permissions to Administrator role...')
        const newPermissions = await prisma.permission.findMany({
          where: { code: { in: NEW_PERMISSIONS.map(p => p.code) } }
        })
        
        let grantedCount = 0
        for (const permission of newPermissions) {
          try {
            await prisma.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: adminRole.id,
                  permissionId: permission.id
                }
              },
              update: {},
              create: {
                tenantId: tenant.id,
                roleId: adminRole.id,
                permissionId: permission.id
              }
            })
            grantedCount++
          } catch (error) {
            // Permission might already exist, continue
          }
        }
        console.log(`   ✅ Granted ${grantedCount} new permissions to Administrator role`)
      } else {
        console.log('   ⚠️  Administrator role not found for this tenant')
      }

      // Step 5: Grant import/export permissions to Sales Management role
      const salesMgmtRole = await prisma.role.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [
            { name: 'Sales Management' },
            { code: 'SALES_MGMT' }
          ]
        }
      })

      if (salesMgmtRole) {
        console.log(`   ✅ Found Sales Management role: ${salesMgmtRole.name}`)
        
        // Grant import/export permissions to Sales Management
        const salesMgmtPermissions = await prisma.permission.findMany({
          where: { 
            code: { 
              in: [
                'admin.data_management',
                'admin.data_management.view',
                'accounts.import',
                'accounts.export',
                'accounts.template',
                'contacts.import',
                'contacts.export',
                'contacts.template'
              ]
            }
          }
        })
        
        let grantedCount = 0
        for (const permission of salesMgmtPermissions) {
          try {
            await prisma.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: salesMgmtRole.id,
                  permissionId: permission.id
                }
              },
              update: {},
              create: {
                tenantId: tenant.id,
                roleId: salesMgmtRole.id,
                permissionId: permission.id
              }
            })
            grantedCount++
          } catch (error) {
            // Permission might already exist, continue
          }
        }
        console.log(`   ✅ Granted ${grantedCount} import/export permissions to Sales Management role`)
      }
    }

    console.log('\n🎉 Data management permissions setup completed successfully!')
    console.log('\n📋 Summary:')
    console.log(`   • Created/updated ${NEW_PERMISSIONS.length} new permissions`)
    console.log(`   • Processed ${tenants.length} tenants`)
    console.log('   • Administrator role now has ALL new permissions')
    console.log('   • Sales Management role has import/export permissions')

  } catch (error) {
    console.error('❌ Error adding data management permissions:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  try {
    await addDataManagementPermissions()
  } catch (error) {
    console.error('Failed to add data management permissions:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { addDataManagementPermissions }
