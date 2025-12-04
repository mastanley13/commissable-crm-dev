/**
 * Coverage diagnostic (and optional backfill) for DepositLineItem.locationId / customerPurchaseOrder.
 *
 * Usage:
 *   - Report only: ts-node scripts/reconciliation-location-po-coverage.ts
 *   - Backfill missing fields from primaryRevenueSchedule.opportunity: ts-node scripts/reconciliation-location-po-coverage.ts --apply
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type CoverageRow = {
  tenantId: string
  total: number
  withLocation: number
  withCustomerPo: number
}

async function collectCoverage(): Promise<CoverageRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{ tenantId: string; total: bigint; withLocation: bigint; withCustomerPo: bigint }>
  >`
    SELECT
      "tenantId",
      COUNT(*) AS total,
      COUNT(NULLIF(TRIM(COALESCE("locationId", '')), '')) AS "withLocation",
      COUNT(NULLIF(TRIM(COALESCE("customerPurchaseOrder", '')), '')) AS "withCustomerPo"
    FROM "DepositLineItem"
    GROUP BY "tenantId"
    ORDER BY "tenantId" ASC
  `

  return rows.map(row => ({
    tenantId: row.tenantId,
    total: Number(row.total),
    withLocation: Number(row.withLocation),
    withCustomerPo: Number(row.withCustomerPo),
  }))
}

function printCoverage(rows: CoverageRow[]) {
  console.log("DepositLineItem Location/PO coverage by tenant")
  console.log("tenantId | total | location% | customerPO%")
  rows.forEach(row => {
    const locPct = row.total === 0 ? 0 : (row.withLocation / row.total) * 100
    const poPct = row.total === 0 ? 0 : (row.withCustomerPo / row.total) * 100
    console.log(
      `${row.tenantId} | ${row.total} | ${locPct.toFixed(1).padStart(5)}% | ${poPct
        .toFixed(1)
        .padStart(5)}%`,
    )
  })
}

async function backfillMissing() {
  const candidates = await prisma.depositLineItem.findMany({
    where: {
      OR: [
        { locationId: null },
        { locationId: "" },
        { customerPurchaseOrder: null },
        { customerPurchaseOrder: "" },
      ],
      primaryRevenueScheduleId: { not: null },
    },
    select: {
      id: true,
      tenantId: true,
      locationId: true,
      customerPurchaseOrder: true,
      primaryRevenueScheduleId: true,
      primaryRevenueSchedule: {
        select: {
          opportunity: {
            select: {
              locationId: true,
              customerPurchaseOrder: true,
            },
          },
        },
      },
    },
    take: 5000, // safety cap for a single run
  })

  let updates = 0
  for (const line of candidates) {
    const schedule = line.primaryRevenueSchedule
    const opportunity = schedule?.opportunity
    const nextLocation = (line.locationId || "").trim() || (opportunity?.locationId || "").trim()
    const nextPo =
      (line.customerPurchaseOrder || "").trim() || (opportunity?.customerPurchaseOrder || "").trim()

    if (!nextLocation && !nextPo) continue

    await prisma.depositLineItem.update({
      where: { id: line.id },
      data: {
        locationId: nextLocation || null,
        customerPurchaseOrder: nextPo || null,
      },
    })
    updates += 1
  }

  console.log(`Backfill complete. Updated ${updates} deposit line items.`)
}

async function main() {
  const apply = process.argv.includes("--apply")

  const before = await collectCoverage()
  console.log("Before:")
  printCoverage(before)

  if (apply) {
    console.log("\nApplying backfill from primaryRevenueSchedule.opportunity ...")
    await backfillMissing()
    const after = await collectCoverage()
    console.log("\nAfter:")
    printCoverage(after)
  }
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
