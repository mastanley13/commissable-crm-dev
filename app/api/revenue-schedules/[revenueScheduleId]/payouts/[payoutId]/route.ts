import { NextRequest, NextResponse } from "next/server"
import { CommissionPayoutSplitType, CommissionPayoutStatus } from "@prisma/client"

import { prisma } from "@/lib/db"
import { withPermissions } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseCurrencyInput(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, "")
  const numeric = Number(cleaned)
  return Number.isFinite(numeric) ? numeric : null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { revenueScheduleId: string; payoutId: string } }
) {
  return withPermissions(request, ["revenue-schedules.manage"], async (req) => {
    try {
      const { revenueScheduleId, payoutId } = params
      if (!revenueScheduleId || !payoutId) {
        return NextResponse.json({ error: "Revenue schedule id and payout id are required" }, { status: 400 })
      }

      const tenantId = req.user.tenantId
      const payload = await request.json().catch(() => ({}))

      const errors: Record<string, string> = {}
      const data: Record<string, any> = { updatedById: req.user.id }

      if (typeof (payload as any)?.status === "string") {
        const raw = (payload as any).status
        if (Object.values(CommissionPayoutStatus).includes(raw)) {
          data.status = raw
        } else {
          errors.status = "Invalid status."
        }
      }

      if (typeof (payload as any)?.splitType === "string") {
        const raw = (payload as any).splitType
        if (Object.values(CommissionPayoutSplitType).includes(raw)) {
          data.splitType = raw
        } else {
          errors.splitType = "Invalid split type."
        }
      }

      if ((payload as any)?.amount !== undefined) {
        const raw = (payload as any).amount
        const text =
          typeof raw === "number" && Number.isFinite(raw) ? String(raw) : typeof raw === "string" ? raw.trim() : ""
        const parsed = text ? parseCurrencyInput(text) : null
        if (parsed === null) {
          errors.amount = "Enter a valid amount."
        } else if (parsed <= 0) {
          errors.amount = "Amount must be greater than 0."
        } else {
          data.amount = parsed
        }
      }

      if (typeof (payload as any)?.paidAt === "string") {
        const text = (payload as any).paidAt.trim()
        const parsed = text ? new Date(text) : null
        if (!parsed || Number.isNaN(parsed.getTime())) {
          errors.paidAt = "Enter a valid payment date."
        } else {
          data.paidAt = parsed
        }
      }

      if (typeof (payload as any)?.reference === "string") {
        data.reference = (payload as any).reference.trim() || null
      }

      if (typeof (payload as any)?.notes === "string") {
        data.notes = (payload as any).notes.trim() || null
      }

      if (Object.keys(errors).length > 0) {
        return NextResponse.json({ error: "Invalid input", errors }, { status: 400 })
      }

      const updated = await prisma.commissionPayout.updateMany({
        where: { id: payoutId, tenantId, revenueScheduleId },
        data
      })

      if (!updated.count) {
        return NextResponse.json({ error: "Payout not found" }, { status: 404 })
      }

      return NextResponse.json({ data: { ok: true } })
    } catch (error) {
      console.error("Failed to update payout", error)
      return NextResponse.json({ error: "Failed to update payout" }, { status: 500 })
    }
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { revenueScheduleId: string; payoutId: string } }
) {
  return withPermissions(request, ["revenue-schedules.manage"], async (req) => {
    try {
      const { revenueScheduleId, payoutId } = params
      if (!revenueScheduleId || !payoutId) {
        return NextResponse.json({ error: "Revenue schedule id and payout id are required" }, { status: 400 })
      }

      const tenantId = req.user.tenantId

      const updated = await prisma.commissionPayout.updateMany({
        where: { id: payoutId, tenantId, revenueScheduleId },
        data: { status: CommissionPayoutStatus.Voided, updatedById: req.user.id }
      })

      if (!updated.count) {
        return NextResponse.json({ error: "Payout not found" }, { status: 404 })
      }

      return NextResponse.json({ data: { ok: true } })
    } catch (error) {
      console.error("Failed to void payout", error)
      return NextResponse.json({ error: "Failed to void payout" }, { status: 500 })
    }
  })
}

