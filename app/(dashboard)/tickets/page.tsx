'use client'

import { useState, useCallback, useMemo } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column, PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { TableChangeNotification } from '@/components/table-change-notification'
import { ticketsData } from '@/lib/mock-data'
import { Edit, Trash2, Settings, Check } from 'lucide-react'
import { isRowInactive } from '@/lib/row-state'

const ticketColumns: Column[] = [
  {
    id: 'multi-action',
    label: 'Select All',
    width: 200,
    minWidth: 160,
    maxWidth: 240,
    type: 'multi-action',
    accessor: 'select'
  },
  {
    id: 'distributorName',
    label: 'Distributor Name',
    width: 180,
    minWidth: 150,
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
    type: 'text'
  },
  {
    id: 'issue',
    label: 'Issue',
    width: 200,
    minWidth: 150,
    maxWidth: 350,
    sortable: true,
    type: 'text'
  },
  {
    id: 'revenueSchedule',
    label: 'Revenue Schedule',
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    type: 'text'
  },
  {
    id: 'opportunityName',
    label: 'Opportunity Name',
    width: 200,
    minWidth: 150,
    maxWidth: 300,
    sortable: true,
    type: 'text'
  }
]

export default function TicketsPage() {
  const [tickets, setTickets] = useState(ticketsData)
  const [filteredTickets, setFilteredTickets] = useState(ticketsData)
  const [loading, setLoading] = useState(false)
  const [selectedTickets, setSelectedTickets] = useState<number[]>([])
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)
  
  const handleToggleTicketStatus = useCallback((ticketId: number, newStatus: boolean) => {
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, active: newStatus } : t))
    setFilteredTickets(prev => prev.map(t => t.id === ticketId ? { ...t, active: newStatus } : t))
  }, [])

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
  } = useTablePreferences("tickets:list", ticketColumns)

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setFilteredTickets(tickets)
      return
    }

    const filtered = tickets.filter(ticket =>
      Object.values(ticket).some(value =>
        value.toString().toLowerCase().includes(query.toLowerCase())
      )
    )
    setFilteredTickets(filtered)
  }

  const handleSort = (columnId: string, direction: 'asc' | 'desc') => {
    const sorted = [...filteredTickets].sort((a, b) => {
      const aValue = a[columnId as keyof typeof a]
      const bValue = b[columnId as keyof typeof b]
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })
    
    setFilteredTickets(sorted)
  }

  const handleRowClick = useCallback((ticket: any) => {
    console.log('Ticket clicked:', ticket)
    // Navigate to ticket detail page or open modal
  }, [])

  const handleCreateTicket = () => {
    console.log('Create new ticket')
    // Open create ticket modal or navigate to create page
  }

  const handleFilterChange = (filter: string) => {
    if (filter === 'active') {
      setFilteredTickets(tickets.filter(ticket => ticket.active))
    } else {
      setFilteredTickets(tickets)
    }
  }

  const handleSelectTicket = (ticketId: number, selected: boolean) => {
    if (selected) {
      setSelectedTickets(prev => [...prev, ticketId])
    } else {
      setSelectedTickets(prev => prev.filter(id => id !== ticketId))
    }
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedTickets(filteredTickets.map(ticket => ticket.id))
    } else {
      setSelectedTickets([])
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
  const paginatedTickets = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredTickets.slice(startIndex, endIndex)
  }, [filteredTickets, currentPage, pageSize])

  // Calculate pagination info
  const paginationInfo = useMemo((): PaginationInfo => {
    const totalItems = filteredTickets.length
    const totalPages = Math.ceil(totalItems / pageSize)

    return {
      page: currentPage,
      totalPages,
      pageSize,
      total: totalItems,
    }
  }, [filteredTickets.length, currentPage, pageSize])

  const tableLoading = loading || preferenceLoading
  const tableColumns = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === 'multi-action') {
        return {
          ...column,
          render: (_: unknown, row: any) => {
            const rowId = Number(row.id ?? row.ticketId ?? row.orderId ?? 0)
            const checked = selectedTickets.includes(rowId)
            const activeValue = !!row.active
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                {/* Checkbox */}
                <label className="flex cursor-pointer items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    aria-label={`Select row ${rowId}`}
                    onChange={() => handleSelectTicket(rowId, !checked)}
                  />
                  <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>

                {/* Active Toggle */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleTicketStatus(rowId, !activeValue)
                  }}
                  className="relative inline-flex items-center cursor-pointer"
                  title={activeValue ? 'Active' : 'Inactive'}
                >
                  <span className={`w-9 h-5 rounded-full transition-colors duration-300 ease-in-out ${activeValue ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ease-in-out transform ${activeValue ? 'translate-x-4' : 'translate-x-1'} mt-0.5 ${activeValue ? 'ring-1 ring-blue-300' : ''}`} />
                  </span>
                </button>

                {/* Actions */}
                <div className="flex gap-0.5">
                  <button type="button" className="p-1 text-blue-500 hover:text-blue-700 transition-colors rounded" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} aria-label="Edit ticket">
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  {isRowInactive(row) && (
                    <button type="button" className="p-1 rounded transition-colors text-red-500 hover:text-red-700" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} aria-label={'Delete ticket'}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          }
        }
      }
      return column;
    });
  }, [preferenceColumns, selectedTickets, handleSelectTicket, handleToggleTicketStatus])
  
  // Get hidden columns by comparing all columns with visible ones
  const hiddenColumns = useMemo(() => {
    return ticketColumns
      .filter(col => !tableColumns.some(visibleCol => visibleCol.id === col.id))
      .map(col => col.id)
  }, [tableColumns])

  // Update tickets data to include selection state
  const ticketsWithSelection = paginatedTickets.map(ticket => ({
    ...ticket,
    select: selectedTickets.includes(ticket.id)
  }))

  return (
    <div className="dashboard-page-container">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Page Title */}
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">TICKETS LIST</p>

          {/* Left side - Search */}
          <div className="flex items-center flex-1 max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search tickets..."
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
              onClick={handleCreateTicket}
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
          data={ticketsWithSelection}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={tableLoading}
          emptyMessage="No tickets found"
          onColumnsChange={handleColumnsChange}
          selectedItems={selectedTickets.map(String)}
          onItemSelect={(id, selected) => handleSelectTicket(Number(id), selected)}
          onSelectAll={handleSelectAll}
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
