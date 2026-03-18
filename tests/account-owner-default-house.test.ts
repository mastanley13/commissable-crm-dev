import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function makeCreateAccountRequest(params: { sessionToken: string; payload: unknown }) {
  return new NextRequest("http://localhost/api/accounts", {
    method: "POST",
    headers: {
      cookie: `session-token=${params.sessionToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.payload),
  })
}

async function ensureAccountsManagePermission(prisma: any, tenantId: string, roleId: string) {
  const accountsManagePerm = await prisma.permission.upsert({
    where: { code: "accounts.manage" },
    update: {},
    create: { code: "accounts.manage", name: "Accounts Manage", category: "Accounts" },
    select: { id: true },
  })

  await prisma.rolePermission
    .create({
      data: { tenantId, roleId, permissionId: accountsManagePerm.id },
    })
    .catch(() => null)
}

integrationTest("RB-ACC-002: House accounts default owner to an active ADMIN user", async ctx => {
  const routeModule = await import("../app/api/accounts/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma
  assert.ok(prisma, "Expected prisma export from lib/db")

  await ensureAccountsManagePermission(prisma, ctx.tenantId, ctx.roleId)

  const houseType = await prisma.accountType.create({
    data: { tenantId: ctx.tenantId, code: "HOUSE_REP", name: "House" },
    select: { id: true },
  })

  const newerAdmin = await prisma.user.create({
    data: {
      tenantId: ctx.tenantId,
      roleId: ctx.roleId,
      email: `newer-admin-${Date.now()}@example.com`,
      firstName: "Newer",
      lastName: "Admin",
      fullName: "Newer Admin",
      status: "Active",
    },
    select: { id: true },
  })

  const request = makeCreateAccountRequest({
    sessionToken: ctx.sessionToken,
    payload: { accountName: "House Account A", accountTypeId: houseType.id },
  })

  const response = await POST(request)
  assertStatus(response, 201)
  const body = await readJson<{ data?: { accountOwnerId?: string | null } }>(response)
  assert.equal(body.data?.accountOwnerId, ctx.userId)

  const explicitRequest = makeCreateAccountRequest({
    sessionToken: ctx.sessionToken,
    payload: { accountName: "House Account B", accountTypeId: houseType.id, ownerId: newerAdmin.id },
  })

  const explicitResponse = await POST(explicitRequest)
  assertStatus(explicitResponse, 201)
  const explicitBody = await readJson<{ data?: { accountOwnerId?: string | null } }>(explicitResponse)
  assert.equal(explicitBody.data?.accountOwnerId, newerAdmin.id)

  const customerType = await prisma.accountType.create({
    data: { tenantId: ctx.tenantId, code: "CUSTOMER2", name: "Customer2" },
    select: { id: true },
  })

  const nonHouseRequest = makeCreateAccountRequest({
    sessionToken: ctx.sessionToken,
    payload: { accountName: "Customer Account", accountTypeId: customerType.id },
  })

  const nonHouseResponse = await POST(nonHouseRequest)
  assertStatus(nonHouseResponse, 201)
  const nonHouseBody = await readJson<{ data?: { accountOwnerId?: string | null } }>(nonHouseResponse)
  assert.equal(nonHouseBody.data?.accountOwnerId ?? null, null)
})

integrationTest("ACC-CREATE-ROLLBACK: duplicate account creation does not leave parent accounts or addresses behind", async ctx => {
  const routeModule = await import("../app/api/accounts/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma
  assert.ok(prisma, "Expected prisma export from lib/db")

  await ensureAccountsManagePermission(prisma, ctx.tenantId, ctx.roleId)

  const customerType = await prisma.accountType.create({
    data: { tenantId: ctx.tenantId, code: "ROLLBACK_TEST", name: "Rollback Test" },
    select: { id: true },
  })

  await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: customerType.id,
      accountName: "Duplicate Account",
    },
  })

  const addressCountBefore = await prisma.address.count({ where: { tenantId: ctx.tenantId } })

  const response = await POST(
    makeCreateAccountRequest({
      sessionToken: ctx.sessionToken,
      payload: {
        accountName: "Duplicate Account",
        accountTypeId: customerType.id,
        newParentAccountName: "Transient Parent Account",
        billingSameAsShipping: false,
        shippingAddress: {
          line1: "100 Main St",
          city: "Austin",
          state: "TX",
          postalCode: "78701",
          country: "United States",
        },
        billingAddress: {
          line1: "200 Billing St",
          city: "Austin",
          state: "TX",
          postalCode: "78702",
          country: "United States",
        },
      },
    }),
  )

  assertStatus(response, 409)
  const body = await readJson<{ error?: string }>(response)
  assert.equal(body.error, "An account with this name already exists.")

  const addressCountAfter = await prisma.address.count({ where: { tenantId: ctx.tenantId } })
  assert.equal(addressCountAfter, addressCountBefore)

  const transientParent = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, accountName: "Transient Parent Account" },
    select: { id: true },
  })
  assert.equal(transientParent, null)
})
