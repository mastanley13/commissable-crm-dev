import { NextRequest, NextResponse } from "next/server"
import { TicketPriority, TicketSeverity, TicketStatus, type Prisma } from "@prisma/client"
import { withAuth } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { type OtherSource, resolveOtherSource, resolveOtherValue } from "@/lib/other-field"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type TicketRow = {
  id: string
  distributorName: string
  vendorName: string
  createdAt: string
  dueDate: string
  issue: string
  priority: string
  status: string
  assignedToName: string
  requestorName: string
  vendorTicketId: string
  vendorContactName: string
  revenueScheduleId: string
  revenueSchedule: string
  opportunityName: string
  productNameVendor: string
  productNameOther?: string
  accountIdVendor: string
  accountIdOther?: string
  customerIdVendor: string
  customerIdOther?: string
  description: string
  opportunityId: string
  orderIdVendor: string
  orderIdOther?: string
  otherSource?: OtherSource | null
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
        accountIdDistributor: true
        customerIdVendor: true
        customerIdDistributor: true
        orderIdVendor: true
        orderIdDistributor: true
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
            productNameDistributor: true
          }
        }
        opportunity: {
          select: {
            id: true
            name: true
            distributorName: true
            vendorName: true
            accountIdVendor: true
            accountIdDistributor: true
            customerIdVendor: true
            customerIdDistributor: true
            orderIdVendor: true
            orderIdDistributor: true
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
    createdBy: {
      select: {
        fullName: true
      }
    }
    contact: {
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

function formatDate(value: Date | null | undefined): string {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
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
  const revenueScheduleId = schedule?.id ?? ""

  const opportunityName = opportunity?.name ?? ""
  const opportunityIdDisplay = formatShortId(opportunity?.id ?? null)

  const productNameVendor = schedule?.product?.productNameVendor ?? ""
  const productNameDistributor = schedule?.product?.productNameDistributor ?? ""
  const productNameOther = resolveOtherValue(productNameVendor, productNameDistributor).value ?? ""

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

  const accountIdOther = resolveOtherValue(accountIdVendor, opportunity?.accountIdDistributor ?? "").value ?? ""
  const customerIdOther = resolveOtherValue(customerIdVendor, opportunity?.customerIdDistributor ?? "").value ?? ""
  const orderIdOther = resolveOtherValue(orderIdVendor, opportunity?.orderIdDistributor ?? "").value ?? ""

  const otherSource = resolveOtherSource([
    [accountIdVendor, opportunity?.accountIdDistributor ?? ""],
    [customerIdVendor, opportunity?.customerIdDistributor ?? ""],
    [orderIdVendor, opportunity?.orderIdDistributor ?? ""],
    [productNameVendor, productNameDistributor],
  ])

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
    createdAt: formatDate(ticket.createdAt ?? ticket.openedAt ?? null),
    dueDate: formatDate(ticket.closedAt ?? null),
    issue: ticket.issue,
    priority: String(ticket.priority),
    status: String(ticket.status),
    assignedToName: ticket.assignedTo?.fullName ?? "",
    requestorName: ticket.createdBy?.fullName ?? "",
    vendorTicketId: ticket.vendorTicketId ?? "",
    vendorContactName: ticket.contact?.fullName ?? "",
    revenueScheduleId,
    revenueSchedule: revenueScheduleName,
    opportunityName,
    productNameVendor,
    productNameOther,
    accountIdVendor,
    accountIdOther,
    customerIdVendor,
    customerIdOther,
    description,
    opportunityId: opportunityIdDisplay,
    orderIdVendor,
    orderIdOther,
    otherSource,
    ticketNumber,
    active
  }
}

function coerceId(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const TICKET_TYPE_OPTIONS = new Set([
  "Support Request",
  "Product/Inventory Issue",
  "Commission Question",
  "Other"
])

export async function POST(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      const tenantId = req.user.tenantId
      const payload = await request.json().catch(() => null)

      if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid request payload" }, { status: 400 })
      }

      const issue = typeof (payload as any).issue === "string" ? (payload as any).issue.trim() : ""
      const descriptionInput = typeof (payload as any).description === "string"
        ? (payload as any).description.trim()
        : ""
      const notesInput = typeof (payload as any).notes === "string"
        ? (payload as any).notes.trim()
        : ""
      const active = (payload as any).active !== false

      if (!issue) {
        return NextResponse.json({ error: "Issue is required" }, { status: 400 })
      }

      const opportunityIdInput = coerceId((payload as any).opportunityId)
      const revenueScheduleIdInput = coerceId((payload as any).revenueScheduleId)
      const distributorAccountIdInput = coerceId((payload as any).distributorAccountId)
      const vendorAccountIdInput = coerceId((payload as any).vendorAccountId)
      const vendorContactIdInput = coerceId((payload as any).vendorContactId ?? (payload as any).contactId)
      const vendorTicketIdInput = typeof (payload as any).vendorTicketId === "string"
        ? (payload as any).vendorTicketId.trim()
        : ""
      const productNameVendorInput = typeof (payload as any).productNameVendor === "string"
        ? (payload as any).productNameVendor.trim()
        : ""
      const ticketTypeInput = typeof (payload as any).ticketType === "string"
        ? (payload as any).ticketType.trim()
        : ""

      const ticketType = ticketTypeInput && TICKET_TYPE_OPTIONS.has(ticketTypeInput)
        ? ticketTypeInput
        : ""

      let opportunityId = opportunityIdInput
      let revenueScheduleId = revenueScheduleIdInput
      let distributorAccountId = distributorAccountIdInput
      let vendorAccountId = vendorAccountIdInput
      let accountId: string | null = null

      if (revenueScheduleId) {
        const schedule = await prisma.revenueSchedule.findFirst({
          where: { id: revenueScheduleId, tenantId },
          select: {
            id: true,
            accountId: true,
            opportunityId: true,
            distributorAccountId: true,
            vendorAccountId: true
          }
        })

        if (!schedule) {
          return NextResponse.json({ error: "Revenue schedule not found" }, { status: 404 })
        }

        accountId = schedule.accountId ?? accountId
        opportunityId = schedule.opportunityId ?? opportunityId
        distributorAccountId = schedule.distributorAccountId ?? distributorAccountId
        vendorAccountId = schedule.vendorAccountId ?? vendorAccountId
        revenueScheduleId = schedule.id
      }

      if (opportunityId) {
        const opportunity = await prisma.opportunity.findFirst({
          where: { id: opportunityId, tenantId },
          select: {
            id: true,
            accountId: true,
            accountIdDistributor: true,
            accountIdVendor: true
          }
        })

        if (!opportunity) {
          return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
        }

        accountId = opportunity.accountId ?? accountId
        distributorAccountId = distributorAccountId ?? opportunity.accountIdDistributor ?? null
        vendorAccountId = vendorAccountId ?? opportunity.accountIdVendor ?? null
        opportunityId = opportunity.id
      }

      if (distributorAccountId) {
        const distributorExists = await prisma.account.findFirst({
          where: { id: distributorAccountId, tenantId },
          select: { id: true }
        })
        if (!distributorExists) {
          return NextResponse.json({ error: "Distributor account not found" }, { status: 404 })
        }
      }

      if (vendorAccountId) {
        const vendorExists = await prisma.account.findFirst({
          where: { id: vendorAccountId, tenantId },
          select: { id: true }
        })
        if (!vendorExists) {
          return NextResponse.json({ error: "Vendor account not found" }, { status: 404 })
        }
      }

      let contactId: string | null = vendorContactIdInput
      if (contactId) {
        const contact = await prisma.contact.findFirst({
          where: { id: contactId, tenantId },
          select: { id: true, accountId: true }
        })
        if (!contact) {
          return NextResponse.json({ error: "Vendor contact not found" }, { status: 404 })
        }
        if (vendorAccountId && contact.accountId !== vendorAccountId) {
          return NextResponse.json({ error: "Vendor contact must belong to the selected vendor" }, { status: 400 })
        }
        contactId = contact.id
      }

      const vendorTicketId = vendorTicketIdInput.length > 0 ? vendorTicketIdInput : null

      const notesParts: string[] = []
      if (ticketType) {
        notesParts.push(`Type: ${ticketType}`)
      }
      if (productNameVendorInput) {
        notesParts.push(`Other - Product Name: ${productNameVendorInput}`)
      }
      if (descriptionInput) {
        notesParts.push(descriptionInput)
      }
      if (notesInput) {
        notesParts.push(notesInput)
      }
      const notesValue = notesParts.length > 0 ? notesParts.join("\n\n") : null

      const created = await prisma.ticket.create({
        data: {
          tenantId,
          accountId,
          opportunityId,
          revenueScheduleId,
          distributorAccountId,
          vendorAccountId,
          contactId,
          vendorTicketId,
          issue,
          notes: notesValue,
          status: active ? TicketStatus.Open : TicketStatus.Closed,
          priority: TicketPriority.Medium,
          severity: TicketSeverity.Minor,
          createdById: req.user.id ?? null,
          closedAt: active ? null : new Date()
        },
        include: {
          distributor: { select: { accountName: true } },
          vendor: { select: { accountName: true, accountNumber: true } },
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
              distributor: { select: { accountName: true } },
              vendor: { select: { accountName: true, accountNumber: true } },
              product: { select: { productNameVendor: true } },
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
          assignedTo: { select: { fullName: true } },
          createdBy: { select: { fullName: true } },
          contact: { select: { fullName: true } }
        }
      })

      return NextResponse.json({ data: mapTicketToRow(created as TicketWithRelations) }, { status: 201 })
    } catch (error) {
      console.error("Failed to create ticket", error)
      return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 })
    }
  })
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (req) => {
    try {
      const searchParams = request.nextUrl.searchParams
      const tenantId = req.user.tenantId

      const pageParam = Number(searchParams.get("page") ?? "1")
      const pageSizeParam = Number(searchParams.get("pageSize") ?? "25")
      const revenueScheduleIdParam = searchParams.get("revenueScheduleId")
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

      const revenueScheduleId =
        typeof revenueScheduleIdParam === "string" && revenueScheduleIdParam.trim().length > 0
          ? revenueScheduleIdParam.trim()
          : null

      if (revenueScheduleId) {
        where.revenueScheduleId = revenueScheduleId
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
          },
          createdBy: {
            select: { fullName: true }
          },
          contact: {
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
              case "createdAt":
                return row.createdAt.toLowerCase().includes(value)
              case "dueDate":
                return row.dueDate.toLowerCase().includes(value)
              case "priority":
                return row.priority.toLowerCase().includes(value)
              case "status":
                return row.status.toLowerCase().includes(value)
              case "owner":
                return row.assignedToName.toLowerCase().includes(value)
              case "requestor":
                return row.requestorName.toLowerCase().includes(value)
              case "vendorTicketId":
                return row.vendorTicketId.toLowerCase().includes(value)
              case "vendorContactName":
                return row.vendorContactName.toLowerCase().includes(value)
              case "createdByName":
                return row.requestorName.toLowerCase().includes(value)
              default:
                return true
            }
          })
        )
      }

      const sortableFields: Record<string, keyof TicketRow> = {
        distributorName: "distributorName",
        vendorName: "vendorName",
        createdAt: "createdAt",
        dueDate: "dueDate",
        issue: "issue",
        priority: "priority",
        status: "status",
        revenueSchedule: "revenueSchedule",
        opportunityName: "opportunityName",
        productNameVendor: "productNameVendor",
        accountIdVendor: "accountIdVendor",
        customerIdVendor: "customerIdVendor",
        description: "description",
        opportunityId: "opportunityId",
        orderIdVendor: "orderIdVendor",
        ticketNumber: "ticketNumber",
        owner: "assignedToName",
        requestor: "requestorName",
        vendorTicketId: "vendorTicketId",
        vendorContactName: "vendorContactName",
        createdByName: "requestorName"
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
