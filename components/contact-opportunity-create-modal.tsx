"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { DropdownChevron } from "@/components/dropdown-chevron"
import { useToasts } from "@/components/toast"
import { getOpportunityStageOptions, type OpportunityStageOption } from "@/lib/opportunity-stage"

interface SelectOption {
  value: string
  label: string
}

interface ContactOption extends SelectOption {
  accountName?: string
}

interface OpportunityRoleDraft {
  contactId: string
  role: string
}

interface ContactOpportunityFormState {
  opportunityName: string
  stage: string
  estimatedCloseDate: string
  owner: string
  referredBy: string
  referredByContactId: string
  subAgent: string
  subagentContactId: string
  primaryAccount: string
  splitWithAgency: boolean
  notes: string
}

export interface ContactOpportunityCreateModalProps {
  isOpen: boolean
  contactName?: string
  accountId?: string
  accountName?: string
  onClose: () => void
  onSuccess?: () => void
}

const createInitialState = (accountName?: string): ContactOpportunityFormState => ({
  opportunityName: "",
  stage: "Qualification",
  estimatedCloseDate: "",
  owner: "",
  referredBy: "Referral",
  referredByContactId: "",
  subAgent: "",
  subagentContactId: "",
  primaryAccount: accountName ?? "",
  splitWithAgency: false,
  notes: ""
})

const STAGE_OPTIONS: OpportunityStageOption[] = getOpportunityStageOptions()

const formatStageLabel = (option: OpportunityStageOption) =>
  option.autoManaged ? `${option.label} (auto-managed)` : option.label

const LEAD_SOURCE_OPTIONS: SelectOption[] = [
  { value: "Referral", label: "Referral" },
  { value: "Inbound", label: "Inbound" },
  { value: "Event", label: "Event" },
  { value: "Partner", label: "Partner" }
]

