const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT DISTINCT "revenueType" FROM "Product" ORDER BY 1'
    )
    console.log('Distinct Product.revenueType values:')
    console.log(rows)
  } catch (error) {
    console.error("Failed to query Product.revenueType values:", error)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

