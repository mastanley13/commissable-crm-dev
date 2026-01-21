"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { CopyProtectionWrapper } from "@/components/copy-protection"
import { DepositReconciliationTopSection } from "@/components/deposit-reconciliation-top-section"
import { DynamicTable, type Column } from "@/components/dynamic-table"
import { ListHeader } from "@/components/list-header"
import { useBreadcrumbs } from "@/lib/breadcrumb-context"
import type { DepositLineItemRow } from "@/lib/mock-data"
import type { DepositReconciliationMetadata } from "@/components/deposit-reconciliation-detail-view"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"

type DepositDetailResponse = {
  metadata: DepositReconciliationMetadata
  lineItems: DepositLineItemRow[]
}

type ReviewMatchRow = {
  id: string
  depositLineItemId: string
  revenueScheduleId: string
  matchStatus: string
  matchSource: string
  confidenceScore: number | null
  reconciled: boolean
  lineItem: number
  paymentDate: string
  accountName: string
  productName: string
  lineStatus: string | null
  lineReconciled: boolean
  scheduleNumber: string
  scheduleDate: string
  scheduleStatus: string | null
  scheduleAccountName: string
  scheduleProductName: string
  scheduleVendorName: string
  allocatedUsage: number
  allocatedCommission: number
  lineUsage: number
  lineCommission: number
}

