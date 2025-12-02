'use client'

import Link from 'next/link'
import { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column, PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { AccountStatusFilterDropdown } from '@/components/account-status-filter-dropdown'
import { buildStandardBulkActions } from '@/components/standard-bulk-actions'
import { useToasts } from '@/components/toast'
import { Check } from 'lucide-react'
import { ActivityListItem } from '@/lib/activity-service'
import { BulkOwnerModal, type BulkOwnerOption } from '@/components/bulk-owner-modal'
import { BulkStatusModal } from '@/components/bulk-status-modal'

interface ActivityRow {
  id: string
  active: boolean
  activityDate: string
  activityType: string
  description: string
  accountName: string
  attachment: boolean
  fileName: string | string[]
  status: string
  linkHref: string
  assigneeName: string | null
}

interface ColumnFilterState {
  columnId: string
  value: string
}

type SortDirection = 'asc' | 'desc'
type SortConfig = {
  columnId: string
  direction: SortDirection
}

const ACTIVITY_FILTER_COLUMNS = [
  { id: 'activityType', label: 'Activity Type' },
  { id: 'description', label: 'Activity Description' },
  { id: 'accountName', label: 'Account Name' },
  { id: 'status', label: 'Status' }
]

const ACTIVITY_COLUMNS: Column[] = [
  {
    id: 'multi-action',
    label: 'Select All',
    width: 200,
    minWidth: 120,
    maxWidth: 240,
    type: 'multi-action'
  },
  {
    id: 'active',
    label: 'Active',
    width: 100,
    minWidth: 80,
    maxWidth: 140,
    type: 'text'
  },
  {
    id: 'activityDate',
    label: 'Activity Date',
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    type: 'text'
  },
  {
    id: 'activityType',
    label: 'Activity Type',
    width: 150,
    minWidth: 120,
    maxWidth: 220,
    type: 'text'
  },
  {
    id: 'description',
    label: 'Activity Description',
    width: 260,
    minWidth: 200,
    maxWidth: 360,
    type: 'text'
  },
  {
    id: 'accountName',
    label: 'Account Name',
    width: 200,
    minWidth: 150,
    maxWidth: 280,
    type: 'text'
  },
  {
    id: 'attachment',
    label: 'Attachment',
    width: 130,
    minWidth: 100,
    maxWidth: 160,
    type: 'text'
  },
  {
    id: 'fileName',
    label: 'File Name',
    width: 240,
    minWidth: 180,
    maxWidth: 360,
    type: 'text'
  },
  {
    id: 'status',
    label: 'Status',
    width: 140,
    minWidth: 110,
    maxWidth: 200,
    type: 'text'
  }
]

const REQUEST_ANIMATION_FRAME =
  typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame.bind(window)
    : (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16)

const TABLE_BOTTOM_RESERVE = 110
const TABLE_MIN_BODY_HEIGHT = 320
const DEFAULT_SORT: SortConfig = { columnId: 'activityDate', direction: 'desc' }

function transformActivityForTable(activity: ActivityListItem): ActivityRow {
  const sourceDate = activity.dueDate ?? activity.createdAt
  const dateInstance = sourceDate instanceof Date ? sourceDate : new Date(sourceDate)
  const formattedDate = Number.isNaN(dateInstance.getTime())
    ? '-'
    : `${dateInstance.getFullYear()}/${String(dateInstance.getMonth() + 1).padStart(2, '0')}/${String(dateInstance.getDate()).padStart(2, '0')}`

  const attachments = activity.attachments ?? []
  const hasAttachment = attachments.length > 0

  let fileValue: string | string[] = '-'
  if (hasAttachment) {
    if (attachments.length === 1) {
      fileValue = attachments[0].fileName
    } else {
      fileValue = attachments.map(att => att.fileName)
    }
  }

  return {
    id: activity.id,
    active: activity.active ?? false,
    activityDate: formattedDate,
    activityType: activity.type,
    description: activity.subject ?? activity.description ?? 'View activity',
    accountName: activity.accountName ?? '-',
    attachment: hasAttachment,
    fileName: fileValue,
    status: activity.status,
    linkHref: `/activities/${activity.id}`,
    assigneeName: activity.assigneeName ?? null
  }
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active')
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState[]>([])
  const [selectedActivities, setSelectedActivities] = useState<string[]>([])
  const [showOwnerModal, setShowOwnerModal] = useState(false)
  const [ownerOptions, setOwnerOptions] = useState<BulkOwnerOption[]>([])
  const [ownersLoading, setOwnersLoading] = useState(false)
  const [ownerSubmitting, setOwnerSubmitting] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [statusSubmitting, setStatusSubmitting] = useState(false)
  const [sortConfig, setSortConfig] = useState<SortConfig>(DEFAULT_SORT)
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, pageSize: 25, total: 0, totalPages: 1 })
  const [tableBodyHeight, setTableBodyHeight] = useState<number>()
  const tableAreaNodeRef = useRef<HTMLDivElement | null>(null)
  const { showError, showSuccess } = useToasts()

  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    error: preferenceError,
    handleColumnsChange,
    saveChangesOnModalClose
  } = useTablePreferences("activities:list", ACTIVITY_COLUMNS)

  const tableLoading = loading || preferenceLoading

  const sanitizeColumnFilters = useCallback(() => {
    return columnFilters
      .map(filter => ({
        columnId: filter?.columnId ?? "",
        value: filter?.value?.trim() ?? ""
      }))
      .filter(filter => filter.columnId && filter.value.length > 0)
  }, [columnFilters])

  const reloadActivities = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))
      params.set("sortBy", sortConfig.columnId === 'activityDate' ? 'dueDate' : 'createdAt')
      params.set("sortDirection", sortConfig.direction)
      params.set("includeCompleted", statusFilter === "all" ? "true" : "false")
      if (searchQuery.trim().length > 0) {
        params.set("q", searchQuery.trim())
      }
      const normalizedFilters = sanitizeColumnFilters()
      if (normalizedFilters.length > 0) {
        params.set("columnFilters", JSON.stringify(normalizedFilters))
      }

      const response = await fetch(`/api/activities?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load activities")
      }

      const rows: ActivityListItem[] = Array.isArray(payload?.data) ? payload.data : []
      setActivities(rows.map(transformActivityForTable))

      const paginationPayload = payload?.pagination
      if (paginationPayload) {
        setPagination({
          page: paginationPayload.page ?? page,
          pageSize: paginationPayload.pageSize ?? pageSize,
          total: paginationPayload.total ?? rows.length,
          totalPages: paginationPayload.totalPages ?? Math.max(1, Math.ceil(rows.length / pageSize))
        })
      } else {
        setPagination({
          page,
          pageSize,
          total: rows.length,
          totalPages: Math.max(1, Math.ceil(rows.length / pageSize))
        })
      }

      const visibleIds = new Set(rows.map(item => item.id))
      setSelectedActivities(prev => prev.filter(id => visibleIds.has(id)))
    } catch (err) {
      console.error("Failed to load activities", err)
      const message = err instanceof Error ? err.message : "Unable to load activities"
      setError(message)
      setActivities([])
      setPagination(prev => ({ ...prev, total: 0, totalPages: 1 }))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchQuery, statusFilter, sortConfig, sanitizeColumnFilters])

  useEffect(() => {
    reloadActivities().catch(() => undefined)
  }, [reloadActivities])

  useEffect(() => {
    if (!showOwnerModal) {
      return
    }
    setOwnerOptions([])
    setOwnersLoading(true)
    fetch("/api/admin/users?status=Active&limit=200", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load owners")
        }
        const rawUsers = payload?.data?.users ?? payload?.users ?? []
        const users: any[] = Array.isArray(rawUsers) ? rawUsers : []
        const options: BulkOwnerOption[] = users.map(user => ({
          value: user.id,
          label: user.fullName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
        }))
        setOwnerOptions(options)
      })
      .catch(err => {
        console.error("Failed to load owners", err)
        setOwnerOptions([])
        showError("Unable to load owners", err instanceof Error ? err.message : "Please try again later.")
      })
      .finally(() => setOwnersLoading(false))
  }, [showOwnerModal, showError])

  const measureTableArea = useCallback(() => {
    const node = tableAreaNodeRef.current
    if (!node || typeof window === "undefined") {
      return
    }

    const rect = node.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
    if (viewportHeight <= 0) return

    const available = viewportHeight - rect.top - TABLE_BOTTOM_RESERVE
    if (!Number.isFinite(available)) return

    const nextHeight = Math.max(TABLE_MIN_BODY_HEIGHT, Math.floor(available))
    if (nextHeight !== tableBodyHeight) {
      setTableBodyHeight(nextHeight)
    }
  }, [tableBodyHeight])

  const tableAreaRef = useCallback((node: HTMLDivElement | null) => {
    tableAreaNodeRef.current = node
    if (node) {
      REQUEST_ANIMATION_FRAME(() => measureTableArea())
    }
  }, [measureTableArea])

  useLayoutEffect(() => {
    measureTableArea()
  }, [measureTableArea])

  useEffect(() => {
    const handleResize = () => measureTableArea()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [measureTableArea])

  useEffect(() => {
    REQUEST_ANIMATION_FRAME(() => measureTableArea())
  }, [measureTableArea, activities.length, page, pageSize])

  const hasInactiveSelectedActivities = selectedActivities.some(id => {
    const row = activities.find(activity => activity.id === id)
    return row && !row.active
  })

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setPage(1)
  }, [])

  const handleStatusClick = useCallback((filter: 'active' | 'all') => {
    setStatusFilter(filter)
    setPage(1)
  }, [])

  const handleColumnFiltersChange = useCallback((filters: ColumnFilterState[]) => {
    setColumnFilters(filters ?? [])
    setPage(1)
  }, [])

  const handleSort = useCallback((columnId: string, direction: SortDirection) => {
    setSortConfig({ columnId, direction })
    setPage(1)
  }, [])

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
  }, [])

  const handlePageSizeChange = useCallback((nextPageSize: number) => {
    setPageSize(nextPageSize)
    setPage(1)
  }, [])

  const handleSelectActivity = useCallback((id: string, selected: boolean) => {
    setSelectedActivities(prev => selected ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter(x => x !== id))
  }, [])

  const handleSelectAllActivities = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedActivities(activities.map(activity => activity.id))
    } else {
      setSelectedActivities([])
    }
  }, [activities])

  const handleBulkDelete = useCallback(() => {
    if (selectedActivities.length === 0) {
      showError("No activities selected", "Select at least one activity to delete.")
      return
    }
    const activityMap = new Map(activities.map(activity => [activity.id, activity]))
    const inactiveIds = selectedActivities.filter(id => {
      const row = activityMap.get(id)
      return row && !row.active
    })
    if (inactiveIds.length === 0) {
      showError("Only inactive items can be deleted", "Mark the selected activities inactive before deleting.")
      return
    }
    const confirmed = typeof window === "undefined"
      ? true
      : window.confirm(`Delete ${inactiveIds.length} inactive activit${inactiveIds.length === 1 ? "y" : "ies"}? This can't be undone.`)
    if (!confirmed) {
      return
    }
    const inactiveSet = new Set(inactiveIds)
    setActivities(prev => prev.filter(activity => !inactiveSet.has(activity.id)))
    setSelectedActivities(prev => prev.filter(id => !inactiveSet.has(id)))
    setPagination(prev => {
      const nextTotal = Math.max(0, prev.total - inactiveIds.length)
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / prev.pageSize))
      const nextPage = Math.min(prev.page, nextTotalPages)
      if (nextPage !== prev.page) {
        setPage(nextPage)
      }
      return {
        ...prev,
        total: nextTotal,
        totalPages: nextTotalPages,
        page: nextPage
      }
    })
    showSuccess("Activities deleted", `${inactiveIds.length} activit${inactiveIds.length === 1 ? "y" : "ies"} removed.`)
  }, [activities, selectedActivities, showError, showSuccess])

  const handleBulkReassign = useCallback(() => {
    if (selectedActivities.length === 0) {
      showError("No activities selected", "Select at least one activity to reassign.")
      return
    }
    setShowOwnerModal(true)
  }, [selectedActivities, showError])

  const handleBulkStatus = useCallback(() => {
    if (selectedActivities.length === 0) {
      showError("No activities selected", "Select at least one activity to update status.")
      return
    }
    setShowStatusModal(true)
  }, [selectedActivities, showError])

  const handleOwnerSubmit = useCallback(
    async (ownerId: string | null) => {
      if (ownerSubmitting) {
        return
      }
      if (selectedActivities.length === 0) {
        setShowOwnerModal(false)
        return
      }
      setOwnerSubmitting(true)
      const selectedSet = new Set(selectedActivities)
      const selectedCount = selectedSet.size
      const ownerLabel = ownerId
        ? ownerOptions.find(option => option.value === ownerId)?.label || "Selected owner"
        : "Unassigned"
      setActivities(prev =>
        prev.map(activity =>
          selectedSet.has(activity.id)
            ? { ...activity, assigneeName: ownerId ? ownerLabel : null }
            : activity
        )
      )
      setOwnerSubmitting(false)
      setShowOwnerModal(false)
      setSelectedActivities([])
      showSuccess(
        "Activities reassigned",
        `${selectedCount} activit${selectedCount === 1 ? "y" : "ies"} assigned to ${ownerLabel}.`
      )
    },
    [ownerOptions, ownerSubmitting, selectedActivities, showSuccess]
  )

  const handleStatusSubmit = useCallback(
    async (isActive: boolean) => {
      if (statusSubmitting) {
        return
      }
      if (selectedActivities.length === 0) {
        setShowStatusModal(false)
        return
      }
      setStatusSubmitting(true)
      const selectedSet = new Set(selectedActivities)
      const selectedCount = selectedSet.size
      setActivities(prev =>
        prev.map(activity => {
          if (!selectedSet.has(activity.id)) {
            return activity
          }
          const nextStatus = isActive
            ? (activity.status && activity.status.toLowerCase() !== "completed" ? activity.status : "Open")
            : "Completed"
          return {
            ...activity,
            active: isActive,
            status: nextStatus
          }
        })
      )
      setStatusSubmitting(false)
      setShowStatusModal(false)
      setSelectedActivities([])
      showSuccess(
        "Status updated",
        `Marked ${selectedCount} activit${selectedCount === 1 ? "y" : "ies"} as ${isActive ? "Active" : "Inactive"}.`
      )
    },
    [selectedActivities, showSuccess, statusSubmitting]
  )

  const handleBulkExport = useCallback(() => {
    if (selectedActivities.length === 0) {
      showError("No activities selected", "Select at least one activity to export.")
      return
    }
    console.log("Bulk export activities", selectedActivities)
    showSuccess("Export queued", "Bulk export for activities is not yet implemented.")
  }, [selectedActivities, showError, showSuccess])

  const tableColumns = useMemo(() => {
    return preferenceColumns.map(column => {
      if (column.id === 'multi-action') {
        return {
          ...column,
          render: (_: unknown, row: ActivityRow) => {
            const rowId = row.id
            const checked = selectedActivities.includes(rowId)
            return (
              <div className="flex items-center" data-disable-row-click="true">
                <label className="flex cursor-pointer items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    aria-label={`Select activity ${rowId}`}
                    onChange={() => handleSelectActivity(rowId, !checked)}
                    disabled={tableLoading}
                  />
                  <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'
                  }`}>
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
              </div>
            )
          }
        }
      }

      if (column.id === 'active') {
        return {
          ...column,
          render: (_: unknown, row: ActivityRow) => (
            <div className="flex justify-center">
              <div className={`h-3 w-3 rounded-full ${row.active ? 'bg-blue-600' : 'bg-gray-300'}`} />
            </div>
          )
        }
      }

      if (column.id === 'description') {
        return {
          ...column,
          render: (value: any, row: ActivityRow) => (
            <Link href={row.linkHref} className="block max-w-[260px] truncate text-primary-600 transition hover:text-primary-700 hover:underline">
              {value}
            </Link>
          )
        }
      }

      if (column.id === 'attachment') {
        return {
          ...column,
          render: (_: unknown, row: ActivityRow) => (
            <div className="flex justify-center">
              {row.attachment ? (
                <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              ) : (
                <span className="text-gray-300">-</span>
              )}
            </div>
          )
        }
      }

      if (column.id === 'fileName') {
        return {
          ...column,
          render: (value: any) => {
            if (!value || value === '-') {
              return <span className="text-gray-300">-</span>
            }
            if (Array.isArray(value)) {
              return (
                <div className="flex flex-wrap gap-1">
                  {value.map((file, index) => (
                    <span key={index} className="text-blue-600 hover:text-blue-800 cursor-pointer text-sm">
                      {file}
                      {index < value.length - 1 && ', '}
                    </span>
                  ))}
                </div>
              )
            }
            return (
              <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
                {value}
              </span>
            )
          }
        }
      }

        if (column.id === 'status') {
          return {
            ...column,
            render: (value: any) => (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                value === 'Completed' ? 'bg-blue-100 text-blue-800' :
                value === 'Open' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {value}
              </span>
            )
          }
        }

      return column
    })
  }, [preferenceColumns, selectedActivities, handleSelectActivity, tableLoading])

  return (
    <div className="dashboard-page-container">
      <ListHeader
        pageTitle="ACTIVITIES LIST"
        searchPlaceholder="Search activities..."
        onSearch={handleSearch}
        onFilterChange={() => {}}
        onSettingsClick={() => setShowColumnSettings(true)}
        filterColumns={ACTIVITY_FILTER_COLUMNS}
        columnFilters={columnFilters}
        onColumnFiltersChange={handleColumnFiltersChange}
        showStatusFilter={false}
        leftAccessory={
          <AccountStatusFilterDropdown
            value={statusFilter === 'active' ? 'active' : 'all'}
            onChange={(next) => handleStatusClick(next)}
            labels={{ active: 'Active', all: 'Show All' }}
          />
        }
        bulkActions={buildStandardBulkActions({
          selectedCount: selectedActivities.length,
          isBusy: tableLoading,
          entityLabelPlural: "activities",
          onDelete: handleBulkDelete,
          onReassign: handleBulkReassign,
          onStatus: handleBulkStatus,
          onExport: handleBulkExport,
          disableDelete: !hasInactiveSelectedActivities,
        })}
      />

      {preferenceError && (
        <div className="px-4 text-sm text-red-600">{preferenceError}</div>
      )}

      {error && (
        <div className="px-4 text-sm text-red-600">{error}</div>
      )}

      <div ref={tableAreaRef} className="flex-1 min-h-0 px-4 pb-4">
        <DynamicTable
          columns={tableColumns}
          data={activities}
          onSort={handleSort}
          loading={tableLoading}
          emptyMessage={tableLoading ? "Loading activities..." : "No activities found"}
          onColumnsChange={handleColumnsChange}
          selectedItems={selectedActivities}
          onItemSelect={(id, selected) => handleSelectActivity(id, selected)}
          onSelectAll={handleSelectAllActivities}
          pagination={pagination}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          autoSizeColumns={false}
          alwaysShowPagination
          maxBodyHeight={tableBodyHeight}
        />
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

      <BulkOwnerModal
        isOpen={showOwnerModal}
        owners={ownerOptions}
        entityLabel="activities"
        isLoading={ownersLoading}
        isSubmitting={ownerSubmitting}
        onClose={() => {
          if (ownerSubmitting) {
            return
          }
          setShowOwnerModal(false)
        }}
        onSubmit={handleOwnerSubmit}
      />

      <BulkStatusModal
        isOpen={showStatusModal}
        entityLabel="activities"
        isSubmitting={statusSubmitting}
        onClose={() => {
          if (statusSubmitting) {
            return
          }
          setShowStatusModal(false)
        }}
        onSubmit={handleStatusSubmit}
      />
    </div>
  )
}
