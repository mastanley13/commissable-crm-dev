const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const roles = await prisma.role.findMany({ include: { rolePermissions: { include: { permission: true } } } });
  for (const role of roles) {
    console.log(role.code, role.rolePermissions.map(rp => rp.permission.code));
  }
}
main().finally(() => prisma.$disconnect());
