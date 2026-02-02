import { DepositLineItemStatus, DepositLineMatchStatus, Prisma, PrismaClient } from "@prisma/client"
import { getTenantVarianceTolerance } from "@/lib/matching/settings"
import type { MatchSelectionType } from "@/lib/matching/match-selection"

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

const EPSILON = 0.005

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

function isEffectivelyZero(value: number): boolean {
  return Math.abs(value) <= EPSILON
}

export type MatchGroupIssue = {
  level: "error" | "warning"
  code: string
  message: string
}

export type MatchGroupAllocationInput = {
  lineId: string
  scheduleId: string
  usageAmount?: number | null
  commissionAmount?: number | null
}

export type MatchGroupPreviewAllocation = {
  lineId: string
  scheduleId: string
  usageAmount: number
  commissionAmount: number
  existingMatchId: string | null
  existingApplied: boolean
}

export type MatchGroupPreviewLineSummary = {
  lineId: string
  status: string
  usage: number
  commission: number
  usageAllocatedBefore: number
  commissionAllocatedBefore: number
  usageAllocatedAfter: number
  commissionAllocatedAfter: number
  usageUnallocatedAfter: number
  commissionUnallocatedAfter: number
}

export type MatchGroupPreviewScheduleSummary = {
  scheduleId: string
  expectedUsageNet: number
  expectedCommissionNet: number
  actualUsageNetBefore: number
  actualCommissionNetBefore: number
  actualUsageNetAfter: number
  actualCommissionNetAfter: number
  usageBalanceAfter: number
  commissionDifferenceAfter: number
  withinToleranceAfter: boolean
}

export type MatchGroupPreviewResult =
  | {
      ok: true
      tenantVarianceTolerance: number
      matchType: MatchSelectionType
      lineIds: string[]
      scheduleIds: string[]
      normalizedAllocations: MatchGroupPreviewAllocation[]
      issues: MatchGroupIssue[]
      lines: MatchGroupPreviewLineSummary[]
      schedules: MatchGroupPreviewScheduleSummary[]
    }
  | {
      ok: false
      tenantVarianceTolerance: number
      matchType: MatchSelectionType
      issues: MatchGroupIssue[]
    }

function isSelectionCompatibleWithType(params: {
  matchType: MatchSelectionType
  lineCount: number
  scheduleCount: number
}): boolean {
  const { matchType, lineCount, scheduleCount } = params
  if (lineCount <= 0 || scheduleCount <= 0) return false
  switch (matchType) {
    case "OneToOne":
      return lineCount === 1 && scheduleCount === 1
    case "OneToMany":
      return lineCount === 1 && scheduleCount > 1
    case "ManyToOne":
      return lineCount > 1 && scheduleCount === 1
    case "ManyToMany":
      return lineCount > 1 && scheduleCount > 1
    default: {
      const exhaustiveCheck: never = matchType
      return exhaustiveCheck
    }
  }
}

function computeWithinTolerance(params: {
  expectedUsageNet: number
  expectedCommissionNet: number
  usageBalance: number
  commissionDifference: number
  varianceTolerance: number
}): boolean {
  const tolerance = Math.max(0, Math.min(params.varianceTolerance ?? 0, 1))
  const usageTolerance = Math.abs(params.expectedUsageNet) * tolerance
  const commissionTolerance = Math.abs(params.expectedCommissionNet) * tolerance
  return (
    Math.abs(params.usageBalance) <= Math.max(usageTolerance, EPSILON) &&
    Math.abs(params.commissionDifference) <= Math.max(commissionTolerance, EPSILON)
  )
}

