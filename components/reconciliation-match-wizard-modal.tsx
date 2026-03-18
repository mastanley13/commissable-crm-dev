"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ModalHeader } from "./ui/modal-header"
import { cn } from "@/lib/utils"
import type { DepositLineItemRow, SuggestedMatchScheduleRow } from "@/lib/mock-data"
import type { MatchSelectionType } from "@/lib/matching/match-selection"
import { isSelectionCompatibleWithType } from "@/lib/matching/match-selection"
import { deriveMatchWizardValidationState } from "@/lib/matching/match-wizard-validation"

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

type AllocationDraft = {
  usage: string
  commission: string
}

type PreviewIssue = { level: "error" | "warning"; code: string; message: string }
type PreviewResponse =
  | { ok: false; issues: PreviewIssue[] }
  | {
      ok: true
      tenantVarianceTolerance: number
      issues: PreviewIssue[]
      lines: Array<{
        lineId: string
        usage: number
        commission: number
        usageAllocatedBefore: number
        commissionAllocatedBefore: number
        usageAllocatedAfter: number
        commissionAllocatedAfter: number
        usageUnallocatedAfter: number
        commissionUnallocatedAfter: number
      }>
      schedules: Array<{
        scheduleId: string
        expectedUsageNet: number
        expectedCommissionNet: number
        actualUsageNetAfter: number
        actualCommissionNetAfter: number
        usageBalanceAfter: number
        commissionDifferenceAfter: number
        withinToleranceAfter: boolean
      }>
    }

type PreviewLineRow = Extract<PreviewResponse, { ok: true }>["lines"][number]
type PreviewScheduleRow = Extract<PreviewResponse, { ok: true }>["schedules"][number]

const AUTO_VALIDATION_DEBOUNCE_MS = 300

function formatMatchType(type: MatchSelectionType) {
  switch (type) {
    case "OneToOne":
      return "1:1"
    case "OneToMany":
      return "1:M"
    case "ManyToOne":
      return "M:1"
    case "ManyToMany":
      return "M:M"
    default: {
      const exhaustiveCheck: never = type
      return exhaustiveCheck
    }
  }
}

function formatPercent(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "0.00%"
  const numeric = Number(value)
  const normalized = Math.abs(numeric) <= 1.5 ? numeric * 100 : numeric
  return `${percentFormatter.format(normalized)}%`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  return value.slice(0, 10)
}

function formatCount(value: number | null | undefined, fractionDigits = 2) {
  if (!Number.isFinite(Number(value))) return "0.00"
  return Number(value).toFixed(fractionDigits)
}

