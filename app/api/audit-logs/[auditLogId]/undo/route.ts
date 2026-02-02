import { NextRequest, NextResponse } from "next/server"
import { getPrisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"
import { getClientIP, getUserAgent } from "@/lib/audit"
import {
  undoAutoFillAuditLog,
  UndoAutoFillConflictError,
  UndoAutoFillEntityNotFoundError,
  UndoAutoFillNotUndoableError,
} from "@/lib/audit/undo-auto-fill"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UNDO_PERMISSIONS = ["auditLogs.manage"]

export async function POST(request: NextRequest, { params }: { params: { auditLogId: string } }) {
  return withPermissions(request, UNDO_PERMISSIONS, async req => {
    const auditLogId = params?.auditLogId?.trim()
    if (!auditLogId) {
      return NextResponse.json({ error: "auditLogId is required" }, { status: 400 })
    }

    const client = await getPrisma()
    const tenantId = req.user.tenantId

    const ipAddress = getClientIP(request)
    const userAgent = getUserAgent(request)

    try {
      await client.$transaction(async tx => {
        await undoAutoFillAuditLog(tx, {
          auditLogId,
          tenantId,
          userId: req.user.id,
          ipAddress,
          userAgent,
        })
      })
    } catch (error: any) {
      if (error instanceof UndoAutoFillEntityNotFoundError) {
        return NextResponse.json({ error: "Target entity no longer exists" }, { status: 404 })
      }
      if (error instanceof UndoAutoFillConflictError) {
        return NextResponse.json(
          { error: "Cannot undo: field has changed since auto-fill", field: error.field },
          { status: 409 },
        )
      }
      if (error instanceof UndoAutoFillNotUndoableError) {
        const status = error.message === "Audit log not found" ? 404 : 400
        return NextResponse.json({ error: error.message }, { status })
      }

      console.error("Failed to undo auto-fill audit entry", error)
      return NextResponse.json({ error: "Failed to undo audit entry" }, { status: 500 })
    }

    return NextResponse.json({ data: { ok: true } })
  })
}
