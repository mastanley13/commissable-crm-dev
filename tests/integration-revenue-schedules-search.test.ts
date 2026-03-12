import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { assertStatus, integrationTest, readJson } from "./integration-test-helpers"

function authedGet(sessionToken: string, url: string) {
  return new NextRequest(url, { method: "GET", headers: { cookie: `session-token=${sessionToken}` } })
}

integrationTest("REV-SEARCH-13: revenue schedule search returns account, schedule, product, and inherited opportunity matches", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const accountType = await prisma.accountType.findFirst({
    where: { tenantId: ctx.tenantId },
    select: { id: true },
  })
  assert.ok(accountType, "Expected a seeded account type")

  const customer = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "DW Realty GA, LLC",
      accountLegalName: "DW Realty GA, LLC",
      accountNumber: "DW-1824713",
    },
    select: { id: true },
  })

  const product = await prisma.product.create({
    data: {
      tenantId: ctx.tenantId,
      productCode: "REV-SEARCH-PROD-01",
      productNameHouse: "Fiber ADI House",
      productNameVendor: "Fiber ADI",
      revenueType: "Residual",
      vendorAccountId: ctx.vendorAccountId,
      distributorAccountId: ctx.distributorAccountId,
      priceEach: 100,
      commissionPercent: 16,
    },
    select: { id: true },
  })

  const opportunity = await prisma.opportunity.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: customer.id,
      name: "DW Realty - Fiber Opportunity",
      customerIdVendor: "CID-DW-100",
      orderIdVendor: "ORD-DW-100",
      locationId: "ATL-1730",
      customerPurchaseOrder: "PO-DW-100",
      distributorName: "Test Distributor",
      vendorName: "Test Vendor",
    },
    select: { id: true },
  })

  const schedule = await prisma.revenueSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: customer.id,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      opportunityId: opportunity.id,
      productId: product.id,
      scheduleNumber: "RS-SEARCH-100",
      scheduleDate: new Date("2026-02-01T00:00:00Z"),
      expectedUsage: 100,
      expectedCommission: 16,
      status: "Unreconciled",
    },
    select: { id: true },
  })

  const routeModule = await import("../app/api/revenue-schedules/route")
  const GET = (routeModule as any).GET ?? (routeModule as any).default?.GET
  assert.equal(typeof GET, "function")

  const search = async (query: string) => {
    const response = await GET(
      authedGet(
        ctx.sessionToken,
        `http://localhost/api/revenue-schedules?page=1&pageSize=25&q=${encodeURIComponent(query)}`,
      ),
    )
    assertStatus(response, 200)
    return readJson<{ data?: Array<{ id: string }> }>(response)
  }

  const byAccount = await search("DW Realty")
  assert.ok(byAccount.data?.some(row => row.id === schedule.id))

  const bySchedule = await search("RS-SEARCH-100")
  assert.ok(bySchedule.data?.some(row => row.id === schedule.id))

  const byProduct = await search("Fiber ADI")
  assert.ok(byProduct.data?.some(row => row.id === schedule.id))

  const byInheritedOpportunityField = await search("ORD-DW-100")
  assert.ok(byInheritedOpportunityField.data?.some(row => row.id === schedule.id))
})
