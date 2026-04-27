import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import Papa from "papaparse"
import XLSX from "xlsx"

type CsvRow = Record<string, string>

const SOURCE_ROOT = "2026-04-17_Import_Test_Data"
const FULL_IMPORT_ROOT = path.join("docs", "test-data", "data-settings-imports", "full-import")
const OUTPUT_ROOT = path.join(SOURCE_ROOT, "UI_Import_Files")

const OPPORTUNITY_ROLE_PRIORITY = [
  "Client Contact",
  "Customer Contact",
  "Influencer",
  "Other",
  "Distributor Contact",
  "Distributor - Account Executive",
  "Distributor - Order Entry",
  "Order Entry",
  "Referral Partner - Account Exec",
  "Vendor Contact"
]

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function readCsv(projectRoot: string, relativePath: string) {
  const absolutePath = path.join(projectRoot, relativePath)
  const parsed = Papa.parse<CsvRow>(fs.readFileSync(absolutePath, "utf8"), {
    header: true,
    skipEmptyLines: true
  })
  if (parsed.errors.length > 0) {
    throw new Error(`Unable to parse ${relativePath}: ${parsed.errors[0]?.message}`)
  }
  return parsed.data.filter((row): row is CsvRow => Boolean(row) && typeof row === "object")
}

function readWorkbookRows(projectRoot: string, relativePath: string, sheetName: string) {
  const workbook = XLSX.readFile(path.join(projectRoot, relativePath))
  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet) {
    throw new Error(`Workbook ${relativePath} is missing sheet ${sheetName}`)
  }
  return XLSX.utils.sheet_to_json<CsvRow>(worksheet, { defval: "" })
}

function writeWorkbook(projectRoot: string, fileName: string, sheetName: string, rows: CsvRow[]) {
  fs.mkdirSync(path.join(projectRoot, OUTPUT_ROOT), { recursive: true })
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, path.join(projectRoot, OUTPUT_ROOT, fileName))
}

function appendNote(existing: string, note: string) {
  return existing ? `${existing} ${note}` : note
}

function hasValue(value: string | undefined) {
  return Boolean((value ?? "").trim())
}

function clearAddress(row: CsvRow, prefix: "Shipping" | "Billing") {
  for (const field of ["Street", "City", "State", "Zip", "Country"]) {
    row[`${prefix} ${field}`] = ""
  }
}

function normalizeAccountAddresses(row: CsvRow) {
  const hadIncompleteShipping =
    (hasValue(row["Shipping Street"]) ||
      hasValue(row["Shipping City"]) ||
      hasValue(row["Shipping State"]) ||
      hasValue(row["Shipping Zip"])) &&
    (!hasValue(row["Shipping Street"]) || !hasValue(row["Shipping City"]))
  const hadIncompleteBilling =
    (hasValue(row["Billing Street"]) ||
      hasValue(row["Billing City"]) ||
      hasValue(row["Billing State"]) ||
      hasValue(row["Billing Zip"])) &&
    (!hasValue(row["Billing Street"]) || !hasValue(row["Billing City"]))

  if (hadIncompleteShipping) {
    clearAddress(row, "Shipping")
  }
  if (hadIncompleteBilling) {
    clearAddress(row, "Billing")
  }
  if (hadIncompleteShipping || hadIncompleteBilling) {
    row.Description = appendNote(
      row.Description ?? "",
      "Incomplete source address omitted for one-file UI import testing."
    )
  }

  return row
}

function buildAccountNameMap(projectRoot: string) {
  const rows = readCsv(projectRoot, path.join(FULL_IMPORT_ROOT, "00_account_name_crosswalk.csv"))
  return new Map(rows.map(row => [normalizeKey(row["Source Name"] ?? ""), row["Canonical Name"] ?? ""]))
}

function canonicalAccountName(accountNameMap: Map<string, string>, value: string) {
  return accountNameMap.get(normalizeKey(value)) || value.trim()
}

