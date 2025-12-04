const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();

  if (!tenants.length) {
    console.log("No tenants found. Nothing to do.");
    return;
  }

  for (const tenant of tenants) {
    console.log(`Processing tenant: ${tenant.name} (${tenant.id})`);

    // Skip if a "No House Rep" contact already exists for this tenant
    const existing = await prisma.contact.findFirst({
      where: {
        tenantId: tenant.id,
        fullName: "No House Rep",
      },
    });

    if (existing) {
      console.log("  'No House Rep' contact already exists. Skipping.");
      continue;
    }

    // Find the HOUSE account type for this tenant
    let houseType = await prisma.accountType.findFirst({
      where: {
        tenantId: tenant.id,
        code: "HOUSE",
      },
    });

    if (!houseType) {
      houseType = await prisma.accountType.create({
        data: {
          tenantId: tenant.id,
          code: "HOUSE",
          name: "House",
          description: "House accounts",
          displayOrder: 2,
        },
      });
      console.log("  Created HOUSE account type for this tenant.");
    } else {
      console.log("  Using existing HOUSE account type.");
    }

    // Find or create the parent agency account
    let agencyAccount = await prisma.account.findFirst({
      where: {
        tenantId: tenant.id,
        accountTypeId: houseType.id,
        accountName: "Agency Parent Account",
      },
    });

    if (!agencyAccount) {
      agencyAccount = await prisma.account.create({
        data: {
          tenantId: tenant.id,
          accountTypeId: houseType.id,
          accountName: "Agency Parent Account",
          accountLegalName: "Agency Parent Account",
          status: "Active",
          description:
            'Parent agency account used for system-level contacts such as the "No House Rep" dummy contact.',
        },
      });
      console.log("  Created Agency Parent Account.");
    } else {
      console.log("  Using existing Agency Parent Account.");
    }

    // Choose an active user to own / create the contact (if any)
    const user = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        status: "Active",
      },
      orderBy: { createdAt: "asc" },
    });

    const ownerId = user ? user.id : null;

    const contact = await prisma.contact.create({
      data: {
        tenantId: tenant.id,
        accountId: agencyAccount.id,
        accountTypeId: houseType.id,
        ownerId,
        createdById: ownerId,
        updatedById: ownerId,
        firstName: "No House",
        lastName: "Rep",
        fullName: "No House Rep",
        preferredContactMethod: "Email",
        isPrimary: false,
        isDecisionMaker: false,
        description:
          "System dummy contact with 0% commission share when the House receives commissions and no individual rep is assigned.",
      },
    });

    console.log(`  Created 'No House Rep' contact: ${contact.id}`);
  }
}

main()
  .catch((error) => {
    console.error("Error creating 'No House Rep' contact:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
