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
      entityType: "contacts",
      upsertExisting: params.upsertExisting ?? true,
      mapping: params.mapping,
      rows: params.rows
    })
  })
}

integrationTest("ADMIN-IMPORT-CONTACT-01: contact import normalizes phone extension digits", async ctx => {
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
      accountName: "Import Contact Account"
    }
  })

  const response = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      mapping: {
        "Account Name": "accountName",
        "First Name": "firstName",
        "Last Name": "lastName",
        "Work Phone Extension": "workPhoneExt",
        "Preferred Contact Method": "preferredContactMethod"
      },
      rows: [
        {
          "Account Name": "Import Contact Account",
          "First Name": "Taylor",
          "Last Name": "North",
          "Work Phone Extension": " ext. 0042 ",
          "Preferred Contact Method": "Email"
        }
      ]
    })
  )

  assertStatus(response, 200)
  const payload = await readJson<{ data?: { successRows: number; errorRows: number } }>(response)
  assert.equal(payload.data?.successRows, 1)
  assert.equal(payload.data?.errorRows, 0)

  const contact = await prisma.contact.findFirst({
    where: {
      tenantId: ctx.tenantId,
      firstName: "Taylor",
      lastName: "North"
    },
    select: {
      workPhoneExt: true,
      preferredContactMethod: true
    }
  })

  assert.equal(contact?.workPhoneExt, "0042")
  assert.equal(contact?.preferredContactMethod, "Email")
})

integrationTest("ADMIN-IMPORT-CONTACT-02: contact import rejects non-assignable account types", async ctx => {
  const routeModule = await import("../app/api/admin/data-settings/imports/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const blockedType = await prisma.accountType.create({
    data: {
      tenantId: ctx.tenantId,
      code: "BLOCKED_CONTACTS",
      name: "Blocked Contacts",
      isAssignableToContacts: false
    },
    select: { id: true }
  })

  await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: blockedType.id,
      accountName: "Blocked Contact Account"
    }
  })

  const response = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      mapping: {
        "Account Name": "accountName",
        "First Name": "firstName",
        "Last Name": "lastName"
      },
      rows: [
        {
          "Account Name": "Blocked Contact Account",
          "First Name": "Riley",
          "Last Name": "Stone"
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
  assert.equal(payload.data?.errors?.[0]?.field, "accountName")
  assert.match(payload.data?.errors?.[0]?.message ?? "", /cannot be assigned to contacts/i)
})

integrationTest("ADMIN-IMPORT-CONTACT-03: contact import persists and upserts by Contact ID", async ctx => {
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
      accountName: "Contact ID Import Account"
    }
  })

  const mapping = {
    "Contact ID": "salesforceId",
    "Account Name": "accountName",
    "First Name": "firstName",
    "Last Name": "lastName",
    "Email": "emailAddress"
  }

  const firstResponse = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      mapping,
      rows: [
        {
          "Contact ID": "003ABCDEF123456AAA",
          "Account Name": "Contact ID Import Account",
          "First Name": "Jordan",
          "Last Name": "Original",
          "Email": "jordan.original@example.com"
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
          "Contact ID": "003ABCDEF123456AAA",
          "Account Name": "Contact ID Import Account",
          "First Name": "Jordan",
          "Last Name": "Renamed",
          "Email": "jordan.renamed@example.com"
        }
      ]
    })
  )
  assertStatus(secondResponse, 200)
  const payload = await readJson<{ data?: { successRows: number; errorRows: number } }>(secondResponse)
  assert.equal(payload.data?.successRows, 1)
  assert.equal(payload.data?.errorRows, 0)

  const contacts = await prisma.contact.findMany({
    where: { tenantId: ctx.tenantId, salesforceId: "003ABCDEF123456AAA" },
    select: { firstName: true, lastName: true, emailAddress: true, salesforceId: true }
  })

  assert.equal(contacts.length, 1)
  assert.equal(contacts[0]?.firstName, "Jordan")
  assert.equal(contacts[0]?.lastName, "Renamed")
  assert.equal(contacts[0]?.emailAddress, "jordan.renamed@example.com")
  assert.equal(contacts[0]?.salesforceId, "003ABCDEF123456AAA")
})

integrationTest("ADMIN-IMPORT-CONTACT-04: contact import rejects invalid Contact IDs", async ctx => {
  const routeModule = await import("../app/api/admin/data-settings/imports/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const response = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      mapping: {
        "Contact ID": "salesforceId",
        "Account Name": "accountName",
        "First Name": "firstName",
        "Last Name": "lastName"
      },
      rows: [
        {
          "Contact ID": "not-a-salesforce-id",
          "Account Name": "Invalid Contact ID Account",
          "First Name": "Casey",
          "Last Name": "Invalid"
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
  assert.equal(payload.data?.errors?.[0]?.field, "salesforceId")
  assert.match(payload.data?.errors?.[0]?.message ?? "", /Contact ID/)
})
