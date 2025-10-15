# List Page Tables Reference Guide

**Version:** 1.0  
**Last Updated:** October 15, 2025  
**Purpose:** Standard reference for building main list pages with tables

This document provides a comprehensive reference for implementing main list pages with data tables, based on the patterns established in `app/(dashboard)/accounts/page.tsx` and `app/(dashboard)/contacts/page.tsx`.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Structure](#component-structure)
3. [State Management](#state-management)
4. [Table Configuration](#table-configuration)
5. [Data Loading Patterns](#data-loading-patterns)
6. [Search Implementation](#search-implementation)
7. [Filtering System](#filtering-system)
8. [Sorting & Pagination](#sorting--pagination)
9. [Multi-Action Column](#multi-action-column)
10. [Bulk Operations](#bulk-operations)
11. [CRUD Operations](#crud-operations)
12. [Modal Management](#modal-management)
13. [API Integration](#api-integration)
14. [Performance Optimization](#performance-optimization)
15. [UI/UX Standards](#uiux-standards)

---

## Architecture Overview

### Page Component Hierarchy

```
ListPage (e.g., AccountsPage)
├── CopyProtectionWrapper
│   ├── ListHeader
│   │   ├── Page Title
│   │   ├── Create Button
│   │   ├── Search Bar
│   │   ├── Filter Controls
│   │   ├── Column Filter Dropdown
│   │   ├── Active/All Toggle
│   │   └── Column Settings Button
│   ├── Error Display (conditional)
│   ├── Content Container
│   │   ├── BulkActionBar
│   │   └── DynamicTable
│   │       ├── Table Header (with sort)
│   │       ├── Table Body (paginated)
│   │       └── Table Footer (pagination)
│   └── Modals
│       ├── CreateModal
│       ├── EditModal
│       ├── ColumnChooserModal
│       ├── BulkOwnerModal
│       ├── BulkStatusModal
│       ├── ReassignmentModal (Accounts only)
│       └── TwoStageDeleteDialog
└── ToastContainer
```

### Key Differences: Client vs Server Pagination

#### **Accounts Page - Client-Side Pagination**
- Loads all data at once
- Filters and paginates in-memory
- Fast navigation between pages
- Best for smaller datasets (< 1000 records)

#### **Contacts Page - Server-Side Pagination**
- Loads one page at a time
- Filtering and pagination on backend
- Better for large datasets
- Lower memory footprint

---

## Component Structure

### Basic Page Setup

```typescript
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ListHeader } from "@/components/list-header"
import { DynamicTable, Column } from "@/components/dynamic-table"
import { useTablePreferences } from "@/hooks/useTablePreferences"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { useToasts } from "@/components/toast"
// ... other imports

export default function EntityListPage() {
  // Component implementation
}
```

### Row Interface

```typescript
interface EntityRow {
  id: string                    // Required: Unique identifier
  select: boolean              // For checkbox state (deprecated in favor of selectedItems)
  active: boolean              // Active/Inactive status
  status: string               // Status label
  isDeleted: boolean          // Soft delete flag
  deletedAt: string | null    // Soft delete timestamp
  
  // Entity-specific fields
  name: string
  type: string
  owner: string
  ownerId: string | null
  
  // ... additional fields
}
```

### Options Interface

```typescript
interface EntityOptions {
  // Dropdown options for create/edit forms
  entityTypes: Array<{ id: string; name: string }>
  owners: Array<{ id: string; fullName: string }>
  // ... other lookup data
}
```

---

## State Management

### Core State Variables

```typescript
// Data
const [entities, setEntities] = useState<EntityRow[]>([])
const [loading, setLoading] = useState<boolean>(true)
const [error, setError] = useState<string | null>(null)
const [options, setOptions] = useState<EntityOptions | null>(null)

// Pagination
const [page, setPage] = useState<number>(1)
const [pageSize, setPageSize] = useState<number>(25)

// Search & Filters
const [searchQuery, setSearchQuery] = useState<string>("")
const [activeFilter, setActiveFilter] = useState<'all' | 'active'>('active')
const [columnFilters, setColumnFilters] = useState<ColumnFilterState[]>([])

// Sorting
const [sortConfig, setSortConfig] = useState<{
  columnId: keyof EntityRow
  direction: 'asc' | 'desc'
} | null>(null)

// Selection
const [selectedEntities, setSelectedEntities] = useState<string[]>([])

// Modals
const [showCreateModal, setShowCreateModal] = useState<boolean>(false)
const [showEditModal, setShowEditModal] = useState<boolean>(false)
const [showColumnSettings, setShowColumnSettings] = useState<boolean>(false)
const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false)

// Bulk Actions
const [bulkActionLoading, setBulkActionLoading] = useState<boolean>(false)
const [bulkDeleteTargets, setBulkDeleteTargets] = useState<EntityRow[]>([])
const [showBulkOwnerModal, setShowBulkOwnerModal] = useState(false)
const [showBulkStatusModal, setShowBulkStatusModal] = useState(false)

// Edit/Delete Targets
const [entityToEdit, setEntityToEdit] = useState<EntityRow | null>(null)
const [entityToDelete, setEntityToDelete] = useState<EntityRow | null>(null)

// UI State
const [updatingEntityIds, setUpdatingEntityIds] = useState<Set<string>>(new Set())
const [entityColumnsNormalized, setEntityColumnsNormalized] = useState(false)
```

### Table Preferences Hook

```typescript
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
} = useTablePreferences('entity-type:list', baseColumns)
```

### Toast Integration

```typescript
const { showSuccess, showError, ToastContainer } = useToasts()

// Usage
showSuccess("Title", "Description")
showError("Error Title", "Error details")

// Render at page bottom
<ToastContainer />
```

---

## Table Configuration

### Base Column Definition

```typescript
const baseColumns: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 200,
    minWidth: 180,
    maxWidth: 240,
    type: "multi-action",
    accessor: "select",
    hideable: false,  // Cannot be hidden
  },
  {
    id: "primaryField",
    label: "Primary Field",
    width: 180,
    minWidth: 120,
    maxWidth: 300,
    sortable: true,
    type: "text",
    hideable: false,  // Core field, cannot be hidden
    render: (value) => (
      <span className="cursor-pointer font-medium text-blue-600 hover:text-blue-800">
        {value}
      </span>
    ),
  },
  {
    id: "optionalField",
    label: "Optional Field",
    width: 160,
    minWidth: 120,
    maxWidth: 240,
    sortable: true,
    type: "text",
    hidden: true,  // Hidden by default
  },
  // ... more columns
]
```

### Column Types

| Type | Description | Example Render |
|------|-------------|----------------|
| `text` | Plain text | Default |
| `phone` | Phone number | `<a href="tel:...">formatted</a>` |
| `email` | Email address | `<a href="mailto:...">email</a>` |
| `url` | Website URL | `<a href="..." target="_blank">url</a>` |
| `date` | Date value | `formatDate(value)` |
| `boolean` | Yes/No | `value ? "Yes" : "No"` |
| `multi-action` | Action column | Custom multi-control render |

### Default Visible Columns

```typescript
const ENTITY_DEFAULT_VISIBLE_COLUMN_IDS = new Set<string>([
  "primaryField",
  "field2",
  "field3",
  "field4",
  // ... fields visible by default
])
```

### Column Normalization

```typescript
useEffect(() => {
  if (entityColumnsNormalized || preferenceLoading) {
    return
  }
  
  if (!preferenceColumns || preferenceColumns.length === 0) {
    return
  }

  const normalized = preferenceColumns.map(column => {
    if (column.id === "multi-action") {
      return column
    }

    // Show default columns, hide others
    if (ENTITY_DEFAULT_VISIBLE_COLUMN_IDS.has(column.id)) {
      return column.hidden ? { ...column, hidden: false } : column
    }

    return column.hidden === true ? column : { ...column, hidden: true }
  })

  const changed = normalized.some((column, index) => 
    column.hidden !== preferenceColumns[index].hidden
  )

  if (changed) {
    handleColumnsChange(normalized)
  }

  setEntityColumnsNormalized(true)
}, [preferenceColumns, preferenceLoading, handleColumnsChange, entityColumnsNormalized])
```

**Purpose:** Ensures users see appropriate default columns on first load, regardless of stored preferences.

### Filter Options

```typescript
const filterOptions: { id: FilterableColumnKey; label: string }[] = [
  { id: "field1", label: "Field 1 Label" },
  { id: "field2", label: "Field 2 Label" },
  { id: "field3", label: "Field 3 Label" },
  // ... all filterable columns
]
```

---

## Data Loading Patterns

### Client-Side Pagination (Accounts Pattern)

```typescript
const reloadEntities = useCallback(async (query?: string) => {
  setLoading(true)
  
  try {
    const params = new URLSearchParams()
    if (query && query.trim().length > 0) {
      params.set("q", query.trim())
    }
    
    const queryString = params.toString()
    const url = queryString.length > 0
      ? `/api/entities?${queryString}`
      : "/api/entities"

    const response = await fetch(url, { cache: "no-store" })
    
    if (!response.ok) {
      throw new Error("Failed to load entities")
    }

    const payload = await response.json()
    const rows: EntityRow[] = Array.isArray(payload?.data) 
      ? payload.data 
      : []

    setEntities(rows)
    
    // Clean up selection state
    setSelectedEntities(prev => prev.filter(id => rows.some(row => row.id === id)))
    setBulkDeleteTargets(prev => prev.filter(entity => rows.some(row => row.id === entity.id)))
    
    setError(null)
  } catch (err) {
    console.error(err)
    setEntities([])
    setSelectedEntities([])
    setBulkDeleteTargets([])
    setError("Unable to load entities")
  } finally {
    setLoading(false)
  }
}, [])

// Load on mount
useEffect(() => {
  reloadEntities().catch(console.error)
}, [reloadEntities])
```

**Features:**
- Loads all data at once
- Backend search support via query parameter
- Client-side filtering and pagination
- Cleans up stale selection state

### Server-Side Pagination (Contacts Pattern)

```typescript
const [pagination, setPagination] = useState<PaginationInfo>({
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 0
})

const loadEntities = useCallback(async () => {
  setLoading(true)
  
  try {
    const params = new URLSearchParams()
    
    // Pagination
    params.set("page", pagination.page.toString())
    params.set("pageSize", pagination.pageSize.toString())
    
    // Search
    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim())
    }
    
    // Sorting
    params.set("sortBy", sortBy)
    params.set("sortDir", sortDir)
    
    // Filters
    if (filters.field1) params.set("field1", filters.field1)
    if (filters.field2 !== undefined) params.set("field2", filters.field2.toString())
    
    // Column filters
    if (columnFilters.length > 0) {
      const serializedFilters = columnFilters
        .map(filter => ({
          columnId: filter.columnId,
          value: typeof filter.value === "string" ? filter.value.trim() : "",
          operator: filter.operator
        }))
        .filter(filter => filter.columnId && filter.value.length > 0)
      
      if (serializedFilters.length > 0) {
        params.set("columnFilters", JSON.stringify(serializedFilters))
      }
    }

    const response = await fetch(`/api/entities?${params.toString()}`, { 
      cache: "no-store" 
    })
    
    if (!response.ok) {
      throw new Error("Failed to load entities")
    }

    const payload = await response.json()
    const rows: EntityRow[] = (Array.isArray(payload?.data) 
      ? payload.data 
      : []
    ).map((row: any) => ({
      ...row,
      select: false
    }))

    setEntities(rows)
    setPagination(prev => payload.pagination || prev)
    setError(null)
  } catch (err) {
    console.error(err)
    setEntities([])
    setError("Unable to load entities")
    showError("Failed to load entities", "Please try again.")
  } finally {
    setLoading(false)
  }
}, [
  pagination.page, 
  pagination.pageSize, 
  searchQuery, 
  sortBy, 
  sortDir, 
  filters, 
  columnFilters, 
  showError
])

// Load on mount and when dependencies change
useEffect(() => {
  loadEntities()
}, [loadEntities])
```

**Features:**
- Loads only one page at a time
- All filtering/sorting done on backend
- Pagination metadata returned from server
- Lower memory usage for large datasets

### Load Options Pattern

```typescript
const loadOptions = useCallback(async () => {
  try {
    const response = await fetch("/api/entities/options", { 
      cache: "no-store" 
    })
    
    if (!response.ok) {
      throw new Error("Failed to load options")
    }
    
    const data = await response.json()
    setOptions(data)
  } catch (err) {
    console.error("Failed to load options:", err)
    // Silent fail - options are nice to have, not critical
  }
}, [])

useEffect(() => {
  loadOptions()
}, [loadOptions])
```

---

## Search Implementation

### Client-Side Search (Accounts)

```typescript
const handleSearch = (query: string) => {
  setPage(1)  // Reset to first page
  reloadEntities(query).catch(console.error)
}

// In ListHeader
<ListHeader
  searchPlaceholder="Search Here"
  onSearch={handleSearch}
  // ... other props
/>
```

**Backend API:**
```typescript
// GET /api/entities?q=searchTerm
// Returns filtered results based on search term
```

### Server-Side Search with Debounce (Contacts)

```typescript
const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

const debouncedSearch = useCallback((query: string) => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  
  const timeout = setTimeout(() => {
    setSearchQuery(query)
    setPagination(prev => ({ ...prev, page: 1 }))
  }, 300)  // 300ms debounce
  
  setSearchTimeout(timeout)
}, [searchTimeout])

const handleSearch = (query: string) => {
  debouncedSearch(query)
}

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
  }
}, [searchTimeout])
```

**Benefits:**
- Reduces API calls while user types
- Better UX for server-side search
- 300ms is standard debounce time

---

## Filtering System

### Active/All Filter

```typescript
const [activeFilter, setActiveFilter] = useState<'all' | 'active'>('active')

const handleStatusFilterChange = (filter: string) => {
  setActiveFilter(filter === "active" ? "active" : "all")
  setPage(1)  // Reset pagination
}

// Client-side application
const filtered = activeFilter === "active"
  ? entities.filter(entity => entity.active)
  : [...entities]

// OR for server-side, include in API params
if (activeFilter === "active") {
  params.set("active", "true")
}
```

### Column Filters - Client-Side (Accounts)

```typescript
type ColumnFilterState = {
  columnId: FilterableColumnKey
  value: string
} | null

const [columnFilters, setColumnFilters] = useState<ColumnFilterState[]>([])

const handleColumnFilters = useCallback((filters: { columnId: string; value: string }[]) => {
  setPage(1)
  
  if (!Array.isArray(filters) || filters.length === 0) {
    setColumnFilters([])
    setSortConfig(null)
    return
  }

  const sanitized = filters
    .filter(filter => filterOptions.some(option => option.id === filter.columnId))
    .map(filter => ({
      columnId: filter.columnId as FilterableColumnKey,
      value: (filter.value ?? "").trim(),
    }))
    .filter(filter => filter.value.length > 0)

  setColumnFilters(sanitized)

  // Auto-sort by last filter
  if (sanitized.length > 0) {
    const lastFilter = sanitized[sanitized.length - 1]
    setSortConfig({
      columnId: lastFilter.columnId,
      direction: "desc",
    })
  } else {
    setSortConfig(null)
  }
}, [])

// Application function
const applyFilters = useCallback((
  records: EntityRow[],
  status: "all" | "active",
  columnFilterState: ColumnFilterState[],
) => {
  let next = status === "active"
    ? records.filter(record => record.active)
    : [...records]

  if (Array.isArray(columnFilterState) && columnFilterState.length > 0) {
    columnFilterState.forEach(filter => {
      if (!filter) return
      
      const trimmed = filter.value.trim().toLowerCase()
      if (trimmed.length === 0) return

      next = next.filter(record => {
        const recordValue = record[filter.columnId]
        if (recordValue === undefined || recordValue === null) {
          return false
        }
        return String(recordValue).toLowerCase().includes(trimmed)
      })
    })
  }

  return next
}, [])

// Use in filtered data memo
const filteredEntities = useMemo(() => {
  return applyFilters(entities, activeFilter, columnFilters)
}, [entities, activeFilter, columnFilters, applyFilters])
```

### Column Filters - Server-Side (Contacts)

```typescript
const [columnFilters, setColumnFilters] = useState<ListColumnFilter[]>([])

const handleColumnFiltersChange = useCallback((filters: ListColumnFilter[]) => {
  setPagination(prev => ({ ...prev, page: 1 }))

  if (!Array.isArray(filters) || filters.length === 0) {
    setColumnFilters([])
    return
  }

  const sanitized = filters
    .filter(filter => filter && typeof filter.columnId === "string")
    .map(filter => ({
      columnId: filter.columnId,
      value: typeof filter.value === "string" ? filter.value.trim() : "",
      operator: filter.operator
    }))
    .filter(filter => filter.columnId && filter.value.length > 0) as ListColumnFilter[]

  setColumnFilters(sanitized)
}, [])

// Filters are sent to backend in loadEntities
if (columnFilters.length > 0) {
  const serializedFilters = columnFilters.map(filter => ({
    columnId: filter.columnId,
    value: typeof filter.value === "string" ? filter.value.trim() : "",
    operator: filter.operator
  }))
  params.set("columnFilters", JSON.stringify(serializedFilters))
}
```

---

## Sorting & Pagination

### Client-Side Sorting (Accounts)

```typescript
const [sortConfig, setSortConfig] = useState<{
  columnId: keyof EntityRow
  direction: 'asc' | 'desc'
} | null>(null)

const handleSort = (columnId: string, direction: "asc" | "desc") => {
  setPage(1)
  setSortConfig({ 
    columnId: columnId as keyof EntityRow, 
    direction 
  })
}

// Apply sorting
const filteredEntities = useMemo(() => {
  const filtered = applyFilters(entities, activeFilter, columnFilters)

  if (!sortConfig) {
    return filtered
  }

  const { columnId, direction } = sortConfig

  return [...filtered].sort((a, b) => {
    const aValue = (a[columnId] ?? '').toString()
    const bValue = (b[columnId] ?? '').toString()

    if (aValue < bValue) return direction === "asc" ? -1 : 1
    if (aValue > bValue) return direction === "asc" ? 1 : -1
    return 0
  })
}, [entities, activeFilter, columnFilters, sortConfig, applyFilters])
```

### Server-Side Sorting (Contacts)

```typescript
const [sortBy, setSortBy] = useState<string>("createdAt")
const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

const handleSort = (columnId: string, direction: "asc" | "desc") => {
  setSortBy(columnId)
  setSortDir(direction)
  setPagination(prev => ({ ...prev, page: 1 }))
}

// Include in API params
params.set("sortBy", sortBy)
params.set("sortDir", sortDir)
```

### Client-Side Pagination (Accounts)

```typescript
const [page, setPage] = useState<number>(1)
const [pageSize, setPageSize] = useState<number>(25)

const paginatedEntities = useMemo(() => {
  const startIndex = (page - 1) * pageSize
  return filteredEntities.slice(startIndex, startIndex + pageSize)
}, [filteredEntities, page, pageSize])

const paginationInfo: PaginationInfo = useMemo(() => {
  const total = filteredEntities.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return {
    page,
    pageSize,
    total,
    totalPages
  }
}, [filteredEntities.length, page, pageSize])

// Auto-adjust page when data changes
useEffect(() => {
  const total = filteredEntities.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  
  if (page > totalPages) {
    setPage(totalPages)
  } else if (page < 1 && totalPages >= 1) {
    setPage(1)
  }
}, [filteredEntities.length, page, pageSize])

const handlePageChange = (nextPage: number) => {
  setPage(Math.max(1, nextPage))
}

const handlePageSizeChange = (nextPageSize: number) => {
  setPageSize(nextPageSize)
  setPage(1)
}
```

### Server-Side Pagination (Contacts)

```typescript
const [pagination, setPagination] = useState<PaginationInfo>({
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 0
})

// Include in API params
params.set("page", pagination.page.toString())
params.set("pageSize", pagination.pageSize.toString())

// Update from server response
const payload = await response.json()
setPagination(prev => payload.pagination || prev)

const handlePageChange = (page: number) => {
  setPagination(prev => ({ ...prev, page }))
}

const handlePageSizeChange = (pageSize: number) => {
  setPagination(prev => ({ ...prev, pageSize, page: 1 }))
}
```

---

## Multi-Action Column

### Complete Implementation

```typescript
const tableColumns = useMemo(() => {
  return preferenceColumns.map((column) => {
    if (column.id === "multi-action") {
      return {
        ...column,
        render: (_value: unknown, row: EntityRow, index: number) => {
          const rowId = row.id
          const checked = selectedEntities.includes(rowId)
          const activeValue = row.active
          const isUpdating = updatingEntityIds.has(row.id)

          return (
            <div className="flex items-center gap-2" data-disable-row-click="true">
              {/* Checkbox */}
              <label 
                className="flex cursor-pointer items-center justify-center" 
                onClick={e => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  aria-label={`Select ${row.name || rowId}`}
                  onChange={() => handleEntitySelect(rowId, !checked)}
                />
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    checked
                      ? "border-primary-500 bg-primary-600 text-white"
                      : "border-gray-300 bg-white text-transparent"
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
                    handleToggleActive(row, !row.active)
                  }
                }}
                className="relative inline-flex items-center cursor-pointer"
                disabled={isUpdating}
                title={activeValue ? "Active" : "Inactive"}
              >
                <span
                  className={`w-9 h-5 rounded-full transition-colors duration-300 ease-in-out ${
                    activeValue ? "bg-blue-600" : "bg-gray-300"
                  } ${isUpdating ? "opacity-50" : ""}`}
                >
                  <span
                    className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ease-in-out transform ${
                      activeValue ? "translate-x-4" : "translate-x-1"
                    } mt-0.5 ${activeValue ? "ring-1 ring-blue-300" : ""}`}
                  />
                </span>
              </button>

              {/* Action Buttons */}
              <div className="flex gap-0.5">
                <button
                  type="button"
                  className="p-1 text-blue-500 hover:text-blue-700 transition-colors rounded"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    requestEntityEdit(row)
                  }}
                  aria-label="Edit"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className={`p-1 rounded transition-colors ${
                    row.active
                      ? "text-red-500 hover:text-red-700"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    requestEntityDeletion(row)
                  }}
                  aria-label={row.active ? "Delete" : "Manage"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        },
      }
    }
    
    // Handle other columns
    return column
  })
}, [
  preferenceColumns,
  selectedEntities,
  updatingEntityIds,
  handleEntitySelect,
  handleToggleActive,
  requestEntityEdit,
  requestEntityDeletion,
])
```

### Toggle Active with Updating State

```typescript
const [updatingEntityIds, setUpdatingEntityIds] = useState<Set<string>>(new Set())

const markEntityUpdating = useCallback((entityId: string, updating: boolean) => {
  setUpdatingEntityIds(previous => {
    const next = new Set(previous)
    if (updating) {
      next.add(entityId)
    } else {
      next.delete(entityId)
    }
    return next
  })
}, [])

const handleToggleActive = useCallback(async (
  entity: EntityRow, 
  nextActive: boolean
) => {
  markEntityUpdating(entity.id, true)
  
  try {
    const response = await fetch(`/api/entities/${entity.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: nextActive }),
    })

    if (!response.ok) {
      const message = await response
        .json()
        .then((data: any) => data?.error ?? "Failed to update")
        .catch(() => "Failed to update")
      throw new Error(message)
    }

    const payload = await response.json()
    const updatedRow: EntityRow | null = payload?.data ?? null

    if (updatedRow) {
      setEntities(previous =>
        previous.map(item =>
          item.id === updatedRow.id ? updatedRow : item
        )
      )
    }
    
    showSuccess(
      "Status updated",
      `Entity is now ${nextActive ? "active" : "inactive"}.`
    )
  } catch (err) {
    console.error(err)
    showError(
      "Update failed",
      err instanceof Error ? err.message : "Failed to update status"
    )
  } finally {
    markEntityUpdating(entity.id, false)
  }
}, [markEntityUpdating, showSuccess, showError])
```

---

## Bulk Operations

### Selection Management

```typescript
const [selectedEntities, setSelectedEntities] = useState<string[]>([])

// Single select
const handleEntitySelect = useCallback((entityId: string, selected: boolean) => {
  setSelectedEntities(previous => {
    if (selected) {
      if (previous.includes(entityId)) {
        return previous
      }
      return [...previous, entityId]
    }

    if (!previous.includes(entityId)) {
      return previous
    }

    return previous.filter(id => id !== entityId)
  })
}, [])

// Select all (current page for client-side, all results for server-side)
const handleSelectAll = useCallback((selected: boolean) => {
  if (selected) {
    // For client-side: use paginatedEntities
    // For server-side: use entities (current page)
    setSelectedEntities(entities.map(entity => entity.id))
    return
  }
  setSelectedEntities([])
}, [entities])
```

### Bulk Action Bar

```typescript
<BulkActionBar
  count={selectedEntities.length}
  disabled={bulkActionLoading}
  onSoftDelete={openBulkDeleteDialog}
  onExportCsv={handleBulkExportCsv}
  onChangeOwner={() => setShowBulkOwnerModal(true)}
  onUpdateStatus={() => setShowBulkStatusModal(true)}
/>
```

### Bulk Delete Flow

```typescript
const [bulkDeleteTargets, setBulkDeleteTargets] = useState<EntityRow[]>([])

const openBulkDeleteDialog = useCallback(() => {
  if (selectedEntities.length === 0) {
    showError("No items selected", "Select at least one item to delete.")
    return
  }

  const targets = entities.filter(entity => selectedEntities.includes(entity.id))

  if (targets.length === 0) {
    showError(
      "Items unavailable",
      "Unable to locate the selected items. Refresh the page and try again."
    )
    return
  }

  setBulkDeleteTargets(targets)
  setEntityToDelete(null)
  setShowDeleteDialog(true)
}, [entities, selectedEntities, showError])

const executeBulkSoftDelete = useCallback(async (
  targets: EntityRow[],
  bypassConstraints?: boolean
): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
  if (!targets || targets.length === 0) {
    return { success: false, error: "No items selected" }
  }

  setBulkActionLoading(true)

  try {
    // Step 1: Deactivate active items
    const deactivateCandidates = targets.filter(entity => entity.active)
    const deletionCandidates = targets.filter(entity => !entity.active)

    const deactivatedIds: string[] = []
    const deactivationFailures: Array<{ entity: EntityRow; message: string }> = []

    if (deactivateCandidates.length > 0) {
      const results = await Promise.allSettled(
        deactivateCandidates.map(entity => deactivateEntityRequest(entity.id))
      )

      results.forEach((result, index) => {
        const entity = deactivateCandidates[index]
        if (result.status === "fulfilled" && result.value.success) {
          deactivatedIds.push(entity.id)
        } else {
          const message = result.status === "fulfilled"
            ? result.value.error || "Failed to deactivate"
            : result.reason instanceof Error
              ? result.reason.message
              : "Failed to deactivate"

          deactivationFailures.push({ entity, message })
        }
      })

      if (deactivatedIds.length > 0) {
        const updatedSet = new Set(deactivatedIds)
        setEntities(previous =>
          previous.map(entity =>
            updatedSet.has(entity.id)
              ? { ...entity, active: false, status: "Inactive", isDeleted: true }
              : entity
          )
        )

        showSuccess(
          `Marked ${deactivatedIds.length} item${deactivatedIds.length === 1 ? "" : "s"} inactive`,
          "Inactive items can be deleted if needed."
        )
      }
    }

    // Step 2: Soft delete inactive items
    const softDeleteSuccessIds: string[] = []
    const softDeleteFailures: Array<{ entity: EntityRow; message: string }> = []
    const constraintResults: Array<{ entity: EntityRow; constraints: DeletionConstraint[] }> = []

    for (const entity of deletionCandidates) {
      const result = await softDeleteEntityRequest(entity.id, bypassConstraints)

      if (result.success) {
        softDeleteSuccessIds.push(entity.id)
      } else if (result.constraints && result.constraints.length > 0) {
        constraintResults.push({ entity, constraints: result.constraints })
      } else {
        softDeleteFailures.push({
          entity,
          message: result.error || "Failed to delete"
        })
      }
    }

    if (softDeleteSuccessIds.length > 0) {
      const successSet = new Set(softDeleteSuccessIds)
      setEntities(previous =>
        previous.map(entity =>
          successSet.has(entity.id)
            ? { ...entity, active: false, status: "Inactive", isDeleted: true }
            : entity
        )
      )

      showSuccess(
        `Soft deleted ${softDeleteSuccessIds.length} item${softDeleteSuccessIds.length === 1 ? "" : "s"}`,
        "Deleted items can be restored later if needed."
      )
    }

    // Handle failures
    const failureIds = [
      ...deactivationFailures.map(({ entity }) => entity.id),
      ...softDeleteFailures.map(({ entity }) => entity.id),
      ...constraintResults.map(({ entity }) => entity.id),
    ]
    const failureIdSet = new Set(failureIds)

    setSelectedEntities(previous => previous.filter(id => failureIdSet.has(id)))
    setBulkDeleteTargets(targets.filter(entity => failureIdSet.has(entity.id)))

    if (deactivationFailures.length > 0 || softDeleteFailures.length > 0) {
      const message = [
        ...deactivationFailures.map(({ entity, message }) => 
          `${entity.name || "Item"}: ${message}`
        ),
        ...softDeleteFailures.map(({ entity, message }) => 
          `${entity.name || "Item"}: ${message}`
        ),
      ]
        .filter(Boolean)
        .join("; ")

      if (message.length > 0) {
        showError("Bulk delete failed", message)
      }
    }

    if (constraintResults.length > 0) {
      const aggregatedConstraints = constraintResults.flatMap(({ entity, constraints }) =>
        constraints.map(constraint => ({
          ...constraint,
          message: `${entity.name || "Item"}: ${constraint.message}`,
        }))
      )

      return { success: false, constraints: aggregatedConstraints }
    }

    if (failureIds.length > 0) {
      return { success: false, error: "Some items could not be deleted." }
    }

    return { success: deactivatedIds.length > 0 || softDeleteSuccessIds.length > 0 }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete selected items."
    showError("Bulk delete failed", message)
    return { success: false, error: message }
  } finally {
    setBulkActionLoading(false)
  }
}, [/* dependencies */])
```

### Bulk Owner Update

```typescript
const handleBulkOwnerUpdate = useCallback(async (ownerId: string | null) => {
  if (selectedEntities.length === 0) {
    showError("No items selected", "Select at least one item to update.")
    return
  }

  setBulkActionLoading(true)

  try {
    const outcomes = await Promise.allSettled(
      selectedEntities.map(async (entityId) => {
        const response = await fetch(`/api/entities/${entityId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerId }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.error || "Failed to update owner")
        }

        return entityId
      })
    )

    const successes: string[] = []
    const failures: Array<{ entityId: string; message: string }> = []

    outcomes.forEach((result, index) => {
      const entityId = selectedEntities[index]
      if (result.status === "fulfilled") {
        successes.push(entityId)
      } else {
        const message = result.reason instanceof Error 
          ? result.reason.message 
          : "Unexpected error"
        failures.push({ entityId, message })
      }
    })

    if (successes.length > 0) {
      const successSet = new Set(successes)
      const ownerOption = ownerId
        ? options?.owners.find(owner => owner.id === ownerId)
        : undefined
      const ownerName = ownerOption?.fullName ?? ""
      const toastLabel = ownerId ? ownerName || "Selected owner" : "Unassigned"

      setEntities(previous =>
        previous.map(entity =>
          successSet.has(entity.id)
            ? {
                ...entity,
                ownerId: ownerId,
                owner: ownerId ? ownerName : "",
              }
            : entity
        )
      )

      showSuccess(
        `Updated ${successes.length} item${successes.length === 1 ? "" : "s"}`,
        `New owner: ${toastLabel}.`
      )
    }

    if (failures.length > 0) {
      const nameMap = new Map(
        entities.map(entity => [entity.id, entity.name || "Item"])
      )
      const detail = failures
        .map(({ entityId, message }) => 
          `${nameMap.get(entityId) || "Item"}: ${message}`
        )
        .join("; ")
      showError("Failed to update owner for some items", detail)
    }

    const remaining = failures.map(({ entityId }) => entityId)
    setSelectedEntities(remaining)
    
    if (failures.length === 0) {
      setShowBulkOwnerModal(false)
    }
  } catch (error) {
    console.error("Bulk owner update failed", error)
    showError(
      "Bulk owner update failed",
      error instanceof Error ? error.message : "Unable to update owners."
    )
  } finally {
    setBulkActionLoading(false)
  }
}, [entities, options, selectedEntities, showError, showSuccess])
```

### Bulk Status Update

```typescript
const handleBulkStatusUpdate = useCallback(async (isActive: boolean) => {
  if (selectedEntities.length === 0) {
    showError("No items selected", "Select at least one item to update.")
    return
  }

  setBulkActionLoading(true)

  try {
    const outcomes = await Promise.allSettled(
      selectedEntities.map(async (entityId) => {
        const response = await fetch(`/api/entities/${entityId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: isActive }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.error || "Failed to update status")
        }

        return entityId
      })
    )

    const successes: string[] = []
    const failures: Array<{ entityId: string; message: string }> = []

    outcomes.forEach((result, index) => {
      const entityId = selectedEntities[index]
      if (result.status === "fulfilled") {
        successes.push(entityId)
      } else {
        const message = result.reason instanceof Error 
          ? result.reason.message 
          : "Unexpected error"
        failures.push({ entityId, message })
      }
    })

    if (successes.length > 0) {
      const successSet = new Set(successes)
      setEntities(previous =>
        previous.map(entity =>
          successSet.has(entity.id)
            ? {
                ...entity,
                active: isActive,
                status: isActive ? "Active" : "Inactive",
                isDeleted: !isActive,
              }
            : entity
        )
      )

      const label = isActive ? "active" : "inactive"
      showSuccess(
        `Marked ${successes.length} item${successes.length === 1 ? "" : "s"} as ${label}`,
        "The status has been updated."
      )
    }

    if (failures.length > 0) {
      const nameMap = new Map(
        entities.map(entity => [entity.id, entity.name || "Item"])
      )
      const detail = failures
        .map(({ entityId, message }) => 
          `${nameMap.get(entityId) || "Item"}: ${message}`
        )
        .join("; ")
      showError("Failed to update status for some items", detail)
    }

    const remaining = failures.map(({ entityId }) => entityId)
    setSelectedEntities(remaining)
    
    if (failures.length === 0) {
      setShowBulkStatusModal(false)
    }
  } catch (error) {
    console.error("Bulk status update failed", error)
    showError(
      "Bulk status update failed",
      error instanceof Error ? error.message : "Unable to update status."
    )
  } finally {
    setBulkActionLoading(false)
  }
}, [entities, selectedEntities, showError, showSuccess])
```

### Bulk CSV Export

```typescript
const handleBulkExportCsv = useCallback(() => {
  if (selectedEntities.length === 0) {
    showError("No items selected", "Select at least one item to export.")
    return
  }

  const rows = entities.filter(entity => selectedEntities.includes(entity.id))

  if (rows.length === 0) {
    showError(
      "Items not available",
      "Unable to locate the selected items. Refresh and try again."
    )
    return
  }

  const headers = [
    "Field 1",
    "Field 2",
    "Field 3",
    // ... all export columns
  ]

  const escapeCsv = (value: string | null | undefined) => {
    if (value === null || value === undefined) {
      return ""
    }

    const stringValue = String(value)
    if (
      stringValue.includes("\"") || 
      stringValue.includes(",") || 
      stringValue.includes("\n") || 
      stringValue.includes("\r")
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`
    }

    return stringValue
  }

  const lines = [
    headers.join(","),
    ...rows.map(row =>
      [
        row.field1,
        row.field2,
        row.field3,
        // ... map all fields
      ]
        .map(escapeCsv)
        .join(",")
    ),
  ]

  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]
  link.href = url
  link.download = `entities-export-${timestamp}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)

  showSuccess(
    `Exported ${rows.length} item${rows.length === 1 ? "" : "s"}`,
    "Check your downloads for the CSV file."
  )
}, [entities, selectedEntities, showError, showSuccess])
```

---

## CRUD Operations

### Create

```typescript
const [showCreateModal, setShowCreateModal] = useState<boolean>(false)

const handleCreateClick = () => {
  setShowCreateModal(true)
}

const handleModalClose = () => {
  setShowCreateModal(false)
}

const handleSubmitNew = useCallback(async (values: FormValues) => {
  try {
    const response = await fetch("/api/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })

    if (!response.ok) {
      const message = await response
        .json()
        .then((data: any) => data?.error ?? "Failed to create")
        .catch(() => "Failed to create")
      throw new Error(message)
    }

    const payload = await response.json()
    const newRow: EntityRow | null = payload?.data ?? null

    if (newRow) {
      setEntities(previous => {
        // Remove duplicates and add to top
        const withoutDuplicate = previous.filter(
          entity => entity.id !== newRow.id
        )
        return [newRow, ...withoutDuplicate]
      })
    }

    setShowCreateModal(false)
    showSuccess("Item created", "The new item has been added successfully.")
  } catch (error) {
    console.error("Failed to create", error)
    throw error instanceof Error ? error : new Error("Failed to create")
  }
}, [showSuccess])

<CreateModal
  isOpen={showCreateModal}
  onClose={handleModalClose}
  onSubmit={handleSubmitNew}
/>
```

### Edit

```typescript
const [entityToEdit, setEntityToEdit] = useState<EntityRow | null>(null)
const [showEditModal, setShowEditModal] = useState<boolean>(false)

const requestEntityEdit = useCallback((entity: EntityRow) => {
  setEntityToEdit(entity)
  setShowEditModal(true)
}, [])

const handleEditSuccess = useCallback(() => {
  setShowEditModal(false)
  setEntityToEdit(null)
  
  // For server-side pagination
  loadEntities()
  
  // For client-side pagination
  reloadEntities().catch(console.error)
}, [loadEntities]) // or [reloadEntities]

const closeEditModal = () => {
  setShowEditModal(false)
  setEntityToEdit(null)
}

<EditModal
  isOpen={showEditModal}
  onClose={closeEditModal}
  onSuccess={handleEditSuccess}
  entity={entityToEdit}
/>
```

### Delete (Two-Stage)

```typescript
const [entityToDelete, setEntityToDelete] = useState<EntityRow | null>(null)
const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false)

const requestEntityDeletion = useCallback((entity: EntityRow) => {
  setBulkDeleteTargets([])  // Clear bulk targets
  setEntityToDelete(entity)
  setShowDeleteDialog(true)
}, [])

const softDeleteEntityRequest = useCallback(async (
  entityId: string,
  bypassConstraints?: boolean
): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
  try {
    const url = `/api/entities/${entityId}?stage=soft${
      bypassConstraints ? "&bypassConstraints=true" : ""
    }`
    const response = await fetch(url, { method: "DELETE" })

    if (!response.ok) {
      let data: any = null
      try {
        data = await response.json()
      } catch (_) {
        // Ignore JSON parse errors
      }

      if (response.status === 409 && Array.isArray(data?.constraints)) {
        return { 
          success: false, 
          constraints: data.constraints as DeletionConstraint[] 
        }
      }

      const message = typeof data?.error === "string" && data.error.length > 0
        ? data.error
        : "Failed to delete"

      return { success: false, error: message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to delete"
    return { success: false, error: message }
  }
}, [])

const handleSoftDelete = useCallback(async (
  entityId: string,
  bypassConstraints?: boolean
): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
  const result = await softDeleteEntityRequest(entityId, bypassConstraints)

  if (result.success) {
    setEntities(previous =>
      previous.map(entity =>
        entity.id === entityId
          ? { ...entity, active: false, status: "Inactive", isDeleted: true }
          : entity
      )
    )
    setSelectedEntities(prev => prev.filter(id => id !== entityId))
    showSuccess("Item deleted", "The item has been soft deleted.")
  }

  return result
}, [softDeleteEntityRequest, showSuccess])

const handlePermanentDelete = useCallback(async (
  entityId: string
): Promise<{ success: boolean, error?: string }> => {
  try {
    const response = await fetch(`/api/entities/${entityId}?stage=permanent`, {
      method: "DELETE"
    })

    if (!response.ok) {
      const data = await response.json()
      return { 
        success: false, 
        error: data.error || "Failed to permanently delete" 
      }
    }

    // Remove from local state
    setEntities(previous =>
      previous.filter(entity => entity.id !== entityId)
    )

    showSuccess("Item permanently deleted", "The item has been removed.")
    return { success: true }
  } catch (err) {
    console.error(err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : "Unable to delete" 
    }
  }
}, [showSuccess])

const handleRestore = useCallback(async (
  entityId: string
): Promise<{ success: boolean, error?: string }> => {
  try {
    const response = await fetch(`/api/entities/${entityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" })
    })

    if (!response.ok) {
      const data = await response.json()
      return { success: false, error: data.error || "Failed to restore" }
    }

    const payload = await response.json()
    const restoredEntity = payload.data

    if (restoredEntity) {
      setEntities(previous =>
        previous.map(entity =>
          entity.id === entityId ? restoredEntity : entity
        )
      )
    }

    showSuccess("Item restored", "The item has been restored.")
    return { success: true }
  } catch (err) {
    console.error(err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : "Unable to restore" 
    }
  }
}, [showSuccess])

const closeDeleteDialog = () => {
  setShowDeleteDialog(false)
  setEntityToDelete(null)
  setBulkDeleteTargets([])
}

<TwoStageDeleteDialog
  isOpen={showDeleteDialog}
  onClose={closeDeleteDialog}
  entity="Entity"
  entityName={
    bulkDeleteTargets.length > 0
      ? `${bulkDeleteTargets.length} item${bulkDeleteTargets.length === 1 ? "" : "s"}`
      : entityToDelete?.name || "Unknown Item"
  }
  entityId={
    bulkDeleteTargets.length > 0
      ? bulkDeleteTargets[0]?.id || ""
      : entityToDelete?.id || ""
  }
  multipleEntities={
    bulkDeleteTargets.length > 0
      ? bulkDeleteTargets.map(entity => ({
          id: entity.id,
          name: entity.name || "Unknown Item"
        }))
      : undefined
  }
  entityLabelPlural="Items"
  isDeleted={
    bulkDeleteTargets.length > 0
      ? bulkDeleteTargets.every(entity => !entity.active)
      : entityToDelete ? !entityToDelete.active : false
  }
  onSoftDelete={handleSoftDelete}
  onBulkSoftDelete={
    bulkDeleteTargets.length > 0
      ? (entities, bypassConstraints) =>
          executeBulkSoftDelete(
            bulkDeleteTargets.filter(entity =>
              entities.some(e => e.id === entity.id)
            ),
            bypassConstraints
          )
      : undefined
  }
  onPermanentDelete={handlePermanentDelete}
  onRestore={handleRestore}
  userCanPermanentDelete={true}
/>
```

---

## Modal Management

### Column Chooser Modal

```typescript
const [showColumnSettings, setShowColumnSettings] = useState<boolean>(false)

<ColumnChooserModal
  isOpen={showColumnSettings}
  columns={preferenceColumns}
  onApply={handleColumnsChange}
  onClose={async () => {
    setShowColumnSettings(false)
    await saveChangesOnModalClose()
  }}
/>
```

### Bulk Action Modals

```typescript
// Owner Modal
<BulkOwnerModal
  isOpen={showBulkOwnerModal}
  owners={(options?.owners ?? []).map(owner => ({
    value: owner.id,
    label: owner.fullName || "Unknown Owner",
  }))}
  onClose={() => setShowBulkOwnerModal(false)}
  onSubmit={handleBulkOwnerUpdate}
  isSubmitting={bulkActionLoading}
/>

// Status Modal
<BulkStatusModal
  isOpen={showBulkStatusModal}
  onClose={() => setShowBulkStatusModal(false)}
  onSubmit={handleBulkStatusUpdate}
  isSubmitting={bulkActionLoading}
/>
```

### Special: Account Reassignment Modal

```typescript
// Accounts page only - for commission reassignment
const [showReassignModal, setShowReassignModal] = useState(false)

<AccountReassignmentModal
  isOpen={showReassignModal}
  selectedAccountIds={selectedAccounts}
  onClose={() => setShowReassignModal(false)}
  onConfirm={async (data) => {
    setBulkActionLoading(true)
    try {
      const response = await fetch('/api/accounts/bulk-reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountIds: selectedAccounts,
          newOwnerId: data.newOwnerId,
          assignmentRole: data.assignmentRole,
          effectiveDate: data.effectiveDate.toISOString(),
          transferCommissions: data.transferCommissions,
          notifyUsers: data.notifyUsers,
          reason: data.reason,
          commissionOption: data.commissionOption,
          houseDummyRepId: data.houseDummyRepId
        })
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error || 'Reassignment failed')
      }

      await reloadAccounts()
      setSelectedAccounts([])
      showSuccess("Reassignment completed", "Accounts have been reassigned.")
    } catch (error) {
      showError(
        "Reassignment failed",
        error instanceof Error ? error.message : "Unable to reassign accounts."
      )
    } finally {
      setBulkActionLoading(false)
    }
  }}
/>
```

---

## API Integration

### Endpoint Standards

```
# List
GET    /api/entities
  Query params: ?q=search&page=1&pageSize=25&sortBy=field&sortDir=asc

# Options/Lookups
GET    /api/entities/options

# Single Entity
GET    /api/entities/:id
POST   /api/entities
PATCH  /api/entities/:id
DELETE /api/entities/:id?stage=soft
DELETE /api/entities/:id?stage=permanent

# Bulk Operations
POST   /api/entities/bulk-reassign  (Accounts only)
```

### Request/Response Patterns

#### List Request (Server-Side Pagination)
```typescript
GET /api/entities?page=1&pageSize=25&q=search&sortBy=createdAt&sortDir=desc&columnFilters=[...]

Response:
{
  data: EntityRow[],
  pagination: {
    page: 1,
    pageSize: 25,
    total: 150,
    totalPages: 6
  }
}
```

#### List Request (Client-Side Pagination)
```typescript
GET /api/entities?q=search

Response:
{
  data: EntityRow[]  // All records matching search
}
```

#### Create Request
```typescript
POST /api/entities
Body: { ...formValues }

Response:
{
  data: EntityRow,
  message: "Entity created successfully"
}
```

#### Update Request
```typescript
PATCH /api/entities/:id
Body: { field: newValue }

Response:
{
  data: EntityRow,
  message: "Entity updated successfully"
}
```

#### Delete Requests
```typescript
// Soft delete
DELETE /api/entities/:id?stage=soft&bypassConstraints=true

Response (success):
{ message: "Soft deleted successfully" }

Response (constraints):
{
  constraints: [
    { type: "related_records", message: "Has 3 related opportunities" }
  ]
}

// Permanent delete
DELETE /api/entities/:id?stage=permanent

Response:
{ message: "Permanently deleted" }

// Restore
PATCH /api/entities/:id
Body: { action: "restore" }

Response:
{
  data: EntityRow,
  message: "Entity restored successfully"
}
```

---

## Performance Optimization

### Memoization Strategy

```typescript
// Filtered data - apply filters to source data
const filteredEntities = useMemo(() => {
  const filtered = applyFilters(entities, activeFilter, columnFilters)

  if (!sortConfig) {
    return filtered
  }

  // Apply sorting
  return [...filtered].sort((a, b) => {
    // sort logic
  })
}, [entities, activeFilter, columnFilters, sortConfig, applyFilters])

// Paginated data - slice filtered results
const paginatedEntities = useMemo(() => {
  const startIndex = (page - 1) * pageSize
  return filteredEntities.slice(startIndex, startIndex + pageSize)
}, [filteredEntities, page, pageSize])

// Pagination info - calculate from filtered length
const paginationInfo: PaginationInfo = useMemo(() => {
  const total = filteredEntities.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return { page, pageSize, total, totalPages }
}, [filteredEntities.length, page, pageSize])

// Table columns - enhance with custom renders
const tableColumns = useMemo(() => {
  return preferenceColumns.map(column => {
    // Custom renders for specific columns
  })
}, [preferenceColumns, selectedEntities, updatingEntityIds, /* handlers */])
```

### Callback Optimization

```typescript
// Use useCallback for event handlers
const handleEntitySelect = useCallback((entityId: string, selected: boolean) => {
  // logic
}, [])

const handleSelectAll = useCallback((selected: boolean) => {
  // logic
}, [entities]) // or [paginatedEntities] for client-side

const handleRowClick = useCallback((entity: EntityRow) => {
  router.push(`/entities/${entity.id}`)
}, [router])

const handleSort = useCallback((columnId: string, direction: "asc" | "desc") => {
  // For server-side
  setSortBy(columnId)
  setSortDir(direction)
  setPagination(prev => ({ ...prev, page: 1 }))
  
  // For client-side
  setPage(1)
  setSortConfig({ columnId: columnId as keyof EntityRow, direction })
}, [])
```

### Search Debouncing

```typescript
// For server-side search to reduce API calls
const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

const debouncedSearch = useCallback((query: string) => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  
  const timeout = setTimeout(() => {
    setSearchQuery(query)
    setPagination(prev => ({ ...prev, page: 1 }))
  }, 300)
  
  setSearchTimeout(timeout)
}, [searchTimeout])

// Cleanup
useEffect(() => {
  return () => {
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
  }
}, [searchTimeout])
```

---

## UI/UX Standards

### Page Layout

```tsx
<CopyProtectionWrapper className="dashboard-page-container">
  {/* Header with all controls */}
  <ListHeader
    pageTitle="ENTITY LIST"
    searchPlaceholder="Search entities..."
    onSearch={handleSearch}
    onFilterChange={handleStatusFilterChange}
    onCreateClick={handleCreateClick}
    onSettingsClick={() => setShowColumnSettings(true)}
    filterColumns={filterOptions}
    columnFilters={columnFilters}
    onColumnFiltersChange={handleColumnFilters}
    statusFilter={activeFilter}
    hasUnsavedTableChanges={hasUnsavedChanges}
    isSavingTableChanges={preferenceSaving}
    lastTableSaved={lastSaved || undefined}
    onSaveTableChanges={saveChanges}
  />

  {/* Error Display */}
  {(error || preferenceError) && (
    <div className="px-4 text-sm text-red-600">
      {error || preferenceError}
    </div>
  )}

  {/* Table Container */}
  <div className="flex-1 p-4 min-h-0">
    <BulkActionBar
      count={selectedEntities.length}
      disabled={bulkActionLoading}
      onSoftDelete={openBulkDeleteDialog}
      onExportCsv={handleBulkExportCsv}
      onChangeOwner={() => setShowBulkOwnerModal(true)}
      onUpdateStatus={() => setShowBulkStatusModal(true)}
    />
    
    <DynamicTable
      columns={tableColumns}
      data={paginatedEntities}
      onSort={handleSort}
      onRowClick={handleRowClick}
      loading={tableLoading}
      emptyMessage="No entities found"
      onColumnsChange={handleColumnsChange}
      pagination={paginationInfo}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
      selectedItems={selectedEntities}
      onItemSelect={handleEntitySelect}
      onSelectAll={handleSelectAll}
      onToggle={(row, columnId, value) => {
        if (columnId === "active") {
          handleToggleActive(row as EntityRow, value)
        }
      }}
      fillContainerWidth={true}  // Contacts use this
      autoSizeColumns={false}     // Contacts disable this
      alwaysShowPagination={true} // Accounts use this
    />
  </div>

  {/* Modals */}
  <CreateModal ... />
  <EditModal ... />
  <ColumnChooserModal ... />
  <BulkOwnerModal ... />
  <BulkStatusModal ... />
  <TwoStageDeleteDialog ... />
  
  {/* Toast Notifications */}
  <ToastContainer />
</CopyProtectionWrapper>
```

### DynamicTable Props

```typescript
<DynamicTable
  // Required
  columns={Column[]}              // Column definitions with renders
  data={EntityRow[]}              // Current page data
  
  // Handlers
  onSort={(columnId, direction) => void}
  onRowClick={(row) => void}
  onColumnsChange={(columns) => void}
  onPageChange={(page) => void}
  onPageSizeChange={(size) => void}
  onItemSelect={(id, selected) => void}
  onSelectAll={(selected) => void}
  onToggle={(row, columnId, value) => void}
  
  // Selection
  selectedItems={string[]}        // Array of selected IDs
  
  // Pagination
  pagination={PaginationInfo}     // Page info object
  alwaysShowPagination={boolean}  // Show pagination even with few items
  
  // Display
  loading={boolean}
  emptyMessage={string}
  fillContainerWidth={boolean}    // Fill available width
  autoSizeColumns={boolean}       // Auto-calculate column widths
/>
```

---

## Column Render Examples

### Clickable Primary Field (Name)

```typescript
{
  id: "name",
  label: "Name",
  width: 180,
  minWidth: 120,
  maxWidth: 300,
  sortable: true,
  type: "text",
  hideable: false,
  render: (value) => (
    <span className="cursor-pointer font-medium text-blue-600 hover:text-blue-800">
      {value}
    </span>
  ),
}
```

**Note:** Row click handler navigates to detail page, so no `<Link>` needed.

### Phone Number

```typescript
{
  id: "phone",
  label: "Phone",
  width: 140,
  minWidth: 120,
  maxWidth: 180,
  sortable: true,
  type: "phone",
  render: value => value ? (
    <a 
      href={`tel:${value}`} 
      className="text-gray-900 hover:text-blue-600 transition-colors"
      onClick={(e) => e.stopPropagation()}  // Prevent row click
    >
      {formatPhoneNumber(value)}
    </a>
  ) : <span className="text-gray-400">-</span>
}
```

### Email Address

```typescript
{
  id: "email",
  label: "Email",
  width: 200,
  minWidth: 160,
  maxWidth: 300,
  sortable: true,
  type: "email",
  render: value => value ? (
    <a 
      href={`mailto:${value}`} 
      className="text-blue-600 hover:text-blue-800 transition-colors truncate"
      onClick={(e) => e.stopPropagation()}  // Prevent row click
    >
      {value}
    </a>
  ) : <span className="text-gray-400">-</span>
}
```

### Website URL

```typescript
{
  id: "websiteUrl",
  label: "Website URL",
  width: 220,
  minWidth: 160,
  maxWidth: 320,
  sortable: true,
  type: "text",
  hidden: true,
  render: (value: string) =>
    value ? (
      <a
        href={value.startsWith("http") ? value : `https://${value}`}
        className="text-blue-600 hover:text-blue-800 underline"
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {value}
      </a>
    ) : (
      ""
    ),
}
```

### Boolean Field

```typescript
{
  id: "isActive",
  label: "Active (Y/N)",
  width: 120,
  minWidth: 100,
  maxWidth: 160,
  sortable: true,
  type: "text",
  hidden: true,
  accessor: "active",
  render: (_value, row: EntityRow) => (row.active ? "Yes" : "No"),
}
```

---

## Complete Implementation Examples

### Accounts Page (Client-Side) Key Features

1. **Loads all data** on mount with optional search query
2. **Client-side filtering** and pagination
3. **Column filters** with auto-sort by last filter
4. **Default column visibility** normalization
5. **Reassignment modal** for commission workflow
6. **Two-stage delete** (deactivate → soft delete)

### Contacts Page (Server-Side) Key Features

1. **Server-side pagination** for large datasets
2. **Debounced search** (300ms)
3. **Complex filter serialization** to backend
4. **Sort state** sent to API
5. **Pagination metadata** from server response
6. **Standard bulk operations**

---

## Code Checklist for New List Page

### ✅ Initial Setup
- [ ] Create page component file: `app/(dashboard)/[entity]/page.tsx`
- [ ] Add `"use client"` directive
- [ ] Import required components and hooks
- [ ] Define `EntityRow` interface
- [ ] Define `EntityOptions` interface
- [ ] Export default page component

### ✅ Column Configuration
- [ ] Define `baseColumns` array with all columns
- [ ] Set appropriate widths (min, default, max)
- [ ] Mark core columns as `hideable: false`
- [ ] Add custom renders for special fields
- [ ] Define `filterOptions` array
- [ ] Define `DEFAULT_VISIBLE_COLUMN_IDS` set

### ✅ State Management
- [ ] Data state (`entities`, `loading`, `error`)
- [ ] Options state
- [ ] Pagination state (client or server pattern)
- [ ] Search state (with debounce if server-side)
- [ ] Filter states (`activeFilter`, `columnFilters`)
- [ ] Sort state
- [ ] Selection state (`selectedEntities`)
- [ ] Modal states (create, edit, delete, settings, bulk modals)
- [ ] UI states (`updatingEntityIds`, `bulkActionLoading`)

### ✅ Table Preferences
- [ ] Initialize `useTablePreferences` hook
- [ ] Implement column normalization logic
- [ ] Handle save on modal close

### ✅ Data Loading
- [ ] Implement `loadEntities` function
- [ ] Implement `loadOptions` function
- [ ] Add `useEffect` for initial load
- [ ] Choose client-side or server-side pattern
- [ ] Add proper error handling

### ✅ Search & Filtering
- [ ] Implement `handleSearch`
- [ ] Implement `handleStatusFilterChange`
- [ ] Implement `handleColumnFilters`
- [ ] Apply filters in data memo (client) or API params (server)
- [ ] Reset page to 1 on filter changes

### ✅ Sorting & Pagination
- [ ] Implement `handleSort`
- [ ] Implement `handlePageChange`
- [ ] Implement `handlePageSizeChange`
- [ ] Create filtered data memo
- [ ] Create paginated data memo
- [ ] Create pagination info memo
- [ ] Add auto-adjust page effect

### ✅ Selection
- [ ] Implement `handleEntitySelect`
- [ ] Implement `handleSelectAll`
- [ ] Clean selection on data reload

### ✅ Row Actions
- [ ] Implement `handleRowClick` (navigate to detail)
- [ ] Implement `handleToggleActive` with updating state
- [ ] Implement `requestEntityEdit`
- [ ] Implement `requestEntityDeletion`
- [ ] Add `markEntityUpdating` helper

### ✅ CRUD Handlers
- [ ] Implement `handleSubmitNew`
- [ ] Implement `handleEditSuccess`
- [ ] Implement `handleSoftDelete`
- [ ] Implement `executeBulkSoftDelete`
- [ ] Implement `handlePermanentDelete`
- [ ] Implement `handleRestore`
- [ ] Add deactivate request helper

### ✅ Bulk Actions
- [ ] Implement `openBulkDeleteDialog`
- [ ] Implement `handleBulkExportCsv`
- [ ] Implement `handleBulkOwnerUpdate`
- [ ] Implement `handleBulkStatusUpdate`
- [ ] Add special bulk operations (e.g., reassignment)

### ✅ Table Columns Memo
- [ ] Map `preferenceColumns`
- [ ] Handle `multi-action` column with full controls
- [ ] Handle special column renders (links, dates, etc.)
- [ ] Add proper dependencies

### ✅ Modal Components
- [ ] Render `CreateModal`
- [ ] Render `EditModal`
- [ ] Render `ColumnChooserModal`
- [ ] Render `BulkOwnerModal`
- [ ] Render `BulkStatusModal`
- [ ] Render `TwoStageDeleteDialog`
- [ ] Render special modals (e.g., `ReassignmentModal`)

### ✅ Render Structure
- [ ] Wrap in `CopyProtectionWrapper`
- [ ] Add `ListHeader` with all props
- [ ] Add error display
- [ ] Add content container with `min-h-0`
- [ ] Add `BulkActionBar`
- [ ] Add `DynamicTable` with all props
- [ ] Add `ToastContainer` at bottom

### ✅ Testing
- [ ] Test create new entity
- [ ] Test edit entity
- [ ] Test delete (soft and permanent)
- [ ] Test restore
- [ ] Test toggle active status
- [ ] Test search functionality
- [ ] Test active/all filter
- [ ] Test column filters
- [ ] Test sorting (all columns)
- [ ] Test pagination (all pages)
- [ ] Test page size changes
- [ ] Test select single item
- [ ] Test select all items
- [ ] Test bulk delete
- [ ] Test bulk owner update
- [ ] Test bulk status update
- [ ] Test CSV export
- [ ] Test column show/hide
- [ ] Test column reorder
- [ ] Test empty state
- [ ] Test error states
- [ ] Test loading states

---

## Client-Side vs Server-Side Decision Guide

### Use Client-Side Pagination When:
- ✅ Dataset is small (< 1000 records)
- ✅ Need instant filtering/sorting
- ✅ Want to minimize API calls
- ✅ Backend doesn't support advanced filtering
- ✅ Real-time updates are important

**Example:** Accounts, internal admin lists, lookup tables

### Use Server-Side Pagination When:
- ✅ Dataset is large (> 1000 records)
- ✅ Want to reduce initial load time
- ✅ Want to reduce memory usage
- ✅ Backend has efficient query optimization
- ✅ Need advanced filtering (joins, aggregations)

**Example:** Contacts, orders, transactions, logs

---

## Common Column Configurations

### Accounts Page Columns

```typescript
// Always visible
- Multi-action (checkbox + toggle + actions)
- Account Name (clickable, blue)
- Account Legal Name (clickable, blue)
- Account Type
- Account Owner
- Shipping Street
- Shipping Street 2
- Shipping City
- Shipping State
- Shipping Zip

// Hidden by default
- Account Number
- Active (Y/N)
- Parent Account
- Industry
- Website URL
- Description
- Shipping Country
- Billing Street
- Billing Street 2
- Billing City
- Billing State
- Billing Zip
- Billing Country
```

### Contacts Page Columns

```typescript
// Always visible
- Multi-action (checkbox + toggle + actions)
- Suffix
- Full Name (clickable, blue, font-medium)
- Extension
- Work Phone (tel: link)
- Contact Type
- Email Address (mailto: link)
- Job Title
- Mobile (tel: link)

// Hidden by default
- Active (Y/N)
- Decision Maker
- Preferred Contact Method
```

---

## Row Click Navigation

```typescript
const router = useRouter()

const handleRowClick = useCallback((entity: EntityRow) => {
  router.push(`/entities/${entity.id}`)
}, [router])

<DynamicTable
  onRowClick={handleRowClick}
  // ... other props
/>
```

**Important:** Use `data-disable-row-click="true"` on interactive elements inside cells to prevent navigation when clicking controls.

---

## Error Handling Patterns

### Load Errors

```typescript
try {
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error("Failed to load data")
  }
  const data = await response.json()
  setEntities(data.data)
  setError(null)
} catch (err) {
  console.error(err)
  setEntities([])
  setError("Unable to load entities")
  showError("Load failed", "Please try again.")
}
```

### Mutation Errors

```typescript
try {
  const response = await fetch(url, options)
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error || "Operation failed")
  }
  
  showSuccess("Success", "Operation completed.")
} catch (error) {
  console.error(error)
  showError(
    "Operation failed",
    error instanceof Error ? error.message : "Please try again."
  )
  throw error  // Re-throw if needed by modal
}
```

### Bulk Operation Error Handling

```typescript
const outcomes = await Promise.allSettled(operations)

const successes: string[] = []
const failures: Array<{ id: string; message: string }> = []

outcomes.forEach((result, index) => {
  const id = ids[index]
  if (result.status === "fulfilled") {
    successes.push(id)
  } else {
    const message = result.reason instanceof Error 
      ? result.reason.message 
      : "Unexpected error"
    failures.push({ id, message })
  }
})

// Show success toast if any succeeded
if (successes.length > 0) {
  showSuccess(`Updated ${successes.length} items`, "")
}

// Show detailed error if any failed
if (failures.length > 0) {
  const detail = failures
    .map(item => `${getName(item.id)}: ${item.message}`)
    .join("; ")
  showError("Some operations failed", detail)
}

// Keep only failed items selected
setSelectedEntities(failures.map(item => item.id))
```

---

## Best Practices

### 1. Data Consistency
- Clean up selection state when data reloads
- Filter delete targets to match current data
- Auto-adjust page when data changes
- Validate entities exist before operations

### 2. User Feedback
- Show loading states during async operations
- Disable controls during operations
- Show success toasts with details
- Show specific error messages
- Display operation counts

### 3. State Management
- Use `useCallback` for all handlers
- Use `useMemo` for derived data
- Keep selection in sync with data
- Clean up timers on unmount

### 4. Performance
- Debounce search input (server-side)
- Memoize filtered/paginated data
- Avoid unnecessary re-renders
- Use Set for O(1) lookups

### 5. Accessibility
- Add ARIA labels to controls
- Use semantic HTML
- Support keyboard navigation
- Announce state changes to screen readers

### 6. Error Handling
- Try-catch all async operations
- Show user-friendly error messages
- Log errors to console
- Handle partial failures gracefully

---

## Testing Strategy

### Unit Tests
- [ ] Filter logic works correctly
- [ ] Pagination calculations are accurate
- [ ] Selection state updates properly
- [ ] Sort logic works for all types

### Integration Tests
- [ ] Create new entity
- [ ] Edit existing entity
- [ ] Delete entity (soft/permanent)
- [ ] Restore entity
- [ ] Toggle status
- [ ] Bulk operations
- [ ] Search functionality
- [ ] Filter combinations
- [ ] Pagination navigation
- [ ] Column customization

### Edge Cases
- [ ] Empty dataset
- [ ] Single item
- [ ] Large dataset (performance)
- [ ] Very long text values
- [ ] Special characters in search
- [ ] Network errors
- [ ] Permission denied
- [ ] Concurrent modifications
- [ ] Page out of bounds
- [ ] Invalid sort column

---

## Quick Start Template

```typescript
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ListHeader } from "@/components/list-header"
import { DynamicTable, Column } from "@/components/dynamic-table"
import { useTablePreferences } from "@/hooks/useTablePreferences"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { useToasts } from "@/components/toast"
import { TwoStageDeleteDialog } from "@/components/two-stage-delete-dialog"
import { ColumnChooserModal } from "@/components/column-chooser-modal"
import { Trash2, Edit, Check } from "lucide-react"

interface EntityRow {
  id: string
  active: boolean
  name: string
  // ... other fields
  isDeleted: boolean
}

const DEFAULT_VISIBLE_COLUMNS = new Set([
  "name",
  "field2",
  "field3"
])

const baseColumns: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 200,
    minWidth: 180,
    maxWidth: 240,
    type: "multi-action",
    hideable: false,
  },
  {
    id: "name",
    label: "Name",
    width: 180,
    minWidth: 120,
    maxWidth: 300,
    sortable: true,
    hideable: false,
    render: (value) => (
      <span className="font-medium text-blue-600 hover:text-blue-800">
        {value}
      </span>
    ),
  },
  // ... more columns
]

const filterOptions = [
  { id: "name", label: "Name" },
  // ... more filter options
]

export default function EntitiesPage() {
  const router = useRouter()
  const { showSuccess, showError, ToastContainer } = useToasts()
  
  // States
  const [entities, setEntities] = useState<EntityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [activeFilter, setActiveFilter] = useState<'active' | 'all'>('active')
  const [columnFilters, setColumnFilters] = useState([])
  const [selectedEntities, setSelectedEntities] = useState<string[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  
  // Table preferences
  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    handleColumnsChange,
    saveChangesOnModalClose,
    // ... other preference props
  } = useTablePreferences('entities:list', baseColumns)
  
  // Load data
  const loadEntities = useCallback(async () => {
    // Implementation based on client/server pattern
  }, [])
  
  useEffect(() => {
    loadEntities()
  }, [loadEntities])
  
  // Handlers
  const handleRowClick = useCallback((entity: EntityRow) => {
    router.push(`/entities/${entity.id}`)
  }, [router])
  
  // ... implement all handlers
  
  // Computed data
  const filteredEntities = useMemo(() => {
    // Filter logic
  }, [entities, activeFilter, columnFilters])
  
  const paginatedEntities = useMemo(() => {
    // Pagination logic
  }, [filteredEntities, page, pageSize])
  
  const paginationInfo = useMemo(() => {
    // Pagination info
  }, [filteredEntities.length, page, pageSize])
  
  const tableColumns = useMemo(() => {
    return preferenceColumns.map(column => {
      if (column.id === "multi-action") {
        return {
          ...column,
          render: (_, row) => {
            // Multi-action render
          }
        }
      }
      return column
    })
  }, [preferenceColumns, /* other deps */])
  
  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
        pageTitle="ENTITIES LIST"
        onSearch={handleSearch}
        onFilterChange={handleStatusFilterChange}
        onCreateClick={() => setShowCreateModal(true)}
        onSettingsClick={() => setShowColumnSettings(true)}
        filterColumns={filterOptions}
        columnFilters={columnFilters}
        onColumnFiltersChange={handleColumnFilters}
        statusFilter={activeFilter}
      />
      
      <div className="flex-1 p-4 min-h-0">
        <BulkActionBar
          count={selectedEntities.length}
          onSoftDelete={openBulkDeleteDialog}
          onExportCsv={handleBulkExportCsv}
          // ... other bulk actions
        />
        
        <DynamicTable
          columns={tableColumns}
          data={paginatedEntities}
          onRowClick={handleRowClick}
          loading={loading || preferenceLoading}
          emptyMessage="No entities found"
          pagination={paginationInfo}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          selectedItems={selectedEntities}
          onItemSelect={handleEntitySelect}
          onSelectAll={handleSelectAll}
          onColumnsChange={handleColumnsChange}
        />
      </div>
      
      {/* Modals */}
      <CreateModal ... />
      <EditModal ... />
      <ColumnChooserModal ... />
      <TwoStageDeleteDialog ... />
      
      <ToastContainer />
    </CopyProtectionWrapper>
  )
}
```

---

## Troubleshooting

### Issue: Selection persists after delete
**Solution:** Clear selection in soft delete handlers and on data reload

### Issue: Page shows empty after filtering
**Solution:** Add auto-adjust page effect when filtered data changes

### Issue: Column filters not working
**Solution:** Ensure filter options match column IDs exactly

### Issue: Table doesn't fill screen
**Solution:** Use `flex-1 min-h-0` on container div

### Issue: Row click triggers on button click
**Solution:** Add `data-disable-row-click="true"` and `e.stopPropagation()`

### Issue: Toggle not updating
**Solution:** Check updating state and markEntityUpdating calls

### Issue: Bulk operations affect wrong items
**Solution:** Filter targets by current selection before operation

### Issue: Search triggers too many API calls
**Solution:** Implement debounce (300ms recommended)

---

## API Backend Requirements

### List Endpoint

```typescript
GET /api/entities

