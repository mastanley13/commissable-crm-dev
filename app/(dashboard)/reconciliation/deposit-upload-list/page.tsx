'use client'

import { useEffect, useState, useCallback, ChangeEvent, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useBreadcrumbs } from '@/lib/breadcrumb-context'
import { CreateTemplateStep } from '@/components/deposit-upload/create-template-step'
import { MapFieldsStep } from '@/components/deposit-upload/map-fields-step'
import { ReviewStep } from '@/components/deposit-upload/review-step'
import type { DepositUploadFormState } from '@/components/deposit-upload/types'
import { parseSpreadsheetFile } from '@/lib/deposit-import/parse-file'
import { DEPOSIT_IMPORT_TARGET_IDS, type DepositImportFieldTarget } from '@/lib/deposit-import/field-catalog'
import { shouldSkipMultiVendorRow } from '@/lib/deposit-import/multi-vendor'
import {
  createEmptyDepositMappingV2,
  seedDepositMappingV2,
  setColumnSelectionV2,
  createCustomFieldForColumnV2,
  extractDepositMappingV2FromTemplateConfig,
  type DepositMappingConfigV2,
  type DepositColumnSelectionV2,
} from '@/lib/deposit-import/template-mapping-v2'
import type { DepositCustomFieldSection } from '@/lib/deposit-import/template-mapping'
import {
  extractTelarusTemplateFieldsFromTemplateConfig,
  stripTelarusGeneratedCustomFieldsV2,
  type TelarusTemplateFieldsV1,
} from '@/lib/deposit-import/telarus-template-fields'

type WizardStep = 'create-template' | 'map-fields' | 'review'

type BackButtonConfig = { label: string; onClick: () => void; disabled?: boolean }

interface MultiVendorTemplateUsage {
  vendorNameInFile: string
  vendorAccountId: string
  vendorAccountName: string
  templateId: string
  templateName: string
  templateUpdatedAt: string
}

const generateIdempotencyKey = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // fall back below
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const initialFormState: DepositUploadFormState = {
  depositName: '',
  depositReceivedDate: '',
  commissionPeriod: '',
  createdByContactId: '',
  createdByLabel: '',
  distributorAccountId: '',
  distributorLabel: '',
  vendorAccountId: '',
  vendorLabel: '',
  templateId: '',
  templateLabel: '',
  saveTemplateMapping: false,
  multiVendor: false,
}

