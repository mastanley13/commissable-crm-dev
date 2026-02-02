import { NextRequest, NextResponse } from "next/server"
import {
  AuditAction,
  DepositLineMatchSource,
  DepositLineMatchStatus,
  DepositMatchGroupStatus,
  Prisma,
} from "@prisma/client"
import { withPermissions, createErrorResponse } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeDepositAggregates } from "@/lib/matching/deposit-aggregates"
import { recomputeDepositLineItemAllocations } from "@/lib/matching/deposit-line-allocations"
import { recomputeRevenueSchedules } from "@/lib/matching/revenue-schedule-status"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { getClientIP, getUserAgent, logAudit, logRevenueScheduleAudit } from "@/lib/audit"
import { logMatchingMetric } from "@/lib/matching/metrics"
import {
  undoAutoFillAuditLog,
  UndoAutoFillConflictError,
  UndoAutoFillEntityNotFoundError,
  UndoAutoFillNotUndoableError,
} from "@/lib/audit/undo-auto-fill"

type UndoRequestBody = {
  reason?: string | null
}

type ExistingMatchSnapshot = {
  id: string
  depositLineItemId: string
  revenueScheduleId: string
  usageAmount: number
  commissionAmount: number
  status: string
  source: string
  matchGroupId: string | null
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

function parseExistingMatchSnapshots(value: unknown): ExistingMatchSnapshot[] {
  if (!Array.isArray(value)) return []
  const out: ExistingMatchSnapshot[] = []
  for (const item of value) {
    if (!isPlainObject(item)) continue
    const id = typeof item.id === "string" ? item.id.trim() : ""
    const depositLineItemId = typeof item.depositLineItemId === "string" ? item.depositLineItemId.trim() : ""
    const revenueScheduleId = typeof item.revenueScheduleId === "string" ? item.revenueScheduleId.trim() : ""
    if (!id || !depositLineItemId || !revenueScheduleId) continue
    const usageAmount = Number(item.usageAmount ?? 0)
    const commissionAmount = Number(item.commissionAmount ?? 0)
    out.push({
      id,
      depositLineItemId,
      revenueScheduleId,
      usageAmount: Number.isFinite(usageAmount) ? usageAmount : 0,
      commissionAmount: Number.isFinite(commissionAmount) ? commissionAmount : 0,
      status: typeof item.status === "string" ? item.status : "",
      source: typeof item.source === "string" ? item.source : "",
      matchGroupId: typeof item.matchGroupId === "string" ? item.matchGroupId : null,
    })
  }
  return out
}

export async function POST(
  request: NextRequest,
  { params }: { params: { depositId: string; matchGroupId: string } },
) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const depositId = params?.depositId?.trim()
    const matchGroupId = params?.matchGroupId?.trim()
    const tenantId = req.user.tenantId

    if (!depositId || !matchGroupId) {
      return createErrorResponse("depositId and matchGroupId are required", 400)
    }

    const body = (await request.json().catch(() => null)) as UndoRequestBody | null
    const undoReason = body?.reason?.trim() || null

    const group = await prisma.depositMatchGroup.findFirst({
      where: { id: matchGroupId, tenantId, depositId },
      select: { id: true, status: true, createdAt: true },
    })
    if (!group) {
      return createErrorResponse("Match group not found", 404)
    }
    if (group.status === DepositMatchGroupStatus.Undone) {
      return createErrorResponse("Match group is already undone", 400)
    }

    const varianceTolerance = await getTenantVarianceTolerance(tenantId)
    const ipAddress = getClientIP(request)
    const userAgent = getUserAgent(request)

    const result = await prisma.$transaction(async tx => {
      const groupAuditLogs = await tx.auditLog.findMany({
        where: { tenantId, entityName: "DepositMatchGroup", entityId: matchGroupId },
        select: { id: true, metadata: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })

      let applyMetadata: Record<string, unknown> | null = null
      for (const row of groupAuditLogs) {
        const metadata = parseJsonField(row.metadata)
        if (isPlainObject(metadata) && metadata.action === "ApplyMatchGroup") {
          applyMetadata = metadata
          break
        }
      }

      const existingMatchesBefore = parseExistingMatchSnapshots((applyMetadata as any)?.existingMatchesBefore)
      const existingSnapshotByPairKey = new Map<string, ExistingMatchSnapshot>()
      for (const snapshot of existingMatchesBefore) {
        existingSnapshotByPairKey.set(`${snapshot.depositLineItemId}:${snapshot.revenueScheduleId}`, snapshot)
      }

      const autoFillAuditLogIdsFromApply = parseStringArray((applyMetadata as any)?.autoFillAuditLogIds)

      const matches = await tx.depositLineMatch.findMany({
        where: { tenantId, matchGroupId },
        select: { id: true, depositLineItemId: true, revenueScheduleId: true },
      })

      const matchIds = matches.map(match => match.id)
      const lineIds = Array.from(new Set(matches.map(match => match.depositLineItemId)))
      const scheduleIds = Array.from(new Set(matches.map(match => match.revenueScheduleId)))

      const schedulesBefore =
        scheduleIds.length > 0
          ? await tx.revenueSchedule.findMany({
              where: { tenantId, id: { in: scheduleIds } },
              select: { id: true, status: true, actualUsage: true, actualCommission: true },
            })
          : []

      const autoFillUndoResults: Array<{ auditLogId: string; ok: boolean; error?: string; field?: string | null }> = []

      const auditLogIdsToUndo: string[] = []

      if (autoFillAuditLogIdsFromApply.length > 0) {
        auditLogIdsToUndo.push(...autoFillAuditLogIdsFromApply)
      } else if (matchIds.length > 0) {
        const auditLogRows = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
            SELECT "id"
            FROM "AuditLog"
            WHERE "tenantId" = ${tenantId}
              AND "createdAt" >= ${group.createdAt}
              AND "metadata"->>'action' = 'AutoFillFromDepositMatch'
              AND "metadata"->>'depositId' = ${depositId}
              AND ("metadata"->>'depositLineMatchId') IN (${Prisma.join(matchIds)})
          `,
        )
        auditLogIdsToUndo.push(...auditLogRows.map(row => row.id))
      }

      for (const auditLogId of auditLogIdsToUndo) {
          try {
            await undoAutoFillAuditLog(tx, {
              auditLogId,
              tenantId,
              userId: req.user.id,
              ipAddress,
              userAgent,
            })
            autoFillUndoResults.push({ auditLogId, ok: true })
          } catch (error) {
            if (error instanceof UndoAutoFillConflictError) {
              autoFillUndoResults.push({ auditLogId, ok: false, error: "UNDO_CONFLICT", field: error.field })
              continue
            }
            if (error instanceof UndoAutoFillEntityNotFoundError) {
              autoFillUndoResults.push({ auditLogId, ok: false, error: "ENTITY_NOT_FOUND" })
              continue
            }
            if (error instanceof UndoAutoFillNotUndoableError) {
              autoFillUndoResults.push({ auditLogId, ok: false, error: error.message })
              continue
            }

            console.error("Failed to undo auto-fill audit entry during match group undo", error)
            autoFillUndoResults.push({ auditLogId, ok: false, error: "UNKNOWN_ERROR" })
          }
        }

      for (const match of matches) {
        const snapshot = existingSnapshotByPairKey.get(`${match.depositLineItemId}:${match.revenueScheduleId}`)
        if (!snapshot) continue

        const restoreData: Record<string, unknown> = {
          usageAmount: snapshot.usageAmount,
          commissionAmount: snapshot.commissionAmount,
          matchGroupId: snapshot.matchGroupId ?? null,
        }
        if (snapshot.status) {
          restoreData.status = snapshot.status as DepositLineMatchStatus
        }
        if (snapshot.source) {
          restoreData.source = snapshot.source as DepositLineMatchSource
        }

        await tx.depositLineMatch.update({
          where: { id: match.id },
          data: restoreData as any,
          select: { id: true },
        })
      }

      await tx.depositLineMatch.deleteMany({ where: { tenantId, matchGroupId } })

      await tx.depositMatchGroup.update({
        where: { id: matchGroupId },
        data: {
          status: DepositMatchGroupStatus.Undone,
          undoneAt: new Date(),
          undoneByUserId: req.user.id,
          undoReason: undoReason ?? undefined,
        },
        select: { id: true },
      })

      const recomputedLines = []
      for (const lineId of lineIds) {
        const updated = await recomputeDepositLineItemAllocations(tx, lineId, tenantId)
        recomputedLines.push(updated)
      }

      const recomputedSchedules = await recomputeRevenueSchedules(tx, scheduleIds, tenantId, {
        varianceTolerance,
      })

      const deposit = await recomputeDepositAggregates(tx, depositId, tenantId)

      return { deposit, lineIds, scheduleIds, lines: recomputedLines, schedules: recomputedSchedules, schedulesBefore, autoFillUndoResults }
    })

    await logMatchingMetric({
      tenantId,
      userId: req.user.id,
      event: "manual_match",
      depositId,
      request,
      metadata: {
        matchGroupId,
        action: "undo_match_group",
        lineCount: result.lineIds.length,
        scheduleCount: result.scheduleIds.length,
        autoFillUndoAttempted: (result.autoFillUndoResults ?? []).length,
        autoFillUndoSucceeded: (result.autoFillUndoResults ?? []).filter(row => row.ok).length,
      },
    })

    for (const scheduleResult of result.schedules ?? []) {
      const before = (result.schedulesBefore ?? []).find(row => row.id === scheduleResult.schedule.id)
      await logRevenueScheduleAudit(
        AuditAction.Update,
        scheduleResult.schedule.id,
        req.user.id,
        tenantId,
        request,
        {
          status: before?.status ?? null,
          actualUsage: before?.actualUsage ?? null,
          actualCommission: before?.actualCommission ?? null,
        },
        {
          action: "UndoMatchGroup",
          depositId,
          matchGroupId,
          status: scheduleResult.schedule.status,
          actualUsage: scheduleResult.schedule.actualUsage,
          actualCommission: scheduleResult.schedule.actualCommission,
          usageBalance: scheduleResult.usageBalance,
          commissionDifference: scheduleResult.commissionDifference,
          matchCount: scheduleResult.matchCount,
        },
      )
    }

    await logAudit({
      userId: req.user.id,
      tenantId,
      action: AuditAction.Update,
      entityName: "DepositMatchGroup",
      entityId: matchGroupId,
      ipAddress,
      userAgent,
      metadata: {
        action: "UndoMatchGroup",
        depositId,
        matchGroupId,
        reason: undoReason,
        autoFillUndoResults: result.autoFillUndoResults ?? [],
      },
    })

    const { schedulesBefore: _schedulesBefore, ...responseData } = result as any
    return NextResponse.json({ data: responseData })
  })
}
