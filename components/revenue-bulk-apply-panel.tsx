"use client"

import { useEffect, useRef, useState } from "react"
import { Calendar, X } from "lucide-react"

interface RevenueBulkApplyPanelProps {
  isOpen: boolean
  selectedCount: number
  fieldLabel: string
  valueLabel: string
  initialEffectiveDate?: string | null
  onClose: () => void
  onSubmit: (effectiveDate: string) => Promise<void> | void
  isSubmitting?: boolean
  onBeforeSubmit?: () => void
  /**
   * Optional labels to describe the entities being updated.
   * Defaults to "schedule"/"schedules" for backward compatibility.
   */
  entityLabelSingular?: string
  entityLabelPlural?: string
}

export function RevenueBulkApplyPanel({
  isOpen,
  selectedCount,
  fieldLabel,
  valueLabel,
  initialEffectiveDate,
  onClose,
  onSubmit,
  isSubmitting = false,
  onBeforeSubmit,
  entityLabelSingular = "schedule",
  entityLabelPlural,
}: RevenueBulkApplyPanelProps) {
  const [effectiveDate, setEffectiveDate] = useState<string>("")
  const nativeDateInputRef = useRef<HTMLInputElement | null>(null)

  const pluralLabel = entityLabelPlural ?? `${entityLabelSingular}s`
  const effectiveEntityLabel = selectedCount === 1 ? entityLabelSingular : pluralLabel

  useEffect(() => {
    if (isOpen) {
      setEffectiveDate(initialEffectiveDate ?? "")
    }
  }, [initialEffectiveDate, isOpen])

  if (!isOpen) {
    return null
  }

  const handleSubmit = async () => {
    const trimmed = effectiveDate.trim()
    if (!trimmed || isSubmitting) {
      return
    }
    if (onBeforeSubmit) {
      onBeforeSubmit()
    }
    await onSubmit(trimmed)
  }

  const handleClose = () => {
    if (isSubmitting) return
    onClose()
  }

  const openNativePicker = () => {
    if (isSubmitting) return
    const input = nativeDateInputRef.current
    if (!input) return
    // Prefer showPicker when available (Chromium)
    const anyInput = input as any
    if (typeof anyInput.showPicker === "function") {
      anyInput.showPicker()
    } else {
      input.focus()
      input.click()
    }
  }

  const applyLabel =
    selectedCount > 0 ? `Apply to ${selectedCount} selected` : "Apply changes"

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex max-w-full pointer-events-none">
      <div className="pointer-events-auto flex h-full w-screen max-w-md flex-col border-l border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
              Bulk inline update
            </p>
            <h2 className="text-base font-semibold text-gray-900">
              {`Apply to selected ${pluralLabel}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close"
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <p className="font-semibold text-gray-900">
                {selectedCount.toLocaleString()} {effectiveEntityLabel} selected
              </p>
              <p className="mt-1 text-gray-600">
                You are updating <span className="font-medium">{fieldLabel}</span> to{" "}
                <span className="font-semibold text-gray-900">{valueLabel}</span> for all
                selected {pluralLabel}.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="revenue-bulk-effective-date"
                className="text-sm font-medium text-gray-700"
              >
                Effective from (YYYY-MM-DD)
              </label>
              <div className="relative">
                <input
                  id="revenue-bulk-effective-date"
                  type="text"
                  value={effectiveDate}
                  onChange={event => setEffectiveDate(event.target.value)}
                  placeholder="YYYY-MM-DD"
                  inputMode="numeric"
                  pattern="\d{4}-\d{2}-\d{2}"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={openNativePicker}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Open date picker"
                  disabled={isSubmitting}
                >
                  <Calendar className="h-4 w-4" />
                </button>
                <input
                  ref={nativeDateInputRef}
                  type="date"
                  className="sr-only"
                  value={effectiveDate}
                  onChange={event => setEffectiveDate(event.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-xs text-gray-500">
                Changes will apply starting with {pluralLabel} on or after this date.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !effectiveDate.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSubmitting ? "Applying..." : applyLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
