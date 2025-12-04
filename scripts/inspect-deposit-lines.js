const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const deposit = await prisma.deposit.findFirst({
      where: { depositName: "2025-08 Telarus_Lingo_Deposit" },
      include: { lineItems: true },
      orderBy: { createdAt: "desc" },
    });

    if (!deposit) {
      console.log("No deposit found with that name");
      return;
    }

    console.log(
      JSON.stringify(
        {
          id: deposit.id,
          tenantId: deposit.tenantId,
          paymentDate: deposit.paymentDate,
          month: deposit.month,
          lineItems: deposit.lineItems.map((li) => ({
            id: li.id,
            lineNumber: li.lineNumber,
            accountIdVendor: li.accountIdVendor,
            customerIdVendor: li.customerIdVendor,
            orderIdVendor: li.orderIdVendor,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

