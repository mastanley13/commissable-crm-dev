import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import Papa from "papaparse"
import { DepositLineItemStatus, Prisma, RevenueScheduleStatus } from "@prisma/client"
import { prisma } from "@/lib/db"

type CliArgs = {
  csvPath: string
  tenantId: string | null
  apply: boolean
}

type ParsedCsvRow = {
  supplierName: string
  supplierAccount: string
  masterAgencyName: string
  customerName: string
  customerId: string
  telarusOrderId: string
  partnerOrderId: string
  productName: string
  commissionDateRaw: string
  totalBill: number
  totalCommission: number
  commissionRatePercent: number
  ratio: number
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    csvPath: path.join("docs", "reference-data", "Multivendor-Test-Data-02-15.xlsx - Raw Data.csv"),
    tenantId: null,
    apply: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i]
    if (!value) continue

    if (value === "--apply") {
      args.apply = true
      continue
    }

    if (value === "--csv") {
      const next = argv[i + 1]
      if (!next) throw new Error("--csv requires a path")
      args.csvPath = next
      i += 1
      continue
    }

    if (value === "--tenant-id") {
      const next = argv[i + 1]
      if (!next) throw new Error("--tenant-id requires a UUID")
      args.tenantId = next
      i += 1
      continue
    }
  }

  return args
}

function toNumberOrNull(raw: unknown) {
  const value = String(raw ?? "").trim()
  if (!value) return null
  const normalized = value.replace(/\$/g, "").replace(/,/g, "").replace(/%/g, "")
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function formatUuidFromBytes(bytes: Buffer) {
  if (bytes.length < 16) throw new Error("Need at least 16 bytes for uuid")
  const b = Buffer.from(bytes.subarray(0, 16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const hex = b.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function stableUuid(parts: string[]) {
  const hash = crypto.createHash("sha256").update(parts.join("|")).digest()
  return formatUuidFromBytes(hash)
}

function parseCommissionDate(raw: string): Date {
  const value = raw.trim()
  const match = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/.exec(value)
  if (!match) throw new Error(`Unsupported Commission Date format: ${raw}`)
  const [, mm, dd, yyyy, hh, min] = match
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), 0))
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addUtcMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
}

function findHeaderIndex(header: string[], name: string) {
  const index = header.findIndex(value => value === name)
  if (index < 0) throw new Error(`Missing required column: ${name}`)
  return index
}

function parseCsvRows(csvPath: string): ParsedCsvRow[] {
  const content = fs.readFileSync(csvPath, "utf8")
  const parsed = Papa.parse<string[]>(content, { skipEmptyLines: true })
  if (parsed.errors?.length) {
    const message = parsed.errors[0]?.message ?? "Unknown CSV parse error"
    throw new Error(`Failed to parse CSV: ${message}`)
  }

  const rows = (parsed.data ?? []) as string[][]
  if (rows.length < 2) throw new Error("CSV appears empty")

  const header = rows[0] ?? []
  const idxSupplierName = findHeaderIndex(header, "Supplier Name")
  const idxSupplierAccount = findHeaderIndex(header, "Supplier Account")
  const idxMasterAgency = findHeaderIndex(header, "Acquired Master Agency Name")
  const idxCustomerName = findHeaderIndex(header, "Customer Business Name")
  const idxCustomerId = findHeaderIndex(header, "Customer Id")
  const idxCommissionDate = findHeaderIndex(header, "Commission Date")
  const idxTelarusOrder = findHeaderIndex(header, "Telarus Order Id")
  const idxPartnerOrder = findHeaderIndex(header, "Partner Order Id")
  const idxProductName = findHeaderIndex(header, "Product Name")
  const idxTotalBill = findHeaderIndex(header, "Total Bill")
  const idxTotalCommission = findHeaderIndex(header, "Total Commission")

  const idxCommissionRate = 44
  if (!String(header[idxCommissionRate] ?? "").toLowerCase().includes("commission rate")) {
    throw new Error(`Expected Commission Rate to be at index 44, found: ${header[idxCommissionRate] ?? ""}`)
  }

  const result: ParsedCsvRow[] = []
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i]
    if (!row) continue
    const totalBill = toNumberOrNull(row[idxTotalBill])
    const totalCommission = toNumberOrNull(row[idxTotalCommission])
    const commissionRatePercent = toNumberOrNull(row[idxCommissionRate])
    if (totalBill == null || totalCommission == null || commissionRatePercent == null) continue
    if (totalBill === 0) continue
    const ratio = totalCommission / totalBill
    if (!(ratio >= 0.05 && ratio <= 0.3)) continue

    result.push({
      supplierName: String(row[idxSupplierName] ?? "").trim(),
      supplierAccount: String(row[idxSupplierAccount] ?? "").trim(),
      masterAgencyName: String(row[idxMasterAgency] ?? "").trim(),
      customerName: String(row[idxCustomerName] ?? "").trim(),
      customerId: String(row[idxCustomerId] ?? "").trim(),
      commissionDateRaw: String(row[idxCommissionDate] ?? "").trim(),
      telarusOrderId: String(row[idxTelarusOrder] ?? "").trim(),
      partnerOrderId: String(row[idxPartnerOrder] ?? "").trim(),
      productName: String(row[idxProductName] ?? "").trim(),
      totalBill,
      totalCommission,
      commissionRatePercent,
      ratio,
    })
  }

  return result
}

