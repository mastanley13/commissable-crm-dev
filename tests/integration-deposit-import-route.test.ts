import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { integrationTest, readJson, assertStatus } from "./integration-test-helpers"

function makeCsvFile(contents: string, name = "upload.csv") {
  return new File([contents], name, { type: "text/csv" })
}

function makeImportRequest(params: {
  sessionToken: string
  distributorAccountId: string
  vendorAccountId: string
  file: File
  mapping: unknown
  paymentDate?: string
  depositName?: string
  idempotencyKey?: string
  commissionPeriod?: string
  reconciliationTemplateId?: string
  saveTemplateMapping?: boolean
}) {
  const form = new FormData()
  form.set("file", params.file)
  form.set("distributorAccountId", params.distributorAccountId)
  form.set("vendorAccountId", params.vendorAccountId)
  form.set("mapping", JSON.stringify(params.mapping))
  if (params.paymentDate) form.set("paymentDate", params.paymentDate)
  if (params.depositName) form.set("depositName", params.depositName)
  if (params.idempotencyKey) form.set("idempotencyKey", params.idempotencyKey)
  if (params.commissionPeriod) form.set("commissionPeriod", params.commissionPeriod)
  if (params.reconciliationTemplateId) form.set("reconciliationTemplateId", params.reconciliationTemplateId)
  if (params.saveTemplateMapping != null) form.set("saveTemplateMapping", String(params.saveTemplateMapping))

  return new NextRequest("http://localhost/api/reconciliation/deposits/import", {
    method: "POST",
    headers: {
      cookie: `session-token=${params.sessionToken}`,
    },
    body: form,
  })
}

integrationTest("DU-AUTO-10: required mappings enforced (must include usage or commission)", async ctx => {
  const routeModule = await import("../app/api/reconciliation/deposits/import/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const request = makeImportRequest({
    sessionToken: ctx.sessionToken,
    distributorAccountId: ctx.distributorAccountId,
    vendorAccountId: ctx.vendorAccountId,
    file: makeCsvFile("Vendor Name\nTest Vendor\n"),
    mapping: { vendorNameRaw: "Vendor Name" },
    paymentDate: "2026-01-01",
  })

  const response = await POST(request)
  assertStatus(response, 400)
  const payload = await readJson<{ error?: string }>(response)
  assert.match(payload.error ?? "", /missing mapping for required fields/i)
})

integrationTest("DU-AUTO-11: ambiguous/missing mapped column errors return 400", async ctx => {
  const routeModule = await import("../app/api/reconciliation/deposits/import/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const ambiguousRequest = makeImportRequest({
    sessionToken: ctx.sessionToken,
    distributorAccountId: ctx.distributorAccountId,
    vendorAccountId: ctx.vendorAccountId,
    file: makeCsvFile(["Usage, Usage ,Commission", "100,100,25"].join("\n")),
    mapping: { usage: "usage", commission: "Commission" },
    paymentDate: "2026-01-01",
  })

  const ambiguousResponse = await POST(ambiguousRequest)
  assertStatus(ambiguousResponse, 400)
  const ambiguousPayload = await readJson<{ error?: string }>(ambiguousResponse)
  assert.match(ambiguousPayload.error ?? "", /ambiguous/i)

  const missingRequest = makeImportRequest({
    sessionToken: ctx.sessionToken,
    distributorAccountId: ctx.distributorAccountId,
    vendorAccountId: ctx.vendorAccountId,
    file: makeCsvFile(["Commission", "25"].join("\n")),
    mapping: { commission: "Commission Amount" },
    paymentDate: "2026-01-01",
  })

  const missingResponse = await POST(missingRequest)
  assertStatus(missingResponse, 400)
  const missingPayload = await readJson<{ error?: string }>(missingResponse)
  assert.match(missingPayload.error ?? "", /not found/i)
})

integrationTest("DU-AUTO-12: commission-only rows derive usage and set commissionRate=1.0", async ctx => {
  const routeModule = await import("../app/api/reconciliation/deposits/import/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const request = makeImportRequest({
    sessionToken: ctx.sessionToken,
    distributorAccountId: ctx.distributorAccountId,
    vendorAccountId: ctx.vendorAccountId,
    file: makeCsvFile(["Commission", "50"].join("\n")),
    mapping: { commission: "Commission" },
    paymentDate: "2026-01-01",
  })

  const response = await POST(request)
  assertStatus(response, 200)
  const payload = await readJson<{ data?: { depositId?: string } }>(response)
  assert.ok(payload.data?.depositId)

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma
  const lines = await prisma.depositLineItem.findMany({
    where: { depositId: payload.data!.depositId, tenantId: ctx.tenantId },
    select: { usage: true, commission: true, commissionRate: true },
  })
  assert.equal(lines.length, 1)
  assert.equal(Number(lines[0]!.commission ?? 0), 50)
  assert.equal(Number(lines[0]!.usage ?? 0), 50)
  assert.equal(Number(lines[0]!.commissionRate ?? 0), 1)
})

