export type DisplayValue = string | null | undefined

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

function getTrimmedNonBlankDisplayValue(value: DisplayValue): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed === "-" || trimmed === "--") return null
  return trimmed
}

export function isBlankDisplay(value: DisplayValue): boolean {
  return getTrimmedNonBlankDisplayValue(value) === null
}

export function parseCurrencyDisplay(value: DisplayValue): number | null {
  const trimmed = getTrimmedNonBlankDisplayValue(value)
  if (trimmed === null) return null
  const negativeParens = trimmed.startsWith("(") && trimmed.endsWith(")")
  const cleaned = trimmed.replace(/[^0-9.-]/g, "")
  const numeric = Number(cleaned)
  if (!Number.isFinite(numeric)) return null
  if (negativeParens) return numeric > 0 ? -numeric : numeric
  return numeric
}

export function parseNumberDisplay(value: DisplayValue): number | null {
  const trimmed = getTrimmedNonBlankDisplayValue(value)
  if (trimmed === null) return null
  const negativeParens = trimmed.startsWith("(") && trimmed.endsWith(")")
  const cleaned = trimmed.replace(/[^0-9.-]/g, "")
  const numeric = Number(cleaned)
  if (!Number.isFinite(numeric)) return null
  if (negativeParens) return numeric > 0 ? -numeric : numeric
  return numeric
}

// Returns a fraction (0.18) from "18%", "18", or "0.18".
export function parsePercentFractionDisplay(value: DisplayValue): number | null {
  const trimmed = getTrimmedNonBlankDisplayValue(value)
  if (trimmed === null) return null
  const negativeParens = trimmed.startsWith("(") && trimmed.endsWith(")")
  const cleaned = trimmed.replace(/[^0-9.-]/g, "")
  const numeric = Number(cleaned)
  if (!Number.isFinite(numeric)) return null

  const hasPercent = trimmed.includes("%")
  const absValue = Math.abs(numeric)
  const fraction = hasPercent ? numeric / 100 : absValue <= 1 ? numeric : numeric / 100
  if (negativeParens) return fraction > 0 ? -fraction : fraction
  return fraction
}

export function formatCurrencyUSD(value: number): string {
  return currencyFormatter.format(value)
}

export function formatPercentFraction(value: number): string {
  return percentFormatter.format(value)
}

export function formatSignedCurrencyDiff(
  value: number | null,
  options?: { nullDisplay?: string }
): string {
  if (value === null) return options?.nullDisplay ?? "--"
  if (!Number.isFinite(value) || value === 0) return formatCurrencyUSD(0)
  const formatted = formatCurrencyUSD(Math.abs(value))
  return value > 0 ? `+${formatted}` : `-${formatted}`
}

export function formatSignedPercentDiff(value: number | null, options?: { nullDisplay?: string }): string {
  if (value === null) return options?.nullDisplay ?? "--"
  if (!Number.isFinite(value) || value === 0) return "0.00%"
  const formatted = formatPercentFraction(Math.abs(value))
  return value > 0 ? `+${formatted}` : `-${formatted}`
}

export interface RevenueScheduleDisplayInputs {
  quantity?: DisplayValue
  priceEach?: DisplayValue
  expectedUsageGross?: DisplayValue
  expectedUsage?: DisplayValue
  expectedUsageAdjustment?: DisplayValue
  expectedUsageNet?: DisplayValue
  actualUsage?: DisplayValue

  expectedCommissionGross?: DisplayValue
  expectedCommissionAdjustment?: DisplayValue
  expectedCommissionNet?: DisplayValue
  actualCommission?: DisplayValue

  expectedCommissionRatePercent?: DisplayValue
  actualCommissionRatePercent?: DisplayValue
}

export interface RevenueScheduleComputedMetrics {
  expectedUsageGross: number | null
  expectedUsageNet: number | null
  actualUsage: number | null
  usageDifference: number | null

  expectedCommissionGross: number | null
  expectedCommissionNet: number | null
  actualCommission: number | null
  commissionDifference: number | null

  expectedRateFraction: number | null
  actualRateFraction: number | null
  commissionRateDifferenceFraction: number | null

  hasUsageInputs: boolean
  hasCommissionInputs: boolean
  hasActualUsage: boolean
  hasActualCommission: boolean
}

export interface RevenueScheduleNumericInputs {
  quantity?: number | null
  priceEach?: number | null
  expectedUsageGross?: number | null
  expectedUsageAdjustment?: number | null
  expectedUsageNet?: number | null
  actualUsage?: number | null

  expectedCommissionGross?: number | null
  expectedCommissionAdjustment?: number | null
  expectedCommissionNet?: number | null
  actualCommission?: number | null

  expectedRateFraction?: number | null
  actualRateFraction?: number | null
}