Query Parameters:
- q: string                 // Search query
- page: number              // Page number (1-based)
- pageSize: number          // Items per page
- sortBy: string            // Column to sort by
- sortDir: 'asc' | 'desc'  // Sort direction
- columnFilters: string     // JSON array of filters
- [field]: string           // Direct field filters

Response:
{
  data: EntityRow[],
  pagination: {  // For server-side only
    page: number,
    pageSize: number,
    total: number,
    totalPages: number
  }
}
```

### Options Endpoint

```typescript
GET /api/entities/options

Response:
{
  entityTypes: Array<{ id: string, name: string }>,
  owners: Array<{ id: string, fullName: string }>,
  // ... other lookup data
}
```

### Single Entity Endpoints

```typescript
GET    /api/entities/:id
POST   /api/entities
PATCH  /api/entities/:id
DELETE /api/entities/:id?stage=soft&bypassConstraints=true
DELETE /api/entities/:id?stage=permanent
```

### Filter Application (Backend)

```typescript
// Parse column filters from query
const columnFilters = JSON.parse(req.query.columnFilters || '[]')

// Apply filters to query
columnFilters.forEach(filter => {
  if (filter.operator === 'contains') {
    query = query.where(filter.columnId, 'like', `%${filter.value}%`)
  } else if (filter.operator === 'equals') {
    query = query.where(filter.columnId, '=', filter.value)
  }
  // ... other operators
})
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-15 | Initial reference guide |

---

## Related Documentation

- [Detail View Tables Reference Guide](./Detail_View_Tables_Reference_Guide.md) - For detail pages with tabs
- `components/dynamic-table.tsx` - Core table component
- `components/list-header.tsx` - Page header with controls
- `hooks/useTablePreferences.ts` - Preference persistence

---

## Future Enhancements

- [ ] Saved filter presets
- [ ] Advanced filter operators (>, <, between, etc.)
- [ ] Multi-column sorting
- [ ] Batch operations queue
- [ ] Background sync for large operations
- [ ] Export to Excel with formatting
- [ ] Print-friendly view
- [ ] Column templates/presets
- [ ] Inline editing
- [ ] Drag and drop reordering

