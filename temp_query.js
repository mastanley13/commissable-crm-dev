const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  try {
    const prefs = await prisma.tablePreference.findMany({
      where: { pageKey: "accounts:list" },
      select: {
        id: true,
        userId: true,
        pageKey: true,
        columnOrder: true,
        hiddenColumns: true,
        columnWidths: true,
        updatedAt: true
      },
      take: 10
    });
    console.log(JSON.stringify(prefs, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
