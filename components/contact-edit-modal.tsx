"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Loader2 } from "lucide-react"

import { useToasts } from "./toast"

interface ContactOptions {
  accountTypes: Array<{ value: string; label: string; code: string }>
  owners: Array<{ value: string; label: string; firstName: string; lastName: string }>
  accounts: Array<{
    value: string
    label: string
    accountNumber?: string
    accountTypeId: string
    accountTypeName: string
  }>
  contactMethods: Array<{ value: string; label: string }>
}

interface ContactRow {
  id: string
  suffix: string
  fullName: string
  jobTitle: string
  mobile: string
  workPhone: string
  emailAddress: string
  extension: string
  accountId: string
  accountName: string
  isPrimary: boolean
  active: boolean
}

interface ContactEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  contact: ContactRow | null
}

interface ContactFormData {
  suffix: string
  firstName: string
  lastName: string
  accountId: string
  jobTitle: string
  workPhone: string
  extension: string
  mobilePhone: string
  emailAddress: string
  description: string
  active: boolean
}

interface AccountAddressResponse {
  data?: {
    shippingAddress?: AddressPayload | null
    billingAddress?: AddressPayload | null
    billingSameAsShipping?: boolean
    accountType?: string
  }
}

interface AddressPayload {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

const ADDRESS_PLACEHOLDER = "Select an account to view address details."

function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) {
    return { firstName: "", lastName: "" }
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" }
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ")
  }
}

function createInitialForm(contact: ContactRow | null): ContactFormData {
  if (!contact) {
    return {
      suffix: "",
      firstName: "",
      lastName: "",
      accountId: "",
      jobTitle: "",
      workPhone: "",
      extension: "",
      mobilePhone: "",
      emailAddress: "",
      description: "",
      active: true
    }
  }

  const { firstName, lastName } = parseName(contact.fullName || "")

  return {
    suffix: contact.suffix || "",
    firstName,
    lastName,
    accountId: contact.accountId || "",
    jobTitle: contact.jobTitle || "",
    workPhone: contact.workPhone || "",
    extension: contact.extension || "",
    mobilePhone: contact.mobile || "",
    emailAddress: contact.emailAddress || "",
    description: "",
    active: contact.isPrimary ?? contact.active ?? true
  }
}

