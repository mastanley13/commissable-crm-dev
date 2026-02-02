"use client"

import Link from "next/link"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ClipboardCheck, Eye, FileDown, Plus, Sparkles, Trash2, X } from "lucide-react"
import { DynamicTable, type Column } from "./dynamic-table"
import { ListHeader, type ColumnFilter } from "./list-header"
import type { BulkActionsGridProps } from "./bulk-actions-grid"
import { calculateMinWidth } from "@/lib/column-width-utils"
import { cn } from "@/lib/utils"
import type { DepositLineItemRow, SuggestedMatchScheduleRow } from "@/lib/mock-data"
import { useAuth } from "@/lib/auth-context"
import { useToasts } from "./toast"
import { TabDescription } from "@/components/section/TabDescription"
import { DepositReconciliationTopSection } from "./deposit-reconciliation-top-section"
import { DepositVendorSummaryWidget } from "./deposit-vendor-summary-widget"
import { ColumnChooserModal } from "./column-chooser-modal"
import { TwoStageDeleteDialog } from "./two-stage-delete-dialog"
import { ModalHeader } from "./ui/modal-header"
import { ReconciliationMatchWizardModal } from "./reconciliation-match-wizard-modal"
import { useTablePreferences } from "@/hooks/useTablePreferences"
import { classifyMatchSelection, type MatchSelectionType } from "@/lib/matching/match-selection"
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
  actualReceivedAmount?: number | null
  receivedDate?: string | null
  receivedBy?: string | null
  usageTotal: number
  unallocated: number
  allocated: number
  status: string
  reconciled: boolean
  reconciledAt: string | null
}

export interface AutoMatchSummary {
  processed: number
  autoMatched: number
  alreadyMatched: number
  belowThreshold: number
  noCandidates: number
  errors: number
}

type FlexDecisionAction = "none" | "auto_adjust" | "prompt" | "auto_chargeback"

type FlexDecisionPayload = {
  action: FlexDecisionAction
  usageOverage: number
  usageUnderpayment: number
  usageToleranceAmount: number
  overageAboveTolerance: boolean
  allowedPromptOptions: Array<"Adjust" | "Manual" | "FlexProduct">
}

type FlexPromptState = {
  lineId: string
  scheduleId: string
  decision: FlexDecisionPayload
}

type AiAdjustmentPreviewPayload = {
  suggestion: {
    type: "allocate" | "adjust"
    reason: string
    priorOpenScheduleIds: string[]
  }
  base: {
    scheduleId: string
    scheduleDate: string
    expectedUsageNet: number
    actualUsageNet: number
    usageOverage: number
    expectedCommissionNet: number
    actualCommissionNet: number
    commissionOverage: number
  }
  scope: {
    kind: string
  }
  future: {
    count: number
    schedules: Array<{ id: string; scheduleNumber: string | null; scheduleDate: string | null }>
  }
}

type AiAdjustmentModalState = {
  lineId: string
  scheduleId: string
  applyToFuture: boolean
  loading: boolean
  applying: boolean
  error: string | null
  preview: AiAdjustmentPreviewPayload | null
}

type AllocationDraft = {
  usage: string
  commission: string
}

type LineTabKey = DepositLineStatusFilterValue
type ScheduleTabKey = ReconciliationScheduleFilterValue

function formatPercent(fraction: number) {
  if (!Number.isFinite(fraction) || fraction <= 0) return "0%"
  return `${Math.round(fraction * 100)}%`
}

const depositFieldLabels = {
  accountId: "Other - Account ID",
  otherSource: "Other - Source",
  lineItem: "Line Item",
  status: "Deposit Status",
  paymentDate: "Payment Date",
  accountName: "Account Name",
  vendorName: "Vendor Name",
  productName: "Other - Product Name",
  partNumber: "Other - Part Number",
  usage: "Actual Usage",
  usageAllocated: "Usage Allocated",
  usageUnallocated: "Usage Unallocated",
  commissionRate: "Actual Commission Rate %",
  commission: "Actual Commission",
  commissionAllocated: "Commission Allocated",
  commissionUnallocated: "Commission Unallocated",
  customerIdVendor: "Other - Customer ID",
  orderIdVendor: "Other - Order ID",
  distributorName: "Distributor Name"
} as const

type LineFilterColumnId = keyof typeof depositFieldLabels

const depositFieldOrder: LineFilterColumnId[] = [
  "accountId",
  "otherSource",
  "lineItem",
  "status",
  "paymentDate",
  "accountName",
  "vendorName",
  "productName",
  "partNumber",
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
  matchConfidence: "AI Confidence",
  vendorName: "Vendor Name",
  legalName: "Legal Name",
  productNameVendor: "Other - Product Name",
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

const lineStatusStyles: Record<DepositLineItemRow["status"] | "Reconciled", string> = {
  Matched: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  "Partially Matched": "bg-amber-100 text-amber-700 border border-amber-200",
  Unmatched: "bg-red-100 text-red-700 border border-red-200",
  Suggested: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  Reconciled: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Ignored: "bg-slate-100 text-slate-600 border border-slate-200"
}

const scheduleStatusStyles: Record<SuggestedMatchScheduleRow["status"], string> = {
  Suggested: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  Matched: "bg-sky-50 text-sky-700 border border-sky-200",
  Reconciled: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Unmatched: "bg-amber-50 text-amber-700 border border-amber-200"
}

function getAllocationStatusLabel(status: string): string {
  switch (status) {
    case "Matched":
      return "Matched"
    case "Partially Matched":
      return "Partially Matched"
    case "Unmatched":
      return "Unmatched"
    case "Reconciled":
      return "Reconciled"
    default:
      return status
  }
}

const TABLE_CONTAINER_PADDING = 1
const TABLE_BODY_MIN_HEIGHT = 200
const TABLE_BODY_FOOTER_RESERVE = 1
const DEFAULT_TABLE_BODY_HEIGHT = 260

function useTableScrollMetrics() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerHeight, setContainerHeight] = useState<number>()

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const available = window.innerHeight - rect.top - TABLE_CONTAINER_PADDING
    // Ignore measurements that would collapse the table (e.g. when the container
    // is below the viewport and getBoundingClientRect().top is greater than
    // window.innerHeight). In those cases we keep the last known good height.
    if (!Number.isFinite(available) || available <= 0) return
    setContainerHeight(Math.floor(available))
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
  onConfidencePreferencesUpdated?: () => void
  devMatchingControls?: {
    engineMode: "env" | "legacy" | "hierarchical"
    includeFutureSchedules: boolean
    onEngineModeChange: (mode: "env" | "legacy" | "hierarchical") => void
    onIncludeFutureSchedulesChange: (next: boolean) => void
  }
  onRunAutoMatch?: () => void
  autoMatchLoading?: boolean
  autoMatchSummary?: AutoMatchSummary | null
  onOpenFinalizeDepositReview?: () => void
  onFinalizeDeposit?: () => void
  finalizeLoading?: boolean
  onUnfinalizeDeposit?: () => void
  unfinalizeLoading?: boolean
  includeFutureSchedules?: boolean
  onIncludeFutureSchedulesChange?: (checked: boolean) => void
  onDepositDeleted?: () => void
  onBackToReconciliation?: () => void
}

const inlineFieldLabelClass =
  "text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap flex items-center"
const inlineValueBoxBaseClass =
  "flex min-h-[28px] w-full items-center border-b-2 border-gray-300 bg-transparent pl-[3px] pr-0 py-1 text-[11px] text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis"

interface InlineStatRowProps {
  label: string
  value: ReactNode
  valueTitle?: string
  align?: "left" | "right"
  valueBoxClassName?: string
  labelClassName?: string
}

