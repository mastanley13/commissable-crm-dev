'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column, PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { TableChangeNotification } from '@/components/table-change-notification'
import { PermissionGate } from '@/components/auth/permission-gate'
import { RoleEditModal, Role } from '@/components/role-edit-modal'
import { Edit, Trash2, Shield, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

// Define columns outside component for useTablePreferences
const roleColumns: Column[] = [
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
    minWidth: 80,
    maxWidth: 120,
    type: 'action'
  },
  {
    id: 'roleName',
    label: 'Role Name',
    width: 200,
    minWidth: 150,
    maxWidth: 300,
    sortable: true,
    type: 'text'
  },
  {
    id: 'permissions',
    label: 'Permissions',
    width: 200,
    minWidth: 150,
    maxWidth: 300,
    sortable: true,
    type: 'text'
  },
  {
    id: 'userCount',
    label: 'User Count',
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: 'text'
  },
  {
    id: 'description',
    label: 'Description',
    width: 300,
    minWidth: 200,
    maxWidth: 500,
    sortable: true,
    type: 'text'
  }
]

export default function AdminRolesPage() {
  const { refreshAuth } = useAuth()
  const [roles, setRoles] = useState<any[]>([])
  const [filteredRoles, setFilteredRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
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
  } = useTablePreferences("admin:roles", roleColumns)

  useEffect(() => {
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/roles?includePermissions=true')
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to load roles')
      }
      const data = await response.json()
      const roleRows = (data.data?.roles || []).map((r: any) => ({
        id: r.id,
        active: true,
        roleName: r.name,
        permissions: r.permissions ? r.permissions.length : 0,
        userCount: r.userCount,
        description: r.description || ''
      }))
      setRoles(roleRows)
      setFilteredRoles(roleRows)
    } catch (e: any) {
      setError(e?.message || 'Failed to load roles')
      console.error('Error fetching roles:', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchRoleDetails = async (roleId: string): Promise<Role | null> => {
    try {
      setModalLoading(true)
      setModalError(null)
      const response = await fetch(`/api/admin/roles/${roleId}?includePermissions=true`)
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to load role details')
      }
      const data = await response.json()
      return data.data?.role || null
    } catch (e: any) {
      setModalError(e?.message || 'Failed to load role details')
      console.error('Error fetching role details:', e)
      return null
    } finally {
      setModalLoading(false)
    }
  }

  const handleEditRole = async (roleId: string) => {
    const roleDetails = await fetchRoleDetails(roleId)
    if (roleDetails) {
      setSelectedRole(roleDetails)
      setEditModalOpen(true)
    }
  }

  const handleSaveRole = async (roleId: string, updates: any) => {
    try {
      setModalLoading(true)
      setModalError(null)
      
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to update role')
      }

      // Refresh the roles list
      await fetchRoles()
    } catch (e: any) {
      setModalError(e?.message || 'Failed to update role')
      console.error('Error updating role:', e)
      throw e
    } finally {
      setModalLoading(false)
    }
  }

  const handleCloseModal = () => {
    setEditModalOpen(false)
    setSelectedRole(null)
    setModalError(null)
  }

  // Update columns with render functions that access component functions
  const tableColumns = preferenceColumns.map(column => {
    if (column.id === 'actions') {
      return {
        ...column,
        render: (value: any, row: any) => (
          <div className="flex gap-1">
            <button 
              onClick={(e) => {
                e.stopPropagation()
                handleEditRole(row.id)
              }}
              className="text-blue-500 hover:text-blue-700 p-1 rounded transition-colors"
              title="Edit role"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation()
                console.log('Delete role:', row.id)
              }}
              className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
              title="Delete role"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      }
    }
    if (column.id === 'roleName') {
      return {
        ...column,
        render: (value: any) => (
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            <span className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
              {value}
            </span>
          </div>
        )
      }
    }
    if (column.id === 'userCount') {
      return {
        ...column,
        render: (value: any) => (
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4 text-gray-500" />
            <span>{value}</span>
          </div>
        )
      }
    }
    return column
  })

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setFilteredRoles(roles)
      return
    }

    const filtered = roles.filter(role =>
      Object.values(role).some(value =>
        String(value).toLowerCase().includes(query.toLowerCase())
      )
    )
    setFilteredRoles(filtered)
  }

  const handleSort = (columnId: string, direction: 'asc' | 'desc') => {
    const sorted = [...filteredRoles].sort((a, b) => {
      const aValue = a[columnId as keyof typeof a]
      const bValue = b[columnId as keyof typeof b]
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })
    
    setFilteredRoles(sorted)
  }

  const handleRowClick = (role: any) => {
    console.log('Role clicked:', role)
    // Navigate to role detail page or open modal
  }

  const handleCreateRole = () => {
    console.log('Create new role')
    // Open create role modal or navigate to create page
  }

  const handleFilterChange = (filter: string) => {
    if (filter === 'active') {
      setFilteredRoles(roles.filter(role => role.active))
    } else {
      setFilteredRoles(roles)
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
  const paginatedRoles = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredRoles.slice(startIndex, endIndex)
  }, [filteredRoles, currentPage, pageSize])

  // Calculate pagination info
  const paginationInfo = useMemo((): PaginationInfo => {
    const totalItems = filteredRoles.length
    const totalPages = Math.ceil(totalItems / pageSize)

    return {
      page: currentPage,
      totalPages,
      pageSize,
      total: totalItems,
    }
  }, [filteredRoles.length, currentPage, pageSize])

  return (
    <PermissionGate
      permissions={["admin.roles.read", "admin.permissions.read"]}
      fallback={
        <div className="p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don&apos;t have permission to view roles.</p>
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Debug Info:</strong> This page requires admin.roles.read OR admin.permissions.read permissions.
              </p>
              <div className="flex gap-2 mt-2">
                <button 
                  onClick={() => refreshAuth()} 
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Refresh Permissions
                </button>
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="h-full flex flex-col">
        {/* List Header */}
        <ListHeader
          searchPlaceholder="Search roles..."
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          onCreateClick={handleCreateRole}
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
            <button onClick={fetchRoles} className="mt-2 text-red-600 hover:text-red-800 font-medium">Try again</button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 p-6">
          <DynamicTable
            columns={tableColumns}
            data={paginatedRoles}
            onSort={handleSort}
            onRowClick={handleRowClick}
            onColumnsChange={handleColumnsChange}
            loading={loading || preferenceLoading}
            emptyMessage="No roles found"
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

        {/* Role Edit Modal */}
        <RoleEditModal
          isOpen={editModalOpen}
          role={selectedRole}
          loading={modalLoading}
          error={modalError}
          onClose={handleCloseModal}
          onSave={handleSaveRole}
        />
      </div>
    </PermissionGate>
  )
}