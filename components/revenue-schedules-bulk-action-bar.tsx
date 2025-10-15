"use client"

import { Download } from "lucide-react"
import { cn } from "@/lib/utils"

interface RevenueSchedulesBulkActionBarProps {
  count: number
  disabled?: boolean
  onExportCsv: () => void
  className?: string
}

export function RevenueSchedulesBulkActionBar({
  count,
  disabled = false,
  onExportCsv,
  className,
}: RevenueSchedulesBulkActionBarProps) {
  if (count <= 0) {
    return null
  }

  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm",
        "md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="text-sm font-medium text-blue-900">
        {count} item{count === 1 ? '' : 's'} selected
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
  )
}


