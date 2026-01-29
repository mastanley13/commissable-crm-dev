import { NextRequest, NextResponse } from "next/server"
import { AuditAction, RevenueScheduleBillingStatus, RevenueScheduleBillingStatusSource } from "@prisma/client"
import { withPermissions } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { recomputeRevenueScheduleFromMatches } from "@/lib/matching/revenue-schedule-status"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import { logRevenueScheduleAudit } from "@/lib/audit"

type SettlementAction = "AcceptActual" | "WriteOff"

interface SettlementRequestBody {
  action: SettlementAction
  reason?: string
}

export async function POST(request: NextRequest, { params }: { params: { revenueScheduleId: string } }) {
  return withPermissions(request, ["revenue-schedules.manage"], async req => {
    const revenueScheduleId = params?.revenueScheduleId?.trim()
    const tenantId = req.user.tenantId
    if (!revenueScheduleId) {
      return NextResponse.json({ error: "Revenue schedule id is required" }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as SettlementRequestBody | null
    const action = body?.action
    if (action !== "AcceptActual" && action !== "WriteOff") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const reasonText = typeof body?.reason === "string" ? body.reason.trim() : ""
    const varianceTolerance = await getTenantVarianceTolerance(tenantId)

    try {
      const result = await prisma.$transaction(async tx => {
        const existing = await tx.revenueSchedule.findFirst({
          where: { tenantId, id: revenueScheduleId, deletedAt: null },
          select: {
            id: true,
            expectedUsage: true,
            usageAdjustment: true,
            expectedCommission: true,
            actualUsageAdjustment: true,
            actualCommissionAdjustment: true,
            status: true,
            billingStatus: true,
            billingStatusSource: true,
          },
        })
        if (!existing) {
          throw new Error("Revenue schedule not found")
        }
        if (existing.billingStatus !== RevenueScheduleBillingStatus.InDispute) {
          throw new Error("Only In Dispute schedules can be settled")
        }

        const before = {
          expectedUsage: existing.expectedUsage,
          usageAdjustment: existing.usageAdjustment,
          expectedCommission: existing.expectedCommission,
          status: existing.status,
          billingStatus: existing.billingStatus,
          billingStatusSource: existing.billingStatusSource,
        }

        const recomputeBefore = await recomputeRevenueScheduleFromMatches(tx, revenueScheduleId, tenantId, {
          varianceTolerance,
        })

        if (recomputeBefore.matchCount === 0) {
          throw new Error("Cannot settle a schedule with no applied matches")
        }

        const actualUsageNet = recomputeBefore.actualUsageNet
        const actualCommissionNet = recomputeBefore.actualCommissionNet

        await tx.revenueSchedule.update({
          where: { id: revenueScheduleId },
          data: {
            expectedUsage: actualUsageNet,
            usageAdjustment: 0,
            expectedCommission: actualCommissionNet,
            updatedById: req.user.id,
            billingStatusSource: RevenueScheduleBillingStatusSource.Settlement,
            billingStatusUpdatedById: req.user.id,
            billingStatusUpdatedAt: new Date(),
            billingStatusReason: reasonText || `Settlement:${action}`,
          },
          select: { id: true },
        })

        const recomputeAfter = await recomputeRevenueScheduleFromMatches(tx, revenueScheduleId, tenantId, {
          varianceTolerance,
        })

        const unreconciledAppliedMatchCount = await tx.depositLineMatch.count({
          where: {
            tenantId,
            revenueScheduleId,
            status: "Applied",
            reconciled: false,
          },
        })
        const isFinalized = unreconciledAppliedMatchCount === 0

        const nextBillingStatus =
          isFinalized && recomputeAfter.schedule.status === "Reconciled"
            ? RevenueScheduleBillingStatus.Reconciled
            : RevenueScheduleBillingStatus.Open

        const updated = await tx.revenueSchedule.update({
          where: { id: revenueScheduleId },
          data: {
            billingStatus: nextBillingStatus,
            billingStatusSource: RevenueScheduleBillingStatusSource.Settlement,
            billingStatusUpdatedById: req.user.id,
            billingStatusUpdatedAt: new Date(),
            billingStatusReason: reasonText || `Settlement:${action}`,
            updatedById: req.user.id,
          },
          select: {
            id: true,
            expectedUsage: true,
            usageAdjustment: true,
            expectedCommission: true,
            status: true,
            billingStatus: true,
            billingStatusSource: true,
          },
        })

        return {
          before,
          after: updated,
          recompute: recomputeAfter,
          isFinalized,
          settlementAction: action,
        }
      })

      await logRevenueScheduleAudit(
        AuditAction.Update,
        revenueScheduleId,
        req.user.id,
        tenantId,
        request,
        result.before,
        {
          action: "BillingStatusSettlement",
          settlementAction: result.settlementAction,
          expectedUsage: result.after.expectedUsage,
          usageAdjustment: result.after.usageAdjustment,
          expectedCommission: result.after.expectedCommission,
          status: result.after.status,
          billingStatus: result.after.billingStatus,
          billingStatusSource: result.after.billingStatusSource,
          isFinalized: result.isFinalized,
        },
      )

      return NextResponse.json({
        data: {
          revenueScheduleId: result.after.id,
          billingStatus: result.after.billingStatus,
          billingStatusSource: result.after.billingStatusSource,
          scheduleStatus: result.after.status,
          isFinalized: result.isFinalized,
          recompute: result.recompute,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to settle schedule"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  })
}

