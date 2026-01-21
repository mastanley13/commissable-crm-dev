"use client"

import { useMemo, type ReactNode } from "react"

import type { DepositLineItemRow } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { AutoMatchSummary, DepositReconciliationMetadata } from "@/components/deposit-reconciliation-detail-view"

const inlineFieldLabelClass =
  "text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap flex items-center"
const inlineValueBoxBaseClass =
  "flex min-h-[28px] w-full items-center border-b-2 border-gray-300 bg-transparent pl-[3px] pr-0 py-1 text-[11px] text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis"

interface InlineStatRowProps {
  label: string
  value: ReactNode
  valueTitle?: string
  align?: "left" | "right"
  valueBoxClassName?: string
  labelClassName?: string
}

function InlineStatRow({
  label,
  value,
  valueTitle,
  align = "right",
  valueBoxClassName,
  labelClassName,
}: InlineStatRowProps) {
  const displayValue =
    typeof value === "string" ? (
      <span
        className={cn("block w-full truncate", align === "right" ? "text-right tabular-nums" : "text-left")}
        title={valueTitle ?? value}
      >
        {value}
      </span>
    ) : (
      value
    )

  return (
    <div className="grid items-center gap-3 grid-cols-[minmax(0,160px)_minmax(0,1fr)]">
      <span className={cn(inlineFieldLabelClass, labelClassName)}>{label}</span>
      <div
        className={cn(
          inlineValueBoxBaseClass,
          align === "right" ? "justify-end" : "justify-start",
          valueBoxClassName,
        )}
      >
        {displayValue}
      </div>
    </div>
  )
}

function formatPercent(fraction: number) {
  if (!Number.isFinite(fraction) || fraction <= 0) return "0%"
  return `${Math.round(fraction * 100)}%`
}

type DepositHeaderStatus = {
  label: string
  className: string
  title: string
}

