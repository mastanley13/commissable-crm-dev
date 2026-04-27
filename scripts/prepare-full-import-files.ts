import fs from "node:fs/promises"
import path from "node:path"

import XLSX from "xlsx"

type WorkbookName =
  | "Master Accounts File.xlsx"
  | "Master Contacts File.xlsx"
  | "Master Opportunity File.xlsx"
  | "Master Revenue Schedule File.xlsx"
  | "Products_classified.xlsx"

type SourceRef = {
  workbook: WorkbookName
  sheet: string
  rowNumber: number
}

type CrosswalkRow = {
  sourceName: string
  canonicalName: string
  status: string
  sourceWorkbooks: string
  sourceIds: string
  notes: string
}

type ExceptionRow = Record<string, string>

type SummarySection = {
  sourceRows: number
  canonicalRows: number
  exceptionRows: number
  supplementalRows: number
}

type ProductCatalogRow = {
  sourceRef: SourceRef
  productCode: string
  productNameHouse: string
  productNameVendor: string
  description: string
  vendorDescription: string
  partNumberHouse: string
  partNumberVendor: string
  vendorAccountName: string
  distributorAccountName: string
  productFamilyHouse: string
  productSubtypeHouse: string
  revenueType: string
  isActive: string
  priceEach: string
  commissionPercent: string
}

type ProductMatchCandidate = {
  product: ProductCatalogRow
  score: number
  matchedSignals: number
  matchedBy: string[]
}

type ReferenceResolutionOptions = {
  allowReferenceOnlyAccounts?: boolean
}

type AccountResolutionStatus =
  | "master_exact"
  | "alias_to_master"
  | "resolved_by_source_id"
  | "normalized_match"
  | "approved_supplemental_account"
  | "alias_to_approved_supplemental"
  | "reference_only_blocker"
  | "derived_account"
  | "alias_to_derived"
  | "blank"
  | "unresolved"

const REPO_ROOT = process.cwd()
const SOURCE_DIR = path.join(REPO_ROOT, "2026-04-17_Import_Test_Data")
const OUTPUT_DIR = path.join(REPO_ROOT, "docs", "test-data", "data-settings-imports", "full-import")

const ACCOUNT_FILE = "Master Accounts File.xlsx" as const
const CONTACT_FILE = "Master Contacts File.xlsx" as const
const OPPORTUNITY_FILE = "Master Opportunity File.xlsx" as const
const REVENUE_FILE = "Master Revenue Schedule File.xlsx" as const
const PRODUCT_FILE = "Products_classified.xlsx" as const

const PRODUCT_REVENUE_TYPE_MAP = new Map<string, string>([
  ["MRC - 3rd Party", "MRC_ThirdParty"],
  ["MRC - Agency", "MRC_House"],
  ["NRC - % of Usage", "NRC_Percent"],
  ["NRC - Per Item", "NRC_PerItem"],
  ["NRC - Resale (Buy/Sell)", "NRC_Resale"],
  ["NRC - SPIFF - Flat Fee", "NRC_FlatFee"]
])

const STAGE_VALUE_MAP = new Map<string, string>([
  ["Closed Billing Ended", "ClosedWon_BillingEnded"],
  ["Closed Billing and Commissioning", "ClosedWon_Billing"]
])

const ACCOUNT_ALIAS_MAP = new Map<string, { canonicalName: string; notes: string }>([
  [
    "Cloud and Wire, LLC - Customer",
    {
      canonicalName: "Cloud & Wire LLC",
      notes: "Resolved by matching source Account ID 0013i00000DQmNcAAL to the customer master workbook."
    }
  ],
  [
    "Edge Business Systems - Roswell (HQ)",
    {
      canonicalName: "Edge Business Systems",
      notes: "Resolved by matching source Account ID 0013i00000GaROkAAN to the customer master workbook."
    }
  ],
  [
    "Edge Business System - Athens",
    {
      canonicalName: "Edge Business Systems - Athens",
      notes: "Resolved by matching source Account ID 0013i00002dK5bAAAS to the customer master workbook."
    }
  ],
  [
    "Facilitec ï¿½ Office Interiors",
    {
      canonicalName: "Facilitec – Office Interiors",
      notes: "Resolved by matching source Account ID 0013i00000DQlwMAAT to the customer master workbook."
    }
  ],
  [
    "Palo Alto Inc",
    {
      canonicalName: "Palo Alto, Inc",
      notes: "Approved downstream contact/product reference resolved to the generated Palo Alto, Inc vendor account."
    }
  ]
])

const DISTRIBUTOR_ALIAS_MAP = new Map<string, { canonicalName: string; notes: string }>([
  [
    "AvantCRE",
    {
      canonicalName: "Avant-Cresa",
      notes: "Collapsed alternate spelling into the derived distributor account used by the opportunity and product workbooks."
    }
  ],
  [
    "Avant-Cresa",
    {
      canonicalName: "Avant-Cresa",
      notes: "Approved legacy distributor reference from source opportunity/product references; generated as a supplemental distributor account."
    }
  ],
  [
    "Telarus-Cresa",
    {
      canonicalName: "Telarus-Cresa",
      notes:
        "Approved legacy distributor/product commission-rate structure from source opportunity/product references; generated as a supplemental distributor account."
    }
  ]
])

const VENDOR_ALIAS_MAP = new Map<string, { canonicalName: string; notes: string }>([
  ["Advantix Solutions", { canonicalName: "Advantix", notes: "Alias matched to master vendor account." }],
  ["CenturyLink (Level3)", { canonicalName: "Lumen", notes: "Legacy brand mapped to the current master vendor account." }],
  ["Cloud and Wire", { canonicalName: "Cloud and Wire, LLC - HOUSE", notes: "Alias matched to master vendor account." }],
  ["Cloud and Wire, LLC", { canonicalName: "Cloud and Wire, LLC - HOUSE", notes: "Alias matched to master vendor account." }],
  ["Cyber Wurx", { canonicalName: "CyberWurx", notes: "Punctuation variant matched to master vendor account." }],
  ["Equinix - ATL1", { canonicalName: "Equinix", notes: "Site-specific label mapped to the master vendor account." }],
  ["Fusion Connect Connect", { canonicalName: "Fusion Connect", notes: "Duplicate label normalized to the master vendor account." }],
  ["Itel Networks", { canonicalName: "iTel Networks", notes: "Case variant matched to master vendor account." }],
  ["Lingo / Bullseye", { canonicalName: "Lingo", notes: "Legacy Bullseye bundle label mapped to the master vendor account." }],
  ["Savant", { canonicalName: "Savant CTS", notes: "Short label mapped to the master vendor account." }],
  ["Spectrum Business", { canonicalName: "Spectrum", notes: "Business label mapped to the master vendor account." }],
  ["1Path", { canonicalName: "OnePath", notes: "Source master vendor row normalized to the approved OnePath spelling." }],
  ["Palo Alto Inc", { canonicalName: "Palo Alto, Inc", notes: "Approved generated vendor account from source contact/product references." }],
  ["Palo Alto, Inc", { canonicalName: "Palo Alto, Inc", notes: "Approved generated vendor account from source contact/product references." }],
  ["Light Networks", { canonicalName: "Light Networks", notes: "Approved generated vendor account from source product references." }],
  ["OnePath", { canonicalName: "OnePath", notes: "Approved legacy vendor spelling supported by source product and revenue references." }]
])

const SOURCE_VENDOR_ACCOUNT_RENAME_MAP = new Map<string, { canonicalName: string; notes: string }>([
  ["1Path", { canonicalName: "OnePath", notes: "Source master vendor row normalized to the approved OnePath spelling." }]
])

const APPROVED_SUPPLEMENTAL_ACCOUNT_NAMES = new Set(["Telarus-Cresa", "Avant-Cresa", "Palo Alto, Inc", "Light Networks"])

const APPROVED_LEGACY_DISTRIBUTOR_NAMES = new Set(["Telarus-Cresa", "Avant-Cresa"])

const ACCOUNT_HEADERS = [
  "Account Name",
  "Account Number",
  "Account Type",
  "Account Legal Name",
  "Website URL",
  "Description",
  "Parent Account Name",
  "Billing Same As Shipping",
  "Shipping Street",
  "Shipping City",
  "Shipping State",
  "Shipping Zip",
  "Billing Street",
  "Billing City",
  "Billing State",
  "Billing Zip"
] as const

const ACCOUNT_EXCEPTION_HEADERS = [
  "Source Workbook",
  "Source Sheet",
  "Source Row Number",
  "Reason",
  "Reason Detail",
  "Account Name",
  "Account Number",
  "Account Type",
  "Account Legal Name",
  "Parent Account Name",
  "Website URL",
  "Description"
] as const

const CONTACT_HEADERS = [
  "Account Name",
  "First Name",
  "Last Name",
  "Job Title",
  "Work Phone",
  "Work Phone Extension",
  "Mobile Phone",
  "Email Address",
  "Description"
] as const

const CONTACT_EXCEPTION_HEADERS = [
  "Source Workbook",
  "Source Sheet",
  "Source Row Number",
  "Reason",
  "Reason Detail",
  "Canonical Account Name",
  "Contact ID",
  "First Name",
  "Last Name",
  "Account Name",
  "Title",
  "Email",
  "Mobile Phone",
  "Work Phone",
  "Work Extension",
  "Description"
] as const

const PRODUCT_HEADERS = [
  "Product Code",
  "Product Name (House)",
  "Revenue Type",
  "Product Name (Vendor)",
  "Description",
  "Vendor Description",
  "Price Each",
  "Commission Percent",
  "Is Active",
  "Part Number (House)",
  "Part Number (Vendor)",
  "Vendor Account Name",
  "Distributor Account Name",
  "Product Family (House)",
  "Product Subtype (House)"
] as const

