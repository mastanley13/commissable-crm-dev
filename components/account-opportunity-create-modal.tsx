"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import { LeadSource, OpportunityStage } from "@prisma/client"
import { useToasts } from "@/components/toast"

interface SelectOption {
  value: string
  label: string
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
  subAgent: string
}

const stageOptions: SelectOption[] = Object.values(OpportunityStage).map(stage => ({
  value: stage,
  label: stage.replace(/([A-Z])/g, " $1").trim()
}))

const leadSourceOptions: SelectOption[] = Object.values(LeadSource).map(source => ({
  value: source,
  label: source.replace(/([A-Z])/g, " $1").trim()
}))

export function OpportunityCreateModal({ isOpen, accountId, accountName, onClose, onCreated }: OpportunityCreateModalProps) {
  const [form, setForm] = useState<OpportunityFormState>({
    name: "",
    stage: OpportunityStage.Qualification,
    estimatedCloseDate: "",
    ownerId: "",
    leadSource: LeadSource.Referral,
    subAgent: ""
  })
  const [owners, setOwners] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const { showError, showSuccess } = useToasts()

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
      subAgent: ""
    })

    setOptionsLoading(true)
    fetch("/api/admin/users?limit=100", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          throw new Error("Failed to load owners")
        }
        const payload = await response.json()
        const items = Array.isArray(payload?.data?.users) ? payload.data.users : []
        setOwners(
          items.map((user: any) => ({
            value: user.id,
            label: user.fullName || user.email
          }))
        )
      })
      .catch(() => {
        setOwners([])
        showError("Unable to load owners", "Please try again later")
      })
      .finally(() => setOptionsLoading(false))
  }, [isOpen, showError])

  const canSubmit = useMemo(() => {
    return Boolean(
      accountId &&
      form.name.trim().length >= 3 &&
      form.stage &&
      form.ownerId &&
      form.leadSource &&
      form.estimatedCloseDate
    )
  }, [accountId, form])

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
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-600">Create Opportunity</p>
            <h2 className="text-lg font-semibold text-gray-900">New Opportunity for {accountName}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Opportunity Name<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter opportunity name"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Estimated Close Date<span className="ml-1 text-red-500">*</span></label>
              <input
                type="date"
                value={form.estimatedCloseDate}
                onChange={event => setForm(prev => ({ ...prev, estimatedCloseDate: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Stage<span className="ml-1 text-red-500">*</span></label>
              <select
                value={form.stage}
                onChange={event => setForm(prev => ({ ...prev, stage: event.target.value as OpportunityStage }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {stageOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Owner<span className="ml-1 text-red-500">*</span></label>
              <select
                value={form.ownerId}
                onChange={event => setForm(prev => ({ ...prev, ownerId: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
                disabled={optionsLoading}
              >
                <option value="">{optionsLoading ? "Loading owners..." : "Select owner"}</option>
                {owners.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Referred By<span className="ml-1 text-red-500">*</span></label>
              <select
                value={form.leadSource}
                onChange={event => setForm(prev => ({ ...prev, leadSource: event.target.value as LeadSource }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {leadSourceOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Subagent</label>
              <input
                type="text"
                value={form.subAgent}
                onChange={event => setForm(prev => ({ ...prev, subAgent: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Optional subagent"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-gray-200 px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
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
