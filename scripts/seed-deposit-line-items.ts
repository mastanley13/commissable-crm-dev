import { PrismaClient, DepositLineItemStatus, RevenueScheduleStatus } from "@prisma/client"
import { matchDepositLine } from "@/lib/matching/deposit-matcher"

const prisma = new PrismaClient()

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

async function main() {
  const targetDepositName = "2025-08 Telarus_Lingo_Deposit"

  let deposit =
    (await prisma.deposit.findFirst({
      where: { depositName: targetDepositName },
      include: {
        account: { select: { accountName: true, accountLegalName: true } },
        distributor: { select: { accountName: true } },
        vendor: { select: { accountName: true } },
      },
      orderBy: { createdAt: "desc" },
    })) ||
    (await prisma.deposit.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        account: { select: { accountName: true, accountLegalName: true } },
        distributor: { select: { accountName: true } },
        vendor: { select: { accountName: true } },
      },
    }))

  if (!deposit) {
    console.error("No deposits found. Run `npm run db:seed` first to create baseline data.")
    return
  }

  const tenantId = deposit.tenantId

  const product = await prisma.product.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  })

  const opportunity = await prisma.opportunity.findFirst({
    where: { tenantId, accountId: deposit.accountId },
    include: { products: true },
    orderBy: { createdAt: "asc" },
  })

  const baseCustomerId = "CUST-TEL-2025-01"
  const baseOrderId = "ORD-TEL-2025-01"

  let matchOpportunityId: string | null = null
  let matchOpportunityProductId: string | null = null

  if (opportunity) {
    const updated = await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: {
        customerIdVendor: baseCustomerId,
        orderIdVendor: baseOrderId,
        vendorName: deposit.vendor?.accountName ?? "Lingo",
        distributorName: deposit.distributor?.accountName ?? "Telarus",
      },
    })
    matchOpportunityId = updated.id
    const firstProduct = opportunity.products[0]
    if (firstProduct) {
      matchOpportunityProductId = firstProduct.id
    }
  }

  const scheduleBaseDate = deposit.paymentDate ?? deposit.month ?? new Date()

  const scheduleConfigs = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      scheduleNumber: "RS-TEL-2025-08-01",
      expectedUsage: 1000,
      expectedCommission: 100,
      dateOffsetDays: 0,
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      scheduleNumber: "RS-TEL-2025-08-02",
      expectedUsage: 950,
      expectedCommission: 95,
      dateOffsetDays: 1,
    },
    {
      id: "33333333-3333-3333-3333-333333333333",
      scheduleNumber: "RS-TEL-2025-08-03",
      expectedUsage: 800,
      expectedCommission: 80,
      dateOffsetDays: 5,
    },
    {
      id: "44444444-4444-4444-4444-444444444444",
      scheduleNumber: "RS-TEL-2025-08-04",
      expectedUsage: 700,
      expectedCommission: 70,
      dateOffsetDays: 10,
    },
    {
      id: "55555555-5555-5555-5555-555555555555",
      scheduleNumber: "RS-TEL-2025-08-05",
      expectedUsage: 600,
      expectedCommission: 60,
      dateOffsetDays: 15,
    },
    {
      id: "66666666-6666-6666-6666-666666666666",
      scheduleNumber: "RS-TEL-2025-08-06",
      expectedUsage: 500,
      expectedCommission: 50,
      dateOffsetDays: 20,
    },
    {
      id: "77777777-7777-7777-7777-777777777777",
      scheduleNumber: "RS-TEL-2025-08-07",
      expectedUsage: 450,
      expectedCommission: 45,
      dateOffsetDays: 25,
    },
    {
      id: "88888888-8888-8888-8888-888888888888",
      scheduleNumber: "RS-TEL-2025-08-08",
      expectedUsage: 400,
      expectedCommission: 40,
      dateOffsetDays: 30,
    },
    {
      id: "99999999-9999-9999-9999-999999999999",
      scheduleNumber: "RS-TEL-2025-08-09",
      expectedUsage: 300,
      expectedCommission: 30,
      dateOffsetDays: 35,
    },
    {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      scheduleNumber: "RS-TEL-2025-08-10",
      expectedUsage: 250,
      expectedCommission: 25,
      dateOffsetDays: 45,
    },
    {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      scheduleNumber: "RS-TEL-2025-08-11",
      expectedUsage: 150,
      expectedCommission: 15,
      dateOffsetDays: 60,
    },
    {
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      scheduleNumber: "RS-TEL-2025-08-12",
      expectedUsage: 100,
      expectedCommission: 10,
      dateOffsetDays: 75,
    },
  ] as const

  const testSchedules = []
  for (const cfg of scheduleConfigs) {
    const schedule = await prisma.revenueSchedule.upsert({
      where: { id: cfg.id },
      create: {
        id: cfg.id,
        tenantId,
        opportunityId: matchOpportunityId,
        opportunityProductId: matchOpportunityProductId,
        accountId: deposit.accountId,
        productId: product?.id ?? null,
        distributorAccountId: deposit.distributorAccountId ?? deposit.accountId,
        vendorAccountId: deposit.vendorAccountId ?? deposit.accountId,
        scheduleNumber: cfg.scheduleNumber,
        scheduleDate: addDays(scheduleBaseDate, cfg.dateOffsetDays),
      scheduleType: "Recurring",
      expectedUsage: cfg.expectedUsage,
      expectedCommission: cfg.expectedCommission,
      status: RevenueScheduleStatus.Unreconciled,
        notes: "Test schedule for Telarus/Lingo 2025-08 deposit matching scenarios",
      },
      update: {
        tenantId,
        opportunityId: matchOpportunityId,
        opportunityProductId: matchOpportunityProductId,
        accountId: deposit.accountId,
        productId: product?.id ?? null,
        distributorAccountId: deposit.distributorAccountId ?? deposit.accountId,
        vendorAccountId: deposit.vendorAccountId ?? deposit.accountId,
        scheduleNumber: cfg.scheduleNumber,
        scheduleDate: addDays(scheduleBaseDate, cfg.dateOffsetDays),
        expectedUsage: cfg.expectedUsage,
        expectedCommission: cfg.expectedCommission,
        status: RevenueScheduleStatus.Unreconciled,
        notes: "Test schedule for Telarus/Lingo 2025-08 deposit matching scenarios",
      },
    })
    testSchedules.push(schedule)
  }

  console.log(`Target deposit: ${deposit.depositName ?? deposit.id}`)
  console.log(
    `Seeded/updated ${testSchedules.length} revenue schedules for testing: ${testSchedules
      .map((s) => s.scheduleNumber)
      .join(", ")}`,
  )

  await prisma.$transaction([
    prisma.depositLineMatch.deleteMany({
      where: { depositLineItem: { depositId: deposit.id } },
    }),
    prisma.depositLineItem.deleteMany({
      where: { depositId: deposit.id },
    }),
  ])

  const paymentBase = scheduleBaseDate
  const baseAccountName =
    deposit.account?.accountName ?? deposit.account?.accountLegalName ?? "Algave LLC"
  const similarAccountName = `${baseAccountName} Communications`
  const vendorName = deposit.vendor?.accountName ?? "Lingo"
  const distributorName = deposit.distributor?.accountName ?? "Telarus"
  const baseProductName =
    product?.productNameVendor ?? product?.productNameHouse ?? "VoIP Service Bundle"

  const baseVendorAccountId = deposit.vendorAccountId ?? deposit.accountId
  const baseAccountId = deposit.accountId
  const baseUsage = 1000
  const baseCommission = 100
  const baseRate = 0.1

  const lineItemPayloads = [
    {
      tenantId,
      depositId: deposit.id,
      accountId: baseAccountId,
      vendorAccountId: baseVendorAccountId,
      productId: product?.id ?? null,
      lineNumber: 1,
      status: DepositLineItemStatus.Unmatched,
      paymentDate: paymentBase,
      accountIdVendor: "A-TEL-1001",
      customerIdVendor: baseCustomerId,
      orderIdVendor: baseOrderId,
      accountNameRaw: baseAccountName,
      vendorNameRaw: vendorName,
      distributorNameRaw: distributorName,
      productNameRaw: baseProductName,
      usage: baseUsage,
      usageAllocated: 0,
      usageUnallocated: baseUsage,
      commission: baseCommission,
      commissionAllocated: 0,
      commissionUnallocated: baseCommission,
      commissionRate: baseRate,
      isChargeback: false,
    },
    {
      tenantId,
      depositId: deposit.id,
      accountId: baseAccountId,
      vendorAccountId: baseVendorAccountId,
      productId: product?.id ?? null,
      lineNumber: 2,
      status: DepositLineItemStatus.Unmatched,
      paymentDate: addDays(paymentBase, 1),
      accountIdVendor: "A-TEL-1002",
      customerIdVendor: baseCustomerId,
      orderIdVendor: baseOrderId,
      accountNameRaw: baseAccountName,
      vendorNameRaw: vendorName,
      distributorNameRaw: distributorName,
      productNameRaw: baseProductName,
      usage: 950,
      usageAllocated: 0,
      usageUnallocated: 950,
      commission: 95,
      commissionAllocated: 0,
      commissionUnallocated: 95,
      commissionRate: baseRate,
      isChargeback: false,
    },
    {
      tenantId,
      depositId: deposit.id,
      accountId: baseAccountId,
      vendorAccountId: baseVendorAccountId,
      productId: product?.id ?? null,
      lineNumber: 3,
      status: DepositLineItemStatus.Unmatched,
      paymentDate: addDays(paymentBase, 10),
      accountIdVendor: "A-TEL-1003",
      customerIdVendor: baseCustomerId,
      orderIdVendor: "ORD-TEL-2025-ALT1",
      accountNameRaw: baseAccountName,
      vendorNameRaw: vendorName,
      distributorNameRaw: distributorName,
      productNameRaw: `${baseProductName} Intl`,
      usage: 800,
      usageAllocated: 0,
      usageUnallocated: 800,
      commission: 80,
      commissionAllocated: 0,
      commissionUnallocated: 80,
      commissionRate: baseRate,
      isChargeback: false,
    },
    {
      tenantId,
      depositId: deposit.id,
      accountId: baseAccountId,
      vendorAccountId: baseVendorAccountId,
      productId: product?.id ?? null,
      lineNumber: 4,
      status: DepositLineItemStatus.Unmatched,
      paymentDate: addDays(paymentBase, 20),
      accountIdVendor: "A-TEL-1004",
      customerIdVendor: "CUST-TEL-2025-ALT1",
      orderIdVendor: baseOrderId,
      accountNameRaw: baseAccountName,
      vendorNameRaw: vendorName,
      distributorNameRaw: distributorName,
      productNameRaw: baseProductName,
      usage: 700,
      usageAllocated: 0,
      usageUnallocated: 700,
      commission: 70,
      commissionAllocated: 0,
      commissionUnallocated: 70,
      commissionRate: baseRate,
      isChargeback: false,
    },
    {
      tenantId,
      depositId: deposit.id,
      accountId: baseAccountId,
      vendorAccountId: baseVendorAccountId,
      productId: product?.id ?? null,
      lineNumber: 5,
      status: DepositLineItemStatus.Unmatched,
      paymentDate: addDays(paymentBase, 15),
      accountIdVendor: "A-TEL-1005",
      customerIdVendor: baseCustomerId,
      orderIdVendor: baseOrderId,
      accountNameRaw: similarAccountName,
      vendorNameRaw: vendorName,
      distributorNameRaw: distributorName,
      productNameRaw: "VoIP Bundle",
      usage: 600,
      usageAllocated: 0,
      usageUnallocated: 600,
      commission: 60,
      commissionAllocated: 0,
      commissionUnallocated: 60,
      commissionRate: baseRate,
      isChargeback: false,
    },
    {
      tenantId,
      depositId: deposit.id,
      accountId: baseAccountId,
      vendorAccountId: baseVendorAccountId,
      productId: product?.id ?? null,
      lineNumber: 6,
      status: DepositLineItemStatus.Unmatched,
      paymentDate: addDays(paymentBase, 30),
      accountIdVendor: "A-TEL-1006",
      customerIdVendor: "CUST-TEL-2025-ALT2",
      orderIdVendor: "ORD-TEL-2025-ALT2",
      accountNameRaw: similarAccountName,
      vendorNameRaw: vendorName,
      distributorNameRaw: distributorName,
      productNameRaw: "Voice Access",
      usage: 500,
      usageAllocated: 0,
      usageUnallocated: 500,
      commission: 50,
      commissionAllocated: 0,
      commissionUnallocated: 50,
      commissionRate: baseRate,
      isChargeback: false,
    },
    {
      tenantId,
      depositId: deposit.id,
      accountId: baseAccountId,
      vendorAccountId: baseVendorAccountId,
      productId: product?.id ?? null,
      lineNumber: 7,
      status: DepositLineItemStatus.Unmatched,
      paymentDate: addDays(paymentBase, 35),
      accountIdVendor: "A-TEL-1007",
      customerIdVendor: baseCustomerId,
      orderIdVendor: "ORD-TEL-2025-ALT3",
      accountNameRaw: similarAccountName,
      vendorNameRaw: vendorName,
      distributorNameRaw: distributorName,
      productNameRaw: "VoIP Bundle",
      usage: 450,
      usageAllocated: 0,
      usageUnallocated: 450,
      commission: 45,
      commissionAllocated: 0,
      commissionUnallocated: 45,
      commissionRate: baseRate,
      isChargeback: false,
    },
    {
      tenantId,
      depositId: deposit.id,
      accountId: baseAccountId,
      vendorAccountId: baseVendorAccountId,
      productId: product?.id ?? null,
      lineNumber: 8,
      status: DepositLineItemStatus.Unmatched,
      paymentDate: addDays(paymentBase, 40),
      accountIdVendor: "A-TEL-1008",
      customerIdVendor: "CUST-TEL-2025-ALT3",
      orderIdVendor: "ORD-TEL-2025-ALT4",
      accountNameRaw: "Acme Holdings",
      vendorNameRaw: vendorName,
      distributorNameRaw: distributorName,
      productNameRaw: baseProductName,
      usage: 400,
      usageAllocated: 0,
      usageUnallocated: 400,
      commission: 40,
      commissionAllocated: 0,
      commissionUnallocated: 40,
      commissionRate: baseRate,
      isChargeback: false,
    },
    {
      tenantId,
      depositId: deposit.id,
      accountId: null,
      vendorAccountId: baseVendorAccountId,
      productId: product?.id ?? null,
      lineNumber: 9,
      status: DepositLineItemStatus.Unmatched,
      paymentDate: addDays(paymentBase, 60),
      accountIdVendor: "A-TEL-1009",
      customerIdVendor: "CUST-TEL-2025-ALT4",
      orderIdVendor: "ORD-TEL-2025-ALT5",
      accountNameRaw: similarAccountName,
      vendorNameRaw: vendorName,
      distributorNameRaw: distributorName,
      productNameRaw: "Connectivity Add-On",
      usage: 300,
      usageAllocated: 0,
      usageUnallocated: 300,
      commission: 30,
      commissionAllocated: 0,
      commissionUnallocated: 30,
      commissionRate: baseRate,
      isChargeback: false,
    },
    {
      tenantId,
      depositId: deposit.id,
      accountId: baseAccountId,
      vendorAccountId: null,
      productId: product?.id ?? null,
      lineNumber: 10,
      status: DepositLineItemStatus.Unmatched,
      paymentDate: addDays(paymentBase, 70),
      accountIdVendor: "A-TEL-1010",
      customerIdVendor: "CUST-TEL-2025-ALT5",
      orderIdVendor: "ORD-TEL-2025-ALT6",
      accountNameRaw: similarAccountName,
      vendorNameRaw: vendorName,
      distributorNameRaw: distributorName,
      productNameRaw: "Legacy POTS",
      usage: 250,
      usageAllocated: 0,
      usageUnallocated: 250,
      commission: 25,
      commissionAllocated: 0,
      commissionUnallocated: 25,
      commissionRate: baseRate,
      isChargeback: false,
    },
    {
      tenantId,
      depositId: deposit.id,
      accountId: null,
      vendorAccountId: null,
      productId: product?.id ?? null,
      lineNumber: 11,
      status: DepositLineItemStatus.Unmatched,
      paymentDate: addDays(paymentBase, 120),
      accountIdVendor: "A-TEL-1011",
      customerIdVendor: "UNKNOWN-1001",
      orderIdVendor: "ORD-UNKNOWN-1",
      accountNameRaw: "Random Co",
      vendorNameRaw: vendorName,
      distributorNameRaw: distributorName,
      productNameRaw: "Legacy POTS",
      usage: 0,
      usageAllocated: 0,
      usageUnallocated: 0,
      commission: 0,
      commissionAllocated: 0,
      commissionUnallocated: 0,
      commissionRate: baseRate,
      isChargeback: false,
    },
    {
      tenantId,
      depositId: deposit.id,
      accountId: null,
      vendorAccountId: baseVendorAccountId,
      productId: product?.id ?? null,
      lineNumber: 12,
      status: DepositLineItemStatus.Unmatched,
      paymentDate: addDays(paymentBase, 20),
      accountIdVendor: "A-TEL-1012",
      customerIdVendor: "UNKNOWN-1002",
      orderIdVendor: "ORD-UNKNOWN-2",
      accountNameRaw: "Northwind Traders",
      vendorNameRaw: vendorName,
      distributorNameRaw: distributorName,
      productNameRaw: "Legacy POTS",
      usage: 100,
      usageAllocated: 0,
      usageUnallocated: 100,
      commission: 10,
      commissionAllocated: 0,
      commissionUnallocated: 10,
      commissionRate: baseRate,
      isChargeback: false,
    },
  ]

  const createdLineItems = []
  for (const payload of lineItemPayloads) {
    const item = await prisma.depositLineItem.create({ data: payload })
    createdLineItems.push(item)
  }

  for (const item of createdLineItems) {
    try {
      const result = await matchDepositLine(item.id, { limit: 1 })
      const top = result.candidates[0]
      console.log(
        `Line ${item.lineNumber ?? 0}: top match confidence=${top?.matchConfidence?.toFixed(4) ?? "0.0000"} (${top?.confidenceLevel ?? "n/a"}) schedule=${top?.revenueScheduleName ?? "n/a"}`,
      )
    } catch (error) {
      console.warn(`Failed to compute match confidence for line ${item.id}:`, error)
    }
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
