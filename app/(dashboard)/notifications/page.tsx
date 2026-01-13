"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"
import { useToasts } from "@/components/toast"

type NotificationItem = {
  id: string
  title: string
  body: string | null
  createdAt: string
  readAt: string | null
  metadata: any
}

export default function NotificationsPage() {
  const { setBreadcrumbs } = useBreadcrumbs()
  const { showError, showSuccess, ToastContainer } = useToasts()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setBreadcrumbs([
      { name: "Home", href: "/dashboard" },
      { name: "Notifications", href: "/notifications", current: true },
    ])
    return () => setBreadcrumbs(null)
  }, [setBreadcrumbs])

  const load = useCallback(
    async (includeRead: boolean) => {
      setLoading(true)
      try {
        const response = await fetch(`/api/notifications?includeRead=${includeRead ? "true" : "false"}`, {
          cache: "no-store",
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load notifications")
        }
        setItems(Array.isArray(payload?.data) ? payload.data : [])
      } catch (err) {
        console.error("Failed to load notifications", err)
        showError("Load failed", err instanceof Error ? err.message : "Failed to load notifications")
        setItems([])
      } finally {
        setLoading(false)
      }
    },
    [showError],
  )

  useEffect(() => {
    void load(true)
  }, [load])

  const unreadCount = useMemo(() => items.filter(n => !n.readAt).length, [items])

  const markAllRead = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to mark read")
      }
      showSuccess("Marked read", "All notifications marked as read.")
      await load(true)
    } catch (err) {
      console.error("Mark all read failed", err)
      showError("Update failed", err instanceof Error ? err.message : "Failed to mark read")
    }
  }, [load, showError, showSuccess])

  return (
    <div className="p-6">
      <ToastContainer />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-600">{loading ? "Loading..." : `${unreadCount} unread`}</p>
        </div>
        <button
          onClick={() => void markAllRead()}
          className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          disabled={loading || items.length === 0}
        >
          Mark all read
        </button>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-600">
            {loading ? "Loading..." : "No notifications."}
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              className={`rounded border p-4 ${item.readAt ? "border-gray-200 bg-white" : "border-blue-200 bg-blue-50"}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-gray-900">{item.title}</div>
                <div className="text-xs text-gray-500">{item.createdAt.slice(0, 10)}</div>
              </div>
              {item.body ? <div className="mt-1 text-sm text-gray-700">{item.body}</div> : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

