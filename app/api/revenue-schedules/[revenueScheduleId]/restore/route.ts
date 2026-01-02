import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { AuditAction } from "@prisma/client"
import { logRevenueScheduleAudit } from "@/lib/audit"
import { hasPermission } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: { revenueScheduleId: string } }
) {
  return withAuth(request, async (req) => {
    const { revenueScheduleId } = params
    if (!revenueScheduleId) {
      return NextResponse.json({ error: "Revenue schedule id is required" }, { status: 400 })
    }

    const roleCode = (req.user.role?.code ?? "").toLowerCase()
    const isAdmin = roleCode === "admin"
    const isAccounting = roleCode === "accounting"
    const canManage = hasPermission(req.user, "revenue-schedules.manage")
    if (!isAdmin && !isAccounting && !canManage) {
      return NextResponse.json(
        { error: "Insufficient permissions to restore revenue schedules" },
        { status: 403 }
      )
    }

    const tenantId = req.user.tenantId
    const schedule = await prisma.revenueSchedule.findFirst({
      where: { id: revenueScheduleId, tenantId },
      select: { id: true, deletedAt: true }
    })

    if (!schedule) {
      return NextResponse.json({ error: "Revenue schedule not found" }, { status: 404 })
    }

    if (!schedule.deletedAt) {
      return NextResponse.json({ success: true })
    }

    await prisma.revenueSchedule.update({
      where: { id: revenueScheduleId },
      data: {
        deletedAt: null,
        updatedById: req.user.id
      }
    })

    await logRevenueScheduleAudit(
      AuditAction.Update,
      revenueScheduleId,
      req.user.id,
      tenantId,
      request,
      { deletedAt: schedule.deletedAt },
      { deletedAt: null }
    )

    return NextResponse.json({ success: true })
  })
}

