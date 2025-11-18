const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'RevenueType' ORDER BY e.enumsortorder"
    )
    console.log("RevenueType enum values in DB:")
    console.log(rows)
  } catch (error) {
    console.error("Failed to query RevenueType enum:", error)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
