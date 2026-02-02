"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ModalHeader } from "./ui/modal-header"
import { cn } from "@/lib/utils"
import type { DepositLineItemRow, SuggestedMatchScheduleRow } from "@/lib/mock-data"
import type { MatchSelectionType } from "@/lib/matching/match-selection"
import { isSelectionCompatibleWithType } from "@/lib/matching/match-selection"

type MatchWizardStep = 0 | 1 | 2 | 3

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
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
  const [step, setStep] = useState<MatchWizardStep>(0)
  const [overrideType, setOverrideType] = useState<MatchSelectionType | null>(null)
  const [allocations, setAllocations] = useState<Record<string, AllocationDraft>>({})
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
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

  const selectedLines = props.selectedLines
  const selectedSchedules = wizardSchedules

  const lineCount = selectedLines.length
  const scheduleCount = selectedSchedules.length
  const effectiveType = overrideType ?? props.detectedType

  useEffect(() => {
    if (!props.open) return
    setStep(0)
    setOverrideType(null)
    setPreview(null)
    setPreviewLoading(false)
    setPreviewError(null)
    setApplyLoading(false)
    setApplyError(null)
    setAppliedMatchGroupId(null)
    setUndoReason("")
    setUndoLoading(false)
    setUndoError(null)
    setWizardSchedules(props.selectedSchedules)
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
    setAllocations(
      buildDefaultAllocations({
        matchType: props.detectedType,
        lines: selectedLines,
        schedules: props.selectedSchedules,
      }),
    )
  }, [props.open, props.detectedType, props.selectedLines, props.selectedSchedules, selectedLines])

  useEffect(() => {
    if (!props.open) return
    setPreview(null)
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
  }, [effectiveType, props.open, selectedLines, selectedSchedules])

  const selectionCompatible = useMemo(
    () => isSelectionCompatibleWithType({ type: effectiveType, lineCount, scheduleCount }),
    [effectiveType, lineCount, scheduleCount],
  )

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

  const stepMeta = useMemo(
    () => [
      { label: "Selection", description: "Review selection + detected match type" },
      { label: "Allocation", description: "Enter allocations (partial allocations allowed)" },
      { label: "Preview", description: "Validate + show deltas (tolerance warnings allowed)" },
      { label: "Apply", description: "Apply as one atomic action (match group)" },
    ],
    [],
  )

  const selectionBlockedReason = useMemo(() => {
    if (!selectionCompatible) return "Selection does not match match type."
    return null
  }, [effectiveType, selectionCompatible])

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
    effectiveType === "ManyToOne" && manyToOneMode === "bundle" && !bundleAuditLogId
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
    return Boolean(preview && preview.ok && !hasPreviewErrors && !applyLoading && !appliedMatchGroupId)
  }, [appliedMatchGroupId, applyLoading, hasPreviewErrors, preview])

  const runPreview = async () => {
    setPreviewLoading(true)
    setPreviewError(null)
    setPreview(null)
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(props.depositId)}/matches/preview`,
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
      if (!data.ok) {
        setPreviewError("Preview blocked by validation errors.")
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setPreviewLoading(false)
    }
  }

  const applyMatchGroup = async () => {
    setApplyLoading(true)
    setApplyError(null)
    try {
      const response = await fetch(
        `/api/reconciliation/deposits/${encodeURIComponent(props.depositId)}/matches/apply`,
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
      props.onApplied?.()
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
        `/api/reconciliation/deposits/${encodeURIComponent(props.depositId)}/matches/${encodeURIComponent(appliedMatchGroupId)}/undo`,
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
      props.onApplied?.()
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
        `/api/reconciliation/deposits/${encodeURIComponent(props.depositId)}/bundle-rip-replace/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineIds: selectedLines.map(line => line.id),
            revenueScheduleId: selectedSchedules[0]!.id,
            mode: bundleApplyMode,
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
      setPreviewError(null)
      setAppliedMatchGroupId(null)
      setStep(0)
      props.onApplied?.()
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
        `/api/reconciliation/deposits/${encodeURIComponent(props.depositId)}/bundle-rip-replace/${encodeURIComponent(bundleAuditLogId)}/undo`,
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
      setWizardSchedules(props.selectedSchedules)
      setBundleUndoReason("")
      skipAllocationResetRef.current = true
      setOverrideType(null)
      setManyToOneMode("allocation")
      setAllocations(
        buildDefaultAllocations({
          matchType: props.detectedType,
          lines: selectedLines,
          schedules: props.selectedSchedules,
        }),
      )
      setPreview(null)
      setPreviewError(null)
      setAppliedMatchGroupId(null)
      setStep(0)
      props.onApplied?.()
    } catch (err) {
      setBundleUndoError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setBundleUndoLoading(false)
    }
  }

  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4" onClick={props.onClose}>
      <div
        className="w-full max-w-2xl rounded-xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <ModalHeader kicker="Match Wizard" title={`Match ${lineCount} line${lineCount === 1 ? "" : "s"} to ${scheduleCount} schedule${scheduleCount === 1 ? "" : "s"}`} />

        <div className="border-b border-slate-200 px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {stepMeta.map((item, index) => {
              const isActive = index === step
              const isDone = index < step
              return (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                    isActive
                      ? "border-primary-300 bg-primary-50 text-primary-800"
                      : isDone
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  <span className="font-semibold">{item.label}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-slate-600">{stepMeta[step].description}</p>
        </div>

        <div className="space-y-4 p-6 text-sm text-slate-700">
          {step === 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detected match type</p>
                  <p className="text-base font-semibold text-slate-900">{formatMatchType(props.detectedType)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Override (optional)
                  </label>
                  <select
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
                    value={overrideType ?? "auto"}
                    onChange={e =>
                      setOverrideType(e.target.value === "auto" ? null : (e.target.value as MatchSelectionType))
                    }
                  >
                    <option value="auto">Auto</option>
                    <option value="OneToOne">1:1</option>
                    <option value="OneToMany">1:M</option>
                    <option value="ManyToOne">M:1</option>
                    <option value="ManyToMany">M:M</option>
                  </select>
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
                    Review allocations carefully. Preview will warn on over/under tolerance before you apply.
                  </p>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected lines</p>
                  <p className="mt-1 text-sm">
                    Usage total: <span className="font-semibold">{currencyFormatter.format(selectionTotals.lineUsageTotal)}</span>
                  </p>
                  <p className="text-sm">
                    Commission total:{" "}
                    <span className="font-semibold">{currencyFormatter.format(selectionTotals.lineCommissionTotal)}</span>
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected schedules</p>
                  <p className="mt-1 text-sm">
                    Expected usage net:{" "}
                    <span className="font-semibold">
                      {currencyFormatter.format(selectionTotals.scheduleExpectedUsage)}
                    </span>
                  </p>
                  <p className="text-sm">
                    Expected commission net:{" "}
                    <span className="font-semibold">
                      {currencyFormatter.format(selectionTotals.scheduleExpectedCommission)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-3">
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

              {effectiveType === "ManyToOne" && !bundleAuditLogId ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">M:1 Mode</p>
                  <div className="mt-2 flex flex-col gap-2 text-sm text-slate-800">
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="m1-mode"
                        checked={manyToOneMode === "allocation"}
                        onChange={() => setManyToOneMode("allocation")}
                        disabled={bundleLoading}
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

              {effectiveType === "ManyToOne" && manyToOneMode === "bundle" && !bundleAuditLogId ? (
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="font-semibold text-slate-900">Rip &amp; Replace bundle</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Creates new products + schedules starting from the selected schedule date, then switches this wizard
                    into an M:M allocation against the newly created schedules.
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Reason (optional)
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
                    disabled={bundleLoading}
                  >
                    {bundleLoading ? "Creating bundle..." : "Create bundle schedules"}
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
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">Preview</p>
                  <p className="text-xs text-slate-600">
                    Shows validation issues and what will change. Underpaid/overpaid warnings are allowed.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  onClick={() => void runPreview()}
                  disabled={previewLoading}
                >
                  {previewLoading ? "Previewing..." : "Run Preview"}
                </button>
              </div>

              {previewError ? <p className="text-sm font-semibold text-red-600">{previewError}</p> : null}

              {preview ? (
                <div className="space-y-3">
                  {"issues" in preview && preview.issues?.length ? (
                    <div className="rounded-md border border-slate-200 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issues</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                        {preview.issues.map((issue, idx) => (
                          <li
                            key={`${issue.code}-${idx}`}
                            className={issue.level === "error" ? "text-red-700" : "text-amber-800"}
                          >
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {preview.ok ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-slate-200 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lines after apply</p>
                        <ul className="mt-2 space-y-1 text-sm">
                          {preview.lines.map(line => (
                            <li key={line.lineId} className="flex items-center justify-between gap-2">
                              <span className="truncate">{line.lineId}</span>
                              <span className="tabular-nums">
                                {currencyFormatter.format(line.usageAllocatedAfter)} / {currencyFormatter.format(line.usage)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-md border border-slate-200 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Schedules after apply
                        </p>
                        <ul className="mt-2 space-y-2 text-sm">
                          {preview.schedules.map(schedule => (
                            <li key={schedule.scheduleId} className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate">{schedule.scheduleId}</span>
                                <span
                                  className={cn(
                                    "text-xs font-semibold",
                                    schedule.withinToleranceAfter ? "text-emerald-700" : "text-amber-800",
                                  )}
                                >
                                  {schedule.withinToleranceAfter ? "Within tolerance" : "Outside tolerance"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                                <span>
                                  Balance: {currencyFormatter.format(schedule.usageBalanceAfter)} usage /{" "}
                                  {currencyFormatter.format(schedule.commissionDifferenceAfter)} comm
                                </span>
                                <span>
                                  Actual: {currencyFormatter.format(schedule.actualUsageNetAfter)} usage /{" "}
                                  {currencyFormatter.format(schedule.actualCommissionNetAfter)} comm
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate-600">Run preview to validate before applying.</p>
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <p className="font-semibold text-slate-900">Apply</p>
              <p className="text-sm text-slate-600">
                Confirm will create a match group and write allocations as Applied matches. Undo reverts the whole group.
              </p>

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
              ) : (
                <button
                  type="button"
                  className="rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  onClick={() => void applyMatchGroup()}
                  disabled={!canConfirmApply}
                  title={
                    !preview
                      ? "Run preview first"
                      : hasPreviewErrors
                        ? "Fix preview errors before applying"
                        : undefined
                  }
                >
                  {applyLoading ? "Applying..." : "Confirm Apply"}
                </button>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={props.onClose}
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setStep(prev => (prev <= 0 ? prev : ((prev - 1) as MatchWizardStep)))}
              disabled={step === 0}
            >
              Back
            </button>
            {step < 3 ? (
              <button
                type="button"
                className="rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                onClick={() => setStep(prev => (prev >= 3 ? prev : ((prev + 1) as MatchWizardStep)))}
                disabled={step === 0 ? !canProceedToAllocation : step === 1 ? !canProceedToPreview : false}
                title={
                  step === 0 && selectionBlockedReason
                    ? selectionBlockedReason
                    : step === 1 && allocationRows.length === 0
                      ? "No allocation rows available"
                      : undefined
                }
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="rounded bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={true}
                title="Use the Confirm Apply button in the Apply step."
              >
                Confirm
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
