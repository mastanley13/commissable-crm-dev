"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Edit, Trash2, Mail, Phone, MapPin, Calendar, User, Building, Loader2 } from "lucide-react"
import { formatPhoneNumber } from "@/lib/utils"

interface ContactDetail {
  id: string
  accountId: string
  accountName: string
  accountTypeId: string
  accountTypeName: string
  ownerId: string
  ownerName: string
  suffix: string
  prefix: string
  firstName: string
  middleName: string
  lastName: string
  fullName: string
  jobTitle: string
  department: string
  contactType: string
  workPhone: string
  workPhoneExt: string
  mobilePhone: string
  otherPhone: string
  fax: string
  emailAddress: string
  alternateEmail: string
  preferredContactMethod: string
  isPrimary: boolean
  isDecisionMaker: boolean
  assistantName: string
  assistantPhone: string
  linkedinUrl: string
  websiteUrl: string
  birthdate: string
  anniversary: string
  description: string
  notes: string
  syncAddressWithAccount: boolean
  mailingAddress?: {
    id: string
    line1: string
    line2?: string
    city: string
    state?: string
    postalCode?: string
    country?: string
  }
  reportsToContactId: string
  reportsToContactName: string
  createdAt: string
  updatedAt: string
}

export default function ContactDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const contactId = params.id as string
  
  const [contact, setContact] = useState<ContactDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadContact = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/contacts/${contactId}`, { cache: "no-store" })
        
        if (!response.ok) {
          if (response.status === 404) {
            setError("Contact not found")
          } else {
            throw new Error("Failed to load contact")
          }
          return
        }

        const data = await response.json()
        setContact(data.data)
        setError(null)
      } catch (err) {
        console.error("Error loading contact:", err)
        setError("Failed to load contact")
      } finally {
        setLoading(false)
      }
    }

    if (contactId) {
      loadContact()
    }
  }, [contactId])

  const handleEdit = () => {
    // TODO: Open edit modal or navigate to edit page
    console.log("Edit contact:", contact?.id)
  }

  const handleDelete = async () => {
    if (!contact || !confirm(`Are you sure you want to delete ${contact.fullName}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        throw new Error("Failed to delete contact")
      }

      // Navigate back to contacts list
      router.push("/contacts")
    } catch (err) {
      console.error("Error deleting contact:", err)
      alert("Failed to delete contact")
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—"
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          <span className="text-gray-600">Loading contact details...</span>
        </div>
      </div>
    )
  }

  if (error || !contact) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Contact Not Found</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push("/contacts")}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Contacts
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/contacts")}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{contact.fullName}</h1>
              <p className="text-gray-600">{contact.jobTitle || "No title specified"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleEdit}
              className="inline-flex items-center px-3 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center px-3 py-2 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Contact Information */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Contact Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <p className="text-gray-900">{contact.fullName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                    <p className="text-gray-900">{contact.jobTitle || "—"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <p className="text-gray-900">{contact.department || "—"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Type</label>
                    <p className="text-gray-900">{contact.accountTypeName || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Communication */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Communication
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <p className="text-gray-900">
                      {contact.emailAddress ? (
                        <a href={`mailto:${contact.emailAddress}`} className="text-blue-600 hover:text-blue-800">
                          {contact.emailAddress}
                        </a>
                      ) : "—"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Email</label>
                    <p className="text-gray-900">
                      {contact.alternateEmail ? (
                        <a href={`mailto:${contact.alternateEmail}`} className="text-blue-600 hover:text-blue-800">
                          {contact.alternateEmail}
                        </a>
                      ) : "—"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work Phone</label>
                    <p className="text-gray-900">
                      {contact.workPhone ? (
                        <a href={`tel:${contact.workPhone}`} className="text-blue-600 hover:text-blue-800">
                          {formatPhoneNumber(contact.workPhone)}
                          {contact.workPhoneExt && ` ext. ${contact.workPhoneExt}`}
                        </a>
                      ) : "—"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Phone</label>
                    <p className="text-gray-900">
                      {contact.mobilePhone ? (
                        <a href={`tel:${contact.mobilePhone}`} className="text-blue-600 hover:text-blue-800">
                          {formatPhoneNumber(contact.mobilePhone)}
                        </a>
                      ) : "—"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Other Phone</label>
                    <p className="text-gray-900">
                      {contact.otherPhone ? (
                        <a href={`tel:${contact.otherPhone}`} className="text-blue-600 hover:text-blue-800">
                          {formatPhoneNumber(contact.otherPhone)}
                        </a>
                      ) : "—"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fax</label>
                    <p className="text-gray-900">{contact.fax || "—"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Contact Method</label>
                    <p className="text-gray-900">{contact.preferredContactMethod || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Additional Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Birthdate</label>
                    <p className="text-gray-900">{formatDate(contact.birthdate)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Anniversary</label>
                    <p className="text-gray-900">{formatDate(contact.anniversary)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
                    <p className="text-gray-900">
                      {contact.linkedinUrl ? (
                        <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                          {contact.linkedinUrl}
                        </a>
                      ) : "—"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <p className="text-gray-900">
                      {contact.websiteUrl ? (
                        <a href={contact.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                          {contact.websiteUrl}
                        </a>
                      ) : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Account Information */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Account Information
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                    <p className="text-gray-900">
                      <a href={`/accounts/${contact.accountId}`} className="text-blue-600 hover:text-blue-800">
                        {contact.accountName}
                      </a>
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                    <p className="text-gray-900">{contact.accountTypeName || "—"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                    <p className="text-gray-900">{contact.ownerName || "—"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reports To</label>
                    <p className="text-gray-900">{contact.reportsToContactName || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Primary Contact</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      contact.isPrimary 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {contact.isPrimary ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Decision Maker</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      contact.isDecisionMaker 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {contact.isDecisionMaker ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mailing Address */}
              {contact.mailingAddress && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Mailing Address
                  </h2>
                  <div className="text-sm text-gray-700">
                    <p>{contact.mailingAddress.line1}</p>
                    {contact.mailingAddress.line2 && <p>{contact.mailingAddress.line2}</p>}
                    <p>
                      {contact.mailingAddress.city}
                      {contact.mailingAddress.state && `, ${contact.mailingAddress.state}`}
                      {contact.mailingAddress.postalCode && ` ${contact.mailingAddress.postalCode}`}
                    </p>
                    {contact.mailingAddress.country && <p>{contact.mailingAddress.country}</p>}
                  </div>
                </div>
              )}

              {/* Assistant Information */}
              {(contact.assistantName || contact.assistantPhone) && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Assistant</h2>
                  <div className="space-y-3">
                    {contact.assistantName && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <p className="text-gray-900">{contact.assistantName}</p>
                      </div>
                    )}
                    {contact.assistantPhone && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <p className="text-gray-900">
                          <a href={`tel:${contact.assistantPhone}`} className="text-blue-600 hover:text-blue-800">
                            {formatPhoneNumber(contact.assistantPhone)}
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {contact.notes && (
            <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}

          {/* Description */}
          {contact.description && (
            <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{contact.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
