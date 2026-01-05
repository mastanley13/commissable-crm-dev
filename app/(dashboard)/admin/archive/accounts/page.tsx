'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Download, RotateCcw, Trash2 } from 'lucide-react'
import { AccountStatusFilterDropdown } from '@/components/account-status-filter-dropdown'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { CopyProtectionWrapper } from '@/components/copy-protection'
import { DynamicTable, type Column, type PaginationInfo } from '@/components/dynamic-table'
import { ListHeader } from '@/components/list-header'
import { TwoStageDeleteDialog } from '@/components/two-stage-delete-dialog'
import { useToasts } from '@/components/toast'
import { useAuth } from '@/lib/auth-context'
import { useTablePreferences } from '@/hooks/useTablePreferences'

type AccountArchiveRow = {
  id: string
  accountName: string
  accountLegalName?: string
  accountType?: string
  accountOwner?: string
  status: string
  active: boolean
  isDeleted: boolean
  updatedAt?: string | null
}

type ListColumnFilter = {
  columnId: string
  value: string
  operator?: 'equals' | 'contains' | 'starts_with' | 'ends_with'
}

type SortState = { columnId: string; direction: 'asc' | 'desc' }

const TABLE_BOTTOM_RESERVE = 110
const TABLE_MIN_BODY_HEIGHT = 320

const ARCHIVE_ACCOUNT_BASE_COLUMNS: Column[] = [
  { id: 'select', label: 'Select', width: 90, minWidth: 70, maxWidth: 180, type: 'checkbox', hideable: false },
  { id: 'accountName', label: 'Account Name', width: 260, sortable: true, hideable: false },
  { id: 'accountType', label: 'Account Type', width: 160, sortable: true },
  { id: 'accountLegalName', label: 'Legal Name', width: 240, sortable: true },
  { id: 'accountOwner', label: 'Account Owner', width: 180, sortable: true },
  { id: 'status', label: 'Status', width: 140, sortable: true, hidden: true },
  { id: 'updatedAt', label: 'Archived On', width: 140, sortable: true },
]

const ARCHIVE_ACCOUNT_FILTER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'accountName', label: 'Account Name' },
  { id: 'accountLegalName', label: 'Legal Name' },
  { id: 'accountType', label: 'Account Type' },
  { id: 'accountOwner', label: 'Account Owner' },
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

