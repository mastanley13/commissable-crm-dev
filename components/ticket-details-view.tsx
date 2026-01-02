"use client"

import Link from "next/link"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { FieldRow } from "./detail/FieldRow"
import { fieldBoxClass } from "./detail/shared"
import { AuditHistoryTab } from "./audit-history-tab"

export interface TicketDetailRecord {
  id: string
  ticketNumber: string
  issue: string
  status: string
  priority: string
  severity: string
  active: boolean
  openedAt: string | Date
  closedAt: string | Date | null
  createdAt: string | Date
  updatedAt: string | Date
  createdById: string | null
  createdByName: string | null
  assignedToId: string | null
  assignedToName: string | null
  accountId: string | null
  accountName: string | null
  distributorAccountId: string | null
  distributorName: string | null
  vendorAccountId: string | null
  vendorName: string | null
  opportunityId: string | null
  opportunityName: string | null
  opportunityShortId: string
  revenueScheduleId: string | null
  revenueScheduleName: string | null
  notes: string | null
}

interface TicketDetailsViewProps {
  ticket: TicketDetailRecord | null
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
}

const TICKET_HISTORY_TABLE_HEIGHT = 360

function formatDate(value: string | Date | null | undefined, withTime = true): string {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const options: Intl.DateTimeFormatOptions = withTime
    ? { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "short", day: "numeric" }
  return new Intl.DateTimeFormat("en-US", options).format(date)
}

