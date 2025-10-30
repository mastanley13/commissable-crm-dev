'use client'

import { useState, useCallback, useMemo } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column, PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { TableChangeNotification } from '@/components/table-change-notification'
import { reportsData } from '@/lib/mock-data'
import { FileText, Download, Play, Settings } from 'lucide-react'

const reportColumns: Column[] = [
  {
    id: 'actions',
    label: 'Select All',
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
  } = useTablePreferences("reports:list", reportColumns)

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

  const handleRowClick = useCallback((report: any) => {
    console.log('Report clicked:', report)
    // Navigate to report detail page or open modal
  }, [])

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

  // Pagination handlers
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(1) // Reset to first page when page size changes
  }, [])

  // Calculate paginated data
  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredReports.slice(startIndex, endIndex)
  }, [filteredReports, currentPage, pageSize])

  // Calculate pagination info
  const paginationInfo = useMemo((): PaginationInfo => {
    const totalItems = filteredReports.length
    const totalPages = Math.ceil(totalItems / pageSize)

    return {
      page: currentPage,
      totalPages,
      pageSize,
      total: totalItems,
    }
  }, [filteredReports.length, currentPage, pageSize])

  const tableLoading = loading || preferenceLoading
  const tableColumns = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === 'actions') {
        return {
          ...column,
          render: () => (
            <div className="flex gap-1">
              <button className="text-green-500 hover:text-green-700 p-1 rounded transition-colors" title="Run Report">
                <Play className="h-4 w-4" />
              </button>
              <button className="text-blue-500 hover:text-blue-700 p-1 rounded transition-colors" title="Download">
                <Download className="h-4 w-4" />
              </button>
            </div>
          ),
        };
      }
      if (column.id === 'reportName') {
        return {
          ...column,
          render: (value: any) => (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
                {value}
              </span>
            </div>
          ),
        };
      }
      if (column.id === 'status') {
        return {
          ...column,
          render: (value: any) => (
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              value === 'Completed' ? 'bg-green-100 text-green-800' : 
              value === 'Running' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {value}
            </div>
          ),
        };
      }
      return column;
    });
  }, [preferenceColumns])
  
  // Get hidden columns by comparing all columns with visible ones
  const hiddenColumns = useMemo(() => {
    return reportColumns
      .filter(col => !tableColumns.some(visibleCol => visibleCol.id === col.id))
      .map(col => col.id)
  }, [tableColumns])

  return (
    <div className="dashboard-page-container">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Search */}
          <div className="flex items-center flex-1 max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search reports..."
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
              onClick={handleCreateReport}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Create New
            </button>
            
            <button
              onClick={() => setShowColumnSettings(true)}
              className="p-2 text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Column Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          {/* Right side - Filters */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFilterChange("completed")}
              className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            >
              Completed
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
          data={paginatedReports}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={tableLoading}
          emptyMessage="No reports found"
          onColumnsChange={handleColumnsChange}
          autoSizeColumns={false}
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
