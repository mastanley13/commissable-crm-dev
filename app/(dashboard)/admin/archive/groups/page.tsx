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
import { calculateMinWidth } from '@/lib/column-width-utils'

type GroupArchiveRow = {
  id: string
  name: string
  groupType: string
  memberCount: number
  ownerName: string
  isActive: boolean
  description?: string | null
  createdAt?: string | null
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

const ARCHIVE_GROUP_BASE_COLUMNS: Column[] = [
  { id: 'select', label: 'Select', width: 110, minWidth: calculateMinWidth({ label: 'Select', type: 'checkbox', sortable: false }), maxWidth: 220, type: 'checkbox', hideable: false },
  { id: 'groupName', label: 'Group Name', width: 260, minWidth: calculateMinWidth({ label: 'Group Name', type: 'text', sortable: true }), sortable: true, hideable: false, accessor: 'name' },
  { id: 'groupType', label: 'Group Type', width: 160, minWidth: calculateMinWidth({ label: 'Group Type', type: 'text', sortable: true }), maxWidth: 240, sortable: true },
  { id: 'memberCount', label: 'Members', width: 130, minWidth: calculateMinWidth({ label: 'Members', type: 'text', sortable: true }), maxWidth: 180, sortable: true },
  { id: 'ownerName', label: 'Owner', width: 200, minWidth: calculateMinWidth({ label: 'Owner', type: 'text', sortable: true }), maxWidth: 300, sortable: true },
  { id: 'description', label: 'Description', width: 300, minWidth: calculateMinWidth({ label: 'Description', type: 'text', sortable: true }), maxWidth: 500, sortable: true, hidden: true },
  { id: 'createdDate', label: 'Created Date', width: 150, minWidth: calculateMinWidth({ label: 'Created Date', type: 'text', sortable: true }), maxWidth: 220, sortable: true, accessor: 'createdAt' },
]

const ARCHIVE_GROUP_FILTER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'groupName', label: 'Group Name' },
  { id: 'groupType', label: 'Group Type' },
  { id: 'ownerName', label: 'Group Owner' },
  { id: 'description', label: 'Description' },
]