async function resolveTenantId(explicitTenantId: string | null) {
  if (explicitTenantId) return explicitTenantId
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true, name: true } })
  if (tenants.length === 1) return tenants[0]!.id
  const list = tenants.map(t => `${t.id} (${t.slug ?? "no-slug"} / ${t.name ?? "no-name"})`).join("\n")
  throw new Error(`Multiple tenants found. Re-run with --tenant-id.\n${list}`)
}

async function loadAccountTypeIds(tenantId: string) {
  const types = await prisma.accountType.findMany({
    where: { tenantId, code: { in: ["CUSTOMER", "VENDOR", "DISTRIBUTOR"] } },
    select: { id: true, code: true },
  })
  const map = new Map(types.map(t => [t.code, t.id] as const))
  const missing = ["CUSTOMER", "VENDOR", "DISTRIBUTOR"].filter(code => !map.get(code))
  if (missing.length) throw new Error(`Missing AccountType(s) for tenant ${tenantId}: ${missing.join(", ")}`)
  return { customer: map.get("CUSTOMER")!, vendor: map.get("VENDOR")!, distributor: map.get("DISTRIBUTOR")! }
}

async function ensureAccount(params: {
  tenantId: string
  accountTypeId: string
  accountName: string
  accountLegalName: string | null
}) {
  return prisma.account.upsert({
    where: { tenantId_accountName: { tenantId: params.tenantId, accountName: params.accountName } },
    update: {},
    create: {
      id: stableUuid(["seed", params.tenantId, "account", params.accountName]),
      tenantId: params.tenantId,
      accountTypeId: params.accountTypeId,
      accountName: params.accountName,
      accountLegalName: params.accountLegalName,
      status: "Active",
    },
    select: { id: true, accountName: true, accountLegalName: true },
  })
}

async function ensureProduct(params: {
  tenantId: string
  productCode: string
  productNameVendor: string
  revenueType: string
  commissionPercent: number | null
  vendorAccountId: string | null
  distributorAccountId: string | null
}) {
  return prisma.product.upsert({
    where: { tenantId_productCode: { tenantId: params.tenantId, productCode: params.productCode } },
    update: {},
    create: {
      id: stableUuid(["seed", params.tenantId, "product", params.productCode]),
      tenantId: params.tenantId,
      productCode: params.productCode,
      productNameHouse: params.productNameVendor,
      productNameVendor: params.productNameVendor,
      revenueType: params.revenueType,
      commissionPercent: params.commissionPercent == null ? null : new Prisma.Decimal(params.commissionPercent),
      priceEach: new Prisma.Decimal(0),
      vendorAccountId: params.vendorAccountId,
      distributorAccountId: params.distributorAccountId,
      isActive: true,
    },
    select: { id: true, productCode: true },
  })
}

async function ensureOpportunity(params: {
  tenantId: string
  id: string
  accountId: string
  name: string
  customerIdVendor: string
  orderIdVendor: string
  vendorName: string
  distributorName: string
}) {
  return prisma.opportunity.upsert({
    where: { id: params.id },
    update: {},
    create: {
      id: params.id,
      tenantId: params.tenantId,
      accountId: params.accountId,
      name: params.name,
      stage: "Qualification",
      status: "Open",
      active: true,
      customerIdVendor: params.customerIdVendor,
      orderIdVendor: params.orderIdVendor,
      vendorName: params.vendorName,
      distributorName: params.distributorName,
    },
    select: { id: true },
  })
}

