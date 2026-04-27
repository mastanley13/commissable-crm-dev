import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import Papa from "papaparse"
import XLSX from "xlsx"

import { getDataImportEntityDefinition, type DataImportEntityType } from "../lib/data-import/catalog"

type CsvRow = Record<string, string>

type Severity = "blocker" | "warning"
type CheckStatus = "pass" | "warning" | "fail" | "not_run"
type FindingOwner = "Agent A" | "Agent B" | "Agent C" | "Human Reviewer"

interface ValidationOptions {
  projectRoot?: string
}

interface SourceSheetSummary {
  workbook: string
  sheet: string
  rows: number
  status: CheckStatus
  issues: string[]
}

interface CsvIssueSummary {
  field: string
  count: number
  rows: number[]
}

interface BatchSummary {
  batchNumber: number | null
  status: CheckStatus
  rowLimit: number
}

interface CsvFileReport {
  path: string
  relativePath: string
  kind: "canonical" | "exception" | "crosswalk" | "supplemental" | "batch"
  entity: EntityKey | null
  exists: boolean
  status: CheckStatus
  rowCount: number
  headers: string[]
  parseErrors: string[]
  missingHeaders: string[]
  unexpectedHeaders: string[]
  blankRequiredValues: CsvIssueSummary[]
  batchSummary: BatchSummary | null
  notes: string[]
}

interface InternalCsvFileReport extends CsvFileReport {
  rows: CsvRow[]
}

interface RequiredOutputGroupReport {
  id: string
  label: string
  status: CheckStatus
  requiredPatterns: string[]
  missingPatterns: string[]
  matchedFiles: string[]
}

interface CrossReferenceFailure {
  sourceFile: string
  rowNumber: number
  field: string
  value: string
  message: string
}

interface CrossReferenceReport {
  id: string
  label: string
  status: CheckStatus
  checkedRows: number
  failureCount: number
  failures: CrossReferenceFailure[]
  notes: string[]
}

interface ReconciliationReport {
  id: EntityKey
  label: string
  status: CheckStatus
  sourceRows: number
  canonicalRows: number
  exceptionRows: number
  accountedRows: number
  unaccountedRows: number
  details: string[]
}

interface Finding {
  id: string
  severity: Severity
  owner: FindingOwner
  area: string
  status: "open"
  summary: string
  evidence: string
  nextAction: string
}

interface ExecutionGateReport {
  wave: string
  owner: string
  label: string
  status: "pass" | "fail" | "not_run"
  evidence: string
}

export interface FullImportValidationReport {
  reportVersion: 1
  packageRoot: string
  packageRelativeRoot: string
  status: "ready" | "blocked"
  summary: {
    blockerCount: number
    warningCount: number
    filesChecked: number
    filesPresent: number
    filesMissing: number
  }
  sourceSheets: SourceSheetSummary[]
  requiredOutputGroups: RequiredOutputGroupReport[]
  files: CsvFileReport[]
  crossReferenceChecks: CrossReferenceReport[]
  reconciliation: ReconciliationReport[]
  findings: Finding[]
  executionGates: ExecutionGateReport[]
  optionalChecks: Array<{
    id: string
    label: string
    status: "not_run"
    reason: string
  }>
}

type EntityKey = "accounts" | "contacts" | "products" | "opportunities" | "revenueSchedules"

interface SourceSheetSpec {
  workbook: string
  sheet: string
}

interface StaticFileSpec {
  path: string
  kind: "canonical" | "exception" | "crosswalk" | "supplemental"
  entity: EntityKey | null
  entityType?: DataImportEntityType
}

interface RequiredOutputGroupSpec {
  id: string
  label: string
  patterns: string[]
}

const PACKAGE_RELATIVE_ROOT = path.join("docs", "test-data", "data-settings-imports", "full-import")
const REPORT_JSON_RELATIVE_PATH = path.join(PACKAGE_RELATIVE_ROOT, "readiness_report.json")
const REPORT_MARKDOWN_RELATIVE_PATH = path.join(PACKAGE_RELATIVE_ROOT, "readiness_report.md")
const CHECKLIST_RELATIVE_PATH = path.join("docs", "plans", "2026-04-17-full-import-review-checklist.md")
const DEFECT_LOG_RELATIVE_PATH = path.join("docs", "plans", "2026-04-17-full-import-defect-log.csv")
const REVENUE_BATCH_LIMIT = 5000

const SOURCE_ENTITY_SPECS: Record<EntityKey, { label: string; sheets: SourceSheetSpec[] }> = {
  accounts: {
    label: "Accounts",
    sheets: [
      { workbook: "Master Accounts File.xlsx", sheet: "Accounts" },
      { workbook: "Master Accounts File.xlsx", sheet: "Distributors" },
      { workbook: "Master Accounts File.xlsx", sheet: "Vendors" },
    ],
  },
  contacts: {
    label: "Contacts",
    sheets: [{ workbook: "Master Contacts File.xlsx", sheet: "contacts_export (1)" }],
  },
  products: {
    label: "Products",
    sheets: [{ workbook: "Products_classified.xlsx", sheet: "Opportunity Products" }],
  },
  opportunities: {
    label: "Opportunities",
    sheets: [{ workbook: "Master Opportunity File.xlsx", sheet: "Opportunities - All" }],
  },
  revenueSchedules: {
    label: "Revenue Schedules",
    sheets: [
      { workbook: "Master Revenue Schedule File.xlsx", sheet: "Revenue Schedules - settled" },
      { workbook: "Master Revenue Schedule File.xlsx", sheet: "Revenue Schedules - Open" },
    ],
  },
}

