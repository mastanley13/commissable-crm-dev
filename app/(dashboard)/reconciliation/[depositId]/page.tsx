"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import {
  DepositReconciliationDetailView,
  type DepositReconciliationMetadata,
  type AutoMatchSummary,
} from "@/components/deposit-reconciliation-detail-view"
import {
  depositDetailMetadataMock,
  type DepositLineItemRow,
  type SuggestedMatchScheduleRow,
} from "@/lib/mock-data"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"
import {
  AutoMatchPreviewModal,
  type AutoMatchPreviewSummary,
} from "@/components/auto-match-preview-modal"
import { useReconciliationSettings } from "@/hooks/useReconciliationSettings"

type EngineMode = "env" | "legacy" | "hierarchical"

interface DepositDetailResponse {
  metadata: DepositReconciliationMetadata
  lineItems: DepositLineItemRow[]
}

export default function DepositReconciliationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { setBreadcrumbs } = useBreadcrumbs()

  const depositParam = useMemo(() => {
    const raw = params?.depositId
    if (typeof raw === "string") return raw
    if (Array.isArray(raw) && raw.length > 0) return raw[0]!
    return ""
  }, [params])

  const [metadata, setMetadata] = useState<DepositReconciliationMetadata | null>(null)
  const [lineItems, setLineItems] = useState<DepositLineItemRow[]>([])
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const [scheduleCandidates, setScheduleCandidates] = useState<SuggestedMatchScheduleRow[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [candidatesLoading, setCandidatesLoading] = useState<boolean>(false)
  const [candidatesError, setCandidatesError] = useState<string | null>(null)
  const [detailRefresh, setDetailRefresh] = useState(0)
  const [candidatesRefresh, setCandidatesRefresh] = useState(0)
  const [autoMatchLoading, setAutoMatchLoading] = useState(false)
  const [autoMatchSummary, setAutoMatchSummary] = useState<AutoMatchSummary | null>(null)
  const [autoMatchError, setAutoMatchError] = useState<string | null>(null)
  const [autoMatchPreviewOpen, setAutoMatchPreviewOpen] = useState(false)
  const [autoMatchPreviewLoading, setAutoMatchPreviewLoading] = useState(false)
  const [autoMatchPreview, setAutoMatchPreview] = useState<AutoMatchPreviewSummary | null>(null)
  const [autoMatchPreviewError, setAutoMatchPreviewError] = useState<string | null>(null)
  const [finalizeLoading, setFinalizeLoading] = useState(false)
  const [unfinalizeLoading, setUnfinalizeLoading] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const {
    settings: reconciliationSettings,
    loading: reconciliationSettingsLoading,
    error: reconciliationSettingsError,
    refresh: refreshReconciliationSettings,
    save: saveReconciliationSettings,
  } = useReconciliationSettings()
  const [includeFutureSchedules, setIncludeFutureSchedules] = useState(false)
  const [engineModeSetting, setEngineModeSetting] = useState<EngineMode>("env")
  const [varianceToleranceSetting, setVarianceToleranceSetting] = useState<number>(0)
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [engineMode, setEngineMode] = useState<EngineMode>("env")

  useEffect(() => {
    if (!reconciliationSettings) return
    setIncludeFutureSchedules(reconciliationSettings.includeFutureSchedulesDefault ?? false)
    setEngineModeSetting(reconciliationSettings.engineMode ?? "env")
    setVarianceToleranceSetting(reconciliationSettings.varianceTolerance ?? 0)
    setEngineMode(reconciliationSettings.engineMode ?? "env")
  }, [reconciliationSettings])

  useEffect(() => {
    if (!depositParam) return
    let cancelled = false
    const controller = new AbortController()

    const loadDetail = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/reconciliation/deposits/${encodeURIComponent(depositParam)}/detail`, {
          cache: "no-store",
          signal: controller.signal
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load deposit detail")
        }
        if (cancelled) return
        const data = (payload?.data ?? {}) as DepositDetailResponse
        setMetadata(data.metadata ?? null)
        const normalizedLineItems = Array.isArray(data.lineItems) ? data.lineItems : []
        setLineItems(normalizedLineItems)
        if (normalizedLineItems.length > 0) {
          setSelectedLineId(normalizedLineItems[0]!.id)
        } else {
          setSelectedLineId(null)
        }
      } catch (err: unknown) {
        if (cancelled) return
        console.error("Failed to load deposit detail", err)
        setError(err instanceof Error ? err.message : "Unable to load deposit detail")
        setMetadata(null)
        setLineItems([])
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [depositParam, detailRefresh])

  const breadcrumbName = metadata?.depositName ?? depositDetailMetadataMock.depositName

  useEffect(() => {
    setBreadcrumbs([
      { name: "Home", href: "/dashboard" },
      { name: "Reconciliation", href: "/reconciliation" },
      {
        name: "Deposit Detail",
        href: depositParam ? `/reconciliation/${depositParam}` : "/reconciliation"
      },
      { name: breadcrumbName, current: true }
    ])

    return () => {
      setBreadcrumbs(null)
    }
  }, [depositParam, breadcrumbName, setBreadcrumbs])

  const resolvedMetadata: DepositReconciliationMetadata = metadata ?? {
    ...depositDetailMetadataMock,
    id: depositParam || depositDetailMetadataMock.id
  }

  useEffect(() => {
    if (!depositParam || !selectedLineId) {
      setScheduleCandidates([])
      return
    }
    let cancelled = false
    const controller = new AbortController()

    const loadCandidates = async () => {
      setCandidatesLoading(true)
      setCandidatesError(null)
      try {
        const searchParams = new URLSearchParams()
        if (includeFutureSchedules) {
          searchParams.set("includeFutureSchedules", "true")
        }
        if (engineMode === "legacy") {
          searchParams.set("useHierarchicalMatching", "false")
        } else if (engineMode === "hierarchical") {
          searchParams.set("useHierarchicalMatching", "true")
        }
        const query = searchParams.toString()
        const response = await fetch(
          `/api/reconciliation/deposits/${encodeURIComponent(
            depositParam,
          )}/line-items/${encodeURIComponent(selectedLineId)}/candidates${query ? `?${query}` : ""}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        )
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load suggested matches")
        }
        if (cancelled) return
        const data = Array.isArray(payload?.data) ? (payload.data as SuggestedMatchScheduleRow[]) : []
        setScheduleCandidates(data)
      } catch (err: unknown) {
        if (cancelled) return
        console.error("Failed to load schedule candidates", err)
        setCandidatesError(err instanceof Error ? err.message : "Unable to load suggested matches")
        setScheduleCandidates([])
      } finally {
        if (!cancelled) {
          setCandidatesLoading(false)
        }
      }
    }

    void loadCandidates()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    depositParam,
    selectedLineId,
    candidatesRefresh,
    engineMode,
    includeFutureSchedules,
  ])

  const handleLineSelect = useCallback((lineId: string | null) => {
    setSelectedLineId(lineId)
  }, [])

  const handleMatchMutation = useCallback(() => {
    setDetailRefresh(previous => previous + 1)
    setCandidatesRefresh(previous => previous + 1)
  }, [])

  const handleRequestAutoMatchPreview = useCallback(async () => {
    if (!depositParam) return
    setAutoMatchPreviewOpen(true)
    setAutoMatchPreviewLoading(true)
    setAutoMatchPreviewError(null)
    setAutoMatchPreview(null)
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositParam)}/auto-match/preview`,
        {
          method: "POST",
          cache: "no-store",
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load AI matching preview")
      }
      const summary = (payload?.data ?? null) as AutoMatchPreviewSummary | null
      setAutoMatchPreview(summary)
    } catch (err) {
      console.error("AI Matching preview failed", err)
      setAutoMatchPreviewError(err instanceof Error ? err.message : "Unable to load AI matching preview")
    } finally {
      setAutoMatchPreviewLoading(false)
    }
  }, [depositParam])

  const executeAutoMatch = useCallback(async () => {
    if (!depositParam) return false
    setAutoMatchLoading(true)
    setAutoMatchSummary(null)
    setAutoMatchError(null)
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositParam)}/auto-match`,
        {
          method: "POST",
          cache: "no-store",
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to run AI matching")
      }
      const summary = (payload?.data ?? null) as AutoMatchSummary | null
      setAutoMatchSummary(summary)
      setDetailRefresh(previous => previous + 1)
      setCandidatesRefresh(previous => previous + 1)
      return true
    } catch (err) {
      console.error("Run AI Matching failed", err)
      setAutoMatchError(err instanceof Error ? err.message : "Unable to run AI matching")
      return false
    } finally {
      setAutoMatchLoading(false)
    }
  }, [depositParam])

  const handleConfirmAutoMatch = useCallback(async () => {
    const success = await executeAutoMatch()
    if (success) {
      setAutoMatchPreviewOpen(false)
      setAutoMatchPreview(null)
    }
  }, [executeAutoMatch])

  const handleCancelAutoMatchPreview = useCallback(() => {
    if (autoMatchLoading) return
    setAutoMatchPreviewOpen(false)
    setAutoMatchPreviewError(null)
  }, [autoMatchLoading])

  const handleFinalizeDeposit = useCallback(async () => {
    if (!depositParam) return
    setFinalizeLoading(true)
    setFinalizeError(null)
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositParam)}/finalize`,
        {
          method: "POST",
          cache: "no-store",
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to finalize deposit")
      }
      setDetailRefresh(previous => previous + 1)
    } catch (err) {
      console.error("Finalize deposit failed", err)
      setFinalizeError(err instanceof Error ? err.message : "Unable to finalize deposit")
    } finally {
      setFinalizeLoading(false)
    }
  }, [depositParam])

  const handleUnfinalizeDeposit = useCallback(async () => {
    if (!depositParam) return
    setFinalizeError(null)
    setUnfinalizeLoading(true)
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositParam)}/unfinalize`,
        {
          method: "POST",
          cache: "no-store",
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to reopen deposit")
      }
      setDetailRefresh(previous => previous + 1)
    } catch (err) {
      console.error("Unfinalize deposit failed", err)
      setFinalizeError(err instanceof Error ? err.message : "Unable to reopen deposit")
    } finally {
      setUnfinalizeLoading(false)
    }
  }, [depositParam])

  const handleSaveReconciliationSettings = useCallback(async () => {
    setSettingsMessage(null)
    setSettingsSaving(true)
    try {
      await saveReconciliationSettings({
        includeFutureSchedulesDefault: includeFutureSchedules,
        varianceTolerance: varianceToleranceSetting,
        engineMode: engineModeSetting,
      })
      setSettingsMessage("Reconciliation settings saved")
      setCandidatesRefresh(previous => previous + 1)
      void refreshReconciliationSettings()
      setSettingsModalOpen(false)
    } catch (err) {
      setSettingsMessage(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSettingsSaving(false)
    }
  }, [
    saveReconciliationSettings,
    includeFutureSchedules,
    varianceToleranceSetting,
    engineModeSetting,
    refreshReconciliationSettings,
  ])

  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      {error ? (
        <div className="p-4 text-sm text-red-600">{error}</div>
      ) : null}
      {candidatesError ? (
        <div className="px-4 text-xs text-amber-600">{candidatesError}</div>
      ) : null}
      {autoMatchError ? (
        <div className="px-4 text-xs text-red-500">{autoMatchError}</div>
      ) : null}
      {finalizeError ? (
        <div className="px-4 text-xs text-red-500">{finalizeError}</div>
      ) : null}
      {reconciliationSettingsError ? (
        <div className="px-4 text-xs text-amber-600">{reconciliationSettingsError}</div>
      ) : null}
      <div className="flex items-center justify-end px-4 pb-2">
        <button
          type="button"
          onClick={() => router.push('/reconciliation')}
          className="inline-flex items-center rounded border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          ← Back to Reconciliation
        </button>
      </div>
      <DepositReconciliationDetailView
        metadata={resolvedMetadata}
        lineItems={metadata ? lineItems : []}
        schedules={scheduleCandidates}
        loading={loading || (!metadata && !error)}
        scheduleLoading={candidatesLoading}
        selectedLineId={selectedLineId}
        onLineSelectionChange={handleLineSelect}
        onMatchApplied={handleMatchMutation}
        onUnmatchApplied={handleMatchMutation}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onRunAutoMatch={handleRequestAutoMatchPreview}
        autoMatchLoading={autoMatchLoading || autoMatchPreviewLoading}
        autoMatchSummary={autoMatchSummary}
        onFinalizeDeposit={handleFinalizeDeposit}
        finalizeLoading={finalizeLoading}
        onUnfinalizeDeposit={handleUnfinalizeDeposit}
        unfinalizeLoading={unfinalizeLoading}
      />
      <AutoMatchPreviewModal
        isOpen={autoMatchPreviewOpen}
        loading={autoMatchPreviewLoading}
        preview={autoMatchPreview}
        error={autoMatchPreviewError}
        onConfirm={handleConfirmAutoMatch}
        onCancel={handleCancelAutoMatchPreview}
        confirmLoading={autoMatchLoading}
      />

      {settingsModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
          onClick={() => setSettingsModalOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white shadow-xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Reconciliation Settings</h2>
                <p className="text-xs text-slate-500">Tenant defaults and session overrides.</p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-800">
                <span>Include future-dated schedules</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-primary-600"
                  checked={includeFutureSchedules}
                  onChange={event => setIncludeFutureSchedules(event.target.checked)}
                />
              </label>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-800">Variance tolerance (percent)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.1}
                    value={Number((varianceToleranceSetting * 100).toFixed(2))}
                    onChange={event => {
                      const raw = Number(event.target.value)
                      if (Number.isFinite(raw)) {
                        setVarianceToleranceSetting(Math.max(0, Math.min(30, raw)) / 100)
                      }
                    }}
                    className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-slate-500">
                    Stored per tenant. Used by Pass A and auto-match.
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-800">Engine mode default</label>
                <select
                  value={engineModeSetting}
                  onChange={event => setEngineModeSetting(event.target.value as EngineMode)}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                >
                  <option value="env">Use environment default</option>
                  <option value="hierarchical">Hierarchical (Pass A/B)</option>
                  <option value="legacy">Legacy (single-pass)</option>
                </select>
              </div>

              <div className="space-y-2 rounded-lg border border-dashed border-slate-200 p-3">
                <div className="text-sm font-semibold text-slate-800">Matching dev controls (session)</div>
                <div className="text-xs text-slate-500">Applies only to this page session.</div>
                <div className="flex flex-wrap gap-2">
                  {(["env", "legacy", "hierarchical"] as EngineMode[]).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setEngineMode(mode)}
                      className={
                        mode === engineMode
                          ? "rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white"
                          : "rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      }
                    >
                      {mode === "env" ? "Env default" : mode === "legacy" ? "Legacy" : "Hierarchical"}
                    </button>
                  ))}
                </div>
              </div>

              {settingsMessage ? (
                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  {settingsMessage}
                </div>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="rounded border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={settingsSaving || reconciliationSettingsLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveReconciliationSettings()}
                disabled={settingsSaving || reconciliationSettingsLoading}
                className="rounded bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {settingsSaving ? "Saving..." : "Save settings"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </CopyProtectionWrapper>
  )
}