async function ensureOpportunityProduct(params: {
  tenantId: string
  id: string
  opportunityId: string
  productId: string
  commissionPercentSnapshot: number | null
  distributorAccountIdSnapshot: string | null
  vendorAccountIdSnapshot: string | null
}) {
  return prisma.opportunityProduct.upsert({
    where: { id: params.id },
    update: {},
    create: {
      id: params.id,
      tenantId: params.tenantId,
      opportunityId: params.opportunityId,
      productId: params.productId,
      revenueTypeSnapshot: "MRC_ThirdParty",
      commissionPercentSnapshot:
        params.commissionPercentSnapshot == null ? null : new Prisma.Decimal(params.commissionPercentSnapshot),
      distributorAccountIdSnapshot: params.distributorAccountIdSnapshot,
      vendorAccountIdSnapshot: params.vendorAccountIdSnapshot,
      quantity: new Prisma.Decimal(1),
      unitPrice: new Prisma.Decimal(0),
      expectedUsage: new Prisma.Decimal(0),
      expectedRevenue: new Prisma.Decimal(0),
      expectedCommission: new Prisma.Decimal(0),
      active: true,
      status: "Provisioning",
    },
    select: { id: true },
  })
}

async function upsertRevenueSchedule(params: {
  tenantId: string
  id: string
  accountId: string
  opportunityId: string
  opportunityProductId: string
  productId: string
  scheduleNumber: string
  scheduleDate: Date
  distributorAccountId: string
  vendorAccountId: string
  expectedUsage: number
  expectedCommission: number
  expectedCommissionRatePercent: number
}) {
  return prisma.revenueSchedule.upsert({
    where: { id: params.id },
    update: {},
    create: {
      id: params.id,
      tenantId: params.tenantId,
      accountId: params.accountId,
      opportunityId: params.opportunityId,
      opportunityProductId: params.opportunityProductId,
      productId: params.productId,
      scheduleNumber: params.scheduleNumber,
      scheduleDate: params.scheduleDate,
      scheduleType: "Recurring",
      status: RevenueScheduleStatus.Unreconciled,
      distributorAccountId: params.distributorAccountId,
      vendorAccountId: params.vendorAccountId,
      expectedUsage: new Prisma.Decimal(params.expectedUsage),
      expectedCommission: new Prisma.Decimal(params.expectedCommission),
      expectedCommissionRatePercent: new Prisma.Decimal(params.expectedCommissionRatePercent),
      actualUsage: new Prisma.Decimal(0),
      actualCommission: new Prisma.Decimal(0),
    } as any,
    select: { id: true, scheduleNumber: true },
  })
}

async function upsertDeposit(params: {
  tenantId: string
  id: string
  accountId: string
  depositName: string
  month: Date
  paymentDate: Date
  distributorAccountId: string
  vendorAccountId: string
  totalUsage: number
  totalCommission: number
}) {
  return prisma.deposit.upsert({
    where: { id: params.id },
    update: {},
    create: {
      id: params.id,
      tenantId: params.tenantId,
      accountId: params.accountId,
      depositName: params.depositName,
      month: params.month,
      paymentDate: params.paymentDate,
      distributorAccountId: params.distributorAccountId,
      vendorAccountId: params.vendorAccountId,
      reconciled: false,
      status: "Pending",
      totalUsage: new Prisma.Decimal(params.totalUsage),
      totalRevenue: new Prisma.Decimal(params.totalUsage),
      totalCommissions: new Prisma.Decimal(params.totalCommission),
      usageAllocated: new Prisma.Decimal(0),
      usageUnallocated: new Prisma.Decimal(params.totalUsage),
      commissionAllocated: new Prisma.Decimal(0),
      commissionUnallocated: new Prisma.Decimal(params.totalCommission),
      totalItems: 0,
      totalReconciledItems: 0,
      itemsReconciled: 0,
      itemsUnreconciled: 0,
    } as any,
    select: { id: true, depositName: true },
  })
}

