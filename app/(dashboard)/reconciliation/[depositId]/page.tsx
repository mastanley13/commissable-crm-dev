"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { CopyProtectionWrapper } from "@/components/copy-protection"
import { DepositReconciliationDetailView, type DepositReconciliationMetadata } from "@/components/deposit-reconciliation-detail-view"
import { depositDetailMetadataMock, type DepositLineItemRow, type SuggestedMatchScheduleRow } from "@/lib/mock-data"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"
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
  const [unfinalizeLoading, setUnfinalizeLoading] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [includeFutureSchedules, setIncludeFutureSchedules] = useState(false)

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
        setSelectedLineId(previous => {
          if (previous && normalizedLineItems.some(item => item.id === previous)) {
            return previous
          }
          return null
        })
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
        // Force hierarchical matching as the only engine
        searchParams.set("useHierarchicalMatching", "true")
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
    includeFutureSchedules,
  ])

  const handleLineSelect = useCallback((lineId: string | null) => {
    setSelectedLineId(lineId)
  }, [])

  const handleIncludeFutureSchedulesChange = useCallback((checked: boolean) => {
    setIncludeFutureSchedules(checked)
    setCandidatesRefresh(previous => previous + 1)
  }, [])

  const handleMatchMutation = useCallback(() => {
    setDetailRefresh(previous => previous + 1)
    setCandidatesRefresh(previous => previous + 1)
  }, [])

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

  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      {error ? (
        <div className="p-4 text-sm text-red-600">{error}</div>
      ) : null}
      {candidatesError ? (
        <div className="px-4 text-xs text-amber-600">{candidatesError}</div>
      ) : null}
      {finalizeError ? (
        <div className="px-4 text-xs text-red-500">{finalizeError}</div>
      ) : null}
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
        onRunAutoMatch={
          depositParam ? () => router.push(`/reconciliation/${depositParam}/ai-matching`) : undefined
        }
        onOpenFinalizeDepositReview={
          depositParam ? () => router.push(`/reconciliation/${depositParam}/finalize`) : undefined
        }
        onUnfinalizeDeposit={handleUnfinalizeDeposit}
        unfinalizeLoading={unfinalizeLoading}
        includeFutureSchedules={includeFutureSchedules}
        onIncludeFutureSchedulesChange={handleIncludeFutureSchedulesChange}
        onBackToReconciliation={() => router.push('/reconciliation')}
      />
    </CopyProtectionWrapper>
  )
}
