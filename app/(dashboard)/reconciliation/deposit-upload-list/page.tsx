'use client'

import { useEffect, useState, ChangeEvent, ReactNode, useCallback } from 'react'
import { Stepper } from '@/components/stepper'
import { Upload, Plus, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useBreadcrumbs } from '@/lib/breadcrumb-context'
import { useAuth } from '@/lib/auth-context'

interface FormState {
  depositName: string
  customer: string
  date: string
  createdByContactId: string
  createdByLabel: string
  distributorAccountId: string
  distributorLabel: string
  vendorAccountId: string
  vendorLabel: string
  templateId: string
  templateLabel: string
}

interface ContactOption {
  value: string
  label: string
  subtitle?: string
}

interface AccountOption {
  value: string
  label: string
  detail?: string
}

interface TemplateResponse {
  id: string
  name: string
  distributorName: string
  vendorName: string
  description?: string
  config?: Record<string, unknown> | null
}

interface TemplateDetail extends TemplateResponse {
  createdByContactId?: string | null
  createdByContactName?: string | null
  createdByUserId?: string
  createdByUserName?: string | null
}

interface TemplateOption {
  value: string
  label: string
  helper: string
}
const formatTemplateOption = (template: TemplateResponse): TemplateOption => ({
  value: template.id,
  label: template.name,
  helper: `${template.distributorName || 'Distributor'} • ${template.vendorName || 'Vendor'}`
})

const steps = [
  { id: 'create-template', label: 'Create Template' },
  { id: 'map-fields', label: 'Map Fields' },
  { id: 'review', label: 'Review' },
  { id: 'confirm', label: 'Confirm' },
]

const customers = ['Testing Account 1', 'Customer Account 1', 'Algave LLC']

