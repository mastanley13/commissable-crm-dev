'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, Download, RotateCcw, Trash2 } from 'lucide-react'
import { AccountStatusFilterDropdown } from '@/components/account-status-filter-dropdown'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { CopyProtectionWrapper } from '@/components/copy-protection'
import { DynamicTable, type Column, type PaginationInfo } from '@/components/dynamic-table'
import { ListHeader, type ColumnFilter as ListColumnFilter } from '@/components/list-header'
import { TwoStageDeleteDialog } from '@/components/two-stage-delete-dialog'
import { useToasts } from '@/components/toast'
import { useAuth } from '@/lib/auth-context'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { calculateMinWidth } from '@/lib/column-width-utils'

type ProductArchiveRow = {
  id: string
  productNameHouse: string
  productNameVendor: string
  partNumberVendor: string
  distributorId?: string | null
  distributorName: string
  vendorId?: string | null
  vendorName: string
  revenueType?: string
  revenueTypeLabel?: string
  hasRevenueSchedules?: boolean
  active: boolean
}

type SortState = { columnId: string; direction: 'asc' | 'desc' }

const TABLE_BOTTOM_RESERVE = 110
const TABLE_MIN_BODY_HEIGHT = 320

const ARCHIVE_PRODUCT_BASE_COLUMNS: Column[] = [
  { id: 'select', label: 'Select', width: 110, minWidth: calculateMinWidth({ label: 'Select', type: 'checkbox', sortable: false }), maxWidth: 220, type: 'checkbox', hideable: false },
  { id: 'productNameHouse', label: 'House Product', width: 260, minWidth: calculateMinWidth({ label: 'House Product', type: 'text', sortable: true }), sortable: true, hideable: false },
  { id: 'productNameVendor', label: 'Vendor Product', width: 260, minWidth: calculateMinWidth({ label: 'Vendor Product', type: 'text', sortable: true }), sortable: true },
  { id: 'partNumberVendor', label: 'Part #', width: 160, minWidth: calculateMinWidth({ label: 'Part #', type: 'text', sortable: true }), sortable: true },
  { id: 'distributorName', label: 'Distributor', width: 220, minWidth: calculateMinWidth({ label: 'Distributor', type: 'text', sortable: true }), sortable: true },
  { id: 'vendorName', label: 'Vendor', width: 220, minWidth: calculateMinWidth({ label: 'Vendor', type: 'text', sortable: true }), sortable: true },
  { id: 'revenueType', label: 'Revenue Type', width: 180, minWidth: calculateMinWidth({ label: 'Revenue Type', type: 'text', sortable: true }), sortable: true },
  { id: 'hasRevenueSchedules', label: 'Has Schedules', width: 140, minWidth: calculateMinWidth({ label: 'Has Schedules', type: 'text', sortable: false }), sortable: false },
]

const ARCHIVE_PRODUCT_FILTER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'productNameVendor', label: 'Other - Product Name' },
  { id: 'productNameHouse', label: 'House - Product Name' },
  { id: 'distributorName', label: 'Distributor Name' },
  { id: 'vendorName', label: 'Vendor Name' },
  { id: 'partNumberVendor', label: 'Other - Part Number' },
  { id: 'revenueType', label: 'Revenue Type' },
  { id: 'active', label: 'Active (Y/N)' },
  { id: 'hasRevenueSchedules', label: 'Has Revenue Schedules (Y/N)' },
]

