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

interface OpportunityCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (opportunityId: string) => void
  defaultAccountId?: string
}

interface OpportunityFormState {
  accountId: string
  name: string
  stage: OpportunityStage
  estimatedCloseDate: string
  ownerId: string
  leadSource: LeadSource
  subAgent: string
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
  name: "",
  stage: OpportunityStage.Qualification,
  estimatedCloseDate: "",
  ownerId: "",
  leadSource: LeadSource.Referral,
  subAgent: ""
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
  const [accounts, setAccounts] = useState<SelectOption[]>([])
  const [accountQuery, setAccountQuery] = useState("")
  const [accountLoading, setAccountLoading] = useState(false)
  const [owners, setOwners] = useState<SelectOption[]>([])
  const [ownersLoading, setOwnersLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { showError, showSuccess } = useToasts()

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
        const options = items.map(item => ({
          value: item.id,
          label: formatAccountLabel(item)
        }))

        setAccounts(options)
        setForm(previous => {
          if (previous.accountId) {
            return previous
          }
          if (defaultAccountId) {
            return previous
          }
          const firstAccount = options[0]
          return firstAccount ? { ...previous, accountId: firstAccount.value } : previous
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
      const payload = {
        accountId: form.accountId,
        name: form.name.trim(),
        stage: form.stage,
        estimatedCloseDate: form.estimatedCloseDate,
        ownerId: form.ownerId,
        leadSource: form.leadSource,
        subAgent: form.subAgent.trim() || null
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
  }, [canSubmit, form.accountId, form.estimatedCloseDate, form.leadSource, form.name, form.ownerId, form.stage, form.subAgent, handleClose, onCreated, showError, showSuccess])

  const selectedAccountLabel = useMemo(() => {
    const selected = accounts.find(option => option.value === form.accountId)
    return selected?.label ?? ""
  }, [accounts, form.accountId])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
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

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Account<span className="ml-1 text-red-500">*</span>
              </label>
              <div className="grid gap-2 md:grid-cols-[2fr_3fr] md:items-end">
                <div className="md:col-span-1">
                  <input
                    type="text"
                    value={accountQuery}
                    onChange={event => setAccountQuery(event.target.value)}
                    placeholder="Search accounts..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={accountLoading}
                  />
                </div>
                <div className="md:col-span-1">
                  <select
                    value={form.accountId}
                    onChange={event => setForm(previous => ({ ...previous, accountId: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              </div>
              {selectedAccountLabel && (
                <p className="mt-1 text-xs text-gray-500">Selected: {selectedAccountLabel}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Opportunity Name<span className="ml-1 text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={event => setForm(previous => ({ ...previous, name: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enterprise renewal"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Estimated Close Date<span className="ml-1 text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.estimatedCloseDate}
                onChange={event => setForm(previous => ({ ...previous, estimatedCloseDate: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Stage<span className="ml-1 text-red-500">*</span>
              </label>
              <select
                value={form.stage}
                onChange={event => setForm(previous => ({ ...previous, stage: event.target.value as OpportunityStage }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
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

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Owner<span className="ml-1 text-red-500">*</span>
              </label>
              <select
                value={form.ownerId}
                onChange={event => setForm(previous => ({ ...previous, ownerId: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Referred By<span className="ml-1 text-red-500">*</span>
              </label>
              <select
                value={form.leadSource}
                onChange={event => setForm(previous => ({ ...previous, leadSource: event.target.value as LeadSource }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {leadSourceOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Subagent</label>
              <input
                type="text"
                value={form.subAgent}
                onChange={event => setForm(previous => ({ ...previous, subAgent: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Optional subagent"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
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
