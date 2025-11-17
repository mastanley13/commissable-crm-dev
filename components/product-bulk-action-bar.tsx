"use client"

import { Trash2, Download, ToggleLeft, ToggleRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProductBulkActionBarProps {
  count: number
  disabled?: boolean
  onDelete: () => void
  onExportCsv: () => void
  onActivate: () => void
  onDeactivate: () => void
  className?: string
  disableMutations?: boolean
}

export function ProductBulkActionBar({
  count,
  disabled = false,
  onDelete,
  onExportCsv,
  onActivate,
  onDeactivate,
  className,
  disableMutations = false,
}: ProductBulkActionBarProps) {
  if (count <= 0) {
    return null
  }

  const mutationDisabled = disabled || disableMutations
  const mutationDisabledTitle = disableMutations ? "Only Admins can edit products." : undefined

  return (
    <div className={cn("fixed inset-x-0 bottom-6 z-50 pointer-events-none px-4", className)}>
      <div
        className={cn(
          "pointer-events-auto mx-auto flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-xl",
          "md:flex-row md:items-center md:justify-between max-w-5xl"
        )}
        role="region"
        aria-label="Product bulk actions"
      >
        <div className="text-sm font-medium text-blue-900">
          {count} product{count === 1 ? '' : 's'} selected
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={mutationDisabled}
            title={mutationDisabledTitle}
            className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>Delete</span>
          </button>

          <button
            type="button"
            onClick={onExportCsv}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={onActivate}
            disabled={mutationDisabled}
            title={mutationDisabledTitle}
            className="inline-flex items-center gap-2 rounded-md border border-green-200 bg-white px-3 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 hover:text-green-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ToggleRight className="h-4 w-4" aria-hidden="true" />
            <span>Mark Active</span>
          </button>

          <button
            type="button"
            onClick={onDeactivate}
            disabled={mutationDisabled}
            title={mutationDisabledTitle}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ToggleLeft className="h-4 w-4" aria-hidden="true" />
            <span>Mark Inactive</span>
          </button>
        </div>
      </div>
    </div>
  )
}
