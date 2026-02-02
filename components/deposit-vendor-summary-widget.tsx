"use client"

import { useMemo, useState } from "react"

import type { DepositLineItemRow } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { buildVendorSummary } from "@/lib/reconciliation/vendor-summary"

export interface DepositVendorSummaryWidgetProps {
  lineItems: DepositLineItemRow[]
  className?: string
  defaultVisibleRows?: number
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
}

export function DepositVendorSummaryWidget({
  lineItems,
  className,
  defaultVisibleRows = 8,
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

  const visibleRows = showAll ? summary.rows : summary.rows.slice(0, Math.max(1, defaultVisibleRows))
  const canToggle = summary.rows.length > defaultVisibleRows

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
        <div className="flex items-baseline gap-2">
          <div className="text-sm font-semibold text-slate-900">Vendor Summary</div>
          <div className="text-xs font-medium text-slate-500">
            {formatCount(summary.totals.vendorCount)} vendors • {formatCount(summary.totals.lineCount)} lines
          </div>
        </div>
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

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Vendor</th>
              <th className="px-3 py-2 text-right">Lines</th>
              <th className="px-3 py-2 text-right">Lines Fully Allocated</th>
              <th className="px-3 py-2 text-right">Lines w/ Unallocated</th>
              <th className="px-3 py-2 text-right">Usage Allocated</th>
              <th className="px-3 py-2 text-right">Usage Unallocated</th>
              <th className="px-3 py-2 text-right">Commission Allocated</th>
              <th className="px-3 py-2 text-right">Commission Unallocated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map(row => (
              <tr key={row.vendorName} className="hover:bg-slate-50">
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