const STATIC_FILE_SPECS: StaticFileSpec[] = [
  { path: "00_account_name_crosswalk.csv", kind: "crosswalk", entity: null },
  { path: "00_vendor_name_crosswalk.csv", kind: "crosswalk", entity: null },
  { path: "00_distributor_name_crosswalk.csv", kind: "crosswalk", entity: null },
  { path: "00_stage_value_crosswalk.csv", kind: "crosswalk", entity: null },
  { path: "01_accounts_customers.csv", kind: "canonical", entity: "accounts", entityType: "accounts" },
  { path: "01_accounts_distributors.csv", kind: "canonical", entity: "accounts", entityType: "accounts" },
  { path: "01_accounts_vendors.csv", kind: "canonical", entity: "accounts", entityType: "accounts" },
  { path: "01_accounts_supplemental.csv", kind: "supplemental", entity: "accounts", entityType: "accounts" },
  { path: "01_accounts_exceptions.csv", kind: "exception", entity: "accounts" },
  { path: "02_contacts.csv", kind: "canonical", entity: "contacts", entityType: "contacts" },
  { path: "02_contacts_exceptions.csv", kind: "exception", entity: "contacts" },
  { path: "03_products.csv", kind: "canonical", entity: "products", entityType: "products" },
  { path: "03_products_exceptions.csv", kind: "exception", entity: "products" },
  { path: "04_opportunities.csv", kind: "canonical", entity: "opportunities", entityType: "opportunities" },
  { path: "04_opportunities_exceptions.csv", kind: "exception", entity: "opportunities" },
  { path: "05_revenue_schedules_exceptions.csv", kind: "exception", entity: "revenueSchedules" },
]

const REQUIRED_OUTPUT_GROUP_SPECS: RequiredOutputGroupSpec[] = [
  {
    id: "crosswalks",
    label: "Crosswalk outputs",
    patterns: [
      "00_account_name_crosswalk.csv",
      "00_vendor_name_crosswalk.csv",
      "00_distributor_name_crosswalk.csv",
      "00_stage_value_crosswalk.csv",
    ],
  },
  {
    id: "accounts",
    label: "Accounts canonical and exception files",
    patterns: [
      "01_accounts_customers.csv",
      "01_accounts_distributors.csv",
      "01_accounts_vendors.csv",
      "01_accounts_supplemental.csv",
      "01_accounts_exceptions.csv",
    ],
  },
  {
    id: "contacts",
    label: "Contacts canonical and exception files",
    patterns: ["02_contacts.csv", "02_contacts_exceptions.csv"],
  },
  {
    id: "products",
    label: "Products canonical and exception files",
    patterns: ["03_products.csv", "03_products_exceptions.csv"],
  },
  {
    id: "opportunities",
    label: "Opportunities canonical and exception files",
    patterns: ["04_opportunities.csv", "04_opportunities_exceptions.csv"],
  },
  {
    id: "revenue-open-batches",
    label: "Revenue schedule open batches",
    patterns: ["05_revenue_schedules_open_batch_*.csv"],
  },
  {
    id: "revenue-settled-batches",
    label: "Revenue schedule settled batches",
    patterns: ["05_revenue_schedules_settled_batch_*.csv"],
  },
  {
    id: "revenue-exceptions",
    label: "Revenue schedule exception file",
    patterns: ["05_revenue_schedules_exceptions.csv"],
  },
]

function normalizeValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

function toPosix(relativePath: string) {
  return relativePath.split(path.sep).join("/")
}

function countNonEmptySheetRows(rows: unknown[][]) {
  return rows
    .slice(1)
    .filter(row => row.some(cell => String(cell ?? "").trim().length > 0))
    .length
}

function parseCsvFile(filePath: string) {
  const text = fs.readFileSync(filePath, "utf8")
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
  })

  return {
    headers: Array.isArray(parsed.meta.fields) ? parsed.meta.fields : [],
    rows: parsed.data.filter((row): row is CsvRow => Boolean(row) && typeof row === "object"),
    errors: parsed.errors
      .filter(error => error.code !== "UndetectableDelimiter")
      .map(error => error.message),
  }
}

function getExpectedHeaders(entityType: DataImportEntityType) {
  const definition = getDataImportEntityDefinition(entityType)
  if (!definition) {
    throw new Error(`Unknown data import entity type: ${entityType}`)
  }

  return {
    requiredHeaders: definition.fields.filter(field => field.required).map(field => field.label),
    knownHeaders: definition.fields.map(field => field.label),
  }
}

