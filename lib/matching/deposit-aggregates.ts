import {
  Prisma,
  PrismaClient,
  DepositLineItemStatus,
  ReconciliationStatus,
} from "@prisma/client"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

interface DepositAggregateTotals {
  totalUsage: number
  usageAllocated: number
  usageUnallocated: number
  totalCommission: number
  commissionAllocated: number
  commissionUnallocated: number
  totalItems: number
  matchedCount: number
  partialCount: number
  ignoredCount: number
}

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function determineDepositStatus(totals: DepositAggregateTotals) {
  if (totals.totalItems === 0) return ReconciliationStatus.Pending
  const itemsReconciled = totals.matchedCount + totals.ignoredCount
  const itemsUnreconciled = totals.totalItems - itemsReconciled
  if (itemsUnreconciled === 0) return ReconciliationStatus.Completed
  if (itemsReconciled > 0 || totals.partialCount > 0) return ReconciliationStatus.InReview
  return ReconciliationStatus.Pending
}

export async function recomputeDepositAggregates(
  client: PrismaClientOrTx,
  depositId: string,
  tenantId: string,
) {
  const lineItems = await client.depositLineItem.findMany({
    where: { depositId, tenantId },
    select: {
      status: true,
      usage: true,
      usageAllocated: true,
      usageUnallocated: true,
      commission: true,
      commissionAllocated: true,
      commissionUnallocated: true,
    },
  })

  const totals = lineItems.reduce<DepositAggregateTotals>(
    (acc, line) => {
      const usage = toNumber(line.usage)
      const usageAllocated = toNumber(line.usageAllocated)
      const usageUnallocated = toNumber(line.usageUnallocated)
      const commission = toNumber(line.commission)
      const commissionAllocated = toNumber(line.commissionAllocated)
      const commissionUnallocated = toNumber(line.commissionUnallocated)

      acc.totalUsage += usage
      acc.usageAllocated += usageAllocated
      acc.usageUnallocated += usageUnallocated || Math.max(usage - usageAllocated, 0)

      acc.totalCommission += commission
      acc.commissionAllocated += commissionAllocated
      acc.commissionUnallocated += commissionUnallocated || Math.max(commission - commissionAllocated, 0)

      acc.totalItems += 1
      if (line.status === DepositLineItemStatus.Matched) acc.matchedCount += 1
      else if (line.status === DepositLineItemStatus.PartiallyMatched) acc.partialCount += 1
      else if (line.status === DepositLineItemStatus.Ignored) acc.ignoredCount += 1

      return acc
    },
    {
      totalUsage: 0,
      usageAllocated: 0,
      usageUnallocated: 0,
      totalCommission: 0,
      commissionAllocated: 0,
      commissionUnallocated: 0,
      totalItems: 0,
      matchedCount: 0,
      partialCount: 0,
      ignoredCount: 0,
    },
  )

  const itemsReconciled = totals.matchedCount + totals.ignoredCount
  const itemsUnreconciled = totals.totalItems - itemsReconciled
  const status = determineDepositStatus(totals)

  const depositUpdate: Prisma.DepositUpdateInput = {
    totalItems: totals.totalItems,
    totalReconciledItems: itemsReconciled,
    itemsReconciled,
    itemsUnreconciled,
    totalUsage: totals.totalUsage,
    usageAllocated: totals.usageAllocated,
    usageUnallocated: totals.usageUnallocated,
    totalCommissions: totals.totalCommission,
    commissionAllocated: totals.commissionAllocated,
    commissionUnallocated: totals.commissionUnallocated,
    status,
  }

  await client.deposit.update({
    where: { id: depositId },
    data: depositUpdate,
  })

  return {
    status,
    itemsReconciled,
    itemsUnreconciled,
    totals: {
      usage: totals.totalUsage,
      usageAllocated: totals.usageAllocated,
      usageUnallocated: totals.usageUnallocated,
      commission: totals.totalCommission,
      commissionAllocated: totals.commissionAllocated,
      commissionUnallocated: totals.commissionUnallocated,
      totalItems: totals.totalItems,
    },
  }
}
