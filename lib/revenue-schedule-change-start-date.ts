import { formatDateOnlyUtc } from "@/lib/date-only"
import {
  diffMonthsUtc,
  parseDateInputToUtcDate,
  shiftScheduleDateMonthStartUtc,
  toMonthStartUtc,
} from "@/lib/revenue-schedule-date-shift"

export type ChangeStartDateScheduleInput = {
  id: string
  scheduleNumber: string | null
  scheduleDate: Date | null
  opportunityProductId: string | null
  productNameVendor: string | null
  distributorName: string | null
  vendorName: string | null
  opportunityName: string | null
  actualUsage: number | null
  actualCommission: number | null
  scheduleStatus: string | null
  billingStatus: string | null
}

export type ChangeStartDateExistingSchedule = {
  id: string
  scheduleNumber: string | null
  scheduleDate: Date
}

export type ChangeStartDatePreviewRow = {
  id: string
  scheduleNumber: string | null
  currentDate: string | null
  newDate: string | null
  status: "ready" | "collision"
  productNameVendor: string | null
  distributorName: string | null
  vendorName: string | null
  opportunityName: string | null
  conflicts: string[]
}

export type ChangeStartDatePreview = {
  selectedCount: number
  opportunityProductId: string | null
  baselineDate: string | null
  newStartDate: string | null
  deltaMonths: number | null
  canApply: boolean
  blockingReasons: string[]
  conflictSummaries: string[]
  rows: ChangeStartDatePreviewRow[]
}

export type CanSubmitChangeStartDateArgs = {
  selectedCount: number
  hasNewStartDate: boolean
  reason: string
  preview: Pick<ChangeStartDatePreview, "canApply"> | null
  previewLoading: boolean
  previewError: string | null
}

type LoadExistingSchedulesForDates = (args: {
  opportunityProductId: string
  selectedScheduleIds: string[]
  proposedDates: Date[]
}) => Promise<ChangeStartDateExistingSchedule[]>

type BuildChangeStartDatePreviewArgs = {
  selectedSchedules: ChangeStartDateScheduleInput[]
  newStartDateText: string
  reason?: string | null
  requireReason?: boolean
  loadExistingSchedulesForDates: LoadExistingSchedulesForDates
}

type MutablePreviewRow = ChangeStartDatePreviewRow & {
  currentDateObject: Date | null
  newDateObject: Date | null
}

const MATCHED_EPSILON = 0.0001

function normalizeScheduleReference(scheduleNumber: string | null | undefined) {
  const trimmed = scheduleNumber?.trim()
  return trimmed && trimmed.length > 0 ? `Revenue Schedule ${trimmed}` : "This revenue schedule"
}

function normalizeExternalScheduleReference(scheduleNumber: string | null | undefined) {
  const trimmed = scheduleNumber?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : "another schedule"
}

function normalizeSelectedScheduleReference(scheduleNumber: string | null | undefined) {
  const trimmed = scheduleNumber?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : "another selected schedule"
}

function isMonthStartDate(value: Date) {
  return value.getUTCDate() === 1
}

function hasMatchedAmounts(schedule: ChangeStartDateScheduleInput) {
  const actualUsage = typeof schedule.actualUsage === "number" ? schedule.actualUsage : 0
  const actualCommission = typeof schedule.actualCommission === "number" ? schedule.actualCommission : 0
  return Math.abs(actualUsage) > MATCHED_EPSILON || Math.abs(actualCommission) > MATCHED_EPSILON
}

function getBlockedScheduleReason(schedule: ChangeStartDateScheduleInput) {
  const reference = normalizeScheduleReference(schedule.scheduleNumber)
  const billingStatus = schedule.billingStatus?.trim().toLowerCase() ?? ""
  const scheduleStatus = schedule.scheduleStatus?.trim().toLowerCase() ?? ""

  if (billingStatus === "indispute" || scheduleStatus === "in dispute") {
    return `${reference} is in dispute and cannot be shifted.`
  }

  if (billingStatus === "reconciled" || scheduleStatus === "reconciled") {
    return `${reference} is finalized and cannot be shifted.`
  }

  if (hasMatchedAmounts(schedule)) {
    return `${reference} is already matched and cannot be shifted.`
  }

  return null
}

