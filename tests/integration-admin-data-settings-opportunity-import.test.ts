import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function makeImportRequest(params: {
  sessionToken: string
  entityType: "opportunities"
  mapping: Record<string, string>
  rows: Array<Record<string, unknown>>
  upsertExisting?: boolean
  validateOnly?: boolean
}) {
  return new NextRequest("http://localhost/api/admin/data-settings/imports", {
    method: "POST",
    headers: {
      cookie: `session-token=${params.sessionToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      entityType: params.entityType,
      upsertExisting: params.upsertExisting ?? true,
      validateOnly: params.validateOnly ?? false,
      mapping: params.mapping,
      rows: params.rows
    })
  })
}

integrationTest("ADMIN-IMPORT-OPP-01: opportunity import creates an opportunity and active role", async ctx => {
  const routeModule = await import("../app/api/admin/data-settings/imports/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const accountType = await prisma.accountType.findFirst({
    where: { tenantId: ctx.tenantId, code: "CUSTOMER" },
    select: { id: true }
  })
  assert.ok(accountType?.id)

  const account = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "Import Opportunity Account"
    },
    select: { id: true }
  })

  await prisma.contact.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: account.id,
      accountTypeId: accountType.id,
      contactType: "Customer",
      firstName: "Jordan",
      lastName: "Lane",
      fullName: "Jordan Lane",
      emailAddress: "jordan.lane@example.com",
      createdById: ctx.userId,
      updatedById: ctx.userId
    }
  })

  const response = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      entityType: "opportunities",
      mapping: {
        "Account Name": "accountName",
        "Opportunity Name": "name",
        "Role": "roleName",
        "Role Contact Email": "roleContactEmail",
        "Stage": "stage",
      },
      rows: [
        {
          "Account Name": "Import Opportunity Account",
          "Opportunity Name": "Imported Opportunity",
          "Role": "Decision Maker",
          "Role Contact Email": "jordan.lane@example.com",
          "Stage": "Qualification",
        }
      ]
    })
  )

  assertStatus(response, 200)
  const payload = await readJson<{ data?: { successRows: number; errorRows: number } }>(response)
  assert.equal(payload.data?.successRows, 1)
  assert.equal(payload.data?.errorRows, 0)

  const opportunity = await prisma.opportunity.findFirst({
    where: { tenantId: ctx.tenantId, accountId: account.id, name: "Imported Opportunity" },
    select: { id: true, stage: true }
  })
  assert.ok(opportunity?.id)
  assert.equal(opportunity?.stage, "Qualification")

  const roles = await prisma.opportunityRole.findMany({
    where: { tenantId: ctx.tenantId, opportunityId: opportunity.id },
    select: { role: true, email: true, fullName: true, active: true }
  })
  assert.equal(roles.length, 1)
  assert.equal(roles[0]?.role, "Decision Maker")
  assert.equal(roles[0]?.email, "jordan.lane@example.com")
  assert.equal(roles[0]?.fullName, "Jordan Lane")
  assert.equal(roles[0]?.active, true)
})

integrationTest("ADMIN-IMPORT-OPP-02: opportunity import rejects House accounts", async ctx => {
  const routeModule = await import("../app/api/admin/data-settings/imports/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const houseType = await prisma.accountType.create({
    data: {
      tenantId: ctx.tenantId,
      code: "HOUSE",
      name: "House"
    },
    select: { id: true }
  })

  const houseAccount = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: houseType.id,
      accountName: "House Import Account"
    },
    select: { id: true }
  })

  await prisma.contact.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: houseAccount.id,
      accountTypeId: houseType.id,
      contactType: "House",
      firstName: "Holly",
      lastName: "Home",
      fullName: "Holly Home",
      emailAddress: "holly.home@example.com",
      createdById: ctx.userId,
      updatedById: ctx.userId
    }
  })

  const response = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      entityType: "opportunities",
      mapping: {
        "Account Name": "accountName",
        "Opportunity Name": "name",
        "Role": "roleName",
        "Role Contact Email": "roleContactEmail",
      },
      rows: [
        {
          "Account Name": "House Import Account",
          "Opportunity Name": "Blocked Opportunity",
          "Role": "Decision Maker",
          "Role Contact Email": "holly.home@example.com",
        }
      ]
    })
  )

  assertStatus(response, 200)
  const payload = await readJson<{
    data?: { successRows: number; errorRows: number; errors: Array<{ message: string; field: string }> }
  }>(response)
  assert.equal(payload.data?.successRows, 0)
  assert.equal(payload.data?.errorRows, 1)
  assert.match(payload.data?.errors?.[0]?.message ?? "", /house account/i)
  assert.equal(payload.data?.errors?.[0]?.field, "accountName")
})

integrationTest("ADMIN-IMPORT-OPP-03: opportunity import rejects missing role contact", async ctx => {
  const routeModule = await import("../app/api/admin/data-settings/imports/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const accountType = await prisma.accountType.findFirst({
    where: { tenantId: ctx.tenantId, code: "CUSTOMER" },
    select: { id: true }
  })
  assert.ok(accountType?.id)

  await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "Missing Role Contact Account"
    }
  })

  const response = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      entityType: "opportunities",
      mapping: {
        "Account Name": "accountName",
        "Opportunity Name": "name",
        "Role": "roleName",
        "Role Contact Email": "roleContactEmail",
      },
      rows: [
        {
          "Account Name": "Missing Role Contact Account",
          "Opportunity Name": "Missing Contact Opportunity",
          "Role": "Decision Maker",
          "Role Contact Email": "missing.contact@example.com",
        }
      ]
    })
  )

  assertStatus(response, 200)
  const payload = await readJson<{
    data?: { successRows: number; errorRows: number; errors: Array<{ message: string; field: string }> }
  }>(response)
  assert.equal(payload.data?.successRows, 0)
  assert.equal(payload.data?.errorRows, 1)
  assert.equal(payload.data?.errors?.[0]?.field, "roleContactEmail")
  assert.match(payload.data?.errors?.[0]?.message ?? "", /was not found/i)
})

integrationTest("ADMIN-IMPORT-OPP-04: opportunity import upsert ensures role without duplicates", async ctx => {
  const routeModule = await import("../app/api/admin/data-settings/imports/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const accountType = await prisma.accountType.findFirst({
    where: { tenantId: ctx.tenantId, code: "CUSTOMER" },
    select: { id: true }
  })
  assert.ok(accountType?.id)

  const account = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "Upsert Opportunity Account"
    },
    select: { id: true }
  })

  const contact = await prisma.contact.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: account.id,
      accountTypeId: accountType.id,
      contactType: "Customer",
      firstName: "Avery",
      lastName: "Stone",
      fullName: "Avery Stone",
      emailAddress: "avery.stone@example.com",
      createdById: ctx.userId,
      updatedById: ctx.userId
    },
    select: { id: true }
  })

  const opportunity = await prisma.opportunity.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: account.id,
      ownerId: ctx.userId,
      name: "Existing Opportunity",
      stage: "Qualification",
      leadSource: "Referral",
      createdById: ctx.userId,
      updatedById: ctx.userId
    },
    select: { id: true }
  })

  const request = makeImportRequest({
    sessionToken: ctx.sessionToken,
    entityType: "opportunities",
    mapping: {
      "Account Name": "accountName",
      "Opportunity Name": "name",
      "Role": "roleName",
      "Role Contact Email": "roleContactEmail",
      "Stage": "stage",
    },
    rows: [
      {
        "Account Name": "Upsert Opportunity Account",
        "Opportunity Name": "Existing Opportunity",
        "Role": "Technical Buyer",
        "Role Contact Email": "avery.stone@example.com",
        "Stage": "Proposal",
      }
    ]
  })

  const firstResponse = await POST(request)
  assertStatus(firstResponse, 200)
  const secondResponse = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      entityType: "opportunities",
      mapping: {
        "Account Name": "accountName",
        "Opportunity Name": "name",
        "Role": "roleName",
        "Role Contact Email": "roleContactEmail",
        "Stage": "stage",
      },
      rows: [
        {
          "Account Name": "Upsert Opportunity Account",
          "Opportunity Name": "Existing Opportunity",
          "Role": "Technical Buyer",
          "Role Contact Email": "avery.stone@example.com",
          "Stage": "Proposal",
        }
      ]
    })
  )
  assertStatus(secondResponse, 200)

  const updatedOpportunity = await prisma.opportunity.findFirst({
    where: { id: opportunity.id },
    select: { stage: true }
  })
  assert.equal(updatedOpportunity?.stage, "Proposal")

  const roles = await prisma.opportunityRole.findMany({
    where: {
      tenantId: ctx.tenantId,
      opportunityId: opportunity.id,
      contactId: contact.id,
      active: true
    },
    select: { role: true }
  })

  assert.equal(roles.length, 1)
  assert.equal(roles[0]?.role, "Technical Buyer")
})

integrationTest("ADMIN-IMPORT-OPP-05: opportunity import persists extended metadata fields", async ctx => {
  const routeModule = await import("../app/api/admin/data-settings/imports/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const accountType = await prisma.accountType.findFirst({
    where: { tenantId: ctx.tenantId, code: "CUSTOMER" },
    select: { id: true }
  })
  assert.ok(accountType?.id)

  const shippingAddress = await prisma.address.create({
    data: {
      tenantId: ctx.tenantId,
      line1: "500 Shipping Ave",
      city: "Denver",
      state: "CO",
      postalCode: "80202",
      country: "USA"
    },
    select: { id: true }
  })

  const billingAddress = await prisma.address.create({
    data: {
      tenantId: ctx.tenantId,
      line1: "700 Billing Blvd",
      city: "Denver",
      state: "CO",
      postalCode: "80203",
      country: "USA"
    },
    select: { id: true }
  })

  const account = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "Extended Metadata Account",
      shippingAddressId: shippingAddress.id,
      billingAddressId: billingAddress.id
    },
    select: { id: true }
  })

  await prisma.contact.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: account.id,
      accountTypeId: accountType.id,
      contactType: "Customer",
      firstName: "Avery",
      lastName: "Stone",
      fullName: "Avery Stone",
      emailAddress: "avery.stone@example.com",
      createdById: ctx.userId,
      updatedById: ctx.userId
    }
  })

  const response = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      entityType: "opportunities",
      mapping: {
        "Account Name": "accountName",
        "Opportunity Name": "name",
        "Role": "roleName",
        "Role Contact Email": "roleContactEmail",
        "Referred By": "referredBy",
        "Subagent": "subAgent",
        "Subagent Percent": "subagentPercent",
        "House Rep Percent": "houseRepPercent",
        "House Account ID": "accountIdHouse",
        "Vendor Account ID": "accountIdVendor",
        "Distributor Account ID": "accountIdDistributor",
        "House Customer ID": "customerIdHouse",
        "Vendor Customer ID": "customerIdVendor",
        "Distributor Customer ID": "customerIdDistributor",
        "Location ID": "locationId",
        "House Order ID": "orderIdHouse",
        "Vendor Order ID": "orderIdVendor",
        "Distributor Order ID": "orderIdDistributor",
        "Customer Purchase Order": "customerPurchaseOrder"
      },
      rows: [
        {
          "Account Name": "Extended Metadata Account",
          "Opportunity Name": "Extended Metadata Opportunity",
          "Role": "Decision Maker",
          "Role Contact Email": "avery.stone@example.com",
          "Referred By": "Referral Partner",
          "Subagent": "Agency North",
          "Subagent Percent": "25",
          "House Rep Percent": "35",
          "House Account ID": "HOUSE-001",
          "Vendor Account ID": "VEN-001 / VEN-002",
          "Distributor Account ID": "DIST-001",
          "House Customer ID": "CUST-H-001",
          "Vendor Customer ID": "VCUST-1 / VCUST-2",
          "Distributor Customer ID": "DCUST-1",
          "Location ID": "LOC-700",
          "House Order ID": "HORD-123",
          "Vendor Order ID": "VORD-1 / VORD-2",
          "Distributor Order ID": "DORD-99",
          "Customer Purchase Order": "PO-456"
        }
      ]
    })
  )

  assertStatus(response, 200)
  const payload = await readJson<{ data?: { successRows: number; errorRows: number } }>(response)
  assert.equal(payload.data?.successRows, 1)
  assert.equal(payload.data?.errorRows, 0)

  const opportunity = await prisma.opportunity.findFirst({
    where: { tenantId: ctx.tenantId, accountId: account.id, name: "Extended Metadata Opportunity" },
    select: {
      referredBy: true,
      description: true,
      shippingAddress: true,
      billingAddress: true,
      subagentPercent: true,
      houseRepPercent: true,
      houseSplitPercent: true,
      accountIdHouse: true,
      accountIdVendor: true,
      accountIdDistributor: true,
      customerIdHouse: true,
      customerIdVendor: true,
      customerIdDistributor: true,
      locationId: true,
      orderIdHouse: true,
      orderIdVendor: true,
      orderIdDistributor: true,
      customerPurchaseOrder: true
    }
  })

  assert.equal(opportunity?.referredBy, "Referral Partner")
  assert.match(opportunity?.description ?? "", /Subagent: Agency North/)
  assert.match(opportunity?.shippingAddress ?? "", /500 Shipping Ave/)
  assert.match(opportunity?.billingAddress ?? "", /700 Billing Blvd/)
  assert.equal(String(opportunity?.subagentPercent), "25")
  assert.equal(String(opportunity?.houseRepPercent), "35")
  assert.equal(String(opportunity?.houseSplitPercent), "40")
  assert.equal(opportunity?.accountIdHouse, "HOUSE-001")
  assert.equal(opportunity?.accountIdVendor, "VEN-001|VEN-002")
  assert.equal(opportunity?.accountIdDistributor, "DIST-001")
  assert.equal(opportunity?.customerIdHouse, "CUST-H-001")
  assert.equal(opportunity?.customerIdVendor, "VCUST-1|VCUST-2")
  assert.equal(opportunity?.customerIdDistributor, "DCUST-1")
  assert.equal(opportunity?.locationId, "LOC-700")
  assert.equal(opportunity?.orderIdHouse, "HORD-123")
  assert.equal(opportunity?.orderIdVendor, "VORD-1|VORD-2")
  assert.equal(opportunity?.orderIdDistributor, "DORD-99")
  assert.equal(opportunity?.customerPurchaseOrder, "PO-456")
})

integrationTest("ADMIN-IMPORT-OPP-06: opportunity import maps closed billing aliases to supported stages", async ctx => {
  const routeModule = await import("../app/api/admin/data-settings/imports/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const accountType = await prisma.accountType.findFirst({
    where: { tenantId: ctx.tenantId, code: "CUSTOMER" },
    select: { id: true }
  })
  assert.ok(accountType?.id)

  const account = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "Closed Billing Alias Account"
    },
    select: { id: true }
  })

  await prisma.contact.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: account.id,
      accountTypeId: accountType.id,
      contactType: "Customer",
      firstName: "Jamie",
      lastName: "Harper",
      fullName: "Jamie Harper",
      emailAddress: "jamie.harper@example.com",
      createdById: ctx.userId,
      updatedById: ctx.userId
    }
  })

  const response = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      entityType: "opportunities",
      mapping: {
        "Account Name": "accountName",
        "Opportunity Name": "name",
        Role: "roleName",
        "Role Contact Email": "roleContactEmail",
        Stage: "stage"
      },
      rows: [
        {
          "Account Name": "Closed Billing Alias Account",
          "Opportunity Name": "Billing Ended Alias Opportunity",
          Role: "Decision Maker",
          "Role Contact Email": "jamie.harper@example.com",
          Stage: "Closed Billing Ended"
        },
        {
          "Account Name": "Closed Billing Alias Account",
          "Opportunity Name": "Billing Alias Opportunity",
          Role: "Decision Maker",
          "Role Contact Email": "jamie.harper@example.com",
          Stage: "Closed Billing and Commissioning"
        }
      ]
    })
  )

  assertStatus(response, 200)
  const payload = await readJson<{ data?: { successRows: number; errorRows: number } }>(response)
  assert.equal(payload.data?.successRows, 2)
  assert.equal(payload.data?.errorRows, 0)

  const opportunities = await prisma.opportunity.findMany({
    where: { tenantId: ctx.tenantId, accountId: account.id },
    orderBy: { name: "asc" },
    select: { name: true, stage: true }
  })

  assert.equal(opportunities.length, 2)
  assert.deepEqual(
    opportunities.map(opportunity => ({ name: opportunity.name, stage: opportunity.stage })),
    [
      { name: "Billing Alias Opportunity", stage: "ClosedWon_Billing" },
      { name: "Billing Ended Alias Opportunity", stage: "ClosedWon_BillingEnded" }
    ]
  )
})

integrationTest("ADMIN-IMPORT-OPP-07: validate-only uses import validation without writing opportunity rows", async ctx => {
  const routeModule = await import("../app/api/admin/data-settings/imports/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const accountType = await prisma.accountType.findFirst({
    where: { tenantId: ctx.tenantId, code: "CUSTOMER" },
    select: { id: true }
  })
  assert.ok(accountType?.id)

  const account = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "Validate Only Opportunity Account"
    },
    select: { id: true }
  })

  await prisma.contact.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: account.id,
      accountTypeId: accountType.id,
      contactType: "Customer",
      firstName: "Dana",
      lastName: "Fields",
      fullName: "Dana Fields",
      emailAddress: "dana.fields@example.com",
      createdById: ctx.userId,
      updatedById: ctx.userId
    }
  })

  const response = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      entityType: "opportunities",
      validateOnly: true,
      mapping: {
        "Account Name": "accountName",
        "Opportunity Name": "name",
        Role: "roleName",
        "Role Contact Email": "roleContactEmail",
        Stage: "stage"
      },
      rows: [
        {
          "Account Name": "Validate Only Opportunity Account",
          "Opportunity Name": "Validate Only Opportunity",
          Role: "Decision Maker",
          "Role Contact Email": "dana.fields@example.com",
          Stage: "Proposal"
        }
      ]
    })
  )

  assertStatus(response, 200)
  const payload = await readJson<{
    data?: { mode?: string; successRows: number; errorRows: number; importJobId?: string }
  }>(response)
  assert.equal(payload.data?.mode, "validate-only")
  assert.equal(payload.data?.successRows, 1)
  assert.equal(payload.data?.errorRows, 0)
  assert.equal(payload.data?.importJobId, undefined)

  const opportunity = await prisma.opportunity.findFirst({
    where: { tenantId: ctx.tenantId, name: "Validate Only Opportunity" },
    select: { id: true }
  })
  assert.equal(opportunity, null)

  const importJobCount = await prisma.importJob.count({
    where: { tenantId: ctx.tenantId }
  })
  assert.equal(importJobCount, 0)
})

integrationTest("ADMIN-IMPORT-OPP-08: validation errors call out the mapped blocking column", async ctx => {
  const routeModule = await import("../app/api/admin/data-settings/imports/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const accountType = await prisma.accountType.findFirst({
    where: { tenantId: ctx.tenantId, code: "CUSTOMER" },
    select: { id: true }
  })
  assert.ok(accountType?.id)

  const account = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "Field Context Account"
    },
    select: { id: true }
  })

  await prisma.contact.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: account.id,
      accountTypeId: accountType.id,
      contactType: "Customer",
      firstName: "Morgan",
      lastName: "Reed",
      fullName: "Morgan Reed",
      emailAddress: "morgan.reed@example.com",
      createdById: ctx.userId,
      updatedById: ctx.userId
    }
  })

  const response = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      entityType: "opportunities",
      mapping: {
        "Customer Account": "accountName",
        "Deal Name": "name",
        "Primary Role": "roleName",
        "Primary Contact": "roleContactEmail",
        "Legacy Close Stage": "stage"
      },
      rows: [
        {
          "Customer Account": "Field Context Account",
          "Deal Name": "Field Context Opportunity",
          "Primary Role": "Decision Maker",
          "Primary Contact": "morgan.reed@example.com",
          "Legacy Close Stage": "Not A Real Stage"
        }
      ]
    })
  )

  assertStatus(response, 200)
  const payload = await readJson<{
    data?: { errorRows: number; errors: Array<{ field: string; message: string }> }
  }>(response)
  assert.equal(payload.data?.errorRows, 1)
  assert.equal(payload.data?.errors?.[0]?.field, "stage")
  assert.match(payload.data?.errors?.[0]?.message ?? "", /Legacy Close Stage/i)
  assert.match(payload.data?.errors?.[0]?.message ?? "", /Accepted values/i)
})
