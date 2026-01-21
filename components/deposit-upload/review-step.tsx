"use client"


interface ReviewStepProps {
  csvHeaders: string[]
  sampleRows: string[][]
  fieldMapping: Record<string, string>
  validationIssues: string[]
  onBack: () => void
  onProceed: () => void
}

export function ReviewStep({ csvHeaders, sampleRows, fieldMapping, validationIssues, onBack, onProceed }: ReviewStepProps) {
  const hasPreview = csvHeaders.length > 0 && sampleRows.length > 0
  const canProceed = validationIssues.length === 0 && hasPreview && Object.keys(fieldMapping).length > 0

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Review</h2>
        <p className="text-sm text-gray-600">Confirm mappings and spot-check parsed rows before you import.</p>
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
        <p className="text-sm font-semibold text-gray-900">Sample rows</p>
        {hasPreview ? (
          <div className="mt-2 overflow-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  {csvHeaders.map(header => (
                    <th key={header} className="px-3 py-2 font-semibold uppercase tracking-wide">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {sampleRows.slice(0, 5).map((row, index) => (
                  <tr key={`row-${index}`}>
                    {row.map((value, cellIndex) => (
                      <td key={`${index}-${cellIndex}`} className="px-3 py-2">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">Sample data preview will appear once parsing is wired up.</p>
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

      <div className="flex items-center justify-end border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onProceed}
          disabled={!canProceed}
          className="inline-flex items-center rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Continue to Confirm
        </button>
      </div>
    </div>
  )
}
