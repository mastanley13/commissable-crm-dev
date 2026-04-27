const { PrismaClient } = require('@prisma/client')

const TENANT_ID = 'b28d3e15-1f33-49a4-9578-78c39f3dbabc'
const CREATED_BY_USER_ID = 'b3d96a11-8901-4000-99fc-caefa57455c9'
const DISTRIBUTOR_ACCOUNT_ID = '2bb0d87b-33c4-4c99-94b5-22bad4a0141a'
const VENDOR_ACCOUNT_ID = '39c55d31-15a4-4477-a189-b0605225598c'
const TARGET_SCHEDULE_ID = '1274ec2a-54c2-4dcb-9185-6f1cee0de73c'

const FIXTURE_DEPOSIT_ID = 'f660e6fe-9c1c-45d1-b172-5ed13d89bb2d'
const FIXTURE_LINE_IDS = [
  '0df95f40-0d53-4d69-b06f-c5c8462d6c59',
  '554730da-eb12-4fcc-9f55-1ed72af29b88',
  '9f64f22e-a9e5-4ec5-b8e6-4ae3f4797d2e',
]

const FIXTURE = {
  depositId: FIXTURE_DEPOSIT_ID,
  depositName: 'AUTO IMPORT rs-043-weighted-rate-many-to-one-starter-batch',
  month: new Date('2026-04-01T00:00:00.000Z'),
  paymentDate: new Date('2026-04-15T00:00:00.000Z'),
  totalUsage: '1000',
  totalCommission: '150',
  customerIdVendor: 'GEN-DW-1101',
  orderIdVendor: 'RCN-GEN-1101',
  accountNameRaw: 'DW Realty GA',
  vendorNameRaw: 'ACC Business',
  distributorNameRaw: 'Telarus',
  partNumberRaw: 'RCN-BUNDLE-1000',
  lineItems: [
    {
      id: FIXTURE_LINE_IDS[0],
      lineNumber: 1,
      productNameRaw: 'Bundle Part 1',
      usage: '400',
      commission: '60',
      commissionRate: '15',
    },
    {
      id: FIXTURE_LINE_IDS[1],
      lineNumber: 2,
      productNameRaw: 'Bundle Part 2',
      usage: '350',
      commission: '52.5',
      commissionRate: '15',
    },
    {
      id: FIXTURE_LINE_IDS[2],
      lineNumber: 3,
      productNameRaw: 'Bundle Part 3',
      usage: '250',
      commission: '37.5',
      commissionRate: '15',
    },
  ],
}

function requireDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim()
  if (!value) {
    throw new Error('DATABASE_URL is required for bootstrap-rs043-weighted-rate-fixture.cjs')
  }

  return value
}

