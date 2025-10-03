'use client'

import { useState, useCallback, useMemo } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column, PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { TableChangeNotification } from '@/components/table-change-notification'
import { groupsData } from '@/lib/mock-data'
import { Edit, Trash2, Users, Settings, Check } from 'lucide-react'

const groupColumns: Column[] = [
  {
    id: 'multi-action',
    label: 'Actions',
    width: 200,
    minWidth: 160,
    maxWidth: 240,
    type: 'multi-action',
  },
  {
    id: 'groupName',
    label: 'Group Name',
    width: 200,
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
    id: 'groupType',
    label: 'Group Type',
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    type: 'text'
  },
  {
    id: 'memberCount',
    label: 'Member Count',
    width: 120,
    minWidth: 100,
    maxWidth: 150,
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
    width: 250,
    minWidth: 200,
    maxWidth: 400,
    sortable: true,
    type: 'text'
  },
  {
    id: 'createdDate',
    label: 'Created Date',
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    type: 'text'
  }
]

export default function GroupsPage() {
  const [groups, setGroups] = useState(groupsData)
  const [filteredGroups, setFilteredGroups] = useState(groupsData)
  const [loading, setLoading] = useState(false)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([])

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
  } = useTablePreferences("groups:list", groupColumns)

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setFilteredGroups(groups)
      return
    }

    const filtered = groups.filter(group =>
      Object.values(group).some(value =>
        value.toString().toLowerCase().includes(query.toLowerCase())
      )
    )
    setFilteredGroups(filtered)
  }

  const handleSort = (columnId: string, direction: 'asc' | 'desc') => {
    const sorted = [...filteredGroups].sort((a, b) => {
      const aValue = a[columnId as keyof typeof a]
      const bValue = b[columnId as keyof typeof b]
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })
    
    setFilteredGroups(sorted)
  }

  const handleRowClick = useCallback((group: any) => {
    console.log('Group clicked:', group)
    // Navigate to group detail page or open modal
  }, [])

  const handleCreateGroup = () => {
    console.log('Create new group')
    // Open create group modal or navigate to create page
  }

  const handleFilterChange = (filter: string) => {
    if (filter === 'active') {
      setFilteredGroups(groups.filter(group => group.active))
    } else {
      setFilteredGroups(groups)
    }
  }

  const handleSelectGroup = (id: number, selected: boolean) => {
    setSelectedGroupIds(prev => selected ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter(x => x !== id))
  }

  const handleSelectAllGroups = (selected: boolean) => {
    if (selected) setSelectedGroupIds(filteredGroups.map(g => g.id))
    else setSelectedGroupIds([])
  }

  const handleToggleGroupActive = useCallback((id: number, next: boolean) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, active: next } : g))
    setFilteredGroups(prev => prev.map(g => g.id === id ? { ...g, active: next } : g))
  }, [])

  // Pagination handlers
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(1) // Reset to first page when page size changes
  }, [])

  // Calculate paginated data
  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredGroups.slice(startIndex, endIndex)
  }, [filteredGroups, currentPage, pageSize])

  // Calculate pagination info
  const paginationInfo = useMemo((): PaginationInfo => {
    const totalItems = filteredGroups.length
    const totalPages = Math.ceil(totalItems / pageSize)

    return {
      page: currentPage,
      totalPages,
      pageSize,
      total: totalItems,
    }
  }, [filteredGroups.length, currentPage, pageSize])

  const tableLoading = loading || preferenceLoading
  const tableColumns = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === 'multi-action') {
        return {
          ...column,
          render: (_: unknown, row: any) => {
            const rowId = Number(row.id)
            const checked = selectedGroupIds.includes(rowId)
            const activeValue = !!row.active
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <label className="flex cursor-pointer items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" className="sr-only" checked={checked} aria-label={`Select group ${rowId}`} onChange={() => handleSelectGroup(rowId, !checked)} />
                  <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleToggleGroupActive(rowId, !activeValue) }} className="relative inline-flex items-center cursor-pointer" title={activeValue ? 'Active' : 'Inactive'}>
                  <span className={`w-9 h-5 rounded-full transition-colors duration-300 ease-in-out ${activeValue ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ease-in-out transform ${activeValue ? 'translate-x-4' : 'translate-x-1'} mt-0.5 ${activeValue ? 'ring-1 ring-blue-300' : ''}`} />
                  </span>
                </button>
                <div className="flex gap-0.5">
                  <button className="p-1 text-blue-500 hover:text-blue-700 transition-colors rounded" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} aria-label="Edit group">
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button className={`p-1 rounded transition-colors ${activeValue ? 'text-red-500 hover:text-red-700' : 'text-gray-400 hover:text-gray-600'}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} aria-label={activeValue ? 'Delete group' : 'Manage group'}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
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
  }, [preferenceColumns, selectedGroupIds, handleSelectGroup, handleToggleGroupActive])
  
  // Get hidden columns by comparing all columns with visible ones
  const hiddenColumns = useMemo(() => {
    return groupColumns
      .filter(col => !tableColumns.some(visibleCol => visibleCol.id === col.id))
      .map(col => col.id)
  }, [tableColumns])

  return (
    <div className="dashboard-page-container">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Page Title */}
          <h1 className="text-xl font-semibold text-blue-600">Groups List</h1>

          {/* Left side - Search */}
          <div className="flex items-center flex-1 max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search groups..."
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Table Change Notification - Always show */}
          <div className="flex items-center">
            <TableChangeNotification
              hasUnsavedChanges={hasUnsavedChanges || false}
              isSaving={preferenceSaving || false}
              lastSaved={lastSaved || undefined}
              onSave={saveChanges}
            />
          </div>

          {/* Center - Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateGroup}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Create New
            </button>
            
            <button
              onClick={() => setShowColumnSettings(true)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Column Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          {/* Right side - Filters */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFilterChange("active")}
              className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            >
              Active
            </button>
            <button
              onClick={() => handleFilterChange("all")}
              className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            >
              Show All
            </button>
          </div>
        </div>
      </div>

      {preferenceError && (
        <div className="px-4 text-sm text-red-600">{preferenceError}</div>
      )}

      {/* Table */}
      <div className="flex-1 p-4 min-h-0">
        <DynamicTable
          columns={tableColumns}
          data={paginatedGroups}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={tableLoading}
          emptyMessage="No groups found"
          onColumnsChange={handleColumnsChange}
          autoSizeColumns={false}
          selectedItems={selectedGroupIds.map(String)}
          onItemSelect={(id, selected) => handleSelectGroup(Number(id), selected)}
          onSelectAll={handleSelectAllGroups}
          pagination={paginationInfo}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
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
    </div>
  )
}