function readStaticCsvFile(projectRoot: string, spec: StaticFileSpec): InternalCsvFileReport {
  const relativePath = path.join(PACKAGE_RELATIVE_ROOT, spec.path)
  const absolutePath = path.join(projectRoot, relativePath)

  if (!fs.existsSync(absolutePath)) {
    return {
      path: absolutePath,
      relativePath: toPosix(relativePath),
      kind: spec.kind,
      entity: spec.entity,
      exists: false,
      status: "fail",
      rowCount: 0,
      headers: [],
      parseErrors: [],
      missingHeaders: [],
      unexpectedHeaders: [],
      blankRequiredValues: [],
      batchSummary: null,
      notes: ["File does not exist."],
      rows: [],
    }
  }

  const parsed = parseCsvFile(absolutePath)
  const missingHeaders: string[] = []
  const unexpectedHeaders: string[] = []
  const blankRequiredValues: CsvIssueSummary[] = []
  const notes: string[] = []

  if (spec.entityType) {
    const { requiredHeaders, knownHeaders } = getExpectedHeaders(spec.entityType)
    missingHeaders.push(...requiredHeaders.filter(header => !parsed.headers.includes(header)))
    unexpectedHeaders.push(...parsed.headers.filter(header => !knownHeaders.includes(header)))

    for (const requiredHeader of requiredHeaders) {
      const blankRows = parsed.rows
        .map((row, index) => ({ index, value: row[requiredHeader] ?? "" }))
        .filter(entry => entry.value.trim().length === 0)
        .map(entry => entry.index + 2)

      if (blankRows.length > 0) {
        blankRequiredValues.push({
          field: requiredHeader,
          count: blankRows.length,
          rows: blankRows.slice(0, 10),
        })
      }
    }
  }

  if (unexpectedHeaders.length > 0) {
    notes.push(`Unexpected headers present: ${unexpectedHeaders.join(", ")}`)
  }

  const status: CheckStatus =
    parsed.errors.length > 0 || missingHeaders.length > 0 || blankRequiredValues.length > 0
      ? "fail"
      : unexpectedHeaders.length > 0
        ? "warning"
        : "pass"

  return {
    path: absolutePath,
    relativePath: toPosix(relativePath),
    kind: spec.kind,
    entity: spec.entity,
    exists: true,
    status,
    rowCount: parsed.rows.length,
    headers: parsed.headers,
    parseErrors: parsed.errors,
    missingHeaders,
    unexpectedHeaders,
    blankRequiredValues,
    batchSummary: null,
    notes,
    rows: parsed.rows,
  }
}

function readRevenueBatchFiles(projectRoot: string): InternalCsvFileReport[] {
  const packageRoot = path.join(projectRoot, PACKAGE_RELATIVE_ROOT)
  if (!fs.existsSync(packageRoot)) {
    return []
  }

  const revenueFiles = fs
    .readdirSync(packageRoot)
    .filter(name => /^05_revenue_schedules_(open|settled)_batch_\d{3}\.csv$/i.test(name))
    .sort((left, right) => left.localeCompare(right))

  return revenueFiles.map(fileName => {
    const relativePath = path.join(PACKAGE_RELATIVE_ROOT, fileName)
    const absolutePath = path.join(projectRoot, relativePath)
    const parsed = parseCsvFile(absolutePath)
    const { requiredHeaders, knownHeaders } = getExpectedHeaders("revenue-schedules")
    const missingHeaders = requiredHeaders.filter(header => !parsed.headers.includes(header))
    const unexpectedHeaders = parsed.headers.filter(header => !knownHeaders.includes(header))
    const blankRequiredValues: CsvIssueSummary[] = []

    for (const requiredHeader of requiredHeaders) {
      const blankRows = parsed.rows
        .map((row, index) => ({ index, value: row[requiredHeader] ?? "" }))
        .filter(entry => entry.value.trim().length === 0)
        .map(entry => entry.index + 2)

      if (blankRows.length > 0) {
        blankRequiredValues.push({
          field: requiredHeader,
          count: blankRows.length,
          rows: blankRows.slice(0, 10),
        })
      }
    }

    const batchMatch = fileName.match(/_batch_(\d{3})\.csv$/i)
    const batchNumber = batchMatch ? Number(batchMatch[1]) : null
    const batchStatus = parsed.rows.length > REVENUE_BATCH_LIMIT ? "fail" : "pass"
    const notes: string[] = []

    if (unexpectedHeaders.length > 0) {
      notes.push(`Unexpected headers present: ${unexpectedHeaders.join(", ")}`)
    }
    if (batchStatus === "fail") {
      notes.push(`Batch exceeds ${REVENUE_BATCH_LIMIT} rows.`)
    }

    const status: CheckStatus =
      parsed.errors.length > 0 || missingHeaders.length > 0 || blankRequiredValues.length > 0 || batchStatus === "fail"
        ? "fail"
        : unexpectedHeaders.length > 0
          ? "warning"
          : "pass"

    return {
      path: absolutePath,
      relativePath: toPosix(relativePath),
      kind: "batch",
      entity: "revenueSchedules",
      exists: true,
      status,
      rowCount: parsed.rows.length,
      headers: parsed.headers,
      parseErrors: parsed.errors,
      missingHeaders,
      unexpectedHeaders,
      blankRequiredValues,
      batchSummary: {
        batchNumber,
        status: batchStatus,
        rowLimit: REVENUE_BATCH_LIMIT,
      },
      notes,
      rows: parsed.rows,
    }
  })
}

function readSourceSheets(projectRoot: string) {
  const sourceRoot = path.join(projectRoot, "2026-04-17_Import_Test_Data")
  const sourceSheets: SourceSheetSummary[] = []
  const totals = new Map<EntityKey, number>()

  for (const [entity, spec] of Object.entries(SOURCE_ENTITY_SPECS) as Array<[EntityKey, { label: string; sheets: SourceSheetSpec[] }]>) {
    let entityTotal = 0

    for (const sheetSpec of spec.sheets) {
      const workbookPath = path.join(sourceRoot, sheetSpec.workbook)
      if (!fs.existsSync(workbookPath)) {
        sourceSheets.push({
          workbook: sheetSpec.workbook,
          sheet: sheetSpec.sheet,
          rows: 0,
          status: "fail",
          issues: ["Workbook does not exist."],
        })
        continue
      }

      const workbook = XLSX.readFile(workbookPath, { dense: true })
      const sheet = workbook.Sheets[sheetSpec.sheet]
      if (!sheet) {
        sourceSheets.push({
          workbook: sheetSpec.workbook,
          sheet: sheetSpec.sheet,
          rows: 0,
          status: "fail",
          issues: ["Sheet does not exist."],
        })
        continue
      }

      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
      })
      const rowCount = countNonEmptySheetRows(rows)
      entityTotal += rowCount

      sourceSheets.push({
        workbook: sheetSpec.workbook,
        sheet: sheetSpec.sheet,
        rows: rowCount,
        status: "pass",
        issues: [],
      })
    }

    totals.set(entity, entityTotal)
  }

  return {
    sourceSheets,
    totals,
  }
}

