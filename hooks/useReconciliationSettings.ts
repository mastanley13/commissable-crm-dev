"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"

export type ReconciliationSettings = {
  varianceTolerance: number
  includeFutureSchedulesDefault: boolean
  engineMode: "env" | "legacy" | "hierarchical"
  finalizeDisputedDepositsPolicy: "block_all" | "allow_manager_admin" | "allow_all"
}

interface UseReconciliationSettingsResult {
  settings: ReconciliationSettings | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  save: (updates: Partial<ReconciliationSettings>) => Promise<void>
}

export function useReconciliationSettings(): UseReconciliationSettingsResult {
  const { user } = useAuth()
  const [settings, setSettings] = useState<ReconciliationSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setSettings(null)
      setError("Not authenticated")
      return
    }

    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/reconciliation/settings", { cache: "no-store" })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Unable to load reconciliation settings")
      }
      const payload = await response.json()
      setSettings(payload?.data ?? null)
    } catch (err) {
      console.error("Failed to load reconciliation settings", err)
      setError(err instanceof Error ? err.message : "Unable to load reconciliation settings")
      setSettings(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  const save = useCallback(
    async (updates: Partial<ReconciliationSettings>) => {
      if (!user) throw new Error("Not authenticated")
      try {
        setLoading(true)
        setError(null)
        const response = await fetch("/api/reconciliation/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to save reconciliation settings")
        }
        setSettings(payload?.data ?? null)
      } catch (err) {
        console.error("Failed to save reconciliation settings", err)
        setError(err instanceof Error ? err.message : "Unable to save reconciliation settings")
        throw err
      } finally {
        setLoading(false)
      }
    },
    [user],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { settings, loading, error, refresh, save }
}
