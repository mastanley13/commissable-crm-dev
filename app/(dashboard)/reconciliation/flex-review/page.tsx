"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
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
  parentRevenueScheduleId: string | null
  parentRevenueScheduleName: string | null
  scheduleDate: string | null
  opportunityId: string | null
  productId: string | null
  distributorAccountId: string | null
  distributorName: string | null
  vendorAccountId: string | null
  vendorName: string | null
  sourceDepositId: string | null
  sourceDepositLineItemId: string | null
  expectedUsage: number | null
  expectedCommission: number | null
  assignedToUserId: string | null
  assignedToName: string | null
  createdAt: string
  resolvedAt: string | null
}

type FlexResolutionAction = "ApplyToExisting" | "ConvertToRegular" | "BonusCommission"

type ProductFamily = {
  id: string
  name: string
}

type ProductSubtype = {
  id: string
  name: string
  productFamilyId: string | null
}

type ProductOption = {
  id: string
  name: string
  vendorName: string
  distributorName: string
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
  const [classificationFilter, setClassificationFilter] = useState<string>("All")
  const [reasonFilter, setReasonFilter] = useState<string>("All")
  const [vendorFilter, setVendorFilter] = useState<string>("")
  const [distributorFilter, setDistributorFilter] = useState<string>("")
  const [scheduleFilter, setScheduleFilter] = useState<string>("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkNotes, setBulkNotes] = useState("")
  const [paginationTotal, setPaginationTotal] = useState<number | null>(null)
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(200)
  const [totalPages, setTotalPages] = useState<number>(1)

  const [resolveItemId, setResolveItemId] = useState<string | null>(null)
  const [resolveAction, setResolveAction] = useState<FlexResolutionAction>("ApplyToExisting")
  const [resolveTargetSchedule, setResolveTargetSchedule] = useState<string>("")
  const [resolveNotes, setResolveNotes] = useState<string>("")
  const [resolveFamilyId, setResolveFamilyId] = useState<string>("")
  const [resolveSubtypeId, setResolveSubtypeId] = useState<string>("")
  const [resolveProductId, setResolveProductId] = useState<string>("")
  const [resolveProductOptions, setResolveProductOptions] = useState<ProductOption[]>([])
  const [resolveRecurring, setResolveRecurring] = useState<boolean>(false)
  const [resolveAdditionalCount, setResolveAdditionalCount] = useState<number>(0)
  const [resolveAdditionalStartDate, setResolveAdditionalStartDate] = useState<string>("")
  const [resolveProductLoading, setResolveProductLoading] = useState<boolean>(false)

  const [productFamilies, setProductFamilies] = useState<ProductFamily[]>([])
  const [productSubtypes, setProductSubtypes] = useState<ProductSubtype[]>([])

  useEffect(() => {
    setBreadcrumbs([
      { name: "Home", href: "/dashboard" },
      { name: "Reconciliation", href: "/reconciliation" },
      { name: "Flex Review Queue", href: "/reconciliation/flex-review", current: true },
    ])
    return () => setBreadcrumbs(null)
  }, [setBreadcrumbs])

  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const response = await fetch("/api/products/master-data", { cache: "no-store" })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load product master data")
        }
        setProductFamilies(Array.isArray(payload?.families) ? payload.families : [])
        setProductSubtypes(Array.isArray(payload?.subtypes) ? payload.subtypes : [])
      } catch (err) {
        console.error("Failed to load product master data", err)
        showError(
          "Load failed",
          err instanceof Error ? err.message : "Failed to load product master data",
        )
      }
    }

    void loadMasterData()
  }, [showError])

  const buildQueryParams = useCallback(
    (options?: { format?: string; includeAll?: boolean }) => {
      const params = new URLSearchParams()
      if (statusFilter !== "All") params.set("status", statusFilter)
      if (assignmentFilter !== "all") params.set("assignment", assignmentFilter)
      if (classificationFilter !== "All") params.set("classification", classificationFilter)
      if (reasonFilter !== "All") params.set("reason", reasonFilter)
      if (minAgeDays > 0) params.set("minAgeDays", String(minAgeDays))
      if (minAbsCommission > 0) params.set("minAbsCommission", String(minAbsCommission))
      if (vendorFilter.trim()) params.set("vendor", vendorFilter.trim())
      if (distributorFilter.trim()) params.set("distributor", distributorFilter.trim())
      if (scheduleFilter.trim()) params.set("schedule", scheduleFilter.trim())
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))
      if (options?.includeAll) params.set("includeAll", "true")
      if (options?.format) params.set("format", options.format)
      return params
    },
    [
      assignmentFilter,
      classificationFilter,
      distributorFilter,
      minAbsCommission,
      minAgeDays,
      page,
      pageSize,
      reasonFilter,
      scheduleFilter,
      statusFilter,
      vendorFilter,
    ],
  )

  const exportUrl = useMemo(() => {
    const params = buildQueryParams({ format: "csv", includeAll: true })
    return `/api/flex-review?${params.toString()}`
  }, [buildQueryParams])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = buildQueryParams()
      const response = await fetch(`/api/flex-review?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load flex review queue")
      }
      setItems(Array.isArray(payload?.data) ? payload.data : [])
      setPaginationTotal(
        typeof payload?.pagination?.total === "number" ? payload.pagination.total : null,
      )
      const nextTotalPages =
        typeof payload?.pagination?.totalPages === "number" ? payload.pagination.totalPages : 1
      setTotalPages(nextTotalPages)
      if (page > nextTotalPages) {
        setPage(nextTotalPages)
      }
      setSelectedIds([])
    } catch (err) {
      console.error("Failed to load flex review queue", err)
      showError("Load failed", err instanceof Error ? err.message : "Failed to load flex review queue")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [buildQueryParams, page, showError])

  useEffect(() => {
    setPage(prev => (prev === 1 ? prev : 1))
  }, [
    assignmentFilter,
    classificationFilter,
    distributorFilter,
    minAbsCommission,
    minAgeDays,
    reasonFilter,
    scheduleFilter,
    statusFilter,
    vendorFilter,
  ])

  const familyById = useMemo(
    () => new Map(productFamilies.map(family => [family.id, family] as const)),
    [productFamilies],
  )
  const subtypeById = useMemo(
    () => new Map(productSubtypes.map(subtype => [subtype.id, subtype] as const)),
    [productSubtypes],
  )
  const activeResolveItem = useMemo(
    () => (resolveItemId ? items.find(item => item.id === resolveItemId) ?? null : null),
    [items, resolveItemId],
  )

  const loadResolveProducts = useCallback(async () => {
    if (!activeResolveItem) return
    const family = familyById.get(resolveFamilyId)
    const subtype = subtypeById.get(resolveSubtypeId)
    if (!family || !subtype) {
      setResolveProductOptions([])
      return
    }

    const filters = [
      { columnId: "productFamilyHouse", value: family.name },
      { columnId: "productSubtypeHouse", value: subtype.name },
    ] as Array<{ columnId: string; value: string }>

    if (activeResolveItem.vendorAccountId) {
      filters.push({ columnId: "vendorAccountId", value: activeResolveItem.vendorAccountId })
    }
    if (activeResolveItem.distributorAccountId) {
      filters.push({ columnId: "distributorAccountId", value: activeResolveItem.distributorAccountId })
    }

    setResolveProductLoading(true)
    try {
      const response = await fetch(
        `/api/products?filters=${encodeURIComponent(JSON.stringify(filters))}&pageSize=50`,
        { cache: "no-store" },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load products")
      }

      const rows = Array.isArray(payload?.data) ? payload.data : []
      const options = rows.map((row: any) => ({
        id: row.id,
        name: row.productNameHouse || row.productNameVendor || row.id,
        vendorName: row.vendorName || "",
        distributorName: row.distributorName || "",
      }))
      setResolveProductOptions(options)
    } catch (err) {
      console.error("Failed to load products", err)
      showError("Load failed", err instanceof Error ? err.message : "Failed to load products")
      setResolveProductOptions([])
    } finally {
      setResolveProductLoading(false)
    }
  }, [
    activeResolveItem,
    familyById,
    resolveFamilyId,
    resolveSubtypeId,
    showError,
    subtypeById,
  ])

  useEffect(() => {
    const handle = setTimeout(() => {
      void load()
    }, 250)
    return () => clearTimeout(handle)
  }, [load])

  useEffect(() => {
    if (resolveAction !== "ConvertToRegular" || !resolveItemId) return
    if (resolveFamilyId && resolveSubtypeId) {
      void loadResolveProducts()
    } else {
      setResolveProductOptions([])
    }
  }, [
    loadResolveProducts,
    resolveAction,
    resolveFamilyId,
    resolveItemId,
    resolveSubtypeId,
  ])

  const myUserId = user?.id ?? null
  const isAdmin = user?.role?.code === "ADMIN"

  const openCount = useMemo(() => items.filter(item => item.status === "Open").length, [items])
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const classificationOptions = useMemo(() => {
    const values = new Set<string>()
    items.forEach(item => {
      if (item.flexClassification) {
        values.add(item.flexClassification)
      }
    })
    return Array.from(values).sort()
  }, [items])
  const reasonOptions = useMemo(() => {
    const values = new Set<string>()
    items.forEach(item => {
      if (item.flexReasonCode) {
        values.add(item.flexReasonCode)
      }
    })
    return Array.from(values).sort()
  }, [items])

  const filteredItems = useMemo(() => {
    const now = Date.now()
    const vendorQuery = vendorFilter.trim().toLowerCase()
    const distributorQuery = distributorFilter.trim().toLowerCase()
    const scheduleQuery = scheduleFilter.trim().toLowerCase()

    return items.filter(item => {
      if (statusFilter !== "All" && item.status !== statusFilter) return false
      if (classificationFilter !== "All" && item.flexClassification !== classificationFilter) return false
      if (reasonFilter !== "All" && (item.flexReasonCode ?? "") !== reasonFilter) return false

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

      if (vendorQuery) {
        const vendorName = item.vendorName?.toLowerCase() ?? ""
        if (!vendorName.includes(vendorQuery)) return false
      }

      if (distributorQuery) {
        const distributorName = item.distributorName?.toLowerCase() ?? ""
        if (!distributorName.includes(distributorQuery)) return false
      }

      if (scheduleQuery) {
        const scheduleName = item.revenueScheduleName?.toLowerCase() ?? ""
        const parentName = item.parentRevenueScheduleName?.toLowerCase() ?? ""
        if (!scheduleName.includes(scheduleQuery) && !parentName.includes(scheduleQuery)) return false
      }

      return true
    })
  }, [
    assignmentFilter,
    classificationFilter,
    distributorFilter,
    items,
    minAbsCommission,
    minAgeDays,
    myUserId,
    reasonFilter,
    scheduleFilter,
    statusFilter,
    vendorFilter,
  ])

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

  const postJson = useCallback(async (url: string, body?: unknown) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(payload?.error || "Request failed")
    }
    return payload
  }, [])

  const selectableItems = useMemo(
    () => filteredItems.filter(item => item.status === "Open"),
    [filteredItems],
  )
  const allVisibleSelected =
    selectableItems.length > 0 && selectableItems.every(item => selectedIdSet.has(item.id))
  const selectedOpenItems = useMemo(
    () => filteredItems.filter(item => selectedIdSet.has(item.id) && item.status === "Open"),
    [filteredItems, selectedIdSet],
  )
  const selectedChargebackItems = useMemo(
    () =>
      selectedOpenItems.filter(
        item =>
          item.flexClassification === "FlexChargeback" ||
          item.flexClassification === "FlexChargebackReversal",
      ),
    [selectedOpenItems],
  )
  const selectedNonChargebackItems = useMemo(
    () =>
      selectedOpenItems.filter(
        item =>
          item.flexClassification !== "FlexChargeback" &&
          item.flexClassification !== "FlexChargebackReversal",
      ),
    [selectedOpenItems],
  )

  const bulkAssign = useCallback(
    async (mode: "assignToMe" | "unassign") => {
      if (selectedOpenItems.length === 0) {
        showError("No items selected", "Select at least one open flex review item.")
        return
      }

      try {
        setBulkBusy(true)
        let success = 0
        let failed = 0

        for (const item of selectedOpenItems) {
          try {
            await postJson(`/api/flex-review/${encodeURIComponent(item.id)}/assign`, mode === "assignToMe" ? { assignToMe: true } : { unassign: true })
            success += 1
          } catch (err) {
            failed += 1
            console.error("Bulk assign failed", err)
          }
        }

        if (success > 0) {
          showSuccess("Bulk update", `${success} item${success === 1 ? "" : "s"} updated.`)
        }
        if (failed > 0) {
          showError("Bulk update", `${failed} item${failed === 1 ? "" : "s"} failed to update.`)
        }

        await load()
      } finally {
        setBulkBusy(false)
      }
    },
    [load, postJson, selectedOpenItems, showError, showSuccess],
  )

  const bulkApprove = useCallback(async () => {
    if (selectedChargebackItems.length === 0) {
      showError("No items selected", "Select at least one chargeback item to approve.")
      return
    }

    try {
      setBulkBusy(true)
      let success = 0
      let failed = 0

      for (const item of selectedChargebackItems) {
        try {
          await postJson(`/api/flex-review/${encodeURIComponent(item.id)}/approve-and-apply`)
          success += 1
        } catch (err) {
          failed += 1
          console.error("Bulk approve failed", err)
        }
      }

      if (success > 0) {
        showSuccess("Bulk approve", `${success} item${success === 1 ? "" : "s"} approved.`)
      }
      if (failed > 0) {
        showError("Bulk approve", `${failed} item${failed === 1 ? "" : "s"} failed to approve.`)
      }

      await load()
    } finally {
      setBulkBusy(false)
    }
  }, [load, postJson, selectedChargebackItems, showError, showSuccess])

  const bulkResolve = useCallback(
    async (status: "Resolved" | "Rejected") => {
      if (selectedNonChargebackItems.length === 0) {
        showError("No items selected", "Select at least one non-chargeback item to resolve.")
        return
      }

      try {
        setBulkBusy(true)
        const payload = await postJson("/api/flex-review/bulk/resolve", {
          itemIds: selectedNonChargebackItems.map(item => item.id),
          status,
          notes: bulkNotes || undefined,
        })

        const updated = typeof payload?.updated === "number" ? payload.updated : 0
        const failedCount = Array.isArray(payload?.failed) ? payload.failed.length : 0

        if (updated > 0) {
          showSuccess(
            `Bulk ${status.toLowerCase()}`,
            `${updated} item${updated === 1 ? "" : "s"} updated.`,
          )
        }
        if (failedCount > 0) {
          showError(
            `Bulk ${status.toLowerCase()}`,
            `${failedCount} item${failedCount === 1 ? "" : "s"} failed to update.`,
          )
        }
        const errorCount =
          payload?.errors && typeof payload.errors === "object"
            ? Object.keys(payload.errors as Record<string, string>).length
            : 0
        if (errorCount > 0) {
          showError(
            `Bulk ${status.toLowerCase()}`,
            `${errorCount} item${errorCount === 1 ? "" : "s"} reported errors. Check console for details.`,
          )
          console.error("Bulk resolve errors", payload.errors)
        }
        if (selectedChargebackItems.length > 0) {
          showError(
            "Skipped chargebacks",
            `${selectedChargebackItems.length} chargeback item${selectedChargebackItems.length === 1 ? "" : "s"} require approval instead.`,
          )
        }

        setBulkNotes("")
        await load()
      } catch (err) {
        console.error("Bulk resolve failed", err)
        showError(
          `Bulk ${status.toLowerCase()} failed`,
          err instanceof Error ? err.message : "Bulk resolve failed",
        )
      } finally {
        setBulkBusy(false)
      }
    },
    [bulkNotes, load, postJson, selectedChargebackItems.length, selectedNonChargebackItems, showError, showSuccess],
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

  const openResolve = useCallback((item: FlexReviewItem) => {
    setResolveItemId(item.id)
    setResolveAction("ApplyToExisting")
    setResolveTargetSchedule(item.parentRevenueScheduleId ?? "")
    setResolveNotes("")
    setResolveFamilyId("")
    setResolveSubtypeId("")
    setResolveProductId("")
    setResolveProductOptions([])
    setResolveRecurring(false)
    setResolveAdditionalCount(0)
    setResolveAdditionalStartDate(item.scheduleDate ? item.scheduleDate.slice(0, 10) : "")
  }, [])

  const closeResolve = useCallback(() => {
    setResolveItemId(null)
    setResolveProductOptions([])
  }, [])

  const submitResolve = useCallback(async () => {
    if (!resolveItemId || !activeResolveItem) return

    if (resolveAction === "ApplyToExisting") {
      const hasTarget = Boolean(resolveTargetSchedule?.trim()) || Boolean(activeResolveItem.parentRevenueScheduleId)
      if (!hasTarget) {
        showError("Missing target", "Select a target schedule to apply this flex amount.")
        return
      }
    }

    if (resolveAction === "ConvertToRegular") {
      if (!resolveProductId) {
        showError("Missing product", "Select a product to convert this flex schedule.")
        return
      }
      if (resolveRecurring && resolveAdditionalCount > 0 && !resolveAdditionalStartDate) {
        showError("Missing start date", "Select a start date for additional schedules.")
        return
      }
    }

    try {
      setBusyId(resolveItemId)
      const payload: any = {
        action: resolveAction,
        notes: resolveNotes || undefined,
      }

      if (resolveAction === "ApplyToExisting") {
        if (resolveTargetSchedule?.trim()) {
          payload.targetScheduleIdOrNumber = resolveTargetSchedule.trim()
        }
      }

      if (resolveAction === "ConvertToRegular") {
        payload.productId = resolveProductId
        payload.recurring = resolveRecurring
        if (resolveRecurring && resolveAdditionalCount > 0) {
          payload.additionalScheduleCount = resolveAdditionalCount
          payload.additionalScheduleStartDate = resolveAdditionalStartDate
        }
      }

      const response = await fetch(`/api/flex-review/${encodeURIComponent(resolveItemId)}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const responsePayload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(responsePayload?.error || "Resolve failed")
      }

      showSuccess("Resolved", "Flex review item resolved.")
      closeResolve()
      await load()
    } catch (err) {
      console.error("Resolve failed", err)
      showError("Resolve failed", err instanceof Error ? err.message : "Resolve failed")
    } finally {
      setBusyId(null)
    }
  }, [
    activeResolveItem,
    closeResolve,
    load,
    resolveAction,
    resolveAdditionalCount,
    resolveAdditionalStartDate,
    resolveItemId,
    resolveNotes,
    resolveProductId,
    resolveRecurring,
    resolveTargetSchedule,
    showError,
    showSuccess,
  ])

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      const openIds = selectableItems.map(item => item.id)
      setSelectedIds(prev => {
        if (checked) {
          const next = new Set([...prev, ...openIds])
          return Array.from(next)
        }
        return prev.filter(id => !openIds.includes(id))
      })
    },
    [selectableItems],
  )

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]))
  }, [])

  const clearSelection = useCallback(() => setSelectedIds([]), [])

  return (
    <div className="p-6">
      <ToastContainer />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Flex Review Queue</h1>
          <p className="text-sm text-gray-600">
            {loading
              ? "Loading..."
              : `${openCount} open item${openCount === 1 ? "" : "s"}${
                  typeof paginationTotal === "number" ? ` (${paginationTotal} total)` : ""
                }`}
          </p>
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
          <select
            className="rounded border border-gray-300 bg-white px-2 py-2 text-sm"
            value={classificationFilter}
            onChange={e => setClassificationFilter(e.target.value)}
            disabled={loading}
          >
            <option value="All">All types</option>
            {classificationOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-gray-300 bg-white px-2 py-2 text-sm"
            value={reasonFilter}
            onChange={e => setReasonFilter(e.target.value)}
            disabled={loading}
          >
            <option value="All">All reasons</option>
            {reasonOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            className="w-40 rounded border border-gray-300 bg-white px-2 py-2 text-sm"
            type="text"
            value={vendorFilter}
            onChange={e => setVendorFilter(e.target.value)}
            placeholder="Vendor"
            title="Filter by vendor name"
            disabled={loading}
          />
          <input
            className="w-44 rounded border border-gray-300 bg-white px-2 py-2 text-sm"
            type="text"
            value={distributorFilter}
            onChange={e => setDistributorFilter(e.target.value)}
            placeholder="Distributor"
            title="Filter by distributor name"
            disabled={loading}
          />
          <input
            className="w-40 rounded border border-gray-300 bg-white px-2 py-2 text-sm"
            type="text"
            value={scheduleFilter}
            onChange={e => setScheduleFilter(e.target.value)}
            placeholder="Schedule"
            title="Filter by schedule name"
            disabled={loading}
          />
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
          <a
            href={exportUrl}
            className="rounded bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Export CSV
          </a>
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm">
          <span className="font-medium text-gray-700">{selectedIds.length} selected</span>
          <span className="text-xs text-gray-500">
            {selectedNonChargebackItems.length} flex / {selectedChargebackItems.length} chargeback
          </span>
          <button
            className="rounded bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            onClick={() => void bulkAssign("assignToMe")}
            disabled={bulkBusy || loading}
          >
            Assign to me
          </button>
          <button
            className="rounded bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            onClick={() => void bulkAssign("unassign")}
            disabled={bulkBusy || loading}
          >
            Unassign
          </button>
          <button
            className="rounded bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            onClick={() => void bulkResolve("Resolved")}
            disabled={bulkBusy || loading || selectedNonChargebackItems.length === 0}
            title={
              selectedNonChargebackItems.length === 0
                ? "Select non-chargeback items to resolve"
                : undefined
            }
          >
            Resolve
          </button>
          <button
            className="rounded bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            onClick={() => void bulkResolve("Rejected")}
            disabled={bulkBusy || loading || selectedNonChargebackItems.length === 0}
            title={
              selectedNonChargebackItems.length === 0
                ? "Select non-chargeback items to reject"
                : undefined
            }
          >
            Reject
          </button>
          {isAdmin ? (
            <button
              className="rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={() => void bulkApprove()}
              disabled={bulkBusy || loading}
            >
              Approve & Apply
            </button>
          ) : null}
          <input
            className="w-64 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700"
            placeholder="Bulk notes (optional)"
            value={bulkNotes}
            onChange={event => setBulkNotes(event.target.value)}
            disabled={bulkBusy || loading}
          />
          <button
            className="rounded bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            onClick={clearSelection}
            disabled={bulkBusy || loading}
          >
            Clear selection
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600"
                  checked={allVisibleSelected}
                  onChange={event => toggleSelectAll(event.target.checked)}
                  disabled={loading || bulkBusy || selectableItems.length === 0}
                  title="Select all open items"
                />
              </th>
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
                <td colSpan={11} className="px-3 py-6 text-center text-gray-500">
                  {loading ? "Loading..." : "No flex review items found."}
                </td>
              </tr>
            ) : (
              filteredItems.map(item => {
                const isApprovable =
                  item.flexClassification === "FlexChargeback" ||
                  item.flexClassification === "FlexChargebackReversal"
                const canAct = item.status === "Open" && busyId !== item.id && !bulkBusy
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

                const isResolveOpen = resolveItemId === item.id
                const resolveDisabled = !canAct || busyId === item.id
                const isSelected = selectedIdSet.has(item.id)
                const isSelectable = item.status === "Open"

                const subtypesForFamily = resolveFamilyId
                  ? productSubtypes.filter(subtype => subtype.productFamilyId === resolveFamilyId)
                  : []

                return (
                  <Fragment key={item.id}>
                    <tr>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-primary-600"
                          checked={isSelected}
                          onChange={() => toggleSelected(item.id)}
                          disabled={!isSelectable || bulkBusy}
                          title={!isSelectable ? "Only open items can be selected" : undefined}
                        />
                      </td>
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
                                disabled={!canAct || !isAdmin}
                                title={!isAdmin ? "Admin approval required" : undefined}
                              >
                                Approve & Apply
                              </button>
                            ) : (
                              <button
                                className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                                onClick={() => (isResolveOpen ? closeResolve() : openResolve(item))}
                                disabled={!canAct}
                              >
                                {isResolveOpen ? "Close" : "Resolve"}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    {isResolveOpen ? (
                      <tr>
                        <td colSpan={10} className="bg-gray-50 px-4 py-4">
                          <div className="space-y-4 text-sm text-gray-700">
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Resolution Action
                              </label>
                              <select
                                className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                                value={resolveAction}
                                onChange={e => setResolveAction(e.target.value as FlexResolutionAction)}
                                disabled={resolveDisabled}
                              >
                                <option value="ApplyToExisting">Apply to existing schedule</option>
                                <option value="ConvertToRegular">Convert to regular schedule</option>
                                <option value="BonusCommission">Bonus commission (100% rate)</option>
                              </select>
                            </div>

                            {resolveAction === "ApplyToExisting" ? (
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    className="w-80 rounded border border-gray-300 px-2 py-1 text-sm"
                                    placeholder="Target schedule id or number"
                                    value={resolveTargetSchedule}
                                    onChange={e => setResolveTargetSchedule(e.target.value)}
                                    disabled={resolveDisabled}
                                  />
                                  {item.parentRevenueScheduleId ? (
                                    <button
                                      className="rounded bg-white px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                      onClick={() => setResolveTargetSchedule(item.parentRevenueScheduleId ?? "")}
                                      disabled={resolveDisabled}
                                    >
                                      Use parent ({item.parentRevenueScheduleName ?? item.parentRevenueScheduleId})
                                    </button>
                                  ) : null}
                                </div>
                                <p className="text-xs text-gray-500">
                                  Adds the flex amount to the target schedule and retires the flex schedule.
                                </p>
                              </div>
                            ) : null}

                            {resolveAction === "ConvertToRegular" ? (
                              <div className="space-y-3">
                                <div className="flex flex-wrap gap-6 text-xs text-gray-500">
                                  <div>
                                    <div className="font-semibold text-gray-600">Distributor</div>
                                    <div>{item.distributorName ?? "-"}</div>
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-600">Vendor</div>
                                    <div>{item.vendorName ?? "-"}</div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-600">Product Family</label>
                                    <select
                                      className="mt-1 w-56 rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                                      value={resolveFamilyId}
                                      onChange={e => {
                                        setResolveFamilyId(e.target.value)
                                        setResolveSubtypeId("")
                                        setResolveProductId("")
                                        setResolveProductOptions([])
                                      }}
                                      disabled={resolveDisabled}
                                    >
                                      <option value="">Select family</option>
                                      {productFamilies.map(family => (
                                        <option key={family.id} value={family.id}>
                                          {family.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-600">Product Subtype</label>
                                    <select
                                      className="mt-1 w-56 rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                                      value={resolveSubtypeId}
                                      onChange={e => {
                                        setResolveSubtypeId(e.target.value)
                                        setResolveProductId("")
                                      }}
                                      disabled={resolveDisabled || !resolveFamilyId}
                                    >
                                      <option value="">Select subtype</option>
                                      {subtypesForFamily.map(subtype => (
                                        <option key={subtype.id} value={subtype.id}>
                                          {subtype.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-xs font-semibold text-gray-600">Product</label>
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <select
                                      className="w-80 rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                                      value={resolveProductId}
                                      onChange={e => setResolveProductId(e.target.value)}
                                      disabled={resolveDisabled || resolveProductLoading}
                                    >
                                      <option value="">
                                        {resolveProductLoading ? "Loading products..." : "Select product"}
                                      </option>
                                      {resolveProductOptions.map(option => (
                                        <option key={option.id} value={option.id}>
                                          {option.name}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      className="rounded bg-white px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                      onClick={() => void loadResolveProducts()}
                                      disabled={resolveDisabled || resolveProductLoading || !resolveFamilyId || !resolveSubtypeId}
                                    >
                                      Refresh list
                                    </button>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                  <label className="flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-gray-300 text-primary-600"
                                      checked={resolveRecurring}
                                      onChange={e => setResolveRecurring(e.target.checked)}
                                      disabled={resolveDisabled}
                                    />
                                    Recurring (create additional schedules)
                                  </label>
                                  {resolveRecurring ? (
                                    <>
                                      <input
                                        className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                                        type="number"
                                        min={0}
                                        value={resolveAdditionalCount}
                                        onChange={e => setResolveAdditionalCount(Number(e.target.value) || 0)}
                                        disabled={resolveDisabled}
                                        placeholder="# additional"
                                      />
                                      <input
                                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                                        type="date"
                                        value={resolveAdditionalStartDate}
                                        onChange={e => setResolveAdditionalStartDate(e.target.value)}
                                        disabled={resolveDisabled}
                                      />
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                            {resolveAction === "BonusCommission" ? (
                              <p className="text-xs text-gray-500">
                                Sets the flex schedule to a one-time bonus with 100% commission rate.
                              </p>
                            ) : null}

                            <div>
                              <label className="block text-xs font-semibold text-gray-600">Notes</label>
                              <textarea
                                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                                rows={2}
                                value={resolveNotes}
                                onChange={e => setResolveNotes(e.target.value)}
                                disabled={resolveDisabled}
                              />
                            </div>

                            <div className="flex justify-end gap-2">
                              <button
                                className="rounded bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                onClick={closeResolve}
                                disabled={resolveDisabled}
                              >
                                Cancel
                              </button>
                              <button
                                className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                                onClick={() => void submitResolve()}
                                disabled={resolveDisabled}
                              >
                                Apply Resolution
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <div>
          Page {page} of {totalPages}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            onClick={() => setPage(prev => Math.max(1, prev - 1))}
            disabled={loading || page <= 1}
          >
            Previous
          </button>
          <input
            className="w-16 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700"
            type="number"
            min={1}
            max={totalPages}
            value={page}
            onChange={event => {
              const next = Number(event.target.value)
              if (!Number.isFinite(next)) return
              setPage(Math.min(Math.max(1, next), totalPages))
            }}
            disabled={loading}
            title="Page number"
          />
          <button
            className="rounded bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
            disabled={loading || page >= totalPages}
          >
            Next
          </button>
          <select
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
            value={pageSize}
            onChange={event => {
              const next = Number(event.target.value) || 200
              setPageSize(next)
              setPage(1)
            }}
            disabled={loading}
            title="Rows per page"
          >
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={200}>200 / page</option>
            <option value={500}>500 / page</option>
          </select>
        </div>
      </div>
    </div>
  )
}
