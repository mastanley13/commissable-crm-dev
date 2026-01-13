'use client'

import { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column, PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { useToasts } from '@/components/toast'
import { AccountStatusFilterDropdown } from '@/components/account-status-filter-dropdown'
import { buildStandardBulkActions } from '@/components/standard-bulk-actions'
import { Check } from 'lucide-react'
import { BulkOwnerModal, type BulkOwnerOption } from '@/components/bulk-owner-modal'
import { BulkStatusModal } from '@/components/bulk-status-modal'
import { TicketCreateModal } from '@/components/ticket-create-modal'
import { TwoStageDeleteDialog } from '@/components/two-stage-delete-dialog'
import type { DeletionConstraint } from '@/lib/deletion'

interface TicketRow {
  id: string
  distributorName: string
  vendorName: string
  issue: string
  revenueScheduleId?: string
  revenueSchedule: string
  opportunityName: string
  productNameVendor?: string
  accountIdVendor?: string
  customerIdVendor?: string
  description?: string
  opportunityId?: string
  orderIdVendor?: string
  ticketNumber?: string
  active: boolean
  ownerName: string
}

interface ColumnFilterState {
  columnId: string
  value: string
}

type SortDirection = 'asc' | 'desc'
type SortConfig = {
  columnId: string
  direction: SortDirection
}

const REQUEST_ANIMATION_FRAME =
  typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame.bind(window)
    : (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16)

const TABLE_BOTTOM_RESERVE = 110
const TABLE_MIN_BODY_HEIGHT = 320
const DEFAULT_SORT: SortConfig = { columnId: 'distributorName', direction: 'asc' }
const normalizePageSize = (value: number): number => {
  if (!Number.isFinite(value)) return 100
  return Math.min(100, Math.max(1, Math.floor(value)))
}

const TICKET_FILTER_COLUMNS = [
  { id: 'distributorName', label: 'Distributor Name' },
  { id: 'vendorName', label: 'Vendor Name' },
  { id: 'issue', label: 'Issue' },
  { id: 'revenueSchedule', label: 'Revenue Schedule Name' },
  { id: 'opportunityName', label: 'Opportunity Name' }
]

const TICKET_COLUMNS: Column[] = [
  {
    id: 'multi-action',
    label: 'Select All',
    width: 200,
    minWidth: 120,
    maxWidth: 240,
    type: 'multi-action'
  },
  {
    id: 'distributorName',
    label: 'Distributor Name',
    width: 200,
    minWidth: 160,
    maxWidth: 300,
    sortable: true,
    type: 'text'
  },
  {
    id: 'vendorName',
    label: 'Vendor Name',
    width: 180,
    minWidth: 150,
    maxWidth: 280,
    sortable: true,
    type: 'text'
  },
  {
    id: 'issue',
    label: 'Issue',
    width: 240,
    minWidth: 180,
    maxWidth: 360,
    sortable: true,
    type: 'text'
  },
  {
    id: 'revenueSchedule',
    label: 'Revenue Schedule Name',
    width: 160,
    minWidth: 140,
    maxWidth: 240,
    sortable: true,
    type: 'text'
  },
  {
    id: 'opportunityName',
    label: 'Opportunity Name',
    width: 220,
    minWidth: 180,
    maxWidth: 320,
    sortable: true,
    type: 'text'
  },
  {
    id: 'productNameVendor',
    label: 'Other - Product Name',
    width: 220,
    minWidth: 180,
    maxWidth: 320,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'accountIdVendor',
    label: 'Other - Account ID',
    width: 200,
    minWidth: 160,
    maxWidth: 280,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'customerIdVendor',
    label: 'Other - Customer ID',
    width: 200,
    minWidth: 160,
    maxWidth: 280,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'description',
    label: 'Description',
    width: 260,
    minWidth: 200,
    maxWidth: 360,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'opportunityId',
    label: 'Opportunity ID',
    width: 200,
    minWidth: 160,
    maxWidth: 280,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'orderIdVendor',
    label: 'Other - Order ID',
    width: 200,
    minWidth: 160,
    maxWidth: 280,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'ticketNumber',
    label: 'Ticket Number',
    width: 180,
    minWidth: 140,
    maxWidth: 260,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'status',
    label: 'Status',
    width: 130,
    minWidth: 110,
    maxWidth: 180,
    sortable: true,
    type: 'text'
  }
]

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active')
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState[]>([])
  const [selectedTickets, setSelectedTickets] = useState<string[]>([])
  const [showOwnerModal, setShowOwnerModal] = useState(false)
  const [ownerOptions, setOwnerOptions] = useState<BulkOwnerOption[]>([])
  const [ownersLoading, setOwnersLoading] = useState(false)
  const [ownerSubmitting, setOwnerSubmitting] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [statusSubmitting, setStatusSubmitting] = useState(false)
  const [sortConfig, setSortConfig] = useState<SortConfig>(DEFAULT_SORT)
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(100)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, pageSize: 100, total: 0, totalPages: 1 })
  const [tableBodyHeight, setTableBodyHeight] = useState<number>()
  const tableAreaNodeRef = useRef<HTMLDivElement | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [ticketDeleteTargets, setTicketDeleteTargets] = useState<TicketRow[]>([])
  const { showError, showSuccess } = useToasts()

  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    error: preferenceError,
    handleColumnsChange,
    pageSize: preferencePageSize,
    handlePageSizeChange: persistPageSizePreference,
    saveChangesOnModalClose
  } = useTablePreferences("tickets:list", TICKET_COLUMNS)

  const tableLoading = loading || preferenceLoading

  const sanitizeColumnFilters = useCallback(() => {
    return columnFilters
      .map(filter => ({
        columnId: filter?.columnId ?? "",
        value: filter?.value?.trim() ?? ""
      }))
      .filter(filter => filter.columnId && filter.value.length > 0)
  }, [columnFilters])

  const reloadTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))
      params.set("sortBy", sortConfig.columnId)
      params.set("sortDir", sortConfig.direction)
      params.set("status", statusFilter === "active" ? "active" : "all")
      if (searchQuery.trim().length > 0) {
        params.set("q", searchQuery.trim())
      }
      const normalizedFilters = sanitizeColumnFilters()
      if (normalizedFilters.length > 0) {
        params.set("columnFilters", JSON.stringify(normalizedFilters))
      }

      const response = await fetch(`/api/tickets?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load tickets")
      }

      const items: any[] = Array.isArray(payload?.data) ? payload.data : []
      const rows: TicketRow[] = items.map(item => ({
        id: String(item?.id ?? ""),
        distributorName: item?.distributorName ?? "",
        vendorName: item?.vendorName ?? "",
        issue: item?.issue ?? "",
        revenueScheduleId: item?.revenueScheduleId ?? "",
        revenueSchedule: item?.revenueSchedule ?? "",
        opportunityName: item?.opportunityName ?? "",
        productNameVendor: item?.productNameVendor ?? "",
        accountIdVendor: item?.accountIdVendor ?? "",
        customerIdVendor: item?.customerIdVendor ?? "",
        description: item?.description ?? "",
        opportunityId: item?.opportunityId ?? "",
        orderIdVendor: item?.orderIdVendor ?? "",
        ticketNumber: item?.ticketNumber ?? "",
        active: item?.active !== false,
        ownerName: item?.ownerName ?? "Unassigned"
      }))
      setTickets(rows)

      const paginationPayload = payload?.pagination
      if (paginationPayload) {
        setPagination({
          page: paginationPayload.page ?? page,
          pageSize: paginationPayload.pageSize ?? pageSize,
          total: paginationPayload.total ?? rows.length,
          totalPages: paginationPayload.totalPages ?? Math.max(1, Math.ceil(rows.length / pageSize))
        })
      } else {
        setPagination({
          page,
          pageSize,
          total: rows.length,
          totalPages: Math.max(1, Math.ceil(rows.length / pageSize))
        })
      }

      const visibleIds = new Set(rows.map(row => row.id))
      setSelectedTickets(prev => prev.filter(id => visibleIds.has(id)))
    } catch (err) {
      console.error("Failed to load tickets", err)
      const message = err instanceof Error ? err.message : "Unable to load tickets"
      setError(message)
      setTickets([])
      setPagination(prev => ({ ...prev, total: 0, totalPages: 1 }))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchQuery, statusFilter, sortConfig, sanitizeColumnFilters])

  useEffect(() => {
    reloadTickets().catch(() => undefined)
  }, [reloadTickets])

  useEffect(() => {
    if (!showOwnerModal) {
      return
    }
    setOwnerOptions([])
    setOwnersLoading(true)
    fetch("/api/admin/users?status=Active&limit=200", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load owners")
        }
        const rawUsers = payload?.data?.users ?? payload?.users ?? []
        const users: any[] = Array.isArray(rawUsers) ? rawUsers : []
        const options: BulkOwnerOption[] = users.map(user => ({
          value: user.id,
          label: user.fullName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
        }))
        setOwnerOptions(options)
      })
      .catch(err => {
        console.error("Failed to load owners", err)
        setOwnerOptions([])
        showError("Unable to load owners", err instanceof Error ? err.message : "Please try again later.")
      })
      .finally(() => setOwnersLoading(false))
  }, [showOwnerModal, showError])

  const measureTableArea = useCallback(() => {
    const node = tableAreaNodeRef.current
    if (!node || typeof window === "undefined") {
      return
    }

    const rect = node.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
    if (viewportHeight <= 0) return

    const available = viewportHeight - rect.top - TABLE_BOTTOM_RESERVE
    if (!Number.isFinite(available)) return

    const nextHeight = Math.max(TABLE_MIN_BODY_HEIGHT, Math.floor(available))
    if (nextHeight !== tableBodyHeight) {
      setTableBodyHeight(nextHeight)
    }
  }, [tableBodyHeight])

  const tableAreaRef = useCallback((node: HTMLDivElement | null) => {
    tableAreaNodeRef.current = node
    if (node) {
      REQUEST_ANIMATION_FRAME(() => measureTableArea())
    }
  }, [measureTableArea])

  useLayoutEffect(() => {
    measureTableArea()
  }, [measureTableArea])

  useEffect(() => {
    const handleResize = () => measureTableArea()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [measureTableArea])

  useEffect(() => {
    REQUEST_ANIMATION_FRAME(() => measureTableArea())
  }, [measureTableArea, tickets.length, page, pageSize])

  const openBulkDeleteDialog = useCallback(() => {
    if (selectedTickets.length === 0) {
      showError("No tickets selected", "Select at least one ticket to delete.")
      return
    }

    const selectedSet = new Set(selectedTickets)
    const targets = tickets.filter(ticket => selectedSet.has(ticket.id))
    if (targets.length === 0) {
      showError("Tickets unavailable", "Unable to locate the selected tickets on this page.")
      return
    }

    setTicketDeleteTargets(targets)
    setShowDeleteDialog(true)
  }, [selectedTickets, showError, tickets])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setPage(1)
  }, [])

  const handleStatusClick = useCallback((filter: 'active' | 'all') => {
    setStatusFilter(filter)
    setPage(1)
  }, [])

  const handleColumnFiltersChange = useCallback((filters: ColumnFilterState[]) => {
    setColumnFilters(filters ?? [])
    setPage(1)
  }, [])

  const handleSort = useCallback((columnId: string, direction: SortDirection) => {
    setSortConfig({ columnId, direction })
    setPage(1)
  }, [])

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
  }, [])

  const handlePageSizeChange = useCallback((nextPageSize: number) => {
    const normalized = normalizePageSize(nextPageSize)
    setPageSize(normalized)
    setPage(1)
    void persistPageSizePreference(normalized)
  }, [persistPageSizePreference])

  useEffect(() => {
    if (!preferencePageSize) return
    const normalized = normalizePageSize(preferencePageSize)
    if (normalized !== pageSize) {
      setPageSize(normalized)
      setPage(1)
    }
  }, [pageSize, preferencePageSize])

  const handleSelectTicket = useCallback((id: string, selected: boolean) => {
    setSelectedTickets(prev => selected ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter(x => x !== id))
  }, [])

  const handleSelectAllTickets = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedTickets(tickets.map(ticket => ticket.id))
    } else {
      setSelectedTickets([])
    }
  }, [tickets])

  const handleCreateTicket = () => {
    setShowCreateModal(true)
  }

  const deactivateTicketForDialog = useCallback(async (
    ticketId: string,
    _reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false })
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message = payload?.error ?? "Failed to deactivate ticket"
        showError("Failed to deactivate ticket", message)
        return { success: false, error: message }
      }

      setTickets(previous =>
        previous.map(ticket => (ticket.id === ticketId ? { ...ticket, active: false } : ticket))
      )
      showSuccess("Ticket deactivated", "The ticket was marked inactive.")
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to deactivate ticket"
      showError("Failed to deactivate ticket", message)
      return { success: false, error: message }
    }
  }, [showError, showSuccess])

  const bulkDeactivateTicketsForDialog = useCallback(async (
    entities: Array<{ id: string; name: string }>,
    _reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!entities || entities.length === 0) {
      return { success: false, error: "No tickets selected" }
    }

    const ids = entities.map(entity => entity.id)
    const responses = await Promise.allSettled(
      ids.map(async id => {
        const response = await fetch(`/api/tickets/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: false })
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? "Failed to deactivate ticket")
        }
        return id
      })
    )

    const successIds = responses
      .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
      .map(result => result.value)
    const failedCount = responses.length - successIds.length

    if (successIds.length > 0) {
      const successSet = new Set(successIds)
      setTickets(previous =>
        previous.map(ticket => (successSet.has(ticket.id) ? { ...ticket, active: false } : ticket))
      )
      showSuccess(
        `Marked ${successIds.length} ticket${successIds.length === 1 ? "" : "s"} inactive`,
        "Inactive tickets can be deleted if needed."
      )
    }

    if (failedCount > 0) {
      const message = `${failedCount} ticket${failedCount === 1 ? "" : "s"} could not be deactivated.`
      showError("Some tickets could not be deactivated", message)
      return { success: false, error: message }
    }

    return { success: true }
  }, [showError, showSuccess])

  const deleteTicketRequest = useCallback(async (
    ticketId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, { method: "DELETE" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        return { success: false, error: payload?.error ?? "Failed to delete ticket" }
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unable to delete ticket" }
    }
  }, [])

  const deleteTicketForDialog = useCallback(async (
    ticketId: string,
    _bypassConstraints?: boolean,
    _reason?: string
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    const result = await deleteTicketRequest(ticketId)
    return result.success ? { success: true } : { success: false, error: result.error }
  }, [deleteTicketRequest])

  const bulkDeleteTicketsForDialog = useCallback(async (
    entities: Array<{ id: string; name: string }>,
    _bypassConstraints?: boolean,
    _reason?: string
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    if (!entities || entities.length === 0) {
      return { success: false, error: "No tickets selected" }
    }

    const ids = entities.map(entity => entity.id)
    const results = await Promise.allSettled(ids.map(id => deleteTicketRequest(id)))

    const successIds: string[] = []
    const failures: Array<{ id: string; name: string; message: string }> = []
    results.forEach((result, index) => {
      const id = ids[index]
      const name = entities[index]?.name || id.slice(0, 8) + "..."
      if (result.status === "fulfilled" && result.value.success) {
        successIds.push(id)
        return
      }
      const message =
        result.status === "fulfilled"
          ? (result.value.error || "Failed to delete ticket")
          : (result.reason instanceof Error ? result.reason.message : "Failed to delete ticket")
      failures.push({ id, name, message })
    })

    if (successIds.length > 0) {
      showSuccess(
        `Deleted ${successIds.length} ticket${successIds.length === 1 ? "" : "s"}`,
        "The selected tickets have been removed."
      )
      setSelectedTickets(previous => previous.filter(id => !successIds.includes(id)))
      await reloadTickets()
    }

    if (failures.length > 0) {
      const detail = failures.slice(0, 5).map(item => `${item.name}: ${item.message}`).join("; ")
      const message = failures.length > 5 ? `${detail}; and ${failures.length - 5} more` : detail
      showError("Some tickets could not be deleted", message)
      return { success: false, error: message }
    }

    return { success: true }
  }, [deleteTicketRequest, reloadTickets, showError, showSuccess])

  const handleBulkReassign = useCallback(() => {
    if (selectedTickets.length === 0) {
      showError("No tickets selected", "Select at least one ticket to reassign.")
      return
    }
    setShowOwnerModal(true)
  }, [selectedTickets, showError])

  const handleBulkStatus = useCallback(() => {
    if (selectedTickets.length === 0) {
      showError("No tickets selected", "Select at least one ticket to update status.")
      return
    }
    setShowStatusModal(true)
  }, [selectedTickets, showError])

  const handleOwnerSubmit = useCallback(
    async (ownerId: string | null) => {
      if (ownerSubmitting) {
        return
      }
      if (selectedTickets.length === 0) {
        setShowOwnerModal(false)
        return
      }
      setOwnerSubmitting(true)
      const selectedSet = new Set(selectedTickets)
      const selectedCount = selectedSet.size
      const ownerLabel = ownerId
        ? ownerOptions.find(option => option.value === ownerId)?.label || "Selected owner"
        : "Unassigned"
      setTickets(prev =>
        prev.map(ticket =>
          selectedSet.has(ticket.id)
            ? { ...ticket, ownerName: ownerId ? ownerLabel : "Unassigned" }
            : ticket
        )
      )
      setOwnerSubmitting(false)
      setShowOwnerModal(false)
      setSelectedTickets([])
      showSuccess(
        "Owner updated",
        `${selectedCount} ticket${selectedCount === 1 ? "" : "s"} assigned to ${ownerLabel}.`
      )
    },
    [ownerOptions, ownerSubmitting, selectedTickets, showSuccess]
  )

  const handleStatusSubmit = useCallback(
    async (isActive: boolean) => {
      if (statusSubmitting) {
        return
      }
      if (selectedTickets.length === 0) {
        setShowStatusModal(false)
        return
      }
      setStatusSubmitting(true)
      const selectedSet = new Set(selectedTickets)
      const selectedCount = selectedSet.size
      setTickets(prev =>
        prev.map(ticket =>
          selectedSet.has(ticket.id)
            ? { ...ticket, active: isActive }
            : ticket
        )
      )
      setStatusSubmitting(false)
      setShowStatusModal(false)
      setSelectedTickets([])
      showSuccess(
        "Status updated",
        `Marked ${selectedCount} ticket${selectedCount === 1 ? "" : "s"} as ${isActive ? "Active" : "Inactive"}.`
      )
    },
    [selectedTickets, showSuccess, statusSubmitting]
  )

  const handleBulkExport = useCallback(() => {
    if (selectedTickets.length === 0) {
      showError("No tickets selected", "Select at least one ticket to export.")
      return
    }
    console.log("Bulk export tickets", selectedTickets)
    showSuccess("Export queued", "Bulk export for tickets is not yet implemented.")
  }, [selectedTickets, showError, showSuccess])

  const tableColumns = useMemo(() => {
    return preferenceColumns.map(column => {
      if (column.id === 'multi-action') {
        return {
          ...column,
          render: (_: unknown, row: TicketRow) => {
            const rowId = row.id
            const checked = selectedTickets.includes(rowId)
            return (
              <div className="flex items-center" data-disable-row-click="true">
                <label className="flex cursor-pointer items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    aria-label={`Select ticket ${rowId}`}
                    onChange={() => handleSelectTicket(rowId, !checked)}
                    disabled={tableLoading}
                  />
                  <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'
                  }`}>
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
              </div>
            )
          }
        }
      }

      if (column.id === 'distributorName' || column.id === 'vendorName' || column.id === 'opportunityName') {
        return {
          ...column,
          render: (value: any) => (
            <span className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
              {value}
            </span>
          )
        }
      }

      if (column.id === 'revenueSchedule') {
        return {
          ...column,
          render: (value: any, row: TicketRow) => {
            const scheduleId = row.revenueScheduleId
            if (!scheduleId) {
              return <span>{value}</span>
            }
            return (
              <a
                href={`/revenue-schedules/${scheduleId}`}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {value}
              </a>
            )
          }
        }
      }

      if (column.id === 'ticketNumber') {
        return {
          ...column,
          render: (value: any, row: TicketRow) => {
            const ticketId = row.id
            if (!ticketId) {
              return <span>{value}</span>
            }
            const display = value || row.ticketNumber || ticketId
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

      if (column.id === 'status') {
        return {
          ...column,
          render: (_: unknown, row: TicketRow) => (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              row.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {row.active ? 'Active' : 'Inactive'}
            </span>
          )
        }
      }

      return column
    })
  }, [preferenceColumns, selectedTickets, handleSelectTicket, tableLoading])

  return (
    <div className="dashboard-page-container">
      <ListHeader
        pageTitle="TICKETS LIST"
        searchPlaceholder="Search tickets..."
        onSearch={handleSearch}
        onFilterChange={() => {}}
        onCreateClick={handleCreateTicket}
        onSettingsClick={() => setShowColumnSettings(true)}
        filterColumns={TICKET_FILTER_COLUMNS}
        columnFilters={columnFilters}
        onColumnFiltersChange={handleColumnFiltersChange}
        showStatusFilter={false}
        leftAccessory={
          <AccountStatusFilterDropdown
            value={statusFilter === 'active' ? 'active' : 'all'}
            options={["active", "all"]}
            onChange={(next) => handleStatusClick(next === "inactive" ? "all" : next)}
            labels={{ active: 'Active', all: 'Show All' }}
          />
        }
        bulkActions={buildStandardBulkActions({
          selectedCount: selectedTickets.length,
          isBusy: tableLoading,
          entityLabelPlural: "tickets",
          onDelete: openBulkDeleteDialog,
          onReassign: handleBulkReassign,
          onStatus: handleBulkStatus,
          onExport: handleBulkExport,
          disableDelete: selectedTickets.length === 0,
        })}
      />

      {preferenceError && (
        <div className="px-4 text-sm text-red-600">{preferenceError}</div>
      )}

      {error && (
        <div className="px-4 text-sm text-red-600">{error}</div>
      )}

      <div ref={tableAreaRef} className="flex-1 min-h-0 px-4 pb-4">
        <DynamicTable
          columns={tableColumns}
          data={tickets}
          onSort={handleSort}
          loading={tableLoading}
          emptyMessage={tableLoading ? "Loading tickets..." : "No tickets found"}
          onColumnsChange={handleColumnsChange}
          selectedItems={selectedTickets}
          onItemSelect={(id, selected) => handleSelectTicket(id, selected)}
          onSelectAll={handleSelectAllTickets}
          pagination={pagination}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          autoSizeColumns={false}
          alwaysShowPagination
          maxBodyHeight={tableBodyHeight}
        />
      </div>

      <ColumnChooserModal
        isOpen={showColumnSettings}
        columns={preferenceColumns}
        onApply={handleColumnsChange}
        onClose={async () => {
          setShowColumnSettings(false)
          await saveChangesOnModalClose()
        }}
      />

      <BulkOwnerModal
        isOpen={showOwnerModal}
        owners={ownerOptions}
        entityLabel="tickets"
        isLoading={ownersLoading}
        isSubmitting={ownerSubmitting}
        onClose={() => {
          if (ownerSubmitting) {
            return
          }
          setShowOwnerModal(false)
        }}
        onSubmit={handleOwnerSubmit}
      />

      <BulkStatusModal
        isOpen={showStatusModal}
        entityLabel="tickets"
        isSubmitting={statusSubmitting}
        onClose={() => {
          if (statusSubmitting) {
            return
          }
          setShowStatusModal(false)
        }}
        onSubmit={handleStatusSubmit}
      />

      <TicketCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          reloadTickets().catch(() => undefined)
        }}
      />

      <TwoStageDeleteDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false)
          setTicketDeleteTargets([])
        }}
        entity="Ticket"
        entityName={
          ticketDeleteTargets.length > 0
            ? `${ticketDeleteTargets.length} ticket${ticketDeleteTargets.length === 1 ? "" : "s"}`
            : "Ticket"
        }
        entityId={ticketDeleteTargets[0]?.id ?? ""}
        multipleEntities={
          ticketDeleteTargets.length > 0
            ? ticketDeleteTargets.map(ticket => ({
                id: ticket.id,
                name: ticket.issue || ticket.ticketNumber || "Ticket",
                subtitle: ticket.ownerName ? `Owner: ${ticket.ownerName}` : undefined
              }))
            : undefined
        }
        entityLabelPlural="Tickets"
        isDeleted={false}
        onDeactivate={deactivateTicketForDialog}
        onBulkDeactivate={bulkDeactivateTicketsForDialog}
        onSoftDelete={deleteTicketForDialog}
        onBulkSoftDelete={bulkDeleteTicketsForDialog}
        onPermanentDelete={async (id, reason) => {
          const result = await deleteTicketForDialog(id, undefined, reason)
          return result.success ? { success: true } : { success: false, error: result.error }
        }}
        userCanPermanentDelete={false}
        disallowActiveDelete={ticketDeleteTargets.some(ticket => !!ticket.active)}
        modalSize="revenue-schedules"
        requireReason
        note="Tickets must be inactive before they can be deleted. Use Action = Deactivate to mark them inactive."
      />
    </div>
  )
}
