'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column, PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { TableChangeNotification } from '@/components/table-change-notification'
import { Edit, Trash2, Settings } from 'lucide-react'
import { isRowInactive } from '@/lib/row-state'
import { ActivityListItem } from '@/lib/activity-service'

export const activityColumns: Column[] = [
  {
    id: 'actions',
    label: 'Select All',
    width: 100,
    minWidth: 100,
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
    id: 'active',
    label: 'Active',
    width: 80,
    minWidth: 60,
    maxWidth: 100,
    type: 'text',
    render: (value) => (
      <div className="flex justify-center">
        <div className={`w-6 h-6 rounded-full ${value ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
      </div>
    )
  },
  {
    id: 'activityDate',
    label: 'Activity Date',
    width: 130,
    minWidth: 100,
    maxWidth: 160,
    sortable: true,
    type: 'text'
  },
  {
    id: 'activityType',
    label: 'Activity Type',
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: 'text'
  },
  {
    id: 'description',
    label: 'Activity Description',
    width: 200,
    minWidth: 150,
    maxWidth: 300,
    sortable: true,
    type: 'text',
    render: (value, row: any) => (
      row?.id ? (
        <Link
          href={`/activities/${row.id}`}
          className="block max-w-[260px] truncate text-primary-600 transition hover:text-primary-700 hover:underline"
        >
          {value || 'View activity'}
        </Link>
      ) : (
        <span className="text-gray-500">{value || '-'}</span>
      )
    )
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
    id: 'attachment',
    label: 'Attachment',
    width: 120,
    minWidth: 100,
    maxWidth: 140,
    type: 'text',
    render: (value) => (
      <div className="flex justify-center">
        {value ? (
          <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </div>
    )
  },
  {
    id: 'fileName',
    label: 'File Name',
    width: 200,
    minWidth: 150,
    maxWidth: 300,
    sortable: true,
    type: 'text',
    render: (value) => {
      if (value === '-' || !value) {
        return <span className="text-gray-300">-</span>
      }

      // Handle array of files
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

      // Handle single file
      return (
        <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
          {value}
        </span>
      )
    }
  },
  // Hidden/Available columns - based on ActivityListItem interface
  {
    id: 'activityId',
    label: 'Activity ID',
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: 'text',
    hidden: true,
    render: (value) => (
      <span className="font-mono text-xs text-gray-600">{value}</span>
    )
  },
  {
    id: 'activityOwner',
    label: 'Activity Owner',
    width: 160,
    minWidth: 120,
    maxWidth: 220,
    sortable: true,
    type: 'text',
    hidden: true,
    accessor: 'assigneeName'
  },
  {
    id: 'activityStatus',
    label: 'Activity Status',
    width: 130,
    minWidth: 100,
    maxWidth: 160,
    sortable: true,
    type: 'text',
    hidden: true,
    accessor: 'status',
    render: (value) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        value === 'Open' ? 'bg-green-100 text-green-800' : 
        value === 'Completed' ? 'bg-blue-100 text-blue-800' : 
        'bg-gray-100 text-gray-800'
      }`}>
        {value}
      </span>
    )
  },
  {
    id: 'createdBy',
    label: 'Created By',
    width: 160,
    minWidth: 120,
    maxWidth: 220,
    sortable: true,
    type: 'text',
    hidden: true,
    accessor: 'creatorName'
  },
  {
    id: 'createdDate',
    label: 'Created Date',
    width: 140,
    minWidth: 120,
    maxWidth: 180,
    sortable: true,
    type: 'text',
    hidden: true,
    accessor: 'createdAt',
    render: (value) => (
      <span className="text-sm text-gray-600">
        {(() => {
          if (!value) return '-'
          const d = new Date(value)
          if (Number.isNaN(d.getTime())) return '-'
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          return `${y}/${m}/${day}`
        })()}
      </span>
    )
  },
  {
    id: 'modifiedBy',
    label: 'Modified By',
    width: 160,
    minWidth: 120,
    maxWidth: 220,
    sortable: true,
    type: 'text',
    hidden: true,
    accessor: 'updatedByName',
    render: (value) => (
      <span className="text-sm text-gray-600">
        {value || 'System'}
      </span>
    )
  },
  {
    id: 'modifiedDate',
    label: 'Modified Date',
    width: 140,
    minWidth: 120,
    maxWidth: 180,
    sortable: true,
    type: 'text',
    hidden: true,
    accessor: 'updatedAt',
    render: (value) => (
      <span className="text-sm text-gray-600">
        {(() => {
          if (!value) return '-'
          const d = new Date(value)
          if (Number.isNaN(d.getTime())) return '-'
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          return `${y}/${m}/${day}`
        })()}
      </span>
    )
  }
]

