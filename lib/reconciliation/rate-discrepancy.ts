const DEFAULT_RATE_DISCREPANCY_TOLERANCE_PERCENT = Number(
  process.env.DEFAULT_RATE_DISCREPANCY_TOLERANCE_PERCENT ?? 0.05,
)

const EPSILON = 0.005

function toNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

export function normalizeRatePercent(value: unknown): number | null {
  if (value == null) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return Math.abs(numeric) <= 1.5 ? numeric * 100 : numeric
}

export function deriveReceivedRatePercent({
  usageAmount,
  commissionAmount,
}: {
  usageAmount: unknown
  commissionAmount: unknown
}): number | null {
  const usage = toNumber(usageAmount)
  const commission = toNumber(commissionAmount)
  if (Math.abs(usage) <= EPSILON) return null
  return Number(((commission / usage) * 100).toFixed(4))
}

export function normalizeRateDiscrepancyTolerancePercent(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return DEFAULT_RATE_DISCREPANCY_TOLERANCE_PERCENT
  return Math.min(numeric, 100)
}

export function getDefaultRateDiscrepancyTolerancePercent() {
  return DEFAULT_RATE_DISCREPANCY_TOLERANCE_PERCENT
}

export function buildRateDiscrepancySummary({
  expectedRatePercent,
  receivedRatePercent,
  tolerancePercent,
}: {
  expectedRatePercent: number | null
  receivedRatePercent: number | null
  tolerancePercent: number
}) {
  if (expectedRatePercent == null || receivedRatePercent == null) return null

  const normalizedTolerance = normalizeRateDiscrepancyTolerancePercent(tolerancePercent)
  const differencePercent = Number((receivedRatePercent - expectedRatePercent).toFixed(4))
  const absoluteDifferencePercent = Math.abs(differencePercent)

  return {
    expectedRatePercent: Number(expectedRatePercent.toFixed(4)),
    receivedRatePercent: Number(receivedRatePercent.toFixed(4)),
    differencePercent,
    absoluteDifferencePercent: Number(absoluteDifferencePercent.toFixed(4)),
    tolerancePercent: normalizedTolerance,
    isMaterial: absoluteDifferencePercent > normalizedTolerance + EPSILON,
    direction:
      differencePercent > normalizedTolerance + EPSILON
        ? ("higher" as const)
        : differencePercent < -(normalizedTolerance + EPSILON)
          ? ("lower" as const)
          : null,
  }
}

export function isUsageWithinTolerance({
  expectedUsageNet,
  usageBalance,
  varianceTolerance,
}: {
  expectedUsageNet: number
  usageBalance: number
  varianceTolerance: number
}) {
  const normalizedTolerance = Math.max(0, Math.min(Number(varianceTolerance) || 0, 1))
  const usageToleranceAmount = Math.max(Math.abs(expectedUsageNet) * normalizedTolerance, EPSILON)
  return Math.abs(usageBalance) <= usageToleranceAmount + EPSILON
}
