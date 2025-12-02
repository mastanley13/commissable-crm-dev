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

interface TicketRow {
  id: string
  distributorName: string
  vendorName: string
  issue: string
  revenueSchedule: string
  opportunityName: string
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

const TICKET_FILTER_COLUMNS = [
  { id: 'distributorName', label: 'Distributor Name' },
  { id: 'vendorName', label: 'Vendor Name' },
  { id: 'issue', label: 'Issue' },
  { id: 'revenueSchedule', label: 'Revenue Schedule' },
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
    label: 'Revenue Schedule',
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
  const [pageSize, setPageSize] = useState<number>(25)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, pageSize: 25, total: 0, totalPages: 1 })
  const [tableBodyHeight, setTableBodyHeight] = useState<number>()
  const tableAreaNodeRef = useRef<HTMLDivElement | null>(null)
  const { showError, showSuccess } = useToasts()

  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    error: preferenceError,
    handleColumnsChange,
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
        revenueSchedule: item?.revenueSchedule ?? "",
        opportunityName: item?.opportunityName ?? "",
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

  const hasInactiveSelectedTickets = selectedTickets.some(id => {
    const row = tickets.find(ticket => ticket.id === id)
    return row && !row.active
  })

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
    setPageSize(nextPageSize)
    setPage(1)
  }, [])

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
    showError("Not implemented", "Ticket creation is not available yet.")
  }

  const handleBulkDelete = useCallback(() => {
    if (selectedTickets.length === 0) {
      showError("No tickets selected", "Select at least one ticket to delete.")
      return
    }
    const ticketMap = new Map(tickets.map(ticket => [ticket.id, ticket]))
    const inactiveIds = selectedTickets.filter(id => {
      const row = ticketMap.get(id)
      return row && !row.active
    })
    if (inactiveIds.length === 0) {
      showError("Only inactive items can be deleted", "Mark the selected tickets inactive before deleting.")
      return
    }
    const confirmed = typeof window === "undefined"
      ? true
      : window.confirm(`Delete ${inactiveIds.length} inactive ticket${inactiveIds.length === 1 ? "" : "s"}? This can't be undone.`)
    if (!confirmed) {
      return
    }
    const inactiveSet = new Set(inactiveIds)
    setTickets(prev => prev.filter(ticket => !inactiveSet.has(ticket.id)))
    setSelectedTickets(prev => prev.filter(id => !inactiveSet.has(id)))
    setPagination(prev => {
      const nextTotal = Math.max(0, prev.total - inactiveIds.length)
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / prev.pageSize))
      const nextPage = Math.min(prev.page, nextTotalPages)
      if (nextPage !== prev.page) {
        setPage(nextPage)
      }
      return {
        ...prev,
        total: nextTotal,
        totalPages: nextTotalPages,
        page: nextPage
      }
    })
    showSuccess("Tickets deleted", `${inactiveIds.length} ticket${inactiveIds.length === 1 ? "" : "s"} removed.`)
  }, [selectedTickets, showError, showSuccess, tickets])

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
  }, [preferenceColumns, selectedTickets, handleSelectTicket, tableLoading, tickets])

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
            onChange={(next) => handleStatusClick(next)}
            labels={{ active: 'Active', all: 'Show All' }}
          />
        }
        bulkActions={buildStandardBulkActions({
          selectedCount: selectedTickets.length,
          isBusy: tableLoading,
          entityLabelPlural: "tickets",
          onDelete: handleBulkDelete,
          onReassign: handleBulkReassign,
          onStatus: handleBulkStatus,
          onExport: handleBulkExport,
          disableDelete: !hasInactiveSelectedTickets,
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
    </div>
  )
}
