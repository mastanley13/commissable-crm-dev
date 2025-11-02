'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column, PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { TableChangeNotification } from '@/components/table-change-notification'
import { PermissionGate } from '@/components/auth/permission-gate'
import { Edit, Trash2, User, Shield } from 'lucide-react'
import { isRowInactive } from '@/lib/row-state'

const userColumns: Column[] = [
  {
    id: 'active',
    label: 'Active',
    width: 80,
    minWidth: 60,
    maxWidth: 100,
    type: 'toggle',
    accessor: 'active'
  },
  {
    id: 'actions',
    label: 'Select All',
    width: 100,
    minWidth: 100,
    maxWidth: 120,
    type: 'action',
    render: (_: any, row: any) => (
      <div className="flex gap-1">
        <button className="text-blue-500 hover:text-blue-700 p-1 rounded transition-colors" title="Edit user">
          <Edit className="h-4 w-4" />
        </button>
        {isRowInactive(row) && (
          <button className="text-red-500 hover:text-red-700 p-1 rounded transition-colors" title="Delete user">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    )
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
    render: (value) => (
      <span className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
        {value}
      </span>
    )
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
      return `${y}/${m}/${day}`
    }
  }
]

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)

  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    error: preferenceError,
    saving: preferenceSaving,
    hasUnsavedChanges,
    lastSaved,
    handleColumnsChange,
    handleHiddenColumnsChange,
    saveChanges,
    saveChangesOnModalClose,
  } = useTablePreferences("admin:users", userColumns)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users')

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch users')
      }

      const data = await response.json()
      const userData = data.data?.users || []

      setUsers(userData)
      setFilteredUsers(userData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

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
    console.log('User clicked:', user)
    // Navigate to user detail page or open modal
  }

  const handleCreateUser = () => {
    console.log('Create new user')
    // Open create user modal or navigate to create page
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
    setPageSize(newPageSize)
    setCurrentPage(1) // Reset to first page when page size changes
  }, [])

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
          searchPlaceholder="Search users..."
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          onCreateClick={handleCreateUser}
          onSettingsClick={() => setShowColumnSettings(true)}
        />

        {/* Table Change Notification */}
        {hasUnsavedChanges && (
          <TableChangeNotification
            hasUnsavedChanges={hasUnsavedChanges}
            isSaving={preferenceSaving}
            lastSaved={lastSaved || undefined}
            onSave={saveChanges}
          />
        )}

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
            columns={preferenceColumns}
            data={paginatedUsers}
            onSort={handleSort}
            onRowClick={handleRowClick}
            onColumnsChange={handleColumnsChange}
            loading={loading || preferenceLoading}
            emptyMessage="No users found"
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
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
      </div>
    </PermissionGate>
  )
}