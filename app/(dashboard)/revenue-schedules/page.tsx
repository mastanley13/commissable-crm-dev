'use client'

import Link from 'next/link'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column, PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { Check, Copy, Download, Trash2 } from 'lucide-react'
import { isRowInactive } from '@/lib/row-state'
import { CopyProtectionWrapper } from '@/components/copy-protection'
import { useToasts } from '@/components/toast'
import { calculateMinWidth } from '@/lib/column-width-utils'
import { StatusFilterDropdown } from '@/components/status-filter-dropdown'
import type { BulkActionsGridProps } from '@/components/bulk-actions-grid'
import {
  RevenueScheduleCloneModal,
  type CloneParameters,
  type SourceScheduleData,
} from '@/components/revenue-schedule-clone-modal'
import { RevenueBulkApplyPanel } from '@/components/revenue-bulk-apply-panel'
import { RevenueScheduleStatusModal } from '@/components/revenue-schedule-status-modal'
import {
  computeRevenueScheduleMetricsFromDisplay,
  formatCurrencyUSD,
  formatPercentFraction,
  isBlankDisplay,
  parseCurrencyDisplay,
} from '@/lib/revenue-schedule-math'

// Local UUID v1-v5 matcher used to detect schedule IDs vs. human codes
const UUID_REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i

// Column configuration aligned to Opportunity → Revenue Schedules tab
// and the requested column set for the main list
const revenueScheduleColumns: Column[] = [
  {
    id: 'multi-action',
    label: 'Select All',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Select All', type: 'multi-action', sortable: false }),
    maxWidth: 240,
    type: 'multi-action',
    accessor: 'checkbox',
  },
  {
    id: 'scheduleStatus', // 04.00.022
    label: 'Status',
    width: 160,
    minWidth: calculateMinWidth({ label: 'Status', type: 'text', sortable: true }),
    maxWidth: 220,
    sortable: true,
    type: 'text',
  },
  {
    id: 'distributorName', // 04.00.000
    label: 'Distributor Name',
    width: 180,
    minWidth: calculateMinWidth({ label: 'Distributor Name', type: 'text', sortable: true }),
    maxWidth: 280,
    sortable: true,
    type: 'text',
  },
  {
    id: 'vendorName', // 04.00.001
    label: 'Vendor Name',
    width: 160,
    minWidth: calculateMinWidth({ label: 'Vendor Name', type: 'text', sortable: true }),
    maxWidth: 260,
    sortable: true,
    type: 'text',
    render: (value) => (
      <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
        {value}
      </span>
    ),
  },
  {
    id: 'opportunityName',
    label: 'Opportunity Name',
    width: 220,
    minWidth: calculateMinWidth({ label: 'Opportunity Name', type: 'text', sortable: true }),
    maxWidth: 320,
    sortable: true,
    type: 'text',
  },
  {
    id: 'productNameVendor', // 04.00.003
    label: 'Vendor - Product Name',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Vendor - Product Name', type: 'text', sortable: true }),
    maxWidth: 320,
    sortable: true,
    type: 'text',
    render: (value) => (
      <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
        {value}
      </span>
    ),
  },
  {
    id: 'revenueScheduleDate', // 04.00.004
    label: 'Schedule Date',
    width: 160,
    minWidth: calculateMinWidth({ label: 'Schedule Date', type: 'text', sortable: true }),
    maxWidth: 220,
    sortable: true,
    type: 'text',
  },
  {
    id: 'accountName',
    label: 'Account Name',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Account Name', type: 'text', sortable: true }),
    maxWidth: 300,
    sortable: true,
    type: 'text',
  },
  {
    id: 'revenueScheduleName', // 04.00.005
    label: 'Revenue Schedule',
    width: 170,
    minWidth: calculateMinWidth({ label: 'Revenue Schedule', type: 'text', sortable: true }),
    maxWidth: 240,
    sortable: true,
    type: 'text',
  },
  {
    id: 'quantity', // 04.00.006
    label: 'Quantity',
    width: 120,
    minWidth: calculateMinWidth({ label: 'Quantity', type: 'text', sortable: true }),
    maxWidth: 180,
    sortable: true,
    type: 'text',
  },
  {
    id: 'priceEach', // 04.00.007
    label: 'Price Each',
    width: 140,
    minWidth: calculateMinWidth({ label: 'Price Each', type: 'text', sortable: true }),
    maxWidth: 200,
    sortable: true,
    type: 'text',
  },
  {
    id: 'expectedUsageGross', // 04.00.008
    label: 'Expected Usage Gross',
    width: 170,
    minWidth: calculateMinWidth({ label: 'Expected Usage Gross', type: 'text', sortable: true }),
    maxWidth: 240,
    sortable: true,
    type: 'text',
  },
  {
    id: 'expectedUsageAdjustment', // 04.00.009
    label: 'Expected Usage Adjustment',
    width: 190,
    minWidth: calculateMinWidth({ label: 'Expected Usage Adjustment', type: 'text', sortable: true }),
    maxWidth: 260,
    sortable: true,
    type: 'text',
  },
  {
    id: 'expectedUsageNet', // 04.00.010
    label: 'Expected Usage Net',
    width: 170,
    minWidth: calculateMinWidth({ label: 'Expected Usage Net', type: 'text', sortable: true }),
    maxWidth: 240,
    sortable: true,
    type: 'text',
  },
  {
    id: 'actualUsage', // 04.00.011
    label: 'Actual Usage',
    width: 150,
    minWidth: calculateMinWidth({ label: 'Actual Usage', type: 'text', sortable: true }),
    maxWidth: 220,
    sortable: true,
    type: 'text',
  },
  {
    id: 'usageBalance', // 04.00.012
    label: 'Usage Balance',
    width: 160,
    minWidth: calculateMinWidth({ label: 'Usage Balance', type: 'text', sortable: true }),
    maxWidth: 220,
    sortable: true,
    type: 'text',
  },
  {
    id: 'expectedCommissionGross', // added to match Opportunity tab
    label: 'Expected Commission Gross',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Expected Commission Gross', type: 'text', sortable: true }),
    maxWidth: 280,
    sortable: true,
    type: 'text',
  },
  {
    id: 'expectedCommissionAdjustment', // added to match Opportunity tab
    label: 'Expected Commission Adjustment',
    width: 220,
    minWidth: calculateMinWidth({ label: 'Expected Commission Adjustment', type: 'text', sortable: true }),
    maxWidth: 300,
    sortable: true,
    type: 'text',
  },
  {
    id: 'expectedCommissionNet', // 04.00.013
    label: 'Expected Commission Net',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Expected Commission Net', type: 'text', sortable: true }),
    maxWidth: 280,
    sortable: true,
    type: 'text',
  },
  {
    id: 'actualCommission', // 04.00.014
    label: 'Actual Commission',
    width: 170,
    minWidth: calculateMinWidth({ label: 'Actual Commission', type: 'text', sortable: true }),
    maxWidth: 240,
    sortable: true,
    type: 'text',
  },
  {
    id: 'commissionDifference', // 04.00.015
    label: 'Commission Difference',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Commission Difference', type: 'text', sortable: true }),
    maxWidth: 280,
    sortable: true,
    type: 'text',
  },
  {
    id: 'customerIdVendor', // 04.00.016
    label: 'Vendor - Customer ID',
    width: 210,
    minWidth: calculateMinWidth({ label: 'Vendor - Customer ID', type: 'text', sortable: true }),
    maxWidth: 280,
    sortable: true,
    type: 'text',
    hidden: true,
  },
  {
    id: 'orderIdVendor', // 04.00.017
    label: 'Vendor - Order ID',
    width: 190,
    minWidth: calculateMinWidth({ label: 'Vendor - Order ID', type: 'text', sortable: true }),
    maxWidth: 260,
    sortable: true,
    type: 'text',
    hidden: true,
  },
  {
    id: 'customerIdDistributor', // 04.00.020
    label: 'Distributor - Customer ID',
    width: 210,
    minWidth: calculateMinWidth({ label: 'Distributor - Customer ID', type: 'text', sortable: true }),
    maxWidth: 280,
    sortable: true,
    type: 'text',
    hidden: true,
  },
  {
    id: 'orderIdDistributor', // 04.00.021
    label: 'Distributor - Order ID',
    width: 190,
    minWidth: calculateMinWidth({ label: 'Distributor - Order ID', type: 'text', sortable: true }),
    maxWidth: 260,
    sortable: true,
    type: 'text',
    hidden: true,
  },
  {
    id: 'expectedCommissionRatePercent',
    label: 'Expected Commission Rate %',
    width: 220,
    minWidth: calculateMinWidth({ label: 'Expected Commission Rate %', type: 'text', sortable: true }),
    maxWidth: 280,
    sortable: true,
    type: 'text',
  },
  {
    id: 'actualCommissionRatePercent',
    label: 'Actual Commission Rate %',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Actual Commission Rate %', type: 'text', sortable: true }),
    maxWidth: 260,
    sortable: true,
    type: 'text',
  },
  {
    id: 'commissionRateDifference',
    label: 'Commission Rate Difference',
    width: 220,
    minWidth: calculateMinWidth({ label: 'Commission Rate Difference', type: 'text', sortable: true }),
    maxWidth: 280,
    sortable: true,
    type: 'text',
  },
]
type FilterableColumnKey =
  | 'vendorName'
  | 'distributorName'
  | 'accountName'
  | 'opportunityName'
  | 'productNameVendor'
  | 'revenueScheduleName'
  | 'revenueScheduleDate'
  | 'scheduleStatus'
  | 'customerIdVendor'
  | 'orderIdVendor'
  | 'customerIdDistributor'
  | 'orderIdDistributor'

