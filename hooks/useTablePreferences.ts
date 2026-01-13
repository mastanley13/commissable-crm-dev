"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Column } from "@/components/dynamic-table"
import { normalizeTablePreferencePayloadForColumns } from "@/lib/table-preferences-alias"

interface TablePreferencePayload {
  columnOrder?: string[]
  columnWidths?: Record<string, number>
  hiddenColumns?: string[]
  sortState?: unknown
  filters?: unknown
  pageSize?: number | null
}

interface UseTablePreferencesOptions {
  defaultPageSize?: number
}

function cloneColumns(columns: Column[]): Column[] {
  return columns.map(column => ({ ...column }))
}

function applyPreferences(columns: Column[], preference: TablePreferencePayload | null): Column[] {
  const normalized = normalizeTablePreferencePayloadForColumns(preference, columns) as TablePreferencePayload | null

  if (!normalized) {
    return cloneColumns(columns)
  }

  const baseColumns = cloneColumns(columns)
  let orderedColumns = baseColumns

  if (Array.isArray(normalized.columnOrder) && normalized.columnOrder.length) {
    const columnOrderSet = new Set(normalized.columnOrder)

    const ordered: Column[] = []
    for (const columnId of normalized.columnOrder) {
      const column = baseColumns.find(col => col.id === columnId)
      if (column) {
        ordered.push({ ...column })
      }
    }

    const missingColumns = baseColumns.filter(col => !columnOrderSet.has(col.id))
    orderedColumns = [...ordered, ...missingColumns.map(col => ({ ...col }))]
  }

  if (normalized.columnWidths && typeof normalized.columnWidths === "object") {
    orderedColumns = orderedColumns.map(column => {
      const width = normalized.columnWidths?.[column.id]
      if (typeof width === "number" && width > 0) {
        // Normalize width to integer to avoid sub-pixel gaps
        return { ...column, width: Math.round(width) }
      }
      return column
    })
  }

  if (Array.isArray(normalized.hiddenColumns)) {
    const hiddenSet = new Set(normalized.hiddenColumns)
    orderedColumns = orderedColumns.map(column => ({
      ...column,
      hidden: column.hideable !== false ? hiddenSet.has(column.id) : false
    }))
  }

  return orderedColumns
}

function normalizePageSize(value: unknown, fallback: number): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  const clamped = Math.min(100, Math.max(1, Math.floor(num)))
  return clamped
}

export interface UseTablePreferencesResult {
  columns: Column[]
  loading: boolean
  saving: boolean
  error: string | null
  pageSize: number
  /**
   * True when a persisted preference row exists for this pageKey.
   * Used by callers to apply "default visibility" only on first load.
   */
  hasServerPreferences: boolean
  hasUnsavedChanges: boolean
  lastSaved: Date | null
  handleColumnsChange: (columns: Column[]) => void
  handleHiddenColumnsChange: (hiddenColumns: string[]) => void
  handlePageSizeChange: (pageSize: number) => Promise<void>
  saveChanges: () => Promise<void>
  saveChangesOnModalClose: () => Promise<void>
  refresh: () => Promise<void>
}

