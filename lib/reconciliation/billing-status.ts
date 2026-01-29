import {
  AuditAction,
  DepositLineMatchStatus,
  Prisma,
  PrismaClient,
  RevenueScheduleBillingStatus,
  RevenueScheduleBillingStatusSource,
  RevenueScheduleFlexClassification,
  RevenueScheduleStatus,
} from "@prisma/client"
import { logRevenueScheduleAudit } from "@/lib/audit"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

export type BillingStatusInputs = {
  currentBillingStatus: RevenueScheduleBillingStatus
  billingStatusSource: RevenueScheduleBillingStatusSource
  scheduleStatus: RevenueScheduleStatus
  flexClassification: RevenueScheduleFlexClassification
  hasAppliedMatches: boolean
  hasUnreconciledAppliedMatches: boolean
}

export function computeNextBillingStatus(inputs: BillingStatusInputs): RevenueScheduleBillingStatus {
  const {
    currentBillingStatus,
    billingStatusSource,
    scheduleStatus,
    flexClassification,
    hasAppliedMatches,
    hasUnreconciledAppliedMatches,
  } = inputs

  if (billingStatusSource !== RevenueScheduleBillingStatusSource.Auto) {
    return currentBillingStatus
  }

  const isFlexDispute =
    flexClassification === RevenueScheduleFlexClassification.FlexProduct ||
    flexClassification === RevenueScheduleFlexClassification.FlexChargeback ||
    flexClassification === RevenueScheduleFlexClassification.FlexChargebackReversal

  if (isFlexDispute) return RevenueScheduleBillingStatus.InDispute

  // Phase 1: disputes are "sticky" until an explicit settlement-style action clears them.
  if (currentBillingStatus === RevenueScheduleBillingStatus.InDispute) {
    return RevenueScheduleBillingStatus.InDispute
  }

  const canBeReconciled =
    scheduleStatus === RevenueScheduleStatus.Reconciled &&
    hasAppliedMatches &&
    !hasUnreconciledAppliedMatches

  if (canBeReconciled) return RevenueScheduleBillingStatus.Reconciled

  return RevenueScheduleBillingStatus.Open
}

export async function applyBillingStatusTransitions(
  client: PrismaClientOrTx,
  {
    tenantId,
    scheduleIds,
    userId,
    request,
    reason,
  }: {
    tenantId: string
    scheduleIds: string[]
    userId?: string
    request?: Request
    reason?: string
  },
): Promise<{ updatedScheduleIds: string[] }> {
  const uniqueIds = Array.from(new Set(scheduleIds.filter(Boolean)))
  if (uniqueIds.length === 0) return { updatedScheduleIds: [] }

  const schedules = await client.revenueSchedule.findMany({
    where: { tenantId, id: { in: uniqueIds }, deletedAt: null },
    select: {
      id: true,
      status: true,
      billingStatus: true,
      billingStatusSource: true,
      flexClassification: true,
    },
  })

  const appliedCounts = await client.depositLineMatch.groupBy({
    by: ["revenueScheduleId"],
    where: {
      tenantId,
      revenueScheduleId: { in: uniqueIds },
      status: DepositLineMatchStatus.Applied,
    },
    _count: { _all: true },
  })
  const unreconciledAppliedCounts = await client.depositLineMatch.groupBy({
    by: ["revenueScheduleId"],
    where: {
      tenantId,
      revenueScheduleId: { in: uniqueIds },
      status: DepositLineMatchStatus.Applied,
      reconciled: false,
    },
    _count: { _all: true },
  })

  const appliedCountByScheduleId = new Map<string, number>(
    appliedCounts.map(row => [row.revenueScheduleId, (row as any)._count?._all ?? 0]),
  )
  const unreconciledAppliedCountByScheduleId = new Map<string, number>(
    unreconciledAppliedCounts.map(row => [row.revenueScheduleId, (row as any)._count?._all ?? 0]),
  )

  const updatedScheduleIds: string[] = []

  for (const schedule of schedules) {
    if (schedule.billingStatusSource !== RevenueScheduleBillingStatusSource.Auto) continue

    const appliedCount = appliedCountByScheduleId.get(schedule.id) ?? 0
    const unreconciledAppliedCount = unreconciledAppliedCountByScheduleId.get(schedule.id) ?? 0

    const nextBillingStatus = computeNextBillingStatus({
      currentBillingStatus: schedule.billingStatus,
      billingStatusSource: schedule.billingStatusSource,
      scheduleStatus: schedule.status,
      flexClassification: schedule.flexClassification,
      hasAppliedMatches: appliedCount > 0,
      hasUnreconciledAppliedMatches: unreconciledAppliedCount > 0,
    })

    if (nextBillingStatus === schedule.billingStatus) continue

    await client.revenueSchedule.update({
      where: { id: schedule.id },
      data: {
        billingStatus: nextBillingStatus,
        billingStatusUpdatedAt: new Date(),
        billingStatusReason: reason ?? "AutoBillingStatusTransition",
        ...(userId ? { billingStatusUpdatedById: userId } : {}),
      },
      select: { id: true },
    })
    updatedScheduleIds.push(schedule.id)

    if (userId) {
      await logRevenueScheduleAudit(
        AuditAction.Update,
        schedule.id,
        userId,
        tenantId,
        request,
        { billingStatus: schedule.billingStatus },
        {
          billingStatus: nextBillingStatus,
          reason: reason ?? "AutoBillingStatusTransition",
        },
      )
    }
  }

  return { updatedScheduleIds }
}
