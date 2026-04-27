import fs from "node:fs"
import path from "node:path"
import Papa from "papaparse"

type CsvRow = Record<string, string>

type ExpectedRow = {
  scenarioId: string
  sourceRef: string
  phase: string
  period: string
  paymentDate: string
  customer: string
  customerId: string
  locationId: string
  distributor: string
  supplier: string
  telarusOrderId: string
  partnerOrderId: string
  productName: string
  services: string
  totalBill: string
  commissionRate: string
  masterAgent: string
  sme: string
  totalCommission: string
  description: string
}

type FixtureSpec = {
  filePath: string
  expectedRows: ExpectedRow[]
  expectedSuppliers: Record<string, { bill: number; commission: number }>
}

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

const FIXTURE_SPECS: FixtureSpec[] = [
  {
    filePath: path.resolve(process.cwd(), "wave-2a-rate-decisions-2026-05.csv"),
    expectedRows: [
      {
        scenarioId: "W2A-01",
        sourceRef: "Raw#18",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "Rent the Runway",
        customerId: "1664499",
        locationId: "",
        distributor: "Telarus",
        supplier: "ACC Business",
        telarusOrderId: "175283",
        partnerOrderId: "11031",
        productName: "MIS",
        services: "Ethernet -Fiber",
        totalBill: "2255.00",
        commissionRate: "8.00",
        masterAgent: "0.00",
        sme: "180.40",
        totalCommission: "180.40",
        description: "Main rate trap",
      },
      {
        scenarioId: "W2A-02",
        sourceRef: "Wave1 ACC-11 modified",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "Lazega and Johanson",
        customerId: "2006139",
        locationId: "",
        distributor: "Telarus",
        supplier: "ACC Business",
        telarusOrderId: "519039",
        partnerOrderId: "11648",
        productName: "MIS",
        services: "Ethernet -Fiber",
        totalBill: "1214.00",
        commissionRate: "18.00",
        masterAgent: "218.52",
        sme: "0.00",
        totalCommission: "218.52",
        description: "Higher-than-expected rate variance",
      },
      {
        scenarioId: "W2A-03",
        sourceRef: "Wave1 ATT-05",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "TekStream Solutions",
        customerId: "1905623",
        locationId: "",
        distributor: "Telarus",
        supplier: "AT&T",
        telarusOrderId: "416152",
        partnerOrderId: "11498",
        productName: "U-Verse Fiber Broadband - 1000M1000M",
        services: "Business Cable",
        totalBill: "210.00",
        commissionRate: "12.80",
        masterAgent: "26.88",
        sme: "0.00",
        totalCommission: "26.88",
        description: "Clean control row",
      },
      {
        scenarioId: "W2A-04",
        sourceRef: "Wave1 ATT-06",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "Wimberly Lawson",
        customerId: "2019710",
        locationId: "",
        distributor: "Telarus",
        supplier: "AT&T",
        telarusOrderId: "520489",
        partnerOrderId: "11872",
        productName: "U-Verse Fiber Broadband - 1000M1000M",
        services: "Business Cable",
        totalBill: "190.00",
        commissionRate: "13.60",
        masterAgent: "25.84",
        sme: "0.00",
        totalCommission: "25.84",
        description: "Clean control row",
      },
      {
        scenarioId: "W2A-05",
        sourceRef: "Wave1 BIG-01",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "Capital Investment Advisors",
        customerId: "1675789",
        locationId: "",
        distributor: "Telarus",
        supplier: "Bigleaf",
        telarusOrderId: "551435",
        partnerOrderId: "11609",
        productName: "500 Mbps SD-WAN Service",
        services: "SD-WAN",
        totalBill: "558.88",
        commissionRate: "8.00",
        masterAgent: "0.00",
        sme: "44.71",
        totalCommission: "44.71",
        description: "Same-vendor low-rate control",
      },
      {
        scenarioId: "W2A-06",
        sourceRef: "Wave1 BIG-02",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "Persium Group",
        customerId: "1925958",
        locationId: "",
        distributor: "Telarus",
        supplier: "Bigleaf",
        telarusOrderId: "388866",
        partnerOrderId: "11449",
        productName: "100 Mbps SD-WAN Service",
        services: "SD-WAN",
        totalBill: "199.00",
        commissionRate: "16.00",
        masterAgent: "31.84",
        sme: "0.00",
        totalCommission: "31.84",
        description: "Same-vendor high-rate control",
      },
    ],
    expectedSuppliers: {
      "ACC Business": { bill: 3469.0, commission: 398.92 },
      "AT&T": { bill: 400.0, commission: 52.72 },
      "Bigleaf": { bill: 757.88, commission: 76.55 },
    },
  },
  {
    filePath: path.resolve(process.cwd(), "wave-2b-usage-and-commission-variance-2026-05.csv"),
    expectedRows: [
      {
        scenarioId: "W2B-01",
        sourceRef: "Wave1 ACC-12 modified",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "Masterpiece Lighting LLC",
        customerId: "1811409",
        locationId: "",
        distributor: "Telarus",
        supplier: "ACC Business",
        telarusOrderId: "302068",
        partnerOrderId: "11222  11223   11331",
        productName: "MIS",
        services: "Ethernet -Fiber",
        totalBill: "600.00",
        commissionRate: "16.00",
        masterAgent: "96.01",
        sme: "0.00",
        totalCommission: "96.01",
        description: "Penny high tolerance",
      },
      {
        scenarioId: "W2B-02",
        sourceRef: "Wave1 ACC-13 modified",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "Masterpiece Lighting LLC",
        customerId: "1811409",
        locationId: "",
        distributor: "Telarus",
        supplier: "ACC Business",
        telarusOrderId: "302068",
        partnerOrderId: "11222  11223   11331",
        productName: "MIS",
        services: "Ethernet -Fiber",
        totalBill: "572.84",
        commissionRate: "15.99",
        masterAgent: "91.64",
        sme: "0.00",
        totalCommission: "91.64",
        description: "Penny low tolerance",
      },
      {
        scenarioId: "W2B-03",
        sourceRef: "Wave1 ACC-14 modified",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "Slappey & Sadd",
        customerId: "1818483",
        locationId: "",
        distributor: "Telarus",
        supplier: "ACC Business",
        telarusOrderId: "313712",
        partnerOrderId: "11234",
        productName: "MIS",
        services: "Ethernet -Fiber",
        totalBill: "480.00",
        commissionRate: "16.00",
        masterAgent: "76.80",
        sme: "0.00",
        totalCommission: "76.80",
        description: "Lower usage, same rate",
      },
      {
        scenarioId: "W2B-04",
        sourceRef: "Wave1 ACC-15 modified",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "Trimont Real Estate",
        customerId: "1940713",
        locationId: "",
        distributor: "Telarus",
        supplier: "ACC Business",
        telarusOrderId: "441072",
        partnerOrderId: "11525",
        productName: "MIS",
        services: "Ethernet -Fiber",
        totalBill: "820.00",
        commissionRate: "16.00",
        masterAgent: "131.20",
        sme: "0.00",
        totalCommission: "131.20",
        description: "Higher usage, same rate",
      },
      {
        scenarioId: "W2B-05",
        sourceRef: "Wave1 ACC-16 modified",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "United Sales Agency",
        customerId: "1652403",
        locationId: "",
        distributor: "Telarus",
        supplier: "ACC Business",
        telarusOrderId: "166321",
        partnerOrderId: "11870",
        productName: "MIS",
        services: "Ethernet -Fiber",
        totalBill: "467.00",
        commissionRate: "16.00",
        masterAgent: "85.00",
        sme: "0.00",
        totalCommission: "85.00",
        description: "Usage exact, commission conflict",
      },
      {
        scenarioId: "W2B-06",
        sourceRef: "Wave1 ATT-03 modified",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "Azalea Health Innovations",
        customerId: "1979661",
        locationId: "",
        distributor: "Telarus",
        supplier: "AT&T",
        telarusOrderId: "462275",
        partnerOrderId: "11586",
        productName: "U-Verse Fiber Broadband - FBS300M300M",
        services: "Ethernet -Fiber",
        totalBill: "990.00",
        commissionRate: "12.80",
        masterAgent: "100.00",
        sme: "0.00",
        totalCommission: "100.00",
        description: "Underpaid vs expected commission",
      },
    ],
    expectedSuppliers: {
      "ACC Business": { bill: 2939.84, commission: 480.65 },
      "AT&T": { bill: 990.0, commission: 100.0 },
    },
  },
  {
    filePath: path.resolve(process.cwd(), "wave-2c-metadata-and-edge-cases-2026-05.csv"),
    expectedRows: [
      {
        scenarioId: "W2C-01",
        sourceRef: "Wave1 ACC-10 modified",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "KRE UP Holdings",
        customerId: "2007641",
        locationId: "",
        distributor: "Telarus",
        supplier: "ACC Business",
        telarusOrderId: "",
        partnerOrderId: "",
        productName: "HSIA Internet Access",
        services: "Business Cable",
        totalBill: "160.00",
        commissionRate: "17.00",
        masterAgent: "27.20",
        sme: "0.00",
        totalCommission: "27.20",
        description: "Missing order metadata",
      },
      {
        scenarioId: "W2C-02",
        sourceRef: "Wave1 ACC-17 modified",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "University Partners",
        customerId: "",
        locationId: "",
        distributor: "Telarus",
        supplier: "ACC Business",
        telarusOrderId: "",
        partnerOrderId: "",
        productName: "HSIA Internet Access",
        services: "Business Cable",
        totalBill: "165.00",
        commissionRate: "16.00",
        masterAgent: "26.40",
        sme: "0.00",
        totalCommission: "26.40",
        description: "Missing customer and order metadata",
      },
      {
        scenarioId: "W2C-03",
        sourceRef: "Wave1 ATT-04 modified",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "Level Creek Property",
        customerId: "1838096",
        locationId: "",
        distributor: "Telarus",
        supplier: "AT&T",
        telarusOrderId: "330086",
        partnerOrderId: "11070",
        productName: "ATT INTERNET - BASIC 6 IP - LEGACY",
        services: "Internet T1",
        totalBill: "105.00",
        commissionRate: "12.80",
        masterAgent: "13.44",
        sme: "0.00",
        totalCommission: "13.44",
        description: "Unknown product under known customer",
      },
      {
        scenarioId: "W2C-04",
        sourceRef: "Wave1 ADV-01 modified",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "Walton Communities",
        customerId: "1843725",
        locationId: "",
        distributor: "Telarus",
        supplier: "Advantix",
        telarusOrderId: "330870",
        partnerOrderId: "11074",
        productName: "AMP - Service - Fixed",
        services: "Managed Services",
        totalBill: "660.00",
        commissionRate: "",
        masterAgent: "100.00",
        sme: "0.00",
        totalCommission: "100.00",
        description: "Flat-commission behavior",
      },
      {
        scenarioId: "W2C-05",
        sourceRef: "Wave1 ATT-01 modified",
        phase: "wave-2",
        period: "2026-03",
        paymentDate: "2026-05-15",
        customer: "Accent Woodlawn",
        customerId: "1962163",
        locationId: "",
        distributor: "Telarus",
        supplier: "AT&T",
        telarusOrderId: "520290",
        partnerOrderId: "11660",
        productName: "U-VERSE BROADBAND 100M100MG",
        services: "Business Cable",
        totalBill: "100.00",
        commissionRate: "13.60",
        masterAgent: "13.60",
        sme: "0.00",
        totalCommission: "13.60",
        description: "Backdated payment behavior",
      },
      {
        scenarioId: "W2C-06",
        sourceRef: "Wave1 ACC-01 modified",
        phase: "wave-2",
        period: "2026-05",
        paymentDate: "2026-05-15",
        customer: "DW Realty GA, LLC",
        customerId: "1824713",
        locationId: "",
        distributor: "Telarus",
        supplier: "ACC Business",
        telarusOrderId: "356953",
        partnerOrderId: "11205",
        productName: "MIS",
        services: "Ethernet -Fiber",
        totalBill: "-100.00",
        commissionRate: "16.00",
        masterAgent: "-16.00",
        sme: "0.00",
        totalCommission: "-16.00",
        description: "Negative line / clawback candidate",
      },
    ],
    expectedSuppliers: {
      "ACC Business": { bill: 225.0, commission: 37.6 },
      "AT&T": { bill: 205.0, commission: 27.04 },
      "Advantix": { bill: 660.0, commission: 100.0 },
    },
  },
]

