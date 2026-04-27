import fs from "node:fs"
import path from "node:path"
import Papa from "papaparse"

type CsvRow = Record<string, string>

const FIXTURE_PATH = path.resolve(process.cwd(), "wave-1-first-real-reconciliation-2026-04.csv")

const EXPECTED_HEADERS = [
  "Scenario ID",
  "Source Ref",
  "Phase",
  "Commission Period",
  "Commission Payment Date",
  "Customer Business Name",
  "Customer Id",
  "Location Id",
  "Acquired Master Agency Name",
  "Supplier Name",
  "Telarus Order Id",
  "Partner Order Id",
  "Product Name",
  "Services",
  "Total Bill",
  "Commission Rate",
  "Commission Role - Master Agent",
  "Commission Role - Subject Matter Expert",
  "Total Commission",
  "Description",
] as const

const EXPECTED_REAL_SCENARIO_IDS = [
  "W1-ACC-01",
  "W1-ACC-02",
  "W1-ACC-03",
  "W1-ACC-04",
  "W1-ACC-05",
  "W1-ACC-06",
  "W1-ACC-07",
  "W1-ACC-08",
  "W1-ACC-09",
  "W1-ACC-10",
  "W1-ACC-11",
  "W1-ACC-12",
  "W1-ACC-13",
  "W1-ACC-14",
  "W1-ACC-15",
  "W1-ACC-16",
  "W1-ACC-17",
  "W1-ADV-01",
  "W1-ATT-01",
  "W1-ATT-02",
  "W1-ATT-03",
  "W1-ATT-04",
  "W1-ATT-05",
  "W1-ATT-06",
  "W1-BIG-01",
  "W1-BIG-02",
] as const

const EXPECTED_TOTAL_ROWS = {
  "W1-TOTAL-ACC": { customer: "ACC Business Total", supplier: "ACC Business Total", bill: 8664.14, commission: 1399.99 },
  "W1-TOTAL-ADV": { customer: "Advantix Total", supplier: "Advantix Total", bill: 660.0, commission: 105.6 },
  "W1-TOTAL-ATT": { customer: "AT&T Total", supplier: "AT&T Total", bill: 1740.0, commission: 225.04 },
  "W1-TOTAL-BIG": { customer: "Bigleaf Total", supplier: "Bigleaf Total", bill: 757.88, commission: 76.55 },
  "W1-TOTAL-GRAND": { customer: "Grand Total", supplier: "Grand Total", bill: 11822.02, commission: 1807.18 },
} as const

const EXPECTED_GROUP_TOTALS = {
  "ACC Business": { bill: 8664.14, commission: 1399.99 },
  "Advantix": { bill: 660.0, commission: 105.6 },
  "AT&T": { bill: 1740.0, commission: 225.04 },
  "Bigleaf": { bill: 757.88, commission: 76.55 },
} as const

const FORBIDDEN_CUSTOMERS = [
  "Paramount Staffing",
  "Plan Professional",
  "REIT Funding",
  "Stonemont Financial",
  "Win-Tech, Inc.",
  "Rent the Runway",
] as const

const REQUIRED_NORMALIZED_CUSTOMERS = [
  "KRE UP Holdings",
  "Trimont Real Estate",
  "Level Creek Property",
  "Masterpiece Lighting LLC",
] as const

function fail(message: string): never {
  throw new Error(message)
}

function parseMoney(value: string, fieldName: string, scenarioId: string) {
  const trimmed = value.trim()
  if (!trimmed) fail(`Missing ${fieldName} for ${scenarioId}`)
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    fail(`Invalid ${fieldName} "${value}" for ${scenarioId}`)
  }
  return parsed
}

function expectEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) fail(`${message}. Expected "${expected}", got "${actual}"`)
}

function expectApprox(actual: number, expected: number, message: string, tolerance = 0.0001) {
  if (Math.abs(actual - expected) > tolerance) {
    fail(`${message}. Expected ${expected.toFixed(2)}, got ${actual.toFixed(2)}`)
  }
}

function readCsvRows() {
  if (!fs.existsSync(FIXTURE_PATH)) {
    fail(`Fixture file not found: ${FIXTURE_PATH}`)
  }

  const text = fs.readFileSync(FIXTURE_PATH, "utf8")
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
  })
  const headers = Array.isArray(parsed.meta.fields) ? parsed.meta.fields : []
  const rows = parsed.data.filter((row): row is CsvRow => Boolean(row) && typeof row === "object")

  if (parsed.errors.length > 0) {
    const firstError = parsed.errors[0]
    fail(`CSV parse error: ${firstError?.message ?? "unknown error"}`)
  }

  return {
    headers,
    rows,
  }
}