function splitContactName(fullName: string) {
  const normalized = fullName.trim().replace(/\s+/g, " ")
  if (!normalized) {
    return { firstName: "", lastName: "" }
  }
  const parts = normalized.split(" ")
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "Legacy Contact" }
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1]
  }
}

function rolePriority(role: string) {
  const index = OPPORTUNITY_ROLE_PRIORITY.indexOf(role)
  return index === -1 ? 999 : index
}

function buildRoleLookup(projectRoot: string, accountNameMap: Map<string, string>) {
  const rows = readWorkbookRows(
    projectRoot,
    path.join(SOURCE_ROOT, "Master-Opportunity_Contact_Roles (1).xlsx"),
    "Opportunity Contact Roles"
  )

  const lookup = new Map<string, CsvRow[]>()
  for (const row of rows) {
    const accountName = canonicalAccountName(accountNameMap, row["Account Name"] ?? "")
    const opportunityName = row["Opportunity Name"] ?? ""
    if (!accountName || !opportunityName) {
      continue
    }
    const key = `${normalizeKey(accountName)}::${normalizeKey(opportunityName)}`
    const values = lookup.get(key) ?? []
    values.push(row)
    lookup.set(key, values)
  }

  for (const values of lookup.values()) {
    values.sort((left, right) => rolePriority(left.Role ?? "") - rolePriority(right.Role ?? ""))
  }

  return lookup
}

function buildAccounts(projectRoot: string) {
  const rows = [
    ...readCsv(projectRoot, path.join(FULL_IMPORT_ROOT, "01_accounts_customers.csv")),
    ...readCsv(projectRoot, path.join(FULL_IMPORT_ROOT, "01_accounts_distributors.csv")),
    ...readCsv(projectRoot, path.join(FULL_IMPORT_ROOT, "01_accounts_vendors.csv")),
    ...readCsv(projectRoot, path.join(FULL_IMPORT_ROOT, "01_accounts_supplemental.csv"))
  ]
  const rowByName = new Map(rows.map(row => [normalizeKey(row["Account Name"] ?? ""), row]))

  for (const row of [...rows]) {
    const parentName = row["Parent Account Name"] ?? ""
    const parentKey = normalizeKey(parentName)
    if (!parentKey || rowByName.has(parentKey)) {
      continue
    }

    const parentRow: CsvRow = {
      "Account Name": parentName.trim(),
      "Account Number": "",
      "Account Type": "Customer",
      "Account Legal Name": parentName.trim(),
      "Website URL": "",
      Description: "Generated placeholder parent account for one-file UI import testing.",
      "Parent Account Name": "",
      "Billing Same As Shipping": "true",
      "Shipping Street": "",
      "Shipping City": "",
      "Shipping State": "",
      "Shipping Zip": "",
      "Billing Street": "",
      "Billing City": "",
      "Billing State": "",
      "Billing Zip": ""
    }
    rows.push(parentRow)
    rowByName.set(parentKey, parentRow)
  }

  const sorted: CsvRow[] = []
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const visit = (row: CsvRow) => {
    const key = normalizeKey(row["Account Name"] ?? "")
    if (!key || visited.has(key)) {
      return
    }
    if (visiting.has(key)) {
      sorted.push(row)
      visited.add(key)
      return
    }

    visiting.add(key)
    const parent = rowByName.get(normalizeKey(row["Parent Account Name"] ?? ""))
    if (parent) {
      visit(parent)
    }
    visiting.delete(key)
    if (!visited.has(key)) {
      sorted.push(row)
      visited.add(key)
    }
  }

  for (const row of rows) {
    visit(row)
  }

  return sorted.map(row => normalizeAccountAddresses({ ...row }))
}

