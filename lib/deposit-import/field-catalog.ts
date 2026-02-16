import type { FieldDataType, FieldDefinition } from "@prisma/client"

export type DepositImportFieldType = "string" | "number" | "date" | "boolean"
export type DepositImportFieldEntity = "depositLineItem" | "deposit" | "opportunity" | "product" | "matching"
export type DepositImportFieldPersistence = "depositLineItemColumn" | "depositColumn" | "metadata"

export interface DepositImportFieldTarget {
  id: string
  label: string
  entity: DepositImportFieldEntity
  dataType: DepositImportFieldType
  persistence: DepositImportFieldPersistence
  columnName?: string | null
  metadataPath?: string[]
  required?: boolean
}

export const DEPOSIT_IMPORT_TARGET_IDS = {
  depositName: "deposit.depositName",
  depositPaymentDate: "deposit.paymentDate",
  usage: "depositLineItem.usage",
  commission: "depositLineItem.commission",
  commissionRate: "depositLineItem.commissionRate",
  commissionType: "depositLineItem.commissionType",
  commissionDate: "depositLineItem.commissionDate",
  externalScheduleId: "matching.externalScheduleId",
}

const depositLineItemTargets: DepositImportFieldTarget[] = [
  {
    id: "depositLineItem.lineNumber",
    label: "Line Item",
    entity: "depositLineItem",
    dataType: "number",
    persistence: "depositLineItemColumn",
    columnName: "lineNumber",
  },
  {
    id: "depositLineItem.paymentDate",
    label: "Payment Date",
    entity: "depositLineItem",
    dataType: "date",
    persistence: "depositLineItemColumn",
    columnName: "paymentDate",
  },
  {
    id: DEPOSIT_IMPORT_TARGET_IDS.commissionDate,
    label: "Commission Date",
    entity: "depositLineItem",
    dataType: "date",
    persistence: "metadata",
    metadataPath: ["depositLineItem", "commissionDate"],
  },
  {
    id: DEPOSIT_IMPORT_TARGET_IDS.commissionType,
    label: "Commission Type",
    entity: "depositLineItem",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["depositLineItem", "commissionType"],
  },
  {
    id: "depositLineItem.accountNameRaw",
    label: "Account Legal Name",
    entity: "depositLineItem",
    dataType: "string",
    persistence: "depositLineItemColumn",
    columnName: "accountNameRaw",
  },
  {
    id: "depositLineItem.accountIdVendor",
    label: "Other - Account ID",
    entity: "depositLineItem",
    dataType: "string",
    persistence: "depositLineItemColumn",
    columnName: "accountIdVendor",
  },
  {
    id: "depositLineItem.customerIdVendor",
    label: "Other - Customer ID",
    entity: "depositLineItem",
    dataType: "string",
    persistence: "depositLineItemColumn",
    columnName: "customerIdVendor",
  },
  {
    id: "depositLineItem.orderIdVendor",
    label: "Other - Order ID",
    entity: "depositLineItem",
    dataType: "string",
    persistence: "depositLineItemColumn",
    columnName: "orderIdVendor",
  },
  {
    id: "depositLineItem.productNameRaw",
    label: "Other - Product Name",
    entity: "depositLineItem",
    dataType: "string",
    persistence: "depositLineItemColumn",
    columnName: "productNameRaw",
  },
  {
    id: "depositLineItem.partNumberRaw",
    label: "Other - Part Number",
    entity: "depositLineItem",
    dataType: "string",
    persistence: "depositLineItemColumn",
    columnName: "partNumberRaw",
  },
  {
    id: DEPOSIT_IMPORT_TARGET_IDS.usage,
    label: "Actual Usage",
    entity: "depositLineItem",
    dataType: "number",
    persistence: "depositLineItemColumn",
    columnName: "usage",
  },
  {
    id: DEPOSIT_IMPORT_TARGET_IDS.commission,
    label: "Actual Commission",
    entity: "depositLineItem",
    dataType: "number",
    persistence: "depositLineItemColumn",
    columnName: "commission",
  },
  {
    id: DEPOSIT_IMPORT_TARGET_IDS.commissionRate,
    label: "Actual Commission Rate %",
    entity: "depositLineItem",
    dataType: "number",
    persistence: "depositLineItemColumn",
    columnName: "commissionRate",
  },
  {
    id: "depositLineItem.locationId",
    label: "Location ID",
    entity: "depositLineItem",
    dataType: "string",
    persistence: "depositLineItemColumn",
    columnName: "locationId",
  },
  {
    id: "depositLineItem.customerPurchaseOrder",
    label: "Customer PO #",
    entity: "depositLineItem",
    dataType: "string",
    persistence: "depositLineItemColumn",
    columnName: "customerPurchaseOrder",
  },
  {
    id: "depositLineItem.vendorNameRaw",
    label: "Vendor Name",
    entity: "depositLineItem",
    dataType: "string",
    persistence: "depositLineItemColumn",
    columnName: "vendorNameRaw",
  },
  {
    id: "depositLineItem.distributorNameRaw",
    label: "Distributor Name",
    entity: "depositLineItem",
    dataType: "string",
    persistence: "depositLineItemColumn",
    columnName: "distributorNameRaw",
  },
]

