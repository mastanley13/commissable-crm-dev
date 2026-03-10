import { Prisma, PrismaClient } from "@prisma/client"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

export type UndoLogFieldValue = {
  previousValue: unknown
  nextValue: unknown
}

export type UndoLogFieldMap = Record<string, UndoLogFieldValue>

type FieldUpdateUndoPayload = {
  kind: "field_update"
  relatedRevenueScheduleIds?: string[]
  fields: UndoLogFieldMap
}

type CreatedEntityUndoPayload = {
  kind: "created_entity"
  relatedRevenueScheduleIds?: string[]
  deleteStrategy: "soft_delete"
  relatedOpportunityProductIds?: string[]
  resolveFlexReviewItem?: boolean
}

export type UndoLogPayload = FieldUpdateUndoPayload | CreatedEntityUndoPayload

export type ReconciliationUndoLogRecord = {
  id: string
  tenantId: string
  depositId: string
  depositLineItemId: string
  entryType: string
  targetEntityName: string
  targetEntityId: string
  payload: UndoLogPayload
  createdById: string | null
  reversedAt: Date | null
  reversedByUserId: string | null
  createdAt: Date
  updatedAt: Date
}

function sanitizeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeIdList(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)))
}

function isSameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(sanitizeJson(left)) === JSON.stringify(sanitizeJson(right))
}

export async function recordFieldUndoLog(
  client: PrismaClientOrTx,
  {
    tenantId,
    depositId,
    depositLineItemId,
    targetEntityName,
    targetEntityId,
    fields,
    relatedRevenueScheduleIds = [],
    createdById,
  }: {
    tenantId: string
    depositId: string
    depositLineItemId: string
    targetEntityName: string
    targetEntityId: string
    fields: UndoLogFieldMap
    relatedRevenueScheduleIds?: Array<string | null | undefined>
    createdById?: string | null
  },
) {
  const changedEntries = Object.entries(fields).filter(([, value]) => !isSameValue(value.previousValue, value.nextValue))
  if (changedEntries.length === 0) return null

  return (client as any).reconciliationUndoLog.create({
    data: {
      tenantId,
      depositId,
      depositLineItemId,
      entryType: "FieldUpdate",
      targetEntityName,
      targetEntityId,
      payload: sanitizeJson<UndoLogPayload>({
        kind: "field_update",
        relatedRevenueScheduleIds: normalizeIdList(relatedRevenueScheduleIds),
        fields: Object.fromEntries(changedEntries),
      }),
      createdById: createdById ?? null,
    },
    select: { id: true },
  })
}

export async function recordCreatedEntityUndoLog(
  client: PrismaClientOrTx,
  {
    tenantId,
    depositId,
    depositLineItemId,
    targetEntityName,
    targetEntityId,
    deleteStrategy = "soft_delete",
    relatedRevenueScheduleIds = [],
    relatedOpportunityProductIds = [],
    resolveFlexReviewItem = false,
    createdById,
  }: {
    tenantId: string
    depositId: string
    depositLineItemId: string
    targetEntityName: string
    targetEntityId: string
    deleteStrategy?: "soft_delete"
    relatedRevenueScheduleIds?: Array<string | null | undefined>
    relatedOpportunityProductIds?: Array<string | null | undefined>
    resolveFlexReviewItem?: boolean
    createdById?: string | null
  },
) {
  return (client as any).reconciliationUndoLog.create({
    data: {
      tenantId,
      depositId,
      depositLineItemId,
      entryType: "CreatedEntity",
      targetEntityName,
      targetEntityId,
      payload: sanitizeJson<UndoLogPayload>({
        kind: "created_entity",
        deleteStrategy,
        relatedRevenueScheduleIds: normalizeIdList(relatedRevenueScheduleIds),
        relatedOpportunityProductIds: normalizeIdList(relatedOpportunityProductIds),
        resolveFlexReviewItem,
      }),
      createdById: createdById ?? null,
    },
    select: { id: true },
  })
}

