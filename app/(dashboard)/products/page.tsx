'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ListHeader, type ColumnFilter } from '@/components/list-header'
import { DynamicTable, type Column, type PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { CopyProtectionWrapper } from '@/components/copy-protection'
import { ProductBulkActionBar } from '@/components/product-bulk-action-bar'
import { TwoStageDeleteDialog } from '@/components/two-stage-delete-dialog'
import { useToasts } from '@/components/toast'
import { Check, Edit, Trash2 } from 'lucide-react'

const PRODUCT_FILTER_OPTIONS = [
  { id: 'productNameVendor', label: 'Product Name - Vendor' },
  { id: 'productNameHouse', label: 'Product Name - House' },
  { id: 'distributorName', label: 'Distributor Name' },
  { id: 'vendorName', label: 'Vendor Name' },
  { id: 'productFamilyVendor', label: 'Product Family - Vendor' },
  { id: 'productSubtypeVendor', label: 'Product Subtype - Vendor' },
  { id: 'partNumberVendor', label: 'Part Number - Vendor' },
  { id: 'revenueType', label: 'Revenue Type' },
  { id: 'active', label: 'Active (Y/N)' },
]

const BASE_COLUMNS: Column[] = [
  {
    id: 'multi-action',
    label: 'Select All',
    width: 200,
    minWidth: 160,
    maxWidth: 240,
    type: 'multi-action',
  },
  {
    id: 'distributorName',
    label: 'Distributor Name',
    width: 200,
    minWidth: 160,
    maxWidth: 280,
    sortable: true,
    accessor: 'distributorName',
  },
  {
    id: 'vendorName',
    label: 'Vendor Name',
    width: 200,
    minWidth: 160,
    maxWidth: 280,
    sortable: true,
    accessor: 'vendorName',
  },
  {
    id: 'productFamilyVendor',
    label: 'Product Family - Vendor',
    width: 220,
    minWidth: 180,
    maxWidth: 320,
    accessor: 'productFamilyVendor',
    hidden: true,
  },
  {
    id: 'productSubtypeVendor',
    label: 'Product Subtype - Vendor',
    width: 220,
    minWidth: 180,
    maxWidth: 320,
    accessor: 'productSubtypeVendor',
    hidden: true,
  },
  {
    id: 'productNameVendor',
    label: 'Product Name - Vendor',
    width: 240,
    minWidth: 200,
    maxWidth: 360,
    sortable: true,
    accessor: 'productNameVendor',
  },
  {
    id: 'partNumberVendor',
    label: 'Part Number - Vendor',
    width: 200,
    minWidth: 160,
    maxWidth: 280,
    accessor: 'partNumberVendor',
    hidden: true,
  },
  {
    id: 'productNameHouse',
    label: 'Product Name - House',
    width: 240,
    minWidth: 200,
    maxWidth: 360,
    sortable: true,
    accessor: 'productNameHouse',
  },
  {
    id: 'productDescriptionHouse',
    label: 'Product Description - House',
    width: 260,
    minWidth: 200,
    maxWidth: 400,
    accessor: 'productDescriptionHouse',
    hidden: true,
  },
  {
    id: 'productDescriptionVendor',
    label: 'Product Description - Vendor',
    width: 260,
    minWidth: 200,
    maxWidth: 400,
    accessor: 'productDescriptionVendor',
    hidden: true,
  },
  {
    id: 'quantity',
    label: 'Quantity',
    width: 140,
    minWidth: 120,
    maxWidth: 200,
    accessor: 'quantity',
    hidden: true,
  },
  {
    id: 'priceEach',
    label: 'Price Each',
    width: 140,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    accessor: 'priceEach',
  },
  {
    id: 'commissionPercent',
    label: 'Expected Commission Rate %',
    width: 200,
    minWidth: 160,
    maxWidth: 260,
    sortable: true,
    accessor: 'commissionPercent',
  },
  {
    id: 'active',
    label: 'Active (Y/N)',
    width: 140,
    minWidth: 120,
    maxWidth: 200,
    accessor: 'active',
    sortable: true,
    hidden: true,
  },
  {
    id: 'revenueSchedulePeriods',
    label: 'Revenue Schedule Periods',
    width: 220,
    minWidth: 180,
    maxWidth: 300,
    accessor: 'revenueSchedulePeriods',
    hidden: true,
  },
  {
    id: 'revenueScheduleEstimatedStartDate',
    label: 'Revenue Schedule Estimated Start Date',
    width: 260,
    minWidth: 200,
    maxWidth: 360,
    accessor: 'revenueScheduleEstimatedStartDate',
    hidden: true,
  },
  {
    id: 'revenueType',
    label: 'Revenue Type',
    width: 180,
    minWidth: 140,
    maxWidth: 260,
    sortable: true,
    accessor: 'revenueType',
  },
]

interface ProductRow {
  id: string
  select?: boolean
  active: boolean
  distributorName: string
  vendorName: string
  productFamilyVendor: string
  productSubtypeVendor: string
  productNameVendor: string
  partNumberVendor: string
  productNameHouse: string
  productDescriptionHouse: string
  productDescriptionVendor: string
  quantity: number | null
  priceEach: number | null
  commissionPercent: number | null
  revenueSchedulePeriods: number | null
  revenueScheduleEstimatedStartDate: string | null
  revenueType: string
}
interface ProductListResponse {
  data?: ProductRow[]
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages?: number
  }
}

