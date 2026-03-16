"use client"

import { ModalHeader } from "./ui/modal-header"

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  error?: string | null
}

export function ConfirmDialog({
  isOpen,
  title,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  error
}: ConfirmDialogProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50">
      <div
        className="w-full max-w-md rounded-t-xl rounded-b-none bg-white shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <ModalHeader kicker="Confirm" title={title} variant="gradient" />
        {error ? (
          <div className="px-6 py-4">
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-w-[88px] items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex min-w-[96px] items-center justify-center rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {loading ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
