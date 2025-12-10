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

const placeholder = <span className="text-slate-300">--</span>

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

const SECTION_ITEMS: SectionNavigationItem[] = [
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
}

export const RevenueScheduleSupportingDetails = forwardRef<
  RevenueScheduleSupportingDetailsHandle,
  { schedule: RevenueScheduleDetailRecord | null }
>(function RevenueScheduleSupportingDetails({ schedule }, ref) {
  const { hasPermission } = useAuth()
  const canCreateTickets = hasPermission ? hasPermission("tickets.create") : true

  const [activeSectionId, setActiveSectionId] = useState<string>(SECTION_ITEMS[0].id)
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

  useImperativeHandle(
    ref,
    () => ({
      openTicketCreateModal: () => {
        setActiveSectionId("tickets")
        setTicketCreateModalOpen(true)
      }
    }),
    []
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
        id: "issue",
        label: "Issue",
        width: 230,
        minWidth: 180,
        maxWidth: 360,
        sortable: true,
        accessor: "issue"
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
        id: "status",
        label: "Status",
        width: 130,
        minWidth: 110,
        maxWidth: 180,
        sortable: true,
        accessor: "status"
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
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  row.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                }`}
              >
                {row.status ?? (row.active ? "Active" : "Inactive")}
              </span>
            )
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
      status: active ? "Active" : "Inactive",
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

  const opportunityColumns = useMemo<DetailLineProps[][]>(() => {
    const columnA: DetailLineProps[] = [
      { label: "House - Account ID", value: schedule?.accountName ?? "A0000000000008867" },
      { label: "Vendor - Account ID", value: schedule?.vendorName ?? "0008" },
      { label: "Distributor - Account ID", value: schedule?.distributorName ?? "0002" },
      { label: "House - Customer ID", value: "0012" },
      { label: "Vendor - Customer ID", value: "0013" },
      { label: "Distributor - Customer ID", value: "0014" }
    ]

    const columnB: DetailLineProps[] = [
      { label: "Location ID", value: "0015" },
      { label: "Opportunity ID", value: schedule?.opportunityId ?? "1" },
      { label: "Opportunity Owner", value: schedule?.opportunityName ?? "4" },
      { label: "House - Order ID", value: "001231" },
      { label: "Vendor - Order ID", value: "0016" },
      { label: "Distributor - Order ID", value: "0017" }
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

  const renderOpportunityDetails = () => (
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

  return (
    <>
      <section>
        <div className="grid gap-2 xl:grid-cols-[260px,1fr] items-start">
          <nav className="flex flex-col gap-0 rounded-3xl border border-slate-300 bg-white p-0 overflow-hidden divide-y divide-blue-200 self-start h-fit">
            {SECTION_ITEMS.map(item => {
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
    </>
  )
})