const depositTargets: DepositImportFieldTarget[] = [
  {
    id: DEPOSIT_IMPORT_TARGET_IDS.depositName,
    label: "Deposit Name",
    entity: "deposit",
    dataType: "string",
    persistence: "depositColumn",
    columnName: "depositName",
  },
  {
    id: DEPOSIT_IMPORT_TARGET_IDS.depositPaymentDate,
    label: "Payment Date",
    entity: "deposit",
    dataType: "date",
    persistence: "depositColumn",
    columnName: "paymentDate",
  },
]

const matchingTargets: DepositImportFieldTarget[] = [
  {
    id: DEPOSIT_IMPORT_TARGET_IDS.externalScheduleId,
    label: "External Schedule ID",
    entity: "matching",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["matching", "externalScheduleId"],
  },
]

const staticOpportunityTargets: DepositImportFieldTarget[] = [
  {
    id: "opportunity.name",
    label: "Opportunity Name",
    entity: "opportunity",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["opportunity", "name"],
  },
  {
    id: "opportunity.stage",
    label: "Opportunity Stage",
    entity: "opportunity",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["opportunity", "stage"],
  },
  {
    id: "opportunity.status",
    label: "Status",
    entity: "opportunity",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["opportunity", "status"],
  },
  {
    id: "opportunity.type",
    label: "Opportunity Type",
    entity: "opportunity",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["opportunity", "type"],
  },
  {
    id: "opportunity.amount",
    label: "Amount",
    entity: "opportunity",
    dataType: "number",
    persistence: "metadata",
    metadataPath: ["opportunity", "amount"],
  },
  {
    id: "opportunity.expectedCommission",
    label: "Expected Commission",
    entity: "opportunity",
    dataType: "number",
    persistence: "metadata",
    metadataPath: ["opportunity", "expectedCommission"],
  },
  {
    id: "opportunity.estimatedCloseDate",
    label: "Estimated Close Date",
    entity: "opportunity",
    dataType: "date",
    persistence: "metadata",
    metadataPath: ["opportunity", "estimatedCloseDate"],
  },
  {
    id: "opportunity.actualCloseDate",
    label: "Actual Close Date",
    entity: "opportunity",
    dataType: "date",
    persistence: "metadata",
    metadataPath: ["opportunity", "actualCloseDate"],
  },
  {
    id: "opportunity.orderIdVendor",
    label: "Other - Order ID",
    entity: "opportunity",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["opportunity", "orderIdVendor"],
  },
  {
    id: "opportunity.accountIdVendor",
    label: "Other - Account ID",
    entity: "opportunity",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["opportunity", "accountIdVendor"],
  },
  {
    id: "opportunity.customerIdVendor",
    label: "Other - Customer ID",
    entity: "opportunity",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["opportunity", "customerIdVendor"],
  },
  {
    id: "opportunity.customerPurchaseOrder",
    label: "Customer PO #",
    entity: "opportunity",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["opportunity", "customerPurchaseOrder"],
  },
  {
    id: "opportunity.locationId",
    label: "Location ID",
    entity: "opportunity",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["opportunity", "locationId"],
  },
]