export function computeRevenueScheduleMetrics(inputs: RevenueScheduleNumericInputs): RevenueScheduleComputedMetrics {
  const hasUsageCalcInputs =
    inputs.quantity !== null && inputs.quantity !== undefined ||
    inputs.priceEach !== null && inputs.priceEach !== undefined ||
    inputs.expectedUsageGross !== null && inputs.expectedUsageGross !== undefined ||
    inputs.expectedUsageAdjustment !== null && inputs.expectedUsageAdjustment !== undefined

  const hasUsageInputs = hasUsageCalcInputs || (inputs.expectedUsageNet !== null && inputs.expectedUsageNet !== undefined)
  const expectedUsageGross =
    inputs.quantity !== null && inputs.quantity !== undefined && inputs.priceEach !== null && inputs.priceEach !== undefined
      ? inputs.quantity * inputs.priceEach
      : inputs.expectedUsageGross ?? null

  const expectedUsageNet = (() => {
    if (!hasUsageInputs) return null
    if (expectedUsageGross !== null || inputs.expectedUsageAdjustment !== null) {
      return (expectedUsageGross ?? 0) + (inputs.expectedUsageAdjustment ?? 0)
    }
    return inputs.expectedUsageNet ?? null
  })()

  const actualUsage = inputs.actualUsage ?? null
  const hasActualUsage = actualUsage !== null
  const usageDifference = expectedUsageNet !== null || actualUsage !== null ? (expectedUsageNet ?? 0) - (actualUsage ?? 0) : null

  const expectedRateFraction = inputs.expectedRateFraction ?? null
  const hasCommissionCalcInputs =
    inputs.expectedCommissionGross !== null && inputs.expectedCommissionGross !== undefined ||
    inputs.expectedCommissionAdjustment !== null && inputs.expectedCommissionAdjustment !== undefined ||
    expectedRateFraction !== null

  const hasCommissionInputs =
    hasCommissionCalcInputs ||
    (inputs.expectedCommissionNet !== null && inputs.expectedCommissionNet !== undefined) ||
    (inputs.actualCommission !== null && inputs.actualCommission !== undefined)

  // Locked contract: expected commission is based on usage gross (qty * price), not usage net.
  const expectedCommissionGross =
    inputs.expectedCommissionGross ??
    (expectedUsageGross !== null && expectedRateFraction !== null
      ? expectedUsageGross * expectedRateFraction
      : (inputs.expectedCommissionNet ?? null))

  const expectedCommissionNet = (() => {
    if (!hasCommissionInputs) return null
    if (expectedCommissionGross !== null || inputs.expectedCommissionAdjustment !== null) {
      return (expectedCommissionGross ?? 0) + (inputs.expectedCommissionAdjustment ?? 0)
    }
    return inputs.expectedCommissionNet ?? null
  })()

  const actualCommission = inputs.actualCommission ?? null
  const hasActualCommission = actualCommission !== null
  const commissionDifference =
    expectedCommissionNet !== null || actualCommission !== null
      ? (expectedCommissionNet ?? 0) - (actualCommission ?? 0)
      : null

  const actualRateFractionDerived =
    actualUsage !== null && actualUsage !== 0 && actualCommission !== null ? actualCommission / actualUsage : null
  const actualRateFraction = (inputs.actualRateFraction ?? null) ?? actualRateFractionDerived

  const commissionRateDifferenceFraction =
    expectedRateFraction !== null && actualRateFraction !== null ? expectedRateFraction - actualRateFraction : null

  return {
    expectedUsageGross,
    expectedUsageNet,
    actualUsage,
    usageDifference,
    expectedCommissionGross,
    expectedCommissionNet,
    actualCommission,
    commissionDifference,
    expectedRateFraction,
    actualRateFraction,
    commissionRateDifferenceFraction,
    hasUsageInputs,
    hasCommissionInputs,
    hasActualUsage,
    hasActualCommission
  }
}

export function computeRevenueScheduleMetricsFromDisplay(
  inputs: RevenueScheduleDisplayInputs
): RevenueScheduleComputedMetrics {
  const numericExpectedUsageGross =
    parseCurrencyDisplay(inputs.expectedUsageGross) ?? parseCurrencyDisplay(inputs.expectedUsage)

  const baseline = computeRevenueScheduleMetrics({
    quantity: parseNumberDisplay(inputs.quantity),
    priceEach: parseCurrencyDisplay(inputs.priceEach),
    expectedUsageGross: numericExpectedUsageGross,
    expectedUsageAdjustment: parseCurrencyDisplay(inputs.expectedUsageAdjustment),
    expectedUsageNet: parseCurrencyDisplay(inputs.expectedUsageNet),
    actualUsage: parseCurrencyDisplay(inputs.actualUsage),
    expectedCommissionGross: parseCurrencyDisplay(inputs.expectedCommissionGross),
    expectedCommissionAdjustment: parseCurrencyDisplay(inputs.expectedCommissionAdjustment),
    expectedCommissionNet: parseCurrencyDisplay(inputs.expectedCommissionNet),
    actualCommission: parseCurrencyDisplay(inputs.actualCommission),
    expectedRateFraction: null,
    actualRateFraction: parsePercentFractionDisplay(inputs.actualCommissionRatePercent)
  })

  const expectedRateFromField = parsePercentFractionDisplay(inputs.expectedCommissionRatePercent)
  const expectedRateDerived =
    expectedRateFromField ??
    (baseline.expectedUsageNet !== null &&
    baseline.expectedUsageNet !== 0 &&
    baseline.expectedCommissionNet !== null
      ? baseline.expectedCommissionNet / baseline.expectedUsageNet
      : null)

  if (expectedRateDerived === null) {
    return baseline
  }

  return computeRevenueScheduleMetrics({
    quantity: parseNumberDisplay(inputs.quantity),
    priceEach: parseCurrencyDisplay(inputs.priceEach),
    expectedUsageGross: numericExpectedUsageGross,
    expectedUsageAdjustment: parseCurrencyDisplay(inputs.expectedUsageAdjustment),
    expectedUsageNet: parseCurrencyDisplay(inputs.expectedUsageNet),
    actualUsage: parseCurrencyDisplay(inputs.actualUsage),
    expectedCommissionGross: parseCurrencyDisplay(inputs.expectedCommissionGross),
    expectedCommissionAdjustment: parseCurrencyDisplay(inputs.expectedCommissionAdjustment),
    expectedCommissionNet: parseCurrencyDisplay(inputs.expectedCommissionNet),
    actualCommission: parseCurrencyDisplay(inputs.actualCommission),
    expectedRateFraction: expectedRateDerived,
    actualRateFraction: parsePercentFractionDisplay(inputs.actualCommissionRatePercent)
  })
}
