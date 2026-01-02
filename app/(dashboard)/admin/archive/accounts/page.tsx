'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { ListHeader } from '@/components/list-header'
import { CopyProtectionWrapper } from '@/components/copy-protection'
import { DynamicTable, type Column, type PaginationInfo } from '@/components/dynamic-table'
import { TwoStageDeleteDialog } from '@/components/two-stage-delete-dialog'
import { useAuth } from '@/lib/auth-context'
import { useToasts } from '@/components/toast'

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

function formatDate(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString()
}

export default function AdminArchivedAccountsPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()

  const canManageArchive = hasPermission('accounts.manage') || hasPermission('accounts.read')
  const userCanPermanentDelete = hasPermission('accounts.manage') && hasPermission('accounts.delete')
  const userCanRestore = hasPermission('accounts.manage')

  const [accounts, setAccounts] = useState<AccountArchiveRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalRecords, setTotalRecords] = useState(0)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<AccountArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<AccountArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    return {
      page,
      pageSize,
      total: totalRecords,
      totalPages,
    }
  }, [page, pageSize, totalRecords])

  const reloadAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', 'archived')
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (searchQuery.trim().length > 0) {
        params.set('q', searchQuery.trim())
      }

      const response = await fetch(`/api/accounts?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load archived accounts')
      }

      const payload = await response.json()
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
      setError('Unable to load archived accounts')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchQuery])

  useEffect(() => {
    if (!canManageArchive) return
    reloadAccounts().catch(console.error)
  }, [canManageArchive, reloadAccounts])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setPage(1)
  }, [])

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
  }, [])

  const handlePageSizeChange = useCallback((nextPageSize: number) => {
    setPageSize(nextPageSize)
    setPage(1)
  }, [])

  const handleAccountSelect = useCallback((accountId: string, selected: boolean) => {
    setSelectedAccounts((previous) => {
      if (selected) {
        return previous.includes(accountId) ? previous : [...previous, accountId]
      }
      return previous.filter((id) => id !== accountId)
    })
  }, [])

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedAccounts(accounts.map((account) => account.id))
      return
    }
    setSelectedAccounts([])
  }, [accounts])

  const openBulkPermanentDeleteDialog = useCallback(() => {
    if (selectedAccounts.length === 0) {
      showError('No accounts selected', 'Select at least one archived account to permanently delete.')
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

  const handleRestore = useCallback(async (accountId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await restoreAccountRequest(accountId)
    if (result.success) {
      setAccounts((previous) => previous.filter((account) => account.id !== accountId))
      setSelectedAccounts((previous) => previous.filter((id) => id !== accountId))
      showSuccess('Account restored', 'The account was restored and removed from Archive.')
    }
    return result
  }, [restoreAccountRequest, showSuccess])

  const handleBulkRestore = useCallback(async () => {
    if (selectedAccounts.length === 0) {
      showError('No accounts selected', 'Select at least one archived account to restore.')
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

  const handlePermanentDelete = useCallback(async (
    accountId: string,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> => {
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
  }, [])

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false)
    setAccountToDelete(null)
    setBulkDeleteTargets([])
  }

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
          tooltip: (count: number) => `Restore ${count} archived account${count === 1 ? '' : 's'}`,
          disabled: !userCanRestore,
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
  }, [bulkActionLoading, handleBulkRestore, openBulkPermanentDeleteDialog, selectedAccounts.length, userCanPermanentDelete, userCanRestore])

  const columns: Column[] = useMemo(() => {
    return [
      { id: 'select', label: 'Select', width: 70, type: 'checkbox', resizable: false, hideable: false },
      {
        id: 'accountName',
        label: 'Account Name',
        width: 260,
        sortable: true,
        render: (value: string, row: AccountArchiveRow) => (
          <Link href={`/accounts/${row.id}`} className="text-blue-600 hover:underline">
            {value || '—'}
          </Link>
        ),
      },
      { id: 'accountType', label: 'Account Type', width: 160, sortable: true },
      { id: 'accountLegalName', label: 'Legal Name', width: 240, sortable: true },
      { id: 'accountOwner', label: 'Account Owner', width: 180, sortable: true },
      {
        id: 'updatedAt',
        label: 'Archived On',
        width: 140,
        sortable: true,
        render: (value: string | null | undefined) => formatDate(value) || '—',
      },
      {
        id: 'actions',
        label: 'Actions',
        width: 140,
        resizable: false,
        render: (_value: unknown, row: AccountArchiveRow) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                handleRestore(row.id).catch(console.error)
              }}
              disabled={!userCanRestore}
              title={userCanRestore ? 'Restore account' : 'Insufficient permissions'}
            >
              Restore
            </button>
            <button
              type="button"
              className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                requestRowDeletion(row)
              }}
              disabled={!userCanPermanentDelete}
              title={userCanPermanentDelete ? 'Permanently delete' : 'Insufficient permissions'}
            >
              Delete
            </button>
          </div>
        ),
      },
    ]
  }, [handleRestore, requestRowDeletion, userCanPermanentDelete, userCanRestore])

  if (!canManageArchive) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Archived Accounts</h1>
        <p className="mt-2 text-sm text-gray-600">
          Access denied. You need account access permissions to view archived accounts.
        </p>
        {user?.role?.name ? (
          <p className="mt-2 text-xs text-gray-500">Role: {user.role.name}</p>
        ) : null}
      </div>
    )
  }

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
        pageTitle="ARCHIVED ACCOUNTS"
        searchPlaceholder="Search archived accounts..."
        onSearch={handleSearch}
        showStatusFilter={false}
        showColumnFilters={false}
        showCreateButton={false}
        bulkActions={bulkActions}
      />

      {error ? (
        <div className="px-4 text-sm text-red-600">{error}</div>
      ) : null}

      <div className="flex-1 min-h-0 p-4 pt-0 flex flex-col gap-4">
        <div className="flex-1 min-h-0">
          <DynamicTable
            columns={columns}
            data={accounts}
            loading={loading}
            emptyMessage="No archived accounts found"
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            selectedItems={selectedAccounts}
            onItemSelect={handleAccountSelect}
            onSelectAll={handleSelectAll}
            fillContainerWidth
            alwaysShowPagination
          />
        </div>
      </div>

      <TwoStageDeleteDialog
        isOpen={showDeleteDialog}
        onClose={closeDeleteDialog}
        entity="Account"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} account${bulkDeleteTargets.length === 1 ? '' : 's'}`
            : accountToDelete?.accountName || 'Unknown Account'
        }
        entityId={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets[0]?.id || ''
            : accountToDelete?.id || ''
        }
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
