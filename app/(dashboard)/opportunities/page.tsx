'use client'

import { useState, useCallback, useMemo } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column, PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { TableChangeNotification } from '@/components/table-change-notification'
import { opportunitiesData } from '@/lib/mock-data'
import { Edit, Trash2, Settings, Check } from 'lucide-react'

const opportunityColumns: Column[] = [
  {
    id: 'multi-action',
    label: 'Select All',
    width: 200,
    minWidth: 160,
    maxWidth: 240,
    type: 'multi-action',
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
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [selectedOpps, setSelectedOpps] = useState<number[]>([])

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
  } = useTablePreferences("opportunities:list", opportunityColumns)

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

  const handleRowClick = useCallback((opportunity: any) => {
    console.log('Opportunity clicked:', opportunity)
    // Navigate to opportunity detail page or open modal
  }, [])

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

  const handleSelectOpportunity = (id: number, selected: boolean) => {
    setSelectedOpps(prev => selected ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter(x => x !== id))
  }

  const handleSelectAllOpps = (selected: boolean) => {
    if (selected) setSelectedOpps(filteredOpportunities.map(o => o.id))
    else setSelectedOpps([])
  }

  const handleToggleOpportunityStatus = useCallback((id: number, next: boolean) => {
    setOpportunities(prev => prev.map(o => o.id === id ? { ...o, active: next } : o))
    setFilteredOpportunities(prev => prev.map(o => o.id === id ? { ...o, active: next } : o))
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
  const paginatedOpportunities = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredOpportunities.slice(startIndex, endIndex)
  }, [filteredOpportunities, currentPage, pageSize])

  // Calculate pagination info
  const paginationInfo = useMemo((): PaginationInfo => {
    const totalItems = filteredOpportunities.length
    const totalPages = Math.ceil(totalItems / pageSize)

    return {
      page: currentPage,
      totalPages,
      pageSize,
      total: totalItems,
    }
  }, [filteredOpportunities.length, currentPage, pageSize])

  const tableLoading = loading || preferenceLoading
  const tableColumns = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === 'multi-action') {
        return {
          ...column,
          render: (_: unknown, row: any) => {
            const rowId = Number(row.id)
            const checked = selectedOpps.includes(rowId)
            const activeValue = !!row.active
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <label className="flex cursor-pointer items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" className="sr-only" checked={checked} aria-label={`Select opportunity ${rowId}`} onChange={() => handleSelectOpportunity(rowId, !checked)} />
                  <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleToggleOpportunityStatus(rowId, !activeValue) }} className="relative inline-flex items-center cursor-pointer" title={activeValue ? 'Active' : 'Inactive'}>
                  <span className={`w-9 h-5 rounded-full transition-colors duration-300 ease-in-out ${activeValue ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ease-in-out transform ${activeValue ? 'translate-x-4' : 'translate-x-1'} mt-0.5 ${activeValue ? 'ring-1 ring-blue-300' : ''}`} />
                  </span>
                </button>
                <div className="flex gap-0.5">
                  <button type="button" className="p-1 text-blue-500 hover:text-blue-700 transition-colors rounded" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} aria-label="Edit opportunity">
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className={`p-1 rounded transition-colors ${activeValue ? 'text-red-500 hover:text-red-700' : 'text-gray-400 hover:text-gray-600'}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} aria-label={activeValue ? 'Delete opportunity' : 'Manage opportunity'}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          }
        }
      }
      return column;
    });
  }, [preferenceColumns, selectedOpps, handleSelectOpportunity, handleToggleOpportunityStatus])
  
  // Get hidden columns by comparing all columns with visible ones
  const hiddenColumns = useMemo(() => {
    return opportunityColumns
      .filter(col => !tableColumns.some(visibleCol => visibleCol.id === col.id))
      .map(col => col.id)
  }, [tableColumns])

  return (
    <div className="dashboard-page-container">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Page Title */}
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">OPPORTUNITIES LIST</p>

          {/* Left side - Search */}
          <div className="flex items-center flex-1 max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search opportunities..."
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
              onClick={handleCreateOpportunity}
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
        data={paginatedOpportunities}
        onSort={handleSort}
        onRowClick={handleRowClick}
        loading={tableLoading}
        emptyMessage="No opportunities found"
        onColumnsChange={handleColumnsChange}
        autoSizeColumns={false}
        pagination={paginationInfo}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        selectedItems={selectedOpps.map(String)}
        onItemSelect={(id, selected) => handleSelectOpportunity(Number(id), selected)}
        onSelectAll={handleSelectAllOpps}
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
