import { NextRequest, NextResponse } from "next/server"
import { TicketStatus } from "@prisma/client"
import { withAuth, withPermissions } from "@/lib/api-auth"
import { hasPermission } from "@/lib/auth"
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

function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && (Object.values(TicketStatus) as string[]).includes(value)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  return withPermissions(
    request,
    ["tickets.edit.all", "tickets.edit.assigned", "tickets.delete"],
    async (req) => {
      try {
        const ticketId = params.ticketId
        const tenantId = req.user.tenantId

        if (!ticketId) {
          return NextResponse.json({ error: "Ticket id is required" }, { status: 400 })
        }

        const ticket = await prisma.ticket.findFirst({
          where: { id: ticketId, tenantId },
          select: { id: true, status: true, closedAt: true, assignedToId: true }
        })

        if (!ticket) {
          return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
        }

        const canEditAll = hasPermission(req.user, "tickets.edit.all") || hasPermission(req.user, "tickets.delete")
        if (!canEditAll) {
          const assignedToId = ticket.assignedToId
          const isAssigned = Boolean(assignedToId && assignedToId === req.user.id)
          if (!isAssigned) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
          }
        }

        const payload = await request.json().catch(() => ({} as any))

        let nextStatus: TicketStatus | null = null
        let nextClosedAt: Date | null | undefined = undefined

        if (typeof payload?.active === "boolean") {
          if (payload.active) {
            nextStatus = TicketStatus.Open
            nextClosedAt = null
          } else {
            nextStatus = TicketStatus.Closed
            nextClosedAt = ticket.closedAt ?? new Date()
          }
        } else if (isTicketStatus(payload?.status)) {
          nextStatus = payload.status
          const isClosed = nextStatus === TicketStatus.Closed || nextStatus === TicketStatus.Resolved
          nextClosedAt = isClosed ? (ticket.closedAt ?? new Date()) : null
        }

        if (!nextStatus) {
          return NextResponse.json({ error: "No valid fields provided" }, { status: 400 })
        }

        const updated = await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            status: nextStatus,
            closedAt: nextClosedAt
          }
        })

        return NextResponse.json({
          data: {
            id: updated.id,
            status: updated.status,
            closedAt: updated.closedAt
          }
        })
      } catch (error) {
        console.error("Failed to update ticket", error)
        return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 })
      }
    }
  )
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  return withPermissions(
    request,
    ["tickets.delete"],
    async (req) => {
      try {
        const ticketId = params.ticketId
        const tenantId = req.user.tenantId

        if (!ticketId) {
          return NextResponse.json({ error: "Ticket id is required" }, { status: 400 })
        }

        const existing = await prisma.ticket.findFirst({
          where: { id: ticketId, tenantId },
          select: { id: true }
        })

        if (!existing) {
          return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
        }

        await prisma.ticket.delete({ where: { id: existing.id } })
        return NextResponse.json({ success: true })
      } catch (error) {
        console.error("Failed to delete ticket", error)
        if (error && typeof error === "object" && "code" in error) {
          const prismaError = error as { code?: string }
          if (prismaError.code === "P2003" || prismaError.code === "P2014") {
            return NextResponse.json(
              { error: "Cannot delete ticket due to related records." },
              { status: 409 }
            )
          }
        }
        return NextResponse.json({ error: "Failed to delete ticket" }, { status: 500 })
      }
    }
  )
}

