import { TicketStatus } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

import { withPermissions } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import {
  LOW_RATE_EXCEPTION_BILLING_REASON,
  LOW_RATE_EXCEPTION_ISSUE,
  LOW_RATE_EXCEPTION_QUEUE_PATH,
} from "@/lib/reconciliation/low-rate-exceptions"

const DEFAULT_STATUSES = [TicketStatus.Open, TicketStatus.InProgress, TicketStatus.Waiting]

export const dynamic = "force-dynamic"

function normalizeQuery(value: string | null) {
  return value?.trim() ?? ""
}

export async function GET(request: NextRequest) {
  return withPermissions(request, ["reconciliation.manage"], async req => {
    const tenantId = req.user.tenantId
    const searchParams = request.nextUrl.searchParams
    const q = normalizeQuery(searchParams.get("q"))
    const includeResolved = searchParams.get("includeResolved") === "true"

    const tickets = await prisma.ticket.findMany({
      where: {
        tenantId,
        issue: LOW_RATE_EXCEPTION_ISSUE,
        ...(includeResolved ? {} : { status: { in: DEFAULT_STATUSES } }),
        revenueSchedule: {
          is: {
            deletedAt: null,
            billingStatus: "InDispute",
            billingStatusReason: { startsWith: LOW_RATE_EXCEPTION_BILLING_REASON },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        priority: true,
        severity: true,
        createdAt: true,
        updatedAt: true,
        notes: true,
        revenueSchedule: {
          select: {
            id: true,
            scheduleNumber: true,
            scheduleDate: true,
            billingStatus: true,
            billingStatusReason: true,
            expectedCommissionRatePercent: true,
            distributor: { select: { accountName: true } },
            vendor: { select: { accountName: true } },
          },
        },
      },
    })

    const rows = tickets
      .map(ticket => ({
        ticketId: ticket.id,
        scheduleId: ticket.revenueSchedule?.id ?? "",
        scheduleNumber: ticket.revenueSchedule?.scheduleNumber ?? ticket.revenueSchedule?.id ?? "",
        scheduleDate: ticket.revenueSchedule?.scheduleDate ? ticket.revenueSchedule.scheduleDate.toISOString() : null,
        billingStatus: ticket.revenueSchedule?.billingStatus ?? "InDispute",
        billingStatusReason: ticket.revenueSchedule?.billingStatusReason ?? LOW_RATE_EXCEPTION_BILLING_REASON,
        expectedCommissionRatePercent:
          ticket.revenueSchedule?.expectedCommissionRatePercent == null
            ? null
            : Number(ticket.revenueSchedule.expectedCommissionRatePercent),
        distributorName: ticket.revenueSchedule?.distributor?.accountName ?? "",
        vendorName: ticket.revenueSchedule?.vendor?.accountName ?? "",
        ticketStatus: ticket.status,
        ticketPriority: ticket.priority,
        ticketSeverity: ticket.severity,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        notes: ticket.notes ?? "",
        queuePath: LOW_RATE_EXCEPTION_QUEUE_PATH,
      }))
      .filter(row => {
        if (!q) return true
        const haystack = [
          row.scheduleNumber,
          row.distributorName,
          row.vendorName,
          row.ticketStatus,
          row.ticketPriority,
          row.ticketSeverity,
          row.notes,
        ]
          .join(" ")
          .toLowerCase()
        return haystack.includes(q.toLowerCase())
      })

    return NextResponse.json({
      data: rows,
      meta: {
        queuePath: LOW_RATE_EXCEPTION_QUEUE_PATH,
        total: rows.length,
      },
    })
  })
}
