"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import {
  PiggyBank,
  BriefcaseBusiness,
  Package,
  Coins,
  CreditCard,
  NotebookPen,
  Ticket
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { RevenueScheduleDetailRecord } from "./revenue-schedule-details-view"
import { cn } from "@/lib/utils"
import { ListHeader, type ColumnFilter } from "@/components/list-header"
import { ColumnChooserModal } from "@/components/column-chooser-modal"
import { DynamicTable, type Column, type PaginationInfo } from "@/components/dynamic-table"
import { useTablePreferences } from "@/hooks/useTablePreferences"
import { applySimpleFilters } from "@/lib/filter-utils"
import { getRevenueTypeLabel } from "@/lib/revenue-types"
import { ACTIVITY_TABLE_BASE_COLUMNS } from "@/components/opportunity-details-view"
import { ActivityNoteCreateModal } from "@/components/activity-note-create-modal"
import { TicketCreateModal } from "@/components/ticket-create-modal"
import { useAuth } from "@/lib/auth-context"
import { SectionContainer } from "@/components/section/SectionContainer"
import { KeyValueGrid, type KeyValueItem } from "@/components/section/KeyValueGrid"
import { DataTableLite, type DataTableColumn } from "@/components/section/DataTableLite"
import { PillTabs } from "@/components/section/PillTabs"
import { EmptyState } from "@/components/section/EmptyState"
import { ErrorBanner } from "@/components/section/ErrorBanner"
import { LoadingState } from "@/components/section/LoadingState"
import { CommissionPayoutCreateModal } from "@/components/commission-payout-create-modal"

interface SectionNavigationItem {
  id: string
  label: string
  description: string
  icon: LucideIcon
}

interface DetailLineProps {
  label: string
  value?: React.ReactNode
  emphasize?: boolean
  underline?: boolean
}

interface FinancialSplitDefinition {
  id: string
  tabLabel: string
  leftHeading: string
  rightHeading: string
  leftFields: DetailLineProps[]
  rightFields: DetailLineProps[]
}

interface ScheduleMatchCard {
  id: string
  depositLineItemId: string | null
  depositId: string | null
  depositName: string | null
  depositPaymentDate: string | null
  depositPaymentType: string | null
  linePaymentDate: string | null
  reconciledAt: string | null
  usageAmount: number | null
  commissionAmount: number | null
  metadata: Record<string, unknown> | null
}

interface SchedulePayoutRow {
  id: string
  splitType: "House" | "HouseRep" | "Subagent"
  status: "Posted" | "Voided"
  amount: number
  paidAt: string
  reference: string | null
  notes: string | null
}

const placeholder = <span className="text-slate-300">--</span>

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeMatchMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) return []

  const readSection = (section: unknown, prefix: string) => {
    if (!isPlainObject(section)) return []
    return Object.entries(section)
      .map(([key, raw]) => {
        if (isPlainObject(raw) && ("value" in raw || "label" in raw)) {
          const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : key
          const value = typeof raw.value === "string" ? raw.value : String((raw as any).value ?? "")
          return [`${prefix}${label}`, value.trim()] as const
        }
        const value = typeof raw === "string" ? raw : String(raw ?? "")
        return [`${prefix}${key}`, value.trim()] as const
      })
      .filter(([, value]) => value.length > 0)
  }

  const hasStructured =
    (isPlainObject(metadata.additional) && Object.keys(metadata.additional).length > 0) ||
    (isPlainObject(metadata.product) && Object.keys(metadata.product).length > 0)

  if (hasStructured) {
    const additional = readSection(metadata.additional, "")
    const product = readSection(metadata.product, "Product - ")
    return [...additional, ...product]
  }

  return readSection(metadata, "")
}

function renderValue(value?: React.ReactNode) {
  if (value === undefined || value === null) {
    return placeholder
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed.length) {
      return placeholder
    }
    return trimmed
  }

  return value
}

function DetailLine({ label, value, emphasize = false, underline = false }: DetailLineProps) {
  const resolvedValue = renderValue(value)
  const labelClasses = emphasize ? "font-semibold text-slate-700" : "text-slate-600"
  const valueClasses = `text-left ${emphasize ? "font-semibold text-slate-900" : "text-slate-700"}`

  return (
    <div className="space-y-0.5">
      <div className="grid grid-cols-[minmax(auto,200px),auto] items-baseline gap-3 text-[11px]">
        <span className={labelClasses}>{label}</span>
        <span className={valueClasses}>{resolvedValue}</span>
      </div>
      {underline ? (
        <div className="grid grid-cols-[minmax(auto,200px),auto] gap-3">
          <span />
          <div className="flex flex-col gap-[2px] pb-0.5">
            <span className="h-px w-full bg-slate-300" />
            <span className="h-px w-full bg-slate-300" />
          </div>
        </div>
      ) : null}
    </div>
  )
}

const LEGACY_SECTION_ITEMS: SectionNavigationItem[] = [
  {
    id: "financial-summary",
    label: "Financial Summary",
    description: "Commission details and revenue splits",
    icon: PiggyBank
  },
  {
    id: "opportunity-details",
    label: "Opportunity Details",
    description: "Account and customer information",
    icon: BriefcaseBusiness
  },
  {
    id: "product-details",
    label: "Product Details",
    description: "Vendor supplied product data",
    icon: Package
  },
  {
    id: "reconciled-deposits",
    label: "Reconciled Deposits",
    description: "Deposit reconciliation information",
    icon: Coins
  },
  {
    id: "payments-made",
    label: "Payments Made",
    description: "Amounts paid out to reps and partners",
    icon: CreditCard
  },
  {
    id: "activities-notes",
    label: "Activities and Notes",
    description: "Tasks, notes, and attached files",
    icon: NotebookPen
  },
  {
    id: "tickets",
    label: "Tickets",
    description: "Support tickets for this schedule",
    icon: Ticket
  }
]

export interface RevenueScheduleSupportingDetailsHandle {
  openTicketCreateModal: () => void
  openSection: (sectionId: string) => void
}

export const RevenueScheduleSupportingDetails = forwardRef<
  RevenueScheduleSupportingDetailsHandle,
  { schedule: RevenueScheduleDetailRecord | null; enableRedesign?: boolean }
