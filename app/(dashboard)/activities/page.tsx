'use client'

import { useState } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column } from '@/components/dynamic-table'
import { activitiesData } from '@/lib/mock-data'
import { Phone, Mail, Calendar, Edit, Trash2 } from 'lucide-react'

const activityColumns: Column[] = [
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
    id: 'activityType',
    label: 'Activity Type',
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: 'text',
    render: (value) => {
      const Icon = value === 'Call' ? Phone : value === 'Email' ? Mail : Calendar
      return (
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-500" />
          <span>{value}</span>
        </div>
      )
    }
  },
  {
    id: 'subject',
    label: 'Subject',
    width: 250,
    minWidth: 200,
    maxWidth: 400,
    sortable: true,
    type: 'text',
    render: (value) => (
      <span className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
        {value}
      </span>
    )
  },
  {
    id: 'contactName',
    label: 'Contact Name',
    width: 180,
    minWidth: 150,
    maxWidth: 250,
    sortable: true,
    type: 'text'
  },
  {
    id: 'accountName',
    label: 'Account Name',
    width: 180,
    minWidth: 150,
    maxWidth: 250,
    sortable: true,
    type: 'text'
  },
  {
    id: 'dueDate',
    label: 'Due Date',
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    type: 'text'
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
      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
        value === 'Completed' ? 'bg-green-100 text-green-800' : 
        value === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
        'bg-yellow-100 text-yellow-800'
      }`}>
        {value}
      </div>
    )
  },
  {
    id: 'assignedTo',
    label: 'Assigned To',
    width: 180,
    minWidth: 150,
    maxWidth: 250,
    sortable: true,
    type: 'text'
  }
]

export default function ActivitiesPage() {
  const [activities, setActivities] = useState(activitiesData)
  const [filteredActivities, setFilteredActivities] = useState(activitiesData)
  const [loading, setLoading] = useState(false)

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setFilteredActivities(activities)
      return
    }

    const filtered = activities.filter(activity =>
      Object.values(activity).some(value =>
        value.toString().toLowerCase().includes(query.toLowerCase())
      )
    )
    setFilteredActivities(filtered)
  }

  const handleSort = (columnId: string, direction: 'asc' | 'desc') => {
    const sorted = [...filteredActivities].sort((a, b) => {
      const aValue = a[columnId as keyof typeof a]
      const bValue = b[columnId as keyof typeof b]
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })
    
    setFilteredActivities(sorted)
  }

  const handleRowClick = (activity: any) => {
    console.log('Activity clicked:', activity)
    // Navigate to activity detail page or open modal
  }

  const handleCreateActivity = () => {
    console.log('Create new activity')
    // Open create activity modal or navigate to create page
  }

  const handleFilterChange = (filter: string) => {
    if (filter === 'scheduled') {
      setFilteredActivities(activities.filter(activity => activity.status === 'Scheduled'))
    } else if (filter === 'completed') {
      setFilteredActivities(activities.filter(activity => activity.status === 'Completed'))
    } else {
      setFilteredActivities(activities)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* List Header */}
      <ListHeader
        searchPlaceholder="Search Here"
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onCreateClick={handleCreateActivity}
      />

      {/* Table */}
      <div className="flex-1 p-6">
        <DynamicTable
          columns={activityColumns}
          data={filteredActivities}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={loading}
          emptyMessage="No activities found"
        />
      </div>
    </div>
  )
}