function matchesPattern(filePath: string, pattern: string) {
  const expression = new RegExp(
    `^${pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")}$`,
    "i"
  )
  return expression.test(filePath)
}

function buildRequiredOutputGroups(files: InternalCsvFileReport[]): RequiredOutputGroupReport[] {
  const filePaths = new Set(files.map(file => path.posix.basename(file.relativePath)))

  return REQUIRED_OUTPUT_GROUP_SPECS.map(group => {
    const missingPatterns: string[] = []
    const matchedFiles = new Set<string>()

    for (const pattern of group.patterns) {
      const matches = Array.from(filePaths).filter(filePath => matchesPattern(filePath, pattern))
      if (matches.length === 0) {
        missingPatterns.push(pattern)
        continue
      }
      matches.forEach(match => matchedFiles.add(match))
    }

    return {
      id: group.id,
      label: group.label,
      status: missingPatterns.length > 0 ? "fail" : "pass",
      requiredPatterns: group.patterns,
      missingPatterns,
      matchedFiles: Array.from(matchedFiles).sort((left, right) => left.localeCompare(right)),
    }
  })
}

function collectRowsByRelativePath(files: InternalCsvFileReport[]) {
  const fileMap = new Map<string, InternalCsvFileReport>()
  files.forEach(file => {
    fileMap.set(path.posix.basename(file.relativePath), file)
  })
  return fileMap
}

function buildReferenceSets(files: InternalCsvFileReport[]) {
  const accountNames = new Set<string>()
  const productCodes = new Set<string>()
  const opportunityKeys = new Set<string>()
  const duplicateMessages: string[] = []

  for (const file of files) {
    if (!file.exists || file.kind === "exception" || file.kind === "crosswalk" || file.parseErrors.length > 0) {
      continue
    }

    if (file.entity === "accounts") {
      for (const row of file.rows) {
        const accountName = row["Account Name"]?.trim() ?? ""
        if (!accountName) {
          continue
        }
        const normalized = normalizeValue(accountName)
        accountNames.add(normalized)
      }
    }

    if (file.entity === "products") {
      const seenCodes = new Set<string>()
      for (const row of file.rows) {
        const code = row["Product Code"]?.trim() ?? ""
        if (!code) {
          continue
        }
        const normalized = normalizeValue(code)
        if (seenCodes.has(normalized) || productCodes.has(normalized)) {
          duplicateMessages.push(`Duplicate product code detected for "${code}".`)
        }
        seenCodes.add(normalized)
        productCodes.add(normalized)
      }
    }

    if (file.entity === "opportunities") {
      const seenKeys = new Set<string>()
      for (const row of file.rows) {
        const accountName = row["Account Name"]?.trim() ?? ""
        const opportunityName = row["Opportunity Name"]?.trim() ?? ""
        if (!accountName || !opportunityName) {
          continue
        }
        const key = `${normalizeValue(accountName)}::${normalizeValue(opportunityName)}`
        if (seenKeys.has(key) || opportunityKeys.has(key)) {
          duplicateMessages.push(
            `Duplicate opportunity reference detected for account "${accountName}" and opportunity "${opportunityName}".`
          )
        }
        seenKeys.add(key)
        opportunityKeys.add(key)
      }
    }
  }

  return {
    accountNames,
    productCodes,
    opportunityKeys,
    duplicateMessages,
  }
}

