"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"

import type { DepositLineItemRow, SuggestedMatchScheduleRow } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export type FlexDecisionAction = "none" | "auto_adjust" | "prompt" | "auto_chargeback"

export type FlexDecisionPayload = {
  action: FlexDecisionAction
  usageOverage: number
  usageUnderpayment: number
  usageToleranceAmount: number
  overageAboveTolerance: boolean
  allowedPromptOptions: Array<"Adjust" | "Manual" | "FlexProduct">
}

export type FlexPromptState = {
  lineId: string
  scheduleId: string
  decision: FlexDecisionPayload
}

export type AiAdjustmentPreviewPayload = {
  suggestion: {
    type: "allocate" | "adjust"
    reason: string
    priorOpenScheduleIds: string[]
  }
  base: {
    scheduleId: string
    scheduleDate: string
    expectedUsageNet: number
    actualUsageNet: number
    usageOverage: number
    expectedCommissionNet: number
    actualCommissionNet: number
    commissionOverage: number
  }
  scope: {
    kind: string
  }
  future: {
    count: number
    schedules: Array<{ id: string; scheduleNumber: string | null; scheduleDate: string | null }>
  }
}

export type AiAdjustmentModalState = {
  lineId: string
  scheduleId: string
  applyToFuture: boolean
  loading: boolean
  applying: boolean
  error: string | null
  preview: AiAdjustmentPreviewPayload | null
}

export type RateDiscrepancyPayload = {
  revenueScheduleId: string
  scheduleNumber: string
  scheduleDate: string | null
  expectedRatePercent: number
  receivedRatePercent: number
  differencePercent: number
  tolerancePercent: number
  direction: "higher" | "lower"
  future: {
    count: number
    schedules: Array<{ id: string; scheduleNumber: string | null; scheduleDate: string | null }>
  }
}

export type RateDiscrepancyModalState = {
  lineId: string
  scheduleId: string
  applyingAction: "acceptCurrent" | "applyToFuture" | "routeLowRate" | null
  error: string | null
  discrepancy: RateDiscrepancyPayload
}

export type CommissionAmountReviewPayload = {
  revenueScheduleId: string
  scheduleNumber: string
  scheduleDate: string | null
  status: "clear" | "action_required" | "routed_low_rate" | "pending_rate_resolution"
  requiresAction: boolean
  remainingCommissionDifference: number
  message: string
  recommendedAction: "none" | "adjust" | "flex-product"
  queuePath: string | null
  ticketId: string | null
}

export type CommissionAmountReviewState = {
  lineId: string
  scheduleId: string
  loading: boolean
  applyingAction: "adjust" | "flex-product" | null
  error: string | null
  review: CommissionAmountReviewPayload | null
}

type AlertTabId = "usage-overage" | "commission-rate" | "commission-amount"

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

function formatCurrency(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "$0.00"
  return currencyFormatter.format(Number(value))
}

function formatPercent(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "0.00%"
  return `${percentFormatter.format(Number(value))}%`
}

function formatRowRate(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "0.00%"
  const numeric = Number(value)
  const normalized = Math.abs(numeric) <= 1.5 ? numeric * 100 : numeric
  return formatPercent(normalized)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  return value.slice(0, 10)
}

