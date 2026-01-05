"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Info, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { useToasts } from "@/components/toast"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { parseCurrencyDisplay } from "@/lib/revenue-schedule-math"

type StatusAction = "deactivate" | "delete"

export interface RevenueScheduleStatusModalSchedule {
  id: string
  revenueScheduleName?: string | null
  revenueSchedule?: string | null
  revenueScheduleDate?: string | null
  productNameVendor?: string | null
  distributorName?: string | null
  vendorName?: string | null
  opportunityName?: string | null
  actualUsage?: string | null
  actualCommission?: string | null
}

interface RevenueScheduleStatusModalProps {
  isOpen: boolean
  schedules: RevenueScheduleStatusModalSchedule[]
  defaultAction?: StatusAction
  title?: string
  onClose: () => void
  onSuccess?: () => void | Promise<void>
}

const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
const textAreaCls =
  "min-h-[84px] w-full resize-y border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs leading-5 focus:border-primary-500 focus:outline-none"

function getScheduleLabel(schedule: RevenueScheduleStatusModalSchedule) {
  return schedule.revenueScheduleName ?? schedule.revenueSchedule ?? schedule.id
}

export function RevenueScheduleStatusModal({
  isOpen,
  schedules,
  defaultAction = "delete",
  title = "Manage Revenue Schedules",
  onClose,
  onSuccess,
}: RevenueScheduleStatusModalProps) {
  const { showError, showSuccess } = useToasts()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [ineligibleReasons, setIneligibleReasons] = useState<Record<string, string>>({})
  const [prefillApplied, setPrefillApplied] = useState(false)

  const [form, setForm] = useState({
    selectedIds: [] as string[],
    action: defaultAction as StatusAction,
    reason: "",
  })

  const scheduleOptions = useMemo(() => {
    return schedules.map((schedule) => ({
      id: String(schedule.id),
      label: getScheduleLabel(schedule),
      productNameVendor: schedule.productNameVendor ?? null,
      distributorName: schedule.distributorName ?? null,
      vendorName: schedule.vendorName ?? null,
      opportunityName: schedule.opportunityName ?? null,
      scheduleDate: schedule.revenueScheduleDate ?? null,
      actualUsage: schedule.actualUsage ?? null,
      actualCommission: schedule.actualCommission ?? null,
    }))
  }, [schedules])

  useEffect(() => {
    if (!isOpen) {
      setPrefillApplied(false)
      return
    }

    if (prefillApplied) return

    setForm({
      selectedIds: scheduleOptions.map((opt) => opt.id),
      action: defaultAction,
      reason: "",
    })
    setIneligibleReasons({})
    setError(null)
    setShowConfirm(false)
    setSubmitting(false)
    setPrefillApplied(true)
  }, [defaultAction, isOpen, prefillApplied, scheduleOptions])

  const eligibleIds = useMemo(() => {
    const ids = new Set<string>()
    scheduleOptions.forEach((schedule) => {
      const actualUsage = parseCurrencyDisplay(schedule.actualUsage) ?? 0
      const actualCommission = parseCurrencyDisplay(schedule.actualCommission) ?? 0
      const hasUsage = Math.abs(actualUsage) > 0.0001
      const hasCommission = Math.abs(actualCommission) > 0.0001
      if (!hasUsage && !hasCommission) {
        ids.add(schedule.id)
      }
    })
    return ids
  }, [scheduleOptions])

  const getIneligibilityReason = useCallback(
    (id: string): string | undefined => {
      if (ineligibleReasons[id]) return ineligibleReasons[id]
      if (!eligibleIds.has(id)) {
        return "Cannot deactivate or delete this schedule because it has usage or commission applied."
      }
      return undefined
    },
    [eligibleIds, ineligibleReasons],
  )

  const eligibleSelectedCount = useMemo(
    () => form.selectedIds.filter((id) => !getIneligibilityReason(id)).length,
    [form.selectedIds, getIneligibilityReason],
  )
  const ineligibleSelectedCount = form.selectedIds.length - eligibleSelectedCount

  const canSubmit = Boolean(eligibleSelectedCount > 0 && form.reason.trim().length > 0)

  const handleClose = useCallback(() => {
    if (submitting) return
    onClose()
  }, [onClose, submitting])

  const handlePrimary = useCallback(() => {
    if (!canSubmit || submitting) return
    setShowConfirm(true)
  }, [canSubmit, submitting])

  const handleConfirmCancel = useCallback(() => {
    if (submitting) return
    setShowConfirm(false)
  }, [submitting])

  const handleSubmit = useCallback(async () => {
    const ids = form.selectedIds.filter((id) => !getIneligibilityReason(id))
    if (ids.length === 0) {
      const message = "No eligible schedules selected to update."
      setError(message)
      showError("Schedule update failed", message)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      if (form.action === "delete") {
        const results = await Promise.allSettled(
          ids.map(async (id) => {
            const deleteUrl = new URL(
              `/api/revenue-schedules/${encodeURIComponent(id)}`,
              window.location.origin,
            )
            if (form.reason.trim()) {
              deleteUrl.searchParams.set("reason", form.reason.trim())
            }
            const response = await fetch(deleteUrl.toString(), { method: "DELETE" })
            if (!response.ok) {
              const body = await response.json().catch(() => null)
              const message = body?.error ?? "Unable to delete revenue schedule"
              throw new Error(message)
            }
            return id
          }),
        )

        const successfulIds: string[] = []
        const failedResults: Array<{ id: string; error: string }> = []

        results.forEach((result, index) => {
          const id = ids[index]
          if (result.status === "fulfilled") {
            successfulIds.push(result.value)
          } else {
            const errorMessage =
              result.reason instanceof Error ? result.reason.message : String(result.reason)
            failedResults.push({ id, error: errorMessage })
          }
        })

        const deletedCount = successfulIds.length
        const failedCount = failedResults.length

        if (deletedCount > 0) {
          showSuccess(
            `Deleted ${deletedCount} schedule${deletedCount === 1 ? "" : "s"}`,
            "Selected schedules were removed.",
          )
        }

        if (failedCount > 0) {
          const nextReasons: Record<string, string> = {}
          failedResults.forEach(({ id, error }) => {
            nextReasons[id] = error
          })
          setIneligibleReasons((prev) => ({ ...prev, ...nextReasons }))

          const detailMessages = failedResults.map((result) => result.error).join("; ")
          const summary =
            deletedCount > 0
              ? `${deletedCount} schedule${deletedCount === 1 ? "" : "s"} deleted; ${failedCount} could not be deleted.`
              : `${failedCount} schedule${failedCount === 1 ? "" : "s"} could not be deleted.`

          const combinedDetail = detailMessages ? `${summary} ${detailMessages}` : summary
          setError(combinedDetail)
          showError("Some schedules could not be deleted", combinedDetail)

          if (deletedCount === 0) {
            return
          }
        }

        await onSuccess?.()
        onClose()
        return
      }

      const response = await fetch("/api/revenue-schedules/bulk/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleIds: ids,
          reason: form.reason.trim() || null,
          scope: "selection",
        }),
      })

      const body = await response.json().catch(() => null)
      if (!response.ok) {
        const message = body?.error ?? "Unable to deactivate schedules"
        throw new Error(message)
      }

      const updatedCount: number = typeof body?.updated === "number" ? body.updated : ids.length
      const failed: string[] = Array.isArray(body?.failed) ? body.failed : []

      if (updatedCount > 0) {
        showSuccess(
          `Deactivated ${updatedCount} schedule${updatedCount === 1 ? "" : "s"}`,
          "Selected schedules were marked inactive.",
        )
      }

      if (failed.length > 0) {
        const errors = body?.errors as Record<string, string> | undefined
        if (errors && typeof errors === "object") {
          setIneligibleReasons((prev) => ({ ...prev, ...errors }))
        }
        const detail = failed
          .map((id) => errors?.[id])
          .filter(Boolean)
          .join("; ")
        if (detail) {
          setError(detail)
          showError("Some schedules could not be deactivated", detail)
        }
      }

      if (updatedCount > 0) {
        await onSuccess?.()
        onClose()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update schedules"
      setError(message)
      showError("Schedule update failed", message)
    } finally {
      setSubmitting(false)
    }
  }, [form.action, form.reason, form.selectedIds, getIneligibilityReason, onClose, onSuccess, showError, showSuccess])

  const handleConfirm = useCallback(async () => {
    setShowConfirm(false)
    await handleSubmit()
  }, [handleSubmit])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="flex h-[900px] w-full max-w-[1024px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-600">Deactivate or Delete</p>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Select schedules</h3>
              {!scheduleOptions.length ? (
                <p className="mt-2 text-xs text-gray-600">No schedules available yet.</p>
              ) : (
                <div className="mt-3 h-56 overflow-y-auto rounded-lg border border-gray-200">
                  <div className="min-w-[880px]">
                    <div className="grid grid-cols-[auto_minmax(0,2.1fr)_minmax(0,2.1fr)_minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,2.2fr)_minmax(0,1.4fr)] border-b bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      <div className="text-center">Selected</div>
                      <div>Revenue Schedule</div>
                      <div>Vendor - Product Name</div>
                      <div>Distributor</div>
                      <div>Vendor</div>
                      <div>Opportunity</div>
                      <div>Schedule Date</div>
                    </div>
                    {scheduleOptions.map((option) => {
                      const ineligibilityReason = getIneligibilityReason(option.id)
                      const isEligible = !ineligibilityReason
                      const checked = form.selectedIds.includes(option.id)

                      return (
                        <label
                          key={option.id}
                          title={ineligibilityReason}
                          className={cn(
                            "grid grid-cols-[auto_minmax(0,2.1fr)_minmax(0,2.1fr)_minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,2.2fr)_minmax(0,1.4fr)] items-center border-b px-3 py-2 text-xs last:border-b-0",
                            isEligible ? "text-gray-700" : "cursor-not-allowed bg-gray-50 text-gray-400",
                          )}
                        >
                          <div className="flex items-center justify-center gap-2 pr-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-400 text-primary-600 accent-primary-600 disabled:opacity-60"
                              checked={checked}
                              disabled={!isEligible}
                              onChange={(event) => {
                                if (!isEligible) return
                                const checkedInput = event.target.checked
                                setForm((prev) => ({
                                  ...prev,
                                  selectedIds: checkedInput
                                    ? [...prev.selectedIds, option.id]
                                    : prev.selectedIds.filter((id) => id !== option.id),
                                }))
                              }}
                            />
                            {ineligibilityReason ? (
                              <span
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] text-gray-500"
                                title={ineligibilityReason}
                              >
                                <Info className="h-3 w-3" aria-hidden="true" />
                              </span>
                            ) : null}
                          </div>
                          <div className="truncate font-semibold text-gray-900">{option.label}</div>
                          <div className="truncate">{option.productNameVendor || "--"}</div>
                          <div className="truncate">{option.distributorName || "--"}</div>
                          <div className="truncate">{option.vendorName || "--"}</div>
                          <div className="truncate">{option.opportunityName || "Opportunity"}</div>
                          <div className="truncate">{option.scheduleDate || "--"}</div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>
                  Reason<span className="ml-1 text-red-500">*</span>
                </label>
                <textarea
                  value={form.reason}
                  onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                  className={textAreaCls}
                  placeholder="Provide the reason for this change"
                />
              </div>
              <div>
                <label className={labelCls}>Action</label>
                <div className="mt-1 flex flex-wrap gap-4 text-xs text-gray-600">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      className="h-4 w-4 text-primary-600 accent-primary-600"
                      name="status-action"
                      checked={form.action === "deactivate"}
                      onChange={() => setForm((prev) => ({ ...prev, action: "deactivate" }))}
                    />
                    Deactivate
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      className="h-4 w-4 text-primary-600 accent-primary-600"
                      name="status-action"
                      checked={form.action === "delete"}
                      onChange={() => setForm((prev) => ({ ...prev, action: "delete" }))}
                    />
                    Delete
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mx-6 mb-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div
          className="mx-6 mb-3 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-600"
          title="Schedules that have usage or commission applied cannot be deleted or modified."
        >
          <Info className="mt-0.5 h-4 w-4 text-gray-400" aria-hidden="true" />
          <p>
            <span className="font-semibold text-gray-700">Legend:</span> Schedules that have usage or commission applied
            cannot be deleted or modified.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={submitting || !canSubmit}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Apply
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        title={form.action === "delete" ? "Delete revenue schedules" : "Deactivate revenue schedules"}
        description={
          form.action === "delete"
            ? `Delete ${eligibleSelectedCount} schedule${eligibleSelectedCount === 1 ? "" : "s"}? This action cannot be undone.${ineligibleSelectedCount > 0 ? ` ${ineligibleSelectedCount} selected schedule${ineligibleSelectedCount === 1 ? " is" : "s are"} ineligible and will be skipped.` : ""}`
            : `Deactivate ${eligibleSelectedCount} schedule${eligibleSelectedCount === 1 ? "" : "s"}? Deactivated schedules stop billing but remain in history.${ineligibleSelectedCount > 0 ? ` ${ineligibleSelectedCount} selected schedule${ineligibleSelectedCount === 1 ? " is" : "s are"} ineligible and will be skipped.` : ""}`
        }
        confirmLabel={form.action === "delete" ? "Delete" : "Deactivate"}
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
        onCancel={handleConfirmCancel}
        loading={submitting}
      />
    </div>
  )
}
