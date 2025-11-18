export type RevenueTypeCode =
  | "NRC_PerItem"
  | "NRC_Percent"
  | "NRC_FlatFee"
  | "NRC_Resale"
  | "MRC_ThirdParty"
  | "MRC_House"

export interface RevenueTypeDefinition {
  code: RevenueTypeCode
  label: string
  description: string
  category: "NRC" | "MRC"
}

export const REVENUE_TYPE_DEFINITIONS: RevenueTypeDefinition[] = [
  {
    code: "NRC_PerItem",
    label: "NRC - Quantity",
    description:
      "Non-recurring amount multiplied by a quantity (e.g., $50 per phone sold in a single month).",
    category: "NRC"
  },
  {
    code: "NRC_Percent",
    label: "NRC - %",
    description:
      "Non-recurring bonus calculated as a percentage of another amount (e.g., 200% of monthly billing paid up front).",
    category: "NRC"
  },
  {
    code: "NRC_FlatFee",
    label: "NRC - Flat Fee",
    description: "Single non-recurring flat amount (e.g., a $100 gift card).",
    category: "NRC"
  },
  {
    code: "NRC_Resale",
    label: "NRC - Resale",
    description:
      "One-time resale transactions where the company buys and sells products/services (tracks gross profit).",
    category: "NRC"
  },
  {
    code: "MRC_ThirdParty",
    label: "MRC - 3rd Party",
    description:
      "Monthly recurring revenue billed by a third party (e.g., carrier services where we only receive commissions).",
    category: "MRC"
  },
  {
    code: "MRC_House",
    label: "MRC - House",
    description:
      "Monthly recurring revenue billed directly by the company (e.g., in-house consulting engagements).",
    category: "MRC"
  }
]

export const REVENUE_TYPE_OPTIONS = REVENUE_TYPE_DEFINITIONS.map(definition => ({
  value: definition.code,
  label: definition.label
}))

export function getRevenueTypeDefinition(code?: string | null): RevenueTypeDefinition | null {
  if (!code) {
    return null
  }
  return REVENUE_TYPE_DEFINITIONS.find(def => def.code === code) ?? null
}

export function getRevenueTypeLabel(code?: string | null): string | null {
  return getRevenueTypeDefinition(code)?.label ?? null
}

export function isRevenueTypeCode(value: unknown): value is RevenueTypeCode {
  return typeof value === "string" && REVENUE_TYPE_DEFINITIONS.some(def => def.code === value)
}