export default function DepositUploadListPage() {
  const { setBreadcrumbs } = useBreadcrumbs()
  const router = useRouter()

  const [activeStep, setActiveStep] = useState<WizardStep>('create-template')
  const [formState, setFormState] = useState<DepositUploadFormState>(initialFormState)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [sampleRows, setSampleRows] = useState<string[][]>([])
  const [columnHasValuesByIndex, setColumnHasValuesByIndex] = useState<boolean[]>([])
  const [parsedRowCount, setParsedRowCount] = useState(0)
  const [parsingError, setParsingError] = useState<string | null>(null)
  const [fieldCatalog, setFieldCatalog] = useState<DepositImportFieldTarget[]>([])
  const [fieldCatalogError, setFieldCatalogError] = useState<string | null>(null)
  const [mapping, setMapping] = useState<DepositMappingConfigV2>(() => createEmptyDepositMappingV2())
  const [templateMapping, setTemplateMapping] = useState<DepositMappingConfigV2 | null>(null)
  const [templateFields, setTemplateFields] = useState<TelarusTemplateFieldsV1 | null>(null)
  const [multiVendorTemplatesUsed, setMultiVendorTemplatesUsed] = useState<MultiVendorTemplateUsage[]>([])
  const [multiVendorMissingVendors, setMultiVendorMissingVendors] = useState<string[]>([])
  const [multiVendorVendorsMissingTemplates, setMultiVendorVendorsMissingTemplates] = useState<string[]>([])
  const [multiVendorPreviewWarnings, setMultiVendorPreviewWarnings] = useState<string[]>([])
  const [multiVendorPreviewError, setMultiVendorPreviewError] = useState<string | null>(null)
  const [multiVendorPreviewLoading, setMultiVendorPreviewLoading] = useState(false)
  const [validationIssues, setValidationIssues] = useState<string[]>([])
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ depositId?: string; depositIds?: string[] } | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey())
  const mappingHistoryRef = useRef<DepositMappingConfigV2[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const parsedRowsRef = useRef<string[][]>([])
  const mappedVendorColumnName = (mapping.targets?.["depositLineItem.vendorNameRaw"] ?? '').trim()
  const mappedUsageColumnName = (mapping.targets?.[DEPOSIT_IMPORT_TARGET_IDS.usage] ?? '').trim()
  const mappedCommissionColumnName = (mapping.targets?.[DEPOSIT_IMPORT_TARGET_IDS.commission] ?? '').trim()

  useEffect(() => {
    setBreadcrumbs([
      { name: 'Home', href: '/dashboard' },
      { name: 'Reconciliation', href: '/reconciliation' },
      { name: 'Deposit Upload List', href: '/reconciliation/deposit-upload-list', current: true },
    ])
    return () => {
      setBreadcrumbs(null)
    }
  }, [setBreadcrumbs])

  useEffect(() => {
    let cancelled = false
    const loadCatalog = async () => {
      setFieldCatalogError(null)
      try {
        const response = await fetch('/api/reconciliation/deposits/import-field-catalog', { cache: 'no-store' })
        if (!response.ok) {
          throw new Error('Unable to load deposit import field list.')
        }
        const payload = await response.json().catch(() => null)
        if (cancelled) return
        const catalog = Array.isArray(payload?.data) ? payload.data : []
        setFieldCatalog(catalog)
      } catch (error) {
        if (cancelled) return
        console.error('Failed to load deposit import field catalog', error)
        setFieldCatalogError(error instanceof Error ? error.message : 'Unable to load deposit import fields.')
      }
    }
    void loadCatalog()
    return () => {
      cancelled = true
    }
  }, [])

  const updateFormState = useCallback((updates: Partial<DepositUploadFormState>) => {
    setFormState(previous => ({ ...previous, ...updates }))
  }, [])

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
    setIdempotencyKey(generateIdempotencyKey())
    setMapping(createEmptyDepositMappingV2())
    setTemplateMapping(null)
    setTemplateFields(null)
    setCsvHeaders([])
    setSampleRows([])
    setColumnHasValuesByIndex([])
    setParsedRowCount(0)
    setParsingError(null)
    setImportError(null)
    setImportResult(null)
    setMultiVendorTemplatesUsed([])
    setMultiVendorMissingVendors([])
    setMultiVendorVendorsMissingTemplates([])
    setMultiVendorPreviewWarnings([])
    setMultiVendorPreviewError(null)
    setMultiVendorPreviewLoading(false)
    parsedRowsRef.current = []
    mappingHistoryRef.current = []
    setCanUndo(false)
  }, [])

  useEffect(() => {
    if (!selectedFile) {
      return
    }
    let cancelled = false
    setParsingError(null)
    const parse = async () => {
      try {
        const parsed = await parseSpreadsheetFile(selectedFile, selectedFile.name, selectedFile.type)
        if (cancelled) return

        const headers = parsed.headers
        parsedRowsRef.current = parsed.rows
        setCsvHeaders(headers)
        setSampleRows(parsed.rows.slice(0, 25))
        setParsedRowCount(parsed.rows.length)
        const hasValues = new Array(headers.length).fill(false)
        let remaining = headers.length
        for (const row of parsed.rows) {
          if (remaining === 0) break
          for (let index = 0; index < headers.length; index++) {
            if (hasValues[index]) continue
            const cell = row[index]
            if (typeof cell === 'string' ? cell.trim().length > 0 : String(cell ?? '').trim().length > 0) {
              hasValues[index] = true
              remaining -= 1
              if (remaining === 0) break
            }
          }
        }
        setColumnHasValuesByIndex(hasValues)
        mappingHistoryRef.current = []
        setCanUndo(false)

        let templateMapping: DepositMappingConfigV2 | null = null
        let templateFields: TelarusTemplateFieldsV1 | null = null
        const distributorAccountId = formState.distributorAccountId?.trim() ?? ''
        const vendorAccountId = formState.vendorAccountId?.trim() ?? ''
        const templateId = formState.templateId?.trim() ?? ''

        if (!formState.multiVendor && templateId && distributorAccountId && vendorAccountId) {
          try {
            const response = await fetch(`/api/reconciliation/templates/${encodeURIComponent(templateId)}`, {
              cache: 'no-store',
            })
            if (response.ok) {
              const payload = await response.json().catch(() => null)
              const rawConfig = payload?.data?.config
              if (rawConfig) {
                templateMapping = stripTelarusGeneratedCustomFieldsV2(extractDepositMappingV2FromTemplateConfig(rawConfig))
                templateFields = extractTelarusTemplateFieldsFromTemplateConfig(rawConfig)
              }
            } else {
              // Soft-fail on template lookup; fall back to auto-mapping only.
              console.warn('Template lookup failed for deposit upload mapping')
            }
          } catch (error) {
            console.error('Unable to load reconciliation template for deposit upload', error)
          }
        }

        setTemplateMapping(templateMapping)
        setTemplateFields(templateFields)
        setMapping(seedDepositMappingV2({ headers, templateMapping }))
        setFormState(previous => {
          if (previous.saveTemplateMapping) return previous
          const defaultSave = Boolean(previous.templateId) && !templateMapping
          return previous.saveTemplateMapping === defaultSave ? previous : { ...previous, saveTemplateMapping: defaultSave }
        })
      } catch (error) {
        if (cancelled) return
        console.error('Unable to parse file', error)
        parsedRowsRef.current = []
        setCsvHeaders([])
        setSampleRows([])
        setParsedRowCount(0)
        setParsingError(error instanceof Error ? error.message : 'Unable to read file')
        setMapping(createEmptyDepositMappingV2())
        setTemplateMapping(null)
        setTemplateFields(null)
        setMultiVendorTemplatesUsed([])
        setMultiVendorMissingVendors([])
        setMultiVendorVendorsMissingTemplates([])
        setMultiVendorPreviewWarnings([])
        setMultiVendorPreviewError(null)
        setMultiVendorPreviewLoading(false)
        mappingHistoryRef.current = []
        setCanUndo(false)
      }
    }
    void parse()
    return () => {
      cancelled = true
    }
  }, [selectedFile, formState.distributorAccountId, formState.vendorAccountId, formState.templateId, formState.multiVendor])

  useEffect(() => {
    if (!formState.multiVendor) {
      setMultiVendorTemplatesUsed([])
      setMultiVendorMissingVendors([])
      setMultiVendorVendorsMissingTemplates([])
      setMultiVendorPreviewWarnings([])
      setMultiVendorPreviewError(null)
      setMultiVendorPreviewLoading(false)
      return
    }

    const distributorAccountId = formState.distributorAccountId?.trim() ?? ''
    if (!selectedFile || !distributorAccountId || !csvHeaders.length || parsingError) {
      setMultiVendorTemplatesUsed([])
      setMultiVendorMissingVendors([])
      setMultiVendorVendorsMissingTemplates([])
      setMultiVendorPreviewWarnings([])
      setMultiVendorPreviewError(null)
      setMultiVendorPreviewLoading(false)
      setTemplateMapping(null)
      setTemplateFields(null)
      return
    }

    if (!mappedVendorColumnName) {
      setMultiVendorTemplatesUsed([])
      setMultiVendorMissingVendors([])
      setMultiVendorVendorsMissingTemplates([])
      setMultiVendorPreviewWarnings([])
      setMultiVendorPreviewError(null)
      setMultiVendorPreviewLoading(false)
      setTemplateMapping(null)
      setTemplateFields(null)
      return
    }

    const vendorNameIndex = csvHeaders.findIndex(header => header === mappedVendorColumnName)
    if (vendorNameIndex < 0) {
      setMultiVendorTemplatesUsed([])
      setMultiVendorMissingVendors([])
      setMultiVendorVendorsMissingTemplates([])
      setMultiVendorPreviewWarnings([])
      setMultiVendorPreviewError('Unable to locate the mapped "Vendor Name" column in the uploaded file.')
      setMultiVendorPreviewLoading(false)
      setTemplateMapping(null)
      setTemplateFields(null)
      return
    }

    const usageIndex = mappedUsageColumnName ? csvHeaders.findIndex(header => header === mappedUsageColumnName) : -1
    const commissionIndex = mappedCommissionColumnName
      ? csvHeaders.findIndex(header => header === mappedCommissionColumnName)
      : -1

    const normalizeNumber = (value: unknown) => {
      if (value === undefined || value === null) return null
      const normalized = String(value).replace(/[^0-9.\-]/g, '')
      if (!normalized) return null
      const numeric = Number(normalized)
      return Number.isNaN(numeric) ? null : numeric
    }

    const vendorNamesSet = new Set<string>()
    const missingVendorRows: number[] = []
    for (let rowIndex = 0; rowIndex < parsedRowsRef.current.length; rowIndex += 1) {
      const row = parsedRowsRef.current[rowIndex] ?? []
      const usageValue = usageIndex >= 0 ? normalizeNumber(row[usageIndex]) : null
      const commissionValue = commissionIndex >= 0 ? normalizeNumber(row[commissionIndex]) : null
      if (usageValue === null && commissionValue === null) {
        continue
      }

      const vendorNameRaw = typeof row[vendorNameIndex] === 'string' ? row[vendorNameIndex].trim() : String(row[vendorNameIndex] ?? '').trim()
      const vendorName = vendorNameRaw.length > 0 ? vendorNameRaw : null
      if (shouldSkipMultiVendorRow(row, vendorName)) {
        continue
      }

      if (!vendorName) {
        if (missingVendorRows.length < 25) {
          missingVendorRows.push(rowIndex + 2)
        }
        continue
      }
      vendorNamesSet.add(vendorName)
    }

    if (missingVendorRows.length > 0) {
      const sampleRowNumbers = missingVendorRows.slice(0, 10).join(', ')
      setMultiVendorTemplatesUsed([])
      setMultiVendorMissingVendors([])
      setMultiVendorVendorsMissingTemplates([])
      setMultiVendorPreviewWarnings([])
      setMultiVendorPreviewError(
        `Multi-vendor upload is missing vendor values in the mapped "Vendor Name" column (example row numbers: ${sampleRowNumbers}).`,
      )
      setMultiVendorPreviewLoading(false)
      setTemplateMapping(null)
      setTemplateFields(null)
      return
    }

    const vendorNames = Array.from(vendorNamesSet)
    if (vendorNames.length === 0) {
      setMultiVendorTemplatesUsed([])
      setMultiVendorMissingVendors([])
      setMultiVendorVendorsMissingTemplates([])
      setMultiVendorPreviewWarnings([])
      setMultiVendorPreviewError('No usable vendor rows were found from the mapped "Vendor Name" column.')
      setMultiVendorPreviewLoading(false)
      setTemplateMapping(null)
      setTemplateFields(null)
      return
    }

    const controller = new AbortController()
    let cancelled = false

    const runPreview = async () => {
      setMultiVendorPreviewLoading(true)
      setMultiVendorPreviewError(null)
      try {
        const response = await fetch('/api/reconciliation/templates/multi-vendor-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            distributorAccountId,
            vendorNames,
            options: { maxVendors: 100 },
          }),
          signal: controller.signal,
        })

        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to resolve templates for multi-vendor upload.')
        }
        if (cancelled) return

        const data = payload?.data ?? {}
        const templatesUsed = Array.isArray(data.templatesUsed) ? (data.templatesUsed as MultiVendorTemplateUsage[]) : []
        const missingVendors = Array.isArray(data.missingVendors) ? (data.missingVendors as string[]) : []
        const vendorsMissingTemplates = Array.isArray(data.vendorsMissingTemplates)
          ? (data.vendorsMissingTemplates as string[])
          : []
        const warnings = Array.isArray(data.warnings) ? (data.warnings as string[]) : []

        setMultiVendorTemplatesUsed(templatesUsed)
        setMultiVendorMissingVendors(missingVendors)
        setMultiVendorVendorsMissingTemplates(vendorsMissingTemplates)
        setMultiVendorPreviewWarnings(warnings)

        const mergedMappingRaw = data?.mergedTemplateConfig?.depositMappingV2
        const mergedTemplateFieldsRaw = data?.mergedTemplateConfig?.telarusTemplateFields

        const nextTemplateMapping = mergedMappingRaw
          ? stripTelarusGeneratedCustomFieldsV2(
              extractDepositMappingV2FromTemplateConfig({ depositMapping: mergedMappingRaw }),
            )
          : null
        const hasTemplateMapping =
          nextTemplateMapping &&
          (Object.keys(nextTemplateMapping.targets ?? {}).length > 0 ||
            Object.keys(nextTemplateMapping.columns ?? {}).length > 0 ||
            Object.keys(nextTemplateMapping.customFields ?? {}).length > 0)
            ? nextTemplateMapping
            : null

        const nextTemplateFields = mergedTemplateFieldsRaw
          ? extractTelarusTemplateFieldsFromTemplateConfig({
              telarusTemplateFields: mergedTemplateFieldsRaw,
            })
          : null

        setTemplateMapping(hasTemplateMapping)
        setTemplateFields(nextTemplateFields)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        if (cancelled) return
        console.error('Unable to load multi-vendor template preview', error)
        setMultiVendorTemplatesUsed([])
        setMultiVendorMissingVendors([])
        setMultiVendorVendorsMissingTemplates([])
        setMultiVendorPreviewWarnings([])
        setTemplateMapping(null)
        setTemplateFields(null)
        setMultiVendorPreviewError(
          error instanceof Error
            ? error.message
            : 'Unable to resolve templates for multi-vendor upload.',
        )
      } finally {
        if (!cancelled) {
          setMultiVendorPreviewLoading(false)
        }
      }
    }

    const timer = setTimeout(() => {
      void runPreview()
    }, 300)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [
    formState.multiVendor,
    formState.distributorAccountId,
    mappedVendorColumnName,
    mappedUsageColumnName,
    mappedCommissionColumnName,
    csvHeaders,
    selectedFile,
    parsingError,
  ])

  useEffect(() => {
    const issues: string[] = []
    const hasUsage = Boolean(mapping.targets?.[DEPOSIT_IMPORT_TARGET_IDS.usage])
    const hasCommission = Boolean(mapping.targets?.[DEPOSIT_IMPORT_TARGET_IDS.commission])
    if (!hasUsage && !hasCommission) {
      issues.push('Map either "Actual Usage" or "Actual Commission".')
    }
    if (formState.multiVendor && !mapping.targets?.["depositLineItem.vendorNameRaw"]) {
      issues.push('Multi-vendor uploads require mapping the "Vendor Name" column.')
    }
    if (!selectedFile) {
      issues.push('Select a CSV, Excel, or PDF file to continue.')
    }
    if (parsingError) {
      issues.push('Resolve the file parsing error before continuing.')
    }
    if (selectedFile && parsedRowCount === 0 && !parsingError) {
      issues.push('No data rows were detected in the uploaded file.')
    }
    if (formState.multiVendor && multiVendorPreviewLoading) {
      issues.push('Resolving templates for multi-vendor upload. Please wait.')
    }
    if (formState.multiVendor && multiVendorPreviewError) {
      issues.push(multiVendorPreviewError)
    }
    if (formState.multiVendor && multiVendorMissingVendors.length > 0) {
      issues.push(
        `Unable to resolve vendor account(s): ${multiVendorMissingVendors.slice(0, 8).join(', ')}.`,
      )
    }
    if (formState.multiVendor && multiVendorVendorsMissingTemplates.length > 0) {
      issues.push(
        `Missing reconciliation template(s) for vendor(s): ${multiVendorVendorsMissingTemplates.slice(0, 8).join(', ')}.`,
      )
    }
    setValidationIssues(issues)
  }, [
    mapping,
    selectedFile,
    parsingError,
    parsedRowCount,
    formState.multiVendor,
    multiVendorPreviewLoading,
    multiVendorPreviewError,
    multiVendorMissingVendors,
    multiVendorVendorsMissingTemplates,
  ])

  const handleColumnSelectionChange = useCallback((columnName: string, selection: DepositColumnSelectionV2) => {
    setMapping(previous => {
      const next = setColumnSelectionV2(previous, columnName, selection)
      if (next !== previous) {
        mappingHistoryRef.current = [...mappingHistoryRef.current.slice(-49), previous]
        setCanUndo(true)
      }
      return next
    })
  }, [])

  const handleCreateCustomFieldForColumn = useCallback(
    (columnName: string, input: { label: string; section: DepositCustomFieldSection }) => {
      setMapping(previous => {
        const result = createCustomFieldForColumnV2(previous, columnName, input)
        const next = result.nextMapping
        if (next !== previous) {
          mappingHistoryRef.current = [...mappingHistoryRef.current.slice(-49), previous]
          setCanUndo(true)
        }
        return next
      })
    },
    [],
  )

  const handleUndoMapping = useCallback(() => {
    const history = mappingHistoryRef.current
    const previous = history.pop()
    mappingHistoryRef.current = history
    if (previous) {
      setMapping(previous)
    }
    setCanUndo(mappingHistoryRef.current.length > 0)
  }, [])

  const goToMapFields = () => setActiveStep('map-fields')
  const goToReview = () => setActiveStep('review')
  const goToCreateTemplate = () => setActiveStep('create-template')

  const { depositReceivedDate, distributorLabel, vendorLabel, commissionPeriod } = formState

  useEffect(() => {
    if (!depositReceivedDate) return

    const monthValue = depositReceivedDate.slice(0, 7)
    if (!monthValue) return

    setFormState(previous => {
      if (previous.commissionPeriod) return previous
      return { ...previous, commissionPeriod: monthValue }
    })
  }, [depositReceivedDate])

  useEffect(() => {
    const normalizedDate = depositReceivedDate?.trim() ?? ""
    const generated = [vendorLabel, distributorLabel, normalizedDate].filter(Boolean).join(" - ")
    setFormState(previous => (previous.depositName === generated ? previous : { ...previous, depositName: generated }))
  }, [depositReceivedDate, distributorLabel, vendorLabel])

  const mappedTargetCount = Object.keys(mapping.targets ?? {}).length

  const handleConfirmSubmit = async () => {
    if (!selectedFile) {
      setImportError('Please re-select the file before importing.')
      return
    }
    if (validationIssues.length > 0) {
      setImportError('Resolve the validation issues before importing.')
      return
    }
    if (parsedRowCount <= 0) {
      setImportError('No rows detected from the uploaded file.')
      return
    }
    if (mappedTargetCount <= 0) {
      setImportError('No mapped fields selected.')
      return
    }

    setImportSubmitting(true)
    setImportError(null)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('depositName', formState.depositName)
      formData.append('paymentDate', formState.depositReceivedDate)
      formData.append('commissionPeriod', formState.commissionPeriod)
      formData.append('distributorAccountId', formState.distributorAccountId)
      formData.append('vendorAccountId', formState.vendorAccountId)
      formData.append('reconciliationTemplateId', formState.templateId)
      formData.append('saveTemplateMapping', formState.saveTemplateMapping ? 'true' : 'false')
      formData.append('idempotencyKey', idempotencyKey)
      formData.append('createdByContactId', formState.createdByContactId)
      formData.append('mapping', JSON.stringify(mapping))
      formData.append('multiVendor', formState.multiVendor ? 'true' : 'false')

      const response = await fetch('/api/reconciliation/deposits/import', {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to import deposit')
      }

      const depositId = payload?.data?.depositId as string | undefined
      const depositIds = Array.isArray(payload?.data?.depositIds) ? (payload.data.depositIds as string[]) : undefined
      if (depositIds && depositIds.length > 0) {
        setImportResult({ depositIds })
        for (const id of depositIds) {
          router.prefetch(`/reconciliation/${id}`)
        }
      } else {
        setImportResult(depositId ? { depositId } : null)
        if (depositId) {
          router.prefetch(`/reconciliation/${depositId}`)
        }
      }
    } catch (error) {
      console.error('Deposit import failed', error)
      setImportError(error instanceof Error ? error.message : 'Failed to import deposit')
    } finally {
      setImportSubmitting(false)
    }
  }

  const requiredFieldsComplete =
    Boolean(mapping.targets?.[DEPOSIT_IMPORT_TARGET_IDS.usage]) ||
    Boolean(mapping.targets?.[DEPOSIT_IMPORT_TARGET_IDS.commission])
  const vendorColumnReady = !formState.multiVendor || Boolean(mapping.targets?.["depositLineItem.vendorNameRaw"])
  const multiVendorPreviewReady =
    !formState.multiVendor ||
    (!multiVendorPreviewLoading &&
      !multiVendorPreviewError &&
      multiVendorMissingVendors.length === 0 &&
      multiVendorVendorsMissingTemplates.length === 0)
  const canProceedFromMapFields =
    requiredFieldsComplete && vendorColumnReady && Boolean(csvHeaders.length) && !parsingError && multiVendorPreviewReady
  const canProceedFromCreateTemplate = Boolean(
    formState.depositReceivedDate &&
      formState.commissionPeriod &&
      formState.distributorAccountId &&
      (formState.multiVendor || formState.vendorAccountId) &&
      selectedFile,
  )

  const getBackButtonConfig = (): BackButtonConfig | null => {
    switch (activeStep) {
      case 'create-template':
        return null
      case 'map-fields':
        return null
      case 'review':
        return {
          label: 'Back to Map Fields',
          onClick: () => {
            setImportError(null)
            setImportResult(null)
            setActiveStep('map-fields')
          },
          disabled: importSubmitting,
        }
      default:
        return null
    }
  }

  const backButtonConfig = getBackButtonConfig()

  return (
    <div className="dashboard-page-container bg-gray-50">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 space-y-3 pb-24 md:p-4 md:space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {activeStep === 'map-fields' ? 'Deposit Upload - Field Mapping' : 'Deposit Reconciliation'}
              </h1>
            </div>
            {activeStep === 'map-fields' ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={goToCreateTemplate}
                  className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleUndoMapping}
                  disabled={!canUndo}
                  className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={goToReview}
                  disabled={!canProceedFromMapFields}
                  className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  Continue
                </button>
              </div>
            ) : activeStep === 'create-template' ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/reconciliation')}
                  className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={goToMapFields}
                  disabled={!canProceedFromCreateTemplate}
                  className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  Continue
                </button>
              </div>
            ) : backButtonConfig ? (
              <button
                type="button"
                onClick={backButtonConfig.onClick}
                disabled={backButtonConfig.disabled ?? false}
                className="inline-flex items-center self-start rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 md:self-auto"
              >
                {backButtonConfig.label}
              </button>
            ) : null}
          </div>

          {activeStep === 'create-template' ? (
            <CreateTemplateStep
              formState={formState}
              selectedFile={selectedFile}
              onFileChange={handleFileChange}
              onFormStateChange={updateFormState}
            />
          ) : null}

          {activeStep === 'map-fields' ? (
              <MapFieldsStep
                file={selectedFile}
                csvHeaders={csvHeaders}
                sampleRows={sampleRows}
                columnHasValuesByIndex={columnHasValuesByIndex}
                fieldCatalog={fieldCatalog}
                fieldCatalogError={fieldCatalogError}
                mapping={mapping}
                templateMapping={templateMapping}
                templateFields={templateFields}
                templateLabel={
                  formState.multiVendor
                    ? multiVendorTemplatesUsed.length > 0
                      ? `Templates Used (${multiVendorTemplatesUsed.length})`
                      : ''
                    : formState.templateLabel
                }
                multiVendor={formState.multiVendor}
                templatesUsed={multiVendorTemplatesUsed}
                previewWarnings={multiVendorPreviewWarnings}
                missingVendors={multiVendorMissingVendors}
                vendorsMissingTemplates={multiVendorVendorsMissingTemplates}
                previewError={multiVendorPreviewError}
                saveTemplateMapping={formState.saveTemplateMapping}
                onSaveTemplateMappingChange={value => updateFormState({ saveTemplateMapping: value })}
                parsingError={parsingError}
                onColumnSelectionChange={handleColumnSelectionChange}
                onCreateCustomField={handleCreateCustomFieldForColumn}
              />
            ) : null}

          {activeStep === 'review' ? (
            <ReviewStep
              csvHeaders={csvHeaders}
              sampleRows={sampleRows}
              mapping={mapping}
              fieldCatalog={fieldCatalog}
              validationIssues={validationIssues}
              totalRows={parsedRowCount}
              mappedFields={mappedTargetCount}
              submitting={importSubmitting}
              error={importError}
              result={importResult}
              onSubmit={handleConfirmSubmit}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
