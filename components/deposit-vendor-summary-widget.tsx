"use client"

import { useCallback, useMemo, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import type { DepositLineItemRow } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { buildVendorSummary, type VendorSummaryRow, type VendorSummaryTotals } from "@/lib/reconciliation/vendor-summary"

export interface FilterContext {
  activeTab: string
  totalLineItems: number
}

export interface DepositVendorSummaryWidgetProps {
  lineItems: DepositLineItemRow[]
  className?: string
  defaultVisibleRows?: number
  onVendorClick?: (vendorName: string) => void
  selectedVendor?: string | null
  filterContext?: FilterContext | null
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
}

type SortKey =
  | "vendorName"
  | "lineCount"
  | "linesFullyAllocated"
  | "lineCountWithUnallocated"
  | "commissionAllocatedPercent"
  | "statusBreakdown"
  | "usageAllocated"
  | "usageUnallocated"
  | "commissionAllocated"
  | "commissionUnallocated"

type SortDirection = "asc" | "desc"

function getProgressColor(percent: number): string {
  if (percent >= 100) return "bg-emerald-500"
  if (percent >= 50) return "bg-amber-500"
  return "bg-red-500"
}

function getProgressTextColor(percent: number): string {
  if (percent >= 100) return "text-emerald-700"
  if (percent >= 50) return "text-amber-700"
  return "text-red-700"
}

function getRowHighlight(row: VendorSummaryRow): string {
  if (row.commissionUnallocated === 0 && row.usageUnallocated === 0) {
    return "bg-emerald-50/50"
  }
  if (row.commissionAllocatedPercent < 50) {
    return "bg-red-50/40"
  }
  return ""
}

function getSortValue(row: VendorSummaryRow, key: SortKey): number | string {
  switch (key) {
    case "vendorName": return row.vendorName
    case "lineCount": return row.lineCount
    case "linesFullyAllocated": return row.lineCount - row.lineCountWithUnallocated
    case "lineCountWithUnallocated": return row.lineCountWithUnallocated
    case "commissionAllocatedPercent": return row.commissionAllocatedPercent
    case "statusBreakdown": return row.statusCounts.unmatched * 10000 + row.statusCounts.partiallyMatched * 100 + row.statusCounts.suggested
    case "usageAllocated": return row.usageAllocated
    case "usageUnallocated": return row.usageUnallocated
    case "commissionAllocated": return row.commissionAllocated
    case "commissionUnallocated": return row.commissionUnallocated
  }
}

function tabLabel(tab: string): string {
  switch (tab) {
    case "unmatched": return "Unmatched"
    case "matched": return "Matched"
    case "suggested": return "Suggested"
    case "reconciled": return "Reconciled"
    case "all": return "All"
    default: return tab
  }
}

export function DepositVendorSummaryWidget({
  lineItems,
  className,
  defaultVisibleRows = 8,
  onVendorClick,
  selectedVendor,
  filterContext,
}: DepositVendorSummaryWidgetProps) {
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }),
    [],
  )

  const summary = useMemo(() => buildVendorSummary(lineItems), [lineItems])
  const [showAll, setShowAll] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "commissionUnallocated",
    direction: "desc",
  })

  const handleSort = useCallback((key: SortKey) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      return { key, direction: key === "vendorName" ? "asc" : "desc" }
    })
  }, [])

  const sortedRows = useMemo(() => {
    const rows = [...summary.rows]
    rows.sort((a, b) => {
      const aVal = getSortValue(a, sortConfig.key)
      const bVal = getSortValue(b, sortConfig.key)
      const dir = sortConfig.direction === "asc" ? 1 : -1
      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal) * dir
      }
      return ((aVal as number) - (bVal as number)) * dir
    })
    return rows
  }, [summary.rows, sortConfig])

  if (summary.rows.length === 0) {
    return (
      <div className={cn("rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600", className)}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Vendor Summary</div>
          <div className="text-xs font-medium text-slate-500">0 vendors</div>
        </div>
        <div className="mt-2 text-xs text-slate-500">No line items match the current filters.</div>
      </div>
    )
  }

  const visibleRows = showAll ? sortedRows : sortedRows.slice(0, Math.max(1, defaultVisibleRows))
  const canToggle = sortedRows.length > defaultVisibleRows

  function SortHeader({ label, sortKey, align = "right" }: { label: string; sortKey: SortKey; align?: "left" | "right" }) {
    const isActive = sortConfig.key === sortKey
    return (
      <th
        className={cn(
          "px-3 py-2 cursor-pointer select-none transition-colors hover:bg-slate-100/70",
          align === "right" ? "text-right" : "text-left",
        )}
        onClick={() => handleSort(sortKey)}
      >
        <span className="inline-flex items-center gap-0.5">
          {label}
          {isActive ? (
            sortConfig.direction === "asc" ? (
              <ChevronUp className="h-3 w-3 text-primary-600" />
            ) : (
              <ChevronDown className="h-3 w-3 text-primary-600" />
            )
          ) : (
            <ChevronDown className="h-3 w-3 text-slate-300" />
          )}
        </span>
      </th>
    )
  }

  function ProgressBar({ percent }: { percent: number }) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-14 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", getProgressColor(percent))}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <span className={cn("text-[10px] font-semibold tabular-nums", getProgressTextColor(percent))}>
          {percent}%
        </span>
      </div>
    )
  }

  function StatusBadges({ row }: { row: VendorSummaryRow | VendorSummaryTotals }) {
    const counts = row.statusCounts
    const parts: { label: string; count: number; color: string }[] = []
    if (counts.matched > 0) parts.push({ label: "M", count: counts.matched, color: "text-emerald-700" })
    if (counts.partiallyMatched > 0) parts.push({ label: "P", count: counts.partiallyMatched, color: "text-amber-700" })
    if (counts.unmatched > 0) parts.push({ label: "U", count: counts.unmatched, color: "text-red-700" })
    if (counts.suggested > 0) parts.push({ label: "S", count: counts.suggested, color: "text-blue-700" })
    if (counts.reconciled > 0) parts.push({ label: "R", count: counts.reconciled, color: "text-slate-600" })
    if (counts.ignored > 0) parts.push({ label: "I", count: counts.ignored, color: "text-slate-400" })

    if (parts.length === 0) return <span className="text-slate-400">-</span>

    return (
      <span className="inline-flex items-center gap-1.5">
        {parts.map(p => (
          <span key={p.label} className={cn("font-semibold tabular-nums", p.color)} title={`${p.count} ${statusTitle(p.label)}`}>
            {p.count}{p.label}
          </span>
        ))}
      </span>
    )
  }

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
        <div className="flex items-baseline gap-2">
          <div className="text-sm font-semibold text-slate-900">Vendor Summary</div>
          <div className="text-xs font-medium text-slate-500">
            {formatCount(summary.totals.vendorCount)} vendors • {formatCount(summary.totals.lineCount)} lines
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedVendor && onVendorClick ? (
            <button
              type="button"
              onClick={() => onVendorClick("")}
              className="text-xs font-semibold text-red-600 hover:text-red-700"
            >
              Clear filter
            </button>
          ) : null}
          {canToggle ? (
            <button
              type="button"
              onClick={() => setShowAll(previous => !previous)}
              className="text-xs font-semibold text-primary-700 hover:text-primary-800"
            >
              {showAll ? "Show top" : "Show all"}
            </button>
          ) : null}
        </div>
      </div>

      {filterContext && filterContext.activeTab !== "all" ? (
        <div className="flex items-center gap-2 border-b border-slate-100 bg-blue-50/50 px-4 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Filtered</span>
          <span className="text-[11px] text-blue-800">
            {tabLabel(filterContext.activeTab)} tab ({formatCount(lineItems.length)} of {formatCount(filterContext.totalLineItems)} items)
          </span>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <SortHeader label="Vendor" sortKey="vendorName" align="left" />
              <SortHeader label="Lines" sortKey="lineCount" />
              <SortHeader label="Lines Fully Allocated" sortKey="linesFullyAllocated" />
              <SortHeader label="Lines w/ Unallocated" sortKey="lineCountWithUnallocated" />
              <SortHeader label="% Allocated" sortKey="commissionAllocatedPercent" />
              <SortHeader label="Status" sortKey="statusBreakdown" />
              <SortHeader label="Usage Allocated" sortKey="usageAllocated" />
              <SortHeader label="Usage Unallocated" sortKey="usageUnallocated" />
              <SortHeader label="Commission Allocated" sortKey="commissionAllocated" />
              <SortHeader label="Commission Unallocated" sortKey="commissionUnallocated" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map(row => (
              <tr
                key={row.vendorName}
                className={cn(
                  "transition-colors",
                  onVendorClick ? "cursor-pointer" : "",
                  selectedVendor === row.vendorName
                    ? "bg-primary-50 ring-1 ring-inset ring-primary-200"
                    : cn(getRowHighlight(row), "hover:bg-slate-50"),
                )}
                onClick={onVendorClick ? () => onVendorClick(selectedVendor === row.vendorName ? "" : row.vendorName) : undefined}
              >
                <td className="px-3 py-2 text-slate-900">
                  <div className="max-w-[320px] truncate" title={row.vendorName}>
                    {row.vendorName}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{formatCount(row.lineCount)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {formatCount(Math.max(0, row.lineCount - row.lineCountWithUnallocated))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {formatCount(row.lineCountWithUnallocated)}
                </td>
                <td className="px-3 py-2 text-right">
                  <ProgressBar percent={row.commissionAllocatedPercent} />
                </td>
                <td className="px-3 py-2 text-right text-[10px]">
                  <StatusBadges row={row} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {currencyFormatter.format(row.usageAllocated)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {currencyFormatter.format(row.usageUnallocated)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {currencyFormatter.format(row.commissionAllocated)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">
                  {currencyFormatter.format(row.commissionUnallocated)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr className="text-[11px] font-semibold text-slate-800">
              <td className="px-3 py-2 text-left">Total</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCount(summary.totals.lineCount)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCount(Math.max(0, summary.totals.lineCount - summary.totals.lineCountWithUnallocated))}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCount(summary.totals.lineCountWithUnallocated)}
              </td>
              <td className="px-3 py-2 text-right">
                <ProgressBar percent={summary.totals.commissionAllocatedPercent} />
              </td>
              <td className="px-3 py-2 text-right text-[10px]">
                <StatusBadges row={summary.totals} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {currencyFormatter.format(summary.totals.usageAllocated)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {currencyFormatter.format(summary.totals.usageUnallocated)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {currencyFormatter.format(summary.totals.commissionAllocated)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {currencyFormatter.format(summary.totals.commissionUnallocated)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function statusTitle(abbrev: string): string {
  switch (abbrev) {
    case "M": return "Matched"
    case "P": return "Partially Matched"
    case "U": return "Unmatched"
    case "S": return "Suggested"
    case "R": return "Reconciled"
    case "I": return "Ignored"
    default: return abbrev
  }
}