integrationTest("DU-AUTO-13: payment date parsing supports Excel serial values", async ctx => {
  const routeModule = await import("../app/api/reconciliation/deposits/import/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const excelSerial = 45000

  const request = makeImportRequest({
    sessionToken: ctx.sessionToken,
    distributorAccountId: ctx.distributorAccountId,
    vendorAccountId: ctx.vendorAccountId,
    file: makeCsvFile(["Payment Date,Commission", `${excelSerial},10`].join("\n")),
    mapping: { paymentDate: "Payment Date", commission: "Commission" },
    paymentDate: "2026-01-01",
  })

  const response = await POST(request)
  assertStatus(response, 200)
  const payload = await readJson<{ data?: { depositId?: string } }>(response)
  assert.ok(payload.data?.depositId)

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma
  const line = await prisma.depositLineItem.findFirst({
    where: { depositId: payload.data!.depositId, tenantId: ctx.tenantId },
    select: { paymentDate: true },
  })
  assert.ok(line?.paymentDate)

  const excelEpoch = new Date(Date.UTC(1899, 11, 30))
  const expected = new Date(excelEpoch.getTime() + excelSerial * 24 * 60 * 60 * 1000)
  assert.equal(line!.paymentDate.toISOString().slice(0, 10), expected.toISOString().slice(0, 10))
})

integrationTest("DU-AUTO-14: idempotencyKey returns same depositId on repeat requests", async ctx => {
  const routeModule = await import("../app/api/reconciliation/deposits/import/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const idempotencyKey = `test-${Date.now()}`
  const file = makeCsvFile(["Commission", "10"].join("\n"))

  const firstResponse = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      file,
      mapping: { commission: "Commission" },
      paymentDate: "2026-01-01",
      idempotencyKey,
    }),
  )
  assertStatus(firstResponse, 200)
  const firstPayload = await readJson<{ data?: { depositId?: string } }>(firstResponse)
  assert.ok(firstPayload.data?.depositId)

  const secondResponse = await POST(
    makeImportRequest({
      sessionToken: ctx.sessionToken,
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      file: makeCsvFile(["Commission", "10"].join("\n")),
      mapping: { commission: "Commission" },
      paymentDate: "2026-01-01",
      idempotencyKey,
    }),
  )
  assertStatus(secondResponse, 200)
  const secondPayload = await readJson<{ data?: { depositId?: string; idempotent?: boolean } }>(secondResponse)
  assert.equal(secondPayload.data?.depositId, firstPayload.data?.depositId)
  assert.equal(Boolean(secondPayload.data?.idempotent), true)
})

integrationTest("DU-AUTO-15: template persistence toggle controls template config updates", async ctx => {
  const routeModule = await import("../app/api/reconciliation/deposits/import/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma

  const template = await prisma.reconciliationTemplate.create({
    data: {
      tenantId: ctx.tenantId,
      name: "Test Template",
      description: "Integration test template",
      distributorAccountId: ctx.distributorAccountId,
      vendorAccountId: ctx.vendorAccountId,
      createdByUserId: ctx.userId,
      config: null,
    },
    select: { id: true },
  })

  const baseParams = {
    sessionToken: ctx.sessionToken,
    distributorAccountId: ctx.distributorAccountId,
    vendorAccountId: ctx.vendorAccountId,
    reconciliationTemplateId: template.id,
    file: makeCsvFile(["Commission", "10"].join("\n")),
    mapping: { commission: "Commission" },
    paymentDate: "2026-01-01",
  }

  const noSaveResponse = await POST(makeImportRequest({ ...baseParams, saveTemplateMapping: false }))
  assertStatus(noSaveResponse, 200)

  const afterNoSave = await prisma.reconciliationTemplate.findFirst({
    where: { id: template.id, tenantId: ctx.tenantId },
    select: { config: true },
  })
  assert.equal(afterNoSave?.config, null)

  const saveResponse = await POST(makeImportRequest({ ...baseParams, saveTemplateMapping: true }))
  assertStatus(saveResponse, 200)

  const afterSave = await prisma.reconciliationTemplate.findFirst({
    where: { id: template.id, tenantId: ctx.tenantId },
    select: { config: true },
  })
  assert.ok(afterSave?.config, "Expected template config to be persisted when saveTemplateMapping=true")
})

integrationTest("DU-AUTO-16: single-vendor import skips total/subtotal summary rows", async ctx => {
  const routeModule = await import("../app/api/reconciliation/deposits/import/route")
  const POST = (routeModule as any).POST ?? (routeModule as any).default?.POST
  assert.equal(typeof POST, "function")

  const request = makeImportRequest({
    sessionToken: ctx.sessionToken,
    distributorAccountId: ctx.distributorAccountId,
    vendorAccountId: ctx.vendorAccountId,
    file: makeCsvFile(
      [
        "Description,Commission",
        "Line 1,10",
        "Totals,999",
        "Sub-total,888",
        "Grand Total:,777",
        "Total Telecom,5",
      ].join("\n"),
    ),
    mapping: { commission: "Commission" },
    paymentDate: "2026-01-01",
  })

  const response = await POST(request)
  assertStatus(response, 200)
  const payload = await readJson<{ data?: { depositId?: string } }>(response)
  assert.ok(payload.data?.depositId)

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma
  const lines = await prisma.depositLineItem.findMany({
    where: { tenantId: ctx.tenantId, depositId: payload.data!.depositId },
    select: { commission: true },
    orderBy: { lineNumber: "asc" },
  })

  assert.equal(lines.length, 2)
  assert.deepEqual(
    lines.map(line => Number(line.commission ?? 0)),
    [10, 5],
  )
})
