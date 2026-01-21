"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { CopyProtectionWrapper } from "@/components/copy-protection"
import { DepositReconciliationTopSection } from "@/components/deposit-reconciliation-top-section"
import { DynamicTable, type Column } from "@/components/dynamic-table"
import { ColumnChooserModal } from "@/components/column-chooser-modal"
import { ListHeader, type ColumnFilter } from "@/components/list-header"
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
  const [reopenLoading, setReopenLoading] = useState(false)
  const [undoingLineId, setUndoingLineId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([])
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [tableColumns, setTableColumns] = useState<Column[]>([])

  const undoingLineIdRef = useRef<string | null>(null)
  const finalizeLoadingRef = useRef(false)
  const reopenLoadingRef = useRef(false)

  useEffect(() => {
    undoingLineIdRef.current = undoingLineId
  }, [undoingLineId])

  useEffect(() => {
    finalizeLoadingRef.current = finalizeLoading
  }, [finalizeLoading])

  useEffect(() => {
    reopenLoadingRef.current = reopenLoading
  }, [reopenLoading])

  const depositName = metadata?.depositName ?? ""

  useEffect(() => {
    setBreadcrumbs([
      { name: "Home", href: "/dashboard" },
      { name: "Reconciliation", href: "/reconciliation" },
      { name: "Deposit Detail", href: depositId ? `/reconciliation/${depositId}` : "/reconciliation" },
      {
        name: depositName || "Finalize Deposit",
        current: false,
        href: depositId ? `/reconciliation/${depositId}` : "/reconciliation",
      },
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
    const base = matches.filter(row => {
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
      return query ? haystack.includes(query) : true
    })

    if (!columnFilters.length) return base

    const applyOperator = (operator: ColumnFilter["operator"], left: string, right: string) => {
      switch (operator) {
        case "equals":
          return left === right
        case "starts_with":
          return left.startsWith(right)
        case "ends_with":
          return left.endsWith(right)
        case "contains":
        default:
          return left.includes(right)
      }
    }

    return base.filter(row => {
      for (const filter of columnFilters) {
        const right = String(filter.value ?? "").toLowerCase()
        if (!right) continue
        const left = String((row as any)[filter.columnId] ?? "").toLowerCase()
        if (!applyOperator(filter.operator, left, right)) return false
      }
      return true
    })
  }, [columnFilters, matches, searchQuery])

  const sortedMatches = useMemo(() => {
    if (!sortConfig) return filteredMatches
    const direction = sortConfig.direction === "asc" ? 1 : -1
    const key = sortConfig.key

    const compare = (a: any, b: any) => {
      const aVal = a?.[key]
      const bVal = b?.[key]

      if (aVal == null && bVal != null) return 1
      if (aVal != null && bVal == null) return -1
      if (aVal == null && bVal == null) return 0

      if (key === "paymentDate" || key === "scheduleDate") {
        const aTime = aVal ? new Date(String(aVal)).getTime() : 0
        const bTime = bVal ? new Date(String(bVal)).getTime() : 0
        return (aTime - bTime) * direction
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * direction
      }

      const aStr = String(aVal ?? "").toLowerCase()
      const bStr = String(bVal ?? "").toLowerCase()
      if (aStr < bStr) return -1 * direction
      if (aStr > bStr) return 1 * direction
      return 0
    }

    return [...filteredMatches].sort(compare)
  }, [filteredMatches, sortConfig])

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }),
    [],
  )

  const handleUndoLine = useCallback(
    async (lineId: string) => {
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
    },
    [depositId, loadAll],
  )

  const handleFinalize = useCallback(async () => {
    if (!depositId) return
    setFinalizeError(null)
    setFinalizeLoading(true)
    try {
      const response = await fetch(`/api/reconciliation/deposits/${encodeURIComponent(depositId)}/finalize`, {
        method: "POST",
        cache: "no-store",
      })
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

  const handleReopen = useCallback(async () => {
    if (!depositId) return
    setFinalizeError(null)
    setReopenLoading(true)
    try {
      const response = await fetch(`/api/reconciliation/deposits/${encodeURIComponent(depositId)}/unfinalize`, {
        method: "POST",
        cache: "no-store",
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to reopen deposit")
      }
      router.push(`/reconciliation/${depositId}`)
    } catch (err) {
      console.error("Reopen deposit failed", err)
      setFinalizeError(err instanceof Error ? err.message : "Unable to reopen deposit")
    } finally {
      setReopenLoading(false)
    }
  }, [depositId, router])

  const resolvedMetadata: DepositReconciliationMetadata | null = metadata

  const renderDate = useCallback((value: unknown) => {
    if (typeof value !== "string") return ""
    return formatIsoDateYYYYMMDD(value)
  }, [])

  const renderCurrency = useCallback(
    (value: unknown) => currencyFormatter.format(Number(value ?? 0)),
    [currencyFormatter],
  )

  const renderScheduleLink = useCallback((value: unknown, row: ReviewMatchRow) => {
    return (
      <Link
        href={`/revenue-schedules/${encodeURIComponent(row.revenueScheduleId)}`}
        className="text-primary-700 hover:underline"
        data-disable-row-click
      >
        {String(value ?? "")}
      </Link>
    )
  }, [])

  const renderUndoAction = useCallback(
    (_value: unknown, row: ReviewMatchRow) => {
      const disabled =
        !canManageReconciliation ||
        undoingLineIdRef.current === row.depositLineItemId ||
        finalizeLoadingRef.current ||
        reopenLoadingRef.current

      return (
        <button
          type="button"
          onClick={() => void handleUndoLine(row.depositLineItemId)}
          disabled={disabled}
          className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          data-disable-row-click
        >
          {undoingLineIdRef.current === row.depositLineItemId ? "Undoing..." : "Undo"}
        </button>
      )
    },
    [canManageReconciliation, handleUndoLine],
  )

  const baseColumns = useMemo<Column[]>(() => {
    return [
      { id: "lineItem", label: "Line", width: 70, sortable: true, resizable: true, hideable: false },
      { id: "paymentDate", label: "Payment Date", width: 120, sortable: true, resizable: true, render: renderDate },
      { id: "accountName", label: "Account", width: 220, sortable: true, resizable: true, truncate: true },
      { id: "productName", label: "Product", width: 240, sortable: true, resizable: true, truncate: true },
      {
        id: "scheduleNumber",
        label: "Revenue Schedule",
        width: 170,
        sortable: true,
        resizable: true,
        render: renderScheduleLink,
      },
      { id: "scheduleDate", label: "Schedule Date", width: 120, sortable: true, resizable: true, render: renderDate },
      { id: "scheduleStatus", label: "Schedule Status", width: 150, sortable: true, resizable: true, truncate: true },
      { id: "allocatedUsage", label: "Allocated Usage", width: 140, sortable: true, resizable: true, render: renderCurrency },
      {
        id: "allocatedCommission",
        label: "Allocated Commission",
        width: 160,
        sortable: true,
        resizable: true,
        render: renderCurrency,
      },
      {
        id: "confidenceScore",
        label: "Confidence",
        width: 120,
        sortable: true,
        resizable: true,
        render: (value: unknown) => (typeof value === "number" ? `${Math.round(value * 100)}%` : "--"),
      },
      { id: "matchSource", label: "Source", width: 110, sortable: true, resizable: true, truncate: true },
      {
        id: "actions",
        label: "Actions",
        width: 120,
        sortable: false,
        resizable: false,
        hideable: false,
        type: "action",
        render: renderUndoAction,
      },
    ]
  }, [renderCurrency, renderDate, renderScheduleLink, renderUndoAction])

  useEffect(() => {
    if (tableColumns.length > 0) return
    setTableColumns(baseColumns)
  }, [baseColumns, tableColumns.length])

  const effectiveColumns = useMemo(() => (tableColumns.length > 0 ? tableColumns : baseColumns), [baseColumns, tableColumns])

  const filterColumnOptions = useMemo(
    () => [
      { id: "accountName", label: "Account" },
      { id: "productName", label: "Product" },
      { id: "scheduleNumber", label: "Revenue Schedule" },
      { id: "scheduleStatus", label: "Schedule Status" },
      { id: "matchSource", label: "Source" },
      { id: "paymentDate", label: "Payment Date" },
    ],
    [],
  )

  const sortOptions = useMemo(
    () => [
      { label: "None", value: "" },
      { label: "Payment Date (Newest)", value: "paymentDate:desc" },
      { label: "Payment Date (Oldest)", value: "paymentDate:asc" },
      { label: "Account (A-Z)", value: "accountName:asc" },
      { label: "Account (Z-A)", value: "accountName:desc" },
      { label: "Allocated Usage (High)", value: "allocatedUsage:desc" },
      { label: "Allocated Usage (Low)", value: "allocatedUsage:asc" },
      { label: "Allocated Commission (High)", value: "allocatedCommission:desc" },
      { label: "Allocated Commission (Low)", value: "allocatedCommission:asc" },
      { label: "Confidence (High)", value: "confidenceScore:desc" },
      { label: "Confidence (Low)", value: "confidenceScore:asc" },
    ],
    [],
  )

  const sortDropdownValue = useMemo(() => {
    if (!sortConfig) return ""
    return `${sortConfig.key}:${sortConfig.direction}`
  }, [sortConfig])

  return (
    <CopyProtectionWrapper className="min-h-screen bg-slate-50">
      {error ? <div className="p-4 text-sm text-red-600">{error}</div> : null}
      {finalizeError ? <div className="px-4 pt-2 text-xs text-red-600">{finalizeError}</div> : null}

      <div className="min-h-[calc(100vh-110px)] px-3 pb-3 pt-0 sm:px-4 flex flex-col">
        {resolvedMetadata ? (
          <DepositReconciliationTopSection
            metadata={resolvedMetadata}
            lineItems={lineItems}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => router.push(`/reconciliation/${depositId}`)}
                  className="inline-flex items-center rounded border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleReopen()}
                  disabled={!canManageReconciliation || reopenLoading || !metadata?.reconciled}
                  className={cn(
                    "inline-flex items-center justify-center rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50",
                    !canManageReconciliation || reopenLoading || !metadata?.reconciled ? "cursor-not-allowed opacity-60" : "",
                  )}
                >
                  {reopenLoading ? "Reopening..." : "Reopen Deposit"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleFinalize()}
                  disabled={!canManageReconciliation || finalizeLoading || hasOpenLines || Boolean(metadata?.reconciled)}
                  className={cn(
                    "inline-flex items-center justify-center rounded bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700",
                    !canManageReconciliation || finalizeLoading || hasOpenLines || Boolean(metadata?.reconciled)
                      ? "cursor-not-allowed opacity-60"
                      : "",
                  )}
                >
                  {finalizeLoading ? "Finalizing..." : "Finalize Deposit"}
                </button>
              </>
            }
          />
        ) : null}

        <div className="flex-1 min-h-0 flex flex-col">
          <ListHeader
            pageTitle="REVIEW MATCHES"
            searchPlaceholder="Search matches..."
            onSearch={setSearchQuery}
            showStatusFilter={false}
            showColumnFilters
            filterColumns={filterColumnOptions}
            columnFilters={columnFilters}
            onColumnFiltersChange={setColumnFilters}
            showCreateButton={false}
            onSettingsClick={() => setShowColumnSettings(true)}
            preSearchAccessory={
              <div className="relative">
                <select
                  value={sortDropdownValue}
                  onChange={event => {
                    const value = event.target.value
                    if (!value) {
                      setSortConfig(null)
                      return
                    }
                    const [key, direction] = value.split(":")
                    if (!key) {
                      setSortConfig(null)
                      return
                    }
                    setSortConfig({ key, direction: direction === "asc" ? "asc" : "desc" })
                  }}
                  className="w-52 appearance-none rounded border border-gray-300 bg-white px-3 py-1.5 pr-8 text-sm outline-none transition-all focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  aria-label="Sort matches"
                  title="Sort"
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      Sort: {option.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">▾</span>
              </div>
            }
            compact
          />

          <div className="flex-1 min-h-0 p-0">
            <DynamicTable
              className="flex flex-col"
              columns={effectiveColumns}
              data={sortedMatches}
              onSort={(column, direction) => setSortConfig({ key: column, direction })}
              sortConfig={sortConfig}
              onColumnsChange={setTableColumns}
              loading={loading}
              emptyMessage={loading ? "Loading matches..." : "No matches to review"}
              fillContainerWidth
              autoSizeColumns={false}
              preferOverflowHorizontalScroll
              maxBodyHeight={520}
            />
          </div>
        </div>

        {hasOpenLines ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Cannot finalize while deposit line items remain <span className="font-semibold">Unmatched</span> or{" "}
            <span className="font-semibold">Suggested</span>. Resolve all open lines on the deposit detail page first.
          </div>
        ) : null}
      </div>

      <ColumnChooserModal
        isOpen={showColumnSettings}
        columns={effectiveColumns}
        onApply={next => {
          setTableColumns(next)
          setShowColumnSettings(false)
        }}
        onClose={() => setShowColumnSettings(false)}
      />
    </CopyProtectionWrapper>
  )
}
