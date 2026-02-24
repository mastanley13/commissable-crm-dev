export type DataImportEntityType =
  | "accounts"
  | "contacts"
  | "opportunities"
  | "revenue-schedules"
  | "products"

export interface DataImportFieldDefinition {
  id: string
  label: string
  required: boolean
  aliases?: string[]
}

export interface DataImportEntityDefinition {
  type: DataImportEntityType
  label: string
  description: string
  fields: DataImportFieldDefinition[]
}

export const DATA_IMPORT_ENTITIES: DataImportEntityDefinition[] = [
  {
    type: "accounts",
    label: "Accounts",
    description: "Create or update account records by account name.",
    fields: [
      { id: "accountName", label: "Account Name", required: true, aliases: ["name"] },
      {
        id: "accountTypeName",
        label: "Account Type",
        required: true,
        aliases: ["type", "account type name"]
      },
      { id: "accountLegalName", label: "Account Legal Name", required: false, aliases: ["legal name"] },
      { id: "status", label: "Status", required: false, aliases: ["account status"] },
      { id: "websiteUrl", label: "Website URL", required: false, aliases: ["website", "url"] },
      { id: "description", label: "Description", required: false },
      { id: "parentAccountName", label: "Parent Account Name", required: false, aliases: ["parent account"] },
      { id: "ownerEmail", label: "Owner Email", required: false, aliases: ["owner"] },
      { id: "industryName", label: "Industry", required: false, aliases: ["industry name"] }
    ]
  },
  {
    type: "contacts",
    label: "Contacts",
    description: "Create contact records linked to existing accounts.",
    fields: [
      { id: "accountName", label: "Account Name", required: true, aliases: ["account"] },
      { id: "firstName", label: "First Name", required: true, aliases: ["firstname"] },
      { id: "lastName", label: "Last Name", required: true, aliases: ["lastname"] },
      { id: "suffix", label: "Suffix", required: false },
      { id: "jobTitle", label: "Job Title", required: false, aliases: ["title"] },
      { id: "workPhone", label: "Work Phone", required: false, aliases: ["phone"] },
      { id: "workPhoneExt", label: "Work Phone Extension", required: false, aliases: ["extension", "ext"] },
      { id: "mobilePhone", label: "Mobile Phone", required: false, aliases: ["mobile"] },
      { id: "emailAddress", label: "Email Address", required: false, aliases: ["email"] },
      { id: "ownerEmail", label: "Owner Email", required: false, aliases: ["owner"] },
      { id: "isPrimary", label: "Is Primary", required: false },
      { id: "isDecisionMaker", label: "Is Decision Maker", required: false, aliases: ["decision maker"] },
      {
        id: "preferredContactMethod",
        label: "Preferred Contact Method",
        required: false,
        aliases: ["contact method"]
      },
      { id: "description", label: "Description", required: false }
    ]
  },
  {
    type: "opportunities",
    label: "Opportunities",
    description: "Create opportunities linked to existing accounts.",
    fields: [
      { id: "accountName", label: "Account Name", required: true, aliases: ["account"] },
      { id: "name", label: "Opportunity Name", required: true, aliases: ["opportunity", "opportunity name"] },
      { id: "ownerEmail", label: "Owner Email", required: false, aliases: ["owner"] },
      { id: "stage", label: "Stage", required: false },
      { id: "leadSource", label: "Lead Source", required: false, aliases: ["source"] },
      {
        id: "estimatedCloseDate",
        label: "Estimated Close Date",
        required: false,
        aliases: ["close date", "estimated close"]
      },
      { id: "description", label: "Description", required: false },
      { id: "amount", label: "Amount", required: false },
      { id: "expectedCommission", label: "Expected Commission", required: false }
    ]
  },
  {
    type: "revenue-schedules",
    label: "Revenue Schedules",
    description: "Create revenue schedules linked to accounts, opportunities, and products.",
    fields: [
      { id: "accountName", label: "Account Name", required: true, aliases: ["account"] },
      { id: "scheduleDate", label: "Schedule Date", required: false, aliases: ["date"] },
      { id: "scheduleType", label: "Schedule Type", required: false, aliases: ["type"] },
      {
        id: "opportunityName",
        label: "Opportunity Name",
        required: false,
        aliases: ["opportunity", "opportunity name"]
      },
      { id: "productCode", label: "Product Code", required: false, aliases: ["sku", "product"] },
      { id: "expectedUsage", label: "Expected Usage", required: false },
      { id: "actualUsage", label: "Actual Usage", required: false },
      { id: "expectedCommission", label: "Expected Commission", required: false },
      { id: "actualCommission", label: "Actual Commission", required: false },
      { id: "orderIdHouse", label: "House Order ID", required: false, aliases: ["order id"] },
      { id: "distributorOrderId", label: "Distributor Order ID", required: false },
      { id: "notes", label: "Notes", required: false }
    ]
  },
  {
    type: "products",
    label: "Catalog / Products",
    description: "Create or update product catalog records by product code.",
    fields: [
      { id: "productCode", label: "Product Code", required: true, aliases: ["sku", "vendor part number", "code"] },
      { id: "productNameHouse", label: "Product Name (House)", required: true, aliases: ["product name", "name"] },
      {
        id: "revenueType",
        label: "Revenue Type",
        required: true,
        aliases: ["revenue type code", "revenue type label"]
      },
      { id: "productNameVendor", label: "Product Name (Vendor)", required: false },
      { id: "description", label: "Description", required: false },
      { id: "priceEach", label: "Price Each", required: false, aliases: ["price"] },
      {
        id: "commissionPercent",
        label: "Commission Percent",
        required: false,
        aliases: ["commission", "commission %"]
      },
      { id: "isActive", label: "Is Active", required: false, aliases: ["active"] },
      { id: "vendorAccountName", label: "Vendor Account Name", required: false, aliases: ["vendor"] },
      {
        id: "distributorAccountName",
        label: "Distributor Account Name",
        required: false,
        aliases: ["distributor"]
      },
      { id: "productFamilyHouse", label: "Product Family (House)", required: false },
      { id: "productSubtypeHouse", label: "Product Subtype (House)", required: false },
      { id: "productFamilyVendor", label: "Product Family (Vendor)", required: false },
      { id: "productSubtypeVendor", label: "Product Subtype (Vendor)", required: false }
    ]
  }
]

const DATA_IMPORT_ENTITY_MAP = new Map<DataImportEntityType, DataImportEntityDefinition>(
  DATA_IMPORT_ENTITIES.map(definition => [definition.type, definition])
)

export function getDataImportEntityDefinition(entityType: DataImportEntityType) {
  return DATA_IMPORT_ENTITY_MAP.get(entityType) ?? null
}

export function isDataImportEntityType(value: unknown): value is DataImportEntityType {
  if (typeof value !== "string") {
    return false
  }
  return DATA_IMPORT_ENTITY_MAP.has(value as DataImportEntityType)
}
