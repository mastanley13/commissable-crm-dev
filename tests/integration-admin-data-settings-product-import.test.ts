import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"
import { NONE_DIRECT_DISTRIBUTOR_NAME } from "../lib/none-direct-distributor"

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
      entityType: "products",
      upsertExisting: params.upsertExisting ?? true,
      mapping: params.mapping,
      rows: params.rows
    })
  })
}

integrationTest("ADMIN-IMPORT-PROD-01: product import applies None-Direct distributor fallback", async ctx => {
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
      accountName: "Import Product Vendor"
    }
  })

  const response = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      mapping: {
        "Product Code": "productCode",
        "Product Name (House)": "productNameHouse",
        "Revenue Type": "revenueType",
        "Vendor Account Name": "vendorAccountName",
      },
      rows: [
        {
          "Product Code": "PROD-IMPORT-001",
          "Product Name (House)": "Imported Product",
          "Revenue Type": "MRC_House",
          "Vendor Account Name": "Import Product Vendor",
        }
      ]
    })
  )

  assertStatus(response, 200)
  const payload = await readJson<{ data?: { successRows: number; errorRows: number } }>(response)
  assert.equal(payload.data?.successRows, 1)
  assert.equal(payload.data?.errorRows, 0)

  const product = await prisma.product.findFirst({
    where: { tenantId: ctx.tenantId, productCode: "PROD-IMPORT-001" },
    select: {
      vendor: { select: { accountName: true } },
      distributor: { select: { accountName: true } }
    }
  })

  assert.equal(product?.vendor?.accountName, "Import Product Vendor")
  assert.equal(product?.distributor?.accountName, NONE_DIRECT_DISTRIBUTOR_NAME)
})

integrationTest("ADMIN-IMPORT-PROD-02: product import validates active family and subtype pairing", async ctx => {
  const routeModule = await import("../app/api/admin/data-settings/imports/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const familyA = await prisma.productFamily.create({
    data: {
      tenantId: ctx.tenantId,
      code: "FAMILY_A",
      name: "Family A",
      isActive: true
    },
    select: { id: true }
  })

  await prisma.productFamily.create({
    data: {
      tenantId: ctx.tenantId,
      code: "FAMILY_B",
      name: "Family B",
      isActive: true
    }
  })

  await prisma.productSubtype.create({
    data: {
      tenantId: ctx.tenantId,
      code: "SUB_A1",
      name: "Subtype A1",
      productFamilyId: familyA.id,
      isActive: true
    }
  })

  const response = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      mapping: {
        "Product Code": "productCode",
        "Product Name (House)": "productNameHouse",
        "Revenue Type": "revenueType",
        "Product Family (House)": "productFamilyHouse",
        "Product Subtype (House)": "productSubtypeHouse",
      },
      rows: [
        {
          "Product Code": "PROD-IMPORT-002",
          "Product Name (House)": "Invalid Family Pair Product",
          "Revenue Type": "MRC_House",
          "Product Family (House)": "Family B",
          "Product Subtype (House)": "Subtype A1",
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
  assert.equal(payload.data?.errors?.[0]?.field, "productSubtypeHouse")
  assert.match(payload.data?.errors?.[0]?.message ?? "", /does not belong/i)
})

integrationTest("ADMIN-IMPORT-PROD-03: product import persists extended catalog metadata", async ctx => {
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
      accountName: "Extended Product Vendor"
    }
  })

  await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "Extended Product Distributor"
    }
  })

  const family = await prisma.productFamily.create({
    data: {
      tenantId: ctx.tenantId,
      code: "DIST_FAMILY",
      name: "Distributor Family",
      isActive: true
    },
    select: { id: true }
  })

  await prisma.productSubtype.create({
    data: {
      tenantId: ctx.tenantId,
      code: "DIST_SUBTYPE",
      name: "Distributor Subtype",
      productFamilyId: family.id,
      isActive: true
    }
  })

  const response = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      mapping: {
        "Product Code": "productCode",
        "Product Name (House)": "productNameHouse",
        "Revenue Type": "revenueType",
        "Product Name (Vendor)": "productNameVendor",
        "Product Name (Distributor)": "productNameDistributor",
        "Vendor Description": "productDescriptionVendor",
        "Part Number (House)": "partNumberHouse",
        "Part Number (Vendor)": "partNumberVendor",
        "Vendor Account Name": "vendorAccountName",
        "Distributor Account Name": "distributorAccountName",
        "Product Family (Distributor)": "distributorProductFamily",
        "Product Subtype (Distributor)": "distributorProductSubtype"
      },
      rows: [
        {
          "Product Code": "PROD-IMPORT-003",
          "Product Name (House)": "Expanded Product",
          "Revenue Type": "MRC_House",
          "Product Name (Vendor)": "Vendor Name A / Vendor Name B",
          "Product Name (Distributor)": "Distributor Catalog Name",
          "Vendor Description": "Imported vendor-facing description",
          "Part Number (House)": "HOUSE-PART-01",
          "Part Number (Vendor)": "VEN-PART-1 / VEN-PART-2",
          "Vendor Account Name": "Extended Product Vendor",
          "Distributor Account Name": "Extended Product Distributor",
          "Product Family (Distributor)": "Distributor Family",
          "Product Subtype (Distributor)": "Distributor Subtype"
        }
      ]
    })
  )

  assertStatus(response, 200)
  const payload = await readJson<{ data?: { successRows: number; errorRows: number } }>(response)
  assert.equal(payload.data?.successRows, 1)
  assert.equal(payload.data?.errorRows, 0)

  const product = await prisma.product.findFirst({
    where: { tenantId: ctx.tenantId, productCode: "PROD-IMPORT-003" },
    select: {
      productNameVendor: true,
      productNameDistributor: true,
      productDescriptionVendor: true,
      partNumberHouse: true,
      partNumberVendor: true,
      distributorProductFamily: true,
      distributorProductSubtype: true
    }
  })

  assert.equal(product?.productNameVendor, "Vendor Name A|Vendor Name B")
  assert.equal(product?.productNameDistributor, "Distributor Catalog Name")
  assert.equal(product?.productDescriptionVendor, "Imported vendor-facing description")
  assert.equal(product?.partNumberHouse, "HOUSE-PART-01")
  assert.equal(product?.partNumberVendor, "VEN-PART-1|VEN-PART-2")
  assert.equal(product?.distributorProductFamily, "Distributor Family")
  assert.equal(product?.distributorProductSubtype, "Distributor Subtype")
})
