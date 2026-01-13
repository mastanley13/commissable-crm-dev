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

type ReportArchiveRow = {
  id: string
  reportName: string
  reportType: string
  createdDate: string
  lastRun: string | null
  status: string
  description?: string | null
  active: boolean
}

type SortState = { columnId: string; direction: 'asc' | 'desc' }

const TABLE_BOTTOM_RESERVE = 110
const TABLE_MIN_BODY_HEIGHT = 320

const ARCHIVE_REPORT_BASE_COLUMNS: Column[] = [
  { id: 'select', label: 'Select', width: 110, minWidth: calculateMinWidth({ label: 'Select', type: 'checkbox', sortable: false }), maxWidth: 220, type: 'checkbox', hideable: false },
  { id: 'reportName', label: 'Report Name', width: 280, minWidth: calculateMinWidth({ label: 'Report Name', type: 'text', sortable: true }), maxWidth: 460, sortable: true, hideable: false },
  { id: 'reportType', label: 'Report Type', width: 180, minWidth: calculateMinWidth({ label: 'Report Type', type: 'text', sortable: true }), maxWidth: 260, sortable: true },
  { id: 'createdDate', label: 'Created Date', width: 150, minWidth: calculateMinWidth({ label: 'Created Date', type: 'text', sortable: true }), maxWidth: 220, sortable: true },
  { id: 'lastRun', label: 'Last Run', width: 150, minWidth: calculateMinWidth({ label: 'Last Run', type: 'text', sortable: true }), maxWidth: 220, sortable: true },
  { id: 'status', label: 'Status', width: 160, minWidth: calculateMinWidth({ label: 'Status', type: 'text', sortable: true }), maxWidth: 240, sortable: true },
  { id: 'description', label: 'Description', width: 320, minWidth: calculateMinWidth({ label: 'Description', type: 'text', sortable: false }), maxWidth: 520, sortable: false, hidden: true },
]

const ARCHIVE_REPORT_FILTER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'reportName', label: 'Report Name' },
  { id: 'reportType', label: 'Report Type' },
  { id: 'createdDate', label: 'Created Date' },
  { id: 'lastRun', label: 'Last Run' },
  { id: 'status', label: 'Status' },
]

