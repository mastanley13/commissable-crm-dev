"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { LeadSource, OpportunityStage } from "@prisma/client"
import { ChevronDown, Loader2 } from "lucide-react"
import { getOpportunityStageOptions, type OpportunityStageOption } from "@/lib/opportunity-stage"
import { useToasts } from "@/components/toast"
import { formatDecimalToFixed, formatPercentDisplay, normalizeDecimalInput } from "@/lib/number-format"

interface SelectOption {
  value: string
  label: string
}

interface ReferredByOption extends SelectOption {
  type: "account" | "contact"
}

interface ContactOption extends SelectOption {
  accountName?: string
}

interface AccountOption extends SelectOption {
  accountName: string
  accountLegalName: string
  shippingAddress?: string
  billingAddress?: string
}

interface OpportunityCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (opportunityId: string) => void
  defaultAccountId?: string
}

interface OpportunityFormState {
  accountId: string
  accountName: string
  accountLegalName: string
  name: string
  stage: OpportunityStage
  estimatedCloseDate: string
  ownerId: string
  leadSource: LeadSource
  referredBy: string
  shippingAddress: string
  billingAddress: string
  subAgent: string
  orderIdHouse: string
  accountIdHouse: string
  accountIdVendor: string
  accountIdDistributor: string
  customerIdHouse: string
  customerIdVendor: string
  customerIdDistributor: string
  locationId: string
  orderIdVendor: string
  orderIdDistributor: string
  customerPurchaseOrder: string
  description: string
  subagentPercent: string
  houseRepPercent: string
}

interface OpportunityCreateResponse {
  data?: {
    id: string
  }
  error?: string
}

const stageOptions: OpportunityStageOption[] = getOpportunityStageOptions()

const formatStageLabel = (option: OpportunityStageOption) =>
  option.autoManaged ? `${option.label} (auto-managed)` : option.label

const leadSourceOptions: SelectOption[] = Object.values(LeadSource).map(source => ({
  value: source,
  label: source.replace(/([A-Z])/g, " $1").trim()
}))

const buildInitialForm = (defaultAccountId?: string): OpportunityFormState => ({
  accountId: defaultAccountId ?? "",
  accountName: "",
  accountLegalName: "",
  name: "",
  stage: OpportunityStage.Qualification,
  estimatedCloseDate: "",
  ownerId: "",
  leadSource: LeadSource.Referral,
  referredBy: "",
  shippingAddress: "",
  billingAddress: "",
  subAgent: "",
  orderIdHouse: "",
  accountIdHouse: "",
  accountIdVendor: "",
  accountIdDistributor: "",
  customerIdHouse: "",
  customerIdVendor: "",
  customerIdDistributor: "",
  locationId: "",
  orderIdVendor: "",
  orderIdDistributor: "",
  customerPurchaseOrder: "",
  description: "",
  subagentPercent: "0.00",
  houseRepPercent: "0.00"
})

const formatAccountLabel = (account: any): string => {
  const legalName = typeof account?.accountLegalName === "string" ? account.accountLegalName.trim() : ""
  const friendlyName = typeof account?.accountName === "string" ? account.accountName.trim() : ""

  if (legalName && friendlyName && legalName.toLowerCase() !== friendlyName.toLowerCase()) {
    return `${legalName} — ${friendlyName}`
  }

  return legalName || friendlyName || "Unnamed account"
}

