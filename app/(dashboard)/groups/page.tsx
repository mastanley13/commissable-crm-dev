'use client'

import { useState } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column } from '@/components/dynamic-table'
import { groupsData } from '@/lib/mock-data'
import { Edit, Trash2, Users } from 'lucide-react'

const groupColumns: Column[] = [
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

  const handleRowClick = (group: any) => {
    console.log('Group clicked:', group)
    // Navigate to group detail page or open modal
  }

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

  return (
    <div className="dashboard-page-container">
      {/* List Header */}
      <ListHeader
        searchPlaceholder="Search Here"
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onCreateClick={handleCreateGroup}
      />

      {/* Table */}
      <div className="flex-1 p-6 min-h-0">
        <DynamicTable
          columns={groupColumns}
          data={filteredGroups}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={loading}
          emptyMessage="No groups found"
        />
      </div>
    </div>
  )
}