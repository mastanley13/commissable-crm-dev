const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient({ log: ["error"] });
  try {
    const tenant = await prisma.tenant.findFirst({ select: { id: true, name: true } });
    console.log("Using tenant:", tenant);

    const DEFAULT_PRODUCT_FAMILIES = [
      {
        code: "AI_SERVICES",
        name: "AI Services",
        description:
          "AI-based services such as automation, assistants, and intelligent analytics.",
      },
      {
        code: "INTERNET_VOICE",
        name: "Internet & Voice Connectivity",
        description: "Core internet, voice, and connectivity services.",
      },
      {
        code: "CYBERSECURITY",
        name: "Cybersecurity Services",
        description: "Security offerings including threat protection and monitoring.",
      },
      {
        code: "DATA_PROTECTION",
        name: "Data Protection",
        description: "Backup, archiving, and data protection solutions.",
      },
      {
        code: "HARDWARE",
        name: "Hardware Products",
        description: "Physical devices, infrastructure, and related equipment.",
      },
      {
        code: "INSTALLATION",
        name: "Installation Services",
        description: "Implementation, installation, and turn-up services.",
      },
      {
        code: "MAINTENANCE",
        name: "Maintenance Products",
        description: "Maintenance contracts and support entitlements.",
      },
      {
        code: "SOFTWARE",
        name: "Software Products",
        description: "Software licenses, subscriptions, and SaaS products.",
      },
    ];

    await prisma.$transaction(
      DEFAULT_PRODUCT_FAMILIES.map((def, index) =>
        prisma.productFamily.upsert({
          where: {
            tenantId_code: {
              tenantId: tenant.id,
              code: def.code,
            },
          },
          update: {},
          create: {
            tenantId: tenant.id,
            code: def.code,
            name: def.name,
            description: def.description,
            isActive: true,
            isSystem: true,
            displayOrder: (index + 1) * 10,
          },
        })
      )
    );

    const families = await prisma.productFamily.findMany({ where: { tenantId: tenant.id } });
    const subtypes = await prisma.productSubtype.findMany({ where: { tenantId: tenant.id } });
    console.log("ProductFamily count:", families.length);
    console.log("ProductSubtype count:", subtypes.length);
  } catch (error) {
    console.error("Prisma error while querying/ensuring product master data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error("Unhandled error in product family test script:", err);
});
