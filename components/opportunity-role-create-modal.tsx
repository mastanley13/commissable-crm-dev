"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useToasts } from "@/components/toast"

interface ContactOption {
  value: string
  label: string
  accountName?: string
}

interface RoleOption {
  value: string
  label: string
}

interface OpportunityRoleCreateModalProps {
  isOpen: boolean
  opportunityId: string
  onClose: () => void
  onSuccess?: () => void
}

type Mode = "existing" | "new"

export function OpportunityRoleCreateModal({ isOpen, opportunityId, onClose, onSuccess }: OpportunityRoleCreateModalProps) {
  const { showError, showSuccess } = useToasts()
  const [mode, setMode] = useState<Mode>("new")
  const [loading, setLoading] = useState(false)

  // Existing contact mode state
  const [contactQuery, setContactQuery] = useState("")
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null)
  const [existingRole, setExistingRole] = useState("")
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([])
  const [roleQuery, setRoleQuery] = useState("")
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [rolesLoading, setRolesLoading] = useState(false)

  // New role mode state
  const [newRole, setNewRole] = useState("")
  const [fullName, setFullName] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [email, setEmail] = useState("")
  const [workPhone, setWorkPhone] = useState("")
  const [phoneExtension, setPhoneExtension] = useState("")
  const [mobile, setMobile] = useState("")

  useEffect(() => {
    if (!isOpen) return
    // Reset state whenever modal opens
    setMode("new")
    setLoading(false)
    setContactQuery("")
    setContacts([])
    setContactsLoading(false)
    setShowContactDropdown(false)
    setSelectedContact(null)
    setExistingRole("")
    setNewRole("")
    setRoleQuery("")
    setShowRoleDropdown(false)
    setFullName("")
    setJobTitle("")
    setEmail("")
    setWorkPhone("")
    setPhoneExtension("")
    setMobile("")
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const controller = new AbortController()
    const fetchContacts = async () => {
      try {
        setContactsLoading(true)
        const params = new URLSearchParams({ page: "1", pageSize: "50" })
        const trimmed = contactQuery.trim()
        if (trimmed) params.set("q", trimmed)
        const res = await fetch(`/api/contacts?${params.toString()}`, { cache: "no-store", signal: controller.signal })
        if (!res.ok) throw new Error("Failed to load contacts")
        const payload = await res.json().catch(() => null)
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []
        const options: ContactOption[] = items.map(item => ({
          value: item.id,
          label: item.fullName?.trim() || "Unnamed contact",
          accountName: item.accountName || undefined
        }))
        setContacts(options)
      } catch (e) {
        setContacts([])
      } finally {
        setContactsLoading(false)
      }
    }
    fetchContacts()
    return () => controller.abort()
  }, [isOpen, contactQuery])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let cancelled = false

    const fetchRoles = async () => {
      setRolesLoading(true)
      try {
        const response = await fetch("/api/admin/roles", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Failed to load roles")
        }
        const payload = await response.json().catch(() => null)
        const items: any[] = Array.isArray(payload?.data?.roles) ? payload.data.roles : []

        if (cancelled) {
          return
        }

        const options: RoleOption[] = items
          .map(roleItem => {
            const label = (roleItem.name || roleItem.code || "").trim()
            return label
              ? {
                  value: label,
                  label
                }
              : null
          })
          .filter((option): option is RoleOption => Boolean(option))

        setRoleOptions(options)
      } catch (error) {
        if (!cancelled) {
          console.error("Unable to load roles", error)
          setRoleOptions([])
        }
      } finally {
        if (!cancelled) {
          setRolesLoading(false)
        }
      }
    }

    void fetchRoles()

    return () => {
      cancelled = true
    }
  }, [isOpen])

  const canSubmitExisting = useMemo(() => {
    return Boolean(selectedContact?.value && existingRole.trim().length > 0)
  }, [selectedContact, existingRole])

  const canSubmitNew = useMemo(() => {
    return newRole.trim().length > 0 && fullName.trim().length > 0
  }, [newRole, fullName])

  const filteredRoles = useMemo(() => {
    if (!roleQuery.trim()) {
      return roleOptions
    }
    const query = roleQuery.toLowerCase()
    return roleOptions.filter(option => option.label.toLowerCase().includes(query))
  }, [roleOptions, roleQuery])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    try {
      setLoading(true)
      let payload: Record<string, unknown>
      if (mode === "existing") {
        if (!selectedContact?.value || !existingRole.trim()) {
          showError("Missing info", "Select a contact and enter a role.")
          setLoading(false)
          return
        }
        payload = {
          contactId: selectedContact.value,
          role: existingRole.trim()
        }
      } else {
        if (!canSubmitNew) {
          showError("Missing info", "Full name and role are required.")
          setLoading(false)
          return
        }
        payload = {
          role: newRole.trim(),
          fullName: fullName.trim(),
          jobTitle: jobTitle.trim() || null,
          email: email.trim() || null,
          workPhone: workPhone.trim() || null,
          phoneExtension: phoneExtension.trim() || null,
          mobile: mobile.trim() || null
        }
      }

      const response = await fetch(`/api/opportunities/${opportunityId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.error ?? "Failed to create role")
      }
      showSuccess("Role added", "The role has been added to this opportunity.")
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error("Failed to create opportunity role", error)
      showError("Unable to add role", error instanceof Error ? error.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [mode, selectedContact, existingRole, canSubmitNew, newRole, fullName, jobTitle, email, workPhone, phoneExtension, mobile, opportunityId, showError, showSuccess, onSuccess, onClose, loading])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-5xl h-[900px] rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-600">Add Opportunity Role</p>
            <h2 className="text-lg font-semibold text-gray-900">Add Role</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4">
            {/* Mode toggle */}
            <div className="mb-4 inline-flex gap-1">
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold shadow-sm transition ${
                  mode === "new"
                    ? "border-primary-700 bg-primary-700 text-white hover:bg-primary-800"
                    : "border-blue-300 bg-gradient-to-b from-blue-100 to-blue-200 text-primary-800 hover:from-blue-200 hover:to-blue-300 hover:border-blue-400"
                }`}
              >
                New Role
              </button>
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold shadow-sm transition ${
                  mode === "existing"
                    ? "border-primary-700 bg-primary-700 text-white hover:bg-primary-800"
                    : "border-blue-300 bg-gradient-to-b from-blue-100 to-blue-200 text-primary-800 hover:from-blue-200 hover:to-blue-300 hover:border-blue-400"
                }`}
              >
                Existing Contact
              </button>
            </div>

            {mode === "existing" ? (
              <div className="space-y-3">
                <div className="relative">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Contact<span className="ml-1 text-red-500">*</span></label>
                  <input
                    type="text"
                    value={selectedContact ? selectedContact.label : contactQuery}
                    onChange={e => { setSelectedContact(null); setContactQuery(e.target.value); setShowContactDropdown(true) }}
                    onFocus={() => setShowContactDropdown(true)}
                    onBlur={() => setTimeout(() => setShowContactDropdown(false), 160)}
                    placeholder="Type to search contacts..."
                    className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                    disabled={contactsLoading}
                    required
                  />
                  {showContactDropdown && (contactsLoading || contacts.length > 0) && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {contactsLoading ? (
                        <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
                      ) : (
                        contacts.map(option => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => { setSelectedContact(option); setContactQuery(option.label); setShowContactDropdown(false) }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                          >
                            <div className="font-medium text-gray-900">{option.label}</div>
                            {option.accountName && (
                              <div className="text-xs text-gray-500">{option.accountName}</div>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Role<span className="ml-1 text-red-500">*</span></label>
                  <input
                    type="text"
                    value={existingRole}
                    onChange={e => {
                      const value = e.target.value
                      setExistingRole(value)
                      setRoleQuery(value)
                      setShowRoleDropdown(true)
                    }}
                    onFocus={() => {
                      setRoleQuery(existingRole)
                      setShowRoleDropdown(true)
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowRoleDropdown(false), 160)
                    }}
                    placeholder="e.g., Decision Maker, Vendor, Distributor"
                    className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                    disabled={rolesLoading}
                    required
                  />
                  {showRoleDropdown && (rolesLoading || filteredRoles.length > 0) && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {rolesLoading ? (
                        <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
                      ) : (
                        filteredRoles.map(option => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setExistingRole(option.value)
                              setRoleQuery(option.value)
                              setShowRoleDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                          >
                            <div className="font-medium text-gray-900">{option.label}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Full Name<span className="ml-1 text-red-500">*</span></label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                    placeholder="e.g., Jane Smith"
                    required
                  />
                </div>
                <div className="relative sm:col-span-2">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Role<span className="ml-1 text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newRole}
                    onChange={e => {
                      const value = e.target.value
                      setNewRole(value)
                      setRoleQuery(value)
                      setShowRoleDropdown(true)
                    }}
                    onFocus={() => {
                      setRoleQuery(newRole)
                      setShowRoleDropdown(true)
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowRoleDropdown(false), 160)
                    }}
                    className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                    placeholder="e.g., Decision Maker"
                    disabled={rolesLoading}
                    required
                  />
                  {showRoleDropdown && (rolesLoading || filteredRoles.length > 0) && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {rolesLoading ? (
                        <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
                      ) : (
                        filteredRoles.map(option => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setNewRole(option.value)
                              setRoleQuery(option.value)
                              setShowRoleDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                          >
                            <div className="font-medium text-gray-900">{option.label}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Job Title</label>
                  <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Work Phone</label>
                  <input type="text" value={workPhone} onChange={e => setWorkPhone(e.target.value)} className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Extension</label>
                  <input type="text" value={phoneExtension} onChange={e => setPhoneExtension(e.target.value)} className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Mobile</label>
                  <input type="text" value={mobile} onChange={e => setMobile(e.target.value)} className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500" />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3">
            <div className="text-xs text-gray-500">All fields can be edited later.</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
              <button
                type="submit"
                disabled={loading || (mode === "existing" ? !canSubmitExisting : !canSubmitNew)}
                className="inline-flex items-center gap-1 rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Add Role</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
