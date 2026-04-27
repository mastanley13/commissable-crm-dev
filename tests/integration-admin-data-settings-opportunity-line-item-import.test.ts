import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { NONE_DIRECT_DISTRIBUTOR_NAME } from "../lib/none-direct-distributor"
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
      entityType: "opportunity-line-items",
      upsertExisting: params.upsertExisting ?? false,
      mapping: params.mapping,
      rows: params.rows
    })
  })
}

integrationTest(
  "ADMIN-IMPORT-OPP-LINE-01: line item import creates opportunity product and backfills None-Direct distributor",
  async ctx => {
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
        accountName: "Imported Line Item Account"
      },
      select: { id: true }
    })

    const opportunity = await prisma.opportunity.create({
      data: {
        tenantId: ctx.tenantId,
        accountId: account.id,
        name: "Imported Line Item Opportunity",
        ownerId: ctx.userId
      },
      select: { id: true }
    })

    await prisma.product.create({
      data: {
        tenantId: ctx.tenantId,
        productCode: "LINE-ITEM-001",
        productNameHouse: "Imported Line Item Product",
        productNameVendor: "Imported Vendor Product",
        revenueType: "Recurring",
        priceEach: 12.5,
        commissionPercent: 8,
        vendorAccountId: ctx.vendorAccountId,
        createdById: ctx.userId,
        updatedById: ctx.userId
      }
    })

    const response = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        mapping: {
          "Account Name": "accountName",
          "Opportunity Name": "opportunityName",
          "Product Code": "productCode",
          Quantity: "quantity",
          "Unit Price": "unitPrice",
          "Expected Usage": "expectedUsage",
          "Expected Commission": "expectedCommission",
          "SME %": "subjectMatterExpertPercent",
          Status: "status",
          "Revenue Start Date": "revenueStartDate",
          "Revenue End Date": "revenueEndDate"
        },
        rows: [
          {
            "Account Name": "Imported Line Item Account",
            "Opportunity Name": "Imported Line Item Opportunity",
            "Product Code": "LINE-ITEM-001",
            Quantity: "3",
            "Unit Price": "12.50",
            "Expected Usage": "30",
            "Expected Commission": "4.50",
            "SME %": "25",
            Status: "ActiveBilling",
            "Revenue Start Date": "2026-04-01",
            "Revenue End Date": "2026-06-30"
          }
        ]
      })
    )

    assertStatus(response, 200)
    const payload = await readJson<{
      data?: {
        successRows: number
        errorRows: number
      }
    }>(response)
    assert.equal(payload.data?.successRows, 1)
    assert.equal(payload.data?.errorRows, 0)

    const noneDirect = await prisma.account.findFirst({
      where: {
        tenantId: ctx.tenantId,
        accountName: NONE_DIRECT_DISTRIBUTOR_NAME
      },
      select: { id: true }
    })
    assert.ok(noneDirect?.id)

    const importedLineItem = await prisma.opportunityProduct.findFirst({
      where: { tenantId: ctx.tenantId, opportunityId: opportunity.id },
      select: {
        productCodeSnapshot: true,
        quantity: true,
        unitPrice: true,
        expectedUsage: true,
        expectedRevenue: true,
        expectedCommission: true,
        subjectMatterExpertPercent: true,
        status: true,
        distributorAccountIdSnapshot: true,
        vendorAccountIdSnapshot: true,
        distributorNameSnapshot: true,
        vendorNameSnapshot: true,
        revenueStartDate: true,
        revenueEndDate: true
      }
    })

    assert.equal(importedLineItem?.productCodeSnapshot, "LINE-ITEM-001")
    assert.equal(Number(importedLineItem?.quantity ?? 0), 3)
    assert.equal(Number(importedLineItem?.unitPrice ?? 0), 12.5)
    assert.equal(Number(importedLineItem?.expectedUsage ?? 0), 30)
    assert.equal(Number(importedLineItem?.expectedRevenue ?? 0), 37.5)
    assert.equal(Number(importedLineItem?.expectedCommission ?? 0), 4.5)
    assert.equal(Number(importedLineItem?.subjectMatterExpertPercent ?? 0), 25)
    assert.equal(importedLineItem?.status, "ActiveBilling")
    assert.equal(importedLineItem?.distributorAccountIdSnapshot, noneDirect.id)
    assert.equal(importedLineItem?.vendorAccountIdSnapshot, ctx.vendorAccountId)
    assert.equal(importedLineItem?.distributorNameSnapshot, NONE_DIRECT_DISTRIBUTOR_NAME)
    assert.equal(importedLineItem?.vendorNameSnapshot, "Test Vendor")
    assert.equal(importedLineItem?.revenueStartDate?.toISOString(), "2026-04-01T00:00:00.000Z")
    assert.equal(importedLineItem?.revenueEndDate?.toISOString(), "2026-06-30T00:00:00.000Z")

    const updatedProduct = await prisma.product.findFirst({
      where: { tenantId: ctx.tenantId, productCode: "LINE-ITEM-001" },
      select: { distributorAccountId: true }
    })
    assert.equal(updatedProduct?.distributorAccountId, noneDirect.id)
  }
)

