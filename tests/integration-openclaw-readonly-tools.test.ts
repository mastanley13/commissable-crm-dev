import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { assertStatus, integrationTest, readJson } from "./integration-test-helpers"

const BOT_API_KEY = "integration-openclaw-key"

function setBotEnv(userId: string) {
  process.env.OPENCLAW_API_KEY = BOT_API_KEY
  process.env.OPENCLAW_BOT_USER_ID = userId
  delete process.env.OPENCLAW_BOT_USER_EMAIL
}

function authedToolGet(url: string) {
  return new NextRequest(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${BOT_API_KEY}`,
    },
  })
}

async function invokeToolsGet(path: string, query = "") {
  const routeModule = await import("../app/api/bot/v1/tools/[...path]/route")
  const get = (routeModule as any).GET as (
    request: NextRequest,
    context: { params: { path: string[] } },
  ) => Promise<Response>

  const normalizedPath = path.split("/").filter(Boolean)
  const url = `http://localhost/api/bot/v1/tools/${path}${query}`
  return get(authedToolGet(url), { params: { path: normalizedPath } })
}

integrationTest("OPENCLAW-TOOLS-01: capability registry is exposed through the read-only tools surface", async (ctx) => {
  setBotEnv(ctx.userId)

  const response = await invokeToolsGet("capabilities")
  assertStatus(response, 200)

  const json = await readJson<{
    data?: {
      version?: string
      capabilities?: Array<{ intent: string; availability: string }>
    }
  }>(response)

  assert.equal(json.data?.version, "2026-04-23")
  assert.ok(
    json.data?.capabilities?.some(
      (entry) => entry.intent === "insight.top_usage_accounts" && entry.availability === "supported",
    ),
  )
})

integrationTest("OPENCLAW-TOOLS-01B: capability resolver maps a supported business question to a direct intent", async (ctx) => {
  setBotEnv(ctx.userId)

  const response = await invokeToolsGet(
    "capabilities/resolve",
    "?message=What%20are%20the%20top%205%20usage%20accounts%20for%20March%202026%3F",
  )
  assertStatus(response, 200)

  const json = await readJson<{
    data?: {
      routeDiscoveryAllowed?: boolean
      primaryMatch?: {
        intent?: string
        handlingMode?: string
        confidence?: string
        suggestedParams?: Record<string, string | number | null>
      }
    }
    context?: {
      routeDiscoveryAllowed?: boolean
      resolverPath?: string
    }
  }>(response)

  assert.equal(json.context?.routeDiscoveryAllowed, false)
  assert.equal(json.context?.resolverPath, "/api/bot/v1/tools/capabilities/resolve")
  assert.equal(json.data?.routeDiscoveryAllowed, false)
  assert.equal(json.data?.primaryMatch?.intent, "insight.top_usage_accounts")
  assert.equal(json.data?.primaryMatch?.handlingMode, "direct_tool_call")
  assert.equal(json.data?.primaryMatch?.confidence, "high")
  assert.equal(json.data?.primaryMatch?.suggestedParams?.month, "2026-03")
  assert.equal(json.data?.primaryMatch?.suggestedParams?.limit, 5)
})

integrationTest("OPENCLAW-TOOLS-01C: capability resolver handles preview-only and unsupported business questions explicitly", async (ctx) => {
  setBotEnv(ctx.userId)

  const previewResponse = await invokeToolsGet(
    "capabilities/resolve",
    "?message=Create%20a%20ticket%20for%20this%20reconciliation%20issue.",
  )
  assertStatus(previewResponse, 200)
  const previewJson = await readJson<{
    data?: {
      primaryMatch?: {
        intent?: string
        availability?: string
        handlingMode?: string
      }
    }
  }>(previewResponse)

  assert.equal(previewJson.data?.primaryMatch?.intent, "action.draft_support_ticket")
  assert.equal(previewJson.data?.primaryMatch?.availability, "preview_only")
  assert.equal(previewJson.data?.primaryMatch?.handlingMode, "preview_only")

  const unsupportedResponse = await invokeToolsGet(
    "capabilities/resolve",
    "?message=Which%20accounts%20have%20the%20most%20issues%3F",
  )
  assertStatus(unsupportedResponse, 200)
  const unsupportedJson = await readJson<{
    data?: {
      primaryMatch?: {
        intent?: string
        availability?: string
        handlingMode?: string
      }
    }
  }>(unsupportedResponse)

  assert.equal(unsupportedJson.data?.primaryMatch?.intent, "insight.accounts_with_issues")
  assert.equal(unsupportedJson.data?.primaryMatch?.availability, "not_yet_supported")
  assert.equal(unsupportedJson.data?.primaryMatch?.handlingMode, "unsupported")
})

integrationTest("OPENCLAW-TOOLS-02: top usage accounts honors historical ranges, explicit params, and net-usage ranking", async (ctx) => {
  setBotEnv(ctx.userId)

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma
  assert.ok(prisma, "Expected prisma client")

  const accountType = await prisma.accountType.findFirst({
    where: { tenantId: ctx.tenantId },
    select: { id: true },
  })
  assert.ok(accountType, "Expected seeded account type")

  const adjustmentHeavy = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "Adjustment Heavy",
    },
    select: { id: true },
  })

  const steadyNet = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "Steady Net",
    },
    select: { id: true },
  })

  const aprilOnly = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "April Only",
    },
    select: { id: true },
  })

  await prisma.revenueSchedule.createMany({
    data: [
      {
        tenantId: ctx.tenantId,
        accountId: adjustmentHeavy.id,
        scheduleDate: new Date("2026-03-05T12:00:00.000Z"),
        expectedUsage: 100,
        actualUsage: 100,
        actualUsageAdjustment: -20,
        expectedCommission: 10,
        actualCommission: 8,
      },
      {
        tenantId: ctx.tenantId,
        accountId: steadyNet.id,
        scheduleDate: new Date("2026-03-31T12:00:00.000Z"),
        expectedUsage: 90,
        actualUsage: 90,
        actualUsageAdjustment: 0,
        expectedCommission: 9,
        actualCommission: 9,
      },
      {
        tenantId: ctx.tenantId,
        accountId: aprilOnly.id,
        scheduleDate: new Date("2026-04-02T12:00:00.000Z"),
        expectedUsage: 500,
        actualUsage: 500,
        actualUsageAdjustment: 0,
        expectedCommission: 50,
        actualCommission: 50,
      },
    ],
  })

  const response = await invokeToolsGet(
    "revenue-schedules/top-usage-accounts",
    "?from=2026-03-01&to=2026-03-31&limit=5",
  )
  assertStatus(response, 200)

  const json = await readJson<{
    data?: Array<{
      account: { accountName: string }
      rankingBasis: string
      rankingUsageNet: number
      actualUsageNet: number
    }>
    context?: {
      from?: string
      to?: string
      dateFilterMode?: string
      rankingPolicy?: string
    }
  }>(response)

  assert.equal(json.context?.from, "2026-03-01")
  assert.equal(json.context?.to, "2026-03-31")
  assert.equal(json.context?.dateFilterMode, "explicit_date_range")
  assert.equal(json.context?.rankingPolicy, "actual_usage_net_else_expected_usage_net")
  assert.deepEqual(
    json.data?.map((row) => [row.account.accountName, row.rankingBasis, row.rankingUsageNet, row.actualUsageNet]),
    [
      ["Steady Net", "actual_usage_net", 90, 90],
      ["Adjustment Heavy", "actual_usage_net", 80, 80],
    ],
  )
})

