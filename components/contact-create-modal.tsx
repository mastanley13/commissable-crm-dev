"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import { formatPhoneNumber } from "@/lib/validation-shared"
import { useToasts } from "./toast"
import { ModalHeader } from "./ui/modal-header"

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

interface ContactCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  options?: ContactOptions
  defaultAccountId?: string
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
}

interface AccountAddressResponse {
  data?: {
    shippingAddress?: AddressPayload | null
    billingAddress?: AddressPayload | null
    billingSameAsShipping?: boolean
    accountTypeId?: string | null
    accountType?: string | null
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

interface AddressState {
  shipping: AddressPayload | null
  billing: AddressPayload | null
  billingSameAsShipping: boolean
}

const ADDRESS_PLACEHOLDER = "Select an account to view address details."

function buildInitialContactForm(defaultAccountId?: string): ContactFormData {
  return {
    suffix: "",
    firstName: "",
    lastName: "",
    accountId: defaultAccountId ?? "",
    jobTitle: "",
    workPhone: "",
    extension: "",
    mobilePhone: "",
    emailAddress: "",
    description: ""
  }
}

function formatAddress(address?: AddressPayload | null): string {
  if (!address || !address.line1) {
    return ""
  }

  const parts: string[] = []
  parts.push(address.line1.trim())

  if (address.line2 && address.line2.trim().length > 0) {
    parts.push(address.line2.trim())
  }

  const cityStateZip = [address.city, address.state, address.postalCode]
    .map(value => (typeof value === "string" ? value.trim() : ""))
    .filter(segment => segment.length > 0)

  if (cityStateZip.length > 0) {
    parts.push(cityStateZip.join(" "))
  }

  if (address.country && address.country.trim().length > 0) {
    parts.push(address.country.trim())
  }

  return parts.join("  ")
}

export function ContactCreateModal({ isOpen, onClose, onSuccess, options, defaultAccountId }: ContactCreateModalProps) {
  const [formData, setFormData] = useState<ContactFormData>(() => buildInitialContactForm(defaultAccountId))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addresses, setAddresses] = useState<AddressState>({ shipping: null, billing: null, billingSameAsShipping: false })
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [accountTypeFallback, setAccountTypeFallback] = useState<{
    accountId: string
    accountTypeId: string | null
    accountTypeName: string
  } | null>(null)

  const { showError, showSuccess } = useToasts()

  const selectedAccount = useMemo(() => {
    if (!options?.accounts || !formData.accountId) {
      return undefined
    }
    return options.accounts.find(account => account.value === formData.accountId)
  }, [options?.accounts, formData.accountId])

  const resolvedAccountTypeId = selectedAccount?.accountTypeId ?? accountTypeFallback?.accountTypeId ?? ""
  const resolvedAccountTypeName = selectedAccount?.accountTypeName ?? accountTypeFallback?.accountTypeName ?? ""

  const resetState = useCallback(() => {
    setFormData(buildInitialContactForm(defaultAccountId))
    setAddresses({ shipping: null, billing: null, billingSameAsShipping: false })
    setAddressError(null)
    setError(null)
    setAccountTypeFallback(null)
  }, [defaultAccountId])

  useEffect(() => {
    if (isOpen) {
      resetState()
    }
  }, [isOpen, resetState])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (!formData.accountId) {
      setAddresses({ shipping: null, billing: null, billingSameAsShipping: false })
      setAddressError(null)
      setAccountTypeFallback(null)
      return
    }

    const controller = new AbortController()
    setAddressLoading(true)
    setAddressError(null)

    ;(async () => {
      try {
        const response = await fetch(`/api/accounts/${formData.accountId}`, {
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

        const accountTypeId = typeof payload.data?.accountTypeId === "string" ? payload.data.accountTypeId.trim() : ""
        const accountTypeName = typeof payload.data?.accountType === "string" ? payload.data.accountType.trim() : ""
        setAccountTypeFallback({
          accountId: formData.accountId,
          accountTypeId: accountTypeId.length > 0 ? accountTypeId : null,
          accountTypeName
        })
      } catch (err) {
        if (controller.signal.aborted) {
          return
        }

        console.error("Failed to load account addresses", err)
        setAddresses({ shipping: null, billing: null, billingSameAsShipping: false })
        setAddressError(err instanceof Error ? err.message : "Unable to load account addresses")
        setAccountTypeFallback(null)
      } finally {
        if (!controller.signal.aborted) {
          setAddressLoading(false)
        }
      }
    })()

    return () => {
      controller.abort()
    }
  }, [formData.accountId, isOpen])

  const handleInputChange = (field: keyof ContactFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handlePhoneBlur = (field: "workPhone" | "mobilePhone") => {
    setFormData(prev => {
      const current = prev[field]
      if (!current || typeof current !== "string") {
        return prev
      }

      const formatted = formatPhoneNumber(current)
      if (formatted === current) {
        return prev
      }

      return {
        ...prev,
        [field]: formatted
      }
    })
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      const message = "First and Last Name are required."
      setError(message)
      showError("Validation Error", message)
      return
    }

    if (!formData.accountId) {
      const message = "Please select an Account."
      setError(message)
      showError("Validation Error", message)
      return
    }

    if (!resolvedAccountTypeId) {
      const message = "Selected account does not have a contact type configured."
      setError(message)
      showError("Validation Error", message)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const normalizedWorkPhone = formData.workPhone.trim()
        ? formatPhoneNumber(formData.workPhone.trim())
        : ""
      const normalizedMobilePhone = formData.mobilePhone.trim()
        ? formatPhoneNumber(formData.mobilePhone.trim())
        : ""

      const contactData = {
        accountId: formData.accountId,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        suffix: formData.suffix.trim() || undefined,
        jobTitle: formData.jobTitle.trim() || undefined,
        workPhone: normalizedWorkPhone || undefined,
        workPhoneExt: formData.extension.trim() || undefined,
        mobilePhone: normalizedMobilePhone || undefined,
        emailAddress: formData.emailAddress.trim() || undefined,
        description: formData.description.trim() || undefined,
        isPrimary: true // Always default to Active
      }

      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(contactData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(typeof errorData?.error === "string" ? errorData.error : "Failed to create contact")
      }

      onSuccess()
      handleClose()
      showSuccess(
        "Contact created successfully",
        `${formData.firstName.trim()} ${formData.lastName.trim()} has been added to your contacts.`
      )
    } catch (err) {
      console.error("Error creating contact", err)
      const message = err instanceof Error ? err.message : "Failed to create contact"
      setError(message)
      showError("Failed to create contact", message)
    } finally {
      setLoading(false)
    }
  }

  const renderReadOnlyInput = (label: string, value?: string) => (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      <input
        value={value || ""}
        readOnly
        className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
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

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
      <div
        className="w-full max-w-5xl h-[900px] flex flex-col rounded-xl bg-white shadow-xl"
      >
        <ModalHeader kicker="Create Contact" title="Create New Contact" />

        <form onSubmit={handleSubmit} className="px-6 py-6">
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-[120px_1fr_1fr] gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="contact-suffix">Suffix</label>
                  <select
                    id="contact-suffix"
                    value={formData.suffix}
                    onChange={event => handleInputChange("suffix", event.target.value)}
                    className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                  >
                    <option value="">Select</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Dr.">Dr.</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="contact-first-name">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="contact-first-name"
                    type="text"
                    value={formData.firstName}
                    onChange={event => handleInputChange("firstName", event.target.value)}
                    className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                    placeholder="Enter First Name"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="contact-last-name">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="contact-last-name"
                    type="text"
                    value={formData.lastName}
                    onChange={event => handleInputChange("lastName", event.target.value)}
                    className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                    placeholder="Enter Last Name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="contact-job-title">
                  Job Title
                </label>
                <input
                  id="contact-job-title"
                  type="text"
                  value={formData.jobTitle}
                  onChange={event => handleInputChange("jobTitle", event.target.value)}
                  placeholder="Enter Job Title"
                  className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="contact-contact-type">
                  Contact Type
                </label>
                <input
                  id="contact-contact-type"
                  type="text"
                  value={resolvedAccountTypeName || ""}
                  readOnly
                  className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                  placeholder="Select an account to view contact type"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="contact-work-phone">
                    Work Phone
                  </label>
                  <input
                    id="contact-work-phone"
                    type="tel"
                    value={formData.workPhone}
                    onChange={event => handleInputChange("workPhone", event.target.value)}
                    onBlur={() => handlePhoneBlur("workPhone")}
                    placeholder="555-123-4567"
                    className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="contact-extension">
                    Extension
                  </label>
                  <input
                    id="contact-extension"
                    type="text"
                    value={formData.extension}
                    onChange={event => handleInputChange("extension", event.target.value)}
                    placeholder="Extension"
                    className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="contact-mobile">
                  Mobile
                </label>
                <input
                  id="contact-mobile"
                  type="tel"
                  value={formData.mobilePhone}
                  onChange={event => handleInputChange("mobilePhone", event.target.value)}
                  onBlur={() => handlePhoneBlur("mobilePhone")}
                  placeholder="555-987-6543"
                  className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="contact-email">
                  Email Address
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={formData.emailAddress}
                  onChange={event => handleInputChange("emailAddress", event.target.value)}
                  placeholder="Enter Email"
                  className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="contact-description">
                  Description
                </label>
                <textarea
                  id="contact-description"
                  rows={4}
                  value={formData.description}
                  onChange={event => handleInputChange("description", event.target.value)}
                  placeholder="Enter Description"
                  className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full bg-gray-200 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-300"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Creating..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