function fail(message: string): never {
  throw new Error(message)
}

function expectEqual(actual: string, expected: string, message: string) {
  if (actual !== expected) {
    fail(`${message}. Expected "${expected}", got "${actual}"`)
  }
}

function expectApprox(actual: number, expected: number, message: string, tolerance = 0.0001) {
  if (Math.abs(actual - expected) > tolerance) {
    fail(`${message}. Expected ${expected.toFixed(2)}, got ${actual.toFixed(2)}`)
  }
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

function readCsvRows(filePath: string) {
  if (!fs.existsSync(filePath)) {
    fail(`Fixture file not found: ${filePath}`)
  }

  const text = fs.readFileSync(filePath, "utf8")
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
  })
  const headers = Array.isArray(parsed.meta.fields) ? parsed.meta.fields : []
  const rows = parsed.data.filter((row): row is CsvRow => Boolean(row) && typeof row === "object")

  if (parsed.errors.length > 0) {
    const firstError = parsed.errors[0]
    fail(`CSV parse error in ${path.basename(filePath)}: ${firstError?.message ?? "unknown error"}`)
  }

  return {
    headers,
    rows,
  }
}

function validateHeaders(headers: string[], filePath: string) {
  expectEqual(String(headers.length), String(EXPECTED_HEADERS.length), `Header count mismatch for ${path.basename(filePath)}`)
  EXPECTED_HEADERS.forEach((header, index) => {
    expectEqual(headers[index] ?? "", header, `Header mismatch at column ${index + 1} in ${path.basename(filePath)}`)
  })
}

