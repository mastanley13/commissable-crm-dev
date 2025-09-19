"use client"

import { useState } from "react"
import { Settings, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Column } from "./dynamic-table"

interface ColumnChooserProps {
  columns: Column[]
  hiddenColumns: string[]
  onHiddenColumnsChange: (hiddenColumns: string[]) => void
}

export function ColumnChooser({ columns, hiddenColumns, onHiddenColumnsChange }: ColumnChooserProps) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleColumn = (columnId: string) => {
    const newHiddenColumns = hiddenColumns.includes(columnId)
      ? hiddenColumns.filter(id => id !== columnId)
      : [...hiddenColumns, columnId]
    
    onHiddenColumnsChange(newHiddenColumns)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        title="Column Settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">Column Visibility</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
              {columns.map(column => (
                <label
                  key={column.id}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.includes(column.id)}
                    onChange={() => toggleColumn(column.id)}
                    className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 flex-1">{column.label}</span>
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    column.type === "checkbox" ? "bg-gray-300" :
                    column.type === "toggle" ? "bg-green-300" :
                    column.type === "action" ? "bg-red-300" :
                    column.type === "email" ? "bg-blue-300" :
                    column.type === "phone" ? "bg-purple-300" :
                    "bg-gray-300"
                  )} />
                </label>
              ))}
            </div>
            
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onHiddenColumnsChange([])
                    setIsOpen(false)
                  }}
                  className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  Show All
                </button>
                <button
                  onClick={() => {
                    const nonEssentialColumns = columns
                      .filter(col => !["select", "fullName"].includes(col.id))
                      .map(col => col.id)
                    onHiddenColumnsChange(nonEssentialColumns)
                    setIsOpen(false)
                  }}
                  className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  Hide Optional
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
