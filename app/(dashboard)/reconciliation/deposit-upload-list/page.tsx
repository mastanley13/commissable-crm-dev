'use client'

import { useEffect, useState, useCallback, ChangeEvent, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useBreadcrumbs } from '@/lib/breadcrumb-context'
import { CreateTemplateStep } from '@/components/deposit-upload/create-template-step'
import { MapFieldsStep } from '@/components/deposit-upload/map-fields-step'
import { ReviewStep } from '@/components/deposit-upload/review-step'
import type { DepositUploadFormState } from '@/components/deposit-upload/types'
import { parseSpreadsheetFile } from '@/lib/deposit-import/parse-file'
import { DEPOSIT_IMPORT_TARGET_IDS, type DepositImportFieldTarget } from '@/lib/deposit-import/field-catalog'
import { shouldSkipMultiVendorRow } from '@/lib/deposit-import/multi-vendor'
import { filterMultiVendorPreviewRows } from '@/lib/deposit-import/multi-vendor-template-resolver'
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

interface MultiVendorTemplateOption {
  templateId: string
  templateName: string
  templateUpdatedAt: string
  vendorAccountId: string
  vendorAccountName: string
  vendorNamesInFile: string[]
  depositMappingV2: DepositMappingConfigV2 | null
  telarusTemplateFields: TelarusTemplateFieldsV1 | null
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
  const [multiVendorTemplateOptions, setMultiVendorTemplateOptions] = useState<MultiVendorTemplateOption[]>([])
  const [multiVendorSelectedTemplateId, setMultiVendorSelectedTemplateId] = useState<string>('')
  const [multiVendorMappingByTemplateId, setMultiVendorMappingByTemplateId] = useState<
    Record<string, DepositMappingConfigV2>
  >({})
  const [multiVendorSaveMappingByTemplateId, setMultiVendorSaveMappingByTemplateId] = useState<Record<string, boolean>>(
    {},
  )
  const [multiVendorMissingVendors, setMultiVendorMissingVendors] = useState<string[]>([])
  const [multiVendorVendorsMissingTemplates, setMultiVendorVendorsMissingTemplates] = useState<string[]>([])
  const [multiVendorPreviewWarnings, setMultiVendorPreviewWarnings] = useState<string[]>([])
  const [multiVendorPreviewError, setMultiVendorPreviewError] = useState<string | null>(null)
  const [multiVendorPreviewLoading, setMultiVendorPreviewLoading] = useState(false)
  const [validationIssues, setValidationIssues] = useState<string[]>([])
  const [multiVendorMissingRequiredModalOpen, setMultiVendorMissingRequiredModalOpen] = useState(false)
  const [multiVendorMissingRequiredItems, setMultiVendorMissingRequiredItems] = useState<
    Array<{
      templateId: string
      templateLabel: string
      missingRequiredLabels: string[]
    }>
  >([])
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ depositId?: string; depositIds?: string[] } | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey())
  const mappingHistoryRef = useRef<DepositMappingConfigV2[]>([])
  const multiVendorMappingHistoryRef = useRef<Record<string, DepositMappingConfigV2[]>>({})
  const [canUndo, setCanUndo] = useState(false)
  const parsedRowsRef = useRef<string[][]>([])
  const mappedVendorColumnName = (mapping.targets?.["depositLineItem.vendorNameRaw"] ?? '').trim()
  const mappedUsageColumnName = (mapping.targets?.[DEPOSIT_IMPORT_TARGET_IDS.usage] ?? '').trim()
  const mappedCommissionColumnName = (mapping.targets?.[DEPOSIT_IMPORT_TARGET_IDS.commission] ?? '').trim()
  const resolveHeader = useCallback((candidate: string) => {
    if (!candidate) return null
    if (csvHeaders.includes(candidate)) return candidate
    const lower = candidate.toLowerCase()
    const caseInsensitive = csvHeaders.find(header => header.toLowerCase() === lower)
    return caseInsensitive ?? null
  }, [csvHeaders])

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
    setMultiVendorMissingRequiredModalOpen(false)
    setMultiVendorMissingRequiredItems([])
    setMultiVendorTemplatesUsed([])
    setMultiVendorTemplateOptions([])
    setMultiVendorSelectedTemplateId('')
    setMultiVendorMappingByTemplateId({})
    setMultiVendorSaveMappingByTemplateId({})
    setMultiVendorMissingVendors([])
    setMultiVendorVendorsMissingTemplates([])
    setMultiVendorPreviewWarnings([])
    setMultiVendorPreviewError(null)
    setMultiVendorPreviewLoading(false)
    parsedRowsRef.current = []
    mappingHistoryRef.current = []
    multiVendorMappingHistoryRef.current = {}
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
        setMultiVendorTemplateOptions([])
        setMultiVendorSelectedTemplateId('')
        setMultiVendorMappingByTemplateId({})
        setMultiVendorSaveMappingByTemplateId({})
        setMultiVendorMissingVendors([])
        setMultiVendorVendorsMissingTemplates([])
        setMultiVendorPreviewWarnings([])
        setMultiVendorPreviewError(null)
        setMultiVendorPreviewLoading(false)
        mappingHistoryRef.current = []
        multiVendorMappingHistoryRef.current = {}
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
      setMultiVendorTemplateOptions([])
      setMultiVendorSelectedTemplateId('')
      setMultiVendorMappingByTemplateId({})
      setMultiVendorSaveMappingByTemplateId({})
      setMultiVendorMissingVendors([])
      setMultiVendorVendorsMissingTemplates([])
      setMultiVendorPreviewWarnings([])
      setMultiVendorPreviewError(null)
      setMultiVendorPreviewLoading(false)
      multiVendorMappingHistoryRef.current = {}
      return
    }

    const distributorAccountId = formState.distributorAccountId?.trim() ?? ''
    if (!selectedFile || !distributorAccountId || !csvHeaders.length || parsingError) {
      setMultiVendorTemplatesUsed([])
      setMultiVendorTemplateOptions([])
      setMultiVendorSelectedTemplateId('')
      setMultiVendorMappingByTemplateId({})
      setMultiVendorSaveMappingByTemplateId({})
      setMultiVendorMissingVendors([])
      setMultiVendorVendorsMissingTemplates([])
      setMultiVendorPreviewWarnings([])
      setMultiVendorPreviewError(null)
      setMultiVendorPreviewLoading(false)
      setTemplateMapping(null)
      setTemplateFields(null)
      multiVendorMappingHistoryRef.current = {}
      return
    }

    if (!mappedVendorColumnName) {
      setMultiVendorTemplatesUsed([])
      setMultiVendorTemplateOptions([])
      setMultiVendorSelectedTemplateId('')
      setMultiVendorMappingByTemplateId({})
      setMultiVendorSaveMappingByTemplateId({})
      setMultiVendorMissingVendors([])
      setMultiVendorVendorsMissingTemplates([])
      setMultiVendorPreviewWarnings([])
      setMultiVendorPreviewError(null)
      setMultiVendorPreviewLoading(false)
      setTemplateMapping(null)
      setTemplateFields(null)
      multiVendorMappingHistoryRef.current = {}
      return
    }

    const vendorNameIndex = csvHeaders.findIndex(header => header === mappedVendorColumnName)
    if (vendorNameIndex < 0) {
      setMultiVendorTemplatesUsed([])
      setMultiVendorTemplateOptions([])
      setMultiVendorSelectedTemplateId('')
      setMultiVendorMappingByTemplateId({})
      setMultiVendorSaveMappingByTemplateId({})
      setMultiVendorMissingVendors([])
      setMultiVendorVendorsMissingTemplates([])
      setMultiVendorPreviewWarnings([])
      setMultiVendorPreviewError('Unable to locate the mapped "Vendor Name" column in the uploaded file.')
      setMultiVendorPreviewLoading(false)
      setTemplateMapping(null)
      setTemplateFields(null)
      multiVendorMappingHistoryRef.current = {}
      return
    }

    const usageIndex = mappedUsageColumnName ? csvHeaders.findIndex(header => header === mappedUsageColumnName) : -1
    const commissionIndex = mappedCommissionColumnName
      ? csvHeaders.findIndex(header => header === mappedCommissionColumnName)
      : -1
    const shouldRequireAmounts = usageIndex >= 0 || commissionIndex >= 0

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

      const vendorNameRaw = typeof row[vendorNameIndex] === 'string' ? row[vendorNameIndex].trim() : String(row[vendorNameIndex] ?? '').trim()
      const vendorName = vendorNameRaw.length > 0 ? vendorNameRaw : null
      if (shouldSkipMultiVendorRow(row, vendorName)) {
        continue
      }

      if (shouldRequireAmounts) {
        const usageValue = usageIndex >= 0 ? normalizeNumber(row[usageIndex]) : null
        const commissionValue = commissionIndex >= 0 ? normalizeNumber(row[commissionIndex]) : null
        if (usageValue === null && commissionValue === null) {
          continue
        }
      }

      if (!vendorName) {
        if (shouldRequireAmounts) {
          if (missingVendorRows.length < 25) {
            missingVendorRows.push(rowIndex + 2)
          }
        }
        continue
      }
      vendorNamesSet.add(vendorName)
    }

    if (shouldRequireAmounts && missingVendorRows.length > 0) {
      const sampleRowNumbers = missingVendorRows.slice(0, 10).join(', ')
      setMultiVendorTemplatesUsed([])
      setMultiVendorTemplateOptions([])
      setMultiVendorSelectedTemplateId('')
      setMultiVendorMappingByTemplateId({})
      setMultiVendorSaveMappingByTemplateId({})
      setMultiVendorMissingVendors([])
      setMultiVendorVendorsMissingTemplates([])
      setMultiVendorPreviewWarnings([])
      setMultiVendorPreviewError(
        `Multi-vendor upload is missing vendor values in the mapped "Vendor Name" column (example row numbers: ${sampleRowNumbers}).`,
      )
      setMultiVendorPreviewLoading(false)
      setTemplateMapping(null)
      setTemplateFields(null)
      multiVendorMappingHistoryRef.current = {}
      return
    }

    const vendorNames = Array.from(vendorNamesSet)
    if (vendorNames.length === 0) {
      setMultiVendorTemplatesUsed([])
      setMultiVendorTemplateOptions([])
      setMultiVendorSelectedTemplateId('')
      setMultiVendorMappingByTemplateId({})
      setMultiVendorSaveMappingByTemplateId({})
      setMultiVendorMissingVendors([])
      setMultiVendorVendorsMissingTemplates([])
      setMultiVendorPreviewWarnings([])
      setMultiVendorPreviewError(
        shouldRequireAmounts
          ? 'No usable vendor rows were found from the mapped "Vendor Name" column.'
          : 'No vendor rows were found from the mapped "Vendor Name" column.',
      )
      setMultiVendorPreviewLoading(false)
      setTemplateMapping(null)
      setTemplateFields(null)
      multiVendorMappingHistoryRef.current = {}
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
        const templateOptions = Array.isArray(data.templateOptions)
          ? (data.templateOptions as MultiVendorTemplateOption[])
          : []
        const warnings = Array.isArray(data.warnings) ? (data.warnings as string[]) : []

        setMultiVendorTemplatesUsed(templatesUsed)
        setMultiVendorTemplateOptions(templateOptions)
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
        setMultiVendorTemplateOptions([])
        setMultiVendorSelectedTemplateId('')
        setMultiVendorMappingByTemplateId({})
        setMultiVendorSaveMappingByTemplateId({})
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
    csvHeaders,
    selectedFile,
    parsingError,
  ])

  useEffect(() => {
    if (!formState.multiVendor) {
      return
    }

    if (multiVendorTemplateOptions.length === 0) {
      setMultiVendorSelectedTemplateId('')
      setMultiVendorMappingByTemplateId({})
      setMultiVendorSaveMappingByTemplateId({})
      multiVendorMappingHistoryRef.current = {}
      return
    }

    const validTemplateIds = new Set(multiVendorTemplateOptions.map(option => option.templateId))

    setMultiVendorSelectedTemplateId(previous => {
      if (previous && validTemplateIds.has(previous)) {
        return previous
      }
      return multiVendorTemplateOptions[0]?.templateId ?? ''
    })

    const vendorNameHeader = resolveHeader(mappedVendorColumnName)
    const vendorTargetId = "depositLineItem.vendorNameRaw"

    setMultiVendorMappingByTemplateId(previous => {
      let changed = false
      const next: Record<string, DepositMappingConfigV2> = { ...previous }

      for (const existingTemplateId of Object.keys(next)) {
        if (!validTemplateIds.has(existingTemplateId)) {
          delete next[existingTemplateId]
          changed = true
        }
      }

      for (const option of multiVendorTemplateOptions) {
        if (next[option.templateId]) continue
        let seeded = seedDepositMappingV2({ headers: csvHeaders, templateMapping: option.depositMappingV2 })
        if (vendorNameHeader) {
          seeded = setColumnSelectionV2(seeded, vendorNameHeader, { type: "target", targetId: vendorTargetId })
        }
        next[option.templateId] = seeded
        changed = true
      }

      return changed ? next : previous
    })
  }, [
    formState.multiVendor,
    multiVendorTemplateOptions,
    csvHeaders,
    mappedVendorColumnName,
    resolveHeader,
  ])

  useEffect(() => {
    if (!formState.multiVendor) {
      return
    }

    if (!multiVendorSelectedTemplateId) {
      return
    }

    const nextMapping = multiVendorMappingByTemplateId[multiVendorSelectedTemplateId]
    if (!nextMapping) {
      return
    }

    setMapping(previous => (previous === nextMapping ? previous : nextMapping))

    const selectedOption =
      multiVendorTemplateOptions.find(option => option.templateId === multiVendorSelectedTemplateId) ?? null
    setTemplateMapping(selectedOption?.depositMappingV2 ?? null)
    setTemplateFields(selectedOption?.telarusTemplateFields ?? null)

    const history = multiVendorMappingHistoryRef.current[multiVendorSelectedTemplateId] ?? []
    setCanUndo(history.length > 0)
  }, [
    formState.multiVendor,
    multiVendorSelectedTemplateId,
    multiVendorMappingByTemplateId,
    multiVendorTemplateOptions,
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
        if (formState.multiVendor && multiVendorSelectedTemplateId) {
          const previousVendorNameColumn = (previous.targets?.["depositLineItem.vendorNameRaw"] ?? "").trim()
          const nextVendorNameColumn = (next.targets?.["depositLineItem.vendorNameRaw"] ?? "").trim()
          const vendorNameTargetId = "depositLineItem.vendorNameRaw"

          const history = multiVendorMappingHistoryRef.current[multiVendorSelectedTemplateId] ?? []
          multiVendorMappingHistoryRef.current[multiVendorSelectedTemplateId] = [...history.slice(-49), previous]
          setCanUndo(true)
          setMultiVendorMappingByTemplateId(existing => {
            const updated: Record<string, DepositMappingConfigV2> = {
              ...existing,
              [multiVendorSelectedTemplateId]: next,
            }

            if (nextVendorNameColumn && nextVendorNameColumn !== previousVendorNameColumn) {
              for (const [templateId, templateMapping] of Object.entries(updated)) {
                if (templateId === multiVendorSelectedTemplateId) continue
                updated[templateId] = setColumnSelectionV2(templateMapping, nextVendorNameColumn, {
                  type: "target",
                  targetId: vendorNameTargetId,
                })
              }
            }

            return updated
          })
        } else {
          mappingHistoryRef.current = [...mappingHistoryRef.current.slice(-49), previous]
          setCanUndo(true)
        }
      }
      return next
    })
  }, [formState.multiVendor, multiVendorSelectedTemplateId])

  const handleCreateCustomFieldForColumn = useCallback(
    (columnName: string, input: { label: string; section: DepositCustomFieldSection }) => {
      setMapping(previous => {
        const result = createCustomFieldForColumnV2(previous, columnName, input)
        const next = result.nextMapping
        if (next !== previous) {
          if (formState.multiVendor && multiVendorSelectedTemplateId) {
            const history = multiVendorMappingHistoryRef.current[multiVendorSelectedTemplateId] ?? []
            multiVendorMappingHistoryRef.current[multiVendorSelectedTemplateId] = [...history.slice(-49), previous]
            setCanUndo(true)
            setMultiVendorMappingByTemplateId(existing => {
              if (existing[multiVendorSelectedTemplateId] === next) return existing
              return { ...existing, [multiVendorSelectedTemplateId]: next }
            })
          } else {
            mappingHistoryRef.current = [...mappingHistoryRef.current.slice(-49), previous]
            setCanUndo(true)
          }
        }
        return next
      })
    },
    [formState.multiVendor, multiVendorSelectedTemplateId],
  )

  const handleUndoMapping = useCallback(() => {
    if (formState.multiVendor && multiVendorSelectedTemplateId) {
      const history = multiVendorMappingHistoryRef.current[multiVendorSelectedTemplateId] ?? []
      const previous = history.pop()
      multiVendorMappingHistoryRef.current[multiVendorSelectedTemplateId] = history
      if (previous) {
        setMapping(previous)
        setMultiVendorMappingByTemplateId(existing => ({ ...existing, [multiVendorSelectedTemplateId]: previous }))
      }
      setCanUndo(history.length > 0)
      return
    }

    const history = mappingHistoryRef.current
    const previous = history.pop()
    mappingHistoryRef.current = history
    if (previous) {
      setMapping(previous)
    }
    setCanUndo(mappingHistoryRef.current.length > 0)
  }, [formState.multiVendor, multiVendorSelectedTemplateId])

  const goToMapFields = () => setActiveStep('map-fields')
  const goToReview = () => {
    if (formState.multiVendor && multiVendorTemplateOptions.length > 0) {
      const missing = multiVendorTemplateOptions
        .map(option => {
          const completion = multiVendorCompletionByTemplateId[option.templateId]
          if (!completion || completion.complete) return null
          return {
            templateId: option.templateId,
            templateLabel: `${option.vendorAccountName} — ${option.templateName}`,
            missingRequiredLabels: completion.missingRequiredLabels,
          }
        })
        .filter(Boolean) as Array<{
        templateId: string
        templateLabel: string
        missingRequiredLabels: string[]
      }>

      if (missing.length > 0) {
        setMultiVendorMissingRequiredItems(missing)
        setMultiVendorMissingRequiredModalOpen(true)
        return
      }
    }

    setActiveStep('review')
  }
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

  const multiVendorCompletionByTemplateId = useMemo(() => {
    if (!formState.multiVendor) {
      return {} as Record<string, { complete: boolean; missingRequiredLabels: string[] }>
    }

    const usageLabel =
      fieldCatalog.find(target => target.id === DEPOSIT_IMPORT_TARGET_IDS.usage)?.label ?? "Actual Usage"
    const commissionLabel =
      fieldCatalog.find(target => target.id === DEPOSIT_IMPORT_TARGET_IDS.commission)?.label ?? "Actual Commission"
    const vendorNameLabel =
      fieldCatalog.find(target => target.id === "depositLineItem.vendorNameRaw")?.label ?? "Vendor Name"

    const completion: Record<string, { complete: boolean; missingRequiredLabels: string[] }> = {}
    for (const option of multiVendorTemplateOptions) {
      const templateMapping =
        multiVendorMappingByTemplateId[option.templateId] ??
        (option.templateId === multiVendorSelectedTemplateId ? mapping : undefined)
      const missing: string[] = []

      const hasVendorName = Boolean(templateMapping?.targets?.["depositLineItem.vendorNameRaw"])
      if (!hasVendorName) {
        missing.push(vendorNameLabel)
      }

      const hasUsage = Boolean(templateMapping?.targets?.[DEPOSIT_IMPORT_TARGET_IDS.usage])
      const hasCommission = Boolean(templateMapping?.targets?.[DEPOSIT_IMPORT_TARGET_IDS.commission])
      if (!hasUsage && !hasCommission) {
        missing.push(`${usageLabel} or ${commissionLabel}`)
      }

      completion[option.templateId] = { complete: missing.length === 0, missingRequiredLabels: missing }
    }
    return completion
  }, [
    formState.multiVendor,
    fieldCatalog,
    multiVendorTemplateOptions,
    multiVendorMappingByTemplateId,
    multiVendorSelectedTemplateId,
    mapping,
  ])

  const selectedMultiVendorTemplateOption =
    formState.multiVendor && multiVendorSelectedTemplateId
      ? multiVendorTemplateOptions.find(option => option.templateId === multiVendorSelectedTemplateId) ?? null
      : null

  const multiVendorPreviewRowsByTemplateId = useMemo(() => {
    if (!formState.multiVendor || multiVendorTemplateOptions.length === 0 || csvHeaders.length === 0) {
      return {} as Record<string, string[][]>
    }

    const rowsByTemplateId: Record<string, string[][]> = {}

    for (const option of multiVendorTemplateOptions) {
      const templateMapping =
        multiVendorMappingByTemplateId[option.templateId] ??
        seedDepositMappingV2({ headers: csvHeaders, templateMapping: option.depositMappingV2 })

      const vendorHeader = resolveHeader(
        (templateMapping.targets?.["depositLineItem.vendorNameRaw"] ?? mappedVendorColumnName).trim(),
      )
      const usageHeader = resolveHeader((templateMapping.targets?.[DEPOSIT_IMPORT_TARGET_IDS.usage] ?? '').trim())
      const commissionHeader = resolveHeader(
        (templateMapping.targets?.[DEPOSIT_IMPORT_TARGET_IDS.commission] ?? '').trim(),
      )

      const vendorNameIndex = vendorHeader ? csvHeaders.findIndex(header => header === vendorHeader) : -1
      const usageIndex = usageHeader ? csvHeaders.findIndex(header => header === usageHeader) : -1
      const commissionIndex = commissionHeader ? csvHeaders.findIndex(header => header === commissionHeader) : -1

      rowsByTemplateId[option.templateId] =
        vendorNameIndex >= 0
          ? filterMultiVendorPreviewRows({
              rows: parsedRowsRef.current,
              vendorNameIndex,
              vendorNamesInFile: option.vendorNamesInFile,
              usageIndex: usageIndex >= 0 ? usageIndex : undefined,
              commissionIndex: commissionIndex >= 0 ? commissionIndex : undefined,
              maxRows: 25,
            })
          : []
    }

    return rowsByTemplateId
  }, [
    formState.multiVendor,
    multiVendorTemplateOptions,
    multiVendorMappingByTemplateId,
    csvHeaders,
    mappedVendorColumnName,
    resolveHeader,
  ])

  const mapFieldsSampleRows = useMemo(() => {
    if (!formState.multiVendor) {
      return sampleRows
    }
    if (!multiVendorSelectedTemplateId || multiVendorTemplateOptions.length === 0) {
      return sampleRows
    }
    return multiVendorPreviewRowsByTemplateId[multiVendorSelectedTemplateId] ?? []
  }, [
    formState.multiVendor,
    sampleRows,
    multiVendorSelectedTemplateId,
    multiVendorTemplateOptions.length,
    multiVendorPreviewRowsByTemplateId,
  ])

  const multiVendorActiveTemplateLabel = formState.multiVendor
    ? selectedMultiVendorTemplateOption
      ? `${selectedMultiVendorTemplateOption.vendorAccountName} — ${selectedMultiVendorTemplateOption.templateName}`
      : multiVendorTemplatesUsed.length > 0
        ? `Templates Used (${multiVendorTemplatesUsed.length})`
        : ''
    : formState.templateLabel

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
      if (formState.multiVendor) {
        const mappingsByTemplateId: Record<string, DepositMappingConfigV2> = {}
        for (const option of multiVendorTemplateOptions) {
          const templateMapping =
            multiVendorMappingByTemplateId[option.templateId] ??
            (option.templateId === multiVendorSelectedTemplateId ? mapping : null)
          if (templateMapping) {
            mappingsByTemplateId[option.templateId] = templateMapping
          }
        }

        formData.append(
          'mapping',
          JSON.stringify({
            version: 'multiVendorV1',
            mappingsByTemplateId,
            saveUpdatesByTemplateId: multiVendorSaveMappingByTemplateId,
          }),
        )
      } else {
        formData.append('mapping', JSON.stringify(mapping))
      }
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
  const baseMapFieldsReady =
    vendorColumnReady && Boolean(csvHeaders.length) && !parsingError && multiVendorPreviewReady
  const canProceedFromMapFields = formState.multiVendor
    ? baseMapFieldsReady && multiVendorTemplateOptions.length > 0 && Boolean(multiVendorSelectedTemplateId)
    : baseMapFieldsReady && requiredFieldsComplete
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
      {multiVendorMissingRequiredModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-3"
          onClick={() => setMultiVendorMissingRequiredModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Required mappings</p>
                <h2 className="text-lg font-semibold text-gray-900">Finish template mapping</h2>
              </div>
              <button
                type="button"
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setMultiVendorMissingRequiredModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-gray-700">
                Complete the required mappings for all templates before continuing.
              </p>

              <div className="max-h-80 overflow-y-auto space-y-2">
                {multiVendorMissingRequiredItems.map(item => (
                  <div key={item.templateId} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold text-gray-900" title={item.templateLabel}>
                          {item.templateLabel}
                        </p>
                        <p className="text-xs text-gray-700">
                          Missing: {item.missingRequiredLabels.join(", ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
                        onClick={() => {
                          setMultiVendorSelectedTemplateId(item.templateId)
                          setMultiVendorMissingRequiredModalOpen(false)
                        }}
                      >
                        Go to template
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  onClick={() => setMultiVendorMissingRequiredModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
                sampleRows={mapFieldsSampleRows}
                columnHasValuesByIndex={columnHasValuesByIndex}
                fieldCatalog={fieldCatalog}
                fieldCatalogError={fieldCatalogError}
                mapping={mapping}
                templateMapping={templateMapping}
                templateFields={templateFields}
                templateLabel={multiVendorActiveTemplateLabel}
                multiVendor={formState.multiVendor}
                templatesUsed={multiVendorTemplatesUsed}
                multiVendorTemplateOptions={multiVendorTemplateOptions}
                multiVendorSelectedTemplateId={multiVendorSelectedTemplateId}
                onMultiVendorSelectedTemplateIdChange={setMultiVendorSelectedTemplateId}
                multiVendorCompletionByTemplateId={multiVendorCompletionByTemplateId}
                previewWarnings={multiVendorPreviewWarnings}
                missingVendors={multiVendorMissingVendors}
                vendorsMissingTemplates={multiVendorVendorsMissingTemplates}
                previewError={multiVendorPreviewError}
                saveTemplateMapping={
                  formState.multiVendor && multiVendorSelectedTemplateId
                    ? Boolean(multiVendorSaveMappingByTemplateId[multiVendorSelectedTemplateId])
                    : formState.saveTemplateMapping
                }
                onSaveTemplateMappingChange={value => {
                  if (formState.multiVendor) {
                    if (!multiVendorSelectedTemplateId) return
                    setMultiVendorSaveMappingByTemplateId(previous => ({
                      ...previous,
                      [multiVendorSelectedTemplateId]: value,
                    }))
                    return
                  }
                  updateFormState({ saveTemplateMapping: value })
                }}
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