export function ContactEditModal({ isOpen, onClose, onSuccess, contact }: ContactEditModalProps) {
  const [options, setOptions] = useState<ContactOptions | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [form, setForm] = useState<ContactFormData>(() => createInitialForm(contact))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [addresses, setAddresses] = useState<AddressState>({ shipping: null, billing: null, billingSameAsShipping: false })
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)

  const { showError, showSuccess } = useToasts()

  const accountOptions = useMemo(() => {
    const base = options?.accounts ?? []
    if (contact && contact.accountId && !base.some(option => option.value === contact.accountId)) {
      return [
        ...base,
        {
          value: contact.accountId,
          label: contact.accountName,
          accountNumber: undefined,
          accountTypeId: "",
          accountTypeName: ""
        }
      ]
    }
    return base
  }, [options?.accounts, contact])

  const selectedAccount = useMemo(() => {
    if (!form.accountId) {
      return undefined
    }
    return accountOptions.find(option => option.value === form.accountId)
  }, [accountOptions, form.accountId])

  useEffect(() => {
    setForm(createInitialForm(contact))
    setAddresses({ shipping: null, billing: null, billingSameAsShipping: false })
    setAddressError(null)
    setError(null)
  }, [contact])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let cancelled = false
    setOptionsLoading(true)

    fetch("/api/contacts/options", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          throw new Error("Failed to load contact options")
        }
        const payload = (await response.json()) as ContactOptions
        if (!cancelled) {
          setOptions(payload)
        }
      })
      .catch(err => {
        console.error("Failed to load contact options", err)
        if (!cancelled) {
          setOptions(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOptionsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (!form.accountId) {
      setAddresses({ shipping: null, billing: null, billingSameAsShipping: false })
      setAddressError(null)
      return
    }

    const controller = new AbortController()
    setAddressLoading(true)
    setAddressError(null)

    ;(async () => {
      try {
        const response = await fetch(`/api/accounts/${form.accountId}`, {
          cache: "no-store",
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error("Unable to load account addresses")
        }

        const payload = (await response.json()) as AccountAddressResponse
        const shippingAddress = payload.data?.shippingAddress ?? null
        const sameAsShip = Boolean(payload.data?.billingSameAsShipping)
        const billingAddress = sameAsShip ? (payload.data?.shippingAddress ?? null) : payload.data?.billingAddress ?? null

        setAddresses({
          shipping: shippingAddress,
          billing: billingAddress,
          billingSameAsShipping: sameAsShip
        })
      } catch (err) {
        if (controller.signal.aborted) {
          return
        }
        console.error("Failed to load account addresses", err)
        setAddresses({ shipping: null, billing: null, billingSameAsShipping: false })
        setAddressError(err instanceof Error ? err.message : "Unable to load account addresses")
      } finally {
        if (!controller.signal.aborted) {
          setAddressLoading(false)
        }
      }
    })()

    return () => {
      controller.abort()
    }
  }, [form.accountId, isOpen])

  const handleFieldChange = (field: keyof ContactFormData) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = event.target.type === "checkbox" ? (event.target as HTMLInputElement).checked : event.target.value
    setForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleToggleActive = useCallback(() => {
    setForm(prev => ({
      ...prev,
      active: !prev.active
    }))
  }, [])

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!contact) {
      return
    }

    if (!form.firstName.trim() || !form.lastName.trim()) {
      const message = "First and Last Name are required."
      setError(message)
      showError("Validation Error", message)
      return
    }

    if (!form.accountId) {
      const message = "Please select an Account."
      setError(message)
      showError("Validation Error", message)
      return
    }

    if (selectedAccount && !selectedAccount.accountTypeId) {
      const message = "Selected account does not have a contact type configured."
      setError(message)
      showError("Validation Error", message)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        suffix: form.suffix.trim() || null,
        accountId: form.accountId,
        jobTitle: form.jobTitle.trim() || null,
        workPhone: form.workPhone.trim() || null,
        workPhoneExt: form.extension.trim() || null,
        mobilePhone: form.mobilePhone.trim() || null,
        emailAddress: form.emailAddress.trim() || null,
        description: form.description.trim() || null,
        isPrimary: form.active
      }

      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(typeof errorData?.error === "string" ? errorData.error : "Failed to update contact")
      }

      onSuccess()
      showSuccess("Contact updated", "Your changes have been saved.")
      handleClose()
    } catch (err) {
      console.error("Failed to update contact", err)
      const message = err instanceof Error ? err.message : "Failed to update contact"
      setError(message)
      showError("Failed to update contact", message)
    } finally {
      setSubmitting(false)
    }
  }

  const renderReadOnlyInput = (label: string, value?: string) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        value={value || ""}
        readOnly
        className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 focus:outline-none"
      />
    </div>
  )

  const renderAddressCard = (
    title: string,
    address: AddressPayload | null,
    options?: { showSameAsShip?: boolean; sameAsShip?: boolean }
  ) => (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {options?.showSameAsShip && (
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              readOnly
              checked={Boolean(options.sameAsShip)}
            />
            <span>Same as Ship</span>
          </label>
        )}
      </div>

      {addressLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-600" />
          Loading address…
        </div>
      ) : addressError ? (
        <p className="text-sm text-red-600">{addressError}</p>
      ) : !address ? (
        <p className="text-sm text-gray-500">{ADDRESS_PLACEHOLDER}</p>
      ) : (
        <div className="space-y-3">
          {renderReadOnlyInput("Street", address.line1)}
          {renderReadOnlyInput("Street 2", address.line2)}
          <div className="grid gap-3 sm:grid-cols-[2fr,1fr]">
            {renderReadOnlyInput("City", address.city)}
            {renderReadOnlyInput("State", address.state)}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr,1fr]">
            {renderReadOnlyInput("Postal Code", address.postalCode)}
            {renderReadOnlyInput("Country", address.country)}
          </div>
        </div>
      )}
    </div>
  )

  if (!isOpen || !contact) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="w-full max-w-5xl rounded-xl bg-white shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Contact</h2>
            <p className="text-sm text-gray-500">Update the contact information below.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6">
          {(error || optionsLoading) && (
            <div className="mb-4 space-y-2">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              {optionsLoading && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Loading account options…
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="edit-contact-suffix">
                    Suffix
                  </label>
                  <select
                    id="edit-contact-suffix"
                    value={form.suffix}
                    onChange={handleFieldChange("suffix")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Prof.">Prof.</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="edit-contact-first-name">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-contact-first-name"
                    type="text"
                    value={form.firstName}
                    onChange={handleFieldChange("firstName")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter First Name"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="edit-contact-last-name">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-contact-last-name"
                    type="text"
                    value={form.lastName}
                    onChange={handleFieldChange("lastName")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter Last Name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="edit-contact-account">
                  Account Name <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-contact-account"
                  value={form.accountId}
                  onChange={handleFieldChange("accountId")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Select</option>
                  {accountOptions.map(account => (
                    <option key={account.value} value={account.value}>
                      {account.label} {account.accountNumber ? `(${account.accountNumber})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="edit-contact-job-title">
                  Job Title
                </label>
                <input
                  id="edit-contact-job-title"
                  type="text"
                  value={form.jobTitle}
                  onChange={handleFieldChange("jobTitle")}
                  placeholder="Enter Job Title"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="edit-contact-work-phone">
                    Work Phone
                  </label>
                  <input
                    id="edit-contact-work-phone"
                    type="tel"
                    value={form.workPhone}
                    onChange={handleFieldChange("workPhone")}
                    placeholder="+1-555-123-4567"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="edit-contact-extension">
                    Extension
                  </label>
                  <input
                    id="edit-contact-extension"
                    type="text"
                    value={form.extension}
                    onChange={handleFieldChange("extension")}
                    placeholder="Extension"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="edit-contact-mobile">
                  Mobile
                </label>
                <input
                  id="edit-contact-mobile"
                  type="tel"
                  value={form.mobilePhone}
                  onChange={handleFieldChange("mobilePhone")}
                  placeholder="+1-555-987-6543"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Active (Y/N)</label>
                <div className="flex items-center gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2">
                  <span className="text-sm text-gray-600">{form.active ? "Yes" : "No"}</span>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      checked={form.active}
                      onChange={() => handleToggleActive()}
                    />
                    <span>Active</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="edit-contact-email">
                  Email Address
                </label>
                <input
                  id="edit-contact-email"
                  type="email"
                  value={form.emailAddress}
                  onChange={handleFieldChange("emailAddress")}
                  placeholder="Enter Email"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="edit-contact-description">
                  Description
                </label>
                <textarea
                  id="edit-contact-description"
                  rows={4}
                  value={form.description}
                  onChange={handleFieldChange("description")}
                  placeholder="Enter Description"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="space-y-4">
              {renderAddressCard("Ship To Address", addresses.shipping)}
              {renderAddressCard("Bill To Address", addresses.billing, {
                showSameAsShip: true,
                sameAsShip: addresses.billingSameAsShipping
              })}
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full bg-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Updating..." : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
