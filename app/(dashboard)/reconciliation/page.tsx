'use client'

import { useState, useCallback, useMemo, useLayoutEffect, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ListHeader, FilterColumnOption, ColumnFilter } from '@/components/list-header'
import { DynamicTable, Column, PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { Check, X, Download, Trash2 } from 'lucide-react'
import { calculateMinWidth } from '@/lib/column-width-utils'
import { cn } from '@/lib/utils'
import { useToasts } from '@/components/toast'
import { TwoStageDeleteDialog } from '@/components/two-stage-delete-dialog'
import type { BulkActionsGridProps } from '@/components/bulk-actions-grid'

const TABLE_BOTTOM_RESERVE = 110
const TABLE_MIN_BODY_HEIGHT = 320

const normalizePageSize = (value: number): number => {
  if (!Number.isFinite(value)) return 100
  return Math.min(100, Math.max(1, Math.floor(value)))
}

const RECONCILIATION_DEFAULT_VISIBLE_COLUMN_IDS = new Set<string>([
  'accountName',
  'depositName',
  'distributorName',
  'vendorName',
  'month',
  'totalRevenue',
  'totalCommissions',
  'status'
])

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

// Helper function to format dates as YYYY-MM-DD
const formatDateYYYYMMDD = (value: string | Date | null | undefined): string => {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return String(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const reconciliationColumns: Column[] = [
  {
    id: 'multi-action',
    label: 'Select All',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Select All', type: 'multi-action', sortable: false }),
    maxWidth: 240,
    type: 'multi-action',
    accessor: 'select'
  },
  {
    id: 'accountName',
    label: 'Account Name',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Account Name', type: 'text', sortable: true }),
    maxWidth: 300,
    sortable: true,
    type: 'text',
    hideable: false,
    render: (value) => (
      <span className="block truncate min-w-0 text-blue-600 hover:text-blue-800 cursor-pointer font-medium" title={value}>
        {value}
      </span>
    )
  },
  {
    id: 'month',
    label: 'Period',
    width: 150,
    minWidth: calculateMinWidth({ label: 'Period', type: 'text', sortable: true }),
    maxWidth: 200,
    sortable: true,
    type: 'text',
    render: (value) => formatDateYYYYMMDD(value)
  },
  {
    id: 'totalRevenue',
    label: 'Total Revenue',
    width: 150,
    minWidth: calculateMinWidth({ label: 'Total Revenue', type: 'text', sortable: true }),
    maxWidth: 200,
    sortable: true,
    type: 'text'
  },
  {
    id: 'totalCommissions',
    label: 'Total Commission',
    width: 180,
    minWidth: calculateMinWidth({ label: 'Total Commission', type: 'text', sortable: true }),
    maxWidth: 220,
    sortable: true,
    type: 'text'
  },
  {
    id: 'status',
    label: 'Deposit Status',
    width: 120,
    minWidth: calculateMinWidth({ label: 'Deposit Status', type: 'text', sortable: true }),
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
  },
  {
    id: 'active',
    label: 'Active (Y/N)',
    width: 120,
    minWidth: calculateMinWidth({ label: 'Active (Y/N)', type: 'text', sortable: true }),
    maxWidth: 160,
    sortable: true,
    type: 'text',
    hidden: true,
    accessor: 'active',
    render: (value: any) => (value ? 'Yes' : 'No')
  },
  {
    id: 'reconciled',
    label: 'Reconciled (Y/N)',
    width: 140,
    minWidth: calculateMinWidth({ label: 'Reconciled (Y/N)', type: 'text', sortable: true }),
    maxWidth: 180,
    sortable: true,
    type: 'text',
    hidden: true,
    accessor: 'reconciled',
    render: (value: any) => (value ? 'Yes' : 'No')
  },
  // Deposit-level fields
  {
    id: 'createdBy',
    label: 'Created By',
    width: 180,
    minWidth: calculateMinWidth({ label: 'Created By', type: 'text', sortable: true }),
    maxWidth: 260,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'depositName',
    label: 'Deposit Name',
    width: 220,
    minWidth: calculateMinWidth({ label: 'Deposit Name', type: 'text', sortable: true }),
    maxWidth: 320,
    sortable: true,
    type: 'text',
    render: (value: any) => (
      <span className="block truncate min-w-0 text-gray-900" title={value}>
        {value}
      </span>
    )
  },
  {
    id: 'distributorName',
    label: 'Distributor Name',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Distributor Name', type: 'text', sortable: true }),
    maxWidth: 300,
    sortable: true,
    type: 'text'
  },
  {
    id: 'vendorName',
    label: 'Vendor Name',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Vendor Name', type: 'text', sortable: true }),
    maxWidth: 300,
    sortable: true,
    type: 'text'
  },
  {
    id: 'paymentDate',
    label: 'Payment Date',
    width: 150,
    minWidth: calculateMinWidth({ label: 'Payment Date', type: 'text', sortable: true }),
    maxWidth: 220,
    sortable: true,
    type: 'text',
    hidden: true,
    render: (value) => formatDateYYYYMMDD(value)
  },
  {
    id: 'totalItems',
    label: 'Total Items',
    width: 140,
    minWidth: calculateMinWidth({ label: 'Total Items', type: 'text', sortable: true }),
    maxWidth: 200,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'totalReconciledItems',
    label: 'Total Reconciled Items',
    width: 190,
    minWidth: calculateMinWidth({ label: 'Total Reconciled Items', type: 'text', sortable: true }),
    maxWidth: 260,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'totalUsage',
    label: 'Total Usage',
    width: 150,
    minWidth: calculateMinWidth({ label: 'Total Usage', type: 'text', sortable: true }),
    maxWidth: 220,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'paymentType',
    label: 'Payment Type',
    width: 150,
    minWidth: calculateMinWidth({ label: 'Payment Type', type: 'text', sortable: true }),
    maxWidth: 220,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'usageAllocated',
    label: 'Usage Allocated',
    width: 170,
    minWidth: calculateMinWidth({ label: 'Usage Allocated', type: 'text', sortable: true }),
    maxWidth: 240,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'usageUnallocated',
    label: 'Usage Unallocated',
    width: 180,
    minWidth: calculateMinWidth({ label: 'Usage Unallocated', type: 'text', sortable: true }),
    maxWidth: 250,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'commissionAllocated',
    label: 'Commission Allocated',
    width: 190,
    minWidth: calculateMinWidth({ label: 'Commission Allocated', type: 'text', sortable: true }),
    maxWidth: 260,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'commissionUnallocated',
    label: 'Commission Unallocated',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Commission Unallocated', type: 'text', sortable: true }),
    maxWidth: 270,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'depositItemsReconciledUnreconciled',
    label: 'Deposit Items Reconciled/Unreconciled',
    width: 260,
    minWidth: calculateMinWidth({ label: 'Deposit Items Reconciled/Unreconciled', type: 'text', sortable: true }),
    maxWidth: 340,
    sortable: true,
    type: 'text',
    hidden: true
  },
  // Line-item level fields surfaced for column chooser
  {
    id: 'accountIdVendor',
    label: 'Other - Account ID',
    width: 180,
    minWidth: calculateMinWidth({ label: 'Other - Account ID', type: 'text', sortable: true }),
    maxWidth: 260,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'lineItem',
    label: 'Line Item',
    width: 160,
    minWidth: calculateMinWidth({ label: 'Line Item', type: 'text', sortable: true }),
    maxWidth: 240,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'productNameVendor',
    label: 'Other - Product Name',
    width: 220,
    minWidth: calculateMinWidth({ label: 'Other - Product Name', type: 'text', sortable: true }),
    maxWidth: 320,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'usage',
    label: 'Usage',
    width: 130,
    minWidth: calculateMinWidth({ label: 'Usage', type: 'text', sortable: true }),
    maxWidth: 200,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'actualCommissionRatePercent',
    label: 'Actual Commission Rate %',
    width: 210,
    minWidth: calculateMinWidth({ label: 'Actual Commission Rate %', type: 'text', sortable: true }),
    maxWidth: 280,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'actualCommission',
    label: 'Actual Commission',
    width: 180,
    minWidth: calculateMinWidth({ label: 'Actual Commission', type: 'text', sortable: true }),
    maxWidth: 250,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'customerIdVendor',
    label: 'Other - Customer ID',
    width: 210,
    minWidth: calculateMinWidth({ label: 'Other - Customer ID', type: 'text', sortable: true }),
    maxWidth: 280,
    sortable: true,
    type: 'text',
    hidden: true
  },
  {
    id: 'orderIdVendor',
    label: 'Other - Order ID',
    width: 190,
    minWidth: calculateMinWidth({ label: 'Other - Order ID', type: 'text', sortable: true }),
    maxWidth: 260,
    sortable: true,
    type: 'text',
    hidden: true
  }
]

const filterOptions: FilterColumnOption[] = [
  { id: 'accountName', label: 'Account Name' },
  { id: 'depositName', label: 'Deposit Name' },
  { id: 'distributorName', label: 'Distributor Name' },
  { id: 'vendorName', label: 'Vendor Name' },
  { id: 'paymentDate', label: 'Payment Date' },
  { id: 'month', label: 'Period' },
  { id: 'totalRevenue', label: 'Total Revenue' },
  { id: 'totalCommissions', label: 'Total Commission' },
  { id: 'totalItems', label: 'Total Items' },
  { id: 'totalReconciledItems', label: 'Total Reconciled Items' },
  { id: 'totalUsage', label: 'Total Usage' },
  { id: 'usageAllocated', label: 'Usage Allocated' },
  { id: 'usageUnallocated', label: 'Usage Unallocated' },
  { id: 'commissionAllocated', label: 'Commission Allocated' },
  { id: 'commissionUnallocated', label: 'Commission Unallocated' },
  { id: 'status', label: 'Deposit Status' },
  { id: 'paymentType', label: 'Payment Type' },
  { id: 'accountIdVendor', label: 'Other - Account ID' },
  { id: 'lineItem', label: 'Line Item' },
  { id: 'productNameVendor', label: 'Other - Product Name' },
  { id: 'usage', label: 'Usage' },
  { id: 'actualCommissionRatePercent', label: 'Actual Commission Rate %' },
  { id: 'actualCommission', label: 'Actual Commission' },
  { id: 'customerIdVendor', label: 'Other - Customer ID' },
  { id: 'orderIdVendor', label: 'Other - Order ID' }
]

type DepositRow = {
  id: string
  accountId: string
  accountName: string
  month: string
  totalRevenue: string | number | null
  totalCommissions: string | number | null
  status: string
  reconciled: boolean
  reconciledAt?: string | null
  depositName?: string | null
  paymentDate?: string | null
  paymentType?: string | null
  totalItems?: number | null
  totalReconciledItems?: number | null
  totalUsage?: string | number | null
  usageAllocated?: string | number | null
  usageUnallocated?: string | number | null
  commissionAllocated?: string | number | null
  commissionUnallocated?: string | number | null
  itemsReconciled?: number | null
  itemsUnreconciled?: number | null
  distributorAccountId?: string | null
  distributorName?: string | null
  vendorAccountId?: string | null
  vendorName?: string | null
  createdByUserId?: string | null
  createdByUserName?: string | null
  createdByContactId?: string | null
  createdByContactName?: string | null
  createdAt?: string
  updatedAt?: string
  // local-only fields
  active?: boolean
}

export default function ReconciliationPage() {
  const { showSuccess, showError, ToastContainer } = useToasts()
  const router = useRouter()
  const [selectedMonth, setSelectedMonth] = useState<Date>(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )
  const [reconciliation, setReconciliation] = useState<DepositRow[]>([])
  const [loading, setLoading] = useState(false)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(100)
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([])
  const [activeFilter, setActiveFilter] = useState<'active' | 'inactive' | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortConfig, setSortConfig] = useState<{ columnId: string; direction: 'asc' | 'desc' } | null>(null)
  const [selectedReconciliations, setSelectedReconciliations] = useState<string[]>([])
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [reconciliationColumnsNormalized, setReconciliationColumnsNormalized] = useState(false)
  const [tableBodyHeight, setTableBodyHeight] = useState<number | undefined>(undefined)
  const [updatingReconciliationIds, setUpdatingReconciliationIds] = useState<Set<string>>(new Set())
  const tableAreaNodeRef = useRef<HTMLDivElement | null>(null)
  const selectedReconciliationRows = useMemo(() => {
    if (selectedReconciliations.length === 0) {
      return []
    }
    return reconciliation.filter(row => selectedReconciliations.includes(String(row.id)))
  }, [reconciliation, selectedReconciliations])
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }),
    []
  )

  // Load deposits from API
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadDeposits = async () => {
      const baseYear = selectedMonth.getFullYear()
      const baseMonth = selectedMonth.getMonth()
      const monthStart = new Date(baseYear, baseMonth, 1)
      const monthEnd = new Date(baseYear, baseMonth + 1, 0)
      const from = formatDateYYYYMMDD(monthStart)
      const to = formatDateYYYYMMDD(monthEnd)

      setLoading(true)
      try {
        const params = new URLSearchParams({
          from,
          to,
          pageSize: '500',
        })

        const response = await fetch(`/api/reconciliation/deposits?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        })

        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          console.error('Failed to load deposits', payload)
          return
        }

        if (cancelled) {
          return
        }

        const rows: DepositRow[] = (payload?.data ?? []).map((row: any) => ({
          ...row,
          // Ensure we always have an active flag for toggles; real persistence can come later
          active: typeof row.active === 'boolean' ? row.active : true,
        }))

        setReconciliation(rows)
      } catch (error) {
        if (cancelled) {
          return
        }
        console.error('Error loading deposits', error)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDeposits()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedMonth])

  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    error: preferenceError,
    saving: preferenceSaving,
    pageSize: preferencePageSize,
    handlePageSizeChange: persistPageSizePreference,
    hasServerPreferences,
    hasUnsavedChanges,
    lastSaved,
    handleColumnsChange,
    handleHiddenColumnsChange,
    saveChanges,
    saveChangesOnModalClose,
  } = useTablePreferences("reconciliation:list", reconciliationColumns)

  // Normalize column visibility on first load only when there are no
  // saved preferences for this user/page.
  useEffect(() => {
    if (reconciliationColumnsNormalized) {
      return
    }
    if (preferenceLoading) {
      return
    }
    if (!preferenceColumns || preferenceColumns.length === 0) {
      return
    }

    if (hasServerPreferences) {
      setReconciliationColumnsNormalized(true)
      return
    }

    const normalized = preferenceColumns.map(column => {
      if (column.id === 'multi-action') {
        return column
      }

      if (RECONCILIATION_DEFAULT_VISIBLE_COLUMN_IDS.has(column.id)) {
        return column.hidden ? { ...column, hidden: false } : column
      }

      return column.hidden === true ? column : { ...column, hidden: true }
    })

    const changed = normalized.some((column, index) => column.hidden !== preferenceColumns[index].hidden)

    if (changed) {
      handleColumnsChange(normalized)
    }

    setReconciliationColumnsNormalized(true)
  }, [preferenceColumns, preferenceLoading, handleColumnsChange, reconciliationColumnsNormalized, hasServerPreferences])

  // Measure table area for height calculation
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
    [measureTableArea]
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
    reconciliation.length,
    selectedReconciliations.length,
    loading,
    preferenceLoading,
    currentPage,
    pageSize,
  ])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setCurrentPage(1) // Reset to first page on search
  }, [])

  const handleSort = useCallback((columnId: string, direction: 'asc' | 'desc') => {
    setSortConfig({ columnId, direction })
  }, [])

  const handleRowClick = useCallback((record: any) => {
    const depositId = record?.id
    if (!depositId) {
      return
    }

    router.push(`/reconciliation/${encodeURIComponent(String(depositId))}`)
  }, [router])

  const handleStatusFilterChange = useCallback((filter: string) => {
    if (filter === 'active') {
      setActiveFilter('active')
    } else if (filter === 'inactive') {
      setActiveFilter('inactive')
    } else {
      setActiveFilter('all')
    }
    setCurrentPage(1) // Reset to first page on filter change
  }, [])

  const handleColumnFilters = useCallback((filters: ColumnFilter[]) => {
    setColumnFilters(filters)
    setCurrentPage(1) // Reset to first page on filter change
  }, [])

  const handleReconciliationSelect = useCallback((reconciliationId: string, selected: boolean) => {
    setSelectedReconciliations((previous) => {
      if (selected) {
        if (previous.includes(reconciliationId)) {
          return previous
        }
        return [...previous, reconciliationId]
      }

      if (!previous.includes(reconciliationId)) {
        return previous
      }

      return previous.filter((id) => id !== reconciliationId)
    })
  }, [])

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedReconciliations(reconciliation.map((record) => String(record.id)))
      return
    }
    setSelectedReconciliations([])
  }, [reconciliation])

  const bulkDeleteEntities = useMemo(
    () =>
      selectedReconciliationRows.map(row => ({
        id: String(row.id),
        name: row.depositName ?? String(row.id),
        subtitle: `${row.accountName ?? '-'} • ${formatDateYYYYMMDD(row.month ?? '')}`,
      })),
    [selectedReconciliationRows],
  )

  const handleOpenBulkDeleteDialog = useCallback(() => {
    if (selectedReconciliations.length === 0) {
      showError('No records selected', 'Select at least one deposit to delete.')
      return
    }

    const blocked = selectedReconciliationRows.filter(row => row.reconciled || row.status === 'Completed')
    if (blocked.length > 0) {
      showError(
        'Delete blocked',
        'Finalized deposits cannot be deleted. Unselect finalized deposits and try again.',
      )
      return
    }

    setShowBulkDeleteDialog(true)
  }, [selectedReconciliations.length, selectedReconciliationRows, showError])

  const deleteDeposit = useCallback(async (depositId: string) => {
    const response = await fetch(`/api/reconciliation/deposits/${encodeURIComponent(depositId)}`, {
      method: 'DELETE',
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(payload?.error || 'Unable to delete deposit')
    }
  }, [])

  const handleBulkPermanentDelete = useCallback(
    async (entities: { id: string; name: string }[]) => {
      if (!entities.length) {
        return { success: false, error: 'No deposits selected.' }
      }

      try {
        const ids = entities.map(entity => entity.id)
        for (const id of ids) {
          await deleteDeposit(id)
        }

        const idSet = new Set(ids)
        setReconciliation(prev => prev.filter(record => !idSet.has(String(record.id))))
        setSelectedReconciliations([])
        showSuccess(
          `Deleted ${ids.length} deposit${ids.length === 1 ? '' : 's'}`,
          'The deposits and their allocations were removed.',
        )

        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unable to delete selected deposits' }
      }
    },
    [deleteDeposit, showSuccess],
  )

  const handleBulkExportReconciliations = useCallback(() => {
    if (selectedReconciliationRows.length === 0) {
      showError('No records selected', 'Select at least one reconciliation to export.')
      return
    }

    const headers = [
      'Deposit Name',
      'Account Name',
      'Distributor',
      'Vendor',
      'Period',
      'Total Revenue',
      'Total Commission',
      'Status'
    ]

    const escapeCsv = (value: unknown) => {
      if (value === null || value === undefined) {
        return ''
      }
      const stringValue = String(value)
      return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue
    }

    const lines = [
      headers.join(','),
      ...selectedReconciliationRows.map(row => [
        row.depositName ?? row.id,
        row.accountName ?? '-',
        row.distributorName ?? '-',
        row.vendorName ?? '-',
        row.month ?? '',
        currencyFormatter.format(Number(row.totalRevenue ?? 0)),
        currencyFormatter.format(Number(row.totalCommissions ?? 0)),
        row.status ?? (row.active ? 'Active' : 'Inactive')
      ].map(escapeCsv).join(','))
    ]

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0]
    link.href = url
    link.download = `reconciliation-export-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    showSuccess(
      `Exported ${selectedReconciliationRows.length} record${selectedReconciliationRows.length === 1 ? '' : 's'}`,
      'Check your downloads for the CSV file.'
    )
  }, [currencyFormatter, selectedReconciliationRows, showError, showSuccess])

  const handleToggle = useCallback((row: any, columnId: string, value: boolean) => {
    const rowId = String(row.id)

    // Mark as updating
    setUpdatingReconciliationIds(prev => new Set(prev).add(rowId))

    // Simulate async update (in real app, this would be an API call)
    setTimeout(() => {
      // Update the reconciliation data when toggle changes
      setReconciliation(prev => prev.map(record => {
        if (String(record.id) === rowId) {
          if (columnId === 'active') {
            return { ...record, active: value }
          } else if (columnId === 'reconciled') {
            return { ...record, reconciled: value }
          }
        }
        return record
      }))

      // Remove updating state
      setUpdatingReconciliationIds(prev => {
        const next = new Set(prev)
        next.delete(rowId)
        return next
      })
    }, 300)
  }, [])

  // Pagination handlers
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
  const normalized = normalizePageSize(newPageSize)
  setPageSize(normalized)
  setCurrentPage(1) // Reset to first page when page size changes
  void persistPageSizePreference(normalized)
}, [persistPageSizePreference])

