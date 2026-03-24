import { Prisma, PrismaClient } from "@prisma/client"
import { recordCreatedEntityUndoLog } from "@/lib/reconciliation/undo-log"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

const EPSILON = 0.005

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function isEffectivelyZero(value: number) {
  return Math.abs(value) <= EPSILON
}

export type RevenueScheduleAdjustmentSums = {
  usageAmount: number
  commissionAmount: number
}

export async function listRevenueScheduleAdjustmentSums(
  client: PrismaClientOrTx,
  {
    tenantId,
    revenueScheduleIds,
  }: {
    tenantId: string
    revenueScheduleIds: string[]
  },
) {
  const uniqueIds = Array.from(new Set(revenueScheduleIds.filter(Boolean)))
  const sums = new Map<string, RevenueScheduleAdjustmentSums>()
  if (uniqueIds.length === 0) return sums

  const rows = await (client as any).revenueScheduleAdjustment.groupBy({
    by: ["revenueScheduleId"],
    where: {
      tenantId,
      revenueScheduleId: { in: uniqueIds },
      reversedAt: null,
    },
    _sum: {
      usageAmount: true,
      commissionAmount: true,
    },
  })

  for (const row of rows as Array<any>) {
    sums.set(String(row.revenueScheduleId), {
      usageAmount: roundMoney(toNumber(row?._sum?.usageAmount)),
      commissionAmount: roundMoney(toNumber(row?._sum?.commissionAmount)),
    })
  }

  return sums
}

export async function getRevenueScheduleAdjustmentSums(
  client: PrismaClientOrTx,
  {
    tenantId,
    revenueScheduleId,
  }: {
    tenantId: string
    revenueScheduleId: string
  },
) {
  const sums = await listRevenueScheduleAdjustmentSums(client, {
    tenantId,
    revenueScheduleIds: [revenueScheduleId],
  })
  return sums.get(revenueScheduleId) ?? { usageAmount: 0, commissionAmount: 0 }
}

export async function createRevenueScheduleAdjustment(
  client: PrismaClientOrTx,
  {
    tenantId,
    revenueScheduleId,
    matchGroupId,
    sourceDepositId,
    sourceDepositLineItemId,
    adjustmentType,
    applicationScope,
    usageAmount,
    commissionAmount,
    effectiveScheduleDate,
    reason,
    createdById,
  }: {
    tenantId: string
    revenueScheduleId: string
    matchGroupId?: string | null
    sourceDepositId?: string | null
    sourceDepositLineItemId?: string | null
    adjustmentType: string
    applicationScope?: string | null
    usageAmount?: number | null
    commissionAmount?: number | null
    effectiveScheduleDate?: Date | null
    reason?: string | null
    createdById?: string | null
  },
) {
  const normalizedUsageAmount = roundMoney(toNumber(usageAmount))
  const normalizedCommissionAmount = roundMoney(toNumber(commissionAmount))

  if (isEffectivelyZero(normalizedUsageAmount) && isEffectivelyZero(normalizedCommissionAmount)) {
    return null
  }

  return (client as any).revenueScheduleAdjustment.create({
    data: {
      tenantId,
      revenueScheduleId,
      matchGroupId: matchGroupId ?? null,
      sourceDepositId: sourceDepositId ?? null,
      sourceDepositLineItemId: sourceDepositLineItemId ?? null,
      adjustmentType,
      applicationScope: applicationScope ?? null,
      usageAmount: normalizedUsageAmount,
      commissionAmount: normalizedCommissionAmount,
      effectiveScheduleDate: effectiveScheduleDate ?? null,
      reason: reason ?? null,
      createdById: createdById ?? null,
    },
    select: {
      id: true,
      revenueScheduleId: true,
      usageAmount: true,
      commissionAmount: true,
    },
  })
}

export async function createRevenueScheduleAdjustmentWithUndo(
  client: PrismaClientOrTx,
  {
    tenantId,
    depositId,
    depositLineItemId,
    userId,
    revenueScheduleId,
    matchGroupId,
    adjustmentType,
    applicationScope,
    usageAmount,
    commissionAmount,
    effectiveScheduleDate,
    reason,
    relatedRevenueScheduleIds = [],
  }: {
    tenantId: string
    depositId: string
    depositLineItemId: string
    userId: string
    revenueScheduleId: string
    matchGroupId?: string | null
    adjustmentType: string
    applicationScope?: string | null
    usageAmount?: number | null
    commissionAmount?: number | null
    effectiveScheduleDate?: Date | null
    reason?: string | null
    relatedRevenueScheduleIds?: Array<string | null | undefined>
  },
) {
  const created = await createRevenueScheduleAdjustment(client, {
    tenantId,
    revenueScheduleId,
    matchGroupId,
    sourceDepositId: depositId,
    sourceDepositLineItemId: depositLineItemId,
    adjustmentType,
    applicationScope,
    usageAmount,
    commissionAmount,
    effectiveScheduleDate,
    reason,
    createdById: userId,
  })

  if (!created) return null

  await recordCreatedEntityUndoLog(client, {
    tenantId,
    depositId,
    depositLineItemId,
    targetEntityName: "RevenueScheduleAdjustment",
    targetEntityId: created.id,
    deleteStrategy: "hard_delete",
    relatedRevenueScheduleIds: [revenueScheduleId, ...relatedRevenueScheduleIds],
    createdById: userId,
  })

  return created
}
