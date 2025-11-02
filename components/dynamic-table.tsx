"use client"

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { ChevronUp, ChevronDown, Trash2, Check, Edit } from "lucide-react"
import { cn } from "@/lib/utils"
import { isRowInactive } from "@/lib/row-state"

const getRowId = (row: any): string | undefined => row?.id ?? row?.uuid ?? row?.key

export interface Column {
  id: string
  label: string
  width: number
  minWidth?: number
  maxWidth?: number
  sortable?: boolean
  resizable?: boolean
  type?: "text" | "toggle" | "action" | "checkbox" | "email" | "phone" | "multi-action"
  accessor?: string
  render?: (value: any, row: any, index: number) => React.ReactNode
  hidden?: boolean
  hideable?: boolean
}

export interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface TableProps {
  columns: Column[]
  data: any[]
  className?: string
  onSort?: (column: string, direction: "asc" | "desc") => void
  onRowClick?: (row: any, index: number) => void
  loading?: boolean
  emptyMessage?: string
  onColumnsChange?: (columns: Column[]) => void
  pagination?: PaginationInfo
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  selectedItems?: string[]
  onItemSelect?: (itemId: string, selected: boolean, row: any) => void
  onSelectAll?: (selected: boolean) => void
  onToggle?: (row: any, columnId: string, value: boolean) => void
  autoSizeColumns?: boolean // Enable automatic column sizing on mount
  fillContainerWidth?: boolean // Stretch columns to match parent width
  alwaysShowPagination?: boolean // Always render pagination controls
  hideSelectAllLabel?: boolean // Hide the 'Select All' label in the select column header
  selectHeaderLabel?: string // Text label to show next to the select-all checkbox
  maxBodyHeight?: number // Maximum height for the table body with scroll
}

