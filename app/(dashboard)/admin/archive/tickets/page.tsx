'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, Download, RotateCcw, Trash2 } from 'lucide-react'
import { AccountStatusFilterDropdown } from '@/components/account-status-filter-dropdown'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { ListHeader, type ColumnFilter as ListColumnFilter } from '@/components/list-header'
import { CopyProtectionWrapper } from '@/components/copy-protection'
import { DynamicTable, type Column, type PaginationInfo } from '@/components/dynamic-table'
import { TwoStageDeleteDialog } from '@/components/two-stage-delete-dialog'
import { useAuth } from '@/lib/auth-context'
import { useToasts } from '@/components/toast'
import { useTablePreferences } from '@/hooks/useTablePreferences'

type TicketArchiveRow = {
  id: string
  ticketNumber?: string
  distributorName: string
  vendorName: string
  issue: string
  status: string
  dueDate?: string | null
  assignedToName?: string
  requestorName?: string
  revenueSchedule?: string
  opportunityName?: string
  active: boolean
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString()
}

function escapeCsv(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

type SortState = { columnId: string; direction: 'asc' | 'desc' }

const TABLE_BOTTOM_RESERVE = 110
const TABLE_MIN_BODY_HEIGHT = 320

const ARCHIVE_TICKET_BASE_COLUMNS: Column[] = [
  { id: 'select', label: 'Select', width: 110, minWidth: 80, maxWidth: 220, type: 'checkbox', hideable: false },
  { id: 'ticketNumber', label: 'Ticket #', width: 160, minWidth: 120, maxWidth: 240, sortable: true, hideable: false },
  { id: 'issue', label: 'Issue', width: 280, minWidth: 200, maxWidth: 420, sortable: true },
  { id: 'distributorName', label: 'Distributor', width: 220, minWidth: 160, maxWidth: 320, sortable: true },
  { id: 'vendorName', label: 'Vendor', width: 220, minWidth: 160, maxWidth: 320, sortable: true },
  { id: 'owner', label: 'Owner', width: 200, minWidth: 150, maxWidth: 300, sortable: true, accessor: 'assignedToName' },
  { id: 'dueDate', label: 'Closed On', width: 150, minWidth: 120, maxWidth: 220, sortable: true },
  { id: 'status', label: 'Status', width: 150, minWidth: 120, maxWidth: 220, sortable: true, hidden: true },
  { id: 'revenueSchedule', label: 'Revenue Schedule', width: 180, minWidth: 140, maxWidth: 260, sortable: true, hidden: true },
  { id: 'opportunityName', label: 'Opportunity', width: 240, minWidth: 180, maxWidth: 360, sortable: true, hidden: true },
]

const ARCHIVE_TICKET_FILTER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'ticketNumber', label: 'Ticket #' },
  { id: 'issue', label: 'Issue' },
  { id: 'distributorName', label: 'Distributor Name' },
  { id: 'vendorName', label: 'Vendor Name' },
  { id: 'owner', label: 'Owner' },
  { id: 'requestor', label: 'Requestor' },
  { id: 'status', label: 'Ticket Status' },
  { id: 'revenueSchedule', label: 'Revenue Schedule Name' },
  { id: 'opportunityName', label: 'Opportunity Name' },
]

