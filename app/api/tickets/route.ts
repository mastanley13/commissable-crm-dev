import { NextRequest, NextResponse } from "next/server"
import { TicketStatus, type Prisma } from "@prisma/client"
import { withAuth } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type TicketRow = {
  id: string
  distributorName: string
  vendorName: string
  issue: string
  revenueSchedule: string
  opportunityName: string
  productNameVendor: string
  accountIdVendor: string
  customerIdVendor: string
  description: string
  opportunityId: string
  orderIdVendor: string
  ticketNumber: string
  active: boolean
}

type TicketWithRelations = Prisma.TicketGetPayload<{
  include: {
    distributor: {
      select: {
        accountName: true
      }
    }
    vendor: {
      select: {
        accountName: true
        accountNumber: true
      }
    }
    opportunity: {
      select: {
        id: true
        name: true
        distributorName: true
        vendorName: true
        accountIdVendor: true
        customerIdVendor: true
        orderIdVendor: true
        description: true
      }
    }
    revenueSchedule: {
      select: {
        id: true
        scheduleNumber: true
        distributor: {
          select: {
            accountName: true
          }
        }
        vendor: {
          select: {
            accountName: true
            accountNumber: true
          }
        }
        product: {
          select: {
            productNameVendor: true
          }
        }
        opportunity: {
          select: {
            id: true
            name: true
            distributorName: true
            vendorName: true
            accountIdVendor: true
            customerIdVendor: true
            orderIdVendor: true
            description: true
          }
        }
        primaryDepositLineItems: {
          select: {
            accountIdVendor: true
            customerIdVendor: true
            orderIdVendor: true
          }
          take: 1
        }
      }
    }
    assignedTo: {
      select: {
        fullName: true
      }
    }
  }
}>

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

function formatShortId(id: string | null | undefined): string {
  if (!id || typeof id !== "string") return ""
  return id.slice(0, 8).toUpperCase()
}

function mapTicketToRow(ticket: TicketWithRelations): TicketRow {
  const schedule = ticket.revenueSchedule
  const opportunity = ticket.opportunity ?? schedule?.opportunity ?? null
  const primaryLine = schedule?.primaryDepositLineItems?.[0] ?? null

  const distributorName =
    ticket.distributor?.accountName ??
    schedule?.distributor?.accountName ??
    opportunity?.distributorName ??
    ""

  const vendorName =
    ticket.vendor?.accountName ??
    schedule?.vendor?.accountName ??
    opportunity?.vendorName ??
    ""

  const revenueScheduleName = schedule?.scheduleNumber ?? schedule?.id ?? ""

  const opportunityName = opportunity?.name ?? ""
  const opportunityIdDisplay = formatShortId(opportunity?.id ?? null)

  const productNameVendor = schedule?.product?.productNameVendor ?? ""

  const accountIdVendor =
    primaryLine?.accountIdVendor ??
    opportunity?.accountIdVendor ??
    ""

  const customerIdVendor =
    primaryLine?.customerIdVendor ??
    opportunity?.customerIdVendor ??
    ""

  const orderIdVendor =
    primaryLine?.orderIdVendor ??
    opportunity?.orderIdVendor ??
    ""

  const ticketNumber = formatShortId(ticket.id)

  const description = ticket.notes ?? opportunity?.description ?? ""

  const active =
    ticket.status === TicketStatus.Open ||
    ticket.status === TicketStatus.InProgress ||
    ticket.status === TicketStatus.Waiting

  return {
    id: ticket.id,
    distributorName,
    vendorName,
    issue: ticket.issue,
    revenueSchedule: revenueScheduleName,
    opportunityName,
    productNameVendor,
    accountIdVendor,
    customerIdVendor,
    description,
    opportunityId: opportunityIdDisplay,
    orderIdVendor,
    ticketNumber,
    active
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      const searchParams = request.nextUrl.searchParams
      const tenantId = req.user.tenantId

      const pageParam = Number(searchParams.get("page") ?? "1")
      const pageSizeParam = Number(searchParams.get("pageSize") ?? "25")
      const query = searchParams.get("q")?.trim() ?? ""
      const statusFilter = (searchParams.get("status") ?? "active").toLowerCase()
      const sortByParam = searchParams.get("sortBy") ?? "distributorName"
      const sortDirParam: "asc" | "desc" = searchParams.get("sortDir") === "desc" ? "desc" : "asc"
      const columnFilters = parseColumnFilters(searchParams.get("columnFilters"))

      const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
      const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? Math.min(pageSizeParam, 100) : 25

      const where: Prisma.TicketWhereInput = {
        tenantId
      }

      if (statusFilter === "active") {
        where.status = { in: [TicketStatus.Open, TicketStatus.InProgress, TicketStatus.Waiting] }
      } else if (statusFilter === "inactive") {
        where.status = { in: [TicketStatus.Resolved, TicketStatus.Closed] }
      }

      const tickets = await prisma.ticket.findMany({
        where,
        include: {
          distributor: {
            select: { accountName: true }
          },
          vendor: {
            select: { accountName: true, accountNumber: true }
          },
          opportunity: {
            select: {
              id: true,
              name: true,
              distributorName: true,
              vendorName: true,
              accountIdVendor: true,
              customerIdVendor: true,
              orderIdVendor: true,
              description: true
            }
          },
          revenueSchedule: {
            select: {
              id: true,
              scheduleNumber: true,
              distributor: {
                select: { accountName: true }
              },
              vendor: {
                select: { accountName: true, accountNumber: true }
              },
              product: {
                select: { productNameVendor: true }
              },
              opportunity: {
                select: {
                  id: true,
                  name: true,
                  distributorName: true,
                  vendorName: true,
                  accountIdVendor: true,
                  customerIdVendor: true,
                  orderIdVendor: true,
                  description: true
                }
              },
              primaryDepositLineItems: {
                select: {
                  accountIdVendor: true,
                  customerIdVendor: true,
                  orderIdVendor: true
                },
                take: 1
              }
            }
          },
          assignedTo: {
            select: { fullName: true }
          }
        }
      })

      let rows: TicketRow[] = tickets.map(ticket => mapTicketToRow(ticket as TicketWithRelations))

      if (statusFilter === "inactive") {
        // Redundant with DB filter but keeps behavior symmetric with old code
        rows = rows.filter(row => !row.active)
      } else if (statusFilter === "active") {
        rows = rows.filter(row => row.active)
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
              case "productNameVendor":
                return row.productNameVendor.toLowerCase().includes(value)
              case "accountIdVendor":
                return row.accountIdVendor.toLowerCase().includes(value)
              case "customerIdVendor":
                return row.customerIdVendor.toLowerCase().includes(value)
              case "description":
                return row.description.toLowerCase().includes(value)
              case "opportunityId":
                return row.opportunityId.toLowerCase().includes(value)
              case "orderIdVendor":
                return row.orderIdVendor.toLowerCase().includes(value)
              case "ticketNumber":
                return row.ticketNumber.toLowerCase().includes(value)
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
        opportunityName: "opportunityName",
        productNameVendor: "productNameVendor",
        accountIdVendor: "accountIdVendor",
        customerIdVendor: "customerIdVendor",
        description: "description",
        opportunityId: "opportunityId",
        orderIdVendor: "orderIdVendor",
        ticketNumber: "ticketNumber"
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
