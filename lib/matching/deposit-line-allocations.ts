import {
  DepositLineItemStatus,
  DepositLineMatchStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

const EPSILON = 0.005

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function isEffectivelyZero(value: number): boolean {
  return Math.abs(value) <= EPSILON
}

export interface DepositLineAllocationTotals {
  usage: number
  usageAllocated: number
  usageUnallocated: number
  commission: number
  commissionAllocated: number
  commissionUnallocated: number
}

export async function recomputeDepositLineItemAllocations(
  client: PrismaClientOrTx,
  depositLineItemId: string,
  tenantId: string,
) {
  const line = await client.depositLineItem.findFirst({
    where: { id: depositLineItemId, tenantId },
    select: {
      id: true,
      depositId: true,
      status: true,
      reconciled: true,
      usage: true,
      commission: true,
    },
  })

  if (!line) {
    throw new Error(`Deposit line item ${depositLineItemId} not found for tenant ${tenantId}`)
  }

  if (line.reconciled) {
    throw new Error("Reconciled line items cannot be changed")
  }

  if (line.status === DepositLineItemStatus.Ignored) {
    return {
      line: await client.depositLineItem.findFirst({
        where: { id: depositLineItemId, tenantId },
      }),
      totals: {
        usage: toNumber(line.usage),
        usageAllocated: 0,
        usageUnallocated: toNumber(line.usage),
        commission: toNumber(line.commission),
        commissionAllocated: 0,
        commissionUnallocated: toNumber(line.commission),
      } satisfies DepositLineAllocationTotals,
    }
  }

  const matches = await client.depositLineMatch.findMany({
    where: {
      tenantId,
      depositLineItemId,
      status: DepositLineMatchStatus.Applied,
    },
    select: {
      revenueScheduleId: true,
      usageAmount: true,
      commissionAmount: true,
    },
  })

  const usage = toNumber(line.usage)
  const commission = toNumber(line.commission)

  const usageAllocated = matches.reduce((acc, match) => acc + toNumber(match.usageAmount), 0)
  const commissionAllocated = matches.reduce((acc, match) => acc + toNumber(match.commissionAmount), 0)

  const usageRemaining = usage - usageAllocated
  const commissionRemaining = commission - commissionAllocated

  const hasMatches =
    matches.length > 0 &&
    matches.some(match => !isEffectivelyZero(toNumber(match.usageAmount)) || !isEffectivelyZero(toNumber(match.commissionAmount)))

  const fullyAllocated = isEffectivelyZero(usageRemaining) && isEffectivelyZero(commissionRemaining)

  const status = fullyAllocated
    ? DepositLineItemStatus.Matched
    : hasMatches
      ? DepositLineItemStatus.PartiallyMatched
      : DepositLineItemStatus.Unmatched

  const primaryRevenueScheduleId =
    matches.length === 0
      ? null
      : matches
          .map(match => ({
            id: match.revenueScheduleId,
            weight: Math.abs(toNumber(match.usageAmount)) + Math.abs(toNumber(match.commissionAmount)),
          }))
          .sort((a, b) => b.weight - a.weight)[0]?.id ?? null

  const usageUnallocated = Math.max(usage - usageAllocated, 0)
  const commissionUnallocated = Math.max(commission - commissionAllocated, 0)

  const updated = await client.depositLineItem.update({
    where: { id: depositLineItemId },
    data: {
      status,
      primaryRevenueScheduleId,
      usageAllocated,
      usageUnallocated,
      commissionAllocated,
      commissionUnallocated,
    },
  })

  return {
    line: updated,
    totals: {
      usage,
      usageAllocated,
      usageUnallocated,
      commission,
      commissionAllocated,
      commissionUnallocated,
    } satisfies DepositLineAllocationTotals,
  }
}

