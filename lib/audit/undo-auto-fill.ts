import { AuditAction, Prisma } from "@prisma/client"
import { getChangedFields } from "@/lib/audit"

type Tx = Prisma.TransactionClient

const ALLOWED_FIELDS_BY_ENTITY: Record<string, Set<string>> = {
  Opportunity: new Set(["accountIdVendor", "customerIdVendor", "orderIdVendor"]),
  Product: new Set(["productNameVendor", "partNumberVendor"]),
}

export class UndoAutoFillConflictError extends Error {
  code = "UNDO_CONFLICT" as const
  field: string

  constructor(field: string) {
    super("UndoConflict")
    this.field = field
  }
}

export class UndoAutoFillEntityNotFoundError extends Error {
  code = "ENTITY_NOT_FOUND" as const

  constructor() {
    super("EntityNotFound")
  }
}

export class UndoAutoFillNotUndoableError extends Error {
  code = "NOT_UNDOABLE" as const

  constructor(message: string) {
    super(message)
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseJsonField(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

function areEqual(a: unknown, b: unknown) {
  if (a === b) return true
  if (a == null && b == null) return true
  return false
}

export async function undoAutoFillAuditLog(
  tx: Tx,
  params: {
    auditLogId: string
    tenantId: string
    userId: string
    ipAddress?: string
    userAgent?: string
  },
) {
  const log = await tx.auditLog.findFirst({
    where: { id: params.auditLogId, tenantId: params.tenantId },
    select: {
      id: true,
      entityName: true,
      entityId: true,
      previousValues: true,
      newValues: true,
      metadata: true,
    },
  })

  if (!log) {
    throw new UndoAutoFillNotUndoableError("Audit log not found")
  }

  const metadata = parseJsonField(log.metadata)
  if (!isPlainObject(metadata) || metadata.action !== "AutoFillFromDepositMatch") {
    throw new UndoAutoFillNotUndoableError("This audit entry is not undoable")
  }

  const allowedFields = ALLOWED_FIELDS_BY_ENTITY[log.entityName] ?? null
  if (!allowedFields) {
    throw new UndoAutoFillNotUndoableError("Undo not supported for this entity type")
  }

  const previousValues = parseJsonField(log.previousValues)
  const newValues = parseJsonField(log.newValues)
  if (!isPlainObject(previousValues) || !isPlainObject(newValues)) {
    throw new UndoAutoFillNotUndoableError("Audit entry is missing previous/new values")
  }

  const fieldsToUndo = Object.keys(newValues).filter(key => allowedFields.has(key))
  if (fieldsToUndo.length === 0) {
    throw new UndoAutoFillNotUndoableError("Audit entry does not contain undoable fields")
  }

  if (log.entityName === "Opportunity") {
    const current = await tx.opportunity.findFirst({
      where: { id: log.entityId, tenantId: params.tenantId },
      select: Object.fromEntries(fieldsToUndo.map(key => [key, true])) as any,
    })
    if (!current) throw new UndoAutoFillEntityNotFoundError()

    for (const field of fieldsToUndo) {
      if (!areEqual((current as any)[field], newValues[field])) {
        throw new UndoAutoFillConflictError(field)
      }
    }

    const nextData: Record<string, unknown> = {}
    const prevSnapshot: Record<string, unknown> = {}
    const nextSnapshot: Record<string, unknown> = {}

    for (const field of fieldsToUndo) {
      prevSnapshot[field] = (current as any)[field] ?? null
      nextData[field] = previousValues[field] ?? null
    }

    const updated = await tx.opportunity.update({
      where: { id: log.entityId },
      data: nextData,
      select: Object.fromEntries(fieldsToUndo.map(key => [key, true])) as any,
    })

    for (const field of fieldsToUndo) {
      nextSnapshot[field] = (updated as any)[field] ?? null
    }

    const changedFields = getChangedFields(prevSnapshot, nextSnapshot)
    await tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: AuditAction.Update,
        entityName: log.entityName,
        entityId: log.entityId,
        changedFields,
        previousValues: prevSnapshot,
        newValues: nextSnapshot,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: {
          action: "UndoAutoFillFromDepositMatch",
          undoAuditLogId: params.auditLogId,
        },
      },
      select: { id: true },
    })

    return { ok: true as const }
  }

  if (log.entityName === "Product") {
    const current = await tx.product.findFirst({
      where: { id: log.entityId, tenantId: params.tenantId },
      select: Object.fromEntries(fieldsToUndo.map(key => [key, true])) as any,
    })
    if (!current) throw new UndoAutoFillEntityNotFoundError()

    for (const field of fieldsToUndo) {
      if (!areEqual((current as any)[field], newValues[field])) {
        throw new UndoAutoFillConflictError(field)
      }
    }

    const nextData: Record<string, unknown> = {}
    const prevSnapshot: Record<string, unknown> = {}
    const nextSnapshot: Record<string, unknown> = {}

    for (const field of fieldsToUndo) {
      prevSnapshot[field] = (current as any)[field] ?? null
      nextData[field] = previousValues[field] ?? null
    }

    const updated = await tx.product.update({
      where: { id: log.entityId },
      data: nextData as any,
      select: Object.fromEntries(fieldsToUndo.map(key => [key, true])) as any,
    })

    for (const field of fieldsToUndo) {
      nextSnapshot[field] = (updated as any)[field] ?? null
    }

    const changedFields = getChangedFields(prevSnapshot, nextSnapshot)
    await tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: AuditAction.Update,
        entityName: log.entityName,
        entityId: log.entityId,
        changedFields,
        previousValues: prevSnapshot,
        newValues: nextSnapshot,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: {
          action: "UndoAutoFillFromDepositMatch",
          undoAuditLogId: params.auditLogId,
        },
      },
      select: { id: true },
    })

    return { ok: true as const }
  }

  throw new UndoAutoFillNotUndoableError("Undo not supported for this entity type")
}

