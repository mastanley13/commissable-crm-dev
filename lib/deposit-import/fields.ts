export type DepositFieldType = "string" | "number" | "date"

export interface DepositFieldDefinition {
  id: string
  label: string
  description?: string
  required?: boolean
  type: DepositFieldType
  scope: "header" | "line"
}

export const depositFieldDefinitions: DepositFieldDefinition[] = [
  {
    id: "lineNumber",
    label: "Line Number",
    description: "Optional explicit row or reference number from the vendor file.",
    type: "number",
    scope: "line",
  },
  {
    id: "paymentDate",
    label: "Payment Date",
    description: "Date of the individual deposit line. Falls back to deposit date if omitted.",
    type: "date",
    scope: "line",
  },
  {
    id: "accountNameRaw",
    label: "Account / Customer Name",
    type: "string",
    scope: "line",
  },
  {
    id: "accountIdVendor",
    label: "Account ID (Vendor)",
    type: "string",
    scope: "line",
  },
  {
    id: "customerIdVendor",
    label: "Customer ID (Vendor)",
    type: "string",
    scope: "line",
  },
  {
    id: "orderIdVendor",
    label: "Order ID (Vendor)",
    type: "string",
    scope: "line",
  },
  {
    id: "productNameRaw",
    label: "Product Name / SKU",
    type: "string",
    scope: "line",
  },
  {
    id: "usage",
    label: "Usage Amount",
    description: "Numeric value used for reconciliation.",
    required: true,
    type: "number",
    scope: "line",
  },
  {
    id: "commission",
    label: "Commission Amount",
    required: true,
    type: "number",
    scope: "line",
  },
  {
    id: "commissionRate",
    label: "Commission Rate (%)",
    type: "number",
    scope: "line",
  },
  {
    id: "locationId",
    label: "Location ID",
    type: "string",
    scope: "line",
  },
  {
    id: "customerPurchaseOrder",
    label: "Customer PO #",
    type: "string",
    scope: "line",
  },
  {
    id: "vendorNameRaw",
    label: "Vendor Name (raw)",
    type: "string",
    scope: "line",
  },
  {
    id: "distributorNameRaw",
    label: "Distributor Name (raw)",
    type: "string",
    scope: "line",
  },
]

export const requiredDepositFieldIds = depositFieldDefinitions.filter(field => field.required).map(field => field.id)
