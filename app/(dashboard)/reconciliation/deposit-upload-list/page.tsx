'use client'

import { useEffect, useState, useCallback, ChangeEvent, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useBreadcrumbs } from '@/lib/breadcrumb-context'
import { CreateTemplateStep } from '@/components/deposit-upload/create-template-step'
import { MapFieldsStep } from '@/components/deposit-upload/map-fields-step'
import { ReviewStep } from '@/components/deposit-upload/review-step'
import { ConfirmStep } from '@/components/deposit-upload/confirm-step'
import type { DepositUploadFormState } from '@/components/deposit-upload/types'
import { parseSpreadsheetFile } from '@/lib/deposit-import/parse-file'
import { depositFieldDefinitions, requiredDepositFieldIds } from '@/lib/deposit-import/fields'
import {
  createEmptyDepositMapping,
  seedDepositMapping,
  setColumnSelection,
  createCustomFieldForColumn,
  extractDepositMappingFromTemplateConfig,
  type DepositMappingConfigV1,
  type DepositColumnSelection,
  type DepositCustomFieldSection,
} from '@/lib/deposit-import/template-mapping'
import {
  extractTelarusTemplateFieldsFromTemplateConfig,
  stripTelarusGeneratedCustomFields,
  type TelarusTemplateFieldsV1,
} from '@/lib/deposit-import/telarus-template-fields'

type WizardStep = 'create-template' | 'map-fields' | 'review' | 'confirm'

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
}

