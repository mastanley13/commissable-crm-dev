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
  truncate?: boolean
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
  preferOverflowHorizontalScroll?: boolean // Prefer horizontal scroll over shrink-to-fit when table is wider than container
  hasLoadedPreferences?: boolean // Indicates columns include loaded user preferences
  footerAbovePagination?: React.ReactNode // Optional footer content rendered above pagination controls
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
  maxBodyHeight,
  preferOverflowHorizontalScroll = false,
  hasLoadedPreferences = false,
  footerAbovePagination
}: TableProps) {
  const SortTriangles = useCallback(({ direction }: { direction: "asc" | "desc" | null }) => {
    const activeSize = "w-3.5 h-3.5"
    const inactiveSize = "w-2.5 h-2.5"
    const active = "text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]"
    const inactive = "text-blue-300/40"
    return (
      <span className="ml-1 flex flex-col items-center justify-center leading-none">
        <svg
          viewBox="0 0 12 8"
          aria-hidden="true"
          className={cn(
            direction === "asc" ? activeSize : inactiveSize,
            direction === "asc" ? active : inactive,
            "transition-all duration-200"
          )}
        >
          <path d="M6 0 L12 8 L0 8 Z" fill="currentColor" />
        </svg>
        <span className="h-0.5" />
        <svg
          viewBox="0 0 12 8"
          aria-hidden="true"
          className={cn(
            direction === "desc" ? activeSize : inactiveSize,
            direction === "desc" ? active : inactive,
            "transition-all duration-200"
          )}
        >
          <path d="M0 0 L12 0 L6 8 Z" fill="currentColor" />
        </svg>
      </span>
    )
  }, [])
  const [columns, setColumnsState] = useState<Column[]>(() => initialColumns.map(column => ({ ...column })))
  const columnsRef = useRef<Column[]>(initialColumns.map(column => ({ ...column })))
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [resizing, setResizing] = useState<{ columnId: string; pointerId: number; startX: number; startWidth: number } | null>(null)
  const resizingRef = useRef<{ columnId: string; pointerId: number; startX: number; startWidth: number } | null>(null)
  const [isManuallyResized, setIsManuallyResized] = useState(false) // Track manual resize state
  const didResizeRef = useRef(false)
  const suppressSortClickUntilRef = useRef<number>(0)
  const [measuredContainerWidth, setMeasuredContainerWidth] = useState<number | null>(null)

  const tableRef = useRef<HTMLDivElement>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const selectAllRef = useRef<HTMLInputElement | null>(null)
  const selectedCountOnPage = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return 0
    const selectedSet = new Set(selectedItems)
    return data.reduce((count, row) => {
      const rowId = getRowId(row)
      if (!rowId) return count
      return selectedSet.has(rowId) ? count + 1 : count
    }, 0)
  }, [data, selectedItems])
  const allPageRowsSelected = useMemo(
    () => data.length > 0 && selectedCountOnPage === data.length,
    [data.length, selectedCountOnPage]
  )

  useEffect(() => {
    if (!selectAllRef.current) return

    if (data.length === 0) {
      selectAllRef.current.indeterminate = false
      return
    }

    selectAllRef.current.indeterminate = selectedCountOnPage > 0 && selectedCountOnPage < data.length
  }, [data.length, selectedCountOnPage])

  useEffect(() => {
    columnsRef.current = columns
  }, [columns])

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
    tempSpan.style.padding = '6px 12px'

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

  // Set manual resize flag when loaded preferences contain custom widths
  React.useEffect(() => {
    if (hasLoadedPreferences) {
      setIsManuallyResized(true)
    }
  }, [hasLoadedPreferences])

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

  // Calculate optimal widths and distribute/shrink to fit container width
  const useSpacerMode = useMemo(
    () => fillContainerWidth && !preferOverflowHorizontalScroll,
    [fillContainerWidth, preferOverflowHorizontalScroll]
  )

  const { gridTemplate, totalTableWidth, shouldUseFullWidth } = useMemo(() => {
    const overflowPreference = preferOverflowHorizontalScroll || Boolean(resizing)
    if (visibleColumns.length === 0) {
      return { gridTemplate: "1fr", totalTableWidth: 0, shouldUseFullWidth: true }
    }

    const fallbackWidth = 1200
    const computedWidth = fillContainerWidth
      ? (() => {
          // Prefer the actual measured width of the scroll container
          if (measuredContainerWidth && measuredContainerWidth > 0) {
            return measuredContainerWidth
          }

          const parentWidth = tableRef.current?.parentElement?.clientWidth ?? 0
          if (parentWidth > 0) {
            return parentWidth
          }

          // Fallback only when we truly can't measure (SSR / first paint)
          return fallbackWidth
        })()
      : fallbackWidth

    // For layout decisions, use the real container width when available
    const containerWidth = computedWidth
    const totalFixedWidth = visibleColumns.reduce((total, col) => total + col.width, 0)

    // Spacer mode: avoid redistributing widths; add trailing flexible spacer to absorb blank space.
    if (useSpacerMode) {
      const spacerTrack = "minmax(24px, 1fr)"
      const tracks = [
        ...visibleColumns.map(col => `${Math.max(1, Math.round(col.width))}px`),
        spacerTrack
      ]

      return {
        gridTemplate: tracks.join(" "),
        totalTableWidth: containerWidth,
        shouldUseFullWidth: true
      }
    }

    // Decide when we want to allow horizontal overflow with scrollbars.
    // - By default, we only allow overflow after the user manually resizes columns.
    // - When preferOverflowHorizontalScroll is true (e.g., detail tabs) or while actively resizing,
    //   we allow overflow as soon as the table is wider than the container.
    const enableOverflowMode =
      fillContainerWidth && (isManuallyResized || overflowPreference)

    // Use fill mode only when overflow mode is not enabled.
    const useFillMode = fillContainerWidth && !enableOverflowMode

    // When a resize is in progress or the user has manually resized,
    // keep widths stable and avoid redistributing space.
    const lockWidths = Boolean(resizing || isManuallyResized)

    // Hybrid mode for preferOverflowHorizontalScroll (and during resize):
    // - When content exceeds container: use explicit pixel widths and allow horizontal scrolling
    // - When content fits in container: use fill mode to expand columns (even after manual resize)
    if (overflowPreference) {
      if (lockWidths) {
        const gridTemplate = visibleColumns
          .map(col => `${Math.max(1, Math.round(col.width))}px`)
          .join(" ")

        return {
          gridTemplate,
          totalTableWidth: totalFixedWidth,
          shouldUseFullWidth: false,
        }
      }

      if (totalFixedWidth > containerWidth) {
        // Content exceeds container - use scroll mode
        const gridTemplate = visibleColumns
          .map(col => `${Math.max(1, Math.round(col.width))}px`)
          .join(" ")

        return {
          gridTemplate,
          totalTableWidth: totalFixedWidth,
          shouldUseFullWidth: false,
        }
      } else {
        // Content fits in container - use fill mode to expand columns
        // This applies even after manual resize to prevent blank space
        const extraSpace = containerWidth - totalFixedWidth
        const flexibleColumns = visibleColumns.filter(col => col.resizable !== false)
        
        if (flexibleColumns.length > 0) {
          const totalFlexibleWidth = flexibleColumns.reduce((sum, col) => sum + col.width, 0)
          const adjustedWidths = visibleColumns.map(col => {
            if (col.resizable === false) return col.width
            
            const proportion = col.width / totalFlexibleWidth
            const additionalWidth = extraSpace * proportion
            const newWidth = col.width + additionalWidth
            
            // Respect constraints
            const minWidth = col.minWidth ?? 80
            const maxWidth = col.maxWidth ?? containerWidth
            
            return Math.max(minWidth, Math.min(newWidth, maxWidth))
          })
          
          // Use minmax for the last column to absorb any remaining space
          const gridTemplate = adjustedWidths
            .map((width, index) => {
              const rounded = Math.max(1, Math.round(width))
              if (index === adjustedWidths.length - 1) {
                return `minmax(${rounded}px, 1fr)`
              }
              return `${rounded}px`
            })
            .join(" ")

          return {
            gridTemplate,
            totalTableWidth: containerWidth,
            shouldUseFullWidth: true,
          }
        }
        
        // Fallback: no flexible columns, just use explicit widths with last column flex
        const gridTemplate = visibleColumns
          .map((col, index) => {
            const rounded = Math.max(1, Math.round(col.width))
            if (index === visibleColumns.length - 1) {
              return `minmax(${rounded}px, 1fr)`
            }
            return `${rounded}px`
          })
          .join(" ")

        return {
          gridTemplate,
          totalTableWidth: containerWidth,
          shouldUseFullWidth: true,
        }
      }
    }

    const formatTrack = (width: number, index: number, total: number, column?: Column) => {
      const rounded = Math.max(1, Math.round(width))
      if (useFillMode && total > 0 && index === total - 1) {
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
    
    // If total width is greater than container and we want to fill container,
    // shrink resizable columns proportionally while respecting min widths.
    // When overflow mode is enabled, we skip this and allow horizontal scroll instead.
    if (fillContainerWidth && totalFixedWidth > containerWidth && !enableOverflowMode) {
      const minWidthFor = (c: Column) => (c.minWidth ?? 80)

      // Initial proportional shrink
      const shrinkFactor = containerWidth / totalFixedWidth
      let widths = visibleColumns.map(c => Math.max(minWidthFor(c), Math.round(c.width * shrinkFactor)))

      // If still overflowing due to min-width clamps, iteratively reduce columns above min
      let sum = widths.reduce((a, b) => a + b, 0)
      if (sum > containerWidth) {
        let overflow = sum - containerWidth
        const adjustable = widths.map((w, i) => ({ i, w, min: minWidthFor(visibleColumns[i]) }))
        let safeGuard = 0
        while (overflow > 0 && safeGuard < 20) {
          const candidates = adjustable.filter(x => x.w > x.min)
          if (candidates.length === 0) break
          const decrement = Math.max(1, Math.floor(overflow / candidates.length))
          for (const c of candidates) {
            const next = Math.max(c.min, c.w - decrement)
            overflow -= (c.w - next)
            c.w = next
            widths[c.i] = next
            if (overflow <= 0) break
          }
          sum = widths.reduce((a, b) => a + b, 0)
          overflow = Math.max(0, sum - containerWidth)
          safeGuard++
        }
      }

      const gridTemplate = widths
        .map((w, index) => formatTrack(w, index, widths.length))
        .join(" ")

      return {
        gridTemplate,
        totalTableWidth: containerWidth,
        shouldUseFullWidth: true
      }
    }

    // Overflow scenario: keep current widths and allow horizontal scroll
    if (fillContainerWidth && totalFixedWidth > containerWidth && enableOverflowMode) {
      const gridTemplate = visibleColumns
        .map((col, index) => `${Math.max(1, Math.round(col.width))}px`)
        .join(" ")

      return {
        gridTemplate,
        totalTableWidth: totalFixedWidth,
        shouldUseFullWidth: false,
      }
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
  }, [visibleColumns, isManuallyResized, fillContainerWidth, measuredContainerWidth, preferOverflowHorizontalScroll, resizing, useSpacerMode])

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

  const handleResizePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>, columnId: string) => {
    event.preventDefault()
    event.stopPropagation()

    const column = columns.find(col => col.id === columnId)
    if (!column || column.resizable === false) return

    // Mark that user is manually resizing to prevent auto-sizing conflicts
    setIsManuallyResized(true)
    didResizeRef.current = false

    const next = {
      columnId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: column.width
    }

    resizingRef.current = next
    setResizing(next)

    // Keep receiving pointer events even when the cursor leaves the handle.
    // This also reduces the chance of a "mouseup/click" landing on the header.
    if (typeof event.currentTarget?.setPointerCapture === "function") {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture failures (e.g., unsupported environment)
      }
    }
  }, [columns])

  const handleResizePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const resize = resizingRef.current
    if (!resize) return
    if (event.pointerId !== resize.pointerId) return

    setColumnsState(previous => {
      const column = previous.find(col => col.id === resize.columnId)
      if (!column) return previous

      const deltaX = event.clientX - resize.startX
      const minWidth = column.minWidth ?? 100
      const maxWidth = column.maxWidth ?? 600
      const rawWidth = resize.startWidth + deltaX
      const clampedWidth = Math.round(Math.max(minWidth, Math.min(rawWidth, maxWidth)))

      if (clampedWidth === column.width) {
        return previous
      }

      const next = previous.map(col => (
        col.id === resize.columnId ? { ...col, width: clampedWidth } : col
      ))
      columnsRef.current = next
      didResizeRef.current = true
      return next
    })
  }, [])

  const finishResize = useCallback(() => {
    const resized = didResizeRef.current
    didResizeRef.current = false
    resizingRef.current = null
    setResizing(null)

    // Prevent a post-drag click from triggering an unintended sort.
    if (resized) {
      suppressSortClickUntilRef.current = Date.now() + 300
    }

    if (resized && onColumnsChange) {
      const latest = columnsRef.current ?? columns
      const snapshot = latest.map(column => ({ ...column }))
      onColumnsChange(snapshot)
    }

    // Keep isManuallyResized as true to prevent auto-sizing from overriding manual changes
  }, [columns, onColumnsChange])

  const handleResizePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const resize = resizingRef.current
    if (!resize) return
    if (event.pointerId !== resize.pointerId) return

    event.preventDefault()
    event.stopPropagation()

    if (typeof event.currentTarget?.hasPointerCapture === "function" &&
        typeof event.currentTarget?.releasePointerCapture === "function") {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      } catch {
        // ignore
      }
    }

    finishResize()
  }, [finishResize])

  const handleResizePointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const resize = resizingRef.current
    if (!resize) return
    if (event.pointerId !== resize.pointerId) return

    event.preventDefault()
    event.stopPropagation()

    finishResize()
  }, [finishResize])


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

  const renderCell = useCallback((column: Column, value: any, row: any, index: number) => {
    const shouldTruncate =
      typeof column.truncate === "boolean"
        ? column.truncate
        : column.type === undefined ||
          column.type === "text" ||
          column.type === "email" ||
          column.type === "phone"

    const title =
      shouldTruncate && (typeof value === "string" || typeof value === "number")
        ? String(value)
        : undefined

    const wrapTruncatedContent = (content: React.ReactNode) =>
      shouldTruncate ? (
        <span className="block min-w-0 flex-1 truncate" title={title}>
          {content}
        </span>
      ) : (
        content
      )

    if (column.render) {
      return wrapTruncatedContent(column.render(value, row, index))
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
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={rowId ? `Select row ${rowId}` : `Select row ${index + 1}`}
            data-disable-row-click="true"
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1",
              checked
                ? "border-primary-500 bg-primary-600 text-white"
                : "border-gray-300 bg-white text-transparent"
            )}
            onClick={event => {
              event.stopPropagation()
              if (onItemSelect && rowId) {
                onItemSelect(rowId, !checked, row)
              }
            }}
            onMouseDown={event => event.preventDefault()}
          >
            <Check className="h-3 w-3" aria-hidden="true" />
          </button>
        )
      }
      case "email":
        return wrapTruncatedContent(
          <a
            href={`mailto:${value}`}
            className="text-blue-600 hover:text-blue-800 transition-colors"
          >
            {value}
          </a>
        )
      case "phone":
        return wrapTruncatedContent(
          <a href={`tel:${value}`} className="text-gray-900 hover:text-blue-600 transition-colors">
            {value}
          </a>
        )
      default:
        return shouldTruncate ? (
          <span className="block truncate min-w-0 flex-1" title={title}>
            {value}
          </span>
        ) : (
          <span className="min-w-0 flex-1">{value}</span>
        )
    }
  }, [selectedItems, onItemSelect, onToggle])

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
      <div className="bg-white border-2 border-gray-400">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("bg-white border-2 border-gray-400 min-w-0 w-full max-w-full", maxBodyHeight ? "flex flex-col" : "flex flex-col flex-1", className)}>
      {/* Table container */}
      <div
        className="relative overflow-hidden min-w-0 w-full max-w-full"
        style={maxBodyHeight ? { flex: "0 1 auto", minHeight: 0 } : { flex: "1 1 0%", minHeight: 0 }}
      >
        <div
          className="table-scroll-container overflow-x-auto overflow-y-auto min-w-0"
          // Let the scroll container grow with content up to maxBodyHeight,
          // but avoid forcing an exact height. This prevents the grid from
          // being visually clipped when row selection or styling changes
          // slightly affect row height near the bottom of the viewport.
          style={
            maxBodyHeight
              ? { minHeight: `${maxBodyHeight}px`, maxHeight: `${maxBodyHeight}px` }
              : undefined
          }
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
                      "table-cell bg-blue-500 font-semibold text-white text-[11px] relative select-none border-b-2 border-blue-700 border-r-2 border-blue-700 last:border-r-0"
                    )}
                    draggable
                    onDragStart={event => handleDragStart(event, column.id)}
                    onDragOver={handleDragOver}
                    onDrop={event => handleDrop(event, column.id)}
                  >
                    <div className="table-header-content gap-1 min-w-0">
                      {column.id === "select" && onSelectAll ? (
                        <>
                          <input
                            ref={selectAllRef}
                            type="checkbox"
                            className="w-[11px] h-[11px] text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 flex-shrink-0"
                            checked={allPageRowsSelected}
                            onClick={event => event.stopPropagation()}
                            onChange={event => {
                              event.stopPropagation()
                              onSelectAll(event.target.checked)
                            }}
                          />
                          {!hideSelectAllLabel && (
                            <span className="break-words leading-tight flex-1 min-w-0">
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
                            checked={allPageRowsSelected}
                            onClick={event => event.stopPropagation()}
                            onChange={event => {
                              event.stopPropagation()
                              onSelectAll(event.target.checked)
                            }}
                          />
                          {!hideSelectAllLabel && (
                            <span className="break-words leading-tight flex-1 min-w-0">{column.label}</span>
                          )}
                          {/* Invisible placeholder to match SortTriangles height */}
                          <div className="flex-shrink-0 w-2.5 h-2.5 opacity-0" aria-hidden="true" />
                        </>
                      ) : (
                        <>
                          {column.sortable ? (
                            <button
                              type="button"
                              className={cn(
                                "inline-flex items-center gap-1 min-w-0 max-w-full text-left rounded-sm px-1 -mx-1",
                                "cursor-pointer hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-white/70"
                              )}
                              draggable
                              onClick={event => {
                                event.preventDefault()
                                event.stopPropagation()
                                if (Date.now() < suppressSortClickUntilRef.current) return
                                handleSort(column)
                              }}
                              aria-label={`Sort by ${column.label}`}
                            >
                              <span className="break-words leading-tight min-w-0">{column.label}</span>
                              <span className="flex-shrink-0" aria-hidden="true">
                                <SortTriangles direction={sortConfig?.key === column.id ? sortConfig.direction : null} />
                              </span>
                            </button>
                          ) : (
                            <span className="break-words leading-tight flex-1 min-w-0">{column.label}</span>
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
                        onPointerDown={event => handleResizePointerDown(event, column.id)}
                        onPointerMove={handleResizePointerMove}
                        onPointerUp={handleResizePointerUp}
                        onPointerCancel={handleResizePointerCancel}
                        onClick={event => {
                          event.stopPropagation()
                        }}
                        onDoubleClick={event => {
                          event.preventDefault()
                          event.stopPropagation()
                          handleDoubleClick(column.id)
                        }}
                        title="Drag to resize, double-click to auto-fit"
                      />
                    )}
                  </div>
                ))}
                {useSpacerMode && (
                  <div className="table-cell table-spacer" aria-hidden="true" />
                )}
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
                {useSpacerMode && (
                  <div className="table-cell table-spacer" aria-hidden="true" />
                )}
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
          {footerAbovePagination ? (
            <div className="pb-2">
              {footerAbovePagination}
            </div>
          ) : null}
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
                        className={`px-2 py-1 transition-colors ${
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
                  className="border border-gray-300 px-2 py-1 text-sm"
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

