function buildContacts(projectRoot: string, accountNameMap: Map<string, string>, roleLookup: Map<string, CsvRow[]>) {
  const contacts = readCsv(projectRoot, path.join(FULL_IMPORT_ROOT, "02_contacts.csv"))
  const existingContactKeys = new Set(
    contacts.map(row => `${normalizeKey(row["Account Name"] ?? "")}::${normalizeKey(row["Email Address"] ?? "")}`)
  )

  const supplementalContacts: CsvRow[] = []
  for (const [key, roles] of roleLookup.entries()) {
    const accountName = key.split("::")[0] ?? ""
    for (const role of roles) {
      const email = role.Email ?? ""
      const contactName = role["Contact Name"] ?? ""
      if (!email || !contactName) {
        continue
      }
      const canonicalAccount = canonicalAccountName(accountNameMap, role["Account Name"] ?? "")
      const contactKey = `${normalizeKey(canonicalAccount)}::${normalizeKey(email)}`
      if (existingContactKeys.has(contactKey)) {
        continue
      }
      const { firstName, lastName } = splitContactName(contactName)
      supplementalContacts.push({
        "Account Name": canonicalAccount,
        "First Name": firstName,
        "Last Name": lastName,
        "Job Title": role.Title ?? "",
        "Work Phone": role.Phone ?? "",
        "Work Phone Extension": "",
        "Mobile Phone": "",
        "Email Address": email,
        Description: "Generated from Master-Opportunity_Contact_Roles for one-file UI import testing."
      })
      existingContactKeys.add(contactKey)
    }
  }

  return [...contacts, ...supplementalContacts]
}

function buildProducts(projectRoot: string) {
  return readCsv(projectRoot, path.join(FULL_IMPORT_ROOT, "03_products.csv")).map(row => {
    const hadProductPicklistValues = Boolean(
      (row["Product Family (House)"] ?? "").trim() ||
        (row["Product Subtype (House)"] ?? "").trim() ||
        (row["Product Family (Vendor)"] ?? "").trim() ||
        (row["Product Subtype (Vendor)"] ?? "").trim() ||
        (row["Product Family (Distributor)"] ?? "").trim() ||
        (row["Product Subtype (Distributor)"] ?? "").trim()
    )
    const rawCommissionPercent = row["Commission Percent"] ?? ""
    const normalized = rawCommissionPercent.replace(/,/g, "").replace(/%$/g, "").trim()
    const parsed = normalized ? Number(normalized) : null
    const next = { ...row }

    if (hadProductPicklistValues) {
      next["Product Family (House)"] = ""
      next["Product Subtype (House)"] = ""
      next["Product Family (Vendor)"] = ""
      next["Product Subtype (Vendor)"] = ""
      next["Product Family (Distributor)"] = ""
      next["Product Subtype (Distributor)"] = ""
      next.Description = appendNote(
        next.Description ?? "",
        "Source product family/subtype omitted because active Data Settings picklists are not part of this one-file product import."
      )
    }

    if (parsed !== null && Number.isFinite(parsed) && (parsed < 0 || parsed > 100)) {
      next["Commission Percent"] = ""
      next.Description = appendNote(
        next.Description ?? "",
        `Source commission percent ${rawCommissionPercent} omitted because product import accepts 0-100.`
      )
    }

    return next
  })
}

function buildOpportunities(
  projectRoot: string,
  accountNameMap: Map<string, string>,
  roleLookup: Map<string, CsvRow[]>
) {
  const opportunityRows = readCsv(projectRoot, path.join(FULL_IMPORT_ROOT, "04_opportunities_exceptions.csv"))

  return opportunityRows.map(row => {
    const accountName = row["Canonical Account Name"] ?? row["Account Name"] ?? ""
    const opportunityName = row["Opportunity Name"] ?? ""
    const key = `${normalizeKey(accountName)}::${normalizeKey(opportunityName)}`
    const role = (roleLookup.get(key) ?? []).find(candidate => {
      return candidate.Role && candidate["Contact Name"]
    })

    const roleName = role?.Role || "Legacy Migration Contact"
    const roleContactName = role?.["Contact Name"] || "Legacy Migration Contact"
    const roleContactEmail = role?.Email || ""
    const roleContactPhone = role?.Phone || ""
    const roleContactTitle = role?.Title || ""
    const hasSourceRole = Boolean(role)

    return {
      "Account Name": accountName,
      "Opportunity Name": opportunityName,
      Role: roleName,
      "Role Contact Name": roleContactName,
      "Role Contact Email": roleContactEmail,
      "Role Contact Phone": roleContactPhone,
      "Role Contact Title": roleContactTitle,
      Stage: row["Canonical Stage"] ?? row.Stage ?? "",
      Description: hasSourceRole
        ? "Role/contact sourced from Master-Opportunity_Contact_Roles."
        : "No source role row matched; using Legacy Migration Contact fallback for UI import testing."
    }
  })
}