export default function DepositUploadListPage() {
  const { setBreadcrumbs } = useBreadcrumbs()
  const router = useRouter()

  const [activeStep, setActiveStep] = useState<WizardStep>('create-template')
  const [formState, setFormState] = useState<DepositUploadFormState>(initialFormState)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [sampleRows, setSampleRows] = useState<string[][]>([])
  const [parsedRowCount, setParsedRowCount] = useState(0)
  const [parsingError, setParsingError] = useState<string | null>(null)
  const [mapping, setMapping] = useState<DepositMappingConfigV1>(() => createEmptyDepositMapping())
  const [templateMapping, setTemplateMapping] = useState<DepositMappingConfigV1 | null>(null)
  const [templateFields, setTemplateFields] = useState<TelarusTemplateFieldsV1 | null>(null)
  const [validationIssues, setValidationIssues] = useState<string[]>([])
  const [importSummary, setImportSummary] = useState<{ totalRows: number; mappedFields: number } | null>(null)
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ depositId: string } | null>(null)
  const mappingHistoryRef = useRef<DepositMappingConfigV1[]>([])
  const [canUndo, setCanUndo] = useState(false)

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

  const updateFormState = useCallback((updates: Partial<DepositUploadFormState>) => {
    setFormState(previous => ({ ...previous, ...updates }))
  }, [])

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
    setMapping(createEmptyDepositMapping())
    setTemplateMapping(null)
    setTemplateFields(null)
    setCsvHeaders([])
    setSampleRows([])
    setParsedRowCount(0)
    setParsingError(null)
    setImportError(null)
    setImportResult(null)
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
        setCsvHeaders(headers)
        setSampleRows(parsed.rows.slice(0, 25))
        setParsedRowCount(parsed.rows.length)
        mappingHistoryRef.current = []
        setCanUndo(false)

        let templateMapping: DepositMappingConfigV1 | null = null
        let templateFields: TelarusTemplateFieldsV1 | null = null
        const distributorAccountId = formState.distributorAccountId?.trim() ?? ''
        const vendorAccountId = formState.vendorAccountId?.trim() ?? ''
        const templateId = formState.templateId?.trim() ?? ''

        if (templateId && distributorAccountId && vendorAccountId) {
          try {
            const response = await fetch(`/api/reconciliation/templates/${encodeURIComponent(templateId)}`, {
              cache: 'no-store',
            })
            if (response.ok) {
              const payload = await response.json().catch(() => null)
              const rawConfig = payload?.data?.config
              if (rawConfig) {
                templateMapping = stripTelarusGeneratedCustomFields(extractDepositMappingFromTemplateConfig(rawConfig))
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
        setMapping(seedDepositMapping({ headers, templateMapping }))
        setFormState(previous => {
          if (previous.saveTemplateMapping) return previous
          const defaultSave = Boolean(previous.templateId) && !templateMapping
          return previous.saveTemplateMapping === defaultSave ? previous : { ...previous, saveTemplateMapping: defaultSave }
        })
      } catch (error) {
        if (cancelled) return
        console.error('Unable to parse file', error)
        setCsvHeaders([])
        setSampleRows([])
        setParsedRowCount(0)
        setParsingError(error instanceof Error ? error.message : 'Unable to read file')
        setMapping(createEmptyDepositMapping())
        setTemplateMapping(null)
        setTemplateFields(null)
        mappingHistoryRef.current = []
        setCanUndo(false)
      }
    }
    void parse()
    return () => {
      cancelled = true
    }
  }, [selectedFile, formState.distributorAccountId, formState.vendorAccountId, formState.templateId])

  useEffect(() => {
    const canonicalFieldMapping: Record<string, string> = Object.entries(mapping.line ?? {}).reduce(
      (acc, [fieldId, columnName]) => {
        if (typeof columnName === 'string' && columnName.trim()) {
          acc[fieldId] = columnName
        }
        return acc
      },
      {} as Record<string, string>,
    )

    const issues: string[] = []
    requiredDepositFieldIds.forEach(fieldId => {
      if (!canonicalFieldMapping[fieldId]) {
        const label = depositFieldDefinitions.find(field => field.id === fieldId)?.label ?? fieldId
        issues.push(`Map the "${label}" field`)
      }
    })
    if (!selectedFile) {
      issues.push('Select a CSV or Excel file to continue.')
    }
    if (parsingError) {
      issues.push('Resolve the file parsing error before continuing.')
    }
    if (selectedFile && parsedRowCount === 0 && !parsingError) {
      issues.push('No data rows were detected in the uploaded file.')
    }
    setValidationIssues(issues)
  }, [mapping, selectedFile, parsingError, parsedRowCount])

  const handleColumnSelectionChange = useCallback((columnName: string, selection: DepositColumnSelection) => {
    setMapping(previous => {
      const next = setColumnSelection(previous, columnName, selection)
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
        const result = createCustomFieldForColumn(previous, columnName, input)
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

  const handleCancelMapping = useCallback(() => {
    setSelectedFile(null)
    setCsvHeaders([])
    setSampleRows([])
    setParsedRowCount(0)
    setParsingError(null)
    setTemplateMapping(null)
    setTemplateFields(null)
    setMapping(createEmptyDepositMapping())
    setImportError(null)
    setImportResult(null)
    setImportSummary(null)
    mappingHistoryRef.current = []
    setCanUndo(false)
    setActiveStep('create-template')
  }, [])

  const goToMapFields = () => setActiveStep('map-fields')
  const goToReview = () => setActiveStep('review')
  const goToConfirm = () => setActiveStep('confirm')
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

  const canonicalFieldMapping: Record<string, string> = Object.entries(mapping.line ?? {}).reduce(
    (acc, [fieldId, columnName]) => {
      if (typeof columnName === 'string' && columnName.trim()) {
        acc[fieldId] = columnName
      }
      return acc
    },
    {} as Record<string, string>,
  )

  const handleProceedFromReview = () => {
    setImportSummary({
      totalRows: parsedRowCount,
      mappedFields: Object.keys(canonicalFieldMapping).length,
    })
    goToConfirm()
  }

  const handleConfirmSubmit = async () => {
    if (!selectedFile) {
      setImportError('Please re-select the file before importing.')
      return
    }
    if (!importSummary) {
      setImportError('Review the data before importing.')
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
      formData.append('createdByContactId', formState.createdByContactId)
      formData.append('mapping', JSON.stringify(mapping))

      const response = await fetch('/api/reconciliation/deposits/import', {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to import deposit')
      }

      const depositId = payload?.data?.depositId as string | undefined
      setImportResult(depositId ? { depositId } : null)
      if (depositId) {
        router.prefetch(`/reconciliation/${depositId}`)
      }
    } catch (error) {
      console.error('Deposit import failed', error)
      setImportError(error instanceof Error ? error.message : 'Failed to import deposit')
    } finally {
      setImportSubmitting(false)
    }
  }

  const handleBackToReview = () => {
    setImportError(null)
    setImportResult(null)
    setActiveStep('review')
  }

  const requiredFieldsComplete = requiredDepositFieldIds.every(fieldId => Boolean(canonicalFieldMapping[fieldId]))

  const getBackButtonConfig = () => {
    switch (activeStep) {
      case 'create-template':
        return {
          label: 'Back to Reconciliation',
          onClick: () => router.push('/reconciliation'),
        }
      case 'map-fields':
        return {
          label: 'Back to Create Deposit',
          onClick: goToCreateTemplate,
        }
      case 'review':
        return {
          label: 'Back to Map Fields',
          onClick: () => setActiveStep('map-fields'),
        }
      case 'confirm':
        return {
          label: 'Back to Review',
          onClick: handleBackToReview,
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
              <h1 className="text-lg font-semibold text-gray-900">Deposit Reconciliation</h1>
            </div>
            {backButtonConfig ? (
              <button
                type="button"
                onClick={backButtonConfig.onClick}
                disabled={backButtonConfig.disabled}
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
              onProceed={goToMapFields}
              onFormStateChange={updateFormState}
            />
          ) : null}

          {activeStep === 'map-fields' ? (
            <MapFieldsStep
              file={selectedFile}
              csvHeaders={csvHeaders}
              sampleRows={sampleRows}
              mapping={mapping}
              templateMapping={templateMapping}
              templateFields={templateFields}
              templateLabel={formState.templateLabel}
              saveTemplateMapping={formState.saveTemplateMapping}
              onSaveTemplateMappingChange={value => updateFormState({ saveTemplateMapping: value })}
              parsingError={parsingError}
              onColumnSelectionChange={handleColumnSelectionChange}
              onCreateCustomField={handleCreateCustomFieldForColumn}
              canUndo={canUndo}
              onUndo={handleUndoMapping}
              onCancel={handleCancelMapping}
              onBack={goToCreateTemplate}
              canProceed={requiredFieldsComplete && Boolean(csvHeaders.length) && !parsingError}
              onProceed={goToReview}
            />
          ) : null}

          {activeStep === 'review' ? (
            <ReviewStep
              csvHeaders={csvHeaders}
              sampleRows={sampleRows}
              fieldMapping={canonicalFieldMapping}
              validationIssues={validationIssues}
              onBack={goToMapFields}
              onProceed={handleProceedFromReview}
            />
          ) : null}

          {activeStep === 'confirm' ? (
            <ConfirmStep
              importSummary={importSummary}
              submitting={importSubmitting}
              error={importError}
              result={importResult}
              onBack={goToReview}
              onSubmit={handleConfirmSubmit}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
