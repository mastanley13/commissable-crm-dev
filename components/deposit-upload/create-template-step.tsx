'use client'

import { useState, useEffect, useCallback, ChangeEvent, ReactNode } from 'react'
import { Upload, Plus, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import type { DepositUploadFormState, TemplateDetail, TemplateResponse } from '@/components/deposit-upload/types'

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

interface TemplateOption {
  value: string
  label: string
  helper: string
}

const formatTemplateOption = (template: TemplateResponse): TemplateOption => ({
  value: template.id,
  label: template.name,
  helper: `${template.distributorName || 'Distributor'} / ${template.vendorName || 'Vendor'}`,
})

const underlineInputClass =
  "w-full border-0 border-b border-slate-200 bg-transparent px-0 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"

interface CreateTemplateStepProps {
  formState: DepositUploadFormState
  selectedFile: File | null
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onProceed: () => void
  onFormStateChange: (updates: Partial<DepositUploadFormState>) => void
  templateDetails: TemplateDetail | null
  templateDetailsLoading: boolean
  templateDetailsError: string | null
}

export function CreateTemplateStep({
  formState,
  selectedFile,
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
  const [customerQuery, setCustomerQuery] = useState(formState.customerLabel)
  const [customerOptions, setCustomerOptions] = useState<AccountOption[]>([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
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

  useEffect(() => {
    if (!shouldAutoFillCreatedBy) {
      return
    }

    if (user?.fullName && !createdByQuery) {
      setCreatedByQuery(user.fullName)
      setShouldAutoFillCreatedBy(false)
    }
  }, [user?.fullName, createdByQuery, shouldAutoFillCreatedBy])

  const canProceed = Boolean(
    formState.depositReceivedDate &&
      formState.commissionPeriod &&
      formState.customerAccountId &&
      formState.createdByContactId &&
      selectedFile &&
      !templateDetailsLoading,
  )

  const accountsSelected = Boolean(formState.distributorAccountId && formState.vendorAccountId)
  const canCreateTemplate = accountsSelected && Boolean(formState.createdByContactId)
  const templateInputValue = templateQuery.length > 0 ? templateQuery : formState.templateLabel

  const clearTemplateSelection = useCallback(
    (resetQuery: boolean = true) => {
      if (resetQuery) {
        setTemplateQuery('')
      }
      onFormStateChange({ templateId: '', templateLabel: '' })
    },
    [onFormStateChange],
  )

  const handleTemplateCreated = (template: TemplateResponse) => {
    const option = formatTemplateOption(template)
    setTemplateOptions(previous => {
      const next = [...previous.filter(item => item.value !== option.value), option]
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

  const handleCustomerSelect = (option: AccountOption) => {
    setCustomerQuery(option.label)
    onFormStateChange({
      customerAccountId: option.value,
      customerLabel: option.label,
    })
    setShowCustomerDropdown(false)
  }

  const handleDistributorSelect = (option: AccountOption) => {
    setDistributorQuery(option.label)
    onFormStateChange({
      distributorAccountId: option.value,
      distributorLabel: option.label,
      templateId: '',
      templateLabel: '',
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
      templateLabel: '',
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
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('Failed to load contacts')
        }
          const payload = await response.json().catch(() => null)
          if (cancelled) return
          const items: any[] = Array.isArray(payload?.data) ? payload.data : []
          if (items.length === 0 && createdByQuery.trim().length > 0) {
            setCreatedByQuery('')
            return
          }
          const options = items.map(item => ({
            value: item.id,
            label: item.fullName || 'Unnamed contact',
            subtitle: item.accountName || undefined,
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

    const debounce = setTimeout(() => {
      void fetchContacts()
    }, 250)

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
      : createdByOptions[0]

    if (matched) {
      onFormStateChange({ createdByContactId: matched.value, createdByLabel: matched.label })
      setCreatedByQuery(matched.label)
    }
  }, [shouldAutoFillCreatedBy, user?.fullName, createdByOptions, formState.createdByContactId, onFormStateChange])

  const fetchAccounts = useCallback(
    async ({
      type,
      query,
      setOptions,
      setLoading,
    }: {
      type: 'distributor' | 'vendor' | 'customer'
      query: string
      setOptions: (options: AccountOption[]) => void
      setLoading: (value: boolean) => void
    }) => {
      setLoading(true)
      try {
        const accountType =
          type === 'distributor' ? 'Distributor' : type === 'vendor' ? 'Vendor' : 'Customer'
        const params = new URLSearchParams({ page: '1', pageSize: '25', accountType })
        if (query.trim().length > 0) {
          params.set('q', query.trim())
        }
        const response = await fetch(`/api/accounts?${params.toString()}`, {
          cache: 'no-store',
        })
        if (!response.ok) {
          throw new Error('Failed to load accounts')
        }
        const payload = await response.json().catch(() => null)
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []
        const options = items.map(item => ({
          value: item.id,
          label: item.accountName ?? 'Unnamed account',
          detail: item.accountNumber ?? undefined,
        }))
        setOptions(options)
      } catch (error) {
        console.error('Unable to load accounts', error)
        setOptions([])
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const debounce = setTimeout(() => {
      void fetchAccounts({
        type: 'distributor',
        query: distributorQuery,
        setOptions: setDistributorOptions,
        setLoading: setDistributorLoading,
      })
    }, 300)

    return () => {
      clearTimeout(debounce)
    }
  }, [distributorQuery, fetchAccounts])

  useEffect(() => {
    const debounce = setTimeout(() => {
      void fetchAccounts({
        type: 'vendor',
        query: vendorQuery,
        setOptions: setVendorOptions,
        setLoading: setVendorLoading,
      })
    }, 300)

    return () => {
      clearTimeout(debounce)
    }
  }, [vendorQuery, fetchAccounts])

  useEffect(() => {
    const debounce = setTimeout(() => {
      void fetchAccounts({
        type: 'customer',
        query: customerQuery,
        setOptions: setCustomerOptions,
        setLoading: setCustomerLoading,
      })
    }, 300)

    return () => {
      clearTimeout(debounce)
    }
  }, [customerQuery, fetchAccounts])

  const fetchTemplates = useCallback(
    async (query: string) => {
      if (!formState.distributorAccountId || !formState.vendorAccountId) {
        setTemplateOptions([])
        return
      }
      setTemplateLoading(true)
      try {
        const params = new URLSearchParams({
          pageSize: '50',
          distributorAccountId: formState.distributorAccountId,
          vendorAccountId: formState.vendorAccountId,
        })
        if (query.trim().length > 0) {
          params.set('q', query.trim())
        }
        const response = await fetch(`/api/reconciliation/templates?${params.toString()}`, {
          cache: 'no-store',
        })
        if (!response.ok) {
          throw new Error('Failed to load templates')
        }
        const payload = await response.json().catch(() => null)
        const rows: TemplateResponse[] = Array.isArray(payload?.data) ? payload.data : []
        setTemplateOptions(rows.map(item => formatTemplateOption(item)))
      } catch (error) {
        console.error('Unable to load templates', error)
        setTemplateOptions([])
      } finally {
        setTemplateLoading(false)
      }
    },
    [formState.distributorAccountId, formState.vendorAccountId],
  )

  useEffect(() => {
    if (!formState.distributorAccountId || !formState.vendorAccountId) {
      setTemplateOptions([])
      clearTemplateSelection(false)
      return
    }
    const debounce = setTimeout(() => {
      void fetchTemplates(templateQuery)
    }, 300)

    return () => {
      clearTimeout(debounce)
    }
  }, [templateQuery, fetchTemplates, formState.distributorAccountId, formState.vendorAccountId, clearTemplateSelection])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Deposit Name">
          <input
            type="text"
            value={formState.depositName}
            readOnly
            className={`${underlineInputClass} font-semibold`}
          />
          <p className="text-xs text-slate-500">
            {formState.depositName ? "Auto-generated from date + distributor + vendor." : "Provide date, distributor, and vendor to generate a name."}
          </p>
        </FormField>

        <FormField label="Deposit Received Date" required>
          <input
            type="date"
            value={formState.depositReceivedDate}
            onChange={event => onFormStateChange({ depositReceivedDate: event.target.value })}
            className={underlineInputClass}
          />
        </FormField>

        <FormField label="Commission Period (Month/Year)" required>
          <input
            type="month"
            value={formState.commissionPeriod}
            onChange={event => onFormStateChange({ commissionPeriod: event.target.value })}
            className={underlineInputClass}
          />
        </FormField>

        <FormField label="Customer" required>
          <div className="relative">
            <input
              type="text"
              value={customerQuery}
              onChange={event => setCustomerQuery(event.target.value)}
              onFocus={() => setShowCustomerDropdown(true)}
              placeholder="Search customers"
              className={underlineInputClass}
            />
            {showCustomerDropdown ? (
              <DropdownList
                loading={customerLoading}
                options={customerOptions}
                emptyLabel="No customers found"
                onSelect={option => handleCustomerSelect(option)}
                onDismiss={() => setShowCustomerDropdown(false)}
              />
            ) : null}
          </div>
        </FormField>

        <FormField label="Created By" required>
          <div className="rounded border-b border-slate-200 py-2 text-sm font-semibold text-slate-800">
            {formState.createdByLabel || user?.fullName || "Detecting..."}
          </div>
          <p className="text-xs text-slate-500">Automatically assigned to the user uploading this deposit.</p>
        </FormField>
      </div>

      <div className="pt-2">
        <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-slate-50 p-6 text-center text-sm text-gray-600 hover:bg-gray-50">
          <Upload className="h-6 w-6 text-primary-500" />
          <div>
            Drag & drop files
            <span className="text-gray-400"> or browse .csv/.xlsx/.xls</span>
          </div>
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFileChange} />
          {selectedFile ? <p className="text-xs text-gray-500">Selected: {selectedFile.name}</p> : <p className="text-xs text-gray-500">No file selected</p>}
        </label>
      </div>

      {/* Template selection & configuration section removed per updated UX; mapping is configured directly in Map Fields */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={onProceed}
          disabled={!canProceed}
          className="inline-flex items-center rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Proceed
        </button>
      </div>

      {templateModalOpen ? (
        <TemplateCreateModal
          isOpen={templateModalOpen}
          distributor={formState.distributorAccountId ? { id: formState.distributorAccountId, name: formState.distributorLabel } : null}
          vendor={formState.vendorAccountId ? { id: formState.vendorAccountId, name: formState.vendorLabel } : null}
          createdByContactId={formState.createdByContactId}
          onClose={() => setTemplateModalOpen(false)}
          onTemplateCreated={handleTemplateCreated}
        />
      ) : null}
    </div>
  )
}

interface DropdownListProps {
  loading: boolean
  options: { value: string; label: string; detail?: string }[]
  emptyLabel: string
  onSelect: (option: { value: string; label: string }) => void
  onDismiss: () => void
}

function DropdownList({ loading, options, emptyLabel, onSelect, onDismiss }: DropdownListProps) {
  return (
    <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow" onMouseLeave={onDismiss}>
      {loading ? (
        <li className="px-3 py-2 text-sm text-gray-500">Loading...</li>
      ) : options.length === 0 ? (
        <li className="px-3 py-2 text-sm text-gray-500">{emptyLabel}</li>
      ) : (
        options.map(option => (
          <li
            key={option.value}
            className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100"
            onClick={() => onSelect(option)}
          >
            <p className="font-medium text-gray-900">{option.label}</p>
            {option.detail ? <p className="text-xs text-gray-500">{option.detail}</p> : null}
          </li>
        ))
      )}
    </ul>
  )
}

interface TemplateDropdownProps {
  loading: boolean
  options: TemplateOption[]
  emptyLabel: string
  onSelect: (option: TemplateOption) => void
  onDismiss: () => void
}

function TemplateDropdown({ loading, options, emptyLabel, onSelect, onDismiss }: TemplateDropdownProps) {
  return (
    <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow" onMouseLeave={onDismiss}>
      {loading ? (
        <li className="px-3 py-2 text-sm text-gray-500">Loading...</li>
      ) : options.length === 0 ? (
        <li className="px-3 py-2 text-sm text-gray-500">{emptyLabel}</li>
      ) : (
        options.map(option => (
          <li
            key={option.value}
            className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100"
            onClick={() => onSelect(option)}
          >
            <p className="font-medium text-gray-900">{option.label}</p>
            <p className="text-xs text-gray-500">{option.helper}</p>
          </li>
        ))
      )}
    </ul>
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
    if (!isOpen) return
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
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={event => event.stopPropagation()}>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Create Template</h3>
          <p className="text-sm text-gray-600">Save a template for this distributor and vendor combination.</p>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            <p>
              <span className="font-medium text-gray-900">Distributor:</span> {distributor?.name || 'Not selected'}
            </p>
            <p>
              <span className="font-medium text-gray-900">Vendor:</span> {vendor?.name || 'Not selected'}
            </p>
          </div>

          <label className="text-sm font-medium text-gray-700">
            Template Name
            <input
              type="text"
              value={templateName}
              onChange={event => setTemplateName(event.target.value)}
              className={`mt-1 ${underlineInputClass}`}
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

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}
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
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Template
          </button>
        </div>
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
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
      <span className="text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  )
}
