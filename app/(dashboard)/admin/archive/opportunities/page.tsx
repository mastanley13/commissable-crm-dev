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

type OpportunityArchiveRow = {
  id: string
  opportunityName: string
  opportunityId?: string
  accountId?: string | null
  accountLegalName?: string
  accountName?: string
  owner?: string
  stage?: string
  status?: string
  closeDate?: string | null
  active: boolean
  isDeleted: boolean
}

type SortState = { columnId: string; direction: 'asc' | 'desc' }

const TABLE_BOTTOM_RESERVE = 110
const TABLE_MIN_BODY_HEIGHT = 320

const ARCHIVE_OPPORTUNITY_BASE_COLUMNS: Column[] = [
  { id: 'select', label: 'Select', width: 110, minWidth: 80, maxWidth: 220, type: 'checkbox', hideable: false },
  { id: 'opportunityName', label: 'Opportunity Name', width: 260, minWidth: 200, sortable: true, hideable: false },
  { id: 'accountLegalName', label: 'Account Legal Name', width: 260, minWidth: 200, sortable: true },
  { id: 'owner', label: 'Owner', width: 200, sortable: true },
  { id: 'stage', label: 'Stage', width: 200, sortable: true },
  { id: 'status', label: 'Status', width: 140, sortable: true },
  { id: 'closeDate', label: 'Close Date', width: 140, sortable: true },
  { id: 'opportunityId', label: 'Opportunity ID', width: 160, sortable: false, hidden: true },
  { id: 'accountName', label: 'Account Name', width: 220, sortable: false, hidden: true },
]

const ARCHIVE_OPPORTUNITY_FILTER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'opportunityName', label: 'Opportunity Name' },
  { id: 'closeDate', label: 'Close Date' },
  { id: 'stage', label: 'Opportunity Stage' },
  { id: 'owner', label: 'Owner' },
  { id: 'accountLegalName', label: 'Account Legal Name' },
  { id: 'orderIdHouse', label: 'House - Order ID' },
  { id: 'accountIdVendor', label: 'Vendor - Account ID' },
  { id: 'customerIdVendor', label: 'Vendor - Customer ID' },
  { id: 'locationId', label: 'Location ID' },
  { id: 'opportunityId', label: 'Opportunity ID' },
  { id: 'referredBy', label: 'Lead Source' },
  { id: 'status', label: 'Status' },
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

export default function AdminArchivedOpportunitiesPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()
  const router = useRouter()

  const canManageArchive =
    hasPermission('opportunities.manage') || hasPermission('opportunities.delete') || hasPermission('accounts.manage')
  const userCanRestore =
    hasPermission('opportunities.manage') ||
    hasPermission('opportunities.edit.all') ||
    hasPermission('opportunities.edit.assigned') ||
    hasPermission('accounts.manage') ||
    hasPermission('accounts.update')
  const userCanPermanentDelete =
    hasPermission('opportunities.delete') || hasPermission('opportunities.manage') || hasPermission('opportunities.edit.all')

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
  } = useTablePreferences('opportunities:archive', ARCHIVE_OPPORTUNITY_BASE_COLUMNS, { defaultPageSize: 25 })

  const [opportunities, setOpportunities] = useState<OpportunityArchiveRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedOpportunityIds, setSelectedOpportunityIds] = useState<string[]>([])
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
  const [opportunityToDelete, setOpportunityToDelete] = useState<OpportunityArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<OpportunityArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / preferencePageSize))
    return {
      page,
      pageSize: preferencePageSize,
      total: totalRecords,
      totalPages,
    }
  }, [page, preferencePageSize, totalRecords])

  const reloadOpportunities = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      params.set('status', viewFilter === 'all' ? 'all' : 'inactive')

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

      const response = await fetch(`/api/opportunities?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load archived opportunities')
      }

      const rows: OpportunityArchiveRow[] = Array.isArray(payload?.data) ? payload.data : []
      const total = typeof payload?.pagination?.total === 'number' ? payload.pagination.total : rows.length
      setOpportunities(rows)
      setTotalRecords(total)
      setSelectedOpportunityIds([])
      setBulkDeleteTargets([])
      setError(null)
    } catch (err) {
      console.error(err)
      setOpportunities([])
      setSelectedOpportunityIds([])
      setBulkDeleteTargets([])
      setTotalRecords(0)
      setError('Unable to load archived opportunities')
    } finally {
      setLoading(false)
    }
  }, [columnFilters, page, preferencePageSize, searchQuery, sortState, viewFilter])

  useEffect(() => {
    if (!canManageArchive) return
    reloadOpportunities().catch(console.error)
  }, [canManageArchive, reloadOpportunities])

  const measureTableArea = useCallback(() => {
    const node = tableAreaNodeRef.current
    if (!node) return

    const measured = node.getBoundingClientRect().height
    const nextHeight = Math.max(TABLE_MIN_BODY_HEIGHT, Math.floor(measured - TABLE_BOTTOM_RESERVE))
    setTableBodyHeight(nextHeight)
  }, [])

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    measureTableArea()
    window.addEventListener('resize', measureTableArea)
    return () => window.removeEventListener('resize', measureTableArea)
  }, [measureTableArea])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const observer = new ResizeObserver(() => {
      measureTableArea()
    })
    if (tableAreaNodeRef.current) {
      observer.observe(tableAreaNodeRef.current)
    }
    return () => observer.disconnect()
  }, [measureTableArea])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setPage(1)
  }, [])

  const handleViewFilterChange = useCallback((next: 'active' | 'inactive' | 'all') => {
    setViewFilter(next)
    setSelectedOpportunityIds([])
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

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
  }, [])

  const handlePageSizeChange = useCallback((nextPageSize: number) => {
    persistPageSizeChange(nextPageSize)
    setPage(1)
  }, [persistPageSizeChange])

  const handleOpportunitySelect = useCallback((opportunityId: string, selected: boolean) => {
    setSelectedOpportunityIds((previous) => {
      if (selected) {
        return previous.includes(opportunityId) ? previous : [...previous, opportunityId]
      }
      return previous.filter((id) => id !== opportunityId)
    })
  }, [])

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedOpportunityIds(opportunities.map((row) => row.id))
      return
    }
    setSelectedOpportunityIds([])
  }, [opportunities])

  const handleRowClick = useCallback(
    (row: OpportunityArchiveRow) => {
      router.push(`/opportunities/${row.id}`)
    },
    [router],
  )

  const restoreOpportunityRequest = useCallback(async (opportunityId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        return { success: false, error: payload?.error ?? 'Failed to restore opportunity' }
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to restore opportunity' }
    }
  }, [])

  const handleRestore = useCallback(async (opportunityId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await restoreOpportunityRequest(opportunityId)
    if (result.success) {
      setOpportunities((previous) => previous.filter((row) => row.id !== opportunityId))
      setSelectedOpportunityIds((previous) => previous.filter((id) => id !== opportunityId))
      showSuccess('Opportunity restored', 'The opportunity was restored and removed from Archive.')
    }
    return result
  }, [restoreOpportunityRequest, showSuccess])

  const handleBulkRestore = useCallback(async () => {
    if (selectedOpportunityIds.length === 0) {
      showError('No opportunities selected', 'Select at least one archived opportunity to restore.')
      return
    }

    const targets = opportunities.filter((row) => selectedOpportunityIds.includes(row.id) && !row.active)
    if (targets.length === 0) {
      showError('No archived opportunities selected', 'All selected opportunities are already active.')
      return
    }

    setBulkActionLoading(true)
    try {
      const results = await Promise.allSettled(targets.map((row) => restoreOpportunityRequest(row.id)))
      const restoredIds: string[] = []
      const failures: Array<{ opportunity: OpportunityArchiveRow; message: string }> = []

      results.forEach((result, index) => {
        const opportunity = targets[index]
        if (result.status === 'fulfilled' && result.value.success) {
          restoredIds.push(opportunity.id)
        } else {
          const message =
            result.status === 'fulfilled'
              ? result.value.error || 'Failed to restore opportunity'
              : result.reason instanceof Error
                ? result.reason.message
                : 'Failed to restore opportunity'
          failures.push({ opportunity, message })
        }
      })

      if (restoredIds.length > 0) {
        const restoredSet = new Set(restoredIds)
        setOpportunities((previous) => previous.filter((row) => !restoredSet.has(row.id)))
        setSelectedOpportunityIds((previous) => previous.filter((id) => !restoredSet.has(id)))
        showSuccess(
          `Restored ${restoredIds.length} opportunit${restoredIds.length === 1 ? 'y' : 'ies'}`,
          'Restored opportunities were removed from Archive.',
        )
      }

      if (failures.length > 0) {
        const message = failures
          .slice(0, 5)
          .map(({ opportunity, message }) => `${opportunity.opportunityName || 'Opportunity'}: ${message}`)
          .join('; ')
        showError('Some restores failed', message)
      }
    } finally {
      setBulkActionLoading(false)
    }
  }, [opportunities, restoreOpportunityRequest, selectedOpportunityIds, showError, showSuccess])

  const handlePermanentDelete = useCallback(async (
    opportunityId: string,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const trimmedReason = typeof reason === 'string' ? reason.trim() : ''
      const response = await fetch(`/api/opportunities/${opportunityId}`, {
        method: 'DELETE',
        ...(trimmedReason
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason: trimmedReason }),
            }
          : {}),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        return { success: false, error: payload?.error ?? 'Failed to permanently delete opportunity' }
      }

      setOpportunities((previous) => previous.filter((row) => row.id !== opportunityId))
      setSelectedOpportunityIds((previous) => previous.filter((id) => id !== opportunityId))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to permanently delete opportunity' }
    }
  }, [])

  const requestRowDeletion = useCallback((row: OpportunityArchiveRow) => {
    if (!row.isDeleted) {
      showError('Not archived', 'Only archived opportunities can be permanently deleted from this page.')
      return
    }
    setBulkDeleteTargets([])
    setOpportunityToDelete(row)
    setShowDeleteDialog(true)
  }, [showError])

  const openBulkPermanentDeleteDialog = useCallback(() => {
    if (selectedOpportunityIds.length === 0) {
      showError('No opportunities selected', 'Select at least one archived opportunity to permanently delete.')
      return
    }

    const targets = opportunities.filter((row) => selectedOpportunityIds.includes(row.id) && row.isDeleted)
    if (targets.length === 0) {
      showError('No archived opportunities selected', 'Only archived opportunities can be permanently deleted here.')
      return
    }

    setBulkDeleteTargets(targets)
    setOpportunityToDelete(null)
    setShowDeleteDialog(true)
  }, [opportunities, selectedOpportunityIds, showError])

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false)
    setOpportunityToDelete(null)
    setBulkDeleteTargets([])
  }

  const bulkActions = useMemo(() => {
    return {
      selectedCount: selectedOpportunityIds.length,
      isBusy: bulkActionLoading,
      entityName: 'opportunities',
      actions: [
        {
          key: 'restore',
          label: 'Restore',
          icon: RotateCcw,
          tone: 'primary' as const,
          onClick: handleBulkRestore,
          tooltip: (count: number) => `Restore ${count} archived opportunit${count === 1 ? 'y' : 'ies'}`,
          disabled: !userCanRestore,
        },
        {
          key: 'export',
          label: 'Export CSV',
          icon: Download,
          tone: 'info' as const,
          onClick: () => {
            const rows = opportunities.filter((row) => selectedOpportunityIds.includes(row.id))
            if (rows.length === 0) {
              showError('No opportunities selected', 'Select at least one opportunity to export.')
              return
            }

            const lines = [
              ['Opportunity Name', 'Opportunity ID', 'Account Legal Name', 'Owner', 'Stage', 'Status', 'Close Date'].join(','),
              ...rows.map((row) =>
                [
                  escapeCsv(row.opportunityName),
                  escapeCsv(row.opportunityId),
                  escapeCsv(row.accountLegalName || row.accountName),
                  escapeCsv(row.owner),
                  escapeCsv(row.stage),
                  escapeCsv(row.status),
                  escapeCsv(formatDate(row.closeDate)),
                ].join(','),
              ),
            ].join('\r\n')

            const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            link.download = `opportunities-${viewFilter === 'active' ? 'archived' : viewFilter}-${timestamp}.csv`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
            showSuccess('Export complete', 'Check your downloads for the CSV file.')
          },
          tooltip: (count: number) => `Export ${count} opportunit${count === 1 ? 'y' : 'ies'} to CSV`,
        },
        {
          key: 'permanent-delete',
          label: 'Delete Permanently',
          icon: Trash2,
          tone: 'danger' as const,
          onClick: openBulkPermanentDeleteDialog,
          tooltip: (count: number) =>
            `Permanently delete ${count} archived opportunit${count === 1 ? 'y' : 'ies'}`,
          disabled: !userCanPermanentDelete,
        },
      ],
    }
  }, [
    bulkActionLoading,
    handleBulkRestore,
    openBulkPermanentDeleteDialog,
    opportunities,
    selectedOpportunityIds,
    showError,
    showSuccess,
    userCanPermanentDelete,
    userCanRestore,
    viewFilter,
  ])

  const tableColumns: Column[] = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === 'select') {
        return {
          ...column,
          render: (_value: unknown, row: OpportunityArchiveRow) => {
            const checked = selectedOpportunityIds.includes(row.id)
            const canRestoreRow = userCanRestore && !row.active
            const canDeleteRow = userCanPermanentDelete && row.isDeleted
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`Select opportunity ${row.opportunityName || row.id}`}
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
                    checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'
                  }`}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleOpportunitySelect(row.id, !checked)
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
                  aria-label="Restore opportunity"
                  title={canRestoreRow ? 'Restore opportunity' : row.active ? 'Already active' : 'Insufficient permissions'}
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
                  aria-label="Permanently delete opportunity"
                  title={
                    !row.isDeleted
                      ? 'Only archived opportunities can be permanently deleted here'
                      : canDeleteRow
                        ? 'Permanently delete'
                        : 'Insufficient permissions'
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )
          },
        }
      }

      if (column.id === 'opportunityName') {
        return {
          ...column,
          render: (value: string, row: OpportunityArchiveRow) => (
            <Link href={`/opportunities/${row.id}`} className="text-blue-600 hover:underline">
              {value || '--'}
            </Link>
          ),
        }
      }

      if (column.id === 'accountLegalName') {
        return {
          ...column,
          render: (value: string, row: OpportunityArchiveRow) => {
            const label = value || row.accountName || '--'
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

      if (column.id === 'closeDate') {
        return { ...column, render: (value: string | null | undefined) => formatDate(value) || '--' }
      }

      return column
    })
  }, [
    handleOpportunitySelect,
    handleRestore,
    preferenceColumns,
    requestRowDeletion,
    selectedOpportunityIds,
    userCanPermanentDelete,
    userCanRestore,
  ])

  const pageTitle = useMemo(() => {
    if (viewFilter === 'all') return 'ALL OPPORTUNITIES'
    return 'ARCHIVED OPPORTUNITIES'
  }, [viewFilter])

  const searchPlaceholder = useMemo(() => {
    if (viewFilter === 'all') return 'Search all opportunities...'
    return 'Search archived opportunities...'
  }, [viewFilter])

  const emptyMessage = useMemo(() => {
    if (viewFilter === 'all') return 'No opportunities found'
    return 'No archived opportunities found'
  }, [viewFilter])

  if (!canManageArchive) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Archived Opportunities</h1>
        <p className="mt-2 text-sm text-gray-600">
          Access denied. You need opportunity access permissions to view archived opportunities.
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
        filterColumns={ARCHIVE_OPPORTUNITY_FILTER_OPTIONS}
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
        <div ref={tableAreaNodeRef} className="flex-1 min-h-0">
          <DynamicTable
            columns={tableColumns}
            data={opportunities}
            onSort={handleSort}
            onRowClick={handleRowClick}
            loading={loading || preferenceLoading}
            emptyMessage={emptyMessage}
            onColumnsChange={handleColumnsChange}
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            selectedItems={selectedOpportunityIds}
            onItemSelect={handleOpportunitySelect}
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
        entity="Opportunity"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} opportunit${bulkDeleteTargets.length === 1 ? 'y' : 'ies'}`
            : opportunityToDelete?.opportunityName || 'Unknown Opportunity'
        }
        entityId={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets[0]?.id || ''
            : opportunityToDelete?.id || ''
        }
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((row) => ({
                id: row.id,
                name: row.opportunityName || 'Opportunity',
              }))
            : undefined
        }
        entityLabelPlural="Opportunities"
        isDeleted={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.every((opportunity) => opportunity.isDeleted)
            : opportunityToDelete?.isDeleted ?? false
        }
        onSoftDelete={async () => ({ success: false, error: 'Archived opportunities cannot be soft deleted again.' })}
        onPermanentDelete={handlePermanentDelete}
        onRestore={userCanRestore ? handleRestore : undefined}
        userCanPermanentDelete={userCanPermanentDelete}
        modalSize="revenue-schedules"
        requireReason
        note="Legend: Archived opportunities are inactive. Restore will return them to the active Opportunities list. Permanent delete is irreversible."
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}

