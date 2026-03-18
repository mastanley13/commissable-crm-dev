"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ModalHeader } from "./ui/modal-header"
import { RevenueBulkApplyPanel } from "./revenue-bulk-apply-panel"
import { cn } from "@/lib/utils"
import type { DepositLineItemRow, SuggestedMatchScheduleRow } from "@/lib/mock-data"
import {
  buildInlineActualTargets,
  deriveAllocationDraftFromActualTarget,
  parseMatchWizardAmount,
  supportsInlineActualEditing,
  type MatchWizardAllocationDraft,
} from "@/lib/matching/match-wizard-inline-actuals"
import type { MatchSelectionType } from "@/lib/matching/match-selection"
import { isSelectionCompatibleWithType } from "@/lib/matching/match-selection"
import { deriveMatchWizardValidationState } from "@/lib/matching/match-wizard-validation"

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

type AllocationDraft = MatchWizardAllocationDraft

type PreviewIssue = { level: "error" | "warning"; code: string; message: string }
type VarianceResolutionAction = "Adjust" | "FlexProduct"
type PreviewVariancePrompt = {
  scheduleId: string
  scheduleNumber: string
  scheduleDate: string | null
  expectedUsageNet: number
  expectedCommissionNet: number
  actualUsageNetAfter: number
  actualCommissionNetAfter: number
  usageBalanceAfter: number
  commissionDifferenceAfter: number
  usageOverage: number
  commissionOverage: number
  usageToleranceAmount: number
  commissionToleranceAmount: number
  allowedPromptOptions: VarianceResolutionAction[]
  message: string
}
type PreviewResponse =
  | { ok: false; issues: PreviewIssue[] }
  | {
      ok: true
      tenantVarianceTolerance: number
      issues: PreviewIssue[]
      variancePrompts: PreviewVariancePrompt[]
      lines: Array<{
        lineId: string
        usage: number
        commission: number
        usageAllocatedBefore: number
        commissionAllocatedBefore: number
        usageAllocatedAfter: number
        commissionAllocatedAfter: number
        usageUnallocatedAfter: number
        commissionUnallocatedAfter: number
      }>
      schedules: Array<{
        scheduleId: string
        expectedUsageNet: number
        expectedCommissionNet: number
        actualUsageNetAfter: number
        actualCommissionNetAfter: number
        usageBalanceAfter: number
        commissionDifferenceAfter: number
        withinToleranceAfter: boolean
      }>
    }

type PreviewLineRow = Extract<PreviewResponse, { ok: true }>["lines"][number]
type PreviewScheduleRow = Extract<PreviewResponse, { ok: true }>["schedules"][number]
type InlineBulkPromptMode = "scheduleActual" | "lineAllocation"
type InlineBulkPromptState = {
  mode: InlineBulkPromptMode
  field: keyof AllocationDraft
  rawValue: string
  fieldLabel: string
  valueLabel: string
  previousValueLabel?: string
  selectedCount: number
  entityLabelSingular: string
  entityLabelPlural: string
}
type VarianceResolutionModalState = {
  scheduleId: string
  selectedAction: VarianceResolutionAction | null
  submitting: boolean
  error: string | null
}

const AUTO_VALIDATION_DEBOUNCE_MS = 300

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

function formatPercent(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "0.00%"
  const numeric = Number(value)
  const normalized = Math.abs(numeric) <= 1.5 ? numeric * 100 : numeric
  return `${percentFormatter.format(normalized)}%`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  return value.slice(0, 10)
}

function formatCount(value: number | null | undefined, fractionDigits = 2) {
  if (!Number.isFinite(Number(value))) return "0.00"
  return Number(value).toFixed(fractionDigits)
}

function roundAmount(value: number) {
  return Math.round(value * 100) / 100
}