function buildDefaultAllocations(params: {
  matchType: MatchSelectionType
  lines: Array<{
    id: string
    usageUnallocated: number
    commissionUnallocated: number
  }>
  schedules: Array<{
    id: string
    expectedUsageNet: number
    expectedCommissionNet: number
  }>
}): MatchGroupAllocationInput[] {
  if (params.matchType === "OneToMany") {
    const line = params.lines[0]
    const totalUsage = Math.max(0, toNumber(line?.usageUnallocated))
    const totalCommission = Math.max(0, toNumber(line?.commissionUnallocated))

    const scheduleWeights = params.schedules.map(schedule => ({
      scheduleId: schedule.id,
      weight: Math.max(0, Math.abs(toNumber(schedule.expectedUsageNet)) + Math.abs(toNumber(schedule.expectedCommissionNet))),
    }))
    const weightSum = scheduleWeights.reduce((acc, row) => acc + row.weight, 0)
    const denom = weightSum > EPSILON ? weightSum : scheduleWeights.length || 1

    let usageRemaining = totalUsage
    let commissionRemaining = totalCommission

    return scheduleWeights.map((row, index) => {
      const fraction = weightSum > EPSILON ? row.weight / denom : 1 / denom
      const isLast = index === scheduleWeights.length - 1
      const usage = isLast ? usageRemaining : roundMoney(totalUsage * fraction)
      const commission = isLast ? commissionRemaining : roundMoney(totalCommission * fraction)
      usageRemaining = roundMoney(usageRemaining - usage)
      commissionRemaining = roundMoney(commissionRemaining - commission)
      return {
        lineId: line.id,
        scheduleId: row.scheduleId,
        usageAmount: usage,
        commissionAmount: commission,
      }
    })
  }

  if (params.matchType === "ManyToOne") {
    const scheduleId = params.schedules[0]?.id
    if (!scheduleId) return []
    return params.lines.map(line => ({
      lineId: line.id,
      scheduleId,
      usageAmount: Math.max(0, toNumber(line.usageUnallocated)),
      commissionAmount: Math.max(0, toNumber(line.commissionUnallocated)),
    }))
  }

  return []
}

