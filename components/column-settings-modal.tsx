"use client"

import { useEffect, useMemo, useState } from "react"
import type { Column } from "@/components/dynamic-table"
import { cn } from "@/lib/utils"

interface ColumnSettingsModalProps {
  isOpen: boolean
  columns: Column[]
  onApply: (columns: Column[]) => void
  onClose: () => void
}

const MIN_VISIBLE_COLUMNS = 1

export function ColumnSettingsModal({ isOpen, columns, onApply, onClose }: ColumnSettingsModalProps) {
  const [draftColumns, setDraftColumns] = useState<Column[]>([])

  useEffect(() => {
    if (isOpen) {
      setDraftColumns(columns.map(column => ({ ...column })))
    }
  }, [isOpen, columns])

  const visibleCount = useMemo(() => draftColumns.filter(column => !column.hidden).length, [draftColumns])

  const toggleColumn = (columnId: string) => {
    setDraftColumns(previous => {
      const next = previous.map(column => {
        if (column.id !== columnId) return column
        const willHide = !column.hidden
        if (willHide && visibleCount <= MIN_VISIBLE_COLUMNS) {
          return column
        }
        if (column.hideable === false && willHide) {
          return column
        }
        return { ...column, hidden: !column.hidden }
      })
      return next
    })
  }

  const moveColumn = (columnId: string, direction: -1 | 1) => {
    setDraftColumns(previous => {
      const index = previous.findIndex(column => column.id === columnId)
      if (index === -1) return previous
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= previous.length) return previous
      const next = [...previous]
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }

  const handleShowAll = () => {
    setDraftColumns(previous => previous.map(column => ({ ...column, hidden: false })))
  }

  const handleApply = () => {
    onApply(draftColumns.map(column => ({ ...column })))
    onClose()
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Customize Columns</h2>
            <p className="text-sm text-gray-500">Show, hide, and reorder the columns that appear in this table.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            Close
          </button>
        </header>

        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Selected columns: <span className="font-medium text-gray-900">{visibleCount}</span>
            </span>
            <button
              type="button"
              onClick={handleShowAll}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Show all
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2">
            {draftColumns.map((column, index) => {
              const canHide = column.hideable !== false
              const disableHide = canHide ? visibleCount <= MIN_VISIBLE_COLUMNS && !column.hidden : true
              return (
                <div
                  key={column.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                      checked={!column.hidden}
                      onChange={() => toggleColumn(column.id)}
                      disabled={disableHide}
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{column.label}</div>
                      {column.hidden && <div className="text-xs text-gray-500">Hidden</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className={cn(
                        "rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100",
                        index === 0 && "opacity-40 cursor-not-allowed"
                      )}
                      onClick={() => moveColumn(column.id, -1)}
                      disabled={index === 0}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100",
                        index === draftColumns.length - 1 && "opacity-40 cursor-not-allowed"
                      )}
                      onClick={() => moveColumn(column.id, 1)}
                      disabled={index === draftColumns.length - 1}
                    >
                      Down
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:bg-primary-300"
            disabled={visibleCount < MIN_VISIBLE_COLUMNS}
          >
            Apply
          </button>
        </footer>
      </div>
    </div>
  )
}
