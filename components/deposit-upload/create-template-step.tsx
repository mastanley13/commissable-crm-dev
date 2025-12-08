'use client'

import { useState, useEffect, useCallback, ChangeEvent, ReactNode, useRef } from 'react'
import { Upload, Calendar } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import type { DepositUploadFormState } from '@/components/deposit-upload/types'

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

const underlineInputClass =
  "w-full border-0 border-b border-slate-200 bg-transparent px-0 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"

interface CreateTemplateStepProps {
  formState: DepositUploadFormState
  selectedFile: File | null
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onProceed: () => void
  onFormStateChange: (updates: Partial<DepositUploadFormState>) => void
}

export function CreateTemplateStep({
  formState,
  selectedFile,
  onFileChange,
  onProceed,
  onFormStateChange,
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
  const depositDateNativeRef = useRef<HTMLInputElement | null>(null)
  const commissionPeriodNativeRef = useRef<HTMLInputElement | null>(null)

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
      formState.distributorAccountId &&
      formState.vendorAccountId &&
      selectedFile,
  )

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
    })
    setShowDistributorDropdown(false)
  }

  const handleVendorSelect = (option: AccountOption) => {
    setVendorQuery(option.label)
    onFormStateChange({
      vendorAccountId: option.value,
      vendorLabel: option.label,
    })
    setShowVendorDropdown(false)
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
      type: 'distributor' | 'vendor'
      query: string
      setOptions: (options: AccountOption[]) => void
      setLoading: (value: boolean) => void
    }) => {
      setLoading(true)
      try {
        const accountType = type === 'distributor' ? 'Distributor' : 'Vendor'
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

  const openDepositDateCalendar = useCallback(() => {
    const el = depositDateNativeRef.current as any
    if (!el) return
    if (typeof el.showPicker === 'function') {
      el.showPicker()
    } else {
      el.focus()
      el.click()
    }
  }, [])

  const openCommissionPeriodCalendar = useCallback(() => {
    const el = commissionPeriodNativeRef.current as any
    if (!el) return
    if (typeof el.showPicker === 'function') {
      el.showPicker()
    } else {
      el.focus()
      el.click()
    }
  }, [])

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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Vendor" required>
          <div className="relative">
            <input
              type="text"
              value={vendorQuery}
              onChange={event => setVendorQuery(event.target.value)}
              onFocus={() => setShowVendorDropdown(true)}
              placeholder="Search vendors"
              className={underlineInputClass}
            />
            {showVendorDropdown ? (
              <DropdownList
                loading={vendorLoading}
                options={vendorOptions}
                emptyLabel="No vendors found"
                onSelect={option => handleVendorSelect(option)}
                onDismiss={() => setShowVendorDropdown(false)}
              />
            ) : null}
          </div>
        </FormField>

        <FormField label="Distributor" required>
          <div className="relative">
            <input
              type="text"
              value={distributorQuery}
              onChange={event => setDistributorQuery(event.target.value)}
              onFocus={() => setShowDistributorDropdown(true)}
              placeholder="Search distributors"
              className={underlineInputClass}
            />
            {showDistributorDropdown ? (
              <DropdownList
                loading={distributorLoading}
                options={distributorOptions}
                emptyLabel="No distributors found"
                onSelect={option => handleDistributorSelect(option)}
                onDismiss={() => setShowDistributorDropdown(false)}
              />
            ) : null}
          </div>
        </FormField>

        <FormField label="Commission Period (YYYY-MM)" required>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM"
              pattern="\d{4}-\d{2}"
              value={formState.commissionPeriod}
              onChange={event => onFormStateChange({ commissionPeriod: event.target.value })}
              className={`${underlineInputClass} pr-8`}
            />
            <button
              type="button"
              className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              onClick={openCommissionPeriodCalendar}
              aria-label="Open month picker"
              title="Open month picker"
            >
              <Calendar className="h-4 w-4" />
            </button>
            <input
              ref={commissionPeriodNativeRef}
              type="month"
              className="sr-only"
              value={formState.commissionPeriod || ''}
              onChange={event => {
                const value = event.target.value // YYYY-MM
                onFormStateChange({ commissionPeriod: value })
              }}
            />
          </div>
        </FormField>

        <FormField label="Deposit Received Date (YYYY-MM-DD)" required>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              pattern="\d{4}-\d{2}-\d{2}"
              value={formState.depositReceivedDate}
              onChange={event => onFormStateChange({ depositReceivedDate: event.target.value })}
              className={`${underlineInputClass} pr-8`}
            />
            <button
              type="button"
              className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              onClick={openDepositDateCalendar}
              aria-label="Open date picker"
              title="Open date picker"
            >
              <Calendar className="h-4 w-4" />
            </button>
            <input
              ref={depositDateNativeRef}
              type="date"
              className="sr-only"
              value={formState.depositReceivedDate || ''}
              onChange={event => {
                const value = event.target.value // YYYY-MM-DD
                onFormStateChange({ depositReceivedDate: value })
              }}
            />
          </div>
        </FormField>

        <FormField label="Deposit Name">
          <input
            type="text"
            value={formState.depositName}
            readOnly
            className={`${underlineInputClass} font-semibold`}
          />
          <p className="text-xs text-slate-500">
            {formState.depositName
              ? "Auto-generated from vendor + distributor + date."
              : "Provide vendor, distributor, and date to generate a name."}
          </p>
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
