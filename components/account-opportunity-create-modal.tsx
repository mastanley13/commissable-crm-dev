"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { LeadSource, OpportunityStage } from "@prisma/client"
import { getOpportunityStageOptions, type OpportunityStageOption } from "@/lib/opportunity-stage"
import { useToasts } from "@/components/toast"
import { formatDecimalToFixed, formatPercentDisplay, normalizeDecimalInput } from "@/lib/number-format"

interface SelectOption {
  value: string
  label: string
}

interface ContactOption extends SelectOption {
  accountName?: string
}

interface OpportunityCreateModalProps {
  isOpen: boolean
  accountId: string
  accountName: string
  onClose: () => void
  onCreated?: (opportunityId: string) => void
}

interface OpportunityFormState {
  name: string
  stage: OpportunityStage
  estimatedCloseDate: string
  ownerId: string
  leadSource: LeadSource
  referredByContactId: string
  subAgent: string
  subagentContactId: string
  houseRepPercent: string
  subagentPercent: string
  description: string
}

const stageOptions: OpportunityStageOption[] = getOpportunityStageOptions()

const formatStageLabel = (option: OpportunityStageOption) =>
  option.autoManaged ? `${option.label} (auto-managed)` : option.label

export function OpportunityCreateModal({ isOpen, accountId, accountName, onClose, onCreated }: OpportunityCreateModalProps) {
  const [form, setForm] = useState<OpportunityFormState>({
    name: "",
    stage: OpportunityStage.Qualification,
    estimatedCloseDate: "",
    ownerId: "",
    leadSource: LeadSource.Referral,
    referredByContactId: "",
    subAgent: "",
    subagentContactId: "",
    houseRepPercent: "",
    subagentPercent: "",
    description: ""
  })
  const [accountLegalName, setAccountLegalName] = useState<string>("")
  const [owners, setOwners] = useState<SelectOption[]>([])
  const [ownerQuery, setOwnerQuery] = useState("")
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [contactQuery, setContactQuery] = useState("")
  const [contactsLoading, setContactsLoading] = useState(false)
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [subagents, setSubagents] = useState<ContactOption[]>([])
  const [subagentQuery, setSubagentQuery] = useState("")
  const [subagentsLoading, setSubagentsLoading] = useState(false)
  const [showSubagentDropdown, setShowSubagentDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const { showError, showSuccess } = useToasts()
  const [houseRepFocused, setHouseRepFocused] = useState(false)
  const [subagentPercentFocused, setSubagentPercentFocused] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm({
      name: "",
      stage: OpportunityStage.Qualification,
      estimatedCloseDate: "",
      ownerId: "",
      leadSource: LeadSource.Referral,
      referredByContactId: "",
      subAgent: "",
      subagentContactId: "",
      houseRepPercent: "",
      subagentPercent: "",
      description: ""
    })
    setContactQuery("")
    setOwnerQuery("")
    setSubagentQuery("")

    // Fetch account legal name
    if (accountId) {
      fetch(`/api/accounts/${accountId}`, { cache: "no-store" })
        .then(async response => {
          if (response.ok) {
            const payload = await response.json()
            setAccountLegalName(payload?.data?.accountLegalName ?? "")
          }
        })
        .catch(() => {
          setAccountLegalName("")
        })
    }

    setOptionsLoading(true)
    fetch("/api/admin/users?limit=100&status=Active", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          throw new Error("Failed to load owners")
        }
        const payload = await response.json()
        const items = Array.isArray(payload?.data?.users) ? payload.data.users : []
        const ownerOptions = items.map((user: any) => ({
          value: user.id,
          label: user.fullName || user.email
        }))
        setOwners(ownerOptions)

        // Set default owner to first user and populate query
        if (ownerOptions.length > 0) {
          setForm(prev => ({ ...prev, ownerId: ownerOptions[0].value }))
          setOwnerQuery(ownerOptions[0].label)
        }
      })
      .catch(() => {
        setOwners([])
        showError("Unable to load owners", "Please try again later")
      })
      .finally(() => setOptionsLoading(false))
  }, [isOpen, accountId, showError])

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

        const trimmedQuery = contactQuery.trim()
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

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const controller = new AbortController()
    const fetchSubagents = async () => {
      setSubagentsLoading(true)
      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "50"
        })

        const trimmedQuery = subagentQuery.trim()
        if (trimmedQuery.length > 0) {
          params.set("q", trimmedQuery)
        }

        // Filter by Account Type = Subagent and status Active
        params.set("accountType", "Subagent")
        params.set("status", "Active")

        const response = await fetch(`/api/accounts?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error("Failed to load subagents")
        }

        const payload = await response.json()
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []

        const options: ContactOption[] = items.map(item => {
          const name = (item.accountName ?? "").trim()
          const legal = (item.accountLegalName ?? "").trim()
          const label = name && legal && name.toLowerCase() !== legal.toLowerCase()
            ? `${name} (${legal})`
            : name || legal || "Unnamed account"

          return {
            value: item.id,
            label,
            accountName: undefined
          }
        })

        setSubagents(options)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        console.error("Unable to load subagents", error)
        setSubagents([])
      } finally {
        setSubagentsLoading(false)
      }
    }

    const debounce = setTimeout(() => {
      void fetchSubagents()
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(debounce)
    }
  }, [isOpen, subagentQuery])

  const filteredOwners = useMemo(() => {
    if (!ownerQuery.trim()) {
      return owners
    }
    const query = ownerQuery.toLowerCase()
    return owners.filter(owner => owner.label.toLowerCase().includes(query))
  }, [owners, ownerQuery])

  // Calculate House Split % (100% - Subagent % - House Rep %)
  const houseSplitPercent = useMemo(() => {
    const subagent = parseFloat(form.subagentPercent) || 0
    const houseRep = parseFloat(form.houseRepPercent) || 0
    const calculated = 100 - subagent - houseRep
    return calculated >= 0 ? calculated.toFixed(2) : "0.00"
  }, [form.subagentPercent, form.houseRepPercent])

  const canSubmit = useMemo(() => {
    return Boolean(
      accountId &&
      form.name.trim().length >= 3 &&
      form.stage &&
      form.ownerId &&
      form.estimatedCloseDate &&
      form.referredByContactId &&
      form.houseRepPercent &&
      form.subagentPercent &&
      form.description.trim()
    )
  }, [accountId, form])

  const handlePercentChange = (
    field: "houseRepPercent" | "subagentPercent",
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeDecimalInput(event.target.value)
    setForm(prev => ({ ...prev, [field]: normalized }))
  }

  const handlePercentBlur = (field: "houseRepPercent" | "subagentPercent") => () => {
    setForm(prev => ({ ...prev, [field]: formatDecimalToFixed(String(prev[field] ?? "")) }))
  }

  const displayHouseRepPercent = useMemo(() => {
    const raw = form.houseRepPercent.trim()
    if (!raw) return ""

    // When focused, show raw value so user can type freely
    if (houseRepFocused) {
      return raw
    }

    // When not focused, show formatted percent
    return formatPercentDisplay(raw, { alwaysSymbol: true })
  }, [form.houseRepPercent, houseRepFocused])

  const displaySubagentPercent = useMemo(() => {
    const raw = form.subagentPercent.trim()
    if (!raw) return ""

    // When focused, show raw value so user can type freely
    if (subagentPercentFocused) {
      return raw
    }

    // When not focused, show formatted percent
    return formatPercentDisplay(raw, { alwaysSymbol: true })
  }, [form.subagentPercent, subagentPercentFocused])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      showError("Missing information", "Please complete all required fields.")
      return
    }

    setLoading(true)
    try {
      const payload = {
        accountId,
        name: form.name.trim(),
        stage: form.stage,
        estimatedCloseDate: form.estimatedCloseDate,
        ownerId: form.ownerId,
        leadSource: form.leadSource,
        referredBy: form.referredByContactId || null,
        subAgent: form.subAgent.trim() || null,
        subagentContactId: form.subagentContactId || null,
        houseRepPercent: form.houseRepPercent ? parseFloat(form.houseRepPercent) / 100 : null,
        subagentPercent: form.subagentPercent ? parseFloat(form.subagentPercent) / 100 : null,
        description: form.description.trim() || null
      }

      const response = await fetch("/api/opportunities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.error ?? "Failed to create opportunity")
      }

      const data = await response.json().catch(() => null)
      const opportunityId: string | undefined = data?.data?.id
      showSuccess("Opportunity created", "The opportunity has been added to this account.")
      onClose()
      if (opportunityId) {
        onCreated?.(opportunityId)
      }
    } catch (error) {
      console.error("Failed to create opportunity", error)
      showError(
        "Unable to create opportunity",
        error instanceof Error ? error.message : "Unknown error"
      )
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-[1024px] h-[900px] rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-600">Create Opportunity</p>
            <h2 className="text-lg font-semibold text-gray-900">New Opportunity for {accountName}</h2>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Field 01.08..000: Account Legal Name - Read-only */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Account Legal Name</label>
              <input
                type="text"
                value={accountLegalName}
                readOnly
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              />
            </div>
            {/* Field 01.08..004: Account Name - Read-only */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Account Name</label>
              <input
                type="text"
                value={accountName}
                readOnly
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              />
            </div>
            {/* Field 01.08..002: Opportunity Name - Required */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Opportunity Name<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="Enter opportunity name"
                required
              />
            </div>
            {/* Field 01.08..001: Estimated Close Date - Required */}
            <div className="relative">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Estimated Close Date<span className="ml-1 text-red-500">*</span></label>
              <div className="relative">
                <input
                  type="date"
                  value={form.estimatedCloseDate}
                  onChange={event => setForm(prev => ({ ...prev, estimatedCloseDate: event.target.value }))}
                  className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 pr-10 text-xs focus:outline-none focus:border-primary-500 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:opacity-0"
                  style={{ colorScheme: 'light' }}
                  required
                />
                <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-xs text-gray-900">
                  {form.estimatedCloseDate || <span className="text-gray-400">YYYY-MM-DD</span>}
                </span>
              </div>
            </div>
            {/* Field 01.08..003: Stage - Required */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Stage<span className="ml-1 text-red-500">*</span></label>
              <select
                value={form.stage}
                onChange={event => setForm(prev => ({ ...prev, stage: event.target.value as OpportunityStage }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              >
                {stageOptions.map(option => (
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
            {/* Field 01.08..005: Owner - Required */}
            <div className="relative">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Owner<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={ownerQuery}
                onChange={event => {
                  setOwnerQuery(event.target.value)
                  setShowOwnerDropdown(true)
                }}
                onFocus={() => setShowOwnerDropdown(true)}
                onBlur={() => {
                  // Delay hiding to allow click on dropdown items
                  setTimeout(() => setShowOwnerDropdown(false), 200)
                }}
                placeholder="Type to search owners..."
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                disabled={optionsLoading}
                required
              />
              {showOwnerDropdown && filteredOwners.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {filteredOwners.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, ownerId: option.value }))
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
            {/* Field 01.08..007: Referred By - Required */}
            <div className="relative">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Referred By<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={contactQuery}
                onChange={event => {
                  setContactQuery(event.target.value)
                  setShowContactDropdown(true)
                }}
                onFocus={() => setShowContactDropdown(true)}
                onBlur={() => {
                  // Delay hiding to allow click on dropdown items
                  setTimeout(() => setShowContactDropdown(false), 200)
                }}
                placeholder="Type to search contacts..."
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                disabled={contactsLoading}
                required
              />
              {showContactDropdown && contacts.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
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
            {/* Field 01.08..006: Subagent - Optional */}
            <div className="relative">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Subagent</label>
              <input
                type="text"
                value={subagentQuery}
                onChange={event => {
                  setSubagentQuery(event.target.value)
                  setShowSubagentDropdown(true)
                }}
                onFocus={() => setShowSubagentDropdown(true)}
                onBlur={() => {
                  setTimeout(() => setShowSubagentDropdown(false), 200)
                }}
                placeholder="Type to search subagents..."
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                disabled={subagentsLoading}
              />
              {showSubagentDropdown && subagentQuery.length > 0 && subagents.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {subagents.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, subAgent: option.label, subagentContactId: null as any }))
                        setSubagentQuery(option.label)
                        setShowSubagentDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                    >
                      <div className="font-medium text-gray-900">{option.label}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Field 01.08..009: House Rep % - Required */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">House Rep %<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                inputMode="decimal"
                value={displayHouseRepPercent}
                onChange={handlePercentChange("houseRepPercent")}
                onFocus={() => setHouseRepFocused(true)}
                onBlur={() => {
                  setHouseRepFocused(false)
                  handlePercentBlur("houseRepPercent")()
                }}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="0.00%"
                required
              />
            </div>
            {/* Field 01.08..010: Subagent % - Required */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Subagent %<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                inputMode="decimal"
                value={displaySubagentPercent}
                onChange={handlePercentChange("subagentPercent")}
                onFocus={() => setSubagentPercentFocused(true)}
                onBlur={() => {
                  setSubagentPercentFocused(false)
                  handlePercentBlur("subagentPercent")()
                }}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="0.00%"
                required
              />
            </div>
            {/* Field 01.08..008: House Split % - Calculated (Read-only) */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">House Split %</label>
              <input
                type="text"
                value={`${houseSplitPercent}%`}
                readOnly
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              />
            </div>
            {/* Field 01.08..011: Opportunity Description - Required */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Opportunity Description<span className="ml-1 text-red-500">*</span></label>
              <textarea
                value={form.description}
                onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500 min-h-[80px] resize-vertical"
                placeholder="Enter opportunity description"
                required
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-gray-200 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 transition hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
