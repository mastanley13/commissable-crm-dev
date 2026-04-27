"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import {
  DataSettingsRecentImportsView
} from "@/components/data-settings-recent-imports-view"
import { parseSpreadsheetFile, type ParsedWorksheet } from "@/lib/deposit-import/parse-file"
import {
  DATA_IMPORT_ENTITIES,
  getDataImportEntityDefinition,
  type DataImportEntityType
} from "@/lib/data-import/catalog"

type WizardStep = "upload" | "mapping" | "review"

type FieldMapping = Record<string, string>
type DepositTransactionHistoricalBucket = "settled-history" | "open-or-disputed"

interface ImportError {
  rowNumber: number
  field: string
  errorType: "validation" | "business_rule" | "system"
  message: string
  accountName?: string
}

interface ImportResult {
  totalRows: number
  successRows: number
  skippedRows: number
  errorRows: number
  errors: ImportError[]
  mode?: "import" | "validate-only"
  importJobId?: string
  importJobIds?: string[]
  storedErrorCount?: number
}

const IMPORT_BATCH_ROW_LIMIT = 5000
const ALL_WORKSHEETS_VALUE = "__all_importable_worksheets__"

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

function buildCombinedWorksheet(worksheets: ParsedWorksheet[]) {
  const importableWorksheets = worksheets.filter(worksheet => worksheet.isSelectable)
  const headers: string[] = []
  const seenHeaders = new Set<string>()

  for (const worksheet of importableWorksheets) {
    for (const header of worksheet.headers) {
      if (!seenHeaders.has(header)) {
        headers.push(header)
        seenHeaders.add(header)
      }
    }
  }

  const rows = importableWorksheets.flatMap(worksheet => {
    return worksheet.rows.map(row => {
      const rowByHeader = new Map<string, string>()
      worksheet.headers.forEach((header, index) => {
        rowByHeader.set(header, row[index] ?? "")
      })
      return headers.map(header => rowByHeader.get(header) ?? "")
    })
  })

  return {
    headers,
    rows,
    worksheetCount: importableWorksheets.length
  }
}

function shouldDefaultToCombinedWorksheets(entityType: DataImportEntityType, worksheets: ParsedWorksheet[]) {
  const importableCount = worksheets.filter(worksheet => worksheet.isSelectable).length
  return importableCount > 1 && (entityType === "accounts" || entityType === "revenue-schedules")
}

function splitRowsIntoBatches<T>(rows: T[], batchSize: number) {
  const batches: T[][] = []
  for (let index = 0; index < rows.length; index += batchSize) {
    batches.push(rows.slice(index, index + batchSize))
  }
  return batches
}

function buildClientIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `deposit-transactions-${Date.now()}`
}

function isDataImportEntityType(value: string | null): value is DataImportEntityType {
  return DATA_IMPORT_ENTITIES.some(entity => entity.type === value)
}

function buildImportsHref(entityType: DataImportEntityType, view?: "history") {
  const params = new URLSearchParams({ section: "imports", entityType })
  if (view === "history") {
    params.set("view", "history")
  }
  return `/admin/data-settings?${params.toString()}`
}

function formatImportErrorLine(error: ImportError) {
  return error.accountName
    ? `${error.accountName} - Row ${error.rowNumber} - ${error.message}`
    : `Row ${error.rowNumber}: ${error.message}`
}