export default function AdminArchivedTicketsPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()
  const router = useRouter()

  const canManageArchive =
    hasPermission('tickets.view.all') || hasPermission('tickets.edit.all') || hasPermission('tickets.delete') || hasPermission('accounts.manage')
  const userCanRestore = hasPermission('tickets.edit.all') || hasPermission('tickets.delete')
  const userCanPermanentDelete = hasPermission('tickets.delete')

  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    saving: preferenceSaving,
    error: preferenceError,
    pageSize: preferencePageSize,
    hasUnsavedChanges,
    lastSaved,
    handleColumnsChange,
    handlePageSizeChange: persistPageSizeChange,
    saveChanges,
    saveChangesOnModalClose,
  } = useTablePreferences('tickets:archive', ARCHIVE_TICKET_BASE_COLUMNS, { defaultPageSize: 25 })

  const [tickets, setTickets] = useState<TicketArchiveRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalRecords, setTotalRecords] = useState(0)
  const [viewFilter, setViewFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [sortState, setSortState] = useState<SortState | null>(null)
  const [columnFilters, setColumnFilters] = useState<ListColumnFilter[]>([])
  const [tableBodyHeight, setTableBodyHeight] = useState<number>()
  const tableAreaNodeRef = useRef<HTMLDivElement | null>(null)

  const [showColumnSettings, setShowColumnSettings] = useState(false)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [ticketToDelete, setTicketToDelete] = useState<TicketArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<TicketArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / preferencePageSize))
    return { page, pageSize: preferencePageSize, total: totalRecords, totalPages }
  }, [page, preferencePageSize, totalRecords])

  const reloadTickets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      if (viewFilter === 'active') {
        params.set('status', 'inactive')
      } else if (viewFilter === 'inactive') {
        params.set('status', 'active')
      } else {
        params.set('status', 'all')
      }

      params.set('page', String(page))
      params.set('pageSize', String(preferencePageSize))
      if (searchQuery.trim().length > 0) {
        params.set('q', searchQuery.trim())
      }

      if (sortState) {
        params.set('sortBy', sortState.columnId)
        params.set('sortDir', sortState.direction)
      }

      const sanitizedFilters = columnFilters
        .filter((filter) => filter && typeof filter.columnId === 'string')
        .map((filter) => ({
          columnId: String(filter.columnId),
          value: typeof filter.value === 'string' ? filter.value.trim() : String(filter.value ?? '').trim(),
        }))
        .filter((filter) => filter.columnId.length > 0 && filter.value.length > 0)

      if (sanitizedFilters.length > 0) {
        params.set('columnFilters', JSON.stringify(sanitizedFilters))
      }

      const response = await fetch(`/api/tickets?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load archived tickets')
      }

      const rows: TicketArchiveRow[] = Array.isArray(payload?.data) ? payload.data : []
      const total = typeof payload?.pagination?.total === 'number' ? payload.pagination.total : rows.length
      setTickets(rows)
      setTotalRecords(total)
      setSelectedIds([])
      setBulkDeleteTargets([])
      setError(null)
    } catch (err) {
      console.error(err)
      setTickets([])
      setSelectedIds([])
      setBulkDeleteTargets([])
      setTotalRecords(0)
      setError('Unable to load archived tickets')
    } finally {
      setLoading(false)
    }
  }, [columnFilters, page, preferencePageSize, searchQuery, sortState, viewFilter])

  useEffect(() => {
    if (!canManageArchive) return
    reloadTickets().catch(console.error)
  }, [canManageArchive, reloadTickets])

  const measureTableArea = useCallback(() => {
    const node = tableAreaNodeRef.current
    if (!node || typeof window === 'undefined') return

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

  const tableAreaRef = useCallback(
    (node: HTMLDivElement | null) => {
      tableAreaNodeRef.current = node
      if (node && typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          measureTableArea()
        })
      }
    },
    [measureTableArea],
  )

  useLayoutEffect(() => {
    measureTableArea()
  }, [measureTableArea])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => measureTableArea()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [measureTableArea])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.requestAnimationFrame(() => {
      measureTableArea()
    })
  }, [measureTableArea, tickets.length, selectedIds.length, loading, preferenceLoading, page, preferencePageSize, viewFilter])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setPage(1)
  }, [])

  const handleViewFilterChange = useCallback((next: 'active' | 'inactive' | 'all') => {
    setViewFilter(next)
    setSelectedIds([])
    setPage(1)
  }, [])

  const handleColumnFiltersChange = useCallback((filters: ListColumnFilter[]) => {
    setColumnFilters(filters)
    setPage(1)
  }, [])

  const handleSort = useCallback((columnId: string, direction: 'asc' | 'desc') => {
    setSortState({ columnId, direction })
    setPage(1)
  }, [])

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
  }, [])

  const handlePageSizeChange = useCallback((nextPageSize: number) => {
    persistPageSizeChange(nextPageSize)
    setPage(1)
  }, [persistPageSizeChange])

  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((previous) => {
      if (selected) {
        return previous.includes(id) ? previous : [...previous, id]
      }
      return previous.filter((existing) => existing !== id)
    })
  }, [])

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedIds(tickets.map((row) => row.id))
      return
    }
    setSelectedIds([])
  }, [tickets])

  const handleRowClick = useCallback(
    (row: TicketArchiveRow) => {
      if (!row?.id) return
      router.push(`/tickets/${row.id}`)
    },
    [router],
  )

  const restoreTicketRequest = useCallback(async (ticketId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        return { success: false, error: payload?.error ?? 'Failed to reopen ticket' }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to reopen ticket' }
    }
  }, [])

  const handleRestore = useCallback(async (ticketId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await restoreTicketRequest(ticketId)
    if (result.success) {
      setTickets((previous) => previous.filter((row) => row.id !== ticketId))
      setSelectedIds((previous) => previous.filter((id) => id !== ticketId))
      showSuccess('Ticket reopened', 'The ticket was reopened and removed from Archive.')
    }
    return result
  }, [restoreTicketRequest, showSuccess])

  const handleBulkRestore = useCallback(async () => {
    if (!userCanRestore) return
    if (selectedIds.length === 0) {
      showError('No tickets selected', 'Select at least one archived ticket to reopen.')
      return
    }

    setBulkActionLoading(true)
    try {
      const targets = tickets.filter((row) => selectedIds.includes(row.id))
      const results = await Promise.allSettled(targets.map((row) => restoreTicketRequest(row.id)))
      const restoredIds: string[] = []
      const failures: Array<{ ticket: TicketArchiveRow; message: string }> = []

      results.forEach((result, index) => {
        const ticket = targets[index]
        if (!ticket) return
        if (result.status === 'fulfilled' && result.value.success) {
          restoredIds.push(ticket.id)
          return
        }
        const message =
          result.status === 'fulfilled'
            ? result.value.error || 'Failed to reopen ticket'
            : result.reason instanceof Error
              ? result.reason.message
              : 'Failed to reopen ticket'
        failures.push({ ticket, message })
      })

      if (restoredIds.length > 0) {
        const restoredSet = new Set(restoredIds)
        setTickets((previous) => previous.filter((row) => !restoredSet.has(row.id)))
        setSelectedIds((previous) => previous.filter((id) => !restoredSet.has(id)))
        showSuccess(
          `Reopened ${restoredIds.length} ticket${restoredIds.length === 1 ? '' : 's'}`,
          'Reopened tickets were removed from Archive.',
        )
      }

      if (failures.length > 0) {
        const message = failures.slice(0, 3).map((f) => `${f.ticket.ticketNumber || 'Ticket'}: ${f.message}`).join('; ')
        showError('Some reopens failed', message)
      }
    } finally {
      setBulkActionLoading(false)
    }
  }, [restoreTicketRequest, selectedIds, showError, showSuccess, tickets, userCanRestore])

  const handlePermanentDelete = useCallback(async (ticketId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        return { success: false, error: payload?.error ?? 'Failed to permanently delete ticket' }
      }
      setTickets((previous) => previous.filter((row) => row.id !== ticketId))
      setSelectedIds((previous) => previous.filter((id) => id !== ticketId))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to permanently delete ticket' }
    }
  }, [])

  const requestRowDeletion = useCallback((row: TicketArchiveRow) => {
    setTicketToDelete(row)
    setBulkDeleteTargets([])
    setShowDeleteDialog(true)
  }, [])

  const openBulkPermanentDeleteDialog = useCallback(() => {
    if (selectedIds.length === 0) {
      showError('No tickets selected', 'Select at least one archived ticket to permanently delete.')
      return
    }
    const targets = tickets.filter((row) => selectedIds.includes(row.id))
    setBulkDeleteTargets(targets)
    setTicketToDelete(null)
    setShowDeleteDialog(true)
  }, [selectedIds, showError, tickets])

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false)
    setTicketToDelete(null)
    setBulkDeleteTargets([])
  }

  const handleBulkExportCsv = useCallback(() => {
    const selectedSet = new Set(selectedIds)
    const rows = selectedIds.length > 0 ? tickets.filter((row) => selectedSet.has(row.id)) : tickets
    if (rows.length === 0) {
      showError('Nothing to export', 'Select at least one ticket or adjust filters before exporting.')
      return
    }

    const header = [
      'id',
      'ticketNumber',
      'issue',
      'distributorName',
      'vendorName',
      'owner',
      'status',
      'dueDate',
      'revenueSchedule',
      'opportunityName',
    ]
    const lines = [
      header.join(','),
      ...rows.map((row) =>
        [
          row.id,
          row.ticketNumber ?? '',
          row.issue,
          row.distributorName,
          row.vendorName,
          row.assignedToName ?? '',
          row.status,
          row.dueDate ?? '',
          row.revenueSchedule ?? '',
          row.opportunityName ?? '',
        ]
          .map(escapeCsv)
          .join(','),
      ),
    ]

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    link.download = `tickets-${viewFilter === 'active' ? 'archived' : viewFilter}-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showSuccess('Export complete', 'Check your downloads for the CSV file.')
  }, [selectedIds, showError, showSuccess, tickets, viewFilter])

  const bulkActions = useMemo(() => {
    return {
      selectedCount: selectedIds.length,
      isBusy: bulkActionLoading,
      entityName: 'tickets',
      actions: [
        {
          key: 'restore',
          label: 'Reopen',
          icon: RotateCcw,
          tone: 'primary' as const,
          onClick: handleBulkRestore,
          tooltip: (count: number) => `Reopen ${count} archived ticket${count === 1 ? '' : 's'}`,
          disabled: !userCanRestore,
        },
        {
          key: 'export',
          label: 'Export CSV',
          icon: Download,
          tone: 'info' as const,
          onClick: handleBulkExportCsv,
          tooltip: (count: number) => `Export ${count} ticket${count === 1 ? '' : 's'} to CSV`,
          disabled: selectedIds.length === 0,
        },
        {
          key: 'permanent-delete',
          label: 'Delete Permanently',
          icon: Trash2,
          tone: 'danger' as const,
          onClick: openBulkPermanentDeleteDialog,
          tooltip: (count: number) => `Permanently delete ${count} archived ticket${count === 1 ? '' : 's'}`,
          disabled: !userCanPermanentDelete,
        },
      ],
    }
  }, [
    bulkActionLoading,
    handleBulkExportCsv,
    handleBulkRestore,
    openBulkPermanentDeleteDialog,
    selectedIds.length,
    userCanPermanentDelete,
    userCanRestore,
  ])

  const tableColumns: Column[] = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === 'select') {
        return {
          ...column,
          render: (_value: unknown, row: TicketArchiveRow) => {
            const checked = selectedIds.includes(row.id)
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`Select ticket ${row.ticketNumber || row.id}`}
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
                    checked
                      ? 'border-primary-500 bg-primary-600 text-white'
                      : 'border-gray-300 bg-white text-transparent'
                  }`}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleSelect(row.id, !checked)
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <Check className="h-3 w-3" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="p-1 rounded transition-colors text-emerald-600 hover:text-emerald-800 disabled:cursor-not-allowed disabled:text-gray-300"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    void handleRestore(row.id)
                  }}
                  disabled={!userCanRestore}
                  aria-label="Reopen ticket"
                  title={userCanRestore ? 'Reopen ticket' : 'Insufficient permissions'}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="p-1 rounded transition-colors text-red-500 hover:text-red-700 disabled:cursor-not-allowed disabled:text-gray-300"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    requestRowDeletion(row)
                  }}
                  disabled={!userCanPermanentDelete}
                  aria-label="Permanently delete ticket"
                  title={userCanPermanentDelete ? 'Permanently delete' : 'Insufficient permissions'}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )
          },
        }
      }

      if (column.id === 'ticketNumber') {
        return {
          ...column,
          render: (value: string, row: TicketArchiveRow) => (
            <Link href={`/tickets/${row.id}`} className="text-blue-600 hover:underline">
              {value || row.id.slice(0, 8).toUpperCase()}
            </Link>
          ),
        }
      }

      if (column.id === 'dueDate') {
        return { ...column, render: (value: string | null | undefined) => formatDate(value) || '--' }
      }

      return column
    })
  }, [handleRestore, handleSelect, preferenceColumns, requestRowDeletion, selectedIds, userCanPermanentDelete, userCanRestore])

  const pageTitle = useMemo(() => {
    if (viewFilter === 'inactive') return 'ACTIVE TICKETS'
    if (viewFilter === 'all') return 'ALL TICKETS'
    return 'ARCHIVED TICKETS'
  }, [viewFilter])

  const searchPlaceholder = useMemo(() => {
    if (viewFilter === 'inactive') return 'Search active tickets...'
    if (viewFilter === 'all') return 'Search all tickets...'
    return 'Search archived tickets...'
  }, [viewFilter])

  const emptyMessage = useMemo(() => {
    if (viewFilter === 'inactive') return 'No active tickets found'
    if (viewFilter === 'all') return 'No tickets found'
    return 'No archived tickets found'
  }, [viewFilter])

  if (!canManageArchive) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Archived Tickets</h1>
        <p className="mt-2 text-sm text-gray-600">Access denied. You do not have permission to view archived tickets.</p>
        {user?.role?.name ? <p className="mt-2 text-xs text-gray-500">Role: {user.role.name}</p> : null}
      </div>
    )
  }

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
        pageTitle={pageTitle}
        searchPlaceholder={searchPlaceholder}
        onSearch={handleSearch}
        showStatusFilter={false}
        leftAccessory={
          <AccountStatusFilterDropdown
            value={viewFilter}
            options={['active', 'inactive', 'all']}
            labels={{ active: 'Archived', inactive: 'Active', all: 'All' }}
            onChange={handleViewFilterChange}
          />
        }
        showColumnFilters
        filterColumns={ARCHIVE_TICKET_FILTER_OPTIONS}
        columnFilters={columnFilters}
        onColumnFiltersChange={handleColumnFiltersChange}
        showCreateButton={false}
        onSettingsClick={() => setShowColumnSettings(true)}
        hasUnsavedTableChanges={hasUnsavedChanges}
        isSavingTableChanges={preferenceSaving}
        lastTableSaved={lastSaved || undefined}
        onSaveTableChanges={saveChanges}
        bulkActions={bulkActions}
      />

      <div className="flex-1 min-h-0 p-4 pt-0 flex flex-col gap-4">
        {(error || preferenceError) ? <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error || preferenceError}</div> : null}

        <div ref={tableAreaRef} className="flex-1 min-h-0">
          <DynamicTable
            columns={tableColumns}
            data={tickets}
            onSort={handleSort}
            onRowClick={handleRowClick}
            loading={loading || preferenceLoading}
            emptyMessage={emptyMessage}
            onColumnsChange={handleColumnsChange}
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            selectedItems={selectedIds}
            onItemSelect={handleSelect}
            onSelectAll={handleSelectAll}
            fillContainerWidth
            autoSizeColumns={false}
            alwaysShowPagination
            hasLoadedPreferences={!preferenceLoading}
            maxBodyHeight={tableBodyHeight}
          />
        </div>
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

      <TwoStageDeleteDialog
        isOpen={showDeleteDialog}
        onClose={closeDeleteDialog}
        entity="Ticket"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} ticket${bulkDeleteTargets.length === 1 ? '' : 's'}`
            : ticketToDelete?.ticketNumber || ticketToDelete?.issue || 'Unknown Ticket'
        }
        entityId={bulkDeleteTargets.length > 0 ? bulkDeleteTargets[0]?.id || '' : ticketToDelete?.id || ''}
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((ticket) => ({ id: ticket.id, name: ticket.ticketNumber || ticket.issue || 'Ticket' }))
            : undefined
        }
        entityLabelPlural="Tickets"
        isDeleted={true}
        onSoftDelete={async () => ({ success: false, error: 'Archived tickets cannot be soft deleted again.' })}
        onPermanentDelete={handlePermanentDelete}
        onRestore={userCanRestore ? handleRestore : undefined}
        userCanPermanentDelete={userCanPermanentDelete}
        modalSize="revenue-schedules"
        note="Legend: Archived tickets are closed/resolved. Reopen will return them to the active Tickets list. Permanent delete is irreversible."
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}
