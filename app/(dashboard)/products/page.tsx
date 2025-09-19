'use client'

import { useState } from 'react'
import { ListHeader } from '@/components/list-header'
import { DynamicTable, Column } from '@/components/dynamic-table'
import { productsData } from '@/lib/mock-data'
import { Edit, Trash2 } from 'lucide-react'

const productColumns: Column[] = [
  {
    id: 'select',
    label: 'Select ALL',
    width: 100,
    minWidth: 80,
    maxWidth: 120,
    type: 'checkbox',
    accessor: 'select'
  },
  {
    id: 'actions',
    label: 'Actions',
    width: 100,
    minWidth: 80,
    maxWidth: 120,
    type: 'action',
    render: () => (
      <div className="flex gap-1">
        <button className="text-blue-500 hover:text-blue-700 p-1 rounded transition-colors">
          <Edit className="h-4 w-4" />
        </button>
        <button className="text-red-500 hover:text-red-700 p-1 rounded transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    )
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

  const handleRowClick = (product: any) => {
    console.log('Product clicked:', product)
    // Navigate to product detail page or open modal
  }

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

  // Update products data to include selection state
  const productsWithSelection = filteredProducts.map(product => ({
    ...product,
    select: selectedProducts.includes(product.id)
  }))

  return (
    <div className="h-full flex flex-col">
      {/* List Header */}
      <ListHeader
        searchPlaceholder="Search Here"
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onCreateClick={handleCreateProduct}
      />

      {/* Table */}
      <div className="flex-1 p-6">
        <DynamicTable
          columns={productColumns}
          data={productsWithSelection}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={loading}
          emptyMessage="No products found"
        />
      </div>
    </div>
  )
}