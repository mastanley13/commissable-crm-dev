'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, Download, RotateCcw, Trash2 } from 'lucide-react'
import { AccountStatusFilterDropdown } from '@/components/account-status-filter-dropdown'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { CopyProtectionWrapper } from '@/components/copy-protection'
import { DynamicTable, type Column, type PaginationInfo } from '@/components/dynamic-table'
import { ListHeader, type ColumnFilter as ListColumnFilter } from '@/components/list-header'
import { TwoStageDeleteDialog } from '@/components/two-stage-delete-dialog'
import { useToasts } from '@/components/toast'
import { useAuth } from '@/lib/auth-context'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { calculateMinWidth } from '@/lib/column-width-utils'

type RevenueScheduleArchiveRow = {
  id: string
  revenueScheduleName: string
  revenueScheduleDate?: string | null
  accountName?: string | null
  accountId?: string | null
  distributorId?: string | null
  distributorName?: string | null
  vendorId?: string | null
  vendorName?: string | null
  productId?: string | null
  productNameVendor?: string | null
  scheduleStatus?: string
  deletedAt?: string | null
  opportunityId?: string | null
  opportunityName?: string | null
}

type SortState = { columnId: string; direction: 'asc' | 'desc' }

const TABLE_BOTTOM_RESERVE = 110
const TABLE_MIN_BODY_HEIGHT = 320

const ARCHIVE_REVENUE_SCHEDULE_BASE_COLUMNS: Column[] = [
  { id: 'select', label: 'Select', width: 110, minWidth: calculateMinWidth({ label: 'Select', type: 'checkbox', sortable: false }), maxWidth: 220, type: 'checkbox', hideable: false },
  { id: 'revenueScheduleName', label: 'Revenue Schedule', width: 200, minWidth: calculateMinWidth({ label: 'Revenue Schedule', type: 'text', sortable: true }), sortable: true, hideable: false },
  { id: 'revenueScheduleDate', label: 'Schedule Date', width: 140, minWidth: calculateMinWidth({ label: 'Schedule Date', type: 'text', sortable: true }), sortable: true },
  { id: 'accountName', label: 'Account', width: 220, minWidth: calculateMinWidth({ label: 'Account', type: 'text', sortable: true }), sortable: true },
  { id: 'distributorName', label: 'Distributor', width: 200, minWidth: calculateMinWidth({ label: 'Distributor', type: 'text', sortable: true }), sortable: true },
  { id: 'vendorName', label: 'Vendor', width: 200, minWidth: calculateMinWidth({ label: 'Vendor', type: 'text', sortable: true }), sortable: true },
  { id: 'productNameVendor', label: 'Product', width: 240, minWidth: calculateMinWidth({ label: 'Product', type: 'text', sortable: true }), sortable: true },
  { id: 'scheduleStatus', label: 'Status', width: 140, minWidth: calculateMinWidth({ label: 'Status', type: 'text', sortable: true }), sortable: true },
  { id: 'deletedAt', label: 'Archived On', width: 140, minWidth: calculateMinWidth({ label: 'Archived On', type: 'text', sortable: true }), sortable: true },
]

const ARCHIVE_REVENUE_SCHEDULE_FILTER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'revenueScheduleName', label: 'Revenue Schedule' },
  { id: 'revenueScheduleDate', label: 'Schedule Date' },
  { id: 'accountName', label: 'Account Name' },
  { id: 'distributorName', label: 'Distributor Name' },
  { id: 'vendorName', label: 'Vendor Name' },
  { id: 'productNameVendor', label: 'Other - Product Name' },
  { id: 'opportunityId', label: 'Opportunity ID' },
  { id: 'customerIdVendor', label: 'Other - Customer ID' },
  { id: 'orderIdVendor', label: 'Other - Order ID' },
  { id: 'locationId', label: 'Location ID' },
]

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

export default function AdminArchivedRevenueSchedulesPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()
  const router = useRouter()

  const roleCode = (user?.role?.code ?? '').toLowerCase()
  const isAdmin = roleCode === 'admin'
  const isAccounting = roleCode === 'accounting'

  const canManageArchive = hasPermission('revenue-schedules.manage') || isAdmin || isAccounting
  const userCanPermanentDelete = isAdmin
  const userCanRestore = canManageArchive

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
  } = useTablePreferences('revenue-schedules:archive', ARCHIVE_REVENUE_SCHEDULE_BASE_COLUMNS, { defaultPageSize: 25 })

  const [schedules, setSchedules] = useState<RevenueScheduleArchiveRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewFilter, setViewFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [sortState, setSortState] = useState<SortState | null>(null)
  const [columnFilters, setColumnFilters] = useState<ListColumnFilter[]>([])
  const [totalRecords, setTotalRecords] = useState(0)

  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [scheduleToDelete, setScheduleToDelete] = useState<RevenueScheduleArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<RevenueScheduleArchiveRow[]>([])

  const [tableBodyHeight, setTableBodyHeight] = useState<number>()
  const tableAreaNodeRef = useRef<HTMLDivElement | null>(null)

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / preferencePageSize))
    return { page, pageSize: preferencePageSize, total: totalRecords, totalPages }
  }, [page, preferencePageSize, totalRecords])

  const reloadSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      if (viewFilter === 'all') {
        params.set('includeDeleted', 'true')
      } else {
        params.set('includeDeleted', 'true')
        params.set('deletedOnly', 'true')
      }

      params.set('page', String(page))
      params.set('pageSize', String(preferencePageSize))

      if (searchQuery.trim().length > 0) {
        params.set('q', searchQuery.trim())
      }

      if (sortState) {
        params.set('sort', sortState.columnId)
        params.set('direction', sortState.direction)
      }

      const sanitizedFilters = columnFilters
        .filter((filter) => filter && typeof filter.columnId === 'string')
        .map((filter) => ({
          columnId: String(filter.columnId),
          value: typeof filter.value === 'string' ? filter.value : String(filter.value ?? ''),
          operator: typeof filter.operator === 'string' ? filter.operator : undefined,
        }))
        .filter((filter) => filter.columnId.length > 0 && filter.value.trim().length > 0)

      if (sanitizedFilters.length > 0) {
        params.set('filters', JSON.stringify(sanitizedFilters))
      }

      const response = await fetch(`/api/revenue-schedules?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load archived revenue schedules')
      }

      const rows: RevenueScheduleArchiveRow[] = Array.isArray(payload?.data) ? payload.data : []
      const total = typeof payload?.pagination?.total === 'number' ? payload.pagination.total : rows.length
      setSchedules(rows)
      setTotalRecords(total)
      setSelectedIds([])
      setBulkDeleteTargets([])
      setError(null)
    } catch (err) {
      console.error(err)
      setSchedules([])
      setSelectedIds([])
      setBulkDeleteTargets([])
      setTotalRecords(0)
      setError('Unable to load archived revenue schedules')
    } finally {
      setLoading(false)
    }
  }, [columnFilters, page, preferencePageSize, searchQuery, sortState, viewFilter])

  useEffect(() => {
    if (!canManageArchive) return
    reloadSchedules().catch(console.error)
  }, [canManageArchive, reloadSchedules])

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
  }, [measureTableArea, schedules.length, selectedIds.length, loading, preferenceLoading, page, preferencePageSize, viewFilter])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setPage(1)
  }, [])

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
  }, [])

  const handlePageSizeChange = useCallback(
    (nextPageSize: number) => {
      persistPageSizeChange(nextPageSize)
      setPage(1)
    },
    [persistPageSizeChange],
  )

  const handleViewFilterChange = useCallback((next: 'active' | 'inactive' | 'all') => {
    setViewFilter(next)
    setSelectedIds([])
    setPage(1)
  }, [])

  const handleSort = useCallback((columnId: string, direction: 'asc' | 'desc') => {
    setSortState({ columnId, direction })
    setPage(1)
  }, [])

  const handleColumnFiltersChange = useCallback((filters: ListColumnFilter[]) => {
    setColumnFilters(filters)
    setPage(1)
  }, [])

  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((previous) => {
      if (selected) {
        return previous.includes(id) ? previous : [...previous, id]
      }
      return previous.filter((existingId) => existingId !== id)
    })
  }, [])

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedIds(schedules.map((row) => row.id))
        return
      }
      setSelectedIds([])
    },
    [schedules],
  )

  const handleRowClick = useCallback(
    (row: RevenueScheduleArchiveRow) => {
      router.push(`/revenue-schedules/${row.id}`)
    },
    [router],
  )

  const restoreScheduleRequest = useCallback(async (scheduleId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/revenue-schedules/${scheduleId}/restore`, { method: 'POST' })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        return { success: false, error: payload?.error ?? 'Failed to restore revenue schedule' }
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to restore revenue schedule' }
    }
  }, [])

  const handleRestore = useCallback(
    async (scheduleId: string): Promise<{ success: boolean; error?: string }> => {
      const result = await restoreScheduleRequest(scheduleId)
      if (result.success) {
        setSchedules((previous) =>
          viewFilter === 'active'
            ? previous.filter((row) => row.id !== scheduleId)
            : previous.map((row) => (row.id === scheduleId ? { ...row, deletedAt: null } : row)),
        )
        setSelectedIds((previous) => previous.filter((id) => id !== scheduleId))
        showSuccess('Revenue schedule restored', 'The revenue schedule was restored and removed from Archive.')
      }
      return result
    },
    [restoreScheduleRequest, showSuccess, viewFilter],
  )

  const handleBulkRestore = useCallback(async () => {
    if (selectedIds.length === 0) {
      showError('No revenue schedules selected', 'Select at least one archived revenue schedule to restore.')
      return
    }

    const targets = schedules.filter((row) => selectedIds.includes(row.id) && Boolean(row.deletedAt))
    if (targets.length === 0) {
      showError('No archived revenue schedules selected', 'Only archived revenue schedules can be restored.')
      return
    }

    setBulkActionLoading(true)
    try {
      const results = await Promise.allSettled(targets.map((row) => restoreScheduleRequest(row.id)))
      const restoredIds: string[] = []
      const failures: Array<{ schedule: RevenueScheduleArchiveRow; message: string }> = []

      results.forEach((result, index) => {
        const schedule = targets[index]
        if (result.status === 'fulfilled' && result.value.success) {
          restoredIds.push(schedule.id)
        } else {
          const message =
            result.status === 'fulfilled'
              ? result.value.error || 'Failed to restore revenue schedule'
              : result.reason instanceof Error
                ? result.reason.message
                : 'Failed to restore revenue schedule'
          failures.push({ schedule, message })
        }
      })

      if (restoredIds.length > 0) {
        const restoredSet = new Set(restoredIds)
        setSchedules((previous) =>
          viewFilter === 'active'
            ? previous.filter((row) => !restoredSet.has(row.id))
            : previous.map((row) => (restoredSet.has(row.id) ? { ...row, deletedAt: null } : row)),
        )
        setSelectedIds((previous) => previous.filter((id) => !restoredSet.has(id)))
        showSuccess(
          `Restored ${restoredIds.length} revenue schedule${restoredIds.length === 1 ? '' : 's'}`,
          'Restored revenue schedules were removed from Archive.',
        )
      }

      if (failures.length > 0) {
        const message = failures
          .slice(0, 5)
          .map(({ schedule, message }) => `${schedule.revenueScheduleName || 'Revenue Schedule'}: ${message}`)
          .join('; ')
        showError('Some restores failed', message)
      }
    } finally {
      setBulkActionLoading(false)
    }
  }, [restoreScheduleRequest, schedules, selectedIds, showError, showSuccess, viewFilter])

  const handlePermanentDelete = useCallback(
    async (scheduleId: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const trimmedReason = typeof reason === 'string' ? reason.trim() : ''
        const url = new URL(`/api/revenue-schedules/${scheduleId}`, window.location.origin)
        url.searchParams.set('stage', 'permanent')
        const response = await fetch(url.toString(), {
          method: 'DELETE',
          ...(trimmedReason
            ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: trimmedReason }) }
            : {}),
        })

        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          return { success: false, error: payload?.error ?? 'Failed to permanently delete revenue schedule' }
        }

        setSchedules((previous) => previous.filter((row) => row.id !== scheduleId))
        setSelectedIds((previous) => previous.filter((id) => id !== scheduleId))
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unable to permanently delete revenue schedule' }
      }
    },
    [],
  )

  const requestRowDeletion = useCallback(
    (row: RevenueScheduleArchiveRow) => {
      if (!row.deletedAt) {
        showError('Not archived', 'Only archived revenue schedules can be permanently deleted from this page.')
        return
      }
      setBulkDeleteTargets([])
      setScheduleToDelete(row)
      setShowDeleteDialog(true)
    },
    [showError],
  )

  const openBulkPermanentDeleteDialog = useCallback(() => {
    if (selectedIds.length === 0) {
      showError('No revenue schedules selected', 'Select at least one archived revenue schedule to permanently delete.')
      return
    }

    const targets = schedules.filter((row) => selectedIds.includes(row.id) && Boolean(row.deletedAt))
    if (targets.length === 0) {
      showError('No archived revenue schedules selected', 'Only archived revenue schedules can be permanently deleted here.')
      return
    }

    setBulkDeleteTargets(targets)
    setScheduleToDelete(null)
    setShowDeleteDialog(true)
  }, [schedules, selectedIds, showError])

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false)
    setScheduleToDelete(null)
    setBulkDeleteTargets([])
  }

  const handleBulkExportCsv = useCallback(() => {
    const rows = schedules.filter((row) => selectedIds.includes(row.id))
    if (rows.length === 0) {
      showError('No revenue schedules selected', 'Select at least one revenue schedule to export.')
      return
    }

    const lines = [
      ['Revenue Schedule', 'Schedule Date', 'Account', 'Distributor', 'Vendor', 'Product', 'Status', 'Archived On'].join(','),
      ...rows.map((row) =>
        [
          escapeCsv(row.revenueScheduleName),
          escapeCsv(formatDate(row.revenueScheduleDate)),
          escapeCsv(row.accountName),
          escapeCsv(row.distributorName),
          escapeCsv(row.vendorName),
          escapeCsv(row.productNameVendor),
          escapeCsv(row.scheduleStatus),
          escapeCsv(formatDate(row.deletedAt)),
        ].join(','),
      ),
    ].join('\r\n')

    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    link.download = `revenue-schedules-${viewFilter === 'active' ? 'archived' : viewFilter}-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showSuccess('Export complete', 'Check your downloads for the CSV file.')
  }, [schedules, selectedIds, showError, showSuccess, viewFilter])

  const bulkActions = useMemo(() => {
    return {
      selectedCount: selectedIds.length,
      isBusy: bulkActionLoading,
      entityName: 'revenue schedules',
      actions: [
        {
          key: 'restore',
          label: 'Restore',
          icon: RotateCcw,
          tone: 'primary' as const,
          onClick: handleBulkRestore,
          tooltip: (count: number) => `Restore ${count} archived revenue schedule${count === 1 ? '' : 's'}`,
          disabled: !userCanRestore,
        },
        {
          key: 'export',
          label: 'Export CSV',
          icon: Download,
          tone: 'info' as const,
          onClick: handleBulkExportCsv,
          tooltip: (count: number) => `Export ${count} revenue schedule${count === 1 ? '' : 's'} to CSV`,
        },
        {
          key: 'permanent-delete',
          label: 'Delete Permanently',
          icon: Trash2,
          tone: 'danger' as const,
          onClick: openBulkPermanentDeleteDialog,
          tooltip: (count: number) => `Permanently delete ${count} archived revenue schedule${count === 1 ? '' : 's'}`,
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
          render: (_value: unknown, row: RevenueScheduleArchiveRow) => {
            const checked = selectedIds.includes(row.id)
            const isArchived = Boolean(row.deletedAt)
            const canRestoreRow = userCanRestore && isArchived
            const canDeleteRow = userCanPermanentDelete && isArchived

            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`Select revenue schedule ${row.revenueScheduleName || row.id}`}
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
                    checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'
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
                  disabled={!canRestoreRow}
                  aria-label="Restore revenue schedule"
                  title={
                    !isArchived
                      ? 'Only archived schedules can be restored'
                      : canRestoreRow
                        ? 'Restore revenue schedule'
                        : 'Insufficient permissions'
                  }
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
                  disabled={!canDeleteRow}
                  aria-label="Permanently delete revenue schedule"
                  title={
                    !isArchived
                      ? 'Only archived schedules can be permanently deleted here'
                      : canDeleteRow
                        ? 'Permanently delete'
                        : 'Admin role required'
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )
          },
        }
      }

      if (column.id === 'revenueScheduleName') {
        return {
          ...column,
          render: (value: string, row: RevenueScheduleArchiveRow) => (
            <Link href={`/revenue-schedules/${row.id}`} className="text-blue-600 hover:underline">
              {value || '--'}
            </Link>
          ),
        }
      }

      if (column.id === 'accountName') {
        return {
          ...column,
          render: (value: string, row: RevenueScheduleArchiveRow) => {
            const label = value || '--'
            if (row.accountId) {
              return (
                <Link href={`/accounts/${row.accountId}`} className="text-blue-600 hover:underline">
                  {label}
                </Link>
              )
            }
            return <span>{label}</span>
          },
        }
      }

      if (column.id === 'revenueScheduleDate') {
        return { ...column, render: (value: string | null | undefined) => formatDate(value) || '--' }
      }

      if (column.id === 'deletedAt') {
        return { ...column, render: (value: string | null | undefined) => formatDate(value) || '--' }
      }

      return column
    })
  }, [handleRestore, handleSelect, preferenceColumns, requestRowDeletion, selectedIds, userCanPermanentDelete, userCanRestore])

  const pageTitle = useMemo(() => {
    if (viewFilter === 'all') return 'ALL REVENUE SCHEDULES'
    return 'ARCHIVED REVENUE SCHEDULES'
  }, [viewFilter])

  const searchPlaceholder = useMemo(() => {
    if (viewFilter === 'all') return 'Search all revenue schedules...'
    return 'Search archived revenue schedules...'
  }, [viewFilter])

  const emptyMessage = useMemo(() => {
    if (viewFilter === 'all') return 'No revenue schedules found'
    return 'No archived revenue schedules found'
  }, [viewFilter])

  if (!canManageArchive) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Archived Revenue Schedules</h1>
        <p className="mt-2 text-sm text-gray-600">
          Access denied. You need revenue schedule permissions to view archived schedules.
        </p>
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
            options={['active', 'all']}
            labels={{ active: 'Archived', all: 'All' }}
            onChange={handleViewFilterChange}
          />
        }
        showColumnFilters
        filterColumns={ARCHIVE_REVENUE_SCHEDULE_FILTER_OPTIONS}
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

      {(error || preferenceError) ? <div className="px-4 text-sm text-red-600">{error || preferenceError}</div> : null}

      <div className="flex-1 min-h-0 p-4 pt-0 flex flex-col gap-4">
        <div ref={tableAreaRef} className="flex-1 min-h-0">
          <DynamicTable
            columns={tableColumns}
            data={schedules}
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
        entity="Revenue Schedule"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} revenue schedule${bulkDeleteTargets.length === 1 ? '' : 's'}`
            : scheduleToDelete?.revenueScheduleName || 'Unknown Schedule'
        }
        entityId={
          bulkDeleteTargets.length > 0 ? bulkDeleteTargets[0]?.id || '' : scheduleToDelete?.id || ''
        }
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((row) => ({
                id: row.id,
                name: row.revenueScheduleName || 'Revenue Schedule',
              }))
            : undefined
        }
        entityLabelPlural="Revenue Schedules"
        isDeleted={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.every((schedule) => Boolean(schedule.deletedAt))
            : Boolean(scheduleToDelete?.deletedAt)
        }
        onSoftDelete={async () => ({ success: false, error: 'Archived revenue schedules cannot be soft deleted again.' })}
        onPermanentDelete={handlePermanentDelete}
        onRestore={userCanRestore ? handleRestore : undefined}
        userCanPermanentDelete={userCanPermanentDelete}
        modalSize="revenue-schedules"
        requireReason
        note="Legend: Archived revenue schedules are soft-deleted. Restore will return them to the Revenue Schedules module. Permanent delete is irreversible."
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}
