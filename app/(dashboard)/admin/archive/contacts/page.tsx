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

type ListColumnFilter = {
  columnId: string
  value: string
  operator?: 'equals' | 'contains' | 'starts_with' | 'ends_with'
}

type SortState = { columnId: string; direction: 'asc' | 'desc' }

const TABLE_BOTTOM_RESERVE = 110
const TABLE_MIN_BODY_HEIGHT = 320

const ARCHIVE_CONTACT_BASE_COLUMNS: Column[] = [
  { id: 'select', label: 'Select', width: 110, minWidth: 80, maxWidth: 220, type: 'checkbox', hideable: false },
  { id: 'fullName', label: 'Contact Name', width: 260, minWidth: 200, sortable: true, hideable: false },
  { id: 'jobTitle', label: 'Job Title', width: 200, sortable: true },
  { id: 'accountName', label: 'Account', width: 220, sortable: true },
  { id: 'emailAddress', label: 'Email', width: 240, sortable: true },
  { id: 'ownerName', label: 'Owner', width: 180, sortable: true },
  { id: 'deletedAt', label: 'Archived On', width: 140, sortable: true },
  { id: 'workPhone', label: 'Work Phone', width: 160, sortable: false, hidden: true },
  { id: 'mobile', label: 'Mobile', width: 160, sortable: false, hidden: true },
]

const ARCHIVE_CONTACT_FILTER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'fullName', label: 'Contact Name' },
  { id: 'jobTitle', label: 'Job Title' },
  { id: 'accountName', label: 'Account' },
  { id: 'emailAddress', label: 'Email' },
  { id: 'ownerName', label: 'Owner' },
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

