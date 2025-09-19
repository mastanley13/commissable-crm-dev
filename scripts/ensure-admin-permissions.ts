import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// All permissions that should be available in the system
const ALL_PERMISSIONS = [
  // Accounts permissions
  { code: 'accounts.view.assigned', name: 'View assigned accounts only', description: 'Can only view accounts assigned to them', category: 'Accounts' },
  { code: 'accounts.view.all', name: 'View all accounts', description: 'Can view all accounts in the system', category: 'Accounts' },
  { code: 'accounts.create', name: 'Create new accounts', description: 'Can create new account records', category: 'Accounts' },
  { code: 'accounts.edit.assigned', name: 'Edit assigned accounts', description: 'Can edit accounts assigned to them', category: 'Accounts' },
  { code: 'accounts.edit.all', name: 'Edit all accounts', description: 'Can edit any account in the system', category: 'Accounts' },
  { code: 'accounts.delete', name: 'Delete accounts', description: 'Can delete account records', category: 'Accounts' },
  { code: 'accounts.export', name: 'Export account lists', description: 'Can export account data', category: 'Accounts' },
  { code: 'accounts.bulk', name: 'Bulk operations', description: 'Can perform bulk operations on accounts', category: 'Accounts' },
  { code: 'accounts.reassign', name: 'User reassignment', description: 'Can reassign accounts to other users', category: 'Accounts' },

  // Contacts permissions
  { code: 'contacts.view.assigned', name: 'View contacts at assigned accounts', description: 'Can view contacts only at assigned accounts', category: 'Contacts' },
  { code: 'contacts.view.all', name: 'View all contacts', description: 'Can view all contacts in the system', category: 'Contacts' },
  { code: 'contacts.create', name: 'Create new contacts', description: 'Can create new contact records', category: 'Contacts' },
  { code: 'contacts.edit.assigned', name: 'Edit contacts at assigned accounts', description: 'Can edit contacts at assigned accounts', category: 'Contacts' },
  { code: 'contacts.edit.all', name: 'Edit all contacts', description: 'Can edit any contact in the system', category: 'Contacts' },
  { code: 'contacts.delete', name: 'Delete contacts', description: 'Can delete contact records', category: 'Contacts' },
  { code: 'contacts.export', name: 'Export contact lists', description: 'Can export contact data', category: 'Contacts' },
  { code: 'contacts.bulk', name: 'Bulk operations', description: 'Can perform bulk operations on contacts', category: 'Contacts' },

  // Opportunities permissions
  { code: 'opportunities.view.assigned', name: 'View assigned opportunities', description: 'Can view opportunities assigned to them', category: 'Opportunities' },
  { code: 'opportunities.view.all', name: 'View all opportunities', description: 'Can view all opportunities in the system', category: 'Opportunities' },
  { code: 'opportunities.create', name: 'Create opportunities', description: 'Can create new opportunity records', category: 'Opportunities' },
  { code: 'opportunities.edit.assigned', name: 'Edit assigned opportunities', description: 'Can edit opportunities assigned to them', category: 'Opportunities' },
  { code: 'opportunities.edit.all', name: 'Edit all opportunities', description: 'Can edit any opportunity in the system', category: 'Opportunities' },
  { code: 'opportunities.delete', name: 'Delete opportunities', description: 'Can delete opportunity records', category: 'Opportunities' },
  { code: 'opportunities.export', name: 'Export opportunities', description: 'Can export opportunity data', category: 'Opportunities' },

  // Finance permissions
  { code: 'finance.view.reconciliation', name: 'Access for reconciliation', description: 'Can access reconciliation features', category: 'Finance' },
  { code: 'finance.view.all', name: 'View all financial data', description: 'Can view all financial information', category: 'Finance' },
  { code: 'finance.edit', name: 'Modify financial records', description: 'Can modify financial records', category: 'Finance' },
  { code: 'finance.export', name: 'Export financial data', description: 'Can export financial data', category: 'Finance' },
  { code: 'finance.copy_protection', name: 'Copy protection enabled', description: 'Copy protection is enforced for this role', category: 'Finance' },

  // Activities permissions
  { code: 'activities.view.assigned', name: 'View assigned activities', description: 'Can view activities assigned to them', category: 'Activities' },
  { code: 'activities.view.all', name: 'View all activities', description: 'Can view all activities in the system', category: 'Activities' },
  { code: 'activities.create', name: 'Create activities', description: 'Can create new activity records', category: 'Activities' },
  { code: 'activities.edit.assigned', name: 'Edit assigned activities', description: 'Can edit activities assigned to them', category: 'Activities' },
  { code: 'activities.edit.all', name: 'Edit all activities', description: 'Can edit any activity in the system', category: 'Activities' },
  { code: 'activities.delete', name: 'Delete activities', description: 'Can delete activity records', category: 'Activities' },

  // Tickets permissions
  { code: 'tickets.view.assigned', name: 'View assigned tickets', description: 'Can view tickets assigned to them', category: 'Tickets' },
  { code: 'tickets.view.all', name: 'View all tickets', description: 'Can view all tickets in the system', category: 'Tickets' },
  { code: 'tickets.create', name: 'Create tickets', description: 'Can create new ticket records', category: 'Tickets' },
  { code: 'tickets.edit.assigned', name: 'Edit assigned tickets', description: 'Can edit tickets assigned to them', category: 'Tickets' },
  { code: 'tickets.edit.all', name: 'Edit all tickets', description: 'Can edit any ticket in the system', category: 'Tickets' },
  { code: 'tickets.delete', name: 'Delete tickets', description: 'Can delete ticket records', category: 'Tickets' },

  // Admin permissions
  { code: 'admin.users.manage', name: 'User management', description: 'Can manage system users', category: 'Admin' },
  { code: 'admin.roles.manage', name: 'Role management', description: 'Can manage user roles and permissions', category: 'Admin' },
  { code: 'admin.system.config', name: 'System configuration', description: 'Can configure system settings', category: 'Admin' },
  { code: 'admin.audit.access', name: 'Audit log access', description: 'Can access audit logs', category: 'Admin' },
  { code: 'admin.import_export', name: 'Full import/export rights', description: 'Can import and export all data', category: 'Admin' },
  { code: 'admin.roles.read', name: 'Read Roles', description: 'Can read role information', category: 'Admin' },
  { code: 'admin.roles.create', name: 'Create Roles', description: 'Can create new roles', category: 'Admin' },
  { code: 'admin.roles.update', name: 'Update Roles', description: 'Can update existing roles', category: 'Admin' },
  { code: 'admin.roles.delete', name: 'Delete Roles', description: 'Can delete roles', category: 'Admin' },
  { code: 'admin.permissions.read', name: 'Read Permissions', description: 'Can read permission information', category: 'Admin' },
  { code: 'admin.users.read', name: 'Read Users', description: 'Can read user information', category: 'Admin' },
  { code: 'admin.users.create', name: 'Create Users', description: 'Can create new users', category: 'Admin' },
  { code: 'admin.users.update', name: 'Update Users', description: 'Can update existing users', category: 'Admin' },
  { code: 'admin.users.delete', name: 'Delete Users', description: 'Can delete users', category: 'Admin' },

  // System permissions
  { code: 'system.all_modules', name: 'All modules and features', description: 'Access to all system modules', category: 'System' },
  { code: 'system.backup', name: 'System backup', description: 'Can perform system backups', category: 'System' },
  { code: 'system.maintenance', name: 'System maintenance', description: 'Can perform system maintenance tasks', category: 'System' },
  { code: 'tables.customize', name: 'Customize Tables', description: 'Can customize table views', category: 'System' },
  { code: 'system.settings.read', name: 'Read System Settings', description: 'Can read system settings', category: 'System' },
  { code: 'system.settings.write', name: 'Write System Settings', description: 'Can modify system settings', category: 'System' },

  // Products permissions
  { code: 'products.read', name: 'Read Products', description: 'Can read product information', category: 'Products' },
  { code: 'products.create', name: 'Create Products', description: 'Can create new products', category: 'Products' },
  { code: 'products.update', name: 'Update Products', description: 'Can update existing products', category: 'Products' },
  { code: 'products.delete', name: 'Delete Products', description: 'Can delete products', category: 'Products' }
]