function main() {
  const { headers, rows } = readCsvRows()

  expectEqual(headers.length, EXPECTED_HEADERS.length, "Header count mismatch")
  EXPECTED_HEADERS.forEach((header, index) => {
    expectEqual(headers[index] ?? "", header, `Header mismatch at column ${index + 1}`)
  })

  expectEqual(rows.length, 31, "Unexpected row count")

  const totalsRows = rows.filter(row => row["Scenario ID"].startsWith("W1-TOTAL-"))
  const realRows = rows.filter(row => !row["Scenario ID"].startsWith("W1-TOTAL-"))

  expectEqual(realRows.length, 26, "Unexpected real-row count")
  expectEqual(totalsRows.length, 5, "Unexpected totals-row count")

  const seenScenarioIds = new Set<string>()
  for (const row of rows) {
    const scenarioId = row["Scenario ID"].trim()
    if (!scenarioId) fail("Found row with blank Scenario ID")
    if (seenScenarioIds.has(scenarioId)) fail(`Duplicate Scenario ID: ${scenarioId}`)
    seenScenarioIds.add(scenarioId)
    expectEqual(row["Phase"].trim(), "wave-1", `Unexpected Phase for ${scenarioId}`)
    expectEqual(row["Commission Period"].trim(), "2026-04", `Unexpected Commission Period for ${scenarioId}`)
    expectEqual(row["Commission Payment Date"].trim(), "2026-04-15", `Unexpected Commission Payment Date for ${scenarioId}`)
    expectEqual(row["Acquired Master Agency Name"].trim(), "Telarus", `Unexpected distributor for ${scenarioId}`)
  }

  EXPECTED_REAL_SCENARIO_IDS.forEach(id => {
    if (!seenScenarioIds.has(id)) fail(`Missing expected real Scenario ID: ${id}`)
  })
  Object.keys(EXPECTED_TOTAL_ROWS).forEach(id => {
    if (!seenScenarioIds.has(id)) fail(`Missing expected total Scenario ID: ${id}`)
  })

  FORBIDDEN_CUSTOMERS.forEach(customer => {
    const found = realRows.some(row => row["Customer Business Name"].trim() === customer)
    if (found) fail(`Forbidden Wave 0/Wave 2 customer found in Wave 1 fixture: ${customer}`)
  })

  REQUIRED_NORMALIZED_CUSTOMERS.forEach(customer => {
    const found = realRows.some(row => row["Customer Business Name"].trim() === customer)
    if (!found) fail(`Missing required normalized customer name: ${customer}`)
  })

  const realRowIds = new Set(realRows.map(row => row["Scenario ID"].trim()))
  EXPECTED_REAL_SCENARIO_IDS.forEach(id => {
    if (!realRowIds.has(id)) fail(`Expected real row not found in real-row set: ${id}`)
  })

  const groupSums = new Map<string, { bill: number; commission: number }>()
  for (const row of realRows) {
    const scenarioId = row["Scenario ID"].trim()
    const supplier = row["Supplier Name"].trim()
    const bill = parseMoney(row["Total Bill"], "Total Bill", scenarioId)
    const commission = parseMoney(row["Total Commission"], "Total Commission", scenarioId)
    const current = groupSums.get(supplier) ?? { bill: 0, commission: 0 }
    current.bill += bill
    current.commission += commission
    groupSums.set(supplier, current)
  }

  Object.entries(EXPECTED_GROUP_TOTALS).forEach(([supplier, expected]) => {
    const actual = groupSums.get(supplier)
    if (!actual) fail(`Missing expected supplier group: ${supplier}`)
    expectApprox(actual.bill, expected.bill, `Total Bill mismatch for supplier ${supplier}`)
    expectApprox(actual.commission, expected.commission, `Total Commission mismatch for supplier ${supplier}`)
  })

  Object.entries(EXPECTED_TOTAL_ROWS).forEach(([scenarioId, expected]) => {
    const row = totalsRows.find(candidate => candidate["Scenario ID"].trim() === scenarioId)
    if (!row) fail(`Missing totals row ${scenarioId}`)
    expectEqual(row["Customer Business Name"].trim(), expected.customer, `Totals customer mismatch for ${scenarioId}`)
    expectEqual(row["Supplier Name"].trim(), expected.supplier, `Totals supplier mismatch for ${scenarioId}`)
    expectApprox(parseMoney(row["Total Bill"], "Total Bill", scenarioId), expected.bill, `Totals bill mismatch for ${scenarioId}`)
    expectApprox(parseMoney(row["Total Commission"], "Total Commission", scenarioId), expected.commission, `Totals commission mismatch for ${scenarioId}`)
  })

  const grandBill = realRows.reduce((sum, row) => sum + Number(row["Total Bill"]), 0)
  const grandCommission = realRows.reduce((sum, row) => sum + Number(row["Total Commission"]), 0)
  expectApprox(grandBill, EXPECTED_TOTAL_ROWS["W1-TOTAL-GRAND"].bill, "Grand Total Bill mismatch")
  expectApprox(grandCommission, EXPECTED_TOTAL_ROWS["W1-TOTAL-GRAND"].commission, "Grand Total Commission mismatch")

  const bigleafSmeRow = realRows.find(row => row["Scenario ID"].trim() === "W1-BIG-01")
  if (!bigleafSmeRow) fail("Missing W1-BIG-01 row")
  expectEqual(bigleafSmeRow["Commission Role - Master Agent"].trim(), "0.00", "Unexpected Master Agent value for W1-BIG-01")
  expectEqual(bigleafSmeRow["Commission Role - Subject Matter Expert"].trim(), "44.71", "Unexpected SME value for W1-BIG-01")
  expectEqual(bigleafSmeRow["Total Commission"].trim(), "44.71", "Unexpected Total Commission value for W1-BIG-01")

  console.log(
    JSON.stringify(
      {
        fixturePath: FIXTURE_PATH,
        headerCount: headers.length,
        realRows: realRows.length,
        totalRows: totalsRows.length,
        grandTotalBill: grandBill.toFixed(2),
        grandTotalCommission: grandCommission.toFixed(2),
        status: "ok",
      },
      null,
      2
    )
  )
}

main()
