import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PERMISSIONS = [
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
  { code: 'accounts.manage', name: 'Manage accounts', description: 'Full management access to accounts', category: 'Accounts' },
  { code: 'accounts.read', name: 'Read accounts', description: 'Can read account data', category: 'Accounts' },

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
  { code: 'opportunities.manage', name: 'Manage opportunities', description: 'Full management access to opportunities', category: 'Opportunities' },
  { code: 'opportunities.read', name: 'Read opportunities', description: 'Can read opportunity data', category: 'Opportunities' },

  // Products permissions
  { code: 'products.read', name: 'Read products', description: 'Can view products', category: 'Products' },
  { code: 'products.create', name: 'Create products', description: 'Can create new product records', category: 'Products' },
  { code: 'products.update', name: 'Update products', description: 'Can edit product records', category: 'Products' },
  { code: 'products.delete', name: 'Delete products', description: 'Can delete product records', category: 'Products' },
  { code: 'products.manage', name: 'Manage products', description: 'Full management access to products', category: 'Products' },

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
  { code: 'activities.manage', name: 'Manage activities', description: 'Full management access to activities', category: 'Activities' },

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

  // Audit Logs permissions
  { code: 'auditLogs.read', name: 'Read audit logs', description: 'Can view audit logs', category: 'Admin' },
  { code: 'auditLogs.manage', name: 'Manage audit logs', description: 'Full management access to audit logs', category: 'Admin' },

  // System permissions
  { code: 'system.all_modules', name: 'All modules and features', description: 'Access to all system modules', category: 'System' },
  { code: 'system.backup', name: 'System backup', description: 'Can perform system backups', category: 'System' },
  { code: 'system.maintenance', name: 'System maintenance', description: 'Can perform system maintenance tasks', category: 'System' }
]

async function seedPermissions() {
  console.log('Seeding permissions...')
  
  for (const permission of PERMISSIONS) {
    try {
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
    } catch (error) {
      console.error(`✗ Failed to create permission ${permission.code}:`, error)
    }
  }
  
  console.log('Permissions seeding completed!')
}

async function main() {
  try {
    await seedPermissions()
  } catch (error) {
    console.error('Error seeding permissions:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

export { seedPermissions }