export async function listOpenUndoLogs(
  client: PrismaClientOrTx,
  {
    tenantId,
    depositLineItemIds,
  }: {
    tenantId: string
    depositLineItemIds: string[]
  },
) {
  if (depositLineItemIds.length === 0) return [] as any[]
  return (client as any).reconciliationUndoLog.findMany({
    where: {
      tenantId,
      depositLineItemId: { in: depositLineItemIds },
      reversedAt: null,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  }) as Promise<ReconciliationUndoLogRecord[]>
}

export function filterUndoLogsByScheduleIds<T extends ReconciliationUndoLogRecord>(
  entries: T[],
  scheduleIds?: string[] | null,
): T[] {
  const normalized = normalizeIdList(scheduleIds ?? [])
  if (normalized.length === 0) return entries
  const selected = new Set(normalized)

  return entries.filter(entry => {
    if (selected.has(entry.targetEntityId)) return true
    const payload = (entry.payload ?? null) as UndoLogPayload | null
    const relatedIds = Array.isArray(payload?.relatedRevenueScheduleIds)
      ? payload.relatedRevenueScheduleIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : []
    return relatedIds.some(id => selected.has(id))
  })
}

async function applyFieldRollback(
  client: PrismaClientOrTx,
  entry: {
    tenantId: string
    targetEntityName: string
    targetEntityId: string
    payload: UndoLogPayload
  },
) {
  const payload = entry.payload
  if (payload.kind !== "field_update") return

  const rollbackData = Object.fromEntries(
    Object.entries(payload.fields).map(([field, value]) => [field, (value as UndoLogFieldValue).previousValue]),
  )

  if (entry.targetEntityName === "RevenueSchedule") {
    await (client as any).revenueSchedule.updateMany({
      where: { tenantId: entry.tenantId, id: entry.targetEntityId },
      data: rollbackData,
    })
    return
  }

  if (entry.targetEntityName === "Opportunity") {
    await (client as any).opportunity.updateMany({
      where: { tenantId: entry.tenantId, id: entry.targetEntityId },
      data: rollbackData,
    })
    return
  }

  if (entry.targetEntityName === "Product") {
    await (client as any).product.updateMany({
      where: { tenantId: entry.tenantId, id: entry.targetEntityId },
      data: rollbackData,
    })
    return
  }

  if (entry.targetEntityName === "DepositLineItem") {
    await (client as any).depositLineItem.updateMany({
      where: { tenantId: entry.tenantId, id: entry.targetEntityId },
      data: rollbackData,
    })
  }
}

async function applyCreatedEntityRollback(
  client: PrismaClientOrTx,
  entry: {
    tenantId: string
    targetEntityName: string
    targetEntityId: string
    payload: UndoLogPayload
  },
) {
  const payload = entry.payload
  if (payload.kind !== "created_entity") return

  if (entry.targetEntityName === "RevenueSchedule" && payload.deleteStrategy === "soft_delete") {
    await (client as any).revenueSchedule.updateMany({
      where: { tenantId: entry.tenantId, id: entry.targetEntityId, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    const opportunityProductIds = normalizeIdList(payload.relatedOpportunityProductIds ?? [])
    if (opportunityProductIds.length > 0) {
      await (client as any).opportunityProduct.updateMany({
        where: { tenantId: entry.tenantId, id: { in: opportunityProductIds } },
        data: { active: false },
      })
    }

    if (payload.resolveFlexReviewItem) {
      await (client as any).flexReviewItem.updateMany({
        where: {
          tenantId: entry.tenantId,
          revenueScheduleId: entry.targetEntityId,
          status: "Open",
        },
        data: {
          status: "Resolved",
          resolvedAt: new Date(),
        },
      })
    }
  }
}

export async function applyUndoLogRollback(
  client: PrismaClientOrTx,
  entry: {
    tenantId: string
    targetEntityName: string
    targetEntityId: string
    payload: unknown
  },
) {
  const payload = (entry.payload ?? null) as UndoLogPayload | null
  if (!payload) return

  if (payload.kind === "field_update") {
    await applyFieldRollback(client, { ...entry, payload })
    return
  }

  if (payload.kind === "created_entity") {
    await applyCreatedEntityRollback(client, { ...entry, payload })
  }
}

export async function markUndoLogsReversed(
  client: PrismaClientOrTx,
  {
    undoLogIds,
    reversedByUserId,
  }: {
    undoLogIds: string[]
    reversedByUserId?: string | null
  },
) {
  const normalizedIds = normalizeIdList(undoLogIds)
  if (normalizedIds.length === 0) return

  await (client as any).reconciliationUndoLog.updateMany({
    where: { id: { in: normalizedIds }, reversedAt: null },
    data: {
      reversedAt: new Date(),
      reversedByUserId: reversedByUserId ?? null,
    },
  })
}
