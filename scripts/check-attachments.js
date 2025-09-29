const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const attachments = await prisma.activityAttachment.findMany({ take: 5, orderBy: { uploadedAt: 'desc' } });
  console.log(JSON.stringify(attachments, null, 2));
}
main().finally(() => prisma.$disconnect());