useEffect(() => {
  if (!preferencePageSize) return
  const normalized = normalizePageSize(preferencePageSize)
  if (normalized !== pageSize) {
    setPageSize(normalized)
    setCurrentPage(1)
  }
}, [preferencePageSize, pageSize])


  const handleMonthStep = useCallback(
    (direction: 'prev' | 'next') => {
      setSelectedMonth(previous => {
        const year = previous.getFullYear()
        const month = previous.getMonth()
        const offset = direction === 'next' ? 1 : -1
        return new Date(year, month + offset, 1)
      })
      setCurrentPage(1)
    },
    [],
  )

  // Apply all filters (search, status, column filters) and sorting
  const filteredData = useMemo(() => {
    let filtered = [...reconciliation]

    // Apply search filter
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase()
      filtered = filtered.filter(record =>
        Object.values(record).some(value => {
          if (value === null || value === undefined) return false
          return value.toString().toLowerCase().includes(queryLower)
        }),
      )
    }

    // Apply status filter
    if (activeFilter === 'active') {
      filtered = filtered.filter(record => record.active)
    } else if (activeFilter === 'inactive') {
      filtered = filtered.filter(record => !record.active)
    }

    // Apply column filters
    if (columnFilters.length > 0) {
      filtered = filtered.filter(record => {
        return columnFilters.every(filter => {
          const value = record[filter.columnId as keyof typeof record]
          if (!value) return false

          const valueStr = value.toString().toLowerCase()
          const filterValue = filter.value.toLowerCase()

          switch (filter.operator || 'contains') {
            case 'equals':
              return valueStr === filterValue
            case 'contains':
              return valueStr.includes(filterValue)
            case 'starts_with':
              return valueStr.startsWith(filterValue)
            case 'ends_with':
              return valueStr.endsWith(filterValue)
            default:
              return valueStr.includes(filterValue)
          }
        })
      })
    }

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aRaw = a[sortConfig.columnId as keyof typeof a]
        const bRaw = b[sortConfig.columnId as keyof typeof b]
        const aValue = (aRaw ?? '').toString()
        const bValue = (bRaw ?? '').toString()

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [reconciliation, searchQuery, activeFilter, columnFilters, sortConfig])

  // Calculate paginated data
  const paginatedReconciliation = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredData.slice(startIndex, endIndex)
  }, [filteredData, currentPage, pageSize])

  // Calculate pagination info
  const paginationInfo = useMemo((): PaginationInfo => {
    const totalItems = filteredData.length
    const totalPages = Math.ceil(totalItems / pageSize)

    return {
      page: currentPage,
      totalPages,
      pageSize,
      total: totalItems,
    }
  }, [filteredData.length, currentPage, pageSize])

  const tableLoading = loading || preferenceLoading
  const tableColumns = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === 'multi-action') {
        return {
          ...column,
          render: (_value: unknown, row: any) => {
            const rowId = String(row.id)
            const checked = selectedReconciliations.includes(rowId)
            const activeValue = row.active
            const isUpdating = updatingReconciliationIds.has(rowId)

            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                {/* Checkbox */}
                <label className="flex cursor-pointer items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    aria-label={`Select reconciliation ${row.accountName || rowId}`}
                    onChange={() => handleReconciliationSelect(rowId, !checked)}
                  />
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                      checked
                        ? 'border-primary-500 bg-primary-600 text-white'
                        : 'border-gray-300 bg-white text-transparent'
                    }`}
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>

                {/* Active Toggle */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    if (!isUpdating) {
                      handleToggle(row, 'active', !activeValue)
                    }
                  }}
                  className="relative inline-flex items-center cursor-pointer"
                  disabled={isUpdating}
                  title={activeValue ? 'Active' : 'Inactive'}
                >
                  <span
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      activeValue ? 'bg-primary-600' : 'bg-gray-300',
                      isUpdating ? 'opacity-50' : ''
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                        activeValue ? 'translate-x-5' : 'translate-x-1'
                      )}
                    />
                  </span>
                </button>
              </div>
            )
          },
        }
      }

      if (column.id === 'status') {
        return {
          ...column,
          render: (value: any) => {
            const isCompleted = value === 'Completed'
            return (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                isCompleted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {isCompleted ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {value}
              </div>
            )
          },
        };
      }

      if (
        [
          'totalRevenue',
          'totalCommissions',
          'totalUsage',
          'usageAllocated',
          'usageUnallocated',
          'commissionAllocated',
          'commissionUnallocated',
        ].includes(column.id)
      ) {
        return {
          ...column,
          render: (value: any) => currencyFormatter.format(Number(value ?? 0)),
        }
      }

      if (column.id === 'depositName') {
        return {
          ...column,
          render: (value: any, row: any) => {
            const rowId = String(row.id || '')
            const label = value ?? row.depositName ?? ''
            if (!rowId || !label) {
              return label
            }
            return (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  if (rowId) {
                    router.push(`/reconciliation/${rowId}`)
                  }
                }}
                className="block truncate min-w-0 text-left text-blue-600 hover:text-blue-800 cursor-pointer font-medium"
                title={label}
              >
                {label}
              </button>
            )
          },
        }
      }

      return column
    })
  }, [
    preferenceColumns,
    selectedReconciliations,
    updatingReconciliationIds,
    handleReconciliationSelect,
    handleToggle,
    router,
  ])
  
  // Get hidden columns by comparing all columns with visible ones
  const hiddenColumns = useMemo(() => {
    return reconciliationColumns
      .filter(col => !tableColumns.some(visibleCol => visibleCol.id === col.id))
      .map(col => col.id)
  }, [tableColumns])

  // Create New (Deposit Upload) button handler
  const handleDepositUpload = useCallback(() => {
    router.push('/reconciliation/deposit-upload-list')
  }, [router])

  const handleFlexReviewQueue = useCallback(() => {
    router.push('/reconciliation/flex-review')
  }, [router])

  const reconciliationBulkActions = useMemo<BulkActionsGridProps>(() => ({
    selectedCount: selectedReconciliations.length,
    entityName: 'reconciliation records',
    actions: [
      {
        key: 'delete',
        label: 'Delete',
        icon: Trash2,
        tone: 'danger',
        tooltip: (count) => `Delete ${count} record${count === 1 ? '' : 's'}`,
        onClick: handleOpenBulkDeleteDialog,
      },
      {
        key: 'export',
        label: 'Export CSV',
        icon: Download,
        tone: 'info',
        tooltip: (count) => `Export ${count} record${count === 1 ? '' : 's'} to CSV`,
        onClick: handleBulkExportReconciliations,
      },
    ],
  }), [handleBulkExportReconciliations, handleOpenBulkDeleteDialog, selectedReconciliations.length])

  const selectedYear = selectedMonth.getFullYear()
  const selectedMonthIndex = selectedMonth.getMonth()

  return (
    <div className="dashboard-page-container">
      <div className="px-4 pt-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleMonthStep('prev')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              aria-label="Previous month"
            >
              <span className="sr-only">Previous month</span>
              <span aria-hidden="true">{'<'}</span>
            </button>
            <span className="text-sm font-semibold text-slate-900">
              {MONTHS[selectedMonthIndex]} {selectedYear}
            </span>
            <button
              type="button"
              onClick={() => handleMonthStep('next')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              aria-label="Next month"
            >
              <span className="sr-only">Next month</span>
              <span aria-hidden="true">{'>'}</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFlexReviewQueue}
              className="inline-flex h-8 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Flex Review Queue
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-0">
        <ListHeader
        pageTitle="DEPOSITS LIST"
        searchPlaceholder="Search reconciliation..."
        onSearch={handleSearch}
        onFilterChange={handleStatusFilterChange}
        onCreateClick={handleDepositUpload}
        onSettingsClick={() => setShowColumnSettings(true)}
        filterColumns={filterOptions}
        columnFilters={columnFilters}
        onColumnFiltersChange={handleColumnFilters}
        statusFilter={activeFilter}
        hasUnsavedTableChanges={hasUnsavedChanges || false}
        isSavingTableChanges={preferenceSaving || false}
        lastTableSaved={lastSaved || undefined}
        onSaveTableChanges={saveChanges}
        showCreateButton={true}
        createButtonLabel="Deposit Upload"
        showStatusFilter={true}
        showColumnFilters={true}
        bulkActions={reconciliationBulkActions}
        />
      </div>

      {preferenceError && (
        <div className="px-4 text-sm text-red-600">{preferenceError}</div>
      )}

      {/* Table */}
      <div ref={tableAreaRef} className="flex-1 p-4 min-h-0">
        <DynamicTable
          columns={tableColumns}
          data={paginatedReconciliation}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={tableLoading}
          emptyMessage="No reconciliation records found"
          onColumnsChange={handleColumnsChange}
          selectedItems={selectedReconciliations}
          onItemSelect={handleReconciliationSelect}
          onSelectAll={handleSelectAll}
          onToggle={(row, columnId, value) => {
            handleToggle(row, columnId, value)
          }}
          fillContainerWidth={true}
          autoSizeColumns={false}
          hasLoadedPreferences={!preferenceLoading && preferenceColumns.length > 0}
          alwaysShowPagination={true}
          maxBodyHeight={tableBodyHeight}
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

      <TwoStageDeleteDialog
        isOpen={showBulkDeleteDialog}
        onClose={() => setShowBulkDeleteDialog(false)}
        entity="Deposit"
        entityName="Selected deposits"
        entityId={bulkDeleteEntities[0]?.id ?? ''}
        deleteKind="permanent"
        multipleEntities={bulkDeleteEntities}
        entityLabelPlural="Deposits"
        onSoftDelete={async (entityId: string) => {
          try {
            await deleteDeposit(entityId)
            setReconciliation(prev => prev.filter(record => String(record.id) !== String(entityId)))
            setSelectedReconciliations([])
            showSuccess('Deposit deleted', 'The deposit and its allocations were removed.')
            return { success: true }
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unable to delete deposit' }
          }
        }}
        onPermanentDelete={async (entityId: string) => {
          try {
            await deleteDeposit(entityId)
            setReconciliation(prev => prev.filter(record => String(record.id) !== String(entityId)))
            setSelectedReconciliations([])
            showSuccess('Deposit deleted', 'The deposit and its allocations were removed.')
            return { success: true }
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unable to delete deposit' }
          }
        }}
        onBulkPermanentDelete={async (entities) => handleBulkPermanentDelete(entities)}
        note="Deleting deposits permanently removes their line items and allocations. Finalized deposits cannot be deleted."
        primaryActionLabel="Delete Deposits"
      />
      <ToastContainer />
    </div>
  )
}
