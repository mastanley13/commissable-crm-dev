"use client"

import { useMemo, useState } from "react"
import { ModalHeader } from "./ui/modal-header"
import { cn } from "@/lib/utils"
import type { DepositLineItemRow, SuggestedMatchScheduleRow } from "@/lib/mock-data"
import type { MatchSelectionType } from "@/lib/matching/match-selection"
import { isSelectionCompatibleWithType } from "@/lib/matching/match-selection"

type MatchWizardStep = 0 | 1 | 2 | 3

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatMatchType(type: MatchSelectionType) {
  switch (type) {
    case "OneToOne":
      return "1:1"
    case "OneToMany":
      return "1:M"
    case "ManyToOne":
      return "M:1"
    case "ManyToMany":
      return "M:M"
    default: {
      const exhaustiveCheck: never = type
      return exhaustiveCheck
    }
  }
}

export function ReconciliationMatchWizardModal(props: {
  open: boolean
  onClose: () => void
  selectedLines: DepositLineItemRow[]
  selectedSchedules: SuggestedMatchScheduleRow[]
  detectedType: MatchSelectionType
}) {
  const [step, setStep] = useState<MatchWizardStep>(0)
  const [overrideType, setOverrideType] = useState<MatchSelectionType | null>(null)

  const lineCount = props.selectedLines.length
  const scheduleCount = props.selectedSchedules.length
  const effectiveType = overrideType ?? props.detectedType

  const selectionCompatible = useMemo(
    () => isSelectionCompatibleWithType({ type: effectiveType, lineCount, scheduleCount }),
    [effectiveType, lineCount, scheduleCount],
  )

  const selectionTotals = useMemo(() => {
    const lineUsageTotal = props.selectedLines.reduce((sum, row) => sum + (Number(row.usage) || 0), 0)
    const lineCommissionTotal = props.selectedLines.reduce((sum, row) => sum + (Number(row.commission) || 0), 0)
    const scheduleExpectedUsage = props.selectedSchedules.reduce(
      (sum, row) => sum + (Number(row.expectedUsageNet) || 0),
      0,
    )
    const scheduleExpectedCommission = props.selectedSchedules.reduce(
      (sum, row) => sum + (Number(row.expectedCommissionNet) || 0),
      0,
    )
    return {
      lineUsageTotal,
      lineCommissionTotal,
      scheduleExpectedUsage,
      scheduleExpectedCommission,
    }
  }, [props.selectedLines, props.selectedSchedules])

  const stepMeta = useMemo(
    () => [
      { label: "Selection", description: "Review selection + detected match type" },
      { label: "Allocation", description: "Enter allocations (coming next)" },
      { label: "Preview", description: "Validate invariants + show deltas (coming next)" },
      { label: "Apply", description: "Apply as one atomic action (coming next)" },
    ],
    [],
  )

  const canGoNextFromSelection = selectionCompatible

  const allocationNotImplemented = effectiveType !== "OneToOne"
  const applyEnabled = !allocationNotImplemented && effectiveType === "OneToOne"

  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4" onClick={props.onClose}>
      <div
        className="w-full max-w-2xl rounded-xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <ModalHeader kicker="Match Wizard" title={`Match ${lineCount} line${lineCount === 1 ? "" : "s"} to ${scheduleCount} schedule${scheduleCount === 1 ? "" : "s"}`} />

        <div className="border-b border-slate-200 px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {stepMeta.map((item, index) => {
              const isActive = index === step
              const isDone = index < step
              return (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                    isActive
                      ? "border-primary-300 bg-primary-50 text-primary-800"
                      : isDone
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  <span className="font-semibold">{item.label}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-slate-600">{stepMeta[step].description}</p>
        </div>

        <div className="space-y-4 p-6 text-sm text-slate-700">
          {step === 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detected match type</p>
                  <p className="text-base font-semibold text-slate-900">{formatMatchType(props.detectedType)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Override (optional)
                  </label>
                  <select
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
                    value={overrideType ?? "auto"}
                    onChange={e =>
                      setOverrideType(e.target.value === "auto" ? null : (e.target.value as MatchSelectionType))
                    }
                  >
                    <option value="auto">Auto</option>
                    <option value="OneToOne">1:1</option>
                    <option value="OneToMany">1:M</option>
                    <option value="ManyToOne">M:1</option>
                    <option value="ManyToMany">M:M</option>
                  </select>
                </div>
              </div>

              {!selectionCompatible ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <p className="font-semibold">Selection does not match the chosen type</p>
                  <p className="mt-1 text-xs">
                    You selected {lineCount} line{lineCount === 1 ? "" : "s"} and {scheduleCount} schedule
                    {scheduleCount === 1 ? "" : "s"}. Choose a compatible match type or adjust your selection.
                  </p>
                </div>
              ) : effectiveType === "ManyToMany" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <p className="font-semibold">M:M is detected</p>
                  <p className="mt-1 text-xs">
                    Sprint 1 MVP focuses on 1:M and M:1. For now, this wizard blocks M:M and will be enabled once
                    FLOW-001 fully specifies M:M allocation + undo semantics.
                  </p>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected lines</p>
                  <p className="mt-1 text-sm">
                    Usage total: <span className="font-semibold">{currencyFormatter.format(selectionTotals.lineUsageTotal)}</span>
                  </p>
                  <p className="text-sm">
                    Commission total:{" "}
                    <span className="font-semibold">{currencyFormatter.format(selectionTotals.lineCommissionTotal)}</span>
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected schedules</p>
                  <p className="mt-1 text-sm">
                    Expected usage net:{" "}
                    <span className="font-semibold">
                      {currencyFormatter.format(selectionTotals.scheduleExpectedUsage)}
                    </span>
                  </p>
                  <p className="text-sm">
                    Expected commission net:{" "}
                    <span className="font-semibold">
                      {currencyFormatter.format(selectionTotals.scheduleExpectedCommission)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-2">
              <p className="font-semibold text-slate-900">Allocation (coming next)</p>
              <p className="text-sm text-slate-600">
                This is the MATCH-002 wizard shell. Real allocation entry + validation is implemented after FLOW-001 is
                locked and the preview/apply/undo group APIs are available.
              </p>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <p className="font-semibold">Detected: {formatMatchType(effectiveType)}</p>
                <p className="mt-1">
                  Next: allocation editor UI for 1:M and M:1, with validation and server preview.
                </p>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-2">
              <p className="font-semibold text-slate-900">Preview (coming next)</p>
              <p className="text-sm text-slate-600">
                Preview will show computed deltas and validation issues (tolerance, conservation rules, rounding) before
                apply.
              </p>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-2">
              <p className="font-semibold text-slate-900">Apply (coming next)</p>
              <p className="text-sm text-slate-600">
                Apply will commit allocations as a single atomic action and return a match group ID to support grouped
                undo.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={props.onClose}
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setStep(prev => (prev <= 0 ? prev : ((prev - 1) as MatchWizardStep)))}
              disabled={step === 0}
            >
              Back
            </button>
            {step < 3 ? (
              <button
                type="button"
                className="rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                onClick={() => setStep(prev => (prev >= 3 ? prev : ((prev + 1) as MatchWizardStep)))}
                disabled={step === 0 ? !canGoNextFromSelection : effectiveType === "ManyToMany"}
                title={
                  step === 0 && !canGoNextFromSelection
                    ? "Adjust selection or match type"
                    : effectiveType === "ManyToMany"
                      ? "M:M deferred for MVP"
                      : undefined
                }
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!applyEnabled}
                title={!applyEnabled ? "Apply is enabled after preview/apply endpoints are implemented" : undefined}
              >
                Confirm (disabled)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

