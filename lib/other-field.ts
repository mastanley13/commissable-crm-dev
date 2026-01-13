export type OtherSource = "Vendor" | "Distributor"

function normalizeValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function resolveOtherValue(
  vendorValue: string | null | undefined,
  distributorValue: string | null | undefined
): { value: string | null; source: OtherSource | null } {
  const vendor = normalizeValue(vendorValue)
  if (vendor) return { value: vendor, source: "Vendor" }

  const distributor = normalizeValue(distributorValue)
  if (distributor) return { value: distributor, source: "Distributor" }

  return { value: null, source: null }
}

export function resolveOtherSource(
  pairs: Array<[vendor: string | null | undefined, distributor: string | null | undefined]>
): OtherSource | null {
  for (const [vendorValue] of pairs) {
    if (normalizeValue(vendorValue)) return "Vendor"
  }
  for (const [, distributorValue] of pairs) {
    if (normalizeValue(distributorValue)) return "Distributor"
  }
  return null
}