const DEFAULT_PAGINATION: PaginationInfo = {
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 1,
}

const TABLE_BOTTOM_RESERVE = 140
const TABLE_MIN_BODY_HEIGHT = 320

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '$0.00'
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0.00%'
  }
  return `${value.toFixed(2)}%`
}

function formatIsoDate(value?: string | null) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toISOString().slice(0, 10)
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(DEFAULT_PAGINATION.page)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGINATION.pageSize)
  const [pagination, setPagination] = useState<PaginationInfo>(DEFAULT_PAGINATION)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([])
  const [sortState, setSortState] = useState<{ columnId: string; direction: 'asc' | 'desc' }>({
    columnId: 'productNameHouse',
    direction: 'asc',
  })
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [productToDelete, setProductToDelete] = useState<ProductRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<ProductRow[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [tableBodyHeight, setTableBodyHeight] = useState<number>()
  const tableAreaNodeRef = useRef<HTMLDivElement | null>(null)

  const { showError, showSuccess, showWarning, ToastContainer } = useToasts()

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
  } = useTablePreferences('products:list', BASE_COLUMNS)

  const tableLoading = loading || preferenceLoading

  const normalizedPreferenceColumns = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === 'priceEachPercent') {
        return {
          ...column,
          id: 'priceEach',
          accessor: 'priceEach',
          label: column.label === 'Price Each %' ? 'Price Each' : column.label,
        }
      }

      if (column.id === 'commissionPercent' && column.label === 'Commission %') {
        return {
          ...column,
          label: 'Expected Commission Rate %',
        }
      }

      return column
    })
  }, [preferenceColumns])
  const fetchProducts = useCallback(async (page: number, size: number) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(size),
        status: statusFilter,
        sort: sortState.columnId,
        direction: sortState.direction,
      })

      if (searchQuery.trim().length > 0) {
        params.set('q', searchQuery.trim())
      }

      if (columnFilters.length > 0) {
        params.set('filters', JSON.stringify(columnFilters))
      }

      const response = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to load products')
      }

      const payload = (await response.json().catch(() => null)) as ProductListResponse | null
      const data = Array.isArray(payload?.data) ? payload!.data : []

      setProducts(data)
      setSelectedProducts((previous) => previous.filter((id) => data.some((row) => row.id === id)))

      const paginationPayload = payload?.pagination
      if (paginationPayload) {
        setPagination({
          page: paginationPayload.page,
          pageSize: paginationPayload.pageSize,
          total: paginationPayload.total,
          totalPages:
            paginationPayload.totalPages ??
            Math.max(1, Math.ceil(paginationPayload.total / paginationPayload.pageSize)),
        })
      } else {
        setPagination({
          page,
          pageSize: size,
          total: data.length,
          totalPages: Math.max(1, Math.ceil(data.length / size)),
        })
      }
    } catch (err) {
      console.error('Failed to load products', err)
      const message = err instanceof Error ? err.message : 'Failed to load products'
      setError(message)
      showError('Unable to load products', message)
      setProducts([])
      setPagination({
        page,
        pageSize: size,
        total: 0,
        totalPages: 1,
      })
    } finally {
      setLoading(false)
    }
  }, [columnFilters, searchQuery, showError, sortState.columnId, sortState.direction, statusFilter])

  useEffect(() => {
    void fetchProducts(currentPage, pageSize)
  }, [fetchProducts, currentPage, pageSize])

  const reloadProducts = useCallback(() => {
    void fetchProducts(currentPage, pageSize)
  }, [fetchProducts, currentPage, pageSize])

  const measureTableArea = useCallback(() => {
    const node = tableAreaNodeRef.current
    if (!node || typeof window === 'undefined') {
      return
    }

    const rect = node.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
    const available = viewportHeight - rect.top - TABLE_BOTTOM_RESERVE
    if (!Number.isFinite(available)) {
      return
    }

    const nextHeight = Math.max(TABLE_MIN_BODY_HEIGHT, Math.floor(available))
    if (nextHeight !== tableBodyHeight) {
      setTableBodyHeight(nextHeight)
    }
  }, [tableBodyHeight])

  const tableAreaRef = useCallback((node: HTMLDivElement | null) => {
    tableAreaNodeRef.current = node
    if (node) {
      window.requestAnimationFrame(() => {
        measureTableArea()
      })
    }
  }, [measureTableArea])

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
    products.length,
    selectedProducts.length,
    tableLoading,
    pagination.page,
    pagination.pageSize,
  ])
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }, [])

  const handleStatusFilterChange = useCallback((value: 'active' | 'inactive') => {
    setStatusFilter(value)
    setCurrentPage(1)
  }, [])

  const handleColumnFiltersChange = useCallback((filters: ColumnFilter[]) => {
    setColumnFilters(filters)
    setCurrentPage(1)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }, [])

  const handleSort = useCallback((columnId: string, direction: 'asc' | 'desc') => {
    if (columnId === 'multi-action') {
      return
    }
    setSortState({ columnId, direction })
    setCurrentPage(1)
  }, [])

  const handleSelectProduct = useCallback((productId: string, selected: boolean) => {
    setSelectedProducts((previous) => {
      if (selected) {
        if (previous.includes(productId)) {
          return previous
        }
        return [...previous, productId]
      }
      return previous.filter((id) => id !== productId)
    })
  }, [])

  const handleSelectAll = useCallback((selected: boolean) => {
    setSelectedProducts((previous) => {
      if (selected) {
        const ids = products.map((row) => row.id)
        const merged = new Set([...previous, ...ids])
        return Array.from(merged)
      }
      const idsToRemove = new Set(products.map((row) => row.id))
      return previous.filter((id) => !idsToRemove.has(id))
    })
  }, [products])

  const handleRowClick = useCallback((product: ProductRow) => {
    console.log('Product clicked:', product)
    showWarning('Edit coming soon', `${product.productNameHouse || product.productNameVendor} cannot be edited yet.`)
  }, [showWarning])
  const handleProductToggleActive = useCallback(async (row: ProductRow, nextValue: boolean) => {
    try {
      const response = await fetch(`/api/products/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextValue }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to update product')
      }

      setProducts((previous) =>
        previous.map((product) =>
          product.id === row.id ? { ...product, active: nextValue } : product,
        ),
      )
      showSuccess('Product updated', `Product marked ${nextValue ? 'active' : 'inactive'}.`)
      await reloadProducts()
    } catch (err) {
      console.error('Failed to toggle product', err)
      showError('Unable to update product', err instanceof Error ? err.message : 'Please try again later.')
    }
  }, [reloadProducts, showError, showSuccess])

  const handleProductDelete = useCallback(async (productId: string) => {
    try {
      const response = await fetch(`/api/products/${productId}`, { method: 'DELETE' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to delete product')
      }

      setProducts((previous) => previous.filter((product) => product.id !== productId))
      setSelectedProducts((previous) => previous.filter((id) => id !== productId))
      showSuccess('Product deleted', 'The product has been removed.')
      await reloadProducts()
      setProductToDelete(null)
      setShowDeleteDialog(false)
    } catch (err) {
      console.error('Failed to delete product', err)
      showError('Unable to delete product', err instanceof Error ? err.message : 'Please try again later.')
    }
  }, [reloadProducts, showError, showSuccess])

  const openDeleteDialog = useCallback((targets: ProductRow[]) => {
    setBulkDeleteTargets(targets)
    setProductToDelete(null)
    setShowDeleteDialog(true)
  }, [])

  const requestProductDelete = useCallback((product: ProductRow) => {
    setBulkDeleteTargets([])
    setProductToDelete(product)
    setShowDeleteDialog(true)
  }, [])

  const closeDeleteDialog = useCallback(() => {
    setShowDeleteDialog(false)
    setBulkDeleteTargets([])
    setProductToDelete(null)
  }, [])
  const executeBulkProductDelete = useCallback(async (targets: ProductRow[]) => {
    if (!targets || targets.length === 0) {
      showError('No products selected', 'Select at least one product to delete.')
      return { success: false, error: 'No products selected' }
    }

    setBulkActionLoading(true)

    try {
      const outcomes = await Promise.allSettled(
        targets.map(async (target) => {
          const response = await fetch(`/api/products/${target.id}`, { method: 'DELETE' })
          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error ?? 'Failed to delete product')
          }
          return target.id
        }),
      )

      const failures: Array<{ product: ProductRow; message: string }> = []
      const successIds: string[] = []

      outcomes.forEach((result, index) => {
        const product = targets[index]
        if (result.status === 'fulfilled') {
          successIds.push(product.id)
        } else {
          const message =
            result.reason instanceof Error ? result.reason.message : 'Unexpected error'
          failures.push({ product, message })
        }
      })

      if (successIds.length > 0) {
        const successSet = new Set(successIds)
        setProducts((previous) => previous.filter((product) => !successSet.has(product.id)))
        setSelectedProducts((previous) => previous.filter((id) => !successSet.has(id)))
        showSuccess(
          `Deleted ${successIds.length} product${successIds.length === 1 ? '' : 's'}`,
          'The selected products have been deleted.',
        )
        await reloadProducts()
      }

      if (failures.length > 0) {
        const detail = failures
          .map((item) => `${item.product.productNameHouse || item.product.productNameVendor}: ${item.message}`)
          .join('; ')
        showError('Failed to delete some products', detail)
        return { success: false, error: detail }
      }

      return { success: true }
    } finally {
      setBulkActionLoading(false)
    }
  }, [reloadProducts, showError, showSuccess])

  const handleBulkActivateProducts = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      showError('No products selected', 'Select at least one product to update.')
      return
    }

    setBulkActionLoading(true)

    try {
      const outcomes = await Promise.allSettled(
        ids.map(async (productId) => {
          const response = await fetch(`/api/products/${productId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: true }),
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error ?? 'Failed to update product')
          }
          return productId
        }),
      )

      const successIds: string[] = []
      const failures: Array<{ productId: string; message: string }> = []

      outcomes.forEach((result, index) => {
        const productId = ids[index]
        if (result.status === 'fulfilled') {
          successIds.push(productId)
        } else {
          const message =
            result.reason instanceof Error ? result.reason.message : 'Unexpected error'
          failures.push({ productId, message })
        }
      })

      if (successIds.length > 0) {
        const successSet = new Set(successIds)
        setProducts((previous) =>
          previous.map((product) =>
            successSet.has(product.id) ? { ...product, active: true } : product,
          ),
        )
        showSuccess(
          `Marked ${successIds.length} product${successIds.length === 1 ? '' : 's'} active`,
          'The selected products are now active.',
        )
      }

      if (failures.length > 0) {
        const nameMap = new Map(products.map((product) => [product.id, product.productNameHouse || product.productNameVendor || 'Product']))
        const detail = failures
          .map((item) => `${nameMap.get(item.productId) || 'Product'}: ${item.message}`)
          .join('; ')
        showError('Failed to update some products', detail)
      }

      setSelectedProducts((previous) => previous.filter((id) => !ids.includes(id)))
      reloadProducts()
    } finally {
      setBulkActionLoading(false)
    }
  }, [products, reloadProducts, showError, showSuccess])

  const handleBulkDeactivateProducts = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      showError('No products selected', 'Select at least one product to update.')
      return
    }

    setBulkActionLoading(true)

    try {
      const outcomes = await Promise.allSettled(
        ids.map(async (productId) => {
          const response = await fetch(`/api/products/${productId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: false }),
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error ?? 'Failed to update product')
          }
          return productId
        }),
      )

      const successIds: string[] = []
      const failures: Array<{ productId: string; message: string }> = []

      outcomes.forEach((result, index) => {
        const productId = ids[index]
        if (result.status === 'fulfilled') {
          successIds.push(productId)
        } else {
          const message =
            result.reason instanceof Error ? result.reason.message : 'Unexpected error'
          failures.push({ productId, message })
        }
      })

      if (successIds.length > 0) {
        const successSet = new Set(successIds)
        setProducts((previous) =>
          previous.map((product) =>
            successSet.has(product.id) ? { ...product, active: false } : product,
          ),
        )
        showSuccess(
          `Marked ${successIds.length} product${successIds.length === 1 ? '' : 's'} inactive`,
          'The selected products are now inactive.',
        )
      }

      if (failures.length > 0) {
        const nameMap = new Map(products.map((product) => [product.id, product.productNameHouse || product.productNameVendor || 'Product']))
        const detail = failures
          .map((item) => `${nameMap.get(item.productId) || 'Product'}: ${item.message}`)
          .join('; ')
        showError('Failed to update some products', detail)
      }

      setSelectedProducts((previous) => previous.filter((id) => !ids.includes(id)))
      reloadProducts()
    } finally {
      setBulkActionLoading(false)
    }
  }, [products, reloadProducts, showError, showSuccess])
  const handleBulkExportCsv = useCallback(() => {
    const rows = selectedProducts.length > 0
      ? products.filter((row) => selectedProducts.includes(row.id))
      : products

    if (rows.length === 0) {
      showError('Nothing to export', 'There are no products to export.')
      return
    }

    const header = [
      'Distributor Name',
      'Vendor Name',
      'Product Family - Vendor',
      'Product Subtype - Vendor',
      'Product Name - Vendor',
      'Product Name - House',
      'Part Number - Vendor',
      'Quantity',
      'Price Each',
      'Expected Commission Rate %',
      'Revenue Schedule Periods',
      'Revenue Schedule Estimated Start Date',
      'Revenue Type',
      'Active (Y/N)',
    ]

    const lines = [header.join(',')]

    rows.forEach((row) => {
      const cells = [
        row.distributorName,
        row.vendorName,
        row.productFamilyVendor,
        row.productSubtypeVendor,
        row.productNameVendor,
        row.productNameHouse,
        row.partNumberVendor,
        row.quantity === null || row.quantity === undefined ? '' : String(row.quantity),
        formatCurrency(row.priceEach ?? 0),
        formatPercent(row.commissionPercent ?? 0),
        row.revenueSchedulePeriods === null || row.revenueSchedulePeriods === undefined ? '' : String(row.revenueSchedulePeriods),
        formatIsoDate(row.revenueScheduleEstimatedStartDate),
        row.revenueType,
        row.active ? 'Yes' : 'No',
      ]

      lines.push(
        cells
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
    })

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0]
    link.href = url
    link.download = `products-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    showSuccess(
      `Exported ${rows.length} product${rows.length === 1 ? '' : 's'}`,
      'Check your downloads for the CSV file.',
    )
  }, [products, selectedProducts, showError, showSuccess])
  const tableColumns = useMemo(() => {
    return normalizedPreferenceColumns.map((column) => {
      if (column.id === 'multi-action') {
        return {
          ...column,
          render: (_: unknown, row: ProductRow) => {
            const checked = selectedProducts.includes(row.id)
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <label
                  className="flex cursor-pointer items-center justify-center"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    aria-label={`Select product ${row.productNameHouse || row.productNameVendor || row.id}`}
                    onChange={() => handleSelectProduct(row.id, !checked)}
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
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleProductToggleActive(row, !row.active)
                  }}
                  className="relative inline-flex cursor-pointer items-center rounded-full transition-colors"
                  title={row.active ? 'Active' : 'Inactive'}
                >
                  <span
                    className={`h-5 w-9 rounded-full transition-colors duration-300 ease-in-out ${
                      row.active ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ease-in-out ${
                        row.active ? 'translate-x-4' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </button>
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    className="rounded p-1 text-blue-500 transition-colors hover:text-blue-700"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      handleRowClick(row)
                    }}
                    aria-label="Edit product"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className={`rounded p-1 transition-colors ${row.active ? 'text-red-500 hover:text-red-700' : 'text-gray-400 hover:text-gray-600'}`}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      requestProductDelete(row)
                    }}
                    aria-label={row.active ? 'Delete product' : 'Manage product'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          },
        }
      }

      if (column.id === 'priceEach') {
        return {
          ...column,
          render: (value: unknown) => formatCurrency(typeof value === 'number' ? value : Number(value) || 0),
        }
      }

      if (column.id === 'commissionPercent') {
        return {
          ...column,
          render: (value: unknown) => formatPercent(typeof value === 'number' ? value : Number(value) || 0),
        }
      }

      if (column.id === 'revenueScheduleEstimatedStartDate') {
        return {
          ...column,
          render: (value: unknown) => formatIsoDate(typeof value === 'string' ? value : null),
        }
      }

      if (column.id === 'active') {
        return {
          ...column,
          render: (value: unknown) => (value ? 'Yes' : 'No'),
        }
      }

      return column
    })
  }, [
    handleProductToggleActive,
    handleRowClick,
    handleSelectProduct,
    normalizedPreferenceColumns,
    requestProductDelete,
    selectedProducts,
  ])

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
        pageTitle="PRODUCTS LIST"
        searchPlaceholder="Search products..."
        onSearch={handleSearch}
        onFilterChange={handleStatusFilterChange}
        onCreateClick={() => showWarning('Create coming soon', 'Product creation is not available yet.')}
        onSettingsClick={() => setShowColumnSettings(true)}
        filterColumns={PRODUCT_FILTER_OPTIONS}
        columnFilters={columnFilters}
        onColumnFiltersChange={handleColumnFiltersChange}
        statusFilter={statusFilter}
        hasUnsavedTableChanges={hasUnsavedChanges}
        isSavingTableChanges={preferenceSaving}
        lastTableSaved={lastSaved || undefined}
        onSaveTableChanges={saveChanges}
      />

      {(error || preferenceError) && (
        <div className="px-4 text-sm text-red-600">{error || preferenceError}</div>
      )}

      <div className="flex-1 min-h-0 p-4 pt-0 flex flex-col gap-4">
        <div className="flex-shrink-0">
          <ProductBulkActionBar
            count={selectedProducts.length}
            disabled={bulkActionLoading}
            onDelete={() => openDeleteDialog(products.filter((row) => selectedProducts.includes(row.id)))}
            onExportCsv={handleBulkExportCsv}
            onActivate={() => handleBulkActivateProducts(selectedProducts)}
            onDeactivate={() => handleBulkDeactivateProducts(selectedProducts)}
          />
        </div>

        <div ref={tableAreaRef} className="flex-1 min-h-0">
          <DynamicTable
            columns={tableColumns}
            data={products}
            onSort={handleSort}
            onRowClick={(row) => handleRowClick(row as ProductRow)}
            loading={tableLoading}
            emptyMessage="No products found"
            onColumnsChange={handleColumnsChange}
            pagination={pagination}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            selectedItems={selectedProducts}
            onItemSelect={(id, selected) => handleSelectProduct(String(id), selected)}
            onSelectAll={handleSelectAll}
            autoSizeColumns={false}
            alwaysShowPagination
            maxBodyHeight={tableBodyHeight}
          />
        </div>
      </div>

      <ColumnChooserModal
        isOpen={showColumnSettings}
        columns={normalizedPreferenceColumns}
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
        entityId={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets[0]?.id ?? ''
            : productToDelete?.id ?? ''
        }
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((product) => ({
                id: product.id,
                name: product.productNameHouse || product.productNameVendor || 'Product',
              }))
            : undefined
        }
        entityLabelPlural="Products"
        isDeleted={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.every((product) => !product.active)
            : productToDelete ? !productToDelete.active : false
        }
        onSoftDelete={async (id) => {
          await handleProductDelete(id)
          return { success: true }
        }}
        onBulkSoftDelete={async (entities) => {
          const targets = products.filter((product) =>
            entities.some((entity) => entity.id === product.id),
          )
          const result = await executeBulkProductDelete(targets)
          return result
        }}
        onPermanentDelete={async (id) => {
          await handleProductDelete(id)
          return { success: true }
        }}
        userCanPermanentDelete
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}
