import { NextRequest, NextResponse } from "next/server"
import { AuditAction, CommissionPayoutSplitType, CommissionPayoutStatus } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withAuth, withPermissions } from "@/lib/api-auth"
import { logRevenueScheduleAudit } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseCurrencyInput(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, "")
  const numeric = Number(cleaned)
  return Number.isFinite(numeric) ? numeric : null
}

export async function GET(request: NextRequest, { params }: { params: { revenueScheduleId: string } }) {
  return withAuth(request, async (req) => {
    try {
      const { revenueScheduleId } = params
      if (!revenueScheduleId) {
        return NextResponse.json({ error: "Revenue schedule id is required" }, { status: 400 })
      }

      const tenantId = req.user.tenantId

      const payouts = await prisma.commissionPayout.findMany({
        where: { tenantId, revenueScheduleId },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }]
      })

      const data = payouts.map(payout => ({
        id: payout.id,
        splitType: payout.splitType,
        status: payout.status,
        amount: Number(payout.amount),
        paidAt: payout.paidAt.toISOString(),
        reference: payout.reference ?? null,
        notes: payout.notes ?? null,
        createdAt: payout.createdAt.toISOString()
      }))

      return NextResponse.json({ data })
    } catch (error) {
      console.error("Failed to load payouts", error)
      return NextResponse.json({ error: "Failed to load payouts" }, { status: 500 })
    }
  })
}

export async function POST(request: NextRequest, { params }: { params: { revenueScheduleId: string } }) {
  return withPermissions(request, ["revenue-schedules.manage"], async (req) => {
    try {
      const { revenueScheduleId } = params
      if (!revenueScheduleId) {
        return NextResponse.json({ error: "Revenue schedule id is required" }, { status: 400 })
      }

      const payload = await request.json().catch(() => ({}))
      const tenantId = req.user.tenantId

      const errors: Record<string, string> = {}

      const splitTypeRaw = (payload as any)?.splitType
      const splitType = Object.values(CommissionPayoutSplitType).includes(splitTypeRaw)
        ? (splitTypeRaw as CommissionPayoutSplitType)
        : null
      if (!splitType) {
        errors.splitType = "Split type is required."
      }

      const amountRaw = (payload as any)?.amount
      const amountText =
        typeof amountRaw === "number" && Number.isFinite(amountRaw) ? String(amountRaw) : typeof amountRaw === "string" ? amountRaw : ""
      const amount = amountText ? parseCurrencyInput(amountText) : null
      if (amount === null) {
        errors.amount = "Enter a valid amount."
      } else if (amount <= 0) {
        errors.amount = "Amount must be greater than 0."
      }

      const paidAtRaw = (payload as any)?.paidAt
      const paidAtText = typeof paidAtRaw === "string" ? paidAtRaw.trim() : ""
      const paidAt = paidAtText ? new Date(paidAtText) : null
      if (!paidAt || Number.isNaN(paidAt.getTime())) {
        errors.paidAt = "Enter a valid payment date."
      }

      if (Object.keys(errors).length > 0) {
        return NextResponse.json({ error: "Invalid input", errors }, { status: 400 })
      }

      const exists = await prisma.revenueSchedule.findFirst({
        where: { id: revenueScheduleId, tenantId },
        select: { id: true }
      })
      if (!exists) {
        return NextResponse.json({ error: "Revenue schedule not found" }, { status: 404 })
      }

      const created = await prisma.commissionPayout.create({
        data: {
          tenantId,
          revenueScheduleId,
          splitType: splitType as CommissionPayoutSplitType,
          status: CommissionPayoutStatus.Posted,
          amount: amount as number,
          paidAt: paidAt as Date,
          reference: typeof (payload as any)?.reference === "string" ? (payload as any).reference.trim() || null : null,
          notes: typeof (payload as any)?.notes === "string" ? (payload as any).notes.trim() || null : null,
          createdById: req.user.id,
          updatedById: req.user.id
        }
      })

      await logRevenueScheduleAudit(
        AuditAction.Update,
        revenueScheduleId,
        req.user.id,
        tenantId,
        request,
        {},
        {
          action: "RecordPayment",
          payoutId: created.id,
          splitType: created.splitType,
          status: created.status,
          amount: Number(created.amount),
          paidAt: created.paidAt.toISOString(),
          reference: created.reference ?? null,
          notes: created.notes ?? null,
        },
      )

      return NextResponse.json({
        data: {
          id: created.id,
          splitType: created.splitType,
          status: created.status,
          amount: Number(created.amount),
          paidAt: created.paidAt.toISOString(),
          reference: created.reference ?? null,
          notes: created.notes ?? null,
          createdAt: created.createdAt.toISOString()
        }
      })
    } catch (error) {
      console.error("Failed to create payout", error)
      return NextResponse.json({ error: "Failed to record payment" }, { status: 500 })
    }
  })
}