async function ensureAdminPermissions() {
  console.log('🔧 Ensuring admin has all permissions...')
  
  try {
    // Step 1: Create/update all permissions
    console.log('📝 Creating/updating all permissions...')
    for (const permission of ALL_PERMISSIONS) {
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
    }
    console.log(`✅ Created/updated ${ALL_PERMISSIONS.length} permissions`)

    // Step 2: Get all tenants
    const tenants = await prisma.tenant.findMany()
    console.log(`🏢 Found ${tenants.length} tenants`)

    for (const tenant of tenants) {
      console.log(`\n📋 Processing tenant: ${tenant.name}`)
      
      // Step 3: Find or create Administrator role
      let adminRole = await prisma.role.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [
            { code: 'ADMIN' },
            { code: 'Administrator' },
            { name: 'Administrator' }
          ]
        }
      })

      if (!adminRole) {
        console.log('   Creating Administrator role...')
        adminRole = await prisma.role.create({
          data: {
            tenantId: tenant.id,
            code: 'ADMIN',
            name: 'Administrator',
            description: 'Full system control',
            scope: 'Tenant',
            isDefault: false
          }
        })
        console.log('   ✅ Created Administrator role')
      } else {
        console.log(`   ✅ Found Administrator role: ${adminRole.name}`)
      }

      // Step 4: Get all permissions
      const allPermissions = await prisma.permission.findMany()
      console.log(`   📊 Found ${allPermissions.length} total permissions`)

      // Step 5: Grant all permissions to admin role
      console.log('   🔐 Granting all permissions to Administrator role...')
      let grantedCount = 0
      
      for (const permission of allPermissions) {
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
      
      console.log(`   ✅ Granted ${grantedCount} permissions to Administrator role`)

      // Step 6: Update other roles with template permissions
      console.log('   🎯 Updating other roles with template permissions...')
      
      const roleTemplates = {
        'Salesperson': [
          'accounts.view.assigned', 'accounts.create', 'accounts.edit.assigned',
          'contacts.view.assigned', 'contacts.create', 'contacts.edit.assigned',
          'opportunities.view.assigned', 'opportunities.create', 'opportunities.edit.assigned',
          'activities.view.assigned', 'activities.create', 'activities.edit.assigned',
          'tickets.view.assigned', 'tickets.create', 'tickets.edit.assigned'
        ],
        'Sales Management': [
          'accounts.view.all', 'accounts.create', 'accounts.edit.all', 'accounts.delete', 'accounts.export', 'accounts.bulk', 'accounts.reassign',
          'contacts.view.all', 'contacts.create', 'contacts.edit.all', 'contacts.delete', 'contacts.export', 'contacts.bulk',
          'opportunities.view.all', 'opportunities.create', 'opportunities.edit.all', 'opportunities.delete', 'opportunities.export',
          'activities.view.all', 'activities.create', 'activities.edit.all', 'activities.delete',
          'tickets.view.all', 'tickets.create', 'tickets.edit.all', 'tickets.delete'
        ],
        'Accounting': [
          'accounts.view.all', 'contacts.view.all', 'opportunities.view.all',
          'finance.view.reconciliation', 'finance.view.all', 'finance.copy_protection'
        ]
      }

      for (const [roleName, permissionCodes] of Object.entries(roleTemplates)) {
        const role = await prisma.role.findFirst({
          where: {
            tenantId: tenant.id,
            OR: [
              { name: roleName },
              { code: roleName.toUpperCase().replace(' ', '_') }
            ]
          }
        })

        if (role) {
          // Remove existing permissions
          await prisma.rolePermission.deleteMany({
            where: { roleId: role.id }
          })

          // Add template permissions
          const templatePermissions = await prisma.permission.findMany({
            where: { code: { in: permissionCodes } }
          })

          if (templatePermissions.length > 0) {
            await prisma.rolePermission.createMany({
              data: templatePermissions.map(permission => ({
                tenantId: tenant.id,
                roleId: role.id,
                permissionId: permission.id
              }))
            })
            console.log(`   ✅ Updated ${roleName} with ${templatePermissions.length} permissions`)
          }
        }
      }
    }

    console.log('\n🎉 Admin permissions setup completed successfully!')
    console.log('\n📋 Summary:')
    console.log(`   • Created/updated ${ALL_PERMISSIONS.length} permissions`)
    console.log(`   • Processed ${tenants.length} tenants`)
    console.log('   • Administrator role now has ALL permissions')
    console.log('   • Other roles updated with template permissions')

  } catch (error) {
    console.error('❌ Error setting up admin permissions:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  try {
    await ensureAdminPermissions()
  } catch (error) {
    console.error('Failed to ensure admin permissions:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { ensureAdminPermissions }
