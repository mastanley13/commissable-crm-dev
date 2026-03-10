const RATE_EPSILON = 0.0001

export function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

export function normalizeRateFraction(value: number): number {
  return Math.round(value * 10000) / 10000
}

function normalizeRateInputToFraction(value: number): number {
  if (!Number.isFinite(value)) return value
  return Math.abs(value) > 1 ? value / 100 : value
}

export function formatRatePercentFromFraction(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "unknown"
  return `${(normalizeRateFraction(normalizeRateInputToFraction(value)) * 100).toFixed(2)}%`
}

export function getLineCommissionRateFraction(line: {
  usage?: unknown
  usageUnallocated?: unknown
  commission?: unknown
  commissionUnallocated?: unknown
  commissionRate?: unknown
}): number | null {
  const storedRate = toNullableNumber((line as { commissionRate?: unknown }).commissionRate)
  if (storedRate !== null) return normalizeRateFraction(normalizeRateInputToFraction(storedRate))

  const usage = toNullableNumber((line as { usageUnallocated?: unknown; usage?: unknown }).usageUnallocated ?? line.usage)
  const commission = toNullableNumber(
    (line as { commissionUnallocated?: unknown; commission?: unknown }).commissionUnallocated ?? line.commission,
  )
  if (usage === null || commission === null) return null
  if (Math.abs(usage) < RATE_EPSILON) return Math.abs(commission) < RATE_EPSILON ? 0 : null
  return normalizeRateFraction(commission / usage)
}

export function analyzeBundleLineRates<TLine extends { id: string } & Record<string, unknown>>(lines: TLine[]) {
  const rateRows = lines.map(line => {
    const rateFraction = getLineCommissionRateFraction(line as {
      usage?: unknown
      usageUnallocated?: unknown
      commission?: unknown
      commissionUnallocated?: unknown
      commissionRate?: unknown
    })
    return {
      lineId: line.id,
      rateFraction: rateFraction !== null ? normalizeRateFraction(rateFraction) : null,
    }
  })

  const unknownRateLineIds = rateRows.filter(row => row.rateFraction === null).map(row => row.lineId)
  const uniqueRates = Array.from(new Set(rateRows.flatMap(row => (row.rateFraction === null ? [] : [row.rateFraction]))))

  return {
    rateRows,
    unknownRateLineIds,
    uniqueRates,
    hasMixedRates: uniqueRates.length > 1,
  }
}
