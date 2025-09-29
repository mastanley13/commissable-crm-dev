const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const code = process.argv[2];
  const rows = await prisma.$queryRaw`SELECT p.code FROM "Permission" p
    JOIN "RolePermission" rp ON rp."permissionId" = p.id
    JOIN "Role" r ON r.id = rp."roleId"
    WHERE r.code = ${code}
    ORDER BY p.code`;
  console.log(rows.map(r => r.code));
}
main().finally(() => prisma.$disconnect());
