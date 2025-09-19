import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addAdminPermissions() {
  console.log('Adding admin permissions...')

  // Add admin permissions
  const adminPermissions = [
    {
      code: 'admin.users.read',
      name: 'View Users',
      category: 'Admin' as any
    },
    {
      code: 'admin.users.create',
      name: 'Create Users',
      category: 'Admin' as any
    },
    {
      code: 'admin.users.update',
      name: 'Update Users',
      category: 'Admin' as any
    },
    {
      code: 'admin.users.delete',
      name: 'Delete Users',
      category: 'Admin' as any
    },
    {
      code: 'admin.roles.read',
      name: 'View Roles',
      category: 'Admin' as any
    },
    {
      code: 'admin.roles.create',
      name: 'Create Roles',
      category: 'Admin' as any
    },
    {
      code: 'admin.roles.update',
      name: 'Update Roles',
      category: 'Admin' as any
    },
    {
      code: 'admin.roles.delete',
      name: 'Delete Roles',
      category: 'Admin' as any
    },
    {
      code: 'admin.permissions.read',
      name: 'View Permissions',
      category: 'Admin' as any
    },
    {
      code: 'contacts.read',
      name: 'View Contacts',
      category: 'Contacts' as any
    }
  ]

  // Create permissions
  for (const permData of adminPermissions) {
    await prisma.permission.upsert({
      where: { code: permData.code },
      update: {},
      create: permData
    })
  }

  // Get tenant and admin role
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    throw new Error('No tenant found')
  }

  const adminRole = await prisma.role.findFirst({
    where: {
      tenantId: tenant.id,
      code: 'ADMIN'
    }
  })

  if (!adminRole) {
    throw new Error('Admin role not found')
  }

  // Grant all admin permissions to admin role
  const allPermissions = await prisma.permission.findMany()

  for (const permission of allPermissions) {
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
  }

  console.log(`Added ${adminPermissions.length} admin permissions`)
  console.log('Granted all permissions to admin role')

  await prisma.$disconnect()
}

addAdminPermissions()
  .catch((error) => {
    console.error('Error adding admin permissions:', error)
    process.exitCode = 1
  })