"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, GripVertical, Lock, LockOpen } from "lucide-react"
import type { Column } from "@/components/dynamic-table"
import {
  canMoveItemWithinLockGroup,
  moveItemWithinLockGroup,
  normalizeLockedColumnGroup,
  setItemLocked,
} from "@/lib/column-chooser-ordering"
import { cn } from "@/lib/utils"
import { ModalHeader } from "./ui/modal-header"

interface ColumnChooserModalProps {
  isOpen: boolean
  columns: Column[]
  onApply: (columns: Column[], options?: { syncHorizontalScroll?: boolean }) => void | Promise<void>
  onClose: () => void
  showSyncHorizontalScrollOption?: boolean
  syncHorizontalScroll?: boolean
}

interface ColumnItem {
  id: string
  label: string
  hideable: boolean
  hidden: boolean
  locked: boolean
  originalIndex: number
}

const MIN_VISIBLE_COLUMNS = 1

export function ColumnChooserModal({
  isOpen,
  columns,
  onApply,
  onClose,
  showSyncHorizontalScrollOption = false,
  syncHorizontalScroll = true,
}: ColumnChooserModalProps) {
  const [availableColumns, setAvailableColumns] = useState<ColumnItem[]>([])
  const [selectedColumns, setSelectedColumns] = useState<ColumnItem[]>([])
  const [draggedItem, setDraggedItem] = useState<ColumnItem | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [syncHorizontalScrollDraft, setSyncHorizontalScrollDraft] = useState(syncHorizontalScroll)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (isOpen && !initialized) {
      const columnItems: ColumnItem[] = columns.map((column, index) => ({
        id: column.id,
        label: column.label,
        hideable: column.hideable !== false,
        hidden: column.hidden || false,
        locked: Boolean(column.locked) && !column.hidden,
        originalIndex: index
      }))

      const available = columnItems.filter(col => col.hidden && col.hideable)
      const selected = normalizeLockedColumnGroup(columnItems.filter(col => !col.hidden))

      setAvailableColumns(available)
      setSelectedColumns(selected)
      setSyncHorizontalScrollDraft(syncHorizontalScroll)
      setApplying(false)
      setInitialized(true)
    } else if (!isOpen && initialized) {
      setInitialized(false)
      setApplying(false)
    }
  }, [isOpen, columns, initialized, syncHorizontalScroll])

  const moveToSelected = (columnItem: ColumnItem) => {
    if (!columnItem.hideable) return

    setAvailableColumns(prev => prev.filter(col => col.id !== columnItem.id))
    setSelectedColumns(prev =>
      normalizeLockedColumnGroup([...prev, { ...columnItem, hidden: false, locked: false }])
    )
  }

  const moveToAvailable = (columnItem: ColumnItem) => {
    if (!columnItem.hideable) return
    if (selectedColumns.length <= MIN_VISIBLE_COLUMNS) return

    setSelectedColumns(prev => prev.filter(col => col.id !== columnItem.id))
    setAvailableColumns(prev => [...prev, { ...columnItem, hidden: true, locked: false }])
  }

  const moveSelectedUp = (columnId: string) => {
    setSelectedColumns(prev => moveItemWithinLockGroup(prev, columnId, -1))
  }

  const moveSelectedDown = (columnId: string) => {
    setSelectedColumns(prev => moveItemWithinLockGroup(prev, columnId, 1))
  }

  const toggleLocked = (columnId: string) => {
    setSelectedColumns(prev => {
      const target = prev.find(column => column.id === columnId)
      if (!target) return prev
      return setItemLocked(prev, columnId, !target.locked)
    })
  }

  const handleDragStart = (e: React.DragEvent, item: ColumnItem, source: "available" | "selected", index?: number) => {
    if (!item.hideable) {
      e.preventDefault()
      return
    }
    setDraggedItem(item)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", JSON.stringify({ item, source, index }))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDropOnAvailable = (e: React.DragEvent) => {
    e.preventDefault()

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"))
      if (!data || !data.item || !data.source) {
        setDraggedItem(null)
        return
      }

      if (data.source === "selected") {
        moveToAvailable(data.item)
      }
    } catch (error) {
      console.error("Failed to parse drag data:", error)
    }

    setDraggedItem(null)
  }

  const handleDropOnSelected = (e: React.DragEvent) => {
    e.preventDefault()

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"))
      if (!data || !data.item || !data.source) {
        setDraggedItem(null)
        return
      }

      if (data.source === "available") {
        moveToSelected(data.item)
      }
    } catch (error) {
      console.error("Failed to parse drag data:", error)
    }

    setDraggedItem(null)
  }

  const handleDropOnSelectedItem = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"))
      if (!data || !data.item || !data.source) {
        setDraggedItem(null)
        return
      }

      if (data.source === "available") {
        setAvailableColumns(prev => prev.filter(col => col.id !== data.item.id))
        setSelectedColumns(prev => {
          const next = [...prev]
          next.splice(targetIndex, 0, { ...data.item, hidden: false, locked: false })
          return normalizeLockedColumnGroup(next)
        })
      } else if (data.source === "selected") {
        const sourceIndex = data.index
        if (sourceIndex !== undefined && sourceIndex !== targetIndex) {
          setSelectedColumns(prev => {
            const next = [...prev]
            const [moved] = next.splice(sourceIndex, 1)
            next.splice(targetIndex, 0, moved)
            return normalizeLockedColumnGroup(next)
          })
        }
      }
    } catch (error) {
      console.error("Failed to parse drag data:", error)
    }

    setDraggedItem(null)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  const handleApply = async () => {
    if (applying) return

    const updatedColumns = columns.map(column => {
      const selectedItem = selectedColumns.find(item => item.id === column.id)
      const availableItem = availableColumns.find(item => item.id === column.id)

      return {
        ...column,
        hidden: Boolean(availableItem),
        locked: selectedItem ? selectedItem.locked : false,
      }
    })

    const reorderedColumns = [
      ...selectedColumns.map(item => updatedColumns.find(col => col.id === item.id)!),
      ...availableColumns.map(item => updatedColumns.find(col => col.id === item.id)!),
    ].filter(Boolean)

    try {
      setApplying(true)
      await onApply(reorderedColumns, { syncHorizontalScroll: syncHorizontalScrollDraft })
      onClose()
    } finally {
      setApplying(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40">
      <div
        className="w-full max-w-4xl rounded-t-xl rounded-b-none bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <ModalHeader kicker="Column Settings" title="Choose Columns" variant="gradient" />

        <div className="p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="border-b border-gray-200 pb-2 text-sm font-medium text-gray-900">
                Available Columns
              </h3>
              <div
                className="min-h-[300px] max-h-[400px] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3"
                onDragOver={handleDragOver}
                onDrop={handleDropOnAvailable}
              >
                {availableColumns.length === 0 ? (
                  <div className="flex h-32 items-center justify-center text-sm text-gray-500">
                    All columns are selected
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableColumns.map((column, index) => (
                      <div
                        key={column.id}
                        draggable={column.hideable}
                        onDragStart={event => handleDragStart(event, column, "available", index)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "flex items-center justify-between rounded border border-gray-200 bg-white p-3 transition-all hover:bg-gray-50",
                          column.hideable ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-50",
                          draggedItem?.id === column.id && "scale-95 opacity-50"
                        )}
                        onClick={() => column.hideable && moveToSelected(column)}
                      >
                        <div className="flex items-center gap-2">
                          {column.hideable && <GripVertical className="h-4 w-4 text-gray-400" />}
                          <span className="text-sm">{column.label}</span>
                        </div>
                        {column.hideable ? (
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation()
                              moveToSelected(column)
                            }}
                            className="rounded p-1 text-blue-600 hover:bg-blue-50"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="border-b border-gray-200 pb-2 text-sm font-medium text-gray-900">
                Selected Columns
              </h3>
              <div
                className="min-h-[300px] max-h-[400px] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3"
                onDragOver={handleDragOver}
                onDrop={handleDropOnSelected}
              >
                {selectedColumns.length === 0 ? (
                  <div className="flex h-32 items-center justify-center text-sm text-gray-500">
                    No columns selected
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_72px_88px] gap-3 rounded border border-gray-200 bg-gray-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                      <span>Field Name</span>
                      <span className="text-center">Locked</span>
                      <span className="text-center">Reorder</span>
                    </div>
                    {selectedColumns.map((column, index) => {
                      const canMoveUp = canMoveItemWithinLockGroup(selectedColumns, column.id, -1)
                      const canMoveDown = canMoveItemWithinLockGroup(selectedColumns, column.id, 1)

                      return (
                        <div
                          key={column.id}
                          draggable={column.hideable}
                          onDragStart={event => handleDragStart(event, column, "selected", index)}
                          onDragOver={column.hideable ? handleDragOver : undefined}
                          onDrop={event => handleDropOnSelectedItem(event, index)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "grid grid-cols-[minmax(0,1fr)_72px_88px] items-center gap-3 rounded border border-gray-200 bg-white p-3 transition-all",
                            column.hideable ? "cursor-grab active:cursor-grabbing hover:border-blue-400" : "cursor-not-allowed opacity-75",
                            draggedItem?.id === column.id && "scale-95 opacity-50"
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {column.hideable && <GripVertical className="h-4 w-4 shrink-0 text-gray-400" />}
                            <span className="truncate text-sm font-medium">{column.label}</span>
                            {!column.hideable ? (
                              <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">Required</span>
                            ) : null}
                            {column.hideable && selectedColumns.length > MIN_VISIBLE_COLUMNS ? (
                              <button
                                type="button"
                                onClick={() => moveToAvailable(column)}
                                className="ml-auto rounded p-1 text-red-600 hover:bg-red-50"
                                title="Remove column"
                              >
                                <ArrowLeft className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => toggleLocked(column.id)}
                              aria-label={column.locked ? `Unlock ${column.label}` : `Lock ${column.label}`}
                              aria-pressed={column.locked}
                              className={cn(
                                "rounded p-1 transition",
                                column.locked
                                  ? "text-primary-600 hover:bg-primary-50"
                                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              )}
                              title={column.locked ? "Locked" : "Unlocked"}
                            >
                              {column.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                            </button>
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveSelectedUp(column.id)}
                              disabled={!canMoveUp}
                              className={cn(
                                "rounded p-1 text-gray-600 hover:bg-gray-100",
                                !canMoveUp && "cursor-not-allowed opacity-40"
                              )}
                              title={column.locked ? "Move locked column up" : "Move column up"}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSelectedDown(column.id)}
                              disabled={!canMoveDown}
                              className={cn(
                                "rounded p-1 text-gray-600 hover:bg-gray-100",
                                !canMoveDown && "cursor-not-allowed opacity-40"
                              )}
                              title={column.locked ? "Move locked column down" : "Move column down"}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-blue-50 p-3">
            <p className="text-sm text-blue-800">
              <strong>Tips:</strong> Drag columns between lists or drag within Selected Columns to reorder.
              Locked columns stay grouped at the top and remain pinned on the left during horizontal scroll.
              Click available columns to add them. Required columns cannot be removed.
            </p>
          </div>
          {showSyncHorizontalScrollOption ? (
            <label className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primary-600 accent-primary-600"
                checked={syncHorizontalScrollDraft}
                onChange={event => setSyncHorizontalScrollDraft(event.target.checked)}
              />
              <span>
                Sync horizontal scroll with the linked reconciliation table.
              </span>
            </label>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="inline-flex min-w-[88px] items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="text-sm text-gray-600">
              Selected: <span className="font-medium">{selectedColumns.length}</span> columns
            </div>
            <button
              type="button"
              onClick={() => void handleApply()}
              className="inline-flex min-w-[96px] items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
              disabled={selectedColumns.length < MIN_VISIBLE_COLUMNS || applying}
            >
              {applying ? "Saving..." : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
