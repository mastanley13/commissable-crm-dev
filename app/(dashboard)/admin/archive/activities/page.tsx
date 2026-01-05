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

type ActivityArchiveRow = {
  id: string
  description: string
  activityType: string
  status: string
  dueDate?: string | null
  createdAt?: string | null
  accountName?: string | null
  contactName?: string | null
  opportunityName?: string | null
  assigneeName?: string | null
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

const ARCHIVE_ACTIVITY_BASE_COLUMNS: Column[] = [
  { id: 'select', label: 'Select', width: 110, minWidth: 80, maxWidth: 220, type: 'checkbox', hideable: false },
  { id: 'description', label: 'Subject', width: 320, minWidth: 220, maxWidth: 520, hideable: false },
  { id: 'activityType', label: 'Type', width: 180, minWidth: 140, maxWidth: 260 },
  { id: 'accountName', label: 'Account', width: 240, minWidth: 180, maxWidth: 360 },
  { id: 'assigneeName', label: 'Assignee', width: 200, minWidth: 160, maxWidth: 320 },
  { id: 'status', label: 'Status', width: 160, minWidth: 120, maxWidth: 240 },
  { id: 'dueDate', label: 'Due Date', width: 150, minWidth: 120, maxWidth: 220, sortable: true },
  { id: 'createdAt', label: 'Created On', width: 150, minWidth: 120, maxWidth: 220, sortable: true, hidden: true },
  { id: 'contactName', label: 'Contact', width: 240, minWidth: 180, maxWidth: 360, hidden: true },
  { id: 'opportunityName', label: 'Opportunity', width: 280, minWidth: 200, maxWidth: 420, hidden: true },
]

const ARCHIVE_ACTIVITY_FILTER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'description', label: 'Subject / Description' },
  { id: 'activityType', label: 'Activity Type' },
  { id: 'accountName', label: 'Account Name' },
  { id: 'status', label: 'Status' },
]

export default function AdminArchivedActivitiesPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()
  const router = useRouter()

  const canManageArchive =
    hasPermission('activities.manage') || hasPermission('activities.read') || hasPermission('accounts.manage') || hasPermission('contacts.manage')
  const userCanRestore = hasPermission('activities.manage')
  const userCanPermanentDelete = hasPermission('activities.manage')

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
  } = useTablePreferences('activities:archive', ARCHIVE_ACTIVITY_BASE_COLUMNS, { defaultPageSize: 25 })

  const [activities, setActivities] = useState<ActivityArchiveRow[]>([])
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
  const [activityToDelete, setActivityToDelete] = useState<ActivityArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<ActivityArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / preferencePageSize))
    return { page, pageSize: preferencePageSize, total: totalRecords, totalPages }
  }, [page, preferencePageSize, totalRecords])

  const reloadActivities = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      if (viewFilter === 'active') {
        params.set('includeCompleted', 'true')
        params.set('status', 'Completed')
      } else if (viewFilter === 'inactive') {
        params.set('includeCompleted', 'false')
      } else {
        params.set('includeCompleted', 'true')
      }

      params.set('page', String(page))
      params.set('pageSize', String(preferencePageSize))
      if (searchQuery.trim().length > 0) {
        params.set('q', searchQuery.trim())
      }

      if (sortState) {
        params.set('sortBy', sortState.columnId === 'createdAt' ? 'createdAt' : 'dueDate')
        params.set('sortDirection', sortState.direction)
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

      const response = await fetch(`/api/activities?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load archived activities')
      }

      const items: any[] = Array.isArray(payload?.data) ? payload.data : []
      const rows: ActivityArchiveRow[] = items.map((item) => ({
        id: String(item?.id ?? ''),
        description: item?.subject ?? item?.description ?? '',
        activityType: item?.type ?? '',
        status: item?.status ?? '',
        dueDate: item?.dueDate ?? null,
        createdAt: item?.createdAt ?? null,
        accountName: item?.accountName ?? null,
        contactName: item?.contactName ?? null,
        opportunityName: item?.opportunityName ?? null,
        assigneeName: item?.assigneeName ?? null,
      }))
      const total = typeof payload?.pagination?.total === 'number' ? payload.pagination.total : rows.length
      setActivities(rows)
      setTotalRecords(total)
      setSelectedIds([])
      setBulkDeleteTargets([])
      setError(null)
    } catch (err) {
      console.error(err)
      setActivities([])
      setSelectedIds([])
      setBulkDeleteTargets([])
      setTotalRecords(0)
      setError('Unable to load archived activities')
    } finally {
      setLoading(false)
    }
  }, [columnFilters, page, preferencePageSize, searchQuery, sortState, viewFilter])

  useEffect(() => {
    if (!canManageArchive) return
    reloadActivities().catch(console.error)
  }, [canManageArchive, reloadActivities])

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
  }, [measureTableArea, activities.length, selectedIds.length, loading, preferenceLoading, page, preferencePageSize, viewFilter])

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
      setSelectedIds(activities.map((row) => row.id))
      return
    }
    setSelectedIds([])
  }, [activities])

  const handleRowClick = useCallback(
    (row: ActivityArchiveRow) => {
      if (!row?.id) return
      router.push(`/activities/${row.id}`)
    },
    [router],
  )

  const restoreActivityRequest = useCallback(async (activityId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Open' }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        return { success: false, error: payload?.error ?? 'Failed to reopen activity' }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to reopen activity' }
    }
  }, [])

  const handleRestore = useCallback(async (activityId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await restoreActivityRequest(activityId)
    if (result.success) {
      setActivities((previous) => previous.filter((row) => row.id !== activityId))
      setSelectedIds((previous) => previous.filter((id) => id !== activityId))
      showSuccess('Activity reopened', 'The activity was reopened and removed from Archive.')
    }
    return result
  }, [restoreActivityRequest, showSuccess])

  const handleBulkRestore = useCallback(async () => {
    if (!userCanRestore) return
    if (selectedIds.length === 0) {
      showError('No activities selected', 'Select at least one archived activity to reopen.')
      return
    }

    setBulkActionLoading(true)
    try {
      const targets = activities.filter((row) => selectedIds.includes(row.id))
      const results = await Promise.allSettled(targets.map((row) => restoreActivityRequest(row.id)))
      const restoredIds: string[] = []
      const failures: Array<{ activity: ActivityArchiveRow; message: string }> = []

      results.forEach((result, index) => {
        const activity = targets[index]
        if (!activity) return
        if (result.status === 'fulfilled' && result.value.success) {
          restoredIds.push(activity.id)
          return
        }
        const message =
          result.status === 'fulfilled'
            ? result.value.error || 'Failed to reopen activity'
            : result.reason instanceof Error
              ? result.reason.message
              : 'Failed to reopen activity'
        failures.push({ activity, message })
      })

      if (restoredIds.length > 0) {
        const restoredSet = new Set(restoredIds)
        setActivities((previous) => previous.filter((row) => !restoredSet.has(row.id)))
        setSelectedIds((previous) => previous.filter((id) => !restoredSet.has(id)))
        showSuccess(
          `Reopened ${restoredIds.length} activit${restoredIds.length === 1 ? 'y' : 'ies'}`,
          'Reopened activities were removed from Archive.',
        )
      }

      if (failures.length > 0) {
        const message = failures.slice(0, 3).map((f) => `${f.activity.description || 'Activity'}: ${f.message}`).join('; ')
        showError('Some reopens failed', message)
      }
    } finally {
      setBulkActionLoading(false)
    }
  }, [activities, restoreActivityRequest, selectedIds, showError, showSuccess, userCanRestore])

  const handlePermanentDelete = useCallback(async (activityId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/activities/${activityId}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        return { success: false, error: payload?.error ?? 'Failed to permanently delete activity' }
      }
      setActivities((previous) => previous.filter((row) => row.id !== activityId))
      setSelectedIds((previous) => previous.filter((id) => id !== activityId))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to permanently delete activity' }
    }
  }, [])

  const requestRowDeletion = useCallback((row: ActivityArchiveRow) => {
    setActivityToDelete(row)
    setBulkDeleteTargets([])
    setShowDeleteDialog(true)
  }, [])

  const openBulkPermanentDeleteDialog = useCallback(() => {
    if (selectedIds.length === 0) {
      showError('No activities selected', 'Select at least one archived activity to permanently delete.')
      return
    }
    const targets = activities.filter((row) => selectedIds.includes(row.id))
    setBulkDeleteTargets(targets)
    setActivityToDelete(null)
    setShowDeleteDialog(true)
  }, [activities, selectedIds, showError])

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false)
    setActivityToDelete(null)
    setBulkDeleteTargets([])
  }

  const handleBulkExportCsv = useCallback(() => {
    const selectedSet = new Set(selectedIds)
    const rows = selectedIds.length > 0 ? activities.filter((row) => selectedSet.has(row.id)) : activities
    if (rows.length === 0) {
      showError('Nothing to export', 'Select at least one activity or adjust filters before exporting.')
      return
    }

    const header = [
      'id',
      'description',
      'activityType',
      'status',
      'dueDate',
      'createdAt',
      'accountName',
      'contactName',
      'opportunityName',
      'assigneeName',
    ]
    const lines = [
      header.join(','),
      ...rows.map((row) =>
        [
          row.id,
          row.description,
          row.activityType,
          row.status,
          row.dueDate ?? '',
          row.createdAt ?? '',
          row.accountName ?? '',
          row.contactName ?? '',
          row.opportunityName ?? '',
          row.assigneeName ?? '',
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
    link.download = `activities-${viewFilter === 'active' ? 'completed' : viewFilter}-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showSuccess('Export complete', 'Check your downloads for the CSV file.')
  }, [activities, selectedIds, showError, showSuccess, viewFilter])

  const bulkActions = useMemo(() => {
    return {
      selectedCount: selectedIds.length,
      isBusy: bulkActionLoading,
      entityName: 'activities',
      actions: [
        {
          key: 'restore',
          label: 'Reopen',
          icon: RotateCcw,
          tone: 'primary' as const,
          onClick: handleBulkRestore,
          tooltip: (count: number) => `Reopen ${count} completed activit${count === 1 ? 'y' : 'ies'}`,
          disabled: !userCanRestore,
        },
        {
          key: 'export',
          label: 'Export CSV',
          icon: Download,
          tone: 'info' as const,
          onClick: handleBulkExportCsv,
          tooltip: (count: number) => `Export ${count} activit${count === 1 ? 'y' : 'ies'} to CSV`,
          disabled: selectedIds.length === 0,
        },
        {
          key: 'permanent-delete',
          label: 'Delete Permanently',
          icon: Trash2,
          tone: 'danger' as const,
          onClick: openBulkPermanentDeleteDialog,
          tooltip: (count: number) => `Permanently delete ${count} completed activit${count === 1 ? 'y' : 'ies'}`,
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
          render: (_value: unknown, row: ActivityArchiveRow) => {
            const checked = selectedIds.includes(row.id)
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`Select activity ${row.description || row.id}`}
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
                  aria-label="Reopen activity"
                  title={userCanRestore ? 'Reopen activity' : 'Insufficient permissions'}
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
                  aria-label="Permanently delete activity"
                  title={userCanPermanentDelete ? 'Permanently delete' : 'Insufficient permissions'}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )
          },
        }
      }

      if (column.id === 'description') {
        return {
          ...column,
          render: (value: string, row: ActivityArchiveRow) => (
            <Link href={`/activities/${row.id}`} className="text-blue-600 hover:underline">
              {value || '--'}
            </Link>
          ),
        }
      }

      if (column.id === 'dueDate' || column.id === 'createdAt') {
        return { ...column, render: (value: string | null | undefined) => formatDate(value) || '--' }
      }

      return column
    })
  }, [handleRestore, handleSelect, preferenceColumns, requestRowDeletion, selectedIds, userCanPermanentDelete, userCanRestore])

  const pageTitle = useMemo(() => {
    if (viewFilter === 'inactive') return 'OPEN ACTIVITIES'
    if (viewFilter === 'all') return 'ALL ACTIVITIES'
    return 'ARCHIVED ACTIVITIES'
  }, [viewFilter])

  const searchPlaceholder = useMemo(() => {
    if (viewFilter === 'inactive') return 'Search open activities...'
    if (viewFilter === 'all') return 'Search all activities...'
    return 'Search completed activities...'
  }, [viewFilter])

  const emptyMessage = useMemo(() => {
    if (viewFilter === 'inactive') return 'No open activities found'
    if (viewFilter === 'all') return 'No activities found'
    return 'No completed activities found'
  }, [viewFilter])

  if (!canManageArchive) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Archived Activities</h1>
        <p className="mt-2 text-sm text-gray-600">Access denied. You do not have permission to view archived activities.</p>
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
            labels={{ active: 'Completed', inactive: 'Open', all: 'All' }}
            onChange={handleViewFilterChange}
          />
        }
        showColumnFilters
        filterColumns={ARCHIVE_ACTIVITY_FILTER_OPTIONS}
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
            data={activities}
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
        entity="Activity"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} activit${bulkDeleteTargets.length === 1 ? 'y' : 'ies'}`
            : activityToDelete?.description || 'Unknown Activity'
        }
        entityId={bulkDeleteTargets.length > 0 ? bulkDeleteTargets[0]?.id || '' : activityToDelete?.id || ''}
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((activity) => ({ id: activity.id, name: activity.description || 'Activity' }))
            : undefined
        }
        entityLabelPlural="Activities"
        isDeleted={true}
        onSoftDelete={async () => ({ success: false, error: 'Archived activities cannot be soft deleted again.' })}
        onPermanentDelete={handlePermanentDelete}
        onRestore={userCanRestore ? handleRestore : undefined}
        userCanPermanentDelete={userCanPermanentDelete}
        modalSize="revenue-schedules"
        note="Legend: Archived activities are completed. Reopen will mark them Open. Permanent delete is irreversible."
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}
