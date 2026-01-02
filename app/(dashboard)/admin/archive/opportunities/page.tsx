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

type OpportunityArchiveRow = {
  id: string
  opportunityName: string
  opportunityId?: string
  accountId?: string | null
  accountName?: string
  owner?: string
  stage?: string
  status?: string
  closeDate?: string | null
  active: boolean
  isDeleted: boolean
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString()
}

export default function AdminArchivedOpportunitiesPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()

  const canManageArchive =
    hasPermission('opportunities.manage') || hasPermission('opportunities.delete') || hasPermission('accounts.manage')
  const userCanPermanentDelete =
    hasPermission('opportunities.delete') || hasPermission('opportunities.manage') || hasPermission('opportunities.edit.all')

  const [opportunities, setOpportunities] = useState<OpportunityArchiveRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedOpportunityIds, setSelectedOpportunityIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalRecords, setTotalRecords] = useState(0)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [opportunityToDelete, setOpportunityToDelete] = useState<OpportunityArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<OpportunityArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    return {
      page,
      pageSize,
      total: totalRecords,
      totalPages,
    }
  }, [page, pageSize, totalRecords])

  const reloadOpportunities = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', 'inactive')
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (searchQuery.trim().length > 0) {
        params.set('q', searchQuery.trim())
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
  }, [page, pageSize, searchQuery])

  useEffect(() => {
    if (!canManageArchive) return
    reloadOpportunities().catch(console.error)
  }, [canManageArchive, reloadOpportunities])

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

    const targets = opportunities.filter((row) => selectedOpportunityIds.includes(row.id))
    if (targets.length === 0) {
      showError('Opportunities unavailable', 'Unable to locate the selected opportunities. Refresh and try again.')
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
    setBulkDeleteTargets([])
    setOpportunityToDelete(row)
    setShowDeleteDialog(true)
  }, [])

  const openBulkPermanentDeleteDialog = useCallback(() => {
    if (selectedOpportunityIds.length === 0) {
      showError('No opportunities selected', 'Select at least one archived opportunity to permanently delete.')
      return
    }

    const targets = opportunities.filter((row) => selectedOpportunityIds.includes(row.id))
    if (targets.length === 0) {
      showError('Opportunities unavailable', 'Unable to locate the selected opportunities. Refresh and try again.')
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
  }, [bulkActionLoading, handleBulkRestore, openBulkPermanentDeleteDialog, selectedOpportunityIds.length, userCanPermanentDelete])

  const columns: Column[] = useMemo(() => {
    return [
      { id: 'select', label: 'Select', width: 70, type: 'checkbox', resizable: false, hideable: false },
      {
        id: 'opportunityName',
        label: 'Opportunity',
        width: 280,
        sortable: true,
        render: (value: string, row: OpportunityArchiveRow) => (
          <Link href={`/opportunities/${row.id}`} className="text-blue-600 hover:underline">
            {value || '--'}
          </Link>
        ),
      },
      {
        id: 'accountName',
        label: 'Account',
        width: 220,
        sortable: true,
        render: (value: string, row: OpportunityArchiveRow) => {
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
      },
      { id: 'owner', label: 'Owner', width: 180, sortable: true },
      { id: 'stage', label: 'Stage', width: 200, sortable: true },
      { id: 'status', label: 'Status', width: 140, sortable: true },
      {
        id: 'closeDate',
        label: 'Close Date',
        width: 140,
        sortable: true,
        render: (value: string | null | undefined) => formatDate(value) || '--',
      },
      {
        id: 'actions',
        label: 'Actions',
        width: 140,
        resizable: false,
        render: (_value: unknown, row: OpportunityArchiveRow) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-50"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                handleRestore(row.id).catch(console.error)
              }}
              title="Restore opportunity"
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
  }, [handleRestore, requestRowDeletion, userCanPermanentDelete])

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
        pageTitle="ARCHIVED OPPORTUNITIES"
        searchPlaceholder="Search archived opportunities..."
        onSearch={handleSearch}
        showStatusFilter={false}
        showColumnFilters={false}
        showCreateButton={false}
        bulkActions={bulkActions}
      />

      {error ? <div className="px-4 text-sm text-red-600">{error}</div> : null}

      <div className="flex-1 min-h-0 p-4 pt-0 flex flex-col gap-4">
        <div className="flex-1 min-h-0">
          <DynamicTable
            columns={columns}
            data={opportunities}
            loading={loading}
            emptyMessage="No archived opportunities found"
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            selectedItems={selectedOpportunityIds}
            onItemSelect={handleOpportunitySelect}
            onSelectAll={handleSelectAll}
            fillContainerWidth
            alwaysShowPagination
          />
        </div>
      </div>

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
        isDeleted={true}
        onSoftDelete={async () => ({ success: false, error: 'Archived opportunities cannot be soft deleted again.' })}
        onPermanentDelete={handlePermanentDelete}
        onRestore={handleRestore}
        userCanPermanentDelete={userCanPermanentDelete}
        modalSize="revenue-schedules"
        requireReason
        note="Legend: Archived opportunities are inactive. Restore will return them to the active Opportunities list. Permanent delete is irreversible."
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}