integrationTest(
  "ADMIN-IMPORT-OPP-LINE-02: line item import rejects upsert mode",
  async ctx => {
    const routeModule = await import("../app/api/admin/data-settings/imports/route")
    const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
    assert.equal(typeof POST, "function")

    const response = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        upsertExisting: true,
        mapping: {
          "Account Name": "accountName",
          "Opportunity Name": "opportunityName",
          "Product Code": "productCode",
          Quantity: "quantity"
        },
        rows: [
          {
            "Account Name": "Any Account",
            "Opportunity Name": "Any Opportunity",
            "Product Code": "ANY-PRODUCT",
            Quantity: "1"
          }
        ]
      })
    )

    assertStatus(response, 400)
    const payload = await readJson<{ error?: string }>(response)
    assert.match(payload.error ?? "", /create-only/i)
  }
)

integrationTest(
  "ADMIN-IMPORT-OPP-LINE-03: line item import rejects vendor distributor mismatch on the same opportunity",
  async ctx => {
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
        accountName: "Mismatch Account"
      },
      select: { id: true }
    })

    await prisma.opportunity.create({
      data: {
        tenantId: ctx.tenantId,
        accountId: account.id,
        name: "Mismatch Opportunity",
        ownerId: ctx.userId
      }
    })

    await prisma.product.create({
      data: {
        tenantId: ctx.tenantId,
        productCode: "MATCH-PRODUCT-1",
        productNameHouse: "Match Product 1",
        revenueType: "Recurring",
        distributorAccountId: ctx.distributorAccountId,
        vendorAccountId: ctx.vendorAccountId
      }
    })

    const alternateDistributor = await prisma.account.create({
      data: {
        tenantId: ctx.tenantId,
        accountTypeId: accountType.id,
        accountName: "Alternate Distributor"
      },
      select: { id: true }
    })

    const alternateVendor = await prisma.account.create({
      data: {
        tenantId: ctx.tenantId,
        accountTypeId: accountType.id,
        accountName: "Alternate Vendor"
      },
      select: { id: true }
    })

    await prisma.product.create({
      data: {
        tenantId: ctx.tenantId,
        productCode: "MATCH-PRODUCT-2",
        productNameHouse: "Match Product 2",
        revenueType: "Recurring",
        distributorAccountId: alternateDistributor.id,
        vendorAccountId: alternateVendor.id
      }
    })

    const mapping = {
      "Account Name": "accountName",
      "Opportunity Name": "opportunityName",
      "Product Code": "productCode",
      Quantity: "quantity"
    }

    const firstResponse = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        mapping,
        rows: [
          {
            "Account Name": "Mismatch Account",
            "Opportunity Name": "Mismatch Opportunity",
            "Product Code": "MATCH-PRODUCT-1",
            Quantity: "1"
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
            "Account Name": "Mismatch Account",
            "Opportunity Name": "Mismatch Opportunity",
            "Product Code": "MATCH-PRODUCT-2",
            Quantity: "1"
          }
        ]
      })
    )

    assertStatus(secondResponse, 200)
    const payload = await readJson<{
      data?: {
        successRows: number
        errorRows: number
        errors?: Array<{ field: string; message: string }>
      }
    }>(secondResponse)

    assert.equal(payload.data?.successRows, 0)
    assert.equal(payload.data?.errorRows, 1)
    assert.equal(payload.data?.errors?.[0]?.field, "productCode")
    assert.match(payload.data?.errors?.[0]?.message ?? "", /more than one distributor\/vendor/i)
  }
)

integrationTest(
  "ADMIN-IMPORT-OPP-LINE-04: line item import validates quantity",
  async ctx => {
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
        accountName: "Quantity Validation Account"
      },
      select: { id: true }
    })

    await prisma.opportunity.create({
      data: {
        tenantId: ctx.tenantId,
        accountId: account.id,
        name: "Quantity Validation Opportunity",
        ownerId: ctx.userId
      }
    })

    await prisma.product.create({
      data: {
        tenantId: ctx.tenantId,
        productCode: "QUANTITY-PRODUCT",
        productNameHouse: "Quantity Product",
        revenueType: "Recurring",
        distributorAccountId: ctx.distributorAccountId,
        vendorAccountId: ctx.vendorAccountId
      }
    })

    const response = await POST(
      makeImportRequest({
        sessionToken: ctx.sessionToken,
        mapping: {
          "Account Name": "accountName",
          "Opportunity Name": "opportunityName",
          "Product Code": "productCode",
          Quantity: "quantity"
        },
        rows: [
          {
            "Account Name": "Quantity Validation Account",
            "Opportunity Name": "Quantity Validation Opportunity",
            "Product Code": "QUANTITY-PRODUCT",
            Quantity: "0"
          }
        ]
      })
    )

    assertStatus(response, 200)
    const payload = await readJson<{
      data?: {
        successRows: number
        errorRows: number
        errors?: Array<{ field: string; message: string }>
      }
    }>(response)

    assert.equal(payload.data?.successRows, 0)
    assert.equal(payload.data?.errorRows, 1)
    assert.equal(payload.data?.errors?.[0]?.field, "quantity")
    assert.match(payload.data?.errors?.[0]?.message ?? "", /positive number/i)
  }
)