type RevenueEditableColumnId =
  | 'quantity'
  | 'priceEach'
  | 'expectedUsageAdjustment'
  | 'expectedCommissionRatePercent'

type RevenueFillDownPrompt = {
  columnId: RevenueEditableColumnId
  label: string
  value: number
  rowId: string
  selectedCount: number
  anchor: { top: number; left: number }
}

const RS_DEFAULT_VISIBLE_COLUMN_IDS = new Set<string>([
  'distributorName',
  'vendorName',
  'accountName',
  'opportunityName',
  'productNameVendor',
  'revenueScheduleDate',
  'revenueScheduleName',
  'expectedUsageGross',
  'expectedUsageAdjustment',
  'expectedUsageNet',
  'scheduleStatus',
])

const filterOptions: { id: FilterableColumnKey; label: string }[] = [
  { id: 'vendorName', label: 'Vendor Name' },
  { id: 'distributorName', label: 'Distributor Name' },
  { id: 'accountName', label: 'Account Name' },
  { id: 'opportunityName', label: 'Opportunity Name' },
  { id: 'productNameVendor', label: 'Vendor - Product Name' },
  { id: 'revenueScheduleName', label: 'Revenue Schedule' },
  { id: 'revenueScheduleDate', label: 'Schedule Date' },
  { id: 'scheduleStatus', label: 'Status' },
   { id: 'customerIdVendor', label: 'Vendor - Customer ID' },
   { id: 'orderIdVendor', label: 'Vendor - Order ID' },
   { id: 'customerIdDistributor', label: 'Distributor - Customer ID' },
   { id: 'orderIdDistributor', label: 'Distributor - Order ID' },
]

const TABLE_BOTTOM_RESERVE = 110
const TABLE_MIN_BODY_HEIGHT = 320

const parseCurrency = (value: unknown): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0
  return parseCurrencyDisplay(value) ?? 0
}

const formatCurrency = (n: number): string => {
  return formatCurrencyUSD(n)
}

const formatPercent = (f: number | null): string => {
  if (f === null || !Number.isFinite(f)) return '-'
  return formatPercentFraction(f)
}

const normalizePageSize = (value: number): number => {
  if (!Number.isFinite(value)) return 100
  return Math.min(100, Math.max(1, Math.floor(value)))
}

