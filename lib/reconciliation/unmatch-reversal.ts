import { DepositLineMatchStatus, Prisma, PrismaClient } from "@prisma/client"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { recomputeDepositLineItemAllocations } from "@/lib/matching/deposit-line-allocations"
import { recomputeRevenueSchedules } from "@/lib/matching/revenue-schedule-status"
import {
  applyUndoLogRollback,
  filterUndoLogsByScheduleIds,
  listOpenUndoLogs,
  markUndoLogsReversed,
} from "@/lib/reconciliation/undo-log"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

function normalizeIdList(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)))
}

function getRelatedRevenueScheduleIds(payload: unknown): string[] {
  const related = (payload as any)?.relatedRevenueScheduleIds
  if (!Array.isArray(related)) return []
  return normalizeIdList(related)
}

export type ExecuteUnmatchReversalParams = {
  tenantId: string
  depositId: string
  lineItemIds: string[]
  userId: string
  varianceTolerance: number
  revenueScheduleIds?: string[]
}

export async function executeUnmatchReversal(
  client: PrismaClientOrTx,
  {
    tenantId,
    depositId,
    lineItemIds,
    userId,
    varianceTolerance,
    revenueScheduleIds = [],
  }: ExecuteUnmatchReversalParams,
) {
  const normalizedLineIds = normalizeIdList(lineItemIds)
  const normalizedScheduleIds = normalizeIdList(revenueScheduleIds)

  if (normalizedLineIds.length === 0) {
    throw new Error("At least one deposit line item id is required")
  }

  const deposit = await client.deposit.findFirst({
    where: { id: depositId, tenantId },
    select: { id: true, reconciled: true, status: true },
  })
  if (!deposit) {
    throw new Error("Deposit not found")
  }
  if (deposit.reconciled || deposit.status === "Completed") {
    throw new Error("Reconciled/finalized deposits must be unfinalized before unmatching")
  }

  const lines = await client.depositLineItem.findMany({
    where: { tenantId, depositId, id: { in: normalizedLineIds } },
    select: { id: true, reconciled: true },
  })
  if (lines.length !== normalizedLineIds.length) {
    throw new Error("One or more deposit line items were not found")
  }
  if (lines.some(line => line.reconciled)) {
    throw new Error("Reconciled line items cannot be unmatched until the deposit is unfinalized")
  }

  const matchStatuses = [DepositLineMatchStatus.Applied, DepositLineMatchStatus.Suggested]
  const matches = await client.depositLineMatch.findMany({
    where: {
      tenantId,
      depositLineItemId: { in: normalizedLineIds },
      ...(normalizedScheduleIds.length > 0 ? { revenueScheduleId: { in: normalizedScheduleIds } } : {}),
      status: { in: matchStatuses },
    },
    select: {
      id: true,
      depositLineItemId: true,
      revenueScheduleId: true,
      status: true,
    },
  })

  const openUndoLogs = await listOpenUndoLogs(client, {
    tenantId,
    depositLineItemIds: normalizedLineIds,
  })
  const undoLogs = filterUndoLogsByScheduleIds(openUndoLogs, normalizedScheduleIds)

  const affectedLineItemIds = normalizeIdList(matches.map(match => match.depositLineItemId))
  const candidateScheduleIds = new Set<string>()
  for (const match of matches) {
    candidateScheduleIds.add(match.revenueScheduleId)
  }
  for (const entry of undoLogs) {
    if (entry.targetEntityName === "RevenueSchedule") {
      candidateScheduleIds.add(entry.targetEntityId)
    }
    for (const scheduleId of getRelatedRevenueScheduleIds(entry.payload)) {
      candidateScheduleIds.add(scheduleId)
    }
  }

  const schedulesBefore =
    candidateScheduleIds.size > 0
      ? await client.revenueSchedule.findMany({
          where: { tenantId, id: { in: Array.from(candidateScheduleIds) } },
          select: {
            id: true,
            status: true,
            actualUsage: true,
            actualCommission: true,
            deletedAt: true,
          },
        })
      : []

  for (const entry of undoLogs) {
    await applyUndoLogRollback(client, entry)
  }

  const deleteResult = await client.depositLineMatch.deleteMany({
    where: {
      tenantId,
      depositLineItemId: { in: normalizedLineIds },
      ...(normalizedScheduleIds.length > 0 ? { revenueScheduleId: { in: normalizedScheduleIds } } : {}),
      status: { in: matchStatuses },
    },
  })

  const lineIdsToRecompute = normalizedLineIds
  const updatedLines = []
  for (const lineId of lineIdsToRecompute) {
    const { line } = await recomputeDepositLineItemAllocations(client, lineId, tenantId)
    updatedLines.push(line)
  }

  const updatedDeposit = await recomputeDepositAggregates(client, depositId, tenantId)

  const activeScheduleIds =
    candidateScheduleIds.size > 0
      ? (
          await client.revenueSchedule.findMany({
            where: {
              tenantId,
              id: { in: Array.from(candidateScheduleIds) },
              deletedAt: null,
            },
            select: { id: true },
          })
        ).map(row => row.id)
      : []

  const revenueSchedules =
    activeScheduleIds.length > 0
      ? await recomputeRevenueSchedules(client, activeScheduleIds, tenantId, { varianceTolerance })
      : []

  await markUndoLogsReversed(client, {
    undoLogIds: undoLogs.map(entry => entry.id),
    reversedByUserId: userId,
  })

  return {
    deletedMatchCount: deleteResult.count,
    affectedLineItemIds: lineIdsToRecompute,
    affectedScheduleIds: Array.from(candidateScheduleIds),
    reversedUndoLogCount: undoLogs.length,
    lineItems: updatedLines,
    deposit: updatedDeposit,
    revenueSchedules,
    schedulesBefore,
  }
}