function MatchWizardSelectionTable(props: {
  title: string
  emptyLabel: string
  headers: string[]
  rows: ReactNode[][]
}) {
  return (
    <section>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">{props.title}</p>
      <div className="overflow-hidden border-2 border-gray-400 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-blue-500 text-white">
              <tr>
                {props.headers.map(header => (
                  <th key={header} className="whitespace-nowrap px-4 py-1.5 font-semibold text-[11px] uppercase tracking-wide select-none border-b-2 border-blue-700 border-r-2 border-blue-700 last:border-r-0">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.rows.length > 0 ? (
                props.rows.map((row, rowIndex) => (
                  <tr
                    key={`${props.title}-${rowIndex}`}
                    className="border-b border-slate-200 bg-white text-slate-700 last:border-b-0"
                  >
                    {row.map((value, cellIndex) => (
                      <td key={`${props.title}-${rowIndex}-${cellIndex}`} className="whitespace-nowrap px-4 py-2">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr className="bg-white text-slate-700">
                  <td className="px-4 py-3 text-slate-500" colSpan={props.headers.length}>
                    {props.emptyLabel}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function MatchWizardVarianceResolutionModal(props: {
  open: boolean
  prompt: PreviewVariancePrompt | null
  schedule: SuggestedMatchScheduleRow | null
  state: VarianceResolutionModalState | null
  onClose: () => void
  onSelectAction: (action: VarianceResolutionAction) => void
  onSubmit: () => void
}) {
  if (!props.open || !props.prompt || !props.state) return null

  const selectedAction = props.state.selectedAction
  const scheduleLabel = props.schedule?.revenueScheduleName?.trim() || props.prompt.scheduleNumber
  const usageBalanceAfter = props.prompt.usageBalanceAfter
  const commissionDifferenceAfter = props.prompt.commissionDifferenceAfter
  const usageBalanceTone = usageBalanceAfter < 0 ? "text-red-700" : "text-slate-700"
  const commissionDiffTone = commissionDifferenceAfter < 0 ? "text-red-700" : "text-slate-700"

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-6" onClick={props.onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-wizard-variance-resolution-title"
        className="w-full max-w-4xl overflow-hidden rounded-2xl bg-slate-100 shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="border-b border-blue-700 bg-gradient-to-r from-blue-950 via-blue-800 to-blue-700 px-6 py-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-100/90">Variance Resolution</p>
          <h2 id="match-wizard-variance-resolution-title" className="mt-1 text-2xl font-semibold">
            Resolve out-of-tolerance overage
          </h2>
          <p className="mt-1 text-sm text-blue-100/90">
            {scheduleLabel} exceeds tolerance and must be resolved before this match can be applied.
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">Usage Overage</p>
              <p className="mt-1 text-xl font-semibold text-amber-950">{currencyFormatter.format(props.prompt.usageOverage)}</p>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-800">Usage Tolerance</p>
              <p className="mt-1 text-xl font-semibold text-sky-950">
                {currencyFormatter.format(props.prompt.usageToleranceAmount)}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">Comm Overage</p>
              <p className="mt-1 text-xl font-semibold text-amber-950">
                {currencyFormatter.format(props.prompt.commissionOverage)}
              </p>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-800">Comm Tolerance</p>
              <p className="mt-1 text-xl font-semibold text-sky-950">
                {currencyFormatter.format(props.prompt.commissionToleranceAmount)}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Expected Usage</th>
                  <th className="px-4 py-3">Projected Usage</th>
                  <th className="px-4 py-3">Usage Balance</th>
                  <th className="px-4 py-3">Projected Comm</th>
                  <th className="px-4 py-3">Comm Diff.</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200 text-slate-800">
                  <td className="px-4 py-3 font-semibold">{scheduleLabel}</td>
                  <td className="px-4 py-3">{formatDate(props.prompt.scheduleDate)}</td>
                  <td className="px-4 py-3">{currencyFormatter.format(props.prompt.expectedUsageNet)}</td>
                  <td className="px-4 py-3">{currencyFormatter.format(props.prompt.actualUsageNetAfter)}</td>
                  <td className={`px-4 py-3 font-semibold ${usageBalanceTone}`}>
                    {currencyFormatter.format(props.prompt.usageBalanceAfter)}
                  </td>
                  <td className="px-4 py-3">{currencyFormatter.format(props.prompt.actualCommissionNetAfter)}</td>
                  <td className={`px-4 py-3 font-semibold ${commissionDiffTone}`}>
                    {currencyFormatter.format(props.prompt.commissionDifferenceAfter)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => props.onSelectAction("Adjust")}
              className={cn(
                "rounded-xl border px-4 py-4 text-left shadow-sm transition",
                selectedAction === "Adjust"
                  ? "border-[#2f6fe4] bg-[#eef5ff]"
                  : "border-slate-300 bg-white hover:border-[#2f6fe4]",
              )}
            >
              <p className="text-lg font-semibold text-slate-900">Adjust</p>
              <p className="mt-2 text-sm text-slate-600">
                Create an adjustment schedule for the overage and keep the base schedule aligned to expected totals.
              </p>
            </button>
            <button
              type="button"
              onClick={() => props.onSelectAction("FlexProduct")}
              disabled={!props.prompt.allowedPromptOptions.includes("FlexProduct")}
              className={cn(
                "rounded-xl border px-4 py-4 text-left shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60",
                selectedAction === "FlexProduct"
                  ? "border-[#2f6fe4] bg-[#eef5ff]"
                  : "border-slate-300 bg-white hover:border-[#2f6fe4]",
              )}
            >
              <p className="text-lg font-semibold text-slate-900">Flex Product</p>
              <p className="mt-2 text-sm text-slate-600">
                Route the overage to a dedicated flex product schedule instead of absorbing it into the base schedule.
              </p>
            </button>
          </div>

          {props.state.error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{props.state.error}</div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={props.onClose}
            disabled={props.state.submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            onClick={props.onSubmit}
            disabled={!selectedAction || props.state.submitting}
          >
            {props.state.submitting ? "Saving..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  )
}

function InlineEditableCurrencyCell(props: {
  value: number
  ariaLabel: string
  changed: boolean
  oldValue?: string
  onCommit: (value: number) => void
}) {
  const { ariaLabel, changed, oldValue, onCommit, value } = props
  const spanRef = useRef<HTMLSpanElement | null>(null)
  const formattedValue = currencyFormatter.format(value)

  useEffect(() => {
    if (!spanRef.current) return
    if (document.activeElement === spanRef.current) return
    spanRef.current.innerText = formattedValue
  }, [formattedValue])

  const commit = useCallback(() => {
    if (!spanRef.current) return

    const rawText = spanRef.current.innerText.trim()
    if (!rawText) {
      spanRef.current.innerText = formattedValue
      return
    }

    const sanitised = rawText.replace(/[^0-9.\-]/g, "")
    const parsed = sanitised === "" ? Number.NaN : Number(sanitised)
    if (Number.isNaN(parsed)) {
      spanRef.current.innerText = formattedValue
      return
    }

    const normalized = Math.max(0, roundAmount(parsed))
    spanRef.current.innerText = currencyFormatter.format(normalized)
    onCommit(normalized)
  }, [formattedValue, onCommit])

  if (changed && oldValue) {
    return (
      <span className="recon-preview-cell">
        <span className="recon-preview-old">{oldValue}</span>
        <span
          ref={spanRef}
          contentEditable
          suppressContentEditableWarning
          data-disable-row-click="true"
          className="recon-preview-new min-w-0 truncate rounded focus:outline-none focus:ring-1 focus:ring-amber-400"
          onFocus={event => {
            const selection = window.getSelection()
            if (!selection) return
            const range = document.createRange()
            range.selectNodeContents(event.currentTarget)
            selection.removeAllRanges()
            selection.addRange(range)
          }}
          onBlur={commit}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault()
              commit()
            }
          }}
          aria-label={ariaLabel}
        >
          {formattedValue}
        </span>
      </span>
    )
  }

  return (
    <span
      ref={spanRef}
      contentEditable
      suppressContentEditableWarning
      data-disable-row-click="true"
      className={cn(
        "block min-w-0 truncate rounded px-2 py-1 text-sm focus:outline-none",
        changed
          ? "bg-amber-50 font-semibold text-emerald-900 shadow-[inset_0_0_0_1px_rgb(252_191_36)]"
          : "text-gray-900",
      )}
      onFocus={event => {
        const selection = window.getSelection()
        if (!selection) return
        const range = document.createRange()
        range.selectNodeContents(event.currentTarget)
        selection.removeAllRanges()
        selection.addRange(range)
      }}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === "Enter") {
          event.preventDefault()
          commit()
        }
      }}
      aria-label={ariaLabel}
    >
      {formattedValue}
    </span>
  )
}

function renderHighlightedPreviewValue(value: string, changed: boolean, oldValue?: string) {
  if (!changed) return value
  if (oldValue) {
    return (
      <span className="recon-preview-cell">
        <span className="recon-preview-old">{oldValue}</span>
        <span className="recon-preview-new">{value}</span>
      </span>
    )
  }
  return <span className="recon-preview-chip">{value}</span>
}

function allocationKey(lineId: string, scheduleId: string) {
  return `${lineId}:${scheduleId}`
}

function buildDefaultAllocations(params: {
  matchType: MatchSelectionType
  lines: DepositLineItemRow[]
  schedules: SuggestedMatchScheduleRow[]
}): Record<string, AllocationDraft> {
  if (params.matchType === "OneToOne") {
    const line = params.lines[0]
    const scheduleId = params.schedules[0]?.id
    if (!line || !scheduleId) return {}

    const usage = Math.max(0, Number(line.usageUnallocated ?? 0))
    const commission = Math.max(0, Number(line.commissionUnallocated ?? 0))
    return {
      [allocationKey(line.id, scheduleId)]: {
        usage: usage ? usage.toFixed(2) : "",
        commission: commission ? commission.toFixed(2) : "",
      },
    }
  }

  if (params.matchType === "OneToMany") {
    const line = params.lines[0]
    if (!line) return {}

    const totalUsage = Math.max(0, Number(line.usageUnallocated ?? 0))
    const totalCommission = Math.max(0, Number(line.commissionUnallocated ?? 0))

    const weights = params.schedules.map(schedule => ({
      scheduleId: schedule.id,
      weight:
        Math.max(0, Math.abs(Number(schedule.expectedUsageNet ?? 0))) +
        Math.max(0, Math.abs(Number(schedule.expectedCommissionNet ?? 0))),
    }))
    const weightSum = weights.reduce((acc, row) => acc + row.weight, 0)
    const denom = weightSum > 0.0001 ? weightSum : weights.length || 1

    let usageRemaining = totalUsage
    let commissionRemaining = totalCommission
    const out: Record<string, AllocationDraft> = {}

    weights.forEach((row, index) => {
      const isLast = index === weights.length - 1
      const fraction = weightSum > 0.0001 ? row.weight / denom : 1 / denom
      const usage = isLast ? usageRemaining : Math.round(totalUsage * fraction * 100) / 100
      const commission = isLast ? commissionRemaining : Math.round(totalCommission * fraction * 100) / 100
      usageRemaining = Math.round((usageRemaining - usage) * 100) / 100
      commissionRemaining = Math.round((commissionRemaining - commission) * 100) / 100

      out[allocationKey(line.id, row.scheduleId)] = {
        usage: usage ? usage.toFixed(2) : "",
        commission: commission ? commission.toFixed(2) : "",
      }
    })

    return out
  }

  if (params.matchType === "ManyToOne") {
    const scheduleId = params.schedules[0]?.id
    if (!scheduleId) return {}
    const out: Record<string, AllocationDraft> = {}
    for (const line of params.lines) {
      const usage = Math.max(0, Number(line.usageUnallocated ?? 0))
      const commission = Math.max(0, Number(line.commissionUnallocated ?? 0))
      out[allocationKey(line.id, scheduleId)] = {
        usage: usage ? usage.toFixed(2) : "",
        commission: commission ? commission.toFixed(2) : "",
      }
    }
    return out
  }

  if (params.matchType === "ManyToMany") {
    const schedulesSorted = [...params.schedules].sort((a, b) => {
      const dateA = a.revenueScheduleDate ? new Date(a.revenueScheduleDate).getTime() : Number.POSITIVE_INFINITY
      const dateB = b.revenueScheduleDate ? new Date(b.revenueScheduleDate).getTime() : Number.POSITIVE_INFINITY
      if (dateA !== dateB) return dateA - dateB
      return (a.revenueScheduleName ?? "").localeCompare(b.revenueScheduleName ?? "")
    })
    const linesSorted = [...params.lines].sort((a, b) => (a.lineItem ?? 0) - (b.lineItem ?? 0))

    const usageRemainingBySchedule = new Map<string, number>()
    const commissionRemainingBySchedule = new Map<string, number>()

    for (const schedule of schedulesSorted) {
      usageRemainingBySchedule.set(schedule.id, Math.max(0, Number(schedule.expectedUsageNet ?? 0)))
      commissionRemainingBySchedule.set(schedule.id, Math.max(0, Number(schedule.expectedCommissionNet ?? 0)))
    }

    const out: Record<string, AllocationDraft> = {}
    for (const line of linesSorted) {
      let usageRemaining = Math.max(0, Number(line.usageUnallocated ?? 0))
      let commissionRemaining = Math.max(0, Number(line.commissionUnallocated ?? 0))

      for (const schedule of schedulesSorted) {
        if (usageRemaining <= 0.005 && commissionRemaining <= 0.005) break

        const scheduleUsageRemaining = usageRemainingBySchedule.get(schedule.id) ?? 0
        const scheduleCommissionRemaining = commissionRemainingBySchedule.get(schedule.id) ?? 0

        const usageAmount = Math.round(Math.min(usageRemaining, scheduleUsageRemaining) * 100) / 100
        const commissionAmount = Math.round(Math.min(commissionRemaining, scheduleCommissionRemaining) * 100) / 100

        if (usageAmount <= 0.005 && commissionAmount <= 0.005) continue

        out[allocationKey(line.id, schedule.id)] = {
          usage: usageAmount ? usageAmount.toFixed(2) : "",
          commission: commissionAmount ? commissionAmount.toFixed(2) : "",
        }

        usageRemaining = Math.round((usageRemaining - usageAmount) * 100) / 100
        commissionRemaining = Math.round((commissionRemaining - commissionAmount) * 100) / 100

        usageRemainingBySchedule.set(schedule.id, Math.round((scheduleUsageRemaining - usageAmount) * 100) / 100)
        commissionRemainingBySchedule.set(
          schedule.id,
          Math.round((scheduleCommissionRemaining - commissionAmount) * 100) / 100,
        )
      }
    }

    if (Object.keys(out).length === 0) {
      const line = linesSorted[0]
      const schedule = schedulesSorted[0]
      if (!line || !schedule) return {}
      const usage = Math.max(0, Number(line.usageUnallocated ?? 0))
      const commission = Math.max(0, Number(line.commissionUnallocated ?? 0))
      return {
        [allocationKey(line.id, schedule.id)]: {
          usage: usage ? usage.toFixed(2) : "",
          commission: commission ? commission.toFixed(2) : "",
        },
      }
    }

    return out
  }

  return {}
}

export function ReconciliationMatchWizardModal(props: {
  open: boolean
  onClose: () => void
  depositId: string
  selectedLines: DepositLineItemRow[]
  selectedSchedules: SuggestedMatchScheduleRow[]
  detectedType: MatchSelectionType
  onApplied?: () => void
}) {
  const [overrideType, setOverrideType] = useState<MatchSelectionType | null>(null)
  const [allocations, setAllocations] = useState<Record<string, AllocationDraft>>({})
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [allocationsVersion, setAllocationsVersion] = useState(0)
  const [previewVersion, setPreviewVersion] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [applyLoading, setApplyLoading] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [varianceResolutionSelections, setVarianceResolutionSelections] = useState<Record<string, VarianceResolutionAction>>({})
  const [varianceResolutionModal, setVarianceResolutionModal] = useState<VarianceResolutionModalState | null>(null)
  const [appliedMatchGroupId, setAppliedMatchGroupId] = useState<string | null>(null)
  const [undoReason, setUndoReason] = useState("")
  const [undoLoading, setUndoLoading] = useState(false)
  const [undoError, setUndoError] = useState<string | null>(null)

  const [wizardSchedules, setWizardSchedules] = useState<SuggestedMatchScheduleRow[]>(props.selectedSchedules)
  const [manyToOneMode, setManyToOneMode] = useState<"allocation" | "bundle">("allocation")
  const [bundleApplyMode, setBundleApplyMode] = useState<"keep_old" | "soft_delete_old">("keep_old")
  const [bundleApplyReason, setBundleApplyReason] = useState("")
  const [bundleAuditLogId, setBundleAuditLogId] = useState<string | null>(null)
  const [bundleLoading, setBundleLoading] = useState(false)
  const [bundleError, setBundleError] = useState<string | null>(null)
  const [bundleUndoReason, setBundleUndoReason] = useState("")
  const [bundleUndoLoading, setBundleUndoLoading] = useState(false)
  const [bundleUndoError, setBundleUndoError] = useState<string | null>(null)
  const [inlineBulkPrompt, setInlineBulkPrompt] = useState<InlineBulkPromptState | null>(null)
  const [inlineBulkApplying, setInlineBulkApplying] = useState(false)

  const skipAllocationResetRef = useRef(false)
  const autoPreviewRequestKeyRef = useRef<string | null>(null)
  const autoValidationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingInlineBulkPromptRef = useRef<{
    mode: InlineBulkPromptMode
    rowId: string
    field: keyof AllocationDraft
    rawValue: string
  } | null>(null)
  const [allocationExpanded, setAllocationExpanded] = useState(false)

  const isOpen = props.open
  const onClose = props.onClose
  const depositId = props.depositId
  const detectedType = props.detectedType
  const initialSelectedSchedules = props.selectedSchedules
  const onApplied = props.onApplied

  const selectedLines = props.selectedLines
  const selectedSchedules = wizardSchedules

  const lineCount = selectedLines.length
  const scheduleCount = selectedSchedules.length
  const effectiveType = overrideType ?? detectedType

  useEffect(() => {
    if (!isOpen) return
    setOverrideType(null)
    setPreview(null)
    setPreviewVersion(null)
    setAllocationsVersion(0)
    setAllocationExpanded(detectedType === "ManyToOne")
    setPreviewLoading(false)
    setPreviewError(null)
    setApplyLoading(false)
    setApplyError(null)
    setVarianceResolutionSelections({})
    setVarianceResolutionModal(null)
    setAppliedMatchGroupId(null)
    setUndoReason("")
    setUndoLoading(false)
    setUndoError(null)
    setWizardSchedules(initialSelectedSchedules)
    setManyToOneMode("allocation")
    setBundleApplyMode("keep_old")
    setBundleApplyReason("")
    setBundleAuditLogId(null)
    setBundleLoading(false)
    setBundleError(null)
    setBundleUndoReason("")
    setBundleUndoLoading(false)
    setBundleUndoError(null)
    setInlineBulkPrompt(null)
    setInlineBulkApplying(false)
    skipAllocationResetRef.current = false
    autoPreviewRequestKeyRef.current = null
    pendingInlineBulkPromptRef.current = null
    if (autoValidationTimeoutRef.current) {
      clearTimeout(autoValidationTimeoutRef.current)
      autoValidationTimeoutRef.current = null
    }
    setAllocations(
      buildDefaultAllocations({
        matchType: detectedType,
        lines: selectedLines,
        schedules: initialSelectedSchedules,
      }),
    )
  }, [detectedType, initialSelectedSchedules, isOpen, selectedLines])

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      onClose()
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    setPreview(null)
    setPreviewVersion(null)
    setPreviewError(null)
    setAppliedMatchGroupId(null)
    setApplyError(null)
    setUndoError(null)
    setUndoReason("")

    if (skipAllocationResetRef.current) {
      skipAllocationResetRef.current = false
      return
    }

    setAllocations(
      buildDefaultAllocations({
        matchType: effectiveType,
        lines: selectedLines,
        schedules: selectedSchedules,
      }),
    )
  }, [effectiveType, isOpen, selectedLines, selectedSchedules])

  const lineIdsKey = useMemo(() => selectedLines.map(line => line.id).join(","), [selectedLines])
  const scheduleIdsKey = useMemo(() => selectedSchedules.map(schedule => schedule.id).join(","), [selectedSchedules])
  const previewInputsKey = `${effectiveType}|${manyToOneMode}|${lineIdsKey}|${scheduleIdsKey}`

  useEffect(() => {
    if (!isOpen) return
    setAllocationsVersion(prev => prev + 1)
    setPreviewVersion(null)
  }, [allocations, isOpen, previewInputsKey])

  const selectionCompatible = useMemo(
    () => isSelectionCompatibleWithType({ type: effectiveType, lineCount, scheduleCount }),
    [effectiveType, lineCount, scheduleCount],
  )

  const previewUpToDate = Boolean(preview && previewVersion !== null && previewVersion === allocationsVersion)

  const selectionTotals = useMemo(() => {
    const lineUsageTotal = selectedLines.reduce((sum, row) => sum + (Number(row.usage) || 0), 0)
    const lineCommissionTotal = selectedLines.reduce((sum, row) => sum + (Number(row.commission) || 0), 0)
    const scheduleExpectedUsage = selectedSchedules.reduce(
      (sum, row) => sum + (Number(row.expectedUsageNet) || 0),
      0,
    )
    const scheduleExpectedCommission = selectedSchedules.reduce(
      (sum, row) => sum + (Number(row.expectedCommissionNet) || 0),
      0,
    )
    return {
      lineUsageTotal,
      lineCommissionTotal,
      scheduleExpectedUsage,
      scheduleExpectedCommission,
    }
  }, [selectedLines, selectedSchedules])

  const selectionVarianceSummary = useMemo(() => {
    const usageBase = Math.max(Math.abs(selectionTotals.lineUsageTotal), Math.abs(selectionTotals.scheduleExpectedUsage))
    const commissionBase = Math.max(
      Math.abs(selectionTotals.lineCommissionTotal),
      Math.abs(selectionTotals.scheduleExpectedCommission),
    )
    const usageSpread =
      usageBase > 0.005 ? Math.abs(selectionTotals.lineUsageTotal - selectionTotals.scheduleExpectedUsage) / usageBase : 0
    const commissionSpread =
      commissionBase > 0.005
        ? Math.abs(selectionTotals.lineCommissionTotal - selectionTotals.scheduleExpectedCommission) / commissionBase
        : 0
    const needsAttention = usageSpread >= 0.5 || commissionSpread >= 0.5

    if (!needsAttention) return null

    return {
      usageSpread,
      commissionSpread,
    }
  }, [selectionTotals])

  const previewLineMap = useMemo(() => {
    const map = new Map<string, PreviewLineRow>()
    if (!previewUpToDate || !preview || !preview.ok) return map
    for (const row of preview.lines) {
      map.set(row.lineId, row)
    }
    return map
  }, [preview, previewUpToDate])

  const previewScheduleMap = useMemo(() => {
    const map = new Map<string, PreviewScheduleRow>()
    if (!previewUpToDate || !preview || !preview.ok) return map
    for (const row of preview.schedules) {
      map.set(row.scheduleId, row)
    }
    return map
  }, [preview, previewUpToDate])

  const variancePrompts = useMemo(() => {
    if (!previewUpToDate || !preview || !preview.ok) return [] as PreviewVariancePrompt[]
    return preview.variancePrompts ?? []
  }, [preview, previewUpToDate])

  const variancePromptMap = useMemo(() => {
    const map = new Map<string, PreviewVariancePrompt>()
    for (const prompt of variancePrompts) {
      map.set(prompt.scheduleId, prompt)
    }
    return map
  }, [variancePrompts])

  const unresolvedVariancePrompts = useMemo(
    () => variancePrompts.filter(prompt => !varianceResolutionSelections[prompt.scheduleId]),
    [variancePrompts, varianceResolutionSelections],
  )

  useEffect(() => {
    const validScheduleIds = new Set(variancePrompts.map(prompt => prompt.scheduleId))
    setVarianceResolutionSelections(previous => {
      const nextEntries = Object.entries(previous).filter(([scheduleId]) => validScheduleIds.has(scheduleId))
      const isUnchanged =
        nextEntries.length === Object.keys(previous).length &&
        nextEntries.every(([scheduleId, action]) => previous[scheduleId] === action)
      if (isUnchanged) {
        return previous
      }
      return Object.fromEntries(nextEntries) as Record<string, VarianceResolutionAction>
    })

    setVarianceResolutionModal(previous => {
      if (!previous) return previous
      return validScheduleIds.has(previous.scheduleId) ? previous : null
    })
  }, [variancePrompts])

  const replacementRequiredIssue = useMemo(() => {
    const issues = preview?.issues ?? []
    return issues.find(issue => issue.code === "many_to_one_mixed_rate_requires_replacement") ?? null
  }, [preview])

  const replacementBlockedIssue = useMemo(() => {
    const issues = preview?.issues ?? []
    return issues.find(issue => issue.code === "many_to_one_rate_unknown") ?? null
  }, [preview])

  const replacementRequired = Boolean(
    effectiveType === "ManyToOne" && replacementRequiredIssue && !bundleAuditLogId,
  )

  const inlineScheduleActualEditingEnabled = supportsInlineActualEditing(effectiveType)
  const inlineLineAllocationEditingEnabled =
    effectiveType === "ManyToOne" && manyToOneMode === "allocation" && !bundleAuditLogId && !replacementRequired

  const inlineActualTargets = useMemo(
    () =>
      buildInlineActualTargets({
        matchType: effectiveType,
        selectedLines,
        selectedSchedules,
        allocations,
      }),
    [allocations, effectiveType, selectedLines, selectedSchedules],
  )

  const inlineLineAllocationTargets = useMemo(() => {
    const targets = new Map<string, { usage: number; commission: number }>()
    if (effectiveType !== "ManyToOne") return targets

    const scheduleId = selectedSchedules[0]?.id
    if (!scheduleId) return targets

    for (const line of selectedLines) {
      const draft = allocations[allocationKey(line.id, scheduleId)]
      const usageDelta = parseMatchWizardAmount(draft?.usage ?? "") ?? 0
      const commissionDelta = parseMatchWizardAmount(draft?.commission ?? "") ?? 0

      targets.set(line.id, {
        usage: roundAmount(Math.max(0, Number(line.usageAllocated ?? 0) + usageDelta)),
        commission: roundAmount(Math.max(0, Number(line.commissionAllocated ?? 0) + commissionDelta)),
      })
    }

    return targets
  }, [allocations, effectiveType, selectedLines, selectedSchedules])

  const handleAllocationDraftChange = useCallback(
    (rowKey: string, field: keyof AllocationDraft, value: string) => {
      setAllocations(prev => ({
        ...prev,
        [rowKey]: { ...(prev[rowKey] ?? { usage: "", commission: "" }), [field]: value },
      }))
    },
    [],
  )

  const handleInlineActualEdit = useCallback(
    (schedule: SuggestedMatchScheduleRow, field: keyof AllocationDraft, rawValue: string) => {
      if (!supportsInlineActualEditing(effectiveType)) return

      const lineId = selectedLines[0]?.id
      if (!lineId) return

      const rowKey = allocationKey(lineId, schedule.id)
      const currentActual = field === "usage" ? Number(schedule.actualUsage ?? 0) : Number(schedule.actualCommission ?? 0)
      const nextAllocationValue = deriveAllocationDraftFromActualTarget({
        currentActual,
        rawTarget: rawValue,
      })

      handleAllocationDraftChange(rowKey, field, nextAllocationValue)
      pendingInlineBulkPromptRef.current =
        selectedSchedules.length > 1
          ? { mode: "scheduleActual", rowId: schedule.id, field, rawValue }
          : null
    },
    [effectiveType, handleAllocationDraftChange, selectedLines, selectedSchedules.length],
  )

  const handleInlineLineAllocationEdit = useCallback(
    (line: DepositLineItemRow, field: keyof AllocationDraft, rawValue: string) => {
      if (effectiveType !== "ManyToOne") return

      const scheduleId = selectedSchedules[0]?.id
      if (!scheduleId) return

      const rowKey = allocationKey(line.id, scheduleId)
      const currentAllocated =
        field === "usage" ? Number(line.usageAllocated ?? 0) : Number(line.commissionAllocated ?? 0)
      const nextAllocationValue = deriveAllocationDraftFromActualTarget({
        currentActual: currentAllocated,
        rawTarget: rawValue,
      })

      handleAllocationDraftChange(rowKey, field, nextAllocationValue)
      pendingInlineBulkPromptRef.current =
        selectedLines.length > 1
          ? { mode: "lineAllocation", rowId: line.id, field, rawValue }
          : null
    },
    [effectiveType, handleAllocationDraftChange, selectedLines.length, selectedSchedules],
  )

  const maybeOpenScheduleInlineBulkPrompt = useCallback(
    (schedule: SuggestedMatchScheduleRow, field: keyof AllocationDraft, rawValue: string) => {
      const pending = pendingInlineBulkPromptRef.current
      pendingInlineBulkPromptRef.current = null

      if (
        !pending ||
        pending.mode !== "scheduleActual" ||
        pending.rowId !== schedule.id ||
        pending.field !== field ||
        selectedSchedules.length <= 1
      ) {
        return
      }

      const targetValue = parseMatchWizardAmount(rawValue)
      if (targetValue === null) return

      const previousValue = field === "usage" ? Number(schedule.actualUsage ?? 0) : Number(schedule.actualCommission ?? 0)
      setInlineBulkPrompt({
        mode: "scheduleActual",
        field,
        rawValue,
        fieldLabel: field === "usage" ? "Actual Usage" : "Actual Commission",
        valueLabel: currencyFormatter.format(targetValue),
        previousValueLabel: currencyFormatter.format(previousValue),
        selectedCount: selectedSchedules.length,
        entityLabelSingular: "revenue schedule",
        entityLabelPlural: "revenue schedules",
      })
    },
    [selectedSchedules.length],
  )

  const maybeOpenLineInlineBulkPrompt = useCallback(
    (line: DepositLineItemRow, field: keyof AllocationDraft, rawValue: string) => {
      const pending = pendingInlineBulkPromptRef.current
      pendingInlineBulkPromptRef.current = null

      if (
        !pending ||
        pending.mode !== "lineAllocation" ||
        pending.rowId !== line.id ||
        pending.field !== field ||
        selectedLines.length <= 1
      ) {
        return
      }

      const targetValue = parseMatchWizardAmount(rawValue)
      if (targetValue === null) return

      const previousValue =
        field === "usage" ? Number(line.usageAllocated ?? 0) : Number(line.commissionAllocated ?? 0)
      setInlineBulkPrompt({
        mode: "lineAllocation",
        field,
        rawValue,
        fieldLabel: field === "usage" ? "Allocated" : "Comm Alloc",
        valueLabel: currencyFormatter.format(targetValue),
        previousValueLabel: currencyFormatter.format(previousValue),
        selectedCount: selectedLines.length,
        entityLabelSingular: "deposit line",
        entityLabelPlural: "deposit lines",
      })
    },
    [selectedLines.length],
  )

  const renderEditableActualCell = useCallback(
    (params: {
      schedule: SuggestedMatchScheduleRow
      field: keyof AllocationDraft
      value: number
      ariaLabel: string
    }) => {
      const { ariaLabel, field, schedule, value } = params
      const currentActual = field === "usage" ? Number(schedule.actualUsage ?? 0) : Number(schedule.actualCommission ?? 0)
      return (
        <InlineEditableCurrencyCell
          value={value}
          ariaLabel={ariaLabel}
          changed={Math.abs(value - currentActual) > 0.005}
          oldValue={currencyFormatter.format(currentActual)}
          onCommit={nextValue => {
            const rawValue = nextValue.toFixed(2)
            handleInlineActualEdit(schedule, field, rawValue)
            maybeOpenScheduleInlineBulkPrompt(schedule, field, rawValue)
          }}
        />
      )
    },
    [handleInlineActualEdit, maybeOpenScheduleInlineBulkPrompt],
  )

  const renderEditableLineAllocationCell = useCallback(
    (params: {
      line: DepositLineItemRow
      field: keyof AllocationDraft
      value: number
      ariaLabel: string
    }) => {
      const { ariaLabel, field, line, value } = params
      const currentAllocated = field === "usage" ? Number(line.usageAllocated ?? 0) : Number(line.commissionAllocated ?? 0)
      return (
        <InlineEditableCurrencyCell
          value={value}
          ariaLabel={ariaLabel}
          changed={Math.abs(value - currentAllocated) > 0.005}
          oldValue={currencyFormatter.format(currentAllocated)}
          onCommit={nextValue => {
            const rawValue = nextValue.toFixed(2)
            handleInlineLineAllocationEdit(line, field, rawValue)
            maybeOpenLineInlineBulkPrompt(line, field, rawValue)
          }}
        />
      )
    },
    [handleInlineLineAllocationEdit, maybeOpenLineInlineBulkPrompt],
  )

  const selectedLineRows = useMemo<ReactNode[][]>(
    () =>
      selectedLines.map(line => {
        const previewLine = previewLineMap.get(line.id)
        const inlineAllocationTargetsForLine = inlineLineAllocationTargets.get(line.id)
        const baseUsageAllocated = Number(line.usageAllocated ?? 0)
        const baseUsageUnallocated = Number(line.usageUnallocated ?? 0)
        const baseCommissionAllocated = Number(line.commissionAllocated ?? 0)
        const usageAllocatedAfter =
          inlineAllocationTargetsForLine?.usage ?? previewLine?.usageAllocatedAfter ?? baseUsageAllocated
        const usageAllocatedDelta = usageAllocatedAfter - baseUsageAllocated
        const usageUnallocatedAfter =
          previewLine?.usageUnallocatedAfter ?? roundAmount(baseUsageUnallocated - usageAllocatedDelta)
        const commissionAllocatedAfter =
          inlineAllocationTargetsForLine?.commission ?? previewLine?.commissionAllocatedAfter ?? baseCommissionAllocated
        return [
          line.accountId || "-",
          line.accountName || "-",
          line.productName || "-",
          line.lineItem ?? "-",
          currencyFormatter.format(Number(line.usage ?? 0)),
          inlineLineAllocationEditingEnabled
            ? renderEditableLineAllocationCell({
                line,
                field: "usage",
                value: usageAllocatedAfter,
                ariaLabel: `Allocated usage for ${line.accountName || line.accountId || line.id}`,
              })
            : renderHighlightedPreviewValue(
                currencyFormatter.format(usageAllocatedAfter),
                Math.abs(usageAllocatedAfter - baseUsageAllocated) > 0.005,
                currencyFormatter.format(baseUsageAllocated),
              ),
          renderHighlightedPreviewValue(
            currencyFormatter.format(usageUnallocatedAfter),
            Math.abs(usageUnallocatedAfter - baseUsageUnallocated) > 0.005,
            currencyFormatter.format(baseUsageUnallocated),
          ),
          formatPercent(line.commissionRate),
          currencyFormatter.format(Number(line.commission ?? 0)),
          inlineLineAllocationEditingEnabled
            ? renderEditableLineAllocationCell({
                line,
                field: "commission",
                value: commissionAllocatedAfter,
                ariaLabel: `Allocated commission for ${line.accountName || line.accountId || line.id}`,
              })
            : renderHighlightedPreviewValue(
                currencyFormatter.format(commissionAllocatedAfter),
                Math.abs(commissionAllocatedAfter - baseCommissionAllocated) > 0.005,
                currencyFormatter.format(baseCommissionAllocated),
              ),
        ]
      }),
    [inlineLineAllocationEditingEnabled, inlineLineAllocationTargets, previewLineMap, renderEditableLineAllocationCell, selectedLines],
  )

  const selectedScheduleRows = useMemo<ReactNode[][]>(
    () =>
      selectedSchedules.map(schedule => {
        const previewSchedule = previewScheduleMap.get(schedule.id)
        const inlineTargetsForSchedule = inlineActualTargets.get(schedule.id)
        const baseActualUsage = Number(schedule.actualUsage ?? 0)
        const baseActualCommission = Number(schedule.actualCommission ?? 0)
        const manyToOneUsageDraftTotal =
          effectiveType === "ManyToOne"
            ? selectedLines.reduce(
                (sum, line) =>
                  sum + (parseMatchWizardAmount(allocations[allocationKey(line.id, schedule.id)]?.usage ?? "") ?? 0),
                0,
              )
            : 0
        const manyToOneCommissionDraftTotal =
          effectiveType === "ManyToOne"
            ? selectedLines.reduce(
                (sum, line) =>
                  sum +
                  (parseMatchWizardAmount(allocations[allocationKey(line.id, schedule.id)]?.commission ?? "") ?? 0),
                0,
              )
            : 0
        const inlineScheduleUsageAfter =
          effectiveType === "ManyToOne"
            ? roundAmount(baseActualUsage + manyToOneUsageDraftTotal)
            : inlineTargetsForSchedule?.usage
        const inlineScheduleCommissionAfter =
          effectiveType === "ManyToOne"
            ? roundAmount(baseActualCommission + manyToOneCommissionDraftTotal)
            : inlineTargetsForSchedule?.commission
        const actualUsageAfter = inlineScheduleUsageAfter ?? previewSchedule?.actualUsageNetAfter ?? baseActualUsage
        const actualCommissionAfter =
          inlineScheduleCommissionAfter ?? previewSchedule?.actualCommissionNetAfter ?? baseActualCommission
        const usageDelta = actualUsageAfter - baseActualUsage
        const commissionDelta = actualCommissionAfter - baseActualCommission
        const usageBalanceAfter =
          previewSchedule?.usageBalanceAfter ?? roundAmount(Number(schedule.usageBalance ?? 0) - usageDelta)
        const commissionDifferenceAfter =
          previewSchedule?.commissionDifferenceAfter ??
          roundAmount(Number(schedule.commissionDifference ?? 0) - commissionDelta)
        const actualRateAfter =
          Math.abs(actualUsageAfter) <= 0.005 ? 0 : actualCommissionAfter / actualUsageAfter
        const actualUsageChanged = Math.abs(actualUsageAfter - baseActualUsage) > 0.005
        const actualCommissionChanged = Math.abs(actualCommissionAfter - baseActualCommission) > 0.005
        return [
          schedule.revenueScheduleName || schedule.id,
          formatDate(schedule.revenueScheduleDate),
          formatCount(schedule.quantity),
          currencyFormatter.format(Number(schedule.priceEach ?? 0)),
          currencyFormatter.format(Number(schedule.expectedUsageGross ?? 0)),
          currencyFormatter.format(Number(schedule.expectedUsageAdjustment ?? 0)),
          currencyFormatter.format(Number(schedule.expectedUsageNet ?? 0)),
          formatPercent(schedule.expectedCommissionRatePercent),
          currencyFormatter.format(Number(schedule.expectedCommissionNet ?? 0)),
          inlineScheduleActualEditingEnabled
            ? renderEditableActualCell({
                schedule,
                field: "usage",
                value: actualUsageAfter,
                ariaLabel: `Actual usage for ${schedule.revenueScheduleName || schedule.id}`,
              })
            : renderHighlightedPreviewValue(
                currencyFormatter.format(actualUsageAfter),
                actualUsageChanged,
                currencyFormatter.format(baseActualUsage),
              ),
          inlineScheduleActualEditingEnabled
            ? renderEditableActualCell({
                schedule,
                field: "commission",
                value: actualCommissionAfter,
                ariaLabel: `Actual commission for ${schedule.revenueScheduleName || schedule.id}`,
              })
            : renderHighlightedPreviewValue(
                currencyFormatter.format(actualCommissionAfter),
                actualCommissionChanged,
                currencyFormatter.format(baseActualCommission),
              ),
          renderHighlightedPreviewValue(
            formatPercent(actualRateAfter),
            Math.abs(actualRateAfter - Number(schedule.actualCommissionRatePercent ?? 0)) > 0.005,
            formatPercent(Number(schedule.actualCommissionRatePercent ?? 0)),
          ),
          renderHighlightedPreviewValue(
            currencyFormatter.format(usageBalanceAfter),
            Math.abs(usageBalanceAfter - Number(schedule.usageBalance ?? 0)) > 0.005,
            currencyFormatter.format(Number(schedule.usageBalance ?? 0)),
          ),
          renderHighlightedPreviewValue(
            currencyFormatter.format(commissionDifferenceAfter),
            Math.abs(commissionDifferenceAfter - Number(schedule.commissionDifference ?? 0)) > 0.005,
            currencyFormatter.format(Number(schedule.commissionDifference ?? 0)),
          ),
        ]
      }),
    [allocations, effectiveType, inlineActualTargets, inlineScheduleActualEditingEnabled, previewScheduleMap, renderEditableActualCell, selectedLines, selectedSchedules],
  )

  const activeVariancePrompt = useMemo(
    () => (varianceResolutionModal ? variancePromptMap.get(varianceResolutionModal.scheduleId) ?? null : null),
    [variancePromptMap, varianceResolutionModal],
  )

  const activeVarianceSchedule = useMemo(
    () =>
      varianceResolutionModal
        ? selectedSchedules.find(schedule => schedule.id === varianceResolutionModal.scheduleId) ?? null
        : null,
    [selectedSchedules, varianceResolutionModal],
  )

  const showInlineManyToOneHelper =
    effectiveType === "ManyToOne" && manyToOneMode === "allocation" && !bundleAuditLogId && !replacementRequired
  const showLegacyAllocationSection = !inlineScheduleActualEditingEnabled && !showInlineManyToOneHelper

  const selectionBlockedReason = useMemo(() => {
    if (!selectionCompatible) return "Selection does not match match type."
    return null
  }, [selectionCompatible])

  const allocationRows = useMemo(() => {
    if (effectiveType === "OneToOne") {
      const line = selectedLines[0]
      const schedule = selectedSchedules[0]
      if (!line || !schedule) return []

      const key = allocationKey(line.id, schedule.id)
      const draft = allocations[key] ?? { usage: "", commission: "" }
      return [
        {
          key,
          lineId: line.id,
          scheduleId: schedule.id,
          label: schedule.revenueScheduleName ?? schedule.id,
          expectedUsageNet: Number(schedule.expectedUsageNet ?? 0),
          expectedCommissionNet: Number(schedule.expectedCommissionNet ?? 0),
          usage: draft.usage,
          commission: draft.commission,
        },
      ]
    }

    if (effectiveType === "OneToMany") {
      const line = selectedLines[0]
      if (!line) return []
      return selectedSchedules.map(schedule => {
        const key = allocationKey(line.id, schedule.id)
        const draft = allocations[key] ?? { usage: "", commission: "" }
        return {
          key,
          lineId: line.id,
          scheduleId: schedule.id,
          label: schedule.revenueScheduleName ?? schedule.id,
          expectedUsageNet: Number(schedule.expectedUsageNet ?? 0),
          expectedCommissionNet: Number(schedule.expectedCommissionNet ?? 0),
          usage: draft.usage,
          commission: draft.commission,
        }
      })
    }

    if (effectiveType === "ManyToOne") {
      const schedule = selectedSchedules[0]
      if (!schedule) return []
      return selectedLines.map(line => {
        const key = allocationKey(line.id, schedule.id)
        const draft = allocations[key] ?? { usage: "", commission: "" }
        return {
          key,
          lineId: line.id,
          scheduleId: schedule.id,
          label: `${line.accountName} · ${line.productName}`,
          expectedUsageNet: Number(schedule.expectedUsageNet ?? 0),
          expectedCommissionNet: Number(schedule.expectedCommissionNet ?? 0),
          usage: draft.usage,
          commission: draft.commission,
        }
      })
    }

    if (effectiveType === "ManyToMany") {
      const schedulesSorted = [...selectedSchedules].sort((a, b) => {
        const dateA = a.revenueScheduleDate ? new Date(a.revenueScheduleDate).getTime() : Number.POSITIVE_INFINITY
        const dateB = b.revenueScheduleDate ? new Date(b.revenueScheduleDate).getTime() : Number.POSITIVE_INFINITY
        if (dateA !== dateB) return dateA - dateB
        return (a.revenueScheduleName ?? "").localeCompare(b.revenueScheduleName ?? "")
      })

      const linesSorted = [...selectedLines].sort((a, b) => (a.lineItem ?? 0) - (b.lineItem ?? 0))

      return linesSorted.flatMap(line =>
        schedulesSorted.map(schedule => {
          const key = allocationKey(line.id, schedule.id)
          const draft = allocations[key] ?? { usage: "", commission: "" }
          return {
            key,
            lineId: line.id,
            scheduleId: schedule.id,
            label: `${line.accountName} · ${line.productName} → ${schedule.revenueScheduleName ?? schedule.id}`,
            expectedUsageNet: Number(schedule.expectedUsageNet ?? 0),
            expectedCommissionNet: Number(schedule.expectedCommissionNet ?? 0),
            usage: draft.usage,
            commission: draft.commission,
          }
        }),
      )
    }

    return []
  }, [allocations, effectiveType, selectedLines, selectedSchedules])

  const allocationTotals = useMemo(() => {
    let usage = 0
    let commission = 0
    for (const row of allocationRows) {
      const usageAmount = parseMatchWizardAmount(row.usage) ?? 0
      const commissionAmount = parseMatchWizardAmount(row.commission) ?? 0
      usage += usageAmount
      commission += commissionAmount
    }
    return { usage: Math.round(usage * 100) / 100, commission: Math.round(commission * 100) / 100 }
  }, [allocationRows])

  const canProceedToAllocation = selectionCompatible
  const bundleBlocking =
    effectiveType === "ManyToOne" &&
    !bundleAuditLogId &&
    (manyToOneMode === "bundle" || replacementRequired)
  const canProceedToPreview = canProceedToAllocation && allocationRows.length > 0 && !bundleBlocking

  const allocationsPayload = useMemo(() => {
    return allocationRows.map(row => ({
      lineId: row.lineId,
      scheduleId: row.scheduleId,
      usageAmount: parseMatchWizardAmount(row.usage),
      commissionAmount: parseMatchWizardAmount(row.commission),
    }))
  }, [allocationRows])

  const hasPreviewErrors = useMemo(() => {
    if (!preview) return false
    if (!preview.ok) return true
    return preview.issues.some(issue => issue.level === "error")
  }, [preview])

  const canConfirmApply = useMemo(() => {
    return Boolean(
      previewUpToDate && preview && preview.ok && !hasPreviewErrors && !applyLoading && !appliedMatchGroupId,
    )
  }, [appliedMatchGroupId, applyLoading, hasPreviewErrors, preview, previewUpToDate])

  const previewBlockedReason = useMemo(() => {
    if (!canProceedToAllocation) return selectionBlockedReason ?? "Fix selection first."
    if (replacementRequired) return "Replace the bundle first."
    if (bundleBlocking) return "Create bundle schedules first."
    if (allocationRows.length === 0) return "No allocation rows available."
    return null
  }, [allocationRows.length, bundleBlocking, canProceedToAllocation, replacementRequired, selectionBlockedReason])

  const applyBlockedReason = useMemo(() => {
    if (!canProceedToPreview) return previewBlockedReason ?? "Validation has not completed yet."
    if (previewError) return "Validation could not be completed. Retry validation."
    if (!preview) return "Validation has not completed yet."
    if (!previewUpToDate) return "Validation is updating after your latest changes."
    if (hasPreviewErrors) return "Fix validation issues before applying."
    return null
  }, [canProceedToPreview, hasPreviewErrors, preview, previewBlockedReason, previewError, previewUpToDate])

  const validationIssues = useMemo(() => preview?.issues ?? [], [preview])

  const validationState = useMemo(
    () =>
      deriveMatchWizardValidationState({
        canValidate: canProceedToPreview,
        validationLoading: previewLoading,
        validationUpToDate: previewUpToDate,
        validationError: previewError,
        preview,
      }),
    [canProceedToPreview, preview, previewError, previewLoading, previewUpToDate],
  )

  const validationStatus = useMemo(() => {
    if (variancePrompts.length > 0 && validationState !== "error" && validationState !== "system_error") {
      return {
        className: "border-amber-200 bg-amber-50 text-amber-900",
        title: "Variance resolution required",
        message: "Submit opens the variance-resolution modal for the affected schedules.",
        summary: "Preview found schedules that exceed tolerance and require resolution before apply.",
      }
    }

    switch (validationState) {
      case "valid":
        return {
          className: "border-emerald-200 bg-emerald-50 text-emerald-900",
          title: "Preview ready",
          message: "Review looks clear. You can submit this match.",
          summary: "Preview complete. No blocking issues found.",
        }
      case "warning":
        return {
          className: "border-amber-200 bg-amber-50 text-amber-900",
          title: "Preview found warnings",
          message: "Submit is still allowed, but review the warnings first.",
          summary: "Preview complete with warnings. Submit is still allowed.",
        }
      case "error":
        return {
          className: "border-red-200 bg-red-50 text-red-700",
          title: "Preview found blocking issues",
          message: "Fix them before submitting.",
          summary: "Preview found blocking issues.",
        }
      case "stale":
        return {
          className: "border-amber-200 bg-amber-50 text-amber-900",
          title: "Preview is updating",
          message: "Refreshing after your latest edit.",
          summary: "Preview is updating after your latest changes.",
        }
      case "system_error":
        return {
          className: "border-red-200 bg-red-50 text-red-700",
          title: "Preview could not be loaded",
          message: "Try again.",
          summary: "Preview failed. Retry to continue.",
        }
      case "running":
        return {
          className: "border-primary-200 bg-primary-50 text-primary-900",
          title: "Refreshing preview",
          message: "Checking the current selection and allocations.",
          summary: "Preview is running.",
        }
      case "idle":
      default:
        return {
          className: "border-slate-200 bg-slate-50 text-slate-800",
          title: "Preview is waiting",
          message: previewBlockedReason ?? "It will start when selection and allocations are ready.",
          summary: previewBlockedReason ?? "Complete selection and allocation to start preview.",
      }
    }
  }, [previewBlockedReason, validationState, variancePrompts.length])

  const runPreview = useCallback(async () => {
    const runVersion = allocationsVersion
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewVersion(null)
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/matches/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchType: effectiveType,
            lineIds: selectedLines.map(line => line.id),
            scheduleIds: selectedSchedules.map(schedule => schedule.id),
            allocations: allocationsPayload,
          }),
        },
      )
      const payload = await response.json().catch(() => null)
      const data = payload?.data as PreviewResponse | undefined
      if (!data) {
        throw new Error(payload?.error || "Failed to preview match")
      }
      setPreview(data)
      setPreviewVersion(runVersion)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setPreviewLoading(false)
    }
  }, [allocationsPayload, allocationsVersion, depositId, effectiveType, selectedLines, selectedSchedules])

  const openAllocationEditor = useCallback(() => {
    if (effectiveType === "ManyToOne" && !bundleAuditLogId) {
      setManyToOneMode("allocation")
      setAllocationExpanded(current => (manyToOneMode === "allocation" ? !current : true))
      return
    }
    setAllocationExpanded(prev => !prev)
  }, [bundleAuditLogId, effectiveType, manyToOneMode])

  const openBundleEditor = useCallback(() => {
    setManyToOneMode("bundle")
    setAllocationExpanded(current => (manyToOneMode === "bundle" ? !current : true))
  }, [manyToOneMode])

  const applyInlineBulkPrompt = useCallback(async () => {
    if (!inlineBulkPrompt) return

    setInlineBulkApplying(true)

    try {
      setAllocations(prev => {
        const nextAllocations = { ...prev }

        if (inlineBulkPrompt.mode === "scheduleActual") {
          const lineId = selectedLines[0]?.id
          if (!lineId) return prev

          for (const schedule of selectedSchedules) {
            const rowKey = allocationKey(lineId, schedule.id)
            const currentActual =
              inlineBulkPrompt.field === "usage"
                ? Number(schedule.actualUsage ?? 0)
                : Number(schedule.actualCommission ?? 0)
            nextAllocations[rowKey] = {
              ...(nextAllocations[rowKey] ?? { usage: "", commission: "" }),
              [inlineBulkPrompt.field]: deriveAllocationDraftFromActualTarget({
                currentActual,
                rawTarget: inlineBulkPrompt.rawValue,
              }),
            }
          }

          return nextAllocations
        }

        const scheduleId = selectedSchedules[0]?.id
        if (!scheduleId) return prev

        for (const line of selectedLines) {
          const rowKey = allocationKey(line.id, scheduleId)
          const currentAllocated =
            inlineBulkPrompt.field === "usage"
              ? Number(line.usageAllocated ?? 0)
              : Number(line.commissionAllocated ?? 0)
          nextAllocations[rowKey] = {
            ...(nextAllocations[rowKey] ?? { usage: "", commission: "" }),
            [inlineBulkPrompt.field]: deriveAllocationDraftFromActualTarget({
              currentActual: currentAllocated,
              rawTarget: inlineBulkPrompt.rawValue,
            }),
          }
        }

        return nextAllocations
      })
      setInlineBulkPrompt(null)
    } finally {
      setInlineBulkApplying(false)
    }
  }, [inlineBulkPrompt, selectedLines, selectedSchedules])

  const openVarianceResolutionModal = useCallback((scheduleId: string) => {
    setVarianceResolutionModal({
      scheduleId,
      selectedAction: varianceResolutionSelections[scheduleId] ?? null,
      submitting: false,
      error: null,
    })
  }, [varianceResolutionSelections])

  const handleVarianceResolutionSelect = useCallback((action: VarianceResolutionAction) => {
    setVarianceResolutionModal(previous => (previous ? { ...previous, selectedAction: action, error: null } : previous))
  }, [])

  const handleVarianceResolutionSubmit = useCallback(() => {
    if (!varianceResolutionModal?.selectedAction) return

    const nextSelections = {
      ...varianceResolutionSelections,
      [varianceResolutionModal.scheduleId]: varianceResolutionModal.selectedAction,
    }
    setVarianceResolutionSelections(nextSelections)

    const remainingPrompts = variancePrompts.filter(prompt => !nextSelections[prompt.scheduleId])
    if (remainingPrompts.length > 0) {
      setVarianceResolutionModal({
        scheduleId: remainingPrompts[0]!.scheduleId,
        selectedAction: nextSelections[remainingPrompts[0]!.scheduleId] ?? null,
        submitting: false,
        error: null,
      })
      return
    }

    setVarianceResolutionModal(null)
  }, [variancePrompts, varianceResolutionModal, varianceResolutionSelections])

  useEffect(() => {
    if (!isOpen) return
    if (!canProceedToPreview) return

    const requestKey = `${previewInputsKey}|${allocationsVersion}`
    if (autoPreviewRequestKeyRef.current === requestKey) return

    if (autoValidationTimeoutRef.current) {
      clearTimeout(autoValidationTimeoutRef.current)
    }

    autoValidationTimeoutRef.current = setTimeout(() => {
      autoPreviewRequestKeyRef.current = requestKey
      void runPreview()
      autoValidationTimeoutRef.current = null
    }, AUTO_VALIDATION_DEBOUNCE_MS)

    return () => {
      if (autoValidationTimeoutRef.current) {
        clearTimeout(autoValidationTimeoutRef.current)
        autoValidationTimeoutRef.current = null
      }
    }
  }, [allocationsVersion, canProceedToPreview, isOpen, previewInputsKey, runPreview])

  useEffect(() => {
    if (replacementRequired) setAllocationExpanded(true)
  }, [replacementRequired])

  useEffect(() => {
    if (!isOpen) return
    if (!replacementRequiredIssue || bundleAuditLogId) return
    setManyToOneMode("bundle")
    setBundleApplyMode("soft_delete_old")
  }, [bundleAuditLogId, isOpen, replacementRequiredIssue])

  const applyMatchGroup = async () => {
    if (unresolvedVariancePrompts.length > 0) {
      openVarianceResolutionModal(unresolvedVariancePrompts[0]!.scheduleId)
      return
    }

    setApplyLoading(true)
    setApplyError(null)
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/matches/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchType: effectiveType,
            lineIds: selectedLines.map(line => line.id),
            scheduleIds: selectedSchedules.map(schedule => schedule.id),
            allocations: allocationsPayload,
            varianceResolutions: Object.entries(varianceResolutionSelections).map(([scheduleId, action]) => ({
              scheduleId,
              action,
            })),
          }),
        },
      )
      const payload = await response.json().catch(() => null)
      if (response.status === 409 && payload?.data?.requiresVarianceResolution) {
        const returnedPreview = payload?.data?.preview as PreviewResponse | undefined
        if (returnedPreview) {
          setPreview(returnedPreview)
          setPreviewVersion(allocationsVersion)
        }
        const firstPrompt = (payload?.data?.variancePrompts as PreviewVariancePrompt[] | undefined)?.[0]
        if (firstPrompt?.scheduleId) {
          openVarianceResolutionModal(firstPrompt.scheduleId)
          return
        }
      }
      if (!response.ok) {
        const issues = payload?.issues as PreviewIssue[] | undefined
        const message = payload?.error || "Failed to apply match group"
        const issueText = issues?.length ? ` (${issues[0].message})` : ""
        throw new Error(`${message}${issueText}`)
      }
      const groupId = payload?.data?.group?.id as string | undefined
      if (!groupId) {
        throw new Error("Apply succeeded but no matchGroupId was returned.")
      }
      setAppliedMatchGroupId(groupId)
      onApplied?.()
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setApplyLoading(false)
    }
  }

  const undoMatchGroup = async () => {
    if (!appliedMatchGroupId) return
    setUndoLoading(true)
    setUndoError(null)
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/matches/${encodeURIComponent(appliedMatchGroupId)}/undo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: undoReason.trim() || null }),
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to undo match group")
      }
      setAppliedMatchGroupId(null)
      onApplied?.()
    } catch (err) {
      setUndoError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setUndoLoading(false)
    }
  }

  const applyBundleRipReplace = async () => {
    setBundleLoading(true)
    setBundleError(null)

    try {
      if (selectedLines.length < 2) {
        throw new Error("Bundle requires at least two deposit line items.")
      }
      if (selectedSchedules.length !== 1) {
        throw new Error("Bundle requires selecting exactly one schedule.")
      }

      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/bundle-rip-replace/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineIds: selectedLines.map(line => line.id),
            revenueScheduleId: selectedSchedules[0]!.id,
            mode: replacementRequired ? "soft_delete_old" : bundleApplyMode,
            reason: bundleApplyReason.trim() || null,
          }),
        },
      )

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create bundle schedules")
      }

      const bundleAuditLogId = payload?.data?.bundleAuditLogId as string | undefined
      const scheduleRows = payload?.data?.scheduleRows as SuggestedMatchScheduleRow[] | undefined
      const lineToScheduleMap = payload?.data?.lineToScheduleMap as Array<{ lineId: string; scheduleId: string }> | undefined

      if (!bundleAuditLogId || !Array.isArray(scheduleRows) || !Array.isArray(lineToScheduleMap)) {
        throw new Error("Bundle succeeded but returned an invalid response.")
      }

      setBundleAuditLogId(bundleAuditLogId)
      setWizardSchedules(scheduleRows)

      const nextAllocations: Record<string, AllocationDraft> = {}
      for (const mapping of lineToScheduleMap) {
        const line = selectedLines.find(item => item.id === mapping.lineId)
        if (!line) continue
        const usage = Math.max(0, Number(line.usageUnallocated ?? 0))
        const commission = Math.max(0, Number(line.commissionUnallocated ?? 0))
        nextAllocations[allocationKey(mapping.lineId, mapping.scheduleId)] = {
          usage: usage ? usage.toFixed(2) : "",
          commission: commission ? commission.toFixed(2) : "",
        }
      }

      skipAllocationResetRef.current = true
      setOverrideType("ManyToMany")
      setManyToOneMode("allocation")
      setAllocations(nextAllocations)
      setPreview(null)
      setPreviewVersion(null)
      setPreviewError(null)
      setAppliedMatchGroupId(null)
      onApplied?.()
    } catch (err) {
      setBundleError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setBundleLoading(false)
    }
  }

  const undoBundleRipReplace = async () => {
    if (!bundleAuditLogId) return
    setBundleUndoLoading(true)
    setBundleUndoError(null)

    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/bundle-rip-replace/${encodeURIComponent(bundleAuditLogId)}/undo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: bundleUndoReason.trim() || null }),
        },
      )

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to undo bundle operation")
      }

      setBundleAuditLogId(null)
      setWizardSchedules(initialSelectedSchedules)
      setBundleUndoReason("")
      skipAllocationResetRef.current = true
      setOverrideType(null)
      setManyToOneMode("allocation")
      setAllocations(
        buildDefaultAllocations({
          matchType: detectedType,
          lines: selectedLines,
          schedules: initialSelectedSchedules,
        }),
      )
      setPreview(null)
      setPreviewVersion(null)
      setPreviewError(null)
      setAppliedMatchGroupId(null)
      onApplied?.()
    } catch (err) {
      setBundleUndoError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setBundleUndoLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reconciliation match wizard"
        className="flex max-h-[90vh] w-full max-w-[1360px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <ModalHeader
          kicker="Reconciliation Match"
          title={`Match ${lineCount} line${lineCount === 1 ? "" : "s"} to ${scheduleCount} schedule${scheduleCount === 1 ? "" : "s"}`}
          variant="gradient"
        />

        <div className="flex-1 space-y-6 overflow-y-auto p-6 text-sm text-slate-700">
          <div className="space-y-3">
            <div className="space-y-3">
              <div className="flex items-end justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comparison layout</p>
                  <p className="text-base font-semibold text-slate-900">Selected deposit lines and target schedule preview</p>
                </div>
                <div className="flex shrink-0 items-center gap-x-4 text-sm">
                  <p><span className="font-medium text-slate-500">Match Type</span>{" "}<span className="font-semibold text-slate-900">{formatMatchType(effectiveType)}</span></p>
                  <span className="text-slate-300">·</span>
                  <p><span className="font-medium text-slate-500">Deposit Lines</span>{" "}<span className="font-semibold text-slate-900">{lineCount}</span></p>
                  <span className="text-slate-300">·</span>
                  <p><span className="font-medium text-slate-500">Schedules</span>{" "}<span className="font-semibold text-slate-900">{scheduleCount}</span></p>
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
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-800">
                  <p className="font-semibold">M:M is detected</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Review allocations carefully. Validation will warn on over/under tolerance before you apply.
                  </p>
                </div>
              ) : null}

              {selectionVarianceSummary ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                  <p className="font-semibold">Large total mismatch detected</p>
                  <p className="mt-1 text-xs">
                    Selected deposit totals and schedule totals are materially different. Review whether this should stay as
                    an edited allocation or move through the bundle/flex path before submitting.
                  </p>
                </div>
              ) : null}

              <div className="space-y-3">
                <MatchWizardSelectionTable
                  title={lineCount === 1 ? "Selected Deposit Line" : "Selected Deposit Lines"}
                  emptyLabel="No deposit line items were selected."
                  headers={[
                    "Account ID",
                    "Account",
                    "Product",
                    "Line",
                    "Act. Usage",
                    "Allocated",
                    "Unalloc.",
                    "Comm %",
                    "Act. Comm",
                    "Comm Alloc",
                  ]}
                  rows={selectedLineRows}
                />
                {inlineLineAllocationEditingEnabled ? (
                  <p className="text-xs text-slate-600">
                    Edit <span className="font-semibold text-slate-900">Allocated</span> and{" "}
                    <span className="font-semibold text-slate-900">Comm Alloc</span> directly in the selected deposit
                    lines. If the same final value should apply across all selected lines, tab out of the edited cell to
                    use bulk inline update.
                  </p>
                ) : null}
                <div className="space-y-2">
                  <MatchWizardSelectionTable
                    title={scheduleCount === 1 ? "Target Revenue Schedule Preview" : "Target Revenue Schedules Preview"}
                    emptyLabel="No revenue schedules were selected."
                    headers={[
                      "Sched",
                      "Date",
                      "Qty",
                      "Price Each",
                      "Exp. Gross",
                      "Exp. Adj.",
                      "Exp. Net",
                      "Exp. Rate",
                      "Exp. Comm",
                      "Act. Usage",
                      "Act. Comm",
                      "Act. Rate",
                      "Usage Bal.",
                      "Comm Diff.",
                    ]}
                    rows={selectedScheduleRows}
                  />
                  {inlineScheduleActualEditingEnabled ? (
                    <p className="text-xs text-slate-600">
                      Edit <span className="font-semibold text-slate-900">Actual Usage</span> and{" "}
                      <span className="font-semibold text-slate-900">Actual Commission</span> directly in the preview
                      table. If the same final value should apply across all selected schedules, tab out of the edited
                      cell to use bulk inline update.
                    </p>
                  ) : null}
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="whitespace-nowrap">
                        Selected line usage{" "}
                        <span className="font-semibold text-slate-900">
                          {currencyFormatter.format(selectionTotals.lineUsageTotal)}
                        </span>
                      </span>
                      <span className="whitespace-nowrap">
                        Selected line comm{" "}
                        <span className="font-semibold text-slate-900">
                          {currencyFormatter.format(selectionTotals.lineCommissionTotal)}
                        </span>
                      </span>
                      <span className="whitespace-nowrap">
                        Expected usage net{" "}
                        <span className="font-semibold text-slate-900">
                          {currencyFormatter.format(selectionTotals.scheduleExpectedUsage)}
                        </span>
                      </span>
                      <span className="whitespace-nowrap">
                        Expected comm net{" "}
                        <span className="font-semibold text-slate-900">
                          {currencyFormatter.format(selectionTotals.scheduleExpectedCommission)}
                        </span>
                      </span>
                    </div>
                  </div>
                  {previewLoading && !previewUpToDate ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Refreshing live preview...
                    </div>
                  ) : null}
                  {validationState !== "idle" &&
                  validationState !== "valid" &&
                  validationState !== "running" &&
                  !previewLoading ? (
                    <div className={cn("rounded-md border px-3 py-2.5 text-sm", validationStatus.className)}>
                      <p className="font-semibold">{validationStatus.title}</p>
                      <p className="mt-1">{validationStatus.message}</p>
                      {validationState === "system_error" && previewError ? (
                        <p className="mt-1 text-xs">{previewError}</p>
                      ) : null}
                      {previewUpToDate &&
                      (validationState === "warning" || validationState === "error") &&
                      validationIssues.length ? (
                        <>
                          {validationIssues.some(i => i.level === "error") ? (
                            <>
                              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-red-600">Errors</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                                {validationIssues.filter(i => i.level === "error").map((issue, idx) => (
                                  <li key={`err-${issue.code}-${idx}`} className="text-red-700">{issue.message}</li>
                                ))}
                              </ul>
                            </>
                          ) : null}
                          {validationIssues.some(i => i.level === "warning") ? (
                            <>
                              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-700">Warnings</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                                {validationIssues.filter(i => i.level === "warning").map((issue, idx) => (
                                  <li key={`warn-${issue.code}-${idx}`} className="text-amber-800">{issue.message}</li>
                                ))}
                              </ul>
                            </>
                          ) : null}
                          {variancePrompts.length > 0 ? (
                            <>
                              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-700">
                                Resolution Needed
                              </p>
                              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                                {variancePrompts.map(prompt => (
                                  <li key={`variance-${prompt.scheduleId}`} className="text-amber-800">
                                    {prompt.scheduleNumber} exceeds tolerance by{" "}
                                    {currencyFormatter.format(
                                      Math.max(prompt.usageOverage, prompt.commissionOverage),
                                    )}
                                    .
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {showInlineManyToOneHelper ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">Inline allocation editing is active</p>
                  <p className="mt-1 text-xs text-slate-600">
                    The selected deposit lines above are now the primary allocation editor. Switch to bundle only when
                    this should break into replacement schedules.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                    Allocation totals:{" "}
                    <span className="font-semibold">{currencyFormatter.format(allocationTotals.usage)}</span> usage,{" "}
                    <span className="font-semibold">{currencyFormatter.format(allocationTotals.commission)}</span>{" "}
                    commission
                  </div>
                  <button
                    type="button"
                    className="rounded border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    onClick={openBundleEditor}
                    disabled={bundleLoading}
                  >
                    Bundle Instead
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {showLegacyAllocationSection ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">Edit Allocation</p>
                  <p className="text-xs text-slate-600">Adjust allocations here before submitting the match.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {effectiveType === "ManyToOne" && !bundleAuditLogId ? (
                    <>
                      <button
                        type="button"
                        className={cn(
                          "rounded border px-2.5 py-1.5 text-xs font-semibold transition",
                          manyToOneMode === "allocation"
                            ? "border-primary-300 bg-primary-50 text-primary-800 hover:bg-primary-100"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        )}
                        onClick={openAllocationEditor}
                        disabled={replacementRequired}
                      >
                        Edit Allocation
                      </button>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">or</span>
                      <button
                        type="button"
                        className={cn(
                          "rounded border px-2.5 py-1.5 text-xs font-semibold transition",
                          manyToOneMode === "bundle"
                            ? "border-primary-300 bg-primary-50 text-primary-800 hover:bg-primary-100"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        )}
                        onClick={openBundleEditor}
                        disabled={bundleLoading}
                      >
                        Bundle
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={openAllocationEditor}
                    >
                      {allocationExpanded ? "Hide Allocation Editor" : "Edit Allocation"}
                    </button>
                  )}
                </div>
              </div>

              {allocationExpanded ? (
                <div className="space-y-3">
                {!canProceedToAllocation ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    <p className="font-semibold">Allocation is blocked</p>
                    <p className="mt-1 text-xs">{selectionBlockedReason ?? "Fix selection above to continue."}</p>
                  </div>
                ) : null}

                <div className={cn("space-y-3", !canProceedToAllocation && "pointer-events-none opacity-50")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Allocation mode</p>
                  <p className="text-base font-semibold text-slate-900">{formatMatchType(effectiveType)}</p>
                  <p className="text-xs text-slate-600">Partial allocations are allowed.</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <p>
                    Allocation totals:{" "}
                    <span className="font-semibold">{currencyFormatter.format(allocationTotals.usage)}</span> usage,{" "}
                    <span className="font-semibold">{currencyFormatter.format(allocationTotals.commission)}</span>{" "}
                    commission
                  </p>
                </div>
              </div>

              {bundleAuditLogId && !appliedMatchGroupId ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                  <p className="font-semibold">Bundle created</p>
                  <p className="mt-1 text-xs">Audit ID: {bundleAuditLogId}</p>

                  <div className="mt-3 space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80">
                      Bundle undo reason (optional)
                    </label>
                    <input
                      className="w-full rounded border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-800"
                      value={bundleUndoReason}
                      onChange={e => setBundleUndoReason(e.target.value)}
                      disabled={bundleUndoLoading}
                      placeholder="Why are you undoing this bundle?"
                    />
                    {bundleUndoError ? <p className="text-xs font-semibold text-red-700">{bundleUndoError}</p> : null}
                    <button
                      type="button"
                      className="rounded border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void undoBundleRipReplace()}
                      disabled={bundleUndoLoading}
                    >
                      {bundleUndoLoading ? "Undoing bundle..." : "Undo bundle"}
                    </button>
                  </div>
                </div>
              ) : null}

              {false && effectiveType === "ManyToOne" && !bundleAuditLogId ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">M:1 Mode</p>
                  <div className="mt-2 flex flex-col gap-2 text-sm text-slate-800">
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="m1-mode"
                        checked={manyToOneMode === "allocation"}
                        onChange={() => setManyToOneMode("allocation")}
                        disabled={bundleLoading || replacementRequired}
                      />
                      <span>
                        <span className="font-semibold">Allocate</span>{" "}
                        <span className="text-xs text-slate-600">(multiple lines → one schedule)</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="m1-mode"
                        checked={manyToOneMode === "bundle"}
                        onChange={() => setManyToOneMode("bundle")}
                        disabled={bundleLoading}
                      />
                      <span>
                        <span className="font-semibold">Bundle (Rip &amp; Replace)</span>{" "}
                        <span className="text-xs text-slate-600">(create products/schedules for future auto-match)</span>
                      </span>
                    </label>
                  </div>
                </div>
              ) : null}

              {replacementRequired ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950">
                  <p className="font-semibold">Direct match blocked</p>
                  <p className="mt-1 text-sm">
                    {replacementRequiredIssue?.message ??
                      "You can't match this directly because the selected lines use different commission rates. Replace the bundle with individual schedules instead."}
                  </p>
                  <p className="mt-2 text-xs text-amber-900/80">
                    Confirming replacement creates one product and schedule series per deposit line, then retires the original bundled schedules and opportunity product.
                  </p>
                </div>
              ) : null}

              {replacementBlockedIssue ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
                  <p className="font-semibold">Replacement blocked</p>
                  <p className="mt-1 text-sm">{replacementBlockedIssue.message}</p>
                </div>
              ) : null}

              {effectiveType === "ManyToOne" && manyToOneMode === "bundle" && !bundleAuditLogId ? (
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="font-semibold text-slate-900">
                    {replacementRequired ? "Replace bundled setup" : "Rip &amp; Replace bundle"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {replacementRequired
                      ? "Creates individual products and schedule series from the selected deposit lines, then switches this wizard into a line-to-schedule allocation against the new replacement schedules."
                      : "Creates new products + schedules starting from the selected schedule date, then switches this wizard into an M:M allocation against the newly created schedules."}
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {replacementRequired ? (
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Cleanup
                        </label>
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          Retire original bundle schedules and deactivate the bundled opportunity product.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Replace mode
                        </label>
                        <select
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
                          value={bundleApplyMode}
                          onChange={e =>
                            setBundleApplyMode(e.target.value === "soft_delete_old" ? "soft_delete_old" : "keep_old")
                          }
                          disabled={bundleLoading}
                        >
                          <option value="keep_old">Keep old schedules (no deletion)</option>
                          <option value="soft_delete_old">Soft-delete unreconciled old schedules</option>
                        </select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Reason {replacementRequired ? "(required for audit)" : "(optional)"}
                      </label>
                      <input
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
                        value={bundleApplyReason}
                        onChange={e => setBundleApplyReason(e.target.value)}
                        disabled={bundleLoading}
                        placeholder="Why create this bundle?"
                      />
                    </div>
                  </div>

                  {bundleError ? <p className="mt-2 text-sm font-semibold text-red-600">{bundleError}</p> : null}

                  <button
                    type="button"
                    className="mt-3 rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    onClick={() => void applyBundleRipReplace()}
                    disabled={bundleLoading || (replacementRequired && bundleApplyReason.trim().length === 0)}
                  >
                    {bundleLoading
                      ? "Creating replacement..."
                      : replacementRequired
                        ? "Confirm replacement"
                        : "Create bundle schedules"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {allocationRows.map(row => (
                    <div key={row.key} className="rounded-md border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-[220px]">
                          <p className="font-semibold text-slate-900">{row.label}</p>
                                {effectiveType === "ManyToMany" ? (
                            <p className="text-xs text-slate-600">
                              Expected: {currencyFormatter.format(row.expectedUsageNet)} usage /{" "}
                              {currencyFormatter.format(row.expectedCommissionNet)} commission
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Usage
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-32 rounded border border-slate-200 px-2 py-1 text-sm text-slate-800"
                              value={row.usage}
                              onChange={e => handleAllocationDraftChange(row.key, "usage", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Commission
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-32 rounded border border-slate-200 px-2 py-1 text-sm text-slate-800"
                              value={row.commission}
                              onChange={e => handleAllocationDraftChange(row.key, "commission", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {applyError ? <p className="text-sm font-semibold text-red-600">{applyError}</p> : null}

              {appliedMatchGroupId ? (
                <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                  <p className="font-semibold">Applied successfully</p>
                  <p className="text-xs">Match Group ID: {appliedMatchGroupId}</p>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80">
                      Undo reason (optional)
                    </label>
                    <input
                      className="w-full rounded border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-800"
                      value={undoReason}
                      onChange={e => setUndoReason(e.target.value)}
                      disabled={undoLoading}
                      placeholder="Why are you undoing this match group?"
                    />
                    {undoError ? <p className="text-xs font-semibold text-red-700">{undoError}</p> : null}
                    <button
                      type="button"
                      className="rounded border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void undoMatchGroup()}
                      disabled={undoLoading}
                    >
                      {undoLoading ? "Undoing..." : "Undo Match Group"}
                    </button>
                  </div>
                </div>
              ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            onClick={() => void applyMatchGroup()}
            disabled={!canConfirmApply}
            title={applyBlockedReason ?? undefined}
          >
            {applyLoading ? "Submitting..." : appliedMatchGroupId ? "Applied" : "Submit Match"}
          </button>
        </div>
      </div>
      <MatchWizardVarianceResolutionModal
        open={Boolean(activeVariancePrompt && varianceResolutionModal)}
        prompt={activeVariancePrompt}
        schedule={activeVarianceSchedule}
        state={varianceResolutionModal}
        onClose={() => setVarianceResolutionModal(null)}
        onSelectAction={handleVarianceResolutionSelect}
        onSubmit={handleVarianceResolutionSubmit}
      />
      <RevenueBulkApplyPanel
        isOpen={Boolean(inlineBulkPrompt)}
        selectedCount={inlineBulkPrompt?.selectedCount ?? 0}
        fieldLabel={inlineBulkPrompt?.fieldLabel ?? "Allocation"}
        valueLabel={inlineBulkPrompt?.valueLabel ?? currencyFormatter.format(0)}
        previousValueLabel={inlineBulkPrompt?.previousValueLabel}
        onClose={() => {
          pendingInlineBulkPromptRef.current = null
          setInlineBulkPrompt(null)
        }}
        onSubmit={applyInlineBulkPrompt}
        isSubmitting={inlineBulkApplying}
        entityLabelSingular={inlineBulkPrompt?.entityLabelSingular ?? "revenue schedule"}
        entityLabelPlural={inlineBulkPrompt?.entityLabelPlural ?? "revenue schedules"}
        containerClassName="z-[60]"
      />
    </div>
  )
}
