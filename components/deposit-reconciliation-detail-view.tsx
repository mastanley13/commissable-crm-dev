"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ClipboardCheck, Eye, FileDown, Link2, Trash2 } from "lucide-react"
import { DynamicTable, type Column } from "./dynamic-table"
import { ListHeader, type ColumnFilter } from "./list-header"
import type { BulkActionsGridProps } from "./bulk-actions-grid"
import { calculateMinWidth } from "@/lib/column-width-utils"
import { cn } from "@/lib/utils"
import type { DepositLineItemRow, SuggestedMatchScheduleRow } from "@/lib/mock-data"
import { useToasts } from "./toast"
import { ColumnChooserModal } from "./column-chooser-modal"
import {
  DepositLineStatusFilterDropdown,
  type DepositLineStatusFilterValue
} from "./deposit-line-status-filter-dropdown"
import {
  ReconciliationScheduleStatusFilterDropdown,
  type ReconciliationScheduleFilterValue
} from "./reconciliation-schedule-status-filter-dropdown"

export interface DepositReconciliationMetadata {
  id: string
  depositName: string
  depositDate: string
  createdBy: string
  paymentType: string
  usageTotal: number
  unallocated: number
  allocated: number
}

type LineTabKey = DepositLineStatusFilterValue
type ScheduleTabKey = ReconciliationScheduleFilterValue

const depositFieldLabels = {
  accountId: "Account ID - Vendor",
  lineItem: "Line Item",
  status: "Deposit Status",
  paymentDate: "Payment Date",
  accountName: "Account Name",
  vendorName: "Vendor Name",
  productName: "Product Name - Vendor",
  usage: "Usage",
  usageAllocated: "Usage Allocated",
  usageUnallocated: "Usage Unallocated",
  commissionRate: "Actual Commission Rate %",
  commission: "Actual Commission",
  commissionAllocated: "Commission Allocated",
  commissionUnallocated: "Commission Unallocated",
  customerIdVendor: "Customer ID - Vendor",
  orderIdVendor: "Order ID - Vendor",
  distributorName: "Distributor Name"
} as const

type LineFilterColumnId = keyof typeof depositFieldLabels

const depositFieldOrder: LineFilterColumnId[] = [
  "accountId",
  "lineItem",
  "status",
  "paymentDate",
  "accountName",
  "vendorName",
  "productName",
  "usage",
  "usageAllocated",
  "usageUnallocated",
  "commissionRate",
  "commission",
  "commissionAllocated",
  "commissionUnallocated",
  "customerIdVendor",
  "orderIdVendor",
  "distributorName"
]

const lineFilterColumnOptions: Array<{ id: LineFilterColumnId; label: string }> = depositFieldOrder.map(id => ({
  id,
  label: depositFieldLabels[id]
}))

const LINE_FILTER_COLUMN_IDS = new Set<LineFilterColumnId>(lineFilterColumnOptions.map(option => option.id))

const scheduleFieldLabels = {
  lineItem: "Line Item",
  matchConfidence: "Match Confidence",
  vendorName: "Vendor Name",
  legalName: "Legal Name",
  productNameVendor: "Product Name - Vendor",
  revenueScheduleDate: "Revenue Schedule Date",
  revenueScheduleName: "Revenue Schedule Name",
  quantity: "Quantity",
  priceEach: "Price Each",
  expectedUsageGross: "Expected Usage Gross",
  expectedUsageAdjustment: "Expected Usage Adjustment",
  expectedUsageNet: "Expected Usage Net",
  actualUsage: "Actual Usage",
  usageBalance: "Usage Balance",
  paymentDate: "Payment Date",
  expectedCommissionGross: "Expected Commission Gross",
  expectedCommissionAdjustment: "Expected Commission Adjustment",
  expectedCommissionNet: "Expected Commission Net",
  actualCommission: "Actual Commission",
  commissionDifference: "Commission Difference",
  expectedCommissionRatePercent: "Expected Commission Rate %",
  actualCommissionRatePercent: "Actual Commission Rate %",
  commissionRateDifference: "Commission Rate Difference"
} as const

const scheduleFieldOrder: Array<keyof typeof scheduleFieldLabels> = [
  "lineItem",
  "matchConfidence",
  "vendorName",
  "legalName",
  "productNameVendor",
  "revenueScheduleDate",
  "revenueScheduleName",
  "quantity",
  "priceEach",
  "expectedUsageGross",
  "expectedUsageAdjustment",
  "expectedUsageNet",
  "actualUsage",
  "usageBalance",
  "paymentDate",
  "expectedCommissionGross",
  "expectedCommissionAdjustment",
  "expectedCommissionNet",
  "actualCommission",
  "commissionDifference",
  "expectedCommissionRatePercent",
  "actualCommissionRatePercent",
  "commissionRateDifference"
]

type ScheduleFilterColumnId = keyof typeof scheduleFieldLabels

const scheduleFilterColumnOptions: Array<{ id: ScheduleFilterColumnId; label: string }> =
  scheduleFieldOrder.map(id => ({
    id,
    label: scheduleFieldLabels[id]
  }))

const SCHEDULE_FILTER_COLUMN_IDS = new Set<ScheduleFilterColumnId>(scheduleFilterColumnOptions.map(option => option.id))

type LineColumnFilter = ColumnFilter & { columnId: LineFilterColumnId }
type ScheduleColumnFilter = ColumnFilter & { columnId: ScheduleFilterColumnId }

const lineStatusStyles: Record<DepositLineItemRow["status"], string> = {
  Matched: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  Unreconciled: "bg-red-100 text-red-700 border border-red-200",
  "Partially Matched": "bg-amber-100 text-amber-700 border border-amber-200"
}

const scheduleStatusStyles: Record<SuggestedMatchScheduleRow["status"], string> = {
  Suggested: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  Reconciled: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "Un-Reconciled": "bg-amber-50 text-amber-700 border border-amber-200"
}

