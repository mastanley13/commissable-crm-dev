import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function makeContactDetailRequest(params: { sessionToken: string; contactId: string }) {
  return new NextRequest(`http://localhost/api/contacts/${params.contactId}`, {
    method: "GET",
    headers: {
      cookie: `session-token=${params.sessionToken}`,
    },
  })
}

integrationTest("RB-CON-003: contact detail opportunities only include role-linked opportunities", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma
  assert.ok(prisma, "Expected prisma export from lib/db")

  const [contactsReadPermission, contactsManagePermission] = await Promise.all([
    prisma.permission.upsert({
      where: { code: "contacts.read" },
      update: {},
      create: { code: "contacts.read", name: "Contacts Read", category: "CRM" },
      select: { id: true },
    }),
    prisma.permission.upsert({
      where: { code: "contacts.manage" },
      update: {},
      create: { code: "contacts.manage", name: "Contacts Manage", category: "CRM" },
      select: { id: true },
    }),
  ])

  await prisma.rolePermission.createMany({
    data: [
      { tenantId: ctx.tenantId, roleId: ctx.roleId, permissionId: contactsReadPermission.id },
      { tenantId: ctx.tenantId, roleId: ctx.roleId, permissionId: contactsManagePermission.id },
    ],
    skipDuplicates: true,
  })

  const contact = await prisma.contact.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: ctx.distributorAccountId,
      firstName: "Jordan",
      lastName: "Cole",
      fullName: "Jordan Cole",
    },
    select: { id: true },
  })

  const [linkedOpportunity, unlinkedOpportunity] = await Promise.all([
    prisma.opportunity.create({
      data: {
        tenantId: ctx.tenantId,
        accountId: ctx.distributorAccountId,
        ownerId: ctx.userId,
        name: "Algave Cloud Migration",
      },
      select: { id: true },
    }),
    prisma.opportunity.create({
      data: {
        tenantId: ctx.tenantId,
        accountId: ctx.distributorAccountId,
        ownerId: ctx.userId,
        name: "Unrelated Opportunity",
      },
      select: { id: true },
    }),
  ])

  await prisma.opportunityRole.create({
    data: {
      tenantId: ctx.tenantId,
      opportunityId: linkedOpportunity.id,
      contactId: contact.id,
      role: "Decision Maker",
      fullName: "Jordan Cole",
      createdById: ctx.userId,
      updatedById: ctx.userId,
      active: true,
    },
    select: { id: true },
  })

  const routeModule = await import("../app/api/contacts/[id]/route")
  const GET = (routeModule as any).GET ?? (routeModule as any).default?.GET
  assert.equal(typeof GET, "function")

  const request = makeContactDetailRequest({ sessionToken: ctx.sessionToken, contactId: contact.id })
  const response = await GET(request, { params: { id: contact.id } })
  assertStatus(response, 200)
  const payload = await readJson<{ data?: { opportunities?: Array<{ id: string }> } }>(response)

  const opportunities = payload.data?.opportunities ?? []
  assert.equal(opportunities.length, 1)
  assert.equal(opportunities[0]?.id, linkedOpportunity.id)
  assert.notEqual(opportunities[0]?.id, unlinkedOpportunity.id)
})

