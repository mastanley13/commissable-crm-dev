"use client"

import { useCallback, useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Upload
} from "lucide-react"
import { parseSpreadsheetFile } from "@/lib/deposit-import/parse-file"
import {
  DATA_IMPORT_ENTITIES,
  getDataImportEntityDefinition,
  type DataImportEntityType
} from "@/lib/data-import/catalog"

type WizardStep = "upload" | "mapping" | "review"

type FieldMapping = Record<string, string>

interface ImportError {
  rowNumber: number
  field: string
  errorType: "validation" | "business_rule" | "system"
  message: string
}

interface ImportResult {
  totalRows: number
  successRows: number
  skippedRows: number
  errorRows: number
  errors: ImportError[]
}

function toCsvLine(values: string[]) {
  return values
    .map(value => {
      const escaped = value.replaceAll('"', '""')
      return `"${escaped}"`
    })
    .join(",")
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (["true", "1", "yes", "y"].includes(normalized)) return true
  if (["false", "0", "no", "n"].includes(normalized)) return false
  return null
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error"
}

function buildAutoMapping(
  csvHeaders: string[],
  entityType: DataImportEntityType
): FieldMapping {
  const definition = getDataImportEntityDefinition(entityType)
  if (!definition) {
    return {}
  }

  const aliasToField = new Map<string, string>()
  for (const field of definition.fields) {
    const keys = [field.id, field.label, ...(field.aliases ?? [])]
    for (const key of keys) {
      aliasToField.set(normalizeKey(key), field.id)
    }
  }

  const usedFields = new Set<string>()
  const mapping: FieldMapping = {}
  for (const header of csvHeaders) {
    const candidate = aliasToField.get(normalizeKey(header))
    if (!candidate || usedFields.has(candidate)) {
      continue
    }
    mapping[header] = candidate
    usedFields.add(candidate)
  }

  return mapping
}

function buildRowObjects(csvHeaders: string[], csvRows: string[][]): Array<Record<string, string>> {
  return csvRows.map(row => {
    const next: Record<string, string> = {}
    csvHeaders.forEach((header, index) => {
      next[header] = typeof row[index] === "string" ? row[index] : String(row[index] ?? "")
    })
    return next
  })
}