export async function buildMatchGroupPreview(
  client: PrismaClientOrTx,
  params: {
    tenantId: string
    depositId: string
    matchType: MatchSelectionType
    lineIds: string[]
    scheduleIds: string[]
    allocations?: MatchGroupAllocationInput[] | null
  },
): Promise<MatchGroupPreviewResult> {
  const tenantVarianceTolerance = await getTenantVarianceTolerance(params.tenantId)
  const issues: MatchGroupIssue[] = []

  const lineIds = Array.from(new Set((params.lineIds ?? []).map(id => id.trim()).filter(Boolean)))
  const scheduleIds = Array.from(new Set((params.scheduleIds ?? []).map(id => id.trim()).filter(Boolean)))

  if (params.matchType === "ManyToMany") {
    return {
      ok: false,
      tenantVarianceTolerance,
      matchType: params.matchType,
      issues: [
        {
          level: "error",
          code: "match_type_not_supported",
          message: "Many-to-many (M:M) matching is not supported yet for the wizard MVP.",
        },
      ],
    }
  }

  if (!isSelectionCompatibleWithType({ matchType: params.matchType, lineCount: lineIds.length, scheduleCount: scheduleIds.length })) {
    return {
      ok: false,
      tenantVarianceTolerance,
      matchType: params.matchType,
      issues: [
        {
          level: "error",
          code: "selection_mismatch",
          message: `Selection does not match matchType ${params.matchType} (lines=${lineIds.length}, schedules=${scheduleIds.length}).`,
        },
      ],
    }
  }

  const [lines, schedules] = await Promise.all([
    client.depositLineItem.findMany({
      where: { tenantId: params.tenantId, depositId: params.depositId, id: { in: lineIds } },
      select: {
        id: true,
        status: true,
        reconciled: true,
        usage: true,
        commission: true,
        usageAllocated: true,
        usageUnallocated: true,
        commissionAllocated: true,
        commissionUnallocated: true,
      },
    }),
    client.revenueSchedule.findMany({
      where: {
        tenantId: params.tenantId,
        id: { in: scheduleIds },
        deletedAt: null,
      } as any,
      select: {
        id: true,
        expectedUsage: true,
        usageAdjustment: true,
        actualUsageAdjustment: true,
        expectedCommission: true,
        actualCommissionAdjustment: true,
      },
    }),
  ])

  const foundLineIds = new Set(lines.map(row => row.id))
  const missingLines = lineIds.filter(id => !foundLineIds.has(id))
  if (missingLines.length) {
    issues.push({
      level: "error",
      code: "missing_line_items",
      message: `Some selected deposit line items could not be found: ${missingLines.join(", ")}`,
    })
  }

  const foundScheduleIds = new Set(schedules.map(row => row.id))
  const missingSchedules = scheduleIds.filter(id => !foundScheduleIds.has(id))
  if (missingSchedules.length) {
    issues.push({
      level: "error",
      code: "missing_schedules",
      message: `Some selected revenue schedules could not be found: ${missingSchedules.join(", ")}`,
    })
  }

  for (const line of lines) {
    if (line.reconciled) {
      issues.push({
        level: "error",
        code: "line_locked",
        message: `Line ${line.id} is reconciled and cannot be changed.`,
      })
    }
    if (line.status === DepositLineItemStatus.Ignored) {
      issues.push({
        level: "error",
        code: "line_ignored",
        message: `Line ${line.id} is ignored and cannot be allocated.`,
      })
    }
    const usage = toNumber(line.usage)
    const commission = toNumber(line.commission)
    if (usage < -EPSILON || commission < -EPSILON) {
      issues.push({
        level: "error",
        code: "negative_line_not_supported",
        message: `Line ${line.id} appears to be a chargeback/negative line. Use the Flex/chargeback flow instead of the multi-match wizard.`,
      })
    }
  }

  const scheduleMeta = schedules.map(schedule => {
    const expectedUsageNet = toNumber(schedule.expectedUsage) + toNumber(schedule.usageAdjustment)
    const expectedCommissionNet = toNumber(schedule.expectedCommission)
    const actualUsageAdjustment = toNumber(schedule.actualUsageAdjustment)
    const actualCommissionAdjustment = toNumber(schedule.actualCommissionAdjustment)
    return {
      id: schedule.id,
      expectedUsageNet,
      expectedCommissionNet,
      actualUsageAdjustment,
      actualCommissionAdjustment,
    }
  })

  const defaultAllocations = buildDefaultAllocations({
    matchType: params.matchType,
    lines: lines.map(line => ({
      id: line.id,
      usageUnallocated: toNumber(line.usageUnallocated ?? Math.max(0, toNumber(line.usage) - toNumber(line.usageAllocated))),
      commissionUnallocated: toNumber(line.commissionUnallocated ?? Math.max(0, toNumber(line.commission) - toNumber(line.commissionAllocated))),
    })),
    schedules: scheduleMeta.map(schedule => ({
      id: schedule.id,
      expectedUsageNet: schedule.expectedUsageNet,
      expectedCommissionNet: schedule.expectedCommissionNet,
    })),
  })

  const allocations = (params.allocations?.length ? params.allocations : defaultAllocations)
    .map(row => ({
      lineId: row.lineId?.trim(),
      scheduleId: row.scheduleId?.trim(),
      usageAmount: row.usageAmount == null ? 0 : roundMoney(toNumber(row.usageAmount)),
      commissionAmount: row.commissionAmount == null ? 0 : roundMoney(toNumber(row.commissionAmount)),
    }))
    .filter(row => row.lineId && row.scheduleId)

  if (allocations.length === 0) {
    issues.push({
      level: "error",
      code: "missing_allocations",
      message: "No allocations provided.",
    })
  }

  for (const allocation of allocations) {
    if (!foundLineIds.has(allocation.lineId)) {
      issues.push({
        level: "error",
        code: "allocation_invalid_line",
        message: `Allocation references unknown line ${allocation.lineId}.`,
      })
    }
    if (!foundScheduleIds.has(allocation.scheduleId)) {
      issues.push({
        level: "error",
        code: "allocation_invalid_schedule",
        message: `Allocation references unknown schedule ${allocation.scheduleId}.`,
      })
    }
    if (!Number.isFinite(allocation.usageAmount) || !Number.isFinite(allocation.commissionAmount)) {
      issues.push({
        level: "error",
        code: "allocation_invalid_amount",
        message: "Allocation amounts must be valid numbers.",
      })
    }
    if (allocation.usageAmount < -EPSILON || allocation.commissionAmount < -EPSILON) {
      issues.push({
        level: "error",
        code: "allocation_negative_amount",
        message: "Negative allocations are not supported in the multi-match wizard.",
      })
    }
  }

  const hasAnyNonZero = allocations.some(a => !isEffectivelyZero(a.usageAmount) || !isEffectivelyZero(a.commissionAmount))
  if (!hasAnyNonZero) {
    issues.push({
      level: "error",
      code: "allocation_all_zero",
      message: "At least one allocation amount must be non-zero.",
    })
  }

  const pairMatches = await client.depositLineMatch.findMany({
    where: {
      tenantId: params.tenantId,
      depositLineItemId: { in: lineIds },
      revenueScheduleId: { in: scheduleIds },
    },
    select: {
      id: true,
      depositLineItemId: true,
      revenueScheduleId: true,
      status: true,
      matchGroupId: true,
      usageAmount: true,
      commissionAmount: true,
      reconciled: true,
    },
  })

  const existingPairMap = new Map<string, (typeof pairMatches)[number]>()
  for (const match of pairMatches) {
    existingPairMap.set(`${match.depositLineItemId}:${match.revenueScheduleId}`, match)
  }

  // Disallow using this flow to "remove" a previously-applied allocation; use Unmatch for that.
  for (const allocation of allocations) {
    const key = `${allocation.lineId}:${allocation.scheduleId}`
    const existing = existingPairMap.get(key)
    if (
      existing &&
      existing.status === DepositLineMatchStatus.Applied &&
      isEffectivelyZero(allocation.usageAmount) &&
      isEffectivelyZero(allocation.commissionAmount)
    ) {
      issues.push({
        level: "error",
        code: "allocation_remove_not_supported",
        message: "Use Unmatch to remove existing allocations instead of setting them to 0 in the wizard.",
      })
    }
    if (existing?.reconciled) {
      issues.push({
        level: "error",
        code: "match_locked",
        message: "This allocation references an already-reconciled match and cannot be changed.",
      })
    }
    const changesExistingGroupedMatch =
      existing &&
      existing.status === DepositLineMatchStatus.Applied &&
      Boolean(existing.matchGroupId) &&
      (!isEffectivelyZero(allocation.usageAmount - toNumber(existing.usageAmount)) ||
        !isEffectivelyZero(allocation.commissionAmount - toNumber(existing.commissionAmount)))

    if (changesExistingGroupedMatch) {
      issues.push({
        level: "error",
        code: "match_group_conflict",
        message: "This allocation is already part of a match group and cannot be edited via the wizard yet.",
      })
    }
  }

  const appliedMatchesByLine = await client.depositLineMatch.findMany({
    where: {
      tenantId: params.tenantId,
      depositLineItemId: { in: lineIds },
      status: DepositLineMatchStatus.Applied,
    },
    select: {
      depositLineItemId: true,
      revenueScheduleId: true,
      usageAmount: true,
      commissionAmount: true,
    },
  })

  const appliedPairAmountMap = new Map<string, { usageAmount: number; commissionAmount: number }>()
  for (const match of appliedMatchesByLine) {
    appliedPairAmountMap.set(`${match.depositLineItemId}:${match.revenueScheduleId}`, {
      usageAmount: toNumber(match.usageAmount),
      commissionAmount: toNumber(match.commissionAmount),
    })
  }

  const lineAllocatedBefore = new Map<string, { usage: number; commission: number }>()
  for (const match of appliedMatchesByLine) {
    const key = match.depositLineItemId
    const previous = lineAllocatedBefore.get(key) ?? { usage: 0, commission: 0 }
    lineAllocatedBefore.set(key, {
      usage: previous.usage + toNumber(match.usageAmount),
      commission: previous.commission + toNumber(match.commissionAmount),
    })
  }

  const lineAllocationDeltas = new Map<string, { usage: number; commission: number }>()
  for (const allocation of allocations) {
    const key = `${allocation.lineId}:${allocation.scheduleId}`
    const oldApplied = appliedPairAmountMap.get(key) ?? { usageAmount: 0, commissionAmount: 0 }
    const deltaUsage = allocation.usageAmount - oldApplied.usageAmount
    const deltaCommission = allocation.commissionAmount - oldApplied.commissionAmount
    const existing = lineAllocationDeltas.get(allocation.lineId) ?? { usage: 0, commission: 0 }
    lineAllocationDeltas.set(allocation.lineId, {
      usage: existing.usage + deltaUsage,
      commission: existing.commission + deltaCommission,
    })
  }

  const lineSummaries: MatchGroupPreviewLineSummary[] = []
  for (const line of lines) {
    const usage = toNumber(line.usage)
    const commission = toNumber(line.commission)
    const before = lineAllocatedBefore.get(line.id) ?? { usage: 0, commission: 0 }
    const delta = lineAllocationDeltas.get(line.id) ?? { usage: 0, commission: 0 }
    const afterUsageAllocated = roundMoney(before.usage + delta.usage)
    const afterCommissionAllocated = roundMoney(before.commission + delta.commission)

    if (afterUsageAllocated > usage + EPSILON) {
      issues.push({
        level: "error",
        code: "line_over_allocated_usage",
        message: `Line ${line.id} usage allocations exceed the line usage total.`,
      })
    }
    if (afterCommissionAllocated > commission + EPSILON) {
      issues.push({
        level: "error",
        code: "line_over_allocated_commission",
        message: `Line ${line.id} commission allocations exceed the line commission total.`,
      })
    }

    lineSummaries.push({
      lineId: line.id,
      status: String(line.status),
      usage,
      commission,
      usageAllocatedBefore: roundMoney(before.usage),
      commissionAllocatedBefore: roundMoney(before.commission),
      usageAllocatedAfter: afterUsageAllocated,
      commissionAllocatedAfter: afterCommissionAllocated,
      usageUnallocatedAfter: roundMoney(Math.max(usage - afterUsageAllocated, 0)),
      commissionUnallocatedAfter: roundMoney(Math.max(commission - afterCommissionAllocated, 0)),
    })
  }

  const scheduleAggregates = await Promise.all(
    scheduleMeta.map(async schedule => {
      const aggregation = await client.depositLineMatch.aggregate({
        where: {
          tenantId: params.tenantId,
          revenueScheduleId: schedule.id,
          status: DepositLineMatchStatus.Applied,
        },
        _sum: { usageAmount: true, commissionAmount: true },
        _count: true,
      })
      const actualUsage = toNumber(aggregation._sum.usageAmount)
      const actualCommission = toNumber(aggregation._sum.commissionAmount)
      const matchCount = typeof aggregation._count === "number" ? aggregation._count : 0
      return { scheduleId: schedule.id, actualUsage, actualCommission, matchCount }
    }),
  )

  const scheduleBeforeMap = new Map<string, { actualUsage: number; actualCommission: number; matchCount: number }>()
  for (const row of scheduleAggregates) {
    scheduleBeforeMap.set(row.scheduleId, {
      actualUsage: row.actualUsage,
      actualCommission: row.actualCommission,
      matchCount: row.matchCount,
    })
  }

  const scheduleDeltaMap = new Map<string, { usage: number; commission: number }>()
  for (const allocation of allocations) {
    const key = `${allocation.lineId}:${allocation.scheduleId}`
    const oldApplied = appliedPairAmountMap.get(key) ?? { usageAmount: 0, commissionAmount: 0 }
    const existing = scheduleDeltaMap.get(allocation.scheduleId) ?? { usage: 0, commission: 0 }
    scheduleDeltaMap.set(allocation.scheduleId, {
      usage: existing.usage + (allocation.usageAmount - oldApplied.usageAmount),
      commission: existing.commission + (allocation.commissionAmount - oldApplied.commissionAmount),
    })
  }

  const scheduleSummaries: MatchGroupPreviewScheduleSummary[] = []
  for (const schedule of scheduleMeta) {
    const before = scheduleBeforeMap.get(schedule.id) ?? { actualUsage: 0, actualCommission: 0, matchCount: 0 }
    const delta = scheduleDeltaMap.get(schedule.id) ?? { usage: 0, commission: 0 }
    const afterActualUsage = roundMoney(before.actualUsage + delta.usage)
    const afterActualCommission = roundMoney(before.actualCommission + delta.commission)

    const expectedUsageNet = schedule.expectedUsageNet
    const expectedCommissionNet = schedule.expectedCommissionNet

    const actualUsageNetBefore = roundMoney(before.actualUsage + schedule.actualUsageAdjustment)
    const actualCommissionNetBefore = roundMoney(before.actualCommission + schedule.actualCommissionAdjustment)

    const actualUsageNetAfter = roundMoney(afterActualUsage + schedule.actualUsageAdjustment)
    const actualCommissionNetAfter = roundMoney(afterActualCommission + schedule.actualCommissionAdjustment)

    const usageBalanceAfter = roundMoney(expectedUsageNet - actualUsageNetAfter)
    const commissionDifferenceAfter = roundMoney(expectedCommissionNet - actualCommissionNetAfter)

    const withinToleranceAfter = computeWithinTolerance({
      expectedUsageNet,
      expectedCommissionNet,
      usageBalance: usageBalanceAfter,
      commissionDifference: commissionDifferenceAfter,
      varianceTolerance: tenantVarianceTolerance,
    })

    if (!withinToleranceAfter) {
      const level: MatchGroupIssue["level"] = "warning"
      const kind = usageBalanceAfter < -EPSILON || commissionDifferenceAfter < -EPSILON ? "overpaid" : "underpaid"
      issues.push({
        level,
        code: `schedule_${kind}`,
        message: `Schedule ${schedule.id} will be ${kind} after apply (outside tolerance).`,
      })
    }

    scheduleSummaries.push({
      scheduleId: schedule.id,
      expectedUsageNet: roundMoney(expectedUsageNet),
      expectedCommissionNet: roundMoney(expectedCommissionNet),
      actualUsageNetBefore,
      actualCommissionNetBefore,
      actualUsageNetAfter,
      actualCommissionNetAfter,
      usageBalanceAfter,
      commissionDifferenceAfter,
      withinToleranceAfter,
    })
  }

  const normalizedAllocations: MatchGroupPreviewAllocation[] = allocations.map(allocation => {
    const existing = existingPairMap.get(`${allocation.lineId}:${allocation.scheduleId}`)
    return {
      lineId: allocation.lineId,
      scheduleId: allocation.scheduleId,
      usageAmount: allocation.usageAmount,
      commissionAmount: allocation.commissionAmount,
      existingMatchId: existing?.id ?? null,
      existingApplied: existing?.status === DepositLineMatchStatus.Applied,
    }
  })

  const hasErrors = issues.some(issue => issue.level === "error")
  if (hasErrors) {
    return { ok: false, tenantVarianceTolerance, matchType: params.matchType, issues }
  }

  return {
    ok: true,
    tenantVarianceTolerance,
    matchType: params.matchType,
    lineIds,
    scheduleIds,
    normalizedAllocations,
    issues,
    lines: lineSummaries,
    schedules: scheduleSummaries,
  }
}