function buildRevenueSchedules(projectRoot: string) {
  const packageRoot = path.join(projectRoot, FULL_IMPORT_ROOT)
  const fileNames = fs
    .readdirSync(packageRoot)
    .filter(fileName => /^05_revenue_schedules_(open|settled)_batch_\d{3}\.csv$/i.test(fileName))
    .sort((left, right) => left.localeCompare(right))

  return fileNames.flatMap(fileName => readCsv(projectRoot, path.join(FULL_IMPORT_ROOT, fileName)))
}

function buildDepositTransactionsSample() {
  return [
    {
      "Source Deposit Key": "UI-DEP-001",
      "Source Transaction Key": "UI-TX-001",
      "Deposit Name": "UI Test Deposit 001",
      "Commission Period": "2026-04",
      "Payment Date": "2026-04-15",
      "Line Item": "1",
      "Account Legal Name": "UI Test Customer",
      "Actual Usage": "500",
      "Actual Commission": "50.00",
      Notes: "Small sample for Deposits / Transactions UI import testing."
    },
    {
      "Source Deposit Key": "UI-DEP-001",
      "Source Transaction Key": "UI-TX-002",
      "Deposit Name": "UI Test Deposit 001",
      "Commission Period": "2026-04",
      "Payment Date": "2026-04-15",
      "Line Item": "2",
      "Account Legal Name": "UI Test Customer",
      "Actual Usage": "250",
      "Actual Commission": "25.00",
      Notes: "Small sample for Deposits / Transactions UI import testing."
    }
  ]
}

export function buildUiImportWorkbooks(projectRoot = process.cwd()) {
  const accountNameMap = buildAccountNameMap(projectRoot)
  const roleLookup = buildRoleLookup(projectRoot, accountNameMap)

  const outputs = [
    {
      fileName: "01_Accounts_UI_Import.xlsx",
      sheetName: "Accounts",
      rows: buildAccounts(projectRoot)
    },
    {
      fileName: "02_Contacts_UI_Import.xlsx",
      sheetName: "Contacts",
      rows: buildContacts(projectRoot, accountNameMap, roleLookup)
    },
    {
      fileName: "03_Products_UI_Import.xlsx",
      sheetName: "Products",
      rows: buildProducts(projectRoot)
    },
    {
      fileName: "04_Opportunities_UI_Import.xlsx",
      sheetName: "Opportunities",
      rows: buildOpportunities(projectRoot, accountNameMap, roleLookup)
    },
    {
      fileName: "05_Deposit_Transactions_UI_Sample.xlsx",
      sheetName: "Deposit Transactions",
      rows: buildDepositTransactionsSample()
    },
    {
      fileName: "06_Revenue_Schedules_UI_Import.xlsx",
      sheetName: "Revenue Schedules",
      rows: buildRevenueSchedules(projectRoot)
    }
  ]

  for (const output of outputs) {
    writeWorkbook(projectRoot, output.fileName, output.sheetName, output.rows)
  }

  return outputs.map(output => ({
    fileName: path.join(OUTPUT_ROOT, output.fileName),
    rows: output.rows.length
  }))
}

function main() {
  console.log(JSON.stringify(buildUiImportWorkbooks(), null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