function runCrossReferenceChecks(files: InternalCsvFileReport[]) {
  const fileMap = collectRowsByRelativePath(files)
  const references = buildReferenceSets(files)
  const checks: CrossReferenceReport[] = []

  const contactsFile = fileMap.get("02_contacts.csv")
  if (!contactsFile?.exists) {
    checks.push({
      id: "contacts-to-accounts",
      label: "Contacts reference existing accounts",
      status: "not_run",
      checkedRows: 0,
      failureCount: 0,
      failures: [],
      notes: ["Skipped because 02_contacts.csv is missing."],
    })
  } else {
    const failures = contactsFile.rows.flatMap((row, index) => {
      const accountName = row["Account Name"]?.trim() ?? ""
      if (!accountName || references.accountNames.has(normalizeValue(accountName))) {
        return []
      }
      return [
        {
          sourceFile: contactsFile.relativePath,
          rowNumber: index + 2,
          field: "Account Name",
          value: accountName,
          message: `Contact references account "${accountName}" that is not present in the accounts files.`,
        },
      ]
    })

    checks.push({
      id: "contacts-to-accounts",
      label: "Contacts reference existing accounts",
      status: failures.length > 0 ? "fail" : "pass",
      checkedRows: contactsFile.rows.length,
      failureCount: failures.length,
      failures,
      notes: [],
    })
  }

  const opportunitiesFile = fileMap.get("04_opportunities.csv")
  if (!opportunitiesFile?.exists) {
    checks.push({
      id: "opportunities-to-accounts",
      label: "Opportunities reference existing accounts",
      status: "not_run",
      checkedRows: 0,
      failureCount: 0,
      failures: [],
      notes: ["Skipped because 04_opportunities.csv is missing."],
    })
  } else {
    const failures = opportunitiesFile.rows.flatMap((row, index) => {
      const accountName = row["Account Name"]?.trim() ?? ""
      if (!accountName || references.accountNames.has(normalizeValue(accountName))) {
        return []
      }
      return [
        {
          sourceFile: opportunitiesFile.relativePath,
          rowNumber: index + 2,
          field: "Account Name",
          value: accountName,
          message: `Opportunity references account "${accountName}" that is not present in the accounts files.`,
        },
      ]
    })

    checks.push({
      id: "opportunities-to-accounts",
      label: "Opportunities reference existing accounts",
      status: failures.length > 0 ? "fail" : "pass",
      checkedRows: opportunitiesFile.rows.length,
      failureCount: failures.length,
      failures,
      notes: [],
    })
  }

  const productsFile = fileMap.get("03_products.csv")
  if (!productsFile?.exists) {
    checks.push({
      id: "products-to-accounts",
      label: "Products reference existing vendor and distributor accounts",
      status: "not_run",
      checkedRows: 0,
      failureCount: 0,
      failures: [],
      notes: ["Skipped because 03_products.csv is missing."],
    })
  } else {
    const failures = productsFile.rows.flatMap((row, index) => {
      const rowFailures: CrossReferenceFailure[] = []
      const vendorName = row["Vendor Account Name"]?.trim() ?? ""
      const distributorName = row["Distributor Account Name"]?.trim() ?? ""

      if (vendorName && !references.accountNames.has(normalizeValue(vendorName))) {
        rowFailures.push({
          sourceFile: productsFile.relativePath,
          rowNumber: index + 2,
          field: "Vendor Account Name",
          value: vendorName,
          message: `Product references vendor account "${vendorName}" that is not present in the accounts files.`,
        })
      }

      if (distributorName && !references.accountNames.has(normalizeValue(distributorName))) {
        rowFailures.push({
          sourceFile: productsFile.relativePath,
          rowNumber: index + 2,
          field: "Distributor Account Name",
          value: distributorName,
          message: `Product references distributor account "${distributorName}" that is not present in the accounts files.`,
        })
      }

      return rowFailures
    })

    checks.push({
      id: "products-to-accounts",
      label: "Products reference existing vendor and distributor accounts",
      status: failures.length > 0 ? "fail" : "pass",
      checkedRows: productsFile.rows.length,
      failureCount: failures.length,
      failures,
      notes: [],
    })
  }

  const revenueFiles = files.filter(file => file.kind === "batch")
  if (revenueFiles.length === 0) {
    checks.push({
      id: "revenue-schedules-cross-file",
      label: "Revenue schedules reference existing accounts, opportunities, and products",
      status: "not_run",
      checkedRows: 0,
      failureCount: 0,
      failures: [],
      notes: ["Skipped because no revenue schedule batch files were found."],
    })
  } else {
    const failures = revenueFiles.flatMap(file =>
      file.rows.flatMap((row, index) => {
        const rowFailures: CrossReferenceFailure[] = []
        const accountName = row["Account Name"]?.trim() ?? ""
        const opportunityName = row["Opportunity Name"]?.trim() ?? ""
        const productCode = row["Product Code"]?.trim() ?? ""

        if (accountName && !references.accountNames.has(normalizeValue(accountName))) {
          rowFailures.push({
            sourceFile: file.relativePath,
            rowNumber: index + 2,
            field: "Account Name",
            value: accountName,
            message: `Revenue schedule references account "${accountName}" that is not present in the accounts files.`,
          })
        }

        if (accountName && opportunityName) {
          const opportunityKey = `${normalizeValue(accountName)}::${normalizeValue(opportunityName)}`
          if (!references.opportunityKeys.has(opportunityKey)) {
            rowFailures.push({
              sourceFile: file.relativePath,
              rowNumber: index + 2,
              field: "Opportunity Name",
              value: opportunityName,
              message: `Revenue schedule references opportunity "${opportunityName}" under account "${accountName}" that is not present in 04_opportunities.csv.`,
            })
          }
        }

        if (productCode && !references.productCodes.has(normalizeValue(productCode))) {
          rowFailures.push({
            sourceFile: file.relativePath,
            rowNumber: index + 2,
            field: "Product Code",
            value: productCode,
            message: `Revenue schedule references product code "${productCode}" that is not present in 03_products.csv.`,
          })
        }

        return rowFailures
      })
    )

    checks.push({
      id: "revenue-schedules-cross-file",
      label: "Revenue schedules reference existing accounts, opportunities, and products",
      status: failures.length > 0 ? "fail" : "pass",
      checkedRows: revenueFiles.reduce((sum, file) => sum + file.rows.length, 0),
      failureCount: failures.length,
      failures,
      notes: [],
    })
  }

  return {
    checks,
    duplicateMessages: references.duplicateMessages,
  }
}