const PRODUCT_EXCEPTION_HEADERS = [
  "Source Workbook",
  "Source Sheet",
  "Source Row Number",
  "Reason",
  "Reason Detail",
  "Salesforce Product ID",
  "House - Product Name",
  "House - Part Number",
  "Distributor Name",
  "Vendor Name",
  "Revenue Type",
  "Status"
] as const

const OPPORTUNITY_HEADERS = [
  "Account Name",
  "Opportunity Name",
  "Role",
  "Role Contact Email",
  "Stage",
  "Description"
] as const

const OPPORTUNITY_EXCEPTION_HEADERS = [
  "Source Workbook",
  "Source Sheet",
  "Source Row Number",
  "Reason",
  "Reason Detail",
  "Canonical Account Name",
  "Canonical Distributor Name",
  "Canonical Vendor Name",
  "Canonical Stage",
  "Opportunity Number",
  "Opportunity Name",
  "Stage",
  "Account Name",
  "Distributor Name",
  "Vendor Name"
] as const

const REVENUE_HEADERS = [
  "Account Name",
  "Schedule Date",
  "Schedule Type",
  "Opportunity Name",
  "Product Code",
  "Expected Usage",
  "Actual Usage",
  "Expected Commission",
  "Actual Commission",
  "House Order ID",
  "Distributor Order ID",
  "Notes"
] as const

const REVENUE_EXCEPTION_HEADERS = [
  "Source Workbook",
  "Source Sheet",
  "Source Row Number",
  "Reason",
  "Reason Detail",
  "Canonical Account Name",
  "Canonical Vendor Name",
  "Canonical Distributor Name",
  "Product Match Candidates",
  "Revenue Schedule Name",
  "Record_Type",
  "Account Name",
  "Distributor Name",
  "Vendor Name",
  "Opportunity Name",
  "Product Name",
  "Cloud & Wire Product SKU",
  "Vendor Product SKU",
  "Distributor Product SKU",
  "Revenue Schedule Date",
  "Payment Type",
  "Adj Exp Total Usage (Billing)",
  "Actual Billed",
  "Adjusted Expected Commission - Gross",
  "Actual Commission - Gross"
] as const

type SourceAccountRow = {
  sourceRef: SourceRef
  salesforceId: string
  accountName: string
  accountLegalName: string
  parentAccountName: string
  accountType: "Customer" | "Distributor" | "Vendor"
  websiteUrl: string
  description: string
  shippingStreet: string
  shippingCity: string
  shippingState: string
  shippingZip: string
  billingStreet: string
  billingCity: string
  billingState: string
  billingZip: string
}

type SourceContactRow = {
  sourceRef: SourceRef
  contactId: string
  firstName: string
  lastName: string
  accountName: string
  title: string
  email: string
  mobilePhone: string
  workPhone: string
  workExtension: string
  description: string
}

type SourceOpportunityRow = {
  sourceRef: SourceRef
  opportunityNumber: string
  opportunityName: string
  stage: string
  accountName: string
  distributorName: string
  vendorName: string
}

type SourceRevenueRow = {
  sourceRef: SourceRef
  recordType: string
  distributorName: string
  distributorId: string
  vendorId: string
  vendorName: string
  vendorAccountId: string
  accountId: string
  accountName: string
  accountLegalName: string
  opportunityNumber: string
  opportunityName: string
  productName: string
  productFamily: string
  distributorProductSku: string
  vendorProductSku: string
  cloudWireProductSku: string
  revenueScheduleName: string
  expectedUsage: string
  actualUsage: string
  expectedCommission: string
  actualCommission: string
  opportunityStage: string
  revenueScheduleDateRaw: string
  paymentType: string
}

function normalizeLookup(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
}

function trimCell(value: unknown) {
  return String(value ?? "").trim()
}

function toBooleanString(value: boolean) {
  return value ? "true" : "false"
}

function formatDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const trimmed = trimCell(value)
  if (!trimmed) {
    return ""
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(trimmed)) {
    const [month, day, rawYear] = trimmed.split("/")
    const year =
      rawYear.length === 2
        ? Number(rawYear) >= 70
          ? `19${rawYear}`
          : `20${rawYear}`
        : rawYear
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }
  const serial = Number(trimmed)
  if (Number.isFinite(serial)) {
    const parsed = XLSX.SSF.parse_date_code(serial)
    if (parsed) {
      return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`
    }
  }
  return trimmed
}

function normalizeAddressLine(value: string) {
  return value.replace(/\r?\n/g, ", ").replace(/\s+/g, " ").trim()
}

function addressesMatch(row: SourceAccountRow) {
  const shipping = [
    normalizeAddressLine(row.shippingStreet),
    row.shippingCity.trim(),
    row.shippingState.trim(),
    row.shippingZip.trim()
  ]
    .join("|")
    .toLowerCase()
  const billing = [
    normalizeAddressLine(row.billingStreet),
    row.billingCity.trim(),
    row.billingState.trim(),
    row.billingZip.trim()
  ]
    .join("|")
    .toLowerCase()
  return Boolean(shipping && shipping === billing)
}

function csvEscape(value: unknown) {
  const stringValue = String(value ?? "")
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

async function writeCsv(filePath: string, headers: readonly string[], rows: Array<Record<string, string>>) {
  const lines = [headers.map(csvEscape).join(",")]
  for (const row of rows) {
    lines.push(headers.map(header => csvEscape(row[header] ?? "")).join(","))
  }
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8")
}

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
}

function workbookPath(fileName: WorkbookName) {
  return path.join(SOURCE_DIR, fileName)
}

function readSheetRows(fileName: WorkbookName, sheetName: string) {
  const workbook = XLSX.readFile(workbookPath(fileName), { cellDates: true })
  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" was not found in ${fileName}.`)
  }
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "", raw: false })
}

function readAccounts() {
  const customers = readSheetRows(ACCOUNT_FILE, "Accounts").map<SourceAccountRow>((row, index) => ({
    sourceRef: { workbook: ACCOUNT_FILE, sheet: "Accounts", rowNumber: index + 2 },
    salesforceId: trimCell(row["Salesforce ID"]),
    accountName: trimCell(row["Account Name"]),
    accountLegalName: trimCell(row["Account Legal Name"]),
    parentAccountName: trimCell(row["Parent Account"]),
    accountType: "Customer",
    websiteUrl: trimCell(row["Website URL"]),
    description: trimCell(row["Description"]),
    shippingStreet: trimCell(row["Shipping Street"]),
    shippingCity: trimCell(row["Shipping City"]),
    shippingState: trimCell(row["Shipping State"]),
    shippingZip: trimCell(row["Shipping Zip"]),
    billingStreet: trimCell(row["Billing Street"]),
    billingCity: trimCell(row["Billing City"]),
    billingState: trimCell(row["Billing State"]),
    billingZip: trimCell(row["Billing Zip"])
  }))

  const distributors = readSheetRows(ACCOUNT_FILE, "Distributors").map<SourceAccountRow>((row, index) => ({
    sourceRef: { workbook: ACCOUNT_FILE, sheet: "Distributors", rowNumber: index + 2 },
    salesforceId: trimCell(row["Salesforce ID"]),
    accountName: trimCell(row["Account Name"]),
    accountLegalName: trimCell(row["Account Legal Name"]),
    parentAccountName: trimCell(row["Parent Account"]),
    accountType: "Distributor",
    websiteUrl: trimCell(row["Website URL"]),
    description: "",
    shippingStreet: trimCell(row["Shipping Street"]),
    shippingCity: trimCell(row["Shipping City"]),
    shippingState: trimCell(row["Shipping State"]),
    shippingZip: trimCell(row["Shipping Zip"]),
    billingStreet: trimCell(row["Billing Street"]),
    billingCity: trimCell(row["Billing City"]),
    billingState: trimCell(row["Billing State"]),
    billingZip: trimCell(row["Billing Zip"])
  }))

  const vendors = readSheetRows(ACCOUNT_FILE, "Vendors").map<SourceAccountRow>((row, index) => {
    const sourceAccountName = trimCell(row["Account Name"])
    const rename = SOURCE_VENDOR_ACCOUNT_RENAME_MAP.get(sourceAccountName)
    const accountName = rename?.canonicalName ?? sourceAccountName

    return {
      sourceRef: { workbook: ACCOUNT_FILE, sheet: "Vendors", rowNumber: index + 2 },
      salesforceId: trimCell(row["Salesforce ID"]),
      accountName,
      accountLegalName: rename?.canonicalName ?? trimCell(row["Account Legal Name"]),
      parentAccountName: "",
      accountType: "Vendor",
      websiteUrl: "",
      description: rename?.notes ?? "",
      shippingStreet: trimCell(row["Shipping Street"]),
      shippingCity: trimCell(row["Shipping City"]),
      shippingState: trimCell(row["Shipping State"]),
      shippingZip: trimCell(row["Shipping Zip"]),
      billingStreet: trimCell(row["Billing Street"]),
      billingCity: trimCell(row["Billing City"]),
      billingState: trimCell(row["Billing State"]),
      billingZip: trimCell(row["Billing Zip"])
    }
  })

  return { customers, distributors, vendors }
}

function readContacts() {
  return readSheetRows(CONTACT_FILE, "contacts_export (1)").map<SourceContactRow>((row, index) => ({
    sourceRef: { workbook: CONTACT_FILE, sheet: "contacts_export (1)", rowNumber: index + 2 },
    contactId: trimCell(row["Contact ID"]),
    firstName: trimCell(row["First Name"]),
    lastName: trimCell(row["Last Name"]),
    accountName: trimCell(row["Account Name"]),
    title: trimCell(row["Title"]),
    email: trimCell(row["Email"]),
    mobilePhone: trimCell(row["Mobile Phone"]),
    workPhone: trimCell(row["Work Phone"]),
    workExtension: trimCell(row["Work Extension"]),
    description: trimCell(row["Description"])
  }))
}

