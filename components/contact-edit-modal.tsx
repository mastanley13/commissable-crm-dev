"use client"

import { useState, useEffect } from "react"
import { useToasts } from "./toast"

interface ContactOptions {
  accountTypes: Array<{ value: string; label: string; code: string }>
  owners: Array<{ value: string; label: string; firstName: string; lastName: string }>
  accounts: Array<{ value: string; label: string; accountNumber?: string; accountTypeId: string; accountTypeName: string }>
  contactMethods: Array<{ value: string; label: string }>
}

interface ContactRow {
  id: string
  select: boolean
  active: boolean
  suffix: string
  fullName: string
  jobTitle: string
  contactType: string
  mobile: string
  workPhone: string
  emailAddress: string
  extension: string
  accountId: string
  accountName: string
  ownerId: string
  ownerName: string
  isPrimary: boolean
  isDecisionMaker: boolean
  preferredContactMethod: string
  createdAt: string
  deletedAt: string | null
  isDeleted: boolean
}

interface ContactEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  contact: ContactRow | null
}

interface ContactFormData {
  // Name fields
  suffix: string
  firstName: string
  lastName: string
  
  // Account and job info
  accountId: string
  jobTitle: string
  
  // Contact information
  workPhone: string
  extension: string
  mobilePhone: string
  emailAddress: string
  
  // Classification
  accountTypeId: string
  contactTypeName: string
  active: boolean
  isPrimary: boolean
  isDecisionMaker: boolean
  preferredContactMethod: string
  
  // Additional fields
  description: string
  
  // Address fields
  shippingStreet: string
  shippingStreet2: string
  shippingCity: string
  shippingState: string
  shippingZip: string
  shippingCountry: string
  
  billingStreet: string
  billingStreet2: string
  billingCity: string
  billingState: string
  billingZip: string
  billingCountry: string
  sameAsShip: boolean
}

function createInitialForm(contact: ContactRow | null): ContactFormData {
  if (!contact) {
    return {
      // Name fields
      suffix: "",
      firstName: "",
      lastName: "",
      
      // Account and job info
      accountId: "",
      jobTitle: "",
      
      // Contact information
      workPhone: "",
      extension: "",
      mobilePhone: "",
      emailAddress: "",
      
      // Classification
      accountTypeId: "",
      contactTypeName: "",
      active: true,
      isPrimary: false,
      isDecisionMaker: false,
      preferredContactMethod: "",
      
      // Additional fields
      description: "",
      
      // Address fields
      shippingStreet: "",
      shippingStreet2: "",
      shippingCity: "",
      shippingState: "",
      shippingZip: "",
      shippingCountry: "United States",
      
      billingStreet: "",
      billingStreet2: "",
      billingCity: "",
      billingState: "",
      billingZip: "",
      billingCountry: "United States",
      sameAsShip: false
    }
  }

  // Parse the fullName to get first and last names
  const nameParts = contact.fullName ? contact.fullName.split(' ') : []
  const firstName = nameParts.length > 0 ? nameParts[0] : ""
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ""

  return {
    // Name fields
    suffix: contact.suffix || "",
    firstName,
    lastName,
    
    // Account and job info
    accountId: contact.accountId || "",
    jobTitle: contact.jobTitle || "",
    
    // Contact information
    workPhone: contact.workPhone || "",
    extension: contact.extension || "",
    mobilePhone: contact.mobile || "",
    emailAddress: contact.emailAddress || "",
    
    // Classification
    accountTypeId: "",
    contactTypeName: contact.contactType || "",
    active: contact.active,
    isPrimary: contact.isPrimary,
    isDecisionMaker: contact.isDecisionMaker,
    preferredContactMethod: contact.preferredContactMethod || "",
    
    // Additional fields
    description: "",
    
    // Address fields - will be populated from API
    shippingStreet: "",
    shippingStreet2: "",
    shippingCity: "",
    shippingState: "",
    shippingZip: "",
    shippingCountry: "United States",
    
    billingStreet: "",
    billingStreet2: "",
    billingCity: "",
    billingState: "",
    billingZip: "",
    billingCountry: "United States",
    sameAsShip: false
  }
}