export function TicketDetailsView({ ticket, loading, error, onRefresh }: TicketDetailsViewProps) {
  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
          <span>Loading ticket details...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Unable to load ticket details</p>
            <p className="mt-1 text-xs text-red-700">{error}</p>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
        Ticket details are not available.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-4 sm:px-6 lg:px-8">
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden gap-4 pt-3 pb-4">
          {/* Top detail section – mirrors Account/Group detail layout */}
          <div className="rounded-2xl bg-gray-100 p-3 shadow-sm h-[300px] overflow-y-auto">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-primary-600">
                  Ticket Detail
                </p>
              </div>

              <button
                type="button"
                disabled
                className="flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white opacity-60 cursor-not-allowed"
              >
                Update
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-1">
                <FieldRow
                  label="Ticket Number"
                  value={
                    <div className={fieldBoxClass}>
                      <span className="block truncate">{ticket.ticketNumber || "--"}</span>
                    </div>
                  }
                />
                <FieldRow
                  label="Issue"
                  value={
                    <div className={fieldBoxClass}>
                      <span className="block truncate" title={ticket.issue}>
                        {ticket.issue}
                      </span>
                    </div>
                  }
                />
                <FieldRow
                  label="Assigned To"
                  value={
                    <div className={fieldBoxClass}>
                      <span className="block truncate">{ticket.assignedToName ?? "Unassigned"}</span>
                    </div>
                  }
                />
                <FieldRow
                  label="Distributor"
                  value={
                    <div className={fieldBoxClass}>
                      {ticket.distributorAccountId && ticket.distributorName ? (
                        <Link
                          href={`/accounts/${ticket.distributorAccountId}`}
                          className="block w-full truncate text-primary-700 hover:text-primary-800 text-[11px]"
                        >
                          {ticket.distributorName}
                        </Link>
                      ) : (
                        <span className="block truncate">{ticket.distributorName ?? "--"}</span>
                      )}
                    </div>
                  }
                />
                <FieldRow
                  label="Vendor"
                  value={
                    <div className={fieldBoxClass}>
                      {ticket.vendorAccountId && ticket.vendorName ? (
                        <Link
                          href={`/accounts/${ticket.vendorAccountId}`}
                          className="block w-full truncate text-primary-700 hover:text-primary-800 text-[11px]"
                        >
                          {ticket.vendorName}
                        </Link>
                      ) : (
                        <span className="block truncate">{ticket.vendorName ?? "--"}</span>
                      )}
                    </div>
                  }
                />
                <FieldRow
                  label="Account"
                  value={
                    <div className={fieldBoxClass}>
                      {ticket.accountId && ticket.accountName ? (
                        <Link
                          href={`/accounts/${ticket.accountId}`}
                          className="block w-full truncate text-primary-700 hover:text-primary-800 text-[11px]"
                        >
                          {ticket.accountName}
                        </Link>
                      ) : (
                        <span className="block truncate">{ticket.accountName ?? "--"}</span>
                      )}
                    </div>
                  }
                />
              </div>

              <div className="space-y-1">
                <FieldRow
                  label="Revenue Schedule"
                  value={
                    <div className={fieldBoxClass}>
                      {ticket.revenueScheduleId && ticket.revenueScheduleName ? (
                        <Link
                          href={`/revenue-schedules/${ticket.revenueScheduleId}`}
                          className="block w-full truncate text-primary-700 hover:text-primary-800 text-[11px]"
                        >
                          {ticket.revenueScheduleName}
                        </Link>
                      ) : (
                        <span className="block truncate">{ticket.revenueScheduleName ?? "--"}</span>
                      )}
                    </div>
                  }
                />
                <FieldRow
                  label="Opportunity"
                  value={
                    <div className={fieldBoxClass}>
                      {ticket.opportunityId && ticket.opportunityName ? (
                        <Link
                          href={`/opportunities/${ticket.opportunityId}`}
                          className="block w-full truncate text-primary-700 hover:text-primary-800 text-[11px]"
                        >
                          {ticket.opportunityName}
                        </Link>
                      ) : (
                        <span className="block truncate">{ticket.opportunityName ?? "--"}</span>
                      )}
                    </div>
                  }
                />
                <FieldRow
                  label="Status"
                  value={
                    <div className={fieldBoxClass}>
                      <span className="block truncate">{ticket.status}</span>
                    </div>
                  }
                />
                <FieldRow
                  label="Priority"
                  value={
                    <div className={fieldBoxClass}>
                      <span className="block truncate">{ticket.priority}</span>
                    </div>
                  }
                />
                <FieldRow
                  label="Severity"
                  value={
                    <div className={fieldBoxClass}>
                      <span className="block truncate">{ticket.severity}</span>
                    </div>
                  }
                />
                <FieldRow
                  label="Created At"
                  value={
                    <div className={fieldBoxClass}>
                      <span className="block truncate">{formatDate(ticket.createdAt) || "--"}</span>
                    </div>
                  }
                />
              </div>

              {/* Final row: align Notes with Last Updated */}
              <div className="space-y-1">
                <FieldRow
                  label="Notes"
                  value={
                    <div className={fieldBoxClass}>
                      <span
                        className="block truncate"
                        title={ticket.notes && ticket.notes.trim().length > 0 ? ticket.notes : undefined}
                      >
                        {ticket.notes && ticket.notes.trim().length > 0 ? ticket.notes : "--"}
                      </span>
                    </div>
                  }
                />
              </div>
              <div className="space-y-1">
                <FieldRow
                  label="Last Updated"
                  value={
                    <div className={fieldBoxClass}>
                      <span className="block truncate">{formatDate(ticket.updatedAt) || "--"}</span>
                    </div>
                  }
                />
              </div>
            </div>
          </div>

          {/* Bottom History section – mirrors Group Detail History layout */}
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex flex-wrap gap-1 border-x border-t border-gray-200 bg-gray-100 pt-2 px-3 pb-0">
              <button
                type="button"
                className={cn(
                  "px-3 py-1.5 text-sm font-semibold transition rounded-t-md border shadow-sm",
                  "relative -mb-[1px] z-10 border-primary-700 bg-primary-700 text-white hover:bg-primary-800"
                )}
              >
                History
              </button>
            </div>

            <AuditHistoryTab
              entityName={"Ticket" as any}
              entityId={ticket.id}
              tableBodyMaxHeight={TICKET_HISTORY_TABLE_HEIGHT}
              description="This section shows a complete audit log of all changes made to this ticket, including status updates, assignment changes, and resolution notes. Track the full lifecycle of the support request."
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default TicketDetailsView