export default function AdminArchivedGroupsPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()
  const router = useRouter()

  const canManageArchive =
    hasPermission('groups.manage') || hasPermission('groups.read') || hasPermission('accounts.manage') || hasPermission('accounts.read')
  const userCanRestore = hasPermission('groups.manage') || hasPermission('groups.edit') || hasPermission('accounts.manage') || hasPermission('accounts.update')
  const userCanPermanentDelete = hasPermission('groups.manage') || hasPermission('groups.delete') || hasPermission('accounts.manage') || hasPermission('accounts.delete')

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
  } = useTablePreferences('groups:archive', ARCHIVE_GROUP_BASE_COLUMNS, { defaultPageSize: 25 })

  const [groups, setGroups] = useState<GroupArchiveRow[]>([])
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
  const [groupToDelete, setGroupToDelete] = useState<GroupArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<GroupArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / preferencePageSize))
    return { page, pageSize: preferencePageSize, total: totalRecords, totalPages }
  }, [page, preferencePageSize, totalRecords])

  const reloadGroups = useCallback(async () => {
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

      const response = await fetch(`/api/groups?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load archived groups')
      }

      const rows: GroupArchiveRow[] = Array.isArray(payload?.data) ? payload.data : []
      const total = typeof payload?.pagination?.total === 'number' ? payload.pagination.total : rows.length
      setGroups(rows)
      setTotalRecords(total)
      setSelectedIds([])
      setBulkDeleteTargets([])
      setError(null)
    } catch (err) {
      console.error(err)
      setGroups([])
      setSelectedIds([])
      setBulkDeleteTargets([])
      setTotalRecords(0)
      setError('Unable to load archived groups')
    } finally {
      setLoading(false)
    }
  }, [columnFilters, page, preferencePageSize, searchQuery, sortState, viewFilter])

  useEffect(() => {
    if (!canManageArchive) return
    reloadGroups().catch(console.error)
  }, [canManageArchive, reloadGroups])

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
  }, [groups.length, loading, measureTableArea, page, preferenceLoading, selectedIds.length, viewFilter])

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
      setSelectedIds(groups.map((row) => row.id))
      return
    }
    setSelectedIds([])
  }, [groups])

  const handleRowClick = useCallback(
    (row: GroupArchiveRow) => {
      if (!row?.id) return
      router.push(`/groups/${row.id}`)
    },
    [router],
  )

  const restoreGroupRequest = useCallback(async (groupId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        return { success: false, error: payload?.error ?? 'Failed to restore group' }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to restore group' }
    }
  }, [])

  const handleRestore = useCallback(async (groupId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await restoreGroupRequest(groupId)
    if (result.success) {
      setGroups((previous) => previous.filter((row) => row.id !== groupId))
      setSelectedIds((previous) => previous.filter((id) => id !== groupId))
      showSuccess('Group restored', 'The group was marked Active and removed from Archive.')
    }
    return result
  }, [restoreGroupRequest, showSuccess])

  const handleBulkRestore = useCallback(async () => {
    if (!userCanRestore) return
    if (selectedIds.length === 0) {
      showError('No groups selected', 'Select at least one archived group to restore.')
      return
    }

    setBulkActionLoading(true)
    try {
      const targets = groups.filter((row) => selectedIds.includes(row.id))
      const results = await Promise.allSettled(targets.map((row) => restoreGroupRequest(row.id)))
      const restoredIds: string[] = []
      const failures: Array<{ group: GroupArchiveRow; message: string }> = []

      results.forEach((result, index) => {
        const group = targets[index]
        if (!group) return
        if (result.status === 'fulfilled' && result.value.success) {
          restoredIds.push(group.id)
          return
        }
        const message =
          result.status === 'fulfilled'
            ? result.value.error || 'Failed to restore group'
            : result.reason instanceof Error
              ? result.reason.message
              : 'Failed to restore group'
        failures.push({ group, message })
      })

      if (restoredIds.length > 0) {
        const restoredSet = new Set(restoredIds)
        setGroups((previous) => previous.filter((row) => !restoredSet.has(row.id)))
        setSelectedIds((previous) => previous.filter((id) => !restoredSet.has(id)))
        showSuccess(
          `Restored ${restoredIds.length} group${restoredIds.length === 1 ? '' : 's'}`,
          'Restored groups were removed from Archive.',
        )
      }

      if (failures.length > 0) {
        const message = failures.slice(0, 3).map((f) => `${f.group.name || 'Group'}: ${f.message}`).join('; ')
        showError('Some restores failed', message)
      }
    } finally {
      setBulkActionLoading(false)
    }
  }, [groups, restoreGroupRequest, selectedIds, showError, showSuccess, userCanRestore])

  const handlePermanentDelete = useCallback(async (groupId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/groups/${groupId}?force=true`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        return { success: false, error: payload?.error ?? 'Failed to permanently delete group' }
      }
      setGroups((previous) => previous.filter((row) => row.id !== groupId))
      setSelectedIds((previous) => previous.filter((id) => id !== groupId))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to permanently delete group' }
    }
  }, [])

  const requestRowDeletion = useCallback((row: GroupArchiveRow) => {
    setGroupToDelete(row)
    setBulkDeleteTargets([])
    setShowDeleteDialog(true)
  }, [])

  const openBulkPermanentDeleteDialog = useCallback(() => {
    if (selectedIds.length === 0) {
      showError('No groups selected', 'Select at least one archived group to permanently delete.')
      return
    }
    const targets = groups.filter((row) => selectedIds.includes(row.id))
    setBulkDeleteTargets(targets)
    setGroupToDelete(null)
    setShowDeleteDialog(true)
  }, [groups, selectedIds, showError])

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false)
    setGroupToDelete(null)
    setBulkDeleteTargets([])
  }

  const handleBulkExportCsv = useCallback(() => {
    const selectedSet = new Set(selectedIds)
    const rows = selectedIds.length > 0 ? groups.filter((row) => selectedSet.has(row.id)) : groups
    if (rows.length === 0) {
      showError('Nothing to export', 'Select at least one group or adjust filters before exporting.')
      return
    }

    const header = ['id', 'groupName', 'groupType', 'memberCount', 'ownerName', 'description', 'createdAt', 'isActive']
    const lines = [
      header.join(','),
      ...rows.map((row) =>
        [
          row.id,
          row.name,
          row.groupType,
          row.memberCount,
          row.ownerName,
          row.description ?? '',
          row.createdAt ?? '',
          row.isActive ? 'true' : 'false',
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
    link.download = `groups-${viewFilter === 'active' ? 'archived' : viewFilter}-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showSuccess('Export complete', 'Check your downloads for the CSV file.')
  }, [groups, selectedIds, showError, showSuccess, viewFilter])

  const bulkActions = useMemo(() => {
    return {
      selectedCount: selectedIds.length,
      isBusy: bulkActionLoading,
      entityName: 'groups',
      actions: [
        {
          key: 'restore',
          label: 'Restore',
          icon: RotateCcw,
          tone: 'primary' as const,
          onClick: handleBulkRestore,
          tooltip: (count: number) => `Restore ${count} archived group${count === 1 ? '' : 's'}`,
          disabled: !userCanRestore,
        },
        {
          key: 'export',
          label: 'Export CSV',
          icon: Download,
          tone: 'info' as const,
          onClick: handleBulkExportCsv,
          tooltip: (count: number) => `Export ${count} group${count === 1 ? '' : 's'} to CSV`,
          disabled: selectedIds.length === 0,
        },
        {
          key: 'permanent-delete',
          label: 'Delete Permanently',
          icon: Trash2,
          tone: 'danger' as const,
          onClick: openBulkPermanentDeleteDialog,
          tooltip: (count: number) => `Permanently delete ${count} archived group${count === 1 ? '' : 's'}`,
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
          render: (_value: unknown, row: GroupArchiveRow) => {
            const checked = selectedIds.includes(row.id)
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`Select group ${row.name || row.id}`}
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
                  aria-label="Restore group"
                  title={userCanRestore ? 'Restore group' : 'Insufficient permissions'}
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
                  aria-label="Permanently delete group"
                  title={userCanPermanentDelete ? 'Permanently delete' : 'Insufficient permissions'}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )
          },
        }
      }

      if (column.id === 'groupName') {
        return {
          ...column,
          render: (value: string, row: GroupArchiveRow) => (
            <Link href={`/groups/${row.id}`} className="text-blue-600 hover:underline">
              {value || '--'}
            </Link>
          ),
        }
      }

      if (column.id === 'createdDate') {
        return { ...column, render: (value: string | null | undefined) => formatDate(value) || '--' }
      }

      return column
    })
  }, [handleRestore, handleSelect, preferenceColumns, requestRowDeletion, selectedIds, userCanPermanentDelete, userCanRestore])

  const pageTitle = useMemo(() => {
    if (viewFilter === 'inactive') return 'ACTIVE GROUPS'
    if (viewFilter === 'all') return 'ALL GROUPS'
    return 'ARCHIVED GROUPS'
  }, [viewFilter])

  const searchPlaceholder = useMemo(() => {
    if (viewFilter === 'inactive') return 'Search active groups...'
    if (viewFilter === 'all') return 'Search all groups...'
    return 'Search archived groups...'
  }, [viewFilter])

  const emptyMessage = useMemo(() => {
    if (viewFilter === 'inactive') return 'No active groups found'
    if (viewFilter === 'all') return 'No groups found'
    return 'No archived groups found'
  }, [viewFilter])

  if (!canManageArchive) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Archived Groups</h1>
        <p className="mt-2 text-sm text-gray-600">Access denied. You do not have permission to view archived groups.</p>
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
        filterColumns={ARCHIVE_GROUP_FILTER_OPTIONS}
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
            data={groups}
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
        entity="Group"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} group${bulkDeleteTargets.length === 1 ? '' : 's'}`
            : groupToDelete?.name || 'Unknown Group'
        }
        entityId={
          bulkDeleteTargets.length > 0 ? bulkDeleteTargets[0]?.id || '' : groupToDelete?.id || ''
        }
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((group) => ({ id: group.id, name: group.name || 'Group' }))
            : undefined
        }
        entityLabelPlural="Groups"
        isDeleted={true}
        onSoftDelete={async () => ({ success: false, error: 'Archived groups cannot be soft deleted again.' })}
        onPermanentDelete={handlePermanentDelete}
        onRestore={userCanRestore ? handleRestore : undefined}
        userCanPermanentDelete={userCanPermanentDelete}
        modalSize="revenue-schedules"
        note="Legend: Archived groups are inactive. Restore will mark them Active. Permanent delete is irreversible."
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}