function escapeCsv(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export default function AdminArchivedReportsPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()
  const router = useRouter()

  const canManageArchive = hasPermission('accounts.manage') || hasPermission('admin.audit.access')
  const userCanRestore = canManageArchive
  const userCanPermanentDelete = canManageArchive

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
  } = useTablePreferences('reports:archive', ARCHIVE_REPORT_BASE_COLUMNS, { defaultPageSize: 25 })

  const [reports, setReports] = useState<ReportArchiveRow[]>([])
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
  const [tableBodyHeight, setTableBodyHeight] = useState<number>()
  const tableAreaNodeRef = useRef<HTMLDivElement | null>(null)

  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [reportToDelete, setReportToDelete] = useState<ReportArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<ReportArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / preferencePageSize))
    return { page, pageSize: preferencePageSize, total: totalRecords, totalPages }
  }, [page, preferencePageSize, totalRecords])

  const reloadReports = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(preferencePageSize))

      if (searchQuery.trim().length > 0) {
        params.set('q', searchQuery.trim())
      }

      const recordStatus = viewFilter === 'active' ? 'inactive' : viewFilter === 'inactive' ? 'active' : 'all'
      params.set('recordStatus', recordStatus)

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

      const response = await fetch(`/api/reports?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load archived reports')
      }

      const rows: ReportArchiveRow[] = Array.isArray(payload?.data) ? payload.data : []
      const total = typeof payload?.pagination?.total === 'number' ? payload.pagination.total : rows.length
      setReports(rows)
      setTotalRecords(total)
      setSelectedIds([])
      setBulkDeleteTargets([])
      setError(null)
    } catch (err) {
      console.error(err)
      setReports([])
      setSelectedIds([])
      setBulkDeleteTargets([])
      setTotalRecords(0)
      setError(err instanceof Error ? err.message : 'Unable to load archived reports')
    } finally {
      setLoading(false)
    }
  }, [columnFilters, page, preferencePageSize, searchQuery, sortState, viewFilter])

  useEffect(() => {
    if (!canManageArchive) return
    reloadReports().catch(console.error)
  }, [canManageArchive, reloadReports])

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
  }, [measureTableArea, reports.length, selectedIds.length, loading, preferenceLoading, page, preferencePageSize, viewFilter])

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

  const handlePageSizeChange = useCallback(
    (nextPageSize: number) => {
      persistPageSizeChange(nextPageSize)
      setPage(1)
    },
    [persistPageSizeChange],
  )

  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((previous) => {
      if (selected) {
        return previous.includes(id) ? previous : [...previous, id]
      }
      return previous.filter((existing) => existing !== id)
    })
  }, [])

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedIds(reports.map((row) => row.id))
        return
      }
      setSelectedIds([])
    },
    [reports],
  )

  const handleRowClick = useCallback(
    (row: ReportArchiveRow) => {
      if (!row?.id) return
      router.push(`/reports/${row.id}`)
    },
    [router],
  )

  const restoreReportRequest = useCallback(async (reportId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        return { success: false, error: payload?.error ?? 'Failed to restore report' }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to restore report' }
    }
  }, [])

  const handleRestore = useCallback(
    async (reportId: string): Promise<{ success: boolean; error?: string }> => {
      const result = await restoreReportRequest(reportId)
      if (result.success) {
        setReports((previous) => previous.filter((row) => row.id !== reportId))
        setSelectedIds((previous) => previous.filter((id) => id !== reportId))
        showSuccess('Report restored', 'The report was marked Active and removed from Archive.')
      }
      return result
    },
    [restoreReportRequest, showSuccess],
  )

  const handleBulkRestore = useCallback(async () => {
    if (!userCanRestore) return
    if (selectedIds.length === 0) {
      showError('No reports selected', 'Select at least one archived report to restore.')
      return
    }

    setBulkActionLoading(true)
    try {
      const targets = reports.filter((row) => selectedIds.includes(row.id))
      const results = await Promise.allSettled(targets.map((row) => restoreReportRequest(row.id)))
      const restoredIds: string[] = []
      const failures: Array<{ report: ReportArchiveRow; message: string }> = []

      results.forEach((result, index) => {
        const report = targets[index]
        if (!report) return
        if (result.status === 'fulfilled' && result.value.success) {
          restoredIds.push(report.id)
          return
        }
        const message =
          result.status === 'fulfilled'
            ? result.value.error || 'Failed to restore report'
            : result.reason instanceof Error
              ? result.reason.message
              : 'Failed to restore report'
        failures.push({ report, message })
      })

      if (restoredIds.length > 0) {
        const restoredSet = new Set(restoredIds)
        setReports((previous) => previous.filter((row) => !restoredSet.has(row.id)))
        setSelectedIds((previous) => previous.filter((id) => !restoredSet.has(id)))
        showSuccess(
          `Restored ${restoredIds.length} report${restoredIds.length === 1 ? '' : 's'}`,
          'Restored reports were removed from Archive.',
        )
      }

      if (failures.length > 0) {
        const message = failures.slice(0, 3).map((f) => `${f.report.reportName || 'Report'}: ${f.message}`).join('; ')
        showError('Some restores failed', message)
      }
    } finally {
      setBulkActionLoading(false)
    }
  }, [reports, restoreReportRequest, selectedIds, showError, showSuccess, userCanRestore])

  const handlePermanentDelete = useCallback(async (reportId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        return { success: false, error: payload?.error ?? 'Failed to permanently delete report' }
      }
      setReports((previous) => previous.filter((row) => row.id !== reportId))
      setSelectedIds((previous) => previous.filter((id) => id !== reportId))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to permanently delete report' }
    }
  }, [])

  const requestRowDeletion = useCallback((row: ReportArchiveRow) => {
    setReportToDelete(row)
    setBulkDeleteTargets([])
    setShowDeleteDialog(true)
  }, [])

  const openBulkPermanentDeleteDialog = useCallback(() => {
    if (selectedIds.length === 0) {
      showError('No reports selected', 'Select at least one archived report to permanently delete.')
      return
    }
    const targets = reports.filter((row) => selectedIds.includes(row.id))
    setBulkDeleteTargets(targets)
    setReportToDelete(null)
    setShowDeleteDialog(true)
  }, [reports, selectedIds, showError])

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false)
    setReportToDelete(null)
    setBulkDeleteTargets([])
  }

  const handleBulkExportCsv = useCallback(() => {
    const selectedSet = new Set(selectedIds)
    const rows = selectedIds.length > 0 ? reports.filter((row) => selectedSet.has(row.id)) : reports
    if (rows.length === 0) {
      showError('Nothing to export', 'Select at least one report or adjust filters before exporting.')
      return
    }

    const header = ['id', 'reportName', 'reportType', 'createdDate', 'lastRun', 'status', 'active']
    const lines = [
      header.join(','),
      ...rows.map((row) =>
        [row.id, row.reportName, row.reportType, row.createdDate, row.lastRun ?? '', row.status, row.active ? 'true' : 'false']
          .map(escapeCsv)
          .join(','),
      ),
    ]

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    link.download = `reports-${viewFilter === 'active' ? 'archived' : viewFilter}-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showSuccess('Export complete', 'Check your downloads for the CSV file.')
  }, [reports, selectedIds, showError, showSuccess, viewFilter])

  const bulkActions = useMemo(() => {
    return {
      selectedCount: selectedIds.length,
      isBusy: bulkActionLoading,
      entityName: 'reports',
      actions: [
        {
          key: 'restore',
          label: 'Restore',
          icon: RotateCcw,
          tone: 'primary' as const,
          onClick: handleBulkRestore,
          tooltip: (count: number) => `Restore ${count} report${count === 1 ? '' : 's'}`,
          disabled: !userCanRestore,
        },
        {
          key: 'export',
          label: 'Export CSV',
          icon: Download,
          tone: 'info' as const,
          onClick: handleBulkExportCsv,
          tooltip: (count: number) => `Export ${count} report${count === 1 ? '' : 's'} to CSV`,
          disabled: selectedIds.length === 0,
        },
        {
          key: 'permanent-delete',
          label: 'Delete Permanently',
          icon: Trash2,
          tone: 'danger' as const,
          onClick: openBulkPermanentDeleteDialog,
          tooltip: (count: number) => `Permanently delete ${count} archived report${count === 1 ? '' : 's'}`,
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
          render: (_value: unknown, row: ReportArchiveRow) => {
            const checked = selectedIds.includes(row.id)
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`Select report ${row.reportName || row.id}`}
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
                  aria-label="Restore report"
                  title={userCanRestore ? 'Restore report' : 'Insufficient permissions'}
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
                  aria-label="Permanently delete report"
                  title={userCanPermanentDelete ? 'Permanently delete' : 'Insufficient permissions'}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )
          },
        }
      }

      if (column.id === 'reportName') {
        return {
          ...column,
          render: (value: string, row: ReportArchiveRow) => (
            <Link href={`/reports/${row.id}`} className="text-blue-600 hover:underline">
              {value || '--'}
            </Link>
          ),
        }
      }

      return column
    })
  }, [
    handleRestore,
    handleSelect,
    preferenceColumns,
    requestRowDeletion,
    selectedIds,
    userCanPermanentDelete,
    userCanRestore,
  ])

  const pageTitle = useMemo(() => {
    if (viewFilter === 'inactive') return 'ACTIVE REPORTS'
    if (viewFilter === 'all') return 'ALL REPORTS'
    return 'ARCHIVED REPORTS'
  }, [viewFilter])

  const searchPlaceholder = useMemo(() => {
    if (viewFilter === 'inactive') return 'Search active reports...'
    if (viewFilter === 'all') return 'Search all reports...'
    return 'Search archived reports...'
  }, [viewFilter])

  const emptyMessage = useMemo(() => {
    if (viewFilter === 'inactive') return 'No active reports found'
    if (viewFilter === 'all') return 'No reports found'
    return 'No archived reports found'
  }, [viewFilter])

  if (!canManageArchive) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Archived Reports</h1>
        <p className="mt-2 text-sm text-gray-600">Access denied. You do not have permission to view archived reports.</p>
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
        filterColumns={ARCHIVE_REPORT_FILTER_OPTIONS}
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
            data={reports}
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
        entity="Report"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} report${bulkDeleteTargets.length === 1 ? '' : 's'}`
            : reportToDelete?.reportName || 'Unknown Report'
        }
        entityId={bulkDeleteTargets.length > 0 ? bulkDeleteTargets[0]?.id || '' : reportToDelete?.id || ''}
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((report) => ({ id: report.id, name: report.reportName || 'Report' }))
            : undefined
        }
        entityLabelPlural="Reports"
        isDeleted={true}
        onSoftDelete={async () => ({ success: false, error: 'Archived reports cannot be soft deleted again.' })}
        onPermanentDelete={handlePermanentDelete}
        onRestore={userCanRestore ? handleRestore : undefined}
        userCanPermanentDelete={userCanPermanentDelete}
        modalSize="revenue-schedules"
        note="Legend: Archived reports are marked inactive. Restore will mark them Active. Permanent delete is irreversible."
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}