integrationTest("OPENCLAW-TOOLS-02B: top usage accounts supports month=YYYY-MM for calendar-month requests", async (ctx) => {
  setBotEnv(ctx.userId)

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma
  assert.ok(prisma, "Expected prisma client")

  const accountType = await prisma.accountType.findFirst({
    where: { tenantId: ctx.tenantId },
    select: { id: true },
  })
  assert.ok(accountType, "Expected seeded account type")

  const marchLeader = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "March Leader",
    },
    select: { id: true },
  })

  const marchRunnerUp = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "March Runner Up",
    },
    select: { id: true },
  })

  const aprilNoise = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      accountTypeId: accountType.id,
      accountName: "April Noise",
    },
    select: { id: true },
  })

  await prisma.revenueSchedule.createMany({
    data: [
      {
        tenantId: ctx.tenantId,
        accountId: marchLeader.id,
        scheduleDate: new Date("2026-03-01T00:00:00.000Z"),
        expectedUsage: 140,
        actualUsage: 140,
        actualUsageAdjustment: 0,
        expectedCommission: 14,
        actualCommission: 14,
      },
      {
        tenantId: ctx.tenantId,
        accountId: marchRunnerUp.id,
        scheduleDate: new Date("2026-03-31T23:59:59.000Z"),
        expectedUsage: 120,
        actualUsage: 120,
        actualUsageAdjustment: 0,
        expectedCommission: 12,
        actualCommission: 12,
      },
      {
        tenantId: ctx.tenantId,
        accountId: aprilNoise.id,
        scheduleDate: new Date("2026-04-01T00:00:00.000Z"),
        expectedUsage: 999,
        actualUsage: 999,
        actualUsageAdjustment: 0,
        expectedCommission: 99,
        actualCommission: 99,
      },
    ],
  })

  const response = await invokeToolsGet(
    "revenue-schedules/top-usage-accounts",
    "?month=2026-03&limit=5",
  )
  assertStatus(response, 200)

  const json = await readJson<{
    data?: Array<{
      account: { accountName: string }
      rankingBasis: string
      rankingUsageNet: number
    }>
    context?: {
      month?: string | null
      from?: string
      to?: string
      dateFilterMode?: string
    }
  }>(response)

  assert.equal(json.context?.month, "2026-03")
  assert.equal(json.context?.from, "2026-03-01")
  assert.equal(json.context?.to, "2026-03-31")
  assert.equal(json.context?.dateFilterMode, "calendar_month")
  assert.deepEqual(
    json.data?.map((row) => [row.account.accountName, row.rankingBasis, row.rankingUsageNet]),
    [
      ["March Leader", "actual_usage_net", 140],
      ["March Runner Up", "actual_usage_net", 120],
    ],
  )
})

integrationTest("OPENCLAW-TOOLS-03: top usage accounts rejects ambiguous month and explicit-range params", async (ctx) => {
  setBotEnv(ctx.userId)

  const response = await invokeToolsGet(
    "revenue-schedules/top-usage-accounts",
    "?month=2026-03&from=2026-03-01&to=2026-03-31",
  )
  assertStatus(response, 400)

  const json = await readJson<{ error?: string }>(response)
  assert.match(json.error ?? "", /either month=YYYY-MM or from\/to/i)
})
