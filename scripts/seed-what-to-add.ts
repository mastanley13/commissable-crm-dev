import path from "node:path"
import dotenv from "dotenv"
import {
  OpportunityStage,
  OpportunityStatus,
  OpportunityType,
  PrismaClient,
  RevenueScheduleStatus,
  RevenueScheduleType,
} from "@prisma/client"

import {
  DEFAULT_SCHEDULE_START,
  DISTRIBUTOR_NAME,
  addMonths,
  allCatalogRows,
  doNotAddPlanRows,
  opportunityPlanRows,
  slugify,
} from "./what-to-add-plan"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true })

const prisma = new PrismaClient()

type AccountTypeMap = Record<string, { id: string; code: string; name: string }>

function makeProductCode(vendorName: string, houseProductName: string) {
  return `WTA-PROD-${slugify(vendorName)}-${slugify(houseProductName)}`
}

function makeScheduleNumber(rowNumber: number, scheduleDate: Date) {
  const year = scheduleDate.getUTCFullYear()
  const month = String(scheduleDate.getUTCMonth() + 1).padStart(2, "0")
  return `WTA-R${String(rowNumber).padStart(2, "0")}-${year}${month}`
}

async function getTenant() {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } })
  if (!tenant) throw new Error("No tenant found. Run the base seed first.")
  return tenant
}

async function getAccountTypes(tenantId: string): Promise<AccountTypeMap> {
  const types = await prisma.accountType.findMany({ where: { tenantId } })
  const map: AccountTypeMap = {}
  for (const type of types) {
    map[type.code.toUpperCase()] = { id: type.id, code: type.code, name: type.name }
  }
  return map
}

async function findAccountByExactName(tenantId: string, accountName: string) {
  return prisma.account.findFirst({
    where: { tenantId, accountName },
  })
}

async function ensureAccount(params: {
  tenantId: string
  accountTypeId: string
  accountName: string
  accountLegalName?: string | null
}) {
  const existing = await findAccountByExactName(params.tenantId, params.accountName)
  if (existing) return existing

  return prisma.account.create({
    data: {
      tenantId: params.tenantId,
      accountTypeId: params.accountTypeId,
      accountName: params.accountName,
      accountLegalName: params.accountLegalName ?? null,
      status: "Active",
    },
  })
}

async function ensureCatalogProduct(params: {
  tenantId: string
  distributorAccountId: string
  vendorAccountId: string
  vendorName: string
  houseProductName: string
  vendorProductName: string
}) {
  const exact = await prisma.product.findFirst({
    where: {
      tenantId: params.tenantId,
      distributorAccountId: params.distributorAccountId,
      vendorAccountId: params.vendorAccountId,
      productNameHouse: params.houseProductName,
      productNameVendor: params.vendorProductName,
    },
  })
  if (exact) return exact

  const productCode = makeProductCode(params.vendorName, params.houseProductName)
  const existingByCode = await prisma.product.findFirst({
    where: { tenantId: params.tenantId, productCode },
  })

  const data = {
    tenantId: params.tenantId,
    productCode,
    productNameHouse: params.houseProductName,
    productNameVendor: params.vendorProductName,
    revenueType: "MRC_ThirdParty",
    vendorAccountId: params.vendorAccountId,
    distributorAccountId: params.distributorAccountId,
    isActive: true,
  }

  if (existingByCode) {
    return prisma.product.update({
      where: { id: existingByCode.id },
      data,
    })
  }

  return prisma.product.create({ data })
}

async function ensureOpportunity(params: {
  tenantId: string
  accountId: string
  opportunityName: string
  vendorName: string
  distributorName: string
  expectedUsage: number
  expectedCommission: number
}) {
  const existing = await prisma.opportunity.findFirst({
    where: {
      tenantId: params.tenantId,
      accountId: params.accountId,
      name: params.opportunityName,
    },
  })

  const data = {
    tenantId: params.tenantId,
    accountId: params.accountId,
    name: params.opportunityName,
    vendorName: params.vendorName,
    distributorName: params.distributorName,
    amount: params.expectedUsage,
    expectedCommission: params.expectedCommission,
    stage: OpportunityStage.ClosedWon_Billing,
    status: OpportunityStatus.Won,
    active: true,
    type: OpportunityType.NewBusiness,
    leadSource: "Referral" as const,
  }

  if (existing) {
    return prisma.opportunity.update({
      where: { id: existing.id },
      data,
    })
  }

  return prisma.opportunity.create({ data })
}

