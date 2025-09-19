"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, X, GripVertical } from "lucide-react"
import type { Column } from "@/components/dynamic-table"
import { cn } from "@/lib/utils"

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
  originalIndex: number
}

const MIN_VISIBLE_COLUMNS = 1

export function ColumnChooserModal({ isOpen, columns, onApply, onClose }: ColumnChooserModalProps) {
  const [availableColumns, setAvailableColumns] = useState<ColumnItem[]>([])
  const [selectedColumns, setSelectedColumns] = useState<ColumnItem[]>([])
  const [draggedItem, setDraggedItem] = useState<ColumnItem | null>(null)

  useEffect(() => {
    if (isOpen) {
      const columnItems: ColumnItem[] = columns.map((column, index) => ({
        id: column.id,
        label: column.label,
        hideable: column.hideable !== false,
        hidden: column.hidden || false,
        originalIndex: index
      }))

      const available = columnItems.filter(col => col.hidden && col.hideable)
      const selected = columnItems.filter(col => !col.hidden)

      setAvailableColumns(available)
      setSelectedColumns(selected)
    }
  }, [isOpen, columns])

  const moveToSelected = (columnItem: ColumnItem) => {
    if (!columnItem.hideable) return

    setAvailableColumns(prev => prev.filter(col => col.id !== columnItem.id))
    setSelectedColumns(prev => [...prev, { ...columnItem, hidden: false }])
  }

  const moveToAvailable = (columnItem: ColumnItem) => {
    if (!columnItem.hideable) return
    if (selectedColumns.length <= MIN_VISIBLE_COLUMNS) return

    setSelectedColumns(prev => prev.filter(col => col.id !== columnItem.id))
    setAvailableColumns(prev => [...prev, { ...columnItem, hidden: true }])
  }

  const moveSelectedUp = (index: number) => {
    if (index === 0) return
    setSelectedColumns(prev => {
      const newSelected = [...prev]
      const [moved] = newSelected.splice(index, 1)
      newSelected.splice(index - 1, 0, moved)
      return newSelected
    })
  }

  const moveSelectedDown = (index: number) => {
    if (index === selectedColumns.length - 1) return
    setSelectedColumns(prev => {
      const newSelected = [...prev]
      const [moved] = newSelected.splice(index, 1)
      newSelected.splice(index + 1, 0, moved)
      return newSelected
    })
  }

  const handleDragStart = (e: React.DragEvent, item: ColumnItem, source: 'available' | 'selected') => {
    setDraggedItem(item)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({ item, source }))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDropOnAvailable = (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedItem) return

    const data = JSON.parse(e.dataTransfer.getData('text/plain'))
    if (data.source === 'selected') {
      moveToAvailable(data.item)
    }
    setDraggedItem(null)
  }

  const handleDropOnSelected = (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedItem) return

    const data = JSON.parse(e.dataTransfer.getData('text/plain'))
    if (data.source === 'available') {
      moveToSelected(data.item)
    }
    setDraggedItem(null)
  }

  const handleApply = () => {
    const updatedColumns = columns.map(column => {
      const selectedItem = selectedColumns.find(item => item.id === column.id)
      const availableItem = availableColumns.find(item => item.id === column.id)

      return {
        ...column,
        hidden: availableItem ? true : false
      }
    })

    // Reorder based on selected columns order
    const reorderedColumns = [
      ...selectedColumns.map(item => updatedColumns.find(col => col.id === item.id)!),
      ...availableColumns.map(item => updatedColumns.find(col => col.id === item.id)!)
    ].filter(Boolean)

    onApply(reorderedColumns)
    onClose()
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40" onClick={onClose}>
      <div
        className="w-full max-w-4xl rounded-xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-blue-600">
          <h2 className="text-lg font-semibold text-white">Choose Columns</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-white hover:bg-blue-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Available Columns */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900 border-b border-gray-200 pb-2">
                Available Columns
              </h3>
              <div
                className="min-h-[300px] max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50"
                onDragOver={handleDragOver}
                onDrop={handleDropOnAvailable}
              >
                {availableColumns.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                    All columns are selected
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableColumns.map((column) => (
                      <div
                        key={column.id}
                        draggable={column.hideable}
                        onDragStart={(e) => handleDragStart(e, column, 'available')}
                        className={cn(
                          "flex items-center justify-between p-3 bg-white rounded border border-gray-200 cursor-pointer hover:bg-gray-50",
                          column.hideable ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-50"
                        )}
                        onClick={() => column.hideable && moveToSelected(column)}
                      >
                        <div className="flex items-center gap-2">
                          {column.hideable && <GripVertical className="h-4 w-4 text-gray-400" />}
                          <span className="text-sm">{column.label}</span>
                        </div>
                        {column.hideable && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              moveToSelected(column)
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Columns */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900 border-b border-gray-200 pb-2">
                Selected Columns
              </h3>
              <div
                className="min-h-[300px] max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50"
                onDragOver={handleDragOver}
                onDrop={handleDropOnSelected}
              >
                {selectedColumns.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                    No columns selected
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedColumns.map((column, index) => (
                      <div
                        key={column.id}
                        draggable={column.hideable}
                        onDragStart={(e) => handleDragStart(e, column, 'selected')}
                        className={cn(
                          "flex items-center justify-between p-3 bg-white rounded border border-gray-200",
                          column.hideable ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-75"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {column.hideable && <GripVertical className="h-4 w-4 text-gray-400" />}
                          <span className="text-sm font-medium">{column.label}</span>
                          {!column.hideable && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Required</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Move Up/Down buttons */}
                          <button
                            onClick={() => moveSelectedUp(index)}
                            disabled={index === 0}
                            className={cn(
                              "p-1 text-gray-600 hover:bg-gray-100 rounded text-xs",
                              index === 0 && "opacity-40 cursor-not-allowed"
                            )}
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveSelectedDown(index)}
                            disabled={index === selectedColumns.length - 1}
                            className={cn(
                              "p-1 text-gray-600 hover:bg-gray-100 rounded text-xs",
                              index === selectedColumns.length - 1 && "opacity-40 cursor-not-allowed"
                            )}
                            title="Move down"
                          >
                            ↓
                          </button>
                          {/* Remove button */}
                          {column.hideable && selectedColumns.length > MIN_VISIBLE_COLUMNS && (
                            <button
                              onClick={() => moveToAvailable(column)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Remove column"
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Tips:</strong> Drag columns between lists or use the arrow buttons.
              Click on available columns to add them. Required columns cannot be removed.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="text-sm text-gray-600">
            Selected: <span className="font-medium">{selectedColumns.length}</span> columns
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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