function InlineStatRow({
  label,
  value,
  valueTitle,
  align = "right",
  valueBoxClassName,
  labelClassName,
}: InlineStatRowProps) {
  const displayValue =
    typeof value === "string" ? (
      <span
        className={cn("block w-full truncate", align === "right" ? "text-right tabular-nums" : "text-left")}
        title={valueTitle ?? value}
      >
        {value}
      </span>
    ) : (
      value
    )

  return (
    <div className="grid items-center gap-3 grid-cols-[minmax(0,160px)_minmax(0,1fr)]">
      <span className={cn(inlineFieldLabelClass, labelClassName)}>{label}</span>
      <div
        className={cn(
          inlineValueBoxBaseClass,
          align === "right" ? "justify-end" : "justify-start",
          valueBoxClassName,
        )}
      >
        {displayValue}
      </div>
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
  onConfidencePreferencesUpdated,
  devMatchingControls,
  onRunAutoMatch,
  autoMatchLoading = false,
  autoMatchSummary = null,
  onOpenFinalizeDepositReview,
  onFinalizeDeposit,
  finalizeLoading = false,
  onUnfinalizeDeposit,
  unfinalizeLoading = false,
  includeFutureSchedules = false,
  onIncludeFutureSchedulesChange,
  onDepositDeleted,
  onBackToReconciliation,
}: DepositReconciliationDetailViewProps) {
  const { hasPermission } = useAuth()
  const { showSuccess, showError, ToastContainer } = useToasts()
  const canManageReconciliation = hasPermission("reconciliation.manage")
  const [confidencePrefs, setConfidencePrefs] = useState({
    suggestedMatchesMinConfidence: 0.7,
    autoMatchMinConfidence: 0.95,
  })
  const [confidencePrefsLoading, setConfidencePrefsLoading] = useState(false)
  const [lineTab, setLineTab] = useState<LineTabKey>("unmatched")
  const [scheduleTab, setScheduleTab] = useState<ScheduleTabKey>("suggested")
  const [lineSearch, setLineSearch] = useState("")
  const [scheduleSearch, setScheduleSearch] = useState("")
  const [lineItemRows, setLineItemRows] = useState<DepositLineItemRow[]>(lineItems)
  const [scheduleRows, setScheduleRows] = useState<SuggestedMatchScheduleRow[]>(schedules)
  const [selectedLineItems, setSelectedLineItems] = useState<string[]>([])
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([])
  const [matchingLineId, setMatchingLineId] = useState<string | null>(null)
  const [undoingLineId, setUndoingLineId] = useState<string | null>(null)
  const [lineColumnFilters, setLineColumnFilters] = useState<LineColumnFilter[]>([])
  const [scheduleColumnFilters, setScheduleColumnFilters] = useState<ScheduleColumnFilter[]>([])
  const [showLineColumnSettings, setShowLineColumnSettings] = useState(false)
  const [showScheduleColumnSettings, setShowScheduleColumnSettings] = useState(false)
  const [showFinalizePreview, setShowFinalizePreview] = useState(false)
  const [showUnreconcilePreview, setShowUnreconcilePreview] = useState(false)
  const [showVendorSummaryModal, setShowVendorSummaryModal] = useState(false)
  const [lineSortConfig, setLineSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [scheduleSortConfig, setScheduleSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [showDeleteDepositDialog, setShowDeleteDepositDialog] = useState(false)
  const [flexPrompt, setFlexPrompt] = useState<FlexPromptState | null>(null)
  const [flexResolving, setFlexResolving] = useState(false)
  const [manualFlexEntryOpen, setManualFlexEntryOpen] = useState(false)
  const [manualFlexUsageAmount, setManualFlexUsageAmount] = useState("")
  const [manualFlexError, setManualFlexError] = useState<string | null>(null)
  const [aiAdjustmentModal, setAiAdjustmentModal] = useState<AiAdjustmentModalState | null>(null)
  const [allocationDraft, setAllocationDraft] = useState<AllocationDraft>({ usage: "", commission: "" })
  const [matchWizard, setMatchWizard] = useState<{
    detectedType: MatchSelectionType
    selectedLines: DepositLineItemRow[]
    selectedSchedules: SuggestedMatchScheduleRow[]
  } | null>(null)
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

  const selectedLineIdRef = useRef<string | null | undefined>(selectedLineId)
  const selectedLineItemsRef = useRef<string[]>([])
  const selectedSchedulesRef = useRef<string[]>([])
  const matchingLineIdRef = useRef<string | null>(null)
  const undoingLineIdRef = useRef<string | null>(null)
  const confidenceSaveTimerRef = useRef<number | null>(null)
  const allocationDraftRef = useRef<AllocationDraft>(allocationDraft)

  useEffect(() => {
    if (lineTab === "unmatched") {
      setScheduleTab("suggested")
      return
    }
    if (lineTab === "matched") {
      setScheduleTab("matched")
      return
    }
    if (lineTab === "reconciled") {
      setScheduleTab("reconciled")
    }
  }, [lineTab])

  useEffect(() => {
    allocationDraftRef.current = allocationDraft
  }, [allocationDraft])

  const selectedScheduleForMatch = useMemo(() => {
    const selected = selectedSchedules[0]
    if (!selected) return null
    return scheduleRows.find(row => row.id === selected) ?? null
  }, [scheduleRows, selectedSchedules])

  const parseAllocationInput = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) return null
    return parsed
  }, [])

  useEffect(() => {
    if (!flexPrompt) {
      setManualFlexEntryOpen(false)
      setManualFlexUsageAmount("")
      setManualFlexError(null)
      return
    }

    setManualFlexEntryOpen(false)
    setManualFlexUsageAmount(flexPrompt.decision.usageOverage.toFixed(2))
    setManualFlexError(null)
  }, [flexPrompt])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadPrefs = async () => {
      setConfidencePrefsLoading(true)
      try {
        const response = await fetch("/api/reconciliation/user-settings", {
          cache: "no-store",
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load confidence settings")
        }
        const nextSuggested = Number(payload?.data?.suggestedMatchesMinConfidence)
        const nextAuto = Number(payload?.data?.autoMatchMinConfidence)
        if (cancelled) return
        setConfidencePrefs(previous => ({
          suggestedMatchesMinConfidence: Number.isFinite(nextSuggested) ? nextSuggested : previous.suggestedMatchesMinConfidence,
          autoMatchMinConfidence: Number.isFinite(nextAuto) ? nextAuto : previous.autoMatchMinConfidence,
        }))
      } catch (err) {
        if (cancelled) return
        console.error("Failed to load reconciliation confidence settings", err)
      } finally {
        if (!cancelled) {
          setConfidencePrefsLoading(false)
        }
      }
    }

    void loadPrefs()

    return () => {
      cancelled = true
      controller.abort()
      if (confidenceSaveTimerRef.current) {
        window.clearTimeout(confidenceSaveTimerRef.current)
        confidenceSaveTimerRef.current = null
      }
    }
  }, [])

  const scheduleConfidenceSave = useCallback(
    (updates: Partial<typeof confidencePrefs>) => {
      if (confidenceSaveTimerRef.current) {
        window.clearTimeout(confidenceSaveTimerRef.current)
        confidenceSaveTimerRef.current = null
      }

      confidenceSaveTimerRef.current = window.setTimeout(async () => {
        try {
          const response = await fetch("/api/reconciliation/user-settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          })
          const payload = await response.json().catch(() => null)
          if (!response.ok) {
            throw new Error(payload?.error || "Unable to save confidence settings")
          }
          const savedSuggested = Number(payload?.data?.suggestedMatchesMinConfidence)
          const savedAuto = Number(payload?.data?.autoMatchMinConfidence)
          setConfidencePrefs(previous => ({
            suggestedMatchesMinConfidence: Number.isFinite(savedSuggested) ? savedSuggested : previous.suggestedMatchesMinConfidence,
            autoMatchMinConfidence: Number.isFinite(savedAuto) ? savedAuto : previous.autoMatchMinConfidence,
          }))
          onConfidencePreferencesUpdated?.()
        } catch (err) {
          console.error("Failed to save reconciliation confidence settings", err)
          showError("Unable to save thresholds", err instanceof Error ? err.message : "Unknown error")
        }
      }, 450)
    },
    [onConfidencePreferencesUpdated, showError],
  )

  selectedLineIdRef.current = selectedLineId
  selectedLineItemsRef.current = selectedLineItems
  selectedSchedulesRef.current = selectedSchedules
  matchingLineIdRef.current = matchingLineId
  undoingLineIdRef.current = undoingLineId

  useEffect(() => {
    setLineItemRows(lineItems)
    setSelectedLineItems(prev => prev.filter(id => lineItems.some(item => item.id === id)))
    if (selectedLineId && !lineItems.some(item => item.id === selectedLineId)) {
      onLineSelectionChange?.(null)
    }
  }, [lineItems, selectedLineId, onLineSelectionChange])

  useEffect(() => {
    if (!selectedLineId) return
    setSelectedLineItems(previous => (previous.includes(selectedLineId) ? previous : [selectedLineId, ...previous]))
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

  const selectedLineForMatch = useMemo(() => {
    const lineId = selectedLineId ?? selectedLineItems[0]
    if (!lineId) return null
    return lineItemRows.find(item => item.id === lineId) ?? null
  }, [lineItemRows, selectedLineId, selectedLineItems])

  const isUnmatchSelection = useMemo(() => {
    if (!selectedLineForMatch) return false
    if (selectedSchedules.length !== 1) return false
    return selectedScheduleForMatch?.status === "Matched"
  }, [selectedLineForMatch, selectedSchedules.length, selectedScheduleForMatch?.status])

  useEffect(() => {
    if (!selectedLineForMatch) {
      setAllocationDraft({ usage: "", commission: "" })
      return
    }

    const usageDefault =
      typeof selectedScheduleForMatch?.allocatedUsage === "number"
        ? selectedScheduleForMatch.allocatedUsage
        : Number.isFinite(Number(selectedLineForMatch.usageUnallocated))
          ? Number(selectedLineForMatch.usageUnallocated)
          : Number(selectedLineForMatch.usage ?? 0)

    const commissionDefault =
      typeof selectedScheduleForMatch?.allocatedCommission === "number"
        ? selectedScheduleForMatch.allocatedCommission
        : Number.isFinite(Number(selectedLineForMatch.commissionUnallocated))
          ? Number(selectedLineForMatch.commissionUnallocated)
          : Number(selectedLineForMatch.commission ?? 0)

    setAllocationDraft({
      usage: String(Number.isFinite(usageDefault) ? usageDefault : 0),
      commission: String(Number.isFinite(commissionDefault) ? commissionDefault : 0),
    })
  }, [
    selectedLineForMatch,
    selectedLineForMatch?.usage,
    selectedLineForMatch?.commission,
    selectedLineForMatch?.usageUnallocated,
    selectedLineForMatch?.commissionUnallocated,
    selectedScheduleForMatch?.id,
    selectedScheduleForMatch?.allocatedUsage,
    selectedScheduleForMatch?.allocatedCommission,
  ])

  const matchButtonDisabledReason = useMemo(() => {
    if (matchingLineId || undoingLineId) return "Update in progress"
    if (!selectedLineForMatch) return "Select a deposit line item above"
    if (selectedLineForMatch.reconciled) return "Reconciled line items cannot be changed"
    if (selectedLineForMatch.status === "Ignored") return "Ignored line items cannot be allocated"
    if (selectedSchedules.length === 0) return "Select a schedule below"
    if (selectedSchedules.length > 1) return "Select only one schedule to match to"
    if (selectedScheduleForMatch?.status === "Reconciled") return "Reconciled schedules cannot be changed"
    if (isUnmatchSelection) return null

    const usageAmount = parseAllocationInput(allocationDraft.usage)
    const commissionAmount = parseAllocationInput(allocationDraft.commission)
    if (usageAmount === null || commissionAmount === null) {
      return "Enter allocation amounts"
    }
    if (usageAmount < 0 || commissionAmount < 0) {
      return "Negative amounts must be handled as a Flex/Chargeback"
    }

    const existingUsage = typeof selectedScheduleForMatch?.allocatedUsage === "number" ? selectedScheduleForMatch.allocatedUsage : 0
    const existingCommission =
      typeof selectedScheduleForMatch?.allocatedCommission === "number" ? selectedScheduleForMatch.allocatedCommission : 0

    const allowedUsage = Number(selectedLineForMatch.usageUnallocated ?? 0) + existingUsage
    const allowedCommission = Number(selectedLineForMatch.commissionUnallocated ?? 0) + existingCommission
    if (usageAmount > allowedUsage + 0.005) {
      return "Usage match exceeds remaining unallocated amount"
    }
    if (commissionAmount > allowedCommission + 0.005) {
      return "Commission match exceeds remaining unallocated amount"
    }

    return null
  }, [
    matchingLineId,
    undoingLineId,
    selectedLineForMatch,
    selectedSchedules.length,
    allocationDraft.usage,
    allocationDraft.commission,
    parseAllocationInput,
    selectedScheduleForMatch?.allocatedUsage,
    selectedScheduleForMatch?.allocatedCommission,
    selectedScheduleForMatch?.status,
    isUnmatchSelection,
  ])

  const createFlexButtonLabel = useMemo(() => {
    if (!selectedLineForMatch) return "Create Flex Product"
    const isChargeback = selectedLineForMatch.usage < 0 || selectedLineForMatch.commission < 0
    if (isChargeback) return "Create Chargeback"

    const selectedScheduleId = selectedSchedules.length === 1 ? selectedSchedules[0] : null
    const selectedSchedule = selectedScheduleId
      ? scheduleRows.find(row => row.id === selectedScheduleId)
      : null

    if (selectedSchedule?.flexClassification === "FlexChargeback") {
      return "Create CB-REV"
    }

    return "Create Flex Product"
  }, [scheduleRows, selectedLineForMatch, selectedSchedules])

  const createFlexButtonDisabledReason = useMemo(() => {
    if (matchingLineId || undoingLineId) return "Update in progress"
    if (!selectedLineForMatch) return "Select a deposit line item above"
    if (selectedLineForMatch.reconciled) return "Reconciled line items cannot be changed"
    if (selectedLineForMatch.status === "Ignored") return "Ignored line items cannot be allocated"
    if (!canManageReconciliation) return "Insufficient permissions"
    return null
  }, [canManageReconciliation, matchingLineId, undoingLineId, selectedLineForMatch])

  const matchedLineItems = useMemo(
    () =>
      lineItemRows.filter(
        line => line.status === "Matched" || line.status === "Partially Matched",
      ),
    [lineItemRows],
  )

  const matchedSchedules = useMemo(
    () =>
      scheduleRows.filter(
        schedule => schedule.status === "Matched" || schedule.status === "Reconciled",
      ),
    [scheduleRows],
  )

  const matchedLineItemCount = useMemo(() => {
    return lineItemRows.reduce((count, line) => count + (line.status === "Matched" ? 1 : 0), 0)
  }, [lineItemRows])

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
    () => ({
      format: (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
    }),
    []
  )

  const lineSearchValue = lineSearch.trim().toLowerCase()
  const scheduleSearchValue = scheduleSearch.trim().toLowerCase()

  const renderDevMatchingControls = () => {
    if (!devMatchingControls) return null
    const { engineMode, onEngineModeChange } = devMatchingControls

    return (
      <div className="mb-2 flex items-center justify-between rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-2 text-xs text-slate-700">
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
    </div>
  )
}

  const showDevControls = Boolean(devMatchingControls)
  const includeFutureSchedulesControls =
    devMatchingControls?.includeFutureSchedules !== undefined ? devMatchingControls : undefined

  const handleRowMatchClick = useCallback(
    async (lineId: string) => {
      if (!lineId) {
        showError("No line selected", "Select a deposit line item to match.")
        return
      }
      const targetLine = lineItemRows.find(item => item.id === lineId)
      if (targetLine?.reconciled) {
        showError("Line locked", "Reconciled line items cannot be changed.")
        return
      }
      if (targetLine?.status === "Ignored") {
        showError("Line ignored", "Ignored line items cannot be allocated.")
        return
      }

      const selectedSchedulesNow = selectedSchedulesRef.current
      if (selectedSchedulesNow.length === 0) {
        showError("No schedule selected", "Select a schedule to match to.")
        return
      }
      if (selectedSchedulesNow.length > 1) {
        if (!targetLine) {
          showError("Line missing", "Unable to start matching because the selected line item is missing.")
          return
        }
        const classification = classifyMatchSelection({ lineIds: [lineId], scheduleIds: selectedSchedulesNow })
        if (!classification.ok) {
          showError("Unable to start match", classification.error)
          return
        }
        const selectedWizardSchedules = scheduleRows.filter(row => selectedSchedulesNow.includes(row.id))
        setMatchWizard({
          detectedType: classification.type,
          selectedLines: [targetLine],
          selectedSchedules: selectedWizardSchedules,
        })
        return
      }
      const scheduleId = selectedSchedulesNow[0]!
      try {
        matchingLineIdRef.current = lineId
        setMatchingLineId(lineId)
        const usageAmount = parseAllocationInput(allocationDraftRef.current.usage)
        const commissionAmount = parseAllocationInput(allocationDraftRef.current.commission)
        const response = await fetch(
          `/api/reconciliation/deposits/${encodeURIComponent(metadata.id)}/line-items/${encodeURIComponent(lineId)}/apply-match`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              revenueScheduleId: scheduleId,
              usageAmount: usageAmount ?? undefined,
              commissionAmount: commissionAmount ?? undefined,
            })
          }
        )
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to apply match")
        }

        const flexDecision = payload?.data?.flexDecision as FlexDecisionPayload | undefined
        const flexExecution = payload?.data?.flexExecution as any

        setSelectedLineItems([lineId])
        onLineSelectionChange?.(lineId)
        setSelectedSchedules([])
        onMatchApplied?.()

        if (flexExecution?.action === "ChargebackPending") {
          showSuccess("Chargeback pending", "A Flex Chargeback entry was created and is awaiting approval.")
          return
        }

        if (flexDecision?.action === "auto_adjust") {
          showSuccess("Auto-adjustment created", "A one-time adjustment was created and matched automatically.")
          return
        }

        if (flexDecision?.action === "prompt") {
          setFlexPrompt({ lineId, scheduleId, decision: flexDecision })
          showSuccess("Allocation saved", "Overage exceeds tolerance. Choose how to resolve the variance.")
          return
        }

        showSuccess("Allocation saved", "The selected line item was allocated to the schedule.")
      } catch (err) {
        console.error("Failed to apply match", err)
        showError("Unable to match", err instanceof Error ? err.message : "Unknown error")
      } finally {
        matchingLineIdRef.current = null
        setMatchingLineId(null)
      }
    },
    [
      classifyMatchSelection,
      lineItemRows,
      metadata.id,
      onLineSelectionChange,
      onMatchApplied,
      parseAllocationInput,
      scheduleRows,
      showError,
      showSuccess,
    ]
  )

  const openMatchWizardFromSelection = useCallback(() => {
    const lineIds = selectedLineItemsRef.current
    const scheduleIds = selectedSchedulesRef.current

    const classification = classifyMatchSelection({ lineIds, scheduleIds })
    if (!classification.ok) {
      showError("Unable to start match", classification.error)
      return
    }

    if (classification.type === "OneToOne") {
      const lineId = selectedLineIdRef.current ?? lineIds[0]
      if (!lineId) {
        showError("No line selected", "Select a deposit line item to match.")
        return
      }
      void handleRowMatchClick(lineId)
      return
    }

    const selectedWizardLines = lineItemRows.filter(row => lineIds.includes(row.id))
    const selectedWizardSchedules = scheduleRows.filter(row => scheduleIds.includes(row.id))

    setMatchWizard({
      detectedType: classification.type,
      selectedLines: selectedWizardLines,
      selectedSchedules: selectedWizardSchedules,
    })
  }, [handleRowMatchClick, lineItemRows, scheduleRows, showError])

  const handleCreateFlexSelected = useCallback(async () => {
    const lineId = selectedLineIdRef.current ?? selectedLineItemsRef.current[0]
    if (!lineId) {
      showError("No line selected", "Select a deposit line item to create a flex entry.")
      return
    }

    const targetLine = lineItemRows.find(item => item.id === lineId)
    if (targetLine?.reconciled) {
      showError("Line locked", "Reconciled line items cannot be changed.")
      return
    }
    if (targetLine?.status === "Ignored") {
      showError("Line ignored", "Ignored line items cannot be allocated.")
      return
    }

    const selectedScheduleId =
      selectedSchedulesRef.current.length === 1 ? selectedSchedulesRef.current[0] : null
    const selectedSchedule = selectedScheduleId
      ? scheduleRows.find(row => row.id === selectedScheduleId)
      : null

    const isChargebackLine = targetLine && (targetLine.usage < 0 || targetLine.commission < 0)
    const kind =
      isChargebackLine
        ? "Chargeback"
        : selectedSchedule?.flexClassification === "FlexChargeback"
          ? "ChargebackReversal"
          : "FlexProduct"

    const attachRevenueScheduleId =
      kind === "FlexProduct" || kind === "ChargebackReversal"
        ? selectedScheduleId
        : null

    try {
      matchingLineIdRef.current = lineId
      setMatchingLineId(lineId)

      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(metadata.id)}/line-items/${encodeURIComponent(lineId)}/create-flex`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, attachRevenueScheduleId: attachRevenueScheduleId ?? undefined }),
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create flex entry")
      }

      setSelectedLineItems([lineId])
      onLineSelectionChange?.(lineId)
      onMatchApplied?.()

      if (kind === "Chargeback") {
        showSuccess("Chargeback pending", "A Flex Chargeback entry was created and is awaiting approval.")
      } else if (kind === "ChargebackReversal") {
        showSuccess("CB-REV pending", "A chargeback reversal entry was created and is awaiting approval.")
      } else {
        showSuccess(
          "Flex product created",
          attachRevenueScheduleId
            ? "A Flex Product entry was created, attached to the selected deal/schedule, and allocated to this line item."
            : "A Flex Product entry was created and allocated to this line item.",
        )
      }
    } catch (err) {
      console.error("Failed to create flex entry", err)
      showError("Unable to create flex entry", err instanceof Error ? err.message : "Unknown error")
    } finally {
      matchingLineIdRef.current = null
      setMatchingLineId(null)
    }
  }, [lineItemRows, metadata.id, onLineSelectionChange, onMatchApplied, scheduleRows, showError, showSuccess])

  const unmatchLineById = useCallback(
    async (lineId?: string | null) => {
      const targetLineId =
        lineId ??
        selectedLineIdRef.current ??
        selectedLineItemsRef.current[0]
      if (!targetLineId) {
        showError("No line selected", "Select a deposit line item to update.")
        return false
      }
      try {
        undoingLineIdRef.current = targetLineId
        setUndoingLineId(targetLineId)
        const response = await fetch(
          `/api/reconciliation/deposits/${encodeURIComponent(metadata.id)}/line-items/${encodeURIComponent(targetLineId)}/unmatch`,
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
        showSuccess("Allocation removed", "The selected line item is now unallocated.")
        return true
      } catch (err) {
        console.error("Failed to unmatch line", err)
        showError("Unable to remove allocation", err instanceof Error ? err.message : "Unknown error")
        return false
      } finally {
        undoingLineIdRef.current = null
        setUndoingLineId(null)
      }
    },
    [metadata.id, onUnmatchApplied, showError, showSuccess]
  )

  const handleMatchSelected = useCallback(() => {
    const lineId = selectedLineIdRef.current ?? selectedLineItemsRef.current[0]
    if (!lineId) {
      showError("No line selected", "Select a deposit line item to match.")
      return
    }
    if (isUnmatchSelection) {
      void unmatchLineById(lineId)
      return
    }
    openMatchWizardFromSelection()
  }, [isUnmatchSelection, openMatchWizardFromSelection, showError, unmatchLineById])

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
        case "otherSource":
          return row.otherSource ?? ""
        case "lineItem":
          return String(row.lineItem)
        case "status":
          return row.reconciled ? "Reconciled" : row.status
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
        case "partNumber":
          return row.partNumber
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

  const getLineSortValue = useCallback((row: DepositLineItemRow, columnId: string) => {
    switch (columnId) {
      case "lineItem":
        return Number(row.lineItem ?? 0)
      case "status":
        return row.reconciled ? "Reconciled" : row.status
      case "paymentDate":
        return Date.parse(row.paymentDate ?? "") || 0
      case "usage":
        return Number(row.usage ?? 0)
      case "usageAllocated":
        return Number(row.usageAllocated ?? 0)
      case "usageUnallocated":
        return Number(row.usageUnallocated ?? 0)
      case "commission":
        return Number(row.commission ?? 0)
      case "commissionAllocated":
        return Number(row.commissionAllocated ?? 0)
      case "commissionUnallocated":
        return Number(row.commissionUnallocated ?? 0)
      default:
        return (row as any)[columnId] ?? ""
    }
  }, [])

  const getScheduleSortValue = useCallback((row: SuggestedMatchScheduleRow, columnId: string) => {
    switch (columnId) {
      case "lineItem":
        return Number(row.lineItem ?? 0)
      case "matchConfidence":
        return Number(row.matchConfidence ?? 0)
      case "revenueScheduleDate":
        return Date.parse(row.revenueScheduleDate ?? "") || 0
      case "quantity":
        return Number(row.quantity ?? 0)
      case "priceEach":
        return Number(row.priceEach ?? 0)
      case "expectedUsageGross":
        return Number(row.expectedUsageGross ?? 0)
      case "expectedUsageAdjustment":
        return Number(row.expectedUsageAdjustment ?? 0)
      case "expectedUsageNet":
        return Number(row.expectedUsageNet ?? 0)
      case "actualUsage":
        return Number(row.actualUsage ?? 0)
      case "usageBalance":
        return Number(row.usageBalance ?? 0)
      case "paymentDate":
        return Date.parse(row.paymentDate ?? "") || 0
      case "expectedCommissionGross":
        return Number(row.expectedCommissionGross ?? 0)
      case "expectedCommissionAdjustment":
        return Number(row.expectedCommissionAdjustment ?? 0)
      case "expectedCommissionNet":
        return Number(row.expectedCommissionNet ?? 0)
      case "actualCommission":
        return Number(row.actualCommission ?? 0)
      case "commissionDifference":
        return Number(row.commissionDifference ?? 0)
      case "expectedCommissionRatePercent":
        return Number(row.expectedCommissionRatePercent ?? 0)
      case "actualCommissionRatePercent":
        return Number(row.actualCommissionRatePercent ?? 0)
      case "commissionRateDifference":
        return Number(row.commissionRateDifference ?? 0)
      default:
        return (row as any)[columnId] ?? ""
    }
  }, [])

  const filteredLineItems = useMemo(() => {
    return lineItemRows.filter(item => {
      const isMatched =
        !item.reconciled &&
        (item.status === "Matched" || item.status === "Partially Matched")
      const isSuggested =
        !item.reconciled &&
        (item.status === "Suggested" || (!isMatched && item.hasSuggestedMatches))
      const isUnmatched = !item.reconciled && !isMatched

      const matchesTab =
        lineTab === "all"
          ? true
          : lineTab === "reconciled"
            ? item.reconciled === true
            : lineTab === "matched"
              ? isMatched
              : lineTab === "suggested"
                ? isSuggested
                : isUnmatched

      const matchesSearch = lineSearchValue
        ? [
            item.accountName,
            item.accountId,
            item.vendorName,
            item.productName,
            item.partNumber,
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

  const sortedLineItems = useMemo(() => {
    if (!lineSortConfig) return filteredLineItems
    const rows = [...filteredLineItems]
    const { key, direction } = lineSortConfig
    rows.sort((a, b) => {
      const av = getLineSortValue(a, key)
      const bv = getLineSortValue(b, key)
      if (typeof av === "number" && typeof bv === "number") {
        return direction === "asc" ? av - bv : bv - av
      }
      return direction === "asc"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""))
    })
    return rows
  }, [filteredLineItems, lineSortConfig, getLineSortValue])

  const filteredSchedules = useMemo(() => {
    return scheduleRows.filter(schedule => {
      const scheduleIsReconciled = schedule.status === "Reconciled"
      const scheduleIsMatched = schedule.status === "Matched"
      const scheduleIsSuggested = schedule.status === "Suggested"
      const scheduleIsUnmatched = !scheduleIsMatched && !scheduleIsReconciled

      const matchesTab =
        scheduleTab === "all"
          ? true
          : scheduleTab === "reconciled"
            ? scheduleIsReconciled
            : scheduleTab === "matched"
              ? scheduleIsMatched
              : scheduleTab === "suggested"
                ? scheduleIsSuggested
                : scheduleIsUnmatched

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

  const sortedSchedules = useMemo(() => {
    const rows = [...filteredSchedules]
    if (scheduleSortConfig) {
      const { key, direction } = scheduleSortConfig
      rows.sort((a, b) => {
        const av = getScheduleSortValue(a, key)
        const bv = getScheduleSortValue(b, key)
        if (typeof av === "number" && typeof bv === "number") {
          return direction === "asc" ? av - bv : bv - av
        }
        return direction === "asc"
          ? String(av ?? "").localeCompare(String(bv ?? ""))
          : String(bv ?? "").localeCompare(String(av ?? ""))
      })
      return rows
    }

    rows.sort((a, b) => {
      const productA = (a.productNameVendor ?? "").toLowerCase()
      const productB = (b.productNameVendor ?? "").toLowerCase()
      if (productA && productB && productA !== productB) {
        return productA.localeCompare(productB)
      }

      const dateA = Date.parse(a.revenueScheduleDate)
      const dateB = Date.parse(b.revenueScheduleDate)

      const hasDateA = !Number.isNaN(dateA)
      const hasDateB = !Number.isNaN(dateB)

      if (hasDateA && hasDateB) return dateA - dateB
      if (hasDateA) return -1
      if (hasDateB) return 1
      return 0
    })
    return rows
  }, [filteredSchedules, scheduleSortConfig, getScheduleSortValue])

  const baseLineColumns = useMemo<Column[]>(() => {
    const minTextWidth = (label: string, sortable = true) => calculateMinWidth({ label, type: "text", sortable })
    return [
      {
        id: "select",
        label: "Select All",
        width: 100,
        minWidth: 95,
        type: "checkbox",
        sortable: false
      },
      {
        id: "accountId",
        label: depositFieldLabels.accountId,
        width: 220,
        minWidth: minTextWidth(depositFieldLabels.accountId),
        sortable: true
      },
      {
        id: "otherSource",
        label: depositFieldLabels.otherSource,
        width: 160,
        minWidth: minTextWidth(depositFieldLabels.otherSource),
        sortable: true,
        hidden: true
      },
      {
        id: "lineItem",
        label: depositFieldLabels.lineItem,
        width: 100,
        minWidth: 70,
        sortable: true
      },
      {
        id: "status",
        label: depositFieldLabels.status,
        width: 180,
        minWidth: minTextWidth(depositFieldLabels.status),
        sortable: true,
        render: (_value: DepositLineItemRow["status"], row: DepositLineItemRow) => {
          const displayStatus = row.reconciled ? "Reconciled" : row.status
          const toneClass = lineStatusStyles[displayStatus as keyof typeof lineStatusStyles] ?? "bg-slate-100 text-slate-700 border border-slate-200"
          const dotClass =
            displayStatus === "Matched" || displayStatus === "Reconciled"
              ? "bg-emerald-500"
              : displayStatus === "Partially Matched"
                ? "bg-amber-500"
                : displayStatus === "Unmatched"
                  ? "bg-red-500"
                  : displayStatus === "Suggested"
                    ? "bg-indigo-500"
                    : "bg-slate-400"

          const isBusy =
            matchingLineIdRef.current === row.id || undoingLineIdRef.current === row.id

          return (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
                toneClass,
                isBusy ? "opacity-70" : ""
              )}
              data-disable-row-click="true"
            >
              <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", dotClass)} />
              {isBusy ? "Updating..." : getAllocationStatusLabel(displayStatus)}
            </span>
          )
        }
      },
      {
        id: "paymentDate",
        label: depositFieldLabels.paymentDate,
        width: 180,
        minWidth: minTextWidth(depositFieldLabels.paymentDate),
        sortable: true,
        render: (value: string) => {
          const parsed = new Date(value)
          return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed)
        }
      },
      {
        id: "accountName",
        label: depositFieldLabels.accountName,
        width: 220,
        minWidth: minTextWidth(depositFieldLabels.accountName),
        sortable: true,
        render: (value: string, row: DepositLineItemRow) => {
          const trimmedName = value?.trim()
          const href = row.accountId
            ? `/accounts/${encodeURIComponent(row.accountId)}`
            : trimmedName
              ? `/accounts?search=${encodeURIComponent(trimmedName)}`
              : "/accounts"
          const displayValue = trimmedName || row.accountId || "View account"
          return (
            <Link
              href={href}
              className="inline-flex max-w-full items-center text-sm font-semibold text-primary-600 transition hover:text-primary-700"
              title={displayValue}
              onClick={event => event.stopPropagation()}
              data-disable-row-click="true"
            >
              <span className="truncate">{displayValue}</span>
            </Link>
          )
        }
      },
      {
        id: "vendorName",
        label: depositFieldLabels.vendorName,
        width: 200,
        minWidth: minTextWidth(depositFieldLabels.vendorName),
        sortable: true
      },
      {
        id: "productName",
        label: depositFieldLabels.productName,
        width: 240,
        minWidth: minTextWidth(depositFieldLabels.productName),
        sortable: true,
        render: (value: string, row: DepositLineItemRow) => {
          const trimmedName = value?.trim()
          const href = row.productId
            ? `/products/${encodeURIComponent(row.productId)}`
            : trimmedName
              ? `/products?search=${encodeURIComponent(trimmedName)}`
              : "/products"
          const displayValue = trimmedName || "View product"
          return (
            <Link
              href={href}
              className="inline-flex max-w-full items-center text-sm font-semibold text-primary-600 transition hover:text-primary-700"
              title={displayValue}
              onClick={event => event.stopPropagation()}
              data-disable-row-click="true"
            >
              <span className="truncate">{displayValue}</span>
            </Link>
          )
        }
      },
      {
        id: "partNumber",
        label: depositFieldLabels.partNumber,
        width: 200,
        minWidth: minTextWidth(depositFieldLabels.partNumber),
        sortable: true,
      },
      {
        id: "usage",
        label: depositFieldLabels.usage,
        width: 140,
        minWidth: minTextWidth(depositFieldLabels.usage),
        sortable: true,
        hideable: false,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "usageAllocated",
        label: depositFieldLabels.usageAllocated,
        width: 180,
        minWidth: minTextWidth(depositFieldLabels.usageAllocated),
        sortable: true,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "usageUnallocated",
        label: depositFieldLabels.usageUnallocated,
        width: 200,
        minWidth: minTextWidth(depositFieldLabels.usageUnallocated),
        sortable: true,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "commissionRate",
        label: depositFieldLabels.commissionRate,
        width: 200,
        minWidth: minTextWidth(depositFieldLabels.commissionRate),
        sortable: true,
        render: (value: number) => percentFormatter.format(value)
      },
      {
        id: "commission",
        label: depositFieldLabels.commission,
        width: 160,
        minWidth: minTextWidth(depositFieldLabels.commission),
        sortable: true,
        hideable: false,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "commissionAllocated",
        label: depositFieldLabels.commissionAllocated,
        width: 200,
        minWidth: minTextWidth(depositFieldLabels.commissionAllocated),
        sortable: true,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "commissionUnallocated",
        label: depositFieldLabels.commissionUnallocated,
        width: 210,
        minWidth: minTextWidth(depositFieldLabels.commissionUnallocated),
        sortable: true,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "customerIdVendor",
        label: depositFieldLabels.customerIdVendor,
        width: 200,
        minWidth: minTextWidth(depositFieldLabels.customerIdVendor),
        sortable: true
      },
      {
        id: "orderIdVendor",
        label: depositFieldLabels.orderIdVendor,
        width: 200,
        minWidth: minTextWidth(depositFieldLabels.orderIdVendor),
        sortable: true
      },
      {
        id: "distributorName",
        label: depositFieldLabels.distributorName,
        width: 220,
        minWidth: minTextWidth(depositFieldLabels.distributorName),
        sortable: true
      }
    ]
  }, [currencyFormatter, percentFormatter, dateFormatter])

  const baseScheduleColumns = useMemo<Column[]>(() => {
    const minTextWidth = (label: string, sortable = true) => calculateMinWidth({ label, type: "text", sortable })
    return [
      {
        id: "select",
        label: "Select All",
        width: 100,
        minWidth: 95,
        type: "checkbox",
        sortable: false
      },
      {
        id: "lineItem",
        label: scheduleFieldLabels.lineItem,
        width: 100,
        minWidth: 70,
        sortable: true
      },
      {
        id: "matchConfidence",
        label: scheduleFieldLabels.matchConfidence,
        width: 180,
        minWidth: minTextWidth(scheduleFieldLabels.matchConfidence),
        sortable: true,
        render: (value: number) => percentFormatter.format(value)
      },
      {
        id: "origin",
        label: "Origin",
        width: 180,
        minWidth: 150,
        render: (_value: unknown, row: SuggestedMatchScheduleRow) => (
          <div className="flex flex-wrap items-center gap-1">
            {row.status === "Suggested" && row.matchConfidence >= confidencePrefs.autoMatchMinConfidence ? (
              <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700 ring-1 ring-primary-200">
                Auto-eligible
              </span>
            ) : null}
            {row.matchType ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  row.matchType === "exact"
                    ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                    : row.matchType === "fuzzy"
                      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                      : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
                )}
              >
                {row.matchType === "exact" ? "Exact" : row.matchType === "fuzzy" ? "Fuzzy" : "Legacy"}
              </span>
            ) : null}
            {row.matchSource ? (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                {row.matchSource}
              </span>
            ) : null}
            {row.confidenceLevel ? (
              <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                {row.confidenceLevel}
              </span>
            ) : null}
          </div>
        )
      },
      {
        id: "why",
        label: "Why suggested",
        width: 160,
        minWidth: 140,
        render: (_value: unknown, row: SuggestedMatchScheduleRow) => {
          const reasons = row.reasons?.slice(0, 3) ?? []
          const title = reasons.length > 0 ? reasons.join("; ") : "No reasons recorded"
          return (
            <div
              className="inline-flex cursor-help items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200"
              title={title}
            >
              <span>Why?</span>
              <span className="text-slate-400">ⓘ</span>
            </div>
          )
        }
      },
      {
        id: "vendorName",
        label: scheduleFieldLabels.vendorName,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.vendorName),
        sortable: true
      },
      {
        id: "legalName",
        label: scheduleFieldLabels.legalName,
        width: 220,
        minWidth: minTextWidth(scheduleFieldLabels.legalName),
        sortable: true,
        render: (value: string, row: SuggestedMatchScheduleRow) => {
          const trimmedName = value?.trim()
          const href = row.accountId
            ? `/accounts/${encodeURIComponent(row.accountId)}`
            : trimmedName
              ? `/accounts?search=${encodeURIComponent(trimmedName)}`
              : "/accounts"
          const displayValue = trimmedName || "View account"
          return (
            <Link
              href={href}
              className="inline-flex max-w-full items-center text-sm font-semibold text-primary-600 transition hover:text-primary-700"
              title={displayValue}
              onClick={event => event.stopPropagation()}
              data-disable-row-click="true"
            >
              <span className="truncate">{displayValue}</span>
            </Link>
          )
        }
      },
      {
        id: "productNameVendor",
        label: scheduleFieldLabels.productNameVendor,
        width: 240,
        minWidth: minTextWidth(scheduleFieldLabels.productNameVendor),
        sortable: true
      },
      {
        id: "revenueScheduleDate",
        label: scheduleFieldLabels.revenueScheduleDate,
        width: 180,
        minWidth: minTextWidth(scheduleFieldLabels.revenueScheduleDate),
        sortable: true,
        render: (value: string) => {
          const parsed = new Date(value)
          return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed)
        }
      },
      {
        id: "revenueScheduleName",
        label: scheduleFieldLabels.revenueScheduleName,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.revenueScheduleName),
        sortable: true,
        render: (value: string, row: SuggestedMatchScheduleRow) => {
          const displayValue = value?.trim() || row.revenueScheduleName || row.id || "View schedule"
          const href = row.id
            ? `/revenue-schedules/${encodeURIComponent(row.id)}`
            : `/revenue-schedules`
          return (
            <Link
              href={href}
              className="inline-flex max-w-full items-center text-sm font-semibold text-primary-600 transition hover:text-primary-700"
              title={displayValue}
              onClick={event => event.stopPropagation()}
              data-disable-row-click="true"
            >
              <span className="truncate">{displayValue}</span>
            </Link>
          )
        }
      },
      {
        id: "quantity",
        label: scheduleFieldLabels.quantity,
        width: 120,
        minWidth: minTextWidth(scheduleFieldLabels.quantity),
        sortable: true
      },
      {
        id: "priceEach",
        label: scheduleFieldLabels.priceEach,
        width: 140,
        minWidth: minTextWidth(scheduleFieldLabels.priceEach),
        sortable: true,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "expectedUsageGross",
        label: scheduleFieldLabels.expectedUsageGross,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.expectedUsageGross),
        sortable: true,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "expectedUsageAdjustment",
        label: scheduleFieldLabels.expectedUsageAdjustment,
        width: 220,
        minWidth: minTextWidth(scheduleFieldLabels.expectedUsageAdjustment),
        sortable: true,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "expectedUsageNet",
        label: scheduleFieldLabels.expectedUsageNet,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.expectedUsageNet),
        sortable: true,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "actualUsage",
        label: scheduleFieldLabels.actualUsage,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.actualUsage),
        sortable: true,
        hideable: false,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "usageBalance",
        label: scheduleFieldLabels.usageBalance,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.usageBalance),
        sortable: true,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "paymentDate",
        label: scheduleFieldLabels.paymentDate,
        width: 180,
        minWidth: minTextWidth(scheduleFieldLabels.paymentDate),
        sortable: true,
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
        sortable: true,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "expectedCommissionAdjustment",
        label: scheduleFieldLabels.expectedCommissionAdjustment,
        width: 240,
        minWidth: minTextWidth(scheduleFieldLabels.expectedCommissionAdjustment),
        sortable: true,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "expectedCommissionNet",
        label: scheduleFieldLabels.expectedCommissionNet,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.expectedCommissionNet),
        sortable: true,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "actualCommission",
        label: scheduleFieldLabels.actualCommission,
        width: 200,
        minWidth: minTextWidth(scheduleFieldLabels.actualCommission),
        sortable: true,
        hideable: false,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "commissionDifference",
        label: scheduleFieldLabels.commissionDifference,
        width: 220,
        minWidth: minTextWidth(scheduleFieldLabels.commissionDifference),
        sortable: true,
        render: (value: number) => currencyFormatter.format(value)
      },
      {
        id: "expectedCommissionRatePercent",
        label: scheduleFieldLabels.expectedCommissionRatePercent,
        width: 240,
        minWidth: minTextWidth(scheduleFieldLabels.expectedCommissionRatePercent),
        sortable: true,
        render: (value: number) => percentFormatter.format(value)
      },
      {
        id: "actualCommissionRatePercent",
        label: scheduleFieldLabels.actualCommissionRatePercent,
        width: 240,
        minWidth: minTextWidth(scheduleFieldLabels.actualCommissionRatePercent),
        sortable: true,
        render: (value: number) => percentFormatter.format(value)
      },
      {
        id: "commissionRateDifference",
        label: scheduleFieldLabels.commissionRateDifference,
        width: 240,
        minWidth: minTextWidth(scheduleFieldLabels.commissionRateDifference),
        sortable: true,
        render: (value: number) => percentFormatter.format(value)
      },
      {
        id: "status",
        label: "Status",
        width: 160,
        minWidth: minTextWidth("Status"),
        sortable: true,
        render: (value: SuggestedMatchScheduleRow["status"]) => (
          <span className={cn("inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold", scheduleStatusStyles[value])}>
            {getAllocationStatusLabel(value)}
          </span>
        )
      }
    ]
  }, [currencyFormatter, percentFormatter, dateFormatter, confidencePrefs.autoMatchMinConfidence])

  // Line items table with persistence
  const {
    columns: lineTableColumns,
    loading: linePreferenceLoading,
    handleColumnsChange: handleLineColumnsChange,
    saveChangesOnModalClose: saveLineChangesOnModalClose
  } = useTablePreferences('reconciliation:deposit-line-items', baseLineColumns)

  // Revenue schedules table with persistence
  const {
    columns: scheduleTableColumns,
    loading: schedulePreferenceLoading,
    handleColumnsChange: handleScheduleColumnsChange,
    saveChangesOnModalClose: saveScheduleChangesOnModalClose
  } = useTablePreferences('reconciliation:revenue-schedules', baseScheduleColumns)

  const handleLineColumnModalApply = useCallback((columns: Column[]) => {
    handleLineColumnsChange(columns)
    saveLineChangesOnModalClose()
    setShowLineColumnSettings(false)
  }, [handleLineColumnsChange, saveLineChangesOnModalClose])

  const handleScheduleColumnModalApply = useCallback((columns: Column[]) => {
    handleScheduleColumnsChange(columns)
    saveScheduleChangesOnModalClose()
    setShowScheduleColumnSettings(false)
  }, [handleScheduleColumnsChange, saveScheduleChangesOnModalClose])

  const handleLineColumnModalClose = useCallback(() => {
    setShowLineColumnSettings(false)
  }, [])

  const handleScheduleColumnModalClose = useCallback(() => {
    setShowScheduleColumnSettings(false)
  }, [])

  const handleLineItemSelect = useCallback(
    (lineId: string, selected: boolean) => {
      const previousSelected = selectedLineItemsRef.current

      if (selected) {
        const nextSelected = previousSelected.includes(lineId)
          ? previousSelected
          : [lineId, ...previousSelected]
        setSelectedLineItems(nextSelected)
        onLineSelectionChange?.(lineId)
        return
      }

      const nextSelected = previousSelected.filter(id => id !== lineId)
      setSelectedLineItems(nextSelected)

      const currentActive = selectedLineIdRef.current ?? null
      if (nextSelected.length === 0) {
        onLineSelectionChange?.(null)
        return
      }

      if (!currentActive || currentActive === lineId || !nextSelected.includes(currentActive)) {
        onLineSelectionChange?.(nextSelected[0] ?? null)
      }
    },
    [onLineSelectionChange]
  )

  const handleLineItemSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        const visibleIds = sortedLineItems.map(item => item.id)
        if (visibleIds.length === 0) {
          setSelectedLineItems([])
          onLineSelectionChange?.(null)
          return
        }

        setSelectedLineItems(visibleIds)
        const currentActive = selectedLineIdRef.current ?? null
        const nextActive =
          currentActive && visibleIds.includes(currentActive) ? currentActive : visibleIds[0] ?? null
        onLineSelectionChange?.(nextActive)
        return
      }
      setSelectedLineItems([])
      onLineSelectionChange?.(null)
    },
    [sortedLineItems, onLineSelectionChange]
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
        setSelectedSchedules(sortedSchedules.map(schedule => schedule.id))
        return
      }
      setSelectedSchedules([])
    },
    [sortedSchedules]
  )

  const handleBulkLineMatch = useCallback(async () => {
    const lineId = selectedLineIdRef.current ?? selectedLineItemsRef.current[0]
    if (!lineId) {
      showError("No line selected", "Select a deposit line item to match.")
      return
    }
    const scheduleId = selectedSchedulesRef.current[0]
    if (!scheduleId) {
      showError("No schedule selected", "Select a schedule to match to.")
      return
    }
    try {
      const usageAmount = parseAllocationInput(allocationDraftRef.current.usage)
      const commissionAmount = parseAllocationInput(allocationDraftRef.current.commission)
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(metadata.id)}/line-items/${encodeURIComponent(lineId)}/apply-match`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revenueScheduleId: scheduleId,
            usageAmount: usageAmount ?? undefined,
            commissionAmount: commissionAmount ?? undefined,
          }),
        }
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to apply match")
      }

      const flexDecision = payload?.data?.flexDecision as FlexDecisionPayload | undefined
      const flexExecution = payload?.data?.flexExecution as any
      setSelectedSchedules([])
      onMatchApplied?.()

      if (flexExecution?.action === "AutoChargeback") {
        showSuccess("Chargeback created", "A Flex Chargeback entry was created and matched automatically.")
        return
      }

      if (flexDecision?.action === "auto_adjust") {
        showSuccess("Auto-adjustment created", "A one-time adjustment was created and matched automatically.")
        return
      }

      if (flexDecision?.action === "prompt") {
        setFlexPrompt({ lineId, scheduleId, decision: flexDecision })
        showSuccess("Allocation saved", "Overage exceeds tolerance. Choose how to resolve the variance.")
        return
      }

      showSuccess("Allocation saved", "The selected line item was allocated to the schedule.")
    } catch (err) {
      console.error("Failed to apply match", err)
      showError("Unable to match", err instanceof Error ? err.message : "Unknown error")
    }
  }, [metadata.id, onMatchApplied, parseAllocationInput, showError, showSuccess])

  const handleBulkLineUnmatch = useCallback(async () => {
    await unmatchLineById()
  }, [unmatchLineById])

  const handleResolveFlex = useCallback(
    async (action: "Adjust" | "FlexProduct" | "Manual") => {
      if (!flexPrompt) return

      if (action === "Manual") {
        setManualFlexError(null)
        setManualFlexEntryOpen(true)
        return
      }

      try {
        setFlexResolving(true)
        const response = await fetch(
          `/api/reconciliation/deposits/${encodeURIComponent(metadata.id)}/line-items/${encodeURIComponent(flexPrompt.lineId)}/resolve-flex`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ revenueScheduleId: flexPrompt.scheduleId, action }),
          },
        )
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to resolve flex variance")
        }

        setFlexPrompt(null)
        onMatchApplied?.()

        if (action === "Adjust") {
          showSuccess("Adjustment created", "A one-time adjustment entry was created and allocated.")
        } else {
          showSuccess("Flex product created", "A Flex Product entry was created and allocated.")
        }
      } catch (err) {
        console.error("Failed to resolve flex variance", err)
        showError("Unable to resolve variance", err instanceof Error ? err.message : "Unknown error")
      } finally {
        setFlexResolving(false)
      }
    },
    [flexPrompt, metadata.id, onMatchApplied, showError, showSuccess],
  )

  const handleApplyManualFlex = useCallback(async () => {
    if (!flexPrompt) return

    const parsed = parseAllocationInput(manualFlexUsageAmount)
    if (parsed === null || parsed <= 0.005) {
      setManualFlexError("Enter a positive adjustment amount.")
      return
    }
    if (parsed > flexPrompt.decision.usageOverage + 0.005) {
      setManualFlexError("Manual amount cannot exceed the current overage.")
      return
    }

    try {
      setManualFlexError(null)
      setFlexResolving(true)
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(metadata.id)}/line-items/${encodeURIComponent(flexPrompt.lineId)}/resolve-flex`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revenueScheduleId: flexPrompt.scheduleId,
            action: "Manual",
            manualUsageAmount: parsed,
          }),
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to apply manual adjustment")
      }

      setFlexPrompt(null)
      setManualFlexEntryOpen(false)
      onMatchApplied?.()
      showSuccess("Manual adjustment created", "A one-time manual adjustment entry was created and allocated.")
    } catch (err) {
      console.error("Failed to apply manual adjustment", err)
      const message = err instanceof Error ? err.message : "Unknown error"
      setManualFlexError(message)
      showError("Unable to apply manual adjustment", message)
    } finally {
      setFlexResolving(false)
    }
  }, [flexPrompt, manualFlexUsageAmount, metadata.id, onMatchApplied, parseAllocationInput, showError, showSuccess])

  const handleOpenAiAdjustment = useCallback(async () => {
    if (!flexPrompt) return
    const lineId = flexPrompt.lineId
    const scheduleId = flexPrompt.scheduleId

    setAiAdjustmentModal({
      lineId,
      scheduleId,
      applyToFuture: false,
      loading: true,
      applying: false,
      error: null,
      preview: null,
    })

    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(metadata.id)}/line-items/${encodeURIComponent(lineId)}/ai-adjustment/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revenueScheduleId: scheduleId }),
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load AI adjustment preview")
      }
      const preview = payload?.data as AiAdjustmentPreviewPayload | undefined
      setAiAdjustmentModal(previous =>
        previous
          ? {
              ...previous,
              loading: false,
              preview: preview ?? null,
              error: null,
            }
          : null,
      )
    } catch (err) {
      console.error("Failed to load AI adjustment preview", err)
      setAiAdjustmentModal(previous =>
        previous
          ? {
              ...previous,
              loading: false,
              error: err instanceof Error ? err.message : "Failed to load AI adjustment preview",
            }
          : null,
      )
    }
  }, [flexPrompt, metadata.id])

  const handleApplyAiAdjustment = useCallback(async () => {
    if (!aiAdjustmentModal) return
    const { lineId, scheduleId, applyToFuture } = aiAdjustmentModal
    try {
      setAiAdjustmentModal(previous => (previous ? { ...previous, applying: true } : null))
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(metadata.id)}/line-items/${encodeURIComponent(lineId)}/ai-adjustment/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revenueScheduleId: scheduleId, applyToFuture }),
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to apply AI adjustment")
      }

      const updatedCount = Number(payload?.data?.futureUpdate?.updatedScheduleIds?.length ?? 0)
      setAiAdjustmentModal(null)
      setFlexPrompt(null)
      onMatchApplied?.()
      showSuccess(
        "AI adjustment applied",
        applyToFuture && updatedCount > 0
          ? `Applied adjustment and updated ${updatedCount} future schedules.`
          : "Applied adjustment for this period.",
      )
    } catch (err) {
      console.error("Failed to apply AI adjustment", err)
      setAiAdjustmentModal(previous =>
        previous
          ? {
              ...previous,
              applying: false,
              error: err instanceof Error ? err.message : "Failed to apply AI adjustment",
            }
          : null,
      )
      showError("Unable to apply AI adjustment", err instanceof Error ? err.message : "Unknown error")
    } finally {
      setAiAdjustmentModal(previous => (previous ? { ...previous, applying: false } : null))
    }
  }, [aiAdjustmentModal, metadata.id, onMatchApplied, showError, showSuccess])

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
        case "otherSource":
          return row.otherSource ?? ""
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
        case "partNumber":
          return row.partNumber
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

  const handleDeleteDeposit = useCallback(() => {
    if (!canManageReconciliation) {
      showError("Delete failed", "Insufficient permissions.")
      return
    }
    setShowDeleteDepositDialog(true)
  }, [canManageReconciliation, showError])

  const deleteDeposit = useCallback(async () => {
    if (!canManageReconciliation) {
      return { success: false, error: "Insufficient permissions." }
    }
    if (!metadata?.id) {
      return { success: false, error: "Deposit id is missing." }
    }

    try {
      const response = await fetch(`/api/reconciliation/deposits/${encodeURIComponent(metadata.id)}`, {
        method: "DELETE",
        cache: "no-store",
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to delete deposit")
      }

      showSuccess("Deposit deleted", "The deposit and its allocations were removed.")
      if (onDepositDeleted) {
        onDepositDeleted()
      } else if (onBackToReconciliation) {
        onBackToReconciliation()
      }

      return { success: true }
    } catch (err) {
      console.error("Delete deposit failed", err)
      return { success: false, error: err instanceof Error ? err.message : "Unable to delete deposit" }
    }
  }, [canManageReconciliation, metadata?.id, onBackToReconciliation, onDepositDeleted, showSuccess])

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
          disabled: selectedLineItems.length !== 1,
          tooltip: count =>
            count === 1
              ? "Match the selected line item to the selected schedule"
              : "Select exactly one line item to match",
          onClick: handleBulkLineMatch
        },
        {
          key: "unmatch",
          label: "Remove Match",
          icon: Trash2,
          tone: "danger",
          disabled: selectedLineItems.length !== 1,
          tooltip: count =>
            count === 1
              ? "Remove the match from the selected line item"
              : "Select exactly one line item to remove a match",
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

  const formattedDate = useMemo(() => {
    const parsed = new Date(metadata.depositDate)
    return Number.isNaN(parsed.getTime()) ? metadata.depositDate : dateFormatter.format(parsed)
  }, [metadata.depositDate, dateFormatter])

  const commissionTotals = useMemo(() => {
    return lineItemRows.reduce(
      (acc, item) => {
        acc.total += Number(item.commission ?? 0)
        acc.allocated += Number(item.commissionAllocated ?? 0)
        acc.unallocated += Number(item.commissionUnallocated ?? 0)
        return acc
      },
      { total: 0, allocated: 0, unallocated: 0 },
    )
  }, [lineItemRows])

  const reconciledAtTitle = useMemo(() => {
    if (!metadata.reconciledAt) return null
    const parsed = new Date(metadata.reconciledAt)
    if (Number.isNaN(parsed.getTime())) return `Finalized: ${metadata.reconciledAt}`
    return `Finalized: ${dateFormatter.format(parsed)}`
  }, [dateFormatter, metadata.reconciledAt])

  const allocationPercentages = useMemo(() => {
    const safeUsageTotal = Number(metadata.usageTotal || 0)
    const safeCommissionTotal = Number(commissionTotals.total || 0)
    return {
      usageAllocatedPct: safeUsageTotal > 0 ? metadata.allocated / safeUsageTotal : 0,
      usageUnallocatedPct: safeUsageTotal > 0 ? metadata.unallocated / safeUsageTotal : 0,
      commissionAllocatedPct: safeCommissionTotal > 0 ? commissionTotals.allocated / safeCommissionTotal : 0,
      commissionUnallocatedPct: safeCommissionTotal > 0 ? commissionTotals.unallocated / safeCommissionTotal : 0,
    }
  }, [commissionTotals.allocated, commissionTotals.total, commissionTotals.unallocated, metadata.allocated, metadata.unallocated, metadata.usageTotal])

  const headerStatus = useMemo(() => {
    if (metadata.reconciled) {
      return {
        label: "Finalized",
        className: "bg-emerald-100 text-emerald-800 ring-emerald-200",
        title: reconciledAtTitle ?? "Finalized",
      }
    }

    const usageTotal = Number(metadata.usageTotal || 0)
    if (!Number.isFinite(usageTotal) || usageTotal <= 0) {
      return {
        label: "Open",
        className: "bg-slate-100 text-slate-800 ring-slate-200",
        title: "Open",
      }
    }

    const allocatedPercentLabel = formatPercent(allocationPercentages.usageAllocatedPct)

    if (metadata.allocated <= 0) {
      return {
        label: `Open · Unmatched (${allocatedPercentLabel})`,
        className: "bg-rose-100 text-rose-800 ring-rose-200",
        title: `Open. ${allocatedPercentLabel} of usage allocated.`,
      }
    }

    if (metadata.unallocated <= 0) {
      return {
        label: `Open · Fully Matched (${allocatedPercentLabel})`,
        className: "bg-sky-100 text-sky-800 ring-sky-200",
        title: `Open. ${allocatedPercentLabel} of usage allocated (ready to finalize).`,
      }
    }

    return {
      label: `Open · Partially Matched (${allocatedPercentLabel})`,
      className: "bg-amber-100 text-amber-900 ring-amber-200",
      title: `Open. ${allocatedPercentLabel} of usage allocated.`,
    }
  }, [
    allocationPercentages.usageAllocatedPct,
    metadata.allocated,
    metadata.reconciled,
    metadata.unallocated,
    metadata.usageTotal,
    reconciledAtTitle,
  ])

  return (
    <div className="flex min-h-[calc(100vh-110px)] flex-col gap-0 px-3 pb-3 pt-0 sm:px-4">
      <ReconciliationMatchWizardModal
        open={Boolean(matchWizard)}
        onClose={() => setMatchWizard(null)}
        depositId={metadata.id}
        selectedLines={matchWizard?.selectedLines ?? []}
        selectedSchedules={matchWizard?.selectedSchedules ?? []}
        detectedType={matchWizard?.detectedType ?? "OneToOne"}
        onApplied={onMatchApplied}
      />
      {showVendorSummaryModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm px-4"
          onClick={() => setShowVendorSummaryModal(false)}
        >
          <div
            className="w-full max-w-5xl h-[900px] flex flex-col rounded-xl bg-white shadow-xl"
            onClick={event => event.stopPropagation()}
          >
            <ModalHeader
              kicker="Deposit"
              title="Vendor Summary"
              right={
                <button
                  type="button"
                  onClick={() => setShowVendorSummaryModal(false)}
                  className="inline-flex items-center justify-center rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close vendor summary"
                >
                  <X className="h-4 w-4" />
                </button>
              }
            />
            <div className="flex-1 overflow-auto p-6">
              <DepositVendorSummaryWidget lineItems={filteredLineItems} defaultVisibleRows={25} />
            </div>
          </div>
        </div>
      ) : null}
      {aiAdjustmentModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4"
          onClick={() => (aiAdjustmentModal.applying ? null : setAiAdjustmentModal(null))}
        >
          <div
            className="w-full max-w-xl rounded-xl bg-white shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <ModalHeader kicker="AI Adjustment" title="Preview adjustment" />
            <div className="space-y-3 p-6 text-sm text-slate-700">
              {aiAdjustmentModal.loading ? (
                <p className="text-sm text-slate-600">Loading preview...</p>
              ) : aiAdjustmentModal.error ? (
                <p className="text-sm text-red-600">{aiAdjustmentModal.error}</p>
              ) : aiAdjustmentModal.preview ? (
                <>
                  <p>{aiAdjustmentModal.preview.suggestion.reason}</p>
                  {aiAdjustmentModal.preview.suggestion.type === "allocate" ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-semibold">Suggested next step</p>
                      <p className="mt-1">
                        Allocate this payment across the open schedules below instead of adjusting expected.
                      </p>
                      {aiAdjustmentModal.preview.suggestion.priorOpenScheduleIds.length ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-amber-800">
                            View open schedules ({aiAdjustmentModal.preview.suggestion.priorOpenScheduleIds.length})
                          </summary>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">
                            {aiAdjustmentModal.preview.suggestion.priorOpenScheduleIds.map(id => (
                              <li key={id} className="break-all">
                                {id}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p>
                        This will adjust expected net from{" "}
                        <span className="font-semibold">
                          ${aiAdjustmentModal.preview.base.expectedUsageNet.toFixed(2)}
                        </span>{" "}
                        to{" "}
                        <span className="font-semibold">
                          ${(aiAdjustmentModal.preview.base.expectedUsageNet + aiAdjustmentModal.preview.base.usageOverage).toFixed(2)}
                        </span>{" "}
                        for this period.
                      </p>
                      <p>
                        Commission expected net from{" "}
                        <span className="font-semibold">
                          ${aiAdjustmentModal.preview.base.expectedCommissionNet.toFixed(2)}
                        </span>{" "}
                        to{" "}
                        <span className="font-semibold">
                          ${(aiAdjustmentModal.preview.base.expectedCommissionNet + aiAdjustmentModal.preview.base.commissionOverage).toFixed(2)}
                        </span>
                        .
                      </p>
                      <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-400 text-primary-600 accent-primary-600"
                          checked={aiAdjustmentModal.applyToFuture}
                          onChange={event =>
                            setAiAdjustmentModal(previous =>
                              previous ? { ...previous, applyToFuture: event.target.checked } : null,
                            )
                          }
                          disabled={aiAdjustmentModal.applying}
                        />
                        <span>
                          Apply to future schedules ({aiAdjustmentModal.preview.future.count})
                        </span>
                      </label>
                      {aiAdjustmentModal.applyToFuture && aiAdjustmentModal.preview.future.count > 0 ? (
                        <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-700">
                            View impacted schedules
                          </summary>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
                            {aiAdjustmentModal.preview.future.schedules.map(schedule => (
                              <li key={schedule.id} className="break-all">
                                {schedule.scheduleNumber ?? schedule.id}{" "}
                                {schedule.scheduleDate ? `(${schedule.scheduleDate.slice(0, 10)})` : ""}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </div>
                  )}
                </>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setAiAdjustmentModal(null)}
                  disabled={aiAdjustmentModal.applying}
                >
                  Back
                </button>
                {aiAdjustmentModal.preview?.suggestion.type === "adjust" ? (
                  <button
                    type="button"
                    className="rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                    onClick={() => void handleApplyAiAdjustment()}
                    disabled={aiAdjustmentModal.applying || aiAdjustmentModal.loading}
                  >
                    {aiAdjustmentModal.applying ? "Working..." : "Apply Adjustment"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {flexPrompt && !aiAdjustmentModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4"
          onClick={() => (flexResolving ? null : setFlexPrompt(null))}
        >
          <div
            className="w-full max-w-xl rounded-xl bg-white shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <ModalHeader kicker="Flex Resolution" title="Overage exceeds tolerance" />
            <div className="space-y-3 p-6 text-sm text-slate-700">
              <p>
                This allocation overpays the schedule by{" "}
                <span className="font-semibold">${flexPrompt.decision.usageOverage.toFixed(2)}</span>, which is above the
                tolerance amount of{" "}
                <span className="font-semibold">${flexPrompt.decision.usageToleranceAmount.toFixed(2)}</span>.
              </p>

              {manualFlexEntryOpen ? (
                <div className="space-y-3">
                  <p>
                    Enter the adjustment amount to split into a one-time adjustment schedule.
                  </p>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Manual adjustment amount (usage)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm text-slate-800"
                      value={manualFlexUsageAmount}
                      onChange={e => setManualFlexUsageAmount(e.target.value)}
                      disabled={flexResolving}
                    />
                    <p className="text-xs text-slate-500">
                      Max: ${flexPrompt.decision.usageOverage.toFixed(2)}
                    </p>
                    {manualFlexError ? (
                      <p className="text-xs font-semibold text-red-600">{manualFlexError}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => setManualFlexEntryOpen(false)}
                      disabled={flexResolving}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                      onClick={() => void handleApplyManualFlex()}
                      disabled={flexResolving}
                    >
                      {flexResolving ? "Working..." : "Apply Manual Adjustment"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p>Select how to handle the variance:</p>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => setFlexPrompt(null)}
                      disabled={flexResolving}
                    >
                      Defer
                    </button>
                    <button
                      type="button"
                      className="rounded border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-800 hover:bg-primary-100"
                      onClick={() => void handleOpenAiAdjustment()}
                      disabled={flexResolving}
                    >
                      AI Adjustment
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => void handleResolveFlex("Adjust")}
                      disabled={flexResolving}
                    >
                      {flexResolving ? "Working..." : "Adjust Full Overage"}
                    </button>
                    {flexPrompt.decision.allowedPromptOptions.includes("Manual") ? (
                      <button
                        type="button"
                        className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => void handleResolveFlex("Manual")}
                        disabled={flexResolving}
                      >
                        Manual Amount
                      </button>
                    ) : null}
                    {flexPrompt.decision.allowedPromptOptions.includes("FlexProduct") ? (
                      <button
                        type="button"
                        className="rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                        onClick={() => void handleResolveFlex("FlexProduct")}
                        disabled={flexResolving}
                      >
                        {flexResolving ? "Working..." : "Flex Product"}
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {showDevControls ? renderDevMatchingControls() : null}
      <DepositReconciliationTopSection
        metadata={metadata}
        lineItems={lineItemRows}
        autoMatchSummary={autoMatchSummary}
        verificationEditable={canManageReconciliation && !metadata.reconciled}
        actions={
          <>
            {onBackToReconciliation ? (
              <button
                type="button"
                onClick={onBackToReconciliation}
                className="inline-flex items-center rounded border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                ← Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowVendorSummaryModal(true)}
              className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Vendor Summary
            </button>
            {includeFutureSchedulesControls ? (
              <div className="group relative inline-flex items-center" role="tooltip">
                <label className="flex cursor-pointer items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-400 text-primary-600 accent-primary-600"
                    checked={includeFutureSchedulesControls!.includeFutureSchedules}
                    onChange={event =>
                      includeFutureSchedulesControls!.onIncludeFutureSchedulesChange(event.target.checked)
                    }
                    aria-label="Include Future-Dated Schedules"
                  />
                  <span>Include Future</span>
                </label>
                <div className="pointer-events-none absolute bottom-full left-0 mb-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 whitespace-normal w-56 z-50 shadow-lg">
                  By default, the system only matches against revenue schedules dated on or before the current month. Future-dated schedules are excluded unless toggled here.
                </div>
              </div>
            ) : null}
            {onUnfinalizeDeposit ? (
              <button
                type="button"
                onClick={() => setShowUnreconcilePreview(true)}
                disabled={unfinalizeLoading}
                className={cn(
                  "inline-flex items-center justify-center rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50",
                  unfinalizeLoading ? "cursor-not-allowed opacity-60" : "",
                )}
              >
                {unfinalizeLoading ? "Reopening..." : "Reopen Deposit"}
              </button>
            ) : null}
            {onOpenFinalizeDepositReview ? (
              <button
                type="button"
                onClick={onOpenFinalizeDepositReview}
                disabled={metadata.reconciled}
                className={cn(
                  "inline-flex items-center justify-center rounded bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700",
                  metadata.reconciled ? "cursor-not-allowed opacity-60" : "",
                )}
              >
                Finalize Deposit
              </button>
            ) : null}
          </>
        }
      />
      {false ? (<div className="-mx-3 border-b border-blue-100 bg-blue-50 px-3 py-2 sm:-mx-4 sm:px-4">
        {/* Row 1: Title + Status + Buttons */}
        <div className="flex items-center justify-between pb-2 mb-2">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">Deposit Reconciliation</p>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
                headerStatus.className,
              )}
              title={headerStatus.title}
            >
              {headerStatus.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onBackToReconciliation ? (
              <button
                type="button"
                onClick={onBackToReconciliation}
                className="inline-flex items-center rounded border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                ← Back
              </button>
            ) : null}
            {includeFutureSchedulesControls ? (
              <div className="group relative inline-flex items-center" role="tooltip">
                <label className="flex cursor-pointer items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-400 text-primary-600 accent-primary-600"
                    checked={includeFutureSchedulesControls!.includeFutureSchedules}
                    onChange={event =>
                      includeFutureSchedulesControls!.onIncludeFutureSchedulesChange(event.target.checked)
                    }
                    aria-label="Include Future-Dated Schedules"
                  />
                  <span>Include Future</span>
                </label>
                <div className="pointer-events-none absolute bottom-full left-0 mb-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 whitespace-normal w-56 z-50 shadow-lg">
                  By default, the system only matches against revenue schedules dated on or before the current month. Future-dated schedules are excluded unless toggled here.
                </div>
              </div>
            ) : null}
            {onUnfinalizeDeposit ? (
              <button
                type="button"
                onClick={() => setShowUnreconcilePreview(true)}
                disabled={unfinalizeLoading}
                className={cn(
                  "inline-flex items-center justify-center rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50",
                  unfinalizeLoading ? "cursor-not-allowed opacity-60" : "",
                )}
              >
                {unfinalizeLoading ? "Reopening..." : "Reopen Deposit"}
              </button>
            ) : null}
            {onFinalizeDeposit ? (
              <button
                type="button"
                onClick={() => setShowFinalizePreview(true)}
                disabled={finalizeLoading || metadata.reconciled}
                className={cn(
                  "inline-flex items-center justify-center rounded bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700",
                  finalizeLoading || metadata.reconciled ? "cursor-not-allowed opacity-60" : "",
                )}
              >
                {finalizeLoading ? "Finalizing..." : "Finalize Deposit"}
              </button>
            ) : null}
          </div>
        </div>

        {/* Row 2: Four-column grid (inline label/value rows) */}
        <div className="grid items-start gap-x-10 gap-y-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <InlineStatRow
              label="Deposit Name"
              value={metadata.depositName}
              valueTitle={metadata.depositName}
              align="left"
            />
            <InlineStatRow label="Date" value={formattedDate} valueTitle={formattedDate} align="left" />
            <InlineStatRow
              label="Payment Type"
              value={metadata.paymentType || "-"}
              valueTitle={metadata.paymentType || "-"}
              align="left"
            />
          </div>

          <div className="space-y-1.5">
            <InlineStatRow label="Deposit Total" value={currencyFormatter.format(metadata.usageTotal)} />
            <InlineStatRow label="Allocated to Schedules" value={currencyFormatter.format(metadata.allocated)} />
            <InlineStatRow label="Remaining" value={currencyFormatter.format(metadata.unallocated)} />
          </div>

          <div className="space-y-1.5">
            <InlineStatRow label="Commission Total" value={currencyFormatter.format(commissionTotals.total)} />
            <InlineStatRow label="Commission Allocated" value={currencyFormatter.format(commissionTotals.allocated)} />
            <InlineStatRow label="Remaining" value={currencyFormatter.format(commissionTotals.unallocated)} />
          </div>

          <div className="space-y-1.5">
            <InlineStatRow label="Deposit Line Items" value={String(lineItemRows.length)} />
            <InlineStatRow label="Items Matched" value={String(matchedLineItemCount)} />
            <InlineStatRow
              label="Remaining"
              value={String(Math.max(0, lineItemRows.length - matchedLineItemCount))}
            />
          </div>
        </div>

        {/* Auto-match summary */}
        {autoMatchSummary ? (
          <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-[10px] font-medium text-emerald-800">
            Auto-allocated <span className="font-semibold">{autoMatchSummary!.autoMatched}</span> of{" "}
            <span className="font-semibold">{autoMatchSummary!.processed}</span> lines
            {autoMatchSummary!.alreadyMatched > 0 ? (
              <> {" - "}Already allocated: {autoMatchSummary!.alreadyMatched}</>
            ) : null}
            {autoMatchSummary!.belowThreshold > 0 ? (
              <> {" - "}Below threshold: {autoMatchSummary!.belowThreshold}</>
            ) : null}
            {autoMatchSummary!.noCandidates > 0 ? (
              <> {" - "}No candidates: {autoMatchSummary!.noCandidates}</>
            ) : null}
            {autoMatchSummary!.errors > 0 ? <> {" - "}Errors: {autoMatchSummary!.errors}</> : null}
          </div>
        ) : null}
      </div>) : null}

    {showFinalizePreview ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
        onClick={() => setShowFinalizePreview(false)}
      >
        <div
          className="w-full max-w-5xl rounded-2xl bg-white shadow-xl"
          style={{ width: "1024px", height: "900px" }}
          onClick={event => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Review allocations before finalizing</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowFinalizePreview(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>
          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
                Matched Line Items ({matchedLineItems.length})
              </div>
              <div className="max-h-64 overflow-y-auto">
                {matchedLineItems.length ? (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Line</th>
                        <th className="px-3 py-2 text-left">Account</th>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {matchedLineItems.map(item => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 text-slate-900">{item.lineItem}</td>
                          <td className="px-3 py-2 text-slate-700">{item.accountName}</td>
                          <td className="px-3 py-2 text-slate-700">{item.productName}</td>
                          <td className="px-3 py-2 text-slate-700">{item.status}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => void unmatchLineById(item.id)}
                              disabled={undoingLineId === item.id}
                              className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {undoingLineId === item.id ? "Undoing..." : "Undo"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4 text-xs text-slate-500">No allocated line items yet.</div>
                )}
      </div>
    </div>

    {showUnreconcilePreview ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
        onClick={() => setShowUnreconcilePreview(false)}
      >
        <div
          className="w-full max-w-5xl rounded-2xl bg-white shadow-xl"
          style={{ width: "1024px", height: "900px" }}
          onClick={event => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Review finalized items</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowUnreconcilePreview(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>
          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
                Finalized Line Items ({matchedLineItems.length})
              </div>
              <div className="max-h-64 overflow-y-auto">
                {matchedLineItems.length ? (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Line</th>
                        <th className="px-3 py-2 text-left">Account</th>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {matchedLineItems.map(item => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 text-slate-900">{item.lineItem}</td>
                          <td className="px-3 py-2 text-slate-700">{item.accountName}</td>
                          <td className="px-3 py-2 text-slate-700">{item.productName}</td>
                          <td className="px-3 py-2 text-slate-700">{item.reconciled ? "Reconciled" : item.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4 text-xs text-slate-500">No reconciled line items.</div>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
                Finalized Revenue Schedules ({matchedSchedules.length})
              </div>
              <div className="max-h-64 overflow-y-auto">
                {matchedSchedules.length ? (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Schedule</th>
                        <th className="px-3 py-2 text-left">Account</th>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {matchedSchedules.map(schedule => (
                        <tr key={schedule.id}>
                          <td className="px-3 py-2 text-slate-900">{schedule.revenueScheduleName}</td>
                          <td className="px-3 py-2 text-slate-700">{schedule.legalName}</td>
                          <td className="px-3 py-2 text-slate-700">{schedule.productNameVendor}</td>
                          <td className="px-3 py-2 text-slate-700">{schedule.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4 text-xs text-slate-500">No reconciled schedules.</div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={() => setShowUnreconcilePreview(false)}
              className="rounded border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed"
              disabled={unfinalizeLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUnreconcilePreview(false)
                onUnfinalizeDeposit?.()
              }}
              disabled={unfinalizeLoading}
              className={cn(
                "rounded bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {unfinalizeLoading ? "Reopening..." : "Reopen Deposit"}
            </button>
          </div>
        </div>
      </div>
    ) : null}

    {showUnreconcilePreview ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
        onClick={() => setShowUnreconcilePreview(false)}
      >
        <div
          className="w-full max-w-5xl rounded-2xl bg-white shadow-xl"
          style={{ width: "1024px", height: "900px" }}
          onClick={event => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Review finalized items</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowUnreconcilePreview(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>
          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
                Finalized Line Items ({matchedLineItems.length})
              </div>
              <div className="max-h-64 overflow-y-auto">
                {matchedLineItems.length ? (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Line</th>
                        <th className="px-3 py-2 text-left">Account</th>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {matchedLineItems.map(item => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 text-slate-900">{item.lineItem}</td>
                          <td className="px-3 py-2 text-slate-700">{item.accountName}</td>
                          <td className="px-3 py-2 text-slate-700">{item.productName}</td>
                          <td className="px-3 py-2 text-slate-700">{item.reconciled ? "Reconciled" : item.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4 text-xs text-slate-500">No reconciled line items.</div>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
                Finalized Revenue Schedules ({matchedSchedules.length})
              </div>
              <div className="max-h-64 overflow-y-auto">
                {matchedSchedules.length ? (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Schedule</th>
                        <th className="px-3 py-2 text-left">Account</th>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {matchedSchedules.map(schedule => (
                        <tr key={schedule.id}>
                          <td className="px-3 py-2 text-slate-900">{schedule.revenueScheduleName}</td>
                          <td className="px-3 py-2 text-slate-700">{schedule.legalName}</td>
                          <td className="px-3 py-2 text-slate-700">{schedule.productNameVendor}</td>
                          <td className="px-3 py-2 text-slate-700">{schedule.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4 text-xs text-slate-500">No reconciled schedules.</div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={() => setShowUnreconcilePreview(false)}
              className="rounded border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed"
              disabled={unfinalizeLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUnreconcilePreview(false)
                onUnfinalizeDeposit?.()
              }}
              disabled={unfinalizeLoading}
              className={cn(
                "rounded bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {unfinalizeLoading ? "Reopening..." : "Reopen Deposit"}
            </button>
          </div>
        </div>
      </div>
    ) : null}
            <div className="rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
                Matched Revenue Schedules ({matchedSchedules.length})
              </div>
              <div className="max-h-64 overflow-y-auto">
                {matchedSchedules.length ? (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Schedule</th>
                        <th className="px-3 py-2 text-left">Account</th>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {matchedSchedules.map(schedule => (
                        <tr key={schedule.id}>
                          <td className="px-3 py-2 text-slate-900">{schedule.revenueScheduleName}</td>
                          <td className="px-3 py-2 text-slate-700">{schedule.legalName}</td>
                          <td className="px-3 py-2 text-slate-700">{schedule.productNameVendor}</td>
                          <td className="px-3 py-2 text-slate-700">{schedule.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4 text-xs text-slate-500">No allocated schedules yet.</div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={() => setShowFinalizePreview(false)}
              className="rounded border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed"
              disabled={finalizeLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setShowFinalizePreview(false)
                onFinalizeDeposit?.()
              }}
              disabled={finalizeLoading}
              className={cn(
                "rounded bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {finalizeLoading ? "Finalizing..." : "Confirm & Finalize"}
            </button>
          </div>
        </div>
      </div>
    ) : null}

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-slate-100">
          <div className="px-0 py-2">
            <TabDescription className="my-0">
              Review deposit line items and match deposit amounts to revenue schedules. Matches are editable until the deposit
              is finalized.
            </TabDescription>
          </div>
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
            preSearchAccessory={
              onRunAutoMatch ? (
                <button
                  type="button"
                  onClick={onRunAutoMatch}
                  disabled={autoMatchLoading}
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1 rounded border border-slate-200 bg-white px-2.5 text-xs font-semibold text-primary-700 shadow-sm transition hover:bg-primary-50",
                    autoMatchLoading ? "cursor-not-allowed opacity-60" : "",
                  )}
                  aria-label="Use AI Matching"
                  title="Use AI Matching"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Use AI Matching</span>
                </button>
              ) : null
            }
            leftAccessory={
              <div className="flex items-center gap-1">
                <DepositLineStatusFilterDropdown value={lineTab} onChange={setLineTab} size="compact" />
                <button
                  type="button"
                  onClick={handleDeleteDeposit}
                  disabled={!canManageReconciliation}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 shadow-sm transition hover:bg-red-50",
                    !canManageReconciliation ? "cursor-not-allowed opacity-60" : "",
                  )}
                  aria-label="Delete Deposit"
                  title={canManageReconciliation ? "Delete Deposit" : "Insufficient permissions"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            }
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col pt-1">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" ref={lineTableAreaRefCallback}>
            <DynamicTable
              className="flex flex-col"
              columns={lineTableColumns}
              data={sortedLineItems}
              onSort={(column, direction) => setLineSortConfig({ key: column, direction })}
              loading={loading || linePreferenceLoading}
              emptyMessage="No deposit line items found"
              fillContainerWidth={false}
              hasLoadedPreferences={!linePreferenceLoading && lineTableColumns.length > 0}
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

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-slate-100">
          <div className="px-0 py-2">
            <TabDescription className="my-0">
              Select a revenue schedule, then match the selected deposit line item. Finalizing is a separate step that
              locks these allocations.
            </TabDescription>
          </div>
          <ListHeader
            pageTitle="Suggested Matches - Revenue Schedules"
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
            preSearchAccessory={
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void handleCreateFlexSelected()}
                  disabled={Boolean(createFlexButtonDisabledReason)}
                  title={createFlexButtonDisabledReason ?? "Create a flex entry for the selected line item"}
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1 rounded border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50",
                    createFlexButtonDisabledReason ? "cursor-not-allowed opacity-60 hover:bg-white" : ""
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {createFlexButtonLabel}
                </button>
                <button
                  type="button"
                  onClick={handleMatchSelected}
                  disabled={Boolean(matchButtonDisabledReason)}
                  title={
                    matchButtonDisabledReason ??
                    (isUnmatchSelection
                      ? "Unmatch the selected line item from the selected schedule"
                      : "Match the selected line item to the selected schedule")
                  }
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1 rounded bg-primary-600 px-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700",
                    matchButtonDisabledReason ? "cursor-not-allowed opacity-60 hover:bg-primary-600" : ""
                  )}
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  {isUnmatchSelection ? "Unmatched" : "Match"}
                </button>
              </div>
            }
            leftAccessory={
              <div className="flex items-center gap-1">
                <ReconciliationScheduleStatusFilterDropdown
                  value={scheduleTab}
                  onChange={setScheduleTab}
                  size="compact"
                />
                {onIncludeFutureSchedulesChange ? (
                  <label className="flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-400 text-primary-600 accent-primary-600"
                      checked={includeFutureSchedules}
                      onChange={event => onIncludeFutureSchedulesChange(event.target.checked)}
                      aria-label="Include Future-Dated Schedules"
                    />
                    <span>Include Future-Dated Schedules</span>
                  </label>
                ) : null}
                <div className="hidden flex-wrap items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Suggested ≥ {Math.round(confidencePrefs.suggestedMatchesMinConfidence * 100)}%
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(confidencePrefs.suggestedMatchesMinConfidence * 100)}
                      onChange={event => {
                        const next = Number(event.target.value) / 100
                        setConfidencePrefs(previous => ({ ...previous, suggestedMatchesMinConfidence: next }))
                        scheduleConfidenceSave({ suggestedMatchesMinConfidence: next })
                      }}
                      disabled={confidencePrefsLoading}
                      className="w-28 accent-primary-600"
                      aria-label="Suggested matches minimum confidence"
                    />
                  </div>
                  <div className="h-5 w-px bg-slate-200" aria-hidden="true" />
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Auto ≥ {Math.round(confidencePrefs.autoMatchMinConfidence * 100)}%
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(confidencePrefs.autoMatchMinConfidence * 100)}
                      onChange={event => {
                        const next = Number(event.target.value) / 100
                        setConfidencePrefs(previous => ({ ...previous, autoMatchMinConfidence: next }))
                        scheduleConfidenceSave({ autoMatchMinConfidence: next })
                      }}
                      disabled={confidencePrefsLoading}
                      className="w-28 accent-primary-600"
                      aria-label="Auto-allocation minimum confidence"
                    />
                  </div>
                </div>
              </div>
            }
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col pt-1">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" ref={scheduleTableAreaRefCallback}>
            <DynamicTable
              className="flex flex-col"
              columns={scheduleTableColumns}
              data={sortedSchedules}
              onSort={(column, direction) => setScheduleSortConfig({ key: column, direction })}
              loading={scheduleLoading || loading || schedulePreferenceLoading}
              emptyMessage="No suggested matches found"
              fillContainerWidth
              preferOverflowHorizontalScroll
              hasLoadedPreferences={!schedulePreferenceLoading && scheduleTableColumns.length > 0}
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
      <TwoStageDeleteDialog
        isOpen={showDeleteDepositDialog}
        onClose={() => setShowDeleteDepositDialog(false)}
        entity="Deposit"
        entityName={metadata.depositName}
        entityId={metadata.id}
        deleteKind="permanent"
        onSoftDelete={async () => deleteDeposit()}
        onPermanentDelete={async () => deleteDeposit()}
        primaryActionLabel="Delete Deposit"
        note="Deleting a deposit permanently removes its line items and allocations. This action cannot be undone."
      />
      <ToastContainer />
    </div>
  )
}
