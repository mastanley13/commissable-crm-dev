import { AccountStatus, OpportunityStage, OpportunityStatus, OpportunityType, OpportunityProductStatus, RevenueType } from "@prisma/client"
import { getPrisma, disconnect } from "../lib/db"
import { recalculateOpportunityStage } from "../lib/opportunities/stage"

async function ensureAccount(prisma: Awaited<ReturnType<typeof getPrisma>>, tenantId: string) {
  const existing = await prisma.account.findFirst({ where: { tenantId } })
  if (existing) return existing

  let accountType = await prisma.accountType.findFirst({ where: { tenantId } })
  if (!accountType) {
    accountType = await prisma.accountType.create({
      data: {
        tenantId,
        code: "Default",
        name: "Default",
        description: "Auto-created by seed",
        displayOrder: 0,
      },
    })
  }

  return prisma.account.create({
    data: {
      tenantId,
      accountTypeId: accountType.id,
      accountName: "Demo Account (Stage Seed)",
      accountLegalName: "Demo Account Legal",
      status: AccountStatus.Active,
      description: "Created by seed-opportunity-stage-demo.ts",
    },
  })
}

async function ensureProduct(prisma: Awaited<ReturnType<typeof getPrisma>>, tenantId: string) {
  const existing = await prisma.product.findFirst({ where: { tenantId }, select: { id: true } })
  if (existing) return existing as any

  return prisma.product.create({
    data: {
      tenantId,
      productCode: `DEMO-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      productNameHouse: "Demo Service",
      revenueType: RevenueType.MRC_PerItem,
      priceEach: 100 as any,
      commissionPercent: 10 as any,
      isActive: true,
      description: "Seeded demo product",
    },
  })
}

async function main() {
  const prisma = await getPrisma()
  const tenant = await prisma.tenant.findFirst({ select: { id: true, name: true } })
  if (!tenant) throw new Error("No tenant found; please create a tenant first")

  const account = await ensureAccount(prisma, tenant.id)
  const product = await ensureProduct(prisma, tenant.id)

  // Helper to create an opportunity with initial ClosedWon_Provisioning
  async function createBaseOpp(name: string) {
    return prisma.opportunity.create({
      data: {
        tenantId: tenant.id,
        accountId: account.id,
        name,
        stage: OpportunityStage.ClosedWon_Provisioning,
        status: OpportunityStatus.Won,
        type: OpportunityType.NewBusiness,
      },
      select: { id: true, name: true },
    })
  }

  // A) Provisioning — no active billing products
  const oppProvisioning = await createBaseOpp("Demo - Provisioning")
  await prisma.opportunityProduct.create({
    data: {
      tenantId: tenant.id,
      opportunityId: oppProvisioning.id,
      productId: product.id,
      quantity: 1 as any,
      unitPrice: 100 as any,
      status: OpportunityProductStatus.Provisioning,
    },
  })
  await recalculateOpportunityStage(oppProvisioning.id)

  // B) Billing — at least one ActiveBilling product
  const oppBilling = await createBaseOpp("Demo - Billing")
  await prisma.opportunityProduct.create({
    data: {
      tenantId: tenant.id,
      opportunityId: oppBilling.id,
      productId: product.id,
      quantity: 2 as any,
      unitPrice: 150 as any,
      status: OpportunityProductStatus.ActiveBilling,
    },
  })
  await recalculateOpportunityStage(oppBilling.id)

  // C) Billing Ended — all products ended
  const oppEnded = await createBaseOpp("Demo - Billing Ended")
  await prisma.opportunityProduct.createMany({
    data: [
      {
        tenantId: tenant.id,
        opportunityId: oppEnded.id,
        productId: product.id,
        quantity: 1 as any,
        unitPrice: 200 as any,
        status: OpportunityProductStatus.BillingEnded,
      },
      {
        tenantId: tenant.id,
        opportunityId: oppEnded.id,
        productId: product.id,
        quantity: 3 as any,
        unitPrice: 75 as any,
        status: OpportunityProductStatus.BillingEnded,
      },
    ],
  })
  await recalculateOpportunityStage(oppEnded.id)

  console.log("\nSeed complete. Opportunities created:")
  console.log(" -", oppProvisioning.name)
  console.log(" -", oppBilling.name)
  console.log(" -", oppEnded.name)
  console.log("\nOpen Opportunities list and filter by names above to verify stages and badges.")
}

main()
  .catch((err) => {
    console.error("Seed failed:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnect()
  })
