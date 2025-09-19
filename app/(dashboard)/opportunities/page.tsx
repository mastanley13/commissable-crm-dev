'use client'

import { useState } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column } from '@/components/dynamic-table'
import { opportunitiesData } from '@/lib/mock-data'
import { Edit, Trash2 } from 'lucide-react'

const opportunityColumns: Column[] = [
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
    id: 'estimatedCloseDate',
    label: 'Estimated Close Date',
    width: 150,
    minWidth: 120,
    maxWidth: 200,
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
    id: 'opportunityName',
    label: 'Opportunity Name',
    width: 180,
    minWidth: 140,
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
    id: 'distributorName',
    label: 'Distributor Name',
    width: 150,
    minWidth: 120,
    maxWidth: 250,
    sortable: true,
    type: 'text'
  },
  {
    id: 'vendorName',
    label: 'Vendor Name',
    width: 150,
    minWidth: 120,
    maxWidth: 250,
    sortable: true,
    type: 'text'
  },
  {
    id: 'expectedUsageGrossTotal',
    label: 'Expected Usage Gross-Total',
    width: 180,
    minWidth: 140,
    maxWidth: 250,
    sortable: true,
    type: 'text'
  },
  {
    id: 'expectedCommissionGrossTotal',
    label: 'Expected Commission Gross-Total',
    width: 200,
    minWidth: 160,
    maxWidth: 280,
    sortable: true,
    type: 'text'
  },
  {
    id: 'opportunityOwner',
    label: 'Opportunity Owner',
    width: 150,
    minWidth: 120,
    maxWidth: 250,
    sortable: true,
    type: 'text'
  }
]

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState(opportunitiesData)
  const [filteredOpportunities, setFilteredOpportunities] = useState(opportunitiesData)
  const [loading, setLoading] = useState(false)

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setFilteredOpportunities(opportunities)
      return
    }

    const filtered = opportunities.filter(opportunity =>
      Object.values(opportunity).some(value =>
        value.toString().toLowerCase().includes(query.toLowerCase())
      )
    )
    setFilteredOpportunities(filtered)
  }

  const handleSort = (columnId: string, direction: 'asc' | 'desc') => {
    const sorted = [...filteredOpportunities].sort((a, b) => {
      const aValue = a[columnId as keyof typeof a]
      const bValue = b[columnId as keyof typeof b]
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })
    
    setFilteredOpportunities(sorted)
  }

  const handleRowClick = (opportunity: any) => {
    console.log('Opportunity clicked:', opportunity)
    // Navigate to opportunity detail page or open modal
  }

  const handleCreateOpportunity = () => {
    console.log('Create new opportunity')
    // Open create opportunity modal or navigate to create page
  }

  const handleFilterChange = (filter: string) => {
    if (filter === 'active') {
      setFilteredOpportunities(opportunities.filter(opportunity => opportunity.active))
    } else {
      setFilteredOpportunities(opportunities)
    }
  }

  return (
    <div className="dashboard-page-container">
      {/* List Header */}
      <ListHeader
        searchPlaceholder="Search Here"
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onCreateClick={handleCreateOpportunity}
      />

      {/* Table */}
      <div className="flex-1 p-6 min-h-0">
        <DynamicTable
          columns={opportunityColumns}
          data={filteredOpportunities}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={loading}
          emptyMessage="No opportunities found"
        />
      </div>
    </div>
  )
}