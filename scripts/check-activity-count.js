const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.activity.count();
  console.log('Activity count:', count);
}
main().finally(() => prisma.$disconnect());
