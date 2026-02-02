import { NextRequest, NextResponse } from "next/server"
import { AuditAction, DepositLineMatchStatus } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { getClientIP, getUserAgent } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type BundleUndoBody = {
  reason?: string | null
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

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => (typeof item === "string" ? item.trim() : ""))
    .filter(item => item.length > 0)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { depositId: string; bundleAuditLogId: string } },
) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const depositId = params?.depositId?.trim()
    const auditLogId = params?.bundleAuditLogId?.trim()
    const tenantId = req.user.tenantId
    const ipAddress = getClientIP(request)
    const userAgent = getUserAgent(request)

    if (!depositId || !auditLogId) {
      return createErrorResponse("depositId and bundleAuditLogId are required", 400)
    }

    const body = (await request.json().catch(() => null)) as BundleUndoBody | null
    const reason = typeof body?.reason === "string" ? body.reason.trim() : null

    const log = await prisma.auditLog.findFirst({
      where: { id: auditLogId, tenantId, entityName: "Deposit", entityId: depositId },
      select: { id: true, metadata: true },
    })

    if (!log) {
      return createErrorResponse("Bundle operation not found", 404)
    }

    const metadata = parseJsonField(log.metadata)
    if (!isPlainObject(metadata) || metadata.action !== "BundleRipReplaceApply") {
      return createErrorResponse("This audit entry is not a bundle rip/replace operation", 400)
    }

    const createdRevenueScheduleIds = parseStringArray(metadata.createdRevenueScheduleIds)
    const replacedScheduleIds = parseStringArray(metadata.replacedScheduleIds)
    const createdOpportunityProductIds = parseStringArray(metadata.createdOpportunityProductIds)
    const createdProductIds = parseStringArray(metadata.createdProductIds)

    if (createdRevenueScheduleIds.length === 0) {
      return createErrorResponse("Bundle operation does not contain created schedules", 400)
    }

    try {
      const result = await prisma.$transaction(async tx => {
        const appliedMatchCount = await tx.depositLineMatch.count({
          where: {
            tenantId,
            revenueScheduleId: { in: createdRevenueScheduleIds },
            status: DepositLineMatchStatus.Applied,
          },
        })

        if (appliedMatchCount > 0) {
          return { ok: false as const, error: "Created schedules already have allocations and cannot be undone safely." }
        }

        await tx.revenueSchedule.updateMany({
          where: { tenantId, id: { in: createdRevenueScheduleIds } },
          data: { deletedAt: new Date(), updatedById: req.user.id },
        })

        if (replacedScheduleIds.length > 0) {
          await tx.revenueSchedule.updateMany({
            where: { tenantId, id: { in: replacedScheduleIds } },
            data: { deletedAt: null, updatedById: req.user.id },
          })
        }

        if (createdOpportunityProductIds.length > 0) {
          await (tx.opportunityProduct as any).updateMany({
            where: { tenantId, id: { in: createdOpportunityProductIds } },
            data: { active: false },
          })
        }

        if (createdProductIds.length > 0) {
          await tx.product.updateMany({
            where: { tenantId, id: { in: createdProductIds } },
            data: { isActive: false, updatedById: req.user.id },
          })
        }

        const undoAudit = await tx.auditLog.create({
          data: {
            tenantId,
            userId: req.user.id,
            action: AuditAction.Update,
            entityName: "Deposit",
            entityId: depositId,
            ipAddress,
            userAgent,
            metadata: {
              action: "BundleRipReplaceUndo",
              undoAuditLogId: auditLogId,
              depositId,
              reason,
              createdRevenueScheduleIds,
              replacedScheduleIds,
              createdOpportunityProductIds,
              createdProductIds,
            },
          },
          select: { id: true },
        })

        return { ok: true as const, undoAuditLogId: undoAudit.id }
      })

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 409 })
      }

      return NextResponse.json({ data: result })
    } catch (error) {
      console.error("Failed to undo bundle rip/replace operation", error)
      return NextResponse.json({ error: "Failed to undo bundle operation" }, { status: 500 })
    }
  })
}

