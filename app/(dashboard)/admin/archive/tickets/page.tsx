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

type TicketArchiveRow = {
  id: string
  ticketNumber?: string
  distributorName: string
  vendorName: string
  issue: string
  status: string
  dueDate?: string | null
  assignedToName?: string
  requestorName?: string
  revenueSchedule?: string
  opportunityName?: string
  active: boolean
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString()
}

export default function AdminArchivedTicketsPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()

  const canManageArchive =
    hasPermission('tickets.view.all') || hasPermission('tickets.edit.all') || hasPermission('tickets.delete') || hasPermission('accounts.manage')
  const userCanRestore = hasPermission('tickets.edit.all') || hasPermission('tickets.delete')
  const userCanPermanentDelete = hasPermission('tickets.delete')

  const [tickets, setTickets] = useState<TicketArchiveRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalRecords, setTotalRecords] = useState(0)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [ticketToDelete, setTicketToDelete] = useState<TicketArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<TicketArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    return { page, pageSize, total: totalRecords, totalPages }
  }, [page, pageSize, totalRecords])

  const reloadTickets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', 'inactive')
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (searchQuery.trim().length > 0) {
        params.set('q', searchQuery.trim())
      }

      const response = await fetch(`/api/tickets?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load archived tickets')
      }

      const rows: TicketArchiveRow[] = Array.isArray(payload?.data) ? payload.data : []
      const total = typeof payload?.pagination?.total === 'number' ? payload.pagination.total : rows.length
      setTickets(rows)
      setTotalRecords(total)
      setSelectedIds([])
      setBulkDeleteTargets([])
      setError(null)
    } catch (err) {
      console.error(err)
      setTickets([])
      setSelectedIds([])
      setBulkDeleteTargets([])
      setTotalRecords(0)
      setError('Unable to load archived tickets')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchQuery])

  useEffect(() => {
    if (!canManageArchive) return
    reloadTickets().catch(console.error)
  }, [canManageArchive, reloadTickets])

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
      setSelectedIds(tickets.map((row) => row.id))
      return
    }
    setSelectedIds([])
  }, [tickets])

  const restoreTicketRequest = useCallback(async (ticketId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        return { success: false, error: payload?.error ?? 'Failed to reopen ticket' }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to reopen ticket' }
    }
  }, [])

  const handleRestore = useCallback(async (ticketId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await restoreTicketRequest(ticketId)
    if (result.success) {
      setTickets((previous) => previous.filter((row) => row.id !== ticketId))
      setSelectedIds((previous) => previous.filter((id) => id !== ticketId))
      showSuccess('Ticket reopened', 'The ticket was reopened and removed from Archive.')
    }
    return result
  }, [restoreTicketRequest, showSuccess])

  const handleBulkRestore = useCallback(async () => {
    if (!userCanRestore) return
    if (selectedIds.length === 0) {
      showError('No tickets selected', 'Select at least one archived ticket to reopen.')
      return
    }

    setBulkActionLoading(true)
    try {
      const targets = tickets.filter((row) => selectedIds.includes(row.id))
      const results = await Promise.allSettled(targets.map((row) => restoreTicketRequest(row.id)))
      const restoredIds: string[] = []
      const failures: Array<{ ticket: TicketArchiveRow; message: string }> = []

      results.forEach((result, index) => {
        const ticket = targets[index]
        if (!ticket) return
        if (result.status === 'fulfilled' && result.value.success) {
          restoredIds.push(ticket.id)
          return
        }
        const message =
          result.status === 'fulfilled'
            ? result.value.error || 'Failed to reopen ticket'
            : result.reason instanceof Error
              ? result.reason.message
              : 'Failed to reopen ticket'
        failures.push({ ticket, message })
      })

      if (restoredIds.length > 0) {
        const restoredSet = new Set(restoredIds)
        setTickets((previous) => previous.filter((row) => !restoredSet.has(row.id)))
        setSelectedIds((previous) => previous.filter((id) => !restoredSet.has(id)))
        showSuccess(
          `Reopened ${restoredIds.length} ticket${restoredIds.length === 1 ? '' : 's'}`,
          'Reopened tickets were removed from Archive.',
        )
      }

      if (failures.length > 0) {
        const message = failures.slice(0, 3).map((f) => `${f.ticket.ticketNumber || 'Ticket'}: ${f.message}`).join('; ')
        showError('Some reopens failed', message)
      }
    } finally {
      setBulkActionLoading(false)
    }
  }, [restoreTicketRequest, selectedIds, showError, showSuccess, tickets, userCanRestore])

  const handlePermanentDelete = useCallback(async (ticketId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        return { success: false, error: payload?.error ?? 'Failed to permanently delete ticket' }
      }
      setTickets((previous) => previous.filter((row) => row.id !== ticketId))
      setSelectedIds((previous) => previous.filter((id) => id !== ticketId))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to permanently delete ticket' }
    }
  }, [])

  const requestRowDeletion = useCallback((row: TicketArchiveRow) => {
    setTicketToDelete(row)
    setBulkDeleteTargets([])
    setShowDeleteDialog(true)
  }, [])

  const openBulkPermanentDeleteDialog = useCallback(() => {
    if (selectedIds.length === 0) {
      showError('No tickets selected', 'Select at least one archived ticket to permanently delete.')
      return
    }
    const targets = tickets.filter((row) => selectedIds.includes(row.id))
    setBulkDeleteTargets(targets)
    setTicketToDelete(null)
    setShowDeleteDialog(true)
  }, [selectedIds, showError, tickets])

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false)
    setTicketToDelete(null)
    setBulkDeleteTargets([])
  }

  const bulkActions = useMemo(() => {
    return {
      selectedCount: selectedIds.length,
      isBusy: bulkActionLoading,
      entityName: 'tickets',
      actions: [
        {
          key: 'restore',
          label: 'Reopen',
          icon: RotateCcw,
          tone: 'primary' as const,
          onClick: handleBulkRestore,
          tooltip: (count: number) => `Reopen ${count} archived ticket${count === 1 ? '' : 's'}`,
          disabled: !userCanRestore,
        },
        {
          key: 'permanent-delete',
          label: 'Delete Permanently',
          icon: Trash2,
          tone: 'danger' as const,
          onClick: openBulkPermanentDeleteDialog,
          tooltip: (count: number) => `Permanently delete ${count} archived ticket${count === 1 ? '' : 's'}`,
          disabled: !userCanPermanentDelete,
        },
      ],
    }
  }, [bulkActionLoading, handleBulkRestore, openBulkPermanentDeleteDialog, selectedIds.length, userCanPermanentDelete, userCanRestore])

  const columns: Column[] = useMemo(() => {
    return [
      { id: 'select', label: 'Select', width: 70, type: 'checkbox', resizable: false, hideable: false },
      {
        id: 'ticketNumber',
        label: 'Ticket #',
        width: 120,
        sortable: true,
        render: (value: string, row: TicketArchiveRow) => (
          <Link href={`/tickets/${row.id}`} className="text-blue-600 hover:underline">
            {value || row.id.slice(0, 8).toUpperCase()}
          </Link>
        ),
      },
      { id: 'issue', label: 'Issue', width: 260, sortable: true },
      { id: 'distributorName', label: 'Distributor', width: 200, sortable: true },
      { id: 'vendorName', label: 'Vendor', width: 200, sortable: true },
      { id: 'assignedToName', label: 'Owner', width: 180, sortable: true },
      {
        id: 'dueDate',
        label: 'Closed On',
        width: 140,
        sortable: true,
        render: (value: string | null | undefined) => formatDate(value) || '--',
      },
      { id: 'status', label: 'Status', width: 140, sortable: true, hidden: true },
      { id: 'revenueSchedule', label: 'Revenue Schedule', width: 180, sortable: true, hidden: true },
      { id: 'opportunityName', label: 'Opportunity', width: 220, sortable: true, hidden: true },
      {
        id: 'actions',
        label: 'Actions',
        width: 140,
        resizable: false,
        render: (_value: unknown, row: TicketArchiveRow) => (
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
              title={userCanRestore ? 'Reopen ticket' : 'Insufficient permissions'}
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
        <h1 className="text-xl font-semibold text-gray-900">Archived Tickets</h1>
        <p className="mt-2 text-sm text-gray-600">Access denied. You do not have permission to view archived tickets.</p>
        {user?.role?.name ? <p className="mt-2 text-xs text-gray-500">Role: {user.role.name}</p> : null}
      </div>
    )
  }

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
        pageTitle="ARCHIVED TICKETS"
        searchPlaceholder="Search archived tickets..."
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
            data={tickets}
            loading={loading}
            emptyMessage="No archived tickets found"
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
        entity="Ticket"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} ticket${bulkDeleteTargets.length === 1 ? '' : 's'}`
            : ticketToDelete?.ticketNumber || ticketToDelete?.issue || 'Unknown Ticket'
        }
        entityId={bulkDeleteTargets.length > 0 ? bulkDeleteTargets[0]?.id || '' : ticketToDelete?.id || ''}
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((ticket) => ({ id: ticket.id, name: ticket.ticketNumber || ticket.issue || 'Ticket' }))
            : undefined
        }
        entityLabelPlural="Tickets"
        isDeleted={true}
        onSoftDelete={async () => ({ success: false, error: 'Archived tickets cannot be soft deleted again.' })}
        onPermanentDelete={handlePermanentDelete}
        onRestore={userCanRestore ? handleRestore : undefined}
        userCanPermanentDelete={userCanPermanentDelete}
        modalSize="revenue-schedules"
        note="Legend: Archived tickets are closed/resolved. Reopen will return them to the active Tickets list. Permanent delete is irreversible."
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}

