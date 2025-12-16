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
    label: "NRC - SPIFF - Per Item",
    description:
      'A one-time payment made for specific items sold (e.g., $50 per handset). The system allows these to be split over multiple payment periods if necessary.',
    category: "NRC"
  },
  {
    code: "NRC_Percent",
    label: "NRC - SPIFF - % of Usage",
    description:
      "A one-time incentive calculated based on the monthly recurring billing amount (e.g., a 200% bonus on a $100 monthly bill would result in a $200 commission).",
    category: "NRC"
  },
  {
    code: "NRC_FlatFee",
    label: "NRC - SPIFF - Flat Fee",
    description:
      "A fixed bonus amount (e.g., $5,000) unrelated to usage or quantity. Like Per Item SPIFFs, these can be staged over multiple payments (e.g., 50% upfront, 50% later).",
    category: "NRC"
  },
  {
    code: "NRC_Resale",
    label: "NRC - Resale (Buy/Sell)",
    description:
      "Used for goods or services bought and resold by the agency. The system calculates profit by subtracting the Cost of Goods Sold (COGS) from the sales price. This type requires a corresponding Purchase Order to be reconciled.",
    category: "NRC"
  },
  {
    code: "MRC_ThirdParty",
    label: "MRC - 3rd Party",
    description:
      'This type is used when a product is billed directly to the client by a third-party vendor (e.g., AT&T, Verizon). The agency tracks the "expected" usage to calculate the commission, but only tracks the commission received for IRS revenue purposes, as the agency is not the billing entity.',
    category: "MRC"
  },
  {
    code: "MRC_House",
    label: "MRC - Agency",
    description:
      "This applies when the agency bills the client directly. In this scenario, the system must track the full revenue amount (billing) in addition to the profit/commission for tax and historical purposes.",
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