function MetricCard(props: { label: string; value: string; tone?: "blue" | "green" | "amber" }) {
  const toneClasses =
    props.tone === "green"
      ? "border-emerald-300/60 bg-emerald-400/10 text-emerald-50"
      : props.tone === "amber"
        ? "border-amber-300/60 bg-amber-300/10 text-amber-50"
        : "border-white/20 bg-white/10 text-white"

  return (
    <div className={`min-w-[104px] rounded-lg border px-3 py-2 ${toneClasses}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">{props.label}</p>
      <p className="mt-1 text-lg font-semibold">{props.value}</p>
    </div>
  )
}

function SectionTable(props: {
  title: string
  emptyLabel: string
  headers: string[]
  values: ReactNode[]
}) {
  return (
    <section>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2f6fe4]">{props.title}</p>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-blue-700 text-left text-xs">
          <thead className="bg-[#2f6fe4] text-white">
            <tr>
              {props.headers.map(header => (
                <th key={header} className="whitespace-nowrap px-4 py-2 font-semibold uppercase tracking-wide">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200 bg-white text-slate-700">
              {props.values.length > 0 ? (
                props.values.map((value, index) => (
                  <td key={`${props.title}-${index}`} className="whitespace-nowrap px-4 py-3">
                    {value}
                  </td>
                ))
              ) : (
                <td className="px-4 py-4 text-slate-500" colSpan={props.headers.length}>
                  {props.emptyLabel}
                </td>
              )}
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </section>
  )
}

function ProjectTabs(props: {
  activeId: AlertTabId
  tabs: Array<{
    id: AlertTabId
    label: string
    status: "complete" | "action_required" | "locked"
  }>
  onChange: (id: AlertTabId) => void
}) {
  return (
    <div className="border-b-2 border-[#2f6fe4]">
      <div className="flex flex-wrap gap-1">
        {props.tabs.map((tab, index) => {
          const isActive = props.activeId === tab.id
          const isLocked = tab.status === "locked"
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => (isLocked ? null : props.onChange(tab.id))}
              disabled={isLocked}
              className={cn(
                "rounded-t-md border px-3 py-1.5 text-sm font-semibold shadow-sm transition",
                isActive
                  ? "relative -mb-[1px] z-10 border-primary-700 border-b-transparent bg-primary-700 text-white hover:bg-primary-800"
                  : isLocked
                    ? "cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400 shadow-none"
                    : "border-blue-300 bg-gradient-to-b from-blue-100 to-blue-200 text-primary-800 hover:border-blue-400 hover:from-blue-200 hover:to-blue-300",
              )}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-[0.14em]",
                    isActive ? "text-blue-100" : isLocked ? "text-slate-400" : "text-primary-700",
                  )}
                >
                  {index + 1}
                </span>
                <span>{tab.label}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EmptyTabState(props: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
      <p className="font-semibold text-slate-800">{props.title}</p>
      <p className="mt-1">{props.description}</p>
    </div>
  )
}

function FutureScheduleList(props: {
  title: string
  schedules: Array<{ id: string; scheduleNumber: string | null; scheduleDate: string | null }>
  count: number
}) {
  if (props.count <= 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        No future unreconciled schedules are currently eligible for an update.
      </div>
    )
  }

  return (
    <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-700">
        {props.title} ({props.count})
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
        {props.schedules.map(schedule => (
          <li key={schedule.id} className="break-all">
            {schedule.scheduleNumber ?? schedule.id} {schedule.scheduleDate ? `(${formatDate(schedule.scheduleDate)})` : ""}
          </li>
        ))}
      </ul>
    </details>
  )
}

function HighlightedValue(props: { value: string; tone?: "green" | "red"; subtle?: boolean }) {
  if (!props.tone) {
    return <span>{props.value}</span>
  }

  return (
    <span
      className={
        props.subtle
          ? "recon-preview-chip-subtle"
          : "recon-preview-chip"
      }
    >
      {props.value}
    </span>
  )
}

function PreviewComparisonTable(props: {
  title: string
  description?: string
  rows: Array<{ label: string; current: string; preview: string; changed?: boolean }>
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{props.title}</p>
          {props.description ? <p className="mt-1 text-sm text-slate-600">{props.description}</p> : null}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">Current</th>
              <th className="px-3 py-2">Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {props.rows.map(row => (
              <tr key={row.label}>
                <td className="px-3 py-2 font-semibold text-slate-800">{row.label}</td>
                <td className="px-3 py-2 text-slate-600">{row.current}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      row.changed
                        ? "recon-preview-chip"
                        : "text-slate-900"
                    }
                  >
                    {row.preview}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OptionCard(props: {
  title: string
  description: string
  active?: boolean
  onClick: () => void
  disabled?: boolean
  actionLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={
        props.active
          ? "flex min-h-[92px] w-full flex-col rounded-xl border-2 border-[#2f6fe4] bg-[#eef5ff] px-4 py-4 text-left shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          : "flex min-h-[92px] w-full flex-col rounded-xl border border-slate-300 bg-white px-4 py-4 text-left shadow-sm hover:border-[#2f6fe4] disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      <p className="text-lg font-semibold text-slate-900">{props.title}</p>
      <p className="mt-2 text-sm text-slate-600">{props.description}</p>
      {props.actionLabel ? <p className="mt-auto pt-4 text-sm font-semibold text-[#2f6fe4]">{props.actionLabel}</p> : null}
    </button>
  )
}

export function ReconciliationAlertModal(props: {
  isOpen: boolean
  depositName: string
  line: DepositLineItemRow | null
  schedule: SuggestedMatchScheduleRow | null
  matchedUsageAmount: number
  matchedCommissionAmount: number
  flexPrompt: FlexPromptState | null
  flexResolving: boolean
  aiAdjustmentState: AiAdjustmentModalState | null
  rateDiscrepancy: RateDiscrepancyModalState | null
  commissionAmountReview: CommissionAmountReviewState | null
  canCreateTickets: boolean
  onClose: () => void
  onOpenAiAdjustment: () => void
  onClearAiAdjustment: () => void
  onToggleAiApplyToFuture: (checked: boolean) => void
  onApplyAiAdjustment: () => void
  onCreateFlexProduct: () => void
  onOpenRateTicket: () => void
  onAcceptRateCurrent: () => void
  onApplyRateToFuture: () => void
  onCreateLowRateException: () => void
  onResolveCommissionAmountAdjust: () => void
  onResolveCommissionAmountFlexProduct: () => void
}) {
  const [activeTab, setActiveTab] = useState<AlertTabId>("usage-overage")
  const [selectedUsageAction, setSelectedUsageAction] = useState<"absorb" | "flex-product" | null>(null)
  const [selectedRateAction, setSelectedRateAction] = useState<"acceptCurrent" | "applyToFuture" | null>(null)
  const [selectedCommissionAmountAction, setSelectedCommissionAmountAction] = useState<"adjust" | "flex-product" | null>(
    null,
  )

  useEffect(() => {
    if (!props.isOpen) return
    if (props.flexPrompt) {
      setActiveTab("usage-overage")
      return
    }
    if (props.rateDiscrepancy) {
      setActiveTab("commission-rate")
      return
    }
    if (props.commissionAmountReview?.review) {
      setActiveTab("commission-amount")
      return
    }
    setActiveTab("usage-overage")
  }, [props.commissionAmountReview?.review, props.flexPrompt, props.isOpen, props.rateDiscrepancy])

  useEffect(() => {
    if (!props.isOpen) return
    setSelectedUsageAction(props.aiAdjustmentState ? "absorb" : null)
    setSelectedRateAction(null)
    setSelectedCommissionAmountAction(props.commissionAmountReview?.review?.recommendedAction === "adjust" ? "adjust" : null)
  }, [props.aiAdjustmentState, props.commissionAmountReview?.review?.recommendedAction, props.isOpen])

  const closeDisabled =
    props.flexResolving ||
    Boolean(props.rateDiscrepancy?.applyingAction) ||
    Boolean(props.aiAdjustmentState?.applying) ||
    Boolean(props.commissionAmountReview?.applyingAction)

  const selectionAdjustedSchedule = useMemo(() => {
    if (!props.schedule) return null

    return {
      actualUsage: props.schedule.actualUsage + props.matchedUsageAmount,
      usageBalance: props.schedule.usageBalance - props.matchedUsageAmount,
      actualCommission: props.schedule.actualCommission + props.matchedCommissionAmount,
      commissionDifference: props.schedule.commissionDifference - props.matchedCommissionAmount,
    }
  }, [props.matchedCommissionAmount, props.matchedUsageAmount, props.schedule])

  const absorbPreview = useMemo(() => {
    if (!props.schedule || props.aiAdjustmentState?.preview?.suggestion.type !== "adjust") return null

    const quantity = Number(props.schedule.quantity || 0)
    const usageOverage = props.aiAdjustmentState.preview.base.usageOverage
    const commissionOverage = props.aiAdjustmentState.preview.base.commissionOverage
    const nextExpectedUsageGross = props.schedule.expectedUsageGross + usageOverage
    const nextExpectedUsageNet = props.schedule.expectedUsageNet + usageOverage
    const nextExpectedCommissionNet = props.schedule.expectedCommissionNet + commissionOverage
    const nextPriceEach = quantity > 0 ? nextExpectedUsageGross / quantity : props.schedule.priceEach

    return {
      priceEach: nextPriceEach,
      expectedUsageGross: nextExpectedUsageGross,
      expectedUsageNet: nextExpectedUsageNet,
      expectedCommissionNet: nextExpectedCommissionNet,
    }
  }, [props.aiAdjustmentState, props.schedule])

  const selectionAdjustedActualRate = useMemo(() => {
    if (!selectionAdjustedSchedule) return props.schedule?.actualCommissionRatePercent ?? 0
    if (Math.abs(selectionAdjustedSchedule.actualUsage) <= 0.005) {
      return props.schedule?.actualCommissionRatePercent ?? 0
    }
    return selectionAdjustedSchedule.actualCommission / selectionAdjustedSchedule.actualUsage
  }, [props.schedule?.actualCommissionRatePercent, selectionAdjustedSchedule])

  const flexActionPreview = useMemo(() => {
    if (!props.flexPrompt || !props.schedule || !selectionAdjustedSchedule) return null

    const usageOverage = Math.max(props.flexPrompt.decision.usageOverage, 0)
    const commissionOverage = Math.max(-selectionAdjustedSchedule.commissionDifference, 0)
    const nextActualUsage = Math.max(selectionAdjustedSchedule.actualUsage - usageOverage, 0)
    const nextActualCommission = Math.max(selectionAdjustedSchedule.actualCommission - commissionOverage, 0)
    const nextUsageBalance = selectionAdjustedSchedule.usageBalance + usageOverage
    const nextCommissionDifference = selectionAdjustedSchedule.commissionDifference + commissionOverage
    const nextActualRate = nextActualUsage > 0.005 ? nextActualCommission / nextActualUsage : 0

    return {
      actualUsage: nextActualUsage,
      actualCommission: nextActualCommission,
      actualCommissionRatePercent: nextActualRate,
      usageBalance: nextUsageBalance,
      commissionDifference: nextCommissionDifference,
      usageOverage,
      commissionOverage,
    }
  }, [props.flexPrompt, props.schedule, selectionAdjustedSchedule])

  const absorbPreviewRows = useMemo(() => {
    if (!props.schedule || !selectionAdjustedSchedule) return []

    return [
      {
        label: "Price Each",
        current: formatCurrency(props.schedule.priceEach),
        preview: formatCurrency(absorbPreview?.priceEach ?? props.schedule.priceEach),
        changed: Boolean(absorbPreview),
      },
      {
        label: "Expected Usage",
        current: formatCurrency(props.schedule.expectedUsageNet),
        preview: formatCurrency(absorbPreview?.expectedUsageNet ?? props.schedule.expectedUsageNet),
        changed: Boolean(absorbPreview),
      },
      {
        label: "Actual Usage",
        current: formatCurrency(props.schedule.actualUsage),
        preview: formatCurrency(selectionAdjustedSchedule.actualUsage),
        changed: Math.abs(selectionAdjustedSchedule.actualUsage - props.schedule.actualUsage) > 0.005,
      },
      {
        label: "Expected Commission",
        current: formatCurrency(props.schedule.expectedCommissionNet),
        preview: formatCurrency(absorbPreview?.expectedCommissionNet ?? props.schedule.expectedCommissionNet),
        changed: Boolean(absorbPreview),
      },
      {
        label: "Actual Commission",
        current: formatCurrency(props.schedule.actualCommission),
        preview: formatCurrency(selectionAdjustedSchedule.actualCommission),
        changed: Math.abs(selectionAdjustedSchedule.actualCommission - props.schedule.actualCommission) > 0.005,
      },
      {
        label: "Expected Comm Rate",
        current: formatRowRate(props.schedule.expectedCommissionRatePercent),
        preview: formatRowRate(props.schedule.expectedCommissionRatePercent),
        changed: false,
      },
      {
        label: "Actual Comm Rate",
        current: formatRowRate(props.schedule.actualCommissionRatePercent),
        preview: formatRowRate(selectionAdjustedActualRate),
        changed: Math.abs(selectionAdjustedActualRate - (props.schedule.actualCommissionRatePercent ?? 0)) > 0.005,
      },
    ]
  }, [absorbPreview, props.schedule, selectionAdjustedActualRate, selectionAdjustedSchedule])

  const flexPreviewRows = useMemo(() => {
    if (!props.schedule || !flexActionPreview) return []

    return [
      {
        label: "Actual Usage",
        current: formatCurrency(props.schedule.actualUsage),
        preview: formatCurrency(flexActionPreview.actualUsage),
        changed: Math.abs(flexActionPreview.actualUsage - props.schedule.actualUsage) > 0.005,
      },
      {
        label: "Usage Balance",
        current: formatCurrency(props.schedule.usageBalance),
        preview: formatCurrency(flexActionPreview.usageBalance),
        changed: Math.abs(flexActionPreview.usageBalance - props.schedule.usageBalance) > 0.005,
      },
      {
        label: "Actual Commission",
        current: formatCurrency(props.schedule.actualCommission),
        preview: formatCurrency(flexActionPreview.actualCommission),
        changed: Math.abs(flexActionPreview.actualCommission - props.schedule.actualCommission) > 0.005,
      },
      {
        label: "Commission Difference",
        current: formatCurrency(props.schedule.commissionDifference),
        preview: formatCurrency(flexActionPreview.commissionDifference),
        changed: Math.abs(flexActionPreview.commissionDifference - props.schedule.commissionDifference) > 0.005,
      },
      {
        label: "Actual Comm Rate",
        current: formatRowRate(props.schedule.actualCommissionRatePercent),
        preview: formatRowRate(flexActionPreview.actualCommissionRatePercent),
        changed:
          Math.abs(flexActionPreview.actualCommissionRatePercent - (props.schedule.actualCommissionRatePercent ?? 0)) >
          0.005,
      },
    ]
  }, [flexActionPreview, props.schedule])

  const ratePreviewRows = useMemo(() => {
    const discrepancy = props.rateDiscrepancy?.discrepancy
    if (!discrepancy || !props.schedule) return []

    const nextExpectedRate =
      selectedRateAction === "acceptCurrent" || selectedRateAction === "applyToFuture"
        ? discrepancy.receivedRatePercent
        : discrepancy.expectedRatePercent

    return [
      {
        label: "Expected Comm Rate",
        current: formatPercent(discrepancy.expectedRatePercent),
        preview: formatPercent(nextExpectedRate),
        changed: nextExpectedRate !== discrepancy.expectedRatePercent,
      },
      {
        label: "Actual Comm Rate",
        current: formatRowRate(props.schedule.actualCommissionRatePercent),
        preview: formatPercent(discrepancy.receivedRatePercent),
        changed: Math.abs(discrepancy.receivedRatePercent - (props.schedule.actualCommissionRatePercent ?? 0)) > 0.005,
      },
    ]
  }, [props.rateDiscrepancy, props.schedule, selectedRateAction])

  if (!props.isOpen) return null

  const depositHeaders = [
    "Account ID",
    "Account",
    "Product",
    "Line",
    "Act. Usage",
    "Allocated",
    "Unalloc.",
    "Comm %",
    "Act. Comm",
    "Comm Alloc.",
    "Comm Unalloc.",
  ]
  const depositValues = props.line
    ? [
        props.line.accountId || "-",
        props.line.accountName || "-",
        props.line.productName || "-",
        formatCurrency(props.line.lineItem),
        formatCurrency(props.line.usage),
        formatCurrency(props.line.usageAllocated),
        formatCurrency(props.line.usageUnallocated),
        formatRowRate(props.line.commissionRate),
        formatCurrency(props.line.commission),
        formatCurrency(props.line.commissionAllocated),
        formatCurrency(props.line.commissionUnallocated),
      ]
    : []

  const scheduleHeaders = [
    "Sched",
    "Date",
    "Qty",
    "Price Each",
    "Exp. Gross",
    "Exp. Adj.",
    "Exp. Net",
    "Comm %",
    "Exp. Comm",
    "Act. Usage",
    "Usage Bal.",
  ]
  const scheduleValues = props.schedule
    ? [
        props.schedule.revenueScheduleName || "-",
        formatDate(props.schedule.revenueScheduleDate),
        Number.isFinite(Number(props.schedule.quantity)) ? Number(props.schedule.quantity).toFixed(2) : "-",
        <HighlightedValue
          key="price"
          value={formatCurrency(absorbPreview?.priceEach ?? props.schedule.priceEach)}
          tone={absorbPreview ? "green" : undefined}
        />,
        <HighlightedValue
          key="gross"
          value={formatCurrency(absorbPreview?.expectedUsageGross ?? props.schedule.expectedUsageGross)}
          tone={absorbPreview ? "green" : undefined}
        />,
        formatCurrency(props.schedule.expectedUsageAdjustment),
        <HighlightedValue
          key="net"
          value={formatCurrency(absorbPreview?.expectedUsageNet ?? props.schedule.expectedUsageNet)}
          tone={absorbPreview ? "green" : undefined}
        />,
        formatRowRate(props.schedule.expectedCommissionRatePercent),
        <HighlightedValue
          key="exp-comm"
          value={formatCurrency(absorbPreview?.expectedCommissionNet ?? props.schedule.expectedCommissionNet)}
          tone={absorbPreview ? "green" : undefined}
        />,
        <HighlightedValue
          key="act-usage"
          value={formatCurrency(selectionAdjustedSchedule?.actualUsage ?? props.schedule.actualUsage)}
          tone={props.matchedUsageAmount > 0 ? "green" : undefined}
        />,
        <HighlightedValue
          key="usage-bal"
          value={formatCurrency(selectionAdjustedSchedule?.usageBalance ?? props.schedule.usageBalance)}
          tone={
            selectionAdjustedSchedule
              ? Math.abs(selectionAdjustedSchedule.usageBalance) <= Math.abs(props.schedule.usageBalance)
                ? "green"
                : "red"
              : undefined
          }
        />,
      ]
    : []

  const rateDiscrepancy = props.rateDiscrepancy?.discrepancy ?? null
  const commissionAmountReview = props.commissionAmountReview?.review ?? null
  const usageOverage = props.flexPrompt?.decision.usageOverage ?? 0
  const usageToleranceAmount = props.flexPrompt?.decision.usageToleranceAmount ?? 0
  const absorbSelected = selectedUsageAction === "absorb"
  const futureCount = props.aiAdjustmentState?.preview?.future.count ?? 0
  const projectedAllocatedAmount = props.line ? props.line.usageAllocated + props.matchedUsageAmount : 0
  const projectedRemainingAmount = props.line ? props.line.usage - projectedAllocatedAmount : 0
  const actualCommissionPercent = props.line?.commissionRate ?? rateDiscrepancy?.receivedRatePercent ?? 0
  const summaryItems = [
    { label: "Deposit Total", value: formatCurrency(props.line?.usage ?? 0) },
    { label: "Allocated", value: formatCurrency(projectedAllocatedAmount) },
    { label: "Remaining", value: formatCurrency(projectedRemainingAmount) },
    { label: "Tolerance", value: formatCurrency(usageToleranceAmount) },
    { label: "Exp. Comm %", value: formatRowRate(props.schedule?.expectedCommissionRatePercent ?? 0) },
    { label: "Act. Comm %", value: formatRowRate(actualCommissionPercent) },
    {
      label: "Comm Amount Review",
      value: commissionAmountReview ? formatCurrency(commissionAmountReview.remainingCommissionDifference) : "Pending",
    },
  ]

  const usageStepStatus: "complete" | "action_required" | "locked" = props.flexPrompt ? "action_required" : "complete"
  const rateStepStatus: "complete" | "action_required" | "locked" = props.flexPrompt
    ? "locked"
    : rateDiscrepancy
      ? "action_required"
      : "complete"
  const commissionAmountStepStatus: "complete" | "action_required" | "locked" = props.flexPrompt || rateDiscrepancy
    ? "locked"
    : commissionAmountReview?.requiresAction
      ? "action_required"
      : "complete"
  const workflowTabs = [
    { id: "usage-overage", label: "Usage", status: usageStepStatus },
    { id: "commission-rate", label: "Commission Rate", status: rateStepStatus },
    { id: "commission-amount", label: "Commission Amount", status: commissionAmountStepStatus },
  ] satisfies Array<{ id: AlertTabId; label: string; status: "complete" | "action_required" | "locked" }>

  const handleClose = () => {
    if (props.aiAdjustmentState) {
      props.onClearAiAdjustment()
    }
    setSelectedUsageAction(null)
    setSelectedRateAction(null)
    setSelectedCommissionAmountAction(null)
    props.onClose()
  }

  const handleUsageActionSelect = (action: "absorb" | "flex-product") => {
    setSelectedUsageAction(action)
    if (action === "absorb") {
      props.onOpenAiAdjustment()
      return
    }
    if (props.aiAdjustmentState) {
      props.onClearAiAdjustment()
    }
  }

  const handleUsageSubmit = () => {
    if (selectedUsageAction === "absorb") {
      props.onApplyAiAdjustment()
      return
    }
    if (selectedUsageAction === "flex-product") {
      props.onCreateFlexProduct()
    }
  }

  const handleRateSubmit = () => {
    if (selectedRateAction === "acceptCurrent") {
      props.onAcceptRateCurrent()
      return
    }
    if (selectedRateAction === "applyToFuture") {
      props.onApplyRateToFuture()
    }
  }

  const handleCommissionAmountSubmit = () => {
    if (selectedCommissionAmountAction === "adjust") {
      props.onResolveCommissionAmountAdjust()
      return
    }
    if (selectedCommissionAmountAction === "flex-product") {
      props.onResolveCommissionAmountFlexProduct()
    }
  }

  const usageSubmitDisabled =
    !selectedUsageAction ||
    props.flexResolving ||
    (selectedUsageAction === "absorb" &&
      (Boolean(props.aiAdjustmentState?.loading) || props.aiAdjustmentState?.preview?.suggestion.type !== "adjust"))

  const rateSubmitDisabled =
    !selectedRateAction ||
    Boolean(props.rateDiscrepancy?.applyingAction) ||
    (selectedRateAction === "applyToFuture" && (rateDiscrepancy?.future.count ?? 0) === 0)

  const commissionAmountSubmitDisabled =
    !selectedCommissionAmountAction ||
    Boolean(props.commissionAmountReview?.applyingAction) ||
    !commissionAmountReview?.requiresAction

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6"
      onClick={() => (closeDisabled ? null : handleClose())}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reconciliation-alert-title"
        className="flex h-[900px] w-full max-w-[1360px] min-h-0 flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="border-b border-blue-700 bg-gradient-to-r from-blue-950 via-blue-800 to-blue-700 px-6 py-5 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-100/90">
                Reconciliation Alert
              </p>
              <h2 id="reconciliation-alert-title" className="mt-1 text-2xl font-semibold">
                Variance and Commission Review
              </h2>
              <p className="mt-1 text-sm text-blue-100/90">{props.depositName}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Usage Overage" value={formatCurrency(usageOverage)} tone="amber" />
              <MetricCard label="Tolerance" value={formatCurrency(usageToleranceAmount)} tone="blue" />
              <MetricCard
                label="Expected Rate"
                value={rateDiscrepancy ? formatPercent(rateDiscrepancy.expectedRatePercent) : "No issue"}
                tone="green"
              />
              <MetricCard
                label="Comm Delta"
                value={rateDiscrepancy ? formatPercent(rateDiscrepancy.differencePercent) : "No issue"}
                tone="amber"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-100 px-6 py-4">
          <div className="space-y-3">
            <SectionTable
              title="Selected Deposit Line Item"
              emptyLabel="Deposit line details were not available for this alert."
              headers={depositHeaders}
              values={depositValues}
            />
            <div className="space-y-2">
              <SectionTable
                title="Matched Revenue Schedule"
                emptyLabel="Revenue schedule details were not available for this alert."
                headers={scheduleHeaders}
                values={scheduleValues}
              />
              {props.line || props.schedule ? (
                <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    {summaryItems.map(item => (
                      <span key={item.label} className="whitespace-nowrap">
                        {item.label} <span className="font-semibold text-slate-900">{item.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {(props.matchedUsageAmount > 0 || absorbPreview) && props.schedule ? (
                <p className="text-xs text-slate-600">
                  <HighlightedValue value="Yellow highlight" tone="green" subtle /> values reflect changes from the selected
                  deposit match and absorb-preview path.
                </p>
              ) : null}
            </div>

            <div>
              <ProjectTabs activeId={activeTab} tabs={workflowTabs} onChange={setActiveTab} />

              <div className="mt-3">
                {activeTab === "usage-overage" ? (
                  props.flexPrompt ? (
                    <div className="space-y-4">
                      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                        This allocation overpays the schedule by{" "}
                        <span className="font-semibold">{formatCurrency(props.flexPrompt.decision.usageOverage)}</span>.
                        Current tolerance amount:{" "}
                        <span className="font-semibold">{formatCurrency(props.flexPrompt.decision.usageToleranceAmount)}</span>.
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
                        <OptionCard
                          title="Absorb into Price Each"
                          description="Adjust Exp. Usage Gross and recalculate Price Each on the matched schedule."
                          active={selectedUsageAction === "absorb"}
                          onClick={() => handleUsageActionSelect("absorb")}
                          disabled={props.flexResolving || Boolean(props.aiAdjustmentState?.loading)}
                          actionLabel={
                            props.aiAdjustmentState?.loading ? "Loading preview..." : "Select to preview"
                          }
                        />
                        <div className="flex items-center justify-center" aria-hidden="true">
                          <div className="flex w-full items-center gap-3 lg:w-auto lg:flex-col lg:gap-2">
                            <div className="h-px flex-1 bg-slate-300 lg:h-full lg:w-px lg:flex-none" />
                            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              or
                            </span>
                            <div className="h-px flex-1 bg-slate-300 lg:h-full lg:w-px lg:flex-none" />
                          </div>
                        </div>
                        <OptionCard
                          title="Create Flex Product"
                          description="Create a new flex schedule to capture the overage separately."
                          active={selectedUsageAction === "flex-product"}
                          onClick={() => handleUsageActionSelect("flex-product")}
                          disabled={props.flexResolving}
                          actionLabel={props.flexResolving ? "Working..." : "Select to preview"}
                        />
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-slate-400 text-primary-600 accent-primary-600"
                            checked={props.aiAdjustmentState?.applyToFuture ?? false}
                            onChange={event => props.onToggleAiApplyToFuture(event.target.checked)}
                            disabled={!absorbSelected || Boolean(props.aiAdjustmentState?.applying)}
                          />
                          <span className="text-sm text-slate-700">
                            <span className="block font-semibold">
                              Apply this adjustment to all future schedules for this opportunity product
                            </span>
                            <span className="mt-1 block text-slate-500">
                              {futureCount > 0
                                ? `${futureCount} future schedule${futureCount === 1 ? "" : "s"} will be updated if you apply the absorb option.`
                                : "Future schedule impact will be shown when the absorb preview loads."}
                            </span>
                          </span>
                        </label>
                      </div>

                      {selectedUsageAction === "absorb" ? (
                        <div className="space-y-3 rounded-xl border border-primary-200 bg-primary-50/60 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Absorb preview</p>
                              <p className="mt-1 text-sm text-slate-600">
                                Review the schedule changes before submitting the adjustment.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                setSelectedUsageAction(null)
                                props.onClearAiAdjustment()
                              }}
                              disabled={props.aiAdjustmentState?.applying}
                            >
                              Clear Selection
                            </button>
                          </div>

                          {props.aiAdjustmentState?.loading ? (
                            <p className="text-sm text-slate-600">Loading preview...</p>
                          ) : props.aiAdjustmentState?.error ? (
                            <p className="text-sm text-red-600">{props.aiAdjustmentState.error}</p>
                          ) : props.aiAdjustmentState?.preview ? (
                            <>
                              <p className="text-sm text-slate-700">{props.aiAdjustmentState.preview.suggestion.reason}</p>
                              {props.aiAdjustmentState.preview.suggestion.type === "adjust" ? (
                                <>
                                  <PreviewComparisonTable
                                    title="Absorb Into Price Each Preview"
                                    description="Changed values are shown in-place with the pending result in the preview column."
                                    rows={absorbPreviewRows}
                                  />
                                  {props.aiAdjustmentState.applyToFuture ? (
                                    <FutureScheduleList
                                      title="Future schedules affected"
                                      schedules={props.aiAdjustmentState.preview.future.schedules}
                                      count={props.aiAdjustmentState.preview.future.count}
                                    />
                                  ) : null}
                                </>
                              ) : (
                                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                  The current preview recommends allocation instead of an absorb-style adjustment.
                                </div>
                              )}
                            </>
                          ) : null}
                        </div>
                      ) : null}

                      {selectedUsageAction === "flex-product" && flexActionPreview ? (
                        <PreviewComparisonTable
                          title="Create Flex Product Preview"
                          description={`The overage will be split out to a new flex entry before submit. Usage moved: ${formatCurrency(flexActionPreview.usageOverage)}. Commission moved: ${formatCurrency(flexActionPreview.commissionOverage)}.`}
                          rows={flexPreviewRows}
                        />
                      ) : null}

                      {selectedUsageAction ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            className="rounded bg-[#2f6fe4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245dd1] disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={handleUsageSubmit}
                            disabled={usageSubmitDisabled}
                          >
                            {selectedUsageAction === "absorb"
                              ? props.aiAdjustmentState?.applying
                                ? "Submitting..."
                                : "Submit Absorb into Price Each"
                              : props.flexResolving
                                ? "Submitting..."
                                : "Submit Create Flex Product"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <EmptyTabState
                      title="No usage-overage action required"
                      description="This match did not raise a promptable usage variance. The tab stays visible to preserve the unified shell layout."
                    />
                  )
                ) : activeTab === "commission-rate" ? (
                  rateDiscrepancy ? (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-700">
                        The received commission rate for this match does not match the expected schedule rate.
                        Step 2 must be completed before the commission-amount review unlocks.
                      </p>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="whitespace-nowrap text-slate-600">
                          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Expected
                          </span>
                          <span className="font-semibold text-slate-900">
                            {formatPercent(rateDiscrepancy.expectedRatePercent)}
                          </span>
                        </span>
                        <span className="whitespace-nowrap text-slate-600">
                          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Received
                          </span>
                          <span className="font-semibold text-slate-900">
                            {formatPercent(rateDiscrepancy.receivedRatePercent)}
                          </span>
                        </span>
                        <span className="whitespace-nowrap text-slate-600">
                          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Tolerance
                          </span>
                          <span className="font-semibold text-slate-900">
                            {formatPercent(rateDiscrepancy.tolerancePercent)}
                          </span>
                        </span>
                        <span className="whitespace-nowrap text-amber-900">
                          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                            Difference
                          </span>
                          <span className="font-semibold">
                            {formatPercent(rateDiscrepancy.differencePercent)}
                          </span>
                        </span>
                      </div>

                      {rateDiscrepancy.direction === "higher" ? (
                        <>
                          <div className="grid gap-4 lg:grid-cols-2">
                            <OptionCard
                              title="Accept Higher Rate Once"
                              description="Update only the current schedule to the higher received commission rate."
                              active={selectedRateAction === "acceptCurrent"}
                              onClick={() => setSelectedRateAction("acceptCurrent")}
                              disabled={Boolean(props.rateDiscrepancy?.applyingAction)}
                              actionLabel="Select to preview"
                            />
                            <OptionCard
                              title="Apply Higher Rate to Future"
                              description="Update the current schedule and all eligible future schedules to the higher received rate."
                              active={selectedRateAction === "applyToFuture"}
                              onClick={() => setSelectedRateAction("applyToFuture")}
                              disabled={Boolean(props.rateDiscrepancy?.applyingAction) || rateDiscrepancy.future.count === 0}
                              actionLabel="Select to preview"
                            />
                          </div>
                          {selectedRateAction ? (
                            <PreviewComparisonTable
                              title="Commission Rate Preview"
                              description={
                                selectedRateAction === "applyToFuture"
                                  ? `${rateDiscrepancy.future.count} future schedule${rateDiscrepancy.future.count === 1 ? "" : "s"} will also adopt the previewed expected rate after submit.`
                                  : "Only the current schedule will adopt the previewed expected rate after submit."
                              }
                              rows={ratePreviewRows}
                            />
                          ) : null}
                          <FutureScheduleList
                            title="Future unreconciled schedules"
                            schedules={rateDiscrepancy.future.schedules}
                            count={rateDiscrepancy.future.count}
                          />
                          {props.rateDiscrepancy?.error ? (
                            <p className="text-sm text-red-600">{props.rateDiscrepancy.error}</p>
                          ) : null}
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-md border border-[#efb071] bg-white px-4 py-2.5 text-sm font-semibold text-[#c46a1f] shadow-sm hover:bg-[#fff7ef] disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={props.onOpenRateTicket}
                              disabled={Boolean(props.rateDiscrepancy?.applyingAction) || !props.canCreateTickets}
                              title={!props.canCreateTickets ? "Insufficient permissions to create tickets" : undefined}
                            >
                              Create Ticket
                            </button>
                            {selectedRateAction ? (
                              <button
                                type="button"
                                className="rounded-md bg-[#2f6fe4] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#245dd1] disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={handleRateSubmit}
                                disabled={rateSubmitDisabled}
                              >
                                {props.rateDiscrepancy?.applyingAction
                                  ? "Submitting..."
                                  : selectedRateAction === "acceptCurrent"
                                    ? "Submit Accept Higher Rate Once"
                                    : "Submit Apply Higher Rate to Future"}
                              </button>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                            This is a lower-than-expected rate. It cannot be normalized silently or pushed to future schedules.
                            Submitting this step will flag the schedule, create the investigation ticket, and route it to the low-rate review queue.
                          </div>
                          {props.rateDiscrepancy?.error ? (
                            <p className="text-sm text-red-600">{props.rateDiscrepancy.error}</p>
                          ) : null}
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-md bg-[#2f6fe4] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#245dd1] disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={props.onCreateLowRateException}
                              disabled={Boolean(props.rateDiscrepancy?.applyingAction)}
                            >
                              {props.rateDiscrepancy?.applyingAction ? "Submitting..." : "Route Low-Rate Exception"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <EmptyTabState
                      title="No commission-rate action required"
                      description="This match did not trigger a material commission-rate discrepancy. The tab stays visible so the modal layout matches the rest of the project."
                    />
                  )
                ) : commissionAmountReview ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">Server-backed commission amount review</p>
                      <p className="mt-1 text-sm text-slate-600">{commissionAmountReview.message}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                        <span className="text-slate-600">
                          Remaining Difference{" "}
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(commissionAmountReview.remainingCommissionDifference)}
                          </span>
                        </span>
                        <span className="text-slate-600">
                          Status <span className="font-semibold text-slate-900">{commissionAmountReview.status}</span>
                        </span>
                      </div>
                      {commissionAmountReview.queuePath ? (
                        <p className="mt-3 text-sm">
                          <a href={commissionAmountReview.queuePath} className="font-semibold text-[#2f6fe4] hover:underline">
                            Open low-rate review queue
                          </a>
                        </p>
                      ) : null}
                    </div>

                    {commissionAmountReview.requiresAction ? (
                      <>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <OptionCard
                            title="Create Adjustment Entry"
                            description="Resolve the remaining commission amount on the current schedule through the flex-adjustment path."
                            active={selectedCommissionAmountAction === "adjust"}
                            onClick={() => setSelectedCommissionAmountAction("adjust")}
                            disabled={Boolean(props.commissionAmountReview?.applyingAction)}
                            actionLabel="Recommended"
                          />
                          <OptionCard
                            title="Create Flex Product"
                            description="Split the remaining commission amount to a separate flex schedule when the overage should stay separate."
                            active={selectedCommissionAmountAction === "flex-product"}
                            onClick={() => setSelectedCommissionAmountAction("flex-product")}
                            disabled={Boolean(props.commissionAmountReview?.applyingAction)}
                            actionLabel="Select to submit"
                          />
                        </div>
                        {props.commissionAmountReview?.error ? (
                          <p className="text-sm text-red-600">{props.commissionAmountReview.error}</p>
                        ) : null}
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-md bg-[#2f6fe4] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#245dd1] disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={handleCommissionAmountSubmit}
                            disabled={commissionAmountSubmitDisabled}
                          >
                            {props.commissionAmountReview?.applyingAction
                              ? "Submitting..."
                              : selectedCommissionAmountAction === "flex-product"
                                ? "Submit Create Flex Product"
                                : "Submit Create Adjustment Entry"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <EmptyTabState
                        title="No commission-amount action required"
                        description="The remaining commission amount has already cleared or been routed through the approved exception flow."
                      />
                    )}
                  </div>
                ) : (
                  <EmptyTabState
                    title="Commission amount review pending"
                    description="The server-backed commission amount validation will appear here once Steps 1 and 2 are complete."
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
          <p className="text-sm text-slate-500">
            Review the highlighted preview, then submit the selected action when ready.
          </p>
          <button
            type="button"
            className="rounded border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleClose}
            disabled={closeDisabled}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
