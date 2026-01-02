'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column, PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { UserCreateModal } from '@/components/user-create-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { PermissionGate } from '@/components/auth/permission-gate'
import { Check, Edit, Trash2, User, Shield } from 'lucide-react'
import { isRowInactive } from '@/lib/row-state'
import { cn } from '@/lib/utils'

function UserNameCell({ value, userId }: { value: string | null | undefined; userId: string }) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        router.push(`/admin/users/${userId}`)
      }}
      className="text-blue-600 hover:text-blue-800 font-medium"
    >
      {value || "View"}
    </button>
  )
}

const normalizePageSize = (value: number): number => {
  if (!Number.isFinite(value)) return 100
  return Math.min(100, Math.max(1, Math.floor(value)))
}

const userColumns: Column[] = [
  {
    id: 'actions',
    label: 'Select All',
    width: 220,
    minWidth: 200,
    maxWidth: 260,
    type: 'multi-action',
    accessor: 'select',
    hideable: false,
  },
  {
    id: 'email',
    label: 'Email',
    width: 200,
    minWidth: 160,
    maxWidth: 300,
    sortable: true,
    type: 'text',
    render: (value) => (
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-gray-500" />
        <span className="font-medium">{value}</span>
      </div>
    )
  },
  {
    id: 'fullName',
    label: 'Full Name',
    width: 180,
    minWidth: 150,
    maxWidth: 300,
    sortable: true,
    type: 'text',
    render: (value, row) => <UserNameCell value={value} userId={row.id} />
  },
  {
    id: 'status',
    label: 'Status',
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: 'text',
    render: (value) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        value === 'Active' ? 'bg-green-100 text-green-800' :
        value === 'Invited' ? 'bg-yellow-100 text-yellow-800' :
        'bg-red-100 text-red-800'
      }`}>
        {value}
      </span>
    )
  },
  {
    id: 'role',
    label: 'Role',
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    type: 'text',
    render: (value, row) => (
      <div className="flex items-center gap-1">
        <Shield className="h-4 w-4 text-indigo-600" />
        <span className="text-indigo-600">{row.role?.name || 'No Role'}</span>
      </div>
    )
  },
  {
    id: 'lastLoginAt',
    label: 'Last Login',
    width: 160,
    minWidth: 140,
    maxWidth: 200,
    sortable: true,
    type: 'text',
    render: (value) => {
      if (!value) return 'Never'
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return 'Never'
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}/${m}/${day}`
    }
  },
  {
    id: 'createdAt',
    label: 'Created Date',
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    type: 'text',
    render: (value) => {
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return ''
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
  }
]

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [filteredUsers, setFilteredUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(100)
  const [updatingUserIds, setUpdatingUserIds] = useState<Set<string>>(new Set())
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])

  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    error: preferenceError,
    pageSize: preferencePageSize,
    handlePageSizeChange: persistPageSizePreference,
    handleColumnsChange,
    saveChangesOnModalClose,
  } = useTablePreferences("admin:users", userColumns)

  const normalizeUsers = useCallback((userList: any[]) => {
    return userList.map((user) => ({
      ...user,
      // Derive an "active" boolean from the status enum so the toggle renders correctly
      active: user.status === 'Active'
    }))
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users')

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch users')
      }

      const data = await response.json()
      const userData = normalizeUsers(data.data?.users || [])

      setUsers(userData)
      setFilteredUsers(userData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }, [normalizeUsers])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  const updateUserState = useCallback((userId: string, updater: (user: any) => any) => {
    setUsers((previous) => previous.map((user: any) => (user.id === userId ? updater(user) : user)))
    setFilteredUsers((previous) => previous.map((user: any) => (user.id === userId ? updater(user) : user)))
  }, [])

  const handleToggleUserActive = useCallback(
    async (user: any, activeValue: boolean) => {
      if (updatingUserIds.has(user.id)) return

      const nextStatus = activeValue ? 'Active' : 'Disabled'
      const previousUsers = users
      const previousFiltered = filteredUsers

      setUpdatingUserIds((prev) => new Set(prev).add(user.id))
      updateUserState(user.id, (current) => ({
        ...current,
        active: activeValue,
        status: nextStatus
      }))

      try {
        const response = await fetch(`/api/admin/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to update user status')
        }
      } catch (err) {
        console.error('Error updating user status:', err)
        setError(err instanceof Error ? err.message : 'Failed to update user status')
        setUsers(previousUsers)
        setFilteredUsers(previousFiltered)
      } finally {
        setUpdatingUserIds((prev) => {
          const next = new Set(prev)
          next.delete(user.id)
          return next
        })
      }
    },
    [filteredUsers, updateUserState, updatingUserIds, users]
  )

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setFilteredUsers(users)
      return
    }

    const filtered = users.filter(user =>
      Object.values(user).some(value =>
        value?.toString().toLowerCase().includes(query.toLowerCase())
      )
    )
    setFilteredUsers(filtered)
  }

  const handleSort = (columnId: string, direction: 'asc' | 'desc') => {
    const sorted = [...filteredUsers].sort((a: any, b: any) => {
      const aValue = a[columnId]
      const bValue = b[columnId]

      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })

    setFilteredUsers(sorted)
  }

  const handleRowClick = (user: any) => {
    if (!user?.id) return
    router.push(`/admin/users/${user.id}`)
  }

  const handleCreateUser = () => {
    setShowCreateModal(true)
  }

  const handleFilterChange = (filter: string) => {
    if (filter === 'active') {
      setFilteredUsers(users.filter((user: any) => user.status === 'Active'))
    } else {
      setFilteredUsers(users)
    }
  }

  // Pagination handlers
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    const normalized = normalizePageSize(newPageSize)
    setPageSize(normalized)
    setCurrentPage(1) // Reset to first page when page size changes
    void persistPageSizePreference(normalized)
  }, [persistPageSizePreference])

  useEffect(() => {
    if (!preferencePageSize) return
    const normalized = normalizePageSize(preferencePageSize)
    if (normalized !== pageSize) {
      setPageSize(normalized)
      setCurrentPage(1)
    }
  }, [pageSize, preferencePageSize])

  // Calculate paginated data
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredUsers.slice(startIndex, endIndex)
  }, [filteredUsers, currentPage, pageSize])

  // Calculate pagination info
  const paginationInfo = useMemo((): PaginationInfo => {
    const totalItems = filteredUsers.length
    const totalPages = Math.ceil(totalItems / pageSize)

    return {
      page: currentPage,
      totalPages,
      pageSize,
      total: totalItems,
    }
  }, [filteredUsers.length, currentPage, pageSize])

  const handleUserSelect = useCallback((userId: string, selected: boolean) => {
    setSelectedUserIds((previous) => {
      if (selected) {
        if (previous.includes(userId)) return previous
        return [...previous, userId]
      }

      if (!previous.includes(userId)) return previous
      return previous.filter((id) => id !== userId)
    })
  }, [])

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      const ids = filteredUsers
        .map((user: any) => user?.id)
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      setSelectedUserIds(ids)
      return
    }
    setSelectedUserIds([])
  }, [filteredUsers])

  const tableColumns = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id !== 'actions') return column

      return {
        ...column,
        type: 'multi-action' as const,
        render: (_value: unknown, row: any) => {
          const rowId = row?.id as string | undefined
          const checked = Boolean(rowId && selectedUserIds.includes(rowId))
          const activeValue = Boolean(row?.active)
          const isUpdating = Boolean(rowId && updatingUserIds.has(rowId))

          return (
            <div className="flex items-center gap-2" data-disable-row-click="true">
              <label
                className="flex cursor-pointer items-center justify-center"
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  aria-label={rowId ? `Select user ${row.fullName || row.email || rowId}` : 'Select user'}
                  onChange={() => {
                    if (!rowId) return
                    handleUserSelect(rowId, !checked)
                  }}
                />
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    checked
                      ? 'border-primary-500 bg-primary-600 text-white'
                      : 'border-gray-300 bg-white text-transparent'
                  }`}
                >
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
              </label>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  if (!rowId || isUpdating) return
                  void handleToggleUserActive(row, !activeValue)
                }}
                className="relative inline-flex items-center cursor-pointer"
                disabled={isUpdating}
                title={activeValue ? 'Active' : 'Inactive'}
              >
                <span
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    activeValue ? 'bg-primary-600' : 'bg-gray-300',
                    isUpdating ? 'opacity-50' : ''
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                      activeValue ? 'translate-x-5' : 'translate-x-1'
                    )}
                  />
                </span>
              </button>

              <button
                type="button"
                className="text-blue-500 hover:text-blue-700 p-1 rounded transition-colors"
                title="Edit user"
                onClick={(event) => {
                  event.stopPropagation()
                  if (!rowId) return
                  router.push(`/admin/users/${rowId}`)
                }}
              >
                <Edit className="h-4 w-4" />
              </button>

              {isRowInactive(row) && (
                <button
                  type="button"
                  className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                  title="Delete user"
                  onClick={(event) => {
                    event.stopPropagation()
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )
        }
      }
    })
  }, [handleToggleUserActive, handleUserSelect, preferenceColumns, router, selectedUserIds, updatingUserIds])

  return (
    <PermissionGate
      permissions={['admin.users.read', 'accounts.manage']}
      fallback={
        <div className="p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don&apos;t have permission to view users.</p>
          </div>
        </div>
      }
    >
      <div className="h-full flex flex-col">
        {/* List Header */}
        <ListHeader
          pageTitle="USERS LIST"
          searchPlaceholder="Search users..."
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          onCreateClick={handleCreateUser}
          onSettingsClick={() => setShowColumnSettings(true)}
        />

        {/* Error Message */}
        {(error || preferenceError) && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error || preferenceError}</p>
            <button
              onClick={fetchUsers}
              className="mt-2 text-red-600 hover:text-red-800 font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 p-6">
          <DynamicTable
            columns={tableColumns}
            data={paginatedUsers}
            onSort={handleSort}
            onRowClick={handleRowClick}
            onColumnsChange={handleColumnsChange}
            loading={loading || preferenceLoading}
            emptyMessage="No users found"
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            selectedItems={selectedUserIds}
            onSelectAll={handleSelectAll}
          />
        </div>

        {/* Column Chooser Modal */}
        <ColumnChooserModal
          isOpen={showColumnSettings}
          columns={preferenceColumns}
          onApply={handleColumnsChange}
          onClose={async () => {
            setShowColumnSettings(false)
            await saveChangesOnModalClose()
          }}
        />

        {/* User Create Modal */}
        <UserCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            void fetchUsers()
          }}
        />
      </div>
    </PermissionGate>
  )
}