export function DataSettingsImportsSection() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resultRef = useRef<HTMLDivElement | null>(null)
  const [entityType, setEntityType] = useState<DataImportEntityType>("accounts")
  const [step, setStep] = useState<WizardStep>("upload")
  const [upsertExisting, setUpsertExisting] = useState(true)
  const [historicalBucket, setHistoricalBucket] =
    useState<DepositTransactionHistoricalBucket>("settled-history")
  const [sourceSystem, setSourceSystem] = useState("")
  const [idempotencyKey, setIdempotencyKey] = useState("")
  const [defaultDistributorAccountName, setDefaultDistributorAccountName] = useState("")
  const [defaultVendorAccountName, setDefaultVendorAccountName] = useState("")
  const [notesPrefix, setNotesPrefix] = useState("")
  const [previewRowIndex, setPreviewRowIndex] = useState(0)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [worksheets, setWorksheets] = useState<ParsedWorksheet[]>([])
  const [selectedWorksheetName, setSelectedWorksheetName] = useState<string | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({})
  const [parseError, setParseError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionMode, setSubmissionMode] = useState<"import" | "validate-only" | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const entityDefinition = useMemo(() => getDataImportEntityDefinition(entityType), [entityType])
  const currentView = searchParams?.get("view") === "history" ? "history" : "wizard"
  const rowObjects = useMemo(() => buildRowObjects(csvHeaders, csvRows), [csvHeaders, csvRows])
  const selectedWorksheet = useMemo(
    () => worksheets.find(worksheet => worksheet.name === selectedWorksheetName) ?? null,
    [selectedWorksheetName, worksheets]
  )
  const selectedWorksheetLabel = selectedWorksheetName === ALL_WORKSHEETS_VALUE
    ? "All importable worksheets"
    : selectedWorksheet?.name ?? null
  const totalPreviewRows = csvRows.length
  const effectivePreviewRowIndex =
    totalPreviewRows === 0 ? 0 : Math.min(previewRowIndex, Math.max(0, totalPreviewRows - 1))
  const sampleRow = csvRows[effectivePreviewRowIndex] ?? []
  const isDepositTransactionsEntity = entityType === "deposit-transactions"
  const isOpportunityLineItemsEntity = entityType === "opportunity-line-items"
  const isRevenueSchedulesEntity = entityType === "revenue-schedules"
  const supportsUpsertToggle =
    entityType !== "revenue-schedules" &&
    entityType !== "deposit-transactions" &&
    entityType !== "opportunity-line-items"

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

  const depositTransactionConfigValid = useMemo(() => {
    if (!isDepositTransactionsEntity) {
      return true
    }

    const mappedFieldIds = new Set(Object.values(fieldMapping).filter(Boolean))
    return Boolean(
      historicalBucket &&
        sourceSystem.trim() &&
        idempotencyKey.trim() &&
        (defaultDistributorAccountName.trim() || mappedFieldIds.has("distributorAccountName")) &&
        (defaultVendorAccountName.trim() || mappedFieldIds.has("vendorAccountName"))
    )
  }, [
    fieldMapping,
    defaultDistributorAccountName,
    defaultVendorAccountName,
    historicalBucket,
    idempotencyKey,
    isDepositTransactionsEntity,
    sourceSystem
  ])

  const importFileLabel = useMemo(() => {
    if (!selectedFileName) {
      return null
    }
    if (selectedWorksheetLabel && worksheets.length > 1) {
      return `${selectedFileName} :: ${selectedWorksheetLabel}`
    }
    return selectedFileName
  }, [selectedFileName, selectedWorksheetLabel, worksheets.length])

  const applyParsedSheet = useCallback(
    (headers: string[], rows: string[][]) => {
      setCsvHeaders(headers)
      setCsvRows(rows)
      setPreviewRowIndex(0)
      setFieldMapping(buildAutoMapping(headers, entityType))
    },
    [entityType]
  )

  const handleFileSelected = useCallback(
    async (file: File | null) => {
      setParseError(null)
      setImportResult(null)
      setSubmitError(null)
      setSubmissionMode(null)

      if (!file) {
        setSelectedFileName(null)
        setWorksheets([])
        setSelectedWorksheetName(null)
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
        setWorksheets(parsed.worksheets ?? [])
        if (parsed.worksheets && shouldDefaultToCombinedWorksheets(entityType, parsed.worksheets)) {
          const combined = buildCombinedWorksheet(parsed.worksheets)
          setSelectedWorksheetName(ALL_WORKSHEETS_VALUE)
          applyParsedSheet(combined.headers, combined.rows)
        } else {
          setSelectedWorksheetName(parsed.selectedWorksheetName ?? null)
          applyParsedSheet(parsed.headers, parsed.rows)
        }
      } catch (error) {
        setParseError(readErrorMessage(error))
        setSelectedFileName(file.name)
        setWorksheets([])
        setSelectedWorksheetName(null)
        setCsvHeaders([])
        setCsvRows([])
        setPreviewRowIndex(0)
        setFieldMapping({})
      } finally {
        setIsParsing(false)
      }
    },
    [applyParsedSheet, entityType]
  )

  const handleEntityChange = useCallback((nextType: DataImportEntityType) => {
    setEntityType(nextType)
    setStep("upload")
    setUpsertExisting(true)
    setHistoricalBucket("settled-history")
    setSourceSystem("")
    setIdempotencyKey(nextType === "deposit-transactions" ? buildClientIdempotencyKey() : "")
    setDefaultDistributorAccountName("")
    setDefaultVendorAccountName("")
    setNotesPrefix("")
    setPreviewRowIndex(0)
    setSelectedFileName(null)
    setWorksheets([])
    setSelectedWorksheetName(null)
    setCsvHeaders([])
    setCsvRows([])
    setFieldMapping({})
    setParseError(null)
    setSubmitError(null)
    setImportResult(null)
    setSubmissionMode(null)
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

  const handleWorksheetSelected = useCallback(
    (nextWorksheetName: string) => {
      if (nextWorksheetName === ALL_WORKSHEETS_VALUE) {
        const combined = buildCombinedWorksheet(worksheets)
        if (combined.rows.length === 0) {
          return
        }

        setSelectedWorksheetName(ALL_WORKSHEETS_VALUE)
        setParseError(null)
        setImportResult(null)
        setSubmitError(null)
        setSubmissionMode(null)
        applyParsedSheet(combined.headers, combined.rows)
        return
      }

      const nextWorksheet = worksheets.find(worksheet => worksheet.name === nextWorksheetName)
      if (!nextWorksheet || !nextWorksheet.isSelectable) {
        return
      }

      setSelectedWorksheetName(nextWorksheet.name)
      setParseError(null)
      setImportResult(null)
      setSubmitError(null)
      setSubmissionMode(null)
      applyParsedSheet(nextWorksheet.headers, nextWorksheet.rows)
    },
    [applyParsedSheet, worksheets]
  )

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

  useEffect(() => {
    if (entityType === "deposit-transactions" && !idempotencyKey) {
      setIdempotencyKey(buildClientIdempotencyKey())
    }
  }, [entityType, idempotencyKey])

  useEffect(() => {
    const queryEntityType = searchParams?.get("entityType") ?? null
    if (!isDataImportEntityType(queryEntityType) || queryEntityType === entityType) {
      return
    }

    handleEntityChange(queryEntityType)
  }, [entityType, handleEntityChange, searchParams])

  const downloadTemplate = useCallback(() => {
    if (!entityDefinition) return

    const requiredHeaders = entityDefinition.fields.filter(field => field.required).map(field => field.label)
    const templateHeaders =
      entityType === "deposit-transactions"
        ? entityDefinition.fields.map(field => field.label)
        : requiredHeaders.length > 0
          ? requiredHeaders
          : entityDefinition.fields.map(field => field.label)

    const csv = `\uFEFF${toCsvLine(templateHeaders)}\n`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${entityDefinition.type}-import-template.csv`
    anchor.click()

    URL.revokeObjectURL(url)
  }, [entityDefinition, entityType])

  const downloadImportErrors = useCallback((importJobId: string) => {
    const anchor = document.createElement("a")
    anchor.href = `/api/admin/data-settings/imports/${importJobId}/errors`
    anchor.click()
  }, [])

  const runImport = useCallback(async (mode: "import" | "validate-only") => {
    if (!entityDefinition) {
      return
    }

    setSubmitError(null)
    setImportResult(null)
    setIsSubmitting(true)
    setSubmissionMode(mode)
    try {
      const rowBatches = splitRowsIntoBatches(rowObjects, IMPORT_BATCH_ROW_LIMIT)
      const aggregate: ImportResult = {
        totalRows: 0,
        successRows: 0,
        skippedRows: 0,
        errorRows: 0,
        errors: [],
        mode: mode === "validate-only" ? "validate-only" : "import",
        importJobIds: [],
        storedErrorCount: 0
      }

      for (let batchIndex = 0; batchIndex < rowBatches.length; batchIndex += 1) {
        const batchRows = rowBatches[batchIndex]
        const isMultiBatch = rowBatches.length > 1
        const batchNumber = batchIndex + 1
        const batchFileLabel = isMultiBatch
          ? `${importFileLabel ?? entityType}-part-${batchNumber}-of-${rowBatches.length}`
          : importFileLabel

        const response = await fetch("/api/admin/data-settings/imports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType,
            upsertExisting: isDepositTransactionsEntity || isRevenueSchedulesEntity ? false : upsertExisting,
            validateOnly: mode === "validate-only",
            mapping: fieldMapping,
            rows: batchRows,
            fileName: batchFileLabel,
            entityOptions: isDepositTransactionsEntity
              ? {
                  historicalBucket,
                  sourceSystem: sourceSystem.trim(),
                  idempotencyKey: isMultiBatch
                    ? `${idempotencyKey.trim()}-part-${batchNumber}`
                    : idempotencyKey.trim(),
                  defaultDistributorAccountName: defaultDistributorAccountName.trim(),
                  defaultVendorAccountName: defaultVendorAccountName.trim(),
                  notesPrefix: notesPrefix.trim()
                }
              : undefined
          })
        })

        const payload = (await response.json().catch(() => null)) as
          | { data?: ImportResult; error?: string }
          | null

        if (!response.ok) {
          throw new Error(
            `${isMultiBatch ? `Batch ${batchNumber} failed: ` : ""}${payload?.error ?? "Import failed"}`
          )
        }

        if (!payload?.data) {
          throw new Error(`${isMultiBatch ? `Batch ${batchNumber} finished` : "Import finished"} but no summary was returned.`)
        }

        const rowOffset = batchIndex * IMPORT_BATCH_ROW_LIMIT
        aggregate.totalRows += payload.data.totalRows
        aggregate.successRows += payload.data.successRows
        aggregate.skippedRows += payload.data.skippedRows
        aggregate.errorRows += payload.data.errorRows
        aggregate.errors.push(
          ...payload.data.errors.map(error => ({
            ...error,
            rowNumber: rowOffset + error.rowNumber
          }))
        )
        if (payload.data.importJobId) {
          aggregate.importJobIds?.push(payload.data.importJobId)
          aggregate.importJobId = payload.data.importJobId
        }
        aggregate.storedErrorCount =
          (aggregate.storedErrorCount ?? 0) + (payload.data.storedErrorCount ?? 0)
      }

      setImportResult(aggregate)
    } catch (error) {
      setSubmitError(readErrorMessage(error))
    } finally {
      setIsSubmitting(false)
      setSubmissionMode(null)
    }
  }, [
    entityDefinition,
    historicalBucket,
    idempotencyKey,
    isDepositTransactionsEntity,
    isRevenueSchedulesEntity,
    entityType,
    defaultDistributorAccountName,
    defaultVendorAccountName,
    fieldMapping,
    notesPrefix,
    rowObjects,
    importFileLabel,
    sourceSystem,
    upsertExisting
  ])

  const openRecentImports = useCallback(() => {
    router.push(buildImportsHref(entityType, "history"))
  }, [entityType, router])

  const closeRecentImports = useCallback(() => {
    router.push(buildImportsHref(entityType))
  }, [entityType, router])

  const handleRecentImportsEntityChange = useCallback(
    (nextType: DataImportEntityType) => {
      handleEntityChange(nextType)
      router.replace(buildImportsHref(nextType, "history"), { scroll: false })
    },
    [handleEntityChange, router]
  )

  const canMoveToMapping = csvHeaders.length > 0 && csvRows.length > 0 && !isParsing
  const canMoveToReview =
    canMoveToMapping && missingRequiredMappings.length === 0 && depositTransactionConfigValid
  const canSubmit = canMoveToReview && !isSubmitting

  const mappedFieldLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const field of entityDefinition?.fields ?? []) {
      map.set(field.id, field.label)
    }
    return map
  }, [entityDefinition])

  const resultStatus = useMemo(() => {
    if (!importResult) {
      return null
    }

    const isValidation = importResult.mode === "validate-only"
    const noun = isValidation ? "validation" : "import"
    const wroteRecords = !isValidation && importResult.successRows > 0

    if (importResult.errorRows > 0 && importResult.successRows > 0) {
      return {
        tone: "warning" as const,
        title: isValidation ? "Validation Completed with Errors" : "Import Completed with Errors",
        message: `${importResult.successRows} row(s) succeeded and ${importResult.errorRows} row(s) need review.`
      }
    }

    if (importResult.errorRows > 0) {
      return {
        tone: "error" as const,
        title: isValidation ? "Validation Failed" : "Import Finished with No Successful Rows",
        message: `The ${noun} completed, but all ${importResult.errorRows} processed row(s) had errors.`
      }
    }

    if (importResult.skippedRows > 0 && importResult.successRows === 0) {
      return {
        tone: "warning" as const,
        title: isValidation ? "Validation Complete" : "Import Completed with Skipped Rows",
        message: `No errors were found, but ${importResult.skippedRows} row(s) were skipped.`
      }
    }

    return {
      tone: "success" as const,
      title: isValidation ? "Validation Complete" : "Import Complete",
      message: isValidation
        ? `${importResult.totalRows} row(s) validated successfully. No records were written.`
        : wroteRecords
          ? `${importResult.successRows} row(s) imported successfully.`
          : "The import completed successfully."
    }
  }, [importResult])

  const resultToneClasses = resultStatus?.tone === "error"
    ? {
        panel: "border-red-200 bg-red-50",
        icon: "text-red-600",
        title: "text-red-900",
        text: "text-red-800"
      }
    : resultStatus?.tone === "warning"
      ? {
          panel: "border-amber-200 bg-amber-50",
          icon: "text-amber-600",
          title: "text-amber-900",
          text: "text-amber-800"
        }
      : {
          panel: "border-green-200 bg-green-50",
          icon: "text-green-600",
          title: "text-green-900",
          text: "text-green-800"
        }

  useEffect(() => {
    if (!importResult && !submitError) {
      return
    }

    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [importResult, submitError])

  if (currentView === "history") {
    return (
      <DataSettingsRecentImportsView
        entityType={entityType}
        onBack={closeRecentImports}
        onEntityTypeChange={handleRecentImportsEntityChange}
      />
    )
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Imports</h1>
        <div className="text-xs text-gray-500">Operator workflow: CSV or Excel</div>
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

        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <p className="text-blue-900">{entityDefinition?.description}</p>
          <p className="mt-1 text-blue-900">
            Import operators can upload one CSV or Excel workbook per object. Compatible multi-sheet workbooks
            can be combined into one import before field mapping.
          </p>
          {supportsUpsertToggle && (
            <p className="mt-1 text-blue-900">
              When Insert Only is selected, rows that match an existing record are skipped (no updates applied).
            </p>
          )}
        </div>
        {isOpportunityLineItemsEntity && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This import is create-only. It adds new opportunity line items and does not upsert existing rows.
          </div>
        )}
        {isRevenueSchedulesEntity && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This import is create-only. Reruns are not idempotent. Reset or remove previously imported
            revenue schedules before rerunning the same file.
          </div>
        )}
        {isDepositTransactionsEntity && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
              Historical Bucket
              <select
                value={historicalBucket}
                onChange={event =>
                  setHistoricalBucket(event.target.value as DepositTransactionHistoricalBucket)
                }
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
              >
                <option value="settled-history">Settled History</option>
                <option value="open-or-disputed">Open or Disputed</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
              Source System
              <input
                value={sourceSystem}
                onChange={event => setSourceSystem(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
                placeholder="Legacy CRM"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
              Idempotency Key
              <div className="flex gap-2">
                <input
                  value={idempotencyKey}
                  onChange={event => setIdempotencyKey(event.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
                  placeholder="deposit-transactions-2026-04-wave1"
                />
                <button
                  type="button"
                  onClick={() => setIdempotencyKey(buildClientIdempotencyKey())}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Regenerate
                </button>
              </div>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
              Default Distributor
              <input
                value={defaultDistributorAccountName}
                onChange={event => setDefaultDistributorAccountName(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
                placeholder="Test Distributor"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
              Default Vendor
              <input
                value={defaultVendorAccountName}
                onChange={event => setDefaultVendorAccountName(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
                placeholder="Test Vendor"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 md:col-span-2">
              Notes Prefix
              <input
                value={notesPrefix}
                onChange={event => setNotesPrefix(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
                placeholder="Wave 1 historical backfill"
              />
            </label>

            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 md:col-span-2">
              This import is create-only. Each row must include stable source keys, and settled-history
              deposits are hidden from the default reconciliation queue.
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Recent Imports</h2>
            <p className="text-xs text-gray-600">
              Open a dedicated history page for the latest admin import runs for {entityDefinition?.label}.
            </p>
          </div>
          <button
            type="button"
            onClick={openRecentImports}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Open Recent Imports
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3 text-xs font-medium text-gray-600">
          <div className={step === "upload" ? "text-blue-700" : ""}>1. Upload File</div>
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
              Upload a CSV or Excel file for {entityDefinition?.label}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Header row is required. CSV, XLS, and XLSX files are supported. If the workbook contains
              multiple sheets, select the worksheet you want to import.
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
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <FileText className="h-4 w-4 text-gray-500" />
              <span>{selectedFileName}</span>
              {selectedWorksheetLabel && (
                <>
                  <span className="text-gray-400">|</span>
                  <span>Worksheet: {selectedWorksheetLabel}</span>
                </>
              )}
              <span className="text-gray-400">|</span>
              <span>{csvRows.length} data row(s)</span>
              <span className="text-gray-400">|</span>
              <span>{csvHeaders.length} column(s)</span>
            </div>
          )}

          {worksheets.length > 1 && !parseError && (
            <div className="mb-4 rounded-md border border-gray-200 bg-white p-4">
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
                Worksheet
                <select
                  value={selectedWorksheetName ?? ""}
                  onChange={event => handleWorksheetSelected(event.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
                >
                  <option value={ALL_WORKSHEETS_VALUE}>
                    All importable worksheets ({buildCombinedWorksheet(worksheets).rows.length} row(s))
                  </option>
                  {worksheets.map(worksheet => (
                    <option
                      key={worksheet.name}
                      value={worksheet.name}
                      disabled={!worksheet.isSelectable}
                    >
                      {worksheet.isSelectable
                        ? `${worksheet.name} (${worksheet.rows.length} row(s))`
                        : `${worksheet.name} (${worksheet.error ?? "Not importable"})`}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-xs text-gray-500">
                Importable worksheets: {worksheets.filter(worksheet => worksheet.isSelectable).length} of{" "}
                {worksheets.length}
              </p>
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

          <div className="min-h-[360px] max-h-[60vh] overflow-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Source Column</th>
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
            {isDepositTransactionsEntity && !depositTransactionConfigValid && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Deposit transaction imports also require Historical Bucket, Source System, Idempotency Key,
                and either mapped Vendor/Distributor columns or default Vendor/Distributor values before
                review.
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
            <div
              className={`grid grid-cols-1 gap-3 ${
                selectedWorksheetLabel ? "md:grid-cols-5" : "md:grid-cols-4"
              }`}
            >
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs text-gray-500">Object</p>
                <p className="text-sm font-medium text-gray-900">{entityDefinition?.label}</p>
              </div>
              {selectedWorksheetLabel && (
                <div className="rounded-md border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">Worksheet</p>
                  <p className="text-sm font-medium text-gray-900">{selectedWorksheetLabel}</p>
                </div>
              )}
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

          <div ref={resultRef} className="space-y-3" aria-live="polite">
            {isSubmitting && (
              <div
                role="status"
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {submissionMode === "validate-only" ? "Validation is running" : "Import is running"}
                </div>
                <p className="mt-1 text-blue-800">
                  Keep this page open. A completion summary will appear here when processing finishes.
                </p>
              </div>
            )}

            {submitError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                <div className="flex items-center gap-2 font-semibold text-red-900">
                  <AlertCircle className="h-4 w-4" />
                  Import request failed
                </div>
                <p className="mt-1">{submitError}</p>
              </div>
            )}

            {importResult && resultStatus && (
              <div
                role="status"
                className={`rounded-lg border p-4 ${resultToneClasses.panel}`}
              >
                <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {resultStatus.tone === "success" ? (
                        <CheckCircle2 className={`h-5 w-5 ${resultToneClasses.icon}`} />
                      ) : (
                        <AlertCircle className={`h-5 w-5 ${resultToneClasses.icon}`} />
                      )}
                      <h3 className={`text-sm font-semibold ${resultToneClasses.title}`}>
                        {resultStatus.title}
                      </h3>
                    </div>
                    <p className={`mt-1 text-sm ${resultToneClasses.text}`}>{resultStatus.message}</p>
                  </div>
                  {importResult.mode !== "validate-only" && (
                    <button
                      type="button"
                      onClick={openRecentImports}
                      className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      View Recent Imports
                    </button>
                  )}
                </div>
              {importResult.mode === "validate-only" && (
                <p className="mb-3 text-sm text-gray-600">
                  Validation used the same mapping and row checks but did not write any records or import history.
                </p>
              )}
              {importResult.mode !== "validate-only" && importResult.importJobId && (
                <p className="mb-3 text-sm text-gray-600">
                  Import job recorded. You can review it from Recent Imports.
                </p>
              )}
              {importResult.importJobIds && importResult.importJobIds.length > 1 && (
                <p className="mb-3 text-sm text-gray-600">
                  This upload was processed in {importResult.importJobIds.length} backend batch jobs.
                </p>
              )}
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
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                      <AlertCircle className="h-4 w-4" />
                      Row Errors
                    </div>
                    {importResult.importJobIds &&
                    importResult.importJobIds.length > 1 &&
                    importResult.storedErrorCount &&
                    importResult.storedErrorCount > 0 ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        {importResult.importJobIds.map((importJobId, index) => (
                          <button
                            key={importJobId}
                            type="button"
                            onClick={() => downloadImportErrors(importJobId)}
                            className="text-xs font-medium text-amber-900 underline-offset-2 hover:underline"
                          >
                            Batch {index + 1} CSV
                          </button>
                        ))}
                      </div>
                    ) : (
                      importResult.importJobId &&
                      importResult.storedErrorCount &&
                      importResult.storedErrorCount > 0 && (
                        <button
                          type="button"
                          onClick={() => downloadImportErrors(importResult.importJobId!)}
                          className="text-xs font-medium text-amber-900 underline-offset-2 hover:underline"
                        >
                          Download CSV
                        </button>
                      )
                    )}
                  </div>
                  <div className="max-h-44 overflow-auto text-xs text-amber-800">
                    {importResult.errors.slice(0, 40).map(error => (
                      <div key={`${error.rowNumber}-${error.field}-${error.message}`}>
                        {formatImportErrorLine(error)}
                      </div>
                    ))}
                    {importResult.errors.length > 40 && (
                      <div className="mt-1 text-amber-700">
                        +{importResult.errors.length - 40} additional errors not shown
                      </div>
                    )}
                    {typeof importResult.storedErrorCount === "number" &&
                      importResult.storedErrorCount < importResult.errorRows && (
                        <div className="mt-1 text-amber-700">
                          Stored the first {importResult.storedErrorCount} error row(s) for CSV download.
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
            )}
          </div>

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
                disabled={!canSubmit}
                onClick={() => void runImport("validate-only")}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
              >
                {isSubmitting && submissionMode === "validate-only" && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Validate Only
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => void runImport("import")}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isSubmitting && submissionMode === "import" && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
