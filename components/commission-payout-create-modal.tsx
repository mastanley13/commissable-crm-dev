"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"

import { useToasts } from "@/components/toast"

type SplitType = "House" | "HouseRep" | "Subagent"

interface CommissionPayoutCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  revenueScheduleId: string
  defaultSplitType?: SplitType
}

const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
const inputCls =
  "w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"

export function CommissionPayoutCreateModal({
  isOpen,
  onClose,
  onSuccess,
  revenueScheduleId,
  defaultSplitType = "House"
}: CommissionPayoutCreateModalProps) {
  const { showSuccess, showError } = useToasts()
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const [splitType, setSplitType] = useState<SplitType>(defaultSplitType)
  const [amount, setAmount] = useState<string>("")
  const [paidAt, setPaidAt] = useState<string>(today)
  const [reference, setReference] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    setSplitType(defaultSplitType)
    setAmount("")
    setPaidAt(today)
    setReference("")
    setSaving(false)
    setFieldErrors({})
  }, [defaultSplitType, isOpen, today])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!revenueScheduleId) return

    setSaving(true)
    setFieldErrors({})
    try {
      const response = await fetch(`/api/revenue-schedules/${encodeURIComponent(revenueScheduleId)}/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          splitType,
          amount,
          paidAt,
          reference
        })
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const serverErrors = (payload?.errors ?? {}) as Record<string, string>
        if (serverErrors && Object.keys(serverErrors).length > 0) {
          setFieldErrors(serverErrors)
        }
        throw new Error(payload?.error ?? "Failed to record payment")
      }

      showSuccess("Payment recorded", "Payout has been added.")
      onClose()
      onSuccess?.()
    } catch (error) {
      showError("Unable to record payment", error instanceof Error ? error.message : "Failed to record payment")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Record Payment</h2>
            <p className="text-xs text-gray-500">Adds a payout transaction for this revenue schedule.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
          <div>
            <label className={labelCls}>Split</label>
            <select
              className={inputCls}
              value={splitType}
              onChange={e => setSplitType(e.target.value as SplitType)}
              disabled={saving}
            >
              <option value="House">House</option>
              <option value="HouseRep">House Rep</option>
              <option value="Subagent">Subagent</option>
            </select>
            {fieldErrors.splitType ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.splitType}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Amount</label>
              <input
                className={inputCls}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="$0.00"
                disabled={saving}
                inputMode="decimal"
              />
              {fieldErrors.amount ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.amount}</p> : null}
            </div>
            <div>
              <label className={labelCls}>Paid At</label>
              <input
                className={inputCls}
                value={paidAt}
                onChange={e => setPaidAt(e.target.value)}
                type="date"
                disabled={saving}
              />
              {fieldErrors.paidAt ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.paidAt}</p> : null}
            </div>
          </div>

          <div>
            <label className={labelCls}>Reference (optional)</label>
            <input
              className={inputCls}
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="ACH-12345"
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