const US_STATES = [
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

export function ContactEditModal({ isOpen, onClose, onSuccess, contact }: ContactEditModalProps) {
  const [form, setForm] = useState<ContactFormData>(() => createInitialForm(contact))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [optionsLoaded, setOptionsLoaded] = useState(false)
  const [options, setOptions] = useState<ContactOptions | null>(null)
  const [fullContactData, setFullContactData] = useState<any>(null)

  const { showSuccess, showError } = useToasts()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm(createInitialForm(contact))
    setErrors({})
    setFormError(null)
    setOptionsLoaded(false)
    setOptionsError(null)
    setFullContactData(null)
  }, [isOpen, contact])

  useEffect(() => {
    if (!isOpen || optionsLoaded) {
      return
    }

    const fetchOptions = async () => {
      try {
        setOptionsLoading(true)
        setOptionsError(null)
        const response = await fetch("/api/contacts/options", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Unable to load field options")
        }
        const data = await response.json()
        setOptions(data)
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

  // Fetch full contact data when modal opens
  useEffect(() => {
    if (!isOpen || !contact?.id || fullContactData) {
      return
    }

    const fetchContactDetails = async () => {
      try {
        const response = await fetch(`/api/contacts/${contact.id}`, { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Failed to load contact details")
        }
        const data = await response.json()
        const contactData = data.data
        setFullContactData(contactData)

        // Update form with full data
        setForm(prev => ({
          ...prev,
          suffix: contactData.suffix || "",
          firstName: contactData.firstName || "",
          lastName: contactData.lastName || "",
          accountId: contactData.accountId || "",
          jobTitle: contactData.jobTitle || "",
          workPhone: contactData.workPhone || "",
          extension: contactData.workPhoneExt || "",
          mobilePhone: contactData.mobilePhone || "",
          emailAddress: contactData.emailAddress || "",
          accountTypeId: contactData.accountTypeId || "",
          contactTypeName: contactData.contactTypeName || "",
          active: contactData.active ?? true,
          isPrimary: contactData.isPrimary ?? false,
          isDecisionMaker: contactData.isDecisionMaker ?? false,
          preferredContactMethod: contactData.preferredContactMethod || "",
          description: contactData.description || "",
          // Address fields
          shippingStreet: contactData.mailingAddress?.line1 || "",
          shippingStreet2: contactData.mailingAddress?.line2 || "",
          shippingCity: contactData.mailingAddress?.city || "",
          shippingState: contactData.mailingAddress?.state || "",
          shippingZip: contactData.mailingAddress?.postalCode || "",
          shippingCountry: contactData.mailingAddress?.country || "United States",
          billingStreet: "",
          billingStreet2: "",
          billingCity: "",
          billingState: "",
          billingZip: "",
          billingCountry: "United States",
          sameAsShip: false
        }))
      } catch (error) {
        console.error("Failed to load contact details:", error)
        showError("Failed to load contact details", "Please try again or contact support.")
      }
    }

    fetchContactDetails()
  }, [isOpen, contact?.id, fullContactData, showError])

  const handleFieldChange = (field: keyof ContactFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const value = event.target.type === "checkbox" 
      ? (event.target as HTMLInputElement).checked 
      : event.target.value
    
    setForm(previous => ({
      ...previous,
      [field]: value
    }))
  }

  const handleSameAsShipToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked
    setForm(previous => ({
      ...previous,
      sameAsShip: checked,
      ...(checked && {
        billingStreet: previous.shippingStreet,
        billingStreet2: previous.shippingStreet2,
        billingCity: previous.shippingCity,
        billingState: previous.shippingState,
        billingZip: previous.shippingZip,
        billingCountry: previous.shippingCountry
      })
    }))
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!form.firstName.trim()) {
      newErrors.firstName = "First name is required"
    }

    if (!form.lastName.trim()) {
      newErrors.lastName = "Last name is required"
    }

    if (!form.accountId.trim()) {
      newErrors.accountId = "Account is required"
    }

    if (form.emailAddress.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailAddress.trim())) {
      newErrors.emailAddress = "Invalid email format"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!contact?.id) return

    if (!validateForm()) {
      return
    }

    setFormError(null)

    try {
      setIsSubmitting(true)
      
      const updateData = {
        suffix: form.suffix.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        accountId: form.accountId.trim(),
        jobTitle: form.jobTitle.trim(),
        workPhone: form.workPhone.trim(),
        workPhoneExt: form.extension.trim(),
        mobilePhone: form.mobilePhone.trim(),
        emailAddress: form.emailAddress.trim(),
        isPrimary: form.isPrimary,
        isDecisionMaker: form.isDecisionMaker,
        preferredContactMethod: form.preferredContactMethod.trim(),
        description: form.description.trim(),
        mailingAddress: {
          line1: form.shippingStreet.trim(),
          line2: form.shippingStreet2.trim(),
          city: form.shippingCity.trim(),
          state: form.shippingState.trim(),
          postalCode: form.shippingZip.trim(),
          country: form.shippingCountry.trim()
        }
      }

      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || "Failed to update contact")
      }

      showSuccess("Contact updated successfully", "The contact has been updated with the new information.")
      onSuccess()
    } catch (error) {
      console.error(error)
      setFormError(error instanceof Error ? error.message : "Failed to update contact")
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
        className="w-full max-w-5xl rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Contact</h2>
            <p className="text-sm text-gray-500">Update the contact information below.</p>
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
            {/* Left Column */}
            <div className="space-y-4">
              {/* Name Fields */}
              <div className="grid grid-cols-6 gap-3">
                <div className="col-span-1">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Suffix</label>
                  <input
                    type="text"
                    value={form.suffix}
                    onChange={handleFieldChange("suffix")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Mr."
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">First Name *</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={handleFieldChange("firstName")}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.firstName ? "border-red-400" : "border-gray-300"}`}
                    placeholder="First Name"
                    required
                  />
                  {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
                </div>
                <div className="col-span-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Last Name *</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={handleFieldChange("lastName")}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.lastName ? "border-red-400" : "border-gray-300"}`}
                    placeholder="Last Name"
                    required
                  />
                  {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
                </div>
              </div>

              {/* Account */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Account *</label>
                <select
                  value={form.accountId}
                  onChange={handleFieldChange("accountId")}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.accountId ? "border-red-400" : "border-gray-300"}`}
                  required
                >
                  <option value="">Select Account</option>
                  {options?.accounts.map(account => (
                    <option key={account.value} value={account.value}>
                      {account.label}
                    </option>
                  ))}
                </select>
                {errors.accountId && <p className="mt-1 text-xs text-red-600">{errors.accountId}</p>}
              </div>

              {/* Job Title */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Job Title</label>
                <input
                  type="text"
                  value={form.jobTitle}
                  onChange={handleFieldChange("jobTitle")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Job Title"
                />
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Work Phone</label>
                  <input
                    type="tel"
                    value={form.workPhone}
                    onChange={handleFieldChange("workPhone")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Work Phone"
                  />
                </div>
                <div className="col-span-1">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Extension</label>
                  <input
                    type="text"
                    value={form.extension}
                    onChange={handleFieldChange("extension")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Ext"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Mobile Phone</label>
                <input
                  type="tel"
                  value={form.mobilePhone}
                  onChange={handleFieldChange("mobilePhone")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Mobile Phone"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  value={form.emailAddress}
                  onChange={handleFieldChange("emailAddress")}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.emailAddress ? "border-red-400" : "border-gray-300"}`}
                  placeholder="Email Address"
                />
                {errors.emailAddress && <p className="mt-1 text-xs text-red-600">{errors.emailAddress}</p>}
              </div>

              {/* Contact Classification */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Active</label>
                  <div className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 py-2">
                    <span className="text-sm text-gray-600">{form.active ? "Yes" : "No"}</span>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={form.active}
                        onChange={handleFieldChange("active")}
                      />
                      <span>Active</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Primary</label>
                  <div className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 py-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={form.isPrimary}
                        onChange={handleFieldChange("isPrimary")}
                      />
                      <span>Primary</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Decision Maker</label>
                  <div className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 py-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={form.isDecisionMaker}
                        onChange={handleFieldChange("isDecisionMaker")}
                      />
                      <span>Decision Maker</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Preferred Contact Method</label>
                <select
                  value={form.preferredContactMethod}
                  onChange={handleFieldChange("preferredContactMethod")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Method</option>
                  {options?.contactMethods.map(method => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={handleFieldChange("description")}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Additional notes or description"
                />
              </div>
            </div>

            {/* Right Column - Address */}
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800">Mailing Address</h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Street</label>
                    <input
                      type="text"
                      value={form.shippingStreet}
                      onChange={handleFieldChange("shippingStreet")}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Street Address"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Street 2</label>
                    <input
                      type="text"
                      value={form.shippingStreet2}
                      onChange={handleFieldChange("shippingStreet2")}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Apt, Suite, etc."
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-600">City</label>
                      <input
                        type="text"
                        value={form.shippingCity}
                        onChange={handleFieldChange("shippingCity")}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">State</label>
                      <select
                        value={form.shippingState}
                        onChange={handleFieldChange("shippingState")}
                        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">State</option>
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
                      <label className="mb-1 block text-xs font-medium text-gray-600">Zip Code</label>
                      <input
                        type="text"
                        value={form.shippingZip}
                        onChange={handleFieldChange("shippingZip")}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Zip Code"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Country</label>
                      <select
                        value={form.shippingCountry}
                        onChange={handleFieldChange("shippingCountry")}
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
              {isSubmitting ? "Updating..." : "Update"}
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