const productTargets: DepositImportFieldTarget[] = [
  {
    id: "product.productCode",
    label: "House - Part Number",
    entity: "product",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["product", "productCode"],
  },
  {
    id: "product.productNameHouse",
    label: "House - Product Name",
    entity: "product",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["product", "productNameHouse"],
  },
  {
    id: "product.productNameVendor",
    label: "Other - Product Name",
    entity: "product",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["product", "productNameVendor"],
  },
  {
    id: "product.description",
    label: "Other - Product Description",
    entity: "product",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["product", "description"],
  },
  {
    id: "product.revenueType",
    label: "Revenue Type",
    entity: "product",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["product", "revenueType"],
  },
  {
    id: "product.priceEach",
    label: "Price Each",
    entity: "product",
    dataType: "number",
    persistence: "metadata",
    metadataPath: ["product", "priceEach"],
  },
  {
    id: "product.commissionPercent",
    label: "Expected Commission Rate %",
    entity: "product",
    dataType: "number",
    persistence: "metadata",
    metadataPath: ["product", "commissionPercent"],
  },
  {
    id: "product.partNumberVendor",
    label: "Other - Part Number",
    entity: "product",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["product", "partNumberVendor"],
  },
  {
    id: "product.productFamilyVendor",
    label: "Other - Product Family",
    entity: "product",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["product", "productFamilyVendor"],
  },
  {
    id: "product.productSubtypeVendor",
    label: "Other - Product Subtype",
    entity: "product",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["product", "productSubtypeVendor"],
  },
  {
    id: "product.productNameDistributor",
    label: "Distributor - Product Name",
    entity: "product",
    dataType: "string",
    persistence: "metadata",
    metadataPath: ["product", "productNameDistributor"],
  },
]

const FIELD_DATA_TYPE_MAP: Record<FieldDataType, DepositImportFieldType | null> = {
  Text: "string",
  Number: "number",
  Boolean: "boolean",
  Date: "date",
  Enum: "string",
  Json: null,
}

type OpportunityFieldDefinitionInput = Pick<FieldDefinition, "dataType" | "fieldCode" | "label">

function mapFieldDefinitionToTarget(field: OpportunityFieldDefinitionInput): DepositImportFieldTarget | null {
  const dataType = FIELD_DATA_TYPE_MAP[field.dataType]
  if (!dataType) return null
  const fieldCode = field.fieldCode?.trim()
  if (!fieldCode) return null
  return {
    id: `opportunity.${fieldCode}`,
    label: field.label || fieldCode,
    entity: "opportunity",
    dataType,
    persistence: "metadata",
    metadataPath: ["opportunity", fieldCode],
  }
}

export function buildDepositImportFieldCatalog(options?: {
  opportunityFieldDefinitions?: OpportunityFieldDefinitionInput[]
}): DepositImportFieldTarget[] {
  const targets: DepositImportFieldTarget[] = [
    ...depositLineItemTargets,
    ...depositTargets,
    ...matchingTargets,
    ...staticOpportunityTargets,
    ...productTargets,
  ]

  const dynamicOpportunityTargets = (options?.opportunityFieldDefinitions ?? [])
    .map(mapFieldDefinitionToTarget)
    .filter(Boolean) as DepositImportFieldTarget[]

  const seen = new Set<string>(targets.map(target => target.id))
  for (const target of dynamicOpportunityTargets) {
    if (seen.has(target.id)) continue
    targets.push(target)
    seen.add(target.id)
  }

  return targets
}

export function buildDepositImportFieldCatalogIndex(targets: DepositImportFieldTarget[]) {
  const index = new Map<string, DepositImportFieldTarget>()
  for (const target of targets) {
    index.set(target.id, target)
  }
  return index
}

export const LEGACY_FIELD_ID_TO_TARGET_ID: Record<string, string> = {
  lineNumber: "depositLineItem.lineNumber",
  paymentDate: "depositLineItem.paymentDate",
  accountNameRaw: "depositLineItem.accountNameRaw",
  accountIdVendor: "depositLineItem.accountIdVendor",
  customerIdVendor: "depositLineItem.customerIdVendor",
  orderIdVendor: "depositLineItem.orderIdVendor",
  productNameRaw: "depositLineItem.productNameRaw",
  partNumberRaw: "depositLineItem.partNumberRaw",
  usage: DEPOSIT_IMPORT_TARGET_IDS.usage,
  commission: DEPOSIT_IMPORT_TARGET_IDS.commission,
  commissionRate: DEPOSIT_IMPORT_TARGET_IDS.commissionRate,
  locationId: "depositLineItem.locationId",
  customerPurchaseOrder: "depositLineItem.customerPurchaseOrder",
  vendorNameRaw: "depositLineItem.vendorNameRaw",
  distributorNameRaw: "depositLineItem.distributorNameRaw",
}
