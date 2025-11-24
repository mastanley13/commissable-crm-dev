import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function grantAuditPermissions() {
  console.log('Granting audit log permissions to roles...\n')

  try {
    // Get auditLogs.read permission
    const auditReadPermission = await prisma.permission.findUnique({
      where: { code: 'auditLogs.read' }
    })

    if (!auditReadPermission) {
      console.error('❌ auditLogs.read permission not found. Run seed-permissions.ts first.')
      return
    }

    // Find all roles that have opportunities.manage, accounts.manage, or activities.manage
    const managePermissions = await prisma.permission.findMany({
      where: {
        code: {
          in: ['opportunities.manage', 'accounts.manage', 'activities.manage']
        }
      }
    })

    const managePermissionIds = managePermissions.map(p => p.id)

    // Get all role permissions that have these manage permissions
    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        permissionId: {
          in: managePermissionIds
        }
      },
      include: {
        role: true,
        permission: true
      }
    })

    // Group by role to avoid duplicates
    const roleMap = new Map<string, { roleId: string; roleName: string; tenantId: string | null }>()

    for (const rp of rolePermissions) {
      if (!roleMap.has(rp.roleId)) {
        roleMap.set(rp.roleId, {
          roleId: rp.roleId,
          roleName: rp.role.name,
          tenantId: rp.tenantId
        })
      }
    }

    console.log(`Found ${roleMap.size} roles that need audit permissions:\n`)

    let grantedCount = 0

    for (const [roleId, roleInfo] of roleMap) {
      // Check if this role already has auditLogs.read
      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: roleId,
            permissionId: auditReadPermission.id
          }
        }
      })

      if (existing) {
        console.log(`  ⚪ ${roleInfo.roleName} - already has auditLogs.read`)
        continue
      }

      // Grant the permission
      await prisma.rolePermission.create({
        data: {
          roleId: roleId,
          permissionId: auditReadPermission.id,
          tenantId: roleInfo.tenantId
        }
      })

      console.log(`  ✅ ${roleInfo.roleName} - granted auditLogs.read`)
      grantedCount++
    }

    console.log(`\n✨ Granted auditLogs.read to ${grantedCount} role(s)`)

    // Show summary
    console.log('\n📊 Summary of roles with audit permissions:')
    const allRoles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true
          },
          where: {
            permission: {
              code: {
                in: ['auditLogs.read', 'auditLogs.manage']
              }
            }
          }
        }
      }
    })

    for (const role of allRoles) {
      if (role.permissions.length > 0) {
        const perms = role.permissions.map(rp => rp.permission.code).join(', ')
        console.log(`  • ${role.name}: ${perms}`)
      }
    }

  } catch (error) {
    console.error('❌ Error granting permissions:', error)
    throw error
  }
}

async function main() {
  try {
    await grantAuditPermissions()
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

export { grantAuditPermissions }
