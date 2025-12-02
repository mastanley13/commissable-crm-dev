import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { reportsData } from "@/lib/mock-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ReportRow = {
  id: string
  reportName: string
  reportType: string
  createdDate: string
  lastRun: string | null
  status: string
  description?: string | null
}

let inMemoryReports: ReportRow[] = [...reportsData.map(report => ({
  id: String(report.id),
  reportName: report.reportName,
  reportType: report.reportType,
  createdDate: report.createdDate,
  lastRun: report.lastRun ?? null,
  status: report.status ?? "Completed",
  description: (report as any).description ?? null
}))]

function parseColumnFilters(raw: string | null): Array<{ columnId: string; value: string }> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(item => ({
        columnId: typeof item?.columnId === "string" ? item.columnId : "",
        value: typeof item?.value === "string" ? item.value : ""
      }))
      .filter(item => item.columnId && item.value.trim().length > 0)
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const searchParams = request.nextUrl.searchParams
      const pageParam = Number(searchParams.get("page") ?? "1")
      const pageSizeParam = Number(searchParams.get("pageSize") ?? "25")
      const query = searchParams.get("q")?.trim() ?? ""
      const statusFilter = (searchParams.get("status") ?? "all").toLowerCase()
      const sortByParam = searchParams.get("sortBy") ?? "reportName"
      const sortDirParam = searchParams.get("sortDir") === "desc" ? "desc" : "asc"
      const columnFilters = parseColumnFilters(searchParams.get("columnFilters"))

      const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
      const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? Math.min(pageSizeParam, 100) : 25

      let rows = [...inMemoryReports]

      if (statusFilter === "completed") {
        rows = rows.filter(row => row.status?.toLowerCase() === "completed")
      } else if (statusFilter === "running") {
        rows = rows.filter(row => row.status?.toLowerCase() === "running")
      }

      if (query.length > 0) {
        const q = query.toLowerCase()
        rows = rows.filter(row =>
          Object.values(row).some(value =>
            (value ?? "").toString().toLowerCase().includes(q)
          )
        )
      }

      if (columnFilters.length > 0) {
        rows = rows.filter(row =>
          columnFilters.every(filter => {
            const value = filter.value.trim().toLowerCase()
            if (!value) return true
            switch (filter.columnId) {
              case "reportName":
                return row.reportName?.toLowerCase().includes(value)
              case "reportType":
                return row.reportType?.toLowerCase().includes(value)
              case "createdDate":
                return row.createdDate?.toLowerCase().includes(value)
              case "lastRun":
                return (row.lastRun ?? "").toLowerCase().includes(value)
              case "status":
                return row.status?.toLowerCase().includes(value)
              default:
                return true
            }
          })
        )
      }

      const sortableFields: Record<string, keyof ReportRow> = {
        reportName: "reportName",
        reportType: "reportType",
        createdDate: "createdDate",
        lastRun: "lastRun",
        status: "status"
      }
      const sortField = sortableFields[sortByParam] ?? "reportName"
      rows.sort((a, b) => {
        const aValue = (a[sortField] ?? "").toString().toLowerCase()
        const bValue = (b[sortField] ?? "").toString().toLowerCase()
        if (aValue < bValue) return sortDirParam === "asc" ? -1 : 1
        if (aValue > bValue) return sortDirParam === "asc" ? 1 : -1
        return 0
      })

      const total = rows.length
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      const startIndex = (page - 1) * pageSize
      const paged = rows.slice(startIndex, startIndex + pageSize)

      return NextResponse.json({
        data: paged,
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        }
      })
    } catch (error) {
      console.error("Failed to load reports", error)
      return NextResponse.json({ error: "Failed to load reports" }, { status: 500 })
    }
  })
}

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const payload = await request.json().catch(() => null)
      if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const reportName = typeof payload.reportName === "string" ? payload.reportName.trim() : ""
      if (reportName.length < 3) {
        return NextResponse.json({ error: "Report name must be at least 3 characters" }, { status: 400 })
      }

      const reportType = typeof payload.reportType === "string" ? payload.reportType : "Custom"
      const description = typeof payload.description === "string" ? payload.description.trim() : null
      const createdDate = new Date().toISOString().slice(0, 10)

      const report: ReportRow = {
        id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}`,
        reportName,
        reportType,
        createdDate,
        lastRun: null,
        status: "Draft",
        description
      }

      inMemoryReports = [report, ...inMemoryReports]

      return NextResponse.json({ data: report }, { status: 201 })
    } catch (error) {
      console.error("Failed to create report", error)
      return NextResponse.json({ error: "Failed to create report" }, { status: 500 })
    }
  })
}
