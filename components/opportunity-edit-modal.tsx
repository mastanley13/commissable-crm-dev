"use client"

import { useEffect, useMemo, useState } from "react"
import { LeadSource, OpportunityStage } from "@prisma/client"
import { getOpportunityStageOptions, isOpportunityStageAutoManaged, isOpportunityStageValue, type OpportunityStageOption } from "@/lib/opportunity-stage"
import { Loader2, X } from "lucide-react"
import { useToasts } from "@/components/toast"
import { ModalHeader } from "@/components/ui/modal-header"

interface SelectOption {
  value: string
  label: string
}

interface OpportunityEditModalProps {
  isOpen: boolean
  opportunityId: string | null
  onClose: () => void
  onSuccess?: () => void
}

interface OpportunityEditFormState {
  name: string
  stage: OpportunityStage
  estimatedCloseDate: string
  ownerId: string
  leadSource: LeadSource | null
  subAgent: string
  accountIdVendor: string
  customerIdVendor: string
  orderIdVendor: string
}

const stageOptions: OpportunityStageOption[] = getOpportunityStageOptions()

const formatStageLabel = (option: OpportunityStageOption) =>
  option.autoManaged ? `${option.label} (auto-managed)` : option.label

const isAutoManagedStage = (value: string | null | undefined): boolean => {
  if (!value) {
    return false
  }
  return isOpportunityStageValue(value) && isOpportunityStageAutoManaged(value)
}

const leadSourceOptions: SelectOption[] = Object.values(LeadSource).map(source => ({
  value: source,
  label: source.replace(/([A-Z])/g, " $1").trim()
}))

