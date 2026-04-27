import fs from "fs"
import path from "path"
import Papa from "papaparse"
import { PrismaClient } from "@prisma/client"

type CsvRow = Record<string, string>

const prisma = new PrismaClient()

const GENERATED_ROOT = path.join(
  process.cwd(),
  "docs",
  "plans",
  "03-31-2026-Data-Prep-Master-Testing-Prework",
  "generated",
  "deposit-batches",
)

const PRESETS: Record<string, string[]> = {
  generic: [
    "recommended/generic-1-to-1-starter-batch.csv",
    "recommended/generic-1-to-m-starter-batch.csv",
    "recommended/generic-m-to-1-starter-batch.csv",
    "recommended/generic-partial-starter-batch.csv",
    "recommended/generic-none-starter-batch.csv",
  ],
  rs002_candidate: [
    "recommended/rs-002-exact-metadata-starter-batch.csv",
  ],
  wave1_single_vendor: [
    "wave-1/tc-02-candidate-disambiguation.csv",
    "wave-1/tc-05-1-to-m-split-lines.csv",
    "wave-1/tc-06-month-1-baseline.csv",
    "wave-1/tc-06-month-2-after-rate-change.csv",
    "wave-1/tc-08-month-1-baseline.csv",
    "wave-1/tc-08-month-2-rate-variance.csv",
    "wave-1/tc-10-january-original.csv",
    "wave-1/tc-10-march-target.csv",
    "wave-1/tc-11-january-baseline.csv",
    "wave-1/tc-11-february-updated.csv",
    "wave-1/tc-12-month-1-bundled.csv",
    "wave-1/tc-12-month-2-unbundled.csv",
    "wave-1/tc-13-january.csv",
    "wave-1/tc-13-february.csv",
    "wave-1/tc-13-march-post-cancel.csv",
    "wave-1/tc-14-chargeback-and-service.csv",
    "wave-1/tc-15-undo-flow-baseline.csv",
  ],
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}

function parseCsv(filePath: string): { headers: string[]; rows: CsvRow[] } {
  const text = fs.readFileSync(filePath, "utf8")
  const parsed = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true })
  const headers = Array.isArray(parsed.meta.fields) ? parsed.meta.fields : []
  return {
    headers,
    rows: parsed.data.filter((row): row is CsvRow => Boolean(row) && typeof row === "object"),
  }
}

function buildGeneratedBatchMapping(headers: string[]) {
  const requiredHeaders = [
    "Commission Payment Date",
    "Customer Business Name",
    "Customer Id",
    "Location Id",
    "Acquired Master Agency Name",
    "Supplier Name",
    "Telarus Order Id",
    "Product Code",
    "Services",
    "Total Bill",
    "Commission Rate",
    "Commission Role - Master Agent",
  ]

  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`Expected generated batch header "${header}" in uploaded file.`)
    }
  }

  return {
    version: 1,
    line: {
      paymentDate: "Commission Payment Date",
      accountNameRaw: "Customer Business Name",
      customerIdVendor: "Customer Id",
      locationId: "Location Id",
      distributorNameRaw: "Acquired Master Agency Name",
      vendorNameRaw: "Supplier Name",
      orderIdVendor: "Telarus Order Id",
      partNumberRaw: "Product Code",
      productNameRaw: "Services",
      usage: "Total Bill",
      commissionRate: "Commission Rate",
      commission: "Commission Role - Master Agent",
    },
    columns: {},
    customFields: {},
    header: {
      depositName: null,
      paymentDateColumn: "Commission Payment Date",
      customerAccountColumn: null,
    },
    options: {
      hasHeaderRow: true,
    },
  }
}

