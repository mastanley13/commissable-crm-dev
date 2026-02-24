import { DepositLineMatchStatus, OpportunityProductStatus, RevenueScheduleType } from "@prisma/client"
import { prisma } from "@/lib/db"
import { generateRevenueScheduleName } from "@/lib/revenue-schedule-number"

const DEFAULT_NO_DEPOSIT_THRESHOLD_MONTHS = 3
const NO_DEPOSIT_THRESHOLD_SETTING_KEY = "reconciliation.m2mNoDepositThresholdMonths"
const BILLING_M2M_STATUS = "BillingM2M" as OpportunityProductStatus

export interface MonthToMonthRunOptions {
  dryRun?: boolean
  noDepositThresholdMonths?: number
}

export interface MonthToMonthRunResult {
  dryRun: boolean
  referenceDateIso: string
  targetMonthStartIso: string
  scannedCount: number
  createdCount: number
  skippedExistingCount: number
  skippedMissingAccountCount: number
  transitionedToM2MCount: number
  transitionedToBillingEndedCount: number
  noDepositThresholdMonths: number
  errors: Array<{ opportunityProductId: string; message: string }>
}

function getMonthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function getMonthOffsetStartUtc(date: Date, offsetMonths: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offsetMonths, 1))
}

function deserializeSettingValue(raw: unknown): unknown {
  if (raw == null) return raw
  if (typeof raw !== "string") return raw
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function normalizeNoDepositThreshold(raw: unknown): number {
  const value = deserializeSettingValue(raw)
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_NO_DEPOSIT_THRESHOLD_MONTHS
  const rounded = Math.floor(numeric)
  if (rounded < 1) return DEFAULT_NO_DEPOSIT_THRESHOLD_MONTHS
  return rounded
}

async function getNoDepositThresholdMonths(tenantId: string): Promise<number> {
  const setting = await prisma.systemSetting.findFirst({
    where: { tenantId, key: NO_DEPOSIT_THRESHOLD_SETTING_KEY },
    select: { value: true },
  })
  return normalizeNoDepositThreshold(setting?.value)
}

async function hasRecentDepositsForOpportunityProduct(
  tenantId: string,
  opportunityProductId: string,
  targetMonthStart: Date,
  thresholdMonths: number,
): Promise<boolean> {
  const lookbackStart = getMonthOffsetStartUtc(targetMonthStart, -thresholdMonths)
  const count = await prisma.depositLineMatch.count({
    where: {
      tenantId,
      status: DepositLineMatchStatus.Applied,
      revenueSchedule: {
        tenantId,
        opportunityProductId,
        deletedAt: null,
      },
      depositLineItem: {
        deposit: {
          tenantId,
          month: {
            gte: lookbackStart,
            lt: targetMonthStart,
          },
        },
      },
    },
  })
  return count > 0
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
 * Returns execution telemetry including schedules created and lifecycle transitions.
 */
export async function processMonthToMonthSchedules(
  referenceDate: Date = new Date(),
  options: MonthToMonthRunOptions = {},
): Promise<MonthToMonthRunResult> {
  const dryRun = Boolean(options.dryRun)
  const targetMonthStart = getMonthStartUtc(referenceDate)
  const thresholdByTenant = new Map<string, number>()
  const resolvedThreshold =
    typeof options.noDepositThresholdMonths === "number" && options.noDepositThresholdMonths > 0
      ? Math.floor(options.noDepositThresholdMonths)
      : null

  const products = await prisma.opportunityProduct.findMany({
    where: {
      status: {
        in: [OpportunityProductStatus.ActiveBilling, BILLING_M2M_STATUS] as any,
      },
      revenueSchedules: {
        some: {
          scheduleDate: { not: null },
        },
      },
    },
    select: {
      id: true,
      tenantId: true,
      status: true,
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

  const result: MonthToMonthRunResult = {
    dryRun,
    referenceDateIso: referenceDate.toISOString(),
    targetMonthStartIso: targetMonthStart.toISOString(),
    scannedCount: 0,
    createdCount: 0,
    skippedExistingCount: 0,
    skippedMissingAccountCount: 0,
    transitionedToM2MCount: 0,
    transitionedToBillingEndedCount: 0,
    noDepositThresholdMonths: resolvedThreshold ?? DEFAULT_NO_DEPOSIT_THRESHOLD_MONTHS,
    errors: [],
  }

  for (const product of products) {
    result.scannedCount += 1

    const template = product.revenueSchedules[0]
    if (!template || !template.scheduleDate) {
      continue
    }

    const lastScheduleMonthStart = getMonthStartUtc(new Date(template.scheduleDate))

    // If the most recent schedule is already in the target month or later,
    // we consider schedules for that period "available" and skip.
    if (lastScheduleMonthStart >= targetMonthStart) {
      result.skippedExistingCount += 1
      continue
    }

    const accountId = product.opportunity?.accountId
    if (!accountId) {
      result.skippedMissingAccountCount += 1
      continue
    }

    try {
      const threshold =
        resolvedThreshold ??
        (thresholdByTenant.has(product.tenantId)
          ? thresholdByTenant.get(product.tenantId)!
          : await (async () => {
              const loaded = await getNoDepositThresholdMonths(product.tenantId)
              thresholdByTenant.set(product.tenantId, loaded)
              return loaded
            })())

      result.noDepositThresholdMonths = threshold

      if (product.status === BILLING_M2M_STATUS) {
        const hasRecentDeposits = await hasRecentDepositsForOpportunityProduct(
          product.tenantId,
          product.id,
          targetMonthStart,
          threshold,
        )
        if (!hasRecentDeposits) {
          if (!dryRun) {
            await prisma.opportunityProduct.update({
              where: { id: product.id },
              data: { status: OpportunityProductStatus.BillingEnded },
            })
          }
          result.transitionedToBillingEndedCount += 1
          continue
        }
      }

      if (dryRun) {
        result.createdCount += 1
        if (product.status === OpportunityProductStatus.ActiveBilling) {
          result.transitionedToM2MCount += 1
        }
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
            scheduleNumber,
          },
        })

        if (product.status === OpportunityProductStatus.ActiveBilling) {
          await tx.opportunityProduct.update({
            where: { id: product.id },
            data: { status: BILLING_M2M_STATUS as any },
          })
        }
      })

      result.createdCount += 1
      if (product.status === OpportunityProductStatus.ActiveBilling) {
        result.transitionedToM2MCount += 1
      }
    } catch (error) {
      result.errors.push({
        opportunityProductId: product.id,
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return result
}
