export const VALIDATION_PATTERNS = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^\d{3}-\d{3}-\d{4}$/,
  // URL: allow optional protocol so users can enter either "https://example.com"
  // or "example.com" / "www.example.com", with an optional path.
  url: /^(https?:\/\/)?(www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/,
  state: /^[A-Z]{2}$/,
  zip: /^.{1,12}$/
} as const

export function formatPhoneNumber(phone: string): string {
  if (!phone) return ""

  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  return phone
}

