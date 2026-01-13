"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"
import { useToasts } from "@/components/toast"
import { useAuth } from "@/lib/auth-context"

type AssignmentFilter = "all" | "mine" | "unassigned"

type FlexReviewItem = {
  id: string
  status: string
  flexClassification: string
  flexReasonCode: string | null
  revenueScheduleId: string
  revenueScheduleName: string
  sourceDepositId: string | null
  sourceDepositLineItemId: string | null
  expectedUsage: number | null
  expectedCommission: number | null
  assignedToUserId: string | null
  assignedToName: string | null
  createdAt: string
  resolvedAt: string | null
}

function parseIsoDateMs(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatMoney(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-"
  return value.toFixed(2)
}

export default function FlexReviewQueuePage() {
  const { setBreadcrumbs } = useBreadcrumbs()
  const { user } = useAuth()
  const { showError, showSuccess, ToastContainer } = useToasts()
  const [items, setItems] = useState<FlexReviewItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<string>("Open")
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all")
  const [minAgeDays, setMinAgeDays] = useState<number>(0)
  const [minAbsCommission, setMinAbsCommission] = useState<number>(0)

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

  const myUserId = user?.id ?? null

  const openCount = useMemo(() => items.filter(item => item.status === "Open").length, [items])

  const filteredItems = useMemo(() => {
    const now = Date.now()
    return items.filter(item => {
      if (statusFilter !== "All" && item.status !== statusFilter) return false

      if (assignmentFilter === "mine") {
        if (!myUserId || item.assignedToUserId !== myUserId) return false
      } else if (assignmentFilter === "unassigned") {
        if (item.assignedToUserId) return false
      }

      if (minAgeDays > 0) {
        const createdAtMs = parseIsoDateMs(item.createdAt)
        if (createdAtMs == null) return false
        const ageDays = Math.floor((now - createdAtMs) / (24 * 60 * 60 * 1000))
        if (ageDays < minAgeDays) return false
      }

      if (minAbsCommission > 0) {
        const absCommission = Math.abs(item.expectedCommission ?? 0)
        if (absCommission < minAbsCommission) return false
      }

      return true
    })
  }, [assignmentFilter, items, minAbsCommission, minAgeDays, myUserId, statusFilter])

  const assign = useCallback(
    async (id: string, mode: "assignToMe" | "unassign") => {
      try {
        setBusyId(id)
        const response = await fetch(`/api/flex-review/${encodeURIComponent(id)}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mode === "assignToMe" ? { assignToMe: true } : { unassign: true }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || "Assign failed")
        }
        showSuccess("Updated", "Assignment updated.")
        await load()
      } catch (err) {
        console.error("Assign failed", err)
        showError("Assign failed", err instanceof Error ? err.message : "Assign failed")
      } finally {
        setBusyId(null)
      }
    },
    [load, showError, showSuccess],
  )

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
          <p className="text-sm text-gray-600">{loading ? "Loading..." : `${openCount} open item${openCount === 1 ? "" : "s"}`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded border border-gray-300 bg-white px-2 py-2 text-sm"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            disabled={loading}
          >
            <option value="All">All statuses</option>
            <option value="Open">Open</option>
            <option value="Approved">Approved</option>
            <option value="Resolved">Resolved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <select
            className="rounded border border-gray-300 bg-white px-2 py-2 text-sm"
            value={assignmentFilter}
            onChange={e => setAssignmentFilter(e.target.value as AssignmentFilter)}
            disabled={loading}
          >
            <option value="all">All assignees</option>
            <option value="unassigned">Unassigned</option>
            <option value="mine">Assigned to me</option>
          </select>
          <input
            className="w-28 rounded border border-gray-300 bg-white px-2 py-2 text-sm"
            type="number"
            min={0}
            value={minAgeDays}
            onChange={e => setMinAgeDays(Number(e.target.value) || 0)}
            placeholder="Min age"
            title="Minimum age (days)"
            disabled={loading}
          />
          <input
            className="w-36 rounded border border-gray-300 bg-white px-2 py-2 text-sm"
            type="number"
            min={0}
            value={minAbsCommission}
            onChange={e => setMinAbsCommission(Number(e.target.value) || 0)}
            placeholder="Min $ amt"
            title="Minimum absolute commission amount"
            disabled={loading}
          />
          <button
            onClick={() => void load()}
            className="rounded bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Schedule</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Flex Type</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Flex Reason</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Assigned</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Amount</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Age</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Source</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Created</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-gray-500">
                  {loading ? "Loading..." : "No flex review items found."}
                </td>
              </tr>
            ) : (
              filteredItems.map(item => {
                const isApprovable =
                  item.flexClassification === "FlexChargeback" ||
                  item.flexClassification === "FlexChargebackReversal"
                const canAct = item.status === "Open" && busyId !== item.id
                const createdAtMs = parseIsoDateMs(item.createdAt)
                const ageDays =
                  createdAtMs == null ? null : Math.max(0, Math.floor((Date.now() - createdAtMs) / (24 * 60 * 60 * 1000)))

                const assignmentLabel =
                  item.assignedToName?.trim() ||
                  (item.assignedToUserId ? item.assignedToUserId.slice(0, 8) : "-")

                const canAssignToMe = Boolean(myUserId) && item.status === "Open"
                const assignmentAction =
                  item.assignedToUserId && item.assignedToUserId === myUserId
                    ? { label: "Unassign", mode: "unassign" as const }
                    : { label: item.assignedToUserId ? "Take" : "Assign to me", mode: "assignToMe" as const }

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
                    <td className="px-3 py-2 text-xs text-gray-700">{assignmentLabel}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-700">
                      {formatMoney(item.expectedCommission)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-700">
                      {ageDays == null ? "-" : `${ageDays}d`}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {item.sourceDepositId ? (
                        <Link
                          className="text-blue-600 hover:text-blue-800"
                          href={`/reconciliation/${encodeURIComponent(item.sourceDepositId)}`}
                        >
                          Deposit {item.sourceDepositId}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{item.createdAt.slice(0, 10)}</td>
                    <td className="px-3 py-2 text-right">
                      {busyId === item.id ? (
                        <span className="text-xs text-gray-500">Working...</span>
                      ) : item.status !== "Open" ? (
                        <span className="text-xs text-gray-500">-</span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          {canAssignToMe ? (
                            <button
                              className="rounded bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                              onClick={() => void assign(item.id, assignmentAction.mode)}
                              disabled={!canAct}
                            >
                              {assignmentAction.label}
                            </button>
                          ) : null}
                          {isApprovable ? (
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
                        </div>
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