function buildReconciliation(
  files: InternalCsvFileReport[],
  sourceTotals: Map<EntityKey, number>,
  sourceSheets: SourceSheetSummary[]
) {
  const reports: ReconciliationReport[] = []
  const fileMap = collectRowsByRelativePath(files)

  for (const [entity, spec] of Object.entries(SOURCE_ENTITY_SPECS) as Array<[EntityKey, { label: string; sheets: SourceSheetSpec[] }]>) {
    const sourceRows = sourceTotals.get(entity) ?? 0
    const canonicalRows = files
      .filter(file => file.entity === entity && (file.kind === "canonical" || file.kind === "batch") && file.exists)
      .reduce((sum, file) => sum + file.rowCount, 0)
    let exceptionRows = files
      .filter(file => file.entity === entity && file.kind === "exception" && file.exists)
      .reduce((sum, file) => sum + file.rowCount, 0)

    if (entity === "accounts") {
      const accountExceptionsFile = fileMap.get("01_accounts_exceptions.csv")
      exceptionRows =
        accountExceptionsFile?.rows.filter(row => {
          const workbook = row["Source Workbook"]?.trim() ?? ""
          const sourceRowNumber = row["Source Row Number"]?.trim() ?? ""
          return workbook === "Master Accounts File.xlsx" && sourceRowNumber.length > 0
        }).length ?? 0
    }

    const accountedRows = canonicalRows + exceptionRows
    const unaccountedRows = sourceRows - accountedRows
    const details: string[] = []

    if (entity === "accounts") {
      const accountSubtypeSpecs = [
        {
          label: "Customers",
          sourceWorkbook: "Master Accounts File.xlsx",
          sourceSheet: "Accounts",
          fileName: "01_accounts_customers.csv",
        },
        {
          label: "Distributors",
          sourceWorkbook: "Master Accounts File.xlsx",
          sourceSheet: "Distributors",
          fileName: "01_accounts_distributors.csv",
        },
        {
          label: "Vendors",
          sourceWorkbook: "Master Accounts File.xlsx",
          sourceSheet: "Vendors",
          fileName: "01_accounts_vendors.csv",
        },
      ] as const

      for (const subtype of accountSubtypeSpecs) {
        const sourceSheetSummary = sourceSheets.find(
          sheet => sheet.workbook === subtype.sourceWorkbook && sheet.sheet === subtype.sourceSheet
        )
        const sourceRowCount = sourceSheetSummary?.rows ?? 0
        const accountFile = fileMap.get(subtype.fileName)
        const accountExceptionsFile = fileMap.get("01_accounts_exceptions.csv")
        const canonicalSubtypeRows = accountFile?.rowCount ?? 0
        const exceptionSubtypeRows =
          accountExceptionsFile?.rows.filter(row => {
            const workbook = row["Source Workbook"]?.trim() ?? ""
            const sheet = row["Source Sheet"]?.trim() ?? ""
            const sourceRowNumber = row["Source Row Number"]?.trim() ?? ""
            return workbook === subtype.sourceWorkbook && sheet === subtype.sourceSheet && sourceRowNumber.length > 0
          }).length ?? 0
        const accountedSubtypeRows = canonicalSubtypeRows + exceptionSubtypeRows
        const duplicateRowsByName = new Map<string, number[]>()

        if (accountFile) {
          const seenRowsByName = new Map<string, number[]>()
          accountFile.rows.forEach((row, index) => {
            const accountName = row["Account Name"]?.trim() ?? ""
            if (!accountName) {
              return
            }
            const normalized = normalizeValue(accountName)
            const rowNumbers = seenRowsByName.get(normalized) ?? []
            rowNumbers.push(index + 2)
            seenRowsByName.set(normalized, rowNumbers)
          })

          for (const [normalizedName, rowNumbers] of seenRowsByName.entries()) {
            if (rowNumbers.length > 1) {
              const displayName = accountFile.rows[rowNumbers[0] - 2]?.["Account Name"]?.trim() ?? normalizedName
              duplicateRowsByName.set(displayName, rowNumbers)
            }
          }
        }

        const overage = accountedSubtypeRows - sourceRowCount
        const countDetail =
          exceptionSubtypeRows > 0
            ? `source ${sourceRowCount}, canonical ${canonicalSubtypeRows}, exceptions ${exceptionSubtypeRows}`
            : `source ${sourceRowCount}, canonical ${canonicalSubtypeRows}`
        if (duplicateRowsByName.size > 0) {
          const duplicateDescriptions = Array.from(duplicateRowsByName.entries())
            .map(([name, rowNumbers]) => `"${name}" at rows ${rowNumbers.join(", ")}`)
            .join("; ")
          details.push(
            `${subtype.label}: ${countDetail}, duplicate account name ${duplicateDescriptions}.`
          )
        } else if (overage > 0) {
          details.push(`${subtype.label}: ${countDetail}, over by ${overage}.`)
        } else if (overage < 0) {
          details.push(`${subtype.label}: ${countDetail}, under by ${Math.abs(overage)}.`)
        } else {
          details.push(`${subtype.label}: ${countDetail}, matched.`)
        }
      }
    }

    reports.push({
      id: entity,
      label: spec.label,
      status: unaccountedRows === 0 ? "pass" : "fail",
      sourceRows,
      canonicalRows,
      exceptionRows,
      accountedRows,
      unaccountedRows,
      details,
    })
  }

  return reports
}