export function OpportunityCreateModal({
  isOpen,
  onClose,
  onCreated,
  defaultAccountId
}: OpportunityCreateModalProps) {
  const [form, setForm] = useState<OpportunityFormState>(() => buildInitialForm(defaultAccountId))
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [accountQuery, setAccountQuery] = useState("")
  const [accountLoading, setAccountLoading] = useState(false)
  const [owners, setOwners] = useState<SelectOption[]>([])
  const [ownersLoading, setOwnersLoading] = useState(false)
  const [subagents, setSubagents] = useState<ContactOption[]>([])
  const [subagentQuery, setSubagentQuery] = useState("")
  const [subagentsLoading, setSubagentsLoading] = useState(false)
  const [showSubagentDropdown, setShowSubagentDropdown] = useState(false)
  const [referredByOptions, setReferredByOptions] = useState<ReferredByOption[]>([])
  const [referredByQuery, setReferredByQuery] = useState("")
  const [showReferredByDropdown, setShowReferredByDropdown] = useState(false)
  const [referredByLoading, setReferredByLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [subagentPercentFocused, setSubagentPercentFocused] = useState(false)
  const [houseRepPercentFocused, setHouseRepPercentFocused] = useState(false)

  const { showError, showSuccess } = useToasts()
  const inputClass =
    "w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
  const textareaClass = `${inputClass} min-h-[80px] resize-vertical`

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm(buildInitialForm(defaultAccountId))
    setAccountQuery("")
  }, [isOpen, defaultAccountId])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const controller = new AbortController()
    const fetchAccounts = async () => {
      setAccountLoading(true)
      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "50"
        })

        const trimmedQuery = accountQuery.trim()
        if (trimmedQuery.length > 0) {
          params.set("q", trimmedQuery)
        }

        const response = await fetch(`/api/accounts?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? "Failed to load accounts")
        }

        const payload = await response.json().catch(() => null)
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []

        const buildAddress = (item: any, prefix: "shipping" | "billing") => {
          const street = typeof item?.[`${prefix}Street`] === "string" ? item[`${prefix}Street`].trim() : ""
          const street2 = typeof item?.[`${prefix}Street2`] === "string" ? item[`${prefix}Street2`].trim() : ""
          const city = typeof item?.[`${prefix}City`] === "string" ? item[`${prefix}City`].trim() : ""
          const state = typeof item?.[`${prefix}State`] === "string" ? item[`${prefix}State`].trim() : ""
          const zip = typeof item?.[`${prefix}Zip`] === "string" ? item[`${prefix}Zip`].trim() : ""
          const country = typeof item?.[`${prefix}Country`] === "string" ? item[`${prefix}Country`].trim() : ""

          const parts: string[] = []
          if (street) parts.push(street)
          if (street2) parts.push(street2)

          const cityState = [city, state].filter(Boolean).join(", ")
          if (cityState && zip) {
            parts.push(`${cityState} ${zip}`)
          } else if (cityState) {
            parts.push(cityState)
          } else if (zip) {
            parts.push(zip)
          }

          if (country) parts.push(country)
          return parts.join(", ")
        }

        const options: AccountOption[] = items.map(item => ({
          value: item.id,
          label: formatAccountLabel(item),
          accountName: typeof item?.accountName === "string" ? item.accountName : "",
          accountLegalName: typeof item?.accountLegalName === "string" ? item.accountLegalName : "",
          shippingAddress: buildAddress(item, "shipping"),
          billingAddress: buildAddress(item, "billing")
        }))

        setAccounts(options)
        setForm(previous => {
          const existing = options.find(option => option.value === previous.accountId)
          if (existing) {
            return {
              ...previous,
              accountName: existing.accountName,
              accountLegalName: existing.accountLegalName,
              shippingAddress: previous.shippingAddress || existing.shippingAddress || "",
              billingAddress: previous.billingAddress || existing.billingAddress || ""
            }
          }

          if (previous.accountId) {
            return previous
          }

          const preferredId = defaultAccountId ?? options[0]?.value ?? ""
          const fallback = options.find(option => option.value === preferredId) ?? options[0]
          if (!fallback) {
            return {
              ...previous,
              accountId: "",
              accountName: "",
              accountLegalName: "",
              shippingAddress: "",
              billingAddress: ""
            }
          }

          return {
            ...previous,
            accountId: fallback.value,
            accountName: fallback.accountName,
            accountLegalName: fallback.accountLegalName,
            shippingAddress: fallback.shippingAddress ?? "",
            billingAddress: fallback.billingAddress ?? ""
          }
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        console.error("Unable to load accounts", error)
        setAccounts([])
        showError("Unable to load accounts", "Please try searching again or try later.")
      } finally {
        setAccountLoading(false)
      }
    }

    const debounce = setTimeout(() => {
      void fetchAccounts()
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(debounce)
    }
  }, [isOpen, accountQuery, defaultAccountId, showError])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let cancelled = false
    setOwnersLoading(true)

    fetch("/api/admin/users?limit=100&status=Active", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? "Failed to load owners")
        }
        const payload = await response.json().catch(() => null)
        const items: any[] = Array.isArray(payload?.data?.users) ? payload.data.users : []
        if (cancelled) {
          return
        }
        const options = items.map(user => ({
          value: user.id,
          label: user.fullName || user.email || "Unnamed user"
        }))
        setOwners(options)
        setForm(previous => {
          if (previous.ownerId) {
            return previous
          }
          const defaultOption = options[0]
          return defaultOption ? { ...previous, ownerId: defaultOption.value } : previous
        })
      })
      .catch(error => {
        if (cancelled) {
          return
        }
        console.error("Unable to load owners", error)
        setOwners([])
        showError("Unable to load owners", "Please try again later.")
      })
      .finally(() => {
        if (!cancelled) {
          setOwnersLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, showError])

  const canSubmit = useMemo(() => {
    return Boolean(
      form.accountId &&
      form.name.trim().length >= 3 &&
      form.stage &&
      form.leadSource &&
      form.ownerId &&
      form.estimatedCloseDate
    )
  }, [form.accountId, form.estimatedCloseDate, form.leadSource, form.name, form.ownerId, form.stage])

  const houseSplitPercentDisplay = useMemo(() => {
    const subagentValue = Number.parseFloat(form.subagentPercent)
    const houseRepValue = Number.parseFloat(form.houseRepPercent)
    const safeSubagent = Number.isFinite(subagentValue) ? subagentValue : 0
    const safeHouseRep = Number.isFinite(houseRepValue) ? houseRepValue : 0
    const computed = Math.max(0, 100 - (safeSubagent + safeHouseRep))
    return computed.toFixed(2)
  }, [form.houseRepPercent, form.subagentPercent])

  const handlePercentChange = (field: "subagentPercent" | "houseRepPercent") => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const normalized = normalizeDecimalInput(event.target.value)
    setForm(prev => ({ ...prev, [field]: normalized }))
  }

  const handlePercentBlur = (field: "subagentPercent" | "houseRepPercent") => () => {
    setForm(prev => ({ ...prev, [field]: formatDecimalToFixed(String(prev[field] ?? "")) }))
  }

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

  const displayHouseRepPercent = useMemo(() => {
    const raw = form.houseRepPercent.trim()
    if (!raw) return ""

    // When focused, show raw value so user can type freely
    if (houseRepPercentFocused) {
      return raw
    }

    // When not focused, show formatted percent
    return formatPercentDisplay(raw, { alwaysSymbol: true })
  }, [form.houseRepPercent, houseRepPercentFocused])

  const handleClose = useCallback(() => {
    setForm(buildInitialForm(defaultAccountId))
    setAccountQuery("")
    onClose()
  }, [defaultAccountId, onClose])

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      showError("Missing information", "Please complete all required fields before creating the opportunity.")
      return
    }

    setSubmitting(true)
    try {
      const normalizeString = (value: string) => {
        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : null
      }

      const percentToDecimal = (value: string) => {
        const trimmed = value.trim()
        if (trimmed.length === 0) {
          return null
        }
        const numeric = Number.parseFloat(trimmed)
        if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
          return null
        }
        return numeric / 100
      }

      const subagentPercentDecimal = percentToDecimal(form.subagentPercent)
      const houseRepPercentDecimal = percentToDecimal(form.houseRepPercent)
      const houseSplitPercentDecimal = percentToDecimal(houseSplitPercentDisplay)

      if (subagentPercentDecimal === null && form.subagentPercent.trim().length > 0) {
        showError("Invalid subagent percent", "Subagent % must be between 0 and 100.")
        setSubmitting(false)
        return
      }

      if (houseRepPercentDecimal === null && form.houseRepPercent.trim().length > 0) {
        showError("Invalid house rep percent", "House Rep % must be between 0 and 100.")
        setSubmitting(false)
        return
      }

      if (houseSplitPercentDecimal === null && houseSplitPercentDisplay.trim().length > 0) {
        showError("Invalid house split percent", "House Split % must be between 0 and 100.")
        setSubmitting(false)
        return
      }

      const payload = {
        accountId: form.accountId,
        name: form.name.trim(),
        stage: form.stage,
        estimatedCloseDate: form.estimatedCloseDate,
        ownerId: form.ownerId,
        leadSource: form.leadSource,
        referredBy: normalizeString(form.referredBy),
        subAgent: form.subAgent.trim() || null,
        description: normalizeString(form.description),
        shippingAddress: normalizeString(form.shippingAddress),
        billingAddress: normalizeString(form.billingAddress),
        orderIdHouse: normalizeString(form.orderIdHouse),
        accountIdHouse: normalizeString(form.accountIdHouse),
        accountIdVendor: normalizeString(form.accountIdVendor),
        accountIdDistributor: normalizeString(form.accountIdDistributor),
        customerIdHouse: normalizeString(form.customerIdHouse),
        customerIdVendor: normalizeString(form.customerIdVendor),
        customerIdDistributor: normalizeString(form.customerIdDistributor),
        locationId: normalizeString(form.locationId),
        orderIdVendor: normalizeString(form.orderIdVendor),
        orderIdDistributor: normalizeString(form.orderIdDistributor),
        customerPurchaseOrder: normalizeString(form.customerPurchaseOrder),
        subagentPercent: subagentPercentDecimal,
        houseRepPercent: houseRepPercentDecimal,
        houseSplitPercent: houseSplitPercentDecimal
      }

      const response = await fetch("/api/opportunities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as OpportunityCreateResponse | null
        throw new Error(payload?.error ?? "Failed to create opportunity")
      }

      const result = (await response.json().catch(() => null)) as OpportunityCreateResponse | null
      const createdId = result?.data?.id ?? ""

      showSuccess("Opportunity created", "The opportunity has been added successfully.")
      if (createdId && onCreated) {
        onCreated(createdId)
      }
      handleClose()
    } catch (error) {
      console.error("Failed to create opportunity", error)
      const message = error instanceof Error ? error.message : "Failed to create opportunity"
      showError("Unable to create opportunity", message)
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, form, handleClose, houseSplitPercentDisplay, onCreated, showError, showSuccess])

  const selectedAccount = useMemo(
    () => accounts.find(option => option.value === form.accountId) ?? null,
    [accounts, form.accountId]
  )

  // Load subagents lazily based on typeahead query
  useEffect(() => {
    if (!isOpen) return
    const controller = new AbortController()
    const run = async () => {
      setSubagentsLoading(true)
      try {
        const params = new URLSearchParams({ page: "1", pageSize: "50", contactType: "Subagent" })
        const q = subagentQuery.trim()
        if (q.length > 0) params.set("q", q)
        const res = await fetch(`/api/contacts?${params.toString()}`, { cache: "no-store", signal: controller.signal })
        if (!res.ok) throw new Error("Failed to load subagents")
        const payload = await res.json().catch(() => null)
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []
        const options: ContactOption[] = items.map(item => ({
          value: item.id,
          label: (item.fullName?.trim() || "Unnamed contact"),
          accountName: item.accountName || undefined
        }))
        setSubagents(options)
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setSubagents([])
        }
      } finally {
        setSubagentsLoading(false)
      }
    }
    const debounce = setTimeout(() => { void run() }, 250)
    return () => { controller.abort(); clearTimeout(debounce) }
  }, [isOpen, subagentQuery])

  // Fetch referred by options when dropdown opens or user types
  useEffect(() => {
    if (!isOpen || !showReferredByDropdown) {
      return
    }

    // Only require 2+ characters if user is actively typing
    // Allow empty query when just opening dropdown (shows all results)
    const query = referredByQuery.trim()
    if (query.length === 1) {
      // User has typed 1 character - don't fetch yet
      setReferredByOptions([])
      return
    }

    const controller = new AbortController()
    const fetchReferredByOptions = async () => {
      setReferredByLoading(true)
      try {
        const params = new URLSearchParams({ q: query })
        const response = await fetch(`/api/opportunities/referred-by?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error("Failed to load referral options")
        }

        const payload = await response.json()
        const results = Array.isArray(payload?.data) ? payload.data : []
        setReferredByOptions(results)
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Error fetching referred by options:", error)
          setReferredByOptions([])
        }
      } finally {
        setReferredByLoading(false)
      }
    }

    const debounce = setTimeout(fetchReferredByOptions, 300)
    return () => {
      clearTimeout(debounce)
      controller.abort()
    }
  }, [isOpen, referredByQuery, showReferredByDropdown])

  // Reset subagent and referred by UI when opening/closing
  useEffect(() => {
    if (!isOpen) return
    setSubagentQuery("")
    setSubagents([])
    setShowSubagentDropdown(false)
    setReferredByQuery("")
    setReferredByOptions([])
    setShowReferredByDropdown(false)
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-5xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-600">Create Opportunity</p>
            <h2 className="text-lg font-semibold text-gray-900">Add new opportunity</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[90vh] overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Opportunity Name<span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={event => setForm(previous => ({ ...previous, name: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter opportunity name"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Lead Source<span className="ml-1 text-red-500">*</span>
                </label>
                <select
                  value={form.leadSource}
                  onChange={event => setForm(previous => ({ ...previous, leadSource: event.target.value as LeadSource }))}
                  className={inputClass}
                  required
                >
                  {leadSourceOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Referred By
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={referredByQuery}
                    onChange={e => {
                      setReferredByQuery(e.target.value)
                      setForm(previous => ({ ...previous, referredBy: e.target.value }))
                      setShowReferredByDropdown(true)
                    }}
                    onFocus={() => setShowReferredByDropdown(true)}
                    onBlur={() => setTimeout(() => setShowReferredByDropdown(false), 200)}
                    placeholder="Type to search contacts..."
                    className={`${inputClass} pr-8`}
                  />
                  <ChevronDown 
                    className={`absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none transition-transform ${showReferredByDropdown ? 'rotate-180' : ''}`}
                  />
                </div>

                {showReferredByDropdown && referredByQuery.length !== 1 && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {referredByLoading && (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Searching...
                      </div>
                    )}
                    {!referredByLoading && referredByOptions.length === 0 && referredByQuery.length > 1 && (
                      <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
                    )}
                    {!referredByLoading && referredByOptions.length === 0 && referredByQuery.length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">Type to search contacts or accounts...</div>
                    )}
                    {!referredByLoading && referredByOptions.length > 0 && (
                      <>
                        {/* Group by type - Contacts first, then Accounts */}
                        {referredByOptions.filter(o => o.type === "contact").length > 0 && (
                          <>
                            <div className="sticky top-0 bg-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-100">
                              Contacts
                            </div>
                            {referredByOptions.filter(o => o.type === "contact").map(option => (
                              <button
                                key={`contact-${option.value}`}
                                type="button"
                                onClick={() => {
                                  setForm(previous => ({ ...previous, referredBy: option.value }))
                                  setReferredByQuery(option.value)
                                  setShowReferredByDropdown(false)
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                              >
                                <div className="font-medium text-gray-900">{option.label}</div>
                              </button>
                            ))}
                          </>
                        )}
                        {referredByOptions.filter(o => o.type === "account").length > 0 && (
                          <>
                            <div className="sticky top-0 bg-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-100">
                              Accounts
                            </div>
                            {referredByOptions.filter(o => o.type === "account").map(option => (
                              <button
                                key={`account-${option.value}`}
                                type="button"
                                onClick={() => {
                                  setForm(previous => ({ ...previous, referredBy: option.value }))
                                  setReferredByQuery(option.value)
                                  setShowReferredByDropdown(false)
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50 focus:outline-none"
                              >
                                <div className="font-medium text-gray-900">{option.label}</div>
                              </button>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Other - Order ID</label>
                <input
                  type="text"
                  value={form.orderIdVendor}
                  onChange={event => setForm(previous => ({ ...previous, orderIdVendor: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Order ID (Other)"
                />
              </div>

              <div className="xl:col-span-2">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Account Name<span className="ml-1 text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_3fr] sm:items-end">
                  <input
                    type="text"
                    value={accountQuery}
                    onChange={event => setAccountQuery(event.target.value)}
                    placeholder="Search accounts..."
                    className={inputClass}
                    disabled={accountLoading}
                  />
                  <select
                    value={form.accountId}
                    onChange={event => {
                      const selectedId = event.target.value
                      setForm(previous => {
                        const match = accounts.find(option => option.value === selectedId)
                        if (!match) {
                          return { ...previous, accountId: selectedId }
                        }
                        return {
                          ...previous,
                          accountId: selectedId,
                          accountName: match.accountName,
                          accountLegalName: match.accountLegalName,
                          shippingAddress: match.shippingAddress ?? '',
                          billingAddress: match.billingAddress ?? ''
                        }
                      })
                    }}
                    className={inputClass}
                    disabled={accountLoading}
                  >
                    <option value="">{accountLoading ? "Loading accounts..." : "Select account"}</option>
                    {accounts.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedAccount && (
                  <p className="mt-1 text-xs text-gray-500">Selected: {selectedAccount.label}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">House - Order ID</label>
                <input
                  type="text"
                  value={form.orderIdHouse}
                  onChange={event => setForm(previous => ({ ...previous, orderIdHouse: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Order ID (House)"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Customer PO Number</label>
                <input
                  type="text"
                  value={form.customerPurchaseOrder}
                  onChange={event => setForm(previous => ({ ...previous, customerPurchaseOrder: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Customer PO Number"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Account Legal Name</label>
                <input
                  type="text"
                  value={form.accountLegalName}
                  readOnly
                  className={`${inputClass} bg-gray-100 text-gray-700`}
                  placeholder="Auto-filled from account"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Opportunity Stage<span className="ml-1 text-red-500">*</span>
                </label>
                <select
                  value={form.stage}
                  onChange={event => setForm(previous => ({ ...previous, stage: event.target.value as OpportunityStage }))}
                  className={inputClass}
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

              <div className="relative">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Estimated Close Date<span className="ml-1 text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={form.estimatedCloseDate}
                    onChange={event => setForm(previous => ({ ...previous, estimatedCloseDate: event.target.value }))}
                    className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 pr-10 text-xs focus:outline-none focus:border-primary-500 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:opacity-0 [&::-webkit-datetime-edit]:focus:opacity-100"
                    style={{ colorScheme: 'light' }}
                    onFocus={(e) => {
                      e.currentTarget.classList.add('date-input-focused')
                    }}
                    onBlur={(e) => {
                      e.currentTarget.classList.remove('date-input-focused')
                    }}
                    required
                  />
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-900">
                    {form.estimatedCloseDate || <span className="text-gray-400">YYYY-MM-DD</span>}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Owner<span className="ml-1 text-red-500">*</span>
                </label>
                <select
                  value={form.ownerId}
                  onChange={event => setForm(previous => ({ ...previous, ownerId: event.target.value }))}
                  className={inputClass}
                  disabled={ownersLoading}
                  required
                >
                  <option value="">{ownersLoading ? "Loading owners..." : "Select owner"}</option>
                  {owners.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Subagent</label>
                <div className="relative">
                  <input
                    type="text"
                    value={subagentQuery}
                    onChange={event => {
                      setSubagentQuery(event.target.value)
                      setShowSubagentDropdown(true)
                    }}
                    onFocus={() => setShowSubagentDropdown(true)}
                    onBlur={() => setTimeout(() => setShowSubagentDropdown(false), 200)}
                    className={inputClass}
                    placeholder="Type to search subagents..."
                    disabled={subagentsLoading}
                  />
                  {showSubagentDropdown && subagentQuery.length > 0 && subagents.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {subagents.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setForm(prev => ({ ...prev, subAgent: option.label }))
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
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Subagent %</label>
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
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">House Rep %</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={displayHouseRepPercent}
                  onChange={handlePercentChange("houseRepPercent")}
                  onFocus={() => setHouseRepPercentFocused(true)}
                  onBlur={() => {
                    setHouseRepPercentFocused(false)
                    handlePercentBlur("houseRepPercent")()
                  }}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">House Split %</label>
                <input
                  type="number"
                  value={houseSplitPercentDisplay}
                  readOnly
                  disabled
                  title="Auto-calculated from House Rep % and Subagent %."
                  className={`${inputClass} cursor-not-allowed bg-gray-100 text-gray-700`}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">House - Account ID</label>
                <input
                  type="text"
                  value={form.accountIdHouse}
                  onChange={event => setForm(previous => ({ ...previous, accountIdHouse: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Account ID (House)"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Other - Account ID</label>
                <input
                  type="text"
                  value={form.accountIdVendor}
                  onChange={event => setForm(previous => ({ ...previous, accountIdVendor: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Account ID (Other)"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">House - Customer ID</label>
                <input
                  type="text"
                  value={form.customerIdHouse}
                  onChange={event => setForm(previous => ({ ...previous, customerIdHouse: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Customer ID (House)"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Other - Customer ID</label>
                <input
                  type="text"
                  value={form.customerIdVendor}
                  onChange={event => setForm(previous => ({ ...previous, customerIdVendor: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Customer ID (Other)"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Location ID - Vendor</label>
                <input
                  type="text"
                  value={form.locationId}
                  onChange={event => setForm(previous => ({ ...previous, locationId: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Location ID (Vendor)"
                />
              </div>

              <div className="md:col-span-2 xl:col-span-2">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Shipping Address</label>
                <textarea
                  value={form.shippingAddress}
                  onChange={event => setForm(previous => ({ ...previous, shippingAddress: event.target.value }))}
                  className={`${textareaClass} min-h-[80px]`}
                  placeholder="Enter shipping address"
                />
              </div>

              <div className="md:col-span-2 xl:col-span-2">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Billing Address</label>
                <textarea
                  value={form.billingAddress}
                  onChange={event => setForm(previous => ({ ...previous, billingAddress: event.target.value }))}
                  className={`${textareaClass} min-h-[80px]`}
                  placeholder="Enter billing address"
                />
              </div>

              <div className="md:col-span-2 xl:col-span-2">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Opportunity Description</label>
                <textarea
                  value={form.description}
                  onChange={event => setForm(previous => ({ ...previous, description: event.target.value }))}
                  className={`${textareaClass} min-h-[120px]`}
                  placeholder="Enter opportunity description"
                />
              </div>
            </div>
          </div>          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full bg-gray-200 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-300"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}