async function ensureOpportunityProduct(params: {
  tenantId: string
  opportunityId: string
  productId: string
  houseProductName: string
  vendorProductName: string
  vendorName: string
  distributorName: string
  vendorAccountId: string
  distributorAccountId: string
  expectedUsage: number
  expectedRatePercent: number
  expectedCommission: number
  periods: number
}) {
  const existing = await prisma.opportunityProduct.findFirst({
    where: {
      tenantId: params.tenantId,
      opportunityId: params.opportunityId,
      productId: params.productId,
    },
  })

  const revenueEndDate = addMonths(DEFAULT_SCHEDULE_START, params.periods - 1)
  const data = {
    tenantId: params.tenantId,
    opportunityId: params.opportunityId,
    productId: params.productId,
    productNameHouseSnapshot: params.houseProductName,
    productNameVendorSnapshot: params.vendorProductName,
    revenueTypeSnapshot: "MRC_ThirdParty",
    commissionPercentSnapshot: params.expectedRatePercent,
    distributorNameSnapshot: params.distributorName,
    vendorNameSnapshot: params.vendorName,
    distributorAccountIdSnapshot: params.distributorAccountId,
    vendorAccountIdSnapshot: params.vendorAccountId,
    expectedUsage: params.expectedUsage,
    expectedRevenue: params.expectedUsage,
    expectedCommission: params.expectedCommission,
    quantity: 1,
    unitPrice: params.expectedUsage,
    revenueStartDate: DEFAULT_SCHEDULE_START,
    revenueEndDate,
    active: true,
    status: "Provisioning" as const,
  }

  if (existing) {
    return prisma.opportunityProduct.update({
      where: { id: existing.id },
      data,
    })
  }

  return prisma.opportunityProduct.create({ data })
}

async function ensureRevenueSchedule(params: {
  tenantId: string
  rowNumber: number
  monthOffset: number
  accountId: string
  opportunityId: string
  opportunityProductId: string
  productId: string
  distributorAccountId: string
  vendorAccountId: string
  expectedUsage: number
  expectedRatePercent: number
  expectedCommission: number
  accountName: string
}) {
  const scheduleDate = addMonths(DEFAULT_SCHEDULE_START, params.monthOffset)
  const scheduleNumber = makeScheduleNumber(params.rowNumber, scheduleDate)
  const existing = await prisma.revenueSchedule.findFirst({
    where: {
      tenantId: params.tenantId,
      scheduleNumber,
    },
  })

  const data = {
    tenantId: params.tenantId,
    scheduleNumber,
    scheduleDate,
    scheduleType: RevenueScheduleType.Recurring,
    status: RevenueScheduleStatus.Unreconciled,
    accountId: params.accountId,
    opportunityId: params.opportunityId,
    opportunityProductId: params.opportunityProductId,
    productId: params.productId,
    distributorAccountId: params.distributorAccountId,
    vendorAccountId: params.vendorAccountId,
    expectedUsage: params.expectedUsage,
    expectedCommission: params.expectedCommission,
    expectedCommissionRatePercent: params.expectedRatePercent,
    notes: `What To Add row ${params.rowNumber} seed for ${params.accountName}`,
  }

  if (existing) {
    return prisma.revenueSchedule.update({
      where: { id: existing.id },
      data,
    })
  }

  return prisma.revenueSchedule.create({ data })
}

