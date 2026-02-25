export const PHONE_EXTENSION_MAX_DIGITS = 10

export function phoneExtensionDigits(value: string): string {
  return value.replace(/\D/g, "")
}

export function toPhoneExtensionDigits(value: string, maxDigits: number = PHONE_EXTENSION_MAX_DIGITS): string {
  return phoneExtensionDigits(value).slice(0, maxDigits)
}

export function normalizePhoneExtension(value: unknown, maxDigits: number = PHONE_EXTENSION_MAX_DIGITS): string | null {
  if (value === undefined || value === null) return null

  const trimmed = (typeof value === "string" ? value : String(value)).trim()
  if (trimmed.length === 0) return null

  const digits = phoneExtensionDigits(trimmed)
  if (digits.length === 0) return null

  return digits.slice(0, maxDigits)
}

