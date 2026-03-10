"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, GripVertical } from "lucide-react"
import type { Column } from "@/components/dynamic-table"
import { cn } from "@/lib/utils"
import { ModalHeader } from "./ui/modal-header"

interface ColumnChooserModalProps {
  isOpen: boolean
  columns: Column[]
  onApply: (columns: Column[]) => void
  onClose: () => void
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

export function ColumnChooserModal({ isOpen, columns, onApply, onClose }: ColumnChooserModalProps) {
  const [availableColumns, setAvailableColumns] = useState<ColumnItem[]>([])
  const [selectedColumns, setSelectedColumns] = useState<ColumnItem[]>([])
  const [draggedItem, setDraggedItem] = useState<ColumnItem | null>(null)
  const [initialized, setInitialized] = useState(false)

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
      const selected = columnItems.filter(col => !col.hidden)

      setAvailableColumns(available)
      setSelectedColumns(selected)
      setInitialized(true)
    } else if (!isOpen && initialized) {
      setInitialized(false)
    }
  }, [isOpen, columns, initialized])

  const moveToSelected = (columnItem: ColumnItem) => {
    if (!columnItem.hideable) return

    setAvailableColumns(prev => prev.filter(col => col.id !== columnItem.id))
    setSelectedColumns(prev => [...prev, { ...columnItem, hidden: false, locked: false }])
  }

  const moveToAvailable = (columnItem: ColumnItem) => {
    if (!columnItem.hideable) return
    if (selectedColumns.length <= MIN_VISIBLE_COLUMNS) return

    setSelectedColumns(prev => prev.filter(col => col.id !== columnItem.id))
    setAvailableColumns(prev => [...prev, { ...columnItem, hidden: true, locked: false }])
  }

  const moveSelectedUp = (index: number) => {
    if (index === 0) return
    setSelectedColumns(prev => {
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      next.splice(index - 1, 0, moved)
      return next
    })
  }

  const moveSelectedDown = (index: number) => {
    if (index === selectedColumns.length - 1) return
    setSelectedColumns(prev => {
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      next.splice(index + 1, 0, moved)
      return next
    })
  }

  const toggleLocked = (columnId: string) => {
    setSelectedColumns(prev =>
      prev.map(column =>
        column.id === columnId
          ? { ...column, locked: !column.locked }
          : column
      )
    )
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
          return next
        })
      } else if (data.source === "selected") {
        const sourceIndex = data.index
        if (sourceIndex !== undefined && sourceIndex !== targetIndex) {
          setSelectedColumns(prev => {
            const next = [...prev]
            const [moved] = next.splice(sourceIndex, 1)
            next.splice(targetIndex, 0, moved)
            return next
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

  const handleApply = () => {
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

    onApply(reorderedColumns)
    onClose()
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40">
      <div
        className="w-full max-w-4xl rounded-xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <ModalHeader kicker="Column Settings" title="Choose Columns" />

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
                    {selectedColumns.map((column, index) => (
                      <div
                        key={column.id}
                        draggable={column.hideable}
                        onDragStart={event => handleDragStart(event, column, "selected", index)}
                        onDragOver={column.hideable ? handleDragOver : undefined}
                        onDrop={event => handleDropOnSelectedItem(event, index)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "flex items-center justify-between rounded border border-gray-200 bg-white p-3 transition-all",
                          column.hideable ? "cursor-grab active:cursor-grabbing hover:border-blue-400" : "cursor-not-allowed opacity-75",
                          draggedItem?.id === column.id && "scale-95 opacity-50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {column.hideable && <GripVertical className="h-4 w-4 text-gray-400" />}
                          <span className="text-sm font-medium">{column.label}</span>
                          {column.locked ? (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                              Locked
                            </span>
                          ) : null}
                          {!column.hideable ? (
                            <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">Required</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation()
                              toggleLocked(column.id)
                            }}
                            className={cn(
                              "rounded border px-2 py-1 text-[11px] font-semibold transition",
                              column.locked
                                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                            )}
                            title={column.locked ? "Unlock column" : "Lock column to the left side of the table"}
                          >
                            {column.locked ? "Locked" : "Lock"}
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSelectedUp(index)}
                            disabled={index === 0}
                            className={cn(
                              "rounded p-1 text-xs text-gray-600 hover:bg-gray-100",
                              index === 0 && "cursor-not-allowed opacity-40"
                            )}
                            title="Move up"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSelectedDown(index)}
                            disabled={index === selectedColumns.length - 1}
                            className={cn(
                              "rounded p-1 text-xs text-gray-600 hover:bg-gray-100",
                              index === selectedColumns.length - 1 && "cursor-not-allowed opacity-40"
                            )}
                            title="Move down"
                          >
                            Down
                          </button>
                          {column.hideable && selectedColumns.length > MIN_VISIBLE_COLUMNS ? (
                            <button
                              type="button"
                              onClick={() => moveToAvailable(column)}
                              className="rounded p-1 text-red-600 hover:bg-red-50"
                              title="Remove column"
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-blue-50 p-3">
            <p className="text-sm text-blue-800">
              <strong>Tips:</strong> Drag columns between lists or drag within Selected Columns to reorder.
              Use the Lock button on selected columns to keep them pinned on the left during horizontal scroll.
              Click available columns to add them. Required columns cannot be removed.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="text-sm text-gray-600">
            Selected: <span className="font-medium">{selectedColumns.length}</span> columns
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
              disabled={selectedColumns.length < MIN_VISIBLE_COLUMNS}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
