'use client'

import { useState, useEffect } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column } from '@/components/dynamic-table'
import { PermissionGate } from '@/components/auth/permission-gate'
import { Edit, Trash2, User, Shield } from 'lucide-react'

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
    label: 'Actions',
    width: 100,
    minWidth: 80,
    maxWidth: 120,
    type: 'action',
    render: () => (
      <div className="flex gap-1">
        <button className="text-blue-500 hover:text-blue-700 p-1 rounded transition-colors">
          <Edit className="h-4 w-4" />
        </button>
        <button className="text-red-500 hover:text-red-700 p-1 rounded transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
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
    render: (value) => value ? new Date(value).toLocaleDateString() : 'Never'
  },
  {
    id: 'createdAt',
    label: 'Created Date',
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    type: 'text',
    render: (value) => new Date(value).toLocaleDateString()
  }
]

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        />

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
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
            columns={userColumns}
            data={filteredUsers}
            onSort={handleSort}
            onRowClick={handleRowClick}
            loading={loading}
            emptyMessage="No users found"
          />
        </div>
      </div>
    </PermissionGate>
  )
}