export default function AdminArchivedContactsPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()
  const router = useRouter()

  const canManageArchive = hasPermission('contacts.manage') || hasPermission('contacts.read')
  const userCanPermanentDelete = hasPermission('contacts.delete')
  const userCanRestore = hasPermission('contacts.manage')

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
  } = useTablePreferences('contacts:archive', ARCHIVE_CONTACT_BASE_COLUMNS, { defaultPageSize: 25 })

  const [contacts, setContacts] = useState<ContactArchiveRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
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
  const [contactToDelete, setContactToDelete] = useState<ContactArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<ContactArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / preferencePageSize))
    return { page, pageSize: preferencePageSize, total: totalRecords, totalPages }
  }, [page, preferencePageSize, totalRecords])

  const reloadContacts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      if (viewFilter === 'active') {
        params.set('includeDeleted', 'true')
        params.set('deletedOnly', 'true')
      } else if (viewFilter === 'all') {
        params.set('includeDeleted', 'true')
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
        params.set('columnFilters', JSON.stringify(sanitizedFilters))
      }

      const response = await fetch(`/api/contacts?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load contacts')
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
      setError(err instanceof Error ? err.message : 'Unable to load contacts')
    } finally {
      setLoading(false)
    }
  }, [columnFilters, page, preferencePageSize, searchQuery, sortState, viewFilter])

  useEffect(() => {
    if (!canManageArchive) return
    void reloadContacts()
  }, [canManageArchive, reloadContacts])

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
  }, [contacts.length, loading, measureTableArea, page, preferenceLoading, selectedContacts.length, viewFilter])

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

  const handleContactSelect = useCallback((contactId: string, selected: boolean) => {
    setSelectedContacts((previous) => {
      if (selected) {
        return previous.includes(contactId) ? previous : [...previous, contactId]
      }
      return previous.filter((id) => id !== contactId)
    })
  }, [])

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedContacts(contacts.map((contact) => contact.id))
        return
      }
      setSelectedContacts([])
    },
    [contacts],
  )

  const handleRowClick = useCallback(
    (row: ContactArchiveRow) => {
      router.push(`/contacts/${row.id}`)
    },
    [router],
  )

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

  const handleRestore = useCallback(
    async (contactId: string): Promise<{ success: boolean; error?: string }> => {
      const result = await restoreContactRequest(contactId)
      if (result.success) {
        setContacts((previous) => previous.filter((contact) => contact.id !== contactId))
        setSelectedContacts((previous) => previous.filter((id) => id !== contactId))
        showSuccess('Contact restored', 'The contact was restored and removed from Archive.')
      }
      return result
    },
    [restoreContactRequest, showSuccess],
  )

  const handleBulkRestore = useCallback(async () => {
    if (selectedContacts.length === 0) {
      showError('No contacts selected', 'Select at least one contact to restore.')
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

  const handlePermanentDelete = useCallback(
    async (contactId: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
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
    },
    [],
  )

  const requestRowDeletion = useCallback((row: ContactArchiveRow) => {
    setBulkDeleteTargets([])
    setContactToDelete(row)
    setShowDeleteDialog(true)
  }, [])

  const openBulkPermanentDeleteDialog = useCallback(() => {
    if (selectedContacts.length === 0) {
      showError('No contacts selected', 'Select at least one contact to permanently delete.')
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
  }, [contacts, selectedContacts, showError])

  const closeDeleteDialog = useCallback(() => {
    setShowDeleteDialog(false)
    setContactToDelete(null)
    setBulkDeleteTargets([])
  }, [])

  const handleBulkExportCsv = useCallback(async () => {
    if (selectedContacts.length === 0) {
      showError('No contacts selected', 'Select at least one contact to export.')
      return
    }

    const rows = contacts.filter((contact) => selectedContacts.includes(contact.id))
    if (rows.length === 0) {
      showError('Nothing to export', 'The selected contacts are not on this page. Reload and try again.')
      return
    }

    const header = ['Contact ID', 'Full Name', 'Job Title', 'Account', 'Email', 'Owner', 'Archived On']
    const lines = [
      header.map(escapeCsv).join(','),
      ...rows.map((row) =>
        [row.id, row.fullName, row.jobTitle, row.accountName, row.emailAddress, row.ownerName, row.deletedAt]
          .map(escapeCsv)
          .join(','),
      ),
    ]

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    link.download = `contacts-${viewFilter === 'active' ? 'archived' : viewFilter}-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showSuccess('Export complete', 'Check your downloads for the CSV file.')
  }, [contacts, selectedContacts, showError, showSuccess, viewFilter])

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
          tooltip: (count: number) => `Restore ${count} contact${count === 1 ? '' : 's'}`,
          disabled: !userCanRestore,
        },
        {
          key: 'export',
          label: 'Export CSV',
          icon: Download,
          tone: 'info' as const,
          onClick: handleBulkExportCsv,
          tooltip: (count: number) => `Export ${count} contact${count === 1 ? '' : 's'} to CSV`,
          disabled: selectedContacts.length === 0,
        },
        {
          key: 'permanent-delete',
          label: 'Delete Permanently',
          icon: Trash2,
          tone: 'danger' as const,
          onClick: openBulkPermanentDeleteDialog,
          tooltip: (count: number) => `Permanently delete ${count} contact${count === 1 ? '' : 's'}`,
          disabled: !userCanPermanentDelete,
        },
      ],
    }
  }, [
    bulkActionLoading,
    handleBulkExportCsv,
    handleBulkRestore,
    openBulkPermanentDeleteDialog,
    selectedContacts.length,
    userCanPermanentDelete,
    userCanRestore,
  ])

  const tableColumns: Column[] = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === 'select') {
        return {
          ...column,
          render: (_value: unknown, row: ContactArchiveRow) => {
            const checked = selectedContacts.includes(row.id)
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`Select contact ${row.fullName || row.id}`}
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
                    checked
                      ? 'border-primary-500 bg-primary-600 text-white'
                      : 'border-gray-300 bg-white text-transparent'
                  }`}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleContactSelect(row.id, !checked)
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
                  aria-label="Restore contact"
                  title={userCanRestore ? 'Restore contact' : 'Insufficient permissions'}
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
                  aria-label="Permanently delete contact"
                  title={userCanPermanentDelete ? 'Permanently delete' : 'Insufficient permissions'}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )
          },
        }
      }

      if (column.id === 'fullName') {
        return {
          ...column,
          render: (value: string, row: ContactArchiveRow) => (
            <Link href={`/contacts/${row.id}`} className="text-blue-600 hover:underline">
              {value || '--'}
            </Link>
          ),
        }
      }

      if (column.id === 'accountName') {
        return {
          ...column,
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
        }
      }

      if (column.id === 'deletedAt') {
        return { ...column, render: (value: string | null | undefined) => formatDate(value) || '--' }
      }

      return column
    })
  }, [
    handleContactSelect,
    handleRestore,
    preferenceColumns,
    requestRowDeletion,
    selectedContacts,
    userCanPermanentDelete,
    userCanRestore,
  ])

  const pageTitle = useMemo(() => {
    if (viewFilter === 'inactive') return 'ACTIVE CONTACTS'
    if (viewFilter === 'all') return 'ALL CONTACTS'
    return 'ARCHIVED CONTACTS'
  }, [viewFilter])

  const searchPlaceholder = useMemo(() => {
    if (viewFilter === 'inactive') return 'Search active contacts...'
    if (viewFilter === 'all') return 'Search all contacts...'
    return 'Search archived contacts...'
  }, [viewFilter])

  const emptyMessage = useMemo(() => {
    if (viewFilter === 'inactive') return 'No active contacts found'
    if (viewFilter === 'all') return 'No contacts found'
    return 'No archived contacts found'
  }, [viewFilter])

  if (!canManageArchive) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Archived Contacts</h1>
        <p className="mt-2 text-sm text-gray-600">
          Access denied. You need contact access permissions to view archived contacts.
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
            labels={{ active: 'Archived', inactive: 'Active', all: 'All' }}
            onChange={handleViewFilterChange}
          />
        }
        showColumnFilters
        filterColumns={ARCHIVE_CONTACT_FILTER_OPTIONS}
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
            data={contacts}
            onSort={handleSort}
            onRowClick={handleRowClick}
            loading={loading || preferenceLoading}
            emptyMessage={emptyMessage}
            onColumnsChange={handleColumnsChange}
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            selectedItems={selectedContacts}
            onItemSelect={handleContactSelect}
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
        entity="Contact"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} contact${bulkDeleteTargets.length === 1 ? '' : 's'}`
            : contactToDelete?.fullName || 'Unknown Contact'
        }
        entityId={bulkDeleteTargets.length > 0 ? bulkDeleteTargets[0]?.id || '' : contactToDelete?.id || ''}
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((contact) => ({
                id: contact.id,
                name: contact.fullName || 'Contact',
                email: contact.emailAddress ?? '',
                workPhone: contact.workPhone ?? '',
                mobile: contact.mobile ?? '',
              }))
            : undefined
        }
        entitySummary={
          bulkDeleteTargets.length === 0 && contactToDelete
            ? {
                id: contactToDelete.id,
                name: contactToDelete.fullName || 'Unknown Contact',
                email: contactToDelete.emailAddress ?? '',
                workPhone: contactToDelete.workPhone ?? '',
                mobile: contactToDelete.mobile ?? '',
              }
            : undefined
        }
        entityLabelPlural="Contacts"
        isDeleted={true}
        onSoftDelete={async () => ({ success: false, error: 'Archived contacts cannot be soft deleted again.' })}
        onPermanentDelete={handlePermanentDelete}
        onRestore={userCanRestore ? handleRestore : undefined}
        userCanPermanentDelete={userCanPermanentDelete}
        modalSize="revenue-schedules"
        requireReason
        note="Legend: Archived contacts are soft-deleted. Restore will return them to the main Contacts list. Permanent delete is irreversible."
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}

