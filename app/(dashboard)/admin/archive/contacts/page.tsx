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

type ContactArchiveRow = {
  id: string
  fullName: string
  jobTitle?: string
  emailAddress?: string
  mobile?: string
  workPhone?: string
  accountId?: string | null
  accountName?: string
  ownerName?: string
  deletedAt?: string | null
  isDeleted?: boolean
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString()
}

export default function AdminArchivedContactsPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()

  const canManageArchive = hasPermission('contacts.manage') || hasPermission('contacts.delete')
  const userCanPermanentDelete = hasPermission('contacts.delete')

  const [contacts, setContacts] = useState<ContactArchiveRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalRecords, setTotalRecords] = useState(0)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [contactToDelete, setContactToDelete] = useState<ContactArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<ContactArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    return {
      page,
      pageSize,
      total: totalRecords,
      totalPages,
    }
  }, [page, pageSize, totalRecords])

  const reloadContacts = useCallback(async () => {
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

      const response = await fetch(`/api/contacts?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load archived contacts')
      }

      const rows: ContactArchiveRow[] = Array.isArray(payload?.data) ? payload.data : []
      const total = typeof payload?.pagination?.total === 'number' ? payload.pagination.total : rows.length
      setContacts(rows)
      setTotalRecords(total)
      setSelectedContacts([])
      setBulkDeleteTargets([])
      setError(null)
    } catch (err) {
      console.error(err)
      setContacts([])
      setSelectedContacts([])
      setBulkDeleteTargets([])
      setTotalRecords(0)
      setError('Unable to load archived contacts')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchQuery])

  useEffect(() => {
    if (!canManageArchive) return
    reloadContacts().catch(console.error)
  }, [canManageArchive, reloadContacts])

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

  const handleContactSelect = useCallback((contactId: string, selected: boolean) => {
    setSelectedContacts((previous) => {
      if (selected) {
        return previous.includes(contactId) ? previous : [...previous, contactId]
      }
      return previous.filter((id) => id !== contactId)
    })
  }, [])

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedContacts(contacts.map((contact) => contact.id))
      return
    }
    setSelectedContacts([])
  }, [contacts])

  const restoreContactRequest = useCallback(async (contactId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        return { success: false, error: data?.error || 'Failed to restore contact' }
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to restore contact' }
    }
  }, [])

  const handleRestore = useCallback(async (contactId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await restoreContactRequest(contactId)
    if (result.success) {
      setContacts((previous) => previous.filter((contact) => contact.id !== contactId))
      setSelectedContacts((previous) => previous.filter((id) => id !== contactId))
      showSuccess('Contact restored', 'The contact was restored and removed from Archive.')
    }
    return result
  }, [restoreContactRequest, showSuccess])

  const handleBulkRestore = useCallback(async () => {
    if (selectedContacts.length === 0) {
      showError('No contacts selected', 'Select at least one archived contact to restore.')
      return
    }

    const targets = contacts.filter((contact) => selectedContacts.includes(contact.id))
    if (targets.length === 0) {
      showError('Contacts unavailable', 'Unable to locate the selected contacts. Refresh and try again.')
      return
    }

    setBulkActionLoading(true)
    try {
      const results = await Promise.allSettled(targets.map((contact) => restoreContactRequest(contact.id)))
      const restoredIds: string[] = []
      const failures: Array<{ contact: ContactArchiveRow; message: string }> = []

      results.forEach((result, index) => {
        const contact = targets[index]
        if (result.status === 'fulfilled' && result.value.success) {
          restoredIds.push(contact.id)
        } else {
          const message =
            result.status === 'fulfilled'
              ? result.value.error || 'Failed to restore contact'
              : result.reason instanceof Error
                ? result.reason.message
                : 'Failed to restore contact'
          failures.push({ contact, message })
        }
      })

      if (restoredIds.length > 0) {
        const restoredSet = new Set(restoredIds)
        setContacts((previous) => previous.filter((contact) => !restoredSet.has(contact.id)))
        setSelectedContacts((previous) => previous.filter((id) => !restoredSet.has(id)))
        showSuccess(
          `Restored ${restoredIds.length} contact${restoredIds.length === 1 ? '' : 's'}`,
          'Restored contacts were removed from Archive.',
        )
      }

      if (failures.length > 0) {
        const message = failures
          .slice(0, 5)
          .map(({ contact, message }) => `${contact.fullName || 'Contact'}: ${message}`)
          .join('; ')
        showError('Some restores failed', message)
      }
    } finally {
      setBulkActionLoading(false)
    }
  }, [contacts, restoreContactRequest, selectedContacts, showError, showSuccess])

  const handlePermanentDelete = useCallback(async (
    contactId: string,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const trimmedReason = typeof reason === 'string' ? reason.trim() : ''
      const response = await fetch(`/api/contacts/${contactId}?stage=permanent`, {
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
        return { success: false, error: data?.error || 'Failed to permanently delete contact' }
      }

      setContacts((previous) => previous.filter((contact) => contact.id !== contactId))
      setSelectedContacts((previous) => previous.filter((id) => id !== contactId))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to permanently delete contact' }
    }
  }, [])

  const requestRowDeletion = useCallback((row: ContactArchiveRow) => {
    setBulkDeleteTargets([])
    setContactToDelete(row)
    setShowDeleteDialog(true)
  }, [])

  const openBulkPermanentDeleteDialog = useCallback(() => {
    if (selectedContacts.length === 0) {
      showError('No contacts selected', 'Select at least one archived contact to permanently delete.')
      return
    }

    const targets = contacts.filter((contact) => selectedContacts.includes(contact.id))
    if (targets.length === 0) {
      showError('Contacts unavailable', 'Unable to locate the selected contacts. Refresh and try again.')
      return
    }

    setBulkDeleteTargets(targets)
    setContactToDelete(null)
    setShowDeleteDialog(true)
  }, [contacts, selectedContacts.length, showError])

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false)
    setContactToDelete(null)
    setBulkDeleteTargets([])
  }

  const bulkActions = useMemo(() => {
    return {
      selectedCount: selectedContacts.length,
      isBusy: bulkActionLoading,
      entityName: 'contacts',
      actions: [
        {
          key: 'restore',
          label: 'Restore',
          icon: RotateCcw,
          tone: 'primary' as const,
          onClick: handleBulkRestore,
          tooltip: (count: number) => `Restore ${count} archived contact${count === 1 ? '' : 's'}`,
        },
        {
          key: 'permanent-delete',
          label: 'Delete Permanently',
          icon: Trash2,
          tone: 'danger' as const,
          onClick: openBulkPermanentDeleteDialog,
          tooltip: (count: number) => `Permanently delete ${count} archived contact${count === 1 ? '' : 's'}`,
          disabled: !userCanPermanentDelete,
        },
      ],
    }
  }, [bulkActionLoading, handleBulkRestore, openBulkPermanentDeleteDialog, selectedContacts.length, userCanPermanentDelete])

  const columns: Column[] = useMemo(() => {
    return [
      { id: 'select', label: 'Select', width: 70, type: 'checkbox', resizable: false, hideable: false },
      {
        id: 'fullName',
        label: 'Contact Name',
        width: 260,
        sortable: true,
        render: (value: string, row: ContactArchiveRow) => (
          <Link href={`/contacts/${row.id}`} className="text-blue-600 hover:underline">
            {value || '--'}
          </Link>
        ),
      },
      { id: 'jobTitle', label: 'Job Title', width: 200, sortable: true },
      {
        id: 'accountName',
        label: 'Account',
        width: 220,
        sortable: true,
        render: (value: string, row: ContactArchiveRow) => {
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
      { id: 'emailAddress', label: 'Email', width: 240, sortable: true },
      { id: 'ownerName', label: 'Owner', width: 180, sortable: true },
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
        render: (_value: unknown, row: ContactArchiveRow) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-50"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                handleRestore(row.id).catch(console.error)
              }}
              title="Restore contact"
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
        <h1 className="text-xl font-semibold text-gray-900">Archived Contacts</h1>
        <p className="mt-2 text-sm text-gray-600">
          Access denied. You need contact management permissions to view archived contacts.
        </p>
        {user?.role?.name ? <p className="mt-2 text-xs text-gray-500">Role: {user.role.name}</p> : null}
      </div>
    )
  }

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
        pageTitle="ARCHIVED CONTACTS"
        searchPlaceholder="Search archived contacts..."
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
            data={contacts}
            loading={loading}
            emptyMessage="No archived contacts found"
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            selectedItems={selectedContacts}
            onItemSelect={handleContactSelect}
            onSelectAll={handleSelectAll}
            fillContainerWidth
            alwaysShowPagination
          />
        </div>
      </div>

      <TwoStageDeleteDialog
        isOpen={showDeleteDialog}
        onClose={closeDeleteDialog}
        entity="Contact"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} contact${bulkDeleteTargets.length === 1 ? '' : 's'}`
            : contactToDelete?.fullName || 'Unknown Contact'
        }
        entityId={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets[0]?.id || ''
            : contactToDelete?.id || ''
        }
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((contact) => ({
                id: contact.id,
                name: contact.fullName || 'Contact',
              }))
            : undefined
        }
        entityLabelPlural="Contacts"
        isDeleted={true}
        onSoftDelete={async () => ({ success: false, error: 'Archived contacts cannot be soft deleted again.' })}
        onPermanentDelete={handlePermanentDelete}
        onRestore={handleRestore}
        userCanPermanentDelete={userCanPermanentDelete}
        modalSize="revenue-schedules"
        requireReason
        note="Legend: Archived contacts are soft-deleted. Restore will return them to the main Contacts list. Permanent delete is irreversible."
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}

