export type BonusLikeProductInput = {
  revenueType?: string | null
  productFamilyHouse?: string | null
  productNameHouse?: string | null
}

function normalizeLabel(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text ? text : null
}

export function isBonusLikeProduct(input: BonusLikeProductInput): boolean {
  const revenueType = normalizeLabel(input.revenueType)
  const family = normalizeLabel(input.productFamilyHouse)
  const name = normalizeLabel(input.productNameHouse)

  return (
    (typeof revenueType === "string" && revenueType.startsWith("NRC_")) ||
    Boolean(family && /bonus|spiff|spf/i.test(family)) ||
    Boolean(name && /bonus|spiff|spf/i.test(name))
  )
}

