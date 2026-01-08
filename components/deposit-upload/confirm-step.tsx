"use client"

import Link from "next/link"

interface ConfirmStepProps {
  importSummary: {
    totalRows: number
    mappedFields: number
  } | null
  submitting: boolean
  error: string | null
  result: { depositId: string } | null
  onBack: () => void
  onSubmit: () => void
}

export function ConfirmStep({ importSummary, submitting, error, result, onBack, onSubmit }: ConfirmStepProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Confirm Import</h2>
        <p className="text-sm text-gray-600">Review the summary below, then start the import.</p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
        {importSummary ? (
          <ul className="space-y-1">
            <li>
              <span className="font-semibold text-gray-900">Rows detected:</span> {importSummary.totalRows}
            </li>
            <li>
              <span className="font-semibold text-gray-900">Mapped fields:</span> {importSummary.mappedFields}
            </li>
          </ul>
        ) : (
          <p className="text-gray-600">Import summary will appear here once the Review step is complete.</p>
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

      <div className="flex items-center justify-end border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !importSummary}
          className="inline-flex items-center rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {submitting ? "Importing..." : "Start Import"}
        </button>
      </div>
    </div>
  )
}