export function DataSettingsImportsSection() {
  const [entityType, setEntityType] = useState<DataImportEntityType>("accounts")
  const [step, setStep] = useState<WizardStep>("upload")
  const [upsertExisting, setUpsertExisting] = useState(true)
  const [previewRowIndex, setPreviewRowIndex] = useState(0)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({})
  const [parseError, setParseError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const entityDefinition = useMemo(() => getDataImportEntityDefinition(entityType), [entityType])
  const rowObjects = useMemo(() => buildRowObjects(csvHeaders, csvRows), [csvHeaders, csvRows])
  const totalPreviewRows = csvRows.length
  const effectivePreviewRowIndex =
    totalPreviewRows === 0 ? 0 : Math.min(previewRowIndex, Math.max(0, totalPreviewRows - 1))
  const sampleRow = csvRows[effectivePreviewRowIndex] ?? []
  const supportsUpsertToggle = entityType !== "revenue-schedules"

  const requiredFields = useMemo(
    () => (entityDefinition ? entityDefinition.fields.filter(field => field.required) : []),
    [entityDefinition]
  )

  const missingRequiredMappings = useMemo(() => {
    const mappedFieldIds = new Set(Object.values(fieldMapping).filter(Boolean))
    return requiredFields.filter(field => !mappedFieldIds.has(field.id))
  }, [fieldMapping, requiredFields])

  const mappedHeaders = useMemo(
    () => csvHeaders.filter(header => Boolean(fieldMapping[header])),
    [csvHeaders, fieldMapping]
  )

  const requiredColumnsByField = useMemo(() => {
    const next = new Map<string, string>()
    for (const [header, fieldId] of Object.entries(fieldMapping)) {
      if (fieldId) {
        next.set(fieldId, header)
      }
    }
    return next
  }, [fieldMapping])

  const requiredValueWarnings = useMemo(() => {
    return requiredFields
      .map(field => {
        const mappedHeader = requiredColumnsByField.get(field.id)
        if (!mappedHeader) {
          return null
        }

        const missingCount = rowObjects.reduce((count, row) => {
          const value = row[mappedHeader] ?? ""
          return value.trim().length === 0 ? count + 1 : count
        }, 0)

        if (missingCount === 0) {
          return null
        }

        return `${field.label}: ${missingCount} row(s) are blank`
      })
      .filter((message): message is string => Boolean(message))
  }, [requiredColumnsByField, requiredFields, rowObjects])

  const handleFileSelected = useCallback(
    async (file: File | null) => {
      setParseError(null)
      setImportResult(null)
      setSubmitError(null)

      if (!file) {
        setSelectedFileName(null)
        setCsvHeaders([])
        setCsvRows([])
        setFieldMapping({})
        setStep("upload")
        return
      }

      setIsParsing(true)
      try {
        const parsed = await parseSpreadsheetFile(file, file.name, file.type)
        setSelectedFileName(file.name)
        setCsvHeaders(parsed.headers)
        setCsvRows(parsed.rows)
        setPreviewRowIndex(0)
        setFieldMapping(buildAutoMapping(parsed.headers, entityType))
      } catch (error) {
        setParseError(readErrorMessage(error))
        setSelectedFileName(file.name)
        setCsvHeaders([])
        setCsvRows([])
        setPreviewRowIndex(0)
        setFieldMapping({})
      } finally {
        setIsParsing(false)
      }
    },
    [entityType]
  )

  const handleEntityChange = useCallback((nextType: DataImportEntityType) => {
    setEntityType(nextType)
    setStep("upload")
    setUpsertExisting(true)
    setPreviewRowIndex(0)
    setSelectedFileName(null)
    setCsvHeaders([])
    setCsvRows([])
    setFieldMapping({})
    setParseError(null)
    setSubmitError(null)
    setImportResult(null)
  }, [])

  const handleMappingChange = useCallback((header: string, nextFieldId: string) => {
    setFieldMapping(previous => {
      const next: FieldMapping = { ...previous }
      if (!nextFieldId) {
        delete next[header]
        return next
      }

      for (const [columnHeader, mappedField] of Object.entries(next)) {
        if (columnHeader !== header && mappedField === nextFieldId) {
          delete next[columnHeader]
        }
      }

      next[header] = nextFieldId
      return next
    })
  }, [])

  const previewRangeLabel =
    totalPreviewRows === 0
      ? "No rows"
      : `Row ${effectivePreviewRowIndex + 1} of ${totalPreviewRows}`

  const goToPreviousRow = useCallback(() => {
    setPreviewRowIndex(previous => {
      if (totalPreviewRows === 0) return previous
      const next = previous - 1
      return next > 0 ? next : 0
    })
  }, [totalPreviewRows])

  const goToNextRow = useCallback(() => {
    setPreviewRowIndex(previous => {
      if (totalPreviewRows === 0) return previous
      const next = previous + 1
      if (next >= totalPreviewRows) return previous
      return next
    })
  }, [totalPreviewRows])

  const downloadTemplate = useCallback(() => {
    if (!entityDefinition) return

    const requiredHeaders = entityDefinition.fields.filter(field => field.required).map(field => field.label)
    const templateHeaders =
      requiredHeaders.length > 0 ? requiredHeaders : entityDefinition.fields.map(field => field.label)

    const csv = `\uFEFF${toCsvLine(templateHeaders)}\n`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${entityDefinition.type}-import-template.csv`
    anchor.click()

    URL.revokeObjectURL(url)
  }, [entityDefinition])

  const runImport = useCallback(async () => {
    if (!entityDefinition) {
      return
    }

    setSubmitError(null)
    setImportResult(null)
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/admin/data-settings/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          upsertExisting,
          mapping: fieldMapping,
          rows: rowObjects
        })
      })

      const payload = (await response.json().catch(() => null)) as
        | { data?: ImportResult; error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Import failed")
      }

      if (!payload?.data) {
        throw new Error("Import finished but no summary was returned.")
      }

      setImportResult(payload.data)
    } catch (error) {
      setSubmitError(readErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }, [entityDefinition, entityType, fieldMapping, rowObjects, upsertExisting])

  const canMoveToMapping = csvHeaders.length > 0 && csvRows.length > 0 && !isParsing
  const canMoveToReview = canMoveToMapping && missingRequiredMappings.length === 0
  const canImport = canMoveToReview && !isSubmitting

  const mappedFieldLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const field of entityDefinition?.fields ?? []) {
      map.set(field.id, field.label)
    }
    return map
  }, [entityDefinition])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Imports</h1>
        <div className="text-xs text-gray-500">MVP: CSV/XLS/XLSX supported</div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {DATA_IMPORT_ENTITIES.map(entity => {
              const isActive = entity.type === entityType
              return (
                <button
                  key={entity.type}
                  type="button"
                  onClick={() => handleEntityChange(entity.type)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {entity.label}
                </button>
              )
            })}
          </div>

          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-end md:justify-end">
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Download template
            </button>

            {supportsUpsertToggle && (
              <div className="flex w-full flex-col gap-1 md:w-auto md:items-end">
                <p className="text-xs font-medium text-gray-700">Existing matches</p>
                <div className="inline-flex w-full rounded-md border border-gray-300 bg-white p-1 md:w-auto">
                  <button
                    type="button"
                    onClick={() => setUpsertExisting(true)}
                    className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors md:flex-none ${
                      upsertExisting ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Upsert
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpsertExisting(false)}
                    className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors md:flex-none ${
                      !upsertExisting ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Insert Only
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-3 text-sm text-gray-600">{entityDefinition?.description}</p>
        {supportsUpsertToggle && (
          <p className="mt-1 text-xs text-gray-600">
            When Insert Only is selected, rows that match an existing record are skipped (no updates applied).
          </p>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3 text-xs font-medium text-gray-600">
          <div className={step === "upload" ? "text-blue-700" : ""}>1. Upload CSV</div>
          <div className="h-px flex-1 bg-gray-200" />
          <div className={step === "mapping" ? "text-blue-700" : ""}>2. Field Mapping</div>
          <div className="h-px flex-1 bg-gray-200" />
          <div className={step === "review" ? "text-blue-700" : ""}>3. Review & Confirm</div>
        </div>
      </div>

      {step === "upload" && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-4 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
            <Upload className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-900">
              Upload a CSV, XLS, or XLSX file for {entityDefinition?.label}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Header row is required. Step 2 will let you map each column.
            </p>
            <label className="mt-4 inline-flex cursor-pointer items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Choose File
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                onChange={event => {
                  const file = event.target.files?.[0] ?? null
                  void handleFileSelected(file)
                }}
              />
            </label>
          </div>

          {isParsing && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
              <Loader2 className="h-4 w-4 animate-spin" />
              Parsing file...
            </div>
          )}

          {parseError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {parseError}
            </div>
          )}

          {selectedFileName && !parseError && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <FileText className="h-4 w-4 text-gray-500" />
              <span>{selectedFileName}</span>
              <span className="text-gray-400">|</span>
              <span>{csvRows.length} data row(s)</span>
              <span className="text-gray-400">|</span>
              <span>{csvHeaders.length} column(s)</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!canMoveToMapping}
              onClick={() => setStep("mapping")}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Continue to Mapping
            </button>
          </div>
        </div>
      )}

      {step === "mapping" && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Field Mapping Table</h2>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              {totalPreviewRows > 0 ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600">
                  <button
                    type="button"
                    onClick={goToPreviousRow}
                    disabled={effectivePreviewRowIndex === 0}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 disabled:border-gray-200 disabled:text-gray-300"
                    aria-label="Previous sample row"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <span className="min-w-[120px] text-center">{previewRangeLabel}</span>
                  <button
                    type="button"
                    onClick={goToNextRow}
                    disabled={effectivePreviewRowIndex + 1 >= totalPreviewRows}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 disabled:border-gray-200 disabled:text-gray-300"
                    aria-label="Next sample row"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setFieldMapping(buildAutoMapping(csvHeaders, entityType))}
                className="text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                Auto-map headers
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">CSV Column</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Sample Value</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Map To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {csvHeaders.map((header, index) => (
                  <tr key={header}>
                    <td className="px-3 py-2 font-medium text-gray-800">{header}</td>
                    <td className="max-w-[260px] truncate px-3 py-2 text-gray-600">
                      {sampleRow[index] || "-"}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={fieldMapping[header] ?? ""}
                        onChange={event => handleMappingChange(header, event.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Do Not Map</option>
                        {entityDefinition?.fields.map(field => (
                          <option key={field.id} value={field.id}>
                            {field.label}
                            {field.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-xs text-gray-600">
              Mapped columns: {mappedHeaders.length} of {csvHeaders.length}
            </p>
            {missingRequiredMappings.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Missing required mappings:{" "}
                {missingRequiredMappings.map(field => field.label).join(", ")}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-between">
            <button
              type="button"
              onClick={() => setStep("upload")}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!canMoveToReview}
              onClick={() => setStep("review")}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Continue to Review
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Review & Confirm</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs text-gray-500">Object</p>
                <p className="text-sm font-medium text-gray-900">{entityDefinition?.label}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs text-gray-500">Rows</p>
                <p className="text-sm font-medium text-gray-900">{csvRows.length}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs text-gray-500">Mapped Columns</p>
                <p className="text-sm font-medium text-gray-900">{mappedHeaders.length}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs text-gray-500">Required Mapping</p>
                <p className="text-sm font-medium text-gray-900">
                  {missingRequiredMappings.length === 0 ? "Complete" : "Missing"}
                </p>
              </div>
            </div>

            {requiredValueWarnings.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <p className="font-medium">Required field blanks detected:</p>
                <ul className="mt-1 space-y-1">
                  {requiredValueWarnings.map(message => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 max-h-[320px] overflow-auto rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {mappedHeaders.map(header => (
                      <th key={header} className="px-3 py-2 text-left font-medium text-gray-700">
                        {mappedFieldLabelById.get(fieldMapping[header]) ?? header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {rowObjects.slice(0, 10).map((row, rowIndex) => (
                    <tr key={`preview-${rowIndex}`}>
                      {mappedHeaders.map(header => {
                        const fieldId = fieldMapping[header] ?? ""
                        const isBooleanField = fieldId === "isPrimary" || fieldId === "isDecisionMaker" || fieldId === "isActive"
                        const rawValue = row[header] ?? ""
                        const displayValue = isBooleanField
                          ? (() => {
                              const parsed = parseBoolean(rawValue)
                              if (parsed === null) return rawValue || "-"
                              return parsed ? "true" : "false"
                            })()
                          : rawValue || "-"

                        return (
                          <td key={`${rowIndex}-${header}`} className="px-3 py-2 text-gray-700">
                            {displayValue}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rowObjects.length > 10 && (
              <p className="mt-2 text-xs text-gray-500">Showing first 10 rows of {rowObjects.length}.</p>
            )}
          </div>

          {submitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          )}

          {importResult && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="text-sm font-semibold text-gray-900">Import Complete</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-md border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">Total Rows</p>
                  <p className="text-base font-semibold text-gray-900">{importResult.totalRows}</p>
                </div>
                <div className="rounded-md border border-green-200 bg-green-50 p-3">
                  <p className="text-xs text-green-700">Succeeded</p>
                  <p className="text-base font-semibold text-green-700">{importResult.successRows}</p>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-700">Skipped</p>
                  <p className="text-base font-semibold text-amber-700">{importResult.skippedRows}</p>
                </div>
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <p className="text-xs text-red-700">Errors</p>
                  <p className="text-base font-semibold text-red-700">{importResult.errorRows}</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800">
                    <AlertCircle className="h-4 w-4" />
                    Row Errors
                  </div>
                  <div className="max-h-44 overflow-auto text-xs text-amber-800">
                    {importResult.errors.slice(0, 40).map(error => (
                      <div key={`${error.rowNumber}-${error.field}-${error.message}`}>
                        Row {error.rowNumber}: {error.message}
                      </div>
                    ))}
                    {importResult.errors.length > 40 && (
                      <div className="mt-1 text-amber-700">
                        +{importResult.errors.length - 40} additional errors not shown
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep("mapping")}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleEntityChange(entityType)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Start Over
              </button>
              <button
                type="button"
                disabled={!canImport}
                onClick={() => void runImport()}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
