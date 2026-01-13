import { DepositLineMatchStatus, Prisma, PrismaClient, RevenueScheduleStatus } from "@prisma/client"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

type RecomputeOptions = {
  varianceTolerance?: number
}

export type RevenueScheduleRecomputeResult = {
  schedule: {
    id: string
    status: RevenueScheduleStatus
    actualUsage: number | null
    actualCommission: number | null
  }
  expectedUsageNet: number
  actualUsageNet: number
  expectedCommissionNet: number
  actualCommissionNet: number
  usageBalance: number
  commissionDifference: number
  matchCount: number
}

const EPSILON = 0.005

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function resolveStatus({
  usageBalance,
  commissionDifference,
  matchCount,
  expectedUsageNet,
  expectedCommissionNet,
  varianceTolerance = 0,
}: {
  usageBalance: number
  commissionDifference: number
  matchCount: number
  expectedUsageNet: number
  expectedCommissionNet: number
  varianceTolerance?: number
}): RevenueScheduleStatus {
  if (matchCount === 0) {
    return RevenueScheduleStatus.Unreconciled
  }

  const tolerance = Math.max(0, Math.min(varianceTolerance ?? 0, 1))
  const usageTolerance = Math.abs(expectedUsageNet) * tolerance
  const commissionTolerance = Math.abs(expectedCommissionNet) * tolerance

  const withinTolerance =
    Math.abs(usageBalance) <= Math.max(usageTolerance, EPSILON) &&
    Math.abs(commissionDifference) <= Math.max(commissionTolerance, EPSILON)

  if (withinTolerance) {
    return RevenueScheduleStatus.Reconciled
  }

  if (usageBalance < 0 || commissionDifference < 0) {
    return RevenueScheduleStatus.Overpaid
  }

  return RevenueScheduleStatus.Underpaid
}

export async function recomputeRevenueScheduleFromMatches(
  client: PrismaClientOrTx,
  revenueScheduleId: string,
  tenantId: string,
  options: RecomputeOptions = {},
): Promise<RevenueScheduleRecomputeResult> {
  const schedule = await client.revenueSchedule.findFirst({
    where: { id: revenueScheduleId, tenantId },
    select: {
      id: true,
      expectedUsage: true,
      usageAdjustment: true,
      actualUsageAdjustment: true,
      expectedCommission: true,
      actualCommissionAdjustment: true,
    },
  })

  if (!schedule) {
    throw new Error(`Revenue schedule ${revenueScheduleId} not found for tenant ${tenantId}`)
  }

  const matchAggregation = await client.depositLineMatch.aggregate({
    where: {
      tenantId,
      revenueScheduleId,
      status: DepositLineMatchStatus.Applied,
    },
    _sum: {
      usageAmount: true,
      commissionAmount: true,
    },
    _count: true,
  })

  const actualUsage = toNumber(matchAggregation._sum.usageAmount)
  const actualCommission = toNumber(matchAggregation._sum.commissionAmount)
  const matchCount = typeof matchAggregation._count === "number" ? matchAggregation._count : 0

  const expectedUsage = toNumber(schedule.expectedUsage)
  const expectedUsageAdjustment = toNumber(schedule.usageAdjustment)
  const actualUsageAdjustment = toNumber(schedule.actualUsageAdjustment)

  const expectedCommission = toNumber(schedule.expectedCommission)
  const actualCommissionAdjustment = toNumber(schedule.actualCommissionAdjustment)
  const expectedCommissionAdjustment = 0

  const expectedUsageNet = expectedUsage + expectedUsageAdjustment
  const actualUsageNet = actualUsage + actualUsageAdjustment
  const expectedCommissionNet = expectedCommission + expectedCommissionAdjustment
  const actualCommissionNet = actualCommission + actualCommissionAdjustment

  const usageBalance = expectedUsageNet - actualUsageNet
  const commissionDifference = expectedCommissionNet - actualCommissionNet

  const status = resolveStatus({
    usageBalance,
    commissionDifference,
    matchCount,
    expectedUsageNet,
    expectedCommissionNet,
    varianceTolerance: options.varianceTolerance,
  })

  const updated = await client.revenueSchedule.update({
    where: { id: revenueScheduleId },
    data: {
      actualUsage,
      actualCommission,
      status,
    },
    select: {
      id: true,
      status: true,
    },
  })

  return {
    schedule: {
      id: updated.id,
      status: updated.status,
      actualUsage,
      actualCommission,
    },
    expectedUsageNet,
    actualUsageNet,
    expectedCommissionNet,
    actualCommissionNet,
    usageBalance,
    commissionDifference,
    matchCount,
  }
}

export async function recomputeRevenueSchedules(
  client: PrismaClientOrTx,
  scheduleIds: string[],
  tenantId: string,
  options: RecomputeOptions = {},
): Promise<RevenueScheduleRecomputeResult[]> {
  const uniqueIds = Array.from(new Set(scheduleIds.filter(Boolean)))
  const results: RevenueScheduleRecomputeResult[] = []

  for (const id of uniqueIds) {
    const result = await recomputeRevenueScheduleFromMatches(client, id, tenantId, options)
    results.push(result)
  }

  return results
}
