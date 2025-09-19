'use client'

import { useState } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column } from '@/components/dynamic-table'
import { reconciliationData } from '@/lib/mock-data'
import { Check, X } from 'lucide-react'

const reconciliationColumns: Column[] = [
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
    id: 'reconciled',
    label: 'Reconciled',
    width: 100,
    minWidth: 80,
    maxWidth: 120,
    type: 'toggle',
    accessor: 'reconciled'
  },
  {
    id: 'accountName',
    label: 'Account Name',
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
    id: 'month',
    label: 'Period',
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    type: 'text'
  },
  {
    id: 'totalRevenue',
    label: 'Total Revenue',
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    type: 'text'
  },
  {
    id: 'totalCommissions',
    label: 'Total Commissions',
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
    render: (value) => {
      const isCompleted = value === 'Completed'
      return (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
          isCompleted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {isCompleted ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {value}
        </div>
      )
    }
  }
]

export default function ReconciliationPage() {
  const [reconciliation, setReconciliation] = useState(reconciliationData)
  const [filteredReconciliation, setFilteredReconciliation] = useState(reconciliationData)
  const [loading, setLoading] = useState(false)

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setFilteredReconciliation(reconciliation)
      return
    }

    const filtered = reconciliation.filter(record =>
      Object.values(record).some(value =>
        value.toString().toLowerCase().includes(query.toLowerCase())
      )
    )
    setFilteredReconciliation(filtered)
  }

  const handleSort = (columnId: string, direction: 'asc' | 'desc') => {
    const sorted = [...filteredReconciliation].sort((a, b) => {
      const aValue = a[columnId as keyof typeof a]
      const bValue = b[columnId as keyof typeof b]
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })
    
    setFilteredReconciliation(sorted)
  }

  const handleRowClick = (record: any) => {
    console.log('Reconciliation record clicked:', record)
    // Navigate to reconciliation detail page or open modal
  }

  const handleCreateReconciliation = () => {
    console.log('Create new reconciliation record')
    // Open create reconciliation modal or navigate to create page
  }

  const handleFilterChange = (filter: string) => {
    if (filter === 'active') {
      setFilteredReconciliation(reconciliation.filter(record => record.active))
    } else if (filter === 'reconciled') {
      setFilteredReconciliation(reconciliation.filter(record => record.reconciled))
    } else {
      setFilteredReconciliation(reconciliation)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* List Header */}
      <ListHeader
        searchPlaceholder="Search Here"
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onCreateClick={handleCreateReconciliation}
      />

      {/* Table */}
      <div className="flex-1 p-6">
        <DynamicTable
          columns={reconciliationColumns}
          data={filteredReconciliation}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={loading}
          emptyMessage="No reconciliation records found"
        />
      </div>
    </div>
  )
}