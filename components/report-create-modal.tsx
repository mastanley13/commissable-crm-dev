"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useToasts } from "@/components/toast"

interface SelectOption {
  value: string
  label: string
}

interface ReportCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (reportId: string) => void
}

interface ReportFormState {
  reportName: string
  reportType: string
  description: string
}

const reportTypeOptions: SelectOption[] = [
  { value: "Commission", label: "Commission" },
  { value: "Revenue", label: "Revenue" },
  { value: "Activity", label: "Activity" },
  { value: "Opportunity", label: "Opportunity" },
  { value: "Custom", label: "Custom" }
]

export function ReportCreateModal({ isOpen, onClose, onCreated }: ReportCreateModalProps) {
  const [form, setForm] = useState<ReportFormState>({
    reportName: "",
    reportType: "Commission",
    description: ""
  })
  const [loading, setLoading] = useState(false)
  const [submitMode, setSubmitMode] = useState<"save" | "saveAndNew">("save")
  const { showError, showSuccess } = useToasts()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm({
      reportName: "",
      reportType: "Commission",
      description: ""
    })
    setSubmitMode("save")
  }, [isOpen])

  const canSubmit = useMemo(() => form.reportName.trim().length >= 3, [form.reportName])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      showError("Missing information", "Report name is required (minimum 3 characters).")
      return
    }

    setLoading(true)
    try {
      const payload = {
        reportName: form.reportName.trim(),
        reportType: form.reportType,
        description: form.description.trim() || null
      }

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.error ?? "Failed to create report")
      }

      const data = await response.json().catch(() => null)
      const reportId: string | undefined = data?.data?.id
      showSuccess("Report created", "The report has been created successfully.")
      onCreated?.(reportId ?? "")

      if (submitMode === "saveAndNew") {
        setForm(prev => ({
          ...prev,
          reportName: "",
          description: ""
        }))
        setSubmitMode("save")
      } else {
        onClose()
      }
    } catch (error) {
      console.error("Failed to create report", error)
      showError(
        "Unable to create report",
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
            <p className="text-xs font-semibold uppercase text-primary-600">Create Report</p>
            <h2 className="text-lg font-semibold text-gray-900">New Report</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Report Name<span className="ml-1 text-red-500">*</span></label>
              <input
                type="text"
                value={form.reportName}
                onChange={event => setForm(prev => ({ ...prev, reportName: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="Enter report name"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Report Type</label>
              <select
                value={form.reportType}
                onChange={event => setForm(prev => ({ ...prev, reportType: event.target.value }))}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
              >
                {reportTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Description</label>
              <textarea
                value={form.description}
                onChange={event => setForm(prev => ({ ...prev, description: event.target.value.slice(0, 500) }))}
                rows={3}
                className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                placeholder="Describe the purpose of this report"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-gray-200 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 transition hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={() => setSubmitMode("saveAndNew")}
              disabled={loading || !canSubmit}
              className="flex items-center gap-2 rounded-full border border-primary-600 px-6 py-2 text-sm font-semibold text-primary-600 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:border-primary-300 disabled:text-primary-300"
            >
              {loading && submitMode === "saveAndNew" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save & New
            </button>
            <button
              type="submit"
              onClick={() => setSubmitMode("save")}
              disabled={loading || !canSubmit}
              className="flex items-center gap-2 rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
            >
              {loading && submitMode === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