function readOpportunities() {
  return readSheetRows(OPPORTUNITY_FILE, "Opportunities - All").map<SourceOpportunityRow>((row, index) => ({
    sourceRef: { workbook: OPPORTUNITY_FILE, sheet: "Opportunities - All", rowNumber: index + 2 },
    opportunityNumber: trimCell(row["Opportunity Number"]),
    opportunityName: trimCell(row["Opportunity Name"]),
    stage: trimCell(row["Stage"]),
    accountName: trimCell(row["Account Name"]),
    distributorName: trimCell(row["Distributor Name"]),
    vendorName: trimCell(row["Vendor Name"])
  }))
}

function readRevenueRows(sheetName: "Revenue Schedules - settled" | "Revenue Schedules - Open") {
  return readSheetRows(REVENUE_FILE, sheetName).map<SourceRevenueRow>((row, index) => ({
    sourceRef: { workbook: REVENUE_FILE, sheet: sheetName, rowNumber: index + 2 },
    recordType: trimCell(row["Record_Type"]),
    distributorName: trimCell(row["Distributor Name"]),
    distributorId: trimCell(row["Distributor Id"]),
    vendorId: trimCell(row["Vendor Id"]),
    vendorName: trimCell(row["Vendor Name"]),
    vendorAccountId: trimCell(row["Vendor Account ID"]),
    accountId: trimCell(row["Account ID"]),
    accountName: trimCell(row["Account Name"]),
    accountLegalName: trimCell(row["Account Legal Name"]),
    opportunityNumber: trimCell(row["Opportunity Number"]),
    opportunityName: trimCell(row["Opportunity Name"]),
    productName: trimCell(row["Product Name"]),
    productFamily: trimCell(row["Product Family"]),
    distributorProductSku: trimCell(row["Distributor Product SKU"]),
    vendorProductSku: trimCell(row["Vendor Product SKU"]),
    cloudWireProductSku: trimCell(row["Cloud & Wire Product SKU"]),
    revenueScheduleName: trimCell(row["Revenue Schedule Name"]),
    expectedUsage: trimCell(row["Adj Exp Total Usage (Billing)"]),
    actualUsage: trimCell(row["Actual Billed"]),
    expectedCommission: trimCell(row["Adjusted Expected Commission - Gross"]) || trimCell(row["Expected Commission Gross"]),
    actualCommission: trimCell(row["Actual Commission - Gross"]),
    opportunityStage: trimCell(row["Opportunity Stage"]),
    revenueScheduleDateRaw: formatDate(row["Revenue Schedule Date"]),
    paymentType: trimCell(row["Payment Type"])
  }))
}

function readProducts() {
  return readSheetRows(PRODUCT_FILE, "Opportunity Products")
}

function buildAccountLookups(accounts: SourceAccountRow[]) {
  const byName = new Map<string, SourceAccountRow>()
  const byId = new Map<string, SourceAccountRow>()
  const byLegal = new Map<string, SourceAccountRow>()

  for (const account of accounts) {
    byName.set(account.accountName, account)
    if (account.salesforceId) {
      byId.set(account.salesforceId, account)
    }
    if (account.accountLegalName) {
      byLegal.set(normalizeLookup(account.accountLegalName), account)
    }
  }

  return { byName, byId, byLegal }
}

function buildNameIndex(accounts: SourceAccountRow[]) {
  const index = new Map<string, SourceAccountRow>()
  for (const account of accounts) {
    index.set(normalizeLookup(account.accountName), account)
    if (account.accountLegalName) {
      index.set(normalizeLookup(account.accountLegalName), account)
    }
  }
  return index
}

function canonicalizeAccountName(
  value: string,
  refs: SourceRef[],
  accountByName: Map<string, SourceAccountRow>,
  accountById: Map<string, SourceAccountRow>,
  accountNameIndex: Map<string, SourceAccountRow>
) {
  const exact = accountByName.get(value)
  if (exact) {
    return { canonicalName: exact.accountName, status: "master_exact", notes: "" }
  }

  const alias = ACCOUNT_ALIAS_MAP.get(value)
  if (alias) {
    const aliasTarget = accountNameIndex.get(normalizeLookup(alias.canonicalName))
    const status: AccountResolutionStatus =
      aliasTarget?.sourceRef.rowNumber === 0 ? "alias_to_approved_supplemental" : "alias_to_master"
    return { canonicalName: alias.canonicalName, status, notes: alias.notes }
  }

  for (const ref of refs) {
    const sourceId = getSourceAccountIdForRef(ref)
    if (!sourceId) {
      continue
    }
    const matchedById = accountById.get(sourceId)
    if (matchedById) {
      return {
        canonicalName: matchedById.accountName,
        status: "resolved_by_source_id",
        notes: `Resolved by source Account ID ${sourceId}.`
      }
    }
  }

  const normalized = accountNameIndex.get(normalizeLookup(value))
  if (normalized) {
    return {
      canonicalName: normalized.accountName,
      status: "normalized_match",
      notes: "Resolved by normalized account or legal name match."
    }
  }

  return { canonicalName: "", status: "unresolved", notes: "No matching customer, distributor, or vendor account exists in the source account workbook." }
}

function canonicalizeDistributorName(
  value: string,
  distributorIndex: Map<string, SourceAccountRow>,
  options: ReferenceResolutionOptions = {}
) {
  if (!value) {
    return { canonicalName: "", status: "blank", notes: "" }
  }
  const exact = distributorIndex.get(normalizeLookup(value))
  if (exact) {
    const status: AccountResolutionStatus = exact.sourceRef.rowNumber === 0 ? "approved_supplemental_account" : "master_exact"
    return { canonicalName: exact.accountName, status, notes: "" }
  }
  const alias = DISTRIBUTOR_ALIAS_MAP.get(value)
  if (alias) {
    const aliasTarget = distributorIndex.get(normalizeLookup(alias.canonicalName))
    if (aliasTarget) {
      const status: AccountResolutionStatus =
        aliasTarget.sourceRef.rowNumber === 0 ? "alias_to_approved_supplemental" : "alias_to_master"
      return { canonicalName: aliasTarget.accountName, status, notes: alias.notes }
    }
    if (options.allowReferenceOnlyAccounts === false) {
      return {
        canonicalName: "",
        status: "reference_only_blocker",
        notes: `${alias.notes} Human approval is required before this reference-only distributor can be imported or mapped.`
      }
    }
    return { canonicalName: alias.canonicalName, status: alias.canonicalName === value ? "derived_account" : "alias_to_derived", notes: alias.notes }
  }
  return { canonicalName: value, status: "unresolved", notes: "No master or derived distributor mapping exists." }
}

function canonicalizeVendorName(
  value: string,
  vendorIndex: Map<string, SourceAccountRow>,
  options: ReferenceResolutionOptions = {}
) {
  if (!value) {
    return { canonicalName: "", status: "blank", notes: "" }
  }
  const exact = vendorIndex.get(normalizeLookup(value))
  if (exact) {
    const status: AccountResolutionStatus = exact.sourceRef.rowNumber === 0 ? "approved_supplemental_account" : "master_exact"
    return { canonicalName: exact.accountName, status, notes: "" }
  }
  const alias = VENDOR_ALIAS_MAP.get(value)
  if (alias) {
    const aliasTarget = vendorIndex.get(normalizeLookup(alias.canonicalName))
    if (aliasTarget) {
      const status: AccountResolutionStatus =
        aliasTarget.sourceRef.rowNumber === 0 ? "alias_to_approved_supplemental" : "alias_to_master"
      return { canonicalName: aliasTarget.accountName, status, notes: alias.notes }
    }
    if (options.allowReferenceOnlyAccounts === false) {
      return {
        canonicalName: "",
        status: "reference_only_blocker",
        notes: `${alias.notes} Human approval is required before this reference-only vendor can be imported or mapped.`
      }
    }
    const status = alias.canonicalName === value ? "derived_account" : "alias_to_master"
    return { canonicalName: alias.canonicalName, status, notes: alias.notes }
  }
  return { canonicalName: value, status: "unresolved", notes: "No master or derived vendor mapping exists." }
}

const sourceAccountIdByRef = new Map<string, string>()

function sourceRefKey(ref: SourceRef) {
  return `${ref.workbook}::${ref.sheet}::${ref.rowNumber}`
}

function getSourceAccountIdForRef(ref: SourceRef) {
  return sourceAccountIdByRef.get(sourceRefKey(ref)) ?? ""
}

function registerAccountSourceId(ref: SourceRef, accountId: string) {
  if (accountId) {
    sourceAccountIdByRef.set(sourceRefKey(ref), accountId)
  }
}

function registerVendorSourceId(ref: SourceRef, vendorId: string) {
  if (vendorId) {
    sourceAccountIdByRef.set(sourceRefKey(ref), vendorId)
  }
}