export function ContactOpportunityCreateModal({ isOpen, contactName, accountId, accountName, onClose, onSuccess }: ContactOpportunityCreateModalProps) {
  const [form, setForm] = useState<ContactOpportunityFormState>(() => createInitialState(accountName))
  const [loading, setLoading] = useState(false)
  const [ownerOptions, setOwnerOptions] = useState<SelectOption[]>([])
  const [ownerQuery, setOwnerQuery] = useState("")
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const [ownersLoading, setOwnersLoading] = useState(false)
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [contactQuery, setContactQuery] = useState("None")
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [subagents, setSubagents] = useState<ContactOption[]>([])
  const [subagentQuery, setSubagentQuery] = useState("None")
  const [showSubagentDropdown, setShowSubagentDropdown] = useState(false)
  const [subagentsLoading, setSubagentsLoading] = useState(false)
  const [roleContacts, setRoleContacts] = useState<SelectOption[]>([])
  const [roleContactsLoading, setRoleContactsLoading] = useState(false)
  const [roleDrafts, setRoleDrafts] = useState<OpportunityRoleDraft[]>([{ contactId: "", role: "Decision Maker" }])
  const [roleServerError, setRoleServerError] = useState<string | null>(null)
  const { showError, showSuccess } = useToasts()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm(createInitialState(accountName))
    setContactQuery("None")
    setOwnerQuery("")
    setSubagentQuery("None")
    setRoleDrafts([{ contactId: "", role: "Decision Maker" }])
    setRoleServerError(null)
  }, [isOpen, accountName])

  useEffect(() => {
    if (!isOpen || !accountId) {
      setRoleContacts([])
      return
    }

    let cancelled = false
    setRoleContactsLoading(true)

    const loadRoleContacts = async () => {
      try {
        const response = await fetch(`/api/accounts/${accountId}`, { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Failed to load account")
        }

        const payload = await response.json().catch(() => null)
        const accountContacts: any[] = Array.isArray(payload?.data?.contacts) ? payload.data.contacts : []
        const parentAccountId = typeof payload?.data?.parentAccountId === "string" ? payload.data.parentAccountId.trim() : ""

        const baseOptions: SelectOption[] = accountContacts
          .filter(item => item && item.active !== false)
          .map(item => ({
            value: String(item.id ?? ""),
            label: String(item.fullName ?? "").trim() || "Unnamed contact"
          }))
          .filter(option => option.value.trim().length > 0)

        const merged = new Map<string, SelectOption>()
        for (const option of baseOptions) {
          merged.set(option.value, option)
        }

        if (parentAccountId.length > 0) {
          const parentResponse = await fetch(`/api/accounts/${parentAccountId}`, { cache: "no-store" })
          if (parentResponse.ok) {
            const parentPayload = await parentResponse.json().catch(() => null)
            const parentAccountName =
              typeof parentPayload?.data?.accountName === "string" ? parentPayload.data.accountName.trim() : ""
            const parentContacts: any[] = Array.isArray(parentPayload?.data?.contacts) ? parentPayload.data.contacts : []

            for (const item of parentContacts) {
              if (!item || item.active === false) continue
              const value = String(item.id ?? "").trim()
              if (!value) continue
              const fullName = String(item.fullName ?? "").trim() || "Unnamed contact"
              const label = parentAccountName ? `${fullName} (${parentAccountName})` : fullName
              if (!merged.has(value)) {
                merged.set(value, { value, label })
              }
            }
          }
        }

        if (!cancelled) {
          setRoleContacts(Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label)))
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Unable to load role contacts", error)
          setRoleContacts([])
        }
      } finally {
        if (!cancelled) {
          setRoleContactsLoading(false)
        }
      }
    }

    void loadRoleContacts()

    return () => {
      cancelled = true
    }
  }, [isOpen, accountId])

  useEffect(() => {
    if (!isOpen) return
    const desiredName = (contactName ?? "").trim()
    if (!desiredName) return
    if (roleDrafts.length === 0) return
    if (roleDrafts[0].contactId.trim().length > 0) return

    const match = roleContacts.find(option => option.label.trim().toLowerCase() === desiredName.toLowerCase())
    if (!match) return

    setRoleDrafts(prev => {
      if (prev.length === 0) return prev
      if (prev[0].contactId.trim().length > 0) return prev
      return [{ ...prev[0], contactId: match.value }, ...prev.slice(1)]
    })
  }, [isOpen, contactName, roleContacts, roleDrafts])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let cancelled = false

    async function loadOwners() {
      setOwnersLoading(true)
      try {
        const response = await fetch("/api/admin/users?limit=100&status=Active", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Request failed")
        }
        const payload = await response.json().catch(() => null)
        const users: any[] = Array.isArray(payload?.data?.users) ? payload.data.users : []
        if (cancelled) return
        const options = users.map(user => ({
          value: user.id,
          label: user.fullName || user.email
        }))
        setOwnerOptions(options)

        // Set default owner and populate query
        if (options.length > 0) {
          setForm(prev => (prev.owner ? prev : { ...prev, owner: options[0].value }))
          setOwnerQuery(options[0].label)
        }
      } catch (error) {
        if (!cancelled) {
          setOwnerOptions([])
        }
      } finally {
        if (!cancelled) {
          setOwnersLoading(false)
        }
      }
    }

    loadOwners()

    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const controller = new AbortController()
    const fetchContacts = async () => {
      setContactsLoading(true)
      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "50"
        })

        const rawQuery = contactQuery.trim()
        const trimmedQuery = rawQuery.toLowerCase() === "none" ? "" : rawQuery
        if (trimmedQuery.length > 0) {
          params.set("q", trimmedQuery)
        }

        const response = await fetch(`/api/contacts?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error("Failed to load contacts")
        }

        const payload = await response.json()
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []

        const options: ContactOption[] = items.map(item => {
          const fullName = item.fullName?.trim() || ""

          return {
            value: item.id,
            label: fullName || "Unnamed contact",
            accountName: item.accountName || undefined
          }
        })

        setContacts(options)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        console.error("Unable to load contacts", error)
        setContacts([])
      } finally {
        setContactsLoading(false)
      }
    }

    const debounce = setTimeout(() => {
      void fetchContacts()
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(debounce)
    }
  }, [isOpen, contactQuery])

  // Load subagents (Contact Type = Subagent) for typeahead
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const controller = new AbortController()
    const fetchSubagents = async () => {
      setSubagentsLoading(true)
      try {
        const params = new URLSearchParams({ page: "1", pageSize: "50", contactType: "Subagent" })
        const raw = subagentQuery.trim()
        const q = raw.toLowerCase() === "none" ? "" : raw
        if (q.length > 0) params.set("q", q)

        const response = await fetch(`/api/contacts?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        })
        if (!response.ok) throw new Error("Failed to load subagents")

        const payload = await response.json().catch(() => null)
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []
        const options: ContactOption[] = items.map(item => ({
          value: item.id,
          label: (item.fullName?.trim() || "Unnamed contact"),
          accountName: item.accountName || undefined
        }))
        setSubagents(options)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        setSubagents([])
      } finally {
        setSubagentsLoading(false)
      }
    }

    const debounce = setTimeout(() => { void fetchSubagents() }, 250)
    return () => { controller.abort(); clearTimeout(debounce) }
  }, [isOpen, subagentQuery])

  const filteredOwners = useMemo(() => {
    if (!ownerQuery.trim()) {
      return ownerOptions
    }
    const query = ownerQuery.toLowerCase()
    return ownerOptions.filter(owner => owner.label.toLowerCase().includes(query))
  }, [ownerOptions, ownerQuery])

  const roleValidation = useMemo(() => {
    const meaningful = roleDrafts.filter(draft => draft.contactId.trim().length > 0 || draft.role.trim().length > 0)
    const incomplete = meaningful.filter(draft => !(draft.contactId.trim().length > 0 && draft.role.trim().length > 0))
    const hasValid = meaningful.some(draft => draft.contactId.trim().length > 0 && draft.role.trim().length > 0)
    return {
      meaningful,
      hasValid,
      hasIncomplete: incomplete.length > 0
    }
  }, [roleDrafts])

  const canSubmit = useMemo(() => {
    return Boolean(
      form.opportunityName.trim() &&
        form.owner &&
        accountId &&
        form.estimatedCloseDate &&
        roleValidation.hasValid &&
        !roleValidation.hasIncomplete
    )
  }, [form.opportunityName, form.owner, accountId, form.estimatedCloseDate, roleValidation.hasValid, roleValidation.hasIncomplete])

  const handleClose = () => {
    setForm(createInitialState(accountName))
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || !accountId) {
      if (!roleValidation.hasValid) {
        showError("Missing information", "At least one role contact is required.")
        return
      }

      if (roleValidation.hasIncomplete) {
        showError("Missing information", "Please complete or remove incomplete role rows.")
        return
      }

      showError("Missing information", "Opportunity name, estimated close date, owner, and account are required.")
      return
    }

    const computedSubAgent = (form.subAgent?.trim() || (form.splitWithAgency ? "Partner agency" : "")) || null

    const roleDraftsToCreate = roleValidation.meaningful
      .filter(draft => draft.contactId.trim().length > 0 && draft.role.trim().length > 0)
      .map(draft => ({ contactId: draft.contactId.trim(), role: draft.role.trim() }))

    const payload = {
      accountId,
      name: form.opportunityName.trim(),
      stage: form.stage,
      estimatedCloseDate: form.estimatedCloseDate,
      ownerId: form.owner,
      leadSource: form.referredBy,
      referredBy: form.referredByContactId || null,
      referredByContactId: form.referredByContactId || null,
      subAgent: computedSubAgent,
      subagentContactId: form.subagentContactId || null,
      notes: form.notes.trim() || undefined,
      roles: roleDraftsToCreate
    }

    setLoading(true)
    setRoleServerError(null)
    try {
      const response = await fetch("/api/opportunities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        const serverRoleError = typeof (errorPayload as any)?.errors?.roles === "string" ? (errorPayload as any).errors.roles : null
        if (serverRoleError) {
          setRoleServerError(serverRoleError)
        }
        throw new Error(errorPayload?.error ?? "Unable to create opportunity")
      }

      showSuccess("Opportunity created", "The opportunity has been added for this contact.")
      onSuccess?.()
      handleClose()
    } catch (error) {
      console.error("Failed to create opportunity", error)
      showError("Unable to create opportunity", error instanceof Error ? error.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-600">Create Opportunity</p>
            <h2 className="text-lg font-semibold text-gray-900">New Opportunity for {contactName ?? "this contact"}</h2>
            <p className="text-sm text-gray-500">Capture potential revenue tied to this relationship.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Opportunity Name<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={form.opportunityName}
                onChange={event => setForm(prev => ({ ...prev, opportunityName: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="Enterprise renewal"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Stage</label>
              <select
                value={form.stage}
                onChange={event => setForm(prev => ({ ...prev, stage: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              >
                {STAGE_OPTIONS.map(option => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled && option.value !== form.stage}
                    title={option.disabledReason}
                  >
                    {formatStageLabel(option)}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Estimated Close Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={form.estimatedCloseDate}
                  onChange={event => setForm(prev => ({ ...prev, estimatedCloseDate: event.target.value }))}
                  className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 pr-10 text-xs focus:outline-none focus:border-primary-500 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:opacity-0 [&::-webkit-datetime-edit]:focus:opacity-100"
                  style={{ colorScheme: 'light' }}
                  onFocus={(e) => {
                    e.currentTarget.classList.add('date-input-focused')
                  }}
                  onBlur={(e) => {
                    e.currentTarget.classList.remove('date-input-focused')
                  }}
                />
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-900">
                  {form.estimatedCloseDate || <span className="text-gray-400">YYYY-MM-DD</span>}
                </span>
              </div>
            </div>

            <div className="relative">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Opportunity Owner<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={ownerQuery}
                onChange={event => {
                  setOwnerQuery(event.target.value)
                  setShowOwnerDropdown(true)
                }}
                onFocus={() => setShowOwnerDropdown(true)}
                onBlur={() => {
                  setTimeout(() => setShowOwnerDropdown(false), 200)
                }}
                placeholder="Type to search owners..."
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 pr-8 text-xs focus:outline-none focus:border-primary-500"
                disabled={ownersLoading}
                required
              />
              <DropdownChevron open={showOwnerDropdown} />
              {showOwnerDropdown && filteredOwners.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {filteredOwners.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, owner: option.value }))
                        setOwnerQuery(option.label)
                        setShowOwnerDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                    >
                      <div className="font-medium text-gray-900">{option.label}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2 rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Role Contacts<span className="ml-1 text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setRoleDrafts(prev => [...prev, { contactId: "", role: "" }])}
                  className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
                  disabled={roleContactsLoading}
                  title={roleContactsLoading ? "Loading contacts..." : "Add another role"}
                >
                  Add Role
                </button>
              </div>

              {roleContactsLoading && <div className="mt-3 text-sm text-gray-500">Loading available contacts...</div>}

              {!roleContactsLoading && roleContacts.length === 0 && (
                <div className="mt-3 text-sm text-gray-500">
                  No contacts found for this account (or its parent). Create a contact first.
                </div>
              )}

              <div className="mt-3 space-y-2">
                {roleDrafts.map((draft, index) => (
                  <div key={`${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_2fr_auto] md:items-end">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Contact</label>
                      <select
                        value={draft.contactId}
                        onChange={event => {
                          const value = event.target.value
                          setRoleDrafts(prev => prev.map((row, i) => (i === index ? { ...row, contactId: value } : row)))
                        }}
                        className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                        disabled={roleContactsLoading || roleContacts.length === 0}
                      >
                        <option value="">Select contact</option>
                        {roleContacts.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Role</label>
                      <input
                        type="text"
                        value={draft.role}
                        onChange={event => {
                          const value = event.target.value
                          setRoleDrafts(prev => prev.map((row, i) => (i === index ? { ...row, role: value } : row)))
                        }}
                        className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                        placeholder="e.g., Decision Maker, Buyer"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setRoleDrafts(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [{ contactId: "", role: "Decision Maker" }]))
                        }
                        className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
                        title="Remove role"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {roleServerError ? (
                <p className="mt-3 text-xs text-red-600">{roleServerError}</p>
              ) : roleValidation.hasIncomplete ? (
                <p className="mt-3 text-xs text-red-600">Please complete or remove incomplete role rows.</p>
              ) : !roleValidation.hasValid ? (
                <p className="mt-3 text-xs text-red-600">At least one role contact is required to create an opportunity.</p>
              ) : (
                <p className="mt-3 text-xs text-gray-500">At least one role contact is required to create an opportunity.</p>
              )}
            </div>

            <div className="relative">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Referred By</label>
              <input
                type="text"
                value={contactQuery}
                onChange={event => {
                  setContactQuery(event.target.value)
                  setForm(prev => ({ ...prev, referredByContactId: "" }))
                  setShowContactDropdown(true)
                }}
                onFocus={() => {
                  if (contactQuery.trim().toLowerCase() === "none") {
                    setContactQuery("")
                    setForm(prev => ({ ...prev, referredByContactId: "" }))
                  }
                  setShowContactDropdown(true)
                }}
                onBlur={() => {
                  setTimeout(() => setShowContactDropdown(false), 200)
                  setTimeout(() => {
                    setContactQuery(prev => {
                      const trimmed = prev.trim()
                      if (trimmed.length === 0) {
                        setForm(nextPrev => ({ ...nextPrev, referredByContactId: "" }))
                        return "None"
                      }
                      return prev
                    })
                  }, 210)
                }}
                placeholder="Type to search contacts..."
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 pr-8 text-xs focus:outline-none focus:border-primary-500"
                disabled={contactsLoading}
              />
              <DropdownChevron open={showContactDropdown} />
              {showContactDropdown && contacts.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setForm(prev => ({ ...prev, referredByContactId: "" }))
                      setContactQuery("None")
                      setShowContactDropdown(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                  >
                    <div className="font-medium text-gray-900">None</div>
                  </button>
                  {contacts.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, referredByContactId: option.value }))
                        setContactQuery(option.label)
                        setShowContactDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                    >
                      <div className="font-medium text-gray-900">{option.label}</div>
                      {option.accountName && (
                        <div className="text-xs text-gray-500">{option.accountName}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Subagent</label>
              <input
                type="text"
                value={subagentQuery}
                onChange={event => {
                  setSubagentQuery(event.target.value)
                  setForm(prev => ({ ...prev, subAgent: "", subagentContactId: "" }))
                  setShowSubagentDropdown(true)
                }}
                onFocus={() => {
                  if (subagentQuery.trim().toLowerCase() === "none") {
                    setSubagentQuery("")
                    setForm(prev => ({ ...prev, subAgent: "", subagentContactId: "" }))
                  }
                  setShowSubagentDropdown(true)
                }}
                onBlur={() => {
                  setTimeout(() => setShowSubagentDropdown(false), 200)
                  setTimeout(() => {
                    setSubagentQuery(prev => {
                      const trimmed = prev.trim()
                      if (trimmed.length === 0) {
                        setForm(nextPrev => ({ ...nextPrev, subAgent: "", subagentContactId: "" }))
                        return "None"
                      }
                      return prev
                    })
                  }, 210)
                }}
                placeholder="Type to search subagents..."
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 pr-8 text-xs focus:outline-none focus:border-primary-500"
                disabled={subagentsLoading}
              />
              <DropdownChevron open={showSubagentDropdown} />
              {showSubagentDropdown && subagentQuery.trim().toLowerCase() !== "none" && subagentQuery.length > 0 && subagents.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setForm(prev => ({ ...prev, subagentContactId: "", subAgent: "" }))
                      setSubagentQuery("None")
                      setShowSubagentDropdown(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                  >
                    <div className="font-medium text-gray-900">None</div>
                  </button>
                  {subagents.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, subagentContactId: option.value, subAgent: option.label }))
                        setSubagentQuery(option.label)
                        setShowSubagentDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                    >
                      <div className="font-medium text-gray-900">{option.label}</div>
                      {option.accountName && (
                        <div className="text-xs text-gray-500">{option.accountName}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Primary Account</label>
              <input
                type="text"
                value={form.primaryAccount}
                onChange={event => setForm(prev => ({ ...prev, primaryAccount: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="Algave LLC"
              />
            </div>

            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={form.splitWithAgency}
                onChange={event => setForm(prev => ({ ...prev, splitWithAgency: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Include commission split with partner agency</span>
            </label>

            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Internal Notes</label>
              <textarea
                rows={4}
                value={form.notes}
                onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="Add context, next steps, or deal risks for the team."
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-gray-300 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 transition hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
              disabled={loading || !canSubmit}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Opportunity
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
