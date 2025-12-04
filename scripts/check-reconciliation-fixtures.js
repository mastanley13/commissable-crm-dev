const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const knownScheduleIds = [
    "11111111-1111-1111-1111-111111111111",
    "22222222-2222-2222-2222-222222222222",
    "33333333-3333-3333-3333-333333333333",
    "44444444-4444-4444-4444-444444444444",
  ];

  const schedules = await prisma.revenueSchedule.findMany({
    where: { id: { in: knownScheduleIds } },
    select: { id: true, scheduleNumber: true },
  });

  console.log("foundTestSchedules", schedules.length, "of", knownScheduleIds.length);
  for (const s of schedules) {
    console.log("schedule", s.id, s.scheduleNumber);
  }

  const sampleLineItem = await prisma.depositLineItem.findFirst({
    where: { accountIdVendor: "A-TEL-1001" },
    select: { id: true, depositId: true, lineNumber: true },
  });

  console.log("hasLineItemA_TEL_1001", !!sampleLineItem);
  if (sampleLineItem) {
    console.log(
      "sampleLineItem",
      sampleLineItem.id,
      "depositId",
      sampleLineItem.depositId,
      "lineNumber",
      sampleLineItem.lineNumber,
    );
  }
}

main()
  .catch(error => {
    console.error("Error checking reconciliation fixtures", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
