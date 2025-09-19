'use client'

import { useState } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column } from '@/components/dynamic-table'
import { reportsData } from '@/lib/mock-data'
import { FileText, Download, Play } from 'lucide-react'

const reportColumns: Column[] = [
  {
    id: 'actions',
    label: 'Actions',
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    type: 'action',
    render: () => (
      <div className="flex gap-1">
        <button className="text-green-500 hover:text-green-700 p-1 rounded transition-colors" title="Run Report">
          <Play className="h-4 w-4" />
        </button>
        <button className="text-blue-500 hover:text-blue-700 p-1 rounded transition-colors" title="Download">
          <Download className="h-4 w-4" />
        </button>
      </div>
    )
  },
  {
    id: 'reportName',
    label: 'Report Name',
    width: 250,
    minWidth: 200,
    maxWidth: 400,
    sortable: true,
    type: 'text',
    render: (value) => (
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-blue-600" />
        <span className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
          {value}
        </span>
      </div>
    )
  },
  {
    id: 'reportType',
    label: 'Report Type',
    width: 150,
    minWidth: 120,
    maxWidth: 200,
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
  },
  {
    id: 'lastRun',
    label: 'Last Run',
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
        value === 'Running' ? 'bg-blue-100 text-blue-800' :
        'bg-gray-100 text-gray-800'
      }`}>
        {value}
      </div>
    )
  }
]

export default function ReportsPage() {
  const [reports, setReports] = useState(reportsData)
  const [filteredReports, setFilteredReports] = useState(reportsData)
  const [loading, setLoading] = useState(false)

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setFilteredReports(reports)
      return
    }

    const filtered = reports.filter(report =>
      Object.values(report).some(value =>
        value.toString().toLowerCase().includes(query.toLowerCase())
      )
    )
    setFilteredReports(filtered)
  }

  const handleSort = (columnId: string, direction: 'asc' | 'desc') => {
    const sorted = [...filteredReports].sort((a, b) => {
      const aValue = a[columnId as keyof typeof a]
      const bValue = b[columnId as keyof typeof b]
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })
    
    setFilteredReports(sorted)
  }

  const handleRowClick = (report: any) => {
    console.log('Report clicked:', report)
    // Navigate to report detail page or open modal
  }

  const handleCreateReport = () => {
    console.log('Create new report')
    // Open create report modal or navigate to create page
  }

  const handleFilterChange = (filter: string) => {
    if (filter === 'completed') {
      setFilteredReports(reports.filter(report => report.status === 'Completed'))
    } else {
      setFilteredReports(reports)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* List Header */}
      <ListHeader
        searchPlaceholder="Search Here"
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onCreateClick={handleCreateReport}
      />

      {/* Table */}
      <div className="flex-1 p-6">
        <DynamicTable
          columns={reportColumns}
          data={filteredReports}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={loading}
          emptyMessage="No reports found"
        />
      </div>
    </div>
  )
}