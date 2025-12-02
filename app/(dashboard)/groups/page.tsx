'use client'

import { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column, PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { GroupCreateModal } from '@/components/group-create-modal'
import { GroupEditModal } from '@/components/group-edit-modal'
import { GroupBulkOwnerModal } from '@/components/group-bulk-owner-modal'
import { GroupBulkStatusModal } from '@/components/group-bulk-status-modal'
import { useToasts } from '@/components/toast'
import { buildStandardBulkActions } from '@/components/standard-bulk-actions'
import { Users, Check } from 'lucide-react'

interface GroupRow {
  id: string
  groupName: string
  groupType: string
  memberCount: number
  description: string
  createdDate: string
  active: boolean
  ownerName?: string
}

interface ColumnFilterState {
  columnId: string
  value: string
}

interface OwnerOption {
  value: string
  label: string
}

type SortDirection = 'asc' | 'desc'
type SortConfig = {
  columnId: string
  direction: SortDirection
}

const REQUEST_ANIMATION_FRAME =
  typeof window !== "undefined" && window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16)

const TABLE_BOTTOM_RESERVE = 110
const TABLE_MIN_BODY_HEIGHT = 320
const DEFAULT_SORT: SortConfig = { columnId: 'groupName', direction: 'asc' }
const GROUP_FILTER_COLUMNS = [
  { id: "groupName", label: "Group Name" },
  { id: "groupType", label: "Group Type" },
  { id: "description", label: "Description" },
  { id: "ownerName", label: "Group Owner" }
]