export function DynamicTable({
  columns: initialColumns,
  data,
  className,
  onSort,
  onRowClick,
  loading = false,
  emptyMessage = "No data available",
  onColumnsChange,
  pagination,
  onPageChange,
  onPageSizeChange,
  selectedItems = [],
  onItemSelect,
  onSelectAll,
  onToggle,
  autoSizeColumns = false, // Changed default to false to prevent conflicts
  fillContainerWidth = false,
  alwaysShowPagination = false,
  hideSelectAllLabel = false,
  selectHeaderLabel,
  maxBodyHeight
}: TableProps) {
  const SortTriangles = useCallback(({ direction }: { direction: "asc" | "desc" | null }) => {
    const base = "w-2.5 h-2.5"
    const active = "text-white"
    const inactive = "text-blue-200"
    return (
      <span className="ml-1 flex flex-col items-center justify-center leading-none">
        <svg
          viewBox="0 0 12 8"
          aria-hidden="true"
          className={cn(base, direction === "asc" ? active : inactive)}
        >
          <path d="M6 0 L12 8 L0 8 Z" fill="currentColor" />
        </svg>
        <span className="h-0.5" />
        <svg
          viewBox="0 0 12 8"
          aria-hidden="true"
          className={cn(base, direction === "desc" ? active : inactive)}
        >
          <path d="M0 0 L12 0 L6 8 Z" fill="currentColor" />
        </svg>
      </span>
    )
  }, [])
  const [columns, setColumnsState] = useState<Column[]>(() => initialColumns.map(column => ({ ...column })))
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null)
  const [isManuallyResized, setIsManuallyResized] = useState(false) // Track manual resize state
  const [measuredContainerWidth, setMeasuredContainerWidth] = useState<number | null>(null)

  const tableRef = useRef<HTMLDivElement>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const selectAllRef = useRef<HTMLInputElement | null>(null)
  const lastInteractedIndexRef = useRef<number | null>(null)
  const lastSelectionActionRef = useRef<boolean>(true)

  useEffect(() => {
    if (!selectAllRef.current) return

    if (data.length === 0) {
      selectAllRef.current.indeterminate = false
      return
    }

    const selectedCount = selectedItems.length
    selectAllRef.current.indeterminate = selectedCount > 0 && selectedCount < data.length
  }, [data.length, selectedItems.length])

  useEffect(() => {
    if (selectedItems.length === 0) {
      lastInteractedIndexRef.current = null
      lastSelectionActionRef.current = true
      return
    }

    if (lastInteractedIndexRef.current !== null && lastInteractedIndexRef.current >= data.length) {
      lastInteractedIndexRef.current = data.length - 1
    }
  }, [data.length, selectedItems.length])

  useEffect(() => {
    if (!fillContainerWidth) {
      return
    }

    const gridElement = tableRef.current
    const parent = gridElement?.parentElement
    if (!parent) {
      return
    }

    const updateWidth = () => {
      setMeasuredContainerWidth(parent.clientWidth)
    }

    updateWidth()

    let observer: ResizeObserver | null = null

    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          setMeasuredContainerWidth(entry.contentRect.width)
        }
      })
      observer.observe(parent)
    } else if (typeof window !== "undefined") {
      window.addEventListener("resize", updateWidth)
    }

    return () => {
      if (observer) {
        observer.disconnect()
      } else if (typeof window !== "undefined") {
        window.removeEventListener("resize", updateWidth)
      }
    }
  }, [fillContainerWidth])

  // Calculate optimal width for a column based on content
  const calculateOptimalWidth = useCallback((column: Column) => {
    // Create a temporary span to measure text width
    const tempSpan = document.createElement('span')
    tempSpan.style.visibility = 'hidden'
    tempSpan.style.position = 'absolute'
    tempSpan.style.fontSize = '14px'
    tempSpan.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto'
    tempSpan.style.fontWeight = '500'
    tempSpan.style.whiteSpace = 'normal'
    tempSpan.style.wordWrap = 'break-word'
    tempSpan.style.padding = '12px 16px'

    document.body.appendChild(tempSpan)

    try {
      // Measure header text
      tempSpan.textContent = column.label
      let maxWidth = tempSpan.offsetWidth

      // Measure content for this column in visible rows
      const accessor = column.accessor || column.id
      data.slice(0, Math.min(50, data.length)).forEach(row => {
        const value = row[accessor]
        if (value != null) {
          tempSpan.textContent = String(value)
          maxWidth = Math.max(maxWidth, tempSpan.offsetWidth)
        }
      })

      // Add type-specific adjustments
      let typeAdjustment = 0
      if (column.type === "toggle") typeAdjustment = 20 // Space for toggle switch
      else if (column.type === "action") typeAdjustment = 10 // Space for action buttons
      else if (column.type === "checkbox") typeAdjustment = 5 // Space for checkbox
      else if (column.type === "email" || column.type === "phone") typeAdjustment = 30 // Extra space for links

      // Add some padding and respect min/max constraints
      const paddedWidth = maxWidth + 24 + typeAdjustment // Extra padding for resizer and spacing
      const minWidth = column.minWidth ?? (column.type === "action" ? 80 : column.type === "toggle" ? 100 : 100)
      const maxWidth_constraint = column.maxWidth ?? 600

      // Normalize to integer to avoid sub-pixel gaps
      return Math.round(Math.max(minWidth, Math.min(paddedWidth, maxWidth_constraint)))
    } finally {
      document.body.removeChild(tempSpan)
    }
  }, [data])

  // Debounced update function to prevent race conditions
  const debouncedUpdate = useCallback((updater: (previous: Column[]) => Column[]) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      setColumnsState(previous => {
        const next = updater(previous)
        onColumnsChange?.(next.map(column => ({ ...column })))
        return next
      })
    }, 0)
  }, [onColumnsChange])

  // Auto-calculate optimal widths on mount and data changes
  const autoSizeColumnsFunc = useCallback(() => {
    if (!tableRef.current || !data.length) return

    const optimizedColumns = columns.map(column => {
      const optimalWidth = calculateOptimalWidth(column)
      return { ...column, width: optimalWidth }
    })

    // Use debounced update to prevent race conditions
    debouncedUpdate(() => optimizedColumns)
  }, [columns, data, calculateOptimalWidth, debouncedUpdate])

  // Initialize columns with optimal widths
  React.useEffect(() => {
    setColumnsState(initialColumns.map(column => ({ ...column })))
  }, [initialColumns])

  // Re-calculate optimal widths when data changes significantly
  React.useEffect(() => {
    if (data.length > 0 && tableRef.current && autoSizeColumns && !isManuallyResized) {
      const timer = setTimeout(autoSizeColumnsFunc, 50)
      return () => clearTimeout(timer)
    }
  }, [data.length, autoSizeColumnsFunc, autoSizeColumns, isManuallyResized])

  // Add resize observer to handle container width changes (disabled to prevent conflicts)
  // React.useEffect(() => {
  //   if (!scrollContainerRef.current) return

  //   const resizeObserver = new ResizeObserver((entries) => {
  //     for (const entry of entries) {
  //       const { width } = entry.contentRect
  //       // Trigger re-calculation of column widths when container resizes
  //       setTimeout(() => {
  //         setColumnsState(prev => [...prev]) // Force re-render to trigger memoized calculations
  //       }, 50)
  //     }
  //   })

  //   resizeObserver.observe(scrollContainerRef.current)

  //   return () => {
  //     resizeObserver.disconnect()
  //   }
  // }, [])

  const updateColumns = useCallback((updater: (previous: Column[]) => Column[]) => {
    setColumnsState(previous => {
      const next = updater(previous)
      onColumnsChange?.(next.map(column => ({ ...column })))
      return next
    })
  }, [onColumnsChange])

  // Add method to auto-fit all columns
  const autoFitAllColumns = useCallback(() => {
    if (!tableRef.current || !data.length) return

    const optimizedColumns = columns.map(column => ({
      ...column,
      width: calculateOptimalWidth(column)
    }))

    // Use debounced update to prevent race conditions
    debouncedUpdate(() => optimizedColumns)
  }, [columns, data, calculateOptimalWidth, debouncedUpdate])



  const visibleColumns = useMemo(() => columns.filter(column => !column.hidden), [columns])
  const columnCount = Math.max(visibleColumns.length, 1)

  // Calculate optimal widths and distribute space intelligently
  const { gridTemplate, totalTableWidth, shouldUseFullWidth } = useMemo(() => {
    if (visibleColumns.length === 0) {
      return { gridTemplate: "1fr", totalTableWidth: 0, shouldUseFullWidth: true }
    }

    const fallbackWidth = 1200
    const computedWidth = fillContainerWidth
      ? (() => {
          if (measuredContainerWidth && measuredContainerWidth > 0) {
            return measuredContainerWidth
          }

          const parentWidth = tableRef.current?.parentElement?.clientWidth ?? 0
          if (parentWidth > 0) {
            return parentWidth
          }

          return fallbackWidth
        })()
      : fallbackWidth

    const containerWidth = Math.max(computedWidth, fallbackWidth)
    const totalFixedWidth = visibleColumns.reduce((total, col) => total + col.width, 0)

    const formatTrack = (width: number, index: number, total: number, column?: Column) => {
      const rounded = Math.max(1, Math.round(width))
      if (fillContainerWidth && total > 0 && index === total - 1) {
        const minWidth = column?.minWidth ? Math.max(column.minWidth, rounded) : rounded
        return `minmax(${minWidth}px, 1fr)`
      }
      return `${rounded}px`
    }

    const resolveMaxWidth = (column: Column, fallback: number) => {
      if (fillContainerWidth) {
        return containerWidth
      }
      return column.maxWidth ?? fallback
    }
    
    // If total width is less than container, distribute extra space proportionally
    // Only if user hasn't manually resized columns to preserve their preferences
    if (totalFixedWidth < containerWidth && !isManuallyResized) {
      const extraSpace = containerWidth - totalFixedWidth
      const flexibleColumns = visibleColumns.filter(col => col.resizable !== false)
      
      if (flexibleColumns.length > 0) {
        // Distribute extra space based on column content importance and current width
        const adjustedColumns = visibleColumns.map(col => {
          if (col.resizable === false) return col.width
          
          // Calculate weight based on column type and current width
          // Increased action column weight to prevent compression
          let weight = 1
          if (col.type === "action" || col.type === "checkbox") weight = 0.8 // Increased from 0.3
          else if (col.type === "toggle") weight = 0.7 // Increased from 0.5
          else if (col.type === "email" || col.id.includes("Name") || col.id.includes("description")) weight = 1.5 // Reduced from 2
          else weight = 1
          
          const proportion = (col.width * weight) / flexibleColumns.reduce((sum, c) => sum + (c.width * (
            c.type === "action" || c.type === "checkbox" ? 0.8 : // Updated weight
            c.type === "toggle" ? 0.7 : // Updated weight
            c.type === "email" || c.id.includes("Name") || c.id.includes("description") ? 1.5 : 1 // Updated weight
          )), 0)
          
          const additionalWidth = extraSpace * proportion
          const newWidth = col.width + additionalWidth
          
          // Respect min/max constraints with more conservative max width
          const minWidth = col.minWidth ?? 80
          const maxWidth = resolveMaxWidth(col, Math.min(400, containerWidth * 0.25))
          
          return Math.max(minWidth, Math.min(newWidth, maxWidth))
        })
        
        const gridTemplate = adjustedColumns
          .map((width, index) => formatTrack(width, index, adjustedColumns.length))
          .join(" ")

        return {
          gridTemplate,
          totalTableWidth: containerWidth,
          shouldUseFullWidth: true
        }
      }
    }
    
    // Use original widths if no adjustment needed or not possible
    // If there's extra space, distribute it proportionally to fill the container
    // Only if user hasn't manually resized columns to preserve their preferences
    let finalColumns = visibleColumns
    if (totalFixedWidth < containerWidth && !isManuallyResized) {
      const extraSpace = containerWidth - totalFixedWidth
      const flexibleColumns = visibleColumns.filter(col => col.resizable !== false)

      if (flexibleColumns.length > 0) {
        const totalFlexibleWidth = flexibleColumns.reduce((sum, col) => sum + col.width, 0)
        finalColumns = visibleColumns.map(col => {
          if (col.resizable === false) return col

          const proportion = col.width / totalFlexibleWidth
          const additionalWidth = extraSpace * proportion
          const newWidth = col.width + additionalWidth

          // Respect constraints
          const minWidth = col.minWidth ?? 80
          const maxWidth = resolveMaxWidth(col, 600)

          return {
            ...col,
            width: Math.max(minWidth, Math.min(newWidth, maxWidth))
          }
        })
      }
    }

    const gridTemplate = finalColumns
      .map((col, index) => formatTrack(col.width, index, finalColumns.length, col))
      .join(" ")

    return {
      gridTemplate,
      totalTableWidth: containerWidth,
      shouldUseFullWidth: true
    }
  }, [visibleColumns, isManuallyResized, fillContainerWidth, measuredContainerWidth])

  const gridStyles = useMemo(() => ({
    gridTemplateColumns: gridTemplate,
    width: shouldUseFullWidth ? "100%" : `${totalTableWidth}px`,
    minWidth: shouldUseFullWidth ? "100%" : `${totalTableWidth}px`
  }), [gridTemplate, shouldUseFullWidth, totalTableWidth])

  const isRowSelected = useCallback((row: any) => {
    const rowId = getRowId(row)
    if (!rowId) return false
    return selectedItems.includes(rowId)
  }, [selectedItems])

  const handleSort = (column: Column) => {
    if (!column.sortable) return

    const direction = sortConfig?.key === column.id && sortConfig.direction === "asc" ? "desc" : "asc"
    setSortConfig({ key: column.id, direction })
    onSort?.(column.id, direction)
  }

  const handleMouseDown = useCallback((event: React.MouseEvent, columnId: string) => {
    event.preventDefault()
    event.stopPropagation()

    const column = columns.find(col => col.id === columnId)
    if (!column || column.resizable === false) return

    // Mark that user is manually resizing to prevent auto-sizing conflicts
    setIsManuallyResized(true)

    setResizing({
      columnId,
      startX: event.clientX,
      startWidth: column.width
    })
  }, [columns])

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!resizing) return

    const column = columns.find(col => col.id === resizing.columnId)
    if (!column) return

    const deltaX = event.clientX - resizing.startX
    const minWidth = column.minWidth ?? 100
    const maxWidth = column.maxWidth ?? 600
    const rawWidth = resizing.startWidth + deltaX
    const clampedWidth = Math.round(Math.max(minWidth, Math.min(rawWidth, maxWidth)))

    updateColumns(previous =>
      previous.map(col => (
        col.id === resizing.columnId ? { ...col, width: clampedWidth } : col
      ))
    )
  }, [columns, resizing, updateColumns])

  const handleMouseUp = useCallback(() => {
    setResizing(null)
    // Keep isManuallyResized as true to prevent auto-sizing from overriding manual changes
  }, [])


  const handleDoubleClick = useCallback((columnId: string) => {
    const column = columns.find(col => col.id === columnId)
    if (!column || column.resizable === false) return

    // Mark as manually resized to prevent auto-sizing conflicts
    setIsManuallyResized(true)

    const optimalWidth = calculateOptimalWidth(column)
    // Use debounced update to prevent race conditions
    debouncedUpdate(previous =>
      previous.map(col => (
        col.id === columnId ? { ...col, width: optimalWidth } : col
      ))
    )
  }, [columns, calculateOptimalWidth, debouncedUpdate])

  React.useEffect(() => {
    if (!resizing) {
      return
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp, resizing])

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

  const handleDragStart = (event: React.DragEvent, columnId: string) => {
    setDraggedColumn(columnId)
    event.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  const handleDrop = (event: React.DragEvent, targetColumnId: string) => {
    event.preventDefault()
    if (!draggedColumn || draggedColumn === targetColumnId) {
      setDraggedColumn(null)
      return
    }

    updateColumns(previous => {
      const visibleIds = previous.filter(col => !col.hidden).map(col => col.id)
      const draggedIndex = visibleIds.indexOf(draggedColumn)
      const targetIndex = visibleIds.indexOf(targetColumnId)

      if (draggedIndex === -1 || targetIndex === -1) {
        return previous
      }

      const reorderedVisibleIds = [...visibleIds]
      const [moved] = reorderedVisibleIds.splice(draggedIndex, 1)
      reorderedVisibleIds.splice(targetIndex, 0, moved)

      const visibleColumnMap = new Map(previous.filter(col => !col.hidden).map(col => [col.id, col]))
      const reorderedVisibleColumns = reorderedVisibleIds.map(id => ({ ...visibleColumnMap.get(id)! }))
      const hiddenColumns = previous.filter(col => col.hidden).map(col => ({ ...col }))

      return [...reorderedVisibleColumns, ...hiddenColumns]
    })

    setDraggedColumn(null)
  }

  const handleCheckboxClick = useCallback((
    event: React.MouseEvent<HTMLInputElement>,
    row: any,
    rowIndex: number,
    currentlyChecked: boolean
  ) => {
    event.preventDefault()
    event.stopPropagation()

    if (!onItemSelect) {
      return
    }

    const rowId = getRowId(row)
    if (!rowId) {
      return
    }

    const { shiftKey, metaKey, ctrlKey } = event
    const hasModifier = shiftKey || metaKey || ctrlKey
    const selectedSet = new Set(selectedItems)

    const resolveRow = (itemId: string) => data.find(entry => getRowId(entry) === itemId)

    const desiredState = shiftKey && lastInteractedIndexRef.current !== null
      ? lastSelectionActionRef.current
      : hasModifier
        ? !currentlyChecked
        : true

    if (!hasModifier) {
      for (const existingId of Array.from(selectedSet)) {
        if (existingId === rowId) continue
        const existingRow = resolveRow(existingId)
        onItemSelect(existingId, false, existingRow)
        selectedSet.delete(existingId)
      }
    }

    const applySelection = (targetRow: any) => {
      const targetId = getRowId(targetRow)
      if (!targetId) return

      const isSelected = selectedSet.has(targetId)
      if (isSelected === desiredState) return

      onItemSelect(targetId, desiredState, targetRow)
      if (desiredState) {
        selectedSet.add(targetId)
      } else {
        selectedSet.delete(targetId)
      }
    }

    if (shiftKey && lastInteractedIndexRef.current !== null) {
      const anchorIndex = lastInteractedIndexRef.current
      const [start, end] =
        anchorIndex < rowIndex ? [anchorIndex, rowIndex] : [rowIndex, anchorIndex]

      for (let idx = start; idx <= end; idx++) {
        const targetRow = data[idx]
        if (!targetRow) continue
        applySelection(targetRow)
      }
    } else {
      applySelection(row)
    }

    lastInteractedIndexRef.current = rowIndex
    lastSelectionActionRef.current = desiredState
  }, [data, onItemSelect, selectedItems])
  const renderCell = useCallback((column: Column, value: any, row: any, index: number) => {
    if (column.render) {
      return column.render(value, row, index)
    }

    switch (column.type) {
      case "toggle":
        return (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              if (onToggle) {
                onToggle(row, column.id, !value)
              }
            }}
            className="relative inline-flex items-center cursor-pointer"
            title={value ? "Active" : "Inactive"}
          >
            <span
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                value ? "bg-primary-600" : "bg-gray-300"
              )}
            >
              <span
                className={cn(
                  "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                  value ? "translate-x-5" : "translate-x-1"
                )}
              />
            </span>
          </button>
        )
      case "action": {
        if (!isRowInactive(row)) return null
        return (
          <button className="rounded-full border border-red-200 p-2 text-red-500 transition hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </button>
        )
      }
      case "checkbox": {
        const rowId = getRowId(row)
        const checked = rowId ? selectedItems.includes(rowId) : Boolean(value)
        return (
          <label
            className="flex cursor-pointer items-center justify-center"
            data-disable-row-click="true"
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={checked}
              aria-label={rowId ? `Select row ${rowId}` : `Select row ${index + 1}`}
              onClick={event => handleCheckboxClick(event, row, index, checked)}
              onChange={() => {}}
            />
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                checked
                  ? "border-primary-500 bg-primary-600 text-white"
                  : "border-gray-300 bg-white text-transparent"
              )}
            >
              <Check className="h-3 w-3" aria-hidden="true" />
            </span>
          </label>
        )
      }
      case "email":
        return (
          <a href={`mailto:${value}`} className="text-blue-600 hover:text-blue-800 transition-colors">
            {value}
          </a>
        )
      case "phone":
        return (
          <a href={`tel:${value}`} className="text-gray-900 hover:text-blue-600 transition-colors">
            {value}
          </a>
        )
      default:
        return <span className="truncate">{value}</span>
    }
  }, [handleCheckboxClick, selectedItems, onToggle])

  const shouldRenderPagination = Boolean(pagination && (alwaysShowPagination || data.length > 0))
  const paginationStart = pagination
    ? (data.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0)
    : 0
  const paginationEnd = pagination
    ? (data.length > 0 ? Math.min(pagination.page * pagination.pageSize, pagination.total) : 0)
    : 0
  const effectiveTotalPages = pagination ? Math.max(pagination.totalPages, 1) : 0

  if (loading) {
    return (
      <div className="bg-white rounded-lg border-2 border-gray-400">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("bg-white rounded-lg border-2 border-gray-400", maxBodyHeight ? "flex flex-col" : "flex flex-col flex-1", className)}>
      {/* Table container */}
      <div className="relative" style={maxBodyHeight ? { flex: '0 1 auto', minHeight: 0 } : { flex: '1 1 0%', minHeight: 0 }}>
        <div
          className="table-scroll-container overflow-x-auto overflow-y-auto"
          style={maxBodyHeight ? { minHeight: `${maxBodyHeight}px`, maxHeight: `${maxBodyHeight}px`, height: `${maxBodyHeight}px` } : undefined}
          role="table"
          aria-label="Data table"
        >
          {visibleColumns.length > 0 && (
            <div className="table-header shadow-sm">
              <div
                className="table-grid"
                style={gridStyles}
              >
                {visibleColumns.map(column => (
                  <div
                    key={column.id}
                    className={cn(
                      "table-cell bg-blue-500 font-semibold text-white text-[11px] relative select-none border-b-2 border-blue-700 border-r-2 border-blue-700 last:border-r-0",
                      column.sortable && column.id !== "select" && "cursor-pointer hover:bg-blue-600"
                    )}
                    draggable
                    onDragStart={event => handleDragStart(event, column.id)}
                    onDragOver={handleDragOver}
                    onDrop={event => handleDrop(event, column.id)}
                    onClick={() => column.id !== "select" && handleSort(column)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {column.id === "select" && onSelectAll ? (
                        <>
                          <input
                            ref={selectAllRef}
                            type="checkbox"
                            className="w-[11px] h-[11px] text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 flex-shrink-0"
                            checked={data.length > 0 && selectedItems.length === data.length}
                            onClick={event => event.stopPropagation()}
                            onChange={event => {
                              event.stopPropagation()
                              onSelectAll(event.target.checked)
                            }}
                          />
                          {!hideSelectAllLabel && (
                            <span className="break-words leading-tight whitespace-nowrap flex-1 min-w-0">
                              {selectHeaderLabel ?? 'Select All'}
                            </span>
                          )}
                          {/* Invisible placeholder to match SortTriangles height */}
                          <div className="flex-shrink-0 w-2.5 h-2.5 opacity-0" aria-hidden="true" />
                        </>
                      ) : column.type === "multi-action" && onSelectAll ? (
                        <>
                          <input
                            ref={selectAllRef}
                            type="checkbox"
                            className="w-[11px] h-[11px] text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 flex-shrink-0"
                            checked={data.length > 0 && selectedItems.length === data.length}
                            onClick={event => event.stopPropagation()}
                            onChange={event => {
                              event.stopPropagation()
                              onSelectAll(event.target.checked)
                            }}
                          />
                          {!hideSelectAllLabel && (
                            <span className="break-words leading-tight whitespace-nowrap flex-1 min-w-0">{column.label}</span>
                          )}
                          {/* Invisible placeholder to match SortTriangles height */}
                          <div className="flex-shrink-0 w-2.5 h-2.5 opacity-0" aria-hidden="true" />
                        </>
                      ) : (
                        <>
                          <span className="break-words leading-tight flex-1 min-w-0">{column.label}</span>
                          {column.sortable && (
                            <div className="flex-shrink-0">
                              <SortTriangles direction={sortConfig?.key === column.id ? sortConfig.direction : null} />
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {column.resizable !== false && (
                      <div
                        className={cn(
                          "column-resizer",
                          resizing?.columnId === column.id && "resizing"
                        )}
                        onMouseDown={event => handleMouseDown(event, column.id)}
                        onDoubleClick={() => handleDoubleClick(column.id)}
                        title="Drag to resize, double-click to auto-fit"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div
            ref={tableRef}
            className="table-grid"
            style={gridStyles}
          >
        {visibleColumns.length === 0 ? (
          <div
            className="col-span-full p-10 text-center text-gray-500"
            style={{ gridColumn: `1 / ${columnCount + 1}` }}
          >
            No columns selected. Use the settings menu to add columns back to the table.
          </div>
        ) : data.length === 0 ? (
          <div
            className="col-span-full p-8 text-center text-gray-500"
            style={{ gridColumn: `1 / ${columnCount + 1}` }}
          >
            {emptyMessage}
          </div>
        ) : (
          data.map((row, rowIndex) => {
            const rowSelected = isRowSelected(row)
            return (
              <div
                key={rowIndex}
                className="table-row contents"
                data-row-selected={rowSelected ? "true" : undefined}
              >
                {visibleColumns.map((column, columnIndex) => (
                  <div
                    key={`${rowIndex}-${column.id}`}
                    className={cn(
                      "table-cell text-sm text-gray-900 transition-colors",
                      onRowClick && "cursor-pointer",
                      // Alternating row colors using UNOHARAIRO (#F7FCFE)
                      rowIndex % 2 === 1 && !rowSelected && "bg-[#F7FCFE]",
                      rowSelected && "bg-primary-50 font-medium",
                      rowSelected && columnIndex === 0 && "border-l-4 border-primary-400",
                      rowSelected && columnIndex === visibleColumns.length - 1 && "border-r-4 border-primary-100"
                    )}
                    data-selected={rowSelected ? "true" : undefined}
                    data-selected-first={rowSelected && columnIndex === 0 ? "true" : undefined}
                    data-selected-last={rowSelected && columnIndex === visibleColumns.length - 1 ? "true" : undefined}
                    onClick={event => {
                      if (!onRowClick) return
                      const target = event.target as HTMLElement
                      if (target.closest('input, button, a, [data-disable-row-click], textarea, select')) {
                        return
                      }
                      onRowClick(row, rowIndex)
                    }}
                  >
                    {renderCell(column, row[column.accessor || column.id], row, rowIndex)}
                  </div>
                ))}
              </div>
            )
          })
        )}
          </div>
        </div>
      </div>

      {/* Pagination Footer - moved outside grid container */}
      {shouldRenderPagination && pagination && (
        <div className="px-3 py-2 border-t-2 border-gray-400 bg-gray-50 w-full flex-shrink-0">
          <div className="flex items-center justify-between text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <button
                className="px-2 py-1 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={pagination.page <= 1}
                onClick={() => onPageChange?.(pagination.page - 1)}
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {(() => {
                  const totalPages = effectiveTotalPages || 1
                  const length = Math.min(5, totalPages)
                  const buttons: JSX.Element[] = []

                  for (let i = 0; i < length; i++) {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1
                    } else if (pagination.page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = pagination.page - 2 + i
                    }

                    pageNum = Math.max(pageNum, 1)

                    buttons.push(
                      <button
                        key={pageNum}
                        className={`px-2 py-1 rounded transition-colors ${
                          pageNum === pagination.page
                            ? "bg-primary-600 text-white"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                        }`}
                        onClick={() => onPageChange?.(pageNum)}
                      >
                        {pageNum}
                      </button>
                    )
                  }

                  return buttons
                })()}
              </div>

              <button
                className="px-2 py-1 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={pagination.page >= (effectiveTotalPages || 1)}
                onClick={() => onPageChange?.(pagination.page + 1)}
              >
                Next
              </button>
            </div>
            <div className="flex items-center gap-4">
              <span>
                Showing {paginationStart} to {paginationEnd} of {" "}
                {pagination.total} entries
              </span>
              <div className="flex items-center gap-2">
                <span>Show</span>
                <select
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                  value={pagination.pageSize}
                  onChange={event => onPageSizeChange?.(Number(event.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
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






















