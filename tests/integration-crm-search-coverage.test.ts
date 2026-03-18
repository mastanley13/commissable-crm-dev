import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { assertStatus, integrationTest, readJson } from "./integration-test-helpers"

function authedGet(sessionToken: string, url: string) {
  return new NextRequest(url, { method: "GET", headers: { cookie: `session-token=${sessionToken}` } })
}

integrationTest("CRM-SEARCH-01: expanded global search covers accounts, opportunities, contacts, products, groups, and activities", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma
  assert.ok(prisma, "Expected prisma client")

  const accountType = await prisma.accountType.findFirst({
    where: { tenantId: ctx.tenantId },
    select: { id: true },
  })
  assert.ok(accountType, "Expected a seeded account type")

  const shippingAddress = await prisma.address.create({
    data: {
      tenantId: ctx.tenantId,
      line1: "42 Search Lane",
      city: "Marietta",
      state: "GA",
      postalCode: "30060",
      country: "USA",
    },
    select: { id: true },
  })

  const parentAccount = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "Parent Search Holdings",
    },
    select: { id: true },
  })

  const industry = await prisma.industry.create({
    data: {
      tenantId: ctx.tenantId,
      name: "Search Telecom",
    },
    select: { id: true },
  })

  const account = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      parentAccountId: parentAccount.id,
      industryId: industry.id,
      ownerId: ctx.userId,
      accountName: "Acme Search Customer",
      accountLegalName: "Acme Search Customer LLC",
      accountNumber: "ACCT-SEARCH-7788",
      shippingAddressId: shippingAddress.id,
      websiteUrl: "search.example.com",
      description: "Primary customer for search coverage",
    },
    select: { id: true },
  })

  const opportunity = await prisma.opportunity.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: account.id,
      ownerId: ctx.userId,
      name: "Acme Search Rollout",
      orderIdHouse: "HOUSE-SEARCH-991",
      orderIdVendor: "VENDOR-SEARCH-992",
      customerIdVendor: "CUST-SEARCH-993",
      locationId: "LOC-SEARCH-994",
      description: "Opportunity description searchable",
      distributorName: "Test Distributor",
      vendorName: "Test Vendor",
    },
    select: { id: true },
  })

  const contact = await prisma.contact.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: account.id,
      accountTypeId: accountType.id,
      ownerId: ctx.userId,
      firstName: "Sam",
      lastName: "Search",
      fullName: "Sam Search",
      emailAddress: "sam.search@example.com",
      workPhone: "555-111-2222",
      workPhoneExt: "4312",
      mobilePhone: "555-333-4444",
      jobTitle: "Search Lead",
      preferredContactMethod: "Email",
      isPrimary: true,
    },
    select: { id: true },
  })

  const product = await prisma.product.create({
    data: {
      tenantId: ctx.tenantId,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      productCode: "PROD-SEARCH-01",
      productNameHouse: "House Search Connect",
      productNameVendor: "Vendor Search Connect",
      productDescriptionVendor: "Advanced search connectivity package",
      productFamilyHouse: "Search Family House",
      productSubtypeVendor: "Search Subtype Vendor",
      partNumberVendor: "PN-SEARCH-500",
      revenueType: "Residual",
      priceEach: 120,
      commissionPercent: 18,
    },
    select: { id: true },
  })

  const group = await prisma.group.create({
    data: {
      tenantId: ctx.tenantId,
      ownerId: ctx.userId,
      name: "Search Tigers",
      description: "Search-led account team",
    },
    select: { id: true },
  })

  const activityService = await import("../lib/activity-service")
  const createActivity =
    (activityService as any).createActivity ?? (activityService as any).default?.createActivity
  assert.equal(typeof createActivity, "function")

  const createdActivity = await createActivity({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    creatorId: ctx.userId,
    subject: "Search kickoff",
    type: "Meeting",
    status: "Open",
    assigneeId: ctx.userId,
    accountId: account.id,
    contactId: contact.id,
    opportunityId: opportunity.id,
    description: "Kickoff activity for search coverage",
  })

  const accountsRoute = await import("../app/api/accounts/route")
  const opportunitiesRoute = await import("../app/api/opportunities/route")
  const contactsRoute = await import("../app/api/contacts/route")
  const productsRoute = await import("../app/api/products/route")
  const groupsRoute = await import("../app/api/groups/route")
  const activitiesRoute = await import("../app/api/activities/route")

  const getAccounts = (accountsRoute as any).GET
  const getOpportunities = (opportunitiesRoute as any).GET
  const getContacts = (contactsRoute as any).GET
  const getProducts = (productsRoute as any).GET
  const getGroups = (groupsRoute as any).GET
  const getActivities = (activitiesRoute as any).GET

  const accountByNumber = await getAccounts(
    authedGet(ctx.sessionToken, "http://localhost/api/accounts?page=1&pageSize=25&q=ACCT-SEARCH-7788"),
  )
  assertStatus(accountByNumber, 200)
  const accountByNumberJson = await readJson<{ data?: Array<{ id: string }> }>(accountByNumber)
  assert.ok(accountByNumberJson.data?.some(row => row.id === account.id))

  const accountByCity = await getAccounts(
    authedGet(ctx.sessionToken, "http://localhost/api/accounts?page=1&pageSize=25&q=Marietta"),
  )
  assertStatus(accountByCity, 200)
  const accountByCityJson = await readJson<{ data?: Array<{ id: string }> }>(accountByCity)
  assert.ok(accountByCityJson.data?.some(row => row.id === account.id))

  const opportunityByOrder = await getOpportunities(
    authedGet(ctx.sessionToken, "http://localhost/api/opportunities?page=1&pageSize=25&q=HOUSE-SEARCH-991"),
  )
  assertStatus(opportunityByOrder, 200)
  const opportunityByOrderJson = await readJson<{ data?: Array<{ id: string }> }>(opportunityByOrder)
  assert.ok(opportunityByOrderJson.data?.some(row => row.id === opportunity.id))

  const opportunityByLocation = await getOpportunities(
    authedGet(ctx.sessionToken, "http://localhost/api/opportunities?page=1&pageSize=25&q=LOC-SEARCH-994"),
  )
  assertStatus(opportunityByLocation, 200)
  const opportunityByLocationJson = await readJson<{ data?: Array<{ id: string }> }>(opportunityByLocation)
  assert.ok(opportunityByLocationJson.data?.some(row => row.id === opportunity.id))

  const contactByAccount = await getContacts(
    authedGet(ctx.sessionToken, "http://localhost/api/contacts?page=1&pageSize=25&q=Acme%20Search%20Customer"),
  )
  assertStatus(contactByAccount, 200)
  const contactByAccountJson = await readJson<{ data?: Array<{ id: string }> }>(contactByAccount)
  assert.ok(contactByAccountJson.data?.some(row => row.id === contact.id))

  const contactByExtension = await getContacts(
    authedGet(ctx.sessionToken, "http://localhost/api/contacts?page=1&pageSize=25&q=4312"),
  )
  assertStatus(contactByExtension, 200)
  const contactByExtensionJson = await readJson<{ data?: Array<{ id: string }> }>(contactByExtension)
  assert.ok(contactByExtensionJson.data?.some(row => row.id === contact.id))

  const productByDescription = await getProducts(
    authedGet(ctx.sessionToken, "http://localhost/api/products?page=1&pageSize=25&q=connectivity%20package"),
  )
  assertStatus(productByDescription, 200)
  const productByDescriptionJson = await readJson<{ data?: Array<{ id: string }> }>(productByDescription)
  assert.ok(productByDescriptionJson.data?.some(row => row.id === product.id))

  const productByFamily = await getProducts(
    authedGet(ctx.sessionToken, "http://localhost/api/products?page=1&pageSize=25&q=Search%20Family%20House"),
  )
  assertStatus(productByFamily, 200)
  const productByFamilyJson = await readJson<{ data?: Array<{ id: string }> }>(productByFamily)
  assert.ok(productByFamilyJson.data?.some(row => row.id === product.id))

  const groupByOwner = await getGroups(
    authedGet(ctx.sessionToken, "http://localhost/api/groups?page=1&pageSize=25&q=Test%20User"),
  )
  assertStatus(groupByOwner, 200)
  const groupByOwnerJson = await readJson<{ data?: Array<{ id: string }> }>(groupByOwner)
  assert.ok(groupByOwnerJson.data?.some(row => row.id === group.id))

  const activitiesByAssignee = await getActivities(
    authedGet(ctx.sessionToken, "http://localhost/api/activities?page=1&pageSize=25&q=Test%20User"),
  )
  assertStatus(activitiesByAssignee, 200)
  const activitiesByAssigneeJson = await readJson<{ data?: Array<{ id: string }> }>(activitiesByAssignee)
  assert.ok(activitiesByAssigneeJson.data?.some(row => row.id === createdActivity.id))
})
