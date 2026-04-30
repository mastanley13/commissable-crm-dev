import { NextRequest, NextResponse } from "next/server"

import { withAuth } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATUS_TIMEOUT_MS = 5_000

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "")
}

function resolveChatCompletionsUrl() {
  const configured = process.env.OPENCLAW_CHAT_COMPLETIONS_URL?.trim()
  if (configured) return configured

  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL?.trim()
  if (!gatewayUrl) return null

  const normalized = trimTrailingSlashes(gatewayUrl)
  if (normalized.endsWith("/v1/chat/completions")) return normalized
  if (normalized.endsWith("/v1")) return `${normalized}/chat/completions`
  return `${normalized}/v1/chat/completions`
}

function resolveGatewayWsUrl() {
  const configured = process.env.OPENCLAW_GATEWAY_WS_URL?.trim()
  if (configured) return configured

  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL?.trim()
  if (!gatewayUrl) return null

  try {
    const parsed = new URL(gatewayUrl)
    if (parsed.protocol === "ws:" || parsed.protocol === "wss:") {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/"
      parsed.search = ""
      parsed.hash = ""
      return parsed.toString()
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:"
    parsed.search = ""
    parsed.hash = ""
    parsed.pathname = parsed.pathname
      .replace(/\/v1\/chat\/completions\/?$/, "")
      .replace(/\/v1\/?$/, "")
      .replace(/\/+$/, "") || "/"
    return parsed.toString()
  } catch {
    return null
  }
}

function resolveGatewayHealthUrl() {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL?.trim()
  if (!gatewayUrl) return null

  const normalized = trimTrailingSlashes(gatewayUrl)
  if (normalized.endsWith("/v1/chat/completions")) {
    return normalized.slice(0, -"/v1/chat/completions".length) + "/health"
  }
  if (normalized.endsWith("/v1")) {
    return normalized.slice(0, -"/v1".length) + "/health"
  }
  return `${normalized}/health`
}

function safeUrlSummary(rawUrl: string | null) {
  if (!rawUrl) return null
  try {
    const url = new URL(rawUrl)
    return {
      protocol: url.protocol.replace(":", ""),
      host: url.host,
      path: url.pathname,
    }
  } catch {
    return { protocol: null, host: "invalid-url", path: null }
  }
}

async function fetchHealth(url: string | null) {
  if (!url) {
    return {
      checked: false,
      ok: false,
      status: null,
      error: "OPENCLAW_GATEWAY_URL is not configured.",
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    })
    return {
      checked: true,
      ok: response.ok,
      status: response.status,
      error: response.ok ? null : "Gateway health check did not return OK.",
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError"
    return {
      checked: true,
      ok: false,
      status: null,
      error: aborted ? "Gateway health check timed out." : "Gateway health check failed.",
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    const chatCompletionsUrl = resolveChatCompletionsUrl()
    const gatewayWsUrl = resolveGatewayWsUrl()
    const gatewayHealthUrl = resolveGatewayHealthUrl()
    const gatewayTokenConfigured = Boolean(
      process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || process.env.OPENCLAW_GATEWAY_PASSWORD?.trim(),
    )
    const chatTransportConfigured = Boolean((chatCompletionsUrl || gatewayWsUrl) && gatewayTokenConfigured)
    const health = await fetchHealth(gatewayHealthUrl)

    return NextResponse.json({
      status: "success",
      data: {
        browserChatEndpoint: "/api/openclaw/chat",
        responseModes: {
          liveOpenClawGateway: chatTransportConfigured && health.ok,
          crmReadOnlyFallback: true,
        },
        openClaw: {
          chatTransportConfigured,
          gatewayWebSocketUrlConfigured: Boolean(process.env.OPENCLAW_GATEWAY_WS_URL?.trim() || gatewayWsUrl),
          gatewayUrlConfigured: Boolean(process.env.OPENCLAW_GATEWAY_URL?.trim()),
          chatCompletionsUrlConfigured: Boolean(process.env.OPENCLAW_CHAT_COMPLETIONS_URL?.trim()),
          gatewayTokenConfigured,
          model: process.env.OPENCLAW_CHAT_MODEL?.trim() || process.env.OPENCLAW_BACKEND_MODEL?.trim() || null,
          gatewayWebSocketUrl: safeUrlSummary(gatewayWsUrl),
          chatCompletionsUrl: safeUrlSummary(chatCompletionsUrl),
          gatewayHealthUrl: safeUrlSummary(gatewayHealthUrl),
          health,
        },
        crmReadOnly: {
          enabled: true,
          supportedIntents: [
            "insight.top_usage_accounts",
            "lookup.account_context",
            "lookup.revenue_schedule_search",
            "lookup.deposit_detail",
            "workflow.reconciliation_summary",
            "workflow.import_status",
            "action.preview_write_request",
            "action.draft_support_ticket",
            "action.draft_import_correction_plan",
            "action.draft_reconciliation_handoff",
            "action.preview_match_review",
            "action.draft_client_follow_up",
          ],
        },
      },
    })
  })
}
