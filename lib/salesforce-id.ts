export const SALESFORCE_ID_PATTERN = /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/

export function normalizeSalesforceIdInput(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : null
}

export function isValidSalesforceId(value: string): boolean {
  return SALESFORCE_ID_PATTERN.test(value)
}

