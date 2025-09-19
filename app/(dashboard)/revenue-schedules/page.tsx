'use client'

import { useState } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column } from '@/components/dynamic-table'
import { revenueSchedulesData } from '@/lib/mock-data'
import { Edit, Trash2 } from 'lucide-react'

const revenueScheduleColumns: Column[] = [
  {
    id: 'checkbox',
    label: 'checkbox',
    width: 80,
    minWidth: 60,
    maxWidth: 100,
    type: 'checkbox',
    accessor: 'checkbox'
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
    id: 'active',
    label: 'Active',
    width: 80,
    minWidth: 60,
    maxWidth: 100,
    type: 'toggle',
    accessor: 'active'
  },
  {
    id: 'opportunityId',
    label: 'Opportunity ID',
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: 'text'
  },
  {
    id: 'accountName',
    label: 'Account Name',
    width: 150,
    minWidth: 120,
    maxWidth: 250,
    sortable: true,
    type: 'text',
    render: (value) => (
      <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
        {value}
      </span>
    )
  },
  {
    id: 'accountLegalName',
    label: 'Account Legal Name',
    width: 180,
    minWidth: 140,
    maxWidth: 300,
    sortable: true,
    type: 'text',
    render: (value) => (
      <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
        {value}
      </span>
    )
  },
  {
    id: 'productNameVendor',
    label: 'Product Name - Vendor',
    width: 180,
    minWidth: 140,
    maxWidth: 300,
    sortable: true,
    type: 'text',
    render: (value) => (
      <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
        {value}
      </span>
    )
  },
  {
    id: 'vendorName',
    label: 'Vendor Name',
    width: 150,
    minWidth: 120,
    maxWidth: 250,
    sortable: true,
    type: 'text',
    render: (value) => (
      <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
        {value}
      </span>
    )
  },
  {
    id: 'revenueScheduleDate',
    label: 'Revenue Schedule Date',
    width: 160,
    minWidth: 130,
    maxWidth: 200,
    sortable: true,
    type: 'text'
  },
  {
    id: 'revenueSchedule',
    label: 'Revenue Schedule',
    width: 140,
    minWidth: 120,
    maxWidth: 180,
    sortable: true,
    type: 'text'
  },
  {
    id: 'distributorId',
    label: 'Distributor ID',
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: 'text'
  },
  {
    id: 'orderIdHouse',
    label: 'Order ID - House',
    width: 120,
    minWidth: 100,
    maxWidth: 180,
    sortable: true,
    type: 'text'
  },
  {
    id: 'expectedUsage',
    label: 'Expected Usage',
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: 'text'
  },
  {
    id: 'usageAdjustment',
    label: 'Usage Adjustment',
    width: 140,
    minWidth: 120,
    maxWidth: 180,
    sortable: true,
    type: 'text'
  }
]

export default function RevenueSchedulesPage() {
  const [revenueSchedules, setRevenueSchedules] = useState(revenueSchedulesData)
  const [filteredRevenueSchedules, setFilteredRevenueSchedules] = useState(revenueSchedulesData)
  const [loading, setLoading] = useState(false)
  const [selectedSchedules, setSelectedSchedules] = useState<number[]>([])

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setFilteredRevenueSchedules(revenueSchedules)
      return
    }

    const filtered = revenueSchedules.filter(schedule =>
      Object.values(schedule).some(value =>
        value.toString().toLowerCase().includes(query.toLowerCase())
      )
    )
    setFilteredRevenueSchedules(filtered)
  }

  const handleSort = (columnId: string, direction: 'asc' | 'desc') => {
    const sorted = [...filteredRevenueSchedules].sort((a, b) => {
      const aValue = a[columnId as keyof typeof a]
      const bValue = b[columnId as keyof typeof b]
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })
    
    setFilteredRevenueSchedules(sorted)
  }

  const handleRowClick = (schedule: any) => {
    console.log('Revenue schedule clicked:', schedule)
    // Navigate to schedule detail page or open modal
  }

  const handleCreateSchedule = () => {
    console.log('Create new revenue schedule')
    // Open create schedule modal or navigate to create page
  }

  const handleFilterChange = (filter: string) => {
    if (filter === 'active') {
      setFilteredRevenueSchedules(revenueSchedules.filter(schedule => schedule.active))
    } else {
      setFilteredRevenueSchedules(revenueSchedules)
    }
  }

  const handleSelectSchedule = (scheduleId: number, selected: boolean) => {
    if (selected) {
      setSelectedSchedules(prev => [...prev, scheduleId])
    } else {
      setSelectedSchedules(prev => prev.filter(id => id !== scheduleId))
    }
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedSchedules(filteredRevenueSchedules.map(schedule => schedule.id))
    } else {
      setSelectedSchedules([])
    }
  }

  // Update schedules data to include selection state
  const schedulesWithSelection = filteredRevenueSchedules.map(schedule => ({
    ...schedule,
    checkbox: selectedSchedules.includes(schedule.id)
  }))

  return (
    <div className="h-full flex flex-col">
      {/* Custom Filter Header for Revenue Schedules */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">All</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Reconciled</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Un Reconciled</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Start Date</span>
            <input 
              type="date" 
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              placeholder="YYYY-MM-DD"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">End Date</span>
            <input 
              type="date" 
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              placeholder="YYYY-MM-DD"
            />
          </div>
        </div>
      </div>

      {/* List Header */}
      <ListHeader
        searchPlaceholder="Search Here"
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onCreateClick={handleCreateSchedule}
      />

      {/* Table */}
      <div className="flex-1 p-6">
        <DynamicTable
          columns={revenueScheduleColumns}
          data={schedulesWithSelection}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={loading}
          emptyMessage="No revenue schedules found"
        />
      </div>
    </div>
  )
}