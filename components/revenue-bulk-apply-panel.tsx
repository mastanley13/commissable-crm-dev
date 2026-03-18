"use client"

interface RevenueBulkApplyPanelProps {
  isOpen: boolean
  selectedCount: number
  fieldLabel: string
  valueLabel: string
  previousValueLabel?: string
  containerClassName?: string
  onClose: () => void
  onSubmit: () => Promise<void> | void
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
  previousValueLabel,
  containerClassName,
  onClose,
  onSubmit,
  isSubmitting = false,
  onBeforeSubmit,
  entityLabelSingular = "schedule",
  entityLabelPlural,
}: RevenueBulkApplyPanelProps) {
  const pluralLabel = entityLabelPlural ?? `${entityLabelSingular}s`
  const effectiveEntityLabel = selectedCount === 1 ? entityLabelSingular : pluralLabel

  if (!isOpen) {
    return null
  }

  const handleSubmit = async () => {
    if (isSubmitting || selectedCount < 1) {
      return
    }
    if (onBeforeSubmit) {
      onBeforeSubmit()
    }
    await onSubmit()
  }

  const handleClose = () => {
    if (isSubmitting) return
    onClose()
  }

  const applyLabel =
    selectedCount > 0 ? `Apply to ${selectedCount} selected` : "Apply changes"

  return (
    <div className={`fixed inset-y-0 right-0 z-40 flex max-w-full pointer-events-none ${containerClassName ?? ""}`}>
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

             {previousValueLabel ? (
               <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
                 <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                   Old vs new
                 </p>
                 <p className="mt-1 text-sm text-gray-700">
                   <span className="font-medium text-gray-800">{fieldLabel}:</span>{" "}
                   <span className="font-semibold text-gray-900">{previousValueLabel}</span>{" "}
                   <span className="text-gray-500">-&gt;</span>{" "}
                   <span className="font-semibold text-blue-700">{valueLabel}</span>
                 </p>
               </div>
             ) : null}

             <p className="text-xs text-gray-500">
               Changes apply to all selected {pluralLabel}.
             </p>
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
             disabled={isSubmitting || selectedCount < 1}
             className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
           >
             {isSubmitting ? "Applying..." : applyLabel}
           </button>
         </div>
      </div>
    </div>
  )
}
