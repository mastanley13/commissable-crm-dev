import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { deleteReport, getReportById, updateReport } from "@/lib/reports-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: { reportId: string } }) {
  return withAuth(request, async () => {
    const report = getReportById(params.reportId)
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }
    return NextResponse.json({ data: report })
  })
}

export async function PATCH(request: NextRequest, { params }: { params: { reportId: string } }) {
  return withAuth(request, async () => {
    try {
      const payload = await request.json().catch(() => null)
      if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const patch: Record<string, unknown> = payload as any

      const updated = updateReport(params.reportId, {
        reportName: typeof patch.reportName === "string" ? patch.reportName.trim() : undefined,
        reportType: typeof patch.reportType === "string" ? patch.reportType : undefined,
        status: typeof patch.status === "string" ? patch.status : undefined,
        description: typeof patch.description === "string" ? patch.description.trim() : undefined,
        lastRun: typeof patch.lastRun === "string" ? patch.lastRun : patch.lastRun === null ? null : undefined,
        active: typeof patch.active === "boolean" ? patch.active : undefined,
      })

      if (!updated) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 })
      }

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("Failed to update report", error)
      return NextResponse.json({ error: "Failed to update report" }, { status: 500 })
    }
  })
}

export async function DELETE(request: NextRequest, { params }: { params: { reportId: string } }) {
  return withAuth(request, async () => {
    const deleted = deleteReport(params.reportId)
    if (!deleted) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  })
}

