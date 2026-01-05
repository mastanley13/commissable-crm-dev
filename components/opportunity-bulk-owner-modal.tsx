"use client"

import { useEffect, useState } from "react"

interface OwnerOption {
  value: string
  label: string
}

interface OpportunityBulkOwnerModalProps {
  isOpen: boolean
  owners: OwnerOption[]
  onClose: () => void
  onSubmit: (ownerId: string | null) => Promise<void> | void
  isSubmitting?: boolean
}

const UNASSIGNED_VALUE = "__unassigned__"

export function OpportunityBulkOwnerModal({
  isOpen,
  owners,
  onClose,
  onSubmit,
  isSubmitting = false
}: OpportunityBulkOwnerModalProps) {
  const [selectedOwner, setSelectedOwner] = useState<string>("")

  useEffect(() => {
    if (isOpen) {
      setSelectedOwner("")
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const handleSubmit = async () => {
    const value = selectedOwner === UNASSIGNED_VALUE ? null : selectedOwner || null
    await onSubmit(value)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Change Owner</h2>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-gray-600">
            Select a new owner for the selected opportunities. All chosen records will be updated immediately.
          </p>

          <div className="mt-4 space-y-2">
            <label htmlFor="bulk-opportunity-owner" className="text-sm font-medium text-gray-700">
              New owner
            </label>
            <select
              id="bulk-opportunity-owner"
              value={selectedOwner}
              onChange={event => setSelectedOwner(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isSubmitting}
            >
              <option value="">Select owner...</option>
              <option value={UNASSIGNED_VALUE}>Unassigned</option>
              {owners.map(owner => (
                <option key={owner.value} value={owner.value}>
                  {owner.label}
                </option>
              ))}
            </select>
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
            disabled={isSubmitting || selectedOwner === ""}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSubmitting ? "Updating..." : "Update Owner"}
          </button>
        </div>
      </div>
    </div>
  )
}
