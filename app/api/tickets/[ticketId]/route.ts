import { NextRequest, NextResponse } from "next/server"
import { TicketStatus } from "@prisma/client"
import { withAuth } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function formatShortId(id: string | null | undefined): string {
  if (!id || typeof id !== "string") return ""
  return id.slice(0, 8).toUpperCase()
}

export async function GET(
  request: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  return withAuth(request, async req => {
    try {
      const ticketId = params.ticketId
      const tenantId = req.user.tenantId

      if (!ticketId) {
        return NextResponse.json({ error: "Ticket id is required" }, { status: 400 })
      }

      const ticket = await prisma.ticket.findFirst({
        where: {
          id: ticketId,
          tenantId
        },
        include: {
          account: {
            select: {
              id: true,
              accountName: true
            }
          },
          distributor: {
            select: {
              id: true,
              accountName: true
            }
          },
          vendor: {
            select: {
              id: true,
              accountName: true
            }
          },
          opportunity: {
            select: {
              id: true,
              name: true
            }
          },
          revenueSchedule: {
            select: {
              id: true,
              scheduleNumber: true
            }
          },
          createdBy: {
            select: {
              id: true,
              fullName: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              fullName: true
            }
          }
        }
      })

      if (!ticket) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
      }

      const ticketNumber = formatShortId(ticket.id)
      const opportunityShortId = formatShortId(ticket.opportunity?.id ?? null)

      const active =
        ticket.status === TicketStatus.Open ||
        ticket.status === TicketStatus.InProgress ||
        ticket.status === TicketStatus.Waiting

      const detail = {
        id: ticket.id,
        ticketNumber,
        issue: ticket.issue,
        status: ticket.status,
        priority: ticket.priority,
        severity: ticket.severity,
        active,
        openedAt: ticket.openedAt,
        closedAt: ticket.closedAt,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        createdById: ticket.createdBy?.id ?? null,
        createdByName: ticket.createdBy?.fullName ?? null,
        assignedToId: ticket.assignedTo?.id ?? null,
        assignedToName: ticket.assignedTo?.fullName ?? null,
        accountId: ticket.account?.id ?? null,
        accountName: ticket.account?.accountName ?? null,
        distributorAccountId: ticket.distributor?.id ?? null,
        distributorName: ticket.distributor?.accountName ?? null,
        vendorAccountId: ticket.vendor?.id ?? null,
        vendorName: ticket.vendor?.accountName ?? null,
        opportunityId: ticket.opportunity?.id ?? null,
        opportunityName: ticket.opportunity?.name ?? null,
        opportunityShortId,
        revenueScheduleId: ticket.revenueSchedule?.id ?? null,
        revenueScheduleName: ticket.revenueSchedule?.scheduleNumber ?? null,
        notes: ticket.notes ?? null
      }

      return NextResponse.json({ data: detail })
    } catch (error) {
      console.error("Failed to load ticket", error)
      return NextResponse.json({ error: "Failed to load ticket" }, { status: 500 })
    }
  })
}

