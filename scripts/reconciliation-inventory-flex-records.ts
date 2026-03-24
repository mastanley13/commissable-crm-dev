import { prisma } from "../lib/db"

type InventoryRow = {
  id: string
  scheduleNumber: string | null
  parentRevenueScheduleId: string | null
  flexClassification: string
  deletedAt: Date | null
}

async function main() {
  const tenantId = process.argv[2]?.trim()

  if (!tenantId) {
    throw new Error("Usage: tsx scripts/reconciliation-inventory-flex-records.ts <tenantId>")
  }

  const rows = (await prisma.revenueSchedule.findMany({
    where: {
      tenantId,
      OR: [
        { flexClassification: { not: "Normal" as any } },
        { scheduleNumber: { startsWith: "FLEX-" } },
        { scheduleNumber: { contains: "." } },
      ],
    },
    select: {
      id: true,
      scheduleNumber: true,
      parentRevenueScheduleId: true,
      flexClassification: true,
      deletedAt: true,
    },
    orderBy: [{ scheduleNumber: "asc" }, { createdAt: "asc" }],
  })) as InventoryRow[]

  const categorized = rows.map(row => {
    const scheduleNumber = row.scheduleNumber ?? ""
    const isLegacyFlexPrefix = scheduleNumber.startsWith("FLEX-")
    const isChildNumberStyle = /^\S+\.\d+$/.test(scheduleNumber)
    const isOrphanChild = isChildNumberStyle && !row.parentRevenueScheduleId
    const category = isLegacyFlexPrefix
      ? "legacy_flex_prefix"
      : isOrphanChild
        ? "orphan_child_number"
        : row.flexClassification !== "Normal"
          ? "active_flex_schedule"
          : "other"

    return {
      ...row,
      category,
    }
  })

  const counts = categorized.reduce<Record<string, number>>((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + 1
    return acc
  }, {})

  console.log(JSON.stringify({ tenantId, counts, rows: categorized }, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null)
  })
