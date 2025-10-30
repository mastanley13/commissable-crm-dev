"use client"

import { Download, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface RevenueSchedulesBulkActionBarProps {
  count: number
  disabled?: boolean
  onExportCsv: () => void
  className?: string
  onDelete?: () => void
}

export function RevenueSchedulesBulkActionBar({
  count,
  disabled = false,
  onExportCsv,
  className,
  onDelete,
}: RevenueSchedulesBulkActionBarProps) {
  if (count <= 0) {
    return null
  }

  return (
    <div className={cn("fixed inset-x-0 bottom-6 z-50 pointer-events-none px-4", className)}>
      <div
        className={cn(
          "pointer-events-auto mx-auto flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-xl",
          "md:flex-row md:items-center md:justify-between max-w-5xl"
        )}
        role="region"
        aria-label="Revenue schedules bulk actions"
      >
        <div className="text-sm font-medium text-blue-900">
          {count} item{count === 1 ? '' : 's'} selected
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {/* Using SVG icon names in lucide-react, Trash2 is consistent */}
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Delete</span>
            </button>
          )}
          <button
            type="button"
            onClick={onExportCsv}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>
    </div>
  )
}