function validateRow(row: CsvRow, expected: ExpectedRow) {
  const scenarioId = row["Scenario ID"].trim()
  expectEqual(scenarioId, expected.scenarioId, `Unexpected Scenario ID in ${expected.scenarioId}`)
  expectEqual(row["Source Ref"].trim(), expected.sourceRef, `Unexpected Source Ref for ${scenarioId}`)
  expectEqual(row["Phase"].trim(), expected.phase, `Unexpected Phase for ${scenarioId}`)
  expectEqual(row["Commission Period"].trim(), expected.period, `Unexpected Commission Period for ${scenarioId}`)
  expectEqual(row["Commission Payment Date"].trim(), expected.paymentDate, `Unexpected Commission Payment Date for ${scenarioId}`)
  expectEqual(row["Customer Business Name"].trim(), expected.customer, `Unexpected customer for ${scenarioId}`)
  expectEqual(row["Customer Id"].trim(), expected.customerId, `Unexpected Customer Id for ${scenarioId}`)
  expectEqual(row["Location Id"].trim(), expected.locationId, `Unexpected Location Id for ${scenarioId}`)
  expectEqual(row["Acquired Master Agency Name"].trim(), expected.distributor, `Unexpected distributor for ${scenarioId}`)
  expectEqual(row["Supplier Name"].trim(), expected.supplier, `Unexpected supplier for ${scenarioId}`)
  expectEqual(row["Telarus Order Id"].trim(), expected.telarusOrderId, `Unexpected Telarus Order Id for ${scenarioId}`)
  expectEqual(row["Partner Order Id"].trim(), expected.partnerOrderId, `Unexpected Partner Order Id for ${scenarioId}`)
  expectEqual(row["Product Name"].trim(), expected.productName, `Unexpected Product Name for ${scenarioId}`)
  expectEqual(row["Services"].trim(), expected.services, `Unexpected Services for ${scenarioId}`)
  expectEqual(row["Total Bill"].trim(), expected.totalBill, `Unexpected Total Bill for ${scenarioId}`)
  expectEqual(row["Commission Rate"].trim(), expected.commissionRate, `Unexpected Commission Rate for ${scenarioId}`)
  expectEqual(row["Commission Role - Master Agent"].trim(), expected.masterAgent, `Unexpected Master Agent value for ${scenarioId}`)
  expectEqual(row["Commission Role - Subject Matter Expert"].trim(), expected.sme, `Unexpected SME value for ${scenarioId}`)
  expectEqual(row["Total Commission"].trim(), expected.totalCommission, `Unexpected Total Commission for ${scenarioId}`)
  expectEqual(row["Description"].trim(), expected.description, `Unexpected Description for ${scenarioId}`)
}