function sortPreviewRows(a: MutablePreviewRow, b: MutablePreviewRow) {
  const aTime = a.currentDateObject?.getTime() ?? Number.MAX_SAFE_INTEGER
  const bTime = b.currentDateObject?.getTime() ?? Number.MAX_SAFE_INTEGER
  if (aTime !== bTime) return aTime - bTime

  const aNumber = a.scheduleNumber?.trim() ?? ""
  const bNumber = b.scheduleNumber?.trim() ?? ""
  return aNumber.localeCompare(bNumber)
}

export function canSubmitChangeStartDate({
  selectedCount,
  hasNewStartDate,
  reason,
  preview,
  previewLoading,
  previewError,
}: CanSubmitChangeStartDateArgs) {
  return Boolean(
    selectedCount > 0 &&
    hasNewStartDate &&
    reason.trim().length > 0 &&
    preview &&
    preview.canApply &&
    !previewLoading &&
    !previewError
  )
}

export async function buildChangeStartDatePreview({
  selectedSchedules,
  newStartDateText,
  reason,
  requireReason = false,
  loadExistingSchedulesForDates,
}: BuildChangeStartDatePreviewArgs): Promise<ChangeStartDatePreview> {
  const blockingReasons: string[] = []
  const rows: MutablePreviewRow[] = selectedSchedules.map(schedule => {
    const currentDate = schedule.scheduleDate && !Number.isNaN(schedule.scheduleDate.getTime())
      ? toMonthStartUtc(schedule.scheduleDate)
      : null

    return {
      id: schedule.id,
      scheduleNumber: schedule.scheduleNumber?.trim() || null,
      currentDate: currentDate ? formatDateOnlyUtc(currentDate) : null,
      newDate: null,
      status: "ready",
      productNameVendor: schedule.productNameVendor ?? null,
      distributorName: schedule.distributorName ?? null,
      vendorName: schedule.vendorName ?? null,
      opportunityName: schedule.opportunityName ?? null,
      conflicts: [],
      currentDateObject: currentDate,
      newDateObject: null,
    }
  })

  if (selectedSchedules.length === 0) {
    blockingReasons.push("Select at least one revenue schedule.")
  }

  const opportunityProductIds = new Set<string>()
  let missingOpportunityProductCount = 0
  const blockedScheduleReasons: string[] = []
  const missingDateScheduleIds: string[] = []
  const nonNormalizedDateScheduleIds: string[] = []

  for (const schedule of selectedSchedules) {
    if (schedule.opportunityProductId) {
      opportunityProductIds.add(schedule.opportunityProductId)
    } else {
      missingOpportunityProductCount += 1
    }

    const blockedReason = getBlockedScheduleReason(schedule)
    if (blockedReason) {
      blockedScheduleReasons.push(blockedReason)
    }

    if (!schedule.scheduleDate || Number.isNaN(schedule.scheduleDate.getTime())) {
      missingDateScheduleIds.push(schedule.id)
      continue
    }

    if (!isMonthStartDate(schedule.scheduleDate)) {
      nonNormalizedDateScheduleIds.push(schedule.id)
    }
  }

  if (missingOpportunityProductCount > 0) {
    blockingReasons.push("Each selected schedule must belong to an opportunity product chain before it can be shifted.")
  }

  if (opportunityProductIds.size > 1) {
    blockingReasons.push("All selected schedules must belong to the same opportunity product chain.")
  }

  if (missingDateScheduleIds.length > 0) {
    blockingReasons.push("Some selected schedules are missing schedule dates and cannot be shifted.")
  }

  if (nonNormalizedDateScheduleIds.length > 0) {
    blockingReasons.push("Some selected schedules have non-normalized schedule dates and cannot be shifted.")
  }

  blockingReasons.push(...blockedScheduleReasons)

  const trimmedNewStartDate = newStartDateText.trim()
  const parsedNewStartDate = trimmedNewStartDate ? parseDateInputToUtcDate(trimmedNewStartDate) : null
  const newStartDate = parsedNewStartDate ? toMonthStartUtc(parsedNewStartDate) : null

  if (!newStartDate) {
    blockingReasons.push("Enter a valid new start date.")
  }

  if (requireReason && !(reason ?? "").trim()) {
    blockingReasons.push("Enter a reason to continue.")
  }

  const baselineDateObject = rows
    .map(row => row.currentDateObject)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null

  const deltaMonths =
    baselineDateObject && newStartDate
      ? diffMonthsUtc(baselineDateObject, newStartDate)
      : null

  if (deltaMonths !== null) {
    for (const row of rows) {
      if (!row.currentDateObject) continue
      const shifted = shiftScheduleDateMonthStartUtc(row.currentDateObject, deltaMonths)
      row.newDateObject = shifted
      row.newDate = formatDateOnlyUtc(shifted)
    }
  }

  const internalCollisionBuckets = new Map<string, MutablePreviewRow[]>()
  for (const row of rows) {
    if (!row.newDate) continue
    const existing = internalCollisionBuckets.get(row.newDate) ?? []
    existing.push(row)
    internalCollisionBuckets.set(row.newDate, existing)
  }

  for (const [date, bucket] of internalCollisionBuckets.entries()) {
    if (bucket.length < 2) continue
    for (const row of bucket) {
      const otherReferences = bucket
        .filter(candidate => candidate.id !== row.id)
        .map(candidate => normalizeSelectedScheduleReference(candidate.scheduleNumber))

      const message = `${date} conflicts with another selected schedule (${otherReferences.join(", ")}) for this product.`
      row.conflicts.push(message)
      row.status = "collision"
    }
  }

  const singleOpportunityProductId =
    opportunityProductIds.size === 1
      ? Array.from(opportunityProductIds)[0] ?? null
      : null

  const hasStructuralIssues =
    !singleOpportunityProductId ||
    !newStartDate ||
    missingOpportunityProductCount > 0 ||
    opportunityProductIds.size > 1 ||
    missingDateScheduleIds.length > 0 ||
    nonNormalizedDateScheduleIds.length > 0

  if (!hasStructuralIssues) {
    const proposedDates = rows
      .map(row => row.newDateObject)
      .filter((value): value is Date => Boolean(value))

    if (proposedDates.length > 0) {
      const existingSchedules = await loadExistingSchedulesForDates({
        opportunityProductId: singleOpportunityProductId,
        selectedScheduleIds: rows.map(row => row.id),
        proposedDates,
      })

      const externalCollisionsByDate = new Map<string, ChangeStartDateExistingSchedule[]>()
      for (const schedule of existingSchedules) {
        if (Number.isNaN(schedule.scheduleDate.getTime())) continue
        const key = formatDateOnlyUtc(toMonthStartUtc(schedule.scheduleDate))
        const bucket = externalCollisionsByDate.get(key) ?? []
        bucket.push(schedule)
        externalCollisionsByDate.set(key, bucket)
      }

      for (const row of rows) {
        if (!row.newDate) continue
        const collisions = externalCollisionsByDate.get(row.newDate) ?? []
        if (collisions.length === 0) continue

        const references = collisions.map(schedule => normalizeExternalScheduleReference(schedule.scheduleNumber))
        const message = `${row.newDate} conflicts with an existing schedule (${references.join(", ")}) for this product.`
        row.conflicts.push(message)
        row.status = "collision"
      }
    }
  }

  const conflictSummaries = Array.from(
    new Set(rows.flatMap(row => row.conflicts))
  )

  const normalizedRows = rows
    .sort(sortPreviewRows)
    .map(({ currentDateObject: _currentDateObject, newDateObject: _newDateObject, ...row }) => row)

  return {
    selectedCount: selectedSchedules.length,
    opportunityProductId: singleOpportunityProductId,
    baselineDate: baselineDateObject ? formatDateOnlyUtc(baselineDateObject) : null,
    newStartDate: newStartDate ? formatDateOnlyUtc(newStartDate) : null,
    deltaMonths,
    canApply: blockingReasons.length === 0 && normalizedRows.length > 0 && normalizedRows.every(row => row.status === "ready"),
    blockingReasons,
    conflictSummaries,
    rows: normalizedRows,
  }
}
