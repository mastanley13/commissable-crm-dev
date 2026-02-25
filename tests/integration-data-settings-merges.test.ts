import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function authedPost(sessionToken: string, url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      cookie: `session-token=${sessionToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

integrationTest("DATA-MERGE-01: account merge moves related records and soft-merges source", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const accountType = await prisma.accountType.findFirst({ where: { tenantId: ctx.tenantId }, select: { id: true } })
  assert.ok(accountType)

  const target = await prisma.account.create({
    data: { tenantId: ctx.tenantId, accountTypeId: accountType.id, accountName: "Merge Target Account" },
    select: { id: true },
  })
  const source = await prisma.account.create({
    data: { tenantId: ctx.tenantId, accountTypeId: accountType.id, accountName: "Merge Source Account" },
    select: { id: true },
  })

  const contact = await prisma.contact.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: source.id,
      firstName: "Source",
      lastName: "Contact",
      fullName: "Source Contact",
    },
    select: { id: true },
  })

  const previewModule = await import("../app/api/admin/data-settings/merges/preview/route")
  const executeModule = await import("../app/api/admin/data-settings/merges/execute/route")
  const PREVIEW = (previewModule as any).POST
  const EXECUTE = (executeModule as any).POST
  assert.equal(typeof PREVIEW, "function")
  assert.equal(typeof EXECUTE, "function")

  const previewRes = await PREVIEW(
    authedPost(ctx.sessionToken, "http://localhost/api/admin/data-settings/merges/preview", {
      entity: "Account",
      targetId: target.id,
      sourceId: source.id,
    }),
  )
  assertStatus(previewRes, 200)
  const previewPayload = await readJson<{ data: any }>(previewRes)
  assert.equal(previewPayload.data.entity, "Account")

  const executeRes = await EXECUTE(
    authedPost(ctx.sessionToken, "http://localhost/api/admin/data-settings/merges/execute", {
      entity: "Account",
      targetId: target.id,
      sourceId: source.id,
      fieldWinners: {},
      dryRun: false,
    }),
  )
  assertStatus(executeRes, 200)
  const executePayload = await readJson<{ data: any }>(executeRes)
  assert.equal(executePayload.data.ok, true)
  assert.ok(typeof executePayload.data.auditLogId === "string" && executePayload.data.auditLogId.length > 0)

  const movedContact = await prisma.contact.findFirst({
    where: { tenantId: ctx.tenantId, id: contact.id },
    select: { accountId: true },
  })
  assert.equal(movedContact?.accountId, target.id)

  const sourceAfter = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, id: source.id },
    select: { mergedIntoAccountId: true, status: true },
  })
  assert.equal(sourceAfter?.mergedIntoAccountId, target.id)
  assert.equal(sourceAfter?.status, "Archived")
})

integrationTest("DATA-MERGE-02: account merge blocks when reconciliations collide on month", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const accountType = await prisma.accountType.findFirst({ where: { tenantId: ctx.tenantId }, select: { id: true } })
  assert.ok(accountType)

  const target = await prisma.account.create({
    data: { tenantId: ctx.tenantId, accountTypeId: accountType.id, accountName: "Recon Target Account" },
    select: { id: true },
  })
  const source = await prisma.account.create({
    data: { tenantId: ctx.tenantId, accountTypeId: accountType.id, accountName: "Recon Source Account" },
    select: { id: true },
  })

  const month = new Date("2026-01-01T00:00:00Z")
  await prisma.reconciliation.create({ data: { tenantId: ctx.tenantId, accountId: target.id, month } })
  await prisma.reconciliation.create({ data: { tenantId: ctx.tenantId, accountId: source.id, month } })

  const executeModule = await import("../app/api/admin/data-settings/merges/execute/route")
  const EXECUTE = (executeModule as any).POST
  assert.equal(typeof EXECUTE, "function")

  const res = await EXECUTE(
    authedPost(ctx.sessionToken, "http://localhost/api/admin/data-settings/merges/execute", {
      entity: "Account",
      targetId: target.id,
      sourceId: source.id,
      fieldWinners: {},
      dryRun: false,
    }),
  )
  assertStatus(res, 400)
  const payload = await readJson<{ error?: string }>(res)
  assert.ok((payload.error ?? "").toLowerCase().includes("merge blocked"))
})

integrationTest("DATA-MERGE-03: contact merge moves related records and resolves preference duplicates", async ctx => {
  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const accountType = await prisma.accountType.findFirst({ where: { tenantId: ctx.tenantId }, select: { id: true } })
  assert.ok(accountType)

  const account = await prisma.account.create({
    data: { tenantId: ctx.tenantId, accountTypeId: accountType.id, accountName: "Contact Merge Account" },
    select: { id: true },
  })

  const target = await prisma.contact.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: account.id,
      firstName: "Target",
      lastName: "Contact",
      fullName: "Target Contact",
      emailAddress: "target@example.com",
    },
    select: { id: true },
  })

  const source = await prisma.contact.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: account.id,
      firstName: "Source",
      lastName: "Contact",
      fullName: "Source Contact",
      emailAddress: "source@example.com",
    },
    select: { id: true },
  })

  const activity = await prisma.activity.create({
    data: {
      tenantId: ctx.tenantId,
      creatorId: ctx.userId,
      activityType: "Call",
      subject: "Test Activity",
      contactId: source.id,
    },
    select: { id: true },
  })

  await prisma.contactPreference.create({
    data: { tenantId: ctx.tenantId, contactId: target.id, channel: "Email", enabled: true },
  })
  await prisma.contactPreference.create({
    data: { tenantId: ctx.tenantId, contactId: source.id, channel: "Email", enabled: false, notes: "from source" },
  })

  const executeModule = await import("../app/api/admin/data-settings/merges/execute/route")
  const EXECUTE = (executeModule as any).POST
  assert.equal(typeof EXECUTE, "function")

  const res = await EXECUTE(
    authedPost(ctx.sessionToken, "http://localhost/api/admin/data-settings/merges/execute", {
      entity: "Contact",
      targetId: target.id,
      sourceId: source.id,
      fieldWinners: {},
      dryRun: false,
    }),
  )
  assertStatus(res, 200)

  const movedActivity = await prisma.activity.findFirst({
    where: { tenantId: ctx.tenantId, id: activity.id },
    select: { contactId: true },
  })
  assert.equal(movedActivity?.contactId, target.id)

  const sourceAfter = await prisma.contact.findFirst({
    where: { tenantId: ctx.tenantId, id: source.id },
    select: { mergedIntoContactId: true },
  })
  assert.equal(sourceAfter?.mergedIntoContactId, target.id)

  const sourcePrefs = await prisma.contactPreference.count({
    where: { tenantId: ctx.tenantId, contactId: source.id },
  })
  assert.equal(sourcePrefs, 0)

  const targetPref = await prisma.contactPreference.findFirst({
    where: { tenantId: ctx.tenantId, contactId: target.id, channel: "Email" },
    select: { enabled: true, notes: true },
  })
  assert.ok(targetPref)
  assert.equal(targetPref.enabled, true)
  assert.equal(targetPref.notes, "from source")

  const contactsModule = await import("../app/api/contacts/route")
  const GET_CONTACTS = (contactsModule as any).GET
  assert.equal(typeof GET_CONTACTS, "function")

  const listRes = await GET_CONTACTS(
    new NextRequest("http://localhost/api/contacts?q=Contact&page=1&pageSize=25", {
      method: "GET",
      headers: { cookie: `session-token=${ctx.sessionToken}` },
    }),
  )
  assertStatus(listRes, 200)
  const listPayload = await readJson<{ data?: any[] }>(listRes)
  const ids = (listPayload.data ?? []).map(row => row.id)
  assert.ok(ids.includes(target.id))
  assert.ok(!ids.includes(source.id))
})

