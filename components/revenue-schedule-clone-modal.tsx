"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface RevenueScheduleCloneModalProps {
  isOpen: boolean
  defaultDate?: string
  submitting?: boolean
  onConfirm: (effectiveDate: string) => void
  onCancel: () => void
}

export function RevenueScheduleCloneModal({
  isOpen,
  defaultDate = "",
  submitting = false,
  onConfirm,
  onCancel,
}: RevenueScheduleCloneModalProps) {
  const [effectiveDate, setEffectiveDate] = useState(defaultDate)

  useEffect(() => {
    if (isOpen) {
      setEffectiveDate(defaultDate)
    }
  }, [defaultDate, isOpen])

  if (!isOpen) {
    return null
  }

  const disabled = !effectiveDate || submitting

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Clone Revenue Schedule</h2>
            <p className="text-sm text-gray-600">
              Confirm the clone action and update the effective date if needed.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-600" htmlFor="clone-effective-date">
          Effective Date
        </label>
        <input
          id="clone-effective-date"
          type="date"
          className={cn(
            "mb-6 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500",
            !effectiveDate && "text-gray-400"
          )}
          value={effectiveDate}
          onChange={(event) => setEffectiveDate(event.target.value)}
          disabled={submitting}
        />

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={() => onConfirm(effectiveDate)}
            disabled={disabled}
          >
            {submitting ? "Cloning…" : "Clone Schedule"}
          </button>
        </div>
      </div>
    </div>
  )
}
