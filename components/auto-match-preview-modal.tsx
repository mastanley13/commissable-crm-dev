"use client"

import { Fragment } from "react"
import { cn } from "@/lib/utils"

export interface AutoMatchPreviewLine {
  lineId: string
  lineNumber: number | null
  accountName: string
  usage: number
  commission: number
  scheduleId: string
  scheduleName: string
  confidence: number
  reasons: string[]
}

export interface AutoMatchPreviewSummary {
  processed: number
  alreadyMatched: number
  fuzzyOnly: number
  noCandidates: number
  errors: number
  autoMatchCandidates: AutoMatchPreviewLine[]
}

interface AutoMatchPreviewModalProps {
  isOpen: boolean
  loading: boolean
  preview?: AutoMatchPreviewSummary | null
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
  confirmLoading?: boolean
}

export function AutoMatchPreviewModal({
  isOpen,
  loading,
  preview,
  error,
  onConfirm,
  onCancel,
  confirmLoading = false,
}: AutoMatchPreviewModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50" onClick={onCancel}>
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Run AI Matching</h2>
          <p className="mt-2 text-sm text-slate-600">
            Review the lines eligible for automatic matching. Only exact matches (Pass A) within the tenant variance tolerance will be applied.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>Preview auto-matches (Pass A exact) for the deposit.</li>
            <li>Apply auto-matches, then review fuzzy suggestions manually.</li>
            <li>Confirm allocations, then finalize the deposit.</li>
          </ol>
          {error ? (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {loading ? (
            <div className="mt-4 h-32 rounded-md border border-dashed border-slate-200 text-center text-sm text-slate-500">
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-primary-400" />
                Loading preview…
              </div>
            </div>
          ) : preview ? (
            <>
              <div className="mt-4 text-xs text-slate-600">
                Processed {preview.processed} lines · Already matched: {preview.alreadyMatched} · Eligible for auto-match: {preview.autoMatchCandidates.length} · Fuzzy-only: {preview.fuzzyOnly} · No candidates: {preview.noCandidates} · Errors: {preview.errors}
              </div>
              {preview.autoMatchCandidates.length ? (
                <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Line</th>
                        <th className="px-3 py-2 text-left">Account</th>
                        <th className="px-3 py-2 text-left">Usage</th>
                        <th className="px-3 py-2 text-left">Commission</th>
                        <th className="px-3 py-2 text-left">Schedule</th>
                        <th className="px-3 py-2 text-left">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.autoMatchCandidates.map(candidate => (
                        <tr key={candidate.lineId}>
                          <td className="px-3 py-2 text-slate-900">{candidate.lineNumber ?? "—"}</td>
                          <td className="px-3 py-2 text-slate-700">{candidate.accountName}</td>
                          <td className="px-3 py-2 text-slate-700">${candidate.usage.toFixed(2)}</td>
                          <td className="px-3 py-2 text-slate-700">${candidate.commission.toFixed(2)}</td>
                          <td className="px-3 py-2 text-slate-700">
                            <div className="font-medium text-slate-900">{candidate.scheduleName}</div>
                            {candidate.reasons.length ? (
                              <div className="text-xs text-slate-500">{candidate.reasons.slice(0, 2).join(" · ")}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 font-semibold text-primary-600">
                            {(candidate.confidence * 100).toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-4 rounded-md border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">
                  No lines qualify for automatic matching. Review fuzzy suggestions manually.
                </div>
              )}
            </>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed"
            disabled={loading || confirmLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || confirmLoading || !preview || !preview.autoMatchCandidates.length}
            className={cn(
              "rounded-full px-6 py-2 text-sm font-semibold text-white transition",
              loading || confirmLoading || !preview?.autoMatchCandidates.length
                ? "cursor-not-allowed bg-primary-200"
                : "bg-primary-600 hover:bg-primary-700",
            )}
          >
            {confirmLoading ? "Applying…" : "Apply matches"}
          </button>
        </div>
      </div>
    </div>
  )
}