export default function AdminArchivedAccountsPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()
  const router = useRouter()

  const canManageArchive = hasPermission('accounts.manage') || hasPermission('accounts.read')
  const userCanPermanentDelete = hasPermission('accounts.manage') && hasPermission('accounts.delete')
  const userCanRestore = hasPermission('accounts.manage')

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
  } = useTablePreferences('accounts:archive', ARCHIVE_ACCOUNT_BASE_COLUMNS, { defaultPageSize: 25 })

  const [accounts, setAccounts] = useState<AccountArchiveRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
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
  const [accountToDelete, setAccountToDelete] = useState<AccountArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<AccountArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / preferencePageSize))
    return { page, pageSize: preferencePageSize, total: totalRecords, totalPages }
  }, [page, preferencePageSize, totalRecords])

  const reloadAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      if (viewFilter === 'active') {
        params.set('status', 'archived')
      } else if (viewFilter === 'inactive') {
        params.set('status', 'inactive')
      } else {
        params.set('includeArchived', 'true')
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
          columnId: filter.columnId,
          value: typeof filter.value === 'string' ? filter.value.trim() : '',
          operator: filter.operator,
        }))
        .filter((filter) => filter.columnId.length > 0 && filter.value.length > 0)

      if (sanitizedFilters.length > 0) {
        params.set('filters', JSON.stringify(sanitizedFilters))
      }

      const response = await fetch(`/api/accounts?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to load accounts')
      }

      const payload = await response.json().catch(() => null)
      const rows: AccountArchiveRow[] = Array.isArray(payload?.data) ? payload.data : []
      const total = typeof payload?.pagination?.total === 'number' ? payload.pagination.total : rows.length

      setAccounts(rows)
      setTotalRecords(total)
      setSelectedAccounts([])
      setBulkDeleteTargets([])
      setError(null)
    } catch (err) {
      console.error(err)
      setAccounts([])
      setSelectedAccounts([])
      setBulkDeleteTargets([])
      setTotalRecords(0)
      setError(err instanceof Error ? err.message : 'Unable to load accounts')
    } finally {
      setLoading(false)
    }
  }, [columnFilters, page, preferencePageSize, searchQuery, sortState, viewFilter])

  useEffect(() => {
    if (!canManageArchive) return
    void reloadAccounts()
  }, [canManageArchive, reloadAccounts])

  const measureTableArea = useCallback(() => {
    const node = tableAreaNodeRef.current
    if (!node || typeof window === 'undefined') {
      return
    }

    const rect = node.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
    if (viewportHeight <= 0) {
      return
    }

    const available = viewportHeight - rect.top - TABLE_BOTTOM_RESERVE
    if (!Number.isFinite(available)) {
      return
    }

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

  useEffect(() => {
    measureTableArea()
  }, [measureTableArea])

  useEffect(() => {
    const handleResize = () => measureTableArea()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [measureTableArea])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.requestAnimationFrame(() => {
      measureTableArea()
    })
  }, [accounts.length, loading, measureTableArea, page, preferenceLoading, selectedAccounts.length, viewFilter])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setPage(1)
  }, [])

  const handleViewFilterChange = useCallback((next: 'active' | 'inactive' | 'all') => {
    setViewFilter(next)
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
      void persistPageSizeChange(nextPageSize)
      setPage(1)
    },
    [persistPageSizeChange],
  )

  const handleAccountSelect = useCallback((accountId: string, selected: boolean) => {
    setSelectedAccounts((previous) => {
      if (selected) {
        return previous.includes(accountId) ? previous : [...previous, accountId]
      }
      return previous.filter((id) => id !== accountId)
    })
  }, [])

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedAccounts(accounts.map((account) => account.id))
        return
      }
      setSelectedAccounts([])
    },
    [accounts],
  )

  const handleRowClick = useCallback(
    (row: AccountArchiveRow) => {
      router.push(`/accounts/${row.id}`)
    },
    [router],
  )

  const openBulkPermanentDeleteDialog = useCallback(() => {
    if (selectedAccounts.length === 0) {
      showError('No accounts selected', 'Select at least one account to permanently delete.')
      return
    }

    const targets = accounts.filter((account) => selectedAccounts.includes(account.id))
    if (targets.length === 0) {
      showError('Accounts unavailable', 'Unable to locate the selected accounts. Refresh and try again.')
      return
    }

    setBulkDeleteTargets(targets)
    setAccountToDelete(null)
    setShowDeleteDialog(true)
  }, [accounts, selectedAccounts, showError])

  const requestRowDeletion = useCallback((row: AccountArchiveRow) => {
    setAccountToDelete(row)
    setBulkDeleteTargets([])
    setShowDeleteDialog(true)
  }, [])

  const restoreAccountRequest = useCallback(async (accountId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        return { success: false, error: data?.error || 'Failed to restore account' }
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to restore account' }
    }
  }, [])

  const handleRestore = useCallback(
    async (accountId: string): Promise<{ success: boolean; error?: string }> => {
      const result = await restoreAccountRequest(accountId)
      if (result.success) {
        setAccounts((previous) => previous.filter((account) => account.id !== accountId))
        setSelectedAccounts((previous) => previous.filter((id) => id !== accountId))
        showSuccess('Account restored', 'The account was restored and removed from Archive.')
      }
      return result
    },
    [restoreAccountRequest, showSuccess],
  )

  const handleBulkRestore = useCallback(async () => {
    if (selectedAccounts.length === 0) {
      showError('No accounts selected', 'Select at least one account to restore.')
      return
    }

    const targets = accounts.filter((account) => selectedAccounts.includes(account.id))
    if (targets.length === 0) {
      showError('Accounts unavailable', 'Unable to locate the selected accounts. Refresh and try again.')
      return
    }

    setBulkActionLoading(true)
    try {
      const results = await Promise.allSettled(targets.map((account) => restoreAccountRequest(account.id)))
      const restoredIds: string[] = []
      const failures: Array<{ account: AccountArchiveRow; message: string }> = []

      results.forEach((result, index) => {
        const account = targets[index]
        if (result.status === 'fulfilled' && result.value.success) {
          restoredIds.push(account.id)
        } else {
          const message =
            result.status === 'fulfilled'
              ? result.value.error || 'Failed to restore account'
              : result.reason instanceof Error
                ? result.reason.message
                : 'Failed to restore account'
          failures.push({ account, message })
        }
      })

      if (restoredIds.length > 0) {
        const restoredSet = new Set(restoredIds)
        setAccounts((previous) => previous.filter((account) => !restoredSet.has(account.id)))
        setSelectedAccounts((previous) => previous.filter((id) => !restoredSet.has(id)))
        showSuccess(
          `Restored ${restoredIds.length} account${restoredIds.length === 1 ? '' : 's'}`,
          'Restored accounts were removed from Archive.',
        )
      }

      if (failures.length > 0) {
        const message = failures
          .slice(0, 5)
          .map(({ account, message }) => `${account.accountName || 'Account'}: ${message}`)
          .join('; ')
        showError('Some restores failed', message)
      }
    } finally {
      setBulkActionLoading(false)
    }
  }, [accounts, restoreAccountRequest, selectedAccounts, showError, showSuccess])

  const handlePermanentDelete = useCallback(
    async (accountId: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const trimmedReason = typeof reason === 'string' ? reason.trim() : ''
        const response = await fetch(`/api/accounts/${accountId}?stage=permanent`, {
          method: 'DELETE',
          ...(trimmedReason
            ? {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: trimmedReason }),
              }
            : {}),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => null)
          return { success: false, error: data?.error || 'Failed to permanently delete account' }
        }

        setAccounts((previous) => previous.filter((account) => account.id !== accountId))
        setSelectedAccounts((previous) => previous.filter((id) => id !== accountId))
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unable to permanently delete account' }
      }
    },
    [],
  )

  const closeDeleteDialog = useCallback(() => {
    setShowDeleteDialog(false)
    setAccountToDelete(null)
    setBulkDeleteTargets([])
  }, [])

  const handleBulkExportCsv = useCallback(async () => {
    if (selectedAccounts.length === 0) {
      showError('No accounts selected', 'Select at least one account to export.')
      return
    }

    const rows = accounts.filter((account) => selectedAccounts.includes(account.id))
    if (rows.length === 0) {
      showError('Nothing to export', 'The selected accounts are not on this page. Reload and try again.')
      return
    }

    const header = ['Account ID', 'Account Name', 'Legal Name', 'Account Type', 'Account Owner', 'Status', 'Archived On']
    const lines = [
      header.map(escapeCsv).join(','),
      ...rows.map((row) =>
        [row.id, row.accountName, row.accountLegalName, row.accountType, row.accountOwner, row.status, row.updatedAt]
          .map(escapeCsv)
          .join(','),
      ),
    ]

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    link.download = `accounts-${viewFilter === 'active' ? 'archived' : viewFilter}-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showSuccess('Export complete', 'Check your downloads for the CSV file.')
  }, [accounts, selectedAccounts, showError, showSuccess, viewFilter])

  const bulkActions = useMemo(() => {
    return {
      selectedCount: selectedAccounts.length,
      isBusy: bulkActionLoading,
      entityName: 'accounts',
      actions: [
        {
          key: 'restore',
          label: 'Restore',
          icon: RotateCcw,
          tone: 'primary' as const,
          onClick: handleBulkRestore,
          tooltip: (count: number) => `Restore ${count} account${count === 1 ? '' : 's'}`,
          disabled: !userCanRestore,
        },
        {
          key: 'export',
          label: 'Export CSV',
          icon: Download,
          tone: 'info' as const,
          onClick: handleBulkExportCsv,
          tooltip: (count: number) => `Export ${count} account${count === 1 ? '' : 's'} to CSV`,
          disabled: selectedAccounts.length === 0,
        },
        {
          key: 'permanent-delete',
          label: 'Delete Permanently',
          icon: Trash2,
          tone: 'danger' as const,
          onClick: openBulkPermanentDeleteDialog,
          tooltip: (count: number) => `Permanently delete ${count} archived account${count === 1 ? '' : 's'}`,
          disabled: !userCanPermanentDelete,
        },
      ],
    }
  }, [
    bulkActionLoading,
    handleBulkExportCsv,
    handleBulkRestore,
    openBulkPermanentDeleteDialog,
    selectedAccounts.length,
    userCanPermanentDelete,
    userCanRestore,
  ])

  const tableColumns: Column[] = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === 'select') {
        return {
          ...column,
          render: (_value: unknown, row: AccountArchiveRow) => {
            const checked = selectedAccounts.includes(row.id)
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`Select account ${row.accountName || row.id}`}
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
                    checked
                      ? 'border-primary-500 bg-primary-600 text-white'
                      : 'border-gray-300 bg-white text-transparent'
                  }`}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleAccountSelect(row.id, !checked)
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
                  aria-label="Restore account"
                  title={userCanRestore ? 'Restore account' : 'Insufficient permissions'}
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
                  aria-label="Permanently delete account"
                  title={userCanPermanentDelete ? 'Permanently delete' : 'Insufficient permissions'}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )
          },
        }
      }

      if (column.id === 'accountName') {
        return {
          ...column,
          render: (value: string, row: AccountArchiveRow) => (
            <Link href={`/accounts/${row.id}`} className="text-blue-600 hover:underline">
              {value || '--'}
            </Link>
          ),
        }
      }

      if (column.id === 'updatedAt') {
        return { ...column, render: (value: string | null | undefined) => formatDate(value) || '--' }
      }

      return column
    })
  }, [
    handleAccountSelect,
    handleRestore,
    preferenceColumns,
    requestRowDeletion,
    selectedAccounts,
    userCanPermanentDelete,
    userCanRestore,
  ])

  const pageTitle = useMemo(() => {
    if (viewFilter === 'inactive') return 'INACTIVE ACCOUNTS'
    if (viewFilter === 'all') return 'ALL ACCOUNTS'
    return 'ARCHIVED ACCOUNTS'
  }, [viewFilter])

  const searchPlaceholder = useMemo(() => {
    if (viewFilter === 'inactive') return 'Search inactive accounts...'
    if (viewFilter === 'all') return 'Search all accounts...'
    return 'Search archived accounts...'
  }, [viewFilter])

  const emptyMessage = useMemo(() => {
    if (viewFilter === 'inactive') return 'No inactive accounts found'
    if (viewFilter === 'all') return 'No accounts found'
    return 'No archived accounts found'
  }, [viewFilter])

  if (!canManageArchive) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Archived Accounts</h1>
        <p className="mt-2 text-sm text-gray-600">
          Access denied. You need account access permissions to view archived accounts.
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
            options={['active', 'inactive', 'all']}
            labels={{ active: 'Archived', inactive: 'Inactive', all: 'All' }}
            onChange={handleViewFilterChange}
          />
        }
        showColumnFilters
        filterColumns={ARCHIVE_ACCOUNT_FILTER_OPTIONS}
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
            data={accounts}
            onSort={handleSort}
            onRowClick={handleRowClick}
            loading={loading || preferenceLoading}
            emptyMessage={emptyMessage}
            onColumnsChange={handleColumnsChange}
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            selectedItems={selectedAccounts}
            onItemSelect={handleAccountSelect}
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
        entity="Account"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} account${bulkDeleteTargets.length === 1 ? '' : 's'}`
            : accountToDelete?.accountName || 'Unknown Account'
        }
        entityId={bulkDeleteTargets.length > 0 ? bulkDeleteTargets[0]?.id || '' : accountToDelete?.id || ''}
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((account) => ({
                id: account.id,
                name: account.accountName || 'Unknown Account',
                accountType: account.accountType || '',
                legalName: account.accountLegalName || '',
                accountOwner: account.accountOwner || '',
              }))
            : undefined
        }
        entitySummary={
          bulkDeleteTargets.length === 0 && accountToDelete
            ? {
                id: accountToDelete.id,
                name: accountToDelete.accountName || 'Unknown Account',
                accountType: accountToDelete.accountType || '',
                legalName: accountToDelete.accountLegalName || '',
                accountOwner: accountToDelete.accountOwner || '',
              }
            : undefined
        }
        entityLabelPlural="Accounts"
        isDeleted={true}
        onSoftDelete={async () => ({ success: false, error: 'Archived accounts cannot be soft deleted again.' })}
        onPermanentDelete={handlePermanentDelete}
        onRestore={userCanRestore ? handleRestore : undefined}
        userCanPermanentDelete={userCanPermanentDelete}
        modalSize="revenue-schedules"
        requireReason
        note="Legend: Archived accounts are soft-deleted. Restore will return them to the main Accounts list. Permanent delete is irreversible and may be blocked if related records still reference the account."
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}
