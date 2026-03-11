"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"

import type { DepositLineItemRow, SuggestedMatchScheduleRow } from "@/lib/mock-data"

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
  future: {
    count: number
    schedules: Array<{ id: string; scheduleNumber: string | null; scheduleDate: string | null }>
  }
}

export type RateDiscrepancyModalState = {
  lineId: string
  scheduleId: string
  applyingAction: "acceptCurrent" | "applyToFuture" | null
  error: string | null
  discrepancy: RateDiscrepancyPayload
}

type AlertTabId = "usage-overage" | "commission-rate"

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
  onChange: (id: AlertTabId) => void
}) {
  const tabs: Array<{ id: AlertTabId; label: string }> = [
    { id: "usage-overage", label: "Usage Overage" },
    { id: "commission-rate", label: "Commission Rate" },
  ]

  return (
    <div className="border-b-2 border-[#2f6fe4]">
      <div className="flex gap-1">
        {tabs.map(tab => {
          const isActive = props.activeId === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => props.onChange(tab.id)}
              className={
                isActive
                  ? "rounded-t-md border border-[#94b8ff] border-b-transparent bg-[#2f6fe4] px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-t-md border border-slate-300 bg-[#d7e7ff] px-4 py-2 text-sm font-semibold text-[#1f4db9] hover:bg-[#c8ddff]"
              }
            >
              {tab.label}
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

  const toneClass =
    props.tone === "green"
      ? props.subtle
        ? "font-semibold text-[#0c8f49]"
        : "font-extrabold text-[#0c8f49]"
      : props.subtle
        ? "font-semibold text-[#c43d35]"
        : "font-extrabold text-[#c43d35]"

  return <span className={toneClass}>{props.value}</span>
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
          ? "flex min-h-[112px] w-full flex-col rounded-xl border-2 border-emerald-500 bg-white px-4 py-4 text-left shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          : "flex min-h-[112px] w-full flex-col rounded-xl border border-slate-300 bg-white px-4 py-4 text-left shadow-sm hover:border-[#2f6fe4] disabled:cursor-not-allowed disabled:opacity-60"
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
}) {
  const [activeTab, setActiveTab] = useState<AlertTabId>("usage-overage")

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
    setActiveTab("usage-overage")
  }, [props.isOpen, props.flexPrompt, props.rateDiscrepancy])

  const closeDisabled =
    props.flexResolving ||
    Boolean(props.rateDiscrepancy?.applyingAction) ||
    Boolean(props.aiAdjustmentState?.applying)

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
  const usageOverage = props.flexPrompt?.decision.usageOverage ?? 0
  const usageToleranceAmount = props.flexPrompt?.decision.usageToleranceAmount ?? 0
  const absorbSelected = Boolean(props.aiAdjustmentState)
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
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6"
      onClick={() => (closeDisabled ? null : props.onClose())}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reconciliation-alert-title"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-2xl"
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
                  <HighlightedValue value="Bold green" tone="green" subtle /> values reflect changes from the selected
                  deposit match and absorb-preview path.
                </p>
              ) : null}
            </div>

            <div>
              <ProjectTabs activeId={activeTab} onChange={setActiveTab} />

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

                      <div className="grid gap-4 lg:grid-cols-2">
                        <OptionCard
                          title="Absorb into Price Each"
                          description="Adjust Exp. Usage Gross and recalculate Price Each on the matched schedule."
                          active={absorbSelected}
                          onClick={props.onOpenAiAdjustment}
                          disabled={props.flexResolving || Boolean(props.aiAdjustmentState?.loading)}
                          actionLabel={
                            props.aiAdjustmentState?.loading ? "Loading preview..." : "Preview and apply adjustment"
                          }
                        />
                        <OptionCard
                          title="Create Flex Product"
                          description="Create a new flex schedule to capture the overage separately."
                          onClick={props.onCreateFlexProduct}
                          disabled={props.flexResolving}
                          actionLabel={props.flexResolving ? "Working..." : "Create flex entry"}
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

                      {props.aiAdjustmentState ? (
                        <div className="space-y-3 rounded-xl border border-primary-200 bg-primary-50/60 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Absorb preview</p>
                              <p className="mt-1 text-sm text-slate-600">
                                Review the matched schedule changes before applying.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              onClick={props.onClearAiAdjustment}
                              disabled={props.aiAdjustmentState.applying}
                            >
                              Clear Preview
                            </button>
                          </div>

                          {props.aiAdjustmentState.loading ? (
                            <p className="text-sm text-slate-600">Loading preview...</p>
                          ) : props.aiAdjustmentState.error ? (
                            <p className="text-sm text-red-600">{props.aiAdjustmentState.error}</p>
                          ) : props.aiAdjustmentState.preview ? (
                            <>
                              <p className="text-sm text-slate-700">{props.aiAdjustmentState.preview.suggestion.reason}</p>
                              {props.aiAdjustmentState.preview.suggestion.type === "adjust" ? (
                                <>
                                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-lg border border-emerald-200 bg-white p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        New Price Each
                                      </p>
                                      <p className="mt-1 text-lg font-semibold text-emerald-700">
                                        {formatCurrency(absorbPreview?.priceEach ?? props.schedule?.priceEach ?? 0)}
                                      </p>
                                    </div>
                                    <div className="rounded-lg border border-emerald-200 bg-white p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        New Exp. Gross
                                      </p>
                                      <p className="mt-1 text-lg font-semibold text-emerald-700">
                                        {formatCurrency(absorbPreview?.expectedUsageGross ?? props.schedule?.expectedUsageGross ?? 0)}
                                      </p>
                                    </div>
                                    <div className="rounded-lg border border-emerald-200 bg-white p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        New Exp. Net
                                      </p>
                                      <p className="mt-1 text-lg font-semibold text-emerald-700">
                                        {formatCurrency(absorbPreview?.expectedUsageNet ?? props.schedule?.expectedUsageNet ?? 0)}
                                      </p>
                                    </div>
                                    <div className="rounded-lg border border-emerald-200 bg-white p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        New Exp. Comm
                                      </p>
                                      <p className="mt-1 text-lg font-semibold text-emerald-700">
                                        {formatCurrency(
                                          absorbPreview?.expectedCommissionNet ?? props.schedule?.expectedCommissionNet ?? 0,
                                        )}
                                      </p>
                                    </div>
                                  </div>
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

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {props.aiAdjustmentState?.preview?.suggestion.type === "adjust" ? (
                          <button
                            type="button"
                            className="rounded bg-[#2f6fe4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245dd1] disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={props.onApplyAiAdjustment}
                            disabled={props.aiAdjustmentState.applying || props.aiAdjustmentState.loading}
                          >
                            {props.aiAdjustmentState.applying ? "Applying..." : "Apply Absorb into Price Each"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <EmptyTabState
                      title="No usage-overage action required"
                      description="This match did not raise a promptable usage variance. The tab stays visible to preserve the unified shell layout."
                    />
                  )
                ) : rateDiscrepancy ? (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-700">
                      The received commission rate for this match does not match the expected schedule rate.
                      Continuing without review can hide incorrect schedule data or missed revenue.
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
                      <button
                        type="button"
                        className="rounded-md border border-[#c8d6f0] bg-white px-4 py-2.5 text-sm font-semibold text-[#3256a5] shadow-sm hover:bg-[#f5f9ff] disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={props.onAcceptRateCurrent}
                        disabled={Boolean(props.rateDiscrepancy?.applyingAction)}
                      >
                        {props.rateDiscrepancy?.applyingAction === "acceptCurrent" ? "Updating..." : "Accept New Rate %"}
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-[#2f6fe4] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#245dd1] disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={props.onApplyRateToFuture}
                        disabled={
                          Boolean(props.rateDiscrepancy?.applyingAction) || rateDiscrepancy.future.count === 0
                        }
                      >
                        {props.rateDiscrepancy?.applyingAction === "applyToFuture"
                          ? "Updating..."
                          : "Apply New Rate % to All Future Schedules"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <EmptyTabState
                    title="No commission-rate action required"
                    description="This match did not trigger a material commission-rate discrepancy. The tab stays visible so the modal layout matches the rest of the project."
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
          <p className="text-sm text-slate-500">
            Close the alert to return to reconciliation after reviewing the active tab(s).
          </p>
          <button
            type="button"
            className="rounded border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={props.onClose}
            disabled={closeDisabled}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
