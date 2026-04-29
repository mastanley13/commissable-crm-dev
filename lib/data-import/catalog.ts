export type DataImportEntityType =
  | "accounts"
  | "contacts"
  | "deposit-transactions"
  | "opportunity-line-items"
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
      { id: "accountNumber", label: "Account Number", required: false, aliases: ["number"] },
      {
        id: "salesforceId",
        label: "Salesforce ID",
        required: false,
        aliases: ["salesforce account id", "sf account id", "sfid"]
      },
      {
        id: "accountTypeName",
        label: "Account Type",
        required: true,
        aliases: ["type", "account type name"]
      },
      {
        id: "accountLegalName",
        label: "Account Legal Name",
        required: false,
        aliases: ["legal name", "account legal"]
      },
      { id: "status", label: "Status", required: false, aliases: ["account status"] },
      { id: "websiteUrl", label: "Website URL", required: false, aliases: ["website", "url"] },
      { id: "description", label: "Description", required: false },
      { id: "parentAccountName", label: "Parent Account Name", required: false, aliases: ["parent account"] },
      { id: "ownerEmail", label: "Owner Email", required: false, aliases: ["owner", "account owner"] },
      { id: "industryName", label: "Industry", required: false, aliases: ["industry name"] },
      { id: "billingSameAsShipping", label: "Billing Same As Shipping", required: false, aliases: ["sync billing with shipping"] },
      { id: "shippingStreet", label: "Shipping Street", required: false },
      { id: "shippingStreet2", label: "Shipping Street 2", required: false },
      { id: "shippingCity", label: "Shipping City", required: false },
      { id: "shippingState", label: "Shipping State", required: false },
      { id: "shippingZip", label: "Shipping Zip", required: false, aliases: ["shipping postal code"] },
      { id: "shippingCountry", label: "Shipping Country", required: false },
      { id: "billingStreet", label: "Billing Street", required: false },
      { id: "billingStreet2", label: "Billing Street 2", required: false },
      { id: "billingCity", label: "Billing City", required: false },
      { id: "billingState", label: "Billing State", required: false },
      { id: "billingZip", label: "Billing Zip", required: false, aliases: ["billing postal code"] },
      { id: "billingCountry", label: "Billing Country", required: false }
    ]
  },
  {
    type: "contacts",
    label: "Contacts",
    description:
      "Create or update contact records linked to existing accounts (matched by email when provided, otherwise by name).",
    fields: [
      {
        id: "salesforceId",
        label: "Contact ID",
        required: false,
        aliases: ["salesforce id", "salesforce contact id", "sf contact id", "sfid"]
      },
      { id: "accountName", label: "Account Name", required: true, aliases: ["account"] },
      { id: "firstName", label: "First Name", required: true, aliases: ["firstname"] },
      { id: "lastName", label: "Last Name", required: true, aliases: ["lastname"] },
      { id: "suffix", label: "Suffix", required: false },
      { id: "jobTitle", label: "Job Title", required: false, aliases: ["title"] },
      { id: "workPhone", label: "Work Phone", required: false, aliases: ["phone"] },
      {
        id: "workPhoneExt",
        label: "Work Phone Extension",
        required: false,
        aliases: ["extension", "ext", "work extension"]
      },
      { id: "mobilePhone", label: "Mobile Phone", required: false, aliases: ["mobile"] },
      { id: "emailAddress", label: "Email Address", required: false, aliases: ["email"] },
      { id: "ownerEmail", label: "Owner Email", required: false, aliases: ["owner", "account owner"] },
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
    type: "deposit-transactions",
    label: "Deposits / Transactions",
    description:
      "Create deposit and deposit line item records from transaction-level files for settled historical archive loads or open/disputed reconciliation work.",
    fields: [
      {
        id: "sourceDepositKey",
        label: "Source Deposit Key",
        required: true,
        aliases: ["deposit key", "deposit id", "source batch key"]
      },
      {
        id: "sourceTransactionKey",
        label: "Source Transaction Key",
        required: true,
        aliases: ["transaction key", "transaction id", "source transaction id"]
      },
      { id: "depositName", label: "Deposit Name", required: false },
      {
        id: "commissionPeriod",
        label: "Commission Period",
        required: false,
        aliases: ["period", "commission month"]
      },
      {
        id: "paymentDate",
        label: "Payment Date",
        required: true,
        aliases: ["transaction date", "paid date"]
      },
      {
        id: "distributorAccountName",
        label: "Distributor Name",
        required: false,
        aliases: ["distributor", "distributor account name"]
      },
      {
        id: "vendorAccountName",
        label: "Vendor Name",
        required: false,
        aliases: ["vendor", "vendor account name"]
      },
      { id: "lineNumber", label: "Line Item", required: false, aliases: ["line", "row number"] },
      {
        id: "accountNameRaw",
        label: "Account Legal Name",
        required: false,
        aliases: ["account name", "customer name"]
      },
      { id: "accountIdVendor", label: "Other - Account ID", required: false },
      { id: "customerIdVendor", label: "Other - Customer ID", required: false },
      { id: "orderIdVendor", label: "Other - Order ID", required: false },
      { id: "productNameRaw", label: "Other - Product Name", required: false },
      { id: "partNumberRaw", label: "Other - Part Number", required: false },
      { id: "locationId", label: "Location ID", required: false },
      {
        id: "customerPurchaseOrder",
        label: "Customer PO #",
        required: false,
        aliases: ["customer po", "customer purchase order"]
      },
      { id: "usage", label: "Actual Usage", required: false, aliases: ["usage"] },
      { id: "commission", label: "Actual Commission", required: false, aliases: ["commission"] },
      {
        id: "commissionRate",
        label: "Actual Commission Rate %",
        required: false,
        aliases: ["commission rate", "rate"]
      },
      { id: "commissionType", label: "Commission Type", required: false },
      { id: "commissionDate", label: "Commission Date", required: false },
      {
        id: "isChargeback",
        label: "Is Chargeback",
        required: false,
        aliases: ["chargeback"]
      },
      { id: "notes", label: "Notes", required: false },
      { id: "opportunityName", label: "Opportunity Name", required: false },
      { id: "externalScheduleId", label: "External Schedule ID", required: false }
    ]
  },
  {
    type: "opportunity-line-items",
    label: "Opportunity Line Items",
    description:
      "Create opportunity product line items linked to existing opportunities and products. This import is create-only in v1.",
    fields: [
      { id: "accountName", label: "Account Name", required: true, aliases: ["account"] },
      {
        id: "opportunityName",
        label: "Opportunity Name",
        required: true,
        aliases: ["opportunity", "opportunity name"]
      },
      {
        id: "productCode",
        label: "Product Code",
        required: true,
        aliases: ["sku", "product", "vendor part number", "code"]
      },
      { id: "quantity", label: "Quantity", required: true, aliases: ["qty"] },
      { id: "unitPrice", label: "Unit Price", required: false, aliases: ["price each", "price"] },
      { id: "expectedUsage", label: "Expected Usage", required: false },
      { id: "expectedRevenue", label: "Expected Revenue", required: false },
      { id: "expectedCommission", label: "Expected Commission", required: false },
      {
        id: "subjectMatterExpertPercent",
        label: "SME %",
        required: false,
        aliases: ["sme", "subject matter expert percent"]
      },
      { id: "status", label: "Status", required: false },
      { id: "revenueStartDate", label: "Revenue Start Date", required: false },
      { id: "revenueEndDate", label: "Revenue End Date", required: false }
    ]
  },
  {
    type: "opportunities",
    label: "Opportunities",
    description: "Create or update opportunities linked to existing accounts (matched by account + opportunity name).",
    fields: [
      { id: "accountName", label: "Account Name", required: true, aliases: ["account"] },
      { id: "name", label: "Opportunity Name", required: true, aliases: ["opportunity", "opportunity name"] },
      { id: "roleName", label: "Role", required: true, aliases: ["role"] },
      {
        id: "roleContactEmail",
        label: "Role Contact Email",
        required: false,
        aliases: ["role email", "contact email", "role contact"]
      },
      {
        id: "roleContactName",
        label: "Role Contact Name",
        required: false,
        aliases: ["contact name", "role contact full name", "primary contact"]
      },
      {
        id: "roleContactTitle",
        label: "Role Contact Title",
        required: false,
        aliases: ["contact title", "role contact job title", "title"]
      },
      {
        id: "roleContactPhone",
        label: "Role Contact Phone",
        required: false,
        aliases: ["contact phone", "role contact work phone", "phone"]
      },
      {
        id: "roleContactPhoneExt",
        label: "Role Contact Phone Extension",
        required: false,
        aliases: ["contact extension", "role contact extension", "extension", "ext"]
      },
      { id: "ownerEmail", label: "Owner Email", required: false, aliases: ["owner", "account owner"] },
      { id: "stage", label: "Stage", required: false, aliases: ["opportunity stage"] },
      { id: "leadSource", label: "Lead Source", required: false, aliases: ["source"] },
      {
        id: "estimatedCloseDate",
        label: "Estimated Close Date",
        required: false,
        aliases: ["close date", "estimated close"]
      },
      { id: "description", label: "Description", required: false },
      { id: "amount", label: "Amount", required: false },
      { id: "expectedCommission", label: "Expected Commission", required: false },
      { id: "referredBy", label: "Referred By", required: false, aliases: ["referred by contact"] },
      { id: "shippingAddress", label: "Shipping Address", required: false },
      { id: "billingAddress", label: "Billing Address", required: false },
      { id: "subAgent", label: "Subagent", required: false, aliases: ["sub agent"] },
      { id: "subagentPercent", label: "Subagent Percent", required: false, aliases: ["subagent %"] },
      { id: "houseRepPercent", label: "House Rep Percent", required: false, aliases: ["house rep %"] },
      { id: "houseSplitPercent", label: "House Split Percent", required: false, aliases: ["house split %"] },
      { id: "accountIdHouse", label: "House Account ID", required: false },
      { id: "accountIdVendor", label: "Vendor Account ID", required: false },
      { id: "accountIdDistributor", label: "Distributor Account ID", required: false },
      { id: "customerIdHouse", label: "House Customer ID", required: false },
      { id: "customerIdVendor", label: "Vendor Customer ID", required: false },
      { id: "customerIdDistributor", label: "Distributor Customer ID", required: false },
      { id: "locationId", label: "Location ID", required: false, aliases: ["vendor location id"] },
      { id: "orderIdHouse", label: "House Order ID", required: false },
      { id: "orderIdVendor", label: "Vendor Order ID", required: false },
      { id: "orderIdDistributor", label: "Distributor Order ID", required: false },
      { id: "customerPurchaseOrder", label: "Customer Purchase Order", required: false, aliases: ["customer po number"] }
    ]
  },
  {
    type: "revenue-schedules",
    label: "Revenue Schedules",
    description: "Create revenue schedules linked to accounts, opportunities, and products.",
    fields: [
      {
        id: "accountName",
        label: "Account Name",
        required: true,
        aliases: ["account", "account legal name"]
      },
      { id: "scheduleDate", label: "Schedule Date", required: false, aliases: ["date", "revenue schedule date"] },
      { id: "scheduleType", label: "Schedule Type", required: false, aliases: ["type", "record type"] },
      {
        id: "opportunityName",
        label: "Opportunity Name",
        required: false,
        aliases: ["opportunity", "opportunity name"]
      },
      {
        id: "productCode",
        label: "Product Code",
        required: false,
        aliases: [
          "sku",
          "product",
          "cloud & wire product sku",
          "cloud and wire product sku",
          "distributor product sku",
          "vendor product sku"
        ]
      },
      { id: "expectedUsage", label: "Expected Usage", required: false, aliases: ["adj exp total usage (billing)"] },
      { id: "actualUsage", label: "Actual Usage", required: false, aliases: ["actual billed"] },
      {
        id: "expectedCommission",
        label: "Expected Commission",
        required: false,
        aliases: ["expected commission gross", "adjusted expected commission gross"]
      },
      { id: "actualCommission", label: "Actual Commission", required: false, aliases: ["actual commission gross"] },
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
      {
        id: "productNameHouse",
        label: "Product Name (House)",
        required: true,
        aliases: ["product name", "name", "house product name"]
      },
      {
        id: "revenueType",
        label: "Revenue Type",
        required: true,
        aliases: ["revenue type code", "revenue type label"]
      },
      { id: "productNameVendor", label: "Product Name (Vendor)", required: false, aliases: ["other product name"] },
      { id: "productNameDistributor", label: "Product Name (Distributor)", required: false },
      { id: "description", label: "Description", required: false, aliases: ["house description"] },
      { id: "productDescriptionVendor", label: "Vendor Description", required: false, aliases: ["other product description"] },
      { id: "priceEach", label: "Price Each", required: false, aliases: ["price"] },
      {
        id: "commissionPercent",
        label: "Commission Percent",
        required: false,
        aliases: ["commission", "commission %"]
      },
      { id: "isActive", label: "Is Active", required: false, aliases: ["active"] },
      { id: "partNumberHouse", label: "Part Number (House)", required: false, aliases: ["house part number"] },
      { id: "partNumberVendor", label: "Part Number (Vendor)", required: false, aliases: ["vendor part number", "other part number"] },
      { id: "vendorAccountName", label: "Vendor Account Name", required: false, aliases: ["vendor", "vendor name"] },
      {
        id: "distributorAccountName",
        label: "Distributor Account Name",
        required: false,
        aliases: ["distributor", "distributor name"]
      },
      { id: "productFamilyHouse", label: "Product Family (House)", required: false, aliases: ["house product family"] },
      { id: "productSubtypeHouse", label: "Product Subtype (House)", required: false, aliases: ["house product subtype"] },
      { id: "productFamilyVendor", label: "Product Family (Vendor)", required: false },
      { id: "productSubtypeVendor", label: "Product Subtype (Vendor)", required: false },
      { id: "distributorProductFamily", label: "Product Family (Distributor)", required: false },
      { id: "distributorProductSubtype", label: "Product Subtype (Distributor)", required: false }
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