function formatIsoDateYYYYMMDD(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export interface DepositReconciliationTopSectionProps {
  metadata: DepositReconciliationMetadata
  lineItems: DepositLineItemRow[]
  actions?: ReactNode
  autoMatchSummary?: AutoMatchSummary | null
}

export function DepositReconciliationTopSection({
  metadata,
  lineItems,
  actions,
  autoMatchSummary = null,
}: DepositReconciliationTopSectionProps) {
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }),
    [],
  )

  const formattedDate = useMemo(() => formatIsoDateYYYYMMDD(metadata.depositDate), [metadata.depositDate])

  const commissionTotals = useMemo(() => {
    return lineItems.reduce(
      (acc, item) => {
        acc.total += Number(item.commission ?? 0)
        acc.allocated += Number(item.commissionAllocated ?? 0)
        acc.unallocated += Number(item.commissionUnallocated ?? 0)
        return acc
      },
      { total: 0, allocated: 0, unallocated: 0 },
    )
  }, [lineItems])

  const matchedLineItemCount = useMemo(() => {
    return lineItems.reduce((count, line) => count + (line.status === "Matched" ? 1 : 0), 0)
  }, [lineItems])

  const reconciledAtTitle = useMemo(() => {
    if (!metadata.reconciledAt) return "Finalized"
    const parsed = new Date(metadata.reconciledAt)
    if (Number.isNaN(parsed.getTime())) return `Finalized: ${metadata.reconciledAt}`
    return `Finalized: ${formatIsoDateYYYYMMDD(metadata.reconciledAt)}`
  }, [metadata.reconciledAt])

  const headerStatus: DepositHeaderStatus = useMemo(() => {
    if (metadata.reconciled) {
      return {
        label: "Finalized",
        className: "bg-emerald-100 text-emerald-800 ring-emerald-200",
        title: reconciledAtTitle,
      }
    }

    const usageTotal = Number(metadata.usageTotal || 0)
    if (!Number.isFinite(usageTotal) || usageTotal <= 0) {
      return {
        label: "Open",
        className: "bg-slate-100 text-slate-800 ring-slate-200",
        title: "Open",
      }
    }

    const usageAllocatedPct = usageTotal > 0 ? Number(metadata.allocated || 0) / usageTotal : 0
    const allocatedPercentLabel = formatPercent(usageAllocatedPct)

    if (Number(metadata.allocated || 0) <= 0) {
      return {
        label: `Open • Unmatched (${allocatedPercentLabel})`,
        className: "bg-rose-100 text-rose-800 ring-rose-200",
        title: `Open. ${allocatedPercentLabel} of usage allocated.`,
      }
    }

    if (Number(metadata.unallocated || 0) <= 0) {
      return {
        label: `Open • Fully Matched (${allocatedPercentLabel})`,
        className: "bg-sky-100 text-sky-800 ring-sky-200",
        title: `Open. ${allocatedPercentLabel} of usage allocated (ready to finalize).`,
      }
    }

    return {
      label: `Open • Partially Matched (${allocatedPercentLabel})`,
      className: "bg-amber-100 text-amber-900 ring-amber-200",
      title: `Open. ${allocatedPercentLabel} of usage allocated.`,
    }
  }, [
    metadata.allocated,
    metadata.reconciled,
    metadata.unallocated,
    metadata.usageTotal,
    reconciledAtTitle,
  ])

  return (
    <div className="-mx-3 border-b border-blue-100 bg-blue-50 px-3 py-2 sm:-mx-4 sm:px-4">
      <div className="flex items-center justify-between pb-2 mb-2">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">
            Deposit Reconciliation
          </p>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
              headerStatus.className,
            )}
            title={headerStatus.title}
          >
            {headerStatus.label}
          </span>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      <div className="grid items-start gap-x-10 gap-y-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <InlineStatRow
            label="Deposit Name"
            value={metadata.depositName}
            valueTitle={metadata.depositName}
            align="left"
          />
          <InlineStatRow label="Date" value={formattedDate} valueTitle={formattedDate} align="left" />
          <InlineStatRow
            label="Payment Type"
            value={metadata.paymentType || "-"}
            valueTitle={metadata.paymentType || "-"}
            align="left"
          />
        </div>

        <div className="space-y-1.5">
          <InlineStatRow label="Deposit Total" value={currencyFormatter.format(metadata.usageTotal)} />
          <InlineStatRow label="Allocated to Schedules" value={currencyFormatter.format(metadata.allocated)} />
          <InlineStatRow label="Remaining" value={currencyFormatter.format(metadata.unallocated)} />
        </div>

        <div className="space-y-1.5">
          <InlineStatRow label="Commission Total" value={currencyFormatter.format(commissionTotals.total)} />
          <InlineStatRow label="Commission Allocated" value={currencyFormatter.format(commissionTotals.allocated)} />
          <InlineStatRow label="Remaining" value={currencyFormatter.format(commissionTotals.unallocated)} />
        </div>

        <div className="space-y-1.5">
          <InlineStatRow label="Deposit Line Items" value={String(lineItems.length)} />
          <InlineStatRow label="Items Matched" value={String(matchedLineItemCount)} />
          <InlineStatRow label="Remaining" value={String(Math.max(0, lineItems.length - matchedLineItemCount))} />
        </div>
      </div>

      {autoMatchSummary ? (
        <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-[10px] font-medium text-emerald-800">
          Auto-allocated <span className="font-semibold">{autoMatchSummary.autoMatched}</span> of{" "}
          <span className="font-semibold">{autoMatchSummary.processed}</span> lines
          {autoMatchSummary.alreadyMatched > 0 ? <> {" - "}Already allocated: {autoMatchSummary.alreadyMatched}</> : null}
          {autoMatchSummary.belowThreshold > 0 ? <> {" - "}Below threshold: {autoMatchSummary.belowThreshold}</> : null}
          {autoMatchSummary.noCandidates > 0 ? <> {" - "}No candidates: {autoMatchSummary.noCandidates}</> : null}
          {autoMatchSummary.errors > 0 ? <> {" - "}Errors: {autoMatchSummary.errors}</> : null}
        </div>
      ) : null}
    </div>
  )
}