export function useTablePreferences(
  pageKey: string,
  baseColumns: Column[],
  options?: UseTablePreferencesOptions
): UseTablePreferencesResult {
  const normalizedDefaultPageSize = normalizePageSize(options?.defaultPageSize ?? 100, 100)
  const [columns, setColumns] = useState<Column[]>(() => cloneColumns(baseColumns))
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [hasServerPreferences, setHasServerPreferences] = useState<boolean>(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [savedColumns, setSavedColumns] = useState<Column[]>(() => cloneColumns(baseColumns))
  const [pageSize, setPageSize] = useState<number>(normalizedDefaultPageSize)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const baseColumnsKey = useMemo(() => JSON.stringify(baseColumns), [baseColumns])
  const baseColumnsRef = useRef(baseColumns)
  const pageSizeRef = useRef<number>(normalizedDefaultPageSize)

  useEffect(() => {
    baseColumnsRef.current = baseColumns
  }, [baseColumnsKey])

  useEffect(() => {
    const nextBaseColumns = cloneColumns(baseColumnsRef.current)
    setColumns(nextBaseColumns)
    setSavedColumns(nextBaseColumns.map(col => ({ ...col })))
    setHasUnsavedChanges(false)
  }, [baseColumnsKey])

  // Helper function to check if columns have changed
  const columnsHaveChanged = useCallback((current: Column[], saved: Column[]): boolean => {
    if (current.length !== saved.length) return true
    
    for (let i = 0; i < current.length; i++) {
      const currentCol = current[i]
      const savedCol = saved[i]
      
      if (currentCol.id !== savedCol.id || 
          currentCol.width !== savedCol.width || 
          currentCol.hidden !== savedCol.hidden) {
        return true
      }
    }
    
    return false
  }, [])

  const fetchPreferences = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/table-preferences/' + encodeURIComponent(pageKey), {
        method: "GET",
        cache: "no-store"
      })

      if (!response.ok) {
        throw new Error('Failed to load table preferences for ' + pageKey)
      }

      const payload: TablePreferencePayload | null = await response.json()
      setHasServerPreferences(!!payload)
      const base = baseColumnsRef.current
      const newColumns = applyPreferences(base, payload)
      setColumns(newColumns)
      setSavedColumns(newColumns.map(col => ({ ...col })))
      const nextPageSize = normalizePageSize(payload?.pageSize ?? normalizedDefaultPageSize, normalizedDefaultPageSize)
      setPageSize(nextPageSize)
      pageSizeRef.current = nextPageSize
      setHasUnsavedChanges(false)
      setError(null)
    } catch (err) {
      console.error(err)
      const fallbackColumns = cloneColumns(baseColumnsRef.current)
      setColumns(fallbackColumns)
      setSavedColumns(fallbackColumns.map(col => ({ ...col })))
      setHasUnsavedChanges(false)
      setHasServerPreferences(false)
      setPageSize(normalizedDefaultPageSize)
      pageSizeRef.current = normalizedDefaultPageSize
      setError(err instanceof Error ? err.message : "Unable to load table preferences")
    } finally {
      setLoading(false)
    }
  }, [pageKey, baseColumnsKey, normalizedDefaultPageSize])

  useEffect(() => {
    fetchPreferences()

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [fetchPreferences])

  const persistPreferences = useCallback(async (updatedColumns: Column[], nextPageSize?: number) => {
    const finalPageSize = normalizePageSize(nextPageSize ?? pageSizeRef.current, normalizedDefaultPageSize)
    pageSizeRef.current = finalPageSize
    try {
      setSaving(true)
      const response = await fetch(`/api/table-preferences/${encodeURIComponent(pageKey)}` , {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          columnOrder: updatedColumns.map(column => column.id),
          columnWidths: updatedColumns.reduce<Record<string, number>>((acc, column) => {
            // Normalize width to integer to avoid sub-pixel gaps
            acc[column.id] = Math.round(column.width)
            return acc
          }, {}),
          hiddenColumns: updatedColumns.filter(column => column.hidden).map(column => column.id),
          pageSize: finalPageSize
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to persist table preferences for ${pageKey}`)
      }

      // Update saved state after successful save
      setSavedColumns(updatedColumns.map(col => ({ ...col })))
      setPageSize(finalPageSize)
      setHasUnsavedChanges(false)
      setLastSaved(new Date())
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to save table preferences")
    } finally {
      setSaving(false)
    }
  }, [pageKey, normalizedDefaultPageSize])

  // Manual save function for explicit saves
  const saveChanges = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    await persistPreferences(columns, pageSizeRef.current)
  }, [columns, persistPreferences])

  // Auto-save when modal closes (if there are changes)
  const saveChangesOnModalClose = useCallback(async () => {
    if (hasUnsavedChanges) {
      await saveChanges()
    }
  }, [hasUnsavedChanges, saveChanges])

  const schedulePersist = useCallback((updated: Column[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Check if there are actual changes
    const hasChanges = columnsHaveChanged(updated, savedColumns)
    setHasUnsavedChanges(hasChanges)

    // Auto-save with debounce (150ms delay)
    if (hasChanges) {
      saveTimeoutRef.current = setTimeout(() => {
        persistPreferences(updated, pageSizeRef.current)
      }, 150)
    }
  }, [columnsHaveChanged, savedColumns, persistPreferences])

  const handleColumnsChange = useCallback((updatedColumns: Column[]) => {
    const nextColumns = updatedColumns.map(column => ({ ...column }))
    setColumns(nextColumns)
    schedulePersist(nextColumns)
  }, [schedulePersist])

  const handleHiddenColumnsChange = useCallback((hiddenColumns: string[]) => {
    setColumns(previous => {
      const next = previous.map(column => ({
        ...column,
        hidden: hiddenColumns.includes(column.id)
      }))
      schedulePersist(next)
      return next
    })
  }, [schedulePersist])

  const handlePageSizeChange = useCallback(
    async (next: number) => {
      const normalized = normalizePageSize(next, normalizedDefaultPageSize)
      setPageSize(normalized)
      pageSizeRef.current = normalized
      await persistPreferences(columns, normalized)
    },
    [columns, normalizedDefaultPageSize, persistPreferences]
  )

  const refresh = useCallback(async () => {
    await fetchPreferences()
  }, [fetchPreferences])

  return {
    columns,
    loading,
    saving,
    error,
    pageSize,
    hasServerPreferences,
    hasUnsavedChanges,
    lastSaved,
    handleColumnsChange,
    handleHiddenColumnsChange,
    handlePageSizeChange,
    saveChanges,
    saveChangesOnModalClose,
    refresh
  }
}
