const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const opp = await prisma.opportunity.findFirst({ where: { name: 'Algave Cloud Migration' }, select: { id: true, tenantId: true } });
    console.log('opportunity', opp);
    const result = await prisma.activity.findMany({
      where: {
        tenantId: opp?.tenantId,
        links: { some: { entityType: 'Opportunity', entityId: opp?.id } }
      },
      include: {
        account: { select: { id: true, accountName: true } },
        contact: { select: { id: true, fullName: true } },
        opportunity: { select: { id: true, name: true } },
        revenueSchedule: { select: { id: true, scheduleNumber: true } },
        assignee: { select: { id: true, fullName: true } },
        creator: { select: { id: true, fullName: true } },
        updater: { select: { id: true, fullName: true } },
        attachments: { include: { uploadedBy: { select: { fullName: true } } } },
        links: true
      },
      orderBy: { dueDate: 'desc' },
      take: 100
    });
    console.log('activities length', result.length);
  } catch (error) {
    console.error('error', error);
  } finally {
    await prisma.$disconnect();
  }
})();
