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

type ActivityArchiveRow = {
  id: string
  subject: string
  type: string
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

export default function AdminArchivedActivitiesPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()

  const canManageArchive =
    hasPermission('activities.manage') || hasPermission('activities.read') || hasPermission('accounts.manage') || hasPermission('contacts.manage')
  const userCanRestore = hasPermission('activities.manage')
  const userCanPermanentDelete = hasPermission('activities.manage')

  const [activities, setActivities] = useState<ActivityArchiveRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalRecords, setTotalRecords] = useState(0)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [activityToDelete, setActivityToDelete] = useState<ActivityArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<ActivityArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    return { page, pageSize, total: totalRecords, totalPages }
  }, [page, pageSize, totalRecords])

  const reloadActivities = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('includeCompleted', 'true')
      params.set('status', 'Completed')
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (searchQuery.trim().length > 0) {
        params.set('q', searchQuery.trim())
      }

      const response = await fetch(`/api/activities?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load archived activities')
      }

      const rows: ActivityArchiveRow[] = Array.isArray(payload?.data) ? payload.data : []
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
  }, [page, pageSize, searchQuery])

  useEffect(() => {
    if (!canManageArchive) return
    reloadActivities().catch(console.error)
  }, [canManageArchive, reloadActivities])

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
        const message = failures.slice(0, 3).map((f) => `${f.activity.subject || 'Activity'}: ${f.message}`).join('; ')
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
  }, [bulkActionLoading, handleBulkRestore, openBulkPermanentDeleteDialog, selectedIds.length, userCanPermanentDelete, userCanRestore])

  const columns: Column[] = useMemo(() => {
    return [
      { id: 'select', label: 'Select', width: 70, type: 'checkbox', resizable: false, hideable: false },
      {
        id: 'subject',
        label: 'Subject',
        width: 280,
        sortable: true,
        render: (value: string, row: ActivityArchiveRow) => (
          <Link href={`/activities/${row.id}`} className="text-blue-600 hover:underline">
            {value || '--'}
          </Link>
        ),
      },
      { id: 'type', label: 'Type', width: 140, sortable: true },
      { id: 'accountName', label: 'Account', width: 200, sortable: true },
      { id: 'contactName', label: 'Contact', width: 200, sortable: true, hidden: true },
      { id: 'opportunityName', label: 'Opportunity', width: 240, sortable: true, hidden: true },
      { id: 'assigneeName', label: 'Assignee', width: 180, sortable: true },
      {
        id: 'dueDate',
        label: 'Due Date',
        width: 140,
        sortable: true,
        render: (value: string | null | undefined) => formatDate(value) || '--',
      },
      {
        id: 'createdAt',
        label: 'Created On',
        width: 140,
        sortable: true,
        render: (value: string | null | undefined) => formatDate(value) || '--',
        hidden: true,
      },
      {
        id: 'actions',
        label: 'Actions',
        width: 140,
        resizable: false,
        render: (_value: unknown, row: ActivityArchiveRow) => (
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
              title={userCanRestore ? 'Reopen activity' : 'Insufficient permissions'}
            >
              Reopen
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
        <h1 className="text-xl font-semibold text-gray-900">Archived Activities</h1>
        <p className="mt-2 text-sm text-gray-600">Access denied. You do not have permission to view archived activities.</p>
        {user?.role?.name ? <p className="mt-2 text-xs text-gray-500">Role: {user.role.name}</p> : null}
      </div>
    )
  }

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
        pageTitle="ARCHIVED ACTIVITIES"
        searchPlaceholder="Search archived activities..."
        onSearch={handleSearch}
        showStatusFilter={false}
        showColumnFilters={false}
        showCreateButton={false}
        bulkActions={bulkActions}
      />

      <div className="flex-1 min-h-0 p-4 pt-0 flex flex-col gap-4">
        {error ? <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        <div className="flex-1 min-h-0">
          <DynamicTable
            columns={columns}
            data={activities}
            loading={loading}
            emptyMessage="No archived activities found"
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
        entity="Activity"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} activit${bulkDeleteTargets.length === 1 ? 'y' : 'ies'}`
            : activityToDelete?.subject || 'Unknown Activity'
        }
        entityId={bulkDeleteTargets.length > 0 ? bulkDeleteTargets[0]?.id || '' : activityToDelete?.id || ''}
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((activity) => ({ id: activity.id, name: activity.subject || 'Activity' }))
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