function escapeCsv(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export default function AdminArchivedProductsPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()
  const router = useRouter()

  const roleCode = (user?.role?.code ?? '').toLowerCase()
  const isAdmin = roleCode === 'admin' || roleCode.includes('admin')

  const canManageArchive =
    isAdmin || hasPermission('products.read') || hasPermission('products.update') || hasPermission('products.delete')
  const userCanPermanentDelete = hasPermission('products.delete')
  const userCanRestore = isAdmin

  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    saving: preferenceSaving,
    error: preferenceError,
    pageSize: preferencePageSize,
    hasUnsavedChanges,
    lastSaved,
    handleColumnsChange,
    handlePageSizeChange: persistPageSizeChange,
    saveChanges,
    saveChangesOnModalClose,
  } = useTablePreferences('products:archive', ARCHIVE_PRODUCT_BASE_COLUMNS, { defaultPageSize: 25 })

  const [products, setProducts] = useState<ProductArchiveRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewFilter, setViewFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [sortState, setSortState] = useState<SortState | null>(null)
  const [columnFilters, setColumnFilters] = useState<ListColumnFilter[]>([])
  const [totalRecords, setTotalRecords] = useState(0)

  const [tableBodyHeight, setTableBodyHeight] = useState<number>()
  const tableAreaNodeRef = useRef<HTMLDivElement | null>(null)

  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [productToDelete, setProductToDelete] = useState<ProductArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<ProductArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / preferencePageSize))
    return { page, pageSize: preferencePageSize, total: totalRecords, totalPages }
  }, [page, preferencePageSize, totalRecords])

  const reloadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      if (viewFilter === 'active') {
        params.set('status', 'inactive')
      } else if (viewFilter === 'inactive') {
        params.set('status', 'active')
      } else {
        params.set('status', 'all')
      }

      params.set('page', String(page))
      params.set('pageSize', String(preferencePageSize))

      if (searchQuery.trim().length > 0) {
        params.set('q', searchQuery.trim())
      }

      if (sortState) {
        params.set('sort', sortState.columnId)
        params.set('direction', sortState.direction)
      }

      const sanitizedFilters = columnFilters
        .filter((filter) => filter && typeof filter.columnId === 'string')
        .map((filter) => ({
          columnId: String(filter.columnId),
          value: typeof filter.value === 'string' ? filter.value : String(filter.value ?? ''),
          operator: typeof filter.operator === 'string' ? filter.operator : undefined,
        }))
        .filter((filter) => filter.columnId.length > 0 && filter.value.trim().length > 0)

      if (sanitizedFilters.length > 0) {
        params.set('filters', JSON.stringify(sanitizedFilters))
      }

      const response = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load archived products')
      }

      const rows: ProductArchiveRow[] = Array.isArray(payload?.data) ? payload.data : []
      const total = typeof payload?.pagination?.total === 'number' ? payload.pagination.total : rows.length
      setProducts(rows)
      setTotalRecords(total)
      setSelectedIds([])
      setBulkDeleteTargets([])
      setError(null)
    } catch (err) {
      console.error(err)
      setProducts([])
      setSelectedIds([])
      setBulkDeleteTargets([])
      setTotalRecords(0)
      setError('Unable to load archived products')
    } finally {
      setLoading(false)
    }
  }, [columnFilters, page, preferencePageSize, searchQuery, sortState, viewFilter])

  useEffect(() => {
    if (!canManageArchive) return
    reloadProducts().catch(console.error)
  }, [canManageArchive, reloadProducts])

  const measureTableArea = useCallback(() => {
    const node = tableAreaNodeRef.current
    if (!node || typeof window === 'undefined') return

    const rect = node.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
    if (viewportHeight <= 0) return

    const available = viewportHeight - rect.top - TABLE_BOTTOM_RESERVE
    if (!Number.isFinite(available)) return

    const nextHeight = Math.max(TABLE_MIN_BODY_HEIGHT, Math.floor(available))
    if (nextHeight !== tableBodyHeight) {
      setTableBodyHeight(nextHeight)
    }
  }, [tableBodyHeight])

  const tableAreaRef = useCallback(
    (node: HTMLDivElement | null) => {
      tableAreaNodeRef.current = node
      if (node && typeof window !== 'undefined') {
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
    if (typeof window === 'undefined') return
    const handleResize = () => measureTableArea()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [measureTableArea])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.requestAnimationFrame(() => {
      measureTableArea()
    })
  }, [measureTableArea, products.length, selectedIds.length, loading, preferenceLoading, page, preferencePageSize, viewFilter])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setPage(1)
  }, [])

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
  }, [])

  const handlePageSizeChange = useCallback(
    (nextPageSize: number) => {
      persistPageSizeChange(nextPageSize)
      setPage(1)
    },
    [persistPageSizeChange],
  )

  const handleViewFilterChange = useCallback((next: 'active' | 'inactive' | 'all') => {
    setViewFilter(next)
    setSelectedIds([])
    setPage(1)
  }, [])

  const handleSort = useCallback((columnId: string, direction: 'asc' | 'desc') => {
    setSortState({ columnId, direction })
    setPage(1)
  }, [])

  const handleColumnFiltersChange = useCallback((filters: ListColumnFilter[]) => {
    setColumnFilters(filters)
    setPage(1)
  }, [])

  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((previous) => {
      if (selected) {
        return previous.includes(id) ? previous : [...previous, id]
      }
      return previous.filter((existingId) => existingId !== id)
    })
  }, [])

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedIds(products.map((row) => row.id))
        return
      }
      setSelectedIds([])
    },
    [products],
  )

  const handleRowClick = useCallback(
    (row: ProductArchiveRow) => {
      router.push(`/products/${row.id}`)
    },
    [router],
  )

  const restoreProductRequest = useCallback(async (productId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        return { success: false, error: payload?.error ?? 'Failed to restore product' }
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to restore product' }
    }
  }, [])

  const handleRestore = useCallback(
    async (productId: string): Promise<{ success: boolean; error?: string }> => {
      const result = await restoreProductRequest(productId)
      if (result.success) {
        setProducts((previous) =>
          viewFilter === 'active'
            ? previous.filter((row) => row.id !== productId)
            : previous.map((row) => (row.id === productId ? { ...row, active: true } : row)),
        )
        setSelectedIds((previous) => previous.filter((id) => id !== productId))
        showSuccess('Product restored', 'The product was restored and removed from Archive.')
      }
      return result
    },
    [restoreProductRequest, showSuccess, viewFilter],
  )

  const handleBulkRestore = useCallback(async () => {
    if (selectedIds.length === 0) {
      showError('No products selected', 'Select at least one archived product to restore.')
      return
    }

    const targets = products.filter((row) => selectedIds.includes(row.id) && !row.active)
    if (targets.length === 0) {
      showError('No archived products selected', 'Only archived products can be restored.')
      return
    }

    setBulkActionLoading(true)
    try {
      const results = await Promise.allSettled(targets.map((row) => restoreProductRequest(row.id)))
      const restoredIds: string[] = []
      const failures: Array<{ product: ProductArchiveRow; message: string }> = []

      results.forEach((result, index) => {
        const product = targets[index]
        if (result.status === 'fulfilled' && result.value.success) {
          restoredIds.push(product.id)
        } else {
          const message =
            result.status === 'fulfilled'
              ? result.value.error || 'Failed to restore product'
              : result.reason instanceof Error
                ? result.reason.message
                : 'Failed to restore product'
          failures.push({ product, message })
        }
      })

      if (restoredIds.length > 0) {
        const restoredSet = new Set(restoredIds)
        setProducts((previous) =>
          viewFilter === 'active'
            ? previous.filter((row) => !restoredSet.has(row.id))
            : previous.map((row) => (restoredSet.has(row.id) ? { ...row, active: true } : row)),
        )
        setSelectedIds((previous) => previous.filter((id) => !restoredSet.has(id)))
        showSuccess(
          `Restored ${restoredIds.length} product${restoredIds.length === 1 ? '' : 's'}`,
          'Restored products were removed from Archive.',
        )
      }

      if (failures.length > 0) {
        const message = failures
          .slice(0, 5)
          .map(({ product, message }) => `${product.productNameHouse || product.productNameVendor || 'Product'}: ${message}`)
          .join('; ')
        showError('Some restores failed', message)
      }
    } finally {
      setBulkActionLoading(false)
    }
  }, [products, restoreProductRequest, selectedIds, showError, showSuccess, viewFilter])

  const handlePermanentDelete = useCallback(
    async (productId: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const trimmedReason = typeof reason === 'string' ? reason.trim() : ''
        const response = await fetch(`/api/products/${productId}`, {
          method: 'DELETE',
          ...(trimmedReason ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: trimmedReason }) } : {}),
        })

        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          return { success: false, error: payload?.error ?? 'Failed to permanently delete product' }
        }

        setProducts((previous) => previous.filter((row) => row.id !== productId))
        setSelectedIds((previous) => previous.filter((id) => id !== productId))
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unable to permanently delete product' }
      }
    },
    [],
  )

  const requestRowDeletion = useCallback(
    (row: ProductArchiveRow) => {
      if (row.active) {
        showError('Not archived', 'Only archived products can be permanently deleted from this page.')
        return
      }
      setBulkDeleteTargets([])
      setProductToDelete(row)
      setShowDeleteDialog(true)
    },
    [showError],
  )

  const openBulkPermanentDeleteDialog = useCallback(() => {
    if (selectedIds.length === 0) {
      showError('No products selected', 'Select at least one archived product to permanently delete.')
      return
    }

    const targets = products.filter((row) => selectedIds.includes(row.id) && !row.active)
    if (targets.length === 0) {
      showError('No archived products selected', 'Only archived products can be permanently deleted here.')
      return
    }

    setBulkDeleteTargets(targets)
    setProductToDelete(null)
    setShowDeleteDialog(true)
  }, [products, selectedIds, showError])

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false)
    setProductToDelete(null)
    setBulkDeleteTargets([])
  }

  const handleBulkExportCsv = useCallback(() => {
    const rows = products.filter((row) => selectedIds.includes(row.id))
    if (rows.length === 0) {
      showError('No products selected', 'Select at least one product to export.')
      return
    }

    const lines = [
      ['House Product', 'Vendor Product', 'Part #', 'Distributor', 'Vendor', 'Revenue Type', 'Has Schedules', 'Active'].join(','),
      ...rows.map((row) =>
        [
          escapeCsv(row.productNameHouse),
          escapeCsv(row.productNameVendor),
          escapeCsv(row.partNumberVendor),
          escapeCsv(row.distributorName),
          escapeCsv(row.vendorName),
          escapeCsv(row.revenueTypeLabel ?? row.revenueType),
          escapeCsv(row.hasRevenueSchedules ? 'Yes' : 'No'),
          escapeCsv(row.active ? 'Yes' : 'No'),
        ].join(','),
      ),
    ].join('\r\n')

    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    link.download = `products-${viewFilter === 'active' ? 'archived' : viewFilter}-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showSuccess('Export complete', 'Check your downloads for the CSV file.')
  }, [products, selectedIds, showError, showSuccess, viewFilter])

  const bulkActions = useMemo(() => {
    return {
      selectedCount: selectedIds.length,
      isBusy: bulkActionLoading,
      entityName: 'products',
      actions: [
        {
          key: 'restore',
          label: 'Restore',
          icon: RotateCcw,
          tone: 'primary' as const,
          onClick: handleBulkRestore,
          tooltip: (count: number) => `Restore ${count} archived product${count === 1 ? '' : 's'}`,
          disabled: !userCanRestore,
        },
        {
          key: 'export',
          label: 'Export CSV',
          icon: Download,
          tone: 'info' as const,
          onClick: handleBulkExportCsv,
          tooltip: (count: number) => `Export ${count} product${count === 1 ? '' : 's'} to CSV`,
        },
        {
          key: 'permanent-delete',
          label: 'Delete Permanently',
          icon: Trash2,
          tone: 'danger' as const,
          onClick: openBulkPermanentDeleteDialog,
          tooltip: (count: number) => `Permanently delete ${count} archived product${count === 1 ? '' : 's'}`,
          disabled: !userCanPermanentDelete,
        },
      ],
    }
  }, [
    bulkActionLoading,
    handleBulkExportCsv,
    handleBulkRestore,
    openBulkPermanentDeleteDialog,
    selectedIds.length,
    userCanPermanentDelete,
    userCanRestore,
  ])

  const tableColumns: Column[] = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === 'select') {
        return {
          ...column,
          render: (_value: unknown, row: ProductArchiveRow) => {
            const checked = selectedIds.includes(row.id)
            const canRestoreRow = userCanRestore && !row.active
            const canDeleteRow = userCanPermanentDelete && !row.active
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`Select product ${row.productNameHouse || row.productNameVendor || row.id}`}
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
                    checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'
                  }`}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleSelect(row.id, !checked)
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <Check className="h-3 w-3" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="p-1 rounded transition-colors text-emerald-600 hover:text-emerald-800 disabled:cursor-not-allowed disabled:text-gray-300"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    void handleRestore(row.id)
                  }}
                  disabled={!canRestoreRow}
                  aria-label="Restore product"
                  title={
                    row.active ? 'Already active' : canRestoreRow ? 'Restore product' : 'Admin role required'
                  }
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="p-1 rounded transition-colors text-red-500 hover:text-red-700 disabled:cursor-not-allowed disabled:text-gray-300"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    requestRowDeletion(row)
                  }}
                  disabled={!canDeleteRow}
                  aria-label="Permanently delete product"
                  title={
                    row.active
                      ? 'Only archived products can be permanently deleted here'
                      : canDeleteRow
                        ? 'Permanently delete'
                        : 'Insufficient permissions'
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )
          },
        }
      }

      if (column.id === 'productNameHouse') {
        return {
          ...column,
          render: (value: string, row: ProductArchiveRow) => (
            <Link href={`/products/${row.id}`} className="text-blue-600 hover:underline">
              {value || '--'}
            </Link>
          ),
        }
      }

      if (column.id === 'productNameVendor') {
        return {
          ...column,
          render: (value: string, row: ProductArchiveRow) => (
            <Link href={`/products/${row.id}`} className="text-blue-600 hover:underline">
              {value || '--'}
            </Link>
          ),
        }
      }

      if (column.id === 'revenueType') {
        return {
          ...column,
          render: (_value: unknown, row: ProductArchiveRow) => row.revenueTypeLabel || row.revenueType || '--',
        }
      }

      if (column.id === 'hasRevenueSchedules') {
        return { ...column, render: (_value: unknown, row: ProductArchiveRow) => (row.hasRevenueSchedules ? 'Yes' : 'No') }
      }

      return column
    })
  }, [handleRestore, handleSelect, preferenceColumns, requestRowDeletion, selectedIds, userCanPermanentDelete, userCanRestore])

  const pageTitle = useMemo(() => {
    if (viewFilter === 'inactive') return 'ACTIVE PRODUCTS'
    if (viewFilter === 'all') return 'ALL PRODUCTS'
    return 'ARCHIVED PRODUCTS'
  }, [viewFilter])

  const searchPlaceholder = useMemo(() => {
    if (viewFilter === 'inactive') return 'Search active products...'
    if (viewFilter === 'all') return 'Search all products...'
    return 'Search archived products...'
  }, [viewFilter])

  const emptyMessage = useMemo(() => {
    if (viewFilter === 'inactive') return 'No active products found'
    if (viewFilter === 'all') return 'No products found'
    return 'No archived products found'
  }, [viewFilter])

  if (!canManageArchive) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Archived Products</h1>
        <p className="mt-2 text-sm text-gray-600">Access denied. You need catalog permissions to view archived products.</p>
        {user?.role?.name ? <p className="mt-2 text-xs text-gray-500">Role: {user.role.name}</p> : null}
      </div>
    )
  }

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
        pageTitle={pageTitle}
        searchPlaceholder={searchPlaceholder}
        onSearch={handleSearch}
        showStatusFilter={false}
        leftAccessory={
          <AccountStatusFilterDropdown
            value={viewFilter}
            options={['active', 'inactive', 'all']}
            labels={{ active: 'Archived', inactive: 'Active', all: 'All' }}
            onChange={handleViewFilterChange}
          />
        }
        showColumnFilters
        filterColumns={ARCHIVE_PRODUCT_FILTER_OPTIONS}
        columnFilters={columnFilters}
        onColumnFiltersChange={handleColumnFiltersChange}
        showCreateButton={false}
        onSettingsClick={() => setShowColumnSettings(true)}
        hasUnsavedTableChanges={hasUnsavedChanges}
        isSavingTableChanges={preferenceSaving}
        lastTableSaved={lastSaved || undefined}
        onSaveTableChanges={saveChanges}
        bulkActions={bulkActions}
      />

      {(error || preferenceError) ? <div className="px-4 text-sm text-red-600">{error || preferenceError}</div> : null}

      <div className="flex-1 min-h-0 p-4 pt-0 flex flex-col gap-4">
        <div ref={tableAreaRef} className="flex-1 min-h-0">
          <DynamicTable
            columns={tableColumns}
            data={products}
            onSort={handleSort}
            onRowClick={handleRowClick}
            loading={loading || preferenceLoading}
            emptyMessage={emptyMessage}
            onColumnsChange={handleColumnsChange}
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            selectedItems={selectedIds}
            onItemSelect={handleSelect}
            onSelectAll={handleSelectAll}
            fillContainerWidth
            autoSizeColumns={false}
            alwaysShowPagination
            hasLoadedPreferences={!preferenceLoading}
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

      <TwoStageDeleteDialog
        isOpen={showDeleteDialog}
        onClose={closeDeleteDialog}
        entity="Product"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} product${bulkDeleteTargets.length === 1 ? '' : 's'}`
            : productToDelete?.productNameHouse || productToDelete?.productNameVendor || 'Unknown Product'
        }
        entityId={bulkDeleteTargets.length > 0 ? bulkDeleteTargets[0]?.id || '' : productToDelete?.id || ''}
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((row) => ({
                id: row.id,
                name: row.productNameHouse || row.productNameVendor || 'Product',
              }))
            : undefined
        }
        entityLabelPlural="Products"
        isDeleted={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.every((product) => !product.active)
            : !(productToDelete?.active ?? true)
        }
        onSoftDelete={async () => ({ success: false, error: 'Archived products cannot be soft deleted again.' })}
        onPermanentDelete={handlePermanentDelete}
        onRestore={userCanRestore ? handleRestore : undefined}
        userCanPermanentDelete={userCanPermanentDelete}
        modalSize="revenue-schedules"
        requireReason
        note="Legend: Archived products are inactive. Restore will return them to the Catalog. Permanent delete is irreversible and may be blocked if the product has active revenue schedules or is used on active opportunities."
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}