>(function RevenueScheduleSupportingDetails({ schedule, enableRedesign = false }, ref) {
  const { hasPermission } = useAuth()
  const canCreateTickets = hasPermission ? hasPermission("tickets.create") : true
  const canManageSchedules = hasPermission ? hasPermission("revenue-schedules.manage") : true

  const REDESIGN_SECTION_ITEMS: SectionNavigationItem[] = [
    {
      id: "opportunity-details",
      label: "Opportunity Details",
      description: "Account, order, customer, and location IDs",
      icon: BriefcaseBusiness
    },
    {
      id: "additional-information",
      label: "Additional Information",
      description: "Vendor/distributor metadata from matched deposits",
      icon: Package
    },
    {
      id: "commission-splits",
      label: "Commission Splits",
      description: "Reconciled and receivables by partner",
      icon: PiggyBank
    },
    {
      id: "transactions",
      label: "Transactions",
      description: "Billing, deposits, and payments activity",
      icon: Coins
    },
    {
      id: "activities-notes",
      label: "Activities",
      description: "Tasks, notes, and attached files",
      icon: NotebookPen
    },
    {
      id: "tickets",
      label: "Tickets",
      description: "Support tickets for this schedule",
      icon: Ticket
    }
  ]

  const initialSection = enableRedesign ? REDESIGN_SECTION_ITEMS[0].id : LEGACY_SECTION_ITEMS[0].id

  const [activeSectionId, setActiveSectionId] = useState<string>(initialSection)
  const containerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const target = enableRedesign ? REDESIGN_SECTION_ITEMS[0].id : LEGACY_SECTION_ITEMS[0].id
    setActiveSectionId(target)
  }, [enableRedesign])
  // Activities & Notes – dynamic table state
  const [activitiesLoading, setActivitiesLoading] = useState<boolean>(false)
  const [activitiesError, setActivitiesError] = useState<string | null>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [activitiesPagination, setActivitiesPagination] = useState<PaginationInfo>({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const [activitiesPage, setActivitiesPage] = useState<number>(1)
  const [activitiesPageSize, setActivitiesPageSize] = useState<number>(10)
  const [activitiesSearch, setActivitiesSearch] = useState<string>("")
  const [activitiesIncludeCompleted, setActivitiesIncludeCompleted] = useState<boolean>(false) // Active-only by default
  const [activitiesColumnFilters, setActivitiesColumnFilters] = useState<ColumnFilter[]>([])
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([])
  const [columnChooserOpen, setColumnChooserOpen] = useState<boolean>(false)
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false)
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Tickets tab – dynamic table state
  const [ticketsLoading, setTicketsLoading] = useState<boolean>(false)
  const [ticketsError, setTicketsError] = useState<string | null>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [ticketsPagination, setTicketsPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1
  })
  const [ticketsPage, setTicketsPage] = useState<number>(1)
  const [ticketsPageSize, setTicketsPageSize] = useState<number>(10)
  const [ticketsSearch, setTicketsSearch] = useState<string>("")
  const [ticketsStatusFilter, setTicketsStatusFilter] = useState<"active" | "all">("active")
  const [ticketsColumnFilters, setTicketsColumnFilters] = useState<ColumnFilter[]>([])
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([])
  const [ticketsColumnChooserOpen, setTicketsColumnChooserOpen] = useState<boolean>(false)
  const [ticketCreateModalOpen, setTicketCreateModalOpen] = useState<boolean>(false)
  const ticketsSearchDebounceRef = useRef<NodeJS.Timeout | null>(null)

  const [matchesLoading, setMatchesLoading] = useState<boolean>(false)
  const [matchesError, setMatchesError] = useState<string | null>(null)
  const [matches, setMatches] = useState<ScheduleMatchCard[]>([])
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null)
  const [transactionFilter, setTransactionFilter] = useState<"all" | "billings" | "deposits" | "payments">("all")
  const [paymentSplitFilter, setPaymentSplitFilter] = useState<"all" | "house" | "subagent" | "houseRep">("all")

  const [payoutsLoading, setPayoutsLoading] = useState<boolean>(false)
  const [payoutsError, setPayoutsError] = useState<string | null>(null)
  const [payouts, setPayouts] = useState<SchedulePayoutRow[]>([])

  const [payoutCreateModalOpen, setPayoutCreateModalOpen] = useState(false)

  useImperativeHandle(
    ref,
    () => ({
      openTicketCreateModal: () => {
        setActiveSectionId("tickets")
        setTicketCreateModalOpen(true)
      },
      openSection: (sectionId: string) => {
        const validIds = (enableRedesign ? REDESIGN_SECTION_ITEMS : LEGACY_SECTION_ITEMS).map(item => item.id)
        if (!validIds.includes(sectionId)) return
        setActiveSectionId(sectionId)
        if (containerRef.current) {
          containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      }
    }),
    [enableRedesign]
  )

  const RS_ACTIVITY_FILTER_COLUMNS: Array<{ id: string; label: string }> = useMemo(() => [
    { id: "activityDate", label: "Activity Date" },
    { id: "activityType", label: "Activity Type" },
    { id: "activityStatus", label: "Activity Status" },
    { id: "description", label: "Description" },
    { id: "activityOwner", label: "Activity Owner" },
    { id: "createdBy", label: "Created By" }
  ], [])

  const RS_TICKET_FILTER_COLUMNS: Array<{ id: string; label: string }> = useMemo(
    () => [
      { id: "ticketNumber", label: "Ticket Number" },
      { id: "issue", label: "Issue" },
      { id: "distributorName", label: "Distributor Name" },
      { id: "vendorName", label: "Vendor Name" },
      { id: "opportunityName", label: "Opportunity Name" }
    ],
    []
  )

  // Format date to YYYY-MM-DD to match other detail tables
  const formatDate = useCallback((value?: string | Date | null): string => {
    if (!value) return "--"
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return "--"
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }, [])

  // Persisted column preferences (reuse Opportunity activities columns for parity)
  const RS_ACTIVITY_BASE_COLUMNS: Column[] = useMemo(() => {
    const base = ACTIVITY_TABLE_BASE_COLUMNS.map(c => ({ ...c }))
    // Nudge widths down to fit the smaller right-hand section
    const widthOverrides: Record<string, number> = {
      "multi-action": 140,
      id: 160,
      activityDate: 140,
      activityType: 140,
      activityOwner: 160,
      description: 240,
      activityStatus: 140,
      attachment: 120,
      fileName: 180,
      createdBy: 160
    }
    return base.map(col => (widthOverrides[col.id] ? { ...col, width: widthOverrides[col.id] } : col))
  }, [])
  const { columns: activityPreferenceColumns, handleColumnsChange: handleActivityColumnsChange } = useTablePreferences(
    "revenue-schedule:activities",
    RS_ACTIVITY_BASE_COLUMNS
  )

  const activityColumnsWithRender = useMemo<Column[]>(() => {
    return activityPreferenceColumns.map(col => {
      if (col.id === "activityDate") {
        return { ...col, render: (value?: string | Date | null) => formatDate(value) }
      }
      return col
    })
  }, [activityPreferenceColumns, formatDate])

  const mapApiRowToActivity = useCallback((row: any) => {
    const attachments = Array.isArray(row.attachments) ? row.attachments : []
    const count = attachments.length
    const attachmentLabel = count === 0 ? "None" : `${count} file${count === 1 ? "" : "s"}`
    const primaryName = count > 0 ? attachments[0]?.fileName ?? null : null

    return {
      id: row.id,
      active: Boolean(row.active),
      activityDate: row.dueDate ?? row.createdAt ?? null,
      activityType: row.type ?? null,
      activityStatus: row.status ?? null,
      description: row.description ?? row.subject ?? null,
      activityOwner: row.assigneeName ?? null,
      createdBy: row.creatorName ?? null,
      attachment: attachmentLabel,
      fileName: primaryName,
      attachments
    }
  }, [])

  const RS_TICKET_BASE_COLUMNS: Column[] = useMemo(
    () => [
      {
        id: "multi-action",
        label: "Select All",
        width: 160,
        minWidth: 130,
        maxWidth: 220,
        type: "multi-action",
        hideable: false
      },
      {
        id: "ticketNumber",
        label: "Ticket Number",
        width: 150,
        minWidth: 130,
        maxWidth: 220,
        sortable: true,
        accessor: "ticketNumber"
      },
      {
        id: "createdAt",
        label: "Created Date",
        width: 140,
        minWidth: 130,
        maxWidth: 220,
        sortable: true,
        accessor: "createdAt"
      },
      {
        id: "issue",
        label: "Issue",
        width: 260,
        minWidth: 180,
        maxWidth: 420,
        sortable: true,
        accessor: "issue"
      },
      {
        id: "priority",
        label: "Priority",
        width: 130,
        minWidth: 110,
        maxWidth: 180,
        sortable: true,
        accessor: "priority"
      },
      {
        id: "distributorName",
        label: "Distributor Name",
        width: 180,
        minWidth: 150,
        maxWidth: 260,
        sortable: true,
        accessor: "distributorName"
      },
      {
        id: "vendorName",
        label: "Vendor Name",
        width: 180,
        minWidth: 150,
        maxWidth: 260,
        sortable: true,
        accessor: "vendorName"
      },
      {
        id: "opportunityName",
        label: "Opportunity Name",
        width: 220,
        minWidth: 180,
        maxWidth: 320,
        sortable: true,
        accessor: "opportunityName"
      },
      {
        id: "owner",
        label: "Owner",
        width: 170,
        minWidth: 140,
        maxWidth: 220,
        sortable: true,
        accessor: "assignedToName"
      },
      {
        id: "requestor",
        label: "Requestor",
        width: 170,
        minWidth: 140,
        maxWidth: 240,
        sortable: true,
        accessor: "requestorName"
      },
      {
        id: "status",
        label: "Status",
        width: 130,
        minWidth: 110,
        maxWidth: 180,
        sortable: true,
        accessor: "status"
      },
      {
        id: "dueDate",
        label: "Due Date",
        width: 140,
        minWidth: 120,
        maxWidth: 200,
        sortable: true,
        accessor: "dueDate"
      }
    ],
    []
  )

  const {
    columns: ticketPreferenceColumns,
    handleColumnsChange: handleTicketColumnsChange
  } = useTablePreferences("revenue-schedule:tickets", RS_TICKET_BASE_COLUMNS)

  const ticketColumnsWithRender = useMemo<Column[]>(
    () =>
      ticketPreferenceColumns.map(column => {
        if (column.id === "multi-action") {
          return {
            ...column,
            render: (_: unknown, row: any) => {
              const rowId = String(row.id)
              const checked = selectedTicketIds.includes(rowId)
              return (
                <div className="flex items-center" data-disable-row-click="true">
                  <label
                    className="flex cursor-pointer items-center justify-center"
                    onClick={event => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      aria-label={`Select ticket ${rowId}`}
                      onChange={() => {
                        setSelectedTicketIds(previous =>
                          checked ? previous.filter(id => id !== rowId) : Array.from(new Set([...previous, rowId]))
                        )
                      }}
                    />
                    <span
                      className={
                        checked
                          ? "flex h-4 w-4 items-center justify-center rounded border border-primary-500 bg-primary-600 text-white"
                          : "flex h-4 w-4 items-center justify-center rounded border border-gray-300 bg-white text-transparent"
                      }
                    >
                      <span className="block h-3 w-3 rounded-sm bg-current" />
                    </span>
                  </label>
                </div>
              )
            }
          }
        }

        if (column.id === "ticketNumber") {
          return {
            ...column,
            render: (value: unknown, row: any) => {
              const ticketId = String(row.id ?? "")
              if (!ticketId) {
                return <span>{value as string}</span>
              }
              const display = (value as string) || row.ticketNumber || ticketId
              return (
                <a
                  href={`/tickets/${ticketId}`}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  {display}
                </a>
              )
            }
          }
        }

        if (column.id === "status") {
          return {
            ...column,
            render: (_: unknown, row: any) => (
              <span className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                row.status === "Open" ? "bg-blue-100 text-blue-800" : "",
                row.status === "InProgress" ? "bg-indigo-100 text-indigo-800" : "",
                row.status === "Waiting" ? "bg-amber-100 text-amber-800" : "",
                row.status === "Resolved" ? "bg-emerald-100 text-emerald-800" : "",
                row.status === "Closed" ? "bg-gray-100 text-gray-800" : "",
                !row.status ? "bg-gray-100 text-gray-800" : ""
              )}>
                {row.status ?? (row.active ? "Active" : "Inactive")}
              </span>
            )
          }
        }

        if (column.id === "priority") {
          return {
            ...column,
            render: (value: unknown) => {
              const text = typeof value === "string" && value.trim().length ? value.trim() : "--"
              const className =
                text === "High"
                  ? "bg-red-100 text-red-800"
                  : text === "Medium"
                    ? "bg-amber-100 text-amber-800"
                    : text === "Low"
                      ? "bg-slate-100 text-slate-800"
                      : "bg-slate-100 text-slate-700"
              return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", className)}>{text}</span>
            }
          }
        }

          return column
        }),
      [selectedTicketIds, ticketPreferenceColumns]
  )

  const mapApiRowToTicket = useCallback((row: any) => {
    const active = row?.active !== false
    return {
      id: String(row?.id ?? ""),
      distributorName: row?.distributorName ?? "",
      vendorName: row?.vendorName ?? "",
      issue: row?.issue ?? "",
      revenueScheduleId: row?.revenueScheduleId ?? "",
      revenueSchedule: row?.revenueSchedule ?? "",
      opportunityName: row?.opportunityName ?? "",
      ticketNumber: row?.ticketNumber ?? "",
      createdAt: row?.createdAt ?? "",
      dueDate: row?.dueDate ?? "",
      priority: row?.priority ?? "",
      assignedToName: row?.assignedToName ?? "",
      requestorName: row?.requestorName ?? "",
      status: row?.status ?? (active ? "Active" : "Inactive"),
      active
    }
  }, [])

  const fetchTickets = useCallback(async () => {
    if (!schedule?.id) {
      setTickets([])
      setTicketsPagination({ page: 1, pageSize: ticketsPageSize, total: 0, totalPages: 1 })
      return
    }

    setTicketsLoading(true)
    setTicketsError(null)

    try {
      const params = new URLSearchParams({
        page: String(ticketsPage),
        pageSize: String(ticketsPageSize),
        sortBy: "ticketNumber",
        sortDir: "asc",
        status: ticketsStatusFilter === "active" ? "active" : "all",
        revenueScheduleId: String(schedule.id)
      })

      if (ticketsSearch.trim()) {
        params.set("q", ticketsSearch.trim())
      }

      const response = await fetch(`/api/tickets?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load tickets")
      }

      const data: any[] = Array.isArray(payload?.data) ? payload.data : []
      const pagination: PaginationInfo = payload?.pagination ?? {
        page: ticketsPage,
        pageSize: ticketsPageSize,
        total: data.length,
        totalPages: 1
      }

      const mapped = data.map(mapApiRowToTicket)
      setTickets(mapped)
      setTicketsPagination(pagination)
      setSelectedTicketIds(prev => prev.filter(id => mapped.some(row => row.id === id)))
    } catch (error) {
      console.error("Failed to load schedule tickets", error)
      setTickets([])
      setTicketsPagination({ page: 1, pageSize: ticketsPageSize, total: 0, totalPages: 1 })
      setTicketsError(error instanceof Error ? error.message : "Unable to load tickets")
    } finally {
      setTicketsLoading(false)
    }
  }, [schedule?.id, ticketsPage, ticketsPageSize, ticketsSearch, ticketsStatusFilter, mapApiRowToTicket])

  const fetchActivities = useCallback(async () => {
    if (!schedule?.id) {
      setActivities([])
      setActivitiesPagination({ page: 1, pageSize: activitiesPageSize, total: 0, totalPages: 1 })
      return
    }
    setActivitiesLoading(true)
    setActivitiesError(null)
    try {
      const params = new URLSearchParams({
        page: String(activitiesPage),
        pageSize: String(activitiesPageSize),
        contextType: "RevenueSchedule",
        contextId: String(schedule.id),
        includeCompleted: activitiesIncludeCompleted ? "true" : "false",
        sortBy: "dueDate",
        sortDirection: "desc"
      })
      if (activitiesSearch.trim()) params.set("search", activitiesSearch.trim())

      const response = await fetch(`/api/activities?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load activities")
      }

      const data: any[] = Array.isArray(payload?.data) ? payload.data : []
      const pagination: PaginationInfo = payload?.pagination ?? {
        page: activitiesPage,
        pageSize: activitiesPageSize,
        total: data.length,
        totalPages: 1
      }
      const mapped = data.map(mapApiRowToActivity)
      setActivities(mapped)
      setActivitiesPagination(pagination)
      setSelectedActivityIds(prev => prev.filter(id => mapped.some(row => row.id === id)))
    } catch (err) {
      console.error("Failed to load schedule activities", err)
      setActivities([])
      setActivitiesPagination({ page: 1, pageSize: activitiesPageSize, total: 0, totalPages: 1 })
      setActivitiesError(err instanceof Error ? err.message : "Unable to load activities")
    } finally {
      setActivitiesLoading(false)
    }
  }, [schedule?.id, activitiesPage, activitiesPageSize, activitiesSearch, activitiesIncludeCompleted, mapApiRowToActivity])

  useEffect(() => {
    void fetchActivities()
  }, [fetchActivities])

  useEffect(() => {
    void fetchTickets()
  }, [fetchTickets])

  const handleSearch = useCallback((query: string) => {
    setActivitiesSearch(query)
    setActivitiesPage(1)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      void fetchActivities()
    }, 250)
  }, [fetchActivities])

  const handleStatusFilter = useCallback((filter: string) => {
    const includeCompleted = filter !== "active"
    setActivitiesIncludeCompleted(includeCompleted)
    setActivitiesPage(1)
  }, [])

  const handleActivitiesPageChange = useCallback((page: number) => {
    setActivitiesPage(page)
  }, [])

  const handleActivitiesPageSizeChange = useCallback((size: number) => {
    setActivitiesPageSize(size)
    setActivitiesPage(1)
  }, [])

  const handleActivityItemSelect = useCallback((itemId: string, selected: boolean) => {
    setSelectedActivityIds(prev => (selected ? Array.from(new Set([...prev, itemId])) : prev.filter(id => id !== itemId)))
  }, [])

  const handleSelectAllActivities = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedActivityIds(activities.map(row => row.id))
    } else {
      setSelectedActivityIds([])
    }
  }, [activities])

  const filteredActivities = useMemo(() => applySimpleFilters(activities, activitiesColumnFilters), [activities, activitiesColumnFilters])

  const handleTicketStatusFilter = useCallback((filter: string) => {
    const normalized: "active" | "all" = filter === "active" ? "active" : "all"
    setTicketsStatusFilter(normalized)
    setTicketsPage(1)
  }, [])

  const handleTicketsPageChange = useCallback((page: number) => {
    setTicketsPage(page)
  }, [])

  const handleTicketsPageSizeChange = useCallback((size: number) => {
    setTicketsPageSize(size)
    setTicketsPage(1)
  }, [])

  const handleTicketItemSelect = useCallback((itemId: string, selected: boolean) => {
    setSelectedTicketIds(previous =>
      selected ? Array.from(new Set([...previous, itemId])) : previous.filter(id => id !== itemId)
    )
  }, [])

  const handleSelectAllTickets = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedTicketIds(tickets.map(row => String(row.id)))
      } else {
        setSelectedTicketIds([])
      }
    },
    [tickets]
  )

  const filteredTickets = useMemo(
    () => applySimpleFilters(tickets, ticketsColumnFilters),
    [tickets, ticketsColumnFilters]
  )

  const fetchMatches = useCallback(async () => {
    if (!schedule?.id) {
      setMatches([])
      setMatchesError(null)
      return
    }

    setMatchesLoading(true)
    setMatchesError(null)

    try {
      const response = await fetch(
        `/api/revenue-schedules/${encodeURIComponent(String(schedule.id))}/matches`,
        { cache: "no-store" }
      )
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load matched deposits")
      }

      const rows: any[] = Array.isArray(payload?.data) ? payload.data : []
      const mapped: ScheduleMatchCard[] = rows.map(row => ({
        id: String(row.id ?? row.depositLineItemId ?? ""),
        depositLineItemId: row.depositLineItemId ?? null,
        depositId: row.depositId ?? null,
        depositName: row.depositName ?? null,
        depositPaymentDate: row.depositPaymentDate ?? null,
        depositPaymentType: row.depositPaymentType ?? null,
        linePaymentDate: row.linePaymentDate ?? null,
        reconciledAt: row.reconciledAt ?? null,
        usageAmount: typeof row.usageAmount === "number" ? row.usageAmount : null,
        commissionAmount: typeof row.commissionAmount === "number" ? row.commissionAmount : null,
        metadata: (row.metadata as Record<string, unknown> | null) ?? null
      }))

      setMatches(mapped)
      if (mapped.length) {
        setActiveMatchId(previous => previous && mapped.some(m => m.id === previous) ? previous : mapped[0].id)
      } else {
        setActiveMatchId(null)
      }
    } catch (error) {
      console.error("Failed to load schedule matches", error)
      setMatches([])
      setMatchesError(error instanceof Error ? error.message : "Unable to load matched deposits")
    } finally {
      setMatchesLoading(false)
    }
  }, [schedule?.id])

  const fetchPayouts = useCallback(async () => {
    if (!schedule?.id) {
      setPayouts([])
      setPayoutsError(null)
      return
    }

    setPayoutsLoading(true)
    setPayoutsError(null)

    try {
      const response = await fetch(
        `/api/revenue-schedules/${encodeURIComponent(String(schedule.id))}/payouts`,
        { cache: "no-store" }
      )
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load payouts")
      }

      const rows: any[] = Array.isArray(payload?.data) ? payload.data : []
      const mapped: SchedulePayoutRow[] = rows
        .map(row => ({
          id: String(row.id ?? ""),
          splitType: (row.splitType as SchedulePayoutRow["splitType"]) ?? "House",
          status: (row.status as SchedulePayoutRow["status"]) ?? "Posted",
          amount: typeof row.amount === "number" ? row.amount : Number(row.amount ?? 0),
          paidAt: String(row.paidAt ?? ""),
          reference: row.reference ?? null,
          notes: row.notes ?? null
        }))
        .filter(row => row.id)

      setPayouts(mapped)
    } catch (error) {
      console.error("Failed to load payouts", error)
      setPayouts([])
      setPayoutsError(error instanceof Error ? error.message : "Unable to load payouts")
    } finally {
      setPayoutsLoading(false)
    }
  }, [schedule?.id])

  useEffect(() => {
    if (!enableRedesign) return
    if (activeSectionId === "additional-information" || activeSectionId === "transactions") {
      void fetchMatches()
    }
  }, [activeSectionId, enableRedesign, fetchMatches])

  useEffect(() => {
    if (!enableRedesign) return
    if (activeSectionId === "commission-splits" || activeSectionId === "transactions") {
      void fetchPayouts()
    }
  }, [activeSectionId, enableRedesign, fetchPayouts])

  const financialSplits = useMemo<FinancialSplitDefinition[]>(() => {
    const commissionActual = schedule?.actualCommission ?? "$0.00"
    const commissionDifference = schedule?.commissionDifference ?? "$0.00"
    const expectedNet = schedule?.expectedCommissionNet ?? "$0.00"

    const houseSplit = schedule?.houseSplitPercent ?? "20.00%"
    const houseRepSplit = schedule?.houseRepSplitPercent ?? "30.00%"
    const subagentSplit = schedule?.subagentSplitPercent ?? "50.00%"

    return [
      {
        id: "house",
        tabLabel: `Commission Split - House (${houseSplit})`,
        leftHeading: `Reconciled Commissions - House - ${houseSplit}`,
        rightHeading: `Receivables - House - ${houseSplit}`,
        leftFields: [
          { label: "Commission Actual", value: commissionActual },
          { label: "House Split %", value: `X ${houseSplit}` },
          { label: "Commission Net House", value: expectedNet, emphasize: true }
        ],
        rightFields: [
          { label: "Commission Balance Total", value: commissionDifference },
          { label: "House Split %", value: `X ${houseSplit}` },
          { label: "Commission Net Receivables House", value: commissionDifference, emphasize: true }
        ]
      },
      {
        id: "house-rep",
        tabLabel: `Commission Split - House Rep (${houseRepSplit})`,
        leftHeading: `Reconciled Commissions - House Rep - ${houseRepSplit}`,
        rightHeading: `Receivables - House Rep - ${houseRepSplit}`,
        leftFields: [
          { label: "Commission Actual", value: commissionActual },
          { label: "House Rep Split %", value: `X ${houseRepSplit}` },
          { label: "Commission Net House Rep", value: expectedNet, emphasize: true }
        ],
        rightFields: [
          { label: "Commission Balance Total", value: commissionDifference },
          { label: "House Rep Split %", value: `X ${houseRepSplit}` },
          { label: "Commission Net Receivables House Rep", value: commissionDifference, emphasize: true }
        ]
      },
      {
        id: "subagent",
        tabLabel: `Commission Split - Subagent (${subagentSplit})`,
        leftHeading: `Reconciled Commissions - Subagent - ${subagentSplit}`,
        rightHeading: `Receivables - Subagent - ${subagentSplit}`,
        leftFields: [
          { label: "Commission Actual", value: commissionActual },
          { label: "Subagent Split %", value: `X ${subagentSplit}` },
          { label: "Commission Net Subagent", value: expectedNet, emphasize: true }
        ],
        rightFields: [
          { label: "Commission Balance Total", value: commissionDifference },
          { label: "Subagent Split %", value: `X ${subagentSplit}` },
          { label: "Commission Net Receivables Subagent", value: commissionDifference, emphasize: true }
        ]
      }
    ]
  }, [schedule])

  const [activeSplitId, setActiveSplitId] = useState<string>(financialSplits[0]?.id ?? "")

  useEffect(() => {
    if (!financialSplits.length) {
      setActiveSplitId("")
      return
    }

    if (!financialSplits.some(split => split.id === activeSplitId)) {
      setActiveSplitId(financialSplits[0].id)
    }
  }, [financialSplits, activeSplitId])

  const activeSplit = financialSplits.find(split => split.id === activeSplitId) ?? financialSplits[0]

  const renderCommissionSplitsRedesign = () => {
    if (!schedule) {
      return (
        <SectionContainer
          title="Commission Splits"
          description="Partner-level view of reconciled commissions and remaining receivables."
        >
          <EmptyState
            title="No commission data"
            description="Splits will appear here after expected and actual commissions are available."
          />
        </SectionContainer>
      )
    }

    const parseCurrency = (value?: string | null): number => {
      if (!value) return 0
      const cleaned = value.replace(/[^0-9.-]/g, "")
      const numeric = Number(cleaned)
      return Number.isFinite(numeric) ? numeric : 0
    }

    const parsePercent = (value?: string | null): number => {
      if (!value) return 0
      const cleaned = value.replace(/[^0-9.-]/g, "")
      const numeric = Number(cleaned)
      if (!Number.isFinite(numeric)) return 0
      return numeric / 100
    }

    const formatMoney = (amount: number): string =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(amount)

    const expectedCommissionNet = parseCurrency(
      schedule.expectedCommissionNet ?? schedule.expectedCommissionGross ?? null
    )

    const actualCommissionNet = parseCurrency(schedule.actualCommission ?? null)

    const postedPayouts = payouts.filter(payout => payout.status === "Posted")
    const paidBySplitType = postedPayouts.reduce(
      (acc, payout) => {
        const amount = Number.isFinite(payout.amount) ? payout.amount : 0
        if (payout.splitType === "House") acc.house += amount
        if (payout.splitType === "HouseRep") acc.houseRep += amount
        if (payout.splitType === "Subagent") acc.subagent += amount
        return acc
      },
      { house: 0, houseRep: 0, subagent: 0 }
    )

    const hasAnyCommission = expectedCommissionNet !== 0 || actualCommissionNet !== 0
    const hasAnyPayouts = postedPayouts.some(payout => Number.isFinite(payout.amount) && payout.amount !== 0)

    if (!hasAnyCommission && !hasAnyPayouts) {
      return (
        <SectionContainer
          title="Commission Splits"
          description="Partner-level view of reconciled commissions and remaining receivables."
        >
          <EmptyState
            title="No commission data"
            description="Splits will appear here after expected and actual commissions are available."
          />
        </SectionContainer>
      )
    }

    const houseSplitLabel = schedule.houseSplitPercent ?? "20.00%"
    const houseRepSplitLabel = schedule.houseRepSplitPercent ?? "30.00%"
    const subagentSplitLabel = schedule.subagentSplitPercent ?? "50.00%"

    const splitCards = [
      {
        id: "house",
        label: schedule.accountName ?? "House",
        percentLabel: houseSplitLabel,
        percent: parsePercent(houseSplitLabel)
      },
      {
        id: "houseRep",
        label: schedule.houseRepName ? `House Rep - ${schedule.houseRepName}` : "House Rep",
        percentLabel: houseRepSplitLabel,
        percent: parsePercent(houseRepSplitLabel)
      },
      {
        id: "subagent",
        label: schedule.subagentName ? `Subagent - ${schedule.subagentName}` : "Subagent",
        percentLabel: subagentSplitLabel,
        percent: parsePercent(subagentSplitLabel)
      }
    ] as const

    return (
      <SectionContainer
        title="Commission Splits"
        description="Reconciled and receivables amounts broken out by partner split."
      >
        <div className="space-y-2">
          {payoutsError ? <ErrorBanner message={payoutsError} /> : null}
          {payoutsLoading ? <LoadingState label="Loading payouts..." /> : null}

          <div className="grid gap-3 lg:grid-cols-3">
          {splitCards.map(split => {
            const splitKey = split.id === "house" ? "house" : split.id === "houseRep" ? "houseRep" : "subagent"
            const paid =
              splitKey === "house"
                ? paidBySplitType.house
                : splitKey === "houseRep"
                  ? paidBySplitType.houseRep
                  : paidBySplitType.subagent

            const reconciledNet = actualCommissionNet * split.percent
            const receivable = expectedCommissionNet * split.percent
            const balance = receivable - paid
            const payoutStatus =
              receivable > 0 && Math.abs(balance) < 0.005 ? "Paid in Full" : paid > 0 ? "Partial" : "Pending"
            return (
              <div key={split.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="bg-blue-900 px-3 py-2 text-white">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold">
                      {split.label} - {split.percentLabel}
                    </h4>
                    <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {payoutStatus}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 p-2">
                  <div className="rounded bg-gray-50 p-2">
                    <h5 className="mb-1 text-xs font-semibold uppercase text-blue-800">Reconciled</h5>
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Actual Commission Net</span>
                        <span className="font-medium">{formatMoney(actualCommissionNet)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Split %</span>
                        <span className="font-medium">{split.percentLabel}</span>
                      </div>
                      <div className="mt-0.5 border-t border-gray-300 pt-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-gray-700">Net</span>
                          <span className="font-bold text-blue-900">{formatMoney(reconciledNet)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded bg-blue-50 p-2">
                    <h5 className="mb-1 text-xs font-semibold uppercase text-blue-800">Receivables</h5>
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Commissions Receivables</span>
                        <span className="font-medium">{formatMoney(receivable)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Paid</span>
                        <span className="font-medium">{formatMoney(paid)}</span>
                      </div>
                      <div className="mt-0.5 border-t border-blue-200 pt-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-gray-700">Total</span>
                          <span className="font-bold text-blue-900">{formatMoney(balance)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          </div>
        </div>
      </SectionContainer>
    )
  }

  const opportunityColumns = useMemo<DetailLineProps[][]>(() => {
    const columnA: DetailLineProps[] = [
      { label: "House - Account ID", value: schedule?.accountId ?? undefined },
      { label: "Vendor - Account ID", value: schedule?.vendorId ?? undefined },
      { label: "Distributor - Account ID", value: schedule?.distributorId ?? undefined },
      { label: "House - Customer ID", value: schedule?.customerIdHouse ?? undefined },
      { label: "Vendor - Customer ID", value: schedule?.customerIdVendor ?? undefined },
      { label: "Distributor - Customer ID", value: schedule?.customerIdDistributor ?? undefined }
    ]

    const columnB: DetailLineProps[] = [
      { label: "Location ID", value: schedule?.locationId ?? undefined },
      { label: "Opportunity ID", value: schedule?.opportunityId ? String(schedule.opportunityId) : undefined },
      { label: "Opportunity Owner", value: schedule?.opportunityOwnerName ?? undefined },
      { label: "House - Order ID", value: schedule?.orderIdHouse ?? undefined },
      { label: "Vendor - Order ID", value: schedule?.orderIdVendor ?? undefined },
      { label: "Distributor - Order ID", value: schedule?.orderIdDistributor ?? undefined }
    ]

    return [columnA, columnB]
  }, [schedule])

  const productColumns = useMemo<DetailLineProps[][]>(() => {
    const shippingAddress = schedule?.shippingAddress ?? "23, ABC Street"
    const city = shippingAddress.split(",").slice(-2, -1)[0]?.trim() ?? "Rio Linda"
    const stateMatch = schedule?.shippingAddress?.match(/\b[A-Z]{2}\b/)?.[0] ?? "CA"

    const fields: DetailLineProps[] = [
      { label: "Service ID", value: schedule?.revenueSchedule ?? "12355234" },
      {
        label: "USOC",
        value: getRevenueTypeLabel(schedule?.productRevenueType) ?? schedule?.productRevenueType ?? "AA3251"
      },
      { label: "Service Address", value: shippingAddress },
      { label: "Service City", value: city },
      { label: "Service State", value: stateMatch },
      { label: "Service Postal Code", value: "92242" }
    ]

    return [fields.slice(0, 3), fields.slice(3)]
  }, [schedule])

  const reconciledDeposits = useMemo(
    () => [
      {
        item: "1",
        depositDate: "2025-04-01",
        payee: schedule?.vendorName ?? "Telarus",
        product: schedule?.productNameVendor ?? "UCaaS Seat - 1 User",
        usageActual: schedule?.actualUsage ?? "$12.00",
        commissionActual: schedule?.actualCommission ?? "$1.20",
        paymentMethod: "Bank Transfer",
        paymentReference: "RS-1234-PYMT"
      }
    ],
    [schedule]
  )

  const depositTotals = useMemo(
    () => ({
      usageActual: "$120.00",
      commissionActual: schedule?.actualCommission ?? "$120.00"
    }),
    [schedule]
  )

  const paymentsMade = useMemo(
    () => [
      {
        item: "1",
        paymentDate: "2025-04-07",
        payee: schedule?.subagentName ?? "Subagent Team",
        split: schedule?.subagentSplitPercent ?? "50.00%",
        amount: "$60.00",
        method: "ACH",
        reference: "PMT-10024"
      },
      {
        item: "2",
        paymentDate: "2025-04-10",
        payee: "House Rep Team",
        split: schedule?.houseRepSplitPercent ?? "30.00%",
        amount: "$36.00",
        method: "Check",
        reference: "PMT-10025"
      }
    ],
    [schedule]
  )

  const renderFinancialSummary = () => {
    if (!activeSplit) {
      return <p className="text-[11px] text-slate-500">No commission split data available.</p>
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap justify-start gap-2">
          {financialSplits.map(split => {
            const isActive = split.id === activeSplitId
            return (
              <button
                key={split.id}
                type="button"
                onClick={() => setActiveSplitId(split.id)}
                className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold shadow-sm transition ${
                  isActive
                    ? "border-primary-700 bg-primary-700 text-white hover:bg-primary-800"
                    : "border-blue-300 bg-gradient-to-b from-blue-100 to-blue-200 text-primary-800 hover:from-blue-200 hover:to-blue-300 hover:border-blue-400"
                }`}
              >
                {split.tabLabel}
              </button>
            )
          })}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 max-w-md">
            <h3 className="text-[11px] font-semibold text-slate-900">{activeSplit.leftHeading}</h3>
            <div className="space-y-2">
              {activeSplit.leftFields.map(field => (
                <DetailLine key={`${activeSplit.id}-left-${field.label}`} {...field} />
              ))}
            </div>
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="text-[11px] font-semibold text-slate-900">{activeSplit.rightHeading}</h3>
            <div className="space-y-2">
              {activeSplit.rightFields.map(field => (
                <DetailLine key={`${activeSplit.id}-right-${field.label}`} {...field} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderOpportunityDetails = () => {
    if (enableRedesign) {
      const rows = [
        {
          label: "HOUSE",
          accountId: schedule?.accountId ?? null,
          orderId: schedule?.orderIdHouse ?? null,
          customerId: schedule?.customerIdHouse ?? null,
          locationId: schedule?.locationId ?? null,
          serviceId: schedule?.revenueSchedule ?? null
        },
        {
          label: "VENDOR",
          accountId: schedule?.vendorId ?? null,
          orderId: schedule?.orderIdVendor ?? null,
          customerId: schedule?.customerIdVendor ?? null,
          locationId: null,
          serviceId: null
        },
        {
          label: "DISTRIBUTOR",
          accountId: schedule?.distributorId ?? null,
          orderId: schedule?.orderIdDistributor ?? null,
          customerId: schedule?.customerIdDistributor ?? null,
          locationId: null,
          serviceId: null
        },
        {
          label: "CUSTOMER",
          accountId: null,
          orderId: null,
          customerId: null,
          locationId: null,
          serviceId: null
        }
      ]

      return (
        <div className="space-y-3">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-blue-900 text-white px-3 py-2">
              <h4 className="text-xs font-semibold">Account, Order, Customer, Location &amp; Service IDs</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600" />
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Account ID</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Order ID</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Customer ID</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Location ID</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Service ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.map(row => (
                    <tr key={row.label} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs font-medium text-gray-600">{row.label}</td>
                      <td className="px-3 py-2 text-xs text-gray-900">{renderValue(row.accountId ?? undefined)}</td>
                      <td className="px-3 py-2 text-xs text-gray-900">{renderValue(row.orderId ?? undefined)}</td>
                      <td className="px-3 py-2 text-xs text-gray-900">{renderValue(row.customerId ?? undefined)}</td>
                      <td className="px-3 py-2 text-xs text-gray-900">{renderValue(row.locationId ?? undefined)}</td>
                      <td className="px-3 py-2 text-xs text-gray-900">{renderValue(row.serviceId ?? undefined)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <div className="grid gap-4 lg:grid-cols-2">
          {opportunityColumns.map((column, columnIndex) => (
            <div key={`opportunity-column-${columnIndex}`} className="space-y-2 max-w-md">
              {column.map(field => (
                <DetailLine key={`opportunity-${columnIndex}-${field.label}`} {...field} />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderProductDetails = () => (
    <div className="space-y-3">
      <div className="grid gap-4 lg:grid-cols-2">
        {productColumns.map((column, columnIndex) => (
          <div key={`product-column-${columnIndex}`} className="space-y-2 max-w-md">
            {column.map(field => (
              <DetailLine key={`product-${columnIndex}-${field.label}`} {...field} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )

  const renderReconciledDeposits = () => (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed overflow-hidden rounded-2xl border border-slate-200 text-[11px]">
          <thead className="bg-indigo-50 text-indigo-700">
            <tr>
              {[
                "Item",
                "Deposit Date",
                "Payee",
                "Vendor - Product Name",
                "Usage Actual",
                "Commission Actual",
                "Payment Method",
                "Payment Reference"
              ].map(header => {
                const isNumeric = header === "Usage Actual" || header === "Commission Actual"
                const widthMap: Record<string, string> = {
                  "Item": "w-[64px] min-w-[64px]",
                  "Vendor - Product Name": "w-[300px] min-w-[300px]",
                  "Usage Actual": "w-[120px] min-w-[120px]",
                  "Commission Actual": "w-[140px] min-w-[140px]",
                  "Payment Method": "w-[160px] min-w-[160px]"
                }
                const widthClass = widthMap[header] ?? ""
                const alignClass = isNumeric ? "text-right" : "text-left"
                return (
                  <th
                    key={header}
                    className={`px-2 py-1.5 ${alignClass} ${widthClass} text-[11px] font-semibold uppercase tracking-wide tabular-nums`}
                  >
                    {header}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="bg-white text-slate-700">
            {reconciledDeposits.map(row => (
              <tr key={`deposit-${row.item}`} className="border-t border-slate-100">
                <td className="px-2 py-1.5 font-semibold text-slate-900 w-[64px] min-w-[64px]">{row.item}</td>
                <td className="px-2 py-1.5">{row.depositDate}</td>
                <td className="px-2 py-1.5">{row.payee}</td>
                <td className="px-2 py-1.5 w-[300px] min-w-[300px]"><span className="block truncate">{row.product}</span></td>
                <td className="px-2 py-1.5 text-right tabular-nums w-[120px] min-w-[120px]">{row.usageActual}</td>
                <td className="px-2 py-1.5 text-right tabular-nums w-[140px] min-w-[140px]">{row.commissionActual}</td>
                <td className="px-2 py-1.5 w-[160px] min-w-[160px]"><span className="block truncate">{row.paymentMethod}</span></td>
                <td className="px-2 py-1.5">{row.paymentReference}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 bg-slate-50 text-slate-900">
              <td className="px-2 py-1.5 text-[11px] font-semibold" colSpan={4}>
                Deposit Totals
              </td>
              <td className="px-2 py-1.5 text-right text-[11px] font-semibold tabular-nums w-[120px] min-w-[120px]">{depositTotals.usageActual}</td>
              <td className="px-2 py-1.5 text-right text-[11px] font-semibold tabular-nums w-[140px] min-w-[140px]">{depositTotals.commissionActual}</td>
              <td className="px-2 py-1.5" colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderPaymentsMade = () => (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed overflow-hidden rounded-2xl border border-slate-200 text-[11px]">
          <thead className="bg-indigo-50 text-indigo-700">
            <tr>
              {["Item", "Payment Date", "Payee", "Split %", "Amount Paid", "Payment Method", "Payment Reference"].map(header => {
                const isNumeric = header === "Split %" || header === "Amount Paid"
                const widthMap: Record<string, string> = {
                  "Item": "w-[64px] min-w-[64px]",
                  "Payment Date": "w-[120px] min-w-[120px]",
                  "Payee": "w-[200px] min-w-[200px]",
                  "Split %": "w-[100px] min-w-[100px]",
                  "Amount Paid": "w-[160px] min-w-[160px]",
                  "Payment Method": "w-[160px] min-w-[160px]"
                }
                const widthClass = widthMap[header] ?? ""
                const alignClass = isNumeric ? "text-right" : "text-left"
                return (
                  <th key={header} className={`px-2 py-1.5 ${alignClass} ${widthClass} text-[11px] font-semibold uppercase tracking-wide tabular-nums`}>
                    {header}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="bg-white text-slate-700">
            {paymentsMade.map(row => (
              <tr key={`payment-${row.item}`} className="border-t border-slate-100">
                <td className="px-2 py-1.5 font-semibold text-slate-900 w-[64px] min-w-[64px]">{row.item}</td>
                <td className="px-2 py-1.5 w-[120px] min-w-[120px]">{row.paymentDate}</td>
                <td className="px-2 py-1.5 w-[200px] min-w-[200px]"><span className="block truncate">{row.payee}</span></td>
                <td className="px-2 py-1.5 text-right tabular-nums w-[100px] min-w-[100px]">{row.split}</td>
                <td className="px-2 py-1.5 text-right tabular-nums w-[120px] min-w-[120px]">{row.amount}</td>
                <td className="px-2 py-1.5 w-[160px] min-w-[160px]"><span className="block truncate">{row.method}</span></td>
                <td className="px-2 py-1.5"><span className="block truncate">{row.reference}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderActivitiesNotes = () => (
    <div className="space-y-2">
      <ListHeader
        inTab
        compact
        searchPlaceholder="Search activities"
        onSearch={handleSearch}
        onFilterChange={handleStatusFilter}
        filterColumns={RS_ACTIVITY_FILTER_COLUMNS}
        columnFilters={activitiesColumnFilters}
        onColumnFiltersChange={setActivitiesColumnFilters}
        onSettingsClick={() => setColumnChooserOpen(true)}
        showCreateButton={true}
        onCreateClick={() => setCreateModalOpen(true)}
      />

      <DynamicTable
        columns={activityColumnsWithRender}
        data={filteredActivities}
        loading={activitiesLoading}
        emptyMessage={activitiesError ?? "No data available in table"}
        onColumnsChange={handleActivityColumnsChange}
        pagination={activitiesPagination}
        onPageChange={handleActivitiesPageChange}
        onPageSizeChange={handleActivitiesPageSizeChange}
        selectedItems={selectedActivityIds}
        onItemSelect={(id, selected) => handleActivityItemSelect(id, selected)}
        onSelectAll={handleSelectAllActivities}
        alwaysShowPagination={true}
        fillContainerWidth={true}
        autoSizeColumns={true}
        maxBodyHeight={300}
        hideSelectAllLabel={false}
        selectHeaderLabel="Select All"
      />

      <ColumnChooserModal
        isOpen={columnChooserOpen}
        columns={activityColumnsWithRender}
        onApply={handleActivityColumnsChange}
        onClose={() => setColumnChooserOpen(false)}
      />

      <ActivityNoteCreateModal
        isOpen={createModalOpen}
        context="revenue-schedule"
        entityName={schedule?.revenueScheduleName ?? schedule?.revenueSchedule ?? undefined}
        revenueScheduleId={schedule?.id}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false)
          // After creating, refetch the current page
          void fetchActivities()
        }}
      />
    </div>
  )

  const renderTickets = () => (
    <div className="space-y-2">
      <ListHeader
        inTab
        compact
        searchPlaceholder="Search tickets"
        onSearch={query => {
          setTicketsSearch(query)
          setTicketsPage(1)
          if (ticketsSearchDebounceRef.current) {
            clearTimeout(ticketsSearchDebounceRef.current)
          }
          ticketsSearchDebounceRef.current = setTimeout(() => {
            void fetchTickets()
          }, 250)
        }}
        onFilterChange={handleTicketStatusFilter}
        filterColumns={RS_TICKET_FILTER_COLUMNS}
        columnFilters={ticketsColumnFilters}
        onColumnFiltersChange={setTicketsColumnFilters}
        onSettingsClick={() => setTicketsColumnChooserOpen(true)}
        showCreateButton={canCreateTickets}
        onCreateClick={() => setTicketCreateModalOpen(true)}
      />

      <DynamicTable
        columns={ticketColumnsWithRender}
        data={filteredTickets}
        loading={ticketsLoading}
        emptyMessage={ticketsError ?? "No data available in table"}
        onColumnsChange={handleTicketColumnsChange}
        pagination={ticketsPagination}
        onPageChange={handleTicketsPageChange}
        onPageSizeChange={handleTicketsPageSizeChange}
        selectedItems={selectedTicketIds}
        onItemSelect={(id, selected) => handleTicketItemSelect(id, selected)}
        onSelectAll={handleSelectAllTickets}
        alwaysShowPagination={true}
        fillContainerWidth={true}
        autoSizeColumns={true}
        maxBodyHeight={300}
        hideSelectAllLabel={false}
        selectHeaderLabel="Select All"
      />

      <ColumnChooserModal
        isOpen={ticketsColumnChooserOpen}
        columns={ticketColumnsWithRender}
        onApply={handleTicketColumnsChange}
        onClose={() => setTicketsColumnChooserOpen(false)}
      />
    </div>
  )

  let sectionContent: React.ReactNode

  if (enableRedesign) {
    switch (activeSectionId) {
      case "opportunity-details":
        sectionContent = (
          <SectionContainer
            title="Opportunity Details"
            description="Account, order, customer, location and service IDs for this revenue schedule."
          >
            {renderOpportunityDetails()}
          </SectionContainer>
        )
        break
      case "additional-information": {
        if (matchesLoading) {
          sectionContent = (
            <SectionContainer
              title="Additional Information"
              description="Vendor and distributor metadata from matched deposit line items."
            >
              <LoadingState label="Loading matched deposits..." />
            </SectionContainer>
          )
        } else if (matchesError) {
          sectionContent = (
            <SectionContainer
              title="Additional Information"
              description="Vendor and distributor metadata from matched deposit line items."
            >
              <ErrorBanner
                message={matchesError}
                action={(
                  <button
                    type="button"
                    onClick={() => void fetchMatches()}
                    className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-primary-700 shadow-sm ring-1 ring-primary-200 hover:bg-primary-50"
                  >
                    Retry
                  </button>
                )}
              />
            </SectionContainer>
          )
        } else if (!matches.length) {
          const emptyColumns: Array<readonly [string, string][]> = [[], [], []]

          sectionContent = (
            <SectionContainer
              title="Additional Information"
              description="Vendor and distributor metadata from matched deposit line items."
            >
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-blue-900 text-white px-3 py-2">
                  <h4 className="text-xs font-semibold">Vendor/Distributor Product Metadata</h4>
                </div>
                <div className="bg-gray-50 px-3 pb-3 pt-3 space-y-3">
                  <p className="text-[11px] text-gray-500 italic">
                    This section displays metadata from vendor/distributor deposit line items as they are reconciled
                    with this revenue schedule. Known ID fields (Account, Order, Customer, Location, Service) update
                    the Opportunity Details tab. Other metadata fields not present on the schedule are added here
                    dynamically. Data is read-only.
                  </p>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                      <div className="bg-gray-100 border-b border-gray-200 px-3 py-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded bg-blue-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Commission Deposit
                          </span>
                          <span className="text-[11px] font-semibold text-gray-700">
                            No matched deposits
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5 p-3 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Reconciled</span>
                          <span className="font-medium text-gray-900">--</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Payment Type</span>
                          <span className="font-medium text-gray-900">--</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-600">Services</span>
                          <span className="truncate font-medium text-gray-900">--</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-600">Product Name - Vendor</span>
                          <span className="truncate font-medium text-gray-900">--</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-600">Sales ID</span>
                          <span className="truncate font-medium text-gray-900">--</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-600">Product Code</span>
                          <span className="truncate font-medium text-gray-900">--</span>
                        </div>
                      </div>
                    </div>

                    {emptyColumns.map((columnEntries, columnIndex) => (
                      <div
                        key={`meta-column-empty-${columnIndex}`}
                        className="border border-gray-200 rounded-lg bg-white overflow-hidden"
                      >
                        <div className="bg-gray-100 border-b border-gray-200 px-3 py-1.5 flex items-center">
                          <span className="inline-flex items-center rounded bg-gray-400 px-2 py-0.5 text-[10px] font-semibold text-white">
                            --
                          </span>
                          <span className="ml-2 text-[11px] font-semibold text-gray-700">
                            No Data
                          </span>
                        </div>
                        <div className="space-y-1 p-3 text-[11px]">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <div
                              key={`placeholder-empty-${columnIndex}-${index}`}
                              className="flex items-center justify-between"
                            >
                              <span className="text-gray-400">New Field</span>
                              <span className="text-gray-300">--</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionContainer>
          )
        } else {
          const activeCard =
            (activeMatchId ? matches.find(match => match.id === activeMatchId) : null) ?? matches[0]

          const metadataEntries = normalizeMatchMetadata(activeCard.metadata ?? null)

          const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ")

          const findEntry = (candidates: string[]): readonly [string, string] | null => {
            for (const candidate of candidates) {
              const target = normalizeKey(candidate)
              const exact = metadataEntries.find(([key]) => normalizeKey(key) === target)
              if (exact) return exact
              const partial = metadataEntries.find(([key]) => normalizeKey(key).includes(target))
              if (partial) return partial
            }
            return null
          }

          const usedKeys = new Set<string>()
          const remember = (entry: readonly [string, string] | null) => {
            if (entry) usedKeys.add(normalizeKey(entry[0]))
          }

          const servicesEntry = findEntry(["services", "service"])
          const vendorProductNameEntry = findEntry(["product name - vendor", "vendor product name", "product name"])
          const salesIdEntry = findEntry(["sales id", "sales_id", "salesid"])
          const productCodeEntry = findEntry(["product code", "product_code", "productcode"])

          remember(servicesEntry)
          remember(vendorProductNameEntry)
          remember(salesIdEntry)
          remember(productCodeEntry)

          const isKnownIdKey = (key: string) => {
            const normalized = normalizeKey(key)
            return ["account id", "order id", "customer id", "location id", "service id"].some(fragment =>
              normalized.includes(fragment)
            )
          }

          const remainingEntries = metadataEntries.filter(
            ([key]) => !usedKeys.has(normalizeKey(key)) && !isKnownIdKey(key)
          )
          const perColumn = Math.ceil(remainingEntries.length / 3) || 0
          const columns = [0, 1, 2].map(index =>
            remainingEntries.slice(index * perColumn, (index + 1) * perColumn)
          )

          sectionContent = (
            <SectionContainer
              title="Additional Information"
              description="Vendor and distributor metadata from matched deposit line items."
            >
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-blue-900 text-white px-3 py-2">
                  <h4 className="text-xs font-semibold">Vendor/Distributor Product Metadata</h4>
                </div>
                <div className="bg-gray-50 px-3 pb-3 pt-3 space-y-3">
                  <p className="text-[11px] text-gray-500 italic">
                    This section displays metadata from vendor/distributor deposit line items as they are reconciled
                    with this revenue schedule. Known ID fields (Account, Order, Customer, Location, Service) update
                    the Opportunity Details tab. Other metadata fields not present on the schedule are added here
                    dynamically. Data is read-only.
                  </p>

                  {matches.length > 1 ? (
                    <PillTabs
                      tabs={matches.map(match => ({
                        id: match.id,
                        label: match.depositName ?? match.depositId ?? match.id
                      }))}
                      activeId={activeCard.id}
                      onChange={setActiveMatchId}
                    />
                  ) : null}

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                      <div className="bg-gray-100 border-b border-gray-200 px-3 py-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded bg-blue-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Commission Deposit
                          </span>
                          <span className="text-[11px] font-semibold text-gray-700">
                            {activeCard.depositName ?? activeCard.depositId ?? activeCard.id}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5 p-3 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Reconciled</span>
                          <span className="font-medium text-gray-900">
                            {activeCard.reconciledAt ??
                              activeCard.depositPaymentDate ??
                              activeCard.linePaymentDate ??
                              "--"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Payment Type</span>
                          <span className="font-medium text-gray-900">
                            {activeCard.depositPaymentType ?? "--"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-600">Services</span>
                          <span className="truncate font-medium text-gray-900" title={servicesEntry?.[1] ?? ""}>
                            {servicesEntry?.[1] ?? "--"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-600">Product Name - Vendor</span>
                          <span
                            className="truncate font-medium text-gray-900"
                            title={vendorProductNameEntry?.[1] ?? schedule?.productNameVendor ?? ""}
                          >
                            {vendorProductNameEntry?.[1] ?? schedule?.productNameVendor ?? "--"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-600">Sales ID</span>
                          <span className="truncate font-medium text-gray-900" title={salesIdEntry?.[1] ?? ""}>
                            {salesIdEntry?.[1] ?? "--"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-gray-600">Product Code</span>
                          <span className="truncate font-medium text-gray-900" title={productCodeEntry?.[1] ?? ""}>
                            {productCodeEntry?.[1] ?? "--"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {columns.map((columnEntries, columnIndex) => (
                      <div
                        key={`meta-column-${columnIndex}`}
                        className="border border-gray-200 rounded-lg bg-white overflow-hidden"
                      >
                        <div className="bg-gray-100 border-b border-gray-200 px-3 py-1.5 flex items-center">
                          <span className="inline-flex items-center rounded bg-gray-400 px-2 py-0.5 text-[10px] font-semibold text-white">
                            {columnEntries.length ? "Meta" : "--"}
                          </span>
                          <span className="ml-2 text-[11px] font-semibold text-gray-700">
                            {columnEntries.length ? "Metadata" : "No Data"}
                          </span>
                        </div>
                        <div className="space-y-1 p-3 text-[11px]">
                          {columnEntries.length
                            ? columnEntries.map(([key, value]) => (
                                <div
                                  key={`${activeCard.id}-${columnIndex}-${key}`}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <span className="truncate text-gray-600" title={key}>
                                    {key}
                                  </span>
                                  <span className="truncate font-medium text-gray-900" title={value}>
                                    {value}
                                  </span>
                                </div>
                              ))
                            : Array.from({ length: 5 }).map((_, index) => (
                                <div
                                  key={`placeholder-${columnIndex}-${index}`}
                                  className="flex items-center justify-between"
                                >
                                  <span className="text-gray-400">New Field</span>
                                  <span className="text-gray-300">--</span>
                                </div>
                              ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionContainer>
          )
        }
        break
      }
      case "commission-splits":
        sectionContent = renderCommissionSplitsRedesign()
        break
      case "transactions": {
        const columns: DataTableColumn[] = [
          { id: "date", header: "Date" },
          { id: "type", header: "Type" },
          { id: "account", header: "Account" },
          { id: "split", header: "Split" },
          { id: "ref", header: "ID" },
          { id: "amount", header: "Amount", align: "right" },
          { id: "commission", header: "Commission", align: "right" },
          { id: "paid", header: "Paid", align: "right" },
          { id: "total", header: "Total", align: "right" }
        ]

        const parseCurrency = (value?: string | null): number => {
          if (!value) return 0
          const cleaned = value.replace(/[^0-9.-]/g, "")
          const numeric = Number(cleaned)
          return Number.isFinite(numeric) ? numeric : 0
        }

        const formatMoney = (value: number) =>
          new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)

        const billingAmount = schedule
          ? parseCurrency(
              schedule.actualUsage ??
              schedule.expectedUsageNet ??
              schedule.expectedUsageGross ??
              schedule.expectedUsage
            )
          : 0

        const commissionActual = schedule
          ? parseCurrency(
              schedule.actualCommission ??
              schedule.expectedCommissionNet ??
              schedule.expectedCommissionGross
            )
          : 0

        const housePercent = parseCurrency(schedule?.houseSplitPercent ?? "0") / 100
        const houseRepPercent = parseCurrency(schedule?.houseRepSplitPercent ?? "0") / 100
        const subagentPercent = parseCurrency(schedule?.subagentSplitPercent ?? "0") / 100

        const baseRows: Array<{
          id: string
          date: string
          type: "Billing" | "Commission Deposit" | "Payment"
          account: string
          splitId: "house" | "subagent" | "houseRep" | null
          splitLabel: string
          ref: string
          amount: number
          commission: number
          paid: number
          total: number
        }> = []

        if (schedule && billingAmount !== 0) {
          baseRows.push({
            id: `billing-${schedule.id}`,
            date: formatDate(schedule.revenueScheduleDate ?? null),
            type: "Billing",
            account: schedule.accountName ?? "Customer",
            splitId: null,
            splitLabel: "",
            ref: schedule.revenueSchedule ?? schedule.revenueScheduleName ?? schedule.id,
            amount: billingAmount,
            commission: 0,
            paid: 0,
            total: 0
          })
        }

        matches.forEach(match => {
          const commissionAmount = match.commissionAmount ?? 0
          if (!commissionAmount) return
          baseRows.push({
            id: `deposit-${match.id}`,
            date: formatDate(match.depositPaymentDate ?? match.linePaymentDate ?? null),
            type: "Commission Deposit",
            account: schedule?.vendorName ?? schedule?.distributorName ?? "Vendor",
            splitId: null,
            splitLabel: "",
            ref: match.depositName ?? match.depositId ?? match.id,
            amount: 0,
            commission: commissionAmount,
            paid: 0,
            total: commissionAmount
          })
        })

        const postedPayouts = payouts.filter(payout => payout.status === "Posted")
        postedPayouts.forEach(payout => {
          const amount = Number.isFinite(payout.amount) ? payout.amount : 0
          if (!amount) return
          const splitId = payout.splitType === "House" ? "house" : payout.splitType === "HouseRep" ? "houseRep" : "subagent"
          const splitLabel =
            splitId === "house"
              ? schedule?.houseSplitPercent ?? ""
              : splitId === "houseRep"
                ? schedule?.houseRepSplitPercent ?? ""
                : schedule?.subagentSplitPercent ?? ""
          const account =
            splitId === "house"
              ? schedule?.accountName ?? "House"
              : splitId === "houseRep"
                ? schedule?.houseRepName ?? "House Rep"
                : schedule?.subagentName ?? "Subagent"
          baseRows.push({
            id: `payment-${payout.id}`,
            date: formatDate(payout.paidAt),
            type: "Payment",
            account,
            splitId,
            splitLabel,
            ref: payout.reference ?? payout.id,
            amount: 0,
            commission: 0,
            paid: -amount,
            total: -amount
          })
        })

        const filteredRows = baseRows.filter(row => {
          if (transactionFilter === "billings" && row.type !== "Billing") return false
          if (transactionFilter === "deposits" && row.type !== "Commission Deposit") return false
          if (transactionFilter === "payments" && row.type !== "Payment") return false
          if (transactionFilter === "payments") {
            if (paymentSplitFilter === "house" && row.splitId !== "house") return false
            if (paymentSplitFilter === "subagent" && row.splitId !== "subagent") return false
            if (paymentSplitFilter === "houseRep" && row.splitId !== "houseRep") return false
          }
          return true
        })

        const totals = filteredRows.reduce(
          (agg, row) => ({
            amount: agg.amount + row.amount,
            commission: agg.commission + row.commission,
            paid: agg.paid + row.paid,
            total: agg.total + row.total
          }),
          { amount: 0, commission: 0, paid: 0, total: 0 }
        )

        const rows = filteredRows.map(row => ({
          date: row.date,
          type:
            row.type === "Billing" ? (
              <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                Billing
              </span>
            ) : row.type === "Commission Deposit" ? (
              <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Commission Deposit
              </span>
            ) : (
              <span className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                Payment
              </span>
            ),
          account: row.account,
          split: row.splitLabel,
          ref: row.ref,
          amount: row.amount ? <span className="font-medium text-blue-700">{formatMoney(row.amount)}</span> : <span className="text-slate-300">--</span>,
          commission: row.commission ? <span className="font-medium text-green-700">+{formatMoney(row.commission)}</span> : <span className="text-slate-300">--</span>,
          paid: row.paid ? <span className="font-medium text-red-700">{formatMoney(row.paid)}</span> : <span className="text-slate-300">--</span>,
          total: row.total ? <span className="font-medium text-blue-900">{formatMoney(row.total)}</span> : <span className="text-slate-300">--</span>
        }))

        sectionContent = (
          <SectionContainer
            title="Transaction Ledger"
            description="Billing, commission deposits, and payments affecting this revenue schedule."
            actions={(
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                  <span className="mr-1 italic text-blue-600">Choose one:</span>
                  {(["all", "billings", "deposits", "payments"] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setTransactionFilter(option)
                        if (option !== "payments") setPaymentSplitFilter("all")
                      }}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        transactionFilter === option
                          ? "bg-blue-600 text-white"
                          : "bg-transparent text-blue-700 hover:bg-blue-100"
                      }`}
                    >
                      {option === "all"
                        ? "All"
                        : option === "billings"
                          ? "Billings"
                          : option === "deposits"
                            ? "Commission Deposits"
                            : "Payments"}
                    </button>
                  ))}
                  {transactionFilter === "payments" ? (
                    <select
                      value={paymentSplitFilter}
                      onChange={event => setPaymentSplitFilter(event.target.value as typeof paymentSplitFilter)}
                      className="ml-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white outline-none focus:ring-2 focus:ring-white/60"
                    >
                      <option value="all">All Splits</option>
                      <option value="house">House</option>
                      <option value="houseRep">House Rep</option>
                      <option value="subagent">Subagent</option>
                    </select>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-blue-700">{filteredRows.length} transactions</span>
                  {canManageSchedules && schedule?.id ? (
                    <button
                      type="button"
                      onClick={() => setPayoutCreateModalOpen(true)}
                      className="rounded-full bg-blue-600 px-3 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-700"
                    >
                      Record Payment
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          >
            {payoutsError ? <ErrorBanner message={payoutsError} /> : null}
            {payoutsLoading ? <LoadingState label="Loading payouts..." /> : null}
            <DataTableLite
              columns={columns}
              rows={rows}
              totalsRow={{
                amount: <span className="font-bold text-blue-600">{formatMoney(totals.amount)}</span>,
                commission: <span className="font-bold text-green-600">{formatMoney(totals.commission)}</span>,
                paid: <span className="font-bold text-red-600">{formatMoney(totals.paid)}</span>,
                total: <span className="font-bold text-blue-900">{formatMoney(totals.total)}</span>
              }}
              emptyMessage="No transactions to display."
            />
          </SectionContainer>
        )
        break
      }
      case "activities-notes":
        sectionContent = (
          <SectionContainer
            title="Activities"
            description="Timeline of activities, notes, and files associated with this revenue schedule."
          >
            {renderActivitiesNotes()}
          </SectionContainer>
        )
        break
      case "tickets":
        sectionContent = (
          <SectionContainer
            title="Tickets"
            description="Support tickets related to this revenue schedule."
          >
            {renderTickets()}
          </SectionContainer>
        )
        break
      default:
        sectionContent = null
    }
  } else {
    switch (activeSectionId) {
      case "financial-summary":
        sectionContent = renderFinancialSummary()
        break
      case "opportunity-details":
        sectionContent = renderOpportunityDetails()
        break
      case "product-details":
        sectionContent = renderProductDetails()
        break
      case "reconciled-deposits":
        sectionContent = renderReconciledDeposits()
        break
      case "payments-made":
        sectionContent = renderPaymentsMade()
        break
      case "activities-notes":
        sectionContent = renderActivitiesNotes()
        break
      case "tickets":
        sectionContent = renderTickets()
        break
      default:
        sectionContent = null
    }
  }
  return (
    <>
      <section ref={containerRef}>
        {enableRedesign ? (
          <div className="flex flex-col overflow-hidden">
            <div className="flex flex-wrap gap-1 border-x border-t border-gray-200 bg-gray-100 pt-2 px-3 pb-0">
              {REDESIGN_SECTION_ITEMS.map(item => {
                const isActive = item.id === activeSectionId
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSectionId(item.id)}
                    className={cn(
                      "rounded-t-md border px-3 py-1.5 text-sm font-semibold shadow-sm transition",
                      isActive
                        ? "relative -mb-[1px] z-10 border-primary-700 bg-primary-700 text-white hover:bg-primary-800"
                        : "border-blue-300 bg-gradient-to-b from-blue-100 to-blue-200 text-primary-800 hover:border-blue-400 hover:from-blue-200 hover:to-blue-300"
                    )}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
            <div className="border-x border-b border-gray-200 bg-white px-3 pb-3 pt-0">
              <div className="border-t-2 border-t-primary-600 -mx-3 px-3 pt-3">
                {sectionContent ?? (
                  <p className="text-[11px] text-slate-500">Select a section to view its details.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 xl:grid-cols-[260px,1fr] items-start">
            <nav className="flex flex-col gap-0 rounded-3xl border border-slate-300 bg-white p-0 overflow-hidden divide-y divide-blue-200 self-start h-fit">
              {LEGACY_SECTION_ITEMS.map(item => {
                const Icon = item.icon
                const isActive = item.id === activeSectionId
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSectionId(item.id)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left transition shadow-sm ${
                      isActive
                        ? "rounded-none bg-primary-700 text-white hover:bg-primary-800"
                        : "rounded-none bg-gradient-to-b from-blue-100 to-blue-200 text-primary-800 hover:from-blue-200 hover:to-blue-300"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border ${
                        isActive ? "border-white bg-white text-primary-700" : "border-blue-200 bg-white text-primary-700"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="space-y-0.5">
                      <span className={`block text-[11px] font-semibold ${isActive ? "text-white" : "text-primary-800"}`}>{item.label}</span>
                      <span className={`block text-[11px] leading-tight ${isActive ? "text-blue-100" : "text-primary-700/70"}`}>{item.description}</span>
                    </span>
                  </button>
                )
              })}
            </nav>

            <div className="p-3">
              {sectionContent ?? <p className="text-[11px] text-slate-500">Select a section to view its details.</p>}
            </div>
          </div>
        )}
      </section>

      <TicketCreateModal
        isOpen={ticketCreateModalOpen}
        onClose={() => setTicketCreateModalOpen(false)}
        onSuccess={() => {
          setTicketCreateModalOpen(false)
          void fetchTickets()
        }}
        defaultRevenueScheduleId={schedule?.id}
        defaultRevenueScheduleName={schedule?.revenueScheduleName ?? schedule?.revenueSchedule ?? ""}
        defaultOpportunityId={schedule?.opportunityId ? String(schedule.opportunityId) : ""}
        defaultOpportunityName={schedule?.opportunityName ?? ""}
        defaultDistributorAccountId={schedule?.distributorId ?? ""}
        defaultDistributorName={schedule?.distributorName ?? ""}
        defaultVendorAccountId={schedule?.vendorId ?? ""}
        defaultVendorName={schedule?.vendorName ?? ""}
        defaultProductNameVendor={schedule?.productNameVendor ?? ""}
      />

      {schedule?.id ? (
        <CommissionPayoutCreateModal
          isOpen={payoutCreateModalOpen}
          onClose={() => setPayoutCreateModalOpen(false)}
          onSuccess={() => void fetchPayouts()}
          revenueScheduleId={schedule.id}
        />
      ) : null}
    </>
  )
})