function computeRatePercent(usage, commission) {
  const usageNumber = Number(usage)
  const commissionNumber = Number(commission)
  if (!Number.isFinite(usageNumber) || Math.abs(usageNumber) <= 0.00001) {
    return null
  }

  return Number(((commissionNumber / usageNumber) * 100).toFixed(4))
}

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: requireDatabaseUrl(),
      },
    },
  })

  try {
    const targetSchedule = await prisma.revenueSchedule.findUnique({
      where: { id: TARGET_SCHEDULE_ID },
      select: {
        id: true,
        expectedUsage: true,
        expectedCommission: true,
        expectedCommissionRatePercent: true,
        scheduleNumber: true,
        accountId: true,
        opportunityId: true,
        opportunityProductId: true,
      },
    })

    if (!targetSchedule) {
      throw new Error(`Target revenue schedule ${TARGET_SCHEDULE_ID} was not found`)
    }

    await prisma.$transaction(async tx => {
      await tx.depositLineMatch.deleteMany({
        where: {
          tenantId: TENANT_ID,
          depositLineItemId: { in: FIXTURE_LINE_IDS },
        },
      })

      await tx.deposit.upsert({
        where: { id: FIXTURE.depositId },
        update: {
          accountId: DISTRIBUTOR_ACCOUNT_ID,
          month: FIXTURE.month,
          totalCommissions: FIXTURE.totalCommission,
          status: 'Pending',
          reconciled: false,
          reconciledAt: null,
          depositName: FIXTURE.depositName,
          paymentDate: FIXTURE.paymentDate,
          totalItems: FIXTURE.lineItems.length,
          totalReconciledItems: 0,
          totalUsage: FIXTURE.totalUsage,
          usageAllocated: '0',
          usageUnallocated: FIXTURE.totalUsage,
          commissionAllocated: '0',
          commissionUnallocated: FIXTURE.totalCommission,
          itemsReconciled: 0,
          itemsUnreconciled: FIXTURE.lineItems.length,
          distributorAccountId: DISTRIBUTOR_ACCOUNT_ID,
          vendorAccountId: VENDOR_ACCOUNT_ID,
          createdByUserId: CREATED_BY_USER_ID,
          notes: 'RS-043 dedicated weighted-rate ManyToOne fixture.',
        },
        create: {
          id: FIXTURE.depositId,
          tenantId: TENANT_ID,
          accountId: DISTRIBUTOR_ACCOUNT_ID,
          month: FIXTURE.month,
          totalCommissions: FIXTURE.totalCommission,
          status: 'Pending',
          reconciled: false,
          depositName: FIXTURE.depositName,
          paymentDate: FIXTURE.paymentDate,
          totalItems: FIXTURE.lineItems.length,
          totalReconciledItems: 0,
          totalUsage: FIXTURE.totalUsage,
          usageAllocated: '0',
          usageUnallocated: FIXTURE.totalUsage,
          commissionAllocated: '0',
          commissionUnallocated: FIXTURE.totalCommission,
          itemsReconciled: 0,
          itemsUnreconciled: FIXTURE.lineItems.length,
          distributorAccountId: DISTRIBUTOR_ACCOUNT_ID,
          vendorAccountId: VENDOR_ACCOUNT_ID,
          createdByUserId: CREATED_BY_USER_ID,
          notes: 'RS-043 dedicated weighted-rate ManyToOne fixture.',
        },
      })

      for (const line of FIXTURE.lineItems) {
        await tx.depositLineItem.upsert({
          where: { id: line.id },
          update: {
            depositId: FIXTURE.depositId,
            primaryRevenueScheduleId: null,
            lineNumber: line.lineNumber,
            status: 'Unmatched',
            paymentDate: FIXTURE.paymentDate,
            accountId: null,
            vendorAccountId: VENDOR_ACCOUNT_ID,
            productId: null,
            accountIdVendor: null,
            customerIdVendor: FIXTURE.customerIdVendor,
            orderIdVendor: FIXTURE.orderIdVendor,
            accountNameRaw: FIXTURE.accountNameRaw,
            vendorNameRaw: FIXTURE.vendorNameRaw,
            productNameRaw: line.productNameRaw,
            partNumberRaw: FIXTURE.partNumberRaw,
            distributorNameRaw: FIXTURE.distributorNameRaw,
            locationId: null,
            customerPurchaseOrder: null,
            metadata: null,
            usage: line.usage,
            usageAllocated: '0',
            usageUnallocated: line.usage,
            commission: line.commission,
            commissionAllocated: '0',
            commissionUnallocated: line.commission,
            commissionRate: line.commissionRate,
            isChargeback: false,
            reconciled: false,
            reconciledAt: null,
            hasSuggestedMatches: true,
            lastMatchCheckAt: null,
          },
          create: {
            id: line.id,
            tenantId: TENANT_ID,
            depositId: FIXTURE.depositId,
            lineNumber: line.lineNumber,
            status: 'Unmatched',
            paymentDate: FIXTURE.paymentDate,
            vendorAccountId: VENDOR_ACCOUNT_ID,
            customerIdVendor: FIXTURE.customerIdVendor,
            orderIdVendor: FIXTURE.orderIdVendor,
            accountNameRaw: FIXTURE.accountNameRaw,
            vendorNameRaw: FIXTURE.vendorNameRaw,
            productNameRaw: line.productNameRaw,
            partNumberRaw: FIXTURE.partNumberRaw,
            distributorNameRaw: FIXTURE.distributorNameRaw,
            usage: line.usage,
            usageAllocated: '0',
            usageUnallocated: line.usage,
            commission: line.commission,
            commissionAllocated: '0',
            commissionUnallocated: line.commission,
            commissionRate: line.commissionRate,
            isChargeback: false,
            reconciled: false,
            hasSuggestedMatches: true,
          },
        })
      }
    })

    const actualRatePercent = computeRatePercent(FIXTURE.totalUsage, FIXTURE.totalCommission)
    const expectedRatePercent =
      targetSchedule.expectedCommissionRatePercent == null
        ? computeRatePercent(targetSchedule.expectedUsage, targetSchedule.expectedCommission)
        : Number(targetSchedule.expectedCommissionRatePercent)

    process.stdout.write(
      JSON.stringify(
        {
          fixture: 'RS-043 weighted-rate ManyToOne',
          depositId: FIXTURE.depositId,
          lineId: FIXTURE.lineItems[0].id,
          lineIds: FIXTURE.lineItems.map(line => line.id),
          scheduleIds: [TARGET_SCHEDULE_ID],
          scheduleNumber: targetSchedule.scheduleNumber,
          expectedRatePercent,
          actualWeightedRatePercent: actualRatePercent,
          note:
            expectedRatePercent == null || actualRatePercent == null
              ? 'Fixture seeded, but rate math could not be computed from the stored values.'
              : `Fixture seeded with a weighted-rate delta of ${(actualRatePercent - expectedRatePercent).toFixed(4)} percentage points.`,
        },
        null,
        2
      ) + '\n'
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
