import { PrismaClient, RevenueScheduleStatus, RevenueScheduleType } from "@prisma/client"

const prisma = new PrismaClient()

type AccountTypeMap = Record<string, { id: string; code: string; name: string }>

function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  if (!trimmed) return { firstName: "Unknown", lastName: "Contact" }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: "Contact" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

async function getTenant() {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } })
  if (!tenant) {
    throw new Error("No tenant found. Run `npm run db:seed` first.")
  }
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

async function upsertAccount(params: {
  tenantId: string
  accountTypeId: string
  accountName: string
  accountLegalName?: string | null
}) {
  const existing = await prisma.account.findFirst({
    where: { tenantId: params.tenantId, accountName: params.accountName },
  })
  if (existing) {
    return prisma.account.update({
      where: { id: existing.id },
      data: {
        accountTypeId: params.accountTypeId,
        accountLegalName: params.accountLegalName ?? existing.accountLegalName,
      },
    })
  }
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

async function upsertContact(params: {
  tenantId: string
  accountId: string
  accountTypeId?: string | null
  fullName: string
}) {
  const existing = await prisma.contact.findFirst({
    where: {
      tenantId: params.tenantId,
      accountId: params.accountId,
      fullName: params.fullName,
      deletedAt: null,
    },
  })

  const { firstName, lastName } = splitName(params.fullName)

  if (existing) {
    return prisma.contact.update({
      where: { id: existing.id },
      data: {
        firstName,
        lastName,
        fullName: params.fullName,
        accountTypeId: params.accountTypeId ?? existing.accountTypeId,
      },
    })
  }

  return prisma.contact.create({
    data: {
      tenantId: params.tenantId,
      accountId: params.accountId,
      accountTypeId: params.accountTypeId ?? null,
      firstName,
      lastName,
      fullName: params.fullName,
      isPrimary: false,
    } as any,
  })
}

async function upsertProduct(params: {
  tenantId: string
  productCode: string
  productNameHouse: string
  productNameVendor?: string | null
  vendorAccountId?: string | null
  distributorAccountId?: string | null
}) {
  const existing = await prisma.product.findFirst({
    where: { tenantId: params.tenantId, productCode: params.productCode },
  })

  if (existing) {
    return prisma.product.update({
      where: { id: existing.id },
      data: {
        productNameHouse: params.productNameHouse,
        productNameVendor: params.productNameVendor ?? existing.productNameVendor,
        vendorAccountId: params.vendorAccountId ?? existing.vendorAccountId,
        distributorAccountId: params.distributorAccountId ?? existing.distributorAccountId,
        revenueType: existing.revenueType || "MRC_ThirdParty",
        isActive: true,
      },
    })
  }

  return prisma.product.create({
    data: {
      tenantId: params.tenantId,
      productCode: params.productCode,
      productNameHouse: params.productNameHouse,
      productNameVendor: params.productNameVendor ?? null,
      revenueType: "MRC_ThirdParty",
      vendorAccountId: params.vendorAccountId ?? null,
      distributorAccountId: params.distributorAccountId ?? null,
      isActive: true,
    },
  })
}

async function upsertOpportunity(params: {
  tenantId: string
  accountId: string
  name: string
  customerIdVendor?: string | null
  orderIdVendor?: string | null
  vendorName?: string | null
  distributorName?: string | null
  accountIdVendor?: string | null
  accountIdDistributor?: string | null
}) {
  const existing = await prisma.opportunity.findFirst({
    where: { tenantId: params.tenantId, name: params.name, accountId: params.accountId },
  })
  if (existing) {
    return prisma.opportunity.update({
      where: { id: existing.id },
      data: {
        customerIdVendor: params.customerIdVendor ?? existing.customerIdVendor,
        orderIdVendor: params.orderIdVendor ?? existing.orderIdVendor,
        vendorName: params.vendorName ?? existing.vendorName,
        distributorName: params.distributorName ?? existing.distributorName,
        accountIdVendor: params.accountIdVendor ?? existing.accountIdVendor,
        accountIdDistributor: params.accountIdDistributor ?? existing.accountIdDistributor,
        active: true,
      },
    })
  }
  return prisma.opportunity.create({
    data: {
      tenantId: params.tenantId,
      accountId: params.accountId,
      name: params.name,
      customerIdVendor: params.customerIdVendor ?? null,
      orderIdVendor: params.orderIdVendor ?? null,
      vendorName: params.vendorName ?? null,
      distributorName: params.distributorName ?? null,
      accountIdVendor: params.accountIdVendor ?? null,
      accountIdDistributor: params.accountIdDistributor ?? null,
      stage: "Qualification",
      status: "Open",
      active: true,
      type: "NewBusiness",
      leadSource: "Referral",
    },
  })
}

async function upsertOpportunityProduct(params: {
  tenantId: string
  opportunityId: string
  productId: string
  productNameHouse: string
  productNameVendor?: string | null
  revenueType: string
  vendorName?: string | null
  distributorName?: string | null
  vendorAccountId?: string | null
  distributorAccountId?: string | null
}) {
  const existing = await prisma.opportunityProduct.findFirst({
    where: { tenantId: params.tenantId, opportunityId: params.opportunityId, productId: params.productId },
  })

  if (existing) {
    return prisma.opportunityProduct.update({
      where: { id: existing.id },
      data: {
        productNameHouseSnapshot: params.productNameHouse,
        productNameVendorSnapshot: params.productNameVendor ?? existing.productNameVendorSnapshot,
        revenueTypeSnapshot: params.revenueType,
        distributorNameSnapshot: params.distributorName ?? existing.distributorNameSnapshot,
        vendorNameSnapshot: params.vendorName ?? existing.vendorNameSnapshot,
        distributorAccountIdSnapshot: params.distributorAccountId ?? existing.distributorAccountIdSnapshot,
        vendorAccountIdSnapshot: params.vendorAccountId ?? existing.vendorAccountIdSnapshot,
        active: true,
      },
    })
  }

  return prisma.opportunityProduct.create({
    data: {
      tenantId: params.tenantId,
      opportunityId: params.opportunityId,
      productId: params.productId,
      productNameHouseSnapshot: params.productNameHouse,
      productNameVendorSnapshot: params.productNameVendor ?? null,
      revenueTypeSnapshot: params.revenueType,
      distributorNameSnapshot: params.distributorName ?? null,
      vendorNameSnapshot: params.vendorName ?? null,
      distributorAccountIdSnapshot: params.distributorAccountId ?? null,
      vendorAccountIdSnapshot: params.vendorAccountId ?? null,
      status: "Provisioning",
      active: true,
    },
  })
}

async function upsertRevenueSchedule(params: {
  tenantId: string
  scheduleNumber: string
  scheduleDate: Date
  accountId: string
  opportunityId: string
  opportunityProductId?: string | null
  productId: string
  distributorAccountId?: string | null
  vendorAccountId?: string | null
  distributorOrderId?: string | null
  expectedUsage: number
  expectedCommission: number
  supplierAccount: string
}) {
  const existing = await prisma.revenueSchedule.findFirst({
    where: { tenantId: params.tenantId, scheduleNumber: params.scheduleNumber },
  })

  const data = {
    tenantId: params.tenantId,
    scheduleNumber: params.scheduleNumber,
    scheduleDate: params.scheduleDate,
    scheduleType: RevenueScheduleType.Recurring,
    status: RevenueScheduleStatus.Unreconciled,
    accountId: params.accountId,
    opportunityId: params.opportunityId,
    opportunityProductId: params.opportunityProductId ?? null,
    productId: params.productId,
    distributorAccountId: params.distributorAccountId ?? null,
    vendorAccountId: params.vendorAccountId ?? null,
    distributorOrderId: params.distributorOrderId ?? null,
    expectedUsage: params.expectedUsage,
    expectedCommission: params.expectedCommission,
    notes: `Supplier Account: ${params.supplierAccount}`,
  }

  if (existing) {
    return prisma.revenueSchedule.update({
      where: { id: existing.id },
      data,
    })
  }

  return prisma.revenueSchedule.create({ data })
}

async function upsertOpportunityRole(params: {
  tenantId: string
  opportunityId: string
  role: string
  contactId?: string | null
  fullName: string
}) {
  const existing = await prisma.opportunityRole.findFirst({
    where: {
      tenantId: params.tenantId,
      opportunityId: params.opportunityId,
      role: params.role,
      contactId: params.contactId ?? null,
    },
  })

  if (existing) {
    return prisma.opportunityRole.update({
      where: { id: existing.id },
      data: {
        fullName: params.fullName,
        contactId: params.contactId ?? existing.contactId,
        active: true,
      },
    })
  }

  return prisma.opportunityRole.create({
    data: {
      tenantId: params.tenantId,
      opportunityId: params.opportunityId,
      contactId: params.contactId ?? null,
      role: params.role,
      fullName: params.fullName,
      active: true,
    },
  })
}

async function main() {
  const tenant = await getTenant()
  const types = await getAccountTypes(tenant.id)

  const customerType = types["CUSTOMER"]
  const distributorType = types["DISTRIBUTOR"]
  const vendorType = types["VENDOR"]

  if (!customerType || !distributorType || !vendorType) {
    throw new Error("Missing required account types (CUSTOMER, DISTRIBUTOR, VENDOR). Run `npm run db:seed` first.")
  }

  const distributor = await upsertAccount({
    tenantId: tenant.id,
    accountTypeId: distributorType.id,
    accountName: "Telarus",
    accountLegalName: "Telarus",
  })

  const vendor = await upsertAccount({
    tenantId: tenant.id,
    accountTypeId: vendorType.id,
    accountName: "ACC Business",
    accountLegalName: "ACC Business",
  })

  const customer1 = await upsertAccount({
    tenantId: tenant.id,
    accountTypeId: customerType.id,
    accountName: "Edge Business",
    accountLegalName: "Edge Business",
  })

  const customer2 = await upsertAccount({
    tenantId: tenant.id,
    accountTypeId: customerType.id,
    accountName: "KRE UP Holdings LLC/University Partners",
    accountLegalName: "KRE UP Holdings LLC/University Partners",
  })

  const shawnWallis = await upsertContact({
    tenantId: tenant.id,
    accountId: customer1.id,
    accountTypeId: customer1.accountTypeId,
    fullName: "Shawn Wallis",
  })

  const corbenWashington = await upsertContact({
    tenantId: tenant.id,
    accountId: customer2.id,
    accountTypeId: customer2.accountTypeId,
    fullName: "Corben Washington",
  })

  const byronBraun = await upsertContact({
    tenantId: tenant.id,
    accountId: distributor.id,
    accountTypeId: distributor.accountTypeId,
    fullName: "Byron Braun",
  })

  const productIn = await upsertProduct({
    tenantId: tenant.id,
    productCode: "IN",
    productNameHouse: "ADI",
    productNameVendor: "ADI",
    vendorAccountId: vendor.id,
    distributorAccountId: distributor.id,
  })

  const productVi = await upsertProduct({
    tenantId: tenant.id,
    productCode: "VI",
    productNameHouse: "VoIP",
    productNameVendor: "VoIP",
    vendorAccountId: vendor.id,
    distributorAccountId: distributor.id,
  })

  const productS1 = await upsertProduct({
    tenantId: tenant.id,
    productCode: "S1",
    productNameHouse: "HSIA Internet Access",
    productNameVendor: "HSIA Internet Access",
    vendorAccountId: vendor.id,
    distributorAccountId: distributor.id,
  })

  const opportunity1 = await upsertOpportunity({
    tenantId: tenant.id,
    accountId: customer1.id,
    name: "Edge Business — Telarus 342021",
    customerIdVendor: "1806880",
    orderIdVendor: "342021",
    vendorName: "ACC Business",
    distributorName: "Telarus",
    accountIdVendor: vendor.id,
    accountIdDistributor: distributor.id,
  })

  const opportunity2 = await upsertOpportunity({
    tenantId: tenant.id,
    accountId: customer2.id,
    name: "KRE UP Holdings — Telarus 890954",
    customerIdVendor: "2007641",
    orderIdVendor: "890954",
    vendorName: "ACC Business",
    distributorName: "Telarus",
    accountIdVendor: vendor.id,
    accountIdDistributor: distributor.id,
  })

  await upsertOpportunityRole({
    tenantId: tenant.id,
    opportunityId: opportunity1.id,
    role: "Customer Contact",
    contactId: shawnWallis.id,
    fullName: shawnWallis.fullName,
  })

  await upsertOpportunityRole({
    tenantId: tenant.id,
    opportunityId: opportunity1.id,
    role: "Agent Contact",
    contactId: byronBraun.id,
    fullName: byronBraun.fullName,
  })

  await upsertOpportunityRole({
    tenantId: tenant.id,
    opportunityId: opportunity2.id,
    role: "Customer Contact",
    contactId: corbenWashington.id,
    fullName: corbenWashington.fullName,
  })

  await upsertOpportunityRole({
    tenantId: tenant.id,
    opportunityId: opportunity2.id,
    role: "Agent Contact",
    contactId: byronBraun.id,
    fullName: byronBraun.fullName,
  })

  const opp1ProductIn = await upsertOpportunityProduct({
    tenantId: tenant.id,
    opportunityId: opportunity1.id,
    productId: productIn.id,
    productNameHouse: productIn.productNameHouse,
    productNameVendor: productIn.productNameVendor,
    revenueType: productIn.revenueType,
    vendorName: vendor.accountName,
    distributorName: distributor.accountName,
    vendorAccountId: vendor.id,
    distributorAccountId: distributor.id,
  })

  const opp1ProductVi = await upsertOpportunityProduct({
    tenantId: tenant.id,
    opportunityId: opportunity1.id,
    productId: productVi.id,
    productNameHouse: productVi.productNameHouse,
    productNameVendor: productVi.productNameVendor,
    revenueType: productVi.revenueType,
    vendorName: vendor.accountName,
    distributorName: distributor.accountName,
    vendorAccountId: vendor.id,
    distributorAccountId: distributor.id,
  })

  const opp2ProductS1 = await upsertOpportunityProduct({
    tenantId: tenant.id,
    opportunityId: opportunity2.id,
    productId: productS1.id,
    productNameHouse: productS1.productNameHouse,
    productNameVendor: productS1.productNameVendor,
    revenueType: productS1.revenueType,
    vendorName: vendor.accountName,
    distributorName: distributor.accountName,
    vendorAccountId: vendor.id,
    distributorAccountId: distributor.id,
  })

  const scheduleDate = new Date("2025-09-01T00:00:00.000Z")

  await upsertRevenueSchedule({
    tenantId: tenant.id,
    scheduleNumber: "RS-125165",
    scheduleDate,
    accountId: customer1.id,
    opportunityId: opportunity1.id,
    opportunityProductId: opp1ProductIn.id,
    productId: productIn.id,
    distributorAccountId: distributor.id,
    vendorAccountId: vendor.id,
    distributorOrderId: opportunity1.orderIdVendor ?? "342021",
    expectedUsage: 2.4,
    expectedCommission: 0.38,
    supplierAccount: "8310010182127",
  })

  await upsertRevenueSchedule({
    tenantId: tenant.id,
    scheduleNumber: "RS-125189",
    scheduleDate,
    accountId: customer1.id,
    opportunityId: opportunity1.id,
    opportunityProductId: opp1ProductVi.id,
    productId: productVi.id,
    distributorAccountId: distributor.id,
    vendorAccountId: vendor.id,
    distributorOrderId: opportunity1.orderIdVendor ?? "342021",
    expectedUsage: 29.9,
    expectedCommission: 4.78,
    supplierAccount: "8310010182127",
  })

  await upsertRevenueSchedule({
    tenantId: tenant.id,
    scheduleNumber: "RS-125213",
    scheduleDate,
    accountId: customer1.id,
    opportunityId: opportunity1.id,
    opportunityProductId: opp1ProductIn.id,
    productId: productIn.id,
    distributorAccountId: distributor.id,
    vendorAccountId: vendor.id,
    distributorOrderId: opportunity1.orderIdVendor ?? "342021",
    expectedUsage: 744.61,
    expectedCommission: 119.14,
    supplierAccount: "8310015333839",
  })

  await upsertRevenueSchedule({
    tenantId: tenant.id,
    scheduleNumber: "RS-125237",
    scheduleDate,
    accountId: customer1.id,
    opportunityId: opportunity1.id,
    opportunityProductId: opp1ProductVi.id,
    productId: productVi.id,
    distributorAccountId: distributor.id,
    vendorAccountId: vendor.id,
    distributorOrderId: opportunity1.orderIdVendor ?? "342021",
    expectedUsage: 94.39,
    expectedCommission: 15.1,
    supplierAccount: "8310015333839",
  })

  await upsertRevenueSchedule({
    tenantId: tenant.id,
    scheduleNumber: "RS-117653",
    scheduleDate,
    accountId: customer2.id,
    opportunityId: opportunity2.id,
    opportunityProductId: opp2ProductS1.id,
    productId: productS1.id,
    distributorAccountId: distributor.id,
    vendorAccountId: vendor.id,
    distributorOrderId: opportunity2.orderIdVendor ?? "890954",
    expectedUsage: 160,
    expectedCommission: 27.2,
    supplierAccount: "8310015291624",
  })

  console.log("Seeded Milestone 1 test dataset:")
  console.log(`- Accounts: ${distributor.accountName}, ${vendor.accountName}, ${customer1.accountName}, ${customer2.accountName}`)
  console.log(`- Contacts: ${shawnWallis.fullName}, ${corbenWashington.fullName}, ${byronBraun.fullName}`)
  console.log(`- Products: ${productIn.productNameHouse} (IN), ${productVi.productNameHouse} (VI), ${productS1.productNameHouse} (S1)`)
  console.log(`- Opportunities: ${opportunity1.name}, ${opportunity2.name}`)
  console.log("- Revenue schedules: RS-125165, RS-125189, RS-125213, RS-125237, RS-117653")
}

main()
  .catch(error => {
    console.error("Failed to seed Milestone 1 test data", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null)
  })
