import type { DepositLineItemRow } from "@/lib/mock-data"

export type VendorSummaryRow = {
  vendorName: string
  lineCount: number
  lineCountWithUnallocated: number
  usageAllocated: number
  usageUnallocated: number
  commissionAllocated: number
  commissionUnallocated: number
}

export type VendorSummaryTotals = {
  vendorCount: number
  lineCount: number
  lineCountWithUnallocated: number
  usageAllocated: number
  usageUnallocated: number
  commissionAllocated: number
  commissionUnallocated: number
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

export function buildVendorSummary(lineItems: DepositLineItemRow[]): {
  rows: VendorSummaryRow[]
  totals: VendorSummaryTotals
} {
  const byVendor = new Map<string, VendorSummaryRow>()

  let totalLineCount = 0
  let totalLineCountWithUnallocated = 0
  let totalUsageAllocated = 0
  let totalUsageUnallocated = 0
  let totalCommissionAllocated = 0
  let totalCommissionUnallocated = 0

  for (const item of lineItems) {
    totalLineCount += 1

    const vendorName = (item.vendorName ?? "").trim() || "Unknown Vendor"
    const usageAllocated = toNumber(item.usageAllocated)
    const usageUnallocated = toNumber(item.usageUnallocated)
    const commissionAllocated = toNumber(item.commissionAllocated)
    const commissionUnallocated = toNumber(item.commissionUnallocated)
    const hasUnallocated = usageUnallocated > 0 || commissionUnallocated > 0

    if (hasUnallocated) totalLineCountWithUnallocated += 1

    totalUsageAllocated += usageAllocated
    totalUsageUnallocated += usageUnallocated
    totalCommissionAllocated += commissionAllocated
    totalCommissionUnallocated += commissionUnallocated

    const existing = byVendor.get(vendorName)
    if (existing) {
      existing.lineCount += 1
      if (hasUnallocated) existing.lineCountWithUnallocated += 1
      existing.usageAllocated += usageAllocated
      existing.usageUnallocated += usageUnallocated
      existing.commissionAllocated += commissionAllocated
      existing.commissionUnallocated += commissionUnallocated
      continue
    }

    byVendor.set(vendorName, {
      vendorName,
      lineCount: 1,
      lineCountWithUnallocated: hasUnallocated ? 1 : 0,
      usageAllocated,
      usageUnallocated,
      commissionAllocated,
      commissionUnallocated,
    })
  }

  const rows = Array.from(byVendor.values())
  rows.sort((a, b) => {
    if (b.commissionUnallocated !== a.commissionUnallocated) {
      return b.commissionUnallocated - a.commissionUnallocated
    }
    if (b.usageUnallocated !== a.usageUnallocated) {
      return b.usageUnallocated - a.usageUnallocated
    }
    return a.vendorName.localeCompare(b.vendorName)
  })

  return {
    rows,
    totals: {
      vendorCount: rows.length,
      lineCount: totalLineCount,
      lineCountWithUnallocated: totalLineCountWithUnallocated,
      usageAllocated: totalUsageAllocated,
      usageUnallocated: totalUsageUnallocated,
      commissionAllocated: totalCommissionAllocated,
      commissionUnallocated: totalCommissionUnallocated,
    },
  }
}

