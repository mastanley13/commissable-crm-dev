# Table Customization Implementation Guide

## Overview
This document outlines the complete implementation for user-specific table customizations including column reordering, width adjustments, and show/hide functionality that persists to user profiles.

## Database Schema

### Prisma Schema Addition
Add this to your `prisma/schema.prisma`:

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  // ... existing fields
  
  // New relationship
  tablePreferences TablePreference[]
}

model TablePreference {
  id            String   @id @default(cuid())
  userId        String
  pageType      String   // 'accounts', 'contacts', 'opportunities', etc.
  columnOrder   String   // JSON array of column IDs in preferred order
  columnWidths  String   // JSON object mapping column ID to width
  hiddenColumns String?  // JSON array of hidden column IDs
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, pageType])
}
```

### Database Migration
Run: `npx prisma migrate dev --name add-table-preferences`

## API Implementation

### 1. API Route: `/api/table-preferences/[pageType]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { pageType: string } }
) {
  try {
    // Get user ID from session/auth
    const userId = 'user-id-from-session' // Replace with actual auth logic
    
    const preference = await prisma.tablePreference.findUnique({
      where: {
        userId_pageType: {
          userId,
          pageType: params.pageType
        }
      }
    })

    if (!preference) {
      return NextResponse.json(null)
    }

    return NextResponse.json({
      columnOrder: JSON.parse(preference.columnOrder),
      columnWidths: JSON.parse(preference.columnWidths),
      hiddenColumns: preference.hiddenColumns ? JSON.parse(preference.hiddenColumns) : []
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { pageType: string } }
) {
  try {
    const userId = 'user-id-from-session' // Replace with actual auth logic
    const { columnOrder, columnWidths, hiddenColumns } = await request.json()

    const preference = await prisma.tablePreference.upsert({
      where: {
        userId_pageType: {
          userId,
          pageType: params.pageType
        }
      },
      update: {
        columnOrder: JSON.stringify(columnOrder),
        columnWidths: JSON.stringify(columnWidths),
        hiddenColumns: hiddenColumns ? JSON.stringify(hiddenColumns) : null,
        updatedAt: new Date()
      },
      create: {
        userId,
        pageType: params.pageType,
        columnOrder: JSON.stringify(columnOrder),
        columnWidths: JSON.stringify(columnWidths),
        hiddenColumns: hiddenColumns ? JSON.stringify(hiddenColumns) : null
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}
```

## Frontend Implementation

### 2. Custom Hook: `hooks/useTablePreferences.ts`

```typescript
import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from './useDebounce'

export interface TablePreferences {
  columnOrder: string[]
  columnWidths: Record<string, number>
  hiddenColumns: string[]
}

export function useTablePreferences(pageType: string) {
  const [preferences, setPreferences] = useState<TablePreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load preferences from localStorage first, then from server
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Try localStorage first for immediate loading
        const localKey = `table-preferences-${pageType}`
        const localPrefs = localStorage.getItem(localKey)
        
        if (localPrefs) {
          setPreferences(JSON.parse(localPrefs))
        }

        // Then fetch from server
        const response = await fetch(`/api/table-preferences/${pageType}`)
        if (response.ok) {
          const serverPrefs = await response.json()
          if (serverPrefs) {
            setPreferences(serverPrefs)
            // Update localStorage with server data
            localStorage.setItem(localKey, JSON.stringify(serverPrefs))
          }
        }
      } catch (error) {
        console.error('Failed to load table preferences:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPreferences()
  }, [pageType])

  // Debounced save function
  const debouncedSave = useDebounce(async (newPreferences: TablePreferences) => {
    try {
      setSaving(true)
      
      // Update localStorage immediately
      const localKey = `table-preferences-${pageType}`
      localStorage.setItem(localKey, JSON.stringify(newPreferences))
      
      // Save to server
      const response = await fetch(`/api/table-preferences/${pageType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPreferences),
      })

      if (!response.ok) {
        throw new Error('Failed to save preferences')
      }
    } catch (error) {
      console.error('Failed to save table preferences:', error)
    } finally {
      setSaving(false)
    }
  }, 1000)

  const updatePreferences = useCallback((updates: Partial<TablePreferences>) => {
    if (!preferences) return

    const newPreferences = { ...preferences, ...updates }
    setPreferences(newPreferences)
    debouncedSave(newPreferences)
  }, [preferences, debouncedSave])

  const resetPreferences = useCallback(() => {
    setPreferences(null)
    localStorage.removeItem(`table-preferences-${pageType}`)
    // Optionally call API to delete server preferences
  }, [pageType])

  return {
    preferences,
    loading,
    saving,
    updatePreferences,
    resetPreferences
  }
}
```

### 3. Debounce Hook: `hooks/useDebounce.ts`

```typescript
import { useEffect, useState } from 'react'

export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const [debouncedCallback] = useState(() => callback)

  useEffect(() => {
    const handler = setTimeout(() => {
      debouncedCallback()
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [debouncedCallback, delay])

  return debouncedCallback as T
}
```

### 4. Enhanced Dynamic Table Component

Update your `components/dynamic-table.tsx`:

```typescript
'use client'

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { ChevronUp, ChevronDown, Trash2, MoreVertical, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTablePreferences, TablePreferences } from '@/hooks/useTablePreferences'

export interface Column {
  id: string
  label: string
  width: number
  minWidth?: number
  maxWidth?: number
  sortable?: boolean
  resizable?: boolean
  type?: 'text' | 'toggle' | 'action' | 'checkbox' | 'email' | 'phone'
  accessor?: string
  render?: (value: any, row: any, index: number) => React.ReactNode
  hideable?: boolean // New property
}

export interface TableProps {
  columns: Column[]
  data: any[]
  className?: string
  onSort?: (column: string, direction: 'asc' | 'desc') => void
  onRowClick?: (row: any, index: number) => void
  loading?: boolean
  emptyMessage?: string
  pageType: string // New required prop
  onPreferencesChange?: (preferences: TablePreferences) => void // New callback
}

export function DynamicTable({
  columns: initialColumns,
  data,
  className,
  onSort,
  onRowClick,
  loading = false,
  emptyMessage = "No data available",
  pageType,
  onPreferencesChange
}: TableProps) {
  const { preferences, updatePreferences, saving } = useTablePreferences(pageType)
  const [showSettings, setShowSettings] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null)
  
  const tableRef = useRef<HTMLDivElement>(null)

  // Apply user preferences to columns
  const columns = useMemo(() => {
    if (!preferences) return initialColumns

    let processedColumns = [...initialColumns]

    // Apply column order
    if (preferences.columnOrder.length > 0) {
      const orderedColumns: Column[] = []
      preferences.columnOrder.forEach(columnId => {
        const column = processedColumns.find(col => col.id === columnId)
        if (column) orderedColumns.push(column)
      })
      // Add any new columns not in preferences
      processedColumns.forEach(column => {
        if (!preferences.columnOrder.includes(column.id)) {
          orderedColumns.push(column)
        }
      })
      processedColumns = orderedColumns
    }

    // Apply column widths
    if (preferences.columnWidths) {
      processedColumns = processedColumns.map(col => ({
        ...col,
        width: preferences.columnWidths[col.id] || col.width
      }))
    }

    // Filter out hidden columns
    if (preferences.hiddenColumns.length > 0) {
      processedColumns = processedColumns.filter(col => 
        !preferences.hiddenColumns.includes(col.id)
      )
    }

    return processedColumns
  }, [initialColumns, preferences])

  // Calculate grid template columns
  const gridTemplate = useMemo(() => {
    return columns.map(col => `${col.width}px`).join(' ')
  }, [columns])

  // Handle column sorting
  const handleSort = (column: Column) => {
    if (!column.sortable) return

    const direction = sortConfig?.key === column.id && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    setSortConfig({ key: column.id, direction })
    onSort?.(column.id, direction)
  }

  // Handle column resizing with preference saving
  const handleMouseDown = useCallback((e: React.MouseEvent, columnId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    const column = columns.find(col => col.id === columnId)
    if (!column || column.resizable === false) return

    setResizing({
      columnId,
      startX: e.clientX,
      startWidth: column.width
    })
  }, [columns])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing) return

    const deltaX = e.clientX - resizing.startX
    const newWidth = Math.max(
      resizing.startWidth + deltaX,
      columns.find(col => col.id === resizing.columnId)?.minWidth || 100
    )

    const updatedWidth = Math.min(newWidth, columns.find(col => col.id === resizing.columnId)?.maxWidth || 600)
    
    // Update column widths in preferences
    updatePreferences({
      columnWidths: {
        ...preferences?.columnWidths,
        [resizing.columnId]: updatedWidth
      }
    })
  }, [resizing, columns, updatePreferences, preferences?.columnWidths])

  const handleMouseUp = useCallback(() => {
    setResizing(null)
  }, [])

  // Attach global mouse events for resizing
  React.useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [resizing, handleMouseMove, handleMouseUp])

  // Handle column drag and drop with preference saving
  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    setDraggedColumn(columnId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()
    if (!draggedColumn || draggedColumn === targetColumnId) return

    const draggedIndex = columns.findIndex(col => col.id === draggedColumn)
    const targetIndex = columns.findIndex(col => col.id === targetColumnId)

    const newColumns = [...columns]
    const [movedColumn] = newColumns.splice(draggedIndex, 1)
    newColumns.splice(targetIndex, 0, movedColumn)

    // Update column order in preferences
    const newColumnOrder = newColumns.map(col => col.id)
    updatePreferences({
      columnOrder: newColumnOrder
    })

    setDraggedColumn(null)
  }

  // Handle column visibility toggle
  const toggleColumnVisibility = (columnId: string) => {
    const currentHidden = preferences?.hiddenColumns || []
    const newHidden = currentHidden.includes(columnId)
      ? currentHidden.filter(id => id !== columnId)
      : [...currentHidden, columnId]
    
    updatePreferences({
      hiddenColumns: newHidden
    })
  }

  // Notify parent component of preference changes
  useEffect(() => {
    if (preferences && onPreferencesChange) {
      onPreferencesChange(preferences)
    }
  }, [preferences, onPreferencesChange])

  // Render cell content based on column type (existing implementation)
  const renderCell = (column: Column, value: any, row: any, index: number) => {
    // ... existing renderCell implementation
    if (column.render) {
      return column.render(value, row, index)
    }

    switch (column.type) {
      case 'toggle':
        return (
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={value} readOnly className="sr-only" />
            <div className={`w-10 h-5 rounded-full transition-colors ${
              value ? 'bg-blue-600' : 'bg-gray-300'
            }`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform transform ${
                value ? 'translate-x-5' : 'translate-x-1'
              } mt-0.5`}></div>
            </div>
          </label>
        )
      case 'action':
        return (
          <button className="text-red-500 hover:text-red-700 p-1 rounded transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        )
      case 'checkbox':
        return (
          <input
            type="checkbox"
            className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
            checked={value}
            readOnly
          />
        )
      case 'email':
        return (
          <a href={`mailto:${value}`} className="text-blue-600 hover:text-blue-800 transition-colors">
            {value}
          </a>
        )
      case 'phone':
        return (
          <a href={`tel:${value}`} className="text-gray-900 hover:text-blue-600 transition-colors">
            {value}
          </a>
        )
      default:
        return <span className="truncate">{value}</span>
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("bg-white rounded-lg border border-gray-200 overflow-hidden", className)}>
      {/* Table Settings Button */}
      <div className="flex justify-end p-2 border-b border-gray-200">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
        >
          <Settings className="h-4 w-4" />
          Customize Table
          {saving && <span className="text-xs text-blue-600">Saving...</span>}
        </button>
      </div>

      {/* Column Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Column Settings</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {initialColumns.map((column) => (
              <label key={column.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!preferences?.hiddenColumns.includes(column.id)}
                  onChange={() => toggleColumnVisibility(column.id)}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="truncate">{column.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div 
        ref={tableRef}
        className="table-grid overflow-x-auto"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {/* Header */}
        <div className="table-header contents">
          {columns.map((column) => (
            <div
              key={column.id}
              className={cn(
                "table-cell bg-gray-50 font-medium text-gray-900 relative select-none",
                column.sortable && "cursor-pointer hover:bg-gray-100"
              )}
              draggable
              onDragStart={(e) => handleDragStart(e, column.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
              onClick={() => handleSort(column)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="truncate">{column.label}</span>
                  {column.sortable && sortConfig?.key === column.id && (
                    sortConfig.direction === 'asc' ? 
                      <ChevronUp className="h-4 w-4 text-gray-400" /> :
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Column resizer */}
              {column.resizable !== false && (
                <div
                  className={cn(
                    "column-resizer",
                    resizing?.columnId === column.id && "resizing"
                  )}
                  onMouseDown={(e) => handleMouseDown(e, column.id)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Data rows */}
        {data.length === 0 ? (
          <div 
            className="col-span-full p-8 text-center text-gray-500"
            style={{ gridColumn: `1 / ${columns.length + 1}` }}
          >
            {emptyMessage}
          </div>
        ) : (
          data.map((row, rowIndex) => (
            <div key={rowIndex} className="table-row contents">
              {columns.map((column) => (
                <div
                  key={`${rowIndex}-${column.id}`}
                  className={cn(
                    "table-cell text-sm text-gray-900",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row, rowIndex)}
                >
                  {renderCell(column, row[column.accessor || column.id], row, rowIndex)}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {data.length > 0 && (
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-gray-500 hover:text-gray-700 transition-colors">
                Previous
              </button>
              <span className="px-3 py-1.5 bg-primary-600 text-white rounded">1</span>
              <button className="px-3 py-1.5 text-gray-500 hover:text-gray-700 transition-colors">
                Next
              </button>
            </div>
            <div className="flex items-center gap-4">
              <span>Showing 1 to {Math.min(data.length, 11)} of {data.length} entries</span>
              <div className="flex items-center gap-2">
                <span>Show</span>
                <select className="border border-gray-300 rounded px-2 py-1 text-sm">
                  <option>200</option>
                  <option>100</option>
                  <option>50</option>
                  <option>25</option>
                </select>
                <span>entries</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

### 5. Updated Page Components

Update your page components to use the new table props:

**`app/(dashboard)/accounts/page.tsx`:**
```typescript
// ... existing imports

export default function AccountsPage() {
  // ... existing state and handlers

  return (
    <div className="h-full flex flex-col">
      {/* List Header */}
      <ListHeader
        searchPlaceholder="Search Here"
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onCreateClick={handleCreateAccount}
      />

      {/* Table */}
      <div className="flex-1 p-6">
        <DynamicTable
          columns={accountColumns}
          data={filteredAccounts}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={loading}
          emptyMessage="No accounts found"
          pageType="accounts" // New required prop
        />
      </div>
    </div>
  )
}
```

**`app/(dashboard)/contacts/page.tsx`:**
```typescript
// ... existing imports

export default function ContactsPage() {
  // ... existing state and handlers

  return (
    <div className="h-full flex flex-col">
      {/* List Header */}
      <ListHeader
        searchPlaceholder="Search Here"
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onCreateClick={handleCreateContact}
      />

      {/* Table */}
      <div className="flex-1 p-6">
        <DynamicTable
          columns={contactColumns}
          data={contactsWithSelection}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={loading}
          emptyMessage="No contacts found"
          pageType="contacts" // New required prop
        />
      </div>
    </div>
  )
}
```

## CSS Styles

Add these styles to your `globals.css`:

```css
/* Table Grid Styles */
.table-grid {
  display: grid;
  min-width: 100%;
}

.table-header {
  position: sticky;
  top: 0;
  z-index: 10;
}

.table-cell {
  padding: 12px 16px;
  border-right: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  min-height: 48px;
}

.table-cell:last-child {
  border-right: none;
}

.table-row:hover .table-cell {
  background-color: #f9fafb;
}

/* Column Resizer */
.column-resizer {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  background-color: transparent;
  transition: background-color 0.2s;
}

.column-resizer:hover {
  background-color: #3b82f6;
}

.column-resizer.resizing {
  background-color: #3b82f6;
}

/* Drag and Drop Styles */
.table-cell[draggable="true"] {
  cursor: move;
}

.table-cell[draggable="true"]:hover {
  background-color: #f3f4f6;
}
```

## Implementation Steps

1. **Database Setup:**
   - Add the Prisma schema changes
   - Run the migration: `npx prisma migrate dev --name add-table-preferences`
   - Generate Prisma client: `npx prisma generate`

2. **API Implementation:**
   - Create the API route file
   - Test the endpoints with Postman or similar

3. **Frontend Hooks:**
   - Create the `useTablePreferences` hook
   - Create the `useDebounce` hook

4. **Component Updates:**
   - Update the `DynamicTable` component
   - Update all page components to include `pageType` prop

5. **Styling:**
   - Add the CSS styles to your global stylesheet

6. **Testing:**
   - Test column reordering
   - Test column resizing
   - Test column visibility toggling
   - Test persistence across page refreshes
   - Test cross-device synchronization

## Features Included

- ✅ Column reordering via drag-and-drop
- ✅ Column width adjustment with persistence
- ✅ Show/hide columns functionality
- ✅ User-specific preferences per page type
- ✅ Local storage for immediate updates
- ✅ Server synchronization for cross-device consistency
- ✅ Debounced saving to prevent excessive API calls
- ✅ Visual feedback during saving
- ✅ Fallback to default settings if no preferences exist

## Future Enhancements

- Column sorting preferences
- Custom column groupings
- Saved table views
- Export preferences
- Team/organization-wide default preferences
- Column filtering preferences
- Row height customization
