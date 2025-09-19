"use client"

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { ChevronUp, ChevronDown, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

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
  onSelectAll
}: TableProps) {
  const [columns, setColumnsState] = useState<Column[]>(() => initialColumns.map(column => ({ ...column })))
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const tableRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setColumnsState(initialColumns.map(column => ({ ...column })))
  }, [initialColumns])

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

  const updateColumns = useCallback((updater: (previous: Column[]) => Column[]) => {
    setColumnsState(previous => {
      const next = updater(previous)
      onColumnsChange?.(next.map(column => ({ ...column })))
      return next
    })
  }, [onColumnsChange])

  const visibleColumns = useMemo(() => columns.filter(column => !column.hidden), [columns])
  const columnCount = Math.max(visibleColumns.length, 1)

  const gridTemplate = useMemo(() => {
    if (visibleColumns.length === 0) {
      return "1fr"
    }
    return visibleColumns.map(col => `${col.width}px`).join(" ")
  }, [visibleColumns])

  const totalTableWidth = useMemo(() => {
    return visibleColumns.reduce((total, col) => total + col.width, 0)
  }, [visibleColumns])

  const isRowSelected = useCallback((row: any) => {
    if (!row) return false
    const rowId: string | undefined = row.id ?? row?.uuid ?? row?.key
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
    const clampedWidth = Math.max(minWidth, Math.min(rawWidth, maxWidth))

    updateColumns(previous =>
      previous.map(col => (
        col.id === resizing.columnId ? { ...col, width: clampedWidth } : col
      ))
    )
  }, [columns, resizing, updateColumns])

  const handleMouseUp = useCallback(() => {
    setResizing(null)
  }, [])

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
        const rowId: string | undefined = row?.id ?? row?.uuid ?? row?.key
        const checked = rowId ? selectedItems.includes(rowId) : Boolean(value)
        return (
          <input
            type="checkbox"
            className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
            checked={checked}
            onChange={event => {
              if (rowId && onItemSelect) {
                onItemSelect(rowId, event.target.checked, row)
              }
            }}
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
  }, [onItemSelect, selectedItems])

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
    <div className={cn("bg-white rounded-lg border border-gray-200 flex flex-col", className)}>
      {/* Scroll Controls */}
      <div className="relative flex-1 min-h-0">
        {/* Left scroll button */}
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white border border-gray-300 rounded-full p-2 shadow-md hover:bg-gray-50 transition-colors"
            title="Scroll left"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
        )}

        {/* Right scroll button */}
        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white border border-gray-300 rounded-full p-2 shadow-md hover:bg-gray-50 transition-colors"
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
              width: `${totalTableWidth}px`,
              minWidth: `${totalTableWidth}px`
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
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                        checked={data.length > 0 && selectedItems.length === data.length}
                        onChange={event => onSelectAll(event.target.checked)}
                      />
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
          data.map((row, rowIndex) => (
            <div key={rowIndex} className="table-row contents">
              {visibleColumns.map(column => (
                <div
                  key={`${rowIndex}-${column.id}`}
                  className={cn(
                    "table-cell text-sm text-gray-900",
                    onRowClick && "cursor-pointer",
                    column.id === "select" && isRowSelected(row) && "bg-primary-50"
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

      {visibleColumns.length > 0 && data.length > 0 && pagination && (
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className={`px-3 py-1.5 rounded transition-colors ${
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
                className="px-3 py-1.5 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="flex justify-center py-2 border-t border-gray-200 bg-gray-50">
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