export default function RevenueSchedulesPage() {
  const { showSuccess, showError, ToastContainer } = useToasts()
  const router = useRouter()
  const [revenueSchedules, setRevenueSchedules] = useState<any[]>([])
  const [filteredRevenueSchedules, setFilteredRevenueSchedules] = useState<any[]>([])
  const [sortConfig, setSortConfig] = useState<{ columnId: string; direction: 'asc' | 'desc' } | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([])
  const [bulkActionBusy, setBulkActionBusy] = useState(false)
  const [cloneModalOpen, setCloneModalOpen] = useState(false)
  const [cloneTargetId, setCloneTargetId] = useState<string | null>(null)
  const [cloneDefaultDate, setCloneDefaultDate] = useState<string>('')
  const [cloneSourceSchedule, setCloneSourceSchedule] = useState<SourceScheduleData | undefined>(undefined)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(100)
  const [statusQuickFilter, setStatusQuickFilter] = useState<'all' | 'open' | 'reconciled' | 'in_dispute'>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active'>('active')
  const [columnFilters, setColumnFilters] = useState<{ columnId: FilterableColumnKey; value: string }[]>([])
  const [tableBodyHeight, setTableBodyHeight] = useState<number>()
  const tableAreaNodeRef = useRef<HTMLDivElement | null>(null)
  const [revenueBulkPrompt, setRevenueBulkPrompt] = useState<RevenueFillDownPrompt | null>(null)
  const [revenueBulkApplying, setRevenueBulkApplying] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusModalSchedules, setStatusModalSchedules] = useState<any[]>([])
  const [statusModalDefaultAction, setStatusModalDefaultAction] = useState<'deactivate' | 'delete'>('delete')

  const selectedScheduleRows = useMemo(() => {
    if (selectedSchedules.length === 0) {
      return []
    }
    return revenueSchedules.filter(row => selectedSchedules.includes(row.id))
  }, [revenueSchedules, selectedSchedules])

  const parseDisplayNumber = useCallback((value: unknown): number | null => {
    if (value === null || value === undefined) return null
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null
    }
    const text = String(value).trim()
    if (!text) return null
    const negative = text.startsWith('(') && text.endsWith(')')
    const normalized = text.replace(/[^0-9.\-]/g, '')
    if (!normalized) return null
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) return null
    if (negative) {
      return parsed > 0 ? -parsed : parsed
    }
    return parsed
  }, [])

  const openStatusModal = useCallback((targets: any[], action: 'deactivate' | 'delete' = 'delete') => {
    if (!targets || targets.length === 0) {
      showError('No items selected', 'Select at least one item to delete.')
      return
    }
    setStatusModalSchedules(targets)
    setStatusModalDefaultAction(action)
    setStatusModalOpen(true)
  }, [showError])

  const closeStatusModal = useCallback(() => {
    setStatusModalOpen(false)
    setStatusModalSchedules([])
  }, [])

  const normalizeSortValue = useCallback((value: unknown) => {
    const numeric = parseDisplayNumber(value)
    if (numeric !== null) {
      return { type: 'number' as const, value: numeric }
    }

    if (value === null || value === undefined) {
      return { type: 'string' as const, value: '' }
    }

    const asString = String(value).trim()
    return { type: 'string' as const, value: asString.toLowerCase() }
  }, [parseDisplayNumber])

  const compareDefaultRevenueScheduleSort = useCallback((a: any, b: any) => {
    const normalizeKey = (value: unknown) => {
      if (value === null || value === undefined) {
        return { missing: true, value: '' }
      }
      const text = String(value).trim().toLowerCase()
      return { missing: text.length === 0, value: text }
    }

    const compareKey = (aKey: { missing: boolean; value: string }, bKey: { missing: boolean; value: string }) => {
      if (aKey.missing !== bKey.missing) {
        return aKey.missing ? 1 : -1
      }
      if (aKey.value === bKey.value) return 0
      return aKey.value.localeCompare(bKey.value)
    }

    const comparisons = [
      compareKey(normalizeKey(a?.distributorName), normalizeKey(b?.distributorName)),
      compareKey(normalizeKey(a?.vendorName), normalizeKey(b?.vendorName)),
      compareKey(normalizeKey(a?.opportunityName), normalizeKey(b?.opportunityName)),
      compareKey(normalizeKey(a?.productNameVendor), normalizeKey(b?.productNameVendor)),
      compareKey(normalizeKey(a?.revenueScheduleDate), normalizeKey(b?.revenueScheduleDate)),
      compareKey(normalizeKey(a?.revenueScheduleName), normalizeKey(b?.revenueScheduleName)),
      compareKey(normalizeKey(a?.id), normalizeKey(b?.id)),
    ]

    return comparisons.find(result => result !== 0) ?? 0
  }, [])

  const fetchRevenueSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '500',
        sort: 'revenueScheduleDate',
        direction: 'desc'
      })

      const response = await fetch(`/api/revenue-schedules?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.error ?? 'Unable to load revenue schedules'
        showError('Failed to load revenue schedules', message)
        setRevenueSchedules([])
        setFilteredRevenueSchedules([])
        return
      }

      const payload = await response.json().catch(() => ({ data: [] }))
      const data = Array.isArray(payload?.data) ? payload.data : []
      setRevenueSchedules(data)
      setFilteredRevenueSchedules(data)
    } catch (err) {
      console.error('Failed to fetch revenue schedules', err)
      showError('Failed to load revenue schedules', 'Please try again later.')
      setRevenueSchedules([])
      setFilteredRevenueSchedules([])
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    void fetchRevenueSchedules()
  }, [fetchRevenueSchedules])

  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    error: preferenceError,
    saving: preferenceSaving,
    pageSize: preferencePageSize,
    hasServerPreferences,
    hasUnsavedChanges,
    lastSaved,
    handleColumnsChange,
    handlePageSizeChange: persistPageSizePreference,
    saveChanges,
    saveChangesOnModalClose,
  } = useTablePreferences('revenue-schedules:list', revenueScheduleColumns)

  // Normalize default column visibility only on first load when there are
  // no saved preferences for this user/page.
  const [rsColumnsNormalized, setRsColumnsNormalized] = useState(false)
  useEffect(() => {
    if (rsColumnsNormalized || preferenceLoading) return
    if (!preferenceColumns || preferenceColumns.length === 0) return

    if (hasServerPreferences) {
      setRsColumnsNormalized(true)
      return
    }

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
  }, [preferenceColumns, preferenceLoading, handleColumnsChange, rsColumnsNormalized, hasServerPreferences])

  const measureTableArea = useCallback(() => {
    const node = tableAreaNodeRef.current
    if (!node || typeof window === 'undefined') {
      return
    }

    const rect = node.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
    if (viewportHeight <= 0) {
      return
    }

    const available = viewportHeight - rect.top - TABLE_BOTTOM_RESERVE
    if (!Number.isFinite(available)) {
      return
    }

    const nextHeight = Math.max(TABLE_MIN_BODY_HEIGHT, Math.floor(available))
    if (nextHeight !== tableBodyHeight) {
      setTableBodyHeight(nextHeight)
    }
  }, [tableBodyHeight])

  const tableAreaRef = useCallback(
    (node: HTMLDivElement | null) => {
      tableAreaNodeRef.current = node
      if (node) {
        window.requestAnimationFrame(() => {
          measureTableArea()
        })
      }
    },
    [measureTableArea],
  )

  useLayoutEffect(() => {
    measureTableArea()
  }, [measureTableArea])

  useEffect(() => {
    const handleResize = () => measureTableArea()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [measureTableArea])

  useEffect(() => {
    window.requestAnimationFrame(() => {
      measureTableArea()
    })
  }, [
    measureTableArea,
    revenueSchedules.length,
    selectedSchedules.length,
    loading,
    preferenceLoading,
    currentPage,
    pageSize,
  ])

  const handleSearch = (query: string) => {
    const trimmed = query.trim()
    setCurrentPage(1)
    if (!trimmed) {
      setFilteredRevenueSchedules(revenueSchedules)
      return
    }

    const q = trimmed.toLowerCase()
    const filtered = revenueSchedules.filter(schedule =>
      Object.values(schedule).some((value) => {
        let s = ''
        if (typeof value === 'string') s = value
        else if (typeof value === 'number' || typeof value === 'boolean') s = String(value)
        return s.toLowerCase().includes(q)
      })
    )
    setFilteredRevenueSchedules(filtered)
  }

  const handleSort = useCallback((columnId: string, direction: 'asc' | 'desc') => {
    setSortConfig({ columnId, direction })
    setCurrentPage(1)
  }, [])

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

  const handleSelectSchedule = useCallback((scheduleId: string, selected: boolean) => {
    if (selected) {
      setSelectedSchedules(prev => [...prev, scheduleId])
    } else {
      setSelectedSchedules(prev => prev.filter(id => id !== scheduleId))
    }
  }, [])

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedSchedules(filteredByStatusAndColumns.map(schedule => String(schedule.id)))
    } else {
      setSelectedSchedules([])
    }
  }

  const handleBulkDeleteSchedules = useCallback(() => {
    if (selectedSchedules.length === 0) {
      showError('No items selected', 'Select at least one item to delete.')
      return
    }
    const rows = selectedScheduleRows
    if (!rows.length) {
      showError('Items not available', 'Unable to locate the selected items. Refresh and try again.')
      return
    }
    openStatusModal(rows, 'delete')
  }, [openStatusModal, selectedScheduleRows, selectedSchedules.length, showError])

  const handleBulkExportSchedules = useCallback(() => {
    if (selectedSchedules.length === 0) {
      showError('No items selected', 'Select at least one item to export.')
      return
    }
    const rows = selectedScheduleRows
    if (rows.length === 0) {
      showError('Items not available', 'Unable to locate the selected items. Refresh and try again.')
      return
    }
    const headers = [
      'Distributor Name',
      'Vendor Name',
      'Account Name',
      'Opportunity Name',
      'Vendor - Product Name',
      'Schedule Date',
      'Revenue Schedule',
      'Quantity',
      'Price Each',
      'Expected Usage Gross',
      'Expected Usage Adjustment',
      'Expected Usage Net',
      'Actual Usage',
      'Usage Balance',
      'Expected Commission Gross',
      'Expected Commission Adjustment',
      'Expected Commission Net',
      'Actual Commission',
      'Commission Difference',
      'Expected Commission Rate %',
      'Actual Commission Rate %',
      'Commission Rate Difference',
      'Status',
    ]
    const escapeCsv = (value: string | null | undefined) => {
      if (value === null || value === undefined) return ''
      const sv = String(value)
      return (sv.includes('"') || sv.includes(',') || sv.includes('\n') || sv.includes('\r')) ? `"${sv.replace(/"/g, '""')}"` : sv
    }
    const isBlank = (value: unknown) => {
      if (typeof value !== 'string') return true
      return isBlankDisplay(value)
    }
    const lines = [
      headers.join(','),
      ...rows.map(row => {
        const rawGross = row.expectedUsageGross ?? row.expectedUsage
        const rawAdj = row.expectedUsageAdjustment ?? row.usageAdjustment
        const rawActualUsage = row.actualUsage
        const computed = computeRevenueScheduleMetricsFromDisplay({
          quantity: row.quantity,
          priceEach: row.priceEach,
          expectedUsageGross: rawGross,
          expectedUsage: row.expectedUsage,
          expectedUsageAdjustment: rawAdj,
          expectedUsageNet: row.expectedUsageNet,
          actualUsage: rawActualUsage,
          expectedCommissionGross: row.expectedCommissionGross,
          expectedCommissionAdjustment: row.expectedCommissionAdjustment,
          expectedCommissionNet: row.expectedCommissionNet,
          actualCommission: row.actualCommission,
          expectedCommissionRatePercent: (row as any).expectedCommissionRatePercent ?? null,
          actualCommissionRatePercent: (row as any).actualCommissionRatePercent ?? null,
        })
        const hasNetInputs = !isBlank(rawGross) || !isBlank(rawAdj)
        const hasActualUsage = !isBlank(rawActualUsage)
        const hasCommissionInputs = !isBlank(row.expectedCommissionNet) || !isBlank(row.actualCommission)
        const net = computed.expectedUsageNet ?? 0
        const usageBalance = computed.usageDifference ?? 0
        const commissionDiff = computed.commissionDifference ?? 0
        const expectedRateFraction = computed.expectedRateFraction
        const actualRateFraction = computed.actualRateFraction
        const rateDiffFraction = computed.commissionRateDifferenceFraction
        const fmtPct = (f: number | null) => f === null ? '-' : `${(f * 100).toFixed(2)}%`

        return [
          row.distributorName,
          row.vendorName,
          row.accountName,
          row.opportunityName,
          row.productNameVendor,
          row.revenueScheduleDate,
          row.revenueScheduleName ?? row.revenueSchedule,
          row.quantity,
          row.priceEach,
          rawGross,
          rawAdj,
          hasNetInputs ? formatCurrency(net) : '-',
          rawActualUsage,
          (hasActualUsage || hasNetInputs) ? formatCurrency(usageBalance) : '-',
          row.expectedCommissionGross,
          row.expectedCommissionAdjustment,
          row.expectedCommissionNet,
          row.actualCommission,
          hasCommissionInputs ? formatCurrency(commissionDiff) : '-',
          fmtPct(expectedRateFraction),
          fmtPct(actualRateFraction),
          fmtPct(rateDiffFraction),
          row.scheduleStatus,
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
  }, [selectedSchedules.length, selectedScheduleRows, showError, showSuccess])

  const computeCloneDefaultDate = useCallback((rawDate?: string | null) => {
    const fallback = new Date()
    const base = rawDate ? new Date(rawDate) : fallback
    if (Number.isNaN(base.getTime())) {
      return fallback.toISOString().slice(0, 10)
    }
    const draft = new Date(base)
    if (draft.getDate() === 1) {
      draft.setDate(1)
    } else {
      draft.setMonth(draft.getMonth() + 1, 1)
    }
    draft.setHours(0, 0, 0, 0)
    return draft.toISOString().slice(0, 10)
  }, [])

  const handleCloneSchedule = useCallback(() => {
    if (selectedSchedules.length !== 1) {
      showError('Select a single schedule', 'Choose exactly one revenue schedule to copy/extend.')
      return
    }
    const targetId = selectedSchedules[0]
    const targetRow = selectedScheduleRows.find(row => row.id === targetId)
    if (!targetRow) {
      showError('Schedule unavailable', 'Unable to identify the selected schedule. Refresh and try again.')
      return
    }
    const defaultDate = computeCloneDefaultDate(targetRow.revenueScheduleDate)
    const quantityRaw =
      typeof targetRow.quantityRaw === 'number' && Number.isFinite(targetRow.quantityRaw)
        ? targetRow.quantityRaw
        : parseDisplayNumber(targetRow.quantity)
    const unitPriceRaw =
      typeof targetRow.unitPriceRaw === 'number' && Number.isFinite(targetRow.unitPriceRaw)
        ? targetRow.unitPriceRaw
        : parseDisplayNumber(targetRow.priceEach)
    const usageAdjustmentRaw =
      typeof targetRow.usageAdjustmentRaw === 'number' && Number.isFinite(targetRow.usageAdjustmentRaw)
        ? targetRow.usageAdjustmentRaw
        : parseDisplayNumber(targetRow.expectedUsageAdjustment ?? targetRow.usageAdjustment)
    setCloneSourceSchedule({
      scheduleNumber: targetRow.revenueScheduleName ?? targetRow.revenueSchedule ?? null,
      scheduleDate: targetRow.revenueScheduleDate ?? null,
      quantity: quantityRaw ?? null,
      unitPrice: unitPriceRaw ?? null,
      usageAdjustment: usageAdjustmentRaw ?? null,
      commissionRatePercent:
        typeof targetRow.expectedCommissionRatePercent === 'number' && Number.isFinite(targetRow.expectedCommissionRatePercent)
          ? targetRow.expectedCommissionRatePercent
          : null,
    })
    setCloneTargetId(targetId)
    setCloneDefaultDate(defaultDate)
    setCloneModalOpen(true)
  }, [computeCloneDefaultDate, parseDisplayNumber, selectedScheduleRows, selectedSchedules, showError])

  const handleCloneModalClose = useCallback(() => {
    setCloneModalOpen(false)
    setCloneTargetId(null)
    setCloneSourceSchedule(undefined)
  }, [])
  
  const handleConfirmCloneSchedule = useCallback(async (params: CloneParameters) => {
      if (!cloneTargetId) {
        showError('Schedule unavailable', 'Unable to identify the selected schedule. Refresh and try again.')
        return
      }

      setBulkActionBusy(true)
      try {
        const response = await fetch(`/api/revenue-schedules/${encodeURIComponent(cloneTargetId)}/clone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...params, mode: 'copyExtend' }),
        })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const message = payload?.error ?? 'Unable to clone the selected revenue schedule.'
        throw new Error(message)
      }

      const newId: string | undefined = payload?.data?.id ?? payload?.id
      if (!newId) {
        throw new Error('Clone completed but no schedule id was returned.')
      }

      handleCloneModalClose()
      handleCloneModalClose()
      showSuccess('Schedule copied/extended', 'Opening the new schedule so you can review it.')
      router.push(`/revenue-schedules/${encodeURIComponent(newId)}`)
    } catch (err) {
      console.error('Failed to copy/extend revenue schedule', err)
      const message = err instanceof Error ? err.message : 'Unable to copy/extend revenue schedule.'
      showError('Copy/Extend failed', message)
    } finally {
      setBulkActionBusy(false)
    }
  }, [cloneTargetId, handleCloneModalClose, router, showError, showSuccess])

  const handleDeleteRow = useCallback((scheduleId: string) => {
    const targetRow = revenueSchedules.find(row => row.id === scheduleId)
    if (!targetRow) {
      showError('Schedule unavailable', 'Unable to locate the selected schedule. Refresh and try again.')
      return
    }
    openStatusModal([targetRow], 'delete')
  }, [openStatusModal, revenueSchedules, showError])

  // Pagination handlers
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  useEffect(() => {
    if (!preferencePageSize) return
    const normalized = normalizePageSize(preferencePageSize)
    if (normalized !== pageSize) {
      setPageSize(normalized)
      setCurrentPage(1)
    }
  }, [preferencePageSize, pageSize])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    const normalized = normalizePageSize(newPageSize)
    setPageSize(normalized)
    setCurrentPage(1) // Reset to first page when page size changes
    void persistPageSizePreference(normalized)
  }, [persistPageSizePreference])

  const revenueEditableColumnsMeta = useMemo(
    () =>
      ({
        quantity: { label: 'Quantity', decimals: 0, type: 'number' as const },
        priceEach: { label: 'Price Each', decimals: 2, type: 'currency' as const },
        expectedUsageAdjustment: { label: 'Expected Usage Adjustment', decimals: 2, type: 'currency' as const },
        expectedCommissionRatePercent: { label: 'Expected Commission Rate %', decimals: 2, type: 'percent' as const },
      }),
    [],
  )

  const normalizeRevenueEditValue = useCallback(
    (columnId: RevenueEditableColumnId, value: number) => {
      if (!Number.isFinite(value)) return null
      switch (columnId) {
        case 'quantity':
          return Math.max(0, Math.round(value))
        case 'priceEach':
        case 'expectedUsageAdjustment':
        case 'expectedCommissionRatePercent':
          return Number(Math.max(0, value).toFixed(revenueEditableColumnsMeta[columnId].decimals))
        default:
          return null
      }
    },
    [revenueEditableColumnsMeta],
  )

  const getEditableDisplayValue = useCallback(
    (columnId: RevenueEditableColumnId, row: any): number => {
      if (!row) return 0
      if (columnId === 'quantity') {
        if (typeof row.quantityRaw === 'number' && Number.isFinite(row.quantityRaw)) {
          return row.quantityRaw
        }
        const parsed = parseDisplayNumber(row.quantity)
        return parsed ?? 0
      }
      if (columnId === 'priceEach') {
        if (typeof row.unitPriceRaw === 'number' && Number.isFinite(row.unitPriceRaw)) {
          return row.unitPriceRaw
        }
        const parsed = parseDisplayNumber(row.priceEach)
        return parsed ?? 0
      }
      if (columnId === 'expectedUsageAdjustment') {
        if (typeof row.usageAdjustmentRaw === 'number' && Number.isFinite(row.usageAdjustmentRaw)) {
          return row.usageAdjustmentRaw
        }
        return parseCurrency(row.expectedUsageAdjustment ?? row.usageAdjustment)
      }
      // expectedCommissionRatePercent – parse from display string like "5.00%"
      const raw = row.expectedCommissionRatePercent
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return raw
      }
      if (typeof raw === 'string') {
        const trimmed = raw.trim()
        if (!trimmed || trimmed === '-') return 0
        const numeric = trimmed.replace(/[^0-9.\-]/g, '')
        const parsed = Number(numeric || '0')
        return Number.isFinite(parsed) ? parsed : 0
      }
      return 0
    },
    [parseDisplayNumber],
  )

  const handleRevenueInlineChange = useCallback(
    (rowId: string, columnId: RevenueEditableColumnId, nextValue: number, rect: DOMRect | null) => {
      const normalised = normalizeRevenueEditValue(columnId, nextValue)
      if (normalised === null) {
        return
      }

      if (selectedSchedules.length >= 1 && selectedSchedules.includes(rowId) && rect) {
        setRevenueBulkPrompt({
          columnId,
          label: revenueEditableColumnsMeta[columnId].label,
          value: normalised,
          rowId,
          selectedCount: selectedSchedules.length,
          anchor: {
            top: rect.bottom + 8,
            left: rect.right + 12,
          },
        })
      } else {
        setRevenueBulkPrompt(null)
      }
    },
    [normalizeRevenueEditValue, revenueEditableColumnsMeta, selectedSchedules],
  )

    const handleRevenueApplyFillDown = useCallback(
      async (effectiveDate: string) => {
        if (!revenueBulkPrompt || selectedSchedules.length < 1) {
          return
        }
  
        const columnId = revenueBulkPrompt.columnId
        const payload: Record<string, number> = {}
      if (columnId === 'quantity') payload.quantity = revenueBulkPrompt.value
      if (columnId === 'priceEach') payload.priceEach = revenueBulkPrompt.value
      if (columnId === 'expectedUsageAdjustment') payload.expectedUsageAdjustment = revenueBulkPrompt.value
      if (columnId === 'expectedCommissionRatePercent') payload.expectedCommissionRatePercent = revenueBulkPrompt.value

      if (Object.keys(payload).length === 0) {
        return
      }

      setRevenueBulkApplying(true)
      try {
        const response = await fetch('/api/revenue-schedules/bulk-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: selectedSchedules,
            patch: payload,
            effectiveDate,
          }),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) {
          const message = body?.error ?? 'Unable to apply bulk update'
          throw new Error(message)
        }
        const updatedCount: number = body?.updated ?? selectedSchedules.length
        showSuccess(
          `Applied to ${updatedCount} schedule${updatedCount === 1 ? '' : 's'}`,
          `${revenueBulkPrompt.label} updated across the selected schedules.`,
        )
        setRevenueBulkPrompt(null)
        await fetchRevenueSchedules()
      } catch (error) {
        console.error('Failed to apply bulk update for revenue schedules', error)
        const message = error instanceof Error ? error.message : 'Unable to apply bulk update'
        showError('Bulk update failed', message)
      } finally {
        setRevenueBulkApplying(false)
      }
    },
    [fetchRevenueSchedules, revenueBulkPrompt, selectedSchedules, showError, showSuccess],
  )

  // Apply search, status, column filters, then sort
  const filteredByStatusAndColumns = useMemo(() => {
    let next = activeFilter === 'active' ? filteredRevenueSchedules.filter(r => r.active) : [...filteredRevenueSchedules]

    if (statusQuickFilter !== 'all') {
      next = next.filter(row => {
        const rawStatus = String((row as any).scheduleStatus ?? '').toLowerCase()
        const gross = parseCurrency((row as any).expectedUsageGross ?? (row as any).expectedUsage)
        const adj = parseCurrency((row as any).expectedUsageAdjustment ?? (row as any).usageAdjustment)
        const net = gross + adj
        const isDispute = rawStatus.includes('dispute') || Boolean((row as any).inDispute)
        const isOpen = rawStatus === 'open' ? true : rawStatus === 'reconciled' ? false : Math.abs(net) > 0.0001
        const isReconciled = rawStatus === 'reconciled' ? true : rawStatus === 'open' ? false : !isOpen
        if (statusQuickFilter === 'open') return isOpen
        if (statusQuickFilter === 'reconciled') return isReconciled
        if (statusQuickFilter === 'in_dispute') return isDispute
        return true
      })
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

    if (sortConfig) {
      const { columnId, direction } = sortConfig
      const factor = direction === 'asc' ? 1 : -1
      next = [...next].sort((a, b) => {
        const aNormalized = normalizeSortValue((a as any)?.[columnId])
        const bNormalized = normalizeSortValue((b as any)?.[columnId])

        if (aNormalized.type === 'number' && bNormalized.type === 'number') {
          if (aNormalized.value === bNormalized.value) return 0
          return aNormalized.value < bNormalized.value ? -1 * factor : 1 * factor
        }

        const aValue = String(aNormalized.value ?? '')
        const bValue = String(bNormalized.value ?? '')
        return aValue.localeCompare(bValue) * factor
      })
    } else {
      next = [...next].sort(compareDefaultRevenueScheduleSort)
    }

    return next
  }, [
    activeFilter,
    compareDefaultRevenueScheduleSort,
    columnFilters,
    endDate,
    filteredRevenueSchedules,
    normalizeSortValue,
    sortConfig,
    startDate,
    statusQuickFilter,
  ])

  // Add computed columns (Expected Usage Net, Usage Balance, Commission Difference)
  const withComputed = useMemo(() => {
    const isBlank = (value: unknown) => {
      if (typeof value !== 'string') return true
      return isBlankDisplay(value)
    }

    return filteredByStatusAndColumns.map(row => {
      const rawGross = (row as any).expectedUsageGross ?? (row as any).expectedUsage
      const rawAdj = (row as any).expectedUsageAdjustment ?? (row as any).usageAdjustment
      const rawActualUsage = (row as any).actualUsage
      const rawExpectedCommission = (row as any).expectedCommissionNet
      const rawActualCommission = (row as any).actualCommission
      const hasNetInputs = !isBlank(rawGross) || !isBlank(rawAdj)
      const hasActualUsage = !isBlank(rawActualUsage)
      const hasCommissionInputs = !isBlank(rawExpectedCommission) || !isBlank(rawActualCommission)

      const computed = computeRevenueScheduleMetricsFromDisplay({
        expectedUsageGross: rawGross,
        expectedUsage: (row as any).expectedUsage,
        expectedUsageAdjustment: rawAdj,
        expectedUsageNet: (row as any).expectedUsageNet,
        actualUsage: rawActualUsage,
        expectedCommissionGross: (row as any).expectedCommissionGross,
        expectedCommissionAdjustment: (row as any).expectedCommissionAdjustment,
        expectedCommissionNet: rawExpectedCommission,
        actualCommission: rawActualCommission,
        expectedCommissionRatePercent: null,
        actualCommissionRatePercent: null,
      })

      const netValue = computed.expectedUsageNet ?? 0
      const netDisplay = hasNetInputs ? formatCurrency(netValue) : '-'

      const usageBalanceValue = computed.usageDifference ?? 0
      const usageBalanceDisplay = hasActualUsage || hasNetInputs ? formatCurrency(usageBalanceValue) : '-'

      const commissionDifferenceValue = computed.commissionDifference ?? 0
      const commissionDifferenceDisplay = hasCommissionInputs ? formatCurrency(commissionDifferenceValue) : '-'

      const expectedRateDisplay = computed.expectedRateFraction !== null ? formatPercent(computed.expectedRateFraction) : '-'
      const actualRateDisplay = computed.actualRateFraction !== null ? formatPercent(computed.actualRateFraction) : '-'
      const rateDiffDisplay =
        computed.commissionRateDifferenceFraction !== null ? formatPercent(computed.commissionRateDifferenceFraction) : '-'

      return {
        ...row,
        expectedUsageGross: isBlank(rawGross) ? (row as any).expectedUsageGross ?? '-' : rawGross,
        expectedUsageAdjustment: isBlank(rawAdj) ? (row as any).expectedUsageAdjustment ?? '-' : rawAdj,
        expectedUsageNet: netDisplay,
        usageBalance: usageBalanceDisplay,
        commissionDifference: commissionDifferenceDisplay,
        expectedCommissionRatePercent: expectedRateDisplay,
        actualCommissionRatePercent: actualRateDisplay,
        commissionRateDifference: rateDiffDisplay,
      }
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
    const renderEditableCell = (columnId: RevenueEditableColumnId, label: string) => {
      return function EditableCell(_: unknown, row: any) {
        let spanRef: HTMLSpanElement | null = null
        const displayValue = getEditableDisplayValue(columnId, row)

        const commit = () => {
          if (!spanRef) return
          const rawText = spanRef.innerText.trim()
          if (!rawText) return
          const sanitised = rawText.replace(/[^0-9.\-]/g, '')
          const parsed = sanitised === '' ? NaN : Number(sanitised)
          if (Number.isNaN(parsed)) return
          const rowId = String(row.id)
          handleRevenueInlineChange(rowId, columnId, parsed, spanRef.getBoundingClientRect())
        }

        const formattedForDisplay = () => {
          if (!Number.isFinite(displayValue)) return ''

          const { decimals, type } = revenueEditableColumnsMeta[columnId]

          if (type === 'currency') {
            return displayValue.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })
          }

          if (type === 'percent') {
            const normalized = displayValue > 1 ? displayValue / 100 : displayValue
            return normalized.toLocaleString('en-US', {
              style: 'percent',
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })
          }

          return displayValue.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        }

        return (
          <span
            ref={node => {
              spanRef = node
            }}
            contentEditable
            suppressContentEditableWarning
            data-disable-row-click="true"
            className="block min-w-0 truncate text-sm text-gray-900 focus:outline-none"
            onFocus={() => {
              if (!spanRef) return
              const rowId = String(row.id)
              if (selectedSchedules.length >= 1 && selectedSchedules.includes(rowId)) {
                setRevenueBulkPrompt({
                  columnId,
                  label,
                  value: displayValue,
                  rowId,
                  selectedCount: selectedSchedules.length,
                  anchor: {
                    top: spanRef.getBoundingClientRect().bottom + 8,
                    left: spanRef.getBoundingClientRect().right + 12,
                  },
                })
              } else {
                setRevenueBulkPrompt(null)
              }
            }}
            onBlur={commit}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commit()
              }
            }}
            aria-label={`Edit ${label}`}
          >
            {formattedForDisplay()}
          </span>
        )
      }
    }

    return preferenceColumns.map((column) => {
      if (column.id === 'multi-action') {
        return {
          ...column,
          render: (_: unknown, row: any) => {
            const rowId = String(row.id)
            const checked = selectedSchedules.includes(rowId)
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                {/* Checkbox */}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`Select revenue schedule ${rowId}`}
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectSchedule(rowId, !checked)
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Check className="h-3 w-3" aria-hidden="true" />
                </button>

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
      if (column.id === 'revenueScheduleName') {
        return {
          ...column,
          render: (value: unknown, row: any) => {
            const scheduleCode = row.revenueScheduleName || row.revenueSchedule || row.id
            const displayValue = typeof value === 'string' && value.trim().length > 0
              ? value
              : String(scheduleCode ?? '')
            const targetId = String(row.id)

            return (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  router.push(`/revenue-schedules/${encodeURIComponent(targetId)}`)
                }}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 transition hover:text-primary-700"
                data-disable-row-click="true"
              >
                <span>{displayValue || 'View'}</span>
              </button>
            )
          }
        }
      }

      if (column.id === 'distributorName') {
        return {
          ...column,
          render: (value: unknown, row: any) => {
            const displayValue =
              value === null || value === undefined ? '--' : typeof value === 'string' ? value : String(value)

            if (row.distributorId) {
              return (
                <Link
                  href={`/accounts/${row.distributorId}`}
                  className="text-primary-700 hover:text-primary-800 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {displayValue}
                </Link>
              )
            }

            return <span>{displayValue}</span>
          },
        }
      }

      if (column.id === 'vendorName') {
        return {
          ...column,
          render: (value: unknown, row: any) => {
            const displayValue =
              value === null || value === undefined ? '--' : typeof value === 'string' ? value : String(value)

            if (row.vendorId) {
              return (
                <Link
                  href={`/accounts/${row.vendorId}`}
                  className="text-primary-700 hover:text-primary-800 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {displayValue}
                </Link>
              )
            }

            return <span>{displayValue}</span>
          },
        }
      }

      if (column.id === 'accountName') {
        return {
          ...column,
          render: (value: unknown, row: any) => {
            const displayValue =
              value === null || value === undefined ? '--' : typeof value === 'string' ? value : String(value)

            if (row.accountId) {
              return (
                <Link
                  href={`/accounts/${row.accountId}`}
                  className="text-primary-700 hover:text-primary-800 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {displayValue}
                </Link>
              )
            }

            return <span>{displayValue}</span>
          },
        }
      }

      if (column.id === 'opportunityName') {
        return {
          ...column,
          render: (value: unknown, row: any) => {
            const displayValue =
              value === null || value === undefined ? '--' : typeof value === 'string' ? value : String(value)

            if (row.opportunityId) {
              return (
                <Link
                  href={`/opportunities/${row.opportunityId}`}
                  className="text-primary-700 hover:text-primary-800 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {displayValue}
                </Link>
              )
            }

            return <span>{displayValue}</span>
          },
        }
      }

      if (
        column.id === 'quantity' ||
        column.id === 'priceEach' ||
        column.id === 'expectedUsageAdjustment' ||
        column.id === 'expectedCommissionRatePercent'
      ) {
        return {
          ...column,
          render: renderEditableCell(column.id as RevenueEditableColumnId, column.label),
        }
      }

      return column
    })
  }, [
    handleDeleteRow,
    handleRevenueInlineChange,
    handleSelectSchedule,
    getEditableDisplayValue,
    preferenceColumns,
    revenueEditableColumnsMeta,
    router,
    selectedSchedules,
    setRevenueBulkPrompt,
  ])

  const revenueBulkDefaultEffectiveDate = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const revenueBulkPromptValueLabel = useMemo(() => {
    if (!revenueBulkPrompt) {
      return ''
    }
    const meta = revenueEditableColumnsMeta[revenueBulkPrompt.columnId]
    const value = revenueBulkPrompt.value
    if (meta.type === 'currency') {
      return formatCurrency(value)
    }
    if (meta.type === 'percent') {
      return formatPercent(value / 100)
    }
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: meta.decimals,
    })
  }, [revenueBulkPrompt, revenueEditableColumnsMeta])
  
  // Update schedules data to include selection state
  const schedulesWithSelection = paginatedRevenueSchedules.map(schedule => ({
    ...schedule,
    checkbox: selectedSchedules.includes(String(schedule.id))
  }))

  const revenueBulkActions = useMemo<BulkActionsGridProps>(() => ({
    selectedCount: selectedSchedules.length,
    entityName: 'revenue schedules',
    isBusy: bulkActionBusy,
    actions: [
      {
        key: 'copy-extend',
        label: 'Copy/Extend',
        icon: Copy,
        tone: 'primary',
        onClick: handleCloneSchedule,
        tooltip: (count) => (count === 1 ? 'Copy/Extend this revenue schedule' : 'Select exactly one schedule to copy/extend'),
        disabled: selectedSchedules.length !== 1,
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: Trash2,
        tone: 'danger',
        tooltip: (count) => `Delete ${count} schedule${count === 1 ? '' : 's'}`,
        onClick: handleBulkDeleteSchedules,
      },
      {
        key: 'export',
        label: 'Export CSV',
        icon: Download,
        tone: 'info',
        tooltip: (count) => `Export ${count} schedule${count === 1 ? '' : 's'} to CSV`,
        onClick: handleBulkExportSchedules,
      },
    ],
  }), [bulkActionBusy, handleCloneSchedule, handleBulkDeleteSchedules, handleBulkExportSchedules, selectedSchedules.length])

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
            <StatusFilterDropdown
              value={statusQuickFilter}
              onChange={(value) => {
                setStatusQuickFilter(value)
                setCurrentPage(1)
              }}
            />
            <div className="flex items-center gap-1 text-sm">
              <span className="text-gray-600">Start</span>
              <div className="relative inline-block">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setCurrentPage(1) }}
                  className="rounded border border-gray-300 px-2 py-1 text-sm [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:opacity-0"
                  style={{ colorScheme: 'light' }}
                />
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-900">
                  {startDate || <span className="text-gray-400">YYYY-MM-DD</span>}
                </span>
              </div>
              <span className="text-gray-600">End</span>
              <div className="relative inline-block">
                <input
                  type="date"
                  value={endDate}
                  onChange={e => { setEndDate(e.target.value); setCurrentPage(1) }}
                  className="rounded border border-gray-300 px-2 py-1 text-sm [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:opacity-0"
                  style={{ colorScheme: 'light' }}
                />
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-900">
                  {endDate || <span className="text-gray-400">YYYY-MM-DD</span>}
                </span>
              </div>
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
        bulkActions={revenueBulkActions}
      />

      {(preferenceError) && (
        <div className="px-4 text-sm text-red-600">{preferenceError}</div>
      )}

      <div className="flex-1 min-h-0 p-4 pt-0 flex flex-col gap-4">
        <div ref={tableAreaRef} className="flex-1 min-h-0">
          <DynamicTable
            columns={tableColumns}
            data={schedulesWithSelection}
            onSort={handleSort}
            loading={tableLoading}
            emptyMessage="No revenue schedules found"
            onColumnsChange={handleColumnsChange}
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            selectedItems={selectedSchedules.map(String)}
            onItemSelect={(id, selected, row) => handleSelectSchedule(String(id), selected)}
            onSelectAll={handleSelectAll}
            autoSizeColumns={false}
            alwaysShowPagination
            maxBodyHeight={tableBodyHeight}
          />
        </div>
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

      <RevenueBulkApplyPanel
        isOpen={Boolean(revenueBulkPrompt)}
        selectedCount={selectedSchedules.length}
        fieldLabel={revenueBulkPrompt?.label ?? ''}
        valueLabel={revenueBulkPromptValueLabel}
        initialEffectiveDate={revenueBulkDefaultEffectiveDate}
        onClose={() => setRevenueBulkPrompt(null)}
        onSubmit={handleRevenueApplyFillDown}
        onBeforeSubmit={() => {
          if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
        }}
        isSubmitting={revenueBulkApplying}
        entityLabelSingular="revenue schedule"
        entityLabelPlural="revenue schedules"
      />

      <RevenueScheduleStatusModal
        isOpen={statusModalOpen}
        schedules={statusModalSchedules}
        defaultAction={statusModalDefaultAction}
        title="Manage Revenue Schedules"
        onClose={closeStatusModal}
        onSuccess={async () => {
          setSelectedSchedules([])
          await fetchRevenueSchedules()
        }}
      />

      <ToastContainer />
      <RevenueScheduleCloneModal
        isOpen={cloneModalOpen}
        defaultDate={cloneDefaultDate}
        submitting={bulkActionBusy}
        sourceSchedule={cloneSourceSchedule}
        onCancel={handleCloneModalClose}
        onConfirm={handleConfirmCloneSchedule}
      />
    </CopyProtectionWrapper>
  )
}
