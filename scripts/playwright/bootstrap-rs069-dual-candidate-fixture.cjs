const { PrismaClient } = require('@prisma/client')

const TENANT_ID = 'b28d3e15-1f33-49a4-9578-78c39f3dbabc'
const FIXTURE_DEPOSIT_ID = '347dd9cf-7111-407b-8b3a-328a642fddd3'
const FIXTURE_LINE_ID = '56742e01-8c59-4aba-9562-c00561873d78'
const FIXTURE_SCHEDULE_IDS = [
  '54ce5402-0294-4337-b612-c514ad28865a',
  '7192635a-363e-4ee7-8f03-706686ea6f3e',
]

function requireDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim()
  if (!value) {
    throw new Error('DATABASE_URL is required for bootstrap-rs069-dual-candidate-fixture.cjs')
  }

  return value
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
    const deposit = await prisma.deposit.findUnique({
      where: { id: FIXTURE_DEPOSIT_ID },
      select: {
        id: true,
        tenantId: true,
        depositName: true,
        paymentDate: true,
      },
    })

    if (!deposit) {
      throw new Error(`Fixture deposit ${FIXTURE_DEPOSIT_ID} was not found`)
    }

    if (deposit.tenantId !== TENANT_ID) {
      throw new Error(`Fixture deposit ${FIXTURE_DEPOSIT_ID} belongs to unexpected tenant ${deposit.tenantId}`)
    }

    const line = await prisma.depositLineItem.findUnique({
      where: { id: FIXTURE_LINE_ID },
      select: {
        id: true,
        tenantId: true,
        depositId: true,
      },
    })

    if (!line) {
      throw new Error(`Fixture deposit line ${FIXTURE_LINE_ID} was not found`)
    }

    if (line.tenantId !== TENANT_ID || line.depositId !== FIXTURE_DEPOSIT_ID) {
      throw new Error(`Fixture line ${FIXTURE_LINE_ID} is no longer attached to deposit ${FIXTURE_DEPOSIT_ID}`)
    }

    const schedules = await prisma.revenueSchedule.findMany({
      where: {
        id: { in: FIXTURE_SCHEDULE_IDS },
        tenantId: TENANT_ID,
      },
      select: {
        id: true,
        scheduleNumber: true,
        accountId: true,
        productId: true,
        distributorAccountId: true,
        vendorAccountId: true,
        opportunity: {
          select: {
            customerIdVendor: true,
            orderIdVendor: true,
            customerPurchaseOrder: true,
            locationId: true,
          },
        },
        account: {
          select: {
            accountName: true,
          },
        },
        vendor: {
          select: {
            accountName: true,
          },
        },
        distributor: {
          select: {
            accountName: true,
          },
        },
        product: {
          select: {
            productNameVendor: true,
            partNumberVendor: true,
          },
        },
      },
      orderBy: { scheduleDate: 'asc' },
    })

    if (schedules.length !== FIXTURE_SCHEDULE_IDS.length) {
      throw new Error(
        `Expected ${FIXTURE_SCHEDULE_IDS.length} schedules for RS-069, found ${schedules.length}`
      )
    }

    const [baseline] = schedules
    if (!baseline) {
      throw new Error('RS-069 schedule baseline is missing')
    }

    for (const schedule of schedules) {
      if (
        schedule.accountId !== baseline.accountId ||
        schedule.productId !== baseline.productId ||
        schedule.distributorAccountId !== baseline.distributorAccountId ||
        schedule.vendorAccountId !== baseline.vendorAccountId
      ) {
        throw new Error(
          `RS-069 schedules are no longer a stable near-duplicate family: ${FIXTURE_SCHEDULE_IDS.join(', ')}`
        )
      }
    }

    await prisma.$transaction(async tx => {
      await tx.depositLineMatch.deleteMany({
        where: {
          tenantId: TENANT_ID,
          depositLineItemId: FIXTURE_LINE_ID,
        },
      })

      await tx.deposit.update({
        where: { id: FIXTURE_DEPOSIT_ID },
        data: {
          accountId: baseline.distributorAccountId,
          distributorAccountId: baseline.distributorAccountId,
          vendorAccountId: baseline.vendorAccountId,
          notes: 'RS-069 restored dual-candidate fixture aligned to the Telarus TC-03 schedule family.',
        },
      })

      await tx.depositLineItem.update({
        where: { id: FIXTURE_LINE_ID },
        data: {
          accountId: baseline.accountId,
          vendorAccountId: baseline.vendorAccountId,
          productId: baseline.productId,
          customerIdVendor: baseline.opportunity?.customerIdVendor ?? null,
          orderIdVendor: baseline.opportunity?.orderIdVendor ?? null,
          accountNameRaw: baseline.account?.accountName ?? null,
          vendorNameRaw: baseline.vendor?.accountName ?? null,
          productNameRaw: baseline.product?.productNameVendor ?? null,
          partNumberRaw: baseline.product?.partNumberVendor ?? null,
          distributorNameRaw: baseline.distributor?.accountName ?? null,
          locationId: baseline.opportunity?.locationId ?? null,
          customerPurchaseOrder: baseline.opportunity?.customerPurchaseOrder ?? null,
          primaryRevenueScheduleId: null,
          status: 'Unmatched',
          hasSuggestedMatches: false,
          lastMatchCheckAt: null,
          reconciled: false,
          reconciledAt: null,
        },
      })
    })

    process.stdout.write(
      JSON.stringify(
        {
          fixture: 'RS-069 dual-candidate review',
          depositId: FIXTURE_DEPOSIT_ID,
          lineId: FIXTURE_LINE_ID,
          restoredDistributorAccountId: baseline.distributorAccountId,
          restoredDistributorName: baseline.distributor?.accountName ?? null,
          restoredVendorAccountId: baseline.vendorAccountId,
          restoredVendorName: baseline.vendor?.accountName ?? null,
          scheduleIds: schedules.map(schedule => schedule.id),
          scheduleNumbers: schedules.map(schedule => schedule.scheduleNumber),
          depositName: deposit.depositName,
          paymentDate: deposit.paymentDate?.toISOString() ?? null,
        },
        null,
        2
      )
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