export function OpportunityEditModal({ isOpen, opportunityId, onClose, onSuccess }: OpportunityEditModalProps) {
  const [form, setForm] = useState<OpportunityEditFormState | null>(null)
  const [owners, setOwners] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const { showError, showSuccess } = useToasts()

  useEffect(() => {
    if (!isOpen) {
      setForm(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !opportunityId) {
      return
    }

    setFetching(true)
    fetch(`/api/opportunities/${opportunityId}`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          const message = payload?.error ?? "Failed to load opportunity"
          throw new Error(message)
        }
        const payload = await response.json().catch(() => null)
        const data = payload?.data
        if (!data) {
          throw new Error("Opportunity details unavailable")
        }

        const estimatedDate = data.estimatedCloseDate ? new Date(data.estimatedCloseDate) : null
        const formattedDate = estimatedDate && !Number.isNaN(estimatedDate.getTime())
          ? estimatedDate.toISOString().slice(0, 10)
          : ""

        setForm({
          name: data.name || data.opportunityName || "",
          stage: (data.stage as OpportunityStage) || OpportunityStage.Qualification,
          estimatedCloseDate: formattedDate,
          ownerId: data.ownerId || "",
          leadSource: (data.leadSource as LeadSource) ?? null,
          subAgent: data.subAgent ?? "",
          accountIdVendor: data.identifiers?.accountIdVendor ?? "",
          customerIdVendor: data.identifiers?.customerIdVendor ?? "",
          orderIdVendor: data.identifiers?.orderIdVendor ?? "",
        })
      })
      .catch(error => {
        console.error(error)
        showError(
          "Unable to load opportunity",
          error instanceof Error ? error.message : "Please try again later"
        )
        onClose()
      })
      .finally(() => setFetching(false))
  }, [isOpen, opportunityId, onClose, showError])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    fetch("/api/admin/users?limit=100&status=Active", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          throw new Error("Failed to load owners")
        }
        const payload = await response.json().catch(() => null)
        const items = Array.isArray(payload?.data?.users) ? payload.data.users : []
        setOwners(
          items.map((user: any) => ({
            value: user.id,
            label: user.fullName || user.email
          }))
        )
      })
      .catch(error => {
        console.error(error)
        setOwners([])
        showError("Unable to load owners", "Please try again later")
      })
  }, [isOpen, showError])

  // Track which specific validations are failing
  const validationState = useMemo(() => {
    if (!form) return { hasName: false, hasOwner: false, hasDate: false }
    return {
      hasName: form.name.trim().length >= 3,
      hasOwner: form.ownerId.trim().length > 0,
      hasDate: form.estimatedCloseDate.length > 0
    }
  }, [form])

  const canSubmit = useMemo(() => {
    if (!form) return false
    return validationState.hasName && validationState.hasOwner && validationState.hasDate
  }, [form, validationState])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!opportunityId || !form) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          stage: form.stage,
          ownerId: form.ownerId.trim(),
          estimatedCloseDate: form.estimatedCloseDate,
          leadSource: form.leadSource,
          subAgent: form.subAgent,
          accountIdVendor: form.accountIdVendor,
          customerIdVendor: form.customerIdVendor,
          orderIdVendor: form.orderIdVendor,
        })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.error ?? "Failed to update opportunity"
        throw new Error(message)
      }

      showSuccess("Opportunity updated", "The opportunity changes have been saved.")
      setForm(null)
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error(error)
      showError(
        "Unable to update opportunity",
        error instanceof Error ? error.message : "Please try again later"
      )
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <ModalHeader kicker="Edit Opportunity" title="Update Opportunity Details" />

        {fetching ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">Loading opportunity details...</p>
          </div>
        ) : form ? (
          <form className="space-y-6 px-6 py-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="opportunity-name">
                  Opportunity name
                </label>
                <input
                  id="opportunity-name"
                  type="text"
                  value={form.name}
                  onChange={event => setForm(current => current ? { ...current, name: event.target.value } : current)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={loading}
                  required
                  minLength={3}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="opportunity-stage">
                  Stage
                </label>
                <select
                  id="opportunity-stage"
                  value={form.stage}
                  onChange={event => setForm(current => current ? { ...current, stage: event.target.value as OpportunityStage } : current)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={loading}
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
                {isAutoManagedStage(form.stage) && (
                  <p className="mt-1 text-xs text-gray-500">
                    Stage updates automatically based on product billing status.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="opportunity-owner">
                  Owner <span className="text-red-500">*</span>
                </label>
                <select
                  id="opportunity-owner"
                  value={form.ownerId}
                  onChange={event => setForm(current => current ? { ...current, ownerId: event.target.value } : current)}
                  className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    !validationState.hasOwner && form.ownerId === "" ? 'border-amber-300' : 'border-gray-300'
                  }`}
                  disabled={loading}
                >
                  <option value="">Select owner...</option>
                  {owners.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="opportunity-lead-source">
                  Lead source
                </label>
                <select
                  id="opportunity-lead-source"
                  value={form.leadSource ?? ""}
                  onChange={event => setForm(current => current ? { ...current, leadSource: event.target.value ? event.target.value as LeadSource : null } : current)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="">Unassigned</option>
                  {leadSourceOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="opportunity-estimated-close">
                  Estimated close date <span className="text-red-500">*</span>
                </label>
                <input
                  id="opportunity-estimated-close"
                  type="date"
                  value={form.estimatedCloseDate}
                  onChange={event => setForm(current => current ? { ...current, estimatedCloseDate: event.target.value } : current)}
                  className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    !validationState.hasDate && form.estimatedCloseDate === "" ? 'border-amber-300' : 'border-gray-300'
                  }`}
                  disabled={loading}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="opportunity-subagent">
                  Sub-agent
                </label>
                <input
                  id="opportunity-subagent"
                  type="text"
                  value={form.subAgent}
                  onChange={event => setForm(current => current ? { ...current, subAgent: event.target.value } : current)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Other IDs (comma-separated)
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="opportunity-account-id-vendor">
                    Other - Account ID
                  </label>
                  <input
                    id="opportunity-account-id-vendor"
                    type="text"
                    value={form.accountIdVendor}
                    onChange={event => setForm(current => current ? { ...current, accountIdVendor: event.target.value } : current)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={loading}
                    placeholder="ACCT-001, ACCT-002"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="opportunity-customer-id-vendor">
                    Other - Customer ID
                  </label>
                  <input
                    id="opportunity-customer-id-vendor"
                    type="text"
                    value={form.customerIdVendor}
                    onChange={event => setForm(current => current ? { ...current, customerIdVendor: event.target.value } : current)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={loading}
                    placeholder="CUST-123, CUST-124"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="opportunity-order-id-vendor">
                    Other - Order ID
                  </label>
                  <input
                    id="opportunity-order-id-vendor"
                    type="text"
                    value={form.orderIdVendor}
                    onChange={event => setForm(current => current ? { ...current, orderIdVendor: event.target.value } : current)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={loading}
                    placeholder="ORD-1001, ORD-1002"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Paste multiple values separated by commas or new lines. Matching treats IDs case-insensitively.
              </p>
            </div>

            {/* Validation Feedback */}
            {!canSubmit && form && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-medium text-amber-800 mb-2">Please complete the following to save:</p>
                <ul className="text-sm text-amber-700 space-y-1 ml-4 list-disc">
                  {!validationState.hasName && (
                    <li>Opportunity name must be at least 3 characters</li>
                  )}
                  {!validationState.hasOwner && (
                    <li>Please select an owner</li>
                  )}
                  {!validationState.hasDate && (
                    <li>Please select an estimated close date</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !canSubmit}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20">
            <AlertMessage />
            <p className="text-sm text-gray-500">Unable to display opportunity details.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function AlertMessage() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
      <X className="h-4 w-4" />
      <span>Opportunity data is unavailable.</span>
    </div>
  )
}