const groupColumns: Column[] = [
  {
    id: 'multi-action',
    label: 'Select All',
    width: 200,
    minWidth: 100,
    maxWidth: 240,
    type: 'multi-action',
  },
  {
    id: 'groupName',
    label: 'Group Name',
    width: 200,
    minWidth: 150,
    maxWidth: 320,
    sortable: true,
    type: 'text',
    render: (value) => (
      <span className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
        {value}
      </span>
    )
  },
  {
    id: 'groupType',
    label: 'Group Type',
    width: 150,
    minWidth: 120,
    maxWidth: 220,
    sortable: true,
    type: 'text'
  },
  {
    id: 'memberCount',
    label: 'Member Count',
    width: 140,
    minWidth: 120,
    maxWidth: 180,
    sortable: true,
    type: 'text',
    render: (value) => (
      <div className="flex items-center gap-1">
        <Users className="h-4 w-4 text-gray-500" />
        <span>{value}</span>
      </div>
    )
  },
  {
    id: 'description',
    label: 'Description',
    width: 260,
    minWidth: 200,
    maxWidth: 420,
    sortable: true,
    type: 'text'
  },
  {
    id: 'createdDate',
    label: 'Created Date',
    width: 150,
    minWidth: 120,
    maxWidth: 220,
    sortable: true,
    type: 'text'
  }
]

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, pageSize: 25, total: 0, totalPages: 1 })
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState<SortConfig>(DEFAULT_SORT)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState[]>([])
  const [tableBodyHeight, setTableBodyHeight] = useState<number>()
  const tableAreaNodeRef = useRef<HTMLDivElement | null>(null)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<GroupRow | null>(null)
  const [showBulkOwnerModal, setShowBulkOwnerModal] = useState(false)
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false)
  const [bulkOwnerOptions, setBulkOwnerOptions] = useState<OwnerOption[]>([])
  const [bulkOwnersLoading, setBulkOwnersLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const { showError, showSuccess } = useToasts()

  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    error: preferenceError,
    handleColumnsChange,
    saveChangesOnModalClose,
  } = useTablePreferences("groups:list", groupColumns)

  const tableLoading = loading || preferenceLoading

  const reloadGroups = useCallback(async (options?: { keepSelection?: boolean }) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))
      if (searchQuery.trim().length > 0) {
        params.set("q", searchQuery.trim())
      }
      params.set("status", statusFilter === "active" ? "active" : "all")
      if (columnFilters.length > 0) {
        const sanitizedFilters = columnFilters
          .filter(filter => filter?.columnId && filter?.value?.trim().length > 0)
          .map(filter => ({
            columnId: filter.columnId,
            value: filter.value.trim()
          }))
        if (sanitizedFilters.length > 0) {
          params.set("columnFilters", JSON.stringify(sanitizedFilters))
        }
      }
      if (sortConfig.columnId) {
        params.set("sortBy", sortConfig.columnId)
        params.set("sortDir", sortConfig.direction)
      }

      const response = await fetch(`/api/groups?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load groups")
      }

      const items: any[] = Array.isArray(payload?.data) ? payload.data : []

      const mapped: GroupRow[] = items.map((item) => ({
        id: String(item.id),
        groupName: item.name ?? "",
        groupType: item.groupType ?? "",
        memberCount: typeof item.memberCount === "number" ? item.memberCount : 0,
        description: item.description ?? "",
        createdDate: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "",
        active: item.isActive !== false,
        ownerName: item.ownerName ?? ""
      }))

      setGroups(mapped)

      const paginationPayload = payload?.pagination
      if (paginationPayload) {
        const totalPages = Math.max(1, Math.ceil((paginationPayload.total ?? 0) / (paginationPayload.pageSize ?? pageSize)))
        setPagination({
          page: paginationPayload.page ?? page,
          pageSize: paginationPayload.pageSize ?? pageSize,
          total: paginationPayload.total ?? mapped.length,
          totalPages
        })
      } else {
        const totalPages = Math.max(1, Math.ceil(mapped.length / pageSize))
        setPagination({
          page,
          pageSize,
          total: mapped.length,
          totalPages
        })
      }

      setSelectedGroupIds(previous => {
        if (options?.keepSelection) {
          return previous
        }
        const visibleIds = new Set(mapped.map(row => row.id))
        return previous.filter(id => visibleIds.has(id))
      })
    } catch (err) {
      console.error("Failed to load groups", err)
      setError(err instanceof Error ? err.message : "Unable to load groups")
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchQuery, statusFilter, sortConfig, columnFilters])

  useEffect(() => {
    reloadGroups().catch(() => undefined)
  }, [reloadGroups])

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
  }, [measureTableArea, groups.length, page, pageSize])

  useEffect(() => {
    if (!showBulkOwnerModal) {
      return
    }

    setBulkOwnersLoading(true)
    fetch("/api/admin/users?status=Active&limit=200", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load group owners")
        }
        const users: any[] = Array.isArray(payload?.data?.users) ? payload.data.users : payload?.users ?? []
        const options: OwnerOption[] = users.map(user => ({
          value: user.id,
          label: user.fullName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
        }))
        setBulkOwnerOptions(options)
      })
      .catch((err) => {
        console.error("Failed to load owners", err)
        showError("Unable to load owners", err instanceof Error ? err.message : "Please try again later.")
      })
      .finally(() => setBulkOwnersLoading(false))
  }, [showBulkOwnerModal, showError])

  const handleSearch = useCallback((query: string) => {
    setPage(1)
    setSearchQuery(query)
  }, [])

  const handleStatusFilterChange = useCallback((filter: string) => {
    setPage(1)
    setStatusFilter(filter === "active" ? "active" : "all")
  }, [])

  const handleSort = useCallback((columnId: string, direction: SortDirection) => {
    setSortConfig({ columnId, direction })
    setPage(1)
  }, [])

  const handleColumnFiltersChange = useCallback((filters: ColumnFilterState[]) => {
    setColumnFilters(filters || [])
    setPage(1)
  }, [])

  const handlePageChange = useCallback((nextPage: number) => {
    setPagination(prev => ({ ...prev, page: nextPage }))
    setPage(nextPage)
  }, [])

  const handlePageSizeChange = useCallback((nextSize: number) => {
    setPagination(prev => ({ ...prev, pageSize: nextSize, page: 1 }))
    setPageSize(nextSize)
    setPage(1)
  }, [])

  const handleSelectGroup = useCallback((id: string, selected: boolean) => {
    setSelectedGroupIds(prev => selected ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter(x => x !== id))
  }, [])

  const handleSelectAllGroups = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedGroupIds(groups.map(g => g.id))
    } else {
      setSelectedGroupIds([])
    }
  }, [groups])

  const handleCreateGroup = () => {
    setShowCreateModal(true)
  }

  const handleRowClick = useCallback((group: GroupRow) => {
    setEditingGroup(group)
    setShowEditModal(true)
  }, [])

  const handleBulkExport = useCallback(() => {
    if (selectedGroupIds.length === 0) {
      showError("No groups selected", "Select at least one group before exporting.")
      return
    }

    const rows = groups.filter(group => selectedGroupIds.includes(group.id))
    if (rows.length === 0) {
      showError("Groups unavailable", "Unable to locate the selected groups on this page.")
      return
    }

    const headers = ["Group Name", "Group Type", "Member Count", "Description", "Created Date", "Active"]
    const csvLines = [
      headers.join(","),
      ...rows.map(row => [
        JSON.stringify(row.groupName ?? ""),
        JSON.stringify(row.groupType ?? ""),
        row.memberCount ?? 0,
        JSON.stringify(row.description ?? ""),
        JSON.stringify(row.createdDate ?? ""),
        row.active ? "Yes" : "No"
      ].join(","))
    ]

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `groups-export-${new Date().toISOString()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [groups, selectedGroupIds, showError])

  const deleteGroups = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      showError("No groups selected", "Select at least one group to delete.")
      return
    }

    const confirmDelete = window.confirm(`Delete ${ids.length} group${ids.length === 1 ? "" : "s"}? This cannot be undone.`)
    if (!confirmDelete) {
      return
    }

    setBulkActionLoading(true)
    try {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const response = await fetch(`/api/groups/${id}?force=true`, { method: "DELETE" })
          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error ?? "Failed to delete group")
          }
        })
      )

      const failed = results.filter(result => result.status === "rejected")
      if (failed.length > 0) {
        showError("Some groups could not be deleted", `${failed.length} of ${ids.length} operations failed.`)
      } else {
        showSuccess("Groups deleted", `${ids.length} group${ids.length === 1 ? "" : "s"} deleted successfully.`)
      }

      setSelectedGroupIds(previous => previous.filter(id => !ids.includes(id)))
      await reloadGroups()
    } finally {
      setBulkActionLoading(false)
    }
  }, [reloadGroups, showError, showSuccess])

  const handleBulkDelete = useCallback(async () => {
    await deleteGroups(selectedGroupIds)
  }, [deleteGroups, selectedGroupIds])

  const handleBulkOwnerSubmit = useCallback(async (ownerId: string | null) => {
    if (selectedGroupIds.length === 0) {
      showError("No groups selected", "Select at least one group to update.")
      return
    }

    setBulkActionLoading(true)
    try {
      const results = await Promise.allSettled(
        selectedGroupIds.map(async (id) => {
          const response = await fetch(`/api/groups/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ownerId })
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error ?? "Failed to update group owner")
          }
        })
      )

      const failed = results.filter(result => result.status === "rejected")
      if (failed.length > 0) {
        showError("Owner update incomplete", `${failed.length} of ${selectedGroupIds.length} groups failed to update.`)
      } else {
        showSuccess("Owner updated", "Selected groups are now assigned to the new owner.")
      }
      setShowBulkOwnerModal(false)
      setSelectedGroupIds([])
      await reloadGroups()
    } finally {
      setBulkActionLoading(false)
    }
  }, [reloadGroups, selectedGroupIds, showError, showSuccess])

  const handleBulkStatusSubmit = useCallback(async (isActive: boolean) => {
    if (selectedGroupIds.length === 0) {
      showError("No groups selected", "Select at least one group to update.")
      return
    }

    setBulkActionLoading(true)
    try {
      const results = await Promise.allSettled(
        selectedGroupIds.map(async (id) => {
          const response = await fetch(`/api/groups/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive })
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error ?? "Failed to update group status")
          }
        })
      )

      const failed = results.filter(result => result.status === "rejected")
      if (failed.length > 0) {
        showError("Status update incomplete", `${failed.length} of ${selectedGroupIds.length} groups failed to update.`)
      } else {
        showSuccess("Status updated", `Selected groups marked as ${isActive ? "Active" : "Inactive"}.`)
      }
      setShowBulkStatusModal(false)
      setSelectedGroupIds([])
      await reloadGroups()
    } finally {
      setBulkActionLoading(false)
    }
  }, [reloadGroups, selectedGroupIds, showError, showSuccess])

  const openBulkOwnerModal = useCallback(() => {
    if (selectedGroupIds.length === 0) {
      showError("No groups selected", "Select at least one group to update.")
      return
    }
    setShowBulkOwnerModal(true)
  }, [selectedGroupIds, showError])

  const openBulkStatusModal = useCallback(() => {
    if (selectedGroupIds.length === 0) {
      showError("No groups selected", "Select at least one group to update.")
      return
    }
    setShowBulkStatusModal(true)
  }, [selectedGroupIds, showError])

  const tableColumns = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === 'multi-action') {
        return {
          ...column,
          render: (_: unknown, row: any) => {
            const rowId = String(row.id)
            const checked = selectedGroupIds.includes(rowId)
            return (
              <div className="flex items-center" data-disable-row-click="true">
                <label
                  className="flex cursor-pointer items-center justify-center"
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    aria-label={`Select group ${rowId}`}
                    onChange={() => handleSelectGroup(rowId, !checked)}
                    disabled={tableLoading}
                  />
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                      checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'
                    }`}
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
              </div>
            )
          }
        }
      }
      if (column.id === 'memberCount') {
        return {
          ...column,
          render: (value: any) => (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-gray-500" />
              <span>{value}</span>
            </div>
          ),
        };
      }
      return column;
    });
  }, [preferenceColumns, selectedGroupIds, handleSelectGroup, tableLoading])

  return (
    <div className="dashboard-page-container">
      <ListHeader
        pageTitle="GROUPS LIST"
        searchPlaceholder="Search groups..."
        onSearch={handleSearch}
        onFilterChange={handleStatusFilterChange}
        statusFilter={statusFilter}
        onCreateClick={handleCreateGroup}
        onSettingsClick={() => setShowColumnSettings(true)}
        showColumnFilters
        filterColumns={GROUP_FILTER_COLUMNS}
        columnFilters={columnFilters}
        onColumnFiltersChange={handleColumnFiltersChange}
        bulkActions={buildStandardBulkActions({
          selectedCount: selectedGroupIds.length,
          isBusy: tableLoading || bulkActionLoading,
          entityLabelPlural: "groups",
          onDelete: handleBulkDelete,
          onReassign: openBulkOwnerModal,
          onStatus: openBulkStatusModal,
          onExport: handleBulkExport,
        })}
      />

      {preferenceError && (
        <div className="px-4 text-sm text-red-600">{preferenceError}</div>
      )}

      {error && !preferenceError && (
        <div className="px-4 text-sm text-red-600">{error}</div>
      )}

      <div ref={tableAreaRef} className="flex-1 min-h-0 px-4 pb-4">
        <DynamicTable
          columns={tableColumns}
          data={groups}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={tableLoading}
          emptyMessage="No groups found"
          onColumnsChange={handleColumnsChange}
          autoSizeColumns={false}
          selectedItems={selectedGroupIds}
          onItemSelect={(id, selected) => handleSelectGroup(id, selected)}
          onSelectAll={handleSelectAllGroups}
          pagination={pagination}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
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

      <GroupCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={async () => {
          setShowCreateModal(false)
          await reloadGroups({ keepSelection: true })
        }}
      />

      <GroupEditModal
        isOpen={showEditModal}
        group={editingGroup ? { id: editingGroup.id, groupName: editingGroup.groupName, active: editingGroup.active, description: editingGroup.description } : null}
        onClose={() => setShowEditModal(false)}
        onSuccess={async () => {
          setShowEditModal(false)
          await reloadGroups({ keepSelection: true })
        }}
      />

      <GroupBulkOwnerModal
        isOpen={showBulkOwnerModal}
        owners={bulkOwnerOptions}
        onClose={() => setShowBulkOwnerModal(false)}
        onSubmit={handleBulkOwnerSubmit}
        isSubmitting={bulkActionLoading || bulkOwnersLoading}
      />

      <GroupBulkStatusModal
        isOpen={showBulkStatusModal}
        onClose={() => setShowBulkStatusModal(false)}
        onSubmit={handleBulkStatusSubmit}
        isSubmitting={bulkActionLoading}
      />
    </div>
  )
}
