"use client"

import { FileSpreadsheet, AlertTriangle } from "lucide-react"
import type { TemplateDetail } from "@/components/deposit-upload/types"
import { depositFieldDefinitions, requiredDepositFieldIds } from "@/lib/deposit-import/fields"

interface MapFieldsStepProps {
  file: File | null
  csvHeaders: string[]
  sampleRows: string[][]
  fieldMapping: Record<string, string>
  templateDetails: TemplateDetail | null
  templateDetailsLoading: boolean
  templateDetailsError: string | null
  parsingError: string | null
  onFieldMappingChange: (fieldId: string, columnName: string | null) => void
  canProceed: boolean
  onBack: () => void
  onProceed: () => void
}

export function MapFieldsStep({
  file,
  csvHeaders,
  sampleRows,
  fieldMapping,
  templateDetails,
  templateDetailsLoading,
  templateDetailsError,
  parsingError,
  onFieldMappingChange,
  canProceed,
  onBack,
  onProceed,
}: MapFieldsStepProps) {
  const columnPreview = csvHeaders.map((header, index) => ({
    header,
    preview: sampleRows[0]?.[index] ?? "",
  }))

  const missingRequired = requiredDepositFieldIds.filter(fieldId => !fieldMapping[fieldId])

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-primary-50 p-3 text-primary-600">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Map Fields</h2>
          <p className="text-sm text-gray-600">Match columns from your upload to Commissable fields.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">Uploaded file</p>
          {file ? (
            <div className="mt-2 space-y-1 text-gray-600">
              <p>{file.name}</p>
              <p className="text-xs text-gray-500">Columns detected: {csvHeaders.length || "0"}</p>
              {parsingError ? (
                <p className="text-xs text-red-600">{parsingError}</p>
              ) : csvHeaders.length === 0 ? (
                <p className="text-xs text-gray-500">Select a CSV/XLS file with a header row to begin mapping.</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-gray-500">No file selected. Return to Create Template to attach a file.</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">Loaded Template</p>
          {templateDetailsLoading ? (
            <p className="mt-2 text-sm text-gray-500">Fetching template configuration...</p>
          ) : templateDetails ? (
            <div className="mt-2 space-y-1">
              <p>
                {templateDetails.name} - {templateDetails.distributorName} / {templateDetails.vendorName}
              </p>
              {templateDetails.config && Object.keys(templateDetails.config).length > 0 ? (
                <pre className="max-h-32 overflow-auto rounded bg-white/60 p-2 text-[11px] text-gray-700">
                  {JSON.stringify(templateDetails.config, null, 2)}
                </pre>
              ) : (
                <p className="text-xs text-gray-500">No saved mapping yet. Changes will be saved on import.</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">{templateDetailsError || "Select a template to preload saved mapping settings."}</p>
          )}
        </div>
      </div>

      {parsingError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to read file</p>
            <p>{parsingError}</p>
          </div>
        </div>
      ) : null}

      {csvHeaders.length > 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900">Columns detected</p>
          <div className="mt-3 grid gap-3 text-sm text-gray-700 md:grid-cols-2">
            {columnPreview.map((column, index) => (
              <div key={`${column.header}-${index}`} className="rounded-lg border border-gray-200 p-3">
                <p className="font-semibold">{column.header || "(unnamed column)"}</p>
                {column.preview ? <p className="text-xs text-gray-500 truncate">{column.preview}</p> : <p className="text-xs text-gray-400">No sample value</p>}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <p className="text-sm font-semibold text-gray-900">Map to Commissable fields</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {depositFieldDefinitions.map(field => {
            const mappedColumn = fieldMapping[field.id] ?? ""
            const hasError = field.required && !mappedColumn
            return (
              <div
                key={field.id}
                className={`rounded-lg border p-3 ${hasError ? "border-red-200 bg-red-50/60" : "border-gray-200 bg-gray-50"}`}
              >
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  {field.label}
                  {field.required ? <span className="text-xs font-normal text-red-600">Required</span> : null}
                </p>
                {field.description ? <p className="text-xs text-gray-500 mt-0.5">{field.description}</p> : null}
                <select
                  value={mappedColumn}
                  disabled={csvHeaders.length === 0}
                  onChange={event => onFieldMappingChange(field.id, event.target.value || null)}
                  className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none disabled:bg-gray-100"
                >
                  <option value="">Not mapped</option>
                  {csvHeaders.map((header, index) => (
                    <option key={`${header}-${index}`} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      </div>

      {missingRequired.length > 0 ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>
            <p className="font-semibold">Required fields pending</p>
            <p className="text-xs">
              Map the following fields before continuing: {missingRequired.map(fieldId => depositFieldDefinitions.find(field => field.id === fieldId)?.label || fieldId).join(", ")}.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Back to Template
        </button>
        <button
          type="button"
          onClick={onProceed}
          disabled={!canProceed}
          className="inline-flex items-center rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Continue to Review
        </button>
      </div>
    </div>
  )
}