async function upsertDepositLineItem(params: {
  tenantId: string
  id: string
  depositId: string
  lineNumber: number
  paymentDate: Date
  accountId: string
  vendorAccountId: string
  productId: string | null
  accountIdVendor: string
  customerIdVendor: string
  orderIdVendor: string
  accountNameRaw: string
  vendorNameRaw: string
  distributorNameRaw: string
  productNameRaw: string
  usage: number
  commission: number
  commissionRateFraction: number
}) {
  return prisma.depositLineItem.upsert({
    where: { id: params.id },
    update: {},
    create: {
      id: params.id,
      tenantId: params.tenantId,
      depositId: params.depositId,
      lineNumber: params.lineNumber,
      status: DepositLineItemStatus.Unmatched,
      paymentDate: params.paymentDate,
      accountId: params.accountId,
      vendorAccountId: params.vendorAccountId,
      productId: params.productId,
      accountIdVendor: params.accountIdVendor,
      customerIdVendor: params.customerIdVendor,
      orderIdVendor: params.orderIdVendor,
      accountNameRaw: params.accountNameRaw,
      vendorNameRaw: params.vendorNameRaw,
      distributorNameRaw: params.distributorNameRaw,
      productNameRaw: params.productNameRaw,
      usage: new Prisma.Decimal(params.usage),
      usageAllocated: new Prisma.Decimal(0),
      usageUnallocated: new Prisma.Decimal(params.usage),
      commission: new Prisma.Decimal(params.commission),
      commissionAllocated: new Prisma.Decimal(0),
      commissionUnallocated: new Prisma.Decimal(params.commission),
      commissionRate: new Prisma.Decimal(params.commissionRateFraction),
      reconciled: false,
      isChargeback: false,
      hasSuggestedMatches: false,
    } as any,
    select: { id: true, lineNumber: true },
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const csvPath = path.isAbsolute(args.csvPath) ? args.csvPath : path.join(process.cwd(), args.csvPath)
  const parsedRows = parseCsvRows(csvPath)

  const tc05CustomerId = "1812449"
  const tc06CustomerId = "1806880"

  const tc05Rows = parsedRows.filter(row => row.customerId === tc05CustomerId)
  const tc06Rows = parsedRows.filter(row => row.customerId === tc06CustomerId && row.telarusOrderId === "342021")

  if (tc05Rows.length < 2) {
    throw new Error(`Not enough TC-05 rows found for customerId=${tc05CustomerId}. Found: ${tc05Rows.length}`)
  }
  const tc06Voip = tc06Rows.find(row => row.productName === "VoIP")
  const tc06Mis = tc06Rows.find(row => row.productName === "MIS")
  if (!tc06Voip || !tc06Mis) {
    throw new Error(`Not enough TC-06 rows found for customerId=${tc06CustomerId} (order 342021). Need VoIP + MIS.`)
  }

  const tenantId = await resolveTenantId(args.tenantId)
  const accountTypes = await loadAccountTypeIds(tenantId)
  const anchorDate = parseCommissionDate(tc05Rows[0]!.commissionDateRaw || tc06Voip.commissionDateRaw)
  const month = startOfUtcMonth(anchorDate)

  const mode = args.apply ? "APPLY" : "DRY-RUN"
  console.log(`[seed-tc05-tc06] Mode: ${mode}`)
  console.log(`[seed-tc05-tc06] CSV: ${csvPath}`)
  console.log(`[seed-tc05-tc06] Tenant: ${tenantId}`)
  console.log(`[seed-tc05-tc06] Anchor date (UTC): ${anchorDate.toISOString()}`)

  console.log("")
  console.log("[seed-tc05-tc06] Selected source rows:")
  console.log(`- TC-05 Bundle customerId=${tc05CustomerId} lines=${tc05Rows.length}`)
  for (const row of tc05Rows) {
    console.log(
      `  - ${row.productName}: usage=${row.totalBill} commission=${row.totalCommission} rate=${row.commissionRatePercent}%`,
    )
  }
  console.log(`- TC-06 RateDiff customerId=${tc06CustomerId} (VoIP + MIS, orderId=342021)`)
  for (const row of [tc06Voip, tc06Mis]) {
    console.log(
      `  - ${row.productName}: usage=${row.totalBill} commission=${row.totalCommission} rate=${row.commissionRatePercent}%`,
    )
  }

  if (!args.apply) {
    console.log("")
    console.log("[seed-tc05-tc06] DRY-RUN complete. Re-run with --apply to write data.")
    return
  }

  // TC-05 accounts
  const tc05Supplier = tc05Rows[0]!.supplierName
  const tc05Master = tc05Rows[0]!.masterAgencyName
  const tc05CustomerName = tc05Rows[0]!.customerName
  const tc05Order = tc05Rows[0]!.telarusOrderId

  const tc05VendorAccount = await ensureAccount({
    tenantId,
    accountTypeId: accountTypes.vendor,
    accountName: `UAT-VENDOR ${tc05Supplier}`,
    accountLegalName: tc05Supplier || null,
  })
  const tc05DistributorAccount = await ensureAccount({
    tenantId,
    accountTypeId: accountTypes.distributor,
    accountName: `UAT-DISTRIBUTOR ${tc05Master}`,
    accountLegalName: tc05Master || null,
  })
  const tc05CustomerAccount = await ensureAccount({
    tenantId,
    accountTypeId: accountTypes.customer,
    accountName: `UAT-CUSTOMER ${tc05CustomerName} (${tc05CustomerId})`,
    accountLegalName: tc05CustomerName || null,
  })

  // TC-06 accounts
  const tc06Supplier = tc06Voip.supplierName
  const tc06Master = tc06Voip.masterAgencyName
  const tc06CustomerName = tc06Voip.customerName
  const tc06Order = tc06Voip.telarusOrderId

  const tc06VendorAccount = await ensureAccount({
    tenantId,
    accountTypeId: accountTypes.vendor,
    accountName: `UAT-VENDOR ${tc06Supplier}`,
    accountLegalName: tc06Supplier || null,
  })
  const tc06DistributorAccount = await ensureAccount({
    tenantId,
    accountTypeId: accountTypes.distributor,
    accountName: `UAT-DISTRIBUTOR ${tc06Master}`,
    accountLegalName: tc06Master || null,
  })
  const tc06CustomerAccount = await ensureAccount({
    tenantId,
    accountTypeId: accountTypes.customer,
    accountName: `UAT-CUSTOMER ${tc06CustomerName} (${tc06CustomerId})`,
    accountLegalName: tc06CustomerName || null,
  })

  // TC-05 objects (Bundle M:1)
  const tc05OpportunityId = stableUuid(["seed", tenantId, "tc05", "opportunity", tc05CustomerId])
  await ensureOpportunity({
    tenantId,
    id: tc05OpportunityId,
    accountId: tc05CustomerAccount.id,
    name: `UAT-RCN TC-05 Bundle - ${tc05CustomerName} (${tc05CustomerId})`,
    customerIdVendor: tc05CustomerId,
    orderIdVendor: tc05Order,
    vendorName: tc05Supplier,
    distributorName: tc05Master,
  })

  const tc05Product = await ensureProduct({
    tenantId,
    productCode: `UAT-TC05-${tc05CustomerId}-MIS`,
    productNameVendor: "MIS",
    revenueType: "MRC_ThirdParty",
    commissionPercent: 16.0,
    vendorAccountId: tc05VendorAccount.id,
    distributorAccountId: tc05DistributorAccount.id,
  })

  const tc05OppProductId = stableUuid(["seed", tenantId, "tc05", "oppProduct", tc05CustomerId, tc05Product.id])
  await ensureOpportunityProduct({
    tenantId,
    id: tc05OppProductId,
    opportunityId: tc05OpportunityId,
    productId: tc05Product.id,
    commissionPercentSnapshot: 16.0,
    distributorAccountIdSnapshot: tc05DistributorAccount.id,
    vendorAccountIdSnapshot: tc05VendorAccount.id,
  })

  const tc05BaseLine = tc05Rows[0]!
  const expectedRatePercent = 16.0
  const expectedRateFraction = expectedRatePercent / 100

  for (let monthOffset = 0; monthOffset < 12; monthOffset += 1) {
    const scheduleDate = addUtcMonths(anchorDate, monthOffset)
    const dateText = scheduleDate.toISOString().slice(0, 10)
    const scheduleNumber = `UAT-TC05-${tc05CustomerId}-MIS-${dateText}`
    const scheduleId = stableUuid(["seed", tenantId, "tc05", "schedule", scheduleNumber])
    await upsertRevenueSchedule({
      tenantId,
      id: scheduleId,
      accountId: tc05CustomerAccount.id,
      opportunityId: tc05OpportunityId,
      opportunityProductId: tc05OppProductId,
      productId: tc05Product.id,
      scheduleNumber,
      scheduleDate,
      distributorAccountId: tc05DistributorAccount.id,
      vendorAccountId: tc05VendorAccount.id,
      expectedUsage: tc05BaseLine.totalBill,
      expectedCommission: Number((tc05BaseLine.totalBill * expectedRateFraction).toFixed(2)),
      expectedCommissionRatePercent: expectedRatePercent,
    })
  }

  const tc05DepositId = stableUuid(["seed", tenantId, "tc05", "deposit", tc05CustomerId])
  const tc05DepositName = `UAT-RCN TC-05 Bundle - ${tc05CustomerName} (${tc05CustomerId})`
  const tc05TotalUsage = tc05Rows.reduce((acc, row) => acc + row.totalBill, 0)
  const tc05TotalCommission = tc05Rows.reduce((acc, row) => acc + row.totalCommission, 0)
  await upsertDeposit({
    tenantId,
    id: tc05DepositId,
    accountId: tc05CustomerAccount.id,
    depositName: tc05DepositName,
    month,
    paymentDate: anchorDate,
    distributorAccountId: tc05DistributorAccount.id,
    vendorAccountId: tc05VendorAccount.id,
    totalUsage: Number(tc05TotalUsage.toFixed(2)),
    totalCommission: Number(tc05TotalCommission.toFixed(2)),
  })

  for (let index = 0; index < tc05Rows.length; index += 1) {
    const row = tc05Rows[index]!
    const lineId = stableUuid(["seed", tenantId, "tc05", "line", tc05DepositId, String(index + 1)])
    await upsertDepositLineItem({
      tenantId,
      id: lineId,
      depositId: tc05DepositId,
      lineNumber: index + 1,
      paymentDate: anchorDate,
      accountId: tc05CustomerAccount.id,
      vendorAccountId: tc05VendorAccount.id,
      productId: tc05Product.id,
      accountIdVendor: row.supplierAccount,
      customerIdVendor: tc05CustomerId,
      orderIdVendor: row.telarusOrderId || tc05Order,
      accountNameRaw: tc05CustomerName,
      vendorNameRaw: tc05Supplier,
      distributorNameRaw: tc05Master,
      productNameRaw: row.productName || "MIS",
      usage: row.totalBill,
      commission: row.totalCommission,
      commissionRateFraction: Number((row.commissionRatePercent / 100).toFixed(4)),
    })
  }

  // TC-06 objects (Rate difference via 1:M)
  const tc06OpportunityId = stableUuid(["seed", tenantId, "tc06", "opportunity", tc06CustomerId])
  await ensureOpportunity({
    tenantId,
    id: tc06OpportunityId,
    accountId: tc06CustomerAccount.id,
    name: `UAT-RCN TC-06 RateDiff - ${tc06CustomerName} (${tc06CustomerId})`,
    customerIdVendor: tc06CustomerId,
    orderIdVendor: tc06Order,
    vendorName: tc06Supplier,
    distributorName: tc06Master,
  })

  const tc06ProductVoip = await ensureProduct({
    tenantId,
    productCode: `UAT-TC06-${tc06CustomerId}-VOIP`,
    productNameVendor: "VoIP",
    revenueType: "MRC_ThirdParty",
    commissionPercent: 16.0,
    vendorAccountId: tc06VendorAccount.id,
    distributorAccountId: tc06DistributorAccount.id,
  })
  const tc06ProductMis = await ensureProduct({
    tenantId,
    productCode: `UAT-TC06-${tc06CustomerId}-MIS`,
    productNameVendor: "MIS",
    revenueType: "MRC_ThirdParty",
    commissionPercent: 16.0,
    vendorAccountId: tc06VendorAccount.id,
    distributorAccountId: tc06DistributorAccount.id,
  })

  const tc06OppProductVoipId = stableUuid(["seed", tenantId, "tc06", "oppProduct", tc06CustomerId, tc06ProductVoip.id])
  const tc06OppProductMisId = stableUuid(["seed", tenantId, "tc06", "oppProduct", tc06CustomerId, tc06ProductMis.id])
  await ensureOpportunityProduct({
    tenantId,
    id: tc06OppProductVoipId,
    opportunityId: tc06OpportunityId,
    productId: tc06ProductVoip.id,
    commissionPercentSnapshot: 16.0,
    distributorAccountIdSnapshot: tc06DistributorAccount.id,
    vendorAccountIdSnapshot: tc06VendorAccount.id,
  })
  await ensureOpportunityProduct({
    tenantId,
    id: tc06OppProductMisId,
    opportunityId: tc06OpportunityId,
    productId: tc06ProductMis.id,
    commissionPercentSnapshot: 16.0,
    distributorAccountIdSnapshot: tc06DistributorAccount.id,
    vendorAccountIdSnapshot: tc06VendorAccount.id,
  })

  const tc06ScheduleVoipId = stableUuid(["seed", tenantId, "tc06", "schedule", tc06CustomerId, "voip", anchorDate.toISOString().slice(0, 10)])
  const tc06ScheduleMisId = stableUuid(["seed", tenantId, "tc06", "schedule", tc06CustomerId, "mis", anchorDate.toISOString().slice(0, 10)])

  await upsertRevenueSchedule({
    tenantId,
    id: tc06ScheduleVoipId,
    accountId: tc06CustomerAccount.id,
    opportunityId: tc06OpportunityId,
    opportunityProductId: tc06OppProductVoipId,
    productId: tc06ProductVoip.id,
    scheduleNumber: `UAT-TC06-${tc06CustomerId}-VOIP-${anchorDate.toISOString().slice(0, 10)}`,
    scheduleDate: anchorDate,
    distributorAccountId: tc06DistributorAccount.id,
    vendorAccountId: tc06VendorAccount.id,
    expectedUsage: tc06Voip.totalBill,
    expectedCommission: Number((tc06Voip.totalBill * expectedRateFraction).toFixed(2)),
    expectedCommissionRatePercent: expectedRatePercent,
  })
  await upsertRevenueSchedule({
    tenantId,
    id: tc06ScheduleMisId,
    accountId: tc06CustomerAccount.id,
    opportunityId: tc06OpportunityId,
    opportunityProductId: tc06OppProductMisId,
    productId: tc06ProductMis.id,
    scheduleNumber: `UAT-TC06-${tc06CustomerId}-MIS-${anchorDate.toISOString().slice(0, 10)}`,
    scheduleDate: anchorDate,
    distributorAccountId: tc06DistributorAccount.id,
    vendorAccountId: tc06VendorAccount.id,
    expectedUsage: tc06Mis.totalBill,
    expectedCommission: Number((tc06Mis.totalBill * expectedRateFraction).toFixed(2)),
    expectedCommissionRatePercent: expectedRatePercent,
  })

  const tc06DepositId = stableUuid(["seed", tenantId, "tc06", "deposit", tc06CustomerId])
  const tc06DepositName = `UAT-RCN TC-06 RateDiff (1:M) - ${tc06CustomerName} (${tc06CustomerId})`
  const tc06TotalUsage = tc06Voip.totalBill + tc06Mis.totalBill
  const tc06TotalCommission = tc06Voip.totalCommission + tc06Mis.totalCommission
  await upsertDeposit({
    tenantId,
    id: tc06DepositId,
    accountId: tc06CustomerAccount.id,
    depositName: tc06DepositName,
    month,
    paymentDate: anchorDate,
    distributorAccountId: tc06DistributorAccount.id,
    vendorAccountId: tc06VendorAccount.id,
    totalUsage: Number(tc06TotalUsage.toFixed(2)),
    totalCommission: Number(tc06TotalCommission.toFixed(2)),
  })

  const tc06LineId = stableUuid(["seed", tenantId, "tc06", "line", tc06DepositId, "1"])
  await upsertDepositLineItem({
    tenantId,
    id: tc06LineId,
    depositId: tc06DepositId,
    lineNumber: 1,
    paymentDate: anchorDate,
    accountId: tc06CustomerAccount.id,
    vendorAccountId: tc06VendorAccount.id,
    productId: null,
    accountIdVendor: tc06Voip.supplierAccount,
    customerIdVendor: tc06CustomerId,
    orderIdVendor: tc06Order,
    accountNameRaw: tc06CustomerName,
    vendorNameRaw: tc06Supplier,
    distributorNameRaw: tc06Master,
    productNameRaw: "VoIP, MIS",
    usage: Number(tc06TotalUsage.toFixed(2)),
    commission: Number(tc06TotalCommission.toFixed(2)),
    commissionRateFraction: Number((tc06TotalCommission / tc06TotalUsage).toFixed(4)),
  })

  console.log("")
  console.log("[seed-tc05-tc06] Seed complete. Deposits created:")
  console.log(`- ${tc05DepositName}`)
  console.log(`- ${tc06DepositName}`)
}

main()
  .catch(err => {
    console.error("[seed-tc05-tc06] Failed:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
