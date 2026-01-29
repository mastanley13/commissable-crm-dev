"use client"

import Link from "next/link"

interface ReviewStepProps {
  fieldMapping: Record<string, string>
  validationIssues: string[]
  totalRows: number
  mappedFields: number
  submitting: boolean
  error: string | null
  result: { depositId: string } | null
  onSubmit: () => void
}

export function ReviewStep({
  fieldMapping,
  validationIssues,
  totalRows,
  mappedFields,
  submitting,
  error,
  result,
  onSubmit
}: ReviewStepProps) {
  const blockedReasons: string[] = []
  if (result) blockedReasons.push("Import already completed.")
  if (submitting) blockedReasons.push("Import is already in progress.")
  if (!Number.isFinite(totalRows) || totalRows <= 0) blockedReasons.push("No rows detected from the uploaded file.")
  if (!Number.isFinite(mappedFields) || mappedFields <= 0) blockedReasons.push("No mapped fields selected.")
  if (validationIssues.length > 0) blockedReasons.push("Resolve the validation issues before importing.")

  const canStartImport = blockedReasons.length === 0

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Review</h2>
          <p className="text-sm text-gray-600">Confirm mappings and spot-check parsed rows before you import.</p>
        </div>
        <div className="flex flex-row gap-3 sm:flex-col sm:items-end sm:gap-1 text-sm text-gray-600">
          <div>
            <span className="font-semibold text-gray-900">{Number.isFinite(totalRows) ? totalRows : 0}</span>{" "}
            <span>Rows detected</span>
          </div>
          <div>
            <span className="font-semibold text-gray-900">{Number.isFinite(mappedFields) ? mappedFields : 0}</span>{" "}
            <span>Mapped fields</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <p className="text-sm font-semibold text-gray-900">Mapping summary</p>
        {Object.keys(fieldMapping).length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Mapping is not ready yet. Return to Map Fields to complete it.</p>
        ) : (
          <ul className="mt-3 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
            {Object.entries(fieldMapping).map(([field, column]) => (
              <li key={field} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <span className="font-semibold">{field}</span>
                <span className="text-gray-500"> - {column}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <p className="text-sm font-semibold text-gray-900">Validation</p>
        {validationIssues.length === 0 ? (
          <p className="mt-2 text-sm text-green-600">No blocking issues detected.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-600">
            {validationIssues.map(issue => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {result ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 space-y-2">
          <p className="font-semibold">Import completed</p>
          <p>
            Deposit created successfully.{" "}
            <Link href={`/reconciliation/${result.depositId}`} className="underline font-semibold">
              View deposit detail
            </Link>
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          This step will create a deposit, deposit line items, and a reconciliation import job.
        </div>
      )}

      {!canStartImport && blockedReasons.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold">Cannot start import</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {blockedReasons.map(reason => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center justify-end border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canStartImport}
          className="inline-flex items-center rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {submitting ? "Importing..." : "Start Import"}
        </button>
      </div>
    </div>
  )
}
