import {
  PrismaClient,
  DepositLineItemStatus,
  DepositLineMatchStatus,
  DepositLineMatchSource,
} from "@prisma/client"

const prisma = new PrismaClient()

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

async function main() {
  const deposit = await prisma.deposit.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      account: { select: { accountName: true } },
      distributor: { select: { accountName: true } },
      vendor: { select: { accountName: true } },
    },
  })

  if (!deposit) {
    console.error("No deposits found. Run `npm run db:seed` first to create baseline data.")
    return
  }

  const tenantId = deposit.tenantId

  const product = await prisma.product.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  })

  const revenueSchedules = await prisma.revenueSchedule.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  })

  if (revenueSchedules.length === 0) {
    throw new Error("No revenue schedules found. Seed base data before running this script.")
  }

  const scheduleA = revenueSchedules[0]
  const scheduleB = revenueSchedules[1] ?? revenueSchedules[0]

  console.log(`Target deposit: ${deposit.depositName ?? deposit.id}`)

  await prisma.$transaction([
    prisma.depositLineMatch.deleteMany({
      where: { depositLineItem: { depositId: deposit.id } },
    }),
    prisma.depositLineItem.deleteMany({
      where: { depositId: deposit.id },
    }),
  ])

  const paymentBase = deposit.paymentDate ?? deposit.month ?? new Date()

  const lineItemPayloads = [
    {
      tenantId,
      depositId: deposit.id,
      accountId: deposit.accountId,
      vendorAccountId: deposit.vendorAccountId ?? deposit.accountId,
      productId: product?.id ?? null,
      lineNumber: 1,
      status: DepositLineItemStatus.Unmatched,
      paymentDate: addDays(paymentBase, -2),
      accountIdVendor: "A123543",
      customerIdVendor: "CUST-1101",
      orderIdVendor: "ORD-2201",
      accountNameRaw: deposit.account?.accountName ?? "Mike Inc",
      vendorNameRaw: deposit.vendor?.accountName ?? "Lingo",
      distributorNameRaw: deposit.distributor?.accountName ?? "Telarus",
      productNameRaw: "SD-WAN Advanced",
      usage: 600,
      usageAllocated: 0,
      usageUnallocated: 600,
      commission: 60,
      commissionAllocated: 0,
      commissionUnallocated: 60,
      commissionRate: 0.1,
      isChargeback: false,
    },
    {
      tenantId,
      depositId: deposit.id,
      accountId: deposit.accountId,
      vendorAccountId: deposit.vendorAccountId ?? deposit.accountId,
      productId: product?.id ?? null,
      lineNumber: 2,
      status: DepositLineItemStatus.Matched,
      paymentDate: addDays(paymentBase, -1),
      accountIdVendor: "A123111",
      customerIdVendor: "CUST-1102",
      orderIdVendor: "ORD-2202",
      accountNameRaw: "Alvin Inc",
      vendorNameRaw: deposit.vendor?.accountName ?? "Lingo",
      distributorNameRaw: deposit.distributor?.accountName ?? "Telarus",
      productNameRaw: "Fiber DIA 1GB",
      usage: 1010,
      usageAllocated: 1010,
      usageUnallocated: 0,
      commission: 101,
      commissionAllocated: 101,
      commissionUnallocated: 0,
      commissionRate: 0.1,
      isChargeback: false,
      primaryRevenueScheduleId: scheduleB.id,
    },
  ]

  const createdLineItems = []
  for (const payload of lineItemPayloads) {
    const item = await prisma.depositLineItem.create({ data: payload })
    createdLineItems.push(item)
  }

  const matchedLine = createdLineItems.find(
    (line) => line.status === DepositLineItemStatus.Matched,
  )
  if (matchedLine) {
    await prisma.depositLineMatch.create({
      data: {
        tenantId,
        depositLineItemId: matchedLine.id,
        revenueScheduleId: scheduleB.id,
        usageAmount: matchedLine.usage,
        commissionAmount: matchedLine.commission,
        confidenceScore: 0.98,
        status: DepositLineMatchStatus.Applied,
        source: DepositLineMatchSource.Manual,
        explanation: {
          accountIdVendor: true,
          productName: true,
          paymentDate: matchedLine.paymentDate,
        },
      },
    })
  }

  const totals = createdLineItems.reduce(
    (acc, item) => {
      acc.totalUsage += Number(item.usage ?? 0)
      acc.usageAllocated += Number(item.usageAllocated ?? 0)
      acc.usageUnallocated += Number(item.usageUnallocated ?? 0)
      acc.totalCommission += Number(item.commission ?? 0)
      acc.commissionAllocated += Number(item.commissionAllocated ?? 0)
      acc.commissionUnallocated += Number(item.commissionUnallocated ?? 0)
      if (item.status === DepositLineItemStatus.Matched) {
        acc.itemsReconciled += 1
      } else {
        acc.itemsUnreconciled += 1
      }
      return acc
    },
    {
      totalUsage: 0,
      usageAllocated: 0,
      usageUnallocated: 0,
      totalCommission: 0,
      commissionAllocated: 0,
      commissionUnallocated: 0,
      itemsReconciled: 0,
      itemsUnreconciled: 0,
    },
  )

  await prisma.deposit.update({
    where: { id: deposit.id },
    data: {
      totalItems: createdLineItems.length,
      totalReconciledItems: totals.itemsReconciled,
      itemsReconciled: totals.itemsReconciled,
      itemsUnreconciled: totals.itemsUnreconciled,
      totalUsage: totals.totalUsage,
      usageAllocated: totals.usageAllocated,
      usageUnallocated: totals.usageUnallocated,
      totalCommissions: totals.totalCommission,
      commissionAllocated: totals.commissionAllocated,
      commissionUnallocated: totals.commissionUnallocated,
    },
  })

  console.log(
    `Seeded ${createdLineItems.length} deposit line items for deposit ${deposit.depositName ?? deposit.id}`,
  )
}

main()
  .catch((error) => {
    console.error("Failed to seed deposit line items", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
