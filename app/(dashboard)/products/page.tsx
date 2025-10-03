'use client'

import { useState, useCallback, useMemo } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column, PaginationInfo } from '@/components/dynamic-table'
import { ColumnChooserModal } from '@/components/column-chooser-modal'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { TableChangeNotification } from '@/components/table-change-notification'
import { productsData } from '@/lib/mock-data'
import { Edit, Trash2, Settings, Check } from 'lucide-react'

const productColumns: Column[] = [
  {
    id: 'multi-action',
    label: 'Actions',
    width: 200,
    minWidth: 160,
    maxWidth: 240,
    type: 'multi-action',
    accessor: 'select'
  },
  {
    id: 'productNameHouse',
    label: 'Product Name - House',
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
    id: 'productNameVendor',
    label: 'Product Name - Vendor',
    width: 180,
    minWidth: 140,
    maxWidth: 300,
    sortable: true,
    type: 'text'
  },
  {
    id: 'revenueType',
    label: 'Revenue Type',
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    sortable: true,
    type: 'text'
  },
  {
    id: 'productDescriptionHouse',
    label: 'Product Description - House',
    width: 220,
    minWidth: 180,
    maxWidth: 350,
    sortable: true,
    type: 'text'
  },
  {
    id: 'commissionPercent',
    label: 'Commission %',
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: 'text'
  },
  {
    id: 'priceEachPercent',
    label: 'Price Each %',
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    sortable: true,
    type: 'text'
  }
]

export default function ProductsPage() {
  const [products, setProducts] = useState(productsData)
  const [filteredProducts, setFilteredProducts] = useState(productsData)
  const [loading, setLoading] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
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
  } = useTablePreferences("products:list", productColumns)

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setFilteredProducts(products)
      return
    }

    const filtered = products.filter(product =>
      Object.values(product).some(value =>
        value.toString().toLowerCase().includes(query.toLowerCase())
      )
    )
    setFilteredProducts(filtered)
  }

  const handleSort = (columnId: string, direction: 'asc' | 'desc') => {
    const sorted = [...filteredProducts].sort((a, b) => {
      const aValue = a[columnId as keyof typeof a]
      const bValue = b[columnId as keyof typeof b]
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })
    
    setFilteredProducts(sorted)
  }

  const handleRowClick = useCallback((product: any) => {
    console.log('Product clicked:', product)
    // Navigate to product detail page or open modal
  }, [])

  const handleCreateProduct = () => {
    console.log('Create new product')
    // Open create product modal or navigate to create page
  }

  const handleFilterChange = (filter: string) => {
    // Products don't seem to have an active filter in the screenshot
    setFilteredProducts(products)
  }

  const handleSelectProduct = (productId: number, selected: boolean) => {
    if (selected) {
      setSelectedProducts(prev => [...prev, productId])
    } else {
      setSelectedProducts(prev => prev.filter(id => id !== productId))
    }
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedProducts(filteredProducts.map(product => product.id))
    } else {
      setSelectedProducts([])
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
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredProducts.slice(startIndex, endIndex)
  }, [filteredProducts, currentPage, pageSize])

  // Calculate pagination info
  const paginationInfo = useMemo((): PaginationInfo => {
    const totalItems = filteredProducts.length
    const totalPages = Math.ceil(totalItems / pageSize)

    return {
      page: currentPage,
      totalPages,
      pageSize,
      total: totalItems,
    }
  }, [filteredProducts.length, currentPage, pageSize])

  const tableLoading = loading || preferenceLoading
  const tableColumns = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === 'multi-action') {
        return {
          ...column,
          render: (_: unknown, row: any) => {
            const rowId = Number(row.id)
            const checked = selectedProducts.includes(rowId)
            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                <label className="flex cursor-pointer items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    aria-label={`Select product ${row.productNameHouse || rowId}`}
                    onChange={() => handleSelectProduct(rowId, !checked)}
                  />
                  <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${checked ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>
                <div className="flex gap-0.5">
                  <button type="button" className="p-1 text-blue-500 hover:text-blue-700 transition-colors rounded" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} aria-label="Edit product">
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className={`p-1 rounded transition-colors text-red-500 hover:text-red-700`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} aria-label={'Delete product'}>
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
  }, [preferenceColumns, selectedProducts, handleSelectProduct])
  
  // Get hidden columns by comparing all columns with visible ones
  const hiddenColumns = useMemo(() => {
    return productColumns
      .filter(col => !tableColumns.some(visibleCol => visibleCol.id === col.id))
      .map(col => col.id)
  }, [tableColumns])

  // Update products data to include selection state
  const productsWithSelection = paginatedProducts.map(product => ({
    ...product,
    select: selectedProducts.includes(product.id)
  }))

  return (
    <div className="dashboard-page-container">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Page Title */}
          <h1 className="text-xl font-semibold text-blue-600">Products List</h1>

          {/* Left side - Search */}
          <div className="flex items-center flex-1 max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search products..."
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
              onClick={handleCreateProduct}
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
        </div>
      </div>

      {preferenceError && (
        <div className="px-4 text-sm text-red-600">{preferenceError}</div>
      )}

      {/* Table */}
      <div className="flex-1 p-4 min-h-0">
        <DynamicTable
          columns={tableColumns}
          data={productsWithSelection}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={tableLoading}
          emptyMessage="No products found"
          onColumnsChange={handleColumnsChange}
          selectedItems={selectedProducts.map(String)}
          onItemSelect={(id, selected) => handleSelectProduct(Number(id), selected)}
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
