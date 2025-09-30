"use client"

import { useEffect, useState } from "react"
import { Check, X } from "lucide-react"

interface ContactBulkStatusModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (isPrimary: boolean) => Promise<void> | void
  isSubmitting?: boolean
}

export function ContactBulkStatusModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false
}: ContactBulkStatusModalProps) {
  const [status, setStatus] = useState<'active' | 'inactive'>('active')

  useEffect(() => {
    if (isOpen) {
      setStatus('active')
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const handleSubmit = async () => {
    await onSubmit(status === 'active')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Update Status</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-gray-600">
            Choose how the selected contacts should appear in the list. This updates the Active toggle for each record.
          </p>

          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50">
              <input
                type="radio"
                name="bulk-status"
                value="active"
                checked={status === 'active'}
                onChange={() => setStatus('active')}
                disabled={isSubmitting}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <Check className="h-4 w-4 text-green-500" />
                  Mark as Active
                </div>
                <p className="text-xs text-gray-500">Set the Active toggle to on for all selected contacts.</p>
              </div>
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50">
              <input
                type="radio"
                name="bulk-status"
                value="inactive"
                checked={status === 'inactive'}
                onChange={() => setStatus('inactive')}
                disabled={isSubmitting}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <X className="h-4 w-4 text-red-500" />
                  Mark as Inactive
                </div>
                <p className="text-xs text-gray-500">Set the Active toggle to off for all selected contacts.</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSubmitting ? "Updating..." : "Apply Status"}
          </button>
        </div>
      </div>
    </div>
  )
}

