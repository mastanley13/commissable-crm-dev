import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"
import { getPrisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { getChangedFields, getClientIP, getUserAgent } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UNDO_PERMISSIONS = ["auditLogs.manage"]

const ALLOWED_FIELDS_BY_ENTITY: Record<string, Set<string>> = {
  Opportunity: new Set(["accountIdVendor", "customerIdVendor", "orderIdVendor"]),
  Product: new Set(["productNameVendor", "partNumberVendor"]),
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

export async function POST(request: NextRequest, { params }: { params: { auditLogId: string } }) {
  return withPermissions(request, UNDO_PERMISSIONS, async req => {
    const auditLogId = params?.auditLogId?.trim()
    if (!auditLogId) {
      return NextResponse.json({ error: "auditLogId is required" }, { status: 400 })
    }

    const client = await getPrisma()
    const tenantId = req.user.tenantId

    const log = await client.auditLog.findFirst({
      where: { id: auditLogId, tenantId },
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
      return NextResponse.json({ error: "Audit log not found" }, { status: 404 })
    }

    const metadata = parseJsonField(log.metadata)
    if (!isPlainObject(metadata) || metadata.action !== "AutoFillFromDepositMatch") {
      return NextResponse.json({ error: "This audit entry is not undoable" }, { status: 400 })
    }

    const allowedFields = ALLOWED_FIELDS_BY_ENTITY[log.entityName] ?? null
    if (!allowedFields) {
      return NextResponse.json({ error: "Undo not supported for this entity type" }, { status: 400 })
    }

    const previousValues = parseJsonField(log.previousValues)
    const newValues = parseJsonField(log.newValues)
    if (!isPlainObject(previousValues) || !isPlainObject(newValues)) {
      return NextResponse.json({ error: "Audit entry is missing previous/new values" }, { status: 400 })
    }

    const fieldsToUndo = Object.keys(newValues).filter(key => allowedFields.has(key))
    if (fieldsToUndo.length === 0) {
      return NextResponse.json({ error: "Audit entry does not contain undoable fields" }, { status: 400 })
    }

    const ipAddress = getClientIP(request)
    const userAgent = getUserAgent(request)

    try {
      await client.$transaction(async tx => {
        if (log.entityName === "Opportunity") {
          const current = await tx.opportunity.findFirst({
            where: { id: log.entityId, tenantId },
            select: Object.fromEntries(fieldsToUndo.map(key => [key, true])) as any,
          })
          if (!current) {
            throw Object.assign(new Error("EntityNotFound"), { code: "ENTITY_NOT_FOUND" })
          }

          for (const field of fieldsToUndo) {
            if (!areEqual((current as any)[field], newValues[field])) {
              throw Object.assign(new Error("UndoConflict"), { code: "UNDO_CONFLICT", field })
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
              tenantId,
              userId: req.user.id,
              action: AuditAction.Update,
              entityName: log.entityName,
              entityId: log.entityId,
              changedFields,
              previousValues: prevSnapshot,
              newValues: nextSnapshot,
              ipAddress,
              userAgent,
              metadata: {
                action: "UndoAutoFillFromDepositMatch",
                undoAuditLogId: auditLogId,
              },
            },
          })
          return
        }

        if (log.entityName === "Product") {
          const current = await tx.product.findFirst({
            where: { id: log.entityId, tenantId },
            select: Object.fromEntries(fieldsToUndo.map(key => [key, true])) as any,
          })
          if (!current) {
            throw Object.assign(new Error("EntityNotFound"), { code: "ENTITY_NOT_FOUND" })
          }

          for (const field of fieldsToUndo) {
            if (!areEqual((current as any)[field], newValues[field])) {
              throw Object.assign(new Error("UndoConflict"), { code: "UNDO_CONFLICT", field })
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
              tenantId,
              userId: req.user.id,
              action: AuditAction.Update,
              entityName: log.entityName,
              entityId: log.entityId,
              changedFields,
              previousValues: prevSnapshot,
              newValues: nextSnapshot,
              ipAddress,
              userAgent,
              metadata: {
                action: "UndoAutoFillFromDepositMatch",
                undoAuditLogId: auditLogId,
              },
            },
          })
          return
        }
      })
    } catch (error: any) {
      if (error?.code === "ENTITY_NOT_FOUND") {
        return NextResponse.json({ error: "Target entity no longer exists" }, { status: 404 })
      }
      if (error?.code === "UNDO_CONFLICT") {
        return NextResponse.json(
          { error: "Cannot undo: field has changed since auto-fill", field: error?.field ?? null },
          { status: 409 },
        )
      }

      console.error("Failed to undo auto-fill audit entry", error)
      return NextResponse.json({ error: "Failed to undo audit entry" }, { status: 500 })
    }

    return NextResponse.json({ data: { ok: true } })
  })
}
