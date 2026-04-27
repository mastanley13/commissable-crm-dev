import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import XLSX from "xlsx"

import { validateFullImportFiles } from "../scripts/validate-full-import-files"
import { writeFullImportReadinessOutputs } from "../scripts/report-full-import-readiness"

function makeTempProjectRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "full-import-readiness-"))
}

function writeWorkbook(projectRoot: string, fileName: string, sheets: Array<{ name: string; rows: string[][] }>) {
  const workbook = XLSX.utils.book_new()
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name)
  }
  const sourceRoot = path.join(projectRoot, "2026-04-17_Import_Test_Data")
  fs.mkdirSync(sourceRoot, { recursive: true })
  XLSX.writeFile(workbook, path.join(sourceRoot, fileName))
}

function writeCsv(projectRoot: string, relativePath: string, rows: string[][]) {
  const absolutePath = path.join(projectRoot, relativePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, `${rows.map(columns => columns.join(",")).join("\n")}\n`)
}

function seedSourceWorkbooks(projectRoot: string) {
  writeWorkbook(projectRoot, "Master Accounts File.xlsx", [
    { name: "Accounts", rows: [["Source Account"], ["Customer One"]] },
    { name: "Distributors", rows: [["Source Distributor"], ["Distributor One"]] },
    { name: "Vendors", rows: [["Source Vendor"], ["Vendor One"]] },
  ])

  writeWorkbook(projectRoot, "Master Contacts File.xlsx", [
    { name: "contacts_export (1)", rows: [["First", "Last"], ["Casey", "Contact"]] },
  ])

  writeWorkbook(projectRoot, "Master Opportunity File.xlsx", [
    { name: "Opportunities - All", rows: [["Opportunity"], ["Renewal"]] },
  ])

  writeWorkbook(projectRoot, "Master Revenue Schedule File.xlsx", [
    { name: "Revenue Schedules - settled", rows: [["Schedule"], ["Settled One"]] },
    { name: "Revenue Schedules - Open", rows: [["Schedule"], ["Open One"]] },
  ])

  writeWorkbook(projectRoot, "Products_classified.xlsx", [
    { name: "Opportunity Products", rows: [["Product"], ["PROD-001"]] },
    { name: "Product Fam & Subtype", rows: [["Family", "Subtype"], ["Network", "Fiber"]] },
  ])
}

function seedReadyPackage(projectRoot: string) {
  const packageRoot = path.join("docs", "test-data", "data-settings-imports", "full-import")

  writeCsv(projectRoot, path.join(packageRoot, "00_account_name_crosswalk.csv"), [["Source Name", "Canonical Name"]])
  writeCsv(projectRoot, path.join(packageRoot, "00_vendor_name_crosswalk.csv"), [["Source Name", "Canonical Name"]])
  writeCsv(projectRoot, path.join(packageRoot, "00_distributor_name_crosswalk.csv"), [["Source Name", "Canonical Name"]])
  writeCsv(projectRoot, path.join(packageRoot, "00_stage_value_crosswalk.csv"), [["Source Stage", "Canonical Stage"]])

  writeCsv(projectRoot, path.join(packageRoot, "01_accounts_customers.csv"), [
    ["Account Name", "Account Type"],
    ["Customer One", "Customer"],
  ])
  writeCsv(projectRoot, path.join(packageRoot, "01_accounts_distributors.csv"), [
    ["Account Name", "Account Type"],
    ["Distributor One", "Distributor"],
  ])
  writeCsv(projectRoot, path.join(packageRoot, "01_accounts_vendors.csv"), [
    ["Account Name", "Account Type"],
    ["Vendor One", "Vendor"],
  ])
  writeCsv(projectRoot, path.join(packageRoot, "01_accounts_supplemental.csv"), [["Account Name", "Account Type"]])

  writeCsv(projectRoot, path.join(packageRoot, "02_contacts.csv"), [
    ["Account Name", "First Name", "Last Name"],
    ["Customer One", "Casey", "Contact"],
  ])
  writeCsv(projectRoot, path.join(packageRoot, "02_contacts_exceptions.csv"), [["Reason"]])

  writeCsv(projectRoot, path.join(packageRoot, "03_products.csv"), [
    ["Product Code", "Product Name (House)", "Revenue Type", "Vendor Account Name", "Distributor Account Name"],
    ["PROD-001", "Primary Product", "MRC_House", "Vendor One", "Distributor One"],
  ])
  writeCsv(projectRoot, path.join(packageRoot, "03_products_exceptions.csv"), [["Reason"]])

  writeCsv(projectRoot, path.join(packageRoot, "04_opportunities.csv"), [
    ["Account Name", "Opportunity Name", "Role", "Role Contact Email"],
    ["Customer One", "Renewal", "Decision Maker", "casey@example.com"],
  ])
  writeCsv(projectRoot, path.join(packageRoot, "04_opportunities_exceptions.csv"), [["Reason"]])

  writeCsv(projectRoot, path.join(packageRoot, "05_revenue_schedules_open_batch_001.csv"), [
    ["Account Name", "Opportunity Name", "Product Code"],
    ["Customer One", "Renewal", "PROD-001"],
  ])
  writeCsv(projectRoot, path.join(packageRoot, "05_revenue_schedules_settled_batch_001.csv"), [
    ["Account Name", "Opportunity Name", "Product Code"],
    ["Customer One", "Renewal", "PROD-001"],
  ])
  writeCsv(projectRoot, path.join(packageRoot, "05_revenue_schedules_exceptions.csv"), [["Reason"]])
}

test("validateFullImportFiles reports the package as blocked when canonical outputs are missing", () => {
  const projectRoot = makeTempProjectRoot()
  seedSourceWorkbooks(projectRoot)

  const report = validateFullImportFiles({ projectRoot })

  assert.equal(report.status, "blocked")
  assert.equal(report.summary.blockerCount > 0, true)
  assert.equal(report.requiredOutputGroups.some(group => group.status === "fail"), true)
  assert.equal(report.executionGates.find(gate => gate.wave === "0")?.status, "not_run")
  assert.equal(report.executionGates.find(gate => gate.wave === "1")?.status, "fail")

  const accountsReconciliation = report.reconciliation.find(entry => entry.id === "accounts")
  assert.ok(accountsReconciliation)
  assert.equal(accountsReconciliation.unaccountedRows, 3)
})

test("writeFullImportReadinessOutputs writes ready-state reports for a reconciled package", () => {
  const projectRoot = makeTempProjectRoot()
  seedSourceWorkbooks(projectRoot)
  seedReadyPackage(projectRoot)

  const result = writeFullImportReadinessOutputs({ projectRoot })

  assert.equal(result.report.status, "ready")
  assert.equal(result.report.summary.blockerCount, 0)
  assert.equal(result.report.executionGates.find(gate => gate.wave === "0")?.status, "not_run")
  assert.equal(result.report.executionGates.find(gate => gate.wave === "1")?.status, "pass")
  assert.equal(
    fs.existsSync(path.join(projectRoot, "docs", "test-data", "data-settings-imports", "full-import", "readiness_report.md")),
    true
  )
  assert.equal(
    fs.existsSync(path.join(projectRoot, "docs", "plans", "2026-04-17-full-import-defect-log.csv")),
    true
  )

  const defectLog = fs.readFileSync(path.join(projectRoot, "docs", "plans", "2026-04-17-full-import-defect-log.csv"), "utf8")
  assert.match(defectLog, /^Defect ID,Severity,Area,Owner,Status,Summary,Evidence,Next Action/m)
  assert.equal(defectLog.trim().split(/\r?\n/).length, 1)
})
