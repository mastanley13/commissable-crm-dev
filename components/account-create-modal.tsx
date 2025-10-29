"use client"

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth-context"

export interface AddressFormValues {
  line1: string
  line2: string
  city: string
  state: string
  postalCode: string
  country: string
}

export interface AccountFormValues {
  accountName: string
  accountLegalName: string
  parentAccountId: string
  accountTypeId: string
  ownerId: string
  industryId: string
  websiteUrl: string
  description: string
  active: boolean
  billingSameAsShipping: boolean
  shippingAddress: AddressFormValues
  billingAddress: AddressFormValues
}

interface OptionItem {
  id: string
  name: string
}

interface AccountCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (values: AccountFormValues) => Promise<void> | void
}

const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" }
]

const DEFAULT_COUNTRY = "United States"

const INITIAL_FORM: AccountFormValues = {
  accountName: "",
  accountLegalName: "",
  parentAccountId: "",
  accountTypeId: "",
  ownerId: "",
  industryId: "",
  websiteUrl: "",
  description: "",
  active: true,
  billingSameAsShipping: false,
  shippingAddress: {
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: DEFAULT_COUNTRY
  },
  billingAddress: {
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: DEFAULT_COUNTRY
  }
}

type FormErrors = Partial<Record<string, string>>

export function AccountCreateModal({ isOpen, onClose, onSubmit }: AccountCreateModalProps) {
  const [form, setForm] = useState<AccountFormValues>(INITIAL_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [optionsLoaded, setOptionsLoaded] = useState(false)
  const [accountTypes, setAccountTypes] = useState<OptionItem[]>([])
  const [industries, setIndustries] = useState<OptionItem[]>([])
  const [parentAccounts, setParentAccounts] = useState<OptionItem[]>([])
  const [owners, setOwners] = useState<OptionItem[]>([])
  const [parentAccountQuery, setParentAccountQuery] = useState("")
  const [showParentAccountResults, setShowParentAccountResults] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    if (!isOpen) {
      setShowParentAccountResults(false)
      setParentAccountQuery("")
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm(INITIAL_FORM)
    setParentAccountQuery("")
    // Pre-select current user as owner immediately if available
    if (user?.id) {
      setForm(prev => ({ ...prev, ownerId: user.id }))
    }
    setErrors({})
    setFormError(null)
    setOptionsLoaded(false)
    setOptionsError(null)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || optionsLoaded) {
      return
    }

    const fetchOptions = async () => {
      try {
        setOptionsLoading(true)
        setOptionsError(null)
        const response = await fetch("/api/accounts/options", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Unable to load field options")
        }
        const data = await response.json()
        setAccountTypes(
          Array.isArray(data.accountTypes)
            ? data.accountTypes.map((type: any) => ({ id: type.id, name: type.name ?? type.id }))
            : []
        )
        setIndustries(
          Array.isArray(data.industries)
            ? data.industries.map((industry: any) => ({ id: industry.id, name: industry.name ?? industry.id }))
            : []
        )
        setParentAccounts(
          Array.isArray(data.parentAccounts)
            ? data.parentAccounts.map((account: any) => ({
                id: account.id,
                name: account.accountName ?? account.id
              }))
            : []
        )
        // Normalize owners to OptionItem shape { id, name }
        setOwners(
          Array.isArray(data.owners)
            ? data.owners.map((o: any) => ({ id: o.id, name: o.fullName ?? o.name ?? "" }))
            : []
        )
        setOptionsLoaded(true)
      } catch (error) {
        console.error(error)
        setOptionsError(error instanceof Error ? error.message : "Failed to load options")
      } finally {
        setOptionsLoading(false)
      }
    }

    fetchOptions()
  }, [isOpen, optionsLoaded])

  // Default the Account Owner to the current user when options load
  useEffect(() => {
    if (!isOpen) return
    if (!optionsLoaded) return
    if (!user?.id) return
    if (!owners || owners.length === 0) return
    if (form.ownerId && form.ownerId.length > 0) return

    const hasCurrentUser = owners.some(o => o.id === user.id)
    if (hasCurrentUser) {
      setForm(prev => ({ ...prev, ownerId: user.id }))
    }
  }, [isOpen, optionsLoaded, owners, user?.id, form.ownerId])

  useEffect(() => {
    if (!form.parentAccountId) {
      if (parentAccountQuery !== "") {
        setParentAccountQuery("")
      }
      return
    }

    const match = parentAccounts.find(account => account.id === form.parentAccountId)
    if (match && parentAccountQuery !== match.name) {
      setParentAccountQuery(match.name)
    }
  }, [form.parentAccountId, parentAccounts, parentAccountQuery])

  const parentAccountResults = useMemo(() => {
    const query = parentAccountQuery.trim().toLowerCase()
    const source = query.length === 0
      ? parentAccounts
      : parentAccounts.filter(account => account.name.toLowerCase().includes(query))
    return source.slice(0, 25)
  }, [parentAccountQuery, parentAccounts])

  const disableBillingFields = form.billingSameAsShipping

  const handleFieldChange = (field: keyof AccountFormValues) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const value = event.target.type === "checkbox" ? (event.target as HTMLInputElement).checked : event.target.value
    setForm(previous => ({
      ...previous,
      [field]: value
    }))
  }

  const handleShippingChange = (field: keyof AddressFormValues) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value
    setForm(previous => {
      const updatedShipping = { ...previous.shippingAddress, [field]: value }
      const updatedBilling = previous.billingSameAsShipping
        ? { ...previous.billingAddress, [field]: value }
        : previous.billingAddress
      return {
        ...previous,
        shippingAddress: updatedShipping,
        billingAddress: updatedBilling
      }
    })
  }

  const handleBillingChange = (field: keyof AddressFormValues) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value
    setForm(previous => ({
      ...previous,
      billingAddress: {
        ...previous.billingAddress,
        [field]: value
      }
    }))
  }

  const toggleBillingSync = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.checked
    setForm(previous => ({
      ...previous,
      billingSameAsShipping: value,
      billingAddress: value ? { ...previous.shippingAddress } : previous.billingAddress
    }))
  }

  const trimValue = (value: string) => value.trim()

  const validate = (values: AccountFormValues): FormErrors => {
    const nextErrors: FormErrors = {}

    if (!trimValue(values.accountName)) {
      nextErrors.accountName = "Account name is required"
    }

    if (!trimValue(values.accountTypeId)) {
      nextErrors.accountTypeId = "Account type is required"
    }

    if (!trimValue(values.shippingAddress.line1)) {
      nextErrors["shippingAddress.line1"] = "Shipping street is required"
    }

    if (!trimValue(values.shippingAddress.city)) {
      nextErrors["shippingAddress.city"] = "Shipping city is required"
    }

    if (!trimValue(values.billingAddress.line1) && !values.billingSameAsShipping) {
      nextErrors["billingAddress.line1"] = "Billing street is required"
    }

    if (!trimValue(values.billingAddress.city) && !values.billingSameAsShipping) {
      nextErrors["billingAddress.city"] = "Billing city is required"
    }

    return nextErrors
  }

  const normalizedValues = useMemo(() => {
    return {
      ...form,
      accountName: trimValue(form.accountName),
      accountLegalName: trimValue(form.accountLegalName),
      parentAccountId: trimValue(form.parentAccountId),
      accountTypeId: trimValue(form.accountTypeId),
      ownerId: trimValue(form.ownerId),
      industryId: trimValue(form.industryId),
      websiteUrl: trimValue(form.websiteUrl),
      description: form.description.trim(),
      shippingAddress: {
        line1: trimValue(form.shippingAddress.line1),
        line2: trimValue(form.shippingAddress.line2),
        city: trimValue(form.shippingAddress.city),
        state: trimValue(form.shippingAddress.state),
        postalCode: trimValue(form.shippingAddress.postalCode),
        country: trimValue(form.shippingAddress.country) || DEFAULT_COUNTRY
      },
      billingAddress: {
        line1: trimValue(form.billingAddress.line1),
        line2: trimValue(form.billingAddress.line2),
        city: trimValue(form.billingAddress.city),
        state: trimValue(form.billingAddress.state),
        postalCode: trimValue(form.billingAddress.postalCode),
        country: trimValue(form.billingAddress.country) || DEFAULT_COUNTRY
      }
    }
  }, [form])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const validationErrors = validate(normalizedValues)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setFormError(null)

    try {
      setIsSubmitting(true)
      await onSubmit(normalizedValues)
    } catch (error) {
      console.error(error)
      setFormError(error instanceof Error ? error.message : "Failed to add account")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-5xl rounded-xl bg-white shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add Account</h2>
            <p className="text-sm text-gray-500">Fill out the details below to add a new account.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close modal"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6">
          {formError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          {optionsError && (
            <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              {optionsError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Account Name *</label>
                <input
                  type="text"
                  value={form.accountName}
                  onChange={handleFieldChange("accountName")}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.accountName ? "border-red-400" : "border-gray-300"}`}
                  placeholder="Enter Account Name"
                  required
                />
                {errors.accountName && <p className="mt-1 text-xs text-red-600">{errors.accountName}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Account Legal Name</label>
                <input
                  type="text"
                  value={form.accountLegalName}
                  onChange={handleFieldChange("accountLegalName")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter Legal Name"
                />
              </div>

              <div className="relative">
                <label className="mb-1 block text-sm font-medium text-gray-700">Parent Account</label>
                <input
                  type="text"
                  value={parentAccountQuery}
                  onChange={event => {
                    const value = event.target.value
                    setParentAccountQuery(value)
                    setForm(previous => ({ ...previous, parentAccountId: "" }))
                    if (!showParentAccountResults) {
                      setShowParentAccountResults(true)
                    }
                  }}
                  onFocus={() => setShowParentAccountResults(true)}
                  onBlur={() => {
                    setTimeout(() => setShowParentAccountResults(false), 120)
                  }}
                  placeholder="Search parent accounts"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoComplete="off"
                />
                {showParentAccountResults && parentAccountResults.length > 0 ? (
                  <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {parentAccountResults.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => {
                          setForm(previous => ({ ...previous, parentAccountId: option.id }))
                          setParentAccountQuery(option.name)
                          setShowParentAccountResults(false)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                      >
                        <div className="font-medium text-gray-900">{option.name}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
                {showParentAccountResults && parentAccountResults.length === 0 && parentAccountQuery.trim().length > 0 ? (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-lg">
                    No parent accounts match your search.
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Account Type *</label>
                  <select
                    value={form.accountTypeId}
                    onChange={handleFieldChange("accountTypeId")}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.accountTypeId ? "border-red-400" : "border-gray-300"}`}
                    required
                  >
                    <option value="">- Select -</option>
                    {accountTypes.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  {errors.accountTypeId && <p className="mt-1 text-xs text-red-600">{errors.accountTypeId}</p>}
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Active (Y/N)</label>
                  <div className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 py-2">
                    <span className="text-sm text-gray-600">{form.active ? "Yes" : "No"}</span>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={form.active}
                        onChange={handleFieldChange("active")}
                      />
                      <span>Active</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Account Owner</label>
                <select
                  value={form.ownerId}
                  onChange={handleFieldChange("ownerId")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select</option>
                  {owners.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Website URL</label>
                <input
                  type="url"
                  value={form.websiteUrl}
                  onChange={handleFieldChange("websiteUrl")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="www.commissable.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={handleFieldChange("description")}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter Description"
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800">Ship To Address</h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Shipping Street *</label>
                    <input
                      type="text"
                      value={form.shippingAddress.line1}
                      onChange={handleShippingChange("line1")}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors["shippingAddress.line1"] ? "border-red-400" : "border-gray-300"}`}
                      placeholder="Shipping Street"
                    />
                    {errors["shippingAddress.line1"] && (
                      <p className="mt-1 text-xs text-red-600">{errors["shippingAddress.line1"]}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Shipping Street 2</label>
                    <input
                      type="text"
                      value={form.shippingAddress.line2}
                      onChange={handleShippingChange("line2")}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Shipping Street 2"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-600">Shipping City *</label>
                      <input
                        type="text"
                        value={form.shippingAddress.city}
                        onChange={handleShippingChange("city")}
                        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors["shippingAddress.city"] ? "border-red-400" : "border-gray-300"}`}
                        placeholder="Shipping City"
                      />
                      {errors["shippingAddress.city"] && (
                        <p className="mt-1 text-xs text-red-600">{errors["shippingAddress.city"]}</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">State</label>
                      <select
                        value={form.shippingAddress.state}
                        onChange={handleShippingChange("state")}
                        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">- State -</option>
                        {US_STATES.map(state => (
                          <option key={state.code} value={state.code}>
                            {state.code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Shipping Zip</label>
                      <input
                        type="text"
                        value={form.shippingAddress.postalCode}
                        onChange={handleShippingChange("postalCode")}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Shipping Zip"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Country</label>
                      <select
                        value={form.shippingAddress.country}
                        onChange={handleShippingChange("country")}
                        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="United States">United States</option>
                        <option value="Canada">Canada</option>
                        <option value="Mexico">Mexico</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">Bill To Address</h3>
                  <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      checked={form.billingSameAsShipping}
                      onChange={toggleBillingSync}
                    />
                    <span>Same as Ship</span>
                  </label>
                </div>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Billing Street {form.billingSameAsShipping ? "" : "*"}</label>
                    <input
                      type="text"
                      value={form.billingAddress.line1}
                      onChange={handleBillingChange("line1")}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors["billingAddress.line1"] ? "border-red-400" : "border-gray-300"}`}
                      placeholder="Billing Street"
                      disabled={disableBillingFields}
                    />
                    {errors["billingAddress.line1"] && !form.billingSameAsShipping && (
                      <p className="mt-1 text-xs text-red-600">{errors["billingAddress.line1"]}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Billing Street 2</label>
                    <input
                      type="text"
                      value={form.billingAddress.line2}
                      onChange={handleBillingChange("line2")}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Billing Street 2"
                      disabled={disableBillingFields}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-600">Billing City {form.billingSameAsShipping ? "" : "*"}</label>
                      <input
                        type="text"
                        value={form.billingAddress.city}
                        onChange={handleBillingChange("city")}
                        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors["billingAddress.city"] ? "border-red-400" : "border-gray-300"}`}
                        placeholder="Billing City"
                        disabled={disableBillingFields}
                      />
                      {errors["billingAddress.city"] && !form.billingSameAsShipping && (
                        <p className="mt-1 text-xs text-red-600">{errors["billingAddress.city"]}</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">State</label>
                      <select
                        value={form.billingAddress.state}
                        onChange={handleBillingChange("state")}
                        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={disableBillingFields}
                      >
                        <option value="">- State -</option>
                        {US_STATES.map(state => (
                          <option key={state.code} value={state.code}>
                            {state.code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Billing Zip</label>
                      <input
                        type="text"
                        value={form.billingAddress.postalCode}
                        onChange={handleBillingChange("postalCode")}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Billing Zip"
                        disabled={disableBillingFields}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Country</label>
                      <select
                        value={form.billingAddress.country}
                        onChange={handleBillingChange("country")}
                        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={disableBillingFields}
                      >
                        <option value="United States">United States</option>
                        <option value="Canada">Canada</option>
                        <option value="Mexico">Mexico</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || optionsLoading}
              className="rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
            >
              {isSubmitting ? "Adding..." : "Add"}
            </button>
          </div>
        </form>

        {optionsLoading && (
          <div className="border-t border-gray-200 px-6 py-3 text-xs text-gray-500">Loading options...</div>
        )}
      </div>
    </div>
  )
}