export default function DepositUploadListPage() {
  const [activeStep, setActiveStep] = useState<string>('create-template')
  const [formState, setFormState] = useState<FormState>({
    depositName: '',
    customer: '',
    date: '',
    createdByContactId: '',
    createdByLabel: '',
    distributorAccountId: '',
    distributorLabel: '',
    vendorAccountId: '',
    vendorLabel: '',
    templateId: '',
    templateLabel: '',
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [templateDetails, setTemplateDetails] = useState<TemplateDetail | null>(null)
  const [templateDetailsLoading, setTemplateDetailsLoading] = useState(false)
  const [templateDetailsError, setTemplateDetailsError] = useState<string | null>(null)

  const { setBreadcrumbs } = useBreadcrumbs()

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

  const updateFormState = useCallback((updates: Partial<FormState>) => {
    setFormState(prev => ({ ...prev, ...updates }))
  }, [])

  const handleInputChange = (field: 'depositName' | 'customer' | 'date') => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.value
    updateFormState({ [field]: value } as Partial<FormState>)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setSelectedFile(file || null)
  }

  const handleProceed = () => {
    setActiveStep('map-fields')
  }

  const handleBackToTemplate = () => {
    setActiveStep('create-template')
  }

  useEffect(() => {
    if (!formState.templateId) {
      setTemplateDetails(null)
      setTemplateDetailsLoading(false)
      setTemplateDetailsError(null)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const loadTemplateDetails = async () => {
      setTemplateDetailsLoading(true)
      setTemplateDetailsError(null)
      try {
        const response = await fetch(`/api/reconciliation/templates/${formState.templateId}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load template details')
        }

        if (!payload?.data || cancelled) {
          return
        }
        setTemplateDetails(payload.data as TemplateDetail)
      } catch (error: any) {
        if (cancelled) {
          return
        }
        console.error('Unable to load reconciliation template details', error)
        setTemplateDetails(null)
        setTemplateDetailsError(error?.message || 'Unable to load template details')
      } finally {
        if (!cancelled) {
          setTemplateDetailsLoading(false)
        }
      }
    }

    void loadTemplateDetails()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [formState.templateId])

  return (
    <div className="dashboard-page-container bg-gray-50 min-h-screen">
      <div className="p-4 space-y-4 pb-28 md:p-6 md:space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Deposit Reconciliation</h1>
          <p className="text-sm text-gray-600 mt-1">
            Upload deposit files, map fields, and confirm reconciliation in four guided steps.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5">
          <Stepper steps={steps} activeStepId={activeStep} />
        </div>

        {activeStep === 'create-template' ? (
          <CreateTemplateStep
            formState={formState}
            selectedFile={selectedFile}
            onInputChange={handleInputChange}
            onFileChange={handleFileChange}
            onProceed={handleProceed}
            onFormStateChange={updateFormState}
            templateDetails={templateDetails}
            templateDetailsLoading={templateDetailsLoading}
            templateDetailsError={templateDetailsError}
          />
        ) : (
          <MapFieldsPlaceholder
            onBack={handleBackToTemplate}
            templateDetails={templateDetails}
            templateDetailsLoading={templateDetailsLoading}
            templateDetailsError={templateDetailsError}
          />
        )}
      </div>
    </div>
  )
}

interface CreateTemplateStepProps {
  formState: FormState
  selectedFile: File | null
  onInputChange: (field: 'depositName' | 'customer' | 'date') => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onProceed: () => void
  onFormStateChange: (updates: Partial<FormState>) => void
  templateDetails: TemplateDetail | null
  templateDetailsLoading: boolean
  templateDetailsError: string | null
}

function CreateTemplateStep({
  formState,
  selectedFile,
  onInputChange,
  onFileChange,
  onProceed,
  onFormStateChange,
  templateDetails,
  templateDetailsLoading,
  templateDetailsError,
}: CreateTemplateStepProps) {
  const { user } = useAuth()
  const [createdByQuery, setCreatedByQuery] = useState(formState.createdByLabel)
  const [createdByOptions, setCreatedByOptions] = useState<ContactOption[]>([])
  const [createdByLoading, setCreatedByLoading] = useState(false)
  const [showCreatedByDropdown, setShowCreatedByDropdown] = useState(false)
  const [shouldAutoFillCreatedBy, setShouldAutoFillCreatedBy] = useState(true)
  const [distributorQuery, setDistributorQuery] = useState(formState.distributorLabel)
  const [distributorOptions, setDistributorOptions] = useState<AccountOption[]>([])
  const [distributorLoading, setDistributorLoading] = useState(false)
  const [showDistributorDropdown, setShowDistributorDropdown] = useState(false)
  const [vendorQuery, setVendorQuery] = useState(formState.vendorLabel)
  const [vendorOptions, setVendorOptions] = useState<AccountOption[]>([])
  const [vendorLoading, setVendorLoading] = useState(false)
  const [showVendorDropdown, setShowVendorDropdown] = useState(false)
  const [templateQuery, setTemplateQuery] = useState('')
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([])
  const [templateLoading, setTemplateLoading] = useState(false)
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)

  const canProceed = Boolean(
    formState.depositName.trim() &&
    formState.customer &&
    formState.date &&
    formState.createdByContactId &&
    formState.distributorAccountId &&
    formState.vendorAccountId &&
    formState.templateId &&
    !templateDetailsLoading
  )

  const accountsSelected = Boolean(formState.distributorAccountId && formState.vendorAccountId)
  const canCreateTemplate = accountsSelected && Boolean(formState.createdByContactId)
  const templateInputValue = templateQuery.length > 0 ? templateQuery : formState.templateLabel

  const clearTemplateSelection = (resetQuery: boolean = true) => {
    if (resetQuery) {
      setTemplateQuery('')
    }
    onFormStateChange({ templateId: '', templateLabel: '' })
  }

  const handleTemplateCreated = (template: TemplateResponse) => {
    const option = formatTemplateOption(template)
    setTemplateOptions(prev => {
      const next = [...prev.filter(item => item.value !== option.value), option]
      return next.sort((a, b) => a.label.localeCompare(b.label))
    })
    setTemplateQuery(option.label)
    onFormStateChange({ templateId: option.value, templateLabel: option.label })
    setShowTemplateDropdown(false)
    setTemplateModalOpen(false)
  }

  const handleCreatedBySelect = (option: ContactOption) => {
    setCreatedByQuery(option.label)
    onFormStateChange({ createdByContactId: option.value, createdByLabel: option.label })
    setShowCreatedByDropdown(false)
    setShouldAutoFillCreatedBy(false)
  }

  const handleDistributorSelect = (option: AccountOption) => {
    setDistributorQuery(option.label)
    onFormStateChange({
      distributorAccountId: option.value,
      distributorLabel: option.label,
      templateId: '',
      templateLabel: ''
    })
    setShowDistributorDropdown(false)
    clearTemplateSelection()
  }

  const handleVendorSelect = (option: AccountOption) => {
    setVendorQuery(option.label)
    onFormStateChange({
      vendorAccountId: option.value,
      vendorLabel: option.label,
      templateId: '',
      templateLabel: ''
    })
    setShowVendorDropdown(false)
    clearTemplateSelection()
  }

  const handleTemplateSelect = (option: TemplateOption) => {
    setTemplateQuery(option.label)
    onFormStateChange({ templateId: option.value, templateLabel: option.label })
    setShowTemplateDropdown(false)
  }

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const fetchContacts = async () => {
      setCreatedByLoading(true)
      try {
        const params = new URLSearchParams({ page: '1', pageSize: '25', contactType: 'House Rep' })
        const trimmed = createdByQuery.trim()
        if (trimmed.length > 0) {
          params.set('q', trimmed)
        }
        const response = await fetch(`/api/contacts?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal
        })
        if (!response.ok) {
          throw new Error('Failed to load contacts')
        }
        const payload = await response.json().catch(() => null)
        if (cancelled) return
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []
        const options = items.map(item => ({
          value: item.id,
          label: item.fullName || 'Unnamed contact',
          subtitle: item.accountName || undefined
        }))
        setCreatedByOptions(options)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        if (!cancelled) {
          console.error('Unable to load House Rep contacts', error)
          setCreatedByOptions([])
        }
      } finally {
        if (!cancelled) {
          setCreatedByLoading(false)
        }
      }
    }

    const debounce = setTimeout(() => { void fetchContacts() }, 250)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(debounce)
    }
  }, [createdByQuery])

  useEffect(() => {
    if (!shouldAutoFillCreatedBy || formState.createdByContactId || createdByOptions.length === 0) {
      return
    }

    const normalized = user?.fullName?.toLowerCase()
    const matched = normalized
      ? createdByOptions.find(option => option.label.toLowerCase() === normalized)
      : undefined
    const fallback = matched ?? createdByOptions[0]

    if (fallback) {
      setCreatedByQuery(fallback.label)
      onFormStateChange({ createdByContactId: fallback.value, createdByLabel: fallback.label })
      setShouldAutoFillCreatedBy(false)
    }
  }, [createdByOptions, formState.createdByContactId, onFormStateChange, shouldAutoFillCreatedBy, user?.fullName])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const fetchDistributors = async () => {
      setDistributorLoading(true)
      try {
        const params = new URLSearchParams({ page: '1', pageSize: '25', accountType: 'Distributor' })
        const trimmed = distributorQuery.trim()
        if (trimmed.length > 0) {
          params.set('q', trimmed)
        }
        const response = await fetch(`/api/accounts?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal
        })
        if (!response.ok) {
          throw new Error('Failed to load distributors')
        }
        const payload = await response.json().catch(() => null)
        if (cancelled) return
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []
        const options = items.map(item => ({
          value: item.id,
          label: item.accountName || 'Unnamed account',
          detail: item.accountType ? `${item.accountType}${item.accountOwner ? ` � ${item.accountOwner}` : ''}` : item.accountOwner || undefined
        }))
        setDistributorOptions(options)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        if (!cancelled) {
          console.error('Unable to load distributors', error)
          setDistributorOptions([])
        }
      } finally {
        if (!cancelled) {
          setDistributorLoading(false)
        }
      }
    }

    const debounce = setTimeout(() => { void fetchDistributors() }, 250)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(debounce)
    }
  }, [distributorQuery])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const fetchVendors = async () => {
      setVendorLoading(true)
      try {
        const params = new URLSearchParams({ page: '1', pageSize: '25', accountType: 'Vendor' })
        const trimmed = vendorQuery.trim()
        if (trimmed.length > 0) {
          params.set('q', trimmed)
        }
        const response = await fetch(`/api/accounts?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal
        })
        if (!response.ok) {
          throw new Error('Failed to load vendors')
        }
        const payload = await response.json().catch(() => null)
        if (cancelled) return
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []
        const options = items.map(item => ({
          value: item.id,
          label: item.accountName || 'Unnamed account',
          detail: item.accountType ? `${item.accountType}${item.accountOwner ? ` � ${item.accountOwner}` : ''}` : item.accountOwner || undefined
        }))
        setVendorOptions(options)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        if (!cancelled) {
          console.error('Unable to load vendors', error)
          setVendorOptions([])
        }
      } finally {
        if (!cancelled) {
          setVendorLoading(false)
        }
      }
    }

    const debounce = setTimeout(() => { void fetchVendors() }, 250)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(debounce)
    }
  }, [vendorQuery])

  useEffect(() => {
    if (!accountsSelected) {
      setTemplateOptions([])
      setTemplateLoading(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const fetchTemplates = async () => {
      setTemplateLoading(true)
      try {
        const params = new URLSearchParams({
          distributorAccountId: formState.distributorAccountId,
          vendorAccountId: formState.vendorAccountId,
          pageSize: '50'
        })
        const trimmed = templateQuery.trim()
        if (trimmed.length > 0) {
          params.set('q', trimmed)
        }
        const response = await fetch(`/api/reconciliation/templates?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal
        })
        if (!response.ok) {
          throw new Error('Failed to load templates')
        }
        const payload = await response.json().catch(() => null)
        if (cancelled) return
        const items: TemplateResponse[] = Array.isArray(payload?.data) ? payload.data : []
        setTemplateOptions(items.map(formatTemplateOption))
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        if (!cancelled) {
          console.error('Unable to load reconciliation templates', error)
          setTemplateOptions([])
        }
      } finally {
        if (!cancelled) {
          setTemplateLoading(false)
        }
      }
    }

    const debounce = setTimeout(() => { void fetchTemplates() }, 200)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(debounce)
    }
  }, [accountsSelected, formState.distributorAccountId, formState.vendorAccountId, templateQuery])

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5 space-y-6">
      <section className="space-y-3">
        <div className="grid gap-3 md:grid-cols-4 md:gap-4">
          <FormField label="Created By" required>
            <div className="relative">
              <input
                type="text"
                value={createdByQuery}
                onChange={event => {
                  const value = event.target.value
                  setCreatedByQuery(value)
                  setShowCreatedByDropdown(true)
                  setShouldAutoFillCreatedBy(false)
                  if (formState.createdByContactId) {
                    onFormStateChange({ createdByContactId: '', createdByLabel: '' })
                  }
                }}
                onFocus={() => {
                  setShowCreatedByDropdown(true)
                  setShouldAutoFillCreatedBy(false)
                }}
                onBlur={() => {
                  setTimeout(() => setShowCreatedByDropdown(false), 150)
                }}
                placeholder="Search House Rep contacts"
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 pr-8 text-sm focus:outline-none focus:border-primary-500"
              />
              {createdByLoading && (
                <Loader2 className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
              )}
              {showCreatedByDropdown && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {createdByOptions.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-500">No contacts found</p>
                  ) : (
                    createdByOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => handleCreatedBySelect(option)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                      >
                        <div className="font-medium text-gray-900">{option.label}</div>
                        {option.subtitle && (
                          <div className="text-xs text-gray-500">{option.subtitle}</div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <p className="text-[11px] text-gray-500">Looks up contacts tied to House Rep accounts.</p>
          </FormField>
          <FormField label="Deposit Name" required>
            <input
              type="text"
              value={formState.depositName}
              onChange={onInputChange('depositName')}
              placeholder="Enter Deposit Name"
              className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-sm focus:outline-none focus:border-primary-500"
            />
          </FormField>
          <FormField label="Customer" required>
            <select
              value={formState.customer}
              onChange={onInputChange('customer')}
              className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-primary-500"
            >
              <option value="" disabled>Select</option>
              {customers.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Date" required>
            <div className="relative">
              <input
                type="date"
                value={formState.date}
                onChange={onInputChange('date')}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-sm text-transparent caret-transparent focus:outline-none focus:border-primary-500 [color-scheme:light]"
                style={{ colorScheme: 'light' }}
              />
              <span
                className={`pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-sm ${formState.date ? 'text-gray-900' : 'text-gray-400'}`}
                aria-hidden="true"
              >
                {formState.date || 'YYYY-MM-DD'}
              </span>
            </div>
          </FormField>
        </div>
      </section>

      <section className="space-y-2.5">
        <p className="text-sm font-medium text-gray-900">Upload Deposit Excel Sheet</p>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 md:flex-nowrap md:gap-4">
          <div className="flex items-center gap-2 text-primary-600">
            <div className="rounded-full bg-primary-100 p-2">
              <Upload className="h-4 w-4" />
            </div>
            <div className="text-xs text-gray-600">
              <p className="font-semibold text-gray-900 leading-tight">Drag & drop files</p>
              <p>or browse .csv/.xlsx/.xls</p>
            </div>
          </div>
          <p className="flex-1 text-sm text-gray-500 truncate">
            {selectedFile ? selectedFile.name : 'No file selected'}
          </p>
          <div className="flex items-center gap-2">
            <label
              htmlFor="deposit-upload"
              className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
            >
              Browse
            </label>
            <input
              id="deposit-upload"
              type="file"
              accept=".csv,.xlsx,.xls"
              className="sr-only"
              onChange={onFileChange}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-gray-900">Template Selection</p>
              <p className="text-sm text-gray-600">Choose distributor and vendor to align templates.</p>
            </div>
            <button
              type="button"
              onClick={() => setTemplateModalOpen(true)}
              disabled={!canCreateTemplate}
              className="inline-flex items-center gap-2 rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white"
            >
              <Plus className="h-4 w-4" />
              Create New Template
            </button>
          </div>

          {!canCreateTemplate && (
            <p className="text-xs text-gray-500">Select Created By, Distributor, and Vendor to create a template.</p>
          )}

          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            <FormField label="Distributor" required>
              <div className="relative">
                <input
                  type="text"
                  value={distributorQuery}
                onChange={event => {
                  const value = event.target.value
                  setDistributorQuery(value)
                  setShowDistributorDropdown(true)
                  if (formState.distributorAccountId) {
                    onFormStateChange({ distributorAccountId: '', distributorLabel: '' })
                  }
                  if (formState.templateId) {
                    clearTemplateSelection()
                  }
                }}
                  onFocus={() => setShowDistributorDropdown(true)}
                  onBlur={() => {
                    setTimeout(() => setShowDistributorDropdown(false), 150)
                  }}
                  placeholder="Search distributors"
                  className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 pr-8 text-sm focus:outline-none focus:border-primary-500"
                />
                {distributorLoading && (
                  <Loader2 className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                )}
                {showDistributorDropdown && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {distributorOptions.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-500">No distributors found</p>
                    ) : (
                      distributorOptions.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => handleDistributorSelect(option)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                        >
                          <div className="font-medium text-gray-900">{option.label}</div>
                          {option.detail && (
                            <div className="text-xs text-gray-500">{option.detail}</div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </FormField>
            <FormField label="Vendor" required>
              <div className="relative">
                <input
                  type="text"
                  value={vendorQuery}
                onChange={event => {
                  const value = event.target.value
                  setVendorQuery(value)
                  setShowVendorDropdown(true)
                  if (formState.vendorAccountId) {
                    onFormStateChange({ vendorAccountId: '', vendorLabel: '' })
                  }
                  if (formState.templateId) {
                    clearTemplateSelection()
                  }
                }}
                  onFocus={() => setShowVendorDropdown(true)}
                  onBlur={() => {
                    setTimeout(() => setShowVendorDropdown(false), 150)
                  }}
                  placeholder="Search vendors"
                  className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 pr-8 text-sm focus:outline-none focus:border-primary-500"
                />
                {vendorLoading && (
                  <Loader2 className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                )}
                {showVendorDropdown && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {vendorOptions.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-500">No vendors found</p>
                    ) : (
                      vendorOptions.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => handleVendorSelect(option)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                        >
                          <div className="font-medium text-gray-900">{option.label}</div>
                          {option.detail && (
                            <div className="text-xs text-gray-500">{option.detail}</div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </FormField>
          </div>

          <FormField label="Template" required>
            <div className="relative">
              <input
                type="text"
                value={templateInputValue}
                disabled={!accountsSelected}
                onChange={event => {
                  if (!accountsSelected) {
                    return
                  }
                  const value = event.target.value
                  setTemplateQuery(value)
                  setShowTemplateDropdown(true)
                  if (formState.templateId) {
                    clearTemplateSelection(false)
                  }
                }}
                onFocus={() => {
                  if (!accountsSelected) {
                    return
                  }
                  setShowTemplateDropdown(true)
                  if (!templateQuery && formState.templateLabel) {
                    setTemplateQuery(formState.templateLabel)
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowTemplateDropdown(false), 150)
                }}
                placeholder={accountsSelected ? 'Search templates' : 'Select distributor and vendor first'}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 pr-8 text-sm focus:outline-none focus:border-primary-500 disabled:cursor-not-allowed disabled:text-gray-400"
              />
              {templateLoading && (
                <Loader2 className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
              )}
              {showTemplateDropdown && accountsSelected && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {templateOptions.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-500">No templates found</p>
                  ) : (
                    templateOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => handleTemplateSelect(option)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                      >
                        <div className="font-medium text-gray-900">{option.label}</div>
                        <div className="text-xs text-gray-500">{option.helper}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {!accountsSelected && (
              <p className="text-[11px] text-gray-500">Pick a distributor and vendor to load templates.</p>
            )}
            {accountsSelected && !templateLoading && templateOptions.length === 0 && (
              <p className="text-[11px] text-gray-500">No templates available yet. Create one to get started.</p>
            )}
          </FormField>

          {formState.templateId && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900">Template Preview</p>
                {templateDetailsLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              </div>
              {templateDetailsLoading ? (
                <p className="mt-1 text-gray-600">Loading template configuration…</p>
              ) : templateDetails ? (
                <>
                  <p className="mt-1 text-xs text-gray-500">
                    {templateDetails.description || 'No description provided.'}
                  </p>
                  <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                    {templateDetails.config && Object.keys(templateDetails.config).length > 0 ? (
                      <pre className="max-h-48 overflow-auto text-[11px] text-gray-800">
                        {JSON.stringify(templateDetails.config, null, 2)}
                      </pre>
                    ) : (
                      <p>No saved mapping configuration yet. Proceed to Map Fields to create one.</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-1 text-sm text-red-600">{templateDetailsError ?? 'Unable to load template details.'}</p>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="flex items-center justify-start border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onProceed}
          disabled={!canProceed}
          className="inline-flex items-center rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Proceed
        </button>
      </div>

      <TemplateCreateModal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        distributor={formState.distributorAccountId ? { id: formState.distributorAccountId, name: formState.distributorLabel } : null}
        vendor={formState.vendorAccountId ? { id: formState.vendorAccountId, name: formState.vendorLabel } : null}
        createdByContactId={formState.createdByContactId}
        onTemplateCreated={handleTemplateCreated}
      />
    </div>
  )
}

interface MapFieldsPlaceholderProps {
  onBack: () => void
  templateDetails: TemplateDetail | null
  templateDetailsLoading: boolean
  templateDetailsError: string | null
}

function MapFieldsPlaceholder({ onBack, templateDetails, templateDetailsLoading, templateDetailsError }: MapFieldsPlaceholderProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
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
        <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
          CSV / Excel columns preview will render here.
        </div>
        <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
          Commissable fields and mapping controls will appear here.
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
        <p className="font-medium text-gray-900">Loaded Template</p>
        {templateDetailsLoading ? (
          <div className="mt-2 inline-flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            Fetching template configuration…
          </div>
        ) : templateDetails ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-gray-700">
              {templateDetails.name} • {templateDetails.distributorName} / {templateDetails.vendorName}
            </p>
            <div className="rounded-lg bg-white p-3 text-xs text-gray-600">
              {templateDetails.config && Object.keys(templateDetails.config).length > 0 ? (
                <pre className="max-h-48 overflow-auto text-[11px] text-gray-800">
                  {JSON.stringify(templateDetails.config, null, 2)}
                </pre>
              ) : (
                <p>No mapping stored yet. Any mapping you create will be saved back to this template.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">
            {templateDetailsError || 'Select a template to preload saved mapping settings.'}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-900">Next up</p>
        <p>Review your mappings, validate sample rows, then confirm to complete reconciliation.</p>
      </div>

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
          disabled
          className="inline-flex items-center rounded-lg bg-gray-300 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Continue to Review
        </button>
      </div>
    </div>
  )
}

interface FormFieldProps {
  label: string
  required?: boolean
  children: ReactNode
}

function FormField({ label, required, children }: FormFieldProps) {
  return (
    <label className="flex flex-col gap-0.5 text-xs font-medium uppercase tracking-wide text-gray-600">
      <span className="text-gray-900">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  )
}


interface TemplateCreateModalProps {
  isOpen: boolean
  distributor: { id: string; name: string } | null
  vendor: { id: string; name: string } | null
  createdByContactId?: string
  onClose: () => void
  onTemplateCreated: (template: TemplateResponse) => void
}

function TemplateCreateModal({ isOpen, distributor, vendor, createdByContactId, onClose, onTemplateCreated }: TemplateCreateModalProps) {
  const [templateName, setTemplateName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const defaultName = distributor?.name && vendor?.name ? `${distributor.name}-${vendor.name}` : ''
    setTemplateName(defaultName)
    setDescription('')
    setError(null)
  }, [isOpen, distributor?.name, vendor?.name])

  if (!isOpen) {
    return null
  }

  const canSubmit = Boolean(templateName.trim() && distributor?.id && vendor?.id && createdByContactId && !submitting)

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError('Template name, distributor, vendor, and Created By are required.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/reconciliation/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          description: description.trim() || undefined,
          distributorAccountId: distributor!.id,
          vendorAccountId: vendor!.id,
          createdByContactId,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create template')
      }

      const template: TemplateResponse | undefined = payload?.data
      if (!template) {
        throw new Error('Template response missing data')
      }

      onTemplateCreated(template)
    } catch (error: any) {
      setError(error?.message || 'Unable to create template')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Create Template</h3>
          <p className="text-sm text-gray-600">Save a template for this distributor and vendor combination.</p>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            <p><span className="font-medium text-gray-900">Distributor:</span> {distributor?.name || 'Not selected'}</p>
            <p><span className="font-medium text-gray-900">Vendor:</span> {vendor?.name || 'Not selected'}</p>
          </div>

          <label className="text-sm font-medium text-gray-700">
            Template Name
            <input
              type="text"
              value={templateName}
              onChange={event => setTemplateName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              placeholder="e.g., Telarus-Lingo"
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Description (optional)
            <textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              rows={3}
              placeholder="Add notes about this template's mapping or usage."
            />
          </label>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Template
          </button>
        </div>
      </div>
    </div>
  )
}
