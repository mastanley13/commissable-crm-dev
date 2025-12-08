import { OpportunityProductStatus, RevenueScheduleType } from "@prisma/client"
import { prisma } from "@/lib/db"
import { generateRevenueScheduleName } from "@/lib/revenue-schedule-number"

function getMonthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

/**
 * Creates a new monthly revenue schedule for each active-billing
 * opportunity product that is still billing and does not yet have
 * a schedule in the target month.
 *
 * Business mapping:
 * - "Still Billing" in specs == OpportunityProductStatus.ActiveBilling.
 * - Automation is intended to be run on the 1st of the month (UTC).
 *
 * Returns the number of schedules created.
 */
export async function processMonthToMonthSchedules(referenceDate: Date = new Date()): Promise<number> {
  const targetMonthStart = getMonthStartUtc(referenceDate)

  const products = await prisma.opportunityProduct.findMany({
    where: {
      status: OpportunityProductStatus.ActiveBilling,
      revenueSchedules: {
        some: {
          scheduleDate: { not: null },
        },
      },
    },
    select: {
      id: true,
      tenantId: true,
      opportunityId: true,
      opportunity: {
        select: {
          accountId: true
        }
      },
      revenueSchedules: {
        where: {
          scheduleDate: { not: null }
        },
        orderBy: {
          scheduleDate: "desc"
        },
        take: 1,
        select: {
          scheduleDate: true,
          scheduleType: true,
          expectedUsage: true,
          expectedCommission: true,
          productId: true,
          distributorAccountId: true,
          vendorAccountId: true
        }
      }
    }
  })

  let createdCount = 0

  for (const product of products) {
    const template = product.revenueSchedules[0]
    if (!template || !template.scheduleDate) {
      continue
    }

    const lastScheduleMonthStart = getMonthStartUtc(new Date(template.scheduleDate))

    // If the most recent schedule is already in the target month or later,
    // we consider schedules for that period "available" and skip.
    if (lastScheduleMonthStart >= targetMonthStart) {
      continue
    }

    const accountId = product.opportunity?.accountId
    if (!accountId) {
      continue
    }

    await prisma.$transaction(async tx => {
      const scheduleNumber = await generateRevenueScheduleName(tx)

      await tx.revenueSchedule.create({
        data: {
          tenantId: product.tenantId,
          opportunityId: product.opportunityId ?? null,
          opportunityProductId: product.id,
          accountId,
          productId: template.productId ?? null,
          distributorAccountId: template.distributorAccountId ?? null,
          vendorAccountId: template.vendorAccountId ?? null,
          scheduleDate: targetMonthStart,
          scheduleType: template.scheduleType ?? RevenueScheduleType.Recurring,
          expectedUsage: template.expectedUsage,
          expectedCommission: template.expectedCommission,
          scheduleNumber
        }
      })
    })

    createdCount += 1
  }

  return createdCount
}
