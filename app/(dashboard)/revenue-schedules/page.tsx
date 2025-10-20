'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column, PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { revenueSchedulesData } from '@/lib/mock-data'
import { Edit, Check, Trash2 } from 'lucide-react'
import { isRowInactive } from '@/lib/row-state'
import { CopyProtectionWrapper } from '@/components/copy-protection'
import { useToasts } from '@/components/toast'
import { RevenueSchedulesBulkActionBar } from '@/components/revenue-schedules-bulk-action-bar'

// Column configuration aligned to 04.00.000 – 04.00.023 (where data available)
const revenueScheduleColumns: Column[] = [
  {
    id: 'multi-action',
    label: 'Select All',
    width: 200,
    minWidth: 160,
    maxWidth: 240,
    type: 'multi-action',
    accessor: 'checkbox'
  },
  {
    id: 'distributorName',
    label: 'Distributor Name', // 04.00.000
    width: 160,
    minWidth: 130,
    maxWidth: 260,
    sortable: true,
    type: 'text',
    hidden: true,
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
  // Not part of 04.00 list — keep hidden/optional
  {
    id: 'accountLegalName',
    label: 'Account Legal Name',
    width: 180,
    minWidth: 140,
    maxWidth: 300,
    sortable: true,
    type: 'text',
    hidden: true,
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
    id: 'revenueScheduleName', // 04.00.005
    label: 'Revenue Schedule Name',
    width: 140,
    minWidth: 120,
    maxWidth: 180,
    sortable: true,
    type: 'text',
    accessor: 'revenueSchedule',
  },
  {
    id: 'customerIdDistributor', // 04.00.020
    label: 'Customer ID - Distributor',
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: 'text',
    accessor: 'distributorId',
  },
  // Non-spec; hide by default
  { id: 'orderIdHouse', label: 'Order ID - House', width: 120, minWidth: 100, maxWidth: 180, sortable: true, type: 'text', hidden: true },
  // 04.00.006 – Quantity (missing in mock) — keep hidden until backend
  { id: 'quantity', label: 'Quantity', width: 100, minWidth: 90, maxWidth: 160, sortable: true, type: 'text', hidden: true },
  // 04.00.007 – Price Each (missing in mock) — hidden
  { id: 'priceEach', label: 'Price Each', width: 120, minWidth: 100, maxWidth: 160, sortable: true, type: 'text', hidden: true },
  {
    id: 'expectedUsageGross', // 04.00.008
    label: 'Expected Usage Gross',
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: 'text',
    accessor: 'expectedUsage',
  },
  {
    id: 'expectedUsageAdjustment', // 04.00.009
    label: 'Expected Usage Adjustment',
    width: 140,
    minWidth: 120,
    maxWidth: 180,
    sortable: true,
    type: 'text',
    accessor: 'usageAdjustment'
  },
  {
    id: 'expectedUsageNet', // 04.00.010
    label: 'Expected Usage Net',
    width: 140,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    type: 'text',
  },
  // 04.00.011 Actual Usage (missing) — hidden
  { id: 'actualUsage', label: 'Actual Usage', width: 140, minWidth: 120, maxWidth: 200, sortable: true, type: 'text', hidden: true },
  // 04.00.012 Usage Balance (requires actual usage) — hidden
  { id: 'usageBalance', label: 'Usage Balance', width: 140, minWidth: 120, maxWidth: 200, sortable: true, type: 'text', hidden: true },
  // 04.00.013 Expected Commission Net (depends on rate) — hidden
  { id: 'expectedCommissionNet', label: 'Expected Commission Net', width: 160, minWidth: 130, maxWidth: 240, sortable: true, type: 'text', hidden: true },
  // 04.00.014 Actual Commission — hidden
  { id: 'actualCommission', label: 'Actual Commission', width: 150, minWidth: 120, maxWidth: 220, sortable: true, type: 'text', hidden: true },
  // 04.00.015 Commission Difference — hidden
  { id: 'commissionDifference', label: 'Commission Difference', width: 170, minWidth: 130, maxWidth: 260, sortable: true, type: 'text', hidden: true },
  // 04.00.016 Customer ID - Vendor — hidden until backend
  { id: 'customerIdVendor', label: 'Customer ID - Vendor', width: 160, minWidth: 130, maxWidth: 240, sortable: true, type: 'text', hidden: true },
  // 04.00.017 Order ID - Vendor — hidden
  { id: 'orderIdVendor', label: 'Order ID - Vendor', width: 150, minWidth: 120, maxWidth: 220, sortable: true, type: 'text', hidden: true },
  // 04.00.018 Location ID — hidden
  { id: 'locationId', label: 'Location ID', width: 130, minWidth: 110, maxWidth: 200, sortable: true, type: 'text', hidden: true },
  // 04.00.021 Order ID - Distributor — hidden
  { id: 'orderIdDistributor', label: 'Order ID - Distributor', width: 160, minWidth: 120, maxWidth: 220, sortable: true, type: 'text', hidden: true },
  // 04.00.022 Schedule Status — hidden (not computed yet)
  { id: 'scheduleStatus', label: 'Schedule Status', width: 150, minWidth: 120, maxWidth: 220, sortable: true, type: 'text', hidden: true },
  // 04.00.023 In Dispute — hidden
  { id: 'inDispute', label: 'In Dispute', width: 120, minWidth: 100, maxWidth: 160, sortable: true, type: 'text', hidden: true },
]

type FilterableColumnKey =
  | 'accountName'
  | 'vendorName'
  | 'distributorName'
  | 'productNameVendor'
  | 'revenueScheduleName'
  | 'revenueScheduleDate'
  | 'opportunityId'
  | 'customerIdDistributor'
  | 'customerIdVendor'
  | 'orderIdVendor'
  | 'orderIdDistributor'
  | 'locationId'

const RS_DEFAULT_VISIBLE_COLUMN_IDS = new Set<string>([
  'accountName',
  'vendorName',
  'productNameVendor',
  'revenueScheduleDate',
  'revenueScheduleName',
  'expectedUsageGross',
  'expectedUsageAdjustment',
  'expectedUsageNet',
  'opportunityId',
])

const filterOptions: { id: FilterableColumnKey; label: string }[] = [
  { id: 'accountName', label: 'Account Name' },
  { id: 'vendorName', label: 'Vendor Name' },
  { id: 'distributorName', label: 'Distributor Name' },
  { id: 'productNameVendor', label: 'Product Name - Vendor' },
  { id: 'revenueScheduleName', label: 'Revenue Schedule Name' },
  { id: 'revenueScheduleDate', label: 'Revenue Schedule Date' },
  { id: 'opportunityId', label: 'Opportunity ID' },
  { id: 'customerIdDistributor', label: 'Customer ID - Distributor' },
  { id: 'customerIdVendor', label: 'Customer ID - Vendor' },
  { id: 'orderIdVendor', label: 'Order ID - Vendor' },
  { id: 'orderIdDistributor', label: 'Order ID - Distributor' },
  { id: 'locationId', label: 'Location ID' },
]

export default function RevenueSchedulesPage() {
  const { showSuccess, showError, ToastContainer } = useToasts()
  const router = useRouter()
  const [revenueSchedules, setRevenueSchedules] = useState(revenueSchedulesData)
  const [filteredRevenueSchedules, setFilteredRevenueSchedules] = useState(revenueSchedulesData)
  const [loading, setLoading] = useState(false)
  const [selectedSchedules, setSelectedSchedules] = useState<number[]>([])
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [statusQuickFilter, setStatusQuickFilter] = useState<'all' | 'open' | 'reconciled' | 'in_dispute'>('all')
  const [inDisputeOnly, setInDisputeOnly] = useState(false)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active'>('active')
  const [columnFilters, setColumnFilters] = useState<{ columnId: FilterableColumnKey; value: string }[]>([])

  const handleToggleScheduleStatus = useCallback((scheduleId: number, newStatus: boolean) => {
    setRevenueSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, active: newStatus } : s))
    setFilteredRevenueSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, active: newStatus } : s))
  }, [])

  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    error: preferenceError,
    saving: preferenceSaving,
    hasUnsavedChanges,
    lastSaved,
    handleColumnsChange,
    saveChanges,
    saveChangesOnModalClose,
  } = useTablePreferences('revenue-schedules:list', revenueScheduleColumns)

  // Normalize default column visibility for first load
  const [rsColumnsNormalized, setRsColumnsNormalized] = useState(false)
  useEffect(() => {
    if (rsColumnsNormalized || preferenceLoading) return
    if (!preferenceColumns || preferenceColumns.length === 0) return

    const normalized = preferenceColumns.map(column => {
      if (column.id === 'multi-action') return column
      if (RS_DEFAULT_VISIBLE_COLUMN_IDS.has(column.id)) {
        return column.hidden ? { ...column, hidden: false } : column
      }
      return column.hidden === true ? column : { ...column, hidden: true }
    })

    const changed = normalized.some((c, i) => c.hidden !== preferenceColumns[i].hidden)
    if (changed) {
      handleColumnsChange(normalized)
    }
    setRsColumnsNormalized(true)
  }, [preferenceColumns, preferenceLoading, handleColumnsChange, rsColumnsNormalized])

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

  const handleRowClick = useCallback((schedule: any) => {
    const oppId = schedule?.opportunityId
    if (oppId) {
      router.push(`/opportunities/${oppId}`)
      return
    }
    const id = schedule?.id
    if (id) {
      router.push(`/revenue-schedules/${id}`)
    }
  }, [router])

  const handleCreateSchedule = () => {
    console.log('Create new revenue schedule')
    // Open create schedule modal or navigate to create page
  }

  const handleStatusFilterChange = (filter: string) => {
    setActiveFilter(filter === 'active' ? 'active' : 'all')
    setCurrentPage(1)
  }

  const handleColumnFiltersChange = useCallback((filters: { columnId: string; value: string }[]) => {
    setCurrentPage(1)
    if (!Array.isArray(filters) || filters.length === 0) {
      setColumnFilters([])
      return
    }

    const sanitized = filters
      .filter(f => filterOptions.some(opt => opt.id === (f.columnId as FilterableColumnKey)))
      .map(f => ({ columnId: f.columnId as FilterableColumnKey, value: (f.value ?? '').trim() }))
      .filter(f => f.value.length > 0)

    setColumnFilters(sanitized)
  }, [])

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

  const handleDeleteRow = useCallback((scheduleId: number) => {
    // Client-side delete placeholder; wire to API when available
    setRevenueSchedules(prev => prev.filter(row => row.id !== scheduleId))
    setSelectedSchedules(prev => prev.filter(id => id !== scheduleId))
    showSuccess('Deleted', 'Schedule has been removed from the list.')
  }, [showSuccess])

  // Pagination handlers
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(1) // Reset to first page when page size changes
  }, [])

  // Utility: parse/format currency for computed columns
  const parseCurrency = (value: unknown): number => {
    if (typeof value !== 'string') return 0
    const trimmed = value.trim()
    if (!trimmed) return 0
    const negative = trimmed.startsWith('(') && trimmed.endsWith(')')
    const numeric = trimmed.replace(/[$,()\s]/g, '')
    const n = Number(numeric || '0')
    return negative ? -n : n
  }
  const formatCurrency = (n: number): string => {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
    } catch {
      return `$${n.toFixed(2)}`
    }
  }

  // Apply status and column filters
  const filteredByStatusAndColumns = useMemo(() => {
    let next = activeFilter === 'active' ? revenueSchedules.filter(r => r.active) : [...revenueSchedules]

    if (statusQuickFilter !== 'all') {
      next = next.filter(row => {
        const hasDispute = Boolean((row as any).inDispute)
        const gross = parseCurrency((row as any).expectedUsage)
        const adj = parseCurrency((row as any).usageAdjustment)
        const net = gross + adj
        const isOpen = Math.abs(net) > 0.0001
        const isReconciled = !isOpen
        if (statusQuickFilter === 'open') return isOpen
        if (statusQuickFilter === 'reconciled') return isReconciled
        if (statusQuickFilter === 'in_dispute') return hasDispute
        return true
      })
    }

    if (inDisputeOnly) {
      next = next.filter(row => Boolean((row as any).inDispute))
    }

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null
      const end = endDate ? new Date(endDate) : null
      next = next.filter(row => {
        const d = new Date((row as any).revenueScheduleDate)
        if (Number.isNaN(d.getTime())) return false
        if (start && d < start) return false
        if (end) {
          const endInclusive = new Date(end)
          endInclusive.setHours(23, 59, 59, 999)
          if (d > endInclusive) return false
        }
        return true
      })
    }

    if (columnFilters.length > 0) {
      columnFilters.forEach(filter => {
        const key = filter.columnId as keyof typeof revenueSchedules[number]
        const val = filter.value.toLowerCase()
        next = next.filter(row => {
          const rv = row[key]
          if (rv === undefined || rv === null) return false
          return String(rv).toLowerCase().includes(val)
        })
      })
    }
    return next
  }, [revenueSchedules, activeFilter, columnFilters, statusQuickFilter, inDisputeOnly, startDate, endDate])

  // Add computed columns (Expected Usage Net)
  const withComputed = useMemo(() => {
    return filteredByStatusAndColumns.map(row => {
      const rawGross = (row as any).expectedUsage as string | undefined
      const rawAdj = (row as any).usageAdjustment as string | undefined
      const bothBlank = (!rawGross || rawGross.trim() === '-' || rawGross.trim() === '') && (!rawAdj || rawAdj.trim() === '-' || rawAdj.trim() === '')
      const gross = parseCurrency(rawGross)
      const adj = parseCurrency(rawAdj)
      const net = gross + adj
      return { ...row, expectedUsageNet: bothBlank ? '-' : formatCurrency(net) }
    })
  }, [filteredByStatusAndColumns])

  // Calculate paginated data
  const paginatedRevenueSchedules = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return withComputed.slice(startIndex, endIndex)
  }, [withComputed, currentPage, pageSize])

  // Calculate pagination info
  const paginationInfo = useMemo((): PaginationInfo => {
    const totalItems = withComputed.length
    const totalPages = Math.ceil(totalItems / pageSize)

    return {
      page: currentPage,
      totalPages,
      pageSize,
      total: totalItems,
    }
  }, [withComputed.length, currentPage, pageSize])

  const tableLoading = loading || preferenceLoading
  const tableColumns = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === 'multi-action') {
        return {
          ...column,
          render: (_: unknown, row: any) => {
            const rowId = Number(row.id)
            const checked = selectedSchedules.includes(rowId)
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                {/* Checkbox */}
                <label className="flex cursor-pointer items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    aria-label={`Select revenue schedule ${rowId}`}
                    onChange={() => handleSelectSchedule(rowId, !checked)}
                  />
                  <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>

                {/* Toggle placeholder (schedules do not have active/inactive; use open/reconciled style if needed) */}
                <span className="inline-flex w-9 h-5 items-center justify-start rounded-full bg-gray-300 opacity-50" title="No status toggle for schedules">
                  <span className="inline-block w-4 h-4 bg-white rounded-full shadow translate-x-1" />
                </span>

                {/* Actions */}
                <div className="flex gap-0.5">
                  {isRowInactive(row) && (
                    <button
                      type="button"
                      className="p-1 text-red-500 hover:text-red-700 transition-colors rounded"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteRow(rowId) }}
                      aria-label="Delete"
                      title="Delete"
                    >
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
  }, [preferenceColumns, selectedSchedules, handleSelectSchedule, handleToggleScheduleStatus])
  
  // Update schedules data to include selection state
  const schedulesWithSelection = paginatedRevenueSchedules.map(schedule => ({
    ...schedule,
    checkbox: selectedSchedules.includes(schedule.id)
  }))

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
        pageTitle="REVENUE SCHEDULES LIST"
        searchPlaceholder="Search revenue schedules..."
        onSearch={handleSearch}
        onFilterChange={handleStatusFilterChange}
        showCreateButton={false}
        showStatusFilter={false}
        leftAccessory={(
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-0.5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'open', label: 'Open' },
                  { id: 'reconciled', label: 'Reconciled' },
                  { id: 'in_dispute', label: 'In Dispute' },
                ] as const
              ).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setStatusQuickFilter(opt.id); setCurrentPage(1) }}
                  className={`px-3 py-1.5 text-sm font-medium transition-all duration-200 rounded-md ${
                    statusQuickFilter === opt.id
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1 text-sm text-gray-700">
              <input type="checkbox" checked={inDisputeOnly} onChange={(e) => { setInDisputeOnly(e.target.checked); setCurrentPage(1) }} />
              In Dispute Only
            </label>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-gray-600">Start</span>
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setCurrentPage(1) }} className="rounded border border-gray-300 px-2 py-1" />
              <span className="text-gray-600">End</span>
              <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setCurrentPage(1) }} className="rounded border border-gray-300 px-2 py-1" />
            </div>
          </div>
        )}
        onSettingsClick={() => setShowColumnSettings(true)}
        filterColumns={filterOptions}
        columnFilters={columnFilters}
        onColumnFiltersChange={handleColumnFiltersChange}
        statusFilter={activeFilter}
        hasUnsavedTableChanges={hasUnsavedChanges}
        isSavingTableChanges={preferenceSaving}
        lastTableSaved={lastSaved || undefined}
        onSaveTableChanges={saveChanges}
      />

      {(preferenceError) && (
        <div className="px-4 text-sm text-red-600">{preferenceError}</div>
      )}

      <div className="flex-1 p-4 min-h-0">
        <RevenueSchedulesBulkActionBar
          count={selectedSchedules.length}
          onDelete={() => {
            if (selectedSchedules.length === 0) {
              showError('No items selected', 'Select at least one item to delete.')
              return
            }
            // For schedules, we only support soft-delete as a UX placeholder. Replace with real API when available
            const remainingIds = new Set(selectedSchedules)
            setRevenueSchedules(prev => prev.filter(row => !remainingIds.has(row.id)))
            setSelectedSchedules([])
            showSuccess('Deleted', 'Selected schedules have been removed from the list.')
          }}
          onExportCsv={() => {
            if (selectedSchedules.length === 0) {
              showError('No items selected', 'Select at least one item to export.')
              return
            }
            const rows = revenueSchedules.filter(r => selectedSchedules.includes(r.id))
            if (rows.length === 0) {
              showError('Items not available', 'Unable to locate the selected items. Refresh and try again.')
              return
            }
            const headers = [
              'Account Name',
              'Vendor Name',
              'Product Name - Vendor',
              'Revenue Schedule Date',
              'Revenue Schedule Name',
              'Expected Usage Gross',
              'Expected Usage Adjustment',
              'Expected Usage Net',
              'Opportunity ID',
              'Customer ID - Distributor',
            ]
            const escapeCsv = (value: string | null | undefined) => {
              if (value === null || value === undefined) return ''
              const sv = String(value)
              return (sv.includes('"') || sv.includes(',') || sv.includes('\n') || sv.includes('\r')) ? `"${sv.replace(/"/g, '""')}"` : sv
            }
            const lines = [
              headers.join(','),
              ...rows.map(row => {
                const gross = parseCurrency(row.expectedUsage)
                const adj = parseCurrency(row.usageAdjustment)
                const net = gross + adj
                return [
                  row.accountName,
                  row.vendorName,
                  row.productNameVendor,
                  row.revenueScheduleDate,
                  row.revenueSchedule,
                  row.expectedUsage,
                  row.usageAdjustment,
                  formatCurrency(net),
                  row.opportunityId,
                  row.distributorId,
                ].map(escapeCsv).join(',')
              })
            ]
            const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0]
            link.href = url
            link.download = `revenue-schedules-export-${timestamp}.csv`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
            showSuccess(`Exported ${rows.length} item${rows.length === 1 ? '' : 's'}`, 'Check your downloads for the CSV file.')
          }}
        />

        <DynamicTable
          columns={tableColumns}
          data={schedulesWithSelection}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={tableLoading}
          emptyMessage="No revenue schedules found"
          onColumnsChange={handleColumnsChange}
          pagination={paginationInfo}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          selectedItems={selectedSchedules.map(String)}
          onItemSelect={(id, selected, row) => handleSelectSchedule(Number(id), selected)}
          onSelectAll={handleSelectAll}
          autoSizeColumns={false}
          alwaysShowPagination
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
      <ToastContainer />
    </CopyProtectionWrapper>
  )
}
