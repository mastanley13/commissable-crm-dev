import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { ticketsData } from "@/lib/mock-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type TicketRow = {
  id: string
  distributorName: string
  vendorName: string
  issue: string
  revenueSchedule: string
  opportunityName: string
  active: boolean
}

let inMemoryTickets: TicketRow[] = ticketsData.map(ticket => ({
  id: String(ticket.id),
  distributorName: ticket.distributorName ?? "",
  vendorName: ticket.vendorName ?? "",
  issue: ticket.issue ?? "",
  revenueSchedule: ticket.revenueSchedule ?? "",
  opportunityName: ticket.opportunityName ?? "",
  active: ticket.active !== false
}))

type ColumnFilter = {
  columnId: string
  value: string
}

function parseColumnFilters(raw: string | null): ColumnFilter[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(item => ({
        columnId: typeof item?.columnId === "string" ? item.columnId : "",
        value: typeof item?.value === "string" ? item.value : ""
      }))
      .filter(filter => filter.columnId && filter.value.trim().length > 0)
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
      const statusFilter = (searchParams.get("status") ?? "active").toLowerCase()
      const sortByParam = searchParams.get("sortBy") ?? "distributorName"
      const sortDirParam = searchParams.get("sortDir") === "desc" ? "desc" : "asc"
      const columnFilters = parseColumnFilters(searchParams.get("columnFilters"))

      const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
      const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? Math.min(pageSizeParam, 100) : 25

      let rows = [...inMemoryTickets]

      if (statusFilter === "active") {
        rows = rows.filter(row => row.active)
      } else if (statusFilter === "inactive") {
        rows = rows.filter(row => !row.active)
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
              case "distributorName":
                return row.distributorName.toLowerCase().includes(value)
              case "vendorName":
                return row.vendorName.toLowerCase().includes(value)
              case "issue":
                return row.issue.toLowerCase().includes(value)
              case "revenueSchedule":
                return row.revenueSchedule.toLowerCase().includes(value)
              case "opportunityName":
                return row.opportunityName.toLowerCase().includes(value)
              default:
                return true
            }
          })
        )
      }

      const sortableFields: Record<string, keyof TicketRow> = {
        distributorName: "distributorName",
        vendorName: "vendorName",
        issue: "issue",
        revenueSchedule: "revenueSchedule",
        opportunityName: "opportunityName"
      }
      const sortField = sortableFields[sortByParam] ?? "distributorName"
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
      console.error("Failed to load tickets", error)
      return NextResponse.json({ error: "Failed to load tickets" }, { status: 500 })
    }
  })
}