function buildCrosswalkRows(
  valuesToRefs: Map<string, SourceRef[]>,
  resolver: (value: string, refs: SourceRef[]) => { canonicalName: string; status: string; notes: string }
) {
  const rows: CrosswalkRow[] = []
  for (const [sourceName, refs] of [...valuesToRefs.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const resolved = resolver(sourceName, refs)
    const sourceIds = [...new Set(refs.map(ref => getSourceAccountIdForRef(ref)).filter(Boolean))].join(" | ")
    rows.push({
      sourceName,
      canonicalName: resolved.canonicalName,
      status: resolved.status,
      sourceWorkbooks: [...new Set(refs.map(ref => ref.workbook))].join(" | "),
      sourceIds,
      notes: resolved.notes
    })
  }
  return rows
}

function buildValuesToRefs(rows: Array<{ value: string; sourceRef: SourceRef }>) {
  const map = new Map<string, SourceRef[]>()
  for (const row of rows) {
    if (!row.value) {
      continue
    }
    const list = map.get(row.value) ?? []
    list.push(row.sourceRef)
    map.set(row.value, list)
  }
  return map
}

function buildDerivedDistributorAccounts(baseDistributors: SourceAccountRow[]) {
  const rows: SourceAccountRow[] = []
  for (const [sourceName, alias] of DISTRIBUTOR_ALIAS_MAP.entries()) {
    if (alias.canonicalName !== sourceName) {
      continue
    }
    if (!APPROVED_SUPPLEMENTAL_ACCOUNT_NAMES.has(alias.canonicalName)) {
      continue
    }
    rows.push({
      sourceRef: { workbook: OPPORTUNITY_FILE, sheet: "Opportunities - All", rowNumber: 0 },
      salesforceId: "",
      accountName: alias.canonicalName,
      accountLegalName: alias.canonicalName,
      parentAccountName: alias.canonicalName.startsWith("Telarus") ? "Telarus" : "Avant",
      accountType: "Distributor",
      websiteUrl: "",
      description: "Approved supplemental account generated from source opportunity/product references for import alignment.",
      shippingStreet: "",
      shippingCity: "",
      shippingState: "",
      shippingZip: "",
      billingStreet: "",
      billingCity: "",
      billingState: "",
      billingZip: ""
    })
  }

  const existingNames = new Set(baseDistributors.map(row => row.accountName))
  return rows.filter(row => !existingNames.has(row.accountName))
}

function buildDerivedVendorAccounts(baseVendors: SourceAccountRow[]) {
  const derivedSourceNames = [...VENDOR_ALIAS_MAP.entries()]
    .filter(([, value]) => APPROVED_SUPPLEMENTAL_ACCOUNT_NAMES.has(value.canonicalName))
    .map(([, value]) => value.canonicalName)

  const uniqueNames = [...new Set(derivedSourceNames)].sort((a, b) => a.localeCompare(b))
  const existingNames = new Set(baseVendors.map(row => row.accountName))

  return uniqueNames
    .filter(name => !existingNames.has(name))
    .map<SourceAccountRow>(name => ({
      sourceRef: { workbook: PRODUCT_FILE, sheet: "Opportunity Products", rowNumber: 0 },
      salesforceId: "",
      accountName: name,
      accountLegalName: name,
      parentAccountName: "",
      accountType: "Vendor",
      websiteUrl: "",
      description: "Approved supplemental account generated from source downstream references for import alignment.",
      shippingStreet: "",
      shippingCity: "",
      shippingState: "",
      shippingZip: "",
      billingStreet: "",
      billingCity: "",
      billingState: "",
      billingZip: ""
    }))
}

function accountRowToCsv(row: SourceAccountRow) {
  return {
    "Account Name": row.accountName,
    "Account Number": row.salesforceId,
    "Account Type": row.accountType,
    "Account Legal Name": row.accountLegalName,
    "Website URL": row.websiteUrl,
    Description: row.description,
    "Parent Account Name": row.parentAccountName,
    "Billing Same As Shipping": toBooleanString(addressesMatch(row)),
    "Shipping Street": normalizeAddressLine(row.shippingStreet),
    "Shipping City": row.shippingCity,
    "Shipping State": row.shippingState,
    "Shipping Zip": row.shippingZip,
    "Billing Street": normalizeAddressLine(row.billingStreet),
    "Billing City": row.billingCity,
    "Billing State": row.billingState,
    "Billing Zip": row.billingZip
  }
}

function countFilledAccountFields(row: SourceAccountRow) {
  return [
    row.salesforceId,
    row.accountLegalName,
    row.parentAccountName,
    row.websiteUrl,
    row.description,
    row.shippingStreet,
    row.shippingCity,
    row.shippingState,
    row.shippingZip,
    row.billingStreet,
    row.billingCity,
    row.billingState,
    row.billingZip
  ].filter(Boolean).length
}

function chooseCanonicalAccountRow(rows: SourceAccountRow[]) {
  return [...rows].sort((left, right) => {
    const scoreDiff = countFilledAccountFields(right) - countFilledAccountFields(left)
    if (scoreDiff !== 0) {
      return scoreDiff
    }
    return right.sourceRef.rowNumber - left.sourceRef.rowNumber
  })[0]
}

function accountRowToException(
  row: SourceAccountRow,
  reason: string,
  reasonDetail: string
): Record<(typeof ACCOUNT_EXCEPTION_HEADERS)[number], string> {
  return {
    "Source Workbook": row.sourceRef.workbook,
    "Source Sheet": row.sourceRef.sheet,
    "Source Row Number": row.sourceRef.rowNumber > 0 ? String(row.sourceRef.rowNumber) : "",
    Reason: reason,
    "Reason Detail": reasonDetail,
    "Account Name": row.accountName,
    "Account Number": row.salesforceId,
    "Account Type": row.accountType,
    "Account Legal Name": row.accountLegalName,
    "Parent Account Name": row.parentAccountName,
    "Website URL": row.websiteUrl,
    Description: row.description
  }
}

function splitSafeAccountRows(rows: SourceAccountRow[]) {
  const rowsByName = new Map<string, SourceAccountRow[]>()
  for (const row of rows) {
    const list = rowsByName.get(row.accountName) ?? []
    list.push(row)
    rowsByName.set(row.accountName, list)
  }

  const canonicalRows: SourceAccountRow[] = []
  const exceptionRows: Array<Record<(typeof ACCOUNT_EXCEPTION_HEADERS)[number], string>> = []

  for (const groupedRows of rowsByName.values()) {
    if (groupedRows.length === 1) {
      canonicalRows.push(groupedRows[0])
      continue
    }

    const selectedRow = chooseCanonicalAccountRow(groupedRows)
    canonicalRows.push(selectedRow)

    for (const row of groupedRows) {
      if (row === selectedRow) {
        continue
      }
      exceptionRows.push(
        accountRowToException(
          row,
          "Duplicate Account Name importer collision",
          `Account import upserts by Account Name. Kept source row ${selectedRow.sourceRef.rowNumber} from sheet ${selectedRow.sourceRef.sheet} because it had the most complete field set for "${row.accountName}".`
        )
      )
    }
  }

  canonicalRows.sort((left, right) => left.sourceRef.rowNumber - right.sourceRef.rowNumber)

  return { canonicalRows, exceptionRows }
}

function buildProductCatalog(
  productRows: Record<string, unknown>[],
  vendorIndex: Map<string, SourceAccountRow>,
  distributorIndex: Map<string, SourceAccountRow>
) {
  const canonicalRows: ProductCatalogRow[] = []
  const exceptions: ExceptionRow[] = []

  for (let index = 0; index < productRows.length; index += 1) {
    const row = productRows[index]
    const sourceRef: SourceRef = { workbook: PRODUCT_FILE, sheet: "Opportunity Products", rowNumber: index + 2 }
    const revenueTypeSource = trimCell(row["Revenue Type"])
    const mappedRevenueType = PRODUCT_REVENUE_TYPE_MAP.get(revenueTypeSource) ?? ""
    const vendorResolution = canonicalizeVendorName(trimCell(row["Vendor Name"]), vendorIndex, {
      allowReferenceOnlyAccounts: false
    })
    const distributorResolution = canonicalizeDistributorName(trimCell(row["Distributor Name"]), distributorIndex, {
      allowReferenceOnlyAccounts: false
    })

    const reasons: string[] = []
    if (!mappedRevenueType) {
      reasons.push(`Revenue Type "${revenueTypeSource}" is not in the explicit product revenue-type map.`)
    }
    if (!vendorResolution.canonicalName) {
      reasons.push(`Vendor "${trimCell(row["Vendor Name"])}" does not have an approved canonical vendor account.`)
    }
    if (!distributorResolution.canonicalName) {
      reasons.push(`Distributor "${trimCell(row["Distributor Name"])}" does not have an approved canonical distributor account.`)
    }

    if (reasons.length > 0) {
      exceptions.push({
        "Source Workbook": sourceRef.workbook,
        "Source Sheet": sourceRef.sheet,
        "Source Row Number": String(sourceRef.rowNumber),
        Reason: "Product row could not be canonicalized",
        "Reason Detail": reasons.join(" "),
        "Salesforce Product ID": trimCell(row["Salesforce Product ID"]),
        "House - Product Name": trimCell(row["House - Product Name"]),
        "House - Part Number": trimCell(row["House - Part Number"]),
        "Distributor Name": trimCell(row["Distributor Name"]),
        "Vendor Name": trimCell(row["Vendor Name"]),
        "Revenue Type": revenueTypeSource,
        Status: trimCell(row["Status"])
      })
      continue
    }

    canonicalRows.push({
      sourceRef,
      productCode: trimCell(row["House - Part Number"]),
      productNameHouse: trimCell(row["House - Product Name"]),
      productNameVendor: trimCell(row["Other - Product Name"]),
      description: trimCell(row["House - Description"]),
      vendorDescription: trimCell(row["Other - Product Description"]),
      partNumberHouse: trimCell(row["House - Part Number"]),
      partNumberVendor: trimCell(row["Other - Part Number"]),
      vendorAccountName: vendorResolution.canonicalName,
      distributorAccountName: distributorResolution.canonicalName,
      productFamilyHouse: trimCell(row["House - Product Family"]),
      productSubtypeHouse: trimCell(row["House - Product Subtype"]),
      revenueType: mappedRevenueType,
      isActive: toBooleanString(
        trimCell(row["Status"]).toLowerCase() === "active" && distributorResolution.canonicalName !== "Telarus-Cresa"
      ),
      priceEach: trimCell(row["Price Each"]),
      commissionPercent: trimCell(row["Commission %"])
    })
  }

  return { canonicalRows, exceptions }
}

function productRowToCsv(row: ProductCatalogRow) {
  return {
    "Product Code": row.productCode,
    "Product Name (House)": row.productNameHouse,
    "Revenue Type": row.revenueType,
    "Product Name (Vendor)": row.productNameVendor,
    Description: row.description,
    "Vendor Description": row.vendorDescription,
    "Price Each": row.priceEach,
    "Commission Percent": row.commissionPercent,
    "Is Active": row.isActive,
    "Part Number (House)": row.partNumberHouse,
    "Part Number (Vendor)": row.partNumberVendor,
    "Vendor Account Name": row.vendorAccountName,
    "Distributor Account Name": row.distributorAccountName,
    "Product Family (House)": row.productFamilyHouse,
    "Product Subtype (House)": row.productSubtypeHouse
  }
}

function buildProductIndex(products: ProductCatalogRow[]) {
  return products.map(product => ({
    product,
    code: product.productCode,
    otherPart: product.partNumberVendor,
    houseName: product.productNameHouse,
    otherName: product.productNameVendor,
    vendor: product.vendorAccountName,
    distributor: product.distributorAccountName
  }))
}

function revenueRowContainsLegacyDistributorSignal(row: SourceRevenueRow, distributorName: string) {
  const values = [
    row.opportunityName,
    row.productName,
    row.distributorProductSku,
    row.vendorProductSku,
    row.cloudWireProductSku
  ]

  if (distributorName === "Telarus-Cresa") {
    return values.some(value => (value ?? "").includes("Telarus-Cresa") || (value ?? "").includes("TELCRE"))
  }

  if (distributorName === "Avant-Cresa") {
    return values.some(value => (value ?? "").includes("Avant-Cresa") || (value ?? "").includes("AVANTCRE"))
  }

  return false
}

function resolveEffectiveRevenueDistributor(
  row: SourceRevenueRow,
  canonicalDistributorName: string,
  distributorIndex: Map<string, SourceAccountRow>
) {
  for (const legacyDistributorName of APPROVED_LEGACY_DISTRIBUTOR_NAMES) {
    if (
      distributorIndex.has(normalizeLookup(legacyDistributorName)) &&
      revenueRowContainsLegacyDistributorSignal(row, legacyDistributorName)
    ) {
      return legacyDistributorName
    }
  }

  return canonicalDistributorName
}

function resolveScheduleProduct(
  row: SourceRevenueRow,
  productIndex: ReturnType<typeof buildProductIndex>,
  canonicalVendorName: string,
  canonicalDistributorName: string
) {
  const vendorSku = row.vendorProductSku
  const distributorSku = row.distributorProductSku
  const cloudSku = row.cloudWireProductSku
  const productName = row.productName
  const candidates: ProductMatchCandidate[] = []

  for (const entry of productIndex) {
    if (canonicalVendorName && entry.vendor && canonicalVendorName !== entry.vendor) {
      continue
    }
    if (canonicalDistributorName && entry.distributor && canonicalDistributorName !== entry.distributor) {
      continue
    }

    let score = 0
    let matchedSignals = 0
    const matchedBy: string[] = []

    if (cloudSku && (cloudSku === entry.code || cloudSku === entry.otherPart)) {
      score += 5
      matchedSignals += 1
      matchedBy.push("cloudWireProductSku")
    }
    if (vendorSku && (vendorSku === entry.code || vendorSku === entry.otherPart)) {
      score += 4
      matchedSignals += 1
      matchedBy.push("vendorProductSku")
    }
    if (distributorSku && (distributorSku === entry.code || distributorSku === entry.otherPart)) {
      score += 4
      matchedSignals += 1
      matchedBy.push("distributorProductSku")
    }
    if (productName && (productName === entry.houseName || productName === entry.otherName)) {
      score += 2
      matchedSignals += 1
      matchedBy.push("productName")
    }

    if (matchedSignals > 0) {
      candidates.push({ product: entry.product, score, matchedSignals, matchedBy })
    }
  }

  candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }
    if (right.matchedSignals !== left.matchedSignals) {
      return right.matchedSignals - left.matchedSignals
    }
    return left.product.productCode.localeCompare(right.product.productCode)
  })

  const top = candidates[0]
  const second = candidates[1]
  if (!top) {
    return {
      status: "no_match" as const,
      candidates
    }
  }
  if (second && top.score === second.score && top.matchedSignals === second.matchedSignals) {
    return {
      status: "ambiguous" as const,
      candidates
    }
  }
  return {
    status: "matched" as const,
    candidates,
    product: top.product
  }
}