const TABLE_CONTAINER_PADDING = 16
const TABLE_BODY_MIN_HEIGHT = 200
const TABLE_BODY_FOOTER_RESERVE = 96
const DEFAULT_TABLE_BODY_HEIGHT = 360

function useTableScrollMetrics() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerHeight, setContainerHeight] = useState<number>()

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const available = window.innerHeight - rect.top - TABLE_CONTAINER_PADDING
    if (!Number.isFinite(available)) return
    setContainerHeight(Math.max(Math.floor(available), 0))
  }, [])

  const refCallback = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node
    if (node) {
      window.requestAnimationFrame(() => {
        measure()
      })
    }
  }, [measure])

  useLayoutEffect(() => {
    measure()
  }, [measure])

  useEffect(() => {
    const handleResize = () => measure()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [measure])

  const maxBodyHeight = useMemo(() => {
    if (containerHeight == null) return undefined
    const maxBodyWithinContainer = Math.max(containerHeight - TABLE_CONTAINER_PADDING, 0)
    const preferredBodyHeight = Math.max(
      containerHeight - TABLE_BODY_FOOTER_RESERVE,
      Math.floor(containerHeight * 0.65),
      0
    )
    const boundedPreferredHeight = Math.min(preferredBodyHeight, maxBodyWithinContainer)
    if (boundedPreferredHeight >= TABLE_BODY_MIN_HEIGHT) return boundedPreferredHeight
    const minTarget = Math.min(TABLE_BODY_MIN_HEIGHT, maxBodyWithinContainer)
    return Math.max(boundedPreferredHeight, minTarget)
  }, [containerHeight])

  const requestMeasure = useCallback(() => {
    window.requestAnimationFrame(() => {
      measure()
    })
  }, [measure])

  return { refCallback, maxBodyHeight, requestMeasure }
}

interface DepositReconciliationDetailViewProps {
  metadata: DepositReconciliationMetadata
  lineItems: DepositLineItemRow[]
  schedules: SuggestedMatchScheduleRow[]
  loading?: boolean
  scheduleLoading?: boolean
  selectedLineId?: string | null
  onLineSelectionChange?: (lineId: string | null) => void
  onMatchApplied?: () => void
  onUnmatchApplied?: () => void
  devMatchingControls?: {
    engineMode: "env" | "legacy" | "hierarchical"
    includeFutureSchedules: boolean
    onEngineModeChange: (mode: "env" | "legacy" | "hierarchical") => void
    onIncludeFutureSchedulesChange: (next: boolean) => void
  }
}

interface MetaStatProps {
  label: string
  value: string
  emphasis?: boolean
  wrapValue?: boolean
}