function formatIsoDateYYYYMMDD(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function FinalizeDepositReviewPage() {
  const params = useParams()
  const router = useRouter()
  const { setBreadcrumbs } = useBreadcrumbs()
  const { hasPermission } = useAuth()

  const canManageReconciliation = hasPermission("reconciliation.manage")

  const depositId = useMemo(() => {
    const raw = params?.depositId
    if (typeof raw === "string") return raw
    if (Array.isArray(raw) && raw.length > 0) return raw[0]!
    return ""
  }, [params])

  const [metadata, setMetadata] = useState<DepositReconciliationMetadata | null>(null)
  const [lineItems, setLineItems] = useState<DepositLineItemRow[]>([])
  const [matches, setMatches] = useState<ReviewMatchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [finalizeLoading, setFinalizeLoading] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [undoingLineId, setUndoingLineId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const depositName = metadata?.depositName ?? ""

  useEffect(() => {
    setBreadcrumbs([
      { name: "Home", href: "/dashboard" },
      { name: "Reconciliation", href: "/reconciliation" },
      { name: "Deposit Detail", href: depositId ? `/reconciliation/${depositId}` : "/reconciliation" },
      { name: depositName || "Finalize Deposit", current: false, href: depositId ? `/reconciliation/${depositId}` : "/reconciliation" },
      { name: "Finalize Deposit", current: true },
    ])

    return () => {
      setBreadcrumbs(null)
    }
  }, [depositId, depositName, setBreadcrumbs])

  const loadAll = useCallback(async () => {
    if (!depositId) return
    setLoading(true)
    setError(null)
    try {
      const [detailResponse, matchesResponse] = await Promise.all([
        fetch(`/api/reconciliation/deposits/${encodeURIComponent(depositId)}/detail`, { cache: "no-store" }),
        fetch(`/api/reconciliation/deposits/${encodeURIComponent(depositId)}/matches`, { cache: "no-store" }),
      ])

      const detailPayload = await detailResponse.json().catch(() => null)
      if (!detailResponse.ok) {
        throw new Error(detailPayload?.error || "Unable to load deposit detail")
      }
      const detailData = (detailPayload?.data ?? {}) as DepositDetailResponse
      setMetadata(detailData.metadata ?? null)
      setLineItems(Array.isArray(detailData.lineItems) ? detailData.lineItems : [])

      const matchesPayload = await matchesResponse.json().catch(() => null)
      if (!matchesResponse.ok) {
        throw new Error(matchesPayload?.error || "Unable to load deposit matches")
      }
      setMatches(Array.isArray(matchesPayload?.data) ? (matchesPayload.data as ReviewMatchRow[]) : [])
    } catch (err) {
      console.error("Finalize deposit review load failed", err)
      setError(err instanceof Error ? err.message : "Unable to load review page")
      setMetadata(null)
      setLineItems([])
      setMatches([])
    } finally {
      setLoading(false)
    }
  }, [depositId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const hasOpenLines = useMemo(() => {
    return lineItems.some(line => line.status === "Unmatched" || line.status === "Suggested")
  }, [lineItems])

  const filteredMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return matches
    return matches.filter(row => {
      const haystack = [
        String(row.lineItem),
        row.paymentDate,
        row.accountName,
        row.productName,
        row.scheduleNumber,
        row.scheduleAccountName,
        row.scheduleProductName,
        row.scheduleVendorName,
        row.scheduleStatus ?? "",
        row.matchStatus ?? "",
        row.matchSource ?? "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [matches, searchQuery])

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }),
    [],
  )

  const handleUndoLine = useCallback(async (lineId: string) => {
    if (!depositId || !lineId) return
    setFinalizeError(null)
    setUndoingLineId(lineId)
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/line-items/${encodeURIComponent(lineId)}/unmatch`,
        { method: "POST", cache: "no-store" },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to remove allocation")
      }
      await loadAll()
    } catch (err) {
      console.error("Undo allocation failed", err)
      setFinalizeError(err instanceof Error ? err.message : "Unable to remove allocation")
    } finally {
      setUndoingLineId(null)
    }
  }, [depositId, loadAll])

  const handleFinalize = useCallback(async () => {
    if (!depositId) return
    setFinalizeError(null)
    setFinalizeLoading(true)
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/finalize`,
        { method: "POST", cache: "no-store" },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to finalize deposit")
      }
      router.push(`/reconciliation/${depositId}`)
    } catch (err) {
      console.error("Finalize deposit failed", err)
      setFinalizeError(err instanceof Error ? err.message : "Unable to finalize deposit")
    } finally {
      setFinalizeLoading(false)
    }
  }, [depositId, router])

  const resolvedMetadata: DepositReconciliationMetadata | null = metadata

  const columns: Column[] = useMemo(() => {
    const renderDate = (value: unknown) => {
      if (typeof value !== "string") return ""
      return formatIsoDateYYYYMMDD(value)
    }
    const renderCurrency = (value: unknown) => currencyFormatter.format(Number(value ?? 0))

    return [
      { id: "lineItem", label: "Line", width: 70, sortable: false, render: (value) => String(value ?? "") },
      { id: "paymentDate", label: "Payment Date", width: 110, sortable: false, render: renderDate },
      { id: "accountName", label: "Account", width: 200, sortable: false, truncate: true },
      { id: "productName", label: "Product", width: 220, sortable: false, truncate: true },
      {
        id: "scheduleNumber",
        label: "Revenue Schedule",
        width: 170,
        sortable: false,
        render: (value, row) => (
          <Link
            href={`/revenue-schedules/${encodeURIComponent(row.revenueScheduleId)}`}
            className="text-primary-700 hover:underline"
            data-disable-row-click
          >
            {String(value ?? "")}
          </Link>
        ),
      },
      { id: "scheduleDate", label: "Schedule Date", width: 110, sortable: false, render: renderDate },
      { id: "scheduleStatus", label: "Schedule Status", width: 140, sortable: false, truncate: true },
      { id: "allocatedUsage", label: "Allocated Usage", width: 130, sortable: false, render: renderCurrency },
      { id: "allocatedCommission", label: "Allocated Commission", width: 150, sortable: false, render: renderCurrency },
      {
        id: "confidenceScore",
        label: "Confidence",
        width: 110,
        sortable: false,
        render: (value: unknown) => (typeof value === "number" ? `${Math.round(value * 100)}%` : "--"),
      },
      { id: "matchSource", label: "Source", width: 110, sortable: false, truncate: true },
      {
        id: "actions",
        label: "Actions",
        width: 120,
        sortable: false,
        type: "action",
        render: (_value, row) => (
          <button
            type="button"
            onClick={() => void handleUndoLine(row.depositLineItemId)}
            disabled={!canManageReconciliation || undoingLineId === row.depositLineItemId || finalizeLoading}
            className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            data-disable-row-click
          >
            {undoingLineId === row.depositLineItemId ? "Undoing..." : "Undo"}
          </button>
        ),
      },
    ]
  }, [canManageReconciliation, currencyFormatter, finalizeLoading, handleUndoLine, undoingLineId])

  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      {error ? <div className="p-4 text-sm text-red-600">{error}</div> : null}
      {finalizeError ? <div className="px-4 pt-2 text-xs text-red-600">{finalizeError}</div> : null}

      <div className="min-h-[calc(100vh-110px)] px-3 pb-3 pt-0 sm:px-4 flex flex-col gap-3">
        {resolvedMetadata ? (
          <DepositReconciliationTopSection
            metadata={resolvedMetadata}
            lineItems={lineItems}
            actions={
              <button
                type="button"
                onClick={() => router.push(`/reconciliation/${depositId}`)}
                className="inline-flex items-center rounded border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                ← Back
              </button>
            }
          />
        ) : null}

        {hasOpenLines ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Cannot finalize while deposit line items remain <span className="font-semibold">Unmatched</span> or{" "}
            <span className="font-semibold">Suggested</span>. Resolve all open lines on the deposit detail page first.
          </div>
        ) : null}

        <ListHeader
          pageTitle="REVIEW MATCHES"
          searchPlaceholder="Search matches..."
          onSearch={setSearchQuery}
          showStatusFilter={false}
          showColumnFilters={false}
          showCreateButton={false}
          compact
        />

        <div className="flex-1 min-h-0 p-0 flex flex-col gap-3">
          <DynamicTable
            columns={columns}
            data={filteredMatches}
            loading={loading}
            emptyMessage={loading ? "Loading matches..." : "No matches to review"}
            fillContainerWidth
            autoSizeColumns={false}
            preferOverflowHorizontalScroll
            maxBodyHeight={520}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={() => router.push(`/reconciliation/${depositId}`)}
            className="rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={finalizeLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleFinalize()}
            disabled={!canManageReconciliation || finalizeLoading || !depositId || hasOpenLines || Boolean(metadata?.reconciled)}
            className={cn(
              "rounded bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {finalizeLoading ? "Finalizing..." : "Confirm & Finalize"}
          </button>
        </div>
      </div>
    </CopyProtectionWrapper>
  )
}