function scheduleTypeFromPaymentType(paymentType: string) {
  if (paymentType.startsWith("NRC")) {
    return "OneTime"
  }
  return "Recurring"
}

function buildRevenueNotes(row: SourceRevenueRow, legacyDistributorName = "") {
  const notes = [
    `Source Schedule ${row.revenueScheduleName}`,
    `Record ${row.recordType}`,
    `Payment Type ${row.paymentType}`,
    `Opportunity omitted pending approved opportunity role/contact fallback`
  ]
  if (legacyDistributorName) {
    notes.push(`legacy_commission_rate_structure ${legacyDistributorName}`)
  }
  return notes.join(" | ")
}

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size))
  }
  return chunks
}

function categorizeRevenueException(row: ExceptionRow) {
  const reason = row.Reason ?? ""
  const detail = row["Reason Detail"] ?? ""
  const productIdentifiers = [
    row["Product Name"],
    row["Cloud & Wire Product SKU"],
    row["Vendor Product SKU"],
    row["Distributor Product SKU"]
  ].filter(Boolean)

  if (detail.includes("Multiple products matched")) {
    return "ambiguous product match"
  }
  if (
    reason.includes("upstream reference blocked") ||
    detail.includes("does not resolve to a source-backed") ||
    detail.includes("does not resolve to an approved canonical")
  ) {
    return "expected because upstream opportunity/product/account is blocked"
  }
  if (detail.includes("No confident product match") && productIdentifiers.length === 0) {
    return "source-data gap"
  }
  if (detail.includes("No confident product match")) {
    return "fixable crosswalk/mapping issue"
  }
  return "deferred post-import cleanup"
}

function summarizeRevenueExceptionCategories(rows: ExceptionRow[]) {
  const requiredCategories = [
    "expected because upstream opportunity/product/account is blocked",
    "fixable crosswalk/mapping issue",
    "source-data gap",
    "ambiguous product match",
    "deferred post-import cleanup"
  ]
  const counts = new Map(requiredCategories.map(category => [category, 0]))

  for (const row of rows) {
    const category = categorizeRevenueException(row)
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }

  return requiredCategories.map(category => ({
    Category: category,
    Count: String(counts.get(category) ?? 0)
  }))
}

function summarizeRevenueExceptionTopCauses(rows: ExceptionRow[]) {
  const grouped = new Map<
    string,
    {
      category: string
      reason: string
      reasonDetail: string
      vendorName: string
      distributorName: string
      productName: string
      count: number
    }
  >()

  for (const row of rows) {
    const category = categorizeRevenueException(row)
    const reason = row.Reason ?? ""
    const reasonDetail = row["Reason Detail"] ?? ""
    const vendorName = row["Vendor Name"] ?? ""
    const distributorName = row["Distributor Name"] ?? ""
    const productName = row["Product Name"] ?? ""
    const key = [category, reason, reasonDetail, vendorName, distributorName, productName].join("\u001f")
    const current =
      grouped.get(key) ?? {
        category,
        reason,
        reasonDetail,
        vendorName,
        distributorName,
        productName,
        count: 0
      }
    current.count += 1
    grouped.set(key, current)
  }

  return Array.from(grouped.values())
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category))
    .slice(0, 25)
    .map(row => ({
      Category: row.category,
      Count: String(row.count),
      Reason: row.reason,
      "Reason Detail": row.reasonDetail,
      "Vendor Name": row.vendorName,
      "Distributor Name": row.distributorName,
      "Product Name": row.productName
    }))
}