function validateFixture(spec: FixtureSpec) {
  const { headers, rows } = readCsvRows(spec.filePath)
  validateHeaders(headers, spec.filePath)

  if (rows.length !== spec.expectedRows.length) {
    fail(
      `Unexpected row count in ${path.basename(spec.filePath)}. Expected ${spec.expectedRows.length}, got ${rows.length}`
    )
  }

  const scenarioIds = new Set<string>()
  rows.forEach((row, index) => {
    const scenarioId = row["Scenario ID"].trim()
    if (!scenarioId) fail(`Blank Scenario ID at row ${index + 2} in ${path.basename(spec.filePath)}`)
    if (scenarioIds.has(scenarioId)) fail(`Duplicate Scenario ID ${scenarioId} in ${path.basename(spec.filePath)}`)
    scenarioIds.add(scenarioId)
    validateRow(row, spec.expectedRows[index]!)
  })

  const supplierTotals = new Map<string, { bill: number; commission: number }>()
  rows.forEach(row => {
    const supplier = row["Supplier Name"].trim()
    const scenarioId = row["Scenario ID"].trim()
    const current = supplierTotals.get(supplier) ?? { bill: 0, commission: 0 }
    current.bill += parseMoney(row["Total Bill"], "Total Bill", scenarioId)
    current.commission += parseMoney(row["Total Commission"], "Total Commission", scenarioId)
    supplierTotals.set(supplier, current)
  })

  Object.entries(spec.expectedSuppliers).forEach(([supplier, expected]) => {
    const actual = supplierTotals.get(supplier)
    if (!actual) fail(`Missing supplier totals for ${supplier} in ${path.basename(spec.filePath)}`)
    expectApprox(actual.bill, expected.bill, `Supplier Total Bill mismatch for ${supplier} in ${path.basename(spec.filePath)}`)
    expectApprox(
      actual.commission,
      expected.commission,
      `Supplier Total Commission mismatch for ${supplier} in ${path.basename(spec.filePath)}`
    )
  })

  return {
    file: path.basename(spec.filePath),
    rows: rows.length,
    scenarioIds: rows.map(row => row["Scenario ID"].trim()),
    supplierTotals: Object.fromEntries(
      Array.from(supplierTotals.entries()).map(([supplier, totals]) => [
        supplier,
        {
          bill: totals.bill.toFixed(2),
          commission: totals.commission.toFixed(2),
        },
      ])
    ),
  }
}

function main() {
  const summaries = FIXTURE_SPECS.map(validateFixture)

  console.log(
    JSON.stringify(
      {
        validator: "scripts/validate-wave-2-fixture.ts",
        filesValidated: summaries.length,
        summaries,
        status: "ok",
      },
      null,
      2
    )
  )
}

main()
