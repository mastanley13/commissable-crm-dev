"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useToasts } from "./toast"

type Option = {
  value: string
  label: string
  subLabel?: string
  meta?: Record<string, unknown>
}

interface TicketCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  defaultRevenueScheduleId?: string
  defaultRevenueScheduleName?: string
  defaultOpportunityId?: string
  defaultOpportunityName?: string
  defaultDistributorAccountId?: string
  defaultDistributorName?: string
  defaultVendorAccountId?: string
  defaultVendorName?: string
  defaultProductNameVendor?: string
}

type TicketFormState = {
  issue: string
  ticketType: string
  lastActivityDate: string
  distributorAccountId: string
  distributorName: string
  vendorAccountId: string
  vendorName: string
  opportunityId: string
  opportunityName: string
  opportunityShortId: string
  revenueScheduleId: string
  revenueScheduleName: string
  productNameVendor: string
  notes: string
}

const TICKET_TYPE_OPTIONS = [
  "Support Request",
  "Product/Inventory Issue",
  "Commission Question",
  "Other"
]

const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
const inputCls =
  "w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
const textAreaCls =
  "w-full border-b-2 border-gray-300 bg-transparent px-0 py-2 text-xs leading-5 focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 min-h-[72px] resize-y"
const dropdownCls =
  "absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"

const INITIAL_FORM: TicketFormState = {
  issue: "",
  ticketType: "",
  lastActivityDate: "",
  distributorAccountId: "",
  distributorName: "",
  vendorAccountId: "",
  vendorName: "",
  opportunityId: "",
  opportunityName: "",
  opportunityShortId: "",
  revenueScheduleId: "",
  revenueScheduleName: "",
  productNameVendor: "",
  notes: ""
}

