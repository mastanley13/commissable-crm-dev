"use client"

import { useEffect, useState } from "react"
import { FileSpreadsheet, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"
import { depositFieldDefinitions, requiredDepositFieldIds } from "@/lib/deposit-import/fields"
import {
  getColumnSelection,
  type DepositMappingConfigV1,
  type DepositColumnSelection,
  type DepositCustomFieldSection,
} from "@/lib/deposit-import/template-mapping"

const PREVIEW_PAGE_SIZE = 3

interface MapFieldsStepProps {
  file: File | null
  csvHeaders: string[]
  sampleRows: string[][]
  mapping: DepositMappingConfigV1
  parsingError: string | null
  onColumnSelectionChange: (columnName: string, selection: DepositColumnSelection) => void
  onCreateCustomField: (columnName: string, input: { label: string; section: DepositCustomFieldSection }) => void
  canProceed: boolean
  onBack: () => void
  onProceed: () => void
}

export function MapFieldsStep({
  file,
  csvHeaders,
  sampleRows,
  mapping,
  parsingError,
  onColumnSelectionChange,
  onCreateCustomField,
  canProceed,
  onBack,
  onProceed,
}: MapFieldsStepProps) {
  const [previewRowIndex, setPreviewRowIndex] = useState(0)

  useEffect(() => {
    setPreviewRowIndex(0)
  }, [sampleRows.length])

  const totalPreviewRows = sampleRows.length
  const effectiveIndex =
    totalPreviewRows === 0 ? 0 : Math.min(previewRowIndex, Math.max(0, totalPreviewRows - 1))
  const windowStart = effectiveIndex
  const windowEndExclusive =
    totalPreviewRows === 0 ? 0 : Math.min(totalPreviewRows, windowStart + PREVIEW_PAGE_SIZE)
  const previewWindow = sampleRows.slice(windowStart, windowEndExclusive)
  const isFirstWindow = windowStart === 0
  const isLastWindow = windowEndExclusive >= totalPreviewRows

  const canonicalFieldMapping: Record<string, string> = Object.entries(mapping.line ?? {}).reduce(
    (acc, [fieldId, columnName]) => {
      if (typeof columnName === "string" && columnName.trim()) {
        acc[fieldId] = columnName
      }
      return acc
    },
    {} as Record<string, string>,
  )

  const missingRequired = requiredDepositFieldIds.filter(fieldId => !canonicalFieldMapping[fieldId])

  const handleCreateCustomFieldClick = (columnName: string, section: DepositCustomFieldSection) => {
    const label = window.prompt("Enter a label for this custom field:")?.trim()
    if (!label) return
    onCreateCustomField(columnName, { label, section })
  }

  const goToPreviousRow = () => {
    setPreviewRowIndex(previous => {
      if (totalPreviewRows === 0) return previous
      const next = previous - PREVIEW_PAGE_SIZE
      return next > 0 ? next : 0
    })
  }

  const goToNextRow = () => {
    setPreviewRowIndex(previous => {
      if (totalPreviewRows === 0) return previous
      const next = previous + PREVIEW_PAGE_SIZE
      if (next >= totalPreviewRows) {
        return previous
      }
      return next
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-primary-50 p-3 text-primary-600">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Map Fields</h2>
          <p className="text-sm text-gray-600">
            Match columns from your upload to Commissable fields.
          </p>
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
                <p className="text-xs text-gray-500">
                  Select a CSV/XLS file with a header row to begin mapping.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-gray-500">
              No file selected. Return to Create Deposit to attach a file.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">Mapping guidance</p>
          <p className="mt-2 text-xs text-gray-600">
            Map required fields like Usage and Commission to columns from your uploaded file.
            Optional fields can be left unmapped. These mappings apply to this upload only;
            template-based mappings are not used in this version of the wizard.
          </p>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Uploaded columns</p>
              <p className="mt-1 text-xs text-gray-600">
                Review sample data and map each column from your file to a Commissable field.
              </p>
            </div>
            {totalPreviewRows > 0 ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600">
                <button
                  type="button"
                  onClick={goToPreviousRow}
                  disabled={isFirstWindow}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 disabled:border-gray-200 disabled:text-gray-300"
                  aria-label="Previous sample row"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="min-w-[120px] text-center">
                  Rows {windowStart + 1}-{windowEndExclusive} of {totalPreviewRows}
                </span>
                <button
                  type="button"
                  onClick={goToNextRow}
                  disabled={isLastWindow}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 disabled:border-gray-200 disabled:text-gray-300"
                  aria-label="Next sample row"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-3 rounded-lg border border-gray-200 text-sm text-gray-700">
            <div className="hidden border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_120px_minmax(0,1.7fr)]">
              <div>Field label in file</div>
              <div>Preview information</div>
              <div>Status</div>
              <div>Map to Commissable field</div>
            </div>

            <div className="divide-y divide-gray-200">
              {csvHeaders.map((header, index) => {
                const previewValues = previewWindow
                  .map(row => row[index] ?? "")
                  .filter(value => typeof value === "string" && value.trim().length > 0)
                const selection = getColumnSelection(mapping, header)
                const customDefinition =
                  selection.type === "custom" ? mapping.customFields[selection.customKey] : undefined

                let selectValue: string
                if (selection.type === "canonical") {
                  selectValue = `canonical:${selection.fieldId}`
                } else if (selection.type === "product") {
                  selectValue = "product"
                } else if (selection.type === "ignore") {
                  selectValue = "ignore"
                } else if (selection.type === "custom") {
                  selectValue = "custom"
                } else {
                  selectValue = "additional"
                }

                const handleSelectChange = (value: string) => {
                  if (value === "additional") {
                    onColumnSelectionChange(header, { type: "additional" })
                    return
                  }
                  if (value === "product") {
                    onColumnSelectionChange(header, { type: "product" })
                    return
                  }
                  if (value === "ignore") {
                    onColumnSelectionChange(header, { type: "ignore" })
                    return
                  }
                  if (value.startsWith("canonical:")) {
                    const fieldId = value.slice("canonical:".length) as (typeof depositFieldDefinitions)[number]["id"]
                    onColumnSelectionChange(header, { type: "canonical", fieldId })
                    return
                  }
                  // "custom" is handled via the Create custom field actions.
                }

                const mappedField =
                  selection.type === "canonical"
                    ? depositFieldDefinitions.find(field => field.id === selection.fieldId)
                    : undefined

                let statusLabel = "Unmapped"
                let statusClass = "border-gray-200 bg-gray-50 text-gray-600"

                if (selection.type === "canonical") {
                  statusLabel = mappedField?.required ? "Required mapped" : "Mapped"
                  statusClass = "border-emerald-300 bg-emerald-50 text-emerald-700"
                } else if (selection.type === "custom") {
                  statusLabel = "Custom field"
                  statusClass = "border-sky-300 bg-sky-50 text-sky-700"
                } else if (selection.type === "product") {
                  statusLabel = "Product info"
                  statusClass = "border-indigo-300 bg-indigo-50 text-indigo-700"
                } else if (selection.type === "ignore") {
                  statusLabel = "Ignored"
                  statusClass = "border-gray-200 bg-gray-50 text-gray-500"
                } else if (selection.type === "additional") {
                  statusLabel = "Additional info"
                  statusClass = "border-gray-200 bg-gray-50 text-gray-600"
                }

                const columnName = header || "(unnamed column)"

                return (
                  <div
                    key={`${header}-${index}`}
                    className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_120px_minmax(0,1.7fr)] md:items-start"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">
                        Field label in file
                      </p>
                      <p className="text-sm font-semibold text-gray-900 break-words">{columnName}</p>
                    </div>

                    <div className="space-y-0.5 text-xs text-gray-600">
                      <p className="font-semibold uppercase tracking-wide text-gray-500 md:hidden">
                        Preview information
                      </p>
                      {previewValues.length > 0 ? (
                        previewValues.map((value, valueIndex) => (
                          <p
                            key={`${header}-preview-${valueIndex}`}
                            className={valueIndex === 0 ? "truncate" : "truncate text-gray-500"}
                            title={value}
                          >
                            {value}
                          </p>
                        ))
                      ) : (
                        <p className="text-gray-400">No sample values in these rows.</p>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">
                        Status
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">
                        Map to Commissable field
                      </p>
                      <select
                        value={selectValue}
                        disabled={csvHeaders.length === 0}
                        onChange={event => handleSelectChange(event.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none disabled:bg-gray-100"
                      >
                        <option value="additional">Additional info (no specific field)</option>
                        <option value="product">Product info column</option>
                        <option value="ignore">Ignore this column</option>
                        <optgroup label="Map to Commissable field">
                          {depositFieldDefinitions.map(field => (
                            <option key={field.id} value={`canonical:${field.id}`}>
                              {field.label}
                              {field.required ? " (Required)" : ""}
                            </option>
                          ))}
                        </optgroup>
                        {customDefinition ? (
                          <optgroup label="Custom field">
                            <option value="custom">
                              {customDefinition.label} –{" "}
                              {customDefinition.section === "product" ? "Product" : "Additional"} info
                            </option>
                          </optgroup>
                        ) : null}
                      </select>

                      {!customDefinition ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                            onClick={() => handleCreateCustomFieldClick(header, "additional")}
                          >
                            Create custom field (Additional)
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                            onClick={() => handleCreateCustomFieldClick(header, "product")}
                          >
                            Create custom field (Product)
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-600">
                          This column is mapped to a custom{" "}
                          {customDefinition.section === "product"
                            ? "Product Information"
                            : "Additional Information"}{" "}
                          field: <span className="font-semibold">{customDefinition.label}</span>.
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      {missingRequired.length > 0 ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>
            <p className="font-semibold">Required fields pending</p>
            <p className="text-xs">
              Map the following fields before continuing:{" "}
              {missingRequired
                .map(fieldId => depositFieldDefinitions.find(field => field.id === fieldId)?.label || fieldId)
                .join(", ")}
              .
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
          Back to Create Deposit
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
