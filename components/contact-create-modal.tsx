"use client"

import { useState, useEffect } from "react"
import { X, Save, Loader2 } from "lucide-react"
import { useToasts } from "./toast"

interface ContactOptions {
  accountTypes: Array<{ value: string; label: string; code: string }>
  owners: Array<{ value: string; label: string; firstName: string; lastName: string }>
  accounts: Array<{ value: string; label: string; accountNumber?: string }>
  contactMethods: Array<{ value: string; label: string }>
}

interface ContactCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  options?: ContactOptions
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
  contactType: string
  active: boolean
  
  // Additional fields
  description: string
  
  // Address fields (matching the screenshot)
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

export function ContactCreateModal({ isOpen, onClose, onSuccess, options }: ContactCreateModalProps) {
  const [formData, setFormData] = useState<ContactFormData>({
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
    contactType: "",
    active: true,
    
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
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showSuccess, showError } = useToasts()

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({
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
        contactType: "",
        active: true,
        
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
      })
      setError(null)
    }
  }, [isOpen])

  const handleInputChange = (field: keyof ContactFormData, value: string | boolean) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }
      
      // Handle "Same as Ship" functionality
      if (field === "sameAsShip" && value === true) {
        newData.billingStreet = prev.shippingStreet
        newData.billingStreet2 = prev.shippingStreet2
        newData.billingCity = prev.shippingCity
        newData.billingState = prev.shippingState
        newData.billingZip = prev.shippingZip
        newData.billingCountry = prev.shippingCountry
      }
      
      return newData
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!formData.accountId || !formData.firstName || !formData.lastName) {
      const errorMsg = "Account, First Name, and Last Name are required"
      setError(errorMsg)
      showError("Validation Error", errorMsg)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Prepare the data for the API
      const contactData = {
        // Required fields
        accountId: formData.accountId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        
        // Optional contact fields
        suffix: formData.suffix || undefined,
        jobTitle: formData.jobTitle || undefined,
        workPhone: formData.workPhone || undefined,
        workPhoneExt: formData.extension || undefined,
        mobilePhone: formData.mobilePhone || undefined,
        emailAddress: formData.emailAddress || undefined,
        accountTypeId: formData.contactType || undefined,
        
        // Flags
        isPrimary: formData.active,
        
        // Additional fields
        description: formData.description || undefined
      }

      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(contactData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create contact")
      }

      // Success - close modal and refresh data
      onSuccess()
      onClose()
      showSuccess("Contact created successfully", `${formData.firstName} ${formData.lastName} has been added to your contacts.`)
    } catch (err) {
      console.error("Error creating contact:", err)
      const errorMsg = err instanceof Error ? err.message : "Failed to create contact"
      setError(errorMsg)
      showError("Failed to create contact", errorMsg)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-5xl rounded-xl bg-white shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Create New Contact</h2>
            <p className="text-sm text-gray-500">Fill out the details below to add a new contact.</p>
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
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left Column - Contact Details */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Suffix</label>
                  <select
                    value={formData.suffix}
                    onChange={(e) => handleInputChange("suffix", e.target.value)}
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
                  <label className="mb-1 block text-sm font-medium text-gray-700">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter First Name"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter Last Name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Account Name *</label>
                <select
                  value={formData.accountId}
                  onChange={(e) => handleInputChange("accountId", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Select</option>
                  {options?.accounts.map(account => (
                    <option key={account.value} value={account.value}>
                      {account.label} {account.accountNumber && `(${account.accountNumber})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Job Title</label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => handleInputChange("jobTitle", e.target.value)}
                  placeholder="Enter Job Title"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Work Phone</label>
                  <input
                    type="tel"
                    value={formData.workPhone}
                    onChange={(e) => handleInputChange("workPhone", e.target.value)}
                    placeholder="+1-555-123-4567"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Extension</label>
                  <input
                    type="text"
                    value={formData.extension}
                    onChange={(e) => handleInputChange("extension", e.target.value)}
                    placeholder="Extension"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Mobile</label>
                <input
                  type="tel"
                  value={formData.mobilePhone}
                  onChange={(e) => handleInputChange("mobilePhone", e.target.value)}
                  placeholder="+1-555-987-6543"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Contact Type</label>
                  <select
                    value={formData.contactType}
                    onChange={(e) => handleInputChange("contactType", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select</option>
                    {options?.accountTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Active (Y/N)</label>
                  <div className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 py-2">
                    <span className="text-sm text-gray-600">{formData.active ? "Yes" : "No"}</span>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={formData.active}
                        onChange={(e) => handleInputChange("active", e.target.checked)}
                      />
                      <span>Active</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  value={formData.emailAddress}
                  onChange={(e) => handleInputChange("emailAddress", e.target.value)}
                  placeholder="Enter Your Email"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Enter Description"
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Right Column - Address Details */}
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800">Ship To Address</h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Shipping Street *</label>
                    <input
                      type="text"
                      value={formData.shippingStreet}
                      onChange={(e) => handleInputChange("shippingStreet", e.target.value)}
                      placeholder="Shipping Street"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Shipping Street 2</label>
                    <input
                      type="text"
                      value={formData.shippingStreet2}
                      onChange={(e) => handleInputChange("shippingStreet2", e.target.value)}
                      placeholder="Shipping Street 2"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-600">Shipping City *</label>
                      <input
                        type="text"
                        value={formData.shippingCity}
                        onChange={(e) => handleInputChange("shippingCity", e.target.value)}
                        placeholder="Shipping City"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">State</label>
                      <select
                        value={formData.shippingState}
                        onChange={(e) => handleInputChange("shippingState", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">- State -</option>
                        <option value="AL">AL</option>
                        <option value="AK">AK</option>
                        <option value="AZ">AZ</option>
                        <option value="AR">AR</option>
                        <option value="CA">CA</option>
                        <option value="CO">CO</option>
                        <option value="CT">CT</option>
                        <option value="DE">DE</option>
                        <option value="FL">FL</option>
                        <option value="GA">GA</option>
                        <option value="HI">HI</option>
                        <option value="ID">ID</option>
                        <option value="IL">IL</option>
                        <option value="IN">IN</option>
                        <option value="IA">IA</option>
                        <option value="KS">KS</option>
                        <option value="KY">KY</option>
                        <option value="LA">LA</option>
                        <option value="ME">ME</option>
                        <option value="MD">MD</option>
                        <option value="MA">MA</option>
                        <option value="MI">MI</option>
                        <option value="MN">MN</option>
                        <option value="MS">MS</option>
                        <option value="MO">MO</option>
                        <option value="MT">MT</option>
                        <option value="NE">NE</option>
                        <option value="NV">NV</option>
                        <option value="NH">NH</option>
                        <option value="NJ">NJ</option>
                        <option value="NM">NM</option>
                        <option value="NY">NY</option>
                        <option value="NC">NC</option>
                        <option value="ND">ND</option>
                        <option value="OH">OH</option>
                        <option value="OK">OK</option>
                        <option value="OR">OR</option>
                        <option value="PA">PA</option>
                        <option value="RI">RI</option>
                        <option value="SC">SC</option>
                        <option value="SD">SD</option>
                        <option value="TN">TN</option>
                        <option value="TX">TX</option>
                        <option value="UT">UT</option>
                        <option value="VT">VT</option>
                        <option value="VA">VA</option>
                        <option value="WA">WA</option>
                        <option value="WV">WV</option>
                        <option value="WI">WI</option>
                        <option value="WY">WY</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Shipping Zip</label>
                      <input
                        type="text"
                        value={formData.shippingZip}
                        onChange={(e) => handleInputChange("shippingZip", e.target.value)}
                        placeholder="Shipping Zip"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Country</label>
                      <select
                        value={formData.shippingCountry}
                        onChange={(e) => handleInputChange("shippingCountry", e.target.value)}
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
                      checked={formData.sameAsShip}
                      onChange={(e) => handleInputChange("sameAsShip", e.target.checked)}
                    />
                    <span>Same as Ship</span>
                  </label>
                </div>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Billing Street {formData.sameAsShip ? "" : "*"}</label>
                    <input
                      type="text"
                      value={formData.billingStreet}
                      onChange={(e) => handleInputChange("billingStreet", e.target.value)}
                      placeholder="Billing Street"
                      disabled={formData.sameAsShip}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Billing Street 2</label>
                    <input
                      type="text"
                      value={formData.billingStreet2}
                      onChange={(e) => handleInputChange("billingStreet2", e.target.value)}
                      placeholder="Billing Street 2"
                      disabled={formData.sameAsShip}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-600">Billing City {formData.sameAsShip ? "" : "*"}</label>
                      <input
                        type="text"
                        value={formData.billingCity}
                        onChange={(e) => handleInputChange("billingCity", e.target.value)}
                        placeholder="Billing City"
                        disabled={formData.sameAsShip}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">State</label>
                      <select
                        value={formData.billingState}
                        onChange={(e) => handleInputChange("billingState", e.target.value)}
                        disabled={formData.sameAsShip}
                        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
                      >
                        <option value="">- State -</option>
                        <option value="AL">AL</option>
                        <option value="AK">AK</option>
                        <option value="AZ">AZ</option>
                        <option value="AR">AR</option>
                        <option value="CA">CA</option>
                        <option value="CO">CO</option>
                        <option value="CT">CT</option>
                        <option value="DE">DE</option>
                        <option value="FL">FL</option>
                        <option value="GA">GA</option>
                        <option value="HI">HI</option>
                        <option value="ID">ID</option>
                        <option value="IL">IL</option>
                        <option value="IN">IN</option>
                        <option value="IA">IA</option>
                        <option value="KS">KS</option>
                        <option value="KY">KY</option>
                        <option value="LA">LA</option>
                        <option value="ME">ME</option>
                        <option value="MD">MD</option>
                        <option value="MA">MA</option>
                        <option value="MI">MI</option>
                        <option value="MN">MN</option>
                        <option value="MS">MS</option>
                        <option value="MO">MO</option>
                        <option value="MT">MT</option>
                        <option value="NE">NE</option>
                        <option value="NV">NV</option>
                        <option value="NH">NH</option>
                        <option value="NJ">NJ</option>
                        <option value="NM">NM</option>
                        <option value="NY">NY</option>
                        <option value="NC">NC</option>
                        <option value="ND">ND</option>
                        <option value="OH">OH</option>
                        <option value="OK">OK</option>
                        <option value="OR">OR</option>
                        <option value="PA">PA</option>
                        <option value="RI">RI</option>
                        <option value="SC">SC</option>
                        <option value="SD">SD</option>
                        <option value="TN">TN</option>
                        <option value="TX">TX</option>
                        <option value="UT">UT</option>
                        <option value="VT">VT</option>
                        <option value="VA">VA</option>
                        <option value="WA">WA</option>
                        <option value="WV">WV</option>
                        <option value="WI">WI</option>
                        <option value="WY">WY</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Billing Zip</label>
                      <input
                        type="text"
                        value={formData.billingZip}
                        onChange={(e) => handleInputChange("billingZip", e.target.value)}
                        placeholder="Billing Zip"
                        disabled={formData.sameAsShip}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Country</label>
                      <select
                        value={formData.billingCountry}
                        onChange={(e) => handleInputChange("billingCountry", e.target.value)}
                        disabled={formData.sameAsShip}
                        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
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
              disabled={loading}
              className="rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
            >
              {loading ? "Creating..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}