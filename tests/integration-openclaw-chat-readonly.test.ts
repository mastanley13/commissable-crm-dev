import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { assertStatus, integrationTest, readJson } from "./integration-test-helpers"

function authedChatRequest(sessionToken: string, body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/openclaw/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `session-token=${sessionToken}`,
    },
    body: JSON.stringify(body),
  })
}

function authedStatusRequest(sessionToken: string) {
  return new NextRequest("http://localhost/api/openclaw/status", {
    method: "GET",
    headers: {
      cookie: `session-token=${sessionToken}`,
    },
  })
}

integrationTest("OPENCLAW-CHAT-01: browser chat falls back to CRM read-only answers when live OpenClaw is not configured", async (ctx) => {
  delete process.env.OPENCLAW_GATEWAY_URL
  delete process.env.OPENCLAW_CHAT_COMPLETIONS_URL
  delete process.env.OPENCLAW_GATEWAY_TOKEN
  delete process.env.OPENCLAW_GATEWAY_PASSWORD

  const dbModule = await import("../lib/db")
  const prisma = (dbModule as any).prisma ?? (dbModule as any).default?.prisma
  assert.ok(prisma, "Expected prisma client")

  await prisma.revenueSchedule.createMany({
    data: [
      {
        tenantId: ctx.tenantId,
        accountId: ctx.vendorAccountId,
        scheduleDate: new Date("2026-03-05T12:00:00.000Z"),
        expectedUsage: 100,
        actualUsage: 100,
        actualUsageAdjustment: 25,
        expectedCommission: 10,
        actualCommission: 12.5,
      },
      {
        tenantId: ctx.tenantId,
        accountId: ctx.distributorAccountId,
        scheduleDate: new Date("2026-03-10T12:00:00.000Z"),
        expectedUsage: 80,
        actualUsage: 80,
        expectedCommission: 8,
        actualCommission: 8,
      },
    ],
  })

  const routeModule = await import("../app/api/openclaw/chat/route")
  const response = await routeModule.POST(
    authedChatRequest(ctx.sessionToken, {
      conversationId: "integration-openclaw-chat",
      messages: [
        {
          role: "user",
          content: "What are the top 5 usage accounts for March 2026?",
        },
      ],
    }),
  )

  assertStatus(response, 200)
  const json = await readJson<{
    data?: {
      source?: string
      intent?: string
      message?: {
        role?: string
        content?: string
      }
    }
  }>(response)

  assert.equal(json.data?.source, "crm_readonly_fallback")
  assert.equal(json.data?.intent, "insight.top_usage_accounts")
  assert.equal(json.data?.message?.role, "assistant")
  assert.match(json.data?.message?.content ?? "", /Top 2 usage accounts/i)
  assert.match(json.data?.message?.content ?? "", /Test Vendor/i)
  assert.doesNotMatch(json.data?.message?.content ?? "", /offline fallback/i)
})

integrationTest("OPENCLAW-STATUS-01: status endpoint reports CRM read-only fallback without leaking transport secrets", async (ctx) => {
  delete process.env.OPENCLAW_GATEWAY_URL
  delete process.env.OPENCLAW_CHAT_COMPLETIONS_URL
  delete process.env.OPENCLAW_GATEWAY_TOKEN
  delete process.env.OPENCLAW_GATEWAY_PASSWORD

  const routeModule = await import("../app/api/openclaw/status/route")
  const response = await routeModule.GET(authedStatusRequest(ctx.sessionToken))

  assertStatus(response, 200)
  const json = await readJson<{
    data?: {
      responseModes?: {
        liveOpenClawGateway?: boolean
        crmReadOnlyFallback?: boolean
      }
      openClaw?: {
        chatTransportConfigured?: boolean
        gatewayUrlConfigured?: boolean
        chatCompletionsUrlConfigured?: boolean
        gatewayTokenConfigured?: boolean
        chatCompletionsUrl?: unknown
        gatewayHealthUrl?: unknown
        health?: {
          checked?: boolean
          ok?: boolean
          status?: number | null
          error?: string | null
        }
      }
      crmReadOnly?: {
        supportedIntents?: string[]
      }
    }
  }>(response)

  assert.equal(json.data?.responseModes?.liveOpenClawGateway, false)
  assert.equal(json.data?.responseModes?.crmReadOnlyFallback, true)
  assert.equal(json.data?.openClaw?.chatTransportConfigured, false)
  assert.equal(json.data?.openClaw?.gatewayUrlConfigured, false)
  assert.equal(json.data?.openClaw?.chatCompletionsUrlConfigured, false)
  assert.equal(json.data?.openClaw?.gatewayTokenConfigured, false)
  assert.equal(json.data?.openClaw?.chatCompletionsUrl, null)
  assert.equal(json.data?.openClaw?.gatewayHealthUrl, null)
  assert.equal(json.data?.openClaw?.health?.checked, false)
  assert.equal(json.data?.openClaw?.health?.ok, false)
  assert.ok(json.data?.crmReadOnly?.supportedIntents?.includes("insight.top_usage_accounts"))
})
