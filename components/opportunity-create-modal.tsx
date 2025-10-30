"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { LeadSource, OpportunityStage } from "@prisma/client"
import { Loader2, X } from "lucide-react"
import { getOpportunityStageOptions, type OpportunityStageOption } from "@/lib/opportunity-stage"
import { useToasts } from "@/components/toast"

interface SelectOption {
  value: string
  label: string
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
  const [submitting, setSubmitting] = useState(false)

  const { showError, showSuccess } = useToasts()
  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close create opportunity modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[90vh] overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
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
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Referred By<span className="ml-1 text-red-500">*</span>
                </label>
                <select
                  value={form.leadSource}
                  onChange={event => setForm(previous => ({ ...previous, leadSource: event.target.value as LeadSource }))}
                  className={inputClass}
                >
                  {leadSourceOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Order ID - Vendor</label>
                <input
                  type="text"
                  value={form.orderIdVendor}
                  onChange={event => setForm(previous => ({ ...previous, orderIdVendor: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Order ID (Vendor)"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Order ID - Distributor</label>
                <input
                  type="text"
                  value={form.orderIdDistributor}
                  onChange={event => setForm(previous => ({ ...previous, orderIdDistributor: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Order ID (Distributor)"
                />
              </div>

              <div className="xl:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
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
                <label className="mb-1 block text-sm font-medium text-gray-700">Order ID - House</label>
                <input
                  type="text"
                  value={form.orderIdHouse}
                  onChange={event => setForm(previous => ({ ...previous, orderIdHouse: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Order ID (House)"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Customer PO Number</label>
                <input
                  type="text"
                  value={form.customerPurchaseOrder}
                  onChange={event => setForm(previous => ({ ...previous, customerPurchaseOrder: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Customer PO Number"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Account Legal Name</label>
                <input
                  type="text"
                  value={form.accountLegalName}
                  readOnly
                  className={`${inputClass} bg-gray-100 text-gray-700`}
                  placeholder="Auto-filled from account"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
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
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Estimated Close Date<span className="ml-1 text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={form.estimatedCloseDate}
                    onChange={event => setForm(previous => ({ ...previous, estimatedCloseDate: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:opacity-0 [&::-webkit-datetime-edit]:focus:opacity-100"
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
                <label className="mb-1 block text-sm font-medium text-gray-700">
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
                <label className="mb-1 block text-sm font-medium text-gray-700">Subagent</label>
                <input
                  type="text"
                  value={form.subAgent}
                  onChange={event => setForm(previous => ({ ...previous, subAgent: event.target.value }))}
                  className={inputClass}
                  placeholder="Optional subagent"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Subagent %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.subagentPercent}
                  onChange={event => setForm(previous => ({ ...previous, subagentPercent: event.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">House Rep %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.houseRepPercent}
                  onChange={event => setForm(previous => ({ ...previous, houseRepPercent: event.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">House Split %</label>
                <input
                  type="number"
                  value={houseSplitPercentDisplay}
                  readOnly
                  className={`${inputClass} bg-gray-100 text-gray-700`}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Account ID - House</label>
                <input
                  type="text"
                  value={form.accountIdHouse}
                  onChange={event => setForm(previous => ({ ...previous, accountIdHouse: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Account ID (House)"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Account ID - Vendor</label>
                <input
                  type="text"
                  value={form.accountIdVendor}
                  onChange={event => setForm(previous => ({ ...previous, accountIdVendor: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Account ID (Vendor)"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Account ID - Distributor</label>
                <input
                  type="text"
                  value={form.accountIdDistributor}
                  onChange={event => setForm(previous => ({ ...previous, accountIdDistributor: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Account ID (Distributor)"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Customer ID - House</label>
                <input
                  type="text"
                  value={form.customerIdHouse}
                  onChange={event => setForm(previous => ({ ...previous, customerIdHouse: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Customer ID (House)"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Customer ID - Vendor</label>
                <input
                  type="text"
                  value={form.customerIdVendor}
                  onChange={event => setForm(previous => ({ ...previous, customerIdVendor: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Customer ID (Vendor)"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Customer ID - Distributor</label>
                <input
                  type="text"
                  value={form.customerIdDistributor}
                  onChange={event => setForm(previous => ({ ...previous, customerIdDistributor: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Customer ID (Distributor)"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Location ID - Vendor</label>
                <input
                  type="text"
                  value={form.locationId}
                  onChange={event => setForm(previous => ({ ...previous, locationId: event.target.value }))}
                  className={inputClass}
                  placeholder="Enter Location ID (Vendor)"
                />
              </div>

              <div className="md:col-span-2 xl:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Shipping Address</label>
                <textarea
                  value={form.shippingAddress}
                  onChange={event => setForm(previous => ({ ...previous, shippingAddress: event.target.value }))}
                  className={`${textareaClass} min-h-[80px]`}
                  placeholder="Enter shipping address"
                />
              </div>

              <div className="md:col-span-2 xl:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Billing Address</label>
                <textarea
                  value={form.billingAddress}
                  onChange={event => setForm(previous => ({ ...previous, billingAddress: event.target.value }))}
                  className={`${textareaClass} min-h-[80px]`}
                  placeholder="Enter billing address"
                />
              </div>

              <div className="md:col-span-2 xl:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Opportunity Description</label>
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
              className="rounded-full bg-gray-200 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
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






