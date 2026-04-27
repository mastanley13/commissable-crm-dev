import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { AuditAction } from "@prisma/client"

import { withAuth, type AuthenticatedRequest } from "@/lib/api-auth"
import { getClientIP, getUserAgent, logAudit } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ChatRole = "user" | "assistant"

type ChatMessage = {
  role: ChatRole
  content: string
}

type OpenClawChatBody = {
  conversationId?: string
  messages?: ChatMessage[]
}

const MAX_MESSAGES = 24
const MAX_MESSAGE_LENGTH = 6000
const REQUEST_TIMEOUT_MS = 90_000

function resolveChatCompletionsUrl() {
  const configured = process.env.OPENCLAW_CHAT_COMPLETIONS_URL?.trim()
  if (configured) return configured

  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL?.trim()
  if (!gatewayUrl) return null

  const normalized = gatewayUrl.replace(/\/+$/, "")
  if (normalized.endsWith("/v1/chat/completions")) return normalized
  if (normalized.endsWith("/v1")) return `${normalized}/chat/completions`
  return `${normalized}/v1/chat/completions`
}

function resolveGatewayToken() {
  return process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || process.env.OPENCLAW_GATEWAY_PASSWORD?.trim() || null
}

function normalizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return []

  return messages
    .slice(-MAX_MESSAGES)
    .map((message): ChatMessage | null => {
      if (!message || typeof message !== "object") return null
      const candidate = message as Record<string, unknown>
      const role = candidate.role === "assistant" ? "assistant" : candidate.role === "user" ? "user" : null
      const content = typeof candidate.content === "string" ? candidate.content.trim() : ""

      if (!role || !content) return null

      return {
        role,
        content: content.slice(0, MAX_MESSAGE_LENGTH),
      }
    })
    .filter((message): message is ChatMessage => message !== null)
}

function extractAssistantText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null
  const root = payload as Record<string, unknown>
  const choices = Array.isArray(root.choices) ? root.choices : []
  const first = choices[0]
  if (!first || typeof first !== "object") return null
  const choice = first as Record<string, unknown>
  const message = choice.message

  if (message && typeof message === "object") {
    const content = (message as Record<string, unknown>).content
    if (typeof content === "string" && content.trim()) {
      return content.trim()
    }
  }

  const text = choice.text
  return typeof text === "string" && text.trim() ? text.trim() : null
}

async function logChatEvent(args: {
  request: AuthenticatedRequest
  requestId: string
  conversationId: string
  status: "success" | "error"
  messageCount: number
  responseStatus?: number
  errorCode?: string
}) {
  await logAudit({
    userId: args.request.user.id,
    tenantId: args.request.user.tenantId,
    action: AuditAction.Export,
    entityName: "OpenClawChat",
    entityId: args.conversationId,
    requestId: args.requestId,
    ipAddress: getClientIP(args.request),
    userAgent: getUserAgent(args.request),
    metadata: {
      actorType: "user",
      botProvider: "openclaw",
      status: args.status,
      messageCount: args.messageCount,
      responseStatus: args.responseStatus ?? null,
      errorCode: args.errorCode ?? null,
      path: args.request.nextUrl.pathname,
    },
  })
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (authenticatedRequest) => {
    const requestId = crypto.randomUUID()
    const chatCompletionsUrl = resolveChatCompletionsUrl()
    const gatewayToken = resolveGatewayToken()

    if (!chatCompletionsUrl || !gatewayToken) {
      return NextResponse.json(
        {
          error:
            "OpenClaw chat is not configured. Set OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN, or OPENCLAW_CHAT_COMPLETIONS_URL and OPENCLAW_GATEWAY_TOKEN.",
          requestId,
        },
        { status: 503 },
      )
    }

    const body = (await request.json().catch(() => null)) as OpenClawChatBody | null
    const messages = normalizeMessages(body?.messages)
    const lastMessage = messages[messages.length - 1]
    const conversationId =
      typeof body?.conversationId === "string" && body.conversationId.trim()
        ? body.conversationId.trim().slice(0, 120)
        : crypto.randomUUID()

    if (!lastMessage || lastMessage.role !== "user") {
      await logChatEvent({
        request: authenticatedRequest,
        requestId,
        conversationId,
        status: "error",
        messageCount: messages.length,
        errorCode: "missing_user_message",
      })

      return NextResponse.json(
        { error: "A user message is required.", requestId },
        { status: 400 },
      )
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const upstreamResponse = await fetch(chatCompletionsUrl, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${gatewayToken}`,
          "Content-Type": "application/json",
          "x-openclaw-session-key": `commissable-crm:${authenticatedRequest.user.tenantId}:${authenticatedRequest.user.id}:${conversationId}`,
          "x-openclaw-message-channel": "commissable-crm",
          ...(process.env.OPENCLAW_BACKEND_MODEL?.trim()
            ? { "x-openclaw-model": process.env.OPENCLAW_BACKEND_MODEL.trim() }
            : {}),
        },
        body: JSON.stringify({
          model: process.env.OPENCLAW_CHAT_MODEL?.trim() || "openclaw/default",
          stream: false,
          user: `commissable-crm:${authenticatedRequest.user.tenantId}:${authenticatedRequest.user.id}:${conversationId}`,
          messages: [
            {
              role: "system",
              content:
                "You are embedded in the Commissable CRM. Keep v1 behavior read-only. Do not ask for or reveal secrets, credentials, raw exports, or production-only data. Use concise operational answers.",
            },
            ...messages,
          ],
        }),
      })

      const responsePayload = await upstreamResponse.json().catch(() => null)

      if (!upstreamResponse.ok) {
        await logChatEvent({
          request: authenticatedRequest,
          requestId,
          conversationId,
          status: "error",
          messageCount: messages.length,
          responseStatus: upstreamResponse.status,
          errorCode: "openclaw_gateway_error",
        })

        return NextResponse.json(
          {
            error: "OpenClaw gateway returned an error.",
            requestId,
            status: upstreamResponse.status,
          },
          { status: 502 },
        )
      }

      const reply = extractAssistantText(responsePayload)
      if (!reply) {
        await logChatEvent({
          request: authenticatedRequest,
          requestId,
          conversationId,
          status: "error",
          messageCount: messages.length,
          responseStatus: upstreamResponse.status,
          errorCode: "empty_openclaw_response",
        })

        return NextResponse.json(
          { error: "OpenClaw returned an empty response.", requestId },
          { status: 502 },
        )
      }

      await logChatEvent({
        request: authenticatedRequest,
        requestId,
        conversationId,
        status: "success",
        messageCount: messages.length,
        responseStatus: upstreamResponse.status,
      })

      return NextResponse.json({
        data: {
          conversationId,
          message: {
            role: "assistant",
            content: reply,
          },
        },
        requestId,
      })
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError"
      await logChatEvent({
        request: authenticatedRequest,
        requestId,
        conversationId,
        status: "error",
        messageCount: messages.length,
        errorCode: aborted ? "openclaw_timeout" : "openclaw_request_failed",
      })

      return NextResponse.json(
        {
          error: aborted ? "OpenClaw did not respond before the request timed out." : "Unable to reach OpenClaw.",
          requestId,
        },
        { status: 504 },
      )
    } finally {
      clearTimeout(timeout)
    }
  })
}