function buildFindings(
  sourceSheets: SourceSheetSummary[],
  requiredOutputGroups: RequiredOutputGroupReport[],
  files: InternalCsvFileReport[],
  crossReferenceChecks: CrossReferenceReport[],
  reconciliation: ReconciliationReport[],
  duplicateMessages: string[]
) {
  const findings: Finding[] = []

  const failingSourceSheets = sourceSheets.filter(sheet => sheet.status === "fail")
  if (failingSourceSheets.length > 0) {
    findings.push({
      id: "source-inputs-missing",
      severity: "blocker",
      owner: "Human Reviewer",
      area: "Source Inputs",
      status: "open",
      summary: "One or more source workbooks or sheets are missing.",
      evidence: failingSourceSheets.map(sheet => `${sheet.workbook} :: ${sheet.sheet}`).join("; "),
      nextAction: "Restore the required workbook inputs under 2026-04-17_Import_Test_Data before running readiness checks again.",
    })
  }

  for (const group of requiredOutputGroups.filter(candidate => candidate.status === "fail")) {
    findings.push({
      id: `required-output-${group.id}`,
      severity: "blocker",
      owner: "Agent A",
      area: "Required Outputs",
      status: "open",
      summary: `${group.label} are incomplete.`,
      evidence: group.missingPatterns.join("; "),
      nextAction: `Generate the missing outputs in ${PACKAGE_RELATIVE_ROOT} and rerun scripts/report-full-import-readiness.ts.`,
    })
  }

  for (const file of files.filter(candidate => candidate.exists)) {
    if (file.parseErrors.length > 0) {
      findings.push({
        id: `parse-${path.posix.basename(file.relativePath)}`,
        severity: "blocker",
        owner: "Agent A",
        area: "CSV Parsing",
        status: "open",
        summary: `${file.relativePath} failed CSV parsing.`,
        evidence: file.parseErrors.join("; "),
        nextAction: `Repair ${file.relativePath} so it can be parsed as a CSV and rerun the readiness report.`,
      })
    }

    if (file.missingHeaders.length > 0) {
      findings.push({
        id: `headers-${path.posix.basename(file.relativePath)}`,
        severity: "blocker",
        owner: "Agent A",
        area: "Required Headers",
        status: "open",
        summary: `${file.relativePath} is missing required importer headers.`,
        evidence: file.missingHeaders.join("; "),
        nextAction: `Add the missing required headers to ${file.relativePath} and rerun the readiness report.`,
      })
    }

    if (file.blankRequiredValues.length > 0) {
      findings.push({
        id: `blank-values-${path.posix.basename(file.relativePath)}`,
        severity: "blocker",
        owner: "Agent A",
        area: "Required Values",
        status: "open",
        summary: `${file.relativePath} has blank values in required importer columns.`,
        evidence: file.blankRequiredValues
          .map(issue => `${issue.field}: ${issue.count} blanks at rows ${issue.rows.join(", ")}`)
          .join("; "),
        nextAction: `Populate the required values in ${file.relativePath} or move those rows to the matching exception file.`,
      })
    }

    if (file.batchSummary?.status === "fail") {
      findings.push({
        id: `batch-limit-${path.posix.basename(file.relativePath)}`,
        severity: "blocker",
        owner: "Agent A",
        area: "Batch Limits",
        status: "open",
        summary: `${file.relativePath} exceeds the ${REVENUE_BATCH_LIMIT.toLocaleString()}-row batch limit.`,
        evidence: `${file.rowCount} rows`,
        nextAction: `Split ${file.relativePath} into smaller batches at or below ${REVENUE_BATCH_LIMIT.toLocaleString()} rows.`,
      })
    }

    if (file.unexpectedHeaders.length > 0) {
      findings.push({
        id: `unexpected-headers-${path.posix.basename(file.relativePath)}`,
        severity: "warning",
        owner: "Agent A",
        area: "Unexpected Headers",
        status: "open",
        summary: `${file.relativePath} contains headers outside the importer catalog.`,
        evidence: file.unexpectedHeaders.join("; "),
        nextAction: `Confirm the extra headers are intentional and safe, or remove them before the import run.`,
      })
    }
  }

  for (const duplicateMessage of duplicateMessages) {
    findings.push({
      id: `duplicate-${findings.length + 1}`,
      severity: "blocker",
      owner: "Agent A",
      area: "Duplicate Keys",
      status: "open",
      summary: "Duplicate canonical keys were detected in the import package.",
      evidence: duplicateMessage,
      nextAction: "Deduplicate the canonical files so downstream cross-file references stay unambiguous.",
    })
  }

  for (const check of crossReferenceChecks.filter(candidate => candidate.status === "fail")) {
    findings.push({
      id: `xref-${check.id}`,
      severity: "blocker",
      owner: "Agent A",
      area: "Cross-file References",
      status: "open",
      summary: `${check.label} failed.`,
      evidence: check.failures
        .slice(0, 10)
        .map(failure => `${failure.sourceFile} row ${failure.rowNumber}: ${failure.message}`)
        .join("; "),
      nextAction: "Resolve the missing references or move the impacted rows into the appropriate exception file.",
    })
  }

  for (const rowSet of reconciliation.filter(candidate => candidate.unaccountedRows !== 0)) {
    if (rowSet.id === "accounts") {
      const accountDetails = rowSet.details

      for (const [prefix, findingIdBase] of [
        ["Customers:", "accounts-customers"],
        ["Distributors:", "accounts-distributors"],
        ["Vendors:", "accounts-vendors"],
      ] as const) {
        const detail = accountDetails.find(candidate => candidate.startsWith(prefix) && !candidate.endsWith("matched."))
        if (!detail) {
          continue
        }

        const area = detail.includes("duplicate account name") ? "Duplicate Keys" : "Row Reconciliation"
        const summary = detail.includes("duplicate account name")
          ? `${prefix.slice(0, -1)} accounts file contains a duplicate account key.`
          : detail.includes("over by")
            ? `${prefix.slice(0, -1)} accounts file has more rows than the source workbook.`
            : `${prefix.slice(0, -1)} accounts file has fewer rows than the source workbook.`
        const nextAction = detail.includes("duplicate account name")
          ? `Deduplicate the ${prefix.slice(0, -1).toLowerCase()} accounts output so each canonical account name appears only once unless an explicit exception path is documented.`
          : detail.includes("over by")
            ? `Remove or explicitly account for the extra ${prefix.slice(0, -1).toLowerCase()} rows, then rerun the readiness report.`
            : `Restore or explicitly account for the missing ${prefix.slice(0, -1).toLowerCase()} rows, then rerun the readiness report.`

        findings.push({
          id: detail.includes("duplicate account name") ? `${findingIdBase}-duplicate` : `${findingIdBase}-mismatch`,
          severity: "blocker",
          owner: "Agent A",
          area,
          status: "open",
          summary,
          evidence: detail,
          nextAction,
        })
      }

      continue
    }

    findings.push({
      id: `reconcile-${rowSet.id}`,
      severity: "blocker",
      owner: "Agent A",
      area: "Row Reconciliation",
      status: "open",
      summary: `${rowSet.label} rows do not reconcile back to the source workbooks.`,
      evidence: `Source=${rowSet.sourceRows}; Canonical=${rowSet.canonicalRows}; Exceptions=${rowSet.exceptionRows}; Unaccounted=${rowSet.unaccountedRows}`,
      nextAction: "Account for every source row in either a canonical file or an exception file, then rerun the readiness report.",
    })
  }

  return findings.sort((left, right) => left.id.localeCompare(right.id))
}

