import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Role permission templates
const ROLE_PERMISSIONS = {
  Salesperson: [
    'accounts.view.assigned',
    'accounts.create',
    'accounts.edit.assigned',
    'contacts.view.assigned',
    'contacts.create',
    'contacts.edit.assigned',
    'opportunities.view.assigned',
    'opportunities.create',
    'opportunities.edit.assigned',
    'activities.view.assigned',
    'activities.create',
    'activities.edit.assigned',
    'tickets.view.assigned',
    'tickets.create',
    'tickets.edit.assigned'
  ],
  'Sales Management': [
    'accounts.view.all',
    'accounts.create',
    'accounts.edit.all',
    'accounts.delete',
    'accounts.export',
    'accounts.bulk',
    'accounts.reassign',
    'contacts.view.all',
    'contacts.create',
    'contacts.edit.all',
    'contacts.delete',
    'contacts.export',
    'contacts.bulk',
    'opportunities.view.all',
    'opportunities.create',
    'opportunities.edit.all',
    'opportunities.delete',
    'opportunities.export',
    'activities.view.all',
    'activities.create',
    'activities.edit.all',
    'activities.delete',
    'tickets.view.all',
    'tickets.create',
    'tickets.edit.all',
    'tickets.delete'
  ],
  Accounting: [
    'accounts.view.all',
    'contacts.view.all',
    'opportunities.view.all',
    'finance.view.reconciliation',
    'finance.view.all',
    'finance.copy_protection'
  ],
  Administrator: [
    'accounts.view.all',
    'accounts.create',
    'accounts.edit.all',
    'accounts.delete',
    'accounts.export',
    'accounts.bulk',
    'accounts.reassign',
    'contacts.view.all',
    'contacts.create',
    'contacts.edit.all',
    'contacts.delete',
    'contacts.export',
    'contacts.bulk',
    'opportunities.view.all',
    'opportunities.create',
    'opportunities.edit.all',
    'opportunities.delete',
    'opportunities.export',
    'activities.view.all',
    'activities.create',
    'activities.edit.all',
    'activities.delete',
    'tickets.view.all',
    'tickets.create',
    'tickets.edit.all',
    'tickets.delete',
    'finance.view.reconciliation',
    'finance.view.all',
    'finance.edit',
    'finance.export',
    'finance.copy_protection',
    'admin.users.manage',
    'admin.roles.manage',
    'admin.system.config',
    'admin.audit.access',
    'admin.import_export',
    'system.all_modules',
    'system.backup',
    'system.maintenance'
  ]
}

async function updateRolePermissions() {
  console.log('Updating role permissions...')
  
  // Get all tenants
  const tenants = await prisma.tenant.findMany()
  
  for (const tenant of tenants) {
    console.log(`\nProcessing tenant: ${tenant.name}`)
    
    // Get all roles for this tenant
    const roles = await prisma.role.findMany({
      where: { tenantId: tenant.id }
    })
    
    for (const role of roles) {
      const permissionCodes = ROLE_PERMISSIONS[role.name as keyof typeof ROLE_PERMISSIONS]
      
      if (permissionCodes) {
        console.log(`  Updating role: ${role.name}`)
        
        // Get permission IDs
        const permissions = await prisma.permission.findMany({
          where: { code: { in: permissionCodes } }
        })
        
        const permissionIds = permissions.map(p => p.id)
        
        // Remove existing permissions
        await prisma.rolePermission.deleteMany({
          where: { roleId: role.id }
        })
        
        // Add new permissions
        if (permissionIds.length > 0) {
          await prisma.rolePermission.createMany({
            data: permissionIds.map(permissionId => ({
              tenantId: tenant.id,
              roleId: role.id,
              permissionId
            }))
          })
        }
        
        console.log(`    ✓ Updated ${permissionIds.length} permissions`)
      } else {
        console.log(`  Skipping role: ${role.name} (no template found)`)
      }
    }
  }
  
  console.log('\nRole permissions update completed!')
}

async function main() {
  try {
    await updateRolePermissions()
  } catch (error) {
    console.error('Error updating role permissions:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

export { updateRolePermissions }