export function TicketCreateModal({
  isOpen,
  onClose,
  onSuccess,
  defaultRevenueScheduleId,
  defaultRevenueScheduleName,
  defaultOpportunityId,
  defaultOpportunityName,
  defaultDistributorAccountId,
  defaultDistributorName,
  defaultVendorAccountId,
  defaultVendorName,
  defaultProductNameVendor
}: TicketCreateModalProps) {
  const [form, setForm] = useState<TicketFormState>(INITIAL_FORM)
  const [loading, setLoading] = useState(false)

  const [distributorQuery, setDistributorQuery] = useState("")
  const [vendorQuery, setVendorQuery] = useState("")
  const [opportunityQuery, setOpportunityQuery] = useState("")
  const [revenueScheduleQuery, setRevenueScheduleQuery] = useState("")

  const [distributorOptions, setDistributorOptions] = useState<Option[]>([])
  const [vendorOptions, setVendorOptions] = useState<Option[]>([])
  const [opportunityOptions, setOpportunityOptions] = useState<Option[]>([])
  const [revenueScheduleOptions, setRevenueScheduleOptions] = useState<Option[]>([])

  const [distributorLoading, setDistributorLoading] = useState(false)
  const [vendorLoading, setVendorLoading] = useState(false)
  const [opportunityLoading, setOpportunityLoading] = useState(false)
  const [revenueScheduleLoading, setRevenueScheduleLoading] = useState(false)

  const [showDistributorDropdown, setShowDistributorDropdown] = useState(false)
  const [showVendorDropdown, setShowVendorDropdown] = useState(false)
  const [showOpportunityDropdown, setShowOpportunityDropdown] = useState(false)
  const [showRevenueScheduleDropdown, setShowRevenueScheduleDropdown] = useState(false)

  const { showError, showSuccess } = useToasts()

  useEffect(() => {
    if (!isOpen) return

    const initial: TicketFormState = {
      ...INITIAL_FORM,
      distributorAccountId: defaultDistributorAccountId ?? "",
      distributorName: defaultDistributorName ?? "",
      vendorAccountId: defaultVendorAccountId ?? "",
      vendorName: defaultVendorName ?? "",
      opportunityId: defaultOpportunityId ?? "",
      opportunityName: defaultOpportunityName ?? "",
      opportunityShortId: defaultOpportunityId ? defaultOpportunityId.slice(0, 8).toUpperCase() : "",
      revenueScheduleId: defaultRevenueScheduleId ?? "",
      revenueScheduleName: defaultRevenueScheduleName ?? "",
      productNameVendor: defaultProductNameVendor ?? ""
    }

    setForm(initial)
    setDistributorQuery(initial.distributorName)
    setVendorQuery(initial.vendorName)
    setOpportunityQuery(initial.opportunityName)
    setRevenueScheduleQuery(initial.revenueScheduleName)
  }, [
    isOpen,
    defaultDistributorAccountId,
    defaultDistributorName,
    defaultVendorAccountId,
    defaultVendorName,
    defaultOpportunityId,
    defaultOpportunityName,
    defaultRevenueScheduleId,
    defaultRevenueScheduleName,
    defaultProductNameVendor
  ])

  useEffect(() => {
    if (!isOpen) return
    const controller = new AbortController()
    setDistributorLoading(true)
    const params = new URLSearchParams({
      page: "1",
      pageSize: "20",
      status: "Active",
      accountType: "Distributor"
    })
    const trimmed = distributorQuery.trim()
    if (trimmed.length > 0) {
      params.set("q", trimmed)
    }

    fetch(`/api/accounts?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error ?? "Unable to load distributors")
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []
        const options: Option[] = items.map(item => ({
          value: item.id,
          label: item.accountName ?? "Distributor",
          subLabel: item.accountType ?? undefined
        }))
        setDistributorOptions(options)
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return
        console.error("Failed to load distributors", error)
        setDistributorOptions([])
      })
      .finally(() => setDistributorLoading(false))

    return () => controller.abort()
  }, [distributorQuery, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const controller = new AbortController()
    setVendorLoading(true)
    const params = new URLSearchParams({
      page: "1",
      pageSize: "20",
      status: "Active",
      accountType: "Vendor"
    })
    const trimmed = vendorQuery.trim()
    if (trimmed.length > 0) {
      params.set("q", trimmed)
    }

    fetch(`/api/accounts?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error ?? "Unable to load vendors")
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []
        const options: Option[] = items.map(item => ({
          value: item.id,
          label: item.accountName ?? "Vendor",
          subLabel: item.accountType ?? undefined
        }))
        setVendorOptions(options)
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return
        console.error("Failed to load vendors", error)
        setVendorOptions([])
      })
      .finally(() => setVendorLoading(false))

    return () => controller.abort()
  }, [isOpen, vendorQuery])

  useEffect(() => {
    if (!isOpen) return
    const controller = new AbortController()
    setOpportunityLoading(true)
    const params = new URLSearchParams({
      page: "1",
      pageSize: "20",
      status: "active"
    })
    const trimmed = opportunityQuery.trim()
    if (trimmed.length > 0) {
      params.set("q", trimmed)
    }

    fetch(`/api/opportunities?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error ?? "Unable to load opportunities")
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []
        const options: Option[] = items.map(item => ({
          value: item.id,
          label: item.opportunityName ?? item.name ?? "Opportunity",
          subLabel: item.accountName ?? "",
          meta: {
            shortId: item.opportunityId ?? "",
            distributorName: item.distributorName ?? "",
            vendorName: item.vendorName ?? ""
          }
        }))
        setOpportunityOptions(options)
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return
        console.error("Failed to load opportunities", error)
        setOpportunityOptions([])
      })
      .finally(() => setOpportunityLoading(false))

    return () => controller.abort()
  }, [isOpen, opportunityQuery])

  useEffect(() => {
    if (!isOpen) return
    const controller = new AbortController()
    setRevenueScheduleLoading(true)
    const params = new URLSearchParams({
      page: "1",
      pageSize: "20",
      status: "active"
    })
    const trimmed = revenueScheduleQuery.trim()
    if (trimmed.length > 0) {
      params.set("q", trimmed)
    }
    const filters: Array<{ columnId: string; value: string }> = []
    if (form.opportunityId) {
      filters.push({ columnId: "opportunityId", value: form.opportunityId })
    }
    if (filters.length > 0) {
      params.set("filters", JSON.stringify(filters))
    }

    fetch(`/api/revenue-schedules?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error ?? "Unable to load revenue schedules")
        const items: any[] = Array.isArray(payload?.data) ? payload.data : []
        const options: Option[] = items.map(item => ({
          value: item.id,
          label: item.revenueScheduleName ?? item.revenueSchedule ?? "Revenue Schedule",
          subLabel: item.opportunityName ?? "",
          meta: {
            productNameVendor: item.productNameVendor ?? "",
            distributorName: item.distributorName ?? "",
            vendorName: item.vendorName ?? "",
            opportunityId: item.opportunityId ?? "",
            opportunityName: item.opportunityName ?? ""
          }
        }))
        setRevenueScheduleOptions(options)
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return
        console.error("Failed to load revenue schedules", error)
        setRevenueScheduleOptions([])
      })
      .finally(() => setRevenueScheduleLoading(false))

    return () => controller.abort()
  }, [form.opportunityId, isOpen, revenueScheduleQuery])

  const canSubmit = useMemo(() => form.issue.trim().length > 0, [form.issue])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      showError("Missing information", "Issue is required to create a ticket.")
      return
    }

    setLoading(true)
    try {
      const payload = {
        issue: form.issue.trim(),
        notes: form.notes.trim(),
        ticketType: form.ticketType || undefined,
        productNameVendor: form.productNameVendor || undefined,
        distributorAccountId: form.distributorAccountId || null,
        vendorAccountId: form.vendorAccountId || null,
        opportunityId: form.opportunityId || null,
        revenueScheduleId: form.revenueScheduleId || null
      }

      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.error ?? "Unable to create ticket")
      }

      showSuccess("Ticket created", "New ticket has been added.")
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error("Failed to create ticket", error)
      showError("Create failed", error instanceof Error ? error.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-5xl h-[900px] rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-600">Create Ticket</p>
            <h2 className="text-lg font-semibold text-gray-900">New Ticket</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Row 1: Core Ticket Information */}
            <div>
              <label className={labelCls}>Ticket Number</label>
              <input
                type="text"
                value="Auto-generated on save"
                disabled
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Issue<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={form.issue}
                onChange={event => setForm(prev => ({ ...prev, issue: event.target.value }))}
                className={inputCls}
                placeholder="Enter issue"
                required
              />
            </div>

            <div>
              <label className={labelCls}>Ticket Type</label>
              <select
                value={form.ticketType}
                onChange={event => setForm(prev => ({ ...prev, ticketType: event.target.value }))}
                className={`${inputCls} pr-6`}
              >
                <option value="">Select</option>
                {TICKET_TYPE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Last Activity Date</label>
              <input
                type="text"
                value={form.lastActivityDate || "YYYY-MM-DD"}
                disabled
                className={inputCls}
              />
            </div>

            {/* Row 2-3: Relationship Fields */}
            <div className="relative">
              <label className={labelCls}>Vendor Name</label>
              <input
                type="text"
                value={form.vendorName || vendorQuery}
                placeholder="Select vendor"
                onChange={event => {
                  setVendorQuery(event.target.value)
                  setForm(prev => ({ ...prev, vendorName: event.target.value, vendorAccountId: "" }))
                }}
                onFocus={() => setShowVendorDropdown(true)}
                onBlur={() => setTimeout(() => setShowVendorDropdown(false), 120)}
                className={inputCls}
              />
              {showVendorDropdown && vendorOptions.length > 0 && (
                <div className={dropdownCls}>
                  {vendorOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({
                          ...prev,
                          vendorAccountId: option.value,
                          vendorName: option.label
                        }))
                        setVendorQuery(option.label)
                        setShowVendorDropdown(false)
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50"
                    >
                      <div className="font-medium text-gray-900">{option.label}</div>
                      {option.subLabel && <div className="text-xs text-gray-500">{option.subLabel}</div>}
                    </button>
                  ))}
                  {vendorLoading && (
                    <div className="px-3 py-2 text-xs text-gray-500">Loading vendors…</div>
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <label className={labelCls}>Distributor Name</label>
              <input
                type="text"
                value={form.distributorName || distributorQuery}
                placeholder="Select distributor"
                onChange={event => {
                  setDistributorQuery(event.target.value)
                  setForm(prev => ({ ...prev, distributorName: event.target.value, distributorAccountId: "" }))
                }}
                onFocus={() => setShowDistributorDropdown(true)}
                onBlur={() => setTimeout(() => setShowDistributorDropdown(false), 120)}
                className={inputCls}
              />
              {showDistributorDropdown && distributorOptions.length > 0 && (
                <div className={dropdownCls}>
                  {distributorOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({
                          ...prev,
                          distributorAccountId: option.value,
                          distributorName: option.label
                        }))
                        setDistributorQuery(option.label)
                        setShowDistributorDropdown(false)
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50"
                    >
                      <div className="font-medium text-gray-900">{option.label}</div>
                      {option.subLabel && <div className="text-xs text-gray-500">{option.subLabel}</div>}
                    </button>
                  ))}
                  {distributorLoading && (
                    <div className="px-3 py-2 text-xs text-gray-500">Loading distributors…</div>
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <label className={labelCls}>Opportunity Name</label>
              <input
                type="text"
                value={form.opportunityName || opportunityQuery}
                placeholder="Select opportunity"
                onChange={event => {
                  setOpportunityQuery(event.target.value)
                  setForm(prev => ({
                    ...prev,
                    opportunityName: event.target.value,
                    opportunityId: "",
                    opportunityShortId: ""
                  }))
                }}
                onFocus={() => setShowOpportunityDropdown(true)}
                onBlur={() => setTimeout(() => setShowOpportunityDropdown(false), 120)}
                className={inputCls}
              />
              {showOpportunityDropdown && opportunityOptions.length > 0 && (
                <div className={dropdownCls}>
                  {opportunityOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({
                          ...prev,
                          opportunityId: option.value,
                          opportunityName: option.label,
                          opportunityShortId: (option.meta?.shortId as string) || ""
                        }))
                        setOpportunityQuery(option.label)
                        setShowOpportunityDropdown(false)
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50"
                    >
                      <div className="font-medium text-gray-900">{option.label}</div>
                      {option.subLabel && <div className="text-xs text-gray-500">{option.subLabel}</div>}
                    </button>
                  ))}
                  {opportunityLoading && (
                    <div className="px-3 py-2 text-xs text-gray-500">Loading opportunities…</div>
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <label className={labelCls}>Revenue Schedule</label>
              <input
                type="text"
                value={form.revenueScheduleName || revenueScheduleQuery}
                placeholder="Select revenue schedule"
                onChange={event => {
                  setRevenueScheduleQuery(event.target.value)
                  setForm(prev => ({
                    ...prev,
                    revenueScheduleId: "",
                    revenueScheduleName: "",
                    productNameVendor: ""
                  }))
                }}
                onFocus={() => setShowRevenueScheduleDropdown(true)}
                onBlur={() => setTimeout(() => setShowRevenueScheduleDropdown(false), 120)}
                className={inputCls}
              />
              {showRevenueScheduleDropdown && revenueScheduleOptions.length > 0 && (
                <div className={dropdownCls}>
                  {revenueScheduleOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        const scheduleOpportunityId = (option.meta?.opportunityId as string) || ""
                        const scheduleOpportunityName = (option.meta?.opportunityName as string) || ""
                        const scheduleShortId = scheduleOpportunityId
                          ? scheduleOpportunityId.slice(0, 8).toUpperCase()
                          : ""

                        setForm(prev => ({
                          ...prev,
                          revenueScheduleId: option.value,
                          revenueScheduleName: option.label,
                          productNameVendor: (option.meta?.productNameVendor as string) || prev.productNameVendor,
                          opportunityId: scheduleOpportunityId || prev.opportunityId,
                          opportunityName: scheduleOpportunityName || prev.opportunityName,
                          opportunityShortId: scheduleShortId || prev.opportunityShortId
                        }))
                        setRevenueScheduleQuery(option.label)
                        setShowRevenueScheduleDropdown(false)
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus:bg-primary-50"
                    >
                      <div className="font-medium text-gray-900">{option.label}</div>
                      {option.subLabel && <div className="text-xs text-gray-500">{option.subLabel}</div>}
                    </button>
                  ))}
                  {revenueScheduleLoading && (
                    <div className="px-3 py-2 text-xs text-gray-500">Loading revenue schedules…</div>
                  )}
                </div>
              )}
            </div>

            {/* Row 4: Supporting Information */}
            <div>
              <label className={labelCls}>Opportunity ID</label>
              <input
                type="text"
                value={form.opportunityShortId || "Will fill after selection"}
                disabled
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Other - Product Name</label>
              <input
                type="text"
                value={form.productNameVendor}
                onChange={event => setForm(prev => ({ ...prev, productNameVendor: event.target.value }))}
                className={inputCls}
                placeholder="Pulled from revenue schedule"
              />
            </div>

            {/* Row 5: Notes (Full Width) */}
            <div className="md:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea
                value={form.notes}
                onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))}
                className={textAreaCls}
                placeholder="Enter notes"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-gray-200 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600 transition hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