function buildExecutionGates(
  sourceSheets: SourceSheetSummary[],
  requiredOutputGroups: RequiredOutputGroupReport[],
  reconciliation: ReconciliationReport[],
  blockerCount: number
): ExecutionGateReport[] {
  const failedReconciliations = reconciliation.filter(entry => entry.status !== "pass")

  return [
    {
      wave: "0",
      owner: "Human + Agent C",
      label: "Environment readiness",
      status: "not_run",
      evidence: "Human environment/reset approval is not captured by this file-only readiness pass.",
    },
    {
      wave: "1",
      owner: "Agent A",
      label: "Canonical file generation",
      status:
        requiredOutputGroups.every(group => group.status === "pass") && failedReconciliations.length === 0 ? "pass" : "fail",
      evidence:
        requiredOutputGroups.every(group => group.status === "pass") && failedReconciliations.length === 0
          ? "All required outputs are present and all entity totals reconcile to source."
          : [
              ...requiredOutputGroups
                .filter(group => group.status !== "pass")
                .map(group => `${group.label} missing ${group.missingPatterns.join(", ")}`),
              ...failedReconciliations.map(entry => `${entry.label}: ${entry.details.join(" ") || `${entry.unaccountedRows} unaccounted rows`}`),
            ].join(" "),
    },
    {
      wave: "2",
      owner: "Agent B",
      label: "Importer hardening",
      status: "not_run",
      evidence: "Importer hardening is outside this file-only verification pass.",
    },
    {
      wave: "3",
      owner: "Agent C",
      label: "Dry-run / readiness checks",
      status: blockerCount === 0 ? "pass" : "fail",
      evidence:
        blockerCount === 0
          ? "No open blockers were found in the readiness report."
          : `${blockerCount} blocker(s) remain open in the readiness report.`,
    },
  ]
}

export function validateFullImportFiles(options: ValidationOptions = {}): FullImportValidationReport {
  const projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : process.cwd()
  const { sourceSheets, totals } = readSourceSheets(projectRoot)
  const staticFiles = STATIC_FILE_SPECS.map(spec => readStaticCsvFile(projectRoot, spec))
  const batchFiles = readRevenueBatchFiles(projectRoot)
  const files = [...staticFiles, ...batchFiles].sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  const requiredOutputGroups = buildRequiredOutputGroups(files)
  const crossReferenceResult = runCrossReferenceChecks(files)
  const reconciliation = buildReconciliation(files, totals, sourceSheets)
  const findings = buildFindings(
    sourceSheets,
    requiredOutputGroups,
    files,
    crossReferenceResult.checks,
    reconciliation,
    crossReferenceResult.duplicateMessages
  )

  const blockerCount = findings.filter(finding => finding.severity === "blocker").length
  const warningCount = findings.filter(finding => finding.severity === "warning").length
  const filesChecked = STATIC_FILE_SPECS.length + batchFiles.length
  const filesPresent = files.filter(file => file.exists).length
  const filesMissing = filesChecked - filesPresent
  const executionGates = buildExecutionGates(sourceSheets, requiredOutputGroups, reconciliation, blockerCount)

  return {
    reportVersion: 1,
    packageRoot: path.join(projectRoot, PACKAGE_RELATIVE_ROOT),
    packageRelativeRoot: toPosix(PACKAGE_RELATIVE_ROOT),
    status: blockerCount === 0 ? "ready" : "blocked",
    summary: {
      blockerCount,
      warningCount,
      filesChecked,
      filesPresent,
      filesMissing,
    },
    sourceSheets,
    requiredOutputGroups,
    files: files.map(({ rows: _rows, ...file }) => file),
    crossReferenceChecks: crossReferenceResult.checks,
    reconciliation,
    findings,
    executionGates,
    optionalChecks: [
      {
        id: "database-verification",
        label: "Database-backed import verification",
        status: "not_run",
        reason: "Skipped by design. This readiness pass is file-only unless a separate DB-dependent verification step is requested.",
      },
    ],
  }
}

function main() {
  const report = validateFullImportFiles()
  console.log(JSON.stringify(report, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
