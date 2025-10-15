# Detail View Tables Reference Guide

**Version:** 1.0  
**Last Updated:** October 15, 2025  
**Purpose:** Standard reference for building detail view pages with tabbed tables

This document provides a comprehensive reference for implementing detail view pages with tabbed tables, based on the patterns established in `account-details-view.tsx` and `contact-details-view.tsx`.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Structure](#component-structure)
3. [Table Configuration](#table-configuration)
4. [State Management](#state-management)
5. [Features Implementation](#features-implementation)
6. [Multi-Action Column Pattern](#multi-action-column-pattern)
7. [CRUD Operations](#crud-operations)
8. [Filtering & Search](#filtering--search)
9. [Pagination](#pagination)
10. [Bulk Actions](#bulk-actions)
11. [Modal Integration](#modal-integration)
12. [API Integration](#api-integration)
13. [UI/UX Patterns](#uiux-patterns)
14. [Accessibility](#accessibility)
15. [Performance Optimization](#performance-optimization)

---

## Architecture Overview

### Component Hierarchy

```
DetailView (e.g., AccountDetailsView)
├── Detail Section (Collapsible)
│   └── Field Rows
├── Tabbed Section
│   ├── Tab Navigation
│   └── Tab Content (Per Tab)
│       ├── ListHeader
│       ├── BulkActionBar
│       └── DynamicTable
│           ├── Table Header
│           ├── Table Body (Paginated Rows)
│           └── Table Footer (Pagination)
└── Modals
    ├── Create Modals
    ├── Edit Modals
    ├── Bulk Action Modals
    ├── Delete Dialogs
    └── Column Chooser Modal
```

### Key Dependencies

- **DynamicTable**: Core table component with resizing, sorting, and selection
- **ListHeader**: Search, filters, and column management controls
- **BulkActionBar**: Actions for selected items
- **TwoStageDeleteDialog**: Soft delete with constraint handling
- **ColumnChooserModal**: Column visibility and order management
- **useTablePreferences**: Hook for persisting table configurations

---

## Component Structure

### Props Interface

```typescript
interface DetailViewProps {
  [entity]: DetailType | null       // Main entity data
  loading?: boolean                  // Loading state
  error?: string | null              // Error message
  onEdit?: (entity: DetailType) => void    // Edit handler
  onRefresh?: () => Promise<void> | void   // Refresh handler
  onEntityUpdated?: (entity: DetailType) => void  // Update callback
}
```

### Main Entity Interface

```typescript
interface DetailType {
  id: string
  // Entity-specific fields...
  active: boolean
  deletedAt?: string | null
  
  // Related entities (tabs)
  [relatedEntities]: RelatedEntityRow[]
  // Example: contacts: AccountContactRow[]
  //          opportunities: AccountOpportunityRow[]
  //          groups: AccountGroupRow[]
  //          activities: AccountActivityRow[]
}
```

---

## Table Configuration

### Base Column Definition Pattern

Each tab has a `BASE_COLUMNS` constant defining table structure:

```typescript
const [TAB_NAME]_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 200,
    minWidth: 160,
    maxWidth: 240,
    type: "multi-action",
  },
  {
    id: "fieldName",
    label: "Display Label",
    width: 180,           // Default width
    minWidth: 150,        // Minimum allowed width
    maxWidth: 240,        // Maximum allowed width
    sortable: true,       // Enable sorting
    accessor: "fieldName", // Data accessor key
    hidden: false,        // Optional: hide by default
  },
  // ... more columns
]
```

### Column Width Guidelines

| Content Type | Width | MinWidth | MaxWidth |
|-------------|--------|----------|----------|
| Multi-action column | 200 | 160 | 240 |
| ID fields | 150-180 | 120-140 | 200-220 |
| Short text (status, type) | 160-180 | 130-150 | 220-240 |
| Medium text (names, titles) | 200-250 | 160-200 | 280-350 |
| Long text (descriptions) | 260-300 | 200-250 | 400-420 |
| Dates | 150-160 | 120-130 | 200-220 |

### Example Tab Configurations

#### Contacts Tab (Account Details)
- Multi-action column
- Suffix, Full Name, First Name (hidden), Last Name (hidden)
- Job Title, Contact Type, Email, Work Phone, Mobile, Extension

#### Opportunities Tab (Account Details)
- Multi-action column
- Order ID House, Opportunity Name, Stage
- Distributor Name, Vendor Name, Referred By, Owner, Close Date

#### Groups Tab (Account/Contact Details)
- Multi-action column
- Group Name, Visibility (Public/Private), Description, Owner

#### Activities Tab (Account/Contact Details)
- Multi-action column
- Activity Date, Activity Type, Activity Status
- Description, Account Name, Attachment, File Name, Created By

---

## State Management

### Core State Variables (Per Tab)

```typescript
// Tab selection
const [activeTab, setActiveTab] = useState<TabKey>("defaultTab")

// Details expansion
const [detailsExpanded, setDetailsExpanded] = useState(true)

// Active/Inactive filter
const [activeFilter, setActiveFilter] = useState<"active" | "inactive">("active")

// Pagination
const [currentPage, setCurrentPage] = useState(1)
const [pageSize, setPageSize] = useState(10)

// Search & Filters
const [searchQuery, setSearchQuery] = useState("")
const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([])

// Selection
const [selectedItems, setSelectedItems] = useState<string[]>([])

// Modals
const [createModalOpen, setCreateModalOpen] = useState(false)
const [editingItem, setEditingItem] = useState<RowType | null>(null)
const [showColumnSettings, setShowColumnSettings] = useState(false)

// Bulk Actions
const [bulkActionLoading, setBulkActionLoading] = useState(false)
const [showBulkOwnerModal, setShowBulkOwnerModal] = useState(false)
const [showBulkStatusModal, setShowBulkStatusModal] = useState(false)

// Delete
const [deleteTargets, setDeleteTargets] = useState<RowType[]>([])
const [itemToDelete, setItemToDelete] = useState<RowType | null>(null)
const [showDeleteDialog, setShowDeleteDialog] = useState(false)

// Owners (for bulk operations)
const [owners, setOwners] = useState<Array<{ value: string; label: string }>>([])
```

### Table Preferences Hook

```typescript
const {
  columns: preferenceColumns,
  loading: preferencesLoading,
  saving: preferencesSaving,
  hasUnsavedChanges,
  lastSaved,
  handleColumnsChange,
  saveChanges,
  saveChangesOnModalClose,
} = useTablePreferences(
  "detail-view-name:tab-name",  // Unique key for storage
  BASE_COLUMNS
)
```

### State Reset on Entity Change

```typescript
useEffect(() => {
  // Reset all tab states when main entity changes
  setActiveTab("defaultTab")
  setSelectedItems([])
  setSearchQuery("")
  setColumnFilters([])
  setCurrentPage(1)
  setPageSize(10)
  // ... reset other states
}, [entity?.id])
```

---

## Features Implementation

### 1. **Collapsible Detail Section**

```typescript
const [detailsExpanded, setDetailsExpanded] = useState(true)

const toggleDetails = () => {
  setDetailsExpanded(!detailsExpanded)
}

// Render logic
{!detailsExpanded ? (
  <CompactView />
) : (
  <ExpandedView />
)}
```

**UI Pattern:**
- Chevron button in top-right of detail section
- Compact view shows key fields in single row
- Expanded view shows full field grid

### 2. **Tab Navigation**

```typescript
const TABS: { id: TabKey; label: string }[] = [
  { id: "tab1", label: "Display Label 1" },
  { id: "tab2", label: "Display Label 2" },
  // ...
]

// Active tab styling
className={cn(
  "px-3 py-1.5 text-sm font-semibold transition rounded-t-md",
  "border border-blue-300 bg-gradient-to-b from-blue-100 to-blue-200",
  activeTab === tab.id
    ? "text-primary-900 border-blue-500 shadow-md -mb-[1px] relative z-10"
    : ""
)}
```

**Design:**
- Blue gradient background for tabs
- Active tab has stronger shadow and negative margin to overlap border
- Rounded top corners only

### 3. **Dynamic Table Height**

```typescript
const tableAreaRef = useRef<HTMLDivElement | null>(null)
const [tableAreaMaxHeight, setTableAreaMaxHeight] = useState<number>()

const TABLE_CONTAINER_PADDING = 16
const TABLE_BODY_FOOTER_RESERVE = 96
const TABLE_BODY_MIN_HEIGHT = 160

const measureTableAreaHeight = useCallback(() => {
  const container = tableAreaRef.current
  if (!container) return
  const rect = container.getBoundingClientRect()
  const available = window.innerHeight - rect.top - TABLE_CONTAINER_PADDING
  const nextHeight = Math.max(Math.floor(available), 0)
  setTableAreaMaxHeight(nextHeight)
}, [])

// Calculate body height
const tableBodyMaxHeight = useMemo(() => {
  if (tableAreaMaxHeight == null) return undefined
  const maxBodyWithinContainer = Math.max(tableAreaMaxHeight - 16, 0)
  const preferredBodyHeight = Math.max(
    tableAreaMaxHeight - TABLE_BODY_FOOTER_RESERVE,
    Math.floor(tableAreaMaxHeight * 0.6),
    0
  )
  const boundedPreferredHeight = Math.min(preferredBodyHeight, maxBodyWithinContainer)
  if (boundedPreferredHeight >= TABLE_BODY_MIN_HEIGHT) {
    return boundedPreferredHeight
  }
  const minTarget = Math.min(TABLE_BODY_MIN_HEIGHT, maxBodyWithinContainer)
  return Math.max(boundedPreferredHeight, minTarget)
}, [tableAreaMaxHeight])

// Recalculate on resize, tab change, detail expansion
useLayoutEffect(() => {
  measureTableAreaHeight()
}, [measureTableAreaHeight, activeTab, detailsExpanded, loading])

useEffect(() => {
  const handleResize = () => measureTableAreaHeight()
  window.addEventListener("resize", handleResize)
  return () => window.removeEventListener("resize", handleResize)
}, [measureTableAreaHeight])
```

**Purpose:** Ensures table fills available viewport space without causing page scroll

---

## Multi-Action Column Pattern

### Column Structure

The multi-action column combines three interactive elements:
1. **Checkbox** for row selection
2. **Active/Inactive toggle** for status
3. **Action buttons** (Edit, Delete)

### Implementation

```typescript
{
  id: "multi-action",
  label: "Select All",
  width: 200,
  minWidth: 160,
  maxWidth: 240,
  type: "multi-action",
  render: (_value: unknown, row: RowType) => {
    const checked = selectedItems.includes(row.id)
    const activeValue = !!row.active
    
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
            aria-label={`Select ${row.name || row.id}`}
            onChange={() => handleItemSelect(row.id, !checked)}
          />
          <span className={cn(
            "flex h-4 w-4 items-center justify-center rounded border transition-colors",
            checked 
              ? "border-primary-500 bg-primary-600 text-white" 
              : "border-gray-300 bg-white text-transparent"
          )}>
            <Check className="h-3 w-3" aria-hidden="true" />
          </span>
        </label>

        {/* Active Toggle */}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            handleToggleStatus(row, !activeValue)
          }}
          className="relative inline-flex items-center cursor-pointer"
          title={activeValue ? "Active" : "Inactive"}
        >
          <span className={cn(
            "w-9 h-5 rounded-full transition-colors duration-300 ease-in-out",
            activeValue ? "bg-blue-600" : "bg-gray-300"
          )}>
            <span className={cn(
              "inline-block w-4 h-4 bg-white rounded-full shadow",
              "transition-transform duration-300 ease-in-out transform mt-0.5",
              activeValue ? "translate-x-4 ring-1 ring-blue-300" : "translate-x-1"
            )} />
          </span>
        </button>

        {/* Actions */}
        <div className="flex gap-0.5">
          <button
            type="button"
            className="p-1 text-primary-600 hover:text-primary-700 transition-colors rounded"
            onClick={(e) => {
              e.stopPropagation()
              handleEdit(row)
            }}
            aria-label="Edit"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={cn(
              "p-1 rounded transition-colors",
              activeValue || !row.isDeleted
                ? "text-red-500 hover:text-red-700"
                : "text-gray-400 hover:text-gray-600"
            )}
            onClick={(e) => {
              e.stopPropagation()
              requestDelete(row)
            }}
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }
}
```

### Key Features

1. **Checkbox:**
   - Custom styled with screen-reader-only input
   - Check icon appears when selected
   - Primary color when checked

2. **Toggle Switch:**
   - iOS-style toggle (9px × 5px outer)
   - 4px × 4px white circle inside
   - Blue when active, gray when inactive
   - Smooth animation on state change
   - Ring effect when active

3. **Action Buttons:**
   - Edit: Primary color (blue)
   - Delete: Red when active, gray when deleted
   - Small icons (3.5 × 3.5)
   - Hover states

4. **Event Handling:**
   - `data-disable-row-click="true"` on container
   - `e.stopPropagation()` on all interactive elements
   - Prevents row click when interacting with controls

---

## CRUD Operations

### Create Pattern

```typescript
// Modal state
const [createModalOpen, setCreateModalOpen] = useState(false)

// Open modal
const handleCreate = useCallback(() => {
  if (!parentEntity || isDeleted) {
    showError("Cannot create", "Parent entity not available")
    return
  }
  setCreateModalOpen(true)
}, [parentEntity, isDeleted])

// Handle success
const handleCreateSuccess = useCallback(() => {
  setCreateModalOpen(false)
  showSuccess("Item created", "The item has been created successfully.")
  onRefresh?.()
}, [onRefresh, showSuccess])

// Render modal
<CreateModal
  isOpen={createModalOpen}
  parentId={parentEntity.id}
  onClose={() => setCreateModalOpen(false)}
  onSuccess={handleCreateSuccess}
/>
```

### Read Pattern

```typescript
// Data comes from parent entity prop
const filteredData = useMemo(() => {
  let rows = [...(entity?.relatedItems ?? [])]
  
  // Apply active filter
  if (activeFilter === "active") {
    rows = rows.filter(row => row.active && !row.isDeleted)
  } else if (activeFilter === "inactive") {
    rows = rows.filter(row => !row.isDeleted)
    rows.sort((a, b) => {
      if (!a.active && b.active) return -1
      if (a.active && !b.active) return 1
      return 0
    })
  }
  
  // Apply search
  const query = searchQuery.trim().toLowerCase()
  if (query.length > 0) {
    rows = rows.filter(row => {
      return searchableFields
        .filter((value): value is string => typeof value === "string")
        .some(value => value.toLowerCase().includes(query))
    })
  }
  
  // Apply column filters
  if (columnFilters.length > 0) {
    rows = applySimpleFilters(rows, columnFilters)
  }
  
  return rows
}, [entity?.relatedItems, activeFilter, searchQuery, columnFilters])
```

### Update Pattern

```typescript
// Edit modal state
const [editingItem, setEditingItem] = useState<RowType | null>(null)

// Open edit modal
const handleEdit = useCallback((item: RowType) => {
  if (!item?.id) {
    showError("Item unavailable", "Unable to locate this item.")
    return
  }
  setEditingItem(item)
}, [showError])

// Handle edit success
const handleEditSuccess = useCallback(() => {
  setEditingItem(null)
  showSuccess("Item updated", "The item has been updated successfully.")
  onRefresh?.()
}, [onRefresh, showSuccess])

// Close modal
const handleCloseEditModal = useCallback(() => {
  setEditingItem(null)
}, [])

// Render modal
<EditModal
  isOpen={Boolean(editingItem)}
  itemId={editingItem?.id ?? null}
  onClose={handleCloseEditModal}
  onSuccess={handleEditSuccess}
/>
```

### Delete Pattern (Two-Stage)

```typescript
// Delete state
const [itemToDelete, setItemToDelete] = useState<RowType | null>(null)
const [deleteTargets, setDeleteTargets] = useState<RowType[]>([])
const [showDeleteDialog, setShowDeleteDialog] = useState(false)

// Request delete (single)
const requestDelete = useCallback((item: RowType) => {
  setDeleteTargets([])
  setItemToDelete(item)
  setShowDeleteDialog(true)
}, [])

// Request delete (bulk)
const openBulkDeleteDialog = useCallback(() => {
  if (selectedItems.length === 0) {
    showError("No items selected", "Select at least one item to delete.")
    return
  }
  const targets = data.filter(row => selectedItems.includes(row.id))
  setDeleteTargets(targets)
  setItemToDelete(null)
  setShowDeleteDialog(true)
}, [selectedItems, data, showError])

// Soft delete handler
const handleSoftDelete = useCallback(async (
  itemId: string,
  bypassConstraints?: boolean
): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
  try {
    const url = `/api/items/${itemId}?stage=soft${bypassConstraints ? '&bypassConstraints=true' : ''}`
    const response = await fetch(url, { method: "DELETE" })
    
    if (!response.ok) {
      const data = await response.json()
      if (response.status === 409 && data.constraints) {
        return { success: false, constraints: data.constraints }
      }
      return { success: false, error: data.error || "Failed to delete" }
    }
    
    showSuccess("Item deleted", "The item has been soft deleted.")
    onRefresh?.()
    return { success: true }
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : "Unable to delete" 
    }
  }
}, [onRefresh, showSuccess])

// Bulk soft delete handler
const executeBulkSoftDelete = useCallback(async (
  entities: Array<{ id: string }>,
  bypassConstraints?: boolean
): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
  const results = await Promise.all(
    entities.map(entity => handleSoftDelete(entity.id, bypassConstraints))
  )
  
  const successIds = entities
    .filter((_, index) => results[index]?.success)
    .map(entity => entity.id)
  
  if (successIds.length > 0) {
    showSuccess(
      `Deleted ${successIds.length} item${successIds.length === 1 ? "" : "s"}`,
      "Items have been soft deleted."
    )
  }
  
  const constraints = results.flatMap(result => result.constraints ?? [])
  if (constraints.length > 0) {
    return { success: false, constraints }
  }
  
  return { success: successIds.length > 0 }
}, [handleSoftDelete, showSuccess])

// Permanent delete handler
const handlePermanentDelete = useCallback(async (
  itemId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(`/api/items/${itemId}?stage=permanent`, {
      method: "DELETE"
    })
    
    if (!response.ok) {
      const data = await response.json()
      return { success: false, error: data.error || "Failed to delete" }
    }
    
    showSuccess("Item permanently deleted", "The item has been removed.")
    onRefresh?.()
    return { success: true }
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : "Unable to delete" 
    }
  }
}, [onRefresh, showSuccess])

// Restore handler
const handleRestore = useCallback(async (
  itemId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" })
    })
    
    if (!response.ok) {
      const data = await response.json()
      return { success: false, error: data.error || "Failed to restore" }
    }
    
    showSuccess("Item restored", "The item has been restored.")
    onRefresh?.()
    return { success: true }
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : "Unable to restore" 
    }
  }
}, [onRefresh, showSuccess])

// Render dialog
<TwoStageDeleteDialog
  isOpen={showDeleteDialog}
  onClose={() => {
    setShowDeleteDialog(false)
    setItemToDelete(null)
    setDeleteTargets([])
  }}
  entity="Item"
  entityName={
    deleteTargets.length > 0
      ? `${deleteTargets.length} item${deleteTargets.length === 1 ? "" : "s"}`
      : itemToDelete?.name || "Unknown Item"
  }
  entityId={
    deleteTargets.length > 0
      ? deleteTargets[0]?.id || ""
      : itemToDelete?.id || ""
  }
  multipleEntities={
    deleteTargets.length > 0
      ? deleteTargets.map(item => ({
          id: item.id,
          name: item.name || "Item",
          subtitle: item.owner ? `Owner: ${item.owner}` : undefined
        }))
      : undefined
  }
  entityLabelPlural="Items"
  isDeleted={
    deleteTargets.length > 0
      ? deleteTargets.every(item => item.isDeleted)
      : itemToDelete?.isDeleted || false
  }
  onSoftDelete={handleSoftDelete}
  onBulkSoftDelete={deleteTargets.length > 0 ? executeBulkSoftDelete : undefined}
  onPermanentDelete={handlePermanentDelete}
  onRestore={handleRestore}
  userCanPermanentDelete={true}
/>
```

### Toggle Status Pattern

```typescript
const handleToggleStatus = useCallback(async (item: RowType, newStatus: boolean) => {
  if (!item?.id) {
    showError("Item unavailable", "Unable to locate this item.")
    return
  }
  
  try {
    const response = await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: newStatus })
    })
    
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(data?.error || "Failed to update status")
    }
    
    showSuccess(
      "Item updated",
      `Item ${newStatus ? "activated" : "deactivated"} successfully.`
    )
    
    onRefresh?.()
  } catch (error) {
    console.error("Failed to update status", error)
    const message = error instanceof Error ? error.message : "Unable to update status"
    showError("Failed to update item", message)
  }
}, [onRefresh, showError, showSuccess])
```

---

## Filtering & Search

### Active/Inactive Filter

```typescript
const [activeFilter, setActiveFilter] = useState<"active" | "inactive">("active")

// Apply in filtered data memo
if (activeFilter === "active") {
  rows = rows.filter(row => row.active && !row.isDeleted)
} else if (activeFilter === "inactive") {
  // Show all but sort inactive first
  rows = rows.filter(row => !row.isDeleted)
  rows.sort((a, b) => {
    if (!a.active && b.active) return -1
    if (a.active && !b.active) return 1
    return 0
  })
}
```

**UI in ListHeader:**
```typescript
<ListHeader
  statusFilter={activeFilter}
  onFilterChange={(filter: string) => setActiveFilter(filter === "active" ? "active" : "inactive")}
  // ... other props
/>
```

### Search Implementation

```typescript
const [searchQuery, setSearchQuery] = useState("")

const handleSearch = useCallback((query: string) => {
  setSearchQuery(query)
}, [])

// Apply in filtered data
const query = searchQuery.trim().toLowerCase()
if (query.length > 0) {
  rows = rows.filter(row => {
    return [
      row.field1,
      row.field2,
      row.field3,
      // ... searchable fields
    ]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .some(value => value.toLowerCase().includes(query))
  })
}
```

### Column Filters

```typescript
const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([])

const handleColumnFiltersChange = useCallback((filters: ColumnFilter[]) => {
  setColumnFilters(dedupeColumnFilters(filters))
}, [])

// Dedupe function
const normalizeFilterKey = (filter: ColumnFilter) =>
  `${filter.columnId}::${(filter.operator ?? "contains").toLowerCase()}::${filter.value.trim().toLowerCase()}`

const dedupeColumnFilters = (filters: ColumnFilter[]) => {
  const seen = new Set<string>()
  return filters
    .map(filter => ({ ...filter, value: filter.value.trim() }))
    .filter(filter => filter.value.length > 0)
    .filter(filter => {
      const key = normalizeFilterKey(filter)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

// Apply in filtered data
if (columnFilters.length > 0) {
  rows = applySimpleFilters(
    rows as unknown as Record<string, unknown>[], 
    columnFilters
  ) as unknown as RowType[]
}
```

### Filter Columns Configuration

```typescript
const filterColumns = useMemo(() => [
  { id: "field1", label: "Field 1 Label" },
  { id: "field2", label: "Field 2 Label" },
  { id: "field3", label: "Field 3 Label" },
  // ... all filterable columns
], [])
```

---

## Pagination

### State & Computed Values

```typescript
// State
const [currentPage, setCurrentPage] = useState(1)
const [pageSize, setPageSize] = useState(10)

// Paginated data
const paginatedData = useMemo(() => {
  const start = (currentPage - 1) * pageSize
  return filteredData.slice(start, start + pageSize)
}, [filteredData, currentPage, pageSize])

// Pagination info
const pagination = useMemo(() => {
  const total = filteredData.length
  const totalPages = Math.max(Math.ceil(total / pageSize), 1)
  return {
    page: currentPage,
    pageSize: pageSize,
    total,
    totalPages
  }
}, [filteredData.length, currentPage, pageSize])

// Auto-adjust page when filtered data changes
useEffect(() => {
  const maxPage = Math.max(Math.ceil(filteredData.length / pageSize), 1)
  if (currentPage > maxPage) {
    setCurrentPage(maxPage)
  }
}, [filteredData.length, pageSize, currentPage])
```

### Handlers

```typescript
const handlePageChange = (page: number) => {
  setCurrentPage(page)
}

const handlePageSizeChange = (size: number) => {
  setPageSize(size)
  setCurrentPage(1) // Reset to first page
}
```

### DynamicTable Integration

```typescript
<DynamicTable
  data={paginatedData}
  pagination={pagination}
  onPageChange={handlePageChange}
  onPageSizeChange={handlePageSizeChange}
  alwaysShowPagination
  // ... other props
/>
```

---

## Bulk Actions

### Selection State Management

```typescript
const [selectedItems, setSelectedItems] = useState<string[]>([])

// Single item select
const handleItemSelect = useCallback((itemId: string, selected: boolean) => {
  setSelectedItems(previous => {
    if (selected) {
      if (previous.includes(itemId)) return previous
      return [...previous, itemId]
    }
    return previous.filter(id => id !== itemId)
  })
}, [])

// Select all (current page)
const handleSelectAll = useCallback((selected: boolean) => {
  if (selected) {
    setSelectedItems(paginatedData.map(row => row.id))
    return
  }
  setSelectedItems([])
}, [paginatedData])

// Clear selection when data changes
useEffect(() => {
  setSelectedItems(prev => prev.filter(id => filteredData.some(row => row.id === id)))
}, [filteredData])
```

### Bulk Action Bar

```typescript
<BulkActionBar
  count={selectedItems.length}
  disabled={bulkActionLoading}
  onSoftDelete={openBulkDeleteDialog}
  onExportCsv={handleBulkExportCsv}
  onChangeOwner={() => setShowBulkOwnerModal(true)}
  onUpdateStatus={() => setShowBulkStatusModal(true)}
/>
```

### Bulk Owner Update

```typescript
const [showBulkOwnerModal, setShowBulkOwnerModal] = useState(false)
const [bulkActionLoading, setBulkActionLoading] = useState(false)
const [owners, setOwners] = useState<Array<{ value: string; label: string }>>([])

// Load owners on mount
useEffect(() => {
  fetch("/api/admin/users?limit=100", { cache: "no-store" })
    .then(async response => {
      if (!response.ok) throw new Error("Failed to load owners")
      const payload = await response.json()
      const items = Array.isArray(payload?.data?.users) ? payload.data.users : []
      setOwners(
        items.map((user: any) => ({ 
          value: user.id, 
          label: user.fullName || user.email 
        }))
      )
    })
    .catch(error => {
      console.error(error)
      setOwners([])
      showError("Unable to load owners", "Please try again later")
    })
}, [showError])

// Bulk update handler
const handleBulkOwnerUpdate = useCallback(async (ownerId: string | null) => {
  if (selectedItems.length === 0) {
    showError("No items selected", "Select at least one item to update.")
    return
  }
  
  setBulkActionLoading(true)
  
  try {
    const outcomes = await Promise.allSettled(
      selectedItems.map(async (itemId) => {
        const response = await fetch(`/api/items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerId: ownerId ?? null })
        })
        
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error || "Failed to update owner")
        }
        
        return itemId
      })
    )
    
    const successes: string[] = []
    const failures: Array<{ itemId: string; message: string }> = []
    
    outcomes.forEach((result, index) => {
      const itemId = selectedItems[index]
      if (result.status === "fulfilled") {
        successes.push(itemId)
      } else {
        const message = result.reason instanceof Error 
          ? result.reason.message 
          : "Unexpected error"
        failures.push({ itemId, message })
      }
    })
    
    if (successes.length > 0) {
      showSuccess(
        `Updated ${successes.length} item${successes.length === 1 ? "" : "s"}`,
        `New owner assigned successfully.`
      )
      onRefresh?.()
    }
    
    if (failures.length > 0) {
      const detail = failures
        .map(item => `${item.itemId}: ${item.message}`)
        .join("; ")
      showError("Failed to update some items", detail)
    }
    
    setSelectedItems(failures.map(item => item.itemId))
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
}, [selectedItems, onRefresh, showError, showSuccess])

// Render modal
<BulkOwnerModal
  isOpen={showBulkOwnerModal}
  owners={owners}
  onClose={() => setShowBulkOwnerModal(false)}
  onSubmit={handleBulkOwnerUpdate}
  isSubmitting={bulkActionLoading}
/>
```

### Bulk Status Update

```typescript
const [showBulkStatusModal, setShowBulkStatusModal] = useState(false)

const handleBulkStatusUpdate = useCallback(async (isActive: boolean) => {
  if (selectedItems.length === 0) {
    showError("No items selected", "Select at least one item to update.")
    return
  }
  
  setBulkActionLoading(true)
  
  try {
    const outcomes = await Promise.allSettled(
      selectedItems.map(async (itemId) => {
        const response = await fetch(`/api/items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: isActive })
        })
        
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error || "Failed to update status")
        }
        
        return itemId
      })
    )
    
    const successes: string[] = []
    const failures: Array<{ itemId: string; message: string }> = []
    
    outcomes.forEach((result, index) => {
      const itemId = selectedItems[index]
      if (result.status === "fulfilled") {
        successes.push(itemId)
      } else {
        const message = result.reason instanceof Error 
          ? result.reason.message 
          : "Unexpected error"
        failures.push({ itemId, message })
      }
    })
    
    if (successes.length > 0) {
      const label = isActive ? "active" : "inactive"
      showSuccess(
        `Marked ${successes.length} item${successes.length === 1 ? "" : "s"} as ${label}`,
        "The status has been updated successfully."
      )
      onRefresh?.()
    }
    
    if (failures.length > 0) {
      const detail = failures
        .map(item => `${item.itemId}: ${item.message}`)
        .join("; ")
      showError("Failed to update some items", detail)
    }
    
    setSelectedItems(failures.map(item => item.itemId))
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
}, [selectedItems, onRefresh, showError, showSuccess])

// Render modal
<BulkStatusModal
  isOpen={showBulkStatusModal}
  onClose={() => setShowBulkStatusModal(false)}
  onSubmit={handleBulkStatusUpdate}
  isSubmitting={bulkActionLoading}
/>
```

### Bulk CSV Export

```typescript
const handleBulkExportCsv = useCallback(() => {
  if (selectedItems.length === 0) {
    showError("No items selected", "Select at least one item to export.")
    return
  }
  
  const rows = paginatedData.filter(row => selectedItems.includes(row.id))
  
  if (rows.length === 0) {
    showError(
      "Items unavailable",
      "Unable to locate the selected items. Refresh and try again."
    )
    return
  }
  
  const headers = [
    "Column 1",
    "Column 2",
    "Column 3",
    // ... all exportable columns
  ]
  
  const escapeCsv = (value: string | null | undefined) => {
    if (value === null || value === undefined) return ""
    const s = String(value)
    if (s.includes("\"") || s.includes(",") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  
  const formatCsvDate = (value: string | Date | null | undefined) => {
    if (!value) return ""
    const dateValue = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(dateValue.getTime())) return ""
    return dateValue.toISOString().slice(0, 10)
  }
  
  const lines = [
    headers.join(","),
    ...rows.map(row =>
      [
        row.field1,
        row.field2,
        formatCsvDate(row.dateField),
        // ... map all fields
      ]
        .map(escapeCsv)
        .join(",")
    )
  ]
  
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]
  link.href = url
  link.download = `items-export-${timestamp}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
  
  showSuccess(
    `Exported ${rows.length} item${rows.length === 1 ? "" : "s"}`,
    "Check your downloads for the CSV file."
  )
}, [selectedItems, paginatedData, showError, showSuccess])
```

---

## Modal Integration

### Column Chooser Modal

```typescript
const [showColumnSettings, setShowColumnSettings] = useState(false)

const {
  columns: preferenceColumns,
  handleColumnsChange,
  saveChangesOnModalClose,
} = useTablePreferences("storage-key", BASE_COLUMNS)

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

**Features:**
- Drag and drop column reordering
- Show/hide column toggles
- Persists preferences per user
- Auto-saves on modal close

### Create/Edit Modal Pattern

Each entity type has dedicated modals with consistent patterns:

```typescript
<EntityCreateModal
  isOpen={createModalOpen}
  parentId={parentEntity?.id}
  parentName={parentEntity?.name}
  onClose={() => setCreateModalOpen(false)}
  onSuccess={handleCreateSuccess}
/>

<EntityEditModal
  isOpen={Boolean(editingItem)}
  itemId={editingItem?.id ?? null}
  onClose={() => setEditingItem(null)}
  onSuccess={handleEditSuccess}
/>
```

**Modal Props Standard:**
- `isOpen`: Boolean control
- `onClose`: Close handler
- `onSuccess`: Success callback (triggers refresh)
- Entity-specific data props

---

## API Integration

### Endpoint Patterns

```
GET    /api/[entities]                    - List all
GET    /api/[entities]/[id]               - Get one
POST   /api/[entities]                    - Create
PATCH  /api/[entities]/[id]               - Update/Soft delete
DELETE /api/[entities]/[id]               - Permanent delete

Query Parameters:
  ?stage=soft              - Soft delete (PATCH)
  ?stage=permanent         - Permanent delete (DELETE)
  ?bypassConstraints=true  - Skip constraint checks
```

### Fetch Patterns

```typescript
// GET
const response = await fetch(`/api/items/${id}`, {
  cache: "no-store"
})
const data = await response.json()

// POST
const response = await fetch("/api/items", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
})

// PATCH
const response = await fetch(`/api/items/${id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(updates)
})

// DELETE (soft)
const response = await fetch(`/api/items/${id}?stage=soft`, {
  method: "DELETE"
})

// DELETE (permanent)
const response = await fetch(`/api/items/${id}?stage=permanent`, {
  method: "DELETE"
})

// Restore
const response = await fetch(`/api/items/${id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "restore" })
})
```

### Error Handling

```typescript
try {
  const response = await fetch(url, options)
  
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    
    // Handle constraint violations (409)
    if (response.status === 409 && data?.constraints) {
      return { success: false, constraints: data.constraints }
    }
    
    // Generic error
    throw new Error(data?.error || "Request failed")
  }
  
  const data = await response.json()
  return { success: true, data }
  
} catch (error) {
  console.error("API error:", error)
  return {
    success: false,
    error: error instanceof Error ? error.message : "Unknown error"
  }
}
```

---

## UI/UX Patterns

### Layout Structure

```tsx
<div className="flex h-full flex-col overflow-hidden">
  <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-4 sm:px-6 lg:px-8">
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {/* Detail Section */}
      <div className="w-full xl:max-w-[1800px]">
        <div className="rounded-2xl bg-gray-100 p-3 shadow-sm">
          {/* Content */}
        </div>
      </div>
      
      {/* Tabbed Section */}
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-1 border-x border-t border-gray-200 bg-gray-100 p-2">
          {/* Tabs */}
        </div>
        
        {/* Tab Content */}
        <div className="grid flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-1 border-x border-b border-gray-200 bg-white min-h-0 overflow-hidden pt-0.5 px-3 pb-0">
          <ListHeader />
          <BulkActionBar />
          <div ref={tableAreaRefCallback} className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <DynamicTable />
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

### Color Palette

| Element | Color | Class |
|---------|-------|-------|
| Primary (Blue) | #2563eb | `primary-600` |
| Primary Hover | #1d4ed8 | `primary-700` |
| Success (Green) | #16a34a | `green-600` |
| Error (Red) | #dc2626 | `red-600` |
| Warning (Yellow) | #ca8a04 | `yellow-600` |
| Gray Backgrounds | #f9fafb | `gray-50` |
| Gray Borders | #e5e7eb | `gray-200` |
| Text Primary | #111827 | `gray-900` |
| Text Secondary | #6b7280 | `gray-600` |
| Text Muted | #9ca3af | `gray-500` |

### Typography

| Element | Size | Weight | Class |
|---------|------|--------|-------|
| Section Labels | 12px | 600 | `text-xs font-semibold uppercase` |
| Field Labels | 12px | 600 | `text-xs font-semibold uppercase` |
| Field Sub-Labels | 12px | 500 | `text-xs font-medium` |
| Field Values | 14px | 400 | `text-sm` |
| Tab Labels | 14px | 600 | `text-sm font-semibold` |
| Button Text | 14px | 600 | `text-sm font-semibold` |
| Table Text | 14px | 400 | `text-sm` |

### Spacing

| Element | Padding/Margin | Class |
|---------|---------------|-------|
| Detail Section | 12px | `p-3` |
| Tab Navigation | 8px | `p-2` |
| Tab Content | 12px (x) | `px-3` |
| Field Rows | 16px | `gap-4` |
| Button Groups | 8px | `gap-2` |
| Icon Buttons | 4px | `p-1` |
| Tabs Gap | 4px | `gap-1` |

### Borders & Shadows

| Element | Style | Class |
|---------|-------|-------|
| Detail Section | 2px solid | `border-2 border-gray-400` |
| Field Boxes | 2px solid | `border-2 border-gray-400` |
| Tab Container | 1px solid | `border border-gray-200` |
| Tables | 1px solid | `border border-gray-200` |
| Buttons | 1px solid | `border border-gray-300` |
| Detail Shadow | Small | `shadow-sm` |
| Active Tab | Medium | `shadow-md` |

### Interactive States

```typescript
// Hover
"hover:bg-primary-700"
"hover:text-primary-700"
"hover:border-primary-400"

// Focus
"focus:outline-none focus:ring-2 focus:ring-primary-500"

// Disabled
"disabled:opacity-50 disabled:cursor-not-allowed"

// Active
"bg-primary-600 text-white"

// Loading
"opacity-50 pointer-events-none"
```

---

## Accessibility

### ARIA Labels

```tsx
// Checkboxes
<input
  type="checkbox"
  aria-label={`Select ${itemName}`}
  checked={checked}
  onChange={handleChange}
/>

// Buttons
<button
  aria-label="Edit item"
  onClick={handleEdit}
>
  <Edit className="h-4 w-4" />
</button>

// Toggle switches
<button
  type="button"
  title={active ? "Active" : "Inactive"}
  aria-label={`Toggle status: currently ${active ? "active" : "inactive"}`}
  onClick={handleToggle}
>
  {/* Switch UI */}
</button>
```

### Screen Reader Support

```tsx
// Hide decorative icons from screen readers
<Check className="h-3 w-3" aria-hidden="true" />

// Screen reader only input (custom checkbox)
<input type="checkbox" className="sr-only" />

// Loading states
<Loader2 className="animate-spin" role="status" aria-label="Loading" />
```

### Keyboard Navigation

- All interactive elements are keyboard accessible
- Tab order follows visual flow
- Enter/Space activates buttons
- Escape closes modals
- Arrow keys navigate in dropdowns

### Focus Management

```tsx
// Trap focus in modals
const firstFocusableElement = modalRef.current?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
firstFocusableElement?.focus()

// Restore focus after modal close
const previousFocus = document.activeElement
// ... modal interaction
previousFocus?.focus()
```

---

## Performance Optimization

### Memoization Strategy

```typescript
// Filtered data - depends on source data and filters
const filteredData = useMemo(() => {
  // filtering logic
}, [sourceData, activeFilter, searchQuery, columnFilters])

// Paginated data - depends on filtered data and pagination
const paginatedData = useMemo(() => {
  // pagination logic
}, [filteredData, currentPage, pageSize])

// Pagination info - depends on filtered data length
const pagination = useMemo(() => {
  // calculate pagination
}, [filteredData.length, currentPage, pageSize])

// Table columns - depends on preferences and selection state
const tableColumns = useMemo(() => {
  return preferenceColumns.map(column => {
    // custom renders
  })
}, [preferenceColumns, selectedItems, /* other dependencies */])

// Filter columns - static, empty dependency array
const filterColumns = useMemo(() => [
  { id: "field1", label: "Label 1" },
  // ...
], [])
```

### Callback Optimization

```typescript
// Use useCallback for handlers passed to children
const handleItemSelect = useCallback((id: string, selected: boolean) => {
  // logic
}, [/* dependencies */])

const handleSelectAll = useCallback((selected: boolean) => {
  // logic
}, [paginatedData])

const handlePageChange = useCallback((page: number) => {
  setCurrentPage(page)
}, [])

const handleSearch = useCallback((query: string) => {
  setSearchQuery(query)
}, [])
```

### Lazy Loading Patterns

```typescript
// Load options only when modal opens
useEffect(() => {
  if (modalOpen && !options && !optionsLoading) {
    loadOptions().catch(console.error)
  }
}, [modalOpen, options, optionsLoading, loadOptions])

// Debounce search input (if needed)
const debouncedSearch = useMemo(
  () => debounce((query: string) => setSearchQuery(query), 300),
  []
)
```

### Virtualization Considerations

For very large datasets (1000+ rows), consider:
- Virtual scrolling (react-window, react-virtuoso)
- Server-side pagination instead of client-side
- Lazy loading of tab content
- Progressive loading with intersection observer

---

## Common Patterns Checklist

When implementing a new detail view with tabbed tables:

### ✅ Structure
- [ ] Main entity detail section with collapse/expand
- [ ] Tab navigation with active state styling
- [ ] ListHeader with search, filters, and column settings
- [ ] BulkActionBar with count display
- [ ] DynamicTable with pagination

### ✅ State Management
- [ ] Tab selection state
- [ ] Pagination state (page, pageSize)
- [ ] Search query state
- [ ] Column filters state
- [ ] Selected items state
- [ ] Modal states (create, edit, delete, settings)
- [ ] Loading states for async operations

### ✅ Table Configuration
- [ ] BASE_COLUMNS definition with proper widths
- [ ] useTablePreferences hook integration
- [ ] Multi-action column with checkbox, toggle, actions
- [ ] Custom column renders for links, dates, etc.
- [ ] Filter columns configuration

### ✅ Filtering
- [ ] Active/Inactive toggle filter
- [ ] Global search across relevant fields
- [ ] Column-based filters via ListHeader
- [ ] Filter deduplication logic
- [ ] Proper filter application in memo

### ✅ Pagination
- [ ] Paginated data slice
- [ ] Pagination info object
- [ ] Auto-adjust page on filter change
- [ ] Page change handler
- [ ] Page size change handler

### ✅ CRUD Operations
- [ ] Create modal integration
- [ ] Edit modal integration
- [ ] Soft delete with TwoStageDeleteDialog
- [ ] Permanent delete support
- [ ] Restore functionality
- [ ] Status toggle handler

### ✅ Bulk Actions
- [ ] Item selection (single & all)
- [ ] Bulk delete dialog
- [ ] Bulk owner update modal
- [ ] Bulk status update modal
- [ ] CSV export functionality
- [ ] Proper error handling for partial failures

### ✅ API Integration
- [ ] Load related entities from parent
- [ ] Fetch owners/options when needed
- [ ] Proper error handling
- [ ] Success/error toast notifications
- [ ] Refresh data after mutations

### ✅ Accessibility
- [ ] ARIA labels on controls
- [ ] Keyboard navigation support
- [ ] Screen reader announcements
- [ ] Focus management in modals
- [ ] Semantic HTML structure

### ✅ Performance
- [ ] Memoize filtered data
- [ ] Memoize paginated data
- [ ] Memoize table columns
- [ ] useCallback for handlers
- [ ] Efficient re-render strategy

### ✅ UX Polish
- [ ] Loading states
- [ ] Empty states
- [ ] Error states
- [ ] Success feedback
- [ ] Disabled states during async ops
- [ ] Smooth transitions
- [ ] Responsive design

---

## Code Templates

### New Tab Boilerplate

```typescript
// 1. Define base columns
const NEW_TAB_TABLE_BASE_COLUMNS: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 200,
    minWidth: 160,
    maxWidth: 240,
    type: "multi-action",
  },
  // ... other columns
]

// 2. Add tab to entity interface
interface ParentEntityDetail {
  // ... other fields
  newTabItems: NewTabItemRow[]
}

// 3. Add row interface
export interface NewTabItemRow {
  id: string
  active: boolean
  // ... other fields
  isDeleted?: boolean
}

// 4. Add tab to TABS array
const TABS = [
  // ... existing tabs
  { id: "newTab", label: "New Tab Label" }
]

// 5. Add state variables
const [newTabCurrentPage, setNewTabCurrentPage] = useState(1)
const [newTabPageSize, setNewTabPageSize] = useState(10)
const [newTabSearchQuery, setNewTabSearchQuery] = useState("")
const [newTabColumnFilters, setNewTabColumnFilters] = useState<ColumnFilter[]>([])
const [selectedNewTabItems, setSelectedNewTabItems] = useState<string[]>([])
const [newTabModalOpen, setNewTabModalOpen] = useState(false)
const [editingNewTabItem, setEditingNewTabItem] = useState<NewTabItemRow | null>(null)
const [showNewTabColumnSettings, setShowNewTabColumnSettings] = useState(false)
// ... other states

// 6. Add table preferences
const {
  columns: newTabPreferenceColumns,
  loading: newTabPreferencesLoading,
  saving: newTabPreferencesSaving,
  hasUnsavedChanges: newTabHasUnsavedChanges,
  lastSaved: newTabLastSaved,
  handleColumnsChange: handleNewTabTableColumnsChange,
  saveChanges: saveNewTabTablePreferences,
  saveChangesOnModalClose: saveNewTabPrefsOnModalClose,
} = useTablePreferences("parent-details:newTab", NEW_TAB_TABLE_BASE_COLUMNS)

// 7. Add handlers (see patterns above)
// 8. Add filtered/paginated data (see patterns above)
// 9. Add table columns with custom renders (see patterns above)
// 10. Add render in tab content (see structure above)
// 11. Add modals at bottom of component
```

---

## Testing Checklist

### Functionality Testing

- [ ] Create new item
- [ ] Edit existing item
- [ ] Delete item (soft)
- [ ] Delete item (permanent)
- [ ] Restore deleted item
- [ ] Toggle item status
- [ ] Select single item
- [ ] Select all items (current page)
- [ ] Bulk delete
- [ ] Bulk owner update
- [ ] Bulk status update
- [ ] Export CSV
- [ ] Search functionality
- [ ] Column filters
- [ ] Active/Inactive filter
- [ ] Pagination navigation
- [ ] Page size change
- [ ] Column show/hide
- [ ] Column reorder
- [ ] Tab switching
- [ ] Detail collapse/expand

### Edge Cases

- [ ] Empty state (no items)
- [ ] Single item
- [ ] Large dataset (100+ items)
- [ ] Very long text in fields
- [ ] Special characters in search
- [ ] Multiple filters applied
- [ ] Last page with odd number of items
- [ ] Delete item on last page
- [ ] Network error handling
- [ ] Permission denied scenarios

### Browser Testing

- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers

### Accessibility Testing

- [ ] Keyboard navigation
- [ ] Screen reader compatibility
- [ ] High contrast mode
- [ ] Zoom levels (100%, 150%, 200%)

---

## Troubleshooting Guide

### Issue: Table not filling viewport
**Solution:** Check table height measurement implementation and ensure proper flex container hierarchy

### Issue: Pagination shows wrong page after filter
**Solution:** Add useEffect to auto-adjust page when filtered data changes

### Issue: Selected items persist after delete
**Solution:** Clear selection in delete success handlers and filter selection when data changes

### Issue: Column preferences not saving
**Solution:** Verify unique storage key and check saveChangesOnModalClose is called

### Issue: Bulk actions affecting wrong items
**Solution:** Ensure deleteTargets are filtered based on current selection, not stale data

### Issue: Toggle switch not responding
**Solution:** Check event.stopPropagation() is called and handler receives correct parameters

### Issue: Modal doesn't refresh table
**Solution:** Call onRefresh in success handler, not in close handler

---

## Future Enhancements

- [ ] Advanced filtering (date ranges, number ranges, multi-select)
- [ ] Saved filter presets
- [ ] Column grouping
- [ ] Row expansion/collapse for nested data
- [ ] Drag and drop row reordering
- [ ] Bulk edit inline
- [ ] Export to Excel with formatting
- [ ] Print-friendly view
- [ ] Activity audit log integration
- [ ] Real-time updates via WebSocket

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-15 | Initial reference guide |

---

## References

- `components/account-details-view.tsx` - Account detail implementation
- `components/contact-details-view.tsx` - Contact detail implementation
- `components/dynamic-table.tsx` - Core table component
- `components/list-header.tsx` - Header controls
- `hooks/useTablePreferences.ts` - Preference persistence
- `lib/filter-utils.ts` - Filter application logic

