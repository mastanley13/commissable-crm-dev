const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const perms = await prisma.permission.findMany({ orderBy: { code: 'asc' } });
  console.log(perms.map(p => p.code));
}
main().finally(() => prisma.$disconnect());
