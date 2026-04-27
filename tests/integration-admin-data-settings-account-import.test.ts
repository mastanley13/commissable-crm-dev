import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function makeImportRequest(params: {
  sessionToken: string
  mapping: Record<string, string>
  rows: Array<Record<string, unknown>>
  upsertExisting?: boolean
}) {
  return new NextRequest("http://localhost/api/admin/data-settings/imports", {
    method: "POST",
    headers: {
      cookie: `session-token=${params.sessionToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      entityType: "accounts",
      upsertExisting: params.upsertExisting ?? true,
      mapping: params.mapping,
      rows: params.rows
    })
  })
}

integrationTest(
  "ADMIN-IMPORT-ACCT-01: account import persists account number and synced shipping address",
  async ctx => {
    const routeModule = await import("../app/api/admin/data-settings/imports/route")
    const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
    assert.equal(typeof POST, "function")

    const dbModule = await import("../lib/db")
    const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

    await prisma.accountType.findFirst({
      where: { tenantId: ctx.tenantId, code: "CUSTOMER" },
      select: { id: true }
    })

    const response = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        mapping: {
          "Account Name": "accountName",
          "Account Number": "accountNumber",
          "Account Type": "accountTypeName",
          "Billing Same As Shipping": "billingSameAsShipping",
          "Shipping Street": "shippingStreet",
          "Shipping City": "shippingCity",
          "Shipping State": "shippingState",
          "Shipping Zip": "shippingZip",
          "Shipping Country": "shippingCountry"
        },
        rows: [
          {
            "Account Name": "Imported Address Account",
            "Account Number": "ACCT-1001",
            "Account Type": "Customer",
            "Billing Same As Shipping": "true",
            "Shipping Street": "100 Main St",
            "Shipping City": "Albany",
            "Shipping State": "NY",
            "Shipping Zip": "12207",
            "Shipping Country": "USA"
          }
        ]
      })
    )

    assertStatus(response, 200)
    const payload = await readJson<{ data?: { successRows: number; errorRows: number } }>(response)
    assert.equal(payload.data?.successRows, 1)
    assert.equal(payload.data?.errorRows, 0)

    const account = await prisma.account.findFirst({
      where: { tenantId: ctx.tenantId, accountName: "Imported Address Account" },
      select: {
        accountNumber: true,
        shippingSyncBilling: true,
        shippingAddressId: true,
        billingAddressId: true,
        shippingAddress: {
          select: {
            line1: true,
            city: true,
            state: true,
            postalCode: true,
            country: true
          }
        }
      }
    })

    assert.equal(account?.accountNumber, "ACCT-1001")
    assert.equal(account?.shippingSyncBilling, true)
    assert.ok(account?.shippingAddressId)
    assert.equal(account?.billingAddressId, account?.shippingAddressId)
    assert.equal(account?.shippingAddress?.line1, "100 Main St")
    assert.equal(account?.shippingAddress?.city, "Albany")
    assert.equal(account?.shippingAddress?.state, "NY")
    assert.equal(account?.shippingAddress?.postalCode, "12207")
    assert.equal(account?.shippingAddress?.country, "USA")
  }
)

integrationTest(
  "ADMIN-IMPORT-ACCT-02: account import persists Salesforce ID separately from account number",
  async ctx => {
    const routeModule = await import("../app/api/admin/data-settings/imports/route")
    const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
    assert.equal(typeof POST, "function")

    const dbModule = await import("../lib/db")
    const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

    const response = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        mapping: {
          "Account Name": "accountName",
          "Account Number": "accountNumber",
          "Salesforce ID": "salesforceId",
          "Account Type": "accountTypeName"
        },
        rows: [
          {
            "Account Name": "Imported Salesforce Account",
            "Account Number": "ACCT-SF-1001",
            "Salesforce ID": "001ABCDEF123456AAA",
            "Account Type": "Customer"
          }
        ]
      })
    )

    assertStatus(response, 200)
    const payload = await readJson<{ data?: { successRows: number; errorRows: number } }>(response)
    assert.equal(payload.data?.successRows, 1)
    assert.equal(payload.data?.errorRows, 0)

    const account = await prisma.account.findFirst({
      where: { tenantId: ctx.tenantId, accountName: "Imported Salesforce Account" },
      select: {
        accountNumber: true,
        salesforceId: true
      }
    })

    assert.equal(account?.accountNumber, "ACCT-SF-1001")
    assert.equal(account?.salesforceId, "001ABCDEF123456AAA")
  }
)

integrationTest(
  "ADMIN-IMPORT-ACCT-03: account import upserts by Salesforce ID when account name changes",
  async ctx => {
    const routeModule = await import("../app/api/admin/data-settings/imports/route")
    const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
    assert.equal(typeof POST, "function")

    const dbModule = await import("../lib/db")
    const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

    const mapping = {
      "Account Name": "accountName",
      "Salesforce ID": "salesforceId",
      "Account Type": "accountTypeName"
    }

    const firstResponse = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        mapping,
        rows: [
          {
            "Account Name": "Salesforce Original Name",
            "Salesforce ID": "001ZZZYYY123456AAA",
            "Account Type": "Customer"
          }
        ]
      })
    )
    assertStatus(firstResponse, 200)

    const secondResponse = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        mapping,
        rows: [
          {
            "Account Name": "Salesforce Renamed Account",
            "Salesforce ID": "001ZZZYYY123456AAA",
            "Account Type": "Customer"
          }
        ]
      })
    )
    assertStatus(secondResponse, 200)

    const payload = await readJson<{ data?: { successRows: number; errorRows: number } }>(secondResponse)
    assert.equal(payload.data?.successRows, 1)
    assert.equal(payload.data?.errorRows, 0)

    const accounts = await prisma.account.findMany({
      where: { tenantId: ctx.tenantId, salesforceId: "001ZZZYYY123456AAA" },
      select: { accountName: true }
    })

    assert.equal(accounts.length, 1)
    assert.equal(accounts[0]?.accountName, "Salesforce Renamed Account")
  }
)

integrationTest(
  "ADMIN-IMPORT-ACCT-04: account import rejects invalid Salesforce IDs",
  async ctx => {
    const routeModule = await import("../app/api/admin/data-settings/imports/route")
    const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
    assert.equal(typeof POST, "function")

    const response = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        mapping: {
          "Account Name": "accountName",
          "Salesforce ID": "salesforceId",
          "Account Type": "accountTypeName"
        },
        rows: [
          {
            "Account Name": "Invalid Salesforce Account",
            "Salesforce ID": "not-a-salesforce-id",
            "Account Type": "Customer"
          }
        ]
      })
    )

    assertStatus(response, 200)
    const payload = await readJson<{
      data?: { successRows: number; errorRows: number; errors: Array<{ field: string; message: string }> }
    }>(response)
    assert.equal(payload.data?.successRows, 0)
    assert.equal(payload.data?.errorRows, 1)
    assert.equal(payload.data?.errors[0]?.field, "salesforceId")
    assert.match(payload.data?.errors[0]?.message ?? "", /Salesforce ID/)
  }
)
