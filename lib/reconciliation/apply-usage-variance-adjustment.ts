import { Prisma, PrismaClient, RevenueScheduleFlexReasonCode } from "@prisma/client"

import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import {
  applyExpectedDeltasToFutureSchedules,
  findFutureSchedulesInScope,
  resolveScheduleScopeKey,
} from "@/lib/reconciliation/future-schedules"
import { createRevenueScheduleAdjustmentWithUndo } from "@/lib/reconciliation/revenue-schedule-adjustments"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

const EPSILON = 0.005

export type ApplyUsageVarianceAdjustmentResult = {
  updatedScheduleIds: string[]
  createdAdjustmentIds: string[]
  futureUpdatedScheduleIds: string[]
  usageOverage: number
  commissionOverage: number
  flexExecution: {
    applied: true
    action: "Adjust" | "AdjustForward"
    createdRevenueScheduleIds: string[]
    createdProductIds: string[]
    createdAdjustmentIds: string[]
  }
  futureUpdate: {
    updatedScheduleIds: string[]
    createdAdjustmentIds: string[]
  }
}

export async function applyUsageVarianceAdjustment(
  client: PrismaClientOrTx,
  {
    tenantId,
    userId,
    request,
    depositId,
    depositLineItemId,
    revenueScheduleId,
    applyToFuture,
    varianceTolerance,
  }: {
    tenantId: string
    userId: string
    request?: Request
    depositId: string
    depositLineItemId: string
    revenueScheduleId: string
    applyToFuture: boolean
    varianceTolerance: number
  },
): Promise<ApplyUsageVarianceAdjustmentResult> {
  const lineItem = await client.depositLineItem.findFirst({
    where: { id: depositLineItemId, depositId, tenantId },
    select: { id: true, reconciled: true },
  })
  if (!lineItem) {
    throw new Error("Deposit line item not found")
  }
  if (lineItem.reconciled) {
    throw new Error("Reconciled line items cannot be changed")
  }

  const baseSchedule = await client.revenueSchedule.findFirst({
    where: { id: revenueScheduleId, tenantId, deletedAt: null },
    select: {
      id: true,
      accountId: true,
      scheduleDate: true,
      opportunityProductId: true,
      productId: true,
      vendorAccountId: true,
      distributorAccountId: true,
      vendor: { select: { accountName: true } },
      distributor: { select: { accountName: true } },
      product: {
        select: {
          productCode: true,
          partNumberVendor: true,
          partNumberDistributor: true,
          partNumberHouse: true,
        },
      },
    },
  })

  if (!baseSchedule) {
    throw new Error("Revenue schedule not found")
  }
  if (applyToFuture && !baseSchedule.scheduleDate) {
    throw new Error("Revenue schedule date is required to apply future adjustments")
  }

  const recompute = await recomputeRevenueScheduleFromMatches(client, revenueScheduleId, tenantId, {
    varianceTolerance,
  })

  const usageOverage = recompute.usageBalance < 0 ? Math.abs(recompute.usageBalance) : 0
  const commissionOverage = recompute.commissionDifference < 0 ? Math.abs(recompute.commissionDifference) : 0

  if (usageOverage <= EPSILON && commissionOverage <= EPSILON) {
    throw new Error("No overage found to adjust")
  }

  const createdAdjustment = await createRevenueScheduleAdjustmentWithUndo(client, {
    tenantId,
    depositId,
    depositLineItemId,
    userId,
    revenueScheduleId,
    adjustmentType: "adjustment_single",
    applicationScope: "this_schedule_only",
    usageAmount: usageOverage,
    commissionAmount: commissionOverage,
    effectiveScheduleDate: baseSchedule.scheduleDate ?? null,
    reason: RevenueScheduleFlexReasonCode.OverageOutsideTolerance,
  })

  let futureUpdate = { updatedScheduleIds: [] as string[], createdAdjustmentIds: [] as string[] }
  if (applyToFuture) {
    const futureSchedules = await findFutureSchedulesInScope(client, {
      tenantId,
      baseScheduleId: baseSchedule.id,
      baseScheduleDate: baseSchedule.scheduleDate as Date,
      scope: resolveScheduleScopeKey(baseSchedule),
      excludeAllocated: true,
    })

    futureUpdate = await applyExpectedDeltasToFutureSchedules(client, {
      tenantId,
      userId,
      request,
      schedules: futureSchedules,
      usageDelta: usageOverage,
      commissionDelta: commissionOverage,
      sourceScheduleId: baseSchedule.id,
      depositId,
      depositLineItemId,
    })
  }

  const createdAdjustmentIds = [
    ...(createdAdjustment?.id ? [createdAdjustment.id] : []),
    ...(futureUpdate.createdAdjustmentIds ?? []),
  ]

  return {
    updatedScheduleIds: [revenueScheduleId, ...(futureUpdate.updatedScheduleIds ?? [])],
    createdAdjustmentIds,
    futureUpdatedScheduleIds: futureUpdate.updatedScheduleIds ?? [],
    usageOverage,
    commissionOverage,
    flexExecution: {
      applied: true,
      action: applyToFuture ? "AdjustForward" : "Adjust",
      createdRevenueScheduleIds: [],
      createdProductIds: [],
      createdAdjustmentIds,
    },
    futureUpdate,
  }
}