async function main() {
  await ensureOutputDir()

  const { customers, distributors, vendors } = readAccounts()
  const contacts = readContacts()
  const opportunities = readOpportunities()
  const revenueSettled = readRevenueRows("Revenue Schedules - settled")
  const revenueOpen = readRevenueRows("Revenue Schedules - Open")
  const productRows = readProducts()

  const allBaseAccounts = [...customers, ...distributors, ...vendors]
  const baseAccountLookups = buildAccountLookups(allBaseAccounts)
  const supplementalDistributorAccounts = buildDerivedDistributorAccounts(distributors)
  const supplementalVendorAccounts = buildDerivedVendorAccounts(vendors)
  const allAccountsForResolution = [...allBaseAccounts, ...supplementalDistributorAccounts, ...supplementalVendorAccounts]
  const vendorIndex = buildNameIndex([...vendors, ...supplementalVendorAccounts])
  const distributorIndex = buildNameIndex([...distributors, ...supplementalDistributorAccounts])
  const allAccountNameIndex = buildNameIndex(allAccountsForResolution)

  for (const row of [...revenueSettled, ...revenueOpen]) {
    registerAccountSourceId(row.sourceRef, row.accountId)
    registerVendorSourceId(row.sourceRef, row.vendorId)
  }

  const accountCrosswalkInputs = buildValuesToRefs([
    ...contacts.map(row => ({ value: row.accountName, sourceRef: row.sourceRef })),
    ...opportunities.map(row => ({ value: row.accountName, sourceRef: row.sourceRef })),
    ...revenueSettled.map(row => ({ value: row.accountName, sourceRef: row.sourceRef })),
    ...revenueOpen.map(row => ({ value: row.accountName, sourceRef: row.sourceRef }))
  ])

  const vendorCrosswalkInputs = buildValuesToRefs([
    ...opportunities.map(row => ({ value: row.vendorName, sourceRef: row.sourceRef })),
    ...revenueSettled.map(row => ({ value: row.vendorName, sourceRef: row.sourceRef })),
    ...revenueOpen.map(row => ({ value: row.vendorName, sourceRef: row.sourceRef })),
    ...productRows.map((row, index) => ({
      value: trimCell(row["Vendor Name"]),
      sourceRef: { workbook: PRODUCT_FILE, sheet: "Opportunity Products", rowNumber: index + 2 } satisfies SourceRef
    }))
  ])

  const distributorCrosswalkInputs = buildValuesToRefs([
    ...opportunities.map(row => ({ value: row.distributorName, sourceRef: row.sourceRef })),
    ...revenueSettled.map(row => ({ value: row.distributorName, sourceRef: row.sourceRef })),
    ...revenueOpen.map(row => ({ value: row.distributorName, sourceRef: row.sourceRef })),
    ...productRows.map((row, index) => ({
      value: trimCell(row["Distributor Name"]),
      sourceRef: { workbook: PRODUCT_FILE, sheet: "Opportunity Products", rowNumber: index + 2 } satisfies SourceRef
    }))
  ])

  const accountCrosswalk = buildCrosswalkRows(accountCrosswalkInputs, (value, refs) =>
    canonicalizeAccountName(value, refs, baseAccountLookups.byName, baseAccountLookups.byId, allAccountNameIndex)
  )
  const vendorCrosswalk = buildCrosswalkRows(vendorCrosswalkInputs, value =>
    canonicalizeVendorName(value, vendorIndex, { allowReferenceOnlyAccounts: false })
  )
  const distributorCrosswalk = buildCrosswalkRows(distributorCrosswalkInputs, value =>
    canonicalizeDistributorName(value, distributorIndex, { allowReferenceOnlyAccounts: false })
  )

  const safeCustomers = splitSafeAccountRows(customers)
  const safeDistributors = splitSafeAccountRows(distributors)
  const safeVendors = splitSafeAccountRows(vendors)

  const accountExceptions: Array<Record<(typeof ACCOUNT_EXCEPTION_HEADERS)[number], string>> = [
    ...safeCustomers.exceptionRows,
    ...safeDistributors.exceptionRows,
    ...safeVendors.exceptionRows
  ]

  const canonicalAccountsForResolution = [
    ...safeCustomers.canonicalRows,
    ...safeDistributors.canonicalRows,
    ...safeVendors.canonicalRows,
    ...supplementalDistributorAccounts,
    ...supplementalVendorAccounts
  ]
  const canonicalAccountIndex = buildNameIndex(canonicalAccountsForResolution)
  const canonicalVendorIndex = buildNameIndex([...safeVendors.canonicalRows, ...supplementalVendorAccounts])
  const canonicalDistributorIndex = buildNameIndex([...safeDistributors.canonicalRows, ...supplementalDistributorAccounts])

  const contactEmailCounts = new Map<string, number>()
  for (const row of contacts) {
    const normalizedEmail = row.email.toLowerCase()
    if (!normalizedEmail) {
      continue
    }
    contactEmailCounts.set(normalizedEmail, (contactEmailCounts.get(normalizedEmail) ?? 0) + 1)
  }

  const canonicalContacts: Array<Record<string, string>> = []
  const contactExceptions: ExceptionRow[] = []
  for (const row of contacts) {
    const accountResolution = canonicalizeAccountName(
      row.accountName,
      [row.sourceRef],
      baseAccountLookups.byName,
      baseAccountLookups.byId,
      canonicalAccountIndex
    )

    const reasons: string[] = []
    if (!row.firstName) {
      reasons.push("First Name is required by the contact importer.")
    }
    if (!row.lastName) {
      reasons.push("Last Name is required by the contact importer.")
    }
    if (!accountResolution.canonicalName) {
      reasons.push(`Account "${row.accountName}" does not resolve to a canonical account.`)
    }
    const emailKey = row.email.toLowerCase()
    if (emailKey && (contactEmailCounts.get(emailKey) ?? 0) > 1) {
      reasons.push(`Email "${row.email}" appears on multiple source contact rows and cannot be imported without an approved de-duplication rule.`)
    }

    if (reasons.length > 0) {
      contactExceptions.push({
        "Source Workbook": row.sourceRef.workbook,
        "Source Sheet": row.sourceRef.sheet,
        "Source Row Number": String(row.sourceRef.rowNumber),
        Reason: "Contact row blocked",
        "Reason Detail": reasons.join(" "),
        "Canonical Account Name": accountResolution.canonicalName,
        "Contact ID": row.contactId,
        "First Name": row.firstName,
        "Last Name": row.lastName,
        "Account Name": row.accountName,
        Title: row.title,
        Email: row.email,
        "Mobile Phone": row.mobilePhone,
        "Work Phone": row.workPhone,
        "Work Extension": row.workExtension,
        Description: row.description
      })
      continue
    }

    canonicalContacts.push({
      "Account Name": accountResolution.canonicalName,
      "First Name": row.firstName,
      "Last Name": row.lastName,
      "Job Title": row.title,
      "Work Phone": row.workPhone,
      "Work Phone Extension": row.workExtension,
      "Mobile Phone": row.mobilePhone,
      "Email Address": row.email,
      Description: row.description
    })
  }

  const { canonicalRows: canonicalProducts, exceptions: productExceptions } = buildProductCatalog(
    productRows,
    canonicalVendorIndex,
    canonicalDistributorIndex
  )

  const canonicalOpportunities: Array<Record<string, string>> = []
  const opportunityExceptions: ExceptionRow[] = opportunities.map(row => {
    const accountResolution = canonicalizeAccountName(
      row.accountName,
      [row.sourceRef],
      baseAccountLookups.byName,
      baseAccountLookups.byId,
      canonicalAccountIndex
    )
    const distributorResolution = canonicalizeDistributorName(row.distributorName, canonicalDistributorIndex, {
      allowReferenceOnlyAccounts: false
    })
    const vendorResolution = canonicalizeVendorName(row.vendorName, canonicalVendorIndex, {
      allowReferenceOnlyAccounts: false
    })
    return {
      "Source Workbook": row.sourceRef.workbook,
      "Source Sheet": row.sourceRef.sheet,
      "Source Row Number": String(row.sourceRef.rowNumber),
      Reason: "Opportunity row held for reviewer approval",
      "Reason Detail":
        "The source workbook does not include Role or Role Contact Email, which are required by the current opportunity importer. No fallback rule is approved in the execution plan.",
      "Canonical Account Name": accountResolution.canonicalName,
      "Canonical Distributor Name": distributorResolution.canonicalName,
      "Canonical Vendor Name": vendorResolution.canonicalName,
      "Canonical Stage": STAGE_VALUE_MAP.get(row.stage) ?? "",
      "Opportunity Number": row.opportunityNumber,
      "Opportunity Name": row.opportunityName,
      Stage: row.stage,
      "Account Name": row.accountName,
      "Distributor Name": row.distributorName,
      "Vendor Name": row.vendorName
    }
  })

  const productIndex = buildProductIndex(canonicalProducts)
  const matchedRevenueOpen: Array<Record<string, string>> = []
  const matchedRevenueSettled: Array<Record<string, string>> = []
  const revenueExceptions: ExceptionRow[] = []

  for (const row of [...revenueSettled, ...revenueOpen]) {
    const accountResolution = canonicalizeAccountName(
      row.accountName,
      [row.sourceRef],
      baseAccountLookups.byName,
      baseAccountLookups.byId,
      canonicalAccountIndex
    )
    const vendorResolution = canonicalizeVendorName(row.vendorName, canonicalVendorIndex, {
      allowReferenceOnlyAccounts: false
    })
    const distributorResolution = canonicalizeDistributorName(row.distributorName, canonicalDistributorIndex, {
      allowReferenceOnlyAccounts: false
    })
    const effectiveDistributorName = resolveEffectiveRevenueDistributor(
      row,
      distributorResolution.canonicalName,
      canonicalDistributorIndex
    )

    if (!accountResolution.canonicalName) {
      revenueExceptions.push({
        "Source Workbook": row.sourceRef.workbook,
        "Source Sheet": row.sourceRef.sheet,
        "Source Row Number": String(row.sourceRef.rowNumber),
        Reason: "Revenue schedule blocked",
        "Reason Detail": `Account "${row.accountName}" does not resolve to a canonical account.`,
        "Canonical Account Name": accountResolution.canonicalName,
        "Canonical Vendor Name": vendorResolution.canonicalName,
        "Canonical Distributor Name": effectiveDistributorName,
        "Product Match Candidates": "",
        "Revenue Schedule Name": row.revenueScheduleName,
        Record_Type: row.recordType,
        "Account Name": row.accountName,
        "Distributor Name": row.distributorName,
        "Vendor Name": row.vendorName,
        "Opportunity Name": row.opportunityName,
        "Product Name": row.productName,
        "Cloud & Wire Product SKU": row.cloudWireProductSku,
        "Vendor Product SKU": row.vendorProductSku,
        "Distributor Product SKU": row.distributorProductSku,
        "Revenue Schedule Date": row.revenueScheduleDateRaw,
        "Payment Type": row.paymentType,
        "Adj Exp Total Usage (Billing)": row.expectedUsage,
        "Actual Billed": row.actualUsage,
        "Adjusted Expected Commission - Gross": row.expectedCommission,
        "Actual Commission - Gross": row.actualCommission
      })
      continue
    }

    const upstreamReferenceReasons: string[] = []
    if (row.vendorName && !vendorResolution.canonicalName) {
      upstreamReferenceReasons.push(`Vendor "${row.vendorName}" does not resolve to an approved canonical vendor account.`)
    }
    if (row.distributorName && !effectiveDistributorName) {
      upstreamReferenceReasons.push(
        `Distributor "${row.distributorName}" does not resolve to an approved canonical distributor account.`
      )
    }

    if (upstreamReferenceReasons.length > 0) {
      revenueExceptions.push({
        "Source Workbook": row.sourceRef.workbook,
        "Source Sheet": row.sourceRef.sheet,
        "Source Row Number": String(row.sourceRef.rowNumber),
        Reason: "Revenue schedule upstream reference blocked",
        "Reason Detail": upstreamReferenceReasons.join(" "),
        "Canonical Account Name": accountResolution.canonicalName,
        "Canonical Vendor Name": vendorResolution.canonicalName,
        "Canonical Distributor Name": effectiveDistributorName,
        "Product Match Candidates": "",
        "Revenue Schedule Name": row.revenueScheduleName,
        Record_Type: row.recordType,
        "Account Name": row.accountName,
        "Distributor Name": row.distributorName,
        "Vendor Name": row.vendorName,
        "Opportunity Name": row.opportunityName,
        "Product Name": row.productName,
        "Cloud & Wire Product SKU": row.cloudWireProductSku,
        "Vendor Product SKU": row.vendorProductSku,
        "Distributor Product SKU": row.distributorProductSku,
        "Revenue Schedule Date": row.revenueScheduleDateRaw,
        "Payment Type": row.paymentType,
        "Adj Exp Total Usage (Billing)": row.expectedUsage,
        "Actual Billed": row.actualUsage,
        "Adjusted Expected Commission - Gross": row.expectedCommission,
        "Actual Commission - Gross": row.actualCommission
      })
      continue
    }

    const productResolution = resolveScheduleProduct(
      row,
      productIndex,
      vendorResolution.canonicalName,
      effectiveDistributorName
    )

    if (productResolution.status !== "matched") {
      const candidateCodes = productResolution.candidates
        .slice(0, 5)
        .map(candidate => `${candidate.product.productCode} (${candidate.matchedBy.join("+")})`)
        .join(" | ")
      const reasonDetail =
        productResolution.status === "ambiguous"
          ? "Multiple products matched with the same confidence score; reviewer must choose the correct product code."
          : "No confident product match could be derived from vendor/distributor plus SKU/name signals."

      revenueExceptions.push({
        "Source Workbook": row.sourceRef.workbook,
        "Source Sheet": row.sourceRef.sheet,
        "Source Row Number": String(row.sourceRef.rowNumber),
        Reason: "Revenue schedule product linkage blocked",
        "Reason Detail": reasonDetail,
        "Canonical Account Name": accountResolution.canonicalName,
        "Canonical Vendor Name": vendorResolution.canonicalName,
        "Canonical Distributor Name": effectiveDistributorName,
        "Product Match Candidates": candidateCodes,
        "Revenue Schedule Name": row.revenueScheduleName,
        Record_Type: row.recordType,
        "Account Name": row.accountName,
        "Distributor Name": row.distributorName,
        "Vendor Name": row.vendorName,
        "Opportunity Name": row.opportunityName,
        "Product Name": row.productName,
        "Cloud & Wire Product SKU": row.cloudWireProductSku,
        "Vendor Product SKU": row.vendorProductSku,
        "Distributor Product SKU": row.distributorProductSku,
        "Revenue Schedule Date": row.revenueScheduleDateRaw,
        "Payment Type": row.paymentType,
        "Adj Exp Total Usage (Billing)": row.expectedUsage,
        "Actual Billed": row.actualUsage,
        "Adjusted Expected Commission - Gross": row.expectedCommission,
        "Actual Commission - Gross": row.actualCommission
      })
      continue
    }

    const canonicalSchedule = {
      "Account Name": accountResolution.canonicalName,
      "Schedule Date": row.revenueScheduleDateRaw,
      "Schedule Type": scheduleTypeFromPaymentType(row.paymentType),
      "Opportunity Name": "",
      "Product Code": productResolution.product.productCode,
      "Expected Usage": row.expectedUsage,
      "Actual Usage": row.actualUsage,
      "Expected Commission": row.expectedCommission,
      "Actual Commission": row.actualCommission,
      "House Order ID": "",
      "Distributor Order ID": "",
      Notes: buildRevenueNotes(
        row,
        effectiveDistributorName !== distributorResolution.canonicalName ? effectiveDistributorName : ""
      )
    }

    if (row.sourceRef.sheet === "Revenue Schedules - settled") {
      matchedRevenueSettled.push(canonicalSchedule)
    } else {
      matchedRevenueOpen.push(canonicalSchedule)
    }
  }

  const settledBatches = chunkRows(matchedRevenueSettled, 5000)
  const openBatches = chunkRows(matchedRevenueOpen, 5000)

  await writeCsv(
    path.join(OUTPUT_DIR, "00_account_name_crosswalk.csv"),
    ["Source Name", "Canonical Name", "Status", "Source Workbook(s)", "Source ID(s)", "Notes"],
    accountCrosswalk.map(row => ({
      "Source Name": row.sourceName,
      "Canonical Name": row.canonicalName,
      Status: row.status,
      "Source Workbook(s)": row.sourceWorkbooks,
      "Source ID(s)": row.sourceIds,
      Notes: row.notes
    }))
  )

  await writeCsv(
    path.join(OUTPUT_DIR, "00_vendor_name_crosswalk.csv"),
    ["Source Name", "Canonical Name", "Status", "Source Workbook(s)", "Source ID(s)", "Notes"],
    vendorCrosswalk.map(row => ({
      "Source Name": row.sourceName,
      "Canonical Name": row.canonicalName,
      Status: row.status,
      "Source Workbook(s)": row.sourceWorkbooks,
      "Source ID(s)": row.sourceIds,
      Notes: row.notes
    }))
  )

  await writeCsv(
    path.join(OUTPUT_DIR, "00_distributor_name_crosswalk.csv"),
    ["Source Name", "Canonical Name", "Status", "Source Workbook(s)", "Source ID(s)", "Notes"],
    distributorCrosswalk.map(row => ({
      "Source Name": row.sourceName,
      "Canonical Name": row.canonicalName,
      Status: row.status,
      "Source Workbook(s)": row.sourceWorkbooks,
      "Source ID(s)": row.sourceIds,
      Notes: row.notes
    }))
  )

  await writeCsv(
    path.join(OUTPUT_DIR, "00_stage_value_crosswalk.csv"),
    ["Source Stage", "Canonical Stage", "Status", "Notes"],
    [...STAGE_VALUE_MAP.entries()].map(([sourceStage, canonicalStage]) => ({
      "Source Stage": sourceStage,
      "Canonical Stage": canonicalStage,
      Status: "explicit_alias",
      Notes: "Mapped to the importer enum value already recognized by the current route logic."
    }))
  )

  await writeCsv(path.join(OUTPUT_DIR, "01_accounts_customers.csv"), ACCOUNT_HEADERS, safeCustomers.canonicalRows.map(accountRowToCsv))
  await writeCsv(path.join(OUTPUT_DIR, "01_accounts_distributors.csv"), ACCOUNT_HEADERS, safeDistributors.canonicalRows.map(accountRowToCsv))
  await writeCsv(path.join(OUTPUT_DIR, "01_accounts_vendors.csv"), ACCOUNT_HEADERS, safeVendors.canonicalRows.map(accountRowToCsv))
  await writeCsv(
    path.join(OUTPUT_DIR, "01_accounts_supplemental.csv"),
    ACCOUNT_HEADERS,
    [...supplementalDistributorAccounts, ...supplementalVendorAccounts].map(accountRowToCsv)
  )
  await writeCsv(path.join(OUTPUT_DIR, "01_accounts_exceptions.csv"), ACCOUNT_EXCEPTION_HEADERS, accountExceptions)

  await writeCsv(path.join(OUTPUT_DIR, "02_contacts.csv"), CONTACT_HEADERS, canonicalContacts)
  await writeCsv(path.join(OUTPUT_DIR, "02_contacts_exceptions.csv"), CONTACT_EXCEPTION_HEADERS, contactExceptions)

  await writeCsv(path.join(OUTPUT_DIR, "03_products.csv"), PRODUCT_HEADERS, canonicalProducts.map(productRowToCsv))
  await writeCsv(path.join(OUTPUT_DIR, "03_products_exceptions.csv"), PRODUCT_EXCEPTION_HEADERS, productExceptions)

  await writeCsv(path.join(OUTPUT_DIR, "04_opportunities.csv"), OPPORTUNITY_HEADERS, canonicalOpportunities)
  await writeCsv(path.join(OUTPUT_DIR, "04_opportunities_exceptions.csv"), OPPORTUNITY_EXCEPTION_HEADERS, opportunityExceptions)

  for (let index = 0; index < settledBatches.length; index += 1) {
    const fileName = `05_revenue_schedules_settled_batch_${String(index + 1).padStart(3, "0")}.csv`
    await writeCsv(path.join(OUTPUT_DIR, fileName), REVENUE_HEADERS, settledBatches[index])
  }

  for (let index = 0; index < openBatches.length; index += 1) {
    const fileName = `05_revenue_schedules_open_batch_${String(index + 1).padStart(3, "0")}.csv`
    await writeCsv(path.join(OUTPUT_DIR, fileName), REVENUE_HEADERS, openBatches[index])
  }

  await writeCsv(path.join(OUTPUT_DIR, "05_revenue_schedules_exceptions.csv"), REVENUE_EXCEPTION_HEADERS, revenueExceptions)
  const revenueExceptionCategorySummary = summarizeRevenueExceptionCategories(revenueExceptions)
  const revenueExceptionTopCauses = summarizeRevenueExceptionTopCauses(revenueExceptions)
  await writeCsv(
    path.join(OUTPUT_DIR, "05_revenue_schedules_exception_summary.csv"),
    ["Category", "Count"],
    revenueExceptionCategorySummary
  )
  await writeCsv(
    path.join(OUTPUT_DIR, "05_revenue_schedules_exception_top_causes.csv"),
    ["Category", "Count", "Reason", "Reason Detail", "Vendor Name", "Distributor Name", "Product Name"],
    revenueExceptionTopCauses
  )

  const summary: Record<string, SummarySection> = {
    accounts_customers: {
      sourceRows: customers.length,
      canonicalRows: safeCustomers.canonicalRows.length,
      exceptionRows: safeCustomers.exceptionRows.length,
      supplementalRows: 0
    },
    accounts_distributors: {
      sourceRows: distributors.length,
      canonicalRows: safeDistributors.canonicalRows.length,
      exceptionRows: safeDistributors.exceptionRows.length,
      supplementalRows: supplementalDistributorAccounts.length
    },
    accounts_vendors: {
      sourceRows: vendors.length,
      canonicalRows: safeVendors.canonicalRows.length,
      exceptionRows: safeVendors.exceptionRows.length,
      supplementalRows: supplementalVendorAccounts.length
    },
    accounts_reference_only_blockers: {
      sourceRows: 0,
      canonicalRows: 0,
      exceptionRows: 0,
      supplementalRows: 0
    },
    contacts: {
      sourceRows: contacts.length,
      canonicalRows: canonicalContacts.length,
      exceptionRows: contactExceptions.length,
      supplementalRows: 0
    },
    products: {
      sourceRows: productRows.length,
      canonicalRows: canonicalProducts.length,
      exceptionRows: productExceptions.length,
      supplementalRows: 0
    },
    opportunities: {
      sourceRows: opportunities.length,
      canonicalRows: canonicalOpportunities.length,
      exceptionRows: opportunityExceptions.length,
      supplementalRows: 0
    },
    revenue_schedules_settled: {
      sourceRows: revenueSettled.length,
      canonicalRows: matchedRevenueSettled.length,
      exceptionRows: revenueExceptions.filter(row => row["Source Sheet"] === "Revenue Schedules - settled").length,
      supplementalRows: 0
    },
    revenue_schedules_open: {
      sourceRows: revenueOpen.length,
      canonicalRows: matchedRevenueOpen.length,
      exceptionRows: revenueExceptions.filter(row => row["Source Sheet"] === "Revenue Schedules - Open").length,
      supplementalRows: 0
    }
  }

  const summaryMd = [
    "# Full Import Data Prep Summary",
    "",
    "## Transformation Rules",
    "",
    "- Customer account names are normalized through `00_account_name_crosswalk.csv`; the Cloud & Wire and Edge/Facilitec variants are resolved by source Account ID when available.",
    "- Distributor variants are normalized through `00_distributor_name_crosswalk.csv`. Approved legacy references `Avant-Cresa` and `Telarus-Cresa` are generated in `01_accounts_supplemental.csv` when source opportunity/product evidence exists.",
    "- Vendor variants are normalized through `00_vendor_name_crosswalk.csv`. Approved references `Palo Alto, Inc`, `Light Networks`, and `OnePath` resolve without merging `Palo Alto, Inc` with Cloud Genics.",
    "- Account import outputs keep source-backed account rows reconciled to the master workbook. Approved generated account references are isolated in `01_accounts_supplemental.csv`; unresolved references stay explicit in exception files.",
    "- Product revenue types are translated with an explicit map: `MRC - 3rd Party -> MRC_ThirdParty`, `MRC - Agency -> MRC_House`, `NRC - % of Usage -> NRC_Percent`, `NRC - Per Item -> NRC_PerItem`, `NRC - Resale (Buy/Sell) -> NRC_Resale`, `NRC - SPIFF - Flat Fee -> NRC_FlatFee`.",
    "- Product `Status` values are converted to importer booleans: `Active -> true`, `Inactive -> false`. `Telarus-Cresa` products use `legacy_commission_rate_structure_imported_inactive` and are forced to `Is Active=false` for import.",
    "- Opportunity rows are intentionally held in `04_opportunities_exceptions.csv` because the source workbook does not include the required `Role` or `Role Contact Email` columns and no fallback rule is approved in the execution plan.",
    "- Revenue schedule `Schedule Type` is derived from `Payment Type`: `NRC* -> OneTime`, all other current values -> `Recurring`.",
    "- Revenue schedules leave `Opportunity Name` blank on purpose. The field is optional in the current importer; leaving it blank avoids a guaranteed lookup failure until the opportunity-role fallback is approved.",
    "- Revenue schedules only carry a `Product Code` when a unique product match can be scored from vendor/distributor plus exact SKU/name signals. Unmatched or ambiguous rows are sent to `05_revenue_schedules_exceptions.csv`.",
    "",
    "## Row Reconciliation",
    "",
    "| Entity | Source Rows | Canonical Rows | Exception Rows | Supplemental Rows |",
    "| --- | ---: | ---: | ---: | ---: |",
    `| Accounts - Customers | ${summary.accounts_customers.sourceRows} | ${summary.accounts_customers.canonicalRows} | ${summary.accounts_customers.exceptionRows} | ${summary.accounts_customers.supplementalRows} |`,
    `| Accounts - Distributors | ${summary.accounts_distributors.sourceRows} | ${summary.accounts_distributors.canonicalRows} | ${summary.accounts_distributors.exceptionRows} | ${summary.accounts_distributors.supplementalRows} |`,
    `| Accounts - Vendors | ${summary.accounts_vendors.sourceRows} | ${summary.accounts_vendors.canonicalRows} | ${summary.accounts_vendors.exceptionRows} | ${summary.accounts_vendors.supplementalRows} |`,
    `| Accounts - Approved supplemental references | 0 | 0 | ${summary.accounts_reference_only_blockers.exceptionRows} | ${summary.accounts_distributors.supplementalRows + summary.accounts_vendors.supplementalRows} |`,
    `| Contacts | ${summary.contacts.sourceRows} | ${summary.contacts.canonicalRows} | ${summary.contacts.exceptionRows} | ${summary.contacts.supplementalRows} |`,
    `| Products | ${summary.products.sourceRows} | ${summary.products.canonicalRows} | ${summary.products.exceptionRows} | ${summary.products.supplementalRows} |`,
    `| Opportunities | ${summary.opportunities.sourceRows} | ${summary.opportunities.canonicalRows} | ${summary.opportunities.exceptionRows} | ${summary.opportunities.supplementalRows} |`,
    `| Revenue Schedules - Settled | ${summary.revenue_schedules_settled.sourceRows} | ${summary.revenue_schedules_settled.canonicalRows} | ${summary.revenue_schedules_settled.exceptionRows} | ${summary.revenue_schedules_settled.supplementalRows} |`,
    `| Revenue Schedules - Open | ${summary.revenue_schedules_open.sourceRows} | ${summary.revenue_schedules_open.canonicalRows} | ${summary.revenue_schedules_open.exceptionRows} | ${summary.revenue_schedules_open.supplementalRows} |`,
    "",
    "## Revenue Schedule Exception Categories",
    "",
    "| Category | Rows |",
    "| --- | ---: |",
    ...revenueExceptionCategorySummary.map(row => `| ${row.Category} | ${row.Count} |`),
    "",
    "## Revenue Schedule Top Recurring Causes",
    "",
    "| Category | Rows | Vendor | Distributor | Product | Reason Detail |",
    "| --- | ---: | --- | --- | --- | --- |",
    ...revenueExceptionTopCauses
      .slice(0, 10)
      .map(
        row =>
          `| ${row.Category} | ${row.Count} | ${row["Vendor Name"] || "None"} | ${row["Distributor Name"] || "None"} | ${row["Product Name"] || "None"} | ${row["Reason Detail"]} |`
      ),
    "",
    "## Account Reconciliation Proof",
    "",
    `- Source account rows by sheet: Accounts ${customers.length}, Distributors ${distributors.length}, Vendors ${vendors.length}.`,
    `- Canonical account rows by output file: 01_accounts_customers.csv ${safeCustomers.canonicalRows.length}, 01_accounts_distributors.csv ${safeDistributors.canonicalRows.length}, 01_accounts_vendors.csv ${safeVendors.canonicalRows.length}, 01_accounts_supplemental.csv ${supplementalDistributorAccounts.length + supplementalVendorAccounts.length}.`,
    `- Source-backed account exceptions: ${safeCustomers.exceptionRows.length + safeDistributors.exceptionRows.length + safeVendors.exceptionRows.length}.`,
    `- Exact proof: ${customers.length + distributors.length + vendors.length} source-backed account rows = ${safeCustomers.canonicalRows.length + safeDistributors.canonicalRows.length + safeVendors.canonicalRows.length} canonical rows + ${safeCustomers.exceptionRows.length + safeDistributors.exceptionRows.length + safeVendors.exceptionRows.length} source-backed exceptions.`,
    `- Approved supplemental account references not counted in source-sheet totals: ${supplementalDistributorAccounts.length + supplementalVendorAccounts.length}. Missing references that are not approved remain in exception outputs.`,
    "",
    "## Batching",
    "",
    `- Settled batches: ${settledBatches.length}`,
    `- Open batches: ${openBatches.length}`,
    "- Batch size cap: 5,000 rows",
    "",
    "## Reviewer Holds",
    "",
    "- Review approved supplemental account references in `01_accounts_supplemental.csv` before import sequencing.",
    "- Approve an opportunity fallback for `Role` and `Role Contact Email` before moving opportunity rows out of exceptions.",
    "- Review the revenue-schedule product exceptions, especially the four Zoom annual-number rows where two product codes matched with identical confidence."
  ].join("\n")

  await fs.writeFile(path.join(OUTPUT_DIR, "transformation_summary.md"), `${summaryMd}\n`, "utf8")
  await fs.writeFile(path.join(OUTPUT_DIR, "transformation_summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8")

  console.log(`Wrote full import artifacts to ${OUTPUT_DIR}`)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
