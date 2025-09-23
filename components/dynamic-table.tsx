"use client"

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { ChevronUp, ChevronDown, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const getRowId = (row: any): string | undefined => row?.id ?? row?.uuid ?? row?.key

export interface Column {
  id: string
  label: string
  width: number
  minWidth?: number
  maxWidth?: number
  sortable?: boolean
  resizable?: boolean
  type?: "text" | "toggle" | "action" | "checkbox" | "email" | "phone"
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
  autoSizeColumns?: boolean // Enable automatic column sizing on mount
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
  autoSizeColumns = false // Changed default to false to prevent conflicts
}: TableProps) {
  const [columns, setColumnsState] = useState<Column[]>(() => initialColumns.map(column => ({ ...column })))
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isManuallyResized, setIsManuallyResized] = useState(false) // Track manual resize state

  const tableRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
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

  // Calculate optimal width for a column based on content
  const calculateOptimalWidth = useCallback((column: Column) => {
    if (!tableRef.current) return column.width

    // Create a temporary span to measure text width
    const tempSpan = document.createElement('span')
    tempSpan.style.visibility = 'hidden'
    tempSpan.style.position = 'absolute'
    tempSpan.style.fontSize = '14px'
    tempSpan.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto'
    tempSpan.style.fontWeight = '500'
    tempSpan.style.whiteSpace = 'nowrap'
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
      const minWidth = column.minWidth ?? (column.type === "action" ? 80 : column.type === "toggle" ? 100 : 120)
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
    const initializedColumns = initialColumns.map(column => ({ ...column }))
    setColumnsState(initializedColumns)
    
    // Auto-size after a short delay to ensure DOM is ready, but only if not manually resized
    const timer = setTimeout(() => {
      if (data.length > 0 && autoSizeColumns && !isManuallyResized) {
        autoSizeColumnsFunc()
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [initialColumns, isManuallyResized])

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


  // Handle scroll state updates with improved logic
  const updateScrollState = useCallback(() => {
    if (!scrollContainerRef.current) return
    
    const container = scrollContainerRef.current
    const { scrollLeft, scrollWidth, clientWidth } = container
    
    // More reliable scroll detection
    const hasHorizontalScroll = scrollWidth > clientWidth + 1 // Add small buffer
    const isAtStart = scrollLeft <= 1
    const isAtEnd = scrollLeft >= scrollWidth - clientWidth - 1
    
    setCanScrollLeft(hasHorizontalScroll && !isAtStart)
    setCanScrollRight(hasHorizontalScroll && !isAtEnd)
  }, [])

  // Update scroll state when columns change with better timing
  useEffect(() => {
    // Use requestAnimationFrame for better timing
    const updateScroll = () => {
      requestAnimationFrame(() => {
        updateScrollState()
      })
    }
    
    const timer = setTimeout(updateScroll, 50)
    return () => clearTimeout(timer)
  }, [columns, updateScrollState])

  // Scroll control functions with improved behavior
  const scrollLeft = useCallback(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const scrollAmount = Math.min(200, container.clientWidth * 0.5)
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' })
    }
  }, [])

  const scrollRight = useCallback(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const scrollAmount = Math.min(200, container.clientWidth * 0.5)
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }, [])

  // Keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.target !== scrollContainerRef.current) return
    
    if (event.key === 'ArrowLeft' && event.ctrlKey) {
      event.preventDefault()
      scrollLeft()
    } else if (event.key === 'ArrowRight' && event.ctrlKey) {
      event.preventDefault()
      scrollRight()
    }
  }, [scrollLeft, scrollRight])

  // Set up scroll event listener with throttling
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    let timeoutId: NodeJS.Timeout
    const throttledUpdateScrollState = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(updateScrollState, 16) // ~60fps
    }

    updateScrollState()
    container.addEventListener('scroll', throttledUpdateScrollState)
    container.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', throttledUpdateScrollState)

    return () => {
      clearTimeout(timeoutId)
      container.removeEventListener('scroll', throttledUpdateScrollState)
      container.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', throttledUpdateScrollState)
    }
  }, [updateScrollState, handleKeyDown])

  const visibleColumns = useMemo(() => columns.filter(column => !column.hidden), [columns])
  const columnCount = Math.max(visibleColumns.length, 1)

  // Calculate optimal widths and distribute space intelligently
  const { gridTemplate, totalTableWidth, shouldUseFullWidth } = useMemo(() => {
    if (visibleColumns.length === 0) {
      return { gridTemplate: "1fr", totalTableWidth: 0, shouldUseFullWidth: true }
    }

    const containerWidth = scrollContainerRef.current?.clientWidth || 1200
    const totalFixedWidth = visibleColumns.reduce((total, col) => total + col.width, 0)
    
    // If total width is less than container, distribute extra space proportionally
    // Temporarily disabled automatic width distribution to fix overlap issue
    if (false && totalFixedWidth < containerWidth) {
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
          const maxWidth = col.maxWidth ?? Math.min(400, containerWidth * 0.25) // Reduced max width
          
          return Math.max(minWidth, Math.min(newWidth, maxWidth))
        })
        
        return {
          gridTemplate: adjustedColumns.map(width => `${Math.round(width)}px`).join(" "),
          totalTableWidth: containerWidth,
          shouldUseFullWidth: true
        }
      }
    }
    
    // Use original widths if no adjustment needed or not possible
    return {
      gridTemplate: visibleColumns.map(col => `${Math.round(col.width)}px`).join(" "),
      totalTableWidth: totalFixedWidth,
      shouldUseFullWidth: totalFixedWidth >= containerWidth
    }
  }, [visibleColumns])

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
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={Boolean(value)} readOnly className="sr-only" />
            <div
              className={`w-10 h-5 rounded-full transition-colors ${
                value ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform transform ${
                  value ? "translate-x-5" : "translate-x-1"
                } mt-0.5`}
              ></div>
            </div>
          </label>
        )
      case "action":
        return (
          <button className="text-red-500 hover:text-red-700 p-1 rounded transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        )
      case "checkbox": {
        const rowId = getRowId(row)
        const checked = rowId ? selectedItems.includes(rowId) : Boolean(value)
        return (
          <input
            type="checkbox"
            className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
            checked={checked}
            aria-label={rowId ? `Select row ${rowId}` : `Select row ${index + 1}`}
            data-disable-row-click="true"
            onClick={event => handleCheckboxClick(event, row, index, checked)}
            onChange={() => {}}
          />
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
  }, [handleCheckboxClick, selectedItems])

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
    <div className={cn("bg-white rounded-lg border-2 border-gray-400 flex flex-col", className)}>
      {/* Scroll Controls */}
      <div className="relative flex-1 min-h-0">
        {/* Left scroll button */}
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white border-2 border-gray-400 rounded-full p-2 shadow-md hover:bg-gray-50 transition-colors"
            title="Scroll left"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
        )}

        {/* Right scroll button */}
        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white border-2 border-gray-400 rounded-full p-2 shadow-md hover:bg-gray-50 transition-colors"
            title="Scroll right"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        )}

        {/* Scrollable table container */}
        <div
          ref={scrollContainerRef}
          className="table-scroll-container overflow-x-auto overflow-y-visible focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset"
          tabIndex={0}
          role="table"
          aria-label="Data table with horizontal scrolling"
        >
          <div
            ref={tableRef}
            className="table-grid"
            style={{ 
              gridTemplateColumns: gridTemplate,
              width: shouldUseFullWidth ? "100%" : `${totalTableWidth}px`,
              minWidth: shouldUseFullWidth ? "100%" : `${totalTableWidth}px`
            }}
          >
        {visibleColumns.length > 0 && (
          <div className="table-header contents">
            {visibleColumns.map(column => (
              <div
                key={column.id}
                className={cn(
                  "table-cell bg-gray-50 font-medium text-gray-900 relative select-none",
                  column.sortable && column.id !== "select" && "cursor-pointer hover:bg-gray-100"
                )}
                draggable
                onDragStart={event => handleDragStart(event, column.id)}
                onDragOver={handleDragOver}
                onDrop={event => handleDrop(event, column.id)}
                onClick={() => column.id !== "select" && handleSort(column)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {column.id === "select" && onSelectAll ? (
                      <div className="flex items-center gap-3">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                          checked={data.length > 0 && selectedItems.length === data.length}
                          onClick={event => event.stopPropagation()}
                          onChange={event => {
                            event.stopPropagation()
                            onSelectAll(event.target.checked)
                          }}
                        />
                        <div className="flex flex-col leading-tight">
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Select All
                          </span>
                          {selectedItems.length > 0 && (
                            <span className="text-xs text-gray-400">
                              {selectedItems.length} selected
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="truncate">{column.label}</span>
                        {column.sortable && sortConfig?.key === column.id && (
                          sortConfig.direction === "asc" ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )
                        )}
                      </>
                    )}
                  </div>
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
        )}

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

      {visibleColumns.length > 0 && data.length > 0 && pagination && (
        <div className="px-4 py-2 border-t-2 border-gray-400 bg-gray-50">
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
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum: number
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i
                  } else {
                    pageNum = pagination.page - 2 + i
                  }

                  return (
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
                })}
              </div>

              <button
                className="px-2 py-1 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => onPageChange?.(pagination.page + 1)}
              >
                Next
              </button>
            </div>
            <div className="flex items-center gap-4">
              <span>
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to {" "}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {" "}
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

      {/* Scroll indicator */}
      {(canScrollLeft || canScrollRight) && (
        <div className="flex justify-center py-2 border-t-2 border-gray-400 bg-gray-50">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ChevronLeft className="h-3 w-3" />
            <span>Scroll horizontally to see more columns</span>
            <ChevronRight className="h-3 w-3" />
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
