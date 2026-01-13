"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"
import { useToasts } from "@/components/toast"

type FlexReviewItem = {
  id: string
  status: string
  flexClassification: string
  flexReasonCode: string | null
  revenueScheduleId: string
  revenueScheduleName: string
  sourceDepositId: string | null
  sourceDepositLineItemId: string | null
  createdAt: string
  resolvedAt: string | null
}

export default function FlexReviewQueuePage() {
  const { setBreadcrumbs } = useBreadcrumbs()
  const { showError, showSuccess, ToastContainer } = useToasts()
  const [items, setItems] = useState<FlexReviewItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    setBreadcrumbs([
      { name: "Home", href: "/dashboard" },
      { name: "Reconciliation", href: "/reconciliation" },
      { name: "Flex Review Queue", href: "/reconciliation/flex-review", current: true },
    ])
    return () => setBreadcrumbs(null)
  }, [setBreadcrumbs])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/flex-review", { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load flex review queue")
      }
      setItems(Array.isArray(payload?.data) ? payload.data : [])
    } catch (err) {
      console.error("Failed to load flex review queue", err)
      showError("Load failed", err instanceof Error ? err.message : "Failed to load flex review queue")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    void load()
  }, [load])

  const openItems = useMemo(() => items.filter(item => item.status === "Open"), [items])

  const approveAndApply = useCallback(
    async (id: string) => {
      try {
        setBusyId(id)
        const response = await fetch(`/api/flex-review/${encodeURIComponent(id)}/approve-and-apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || "Approve failed")
        }
        showSuccess("Approved", "Flex review item approved.")
        await load()
      } catch (err) {
        console.error("Approve failed", err)
        showError("Approve failed", err instanceof Error ? err.message : "Approve failed")
      } finally {
        setBusyId(null)
      }
    },
    [load, showError, showSuccess],
  )

  const resolve = useCallback(
    async (id: string) => {
      try {
        setBusyId(id)
        const response = await fetch(`/api/flex-review/${encodeURIComponent(id)}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Resolved" }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || "Resolve failed")
        }
        showSuccess("Resolved", "Flex review item resolved.")
        await load()
      } catch (err) {
        console.error("Resolve failed", err)
        showError("Resolve failed", err instanceof Error ? err.message : "Resolve failed")
      } finally {
        setBusyId(null)
      }
    },
    [load, showError, showSuccess],
  )

  return (
    <div className="p-6">
      <ToastContainer />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Flex Review Queue</h1>
          <p className="text-sm text-gray-600">
            {loading ? "Loading…" : `${openItems.length} open item${openItems.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Schedule</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Flex Type</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Flex Reason</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Source</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Created</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  {loading ? "Loading…" : "No flex review items found."}
                </td>
              </tr>
            ) : (
              items.map(item => {
                const isApprovable =
                  item.flexClassification === "FlexChargeback" ||
                  item.flexClassification === "FlexChargebackReversal"
                const canAct = item.status === "Open" && busyId !== item.id
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{item.status}</td>
                    <td className="px-3 py-2">
                      <Link
                        className="text-blue-600 hover:text-blue-800"
                        href={`/revenue-schedules/${encodeURIComponent(item.revenueScheduleId)}`}
                      >
                        {item.revenueScheduleName}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{item.flexClassification}</td>
                    <td className="px-3 py-2">{item.flexReasonCode ?? "-"}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {item.sourceDepositId ? `Deposit ${item.sourceDepositId}` : "-"}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{item.createdAt.slice(0, 10)}</td>
                    <td className="px-3 py-2 text-right">
                      {busyId === item.id ? (
                        <span className="text-xs text-gray-500">Working…</span>
                      ) : item.status !== "Open" ? (
                        <span className="text-xs text-gray-500">—</span>
                      ) : isApprovable ? (
                        <button
                          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          onClick={() => void approveAndApply(item.id)}
                          disabled={!canAct}
                        >
                          Approve & Apply
                        </button>
                      ) : (
                        <button
                          className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                          onClick={() => void resolve(item.id)}
                          disabled={!canAct}
                        >
                          Mark Resolved
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

