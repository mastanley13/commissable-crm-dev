import { PrismaClient } from "@prisma/client"

type JsonValue = any

const prisma = new PrismaClient()

async function main() {
  const targetKeys = ["accounts:list", "account-details:groups"]

  const preferences = await prisma.tablePreference.findMany({
    where: {
      pageKey: {
        in: targetKeys,
      },
    },
    orderBy: {
      pageKey: "asc",
    },
  })

  if (preferences.length === 0) {
    console.log("No table preferences found for target page keys.")
    return
  }

  for (const pref of preferences) {
    console.log("-".repeat(40))
    console.log(`pageKey: ${pref.pageKey}`)
    console.log(`tenantId: ${pref.tenantId}`)
    console.log(`userId: ${pref.userId}`)
    console.log("columnOrder:", JSON.stringify(pref.columnOrder as JsonValue))
    console.log("columnWidths:", JSON.stringify(pref.columnWidths as JsonValue))
    console.log("hiddenColumns:", JSON.stringify(pref.hiddenColumns as JsonValue))
    console.log("sortState:", JSON.stringify(pref.sortState as JsonValue))
    console.log("filters:", JSON.stringify(pref.filters as JsonValue))
    console.log("lastUpdated:", pref.updatedAt ? pref.updatedAt.toISOString() : "n/a")
  }
}

main()
  .catch((error) => {
    console.error("Failed to list table preferences", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