function MetaStat({ label, value, emphasis = false, wrapValue = false }: MetaStatProps) {
  return (
    <div className="px-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-semibold text-slate-900",
          emphasis ? "text-base" : "text-sm",
          wrapValue ? "break-all" : undefined
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function DepositReconciliationDetailView({
  metadata,
  lineItems,
  schedules,
  loading = false,
  scheduleLoading = false,
  selectedLineId,
  onLineSelectionChange,
  onMatchApplied,
  onUnmatchApplied,
  devMatchingControls
}: DepositReconciliationDetailViewProps) {
  const { showSuccess, showError, ToastContainer } = useToasts()
  const [lineTab, setLineTab] = useState<LineTabKey>("all")
  const [scheduleTab, setScheduleTab] = useState<ScheduleTabKey>("suggested")
  const [lineSearch, setLineSearch] = useState("")
  const [scheduleSearch, setScheduleSearch] = useState("")
  const [lineItemRows, setLineItemRows] = useState<DepositLineItemRow[]>(lineItems)
  const [scheduleRows, setScheduleRows] = useState<SuggestedMatchScheduleRow[]>(schedules)
  const [selectedLineItems, setSelectedLineItems] = useState<string[]>([])
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([])
  const [lineColumnFilters, setLineColumnFilters] = useState<LineColumnFilter[]>([])
  const [scheduleColumnFilters, setScheduleColumnFilters] = useState<ScheduleColumnFilter[]>([])
  const [showLineColumnSettings, setShowLineColumnSettings] = useState(false)
  const [showScheduleColumnSettings, setShowScheduleColumnSettings] = useState(false)
  const {
    refCallback: lineTableAreaRefCallback,
    maxBodyHeight: lineTableBodyHeight,
    requestMeasure: requestLineTableMeasure
  } = useTableScrollMetrics()
  const {
    refCallback: scheduleTableAreaRefCallback,
    maxBodyHeight: scheduleTableBodyHeight,
    requestMeasure: requestScheduleTableMeasure
  } = useTableScrollMetrics()

  useEffect(() => {
    setLineItemRows(lineItems)
    setSelectedLineItems(prev => prev.filter(id => lineItems.some(item => item.id === id)))
    if (selectedLineId && !lineItems.some(item => item.id === selectedLineId)) {
      onLineSelectionChange?.(lineItems.length > 0 ? lineItems[0]!.id : null)
    }
  }, [lineItems, selectedLineId, onLineSelectionChange])

  useEffect(() => {
    if (selectedLineId) {
      setSelectedLineItems([selectedLineId])
    } else {
      setSelectedLineItems([])
    }
  }, [selectedLineId])

  useEffect(() => {
    setScheduleRows(schedules)
    setSelectedSchedules(previous => previous.filter(id => schedules.some(item => item.id === id)))
  }, [schedules])

  useEffect(() => {
    requestLineTableMeasure()
  }, [requestLineTableMeasure, lineItemRows.length])

  useEffect(() => {
    requestScheduleTableMeasure()
  }, [requestScheduleTableMeasure, scheduleRows.length])

  const sharedTableBodyHeight = useMemo(() => {
    const heights: number[] = []
    if (typeof lineTableBodyHeight === "number") heights.push(lineTableBodyHeight)
    if (typeof scheduleTableBodyHeight === "number") heights.push(scheduleTableBodyHeight)
    if (heights.length === 0) return undefined
    return Math.min(Math.min(...heights), DEFAULT_TABLE_BODY_HEIGHT)
  }, [lineTableBodyHeight, scheduleTableBodyHeight])

  const normalizedLineTableHeight =
    sharedTableBodyHeight ?? lineTableBodyHeight ?? DEFAULT_TABLE_BODY_HEIGHT
  const normalizedScheduleTableHeight =
    sharedTableBodyHeight ?? scheduleTableBodyHeight ?? DEFAULT_TABLE_BODY_HEIGHT

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2
      }),
    []
  )
  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }),
    []
  )
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      }),
    []
  )

  const lineSearchValue = lineSearch.trim().toLowerCase()
  const scheduleSearchValue = scheduleSearch.trim().toLowerCase()

  const renderDevMatchingControls = () => {
    if (!devMatchingControls) return null
    const { engineMode, includeFutureSchedules, onEngineModeChange, onIncludeFutureSchedulesChange } =
      devMatchingControls

    return (
      <div className="mb-2 flex items-center justify-between rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <div className="flex items-center gap-3">
          <span className="font-semibold uppercase tracking-wide text-slate-500">
            Matching Dev Controls
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-600">Engine:</span>
            <button
              type="button"
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px]",
                engineMode === "env"
                  ? "bg-slate-800 text-white"
                  : "bg-white text-slate-700 border border-slate-300"
              )}
              onClick={() => onEngineModeChange("env")}
            >
              Env default
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px]",
                engineMode === "legacy"
                  ? "bg-slate-800 text-white"
                  : "bg-white text-slate-700 border border-slate-300"
              )}
              onClick={() => onEngineModeChange("legacy")}
            >
              Legacy
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px]",
                engineMode === "hierarchical"
                  ? "bg-slate-800 text-white"
                  : "bg-white text-slate-700 border border-slate-300"
              )}
              onClick={() => onEngineModeChange("hierarchical")}
            >
              Hierarchical
            </button>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-3 w-3 rounded border-slate-400 text-slate-800"
            checked={includeFutureSchedules}
            onChange={event => onIncludeFutureSchedulesChange(event.target.checked)}
          />
          <span className="text-[11px] font-medium text-slate-600">Include future schedules</span>
        </label>
      </div>
    )
  }

  const showDevControls = Boolean(devMatchingControls)

  const handleRowMatchClick = useCallback(
    async (lineId: string) => {
      if (!lineId) {
        showError("No line selected", "Select a deposit line item to match.")
        return
      }
      const scheduleId = selectedSchedules[0]
      if (!scheduleId) {
        showError("No schedule selected", "Select a suggested schedule to match.")
        return
      }
      try {
        const response = await fetch(
          `/api/reconciliation/deposits/${encodeURIComponent(metadata.id)}/line-items/${encodeURIComponent(lineId)}/apply-match`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              revenueScheduleId: scheduleId
            })
          }
        )
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to apply match")
        }

        setSelectedLineItems([lineId])
        onLineSelectionChange?.(lineId)
        setSelectedSchedules([])
        onMatchApplied?.()
        showSuccess("Match applied", "The selected line item has been matched to the schedule.")
      } catch (err) {
        console.error("Failed to apply match", err)
        showError("Unable to match", err instanceof Error ? err.message : "Unknown error")
      }
    },
    [metadata.id, onLineSelectionChange, onMatchApplied, selectedSchedules, showError, showSuccess]
  )

  const handleLineColumnFiltersChange = useCallback((filters: ColumnFilter[]) => {
    if (!filters || filters.length === 0) {
      setLineColumnFilters([])
      return
    }

    const sanitized: LineColumnFilter[] = []
    for (const filter of filters) {
      const columnId = filter.columnId as LineFilterColumnId
      if (!LINE_FILTER_COLUMN_IDS.has(columnId)) continue
      const trimmed = (filter.value ?? "").trim()
      if (!trimmed) continue
      sanitized.push({ ...filter, columnId, value: trimmed })
    }
    setLineColumnFilters(sanitized)
  }, [])

  const handleScheduleColumnFiltersChange = useCallback((filters: ColumnFilter[]) => {
    if (!filters || filters.length === 0) {
      setScheduleColumnFilters([])
      return
    }

    const sanitized: ScheduleColumnFilter[] = []
    for (const filter of filters) {
      const columnId = filter.columnId as ScheduleFilterColumnId
      if (!SCHEDULE_FILTER_COLUMN_IDS.has(columnId)) continue
      const trimmed = (filter.value ?? "").trim()
      if (!trimmed) continue
      sanitized.push({ ...filter, columnId, value: trimmed })
    }
    setScheduleColumnFilters(sanitized)
  }, [])

  const normalizedLineFilters = useMemo(
    () =>
      lineColumnFilters.map(filter => ({
        columnId: filter.columnId,
        value: filter.value.trim().toLowerCase()
      })),
    [lineColumnFilters]
  )

  const normalizedScheduleFilters = useMemo(
    () =>
      scheduleColumnFilters.map(filter => ({
        columnId: filter.columnId,
        value: filter.value.trim().toLowerCase()
      })),
    [scheduleColumnFilters]
  )

  const getLineFilterValue = useCallback(
    (row: DepositLineItemRow, columnId: LineFilterColumnId) => {
      switch (columnId) {
        case "accountId":
          return row.accountId
        case "lineItem":
          return String(row.lineItem)
        case "status":
          return row.status
        case "paymentDate": {
          const parsed = new Date(row.paymentDate)
          return Number.isNaN(parsed.getTime()) ? row.paymentDate : dateFormatter.format(parsed)
        }
        case "accountName":
          return row.accountName
        case "vendorName":
          return row.vendorName
        case "productName":
          return row.productName
        case "usage":
          return currencyFormatter.format(row.usage)
        case "usageAllocated":
          return currencyFormatter.format(row.usageAllocated)
        case "usageUnallocated":
          return currencyFormatter.format(row.usageUnallocated)
        case "commissionRate":
          return percentFormatter.format(row.commissionRate)
        case "commission":
          return currencyFormatter.format(row.commission)
        case "commissionAllocated":
          return currencyFormatter.format(row.commissionAllocated)
        case "commissionUnallocated":
          return currencyFormatter.format(row.commissionUnallocated)
        case "customerIdVendor":
          return row.customerIdVendor
        case "orderIdVendor":
          return row.orderIdVendor
        case "distributorName":
          return row.distributorName
        default:
          return ""
      }
    },
    [currencyFormatter, percentFormatter, dateFormatter]
  )

  const getScheduleFilterValue = useCallback(
    (row: SuggestedMatchScheduleRow, columnId: ScheduleFilterColumnId) => {
      switch (columnId) {
        case "lineItem":
          return String(row.lineItem)
        case "matchConfidence":
          return percentFormatter.format(row.matchConfidence)
        case "vendorName":
          return row.vendorName
        case "legalName":
          return row.legalName
        case "productNameVendor":
          return row.productNameVendor
        case "revenueScheduleDate": {
          const parsed = new Date(row.revenueScheduleDate)
          return Number.isNaN(parsed.getTime()) ? row.revenueScheduleDate : dateFormatter.format(parsed)
        }
        case "revenueScheduleName":
          return row.revenueScheduleName
        case "quantity":
          return String(row.quantity)
        case "priceEach":
          return currencyFormatter.format(row.priceEach)
        case "expectedUsageGross":
          return currencyFormatter.format(row.expectedUsageGross)
        case "expectedUsageAdjustment":
          return currencyFormatter.format(row.expectedUsageAdjustment)
        case "expectedUsageNet":
          return currencyFormatter.format(row.expectedUsageNet)
        case "actualUsage":
          return currencyFormatter.format(row.actualUsage)
        case "usageBalance":
          return currencyFormatter.format(row.usageBalance)
        case "paymentDate": {
          const parsed = new Date(row.paymentDate)
          return Number.isNaN(parsed.getTime()) ? row.paymentDate : dateFormatter.format(parsed)
        }
        case "expectedCommissionGross":
          return currencyFormatter.format(row.expectedCommissionGross)
        case "expectedCommissionAdjustment":
          return currencyFormatter.format(row.expectedCommissionAdjustment)
        case "expectedCommissionNet":
          return currencyFormatter.format(row.expectedCommissionNet)
        case "actualCommission":
          return currencyFormatter.format(row.actualCommission)
        case "commissionDifference":
          return currencyFormatter.format(row.commissionDifference)
        case "expectedCommissionRatePercent":
          return percentFormatter.format(row.expectedCommissionRatePercent)
        case "actualCommissionRatePercent":
          return percentFormatter.format(row.actualCommissionRatePercent)
        case "commissionRateDifference":
          return percentFormatter.format(row.commissionRateDifference)
        default:
          return ""
      }
    },
    [currencyFormatter, percentFormatter, dateFormatter]
  )

  const filteredLineItems = useMemo(() => {
    return lineItemRows.filter(item => {
      const matchesTab =
        lineTab === "all"
          ? true
          : lineTab === "matched"
            ? item.status === "Matched"
            : lineTab === "unmatched"
              ? item.status === "Unreconciled"
              : item.status === "Partially Matched"

      const matchesSearch = lineSearchValue
        ? [
            item.accountName,
            item.accountId,
            item.vendorName,
            item.productName,
            item.customerIdVendor,
            item.orderIdVendor,
            item.distributorName
          ]
            .map(value => value.toLowerCase())
            .some(value => value.includes(lineSearchValue))
        : true

      const matchesColumnFilters =
        normalizedLineFilters.length === 0 ||
        normalizedLineFilters.every(filter => {
          const candidate = getLineFilterValue(item, filter.columnId).toLowerCase()
          return candidate.includes(filter.value)
        })

      return matchesTab && matchesSearch && matchesColumnFilters
    })
  }, [lineItemRows, lineTab, lineSearchValue, normalizedLineFilters, getLineFilterValue])

  const filteredSchedules = useMemo(() => {
    return scheduleRows.filter(schedule => {
      const matchesTab =
        scheduleTab === "all"
          ? true
          : scheduleTab === "suggested"
            ? schedule.status === "Suggested"
            : scheduleTab === "reconciled"
              ? schedule.status === "Reconciled"
              : schedule.status === "Un-Reconciled"

      const matchesSearch = scheduleSearchValue
        ? [
            schedule.revenueScheduleName,
            schedule.vendorName,
            schedule.legalName,
            schedule.productNameVendor
          ]
            .map(value => value.toLowerCase())
            .some(value => value.includes(scheduleSearchValue))
        : true

      const matchesColumnFilters =
        normalizedScheduleFilters.length === 0 ||
        normalizedScheduleFilters.every(filter => {
          const candidate = getScheduleFilterValue(schedule, filter.columnId).toLowerCase()
          return candidate.includes(filter.value)
        })

      return matchesTab && matchesSearch && matchesColumnFilters
    })
  }, [scheduleRows, scheduleTab, scheduleSearchValue, normalizedScheduleFilters, getScheduleFilterValue])

  const baseLineColumns = useMemo<Column[]>(() => {
    const minTextWidth = (label: string) => calculateMinWidth({ label, type: "text", sortable: false })
    return [
      {
        id: "select",
        label: "Select All",
        width: 140,
        minWidth: 100,
        type: "checkbox",
        sortable: false
      },
      {
        id: "match",
        label: "Match",
        width: 140,
        minWidth: 120,
        accessor: "id",
        render: (_value: string, row: DepositLineItemRow) => (
          <button
            type="button"
            onClick={event => {
              event.stopPropagation()
              if (row.id) {
                void handleRowMatchClick(row.id)
              }
            }}
            className="rounded-full border border-primary-200 bg-white px-4 py-1.5 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
          >
            Match
          </button>
        )
      },
      {
        id: "accountId",
        label: depositFieldLabels.accountId,
        width: 220,
        minWidth: minTextWidth(depositFieldLabels.accountId)
      },
      {
        id: "lineItem",
        label: depositFieldLabels.lineItem,
        width: 140,
        minWidth: minTextWidth(depositFieldLabels.lineItem)
      },
      {
        id: "status",
        label: depositFieldLabels.status,
        width: 200,
        minWidth: minTextWidth(depositFieldLabels.status),
        render: (value: DepositLineItemRow["status"]) => (
          <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", lineStatusStyles[value])}>
            {value}
          </span>
        )
      },
      {
        id: "paymentDate",
        label: depositFieldLabels.paymentDate,
        width: 180,
        minWidth: minTextWidth(depositFieldLabels.paymentDate),
        render: (value: string) => {
          const parsed = new Date(value)
          return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed)
        }
      },
      {
        id: "accountName",
        label: depositFieldLabels.accountName,
        width: 220,
        minWidth: minTextWidth(depositFieldLabels.accountName)
      },
      {
        id: "vendorName",
        label: depositFieldLabels.vendorName,
        width: 200,
        minWidth: minTextWidth(depositFieldLabels.vendorName)
      },
      {
        id: "productName",
        label: depositFieldLabels.productName,
        width: 240,
        minWidth: minTextWidth(depositFieldLabels.productName)
      },
      {
        id: "usage",
        label: depositFieldLabels.usage,
        width: 140,
        minWidth: 140,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "usageAllocated",
        label: depositFieldLabels.usageAllocated,
        width: 180,
        minWidth: 160,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "usageUnallocated",
        label: depositFieldLabels.usageUnallocated,
        width: 200,
        minWidth: 180,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "commissionRate",
        label: depositFieldLabels.commissionRate,
        width: 200,
        minWidth: 170,
        render: (value: number) => percentFormatter.format(value)
      },
      {
        id: "commission",
        label: depositFieldLabels.commission,
        width: 160,
        minWidth: 140,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "commissionAllocated",
        label: depositFieldLabels.commissionAllocated,
        width: 200,
        minWidth: 180,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "commissionUnallocated",
        label: depositFieldLabels.commissionUnallocated,
        width: 210,
        minWidth: 190,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "customerIdVendor",
        label: depositFieldLabels.customerIdVendor,
        width: 200,
        minWidth: minTextWidth(depositFieldLabels.customerIdVendor)
      },
      {
        id: "orderIdVendor",
        label: depositFieldLabels.orderIdVendor,
        width: 200,
        minWidth: minTextWidth(depositFieldLabels.orderIdVendor)
      },
      {
        id: "distributorName",
        label: depositFieldLabels.distributorName,
        width: 220,
        minWidth: minTextWidth(depositFieldLabels.distributorName)
      }
    ]
  }, [currencyFormatter, percentFormatter, dateFormatter, handleRowMatchClick])

  const baseScheduleColumns = useMemo<Column[]>(() => {
    const minTextWidth = (label: string) => calculateMinWidth({ label, type: "text", sortable: false })
    return [
      {
        id: "select",
        label: "Select All",
        width: 140,
        minWidth: 100,
        type: "checkbox",
        sortable: false
      },
      {
        id: "lineItem",
        label: scheduleFieldLabels.lineItem,
        width: 140,
        minWidth: minTextWidth(scheduleFieldLabels.lineItem)
      },
      {
        id: "matchConfidence",
        label: scheduleFieldLabels.matchConfidence,
        width: 180,
        minWidth: minTextWidth(scheduleFieldLabels.matchConfidence),
        render: (value: number) => percentFormatter.format(value)
      },
      {
        id: "vendorName",
        label: scheduleFieldLabels.vendorName,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.vendorName)
      },
      {
        id: "legalName",
        label: scheduleFieldLabels.legalName,
        width: 220,
        minWidth: minTextWidth(scheduleFieldLabels.legalName)
      },
      {
        id: "productNameVendor",
        label: scheduleFieldLabels.productNameVendor,
        width: 240,
        minWidth: minTextWidth(scheduleFieldLabels.productNameVendor)
      },
      {
        id: "revenueScheduleDate",
        label: scheduleFieldLabels.revenueScheduleDate,
        width: 180,
        minWidth: minTextWidth(scheduleFieldLabels.revenueScheduleDate),
        render: (value: string) => {
          const parsed = new Date(value)
          return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed)
        }
      },
      {
        id: "revenueScheduleName",
        label: scheduleFieldLabels.revenueScheduleName,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.revenueScheduleName)
      },
      {
        id: "quantity",
        label: scheduleFieldLabels.quantity,
        width: 120,
        minWidth: minTextWidth(scheduleFieldLabels.quantity)
      },
      {
        id: "priceEach",
        label: scheduleFieldLabels.priceEach,
        width: 140,
        minWidth: minTextWidth(scheduleFieldLabels.priceEach),
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "expectedUsageGross",
        label: scheduleFieldLabels.expectedUsageGross,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.expectedUsageGross),
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "expectedUsageAdjustment",
        label: scheduleFieldLabels.expectedUsageAdjustment,
        width: 220,
        minWidth: minTextWidth(scheduleFieldLabels.expectedUsageAdjustment),
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "expectedUsageNet",
        label: scheduleFieldLabels.expectedUsageNet,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.expectedUsageNet),
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "actualUsage",
        label: scheduleFieldLabels.actualUsage,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.actualUsage),
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "usageBalance",
        label: scheduleFieldLabels.usageBalance,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.usageBalance),
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "paymentDate",
        label: scheduleFieldLabels.paymentDate,
        width: 180,
        minWidth: minTextWidth(scheduleFieldLabels.paymentDate),
        render: (value: string) => {
          const parsed = new Date(value)
          return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed)
        }
      },
      {
        id: "expectedCommissionGross",
        label: scheduleFieldLabels.expectedCommissionGross,
        width: 220,
        minWidth: minTextWidth(scheduleFieldLabels.expectedCommissionGross),
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "expectedCommissionAdjustment",
        label: scheduleFieldLabels.expectedCommissionAdjustment,
        width: 240,
        minWidth: minTextWidth(scheduleFieldLabels.expectedCommissionAdjustment),
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "expectedCommissionNet",
        label: scheduleFieldLabels.expectedCommissionNet,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.expectedCommissionNet),
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "actualCommission",
        label: scheduleFieldLabels.actualCommission,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.actualCommission),
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "commissionDifference",
        label: scheduleFieldLabels.commissionDifference,
        width: 220,
        minWidth: minTextWidth(scheduleFieldLabels.commissionDifference),
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "expectedCommissionRatePercent",
        label: scheduleFieldLabels.expectedCommissionRatePercent,
        width: 240,
        minWidth: minTextWidth(scheduleFieldLabels.expectedCommissionRatePercent),
        render: (value: number) => percentFormatter.format(value)
      },
      {
        id: "actualCommissionRatePercent",
        label: scheduleFieldLabels.actualCommissionRatePercent,
        width: 240,
        minWidth: minTextWidth(scheduleFieldLabels.actualCommissionRatePercent),
        render: (value: number) => percentFormatter.format(value)
      },
      {
        id: "commissionRateDifference",
        label: scheduleFieldLabels.commissionRateDifference,
        width: 240,
        minWidth: minTextWidth(scheduleFieldLabels.commissionRateDifference),
        render: (value: number) => percentFormatter.format(value)
      },
      {
        id: "status",
        label: "Status",
        width: 160,
        minWidth: minTextWidth("Status"),
        render: (value: SuggestedMatchScheduleRow["status"]) => (
          <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", scheduleStatusStyles[value])}>
            {value}
          </span>
        )
      }
    ]
  }, [currencyFormatter, percentFormatter, dateFormatter])

  const [lineTableColumns, setLineTableColumns] = useState<Column[]>(baseLineColumns)
  const [scheduleTableColumns, setScheduleTableColumns] = useState<Column[]>(baseScheduleColumns)

  useEffect(() => {
    setLineTableColumns(baseLineColumns)
  }, [baseLineColumns])

  useEffect(() => {
    setScheduleTableColumns(baseScheduleColumns)
  }, [baseScheduleColumns])

  const handleLineColumnsChange = useCallback((columns: Column[]) => {
    setLineTableColumns(columns)
  }, [])

  const handleScheduleColumnsChange = useCallback((columns: Column[]) => {
    setScheduleTableColumns(columns)
  }, [])

  const handleLineColumnModalApply = useCallback((columns: Column[]) => {
    setLineTableColumns(columns)
    setShowLineColumnSettings(false)
  }, [])

  const handleScheduleColumnModalApply = useCallback((columns: Column[]) => {
    setScheduleTableColumns(columns)
    setShowScheduleColumnSettings(false)
  }, [])

  const handleLineColumnModalClose = useCallback(() => {
    setShowLineColumnSettings(false)
  }, [])

  const handleScheduleColumnModalClose = useCallback(() => {
    setShowScheduleColumnSettings(false)
  }, [])

  const handleLineItemSelect = useCallback(
    (lineId: string, selected: boolean) => {
      if (selected) {
        setSelectedLineItems([lineId])
        onLineSelectionChange?.(lineId)
      } else {
        setSelectedLineItems([])
        onLineSelectionChange?.(null)
      }
    },
    [onLineSelectionChange]
  )

  const handleLineItemSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        if (filteredLineItems.length > 0) {
          const firstId = filteredLineItems[0]!.id
          setSelectedLineItems([firstId])
          onLineSelectionChange?.(firstId)
        } else {
          setSelectedLineItems([])
          onLineSelectionChange?.(null)
        }
        return
      }
      setSelectedLineItems([])
      onLineSelectionChange?.(null)
    },
    [filteredLineItems, onLineSelectionChange]
  )

  const handleScheduleSelect = useCallback((scheduleId: string, selected: boolean) => {
    setSelectedSchedules(previous => {
      if (selected) {
        if (previous.includes(scheduleId)) return previous
        return [...previous, scheduleId]
      }
      return previous.filter(id => id !== scheduleId)
    })
  }, [])

  const handleScheduleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedSchedules(filteredSchedules.map(schedule => schedule.id))
        return
      }
      setSelectedSchedules([])
    },
    [filteredSchedules]
  )

  const handleBulkLineMatch = useCallback(async () => {
    const lineId = selectedLineId ?? selectedLineItems[0]
    if (!lineId) {
      showError("No line selected", "Select a deposit line item to match.")
      return
    }
    const scheduleId = selectedSchedules[0]
    if (!scheduleId) {
      showError("No schedule selected", "Select a suggested schedule to match.")
      return
    }
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(metadata.id)}/line-items/${encodeURIComponent(lineId)}/apply-match`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revenueScheduleId: scheduleId,
          }),
        }
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to apply match")
      }
      setSelectedSchedules([])
      onMatchApplied?.()
      showSuccess("Match applied", "The selected line item has been matched to the schedule.")
    } catch (err) {
      console.error("Failed to apply match", err)
      showError("Unable to match", err instanceof Error ? err.message : "Unknown error")
    }
  }, [metadata.id, onMatchApplied, selectedLineId, selectedLineItems, selectedSchedules, showError, showSuccess])

  const handleBulkLineUnmatch = useCallback(async () => {
    const lineId = selectedLineId ?? selectedLineItems[0]
    if (!lineId) {
      showError("No line selected", "Select a deposit line item to update.")
      return
    }
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(metadata.id)}/line-items/${encodeURIComponent(lineId)}/unmatch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to mark line unmatched")
      }
      setSelectedSchedules([])
      onUnmatchApplied?.()
      showSuccess("Line reset", "The selected line item was marked as Unreconciled.")
    } catch (err) {
      console.error("Failed to unmatch line", err)
      showError("Unable to mark unmatched", err instanceof Error ? err.message : "Unknown error")
    }
  }, [metadata.id, onUnmatchApplied, selectedLineId, selectedLineItems, showError, showSuccess])

  const handleBulkLineExport = useCallback(() => {
    if (selectedLineItems.length === 0) {
      showError("No line items selected", "Select at least one line item to export.")
      return
    }
    const rows = lineItemRows.filter(item => selectedLineItems.includes(item.id))
    if (rows.length === 0) {
      showError("Line items unavailable", "Unable to locate the selected line items.")
      return
    }
    const headers = depositFieldOrder.map(id => depositFieldLabels[id])
    const getRawValue = (row: DepositLineItemRow, columnId: LineFilterColumnId) => {
      switch (columnId) {
        case "accountId":
          return row.accountId
        case "lineItem":
          return row.lineItem
        case "status":
          return row.status
        case "paymentDate":
          return row.paymentDate
        case "accountName":
          return row.accountName
        case "vendorName":
          return row.vendorName
        case "productName":
          return row.productName
        case "usage":
          return row.usage
        case "usageAllocated":
          return row.usageAllocated
        case "usageUnallocated":
          return row.usageUnallocated
        case "commissionRate":
          return row.commissionRate
        case "commission":
          return row.commission
        case "commissionAllocated":
          return row.commissionAllocated
        case "commissionUnallocated":
          return row.commissionUnallocated
        case "customerIdVendor":
          return row.customerIdVendor
        case "orderIdVendor":
          return row.orderIdVendor
        case "distributorName":
          return row.distributorName
        default:
          return ""
      }
    }
    const escapeCsv = (value: unknown) => {
      if (value === null || value === undefined) return ""
      const stringValue = String(value)
      return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue
    }
    const lines = [
      headers.join(","),
      ...rows.map(row =>
        depositFieldOrder.map(columnId => escapeCsv(getRawValue(row, columnId))).join(",")
      )
    ]
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]
    link.href = url
    link.download = `deposit-line-items-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    showSuccess(
      `Exported ${rows.length} line item${rows.length === 1 ? "" : "s"}`,
      "Check your downloads for the CSV file."
    )
  }, [lineItemRows, selectedLineItems, showError, showSuccess])

  const handleBulkScheduleLink = useCallback(() => {
    if (selectedSchedules.length === 0) {
      showError("No schedules selected", "Select at least one schedule to link.")
      return
    }
    showSuccess(
      `${selectedSchedules.length} schedule${selectedSchedules.length === 1 ? "" : "s"} linked`,
      "The selected schedules have been linked to the deposit."
    )
  }, [selectedSchedules.length, showError, showSuccess])

  const handleBulkScheduleReconcile = useCallback(() => {
    if (selectedSchedules.length === 0) {
      showError("No schedules selected", "Select at least one schedule to update.")
      return
    }
    setScheduleRows(previous =>
      previous.map(row =>
        selectedSchedules.includes(row.id) ? { ...row, status: "Reconciled" } : row
      )
    )
    setSelectedSchedules([])
    showSuccess(
      `${selectedSchedules.length} schedule${selectedSchedules.length === 1 ? "" : "s"} updated`,
      "Marked the selected schedules as Reconciled."
    )
  }, [selectedSchedules, showError, showSuccess])

  const handleBulkScheduleExport = useCallback(() => {
    if (selectedSchedules.length === 0) {
      showError("No schedules selected", "Select at least one schedule to export.")
      return
    }
    const rows = scheduleRows.filter(row => selectedSchedules.includes(row.id))
    if (rows.length === 0) {
      showError("Schedules unavailable", "Unable to locate the selected schedules.")
      return
    }
    const headers = scheduleFieldOrder.map(id => scheduleFieldLabels[id])
    const getRawValue = (row: SuggestedMatchScheduleRow, columnId: ScheduleFilterColumnId) => {
      switch (columnId) {
        case "lineItem":
          return row.lineItem
        case "matchConfidence":
          return row.matchConfidence
        case "vendorName":
          return row.vendorName
        case "legalName":
          return row.legalName
        case "productNameVendor":
          return row.productNameVendor
        case "revenueScheduleDate":
          return row.revenueScheduleDate
        case "revenueScheduleName":
          return row.revenueScheduleName
        case "quantity":
          return row.quantity
        case "priceEach":
          return row.priceEach
        case "expectedUsageGross":
          return row.expectedUsageGross
        case "expectedUsageAdjustment":
          return row.expectedUsageAdjustment
        case "expectedUsageNet":
          return row.expectedUsageNet
        case "actualUsage":
          return row.actualUsage
        case "usageBalance":
          return row.usageBalance
        case "paymentDate":
          return row.paymentDate
        case "expectedCommissionGross":
          return row.expectedCommissionGross
        case "expectedCommissionAdjustment":
          return row.expectedCommissionAdjustment
        case "expectedCommissionNet":
          return row.expectedCommissionNet
        case "actualCommission":
          return row.actualCommission
        case "commissionDifference":
          return row.commissionDifference
        case "expectedCommissionRatePercent":
          return row.expectedCommissionRatePercent
        case "actualCommissionRatePercent":
          return row.actualCommissionRatePercent
        case "commissionRateDifference":
          return row.commissionRateDifference
        default:
          return ""
      }
    }
    const escapeCsv = (value: unknown) => {
      if (value === null || value === undefined) return ""
      const stringValue = String(value)
      return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue
    }
    const lines = [
      headers.join(","),
      ...rows.map(row =>
        scheduleFieldOrder.map(columnId => escapeCsv(getRawValue(row, columnId))).join(",")
      )
    ]
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]
    link.href = url
    link.download = `revenue-schedules-${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    showSuccess(
      `Exported ${rows.length} schedule${rows.length === 1 ? "" : "s"}`,
      "Check your downloads for the CSV file."
    )
  }, [scheduleRows, selectedSchedules, showError, showSuccess])

  const lineBulkActions = useMemo<BulkActionsGridProps>(
    () => ({
      selectedCount: selectedLineItems.length,
      entityName: "line items",
      actions: [
        {
          key: "match",
          label: "Match",
          icon: ClipboardCheck,
          tone: "primary",
          onClick: handleBulkLineMatch
        },
        {
          key: "unmatch",
          label: "Mark Unmatched",
          icon: Trash2,
          tone: "danger",
          onClick: handleBulkLineUnmatch
        },
        {
          key: "export",
          label: "Export CSV",
          icon: FileDown,
          tone: "info",
          onClick: handleBulkLineExport
        }
      ]
    }),
    [handleBulkLineExport, handleBulkLineMatch, handleBulkLineUnmatch, selectedLineItems.length]
  )

  const scheduleBulkActions = useMemo<BulkActionsGridProps>(
    () => ({
      selectedCount: selectedSchedules.length,
      entityName: "schedules",
      actions: [
        {
          key: "link",
          label: "Link",
          icon: Link2,
          tone: "primary",
          onClick: handleBulkScheduleLink
        },
        {
          key: "reconcile",
          label: "Mark Reconciled",
          icon: ClipboardCheck,
          tone: "neutral",
          onClick: handleBulkScheduleReconcile
        },
        {
          key: "export",
          label: "Export CSV",
          icon: FileDown,
          tone: "info",
          onClick: handleBulkScheduleExport
        }
      ]
    }),
    [
      handleBulkScheduleExport,
      handleBulkScheduleLink,
      handleBulkScheduleReconcile,
      selectedSchedules.length
    ]
  )

  const formattedDate = useMemo(() => {
    const parsed = new Date(metadata.depositDate)
    return Number.isNaN(parsed.getTime()) ? metadata.depositDate : dateFormatter.format(parsed)
  }, [metadata.depositDate, dateFormatter])

  return (
    <div className="flex min-h-[calc(100vh-110px)] flex-col gap-3 px-4 pb-4 pt-3 sm:px-6">
      {showDevControls ? renderDevMatchingControls() : null}
      <div className="flex-shrink-0 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">Deposit Reconciliation</p>
        <div className="grid grid-cols-8 gap-4 text-sm font-medium text-slate-700">
          <div className="col-span-2 min-w-0">
            <MetaStat label="Deposit Name" value={metadata.depositName} emphasis wrapValue />
          </div>
          <MetaStat label="Date" value={formattedDate} />
          <MetaStat label="Created By" value={metadata.createdBy} />
          <MetaStat label="Payment Type" value={metadata.paymentType} />
          <MetaStat label="Usage Total" value={currencyFormatter.format(metadata.usageTotal)} emphasis />
          <MetaStat label="Unallocated" value={currencyFormatter.format(metadata.unallocated)} emphasis />
          <MetaStat label="Allocated" value={currencyFormatter.format(metadata.allocated)} emphasis />
        </div>
      </div>

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
        <div className="-mx-5 -mt-4 border-b border-slate-100 px-5 pt-4">
          <ListHeader
            pageTitle="DEPOSIT LINE ITEMS"
            searchPlaceholder="Search deposit line items"
            onSearch={setLineSearch}
            showStatusFilter={false}
            showCreateButton={false}
            compact
            inTab
            filterColumns={lineFilterColumnOptions}
            columnFilters={lineColumnFilters}
            onColumnFiltersChange={handleLineColumnFiltersChange}
            onSettingsClick={() => setShowLineColumnSettings(true)}
            bulkActions={lineBulkActions}
            leftAccessory={
              <div className="flex items-center gap-2">
                <DepositLineStatusFilterDropdown value={lineTab} onChange={setLineTab} size="compact" />
              </div>
            }
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col pt-4">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" ref={lineTableAreaRefCallback}>
            <DynamicTable
              className="flex flex-col"
              columns={lineTableColumns}
              data={filteredLineItems}
              loading={loading}
              emptyMessage="No deposit line items found"
              fillContainerWidth={false}
              maxBodyHeight={normalizedLineTableHeight}
              selectedItems={selectedLineItems}
              onItemSelect={(itemId, selected) => handleLineItemSelect(String(itemId), selected)}
              onSelectAll={handleLineItemSelectAll}
              selectHeaderLabel="Select"
              onColumnsChange={handleLineColumnsChange}
            />
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
        <div className="-mx-5 -mt-4 border-b border-slate-100 px-5 pt-4">
          <ListHeader
            pageTitle="SUGGESTED MATCHES - REVENUE SCHEDULES"
            searchPlaceholder="Search revenue schedules"
            onSearch={setScheduleSearch}
            showStatusFilter={false}
            showCreateButton={false}
            compact
            inTab
            filterColumns={scheduleFilterColumnOptions}
            columnFilters={scheduleColumnFilters}
            onColumnFiltersChange={handleScheduleColumnFiltersChange}
            onSettingsClick={() => setShowScheduleColumnSettings(true)}
            bulkActions={scheduleBulkActions}
            leftAccessory={
              <div className="flex items-center gap-2">
                <ReconciliationScheduleStatusFilterDropdown
                  value={scheduleTab}
                  onChange={setScheduleTab}
                  size="compact"
                />
              </div>
            }
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col pt-4">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" ref={scheduleTableAreaRefCallback}>
            <DynamicTable
              className="flex flex-col"
              columns={scheduleTableColumns}
              data={filteredSchedules}
              loading={scheduleLoading || loading}
              emptyMessage="No suggested schedules found"
              fillContainerWidth
              preferOverflowHorizontalScroll
              maxBodyHeight={normalizedScheduleTableHeight}
              selectedItems={selectedSchedules}
              onItemSelect={(itemId, selected) => handleScheduleSelect(String(itemId), selected)}
              onSelectAll={handleScheduleSelectAll}
              selectHeaderLabel="Select"
              onColumnsChange={handleScheduleColumnsChange}
            />
          </div>
        </div>
      </section>
      <ColumnChooserModal
        isOpen={showLineColumnSettings}
        columns={lineTableColumns}
        onApply={handleLineColumnModalApply}
        onClose={handleLineColumnModalClose}
      />
      <ColumnChooserModal
        isOpen={showScheduleColumnSettings}
        columns={scheduleTableColumns}
        onApply={handleScheduleColumnModalApply}
        onClose={handleScheduleColumnModalClose}
      />
      <ToastContainer />
    </div>
  )
}