function MatchWizardSelectionTable(props: {
  title: string
  emptyLabel: string
  headers: string[]
  rows: ReactNode[][]
}) {
  return (
    <section>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2f6fe4]">{props.title}</p>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-blue-700 text-left text-xs">
            <thead className="bg-[#2f6fe4] text-white">
              <tr>
                {props.headers.map(header => (
                  <th key={header} className="whitespace-nowrap px-4 py-1.5 font-semibold uppercase tracking-wide">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.rows.length > 0 ? (
                props.rows.map((row, rowIndex) => (
                  <tr
                    key={`${props.title}-${rowIndex}`}
                    className="border-b border-slate-200 bg-white text-slate-700 last:border-b-0"
                  >
                    {row.map((value, cellIndex) => (
                      <td key={`${props.title}-${rowIndex}-${cellIndex}`} className="whitespace-nowrap px-4 py-2">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr className="bg-white text-slate-700">
                  <td className="px-4 py-3 text-slate-500" colSpan={props.headers.length}>
                    {props.emptyLabel}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function renderHighlightedPreviewValue(value: string, changed: boolean) {
  if (!changed) return value
  return <span className="recon-preview-chip">{value}</span>
}

function parseAmount(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric)) return null
  return Math.round(numeric * 100) / 100
}

function allocationKey(lineId: string, scheduleId: string) {
  return `${lineId}:${scheduleId}`
}

function buildDefaultAllocations(params: {
  matchType: MatchSelectionType
  lines: DepositLineItemRow[]
  schedules: SuggestedMatchScheduleRow[]
}): Record<string, AllocationDraft> {
  if (params.matchType === "OneToMany") {
    const line = params.lines[0]
    if (!line) return {}

    const totalUsage = Math.max(0, Number(line.usageUnallocated ?? 0))
    const totalCommission = Math.max(0, Number(line.commissionUnallocated ?? 0))

    const weights = params.schedules.map(schedule => ({
      scheduleId: schedule.id,
      weight:
        Math.max(0, Math.abs(Number(schedule.expectedUsageNet ?? 0))) +
        Math.max(0, Math.abs(Number(schedule.expectedCommissionNet ?? 0))),
    }))
    const weightSum = weights.reduce((acc, row) => acc + row.weight, 0)
    const denom = weightSum > 0.0001 ? weightSum : weights.length || 1

    let usageRemaining = totalUsage
    let commissionRemaining = totalCommission
    const out: Record<string, AllocationDraft> = {}

    weights.forEach((row, index) => {
      const isLast = index === weights.length - 1
      const fraction = weightSum > 0.0001 ? row.weight / denom : 1 / denom
      const usage = isLast ? usageRemaining : Math.round(totalUsage * fraction * 100) / 100
      const commission = isLast ? commissionRemaining : Math.round(totalCommission * fraction * 100) / 100
      usageRemaining = Math.round((usageRemaining - usage) * 100) / 100
      commissionRemaining = Math.round((commissionRemaining - commission) * 100) / 100

      out[allocationKey(line.id, row.scheduleId)] = {
        usage: usage ? usage.toFixed(2) : "",
        commission: commission ? commission.toFixed(2) : "",
      }
    })

    return out
  }

  if (params.matchType === "ManyToOne") {
    const scheduleId = params.schedules[0]?.id
    if (!scheduleId) return {}
    const out: Record<string, AllocationDraft> = {}
    for (const line of params.lines) {
      const usage = Math.max(0, Number(line.usageUnallocated ?? 0))
      const commission = Math.max(0, Number(line.commissionUnallocated ?? 0))
      out[allocationKey(line.id, scheduleId)] = {
        usage: usage ? usage.toFixed(2) : "",
        commission: commission ? commission.toFixed(2) : "",
      }
    }
    return out
  }

  if (params.matchType === "ManyToMany") {
    const schedulesSorted = [...params.schedules].sort((a, b) => {
      const dateA = a.revenueScheduleDate ? new Date(a.revenueScheduleDate).getTime() : Number.POSITIVE_INFINITY
      const dateB = b.revenueScheduleDate ? new Date(b.revenueScheduleDate).getTime() : Number.POSITIVE_INFINITY
      if (dateA !== dateB) return dateA - dateB
      return (a.revenueScheduleName ?? "").localeCompare(b.revenueScheduleName ?? "")
    })
    const linesSorted = [...params.lines].sort((a, b) => (a.lineItem ?? 0) - (b.lineItem ?? 0))

    const usageRemainingBySchedule = new Map<string, number>()
    const commissionRemainingBySchedule = new Map<string, number>()

    for (const schedule of schedulesSorted) {
      usageRemainingBySchedule.set(schedule.id, Math.max(0, Number(schedule.expectedUsageNet ?? 0)))
      commissionRemainingBySchedule.set(schedule.id, Math.max(0, Number(schedule.expectedCommissionNet ?? 0)))
    }

    const out: Record<string, AllocationDraft> = {}
    for (const line of linesSorted) {
      let usageRemaining = Math.max(0, Number(line.usageUnallocated ?? 0))
      let commissionRemaining = Math.max(0, Number(line.commissionUnallocated ?? 0))

      for (const schedule of schedulesSorted) {
        if (usageRemaining <= 0.005 && commissionRemaining <= 0.005) break

        const scheduleUsageRemaining = usageRemainingBySchedule.get(schedule.id) ?? 0
        const scheduleCommissionRemaining = commissionRemainingBySchedule.get(schedule.id) ?? 0

        const usageAmount = Math.round(Math.min(usageRemaining, scheduleUsageRemaining) * 100) / 100
        const commissionAmount = Math.round(Math.min(commissionRemaining, scheduleCommissionRemaining) * 100) / 100

        if (usageAmount <= 0.005 && commissionAmount <= 0.005) continue

        out[allocationKey(line.id, schedule.id)] = {
          usage: usageAmount ? usageAmount.toFixed(2) : "",
          commission: commissionAmount ? commissionAmount.toFixed(2) : "",
        }

        usageRemaining = Math.round((usageRemaining - usageAmount) * 100) / 100
        commissionRemaining = Math.round((commissionRemaining - commissionAmount) * 100) / 100

        usageRemainingBySchedule.set(schedule.id, Math.round((scheduleUsageRemaining - usageAmount) * 100) / 100)
        commissionRemainingBySchedule.set(
          schedule.id,
          Math.round((scheduleCommissionRemaining - commissionAmount) * 100) / 100,
        )
      }
    }

    if (Object.keys(out).length === 0) {
      const line = linesSorted[0]
      const schedule = schedulesSorted[0]
      if (!line || !schedule) return {}
      const usage = Math.max(0, Number(line.usageUnallocated ?? 0))
      const commission = Math.max(0, Number(line.commissionUnallocated ?? 0))
      return {
        [allocationKey(line.id, schedule.id)]: {
          usage: usage ? usage.toFixed(2) : "",
          commission: commission ? commission.toFixed(2) : "",
        },
      }
    }

    return out
  }

  return {}
}

export function ReconciliationMatchWizardModal(props: {
  open: boolean
  onClose: () => void
  depositId: string
  selectedLines: DepositLineItemRow[]
  selectedSchedules: SuggestedMatchScheduleRow[]
  detectedType: MatchSelectionType
  onApplied?: () => void
}) {
  const [overrideType, setOverrideType] = useState<MatchSelectionType | null>(null)
  const [allocations, setAllocations] = useState<Record<string, AllocationDraft>>({})
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [allocationsVersion, setAllocationsVersion] = useState(0)
  const [previewVersion, setPreviewVersion] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [applyLoading, setApplyLoading] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [appliedMatchGroupId, setAppliedMatchGroupId] = useState<string | null>(null)
  const [undoReason, setUndoReason] = useState("")
  const [undoLoading, setUndoLoading] = useState(false)
  const [undoError, setUndoError] = useState<string | null>(null)

  const [wizardSchedules, setWizardSchedules] = useState<SuggestedMatchScheduleRow[]>(props.selectedSchedules)
  const [manyToOneMode, setManyToOneMode] = useState<"allocation" | "bundle">("allocation")
  const [bundleApplyMode, setBundleApplyMode] = useState<"keep_old" | "soft_delete_old">("keep_old")
  const [bundleApplyReason, setBundleApplyReason] = useState("")
  const [bundleAuditLogId, setBundleAuditLogId] = useState<string | null>(null)
  const [bundleLoading, setBundleLoading] = useState(false)
  const [bundleError, setBundleError] = useState<string | null>(null)
  const [bundleUndoReason, setBundleUndoReason] = useState("")
  const [bundleUndoLoading, setBundleUndoLoading] = useState(false)
  const [bundleUndoError, setBundleUndoError] = useState<string | null>(null)

  const skipAllocationResetRef = useRef(false)
  const autoPreviewRequestKeyRef = useRef<string | null>(null)
  const autoValidationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [allocationExpanded, setAllocationExpanded] = useState(false)

  const isOpen = props.open
  const onClose = props.onClose
  const depositId = props.depositId
  const detectedType = props.detectedType
  const initialSelectedSchedules = props.selectedSchedules
  const onApplied = props.onApplied

  const selectedLines = props.selectedLines
  const selectedSchedules = wizardSchedules

  const lineCount = selectedLines.length
  const scheduleCount = selectedSchedules.length
  const effectiveType = overrideType ?? detectedType

  useEffect(() => {
    if (!isOpen) return
    setOverrideType(null)
    setPreview(null)
    setPreviewVersion(null)
    setAllocationsVersion(0)
    setAllocationExpanded(detectedType === "ManyToOne")
    setPreviewLoading(false)
    setPreviewError(null)
    setApplyLoading(false)
    setApplyError(null)
    setAppliedMatchGroupId(null)
    setUndoReason("")
    setUndoLoading(false)
    setUndoError(null)
    setWizardSchedules(initialSelectedSchedules)
    setManyToOneMode("allocation")
    setBundleApplyMode("keep_old")
    setBundleApplyReason("")
    setBundleAuditLogId(null)
    setBundleLoading(false)
    setBundleError(null)
    setBundleUndoReason("")
    setBundleUndoLoading(false)
    setBundleUndoError(null)
    skipAllocationResetRef.current = false
    autoPreviewRequestKeyRef.current = null
    if (autoValidationTimeoutRef.current) {
      clearTimeout(autoValidationTimeoutRef.current)
      autoValidationTimeoutRef.current = null
    }
    setAllocations(
      buildDefaultAllocations({
        matchType: detectedType,
        lines: selectedLines,
        schedules: initialSelectedSchedules,
      }),
    )
  }, [detectedType, initialSelectedSchedules, isOpen, selectedLines])

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      onClose()
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    setPreview(null)
    setPreviewVersion(null)
    setPreviewError(null)
    setAppliedMatchGroupId(null)
    setApplyError(null)
    setUndoError(null)
    setUndoReason("")

    if (skipAllocationResetRef.current) {
      skipAllocationResetRef.current = false
      return
    }

    setAllocations(
      buildDefaultAllocations({
        matchType: effectiveType,
        lines: selectedLines,
        schedules: selectedSchedules,
      }),
    )
  }, [effectiveType, isOpen, selectedLines, selectedSchedules])

  const lineIdsKey = useMemo(() => selectedLines.map(line => line.id).join(","), [selectedLines])
  const scheduleIdsKey = useMemo(() => selectedSchedules.map(schedule => schedule.id).join(","), [selectedSchedules])
  const previewInputsKey = `${effectiveType}|${manyToOneMode}|${lineIdsKey}|${scheduleIdsKey}`

  useEffect(() => {
    if (!isOpen) return
    setAllocationsVersion(prev => prev + 1)
    setPreviewVersion(null)
  }, [allocations, isOpen, previewInputsKey])

  const selectionCompatible = useMemo(
    () => isSelectionCompatibleWithType({ type: effectiveType, lineCount, scheduleCount }),
    [effectiveType, lineCount, scheduleCount],
  )

  const previewUpToDate = Boolean(preview && previewVersion !== null && previewVersion === allocationsVersion)

  const selectionTotals = useMemo(() => {
    const lineUsageTotal = selectedLines.reduce((sum, row) => sum + (Number(row.usage) || 0), 0)
    const lineCommissionTotal = selectedLines.reduce((sum, row) => sum + (Number(row.commission) || 0), 0)
    const scheduleExpectedUsage = selectedSchedules.reduce(
      (sum, row) => sum + (Number(row.expectedUsageNet) || 0),
      0,
    )
    const scheduleExpectedCommission = selectedSchedules.reduce(
      (sum, row) => sum + (Number(row.expectedCommissionNet) || 0),
      0,
    )
    return {
      lineUsageTotal,
      lineCommissionTotal,
      scheduleExpectedUsage,
      scheduleExpectedCommission,
    }
  }, [selectedLines, selectedSchedules])

  const selectionVarianceSummary = useMemo(() => {
    const usageBase = Math.max(Math.abs(selectionTotals.lineUsageTotal), Math.abs(selectionTotals.scheduleExpectedUsage))
    const commissionBase = Math.max(
      Math.abs(selectionTotals.lineCommissionTotal),
      Math.abs(selectionTotals.scheduleExpectedCommission),
    )
    const usageSpread =
      usageBase > 0.005 ? Math.abs(selectionTotals.lineUsageTotal - selectionTotals.scheduleExpectedUsage) / usageBase : 0
    const commissionSpread =
      commissionBase > 0.005
        ? Math.abs(selectionTotals.lineCommissionTotal - selectionTotals.scheduleExpectedCommission) / commissionBase
        : 0
    const needsAttention = usageSpread >= 0.5 || commissionSpread >= 0.5

    if (!needsAttention) return null

    return {
      usageSpread,
      commissionSpread,
    }
  }, [selectionTotals])

  const previewLineMap = useMemo(() => {
    const map = new Map<string, PreviewLineRow>()
    if (!previewUpToDate || !preview || !preview.ok) return map
    for (const row of preview.lines) {
      map.set(row.lineId, row)
    }
    return map
  }, [preview, previewUpToDate])

  const previewScheduleMap = useMemo(() => {
    const map = new Map<string, PreviewScheduleRow>()
    if (!previewUpToDate || !preview || !preview.ok) return map
    for (const row of preview.schedules) {
      map.set(row.scheduleId, row)
    }
    return map
  }, [preview, previewUpToDate])

  const selectedLineRows = useMemo<ReactNode[][]>(
    () =>
      selectedLines.map(line => {
        const previewLine = previewLineMap.get(line.id)
        const usageAllocatedAfter = previewLine?.usageAllocatedAfter ?? Number(line.usageAllocated ?? 0)
        const usageUnallocatedAfter = previewLine?.usageUnallocatedAfter ?? Number(line.usageUnallocated ?? 0)
        const commissionAllocatedAfter = previewLine?.commissionAllocatedAfter ?? Number(line.commissionAllocated ?? 0)
        return [
          line.accountId || "-",
          line.accountName || "-",
          line.productName || "-",
          line.lineItem ?? "-",
          currencyFormatter.format(Number(line.usage ?? 0)),
          renderHighlightedPreviewValue(
            currencyFormatter.format(usageAllocatedAfter),
            Math.abs(usageAllocatedAfter - Number(line.usageAllocated ?? 0)) > 0.005,
          ),
          renderHighlightedPreviewValue(
            currencyFormatter.format(usageUnallocatedAfter),
            Math.abs(usageUnallocatedAfter - Number(line.usageUnallocated ?? 0)) > 0.005,
          ),
          formatPercent(line.commissionRate),
          currencyFormatter.format(Number(line.commission ?? 0)),
          renderHighlightedPreviewValue(
            currencyFormatter.format(commissionAllocatedAfter),
            Math.abs(commissionAllocatedAfter - Number(line.commissionAllocated ?? 0)) > 0.005,
          ),
        ]
      }),
    [previewLineMap, selectedLines],
  )

  const selectedScheduleRows = useMemo<ReactNode[][]>(
    () =>
      selectedSchedules.map(schedule => {
        const previewSchedule = previewScheduleMap.get(schedule.id)
        const actualUsageAfter = previewSchedule?.actualUsageNetAfter ?? Number(schedule.actualUsage ?? 0)
        const actualCommissionAfter = previewSchedule?.actualCommissionNetAfter ?? Number(schedule.actualCommission ?? 0)
        const usageBalanceAfter = previewSchedule?.usageBalanceAfter ?? Number(schedule.usageBalance ?? 0)
        const commissionDifferenceAfter =
          previewSchedule?.commissionDifferenceAfter ?? Number(schedule.commissionDifference ?? 0)
        const actualRateAfter =
          Math.abs(actualUsageAfter) <= 0.005 ? 0 : actualCommissionAfter / actualUsageAfter
        return [
          schedule.revenueScheduleName || schedule.id,
          formatDate(schedule.revenueScheduleDate),
          formatCount(schedule.quantity),
          currencyFormatter.format(Number(schedule.priceEach ?? 0)),
          currencyFormatter.format(Number(schedule.expectedUsageGross ?? 0)),
          currencyFormatter.format(Number(schedule.expectedUsageAdjustment ?? 0)),
          currencyFormatter.format(Number(schedule.expectedUsageNet ?? 0)),
          formatPercent(schedule.expectedCommissionRatePercent),
          currencyFormatter.format(Number(schedule.expectedCommissionNet ?? 0)),
          renderHighlightedPreviewValue(
            currencyFormatter.format(actualUsageAfter),
            Math.abs(actualUsageAfter - Number(schedule.actualUsage ?? 0)) > 0.005,
          ),
          renderHighlightedPreviewValue(
            currencyFormatter.format(actualCommissionAfter),
            Math.abs(actualCommissionAfter - Number(schedule.actualCommission ?? 0)) > 0.005,
          ),
          renderHighlightedPreviewValue(
            formatPercent(actualRateAfter),
            Math.abs(actualRateAfter - Number(schedule.actualCommissionRatePercent ?? 0)) > 0.005,
          ),
          renderHighlightedPreviewValue(
            currencyFormatter.format(usageBalanceAfter),
            Math.abs(usageBalanceAfter - Number(schedule.usageBalance ?? 0)) > 0.005,
          ),
          renderHighlightedPreviewValue(
            currencyFormatter.format(commissionDifferenceAfter),
            Math.abs(commissionDifferenceAfter - Number(schedule.commissionDifference ?? 0)) > 0.005,
          ),
        ]
      }),
    [previewScheduleMap, selectedSchedules],
  )

  const selectionBlockedReason = useMemo(() => {
    if (!selectionCompatible) return "Selection does not match match type."
    return null
  }, [selectionCompatible])

  const replacementRequiredIssue = useMemo(() => {
    const issues = preview?.issues ?? []
    return issues.find(issue => issue.code === "many_to_one_mixed_rate_requires_replacement") ?? null
  }, [preview])

  const replacementBlockedIssue = useMemo(() => {
    const issues = preview?.issues ?? []
    return issues.find(issue => issue.code === "many_to_one_rate_unknown") ?? null
  }, [preview])

  const replacementRequired = Boolean(
    effectiveType === "ManyToOne" && replacementRequiredIssue && !bundleAuditLogId,
  )

  const allocationRows = useMemo(() => {
    if (effectiveType === "OneToMany") {
      const line = selectedLines[0]
      if (!line) return []
      return selectedSchedules.map(schedule => {
        const key = allocationKey(line.id, schedule.id)
        const draft = allocations[key] ?? { usage: "", commission: "" }
        return {
          key,
          lineId: line.id,
          scheduleId: schedule.id,
          label: schedule.revenueScheduleName ?? schedule.id,
          expectedUsageNet: Number(schedule.expectedUsageNet ?? 0),
          expectedCommissionNet: Number(schedule.expectedCommissionNet ?? 0),
          usage: draft.usage,
          commission: draft.commission,
        }
      })
    }

    if (effectiveType === "ManyToOne") {
      const schedule = selectedSchedules[0]
      if (!schedule) return []
      return selectedLines.map(line => {
        const key = allocationKey(line.id, schedule.id)
        const draft = allocations[key] ?? { usage: "", commission: "" }
        return {
          key,
          lineId: line.id,
          scheduleId: schedule.id,
          label: `${line.accountName} · ${line.productName}`,
          expectedUsageNet: Number(schedule.expectedUsageNet ?? 0),
          expectedCommissionNet: Number(schedule.expectedCommissionNet ?? 0),
          usage: draft.usage,
          commission: draft.commission,
        }
      })
    }

    if (effectiveType === "ManyToMany") {
      const schedulesSorted = [...selectedSchedules].sort((a, b) => {
        const dateA = a.revenueScheduleDate ? new Date(a.revenueScheduleDate).getTime() : Number.POSITIVE_INFINITY
        const dateB = b.revenueScheduleDate ? new Date(b.revenueScheduleDate).getTime() : Number.POSITIVE_INFINITY
        if (dateA !== dateB) return dateA - dateB
        return (a.revenueScheduleName ?? "").localeCompare(b.revenueScheduleName ?? "")
      })

      const linesSorted = [...selectedLines].sort((a, b) => (a.lineItem ?? 0) - (b.lineItem ?? 0))

      return linesSorted.flatMap(line =>
        schedulesSorted.map(schedule => {
          const key = allocationKey(line.id, schedule.id)
          const draft = allocations[key] ?? { usage: "", commission: "" }
          return {
            key,
            lineId: line.id,
            scheduleId: schedule.id,
            label: `${line.accountName} · ${line.productName} → ${schedule.revenueScheduleName ?? schedule.id}`,
            expectedUsageNet: Number(schedule.expectedUsageNet ?? 0),
            expectedCommissionNet: Number(schedule.expectedCommissionNet ?? 0),
            usage: draft.usage,
            commission: draft.commission,
          }
        }),
      )
    }

    return []
  }, [allocations, effectiveType, selectedLines, selectedSchedules])

  const allocationTotals = useMemo(() => {
    let usage = 0
    let commission = 0
    for (const row of allocationRows) {
      const usageAmount = parseAmount(row.usage) ?? 0
      const commissionAmount = parseAmount(row.commission) ?? 0
      usage += usageAmount
      commission += commissionAmount
    }
    return { usage: Math.round(usage * 100) / 100, commission: Math.round(commission * 100) / 100 }
  }, [allocationRows])

  const canProceedToAllocation = selectionCompatible
  const bundleBlocking =
    effectiveType === "ManyToOne" &&
    !bundleAuditLogId &&
    (manyToOneMode === "bundle" || replacementRequired)
  const canProceedToPreview = canProceedToAllocation && allocationRows.length > 0 && !bundleBlocking

  const allocationsPayload = useMemo(() => {
    return allocationRows.map(row => ({
      lineId: row.lineId,
      scheduleId: row.scheduleId,
      usageAmount: parseAmount(row.usage),
      commissionAmount: parseAmount(row.commission),
    }))
  }, [allocationRows])

  const hasPreviewErrors = useMemo(() => {
    if (!preview) return false
    if (!preview.ok) return true
    return preview.issues.some(issue => issue.level === "error")
  }, [preview])

  const canConfirmApply = useMemo(() => {
    return Boolean(
      previewUpToDate && preview && preview.ok && !hasPreviewErrors && !applyLoading && !appliedMatchGroupId,
    )
  }, [appliedMatchGroupId, applyLoading, hasPreviewErrors, preview, previewUpToDate])

  const previewBlockedReason = useMemo(() => {
    if (!canProceedToAllocation) return selectionBlockedReason ?? "Fix selection first."
    if (replacementRequired) return "Replace the bundle first."
    if (bundleBlocking) return "Create bundle schedules first."
    if (allocationRows.length === 0) return "No allocation rows available."
    return null
  }, [allocationRows.length, bundleBlocking, canProceedToAllocation, replacementRequired, selectionBlockedReason])

  const applyBlockedReason = useMemo(() => {
    if (!canProceedToPreview) return previewBlockedReason ?? "Validation has not completed yet."
    if (previewError) return "Validation could not be completed. Retry validation."
    if (!preview) return "Validation has not completed yet."
    if (!previewUpToDate) return "Validation is updating after your latest changes."
    if (hasPreviewErrors) return "Fix validation issues before applying."
    return null
  }, [canProceedToPreview, hasPreviewErrors, preview, previewBlockedReason, previewError, previewUpToDate])

  const validationIssues = useMemo(() => preview?.issues ?? [], [preview])

  const validationState = useMemo(
    () =>
      deriveMatchWizardValidationState({
        canValidate: canProceedToPreview,
        validationLoading: previewLoading,
        validationUpToDate: previewUpToDate,
        validationError: previewError,
        preview,
      }),
    [canProceedToPreview, preview, previewError, previewLoading, previewUpToDate],
  )

  const validationStatus = useMemo(() => {
    switch (validationState) {
      case "valid":
        return {
          className: "border-emerald-200 bg-emerald-50 text-emerald-900",
          title: "Preview ready",
          message: "Review looks clear. You can submit this match.",
          summary: "Preview complete. No blocking issues found.",
        }
      case "warning":
        return {
          className: "border-amber-200 bg-amber-50 text-amber-900",
          title: "Preview found warnings",
          message: "Submit is still allowed, but review the warnings first.",
          summary: "Preview complete with warnings. Submit is still allowed.",
        }
      case "error":
        return {
          className: "border-red-200 bg-red-50 text-red-700",
          title: "Preview found blocking issues",
          message: "Fix them before submitting.",
          summary: "Preview found blocking issues.",
        }
      case "stale":
        return {
          className: "border-amber-200 bg-amber-50 text-amber-900",
          title: "Preview is updating",
          message: "Refreshing after your latest edit.",
          summary: "Preview is updating after your latest changes.",
        }
      case "system_error":
        return {
          className: "border-red-200 bg-red-50 text-red-700",
          title: "Preview could not be loaded",
          message: "Try again.",
          summary: "Preview failed. Retry to continue.",
        }
      case "running":
        return {
          className: "border-primary-200 bg-primary-50 text-primary-900",
          title: "Refreshing preview",
          message: "Checking the current selection and allocations.",
          summary: "Preview is running.",
        }
      case "idle":
      default:
        return {
          className: "border-slate-200 bg-slate-50 text-slate-800",
          title: "Preview is waiting",
          message: previewBlockedReason ?? "It will start when selection and allocations are ready.",
          summary: previewBlockedReason ?? "Complete selection and allocation to start preview.",
        }
    }
  }, [previewBlockedReason, validationState])

  const runPreview = useCallback(async () => {
    const runVersion = allocationsVersion
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewVersion(null)
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/matches/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchType: effectiveType,
            lineIds: selectedLines.map(line => line.id),
            scheduleIds: selectedSchedules.map(schedule => schedule.id),
            allocations: allocationsPayload,
          }),
        },
      )
      const payload = await response.json().catch(() => null)
      const data = payload?.data as PreviewResponse | undefined
      if (!data) {
        throw new Error(payload?.error || "Failed to preview match")
      }
      setPreview(data)
      setPreviewVersion(runVersion)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setPreviewLoading(false)
    }
  }, [allocationsPayload, allocationsVersion, depositId, effectiveType, selectedLines, selectedSchedules])

  const openAllocationEditor = useCallback(() => {
    if (effectiveType === "ManyToOne" && !bundleAuditLogId) {
      setManyToOneMode("allocation")
      setAllocationExpanded(current => (manyToOneMode === "allocation" ? !current : true))
      return
    }
    setAllocationExpanded(prev => !prev)
  }, [bundleAuditLogId, effectiveType, manyToOneMode])

  const openBundleEditor = useCallback(() => {
    setManyToOneMode("bundle")
    setAllocationExpanded(current => (manyToOneMode === "bundle" ? !current : true))
  }, [manyToOneMode])

  useEffect(() => {
    if (!isOpen) return
    if (!canProceedToPreview) return

    const requestKey = `${previewInputsKey}|${allocationsVersion}`
    if (autoPreviewRequestKeyRef.current === requestKey) return

    if (autoValidationTimeoutRef.current) {
      clearTimeout(autoValidationTimeoutRef.current)
    }

    autoValidationTimeoutRef.current = setTimeout(() => {
      autoPreviewRequestKeyRef.current = requestKey
      void runPreview()
      autoValidationTimeoutRef.current = null
    }, AUTO_VALIDATION_DEBOUNCE_MS)

    return () => {
      if (autoValidationTimeoutRef.current) {
        clearTimeout(autoValidationTimeoutRef.current)
        autoValidationTimeoutRef.current = null
      }
    }
  }, [allocationsVersion, canProceedToPreview, isOpen, previewInputsKey, runPreview])

  useEffect(() => {
    if (replacementRequired) setAllocationExpanded(true)
  }, [replacementRequired])

  useEffect(() => {
    if (!isOpen) return
    if (!replacementRequiredIssue || bundleAuditLogId) return
    setManyToOneMode("bundle")
    setBundleApplyMode("soft_delete_old")
  }, [bundleAuditLogId, isOpen, replacementRequiredIssue])

  const applyMatchGroup = async () => {
    setApplyLoading(true)
    setApplyError(null)
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/matches/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchType: effectiveType,
            lineIds: selectedLines.map(line => line.id),
            scheduleIds: selectedSchedules.map(schedule => schedule.id),
            allocations: allocationsPayload,
          }),
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const issues = payload?.issues as PreviewIssue[] | undefined
        const message = payload?.error || "Failed to apply match group"
        const issueText = issues?.length ? ` (${issues[0].message})` : ""
        throw new Error(`${message}${issueText}`)
      }
      const groupId = payload?.data?.group?.id as string | undefined
      if (!groupId) {
        throw new Error("Apply succeeded but no matchGroupId was returned.")
      }
      setAppliedMatchGroupId(groupId)
      onApplied?.()
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setApplyLoading(false)
    }
  }

  const undoMatchGroup = async () => {
    if (!appliedMatchGroupId) return
    setUndoLoading(true)
    setUndoError(null)
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/matches/${encodeURIComponent(appliedMatchGroupId)}/undo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: undoReason.trim() || null }),
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to undo match group")
      }
      setAppliedMatchGroupId(null)
      onApplied?.()
    } catch (err) {
      setUndoError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setUndoLoading(false)
    }
  }

  const applyBundleRipReplace = async () => {
    setBundleLoading(true)
    setBundleError(null)

    try {
      if (selectedLines.length < 2) {
        throw new Error("Bundle requires at least two deposit line items.")
      }
      if (selectedSchedules.length !== 1) {
        throw new Error("Bundle requires selecting exactly one schedule.")
      }

      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/bundle-rip-replace/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineIds: selectedLines.map(line => line.id),
            revenueScheduleId: selectedSchedules[0]!.id,
            mode: replacementRequired ? "soft_delete_old" : bundleApplyMode,
            reason: bundleApplyReason.trim() || null,
          }),
        },
      )

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create bundle schedules")
      }

      const bundleAuditLogId = payload?.data?.bundleAuditLogId as string | undefined
      const scheduleRows = payload?.data?.scheduleRows as SuggestedMatchScheduleRow[] | undefined
      const lineToScheduleMap = payload?.data?.lineToScheduleMap as Array<{ lineId: string; scheduleId: string }> | undefined

      if (!bundleAuditLogId || !Array.isArray(scheduleRows) || !Array.isArray(lineToScheduleMap)) {
        throw new Error("Bundle succeeded but returned an invalid response.")
      }

      setBundleAuditLogId(bundleAuditLogId)
      setWizardSchedules(scheduleRows)

      const nextAllocations: Record<string, AllocationDraft> = {}
      for (const mapping of lineToScheduleMap) {
        const line = selectedLines.find(item => item.id === mapping.lineId)
        if (!line) continue
        const usage = Math.max(0, Number(line.usageUnallocated ?? 0))
        const commission = Math.max(0, Number(line.commissionUnallocated ?? 0))
        nextAllocations[allocationKey(mapping.lineId, mapping.scheduleId)] = {
          usage: usage ? usage.toFixed(2) : "",
          commission: commission ? commission.toFixed(2) : "",
        }
      }

      skipAllocationResetRef.current = true
      setOverrideType("ManyToMany")
      setManyToOneMode("allocation")
      setAllocations(nextAllocations)
      setPreview(null)
      setPreviewVersion(null)
      setPreviewError(null)
      setAppliedMatchGroupId(null)
      onApplied?.()
    } catch (err) {
      setBundleError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setBundleLoading(false)
    }
  }

  const undoBundleRipReplace = async () => {
    if (!bundleAuditLogId) return
    setBundleUndoLoading(true)
    setBundleUndoError(null)

    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(depositId)}/bundle-rip-replace/${encodeURIComponent(bundleAuditLogId)}/undo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: bundleUndoReason.trim() || null }),
        },
      )

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to undo bundle operation")
      }

      setBundleAuditLogId(null)
      setWizardSchedules(initialSelectedSchedules)
      setBundleUndoReason("")
      skipAllocationResetRef.current = true
      setOverrideType(null)
      setManyToOneMode("allocation")
      setAllocations(
        buildDefaultAllocations({
          matchType: detectedType,
          lines: selectedLines,
          schedules: initialSelectedSchedules,
        }),
      )
      setPreview(null)
      setPreviewVersion(null)
      setPreviewError(null)
      setAppliedMatchGroupId(null)
      onApplied?.()
    } catch (err) {
      setBundleUndoError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setBundleUndoLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reconciliation match wizard"
        className="flex max-h-[90vh] w-full max-w-[1360px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <ModalHeader
          kicker="Reconciliation Match"
          title={`Match ${lineCount} line${lineCount === 1 ? "" : "s"} to ${scheduleCount} schedule${scheduleCount === 1 ? "" : "s"}`}
          variant="gradient"
        />

        <div className="flex-1 space-y-6 overflow-y-auto p-6 text-sm text-slate-700">
          <div className="space-y-3">
            <div className="space-y-3">
              <div className="flex items-end justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comparison layout</p>
                  <p className="text-base font-semibold text-slate-900">Selected deposit lines and target schedule preview</p>
                </div>
                <div className="flex shrink-0 items-center gap-x-4 text-sm">
                  <p><span className="font-medium text-slate-500">Match Type</span>{" "}<span className="font-semibold text-slate-900">{formatMatchType(effectiveType)}</span></p>
                  <span className="text-slate-300">·</span>
                  <p><span className="font-medium text-slate-500">Deposit Lines</span>{" "}<span className="font-semibold text-slate-900">{lineCount}</span></p>
                  <span className="text-slate-300">·</span>
                  <p><span className="font-medium text-slate-500">Schedules</span>{" "}<span className="font-semibold text-slate-900">{scheduleCount}</span></p>
                </div>
              </div>

              {!selectionCompatible ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <p className="font-semibold">Selection does not match the chosen type</p>
                  <p className="mt-1 text-xs">
                    You selected {lineCount} line{lineCount === 1 ? "" : "s"} and {scheduleCount} schedule
                    {scheduleCount === 1 ? "" : "s"}. Choose a compatible match type or adjust your selection.
                  </p>
                </div>
              ) : effectiveType === "ManyToMany" ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-800">
                  <p className="font-semibold">M:M is detected</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Review allocations carefully. Validation will warn on over/under tolerance before you apply.
                  </p>
                </div>
              ) : null}

              {selectionVarianceSummary ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                  <p className="font-semibold">Large total mismatch detected</p>
                  <p className="mt-1 text-xs">
                    Selected deposit totals and schedule totals are materially different. Review whether this should stay as
                    an edited allocation or move through the bundle/flex path before submitting.
                  </p>
                </div>
              ) : null}

              <div className="space-y-3">
                <MatchWizardSelectionTable
                  title={lineCount === 1 ? "Selected Deposit Line" : "Selected Deposit Lines"}
                  emptyLabel="No deposit line items were selected."
                  headers={[
                    "Account ID",
                    "Account",
                    "Product",
                    "Line",
                    "Act. Usage",
                    "Allocated",
                    "Unalloc.",
                    "Comm %",
                    "Act. Comm",
                    "Comm Alloc",
                  ]}
                  rows={selectedLineRows}
                />
                <div className="space-y-2">
                  <MatchWizardSelectionTable
                    title={scheduleCount === 1 ? "Target Revenue Schedule Preview" : "Target Revenue Schedules Preview"}
                    emptyLabel="No revenue schedules were selected."
                    headers={[
                      "Sched",
                      "Date",
                      "Qty",
                      "Price Each",
                      "Exp. Gross",
                      "Exp. Adj.",
                      "Exp. Net",
                      "Exp. Rate",
                      "Exp. Comm",
                      "Act. Usage",
                      "Act. Comm",
                      "Act. Rate",
                      "Usage Bal.",
                      "Comm Diff.",
                    ]}
                    rows={selectedScheduleRows}
                  />
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="whitespace-nowrap">
                        Selected line usage{" "}
                        <span className="font-semibold text-slate-900">
                          {currencyFormatter.format(selectionTotals.lineUsageTotal)}
                        </span>
                      </span>
                      <span className="whitespace-nowrap">
                        Selected line comm{" "}
                        <span className="font-semibold text-slate-900">
                          {currencyFormatter.format(selectionTotals.lineCommissionTotal)}
                        </span>
                      </span>
                      <span className="whitespace-nowrap">
                        Expected usage net{" "}
                        <span className="font-semibold text-slate-900">
                          {currencyFormatter.format(selectionTotals.scheduleExpectedUsage)}
                        </span>
                      </span>
                      <span className="whitespace-nowrap">
                        Expected comm net{" "}
                        <span className="font-semibold text-slate-900">
                          {currencyFormatter.format(selectionTotals.scheduleExpectedCommission)}
                        </span>
                      </span>
                    </div>
                  </div>
                  {previewLoading && !previewUpToDate ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Refreshing live preview...
                    </div>
                  ) : null}
                  {validationState !== "idle" &&
                  validationState !== "valid" &&
                  validationState !== "running" &&
                  !previewLoading ? (
                    <div className={cn("rounded-md border px-3 py-2.5 text-sm", validationStatus.className)}>
                      <p className="font-semibold">{validationStatus.title}</p>
                      <p className="mt-1">{validationStatus.message}</p>
                      {validationState === "system_error" && previewError ? (
                        <p className="mt-1 text-xs">{previewError}</p>
                      ) : null}
                      {previewUpToDate &&
                      (validationState === "warning" || validationState === "error") &&
                      validationIssues.length ? (
                        <>
                          {validationIssues.some(i => i.level === "error") ? (
                            <>
                              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-red-600">Errors</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                                {validationIssues.filter(i => i.level === "error").map((issue, idx) => (
                                  <li key={`err-${issue.code}-${idx}`} className="text-red-700">{issue.message}</li>
                                ))}
                              </ul>
                            </>
                          ) : null}
                          {validationIssues.some(i => i.level === "warning") ? (
                            <>
                              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-700">Warnings</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                                {validationIssues.filter(i => i.level === "warning").map((issue, idx) => (
                                  <li key={`warn-${issue.code}-${idx}`} className="text-amber-800">{issue.message}</li>
                                ))}
                              </ul>
                            </>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">Edit Allocation</p>
                <p className="text-xs text-slate-600">
                  {effectiveType === "ManyToOne" && !bundleAuditLogId
                    ? "Edit allocation is the primary path. Bundle stays available when this should break into replacement schedules."
                    : "Adjust allocations here before submitting the match."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {effectiveType === "ManyToOne" && !bundleAuditLogId ? (
                  <>
                    <button
                      type="button"
                      className={cn(
                        "rounded border px-2.5 py-1.5 text-xs font-semibold transition",
                        manyToOneMode === "allocation"
                          ? "border-primary-300 bg-primary-50 text-primary-800 hover:bg-primary-100"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      )}
                      onClick={openAllocationEditor}
                      disabled={replacementRequired}
                    >
                      Edit Allocation
                    </button>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">or</span>
                    <button
                      type="button"
                      className={cn(
                        "rounded border px-2.5 py-1.5 text-xs font-semibold transition",
                        manyToOneMode === "bundle"
                          ? "border-primary-300 bg-primary-50 text-primary-800 hover:bg-primary-100"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      )}
                      onClick={openBundleEditor}
                      disabled={bundleLoading}
                    >
                      Bundle
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={openAllocationEditor}
                  >
                    {allocationExpanded ? "Hide Allocation Editor" : "Edit Allocation"}
                  </button>
                )}
              </div>
            </div>

            {allocationExpanded ? (
              <>
                {!canProceedToAllocation ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    <p className="font-semibold">Allocation is blocked</p>
                    <p className="mt-1 text-xs">{selectionBlockedReason ?? "Fix selection above to continue."}</p>
                  </div>
                ) : null}

                <div className={cn("space-y-3", !canProceedToAllocation && "pointer-events-none opacity-50")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Allocation mode</p>
                  <p className="text-base font-semibold text-slate-900">{formatMatchType(effectiveType)}</p>
                  <p className="text-xs text-slate-600">Partial allocations are allowed.</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <p>
                    Allocation totals:{" "}
                    <span className="font-semibold">{currencyFormatter.format(allocationTotals.usage)}</span> usage,{" "}
                    <span className="font-semibold">{currencyFormatter.format(allocationTotals.commission)}</span>{" "}
                    commission
                  </p>
                </div>
              </div>

              {bundleAuditLogId && !appliedMatchGroupId ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                  <p className="font-semibold">Bundle created</p>
                  <p className="mt-1 text-xs">Audit ID: {bundleAuditLogId}</p>

                  <div className="mt-3 space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80">
                      Bundle undo reason (optional)
                    </label>
                    <input
                      className="w-full rounded border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-800"
                      value={bundleUndoReason}
                      onChange={e => setBundleUndoReason(e.target.value)}
                      disabled={bundleUndoLoading}
                      placeholder="Why are you undoing this bundle?"
                    />
                    {bundleUndoError ? <p className="text-xs font-semibold text-red-700">{bundleUndoError}</p> : null}
                    <button
                      type="button"
                      className="rounded border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void undoBundleRipReplace()}
                      disabled={bundleUndoLoading}
                    >
                      {bundleUndoLoading ? "Undoing bundle..." : "Undo bundle"}
                    </button>
                  </div>
                </div>
              ) : null}

              {false && effectiveType === "ManyToOne" && !bundleAuditLogId ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">M:1 Mode</p>
                  <div className="mt-2 flex flex-col gap-2 text-sm text-slate-800">
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="m1-mode"
                        checked={manyToOneMode === "allocation"}
                        onChange={() => setManyToOneMode("allocation")}
                        disabled={bundleLoading || replacementRequired}
                      />
                      <span>
                        <span className="font-semibold">Allocate</span>{" "}
                        <span className="text-xs text-slate-600">(multiple lines → one schedule)</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="m1-mode"
                        checked={manyToOneMode === "bundle"}
                        onChange={() => setManyToOneMode("bundle")}
                        disabled={bundleLoading}
                      />
                      <span>
                        <span className="font-semibold">Bundle (Rip &amp; Replace)</span>{" "}
                        <span className="text-xs text-slate-600">(create products/schedules for future auto-match)</span>
                      </span>
                    </label>
                  </div>
                </div>
              ) : null}

              {replacementRequired ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950">
                  <p className="font-semibold">Direct match blocked</p>
                  <p className="mt-1 text-sm">
                    {replacementRequiredIssue?.message ??
                      "You can't match this directly because the selected lines use different commission rates. Replace the bundle with individual schedules instead."}
                  </p>
                  <p className="mt-2 text-xs text-amber-900/80">
                    Confirming replacement creates one product and schedule series per deposit line, then retires the original bundled schedules and opportunity product.
                  </p>
                </div>
              ) : null}

              {replacementBlockedIssue ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
                  <p className="font-semibold">Replacement blocked</p>
                  <p className="mt-1 text-sm">{replacementBlockedIssue.message}</p>
                </div>
              ) : null}

              {effectiveType === "ManyToOne" && manyToOneMode === "bundle" && !bundleAuditLogId ? (
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="font-semibold text-slate-900">
                    {replacementRequired ? "Replace bundled setup" : "Rip &amp; Replace bundle"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {replacementRequired
                      ? "Creates individual products and schedule series from the selected deposit lines, then switches this wizard into a line-to-schedule allocation against the new replacement schedules."
                      : "Creates new products + schedules starting from the selected schedule date, then switches this wizard into an M:M allocation against the newly created schedules."}
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {replacementRequired ? (
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Cleanup
                        </label>
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          Retire original bundle schedules and deactivate the bundled opportunity product.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Replace mode
                        </label>
                        <select
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
                          value={bundleApplyMode}
                          onChange={e =>
                            setBundleApplyMode(e.target.value === "soft_delete_old" ? "soft_delete_old" : "keep_old")
                          }
                          disabled={bundleLoading}
                        >
                          <option value="keep_old">Keep old schedules (no deletion)</option>
                          <option value="soft_delete_old">Soft-delete unreconciled old schedules</option>
                        </select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Reason {replacementRequired ? "(required for audit)" : "(optional)"}
                      </label>
                      <input
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
                        value={bundleApplyReason}
                        onChange={e => setBundleApplyReason(e.target.value)}
                        disabled={bundleLoading}
                        placeholder="Why create this bundle?"
                      />
                    </div>
                  </div>

                  {bundleError ? <p className="mt-2 text-sm font-semibold text-red-600">{bundleError}</p> : null}

                  <button
                    type="button"
                    className="mt-3 rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    onClick={() => void applyBundleRipReplace()}
                    disabled={bundleLoading || (replacementRequired && bundleApplyReason.trim().length === 0)}
                  >
                    {bundleLoading
                      ? "Creating replacement..."
                      : replacementRequired
                        ? "Confirm replacement"
                        : "Create bundle schedules"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {allocationRows.map(row => (
                    <div key={row.key} className="rounded-md border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-[220px]">
                          <p className="font-semibold text-slate-900">{row.label}</p>
                          {effectiveType === "OneToMany" || effectiveType === "ManyToMany" ? (
                            <p className="text-xs text-slate-600">
                              Expected: {currencyFormatter.format(row.expectedUsageNet)} usage /{" "}
                              {currencyFormatter.format(row.expectedCommissionNet)} commission
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Usage
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-32 rounded border border-slate-200 px-2 py-1 text-sm text-slate-800"
                              value={row.usage}
                              onChange={e =>
                                setAllocations(prev => ({
                                  ...prev,
                                  [row.key]: { ...(prev[row.key] ?? { usage: "", commission: "" }), usage: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Commission
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-32 rounded border border-slate-200 px-2 py-1 text-sm text-slate-800"
                              value={row.commission}
                              onChange={e =>
                                setAllocations(prev => ({
                                  ...prev,
                                  [row.key]: {
                                    ...(prev[row.key] ?? { usage: "", commission: "" }),
                                    commission: e.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
              </>
            ) : null}
            </div>

          {applyError ? <p className="text-sm font-semibold text-red-600">{applyError}</p> : null}

              {appliedMatchGroupId ? (
                <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                  <p className="font-semibold">Applied successfully</p>
                  <p className="text-xs">Match Group ID: {appliedMatchGroupId}</p>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80">
                      Undo reason (optional)
                    </label>
                    <input
                      className="w-full rounded border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-800"
                      value={undoReason}
                      onChange={e => setUndoReason(e.target.value)}
                      disabled={undoLoading}
                      placeholder="Why are you undoing this match group?"
                    />
                    {undoError ? <p className="text-xs font-semibold text-red-700">{undoError}</p> : null}
                    <button
                      type="button"
                      className="rounded border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void undoMatchGroup()}
                      disabled={undoLoading}
                    >
                      {undoLoading ? "Undoing..." : "Undo Match Group"}
                    </button>
                  </div>
                </div>
              ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            onClick={() => void applyMatchGroup()}
            disabled={!canConfirmApply}
            title={applyBlockedReason ?? undefined}
          >
            {applyLoading ? "Submitting..." : appliedMatchGroupId ? "Applied" : "Submit Match"}
          </button>
        </div>
      </div>
    </div>
  )
}
