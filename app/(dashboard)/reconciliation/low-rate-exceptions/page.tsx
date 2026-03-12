"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import { useBreadcrumbs } from "@/lib/breadcrumb-context"

type LowRateExceptionRow = {
  ticketId: string
  scheduleId: string
  scheduleNumber: string
  scheduleDate: string | null
  billingStatus: string
  billingStatusReason: string
  expectedCommissionRatePercent: number | null
  distributorName: string
  vendorName: string
  ticketStatus: string
  ticketPriority: string
  ticketSeverity: string
  createdAt: string
  updatedAt: string
  notes: string
  queuePath: string
}

function formatDate(value: string | null) {
  if (!value) return "-"
  return value.slice(0, 10)
}

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-"
  return `${value.toFixed(2)}%`
}

export default function LowRateExceptionsPage() {
  const { setBreadcrumbs } = useBreadcrumbs()
  const [rows, setRows] = useState<LowRateExceptionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [includeResolved, setIncludeResolved] = useState(false)

  useEffect(() => {
    setBreadcrumbs([
      { name: "Home", href: "/dashboard" },
      { name: "Reconciliation", href: "/reconciliation" },
      { name: "Low-Rate Exceptions", href: "/reconciliation/low-rate-exceptions", current: true },
    ])
    return () => setBreadcrumbs(null)
  }, [setBreadcrumbs])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set("q", query.trim())
      if (includeResolved) params.set("includeResolved", "true")
      const response = await fetch(`/api/reconciliation/low-rate-exceptions?${params.toString()}`, {
        cache: "no-store",
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load low-rate exceptions")
      }
      setRows(Array.isArray(payload?.data) ? payload.data : [])
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : "Failed to load low-rate exceptions")
    } finally {
      setLoading(false)
    }
  }, [includeResolved, query])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo(() => {
    const openCount = rows.filter(row => ["Open", "InProgress", "Waiting"].includes(row.ticketStatus)).length
    return {
      total: rows.length,
      openCount,
    }
  }, [rows])

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2f6fe4]">
              Reconciliation Queue
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Low-Rate Exceptions</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Review schedules that were flagged because the received commission rate was lower than expected.
              Each row ties the disputed schedule to its investigation ticket.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open / Waiting</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.openCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Rows</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.total}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search schedule, vendor, distributor, or ticket notes"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 lg:max-w-xl"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeResolved}
              onChange={event => setIncludeResolved(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Show resolved tickets
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl bg-[#2f6fe4] px-4 py-3 text-sm font-semibold text-white hover:bg-[#245dd1]"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Expected Rate</th>
                <th className="px-4 py-3">Distributor</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Loading low-rate exceptions...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No low-rate exceptions found.
                  </td>
                </tr>
              ) : (
                rows.map(row => (
                  <tr key={row.ticketId} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{row.scheduleNumber || row.scheduleId}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.billingStatusReason}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(row.scheduleDate)}</td>
                    <td className="px-4 py-4 text-slate-600">{formatPercent(row.expectedCommissionRatePercent)}</td>
                    <td className="px-4 py-4 text-slate-600">{row.distributorName || "-"}</td>
                    <td className="px-4 py-4 text-slate-600">{row.vendorName || "-"}</td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{row.ticketStatus}</div>
                      <div className="mt-1">
                        <Link href={`/tickets/${row.ticketId}`} className="text-xs font-semibold text-[#2f6fe4] hover:underline">
                          Open ticket
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      <div>{row.ticketPriority}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.ticketSeverity}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(row.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
