"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"
import type { AutoMatchPreviewSummary } from "@/components/auto-match-preview-modal"
import type { AutoMatchSummary } from "@/components/deposit-reconciliation-detail-view"

const formatCurrency = (value: number) => `$${value.toFixed(2)}`

export default function AutoMatchPage() {
  const params = useParams()
  const router = useRouter()
  const { setBreadcrumbs } = useBreadcrumbs()

  const depositParam = useMemo(() => {
    const raw = params?.depositId
    if (typeof raw === "string") return raw
    if (Array.isArray(raw) && raw.length > 0) return raw[0]!
    return ""
  }, [params])

  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [preview, setPreview] = useState<AutoMatchPreviewSummary | null>(null)
  const [applyLoading, setApplyLoading] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applySummary, setApplySummary] = useState<AutoMatchSummary | null>(null)
  const [depositName, setDepositName] = useState<string | null>(null)
  const [metadataLoading, setMetadataLoading] = useState(false)

  useEffect(() => {
    setBreadcrumbs([
      { name: "Home", href: "/dashboard" },
      { name: "Reconciliation", href: "/reconciliation" },
      { name: "Deposit Detail", href: depositParam ? `/reconciliation/${depositParam}` : "/reconciliation" },
      { name: "Run AI Matching", current: true },
    ])

    return () => {
      setBreadcrumbs(null)
    }
  }, [depositParam, setBreadcrumbs])

  useEffect(() => {
    if (!depositParam) return
    let cancelled = false
    const controller = new AbortController()

    const loadMetadata = async () => {
      setMetadataLoading(true)
      try {
        const response = await fetch(`/api/reconciliation/deposits/${encodeURIComponent(depositParam)}/detail`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load deposit detail")
        }
        if (cancelled) return
        const name = payload?.data?.metadata?.depositName
        if (typeof name === "string" && name.trim()) {
          setDepositName(name)
        }
      } catch (err) {
        if (cancelled) return
        console.error("Failed to load deposit detail", err)
      } finally {
        if (!cancelled) {
          setMetadataLoading(false)
        }
      }
    }

    void loadMetadata()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [depositParam])

  const loadPreview = useCallback(async () => {
    if (!depositParam) return
    setPreviewLoading(true)
    setPreviewError(null)
    setPreview(null)
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
      setPreview(summary)
    } catch (err) {
      console.error("AI Matching preview failed", err)
      setPreviewError(err instanceof Error ? err.message : "Unable to load AI matching preview")
    } finally {
      setPreviewLoading(false)
    }
  }, [depositParam])

  useEffect(() => {
    void loadPreview()
  }, [loadPreview])

  const handleApplyMatches = useCallback(async () => {
    if (!depositParam) return
    setApplyLoading(true)
    setApplyError(null)
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
      setApplySummary(summary)
      await loadPreview()
    } catch (err) {
      console.error("Run AI Matching failed", err)
      setApplyError(err instanceof Error ? err.message : "Unable to run AI matching")
    } finally {
      setApplyLoading(false)
    }
  }, [depositParam, loadPreview])

  const handleBackToDeposit = useCallback(() => {
    if (depositParam) {
      router.push(`/reconciliation/${depositParam}`)
    } else {
      router.push("/reconciliation")
    }
  }, [depositParam, router])

  const hasCandidates = Boolean(preview?.autoMatchCandidates?.length)

  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBackToDeposit}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Back to deposit
            </button>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Run AI Matching</div>
              <div className="text-lg font-semibold text-slate-900">{depositName || depositParam || "Deposit"}</div>
              <div className="text-xs text-slate-500">
                Preview matches at your confidence threshold, apply them, then return to finalize reconciliation.
              </div>
            </div>
          </div>
          {metadataLoading ? (
            <div className="text-xs text-slate-500">Loading deposit…</div>
          ) : null}
        </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <p className="text-sm text-slate-700">
              Review the lines eligible for automatic matching. Matches at or above your confidence threshold are applied automatically.
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              <li>Preview matches that meet your confidence threshold.</li>
              <li>Apply matches, then review remaining suggestions manually.</li>
              <li>Confirm allocations, then finalize the deposit.</li>
            </ol>
          </div>

          <div className="px-6 py-5">
            {previewError ? (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {previewError}
              </div>
            ) : null}
            {applyError ? (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {applyError}
              </div>
            ) : null}
            {applySummary ? (
              <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Auto-matched <span className="font-semibold">{applySummary.autoMatched}</span> of{" "}
                <span className="font-semibold">{applySummary.processed}</span> lines · Already matched:{" "}
                {applySummary.alreadyMatched} · Below threshold: {applySummary.belowThreshold} · No candidates:{" "}
                {applySummary.noCandidates} · Errors: {applySummary.errors}
              </div>
            ) : null}

            {previewLoading ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-200 text-sm text-slate-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-primary-400" />
                Loading preview…
              </div>
            ) : preview ? (
              <>
                <div className="text-xs text-slate-600">
                  Processed {preview.processed} lines · Already matched: {preview.alreadyMatched} · Eligible for
                  auto-match: {preview.autoMatchCandidates.length} · Below threshold: {preview.belowThreshold} · No candidates:{" "}
                  {preview.noCandidates} · Errors: {preview.errors}
                </div>
                {hasCandidates ? (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Line</th>
                          <th className="px-3 py-2 text-left">Account</th>
                          <th className="px-3 py-2 text-left">Usage</th>
                          <th className="px-3 py-2 text-left">Commission</th>
                          <th className="px-3 py-2 text-left">Schedule</th>
                          <th className="px-3 py-2 text-left">Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {preview.autoMatchCandidates.map(candidate => (
                          <tr key={candidate.lineId}>
                            <td className="px-3 py-2 text-slate-900">{candidate.lineNumber ?? "—"}</td>
                            <td className="px-3 py-2 text-slate-700">{candidate.accountName}</td>
                            <td className="px-3 py-2 text-slate-700">{formatCurrency(candidate.usage)}</td>
                            <td className="px-3 py-2 text-slate-700">{formatCurrency(candidate.commission)}</td>
                            <td className="px-3 py-2 text-slate-700">
                              <div className="font-medium text-slate-900">{candidate.scheduleName}</div>
                              {candidate.reasons.length ? (
                                <div className="text-xs text-slate-500">{candidate.reasons.slice(0, 2).join(" · ")}</div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 font-semibold text-primary-600">
                              {(candidate.confidence * 100).toFixed(0)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">
                    No lines qualify for automatic matching at your threshold. Review suggestions manually.
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">
                Start by loading a preview to see which lines qualify for automatic matching.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={handleBackToDeposit}
              className="rounded border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              disabled={applyLoading}
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadPreview}
                disabled={previewLoading || applyLoading || !depositParam}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refresh preview
              </button>
              <button
                type="button"
                onClick={handleApplyMatches}
                disabled={applyLoading || previewLoading || !hasCandidates}
                className="rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-200 disabled:text-white"
              >
                {applyLoading ? "Applying…" : "Apply matches"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </CopyProtectionWrapper>
  )
}