async function resolveAccountId(accountName: string) {
  const trimmed = accountName.trim()
  if (!trimmed) {
    throw new Error("Account name is required.")
  }

  const exact = await prisma.account.findFirst({
    where: { accountName: { equals: trimmed, mode: "insensitive" } },
    select: { id: true, accountName: true },
  })

  if (exact) return exact.id

  const partial = await prisma.account.findMany({
    where: { accountName: { contains: trimmed, mode: "insensitive" } },
    select: { id: true, accountName: true },
    take: 2,
  })

  if (partial.length === 1) return partial[0]!.id

  throw new Error(`Could not resolve account "${trimmed}" to a unique DB record.`)
}

async function loginAndGetSessionToken(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(`Login failed with ${response.status} ${response.statusText}`)
  }

  const setCookie = response.headers.get("set-cookie") ?? ""
  const match = /session-token=([^;]+)/.exec(setCookie)
  if (!match) {
    throw new Error("Login succeeded but no session-token cookie was returned.")
  }

  return match[1]!
}

async function importBatch(params: {
  baseUrl: string
  sessionToken: string
  relativePath: string
}) {
  const filePath = path.join(GENERATED_ROOT, ...params.relativePath.split("/"))
  const fileName = path.basename(filePath)
  const { headers, rows } = parseCsv(filePath)
  const firstRow = rows[0]

  if (!firstRow) {
    throw new Error(`No data rows found in ${params.relativePath}`)
  }

  const distributorName = String(firstRow["Acquired Master Agency Name"] ?? "").trim()
  const vendorName = String(firstRow["Supplier Name"] ?? "").trim()
  if (!distributorName || !vendorName) {
    throw new Error(`Could not infer distributor/vendor from ${params.relativePath}`)
  }

  const distributorAccountId = await resolveAccountId(distributorName)
  const vendorAccountId = await resolveAccountId(vendorName)
  const mapping = buildGeneratedBatchMapping(headers)
  const depositName = `AUTO IMPORT ${fileName.replace(/\.csv$/i, "")}`
  const commissionPeriod = String(firstRow["Commission Period"] ?? "").trim()
  const paymentDate = String(firstRow["Commission Payment Date"] ?? "").trim()
  const idempotencyKey = `reconciliation-batch:${params.relativePath}`

  const file = new File([fs.readFileSync(filePath)], fileName, { type: "text/csv" })
  const form = new FormData()
  form.set("file", file)
  form.set("distributorAccountId", distributorAccountId)
  form.set("vendorAccountId", vendorAccountId)
  form.set("mapping", JSON.stringify(mapping))
  form.set("depositName", depositName)
  form.set("idempotencyKey", idempotencyKey)
  if (commissionPeriod) form.set("commissionPeriod", commissionPeriod)
  if (paymentDate) form.set("paymentDate", paymentDate)

  const response = await fetch(`${params.baseUrl}/api/reconciliation/deposits/import`, {
    method: "POST",
    headers: {
      cookie: `session-token=${params.sessionToken}`,
    },
    body: form,
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      `Import failed for ${params.relativePath}: ${response.status} ${JSON.stringify(payload)}`
    )
  }

  return {
    file: params.relativePath,
    depositName,
    distributorName,
    vendorName,
    response: payload,
  }
}

function resolveRequestedFiles(args: string[]) {
  const requested = args.length ? args : ["generic"]
  return unique(
    requested.flatMap(item => PRESETS[item] ?? [item]).map(item => item.replace(/\\/g, "/"))
  )
}

async function main() {
  const baseUrl = process.env.IMPORT_BASE_URL?.trim() || "http://127.0.0.1:3001"
  const email = process.env.PLAYWRIGHT_EMAIL?.trim() || "admin@commissable.test"
  const password = process.env.PLAYWRIGHT_PASSWORD?.trim() || "password123"
  const files = resolveRequestedFiles(process.argv.slice(2))

  const sessionToken = await loginAndGetSessionToken(baseUrl, email, password)
  const results = []

  for (const relativePath of files) {
    const result = await importBatch({ baseUrl, sessionToken, relativePath })
    results.push(result)
  }

  console.log(JSON.stringify(results, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
