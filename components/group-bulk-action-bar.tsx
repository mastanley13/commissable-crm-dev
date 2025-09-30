"use client"

import { Download, Trash2, UserCog, ToggleLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface GroupBulkActionBarProps {
  count: number
  disabled?: boolean
  onSoftDelete: () => void
  onExportCsv: () => void
  onChangeOwner: () => void
  onUpdateStatus: () => void
  className?: string
}

export function GroupBulkActionBar({
  count,
  disabled = false,
  onSoftDelete,
  onExportCsv,
  onChangeOwner,
  onUpdateStatus,
  className
}: GroupBulkActionBarProps) {
  if (count <= 0) {
    return null
  }

  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm",
        "md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div className="text-sm font-medium text-blue-900">
        {count} group{count === 1 ? "" : "s"} selected
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSoftDelete}
          disabled={disabled}
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
          onClick={onChangeOwner}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UserCog className="h-4 w-4" aria-hidden="true" />
          <span>Change Owner</span>
        </button>

        <button
          type="button"
          onClick={onUpdateStatus}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ToggleLeft className="h-4 w-4" aria-hidden="true" />
          <span>Update Status</span>
        </button>
      </div>
    </div>
  )
}


