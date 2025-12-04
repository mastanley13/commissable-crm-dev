// Helper script to inspect RevenueScheduleStatus enum values in Postgres
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'RevenueScheduleStatus' ORDER BY enumsortorder",
    )
    console.log("RevenueScheduleStatus enum values in database:")
    for (const row of rows) {
      console.log("-", row.enumlabel)
    }
  } catch (error) {
    console.error("Failed to query RevenueScheduleStatus enum:", error)
  } finally {
    await prisma.$disconnect()
  }
}

main()

