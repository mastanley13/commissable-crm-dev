'use client'

import { useEffect, useState, useCallback, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Stepper } from '@/components/stepper'
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

type WizardStep = 'create-template' | 'map-fields' | 'review' | 'confirm'

const steps = [
  { id: 'create-template', label: 'Create Deposit' },
  { id: 'map-fields', label: 'Map Fields' },
  { id: 'review', label: 'Review' },
  { id: 'confirm', label: 'Confirm' },
]

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
  const [validationIssues, setValidationIssues] = useState<string[]>([])
  const [importSummary, setImportSummary] = useState<{ totalRows: number; mappedFields: number } | null>(null)
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ depositId: string } | null>(null)

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
    setCsvHeaders([])
    setSampleRows([])
    setParsedRowCount(0)
    setParsingError(null)
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
        setSampleRows(parsed.rows.slice(0, 5))
        setParsedRowCount(parsed.rows.length)

        let templateMapping: DepositMappingConfigV1 | null = null
        const distributorAccountId = formState.distributorAccountId?.trim() ?? ''
        const vendorAccountId = formState.vendorAccountId?.trim() ?? ''

        if (distributorAccountId && vendorAccountId) {
          try {
            const params = new URLSearchParams({
              distributorAccountId,
              vendorAccountId,
              pageSize: '1',
            })
            const response = await fetch(`/api/reconciliation/templates?${params.toString()}`, {
              cache: 'no-store',
            })
            if (response.ok) {
              const payload = await response.json().catch(() => null)
              const rawConfig = payload?.data?.[0]?.config
              if (rawConfig) {
                templateMapping = extractDepositMappingFromTemplateConfig(rawConfig)
              }
            } else {
              // Soft-fail on template lookup; fall back to auto-mapping only.
              console.warn('Template lookup failed for deposit upload mapping')
            }
          } catch (error) {
            console.error('Unable to load reconciliation template for deposit upload', error)
          }
        }

        setMapping(seedDepositMapping({ headers, templateMapping }))
      } catch (error) {
        if (cancelled) return
        console.error('Unable to parse file', error)
        setCsvHeaders([])
        setSampleRows([])
        setParsedRowCount(0)
        setParsingError(error instanceof Error ? error.message : 'Unable to read file')
        setMapping(createEmptyDepositMapping())
      }
    }
    void parse()
    return () => {
      cancelled = true
    }
  }, [selectedFile, formState.distributorAccountId, formState.vendorAccountId])

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
    setMapping(previous => setColumnSelection(previous, columnName, selection))
  }, [])

  const handleCreateCustomFieldForColumn = useCallback(
    (columnName: string, input: { label: string; section: DepositCustomFieldSection }) => {
      setMapping(previous => createCustomFieldForColumn(previous, columnName, input).nextMapping)
    },
    [],
  )

  const goToMapFields = () => setActiveStep('map-fields')
  const goToReview = () => setActiveStep('review')
  const goToConfirm = () => setActiveStep('confirm')
  const goToCreateTemplate = () => setActiveStep('create-template')

  const { depositReceivedDate, distributorLabel, vendorLabel, commissionPeriod } = formState

  useEffect(() => {
    if (depositReceivedDate && !commissionPeriod) {
      const monthValue = depositReceivedDate.slice(0, 7)
      if (monthValue) {
        setFormState(previous =>
          previous.commissionPeriod === monthValue ? previous : { ...previous, commissionPeriod: monthValue },
        )
      }
    }
  }, [depositReceivedDate, commissionPeriod])

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

  return (
    <div className="dashboard-page-container bg-gray-50">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-4 pb-28 md:p-6 md:space-y-5">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Deposit Reconciliation</h1>
            <p className="text-sm text-gray-600 mt-1">
              Upload deposit files, map fields, and confirm reconciliation in four guided steps.
            </p>
          </div>

          <div className="pb-2">
            <Stepper steps={steps} activeStepId={activeStep} />
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
              parsingError={parsingError}
              onColumnSelectionChange={handleColumnSelectionChange}
              onCreateCustomField={handleCreateCustomFieldForColumn}
              canProceed={requiredFieldsComplete && Boolean(csvHeaders.length) && !parsingError}
              onBack={goToCreateTemplate}
              onProceed={goToReview}
            />
          ) : null}

          {activeStep === 'review' ? (
            <ReviewStep
              csvHeaders={csvHeaders}
              sampleRows={sampleRows}
              fieldMapping={canonicalFieldMapping}
              validationIssues={validationIssues}
              onBack={() => setActiveStep('map-fields')}
              onProceed={handleProceedFromReview}
            />
          ) : null}

          {activeStep === 'confirm' ? (
            <ConfirmStep
              importSummary={importSummary}
              submitting={importSubmitting}
              error={importError}
              result={importResult}
              onBack={handleBackToReview}
              onSubmit={handleConfirmSubmit}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
