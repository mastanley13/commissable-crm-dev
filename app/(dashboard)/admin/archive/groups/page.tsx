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

type GroupArchiveRow = {
  id: string
  name: string
  groupType: string
  memberCount: number
  ownerName: string
  isActive: boolean
  createdAt?: string | null
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString()
}

export default function AdminArchivedGroupsPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()

  const canManageArchive =
    hasPermission('groups.manage') || hasPermission('groups.read') || hasPermission('accounts.manage') || hasPermission('accounts.read')
  const userCanRestore = hasPermission('groups.manage') || hasPermission('groups.edit') || hasPermission('accounts.manage') || hasPermission('accounts.update')
  const userCanPermanentDelete = hasPermission('groups.manage') || hasPermission('groups.delete') || hasPermission('accounts.manage') || hasPermission('accounts.delete')

  const [groups, setGroups] = useState<GroupArchiveRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalRecords, setTotalRecords] = useState(0)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<GroupArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<GroupArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    return { page, pageSize, total: totalRecords, totalPages }
  }, [page, pageSize, totalRecords])

  const reloadGroups = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', 'inactive')
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (searchQuery.trim().length > 0) {
        params.set('q', searchQuery.trim())
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
  }, [page, pageSize, searchQuery])

  useEffect(() => {
    if (!canManageArchive) return
    reloadGroups().catch(console.error)
  }, [canManageArchive, reloadGroups])

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
      setSelectedIds(groups.map((row) => row.id))
      return
    }
    setSelectedIds([])
  }, [groups])

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
  }, [bulkActionLoading, handleBulkRestore, openBulkPermanentDeleteDialog, selectedIds.length, userCanPermanentDelete, userCanRestore])

  const columns: Column[] = useMemo(() => {
    return [
      { id: 'select', label: 'Select', width: 70, type: 'checkbox', resizable: false, hideable: false },
      {
        id: 'name',
        label: 'Group Name',
        width: 260,
        sortable: true,
        render: (value: string, row: GroupArchiveRow) => (
          <Link href={`/groups/${row.id}`} className="text-blue-600 hover:underline">
            {value || '--'}
          </Link>
        ),
      },
      { id: 'groupType', label: 'Group Type', width: 140, sortable: true },
      { id: 'memberCount', label: 'Members', width: 100, sortable: true },
      { id: 'ownerName', label: 'Owner', width: 180, sortable: true },
      {
        id: 'createdAt',
        label: 'Created On',
        width: 140,
        sortable: true,
        render: (value: string | null | undefined) => formatDate(value) || '--',
      },
      {
        id: 'actions',
        label: 'Actions',
        width: 140,
        resizable: false,
        render: (_value: unknown, row: GroupArchiveRow) => (
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
              title={userCanRestore ? 'Restore group' : 'Insufficient permissions'}
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
        <h1 className="text-xl font-semibold text-gray-900">Archived Groups</h1>
        <p className="mt-2 text-sm text-gray-600">Access denied. You do not have permission to view archived groups.</p>
        {user?.role?.name ? <p className="mt-2 text-xs text-gray-500">Role: {user.role.name}</p> : null}
      </div>
    )
  }

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
        pageTitle="ARCHIVED GROUPS"
        searchPlaceholder="Search archived groups..."
        onSearch={handleSearch}
        showStatusFilter={false}
        showColumnFilters={false}
        showCreateButton={false}
        bulkActions={bulkActions}
      />

      <div className="flex-1 min-h-0 p-4 pt-0 flex flex-col gap-4">
        {error ? (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="flex-1 min-h-0">
          <DynamicTable
            columns={columns}
            data={groups}
            loading={loading}
            emptyMessage="No archived groups found"
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

