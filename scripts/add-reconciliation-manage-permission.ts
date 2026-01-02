import { PermissionCategory, PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const permission = await prisma.permission.upsert({
    where: { code: "reconciliation.manage" },
    update: {
      name: "Manage Reconciliation",
      category: PermissionCategory.Finance,
    },
    create: {
      code: "reconciliation.manage",
      name: "Manage Reconciliation",
      category: PermissionCategory.Finance,
    },
  })

  const tenants = await prisma.tenant.findMany({ select: { id: true } })

  for (const tenant of tenants) {
    const roles = await prisma.role.findMany({
      where: {
        tenantId: tenant.id,
        OR: [{ code: "ADMIN" }, { name: "Administrator" }, { code: "ACCOUNTING" }, { name: "Accounting" }],
      },
      select: { id: true },
    })

    for (const role of roles) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          roleId: role.id,
          permissionId: permission.id,
        },
      })
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async error => {
    console.error("Failed to add reconciliation.manage permission", error)
    await prisma.$disconnect()
    process.exitCode = 1
  })