const activityFilterColumns = [
  { id: 'activityDate', label: 'Activity Date' },
  { id: 'activityType', label: 'Activity Type' },
  { id: 'description', label: 'Description' },
  { id: 'accountName', label: 'Account Name' },
  { id: 'fileName', label: 'File Name' }
]

// Transform API data to match table structure
function transformActivityForTable(activity: ActivityListItem, index: number) {
  return {
    id: activity.id,
    activityId: activity.id,
    active: activity.active,
    activityDate: (() => {
      const src = activity.dueDate ? new Date(activity.dueDate) : activity.createdAt
      const d = src instanceof Date ? src : new Date(src)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}/${m}/${day}`
    })(),
    activityType: activity.type,
    description: activity.subject,
    accountName: activity.accountName || '-',
    attachment: activity.attachments.length > 0,
    fileName: activity.attachments.length > 0
      ? (activity.attachments.length === 1
          ? activity.attachments[0].fileName
          : `[${activity.attachments.map(att => `"${att.fileName}"`).join(',')}]`)
      : '-',
    // Hidden/Available fields from ActivityListItem
    assigneeName: activity.assigneeName || 'Unassigned',
    status: activity.status,
    creatorName: activity.creatorName,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
    updatedByName: activity.updatedByName
  }
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<any[]>([])
  const [filteredActivities, setFilteredActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
  } = useTablePreferences("activities:list", activityColumns)

  // Fetch activities from API
  const fetchActivities = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/activities', {
        cache: 'no-store',
        signal
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.error ?? 'Unable to load activities'
        throw new Error(message)
      }

      const payload = await response.json().catch(() => null)
      const apiActivities: ActivityListItem[] = payload?.data ?? []

      const transformedActivities = apiActivities.map(transformActivityForTable)
      setActivities(transformedActivities)
      setFilteredActivities(transformedActivities)
    } catch (err) {
      if (signal?.aborted) {
        return
      }
      console.error(err)
      const message = err instanceof Error ? err.message : 'Unable to load activities'
      setError(message)
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [])

  // Initial load
  useEffect(() => {
    const controller = new AbortController()
    fetchActivities(controller.signal)
    return () => controller.abort()
  }, [fetchActivities])

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setFilteredActivities(activities)
      return
    }

    const filtered = activities.filter(activity =>
      Object.values(activity).some((value: any) =>
        value?.toString().toLowerCase().includes(query.toLowerCase())
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

  // Update columns with render functions
  const tableColumns = preferenceColumns.map(column => {
    if (column.id === 'actions') {
      return {
        ...column,
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
      }
    }
    return column
  })

  const handleRowClick = (activity: any) => {
    console.log('Activity clicked:', activity)
    // Navigate to activity detail page or open modal
  }

  const handleFilterChange = (filter: string) => {
    if (filter === 'active') {
      setFilteredActivities(activities.filter(activity => activity.active === true))
    } else {
      setFilteredActivities(activities)
    }
  }

  const handleExport = () => {
    console.log('Export activities')
    // Implement export functionality
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
  const paginatedActivities = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredActivities.slice(startIndex, endIndex)
  }, [filteredActivities, currentPage, pageSize])

  // Calculate pagination info
  const paginationInfo = useMemo((): PaginationInfo => {
    const totalItems = filteredActivities.length
    const totalPages = Math.ceil(totalItems / pageSize)

    return {
      page: currentPage,
      totalPages,
      pageSize,
      total: totalItems,
    }
  }, [filteredActivities.length, currentPage, pageSize])

  return (
    <div className="h-full flex flex-col">
      {/* List Header */}
      <ListHeader
        pageTitle="ACTIVITIES LIST"
        searchPlaceholder="Search Here"
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        showCreateButton={false}
        onSettingsClick={() => setShowColumnSettings(true)}
        filterColumns={activityFilterColumns}
        canExport={true}
        onExport={handleExport}
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
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex justify-between items-center">
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => fetchActivities()}
              className="rounded-full border border-red-300 px-3 py-1 text-sm font-medium text-red-600 hover:border-red-400 hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Preference Error Message */}
      {preferenceError && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{preferenceError}</p>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 p-6">
        <DynamicTable
          columns={tableColumns}
          data={paginatedActivities}
          onSort={handleSort}
          onRowClick={handleRowClick}
          onColumnsChange={handleColumnsChange}
          loading={loading || preferenceLoading}
          emptyMessage={error ? "Unable to load activities" : "No activities found"}
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
  )
}
