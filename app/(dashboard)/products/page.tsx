'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ListHeader, type ColumnFilter } from '@/components/list-header'
import { DynamicTable, type Column, type PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { CopyProtectionWrapper } from '@/components/copy-protection'
import { TwoStageDeleteDialog } from '@/components/two-stage-delete-dialog'
import { ProductCreateModal } from '@/components/product-create-modal'
import { useToasts } from '@/components/toast'
import { Check, Download, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react'
import { isRowInactive } from '@/lib/row-state'
import { calculateMinWidth } from '@/lib/column-width-utils'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { getRevenueTypeLabel } from '@/lib/revenue-types'
import type { BulkActionsGridProps } from '@/components/bulk-actions-grid'
import { RevenueBulkApplyPanel } from '@/components/revenue-bulk-apply-panel'

const PRODUCT_FILTER_OPTIONS = [
  { id: 'productNameVendor', label: 'Other - Product Name' },
  { id: 'productNameHouse', label: 'House - Product Name' },
  { id: 'distributorName', label: 'Distributor Name' },
  { id: 'vendorName', label: 'Vendor Name' },
  { id: 'partNumberVendor', label: 'Other - Part Number' },
  { id: 'revenueType', label: 'Revenue Type' },
  { id: 'active', label: 'Active (Y/N)' },
  { id: 'hasRevenueSchedules', label: 'Has Revenue Schedules (Y/N)' },
]

const BASE_COLUMNS: Column[] = [
  {
    id: 'multi-action',
    label: 'Select All',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Select All', type: 'multi-action', sortable: false }),
    maxWidth: 240,
    type: 'multi-action',
  },
  {
    id: 'distributorName',
    label: 'Distributor Name',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Distributor Name', type: 'text', sortable: true }),
    maxWidth: 280,
    sortable: true,
    accessor: 'distributorName',
  },
  {
    id: 'vendorName',
    label: 'Vendor Name',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Vendor Name', type: 'text', sortable: true }),
    maxWidth: 280,
    sortable: true,
    accessor: 'vendorName',
  },
  {
    id: 'productNameVendor',
    label: 'Other - Product Name',
    width: 240,
    minWidth: calculateMinWidth({ label: 'Other - Product Name', type: 'text', sortable: true }),
    maxWidth: 360,
    sortable: true,
    accessor: 'productNameVendor',
  },
  {
    id: 'partNumberVendor',
    label: 'Other - Part Number',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Other - Part Number', type: 'text', sortable: false }),
    maxWidth: 280,
    accessor: 'partNumberVendor',
    hidden: true,
  },
  {
    id: 'productNameHouse',
    label: 'House - Product Name',
    width: 240,
    minWidth: calculateMinWidth({ label: 'House - Product Name', type: 'text', sortable: true }),
    maxWidth: 360,
    sortable: true,
    accessor: 'productNameHouse',
  },
  {
    id: 'productDescriptionHouse',
    label: 'House - Product Description',
    width: 260,
    minWidth: calculateMinWidth({ label: 'House - Product Description', type: 'text', sortable: false }),
    maxWidth: 400,
    accessor: 'productDescriptionHouse',
    hidden: true,
  },
  {
    id: 'productDescriptionVendor',
    label: 'Other - Product Description',
    width: 260,
    minWidth: calculateMinWidth({ label: 'Other - Product Description', type: 'text', sortable: false }),
    maxWidth: 400,
    accessor: 'productDescriptionVendor',
    hidden: true,
  },
  {
    id: 'quantity',
    label: 'Quantity',
    width: 140,
    minWidth: calculateMinWidth({ label: 'Quantity', type: 'text', sortable: false }),
    maxWidth: 200,
    accessor: 'quantity',
    hidden: true,
  },
  {
    id: 'priceEach',
    label: 'Price Each',
    width: 140,
    minWidth: calculateMinWidth({ label: 'Price Each', type: 'text', sortable: true }),
    maxWidth: 200,
    sortable: true,
    accessor: 'priceEach',
  },
  {
    id: 'commissionPercent',
    label: 'Expected Commission Rate %',
    width: 200,
    minWidth: calculateMinWidth({ label: 'Expected Commission Rate %', type: 'text', sortable: true }),
    maxWidth: 260,
    sortable: true,
    accessor: 'commissionPercent',
  },
  {
    id: 'active',
    label: 'Active (Y/N)',
    width: 140,
    minWidth: calculateMinWidth({ label: 'Active (Y/N)', type: 'text', sortable: true }),
    maxWidth: 200,
    accessor: 'active',
    sortable: true,
    hidden: true,
  },
  {
    id: 'revenueSchedulePeriods',
    label: 'Revenue Schedule Periods',
    width: 220,
    minWidth: calculateMinWidth({ label: 'Revenue Schedule Periods', type: 'text', sortable: false }),
    maxWidth: 300,
    accessor: 'revenueSchedulePeriods',
    hidden: true,
  },
  {
    id: 'revenueScheduleEstimatedStartDate',
    label: 'Revenue Schedule Estimated Start Date',
    width: 260,
    minWidth: calculateMinWidth({ label: 'Revenue Schedule Estimated Start Date', type: 'text', sortable: false }),
    maxWidth: 360,
    accessor: 'revenueScheduleEstimatedStartDate',
    hidden: true,
  },
  {
    id: 'revenueType',
    label: 'Revenue Type',
    width: 180,
    minWidth: calculateMinWidth({ label: 'Revenue Type', type: 'text', sortable: true }),
    maxWidth: 260,
    sortable: true,
    accessor: 'revenueType',
    render: (value: string) => getRevenueTypeLabel(value) ?? value ?? '--',
  },
]

interface ProductRow {
  id: string
  select?: boolean
  active: boolean
  distributorId?: string | null
  distributorName: string
  vendorId?: string | null
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
  revenueTypeLabel?: string
  hasRevenueSchedules: boolean
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
  pageSize: 100,
  total: 0,
  totalPages: 1,
}

const TABLE_BOTTOM_RESERVE = 110
const TABLE_MIN_BODY_HEIGHT = 320

type ProductEditableColumnId = 'priceEach' | 'commissionPercent'

type ProductFillDownPrompt = {
  columnId: ProductEditableColumnId
  label: string
  value: number
  rowId: string
  selectedCount: number
  anchor: { top: number; left: number }
}

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
  const normalized = value > 1 ? value : value * 100
  return `${normalized.toFixed(2)}%`
}

function getEditableDisplayValue(columnId: ProductEditableColumnId, rowValue: unknown): number {
  if (columnId === 'commissionPercent') {
    const fraction = typeof rowValue === 'number' ? rowValue : Number(rowValue) || 0
    return fraction * 100
  }
  return typeof rowValue === 'number' ? rowValue : Number(rowValue) || 0
}

function normaliseProductEditValue(columnId: ProductEditableColumnId, value: number): number | null {
  if (!Number.isFinite(value)) return null
  switch (columnId) {
    case 'priceEach': {
      const next = Math.max(0, value)
      return Number(next.toFixed(2))
    }
    case 'commissionPercent': {
      const next = Math.max(0, value)
      return Number(next.toFixed(2))
    }
    default:
      return null
  }
}

const normalizePageSize = (value: number): number => {
  if (!Number.isFinite(value)) return 100
  return Math.min(100, Math.max(1, Math.floor(value)))
}

function formatIsoDate(value?: string | null) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
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
  const [productBulkPrompt, setProductBulkPrompt] = useState<ProductFillDownPrompt | null>(null)
  const [productBulkApplying, setProductBulkApplying] = useState(false)
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false)
  const [bulkStatusChoice, setBulkStatusChoice] = useState<'active' | 'inactive'>('active')
  const [bulkStatusSubmitting, setBulkStatusSubmitting] = useState(false)

  const selectedProductRows = useMemo(() => {
    if (selectedProducts.length === 0) {
      return []
    }
    return products.filter(row => selectedProducts.includes(row.id))
  }, [products, selectedProducts])
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { showError, showSuccess, showWarning, ToastContainer } = useToasts()
  const { user } = useAuth()
  const roleCode = user?.role?.code?.toLowerCase() ?? ''
  const canEditProducts = roleCode === 'admin' || roleCode.includes('admin')
  const requireAdminForEdit = useCallback(() => {
    showError('Admin access required', 'Only Admins can modify existing products.')
  }, [showError])

  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    error: preferenceError,
    saving: preferenceSaving,
    pageSize: preferencePageSize,
    hasUnsavedChanges,
    lastSaved,
    handleColumnsChange,
    handlePageSizeChange: persistPageSizePreference,
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

  const handleStatusFilterChange = useCallback((value: string) => {
    let next: 'active' | 'inactive' | 'all'
    if (value === 'inactive') {
      next = 'inactive'
    } else if (value === 'all') {
      next = 'all'
    } else {
      next = 'active'
    }
    setStatusFilter(next)
    setCurrentPage(1)
  }, [])

  const handleColumnFiltersChange = useCallback((filters: ColumnFilter[]) => {
    setColumnFilters(filters)
    setCurrentPage(1)
  }, [])

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

  const handlePageSizeChange = useCallback((size: number) => {
    const normalized = normalizePageSize(size)
    setPageSize(normalized)
    setCurrentPage(1)
    void persistPageSizePreference(normalized)
  }, [persistPageSizePreference])

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
    if (!canEditProducts) {
      requireAdminForEdit()
      return
    }

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
  }, [canEditProducts, reloadProducts, requireAdminForEdit, showError, showSuccess])

  const deactivateProductRequest = useCallback(async (
    productId: string,
    _reason?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!canEditProducts) {
      requireAdminForEdit()
      return { success: false, error: 'Admin access required' }
    }

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        return { success: false, error: payload?.error ?? 'Failed to deactivate product' }
      }

      setProducts((previous) =>
        previous.map((product) =>
          product.id === productId ? { ...product, active: false } : product,
        ),
      )
      showSuccess('Product deactivated', 'The product was marked inactive.')
      await reloadProducts()
      return { success: true }
    } catch (err) {
      console.error('Failed to deactivate product', err)
      const message = err instanceof Error ? err.message : 'Please try again later.'
      showError('Unable to deactivate product', message)
      return { success: false, error: message }
    }
  }, [canEditProducts, reloadProducts, requireAdminForEdit, showError, showSuccess])

  const bulkDeactivateProductsRequest = useCallback(async (
    entities: Array<{ id: string; name: string }>,
    _reason?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!canEditProducts) {
      requireAdminForEdit()
      return { success: false, error: 'Admin access required' }
    }

    if (!entities || entities.length === 0) {
      return { success: false, error: 'No products selected' }
    }

    setBulkActionLoading(true)

    try {
      const outcomes = await Promise.allSettled(
        entities.map(async (entity) => {
          const response = await fetch(`/api/products/${entity.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: false }),
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            throw new Error(payload?.error ?? 'Failed to deactivate product')
          }

          return entity.id
        }),
      )

      const failures: Array<{ id: string; name: string; message: string }> = []
      const successIds: string[] = []

      outcomes.forEach((result, index) => {
        const entity = entities[index]
        if (result.status === 'fulfilled') {
          successIds.push(result.value)
        } else {
          const message = result.reason instanceof Error ? result.reason.message : 'Unexpected error'
          failures.push({ id: entity.id, name: entity.name, message })
        }
      })

      if (successIds.length > 0) {
        const successSet = new Set(successIds)
        setProducts((previous) =>
          previous.map((product) =>
            successSet.has(product.id) ? { ...product, active: false } : product,
          ),
        )
        setSelectedProducts((previous) => previous.filter((id) => !successSet.has(id)))
        showSuccess(
          `Deactivated ${successIds.length} product${successIds.length === 1 ? '' : 's'}`,
          'Selected products were marked inactive.',
        )
        await reloadProducts()
      }

      if (failures.length > 0) {
        const detail = failures
          .slice(0, 5)
          .map((item) => `${item.name || item.id.slice(0, 8) + '...'}: ${item.message}`)
          .join('; ')
        const message = failures.length > 5 ? `${detail}; and ${failures.length - 5} more` : detail
        showError('Some products could not be deactivated', message)
        return { success: false, error: message }
      }

      return { success: true }
    } finally {
      setBulkActionLoading(false)
    }
  }, [canEditProducts, reloadProducts, requireAdminForEdit, showError, showSuccess])

  const handleProductDelete = useCallback(async (
    productId: string,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!canEditProducts) {
      requireAdminForEdit()
      return { success: false, error: 'Admin access required' }
    }

    try {
      const trimmedReason = typeof reason === 'string' ? reason.trim() : ''
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
        ...(trimmedReason
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason: trimmedReason }),
            }
          : {}),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        return { success: false, error: payload?.error ?? 'Failed to delete product' }
      }

      setProducts((previous) => previous.filter((product) => product.id !== productId))
      setSelectedProducts((previous) => previous.filter((id) => id !== productId))
      showSuccess('Product deleted', 'The product has been removed.')
      await reloadProducts()
      return { success: true }
    } catch (err) {
      console.error('Failed to delete product', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Please try again later.',
      }
    }
  }, [canEditProducts, reloadProducts, requireAdminForEdit, showSuccess])

  const openDeleteDialog = useCallback((targets: ProductRow[]) => {
    if (!canEditProducts) {
      requireAdminForEdit()
      return
    }

    if (!targets || targets.length === 0) {
      showError('No products selected', 'Select at least one product to delete.')
      return
    }

    const activeTargets = targets.filter((product) => product.active)
    if (activeTargets.length > 0) {
      showWarning(
        'Some products are active',
        'Active products cannot be deleted. Choose Deactivate in the dialog to mark them inactive first.',
      )
    }

    setBulkDeleteTargets(targets)
    setProductToDelete(null)
    setShowDeleteDialog(true)
  }, [canEditProducts, requireAdminForEdit, showError, showWarning])

  const requestProductDelete = useCallback((product: ProductRow) => {
    if (!canEditProducts) {
      requireAdminForEdit()
      return
    }

    setBulkDeleteTargets([])
    setProductToDelete(product)
    setShowDeleteDialog(true)
  }, [canEditProducts, requireAdminForEdit])

  const closeDeleteDialog = useCallback(() => {
    setShowDeleteDialog(false)
    setBulkDeleteTargets([])
    setProductToDelete(null)
  }, [])
  const executeBulkProductDelete = useCallback(async (
    targets: ProductRow[],
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!canEditProducts) {
      requireAdminForEdit()
      return { success: false, error: 'Admin access required' }
    }

    if (!targets || targets.length === 0) {
      showError('No products selected', 'Select at least one product to delete.')
      return { success: false, error: 'No products selected' }
    }

    setBulkActionLoading(true)

    try {
      const trimmedReason = typeof reason === 'string' ? reason.trim() : ''
      const outcomes = await Promise.allSettled(
        targets.map(async (target) => {
          const response = await fetch(`/api/products/${target.id}`, {
            method: 'DELETE',
            ...(trimmedReason
              ? {
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reason: trimmedReason }),
                }
              : {}),
          })
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
  }, [canEditProducts, reloadProducts, requireAdminForEdit, showError, showSuccess])

  const handleBulkActivateProducts = useCallback(async (ids: string[]) => {
    if (!canEditProducts) {
      requireAdminForEdit()
      return
    }

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
  }, [canEditProducts, products, reloadProducts, requireAdminForEdit, showError, showSuccess])

  const handleBulkDeactivateProducts = useCallback(async (ids: string[]) => {
    if (!canEditProducts) {
      requireAdminForEdit()
      return
    }

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
  }, [canEditProducts, products, reloadProducts, requireAdminForEdit, showError, showSuccess])

  const openBulkStatusModal = useCallback(() => {
    if (selectedProductRows.length === 0) {
      showError('No products selected', 'Select at least one product to update.')
      return
    }
    setBulkStatusChoice('active')
    setShowBulkStatusModal(true)
  }, [selectedProductRows, showError])

  const closeBulkStatusModal = useCallback(() => {
    if (bulkStatusSubmitting) return
    setShowBulkStatusModal(false)
  }, [bulkStatusSubmitting])

  const handleConfirmBulkStatusChange = useCallback(async () => {
    if (selectedProducts.length === 0) {
      showError('No products selected', 'Select at least one product to update.')
      setShowBulkStatusModal(false)
      return
    }

    setBulkStatusSubmitting(true)
    try {
      if (bulkStatusChoice === 'active') {
        await handleBulkActivateProducts(selectedProducts)
      } else {
        await handleBulkDeactivateProducts(selectedProducts)
      }
      setShowBulkStatusModal(false)
    } finally {
      setBulkStatusSubmitting(false)
    }
  }, [
    bulkStatusChoice,
    handleBulkActivateProducts,
    handleBulkDeactivateProducts,
    selectedProducts,
    showError,
  ])
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
      'Other - Product Name',
      'House - Product Name',
      'Other - Part Number',
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
        row.productNameVendor,
        row.productNameHouse,
        row.partNumberVendor,
        row.quantity === null || row.quantity === undefined ? '' : String(row.quantity),
        formatCurrency(row.priceEach ?? 0),
        formatPercent(row.commissionPercent ?? 0),
        row.revenueSchedulePeriods === null || row.revenueSchedulePeriods === undefined ? '' : String(row.revenueSchedulePeriods),
        formatIsoDate(row.revenueScheduleEstimatedStartDate),
        getRevenueTypeLabel(row.revenueType) ?? row.revenueType ?? '',
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

  const productBulkActions = useMemo<BulkActionsGridProps>(() => ({
    selectedCount: selectedProducts.length,
    isBusy: bulkActionLoading,
    entityName: 'products',
    actions: [
      {
        key: 'delete',
        label: 'Delete',
        icon: Trash2,
        tone: 'danger',
        disabled: !canEditProducts,
        tooltip: (count) => `Delete ${count} product${count === 1 ? '' : 's'}`,
        onClick: () => {
          if (selectedProductRows.length === 0) {
            showError('No products selected', 'Select at least one product to delete.')
            return
          }
          openDeleteDialog(selectedProductRows)
        },
      },
      {
        key: 'export',
        label: 'Export CSV',
        icon: Download,
        tone: 'info',
        tooltip: (count) => `Export ${count} product${count === 1 ? '' : 's'} to CSV`,
        onClick: handleBulkExportCsv,
      },
      {
        key: 'status',
        label: 'Change Status',
        icon: ToggleRight,
        tone: 'primary',
        disabled: !canEditProducts,
        tooltip: (count) => `Change status for ${count} product${count === 1 ? '' : 's'}`,
        onClick: openBulkStatusModal,
      },
    ],
  }), [
    bulkActionLoading,
    canEditProducts,
    handleBulkExportCsv,
    openBulkStatusModal,
    openDeleteDialog,
    selectedProductRows,
    selectedProducts,
    showError,
  ])

  const handleProductInlineChange = useCallback(
      async (row: ProductRow, columnId: ProductEditableColumnId, nextValue: number, rect: DOMRect | null) => {
      if (!canEditProducts) {
        requireAdminForEdit()
        return
      }

        const normalised = normaliseProductEditValue(columnId, nextValue)
        if (normalised === null) {
          return
        }
  
        const payload: Record<string, unknown> = {}
        if (columnId === 'priceEach') {
          payload.priceEach = normalised
        }
        if (columnId === 'commissionPercent') {
          const fraction = normalised === 0 ? 0 : normalised > 1 ? normalised / 100 : normalised
          payload.commissionPercent = fraction
        }
  
        try {
          const response = await fetch(`/api/products/${row.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

        if (!response.ok) {
          const body = await response.json().catch(() => null)
          const message = body?.error ?? 'Failed to update product'
          throw new Error(message)
        }

        const updated = await response.json().catch(() => null)
        const updatedData = updated?.data ?? updated

        setProducts(previous =>
          previous.map(product =>
            product.id === row.id
              ? {
                  ...product,
                  priceEach:
                    columnId === 'priceEach' ? normalised : product.priceEach,
                  commissionPercent:
                    columnId === 'commissionPercent'
                      ? (payload.commissionPercent as number)
                      : product.commissionPercent,
                }
              : product,
          ),
        )

          if (selectedProducts.length >= 1 && rect && selectedProducts.includes(row.id)) {
          setProductBulkPrompt({
            columnId,
            label: columnId === 'priceEach' ? 'Price Each' : 'Expected Commission Rate %',
            value: normalised,
            rowId: row.id,
            selectedCount: selectedProducts.length,
            anchor: {
              top: rect.bottom + 8,
              left: rect.right + 12,
            },
          })
        } else {
          setProductBulkPrompt(null)
        }

        if (!updatedData) {
          await reloadProducts()
        }
      } catch (err) {
        console.error('Failed to update product inline', err)
        const message = err instanceof Error ? err.message : 'Failed to update product'
        showError('Unable to update product', message)
      }
      },
      [canEditProducts, reloadProducts, requireAdminForEdit, selectedProducts, showError],
    )

    const productBulkDefaultEffectiveDate = useMemo(() => {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }, [])

    const productBulkPromptValueLabel = useMemo(() => {
      if (!productBulkPrompt) {
        return ''
      }
      const { columnId, value } = productBulkPrompt
      if (columnId === 'priceEach') {
        return formatCurrency(value)
      }
      if (columnId === 'commissionPercent') {
        return formatPercent(value)
      }
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    }, [productBulkPrompt])

      const handleProductApplyFillDown = useCallback(
        async (effectiveDate: string) => {
          if (!canEditProducts || !productBulkPrompt || selectedProducts.length < 1) {
            return
          }

        const columnId = productBulkPrompt.columnId
        const patch: Record<string, number> = {}

        if (columnId === 'priceEach') {
          patch.priceEach = productBulkPrompt.value
        }
        if (columnId === 'commissionPercent') {
          const fraction =
            productBulkPrompt.value === 0
              ? 0
              : productBulkPrompt.value > 1
                ? productBulkPrompt.value / 100
                : productBulkPrompt.value
          patch.commissionPercent = fraction
        }

        if (Object.keys(patch).length === 0) {
          return
        }

        setProductBulkApplying(true)
        try {
          const response = await fetch('/api/products/bulk-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ids: selectedProducts,
              patch,
              effectiveDate,
            }),
          })

          const body = await response.json().catch(() => null)
          if (!response.ok) {
            const message = body?.error ?? 'Unable to apply bulk update'
            throw new Error(message)
          }

          const updatedCount: number = body?.updated ?? selectedProducts.length
          showSuccess(
            `Applied to ${updatedCount} product${updatedCount === 1 ? '' : 's'}`,
            `${productBulkPrompt.label} updated across the selected products.`,
          )
          setProductBulkPrompt(null)
          await reloadProducts()
        } catch (error) {
          console.error('Failed to apply bulk update for products', error)
          const message = error instanceof Error ? error.message : 'Unable to apply bulk update'
          showError('Bulk update failed', message)
        } finally {
          setProductBulkApplying(false)
        }
      },
      [canEditProducts, productBulkPrompt, reloadProducts, selectedProducts, showError, showSuccess],
    )
  
    const tableColumns = useMemo(() => {
    return normalizedPreferenceColumns.map((column) => {
      if (column.id === 'multi-action') {
        return {
          ...column,
          render: (_: unknown, row: ProductRow) => {
            const checked = selectedProducts.includes(row.id)
            const selectionControl = (
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
            )

            if (!canEditProducts) {
              return (
                <div className="flex items-center" data-disable-row-click="true">
                  {selectionControl}
                </div>
              )
            }

            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                {selectionControl}
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
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      row.active ? 'bg-primary-600' : 'bg-gray-300'
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                        row.active ? 'translate-x-5' : 'translate-x-1'
                      )}
                    />
                  </span>
                </button>
                <div className="flex gap-0.5">
                  {isRowInactive(row) && !row.hasRevenueSchedules && (
                    <button
                      type="button"
                      className="rounded p-1 transition-colors text-red-500 hover:text-red-700"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        requestProductDelete(row)
                      }}
                      aria-label={'Delete product'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isRowInactive(row) && row.hasRevenueSchedules && (
                    <button
                      type="button"
                      className="rounded p-1 text-gray-300 cursor-not-allowed"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                      aria-label={'Cannot delete product with revenue schedules'}
                      title="Cannot delete a product that has revenue schedules. Mark it inactive instead."
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          },
        }
      }

      if (column.id === 'priceEach') {
          if (canEditProducts) {
            return {
              ...column,
              render: (_value: unknown, row: ProductRow) => {
                let spanRef: HTMLSpanElement | null = null
                const displayValue = getEditableDisplayValue('priceEach', row.priceEach)

              const commit = () => {
                if (!spanRef) return
                const rawText = spanRef.innerText.trim()
                if (!rawText) return
                const sanitised = rawText.replace(/[^0-9.\-]/g, '')
                  const parsed = sanitised === '' ? NaN : Number(sanitised)
                  if (Number.isNaN(parsed)) return
                  handleProductInlineChange(row, 'priceEach', parsed, spanRef.getBoundingClientRect())
                }
  
                return (
                  <span
                    ref={(node) => {
                      spanRef = node
                    }}
                    contentEditable
                    suppressContentEditableWarning
                    data-disable-row-click="true"
                    className="block min-w-0 truncate text-sm text-gray-900 focus:outline-none"
                    onFocus={() => {
                      if (!spanRef) return
                      if (!canEditProducts) {
                        requireAdminForEdit()
                        return
                      }
                      if (selectedProducts.length >= 1 && selectedProducts.includes(row.id)) {
                        setProductBulkPrompt({
                          columnId: 'priceEach',
                          label: 'Price Each',
                          value: displayValue,
                          rowId: row.id,
                          selectedCount: selectedProducts.length,
                          anchor: {
                            top: spanRef.getBoundingClientRect().bottom + 8,
                            left: spanRef.getBoundingClientRect().right + 12,
                          },
                        })
                      } else {
                        setProductBulkPrompt(null)
                      }
                    }}
                    onBlur={commit}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commit()
                    }
                  }}
                  aria-label="Edit Price Each"
                >
                  {formatCurrency(displayValue)}
                </span>
              )
            },
          }
        }
        return {
          ...column,
          render: (value: unknown) => formatCurrency(typeof value === 'number' ? value : Number(value) || 0),
        }
      }

        if (column.id === 'commissionPercent') {
          if (canEditProducts) {
            return {
              ...column,
              render: (_value: unknown, row: ProductRow) => {
                let spanRef: HTMLSpanElement | null = null
                const displayValue = getEditableDisplayValue('commissionPercent', row.commissionPercent)

              const commit = () => {
                if (!spanRef) return
                const rawText = spanRef.innerText.trim()
                if (!rawText) return
                const sanitised = rawText.replace(/[^0-9.\-]/g, '')
                  const parsed = sanitised === '' ? NaN : Number(sanitised)
                  if (Number.isNaN(parsed)) return
                  handleProductInlineChange(row, 'commissionPercent', parsed, spanRef.getBoundingClientRect())
                }
  
                const normalized = displayValue > 1 ? displayValue / 100 : displayValue
              const formatted = normalized.toLocaleString('en-US', {
                style: 'percent',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })

                return (
                  <span
                    ref={(node) => {
                      spanRef = node
                    }}
                    contentEditable
                    suppressContentEditableWarning
                    data-disable-row-click="true"
                    className="block min-w-0 truncate text-sm text-gray-900 focus:outline-none"
                    onFocus={() => {
                      if (!spanRef) return
                      if (!canEditProducts) {
                        requireAdminForEdit()
                        return
                      }
                      if (selectedProducts.length >= 1 && selectedProducts.includes(row.id)) {
                        setProductBulkPrompt({
                          columnId: 'commissionPercent',
                          label: 'Expected Commission Rate %',
                          value: displayValue,
                          rowId: row.id,
                          selectedCount: selectedProducts.length,
                          anchor: {
                            top: spanRef.getBoundingClientRect().bottom + 8,
                            left: spanRef.getBoundingClientRect().right + 12,
                          },
                        })
                      } else {
                        setProductBulkPrompt(null)
                      }
                    }}
                    onBlur={commit}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commit()
                    }
                  }}
                  aria-label="Edit Expected Commission Rate %"
                >
                  {formatted}
                </span>
              )
            },
          }
        }
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

      if (column.id === 'distributorName') {
        return {
          ...column,
          render: (value: unknown, row: ProductRow) => {
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
          render: (value: unknown, row: ProductRow) => {
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

      if (column.id === 'productNameVendor') {
        return {
          ...column,
          render: (value: unknown, _row: ProductRow) => {
            const displayValue =
              value === null || value === undefined ? '--' : typeof value === 'string' ? value : String(value)

            return <span className="font-medium text-gray-900">{displayValue}</span>
          },
        }
      }

      if (column.id === 'productNameHouse') {
        return {
          ...column,
          render: (value: unknown, row: ProductRow) => {
            const displayValue =
              value === null || value === undefined ? '--' : typeof value === 'string' ? value : String(value)

            return (
              <Link
                href={`/products/${row.id}`}
                className="font-medium text-primary-700 hover:text-primary-800 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {displayValue}
              </Link>
            )
          },
        }
      }

      return column
    })
  }, [
    canEditProducts,
    handleProductToggleActive,
    handleSelectProduct,
    normalizedPreferenceColumns,
      requestProductDelete,
      selectedProducts,
      handleProductInlineChange,
      requireAdminForEdit,
      setProductBulkPrompt,
    ])

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
        pageTitle="CATALOG"
        searchPlaceholder="Search products..."
        onSearch={handleSearch}
        onFilterChange={handleStatusFilterChange}
        statusFilterOptions={['active', 'inactive']}
        onCreateClick={() => setShowCreateModal(true)}
        onSettingsClick={() => setShowColumnSettings(true)}
        filterColumns={PRODUCT_FILTER_OPTIONS}
        columnFilters={columnFilters}
        onColumnFiltersChange={handleColumnFiltersChange}
        statusFilter={statusFilter}
        hasUnsavedTableChanges={hasUnsavedChanges}
        isSavingTableChanges={preferenceSaving}
        lastTableSaved={lastSaved || undefined}
        onSaveTableChanges={saveChanges}
        bulkActions={productBulkActions}
      />

      {(error || preferenceError) && (
        <div className="px-4 text-sm text-red-600">{error || preferenceError}</div>
      )}

      <div className="flex-1 min-h-0 p-4 pt-0 flex flex-col gap-4">
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

      {canEditProducts ? (
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
          onDeactivate={deactivateProductRequest}
          onBulkDeactivate={bulkDeactivateProductsRequest}
          onSoftDelete={async (id, _bypassConstraints, reason) => {
            const result = await handleProductDelete(id, reason)
            return result.success ? { success: true } : { success: false, error: result.error }
          }}
          onBulkSoftDelete={async (entities, _bypassConstraints, reason) => {
            const targets = products.filter((product) =>
              entities.some((entity) => entity.id === product.id),
            )
            const result = await executeBulkProductDelete(targets, reason)
            return result
          }}
          onPermanentDelete={async (id, reason) => {
            const result = await handleProductDelete(id, reason)
            return result
          }}
          userCanPermanentDelete
          disallowActiveDelete={
            bulkDeleteTargets.length > 0
              ? bulkDeleteTargets.some((product) => !!product.active)
              : Boolean(productToDelete?.active)
          }
          modalSize="revenue-schedules"
          requireReason
          note="Products cannot be deleted when they are tied to revenue schedules. Only inactive products without revenue schedules can be deleted."
        />
      ) : null}

      {showBulkStatusModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                  Bulk Status Change
                </p>
                <h3 className="text-lg font-semibold text-gray-900">
                  Update {selectedProductRows.length} product{selectedProductRows.length === 1 ? '' : 's'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeBulkStatusModal}
                className="rounded p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close status modal"
                disabled={bulkStatusSubmitting || bulkActionLoading}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-4">
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">
                  <input
                    type="radio"
                    name="bulk-status"
                    value="active"
                    checked={bulkStatusChoice === 'active'}
                    onChange={() => setBulkStatusChoice('active')}
                    className="h-4 w-4 text-primary-600"
                  />
                  <ToggleRight className="h-4 w-4 text-green-600" />
                  <span>Mark Active</span>
                </label>
                <label className="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">
                  <input
                    type="radio"
                    name="bulk-status"
                    value="inactive"
                    checked={bulkStatusChoice === 'inactive'}
                    onChange={() => setBulkStatusChoice('inactive')}
                    className="h-4 w-4 text-primary-600"
                  />
                  <ToggleLeft className="h-4 w-4 text-slate-600" />
                  <span>Mark Inactive</span>
                </label>
              </div>

              <div className="rounded-lg border border-gray-200">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                  <div className="text-sm font-medium text-gray-700">
                    Selected products ({selectedProductRows.length})
                  </div>
                  <div className="text-xs text-gray-500">
                    Current status shown for review before applying changes.
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                  {selectedProductRows.map((product) => {
                    const name =
                      product.productNameHouse || product.productNameVendor || 'Product'
                    const vendor = product.vendorName || product.distributorName || 'Vendor'
                    return (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">{name}</p>
                          <p className="truncate text-xs text-gray-500">{vendor}</p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            product.active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {product.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    )
                  })}
                  {selectedProductRows.length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-500">No products selected.</div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={closeBulkStatusModal}
                  className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={bulkStatusSubmitting || bulkActionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkStatusChange}
                  className="rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={bulkStatusSubmitting || bulkActionLoading}
                >
                  {bulkStatusSubmitting || bulkActionLoading
                    ? 'Updating...'
                    : bulkStatusChoice === 'active'
                      ? 'Mark Active'
                      : 'Mark Inactive'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ProductCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={reloadProducts}
      />

      <ToastContainer />

      <RevenueBulkApplyPanel
        isOpen={Boolean(productBulkPrompt)}
        selectedCount={selectedProducts.length}
        fieldLabel={productBulkPrompt?.label ?? ''}
        valueLabel={productBulkPromptValueLabel}
        initialEffectiveDate={productBulkDefaultEffectiveDate}
        onClose={() => setProductBulkPrompt(null)}
        onSubmit={handleProductApplyFillDown}
        onBeforeSubmit={() => {
          if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
        }}
        isSubmitting={productBulkApplying}
        entityLabelSingular="product"
        entityLabelPlural="products"
      />
    </CopyProtectionWrapper>
  )
}
