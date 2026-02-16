export interface RevenueScheduleCalculationInputs {
  quantity: number | null
  priceEach: number | null
  usageAdjustment: number | null
  expectedCommissionRatePercent: number | null // percent points (e.g. 12.34 => 12.34%)
  expectedCommissionAdjustment: number | null
}

export interface RevenueScheduleCalculationOutputs {
  expectedUsageGross: number | null
  expectedUsageNet: number | null
  expectedCommissionGross: number | null
  expectedCommissionNet: number | null
  expectedRateFraction: number | null
}

export function roundCurrency(value: number): number {
  // Avoid subtle floating point artifacts before persisting to Decimal(16,2).
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function normalizePercentPoints(value: number | null): number | null {
  if (value === null) return null
  if (!Number.isFinite(value)) return null
  // Store percent points, clamp to a reasonable range.
  return Math.max(0, Math.min(100, value))
}

export function percentPointsToFraction(value: number | null): number | null {
  if (value === null) return null
  if (!Number.isFinite(value)) return null
  return value / 100
}

export function computeExpectedScheduleValues(
  inputs: RevenueScheduleCalculationInputs
): RevenueScheduleCalculationOutputs {
  const qty = inputs.quantity
  const price = inputs.priceEach

  const expectedUsageGross =
    qty !== null &&
    price !== null &&
    Number.isFinite(qty) &&
    Number.isFinite(price)
      ? qty * price
      : null

  const usageAdj = inputs.usageAdjustment ?? 0
  const expectedUsageNet =
    expectedUsageGross !== null || inputs.usageAdjustment !== null
      ? (expectedUsageGross ?? 0) + (Number.isFinite(usageAdj) ? usageAdj : 0)
      : null

  const expectedRateFraction = percentPointsToFraction(inputs.expectedCommissionRatePercent)
  const expectedCommissionGross =
    expectedUsageGross !== null && expectedRateFraction !== null
      ? expectedUsageGross * expectedRateFraction
      : null

  const commissionAdj = inputs.expectedCommissionAdjustment ?? 0
  const expectedCommissionNet =
    expectedCommissionGross !== null || inputs.expectedCommissionAdjustment !== null
      ? (expectedCommissionGross ?? 0) + (Number.isFinite(commissionAdj) ? commissionAdj : 0)
      : null

  return {
    expectedUsageGross: expectedUsageGross !== null ? roundCurrency(expectedUsageGross) : null,
    expectedUsageNet: expectedUsageNet !== null ? roundCurrency(expectedUsageNet) : null,
    expectedCommissionGross: expectedCommissionGross !== null ? roundCurrency(expectedCommissionGross) : null,
    expectedCommissionNet: expectedCommissionNet !== null ? roundCurrency(expectedCommissionNet) : null,
    expectedRateFraction,
  }
}