async function main() {
  const tenant = await getTenant()
  const accountTypes = await getAccountTypes(tenant.id)

  const customerType = accountTypes.CUSTOMER
  const distributorType = accountTypes.DISTRIBUTOR
  const vendorType = accountTypes.VENDOR

  if (!customerType || !distributorType || !vendorType) {
    throw new Error("Missing required account types CUSTOMER, DISTRIBUTOR, or VENDOR.")
  }

  const distributor = await ensureAccount({
    tenantId: tenant.id,
    accountTypeId: distributorType.id,
    accountName: DISTRIBUTOR_NAME,
    accountLegalName: DISTRIBUTOR_NAME,
  })

  const vendorNames = Array.from(
    new Set([...allCatalogRows.map(row => row.vendorName), ...opportunityPlanRows.map(row => row.vendorName)])
  )
  const vendors = new Map<string, Awaited<ReturnType<typeof ensureAccount>>>()
  for (const vendorName of vendorNames) {
    const vendor = await ensureAccount({
      tenantId: tenant.id,
      accountTypeId: vendorType.id,
      accountName: vendorName,
      accountLegalName: vendorName,
    })
    vendors.set(vendorName, vendor)
  }

  const productMap = new Map<string, { id: string }>()
  for (const row of allCatalogRows) {
    const vendor = vendors.get(row.vendorName)
    if (!vendor) throw new Error(`Vendor ${row.vendorName} was not created.`)
    const product = await ensureCatalogProduct({
      tenantId: tenant.id,
      distributorAccountId: distributor.id,
      vendorAccountId: vendor.id,
      vendorName: row.vendorName,
      houseProductName: row.houseProductName,
      vendorProductName: row.vendorProductName,
    })
    productMap.set(`${row.vendorName}::${row.houseProductName}::${row.vendorProductName}`, { id: product.id })
  }

  for (const row of opportunityPlanRows) {
    const vendor = vendors.get(row.vendorName)
    if (!vendor) throw new Error(`Vendor ${row.vendorName} was not created.`)

    const productKey = `${row.vendorName}::${row.houseProductName}::${row.vendorProductName}`
    const product = productMap.get(productKey)
    if (!product) throw new Error(`Product mapping missing for row ${row.rowNumber}: ${productKey}`)

    const account = await ensureAccount({
      tenantId: tenant.id,
      accountTypeId: customerType.id,
      accountName: row.accountName,
      accountLegalName: row.accountName,
    })

    const opportunity = await ensureOpportunity({
      tenantId: tenant.id,
      accountId: account.id,
      opportunityName: row.opportunityName,
      vendorName: row.vendorName,
      distributorName: DISTRIBUTOR_NAME,
      expectedUsage: row.expectedUsage,
      expectedCommission: row.expectedCommission,
    })

    const opportunityProduct = await ensureOpportunityProduct({
      tenantId: tenant.id,
      opportunityId: opportunity.id,
      productId: product.id,
      houseProductName: row.houseProductName,
      vendorProductName: row.vendorProductName,
      vendorName: row.vendorName,
      distributorName: DISTRIBUTOR_NAME,
      vendorAccountId: vendor.id,
      distributorAccountId: distributor.id,
      expectedUsage: row.expectedUsage,
      expectedRatePercent: row.expectedRatePercent,
      expectedCommission: row.expectedCommission,
      periods: row.periods,
    })

    for (let monthOffset = 0; monthOffset < row.periods; monthOffset += 1) {
      await ensureRevenueSchedule({
        tenantId: tenant.id,
        rowNumber: row.rowNumber,
        monthOffset,
        accountId: account.id,
        opportunityId: opportunity.id,
        opportunityProductId: opportunityProduct.id,
        productId: product.id,
        distributorAccountId: distributor.id,
        vendorAccountId: vendor.id,
        expectedUsage: row.expectedUsage,
        expectedRatePercent: row.expectedRatePercent,
        expectedCommission: row.expectedCommission,
        accountName: row.accountName,
      })
    }
  }

  const winTechRow = doNotAddPlanRows.find(row => row.accountOnly)
  if (winTechRow) {
    await ensureAccount({
      tenantId: tenant.id,
      accountTypeId: customerType.id,
      accountName: winTechRow.accountName,
      accountLegalName: winTechRow.accountName,
    })
  }

  console.log(
    JSON.stringify(
      {
        seededCatalogRows: allCatalogRows.length,
        seededOpportunityRows: opportunityPlanRows.length,
        enforcedAccountOnlyRows: doNotAddPlanRows.filter(row => row.accountOnly).length,
        skippedAbsentBootstrapRows: doNotAddPlanRows.filter(row => !row.accountOnly).length,
      },
      null,
      2
    )
  )
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
