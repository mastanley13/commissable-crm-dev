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

type RevenueScheduleArchiveRow = {
  id: string
  revenueScheduleName: string
  revenueScheduleDate?: string | null
  accountName?: string | null
  accountId?: string | null
  distributorName?: string | null
  vendorName?: string | null
  productNameVendor?: string | null
  scheduleStatus?: string
  deletedAt?: string | null
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString()
}

export default function AdminArchivedRevenueSchedulesPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()

  const roleCode = (user?.role?.code ?? '').toLowerCase()
  const isAdmin = roleCode === 'admin'
  const isAccounting = roleCode === 'accounting'

  const canManageArchive = hasPermission('revenue-schedules.manage') || isAdmin || isAccounting
  const userCanPermanentDelete = isAdmin

  const [schedules, setSchedules] = useState<RevenueScheduleArchiveRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalRecords, setTotalRecords] = useState(0)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [scheduleToDelete, setScheduleToDelete] = useState<RevenueScheduleArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<RevenueScheduleArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    return {
      page,
      pageSize,
      total: totalRecords,
      totalPages,
    }
  }, [page, pageSize, totalRecords])

  const reloadSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('includeDeleted', 'true')
      params.set('deletedOnly', 'true')
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (searchQuery.trim().length > 0) {
        params.set('q', searchQuery.trim())
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
  }, [page, pageSize, searchQuery])

  useEffect(() => {
    if (!canManageArchive) return
    reloadSchedules().catch(console.error)
  }, [canManageArchive, reloadSchedules])

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

  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((previous) => {
      if (selected) {
        return previous.includes(id) ? previous : [...previous, id]
      }
      return previous.filter((existingId) => existingId !== id)
    })
  }, [])

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedIds(schedules.map((row) => row.id))
      return
    }
    setSelectedIds([])
  }, [schedules])

  const restoreScheduleRequest = useCallback(async (
    scheduleId: string,
  ): Promise<{ success: boolean; error?: string }> => {
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

  const handleRestore = useCallback(async (scheduleId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await restoreScheduleRequest(scheduleId)
    if (result.success) {
      setSchedules((previous) => previous.filter((row) => row.id !== scheduleId))
      setSelectedIds((previous) => previous.filter((id) => id !== scheduleId))
      showSuccess('Revenue schedule restored', 'The revenue schedule was restored and removed from Archive.')
    }
    return result
  }, [restoreScheduleRequest, showSuccess])

  const handleBulkRestore = useCallback(async () => {
    if (selectedIds.length === 0) {
      showError('No revenue schedules selected', 'Select at least one archived revenue schedule to restore.')
      return
    }

    const targets = schedules.filter((row) => selectedIds.includes(row.id))
    if (targets.length === 0) {
      showError('Revenue schedules unavailable', 'Unable to locate the selected schedules. Refresh and try again.')
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
        setSchedules((previous) => previous.filter((row) => !restoredSet.has(row.id)))
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
  }, [restoreScheduleRequest, schedules, selectedIds, showError, showSuccess])

  const handlePermanentDelete = useCallback(async (
    scheduleId: string,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const trimmedReason = typeof reason === 'string' ? reason.trim() : ''
      const url = new URL(`/api/revenue-schedules/${scheduleId}`, window.location.origin)
      url.searchParams.set('stage', 'permanent')
      const response = await fetch(url.toString(), {
        method: 'DELETE',
        ...(trimmedReason
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason: trimmedReason }),
            }
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
  }, [])

  const requestRowDeletion = useCallback((row: RevenueScheduleArchiveRow) => {
    setBulkDeleteTargets([])
    setScheduleToDelete(row)
    setShowDeleteDialog(true)
  }, [])

  const openBulkPermanentDeleteDialog = useCallback(() => {
    if (selectedIds.length === 0) {
      showError('No revenue schedules selected', 'Select at least one archived revenue schedule to permanently delete.')
      return
    }

    const targets = schedules.filter((row) => selectedIds.includes(row.id))
    if (targets.length === 0) {
      showError('Revenue schedules unavailable', 'Unable to locate the selected schedules. Refresh and try again.')
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
  }, [bulkActionLoading, handleBulkRestore, openBulkPermanentDeleteDialog, selectedIds.length, userCanPermanentDelete])

  const columns: Column[] = useMemo(() => {
    return [
      { id: 'select', label: 'Select', width: 70, type: 'checkbox', resizable: false, hideable: false },
      {
        id: 'revenueScheduleName',
        label: 'Schedule',
        width: 220,
        sortable: true,
        render: (value: string, row: RevenueScheduleArchiveRow) => (
          <Link href={`/revenue-schedules/${row.id}`} className="text-blue-600 hover:underline">
            {value || '--'}
          </Link>
        ),
      },
      {
        id: 'revenueScheduleDate',
        label: 'Schedule Date',
        width: 140,
        sortable: true,
        render: (value: string | null | undefined) => formatDate(value) || '--',
      },
      {
        id: 'accountName',
        label: 'Account',
        width: 200,
        sortable: true,
        render: (value: string | null | undefined, row: RevenueScheduleArchiveRow) => {
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
      { id: 'distributorName', label: 'Distributor', width: 200, sortable: true },
      { id: 'vendorName', label: 'Vendor', width: 200, sortable: true },
      { id: 'productNameVendor', label: 'Product', width: 240, sortable: true },
      { id: 'scheduleStatus', label: 'Status', width: 140, sortable: true },
      {
        id: 'deletedAt',
        label: 'Archived On',
        width: 140,
        sortable: true,
        render: (value: string | null | undefined) => formatDate(value) || '--',
      },
      {
        id: 'actions',
        label: 'Actions',
        width: 140,
        resizable: false,
        render: (_value: unknown, row: RevenueScheduleArchiveRow) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-50"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                handleRestore(row.id).catch(console.error)
              }}
              title="Restore revenue schedule"
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
              title={userCanPermanentDelete ? 'Permanently delete' : 'Admin role required'}
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
        pageTitle="ARCHIVED REVENUE SCHEDULES"
        searchPlaceholder="Search archived revenue schedules..."
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
            data={schedules}
            loading={loading}
            emptyMessage="No archived revenue schedules found"
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            selectedItems={selectedIds}
            onItemSelect={handleSelect}
            onSelectAll={handleSelectAll}
            fillContainerWidth
            alwaysShowPagination
          />
        </div>
      </div>

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
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets[0]?.id || ''
            : scheduleToDelete?.id || ''
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
        isDeleted={true}
        onSoftDelete={async () => ({ success: false, error: 'Archived revenue schedules cannot be soft deleted again.' })}
        onPermanentDelete={handlePermanentDelete}
        onRestore={handleRestore}
        userCanPermanentDelete={userCanPermanentDelete}
        modalSize="revenue-schedules"
        requireReason
        note="Legend: Archived revenue schedules are soft-deleted. Restore will return them to the Revenue Schedules module. Permanent delete is irreversible."
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}

