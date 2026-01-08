"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"

export type ReconciliationUserSettings = {
  suggestedMatchesMinConfidence: number
  autoMatchMinConfidence: number
}

interface UseReconciliationUserSettingsResult {
  settings: ReconciliationUserSettings | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  save: (updates: Partial<ReconciliationUserSettings>) => Promise<void>
}

export function useReconciliationUserSettings(): UseReconciliationUserSettingsResult {
  const { user } = useAuth()
  const [settings, setSettings] = useState<ReconciliationUserSettings | null>(null)
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
      const response = await fetch("/api/reconciliation/user-settings", { cache: "no-store" })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Unable to load reconciliation user settings")
      }
      const payload = await response.json()
      setSettings(payload?.data ?? null)
    } catch (err) {
      console.error("Failed to load reconciliation user settings", err)
      setError(err instanceof Error ? err.message : "Unable to load reconciliation user settings")
      setSettings(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  const save = useCallback(
    async (updates: Partial<ReconciliationUserSettings>) => {
      if (!user) throw new Error("Not authenticated")
      try {
        setLoading(true)
        setError(null)
        const response = await fetch("/api/reconciliation/user-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to save reconciliation user settings")
        }
        setSettings(payload?.data ?? null)
      } catch (err) {
        console.error("Failed to save reconciliation user settings", err)
        setError(err instanceof Error ? err.message : "Unable to save reconciliation user settings")
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
