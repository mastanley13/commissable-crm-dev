type AddressRecord = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
}

export function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function formatAddressRecord(address?: AddressRecord | null): string | null {
  if (!address) {
    return null
  }

  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .map(value => normalizeNonEmptyString(value))
    .filter((value): value is string => Boolean(value))

  return parts.length > 0 ? parts.join(", ") : null
}

export function resolveDisplayAddress(
  preferredAddress: unknown,
  fallbackAddress?: AddressRecord | null,
): string | null {
  return normalizeNonEmptyString(preferredAddress) ?? formatAddressRecord(fallbackAddress) ?? null
}
