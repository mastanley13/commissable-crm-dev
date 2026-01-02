'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { ListHeader } from '@/components/list-header'
import { CopyProtectionWrapper } from '@/components/copy-protection'
import { DynamicTable, type Column, type PaginationInfo } from '@/components/dynamic-table'
import { TwoStageDeleteDialog } from '@/components/two-stage-delete-dialog'
import { useAuth } from '@/lib/auth-context'
import { useToasts } from '@/components/toast'

type ProductArchiveRow = {
  id: string
  productNameHouse: string
  productNameVendor: string
  partNumberVendor: string
  distributorName: string
  vendorName: string
  revenueTypeLabel?: string
  hasRevenueSchedules?: boolean
  active: boolean
}

export default function AdminArchivedProductsPage() {
  const { hasPermission, user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()

  const canManageArchive = hasPermission('products.read') || hasPermission('products.update') || hasPermission('products.delete')
  const userCanPermanentDelete = hasPermission('products.delete')

  const [products, setProducts] = useState<ProductArchiveRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalRecords, setTotalRecords] = useState(0)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [productToDelete, setProductToDelete] = useState<ProductArchiveRow | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<ProductArchiveRow[]>([])

  const paginationInfo: PaginationInfo = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    return {
      page,
      pageSize,
      total: totalRecords,
      totalPages,
    }
  }, [page, pageSize, totalRecords])

  const reloadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', 'inactive')
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (searchQuery.trim().length > 0) {
        params.set('q', searchQuery.trim())
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
  }, [page, pageSize, searchQuery])

  useEffect(() => {
    if (!canManageArchive) return
    reloadProducts().catch(console.error)
  }, [canManageArchive, reloadProducts])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setPage(1)
  }, [])

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
  }, [])

  const handlePageSizeChange = useCallback((nextPageSize: number) => {
    setPageSize(nextPageSize)
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

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedIds(products.map((row) => row.id))
      return
    }
    setSelectedIds([])
  }, [products])

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

  const handleRestore = useCallback(async (productId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await restoreProductRequest(productId)
    if (result.success) {
      setProducts((previous) => previous.filter((row) => row.id !== productId))
      setSelectedIds((previous) => previous.filter((id) => id !== productId))
      showSuccess('Product restored', 'The product was restored and removed from Archive.')
    }
    return result
  }, [restoreProductRequest, showSuccess])

  const handleBulkRestore = useCallback(async () => {
    if (selectedIds.length === 0) {
      showError('No products selected', 'Select at least one archived product to restore.')
      return
    }

    const targets = products.filter((row) => selectedIds.includes(row.id))
    if (targets.length === 0) {
      showError('Products unavailable', 'Unable to locate the selected products. Refresh and try again.')
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
        setProducts((previous) => previous.filter((row) => !restoredSet.has(row.id)))
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
  }, [products, restoreProductRequest, selectedIds, showError, showSuccess])

  const handlePermanentDelete = useCallback(async (
    productId: string,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> => {
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
  }, [])

  const requestRowDeletion = useCallback((row: ProductArchiveRow) => {
    setBulkDeleteTargets([])
    setProductToDelete(row)
    setShowDeleteDialog(true)
  }, [])

  const openBulkPermanentDeleteDialog = useCallback(() => {
    if (selectedIds.length === 0) {
      showError('No products selected', 'Select at least one archived product to permanently delete.')
      return
    }

    const targets = products.filter((row) => selectedIds.includes(row.id))
    if (targets.length === 0) {
      showError('Products unavailable', 'Unable to locate the selected products. Refresh and try again.')
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
  }, [bulkActionLoading, handleBulkRestore, openBulkPermanentDeleteDialog, selectedIds.length, userCanPermanentDelete])

  const columns: Column[] = useMemo(() => {
    return [
      { id: 'select', label: 'Select', width: 70, type: 'checkbox', resizable: false, hideable: false },
      {
        id: 'productNameHouse',
        label: 'Product (House)',
        width: 260,
        sortable: true,
        render: (value: string, row: ProductArchiveRow) => (
          <Link href={`/products/${row.id}`} className="text-blue-600 hover:underline">
            {value || row.productNameVendor || '--'}
          </Link>
        ),
      },
      { id: 'productNameVendor', label: 'Product (Vendor)', width: 240, sortable: true },
      { id: 'partNumberVendor', label: 'Part #', width: 160, sortable: true },
      { id: 'distributorName', label: 'Distributor', width: 220, sortable: true },
      { id: 'vendorName', label: 'Vendor', width: 220, sortable: true },
      { id: 'revenueTypeLabel', label: 'Revenue Type', width: 180, sortable: true },
      {
        id: 'hasRevenueSchedules',
        label: 'Has Schedules',
        width: 120,
        sortable: true,
        render: (value: unknown) => (value ? 'Yes' : 'No'),
      },
      {
        id: 'actions',
        label: 'Actions',
        width: 140,
        resizable: false,
        render: (_value: unknown, row: ProductArchiveRow) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-50"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                handleRestore(row.id).catch(console.error)
              }}
              title="Restore product"
            >
              Restore
            </button>
            <button
              type="button"
              className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                requestRowDeletion(row)
              }}
              disabled={!userCanPermanentDelete}
              title={userCanPermanentDelete ? 'Permanently delete' : 'Insufficient permissions'}
            >
              Delete
            </button>
          </div>
        ),
      },
    ]
  }, [handleRestore, requestRowDeletion, userCanPermanentDelete])

  if (!canManageArchive) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Archived Products</h1>
        <p className="mt-2 text-sm text-gray-600">
          Access denied. You need catalog permissions to view archived products.
        </p>
        {user?.role?.name ? <p className="mt-2 text-xs text-gray-500">Role: {user.role.name}</p> : null}
      </div>
    )
  }

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
        pageTitle="ARCHIVED PRODUCTS"
        searchPlaceholder="Search archived products..."
        onSearch={handleSearch}
        showStatusFilter={false}
        showColumnFilters={false}
        showCreateButton={false}
        bulkActions={bulkActions}
      />

      {error ? <div className="px-4 text-sm text-red-600">{error}</div> : null}

      <div className="flex-1 min-h-0 p-4 pt-0 flex flex-col gap-4">
        <div className="flex-1 min-h-0">
          <DynamicTable
            columns={columns}
            data={products}
            loading={loading}
            emptyMessage="No archived products found"
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            selectedItems={selectedIds}
            onItemSelect={handleSelect}
            onSelectAll={handleSelectAll}
            fillContainerWidth
            alwaysShowPagination
          />
        </div>
      </div>

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
            ? bulkDeleteTargets[0]?.id || ''
            : productToDelete?.id || ''
        }
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((row) => ({
                id: row.id,
                name: row.productNameHouse || row.productNameVendor || 'Product',
              }))
            : undefined
        }
        entityLabelPlural="Products"
        isDeleted={true}
        onSoftDelete={async () => ({ success: false, error: 'Archived products cannot be soft deleted again.' })}
        onPermanentDelete={handlePermanentDelete}
        onRestore={handleRestore}
        userCanPermanentDelete={userCanPermanentDelete}
        modalSize="revenue-schedules"
        requireReason
        note="Legend: Archived products are inactive. Restore will return them to the Catalog. Permanent delete is irreversible and may be blocked if the product has revenue schedules."
      />

      <ToastContainer />
    </CopyProtectionWrapper>
  )
}

