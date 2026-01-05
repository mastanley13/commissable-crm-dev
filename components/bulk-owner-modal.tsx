"use client"

import { useEffect, useState } from "react"

export interface BulkOwnerOption {
  value: string
  label: string
}

interface BulkOwnerModalProps {
  isOpen: boolean
  owners: BulkOwnerOption[]
  entityLabel?: string
  isLoading?: boolean
  isSubmitting?: boolean
  onClose: () => void
  onSubmit: (ownerId: string | null) => Promise<void> | void
}

const UNASSIGNED_VALUE = "__unassigned__"

export function BulkOwnerModal({
  isOpen,
  owners,
  entityLabel,
  isLoading = false,
  isSubmitting = false,
  onClose,
  onSubmit
}: BulkOwnerModalProps) {
  const [selectedOwner, setSelectedOwner] = useState<string>("")

  useEffect(() => {
    if (isOpen) {
      setSelectedOwner("")
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const selectionLabel = entityLabel ? `selected ${entityLabel}` : "selected items"

  const handleSubmit = async () => {
    const normalized = selectedOwner === UNASSIGNED_VALUE ? null : selectedOwner || null
    await onSubmit(normalized)
  }

  const canSubmit = !isSubmitting && !isLoading && selectedOwner !== ""

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Change Owner</h2>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-gray-600">
            Select a new owner for the {selectionLabel}. All chosen records will be updated immediately.
          </p>

          <div className="mt-4 space-y-2">
            <label htmlFor="bulk-owner-select" className="text-sm font-medium text-gray-700">
              New owner
            </label>
            <select
              id="bulk-owner-select"
              value={selectedOwner}
              onChange={event => setSelectedOwner(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isSubmitting || isLoading || owners.length === 0}
            >
              <option value="">Select owner...</option>
              <option value={UNASSIGNED_VALUE}>Unassigned</option>
              {owners.map(owner => (
                <option key={owner.value} value={owner.value}>
                  {owner.label}
                </option>
              ))}
            </select>
            {isLoading && (
              <p className="text-xs text-gray-500">Loading active owners...</p>
            )}
            {!isLoading && owners.length === 0 && (
              <p className="text-xs text-gray-500">No active owners available.</p>
            )}
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
            disabled={!canSubmit}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSubmitting ? "Updating..." : "Update Owner"}
          </button>
        </div>
      </div>
    </div>
  )
}
