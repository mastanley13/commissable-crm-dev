import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { AuditAction, DataEntity } from "@prisma/client"

import { withAuth, type AuthenticatedRequest } from "@/lib/api-auth"
import { getClientIP, getUserAgent, logAudit } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { hasAnyPermission } from "@/lib/auth"
import {
  rankTopUsageAccounts,
  resolveCalendarDateRange,
  resolveIntentFromMessage,
  buildOpenClawReadOnlySystemPrompt,
} from "@/lib/openclaw/read-only-tools"

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

type ChatResponseSource = "openclaw_gateway" | "crm_readonly_fallback"

const MAX_MESSAGES = 24
const MAX_MESSAGE_LENGTH = 6000
const REQUEST_TIMEOUT_MS = 90_000
const ACCOUNT_READ_PERMISSIONS = ["accounts.read", "accounts.manage"]
const SCHEDULE_READ_PERMISSIONS = ["reconciliation.view", "revenue-schedules.manage"]
const RECONCILIATION_READ_PERMISSIONS = ["reconciliation.view"]
const IMPORT_READ_PERMISSIONS = ["admin.data_settings.manage", "system.settings.read", "system.settings.write"]

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

function toFiniteNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (typeof value === "object" && value && "toNumber" in value) {
    try {
      const parsed = (value as { toNumber: () => number }).toNumber()
      return Number.isFinite(parsed) ? parsed : 0
    } catch {
      return 0
    }
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function extractLookupText(message: string, keywords: string[]) {
  const compact = message.replace(/\s+/g, " ").trim()
  for (const keyword of keywords) {
    const index = compact.toLowerCase().lastIndexOf(keyword.toLowerCase())
    if (index >= 0) {
      const candidate = compact.slice(index + keyword.length).replace(/^[\s:,-]+/, "").trim()
      if (candidate.length >= 2) return candidate.slice(0, 120)
    }
  }

  return compact
    .replace(/\b(show me|summarize|summary|look up|lookup|find|search|review|crm context|context|for|the|account|deposit|schedule|revenue schedules?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
}

function buildCapabilityOverview() {
  return [
    "I can help in CRM read-only mode while the OpenClaw transport is being finalized.",
    "",
    "Useful test prompts:",
    "- What are the top 5 usage accounts for March 2026?",
    "- Give me a reconciliation summary.",
    "- What recent imports failed?",
    "- Look up account context for <account name>.",
    "- Find deposits for <vendor or account name>.",
    "",
    "I will not create, update, delete, run imports, or apply reconciliation changes in v1.",
  ].join("\n")
}

function assertReadPermission(request: AuthenticatedRequest, permissions: string[], label: string) {
  if (hasAnyPermission(request.user, permissions)) return null
  return `I cannot read ${label} for your current role. Ask an administrator to confirm your CRM permissions, then retry this prompt.`
}

async function buildTopUsageAnswer(request: AuthenticatedRequest, message: string) {
  const permissionError = assertReadPermission(request, SCHEDULE_READ_PERMISSIONS, "revenue schedule usage data")
  if (permissionError) return permissionError

  const resolution = resolveIntentFromMessage({ message })
  const suggested = resolution.primaryMatch?.suggestedParams ?? {}
  const searchParams = new URLSearchParams()
  if (typeof suggested.month === "string") {
    searchParams.set("month", suggested.month)
  }
  if (typeof suggested.limit === "number") {
    searchParams.set("limit", String(suggested.limit))
  }

  const rangeResult = resolveCalendarDateRange({ searchParams })
  if (!rangeResult.ok) return rangeResult.error

  const range = rangeResult.value
  const limit = Math.min(
    Math.max(typeof suggested.limit === "number" ? suggested.limit : 5, 1),
    25,
  )

  const grouped = await prisma.revenueSchedule.groupBy({
    by: ["accountId"],
    where: {
      tenantId: request.user.tenantId,
      deletedAt: null,
      scheduleDate: { gte: range.from, lt: range.toExclusive },
    },
    _sum: {
      expectedUsage: true,
      usageAdjustment: true,
      actualUsage: true,
      actualUsageAdjustment: true,
      expectedCommission: true,
      actualCommission: true,
    },
    _count: { _all: true },
  })

  if (grouped.length === 0) {
    return `I did not find revenue schedules for ${range.fromDate} through ${range.toDate}.`
  }

  const accounts = await prisma.account.findMany({
    where: { tenantId: request.user.tenantId, id: { in: grouped.map((row) => row.accountId) } },
    select: { id: true, accountName: true, accountLegalName: true, accountNumber: true },
  })
  const accountById = new Map(accounts.map((account) => [account.id, account]))
  const ranked = rankTopUsageAccounts(
    grouped.map((row) => ({
      accountId: row.accountId,
      account: accountById.get(row.accountId) ?? null,
      scheduleCount: row._count._all,
      expectedUsage: row._sum.expectedUsage,
      usageAdjustment: row._sum.usageAdjustment,
      actualUsage: row._sum.actualUsage,
      actualUsageAdjustment: row._sum.actualUsageAdjustment,
      expectedCommission: row._sum.expectedCommission,
      actualCommission: row._sum.actualCommission,
    })),
  ).slice(0, limit)

  return [
    `Top ${ranked.length} usage accounts for ${range.fromDate} through ${range.toDate}:`,
    "",
    ...ranked.map(
      (row) =>
        `${row.rank}. ${row.account.accountName} - usage ${row.rankingUsageNet} (${row.rankingBasis.replace(/_/g, " ")}), schedules ${row.scheduleCount}, actual commission ${row.actualCommission}.`,
    ),
    "",
    "Ranking policy: actual usage net when actual usage exists, otherwise expected usage net.",
  ].join("\n")
}

async function buildReconciliationSummaryAnswer(request: AuthenticatedRequest) {
  const permissionError = assertReadPermission(request, RECONCILIATION_READ_PERMISSIONS, "reconciliation data")
  if (permissionError) return permissionError

  const where = { tenantId: request.user.tenantId }
  const [total, reconciled, unreconciled, statusGroups, sums] = await Promise.all([
    prisma.deposit.count({ where }),
    prisma.deposit.count({ where: { ...where, reconciled: true } }),
    prisma.deposit.count({ where: { ...where, reconciled: false } }),
    prisma.deposit.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.deposit.aggregate({
      where,
      _sum: {
        totalUsage: true,
        totalCommissions: true,
        usageAllocated: true,
        usageUnallocated: true,
        commissionAllocated: true,
        commissionUnallocated: true,
      },
    }),
  ])

  return [
    "Current reconciliation summary:",
    "",
    `- Deposits: ${total}`,
    `- Reconciled: ${reconciled}`,
    `- Unreconciled: ${unreconciled}`,
    `- Status breakdown: ${statusGroups.map((row) => `${row.status}: ${row._count._all}`).join(", ") || "none"}`,
    `- Usage allocated/unallocated: ${round(toFiniteNumber(sums._sum.usageAllocated))} / ${round(toFiniteNumber(sums._sum.usageUnallocated))}`,
    `- Commission allocated/unallocated: ${round(toFiniteNumber(sums._sum.commissionAllocated))} / ${round(toFiniteNumber(sums._sum.commissionUnallocated))}`,
  ].join("\n")
}

async function buildImportStatusAnswer(request: AuthenticatedRequest, message: string) {
  const permissionError = assertReadPermission(request, IMPORT_READ_PERMISSIONS, "import status data")
  if (permissionError) return permissionError

  const resolution = resolveIntentFromMessage({ message })
  const suggested = resolution.primaryMatch?.suggestedParams ?? {}
  const entity =
    typeof suggested.entity === "string" && (Object.values(DataEntity) as string[]).includes(suggested.entity)
      ? (suggested.entity as DataEntity)
      : undefined
  const status = typeof suggested.status === "string" ? suggested.status : undefined

  const jobs = await prisma.importJob.findMany({
    where: {
      tenantId: request.user.tenantId,
      ...(entity ? { entity } : {}),
      ...(status ? { status: status as any } : {}),
    },
    select: {
      id: true,
      entity: true,
      status: true,
      fileName: true,
      totalRows: true,
      successCount: true,
      errorCount: true,
      createdAt: true,
      completedAt: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 5,
  })

  if (jobs.length === 0) {
    return `I did not find recent imports matching ${entity ?? "any entity"} / ${status ?? "any status"}.`
  }

  return [
    `Recent import status${entity ? ` for ${entity}` : ""}${status ? ` with status ${status}` : ""}:`,
    "",
    ...jobs.map(
      (job) =>
        `- ${job.entity} ${job.status}: ${job.fileName ?? "unnamed file"} (${job.successCount ?? 0} succeeded, ${job.errorCount ?? 0} errors, ${job.totalRows ?? 0} total rows)`,
    ),
  ].join("\n")
}

async function buildAccountContextAnswer(request: AuthenticatedRequest, message: string) {
  const permissionError = assertReadPermission(request, ACCOUNT_READ_PERMISSIONS, "account context")
  if (permissionError) return permissionError

  const query = extractLookupText(message, ["account context for", "account for", "account", "for"])
  if (!query || query.length < 2) {
    return "Which account should I look up? Send the account name or account number."
  }

  const contains = { contains: query, mode: "insensitive" as const }
  const accounts = await prisma.account.findMany({
    where: {
      tenantId: request.user.tenantId,
      mergedIntoAccountId: null,
      OR: [{ accountName: contains }, { accountLegalName: contains }, { accountNumber: contains }],
    },
    select: {
      id: true,
      accountName: true,
      accountLegalName: true,
      accountNumber: true,
      status: true,
      accountType: { select: { name: true } },
      owner: { select: { fullName: true } },
      _count: {
        select: {
          contacts: true,
          opportunities: true,
          revenueSchedules: true,
          tickets: true,
          deposits: true,
        },
      },
    },
    orderBy: [{ accountName: "asc" }],
    take: 5,
  })

  if (accounts.length === 0) return `I did not find an account matching "${query}".`
  if (accounts.length > 1) {
    return [
      `I found multiple accounts matching "${query}". Which one do you mean?`,
      "",
      ...accounts.map((account) => `- ${account.accountName}${account.accountNumber ? ` (${account.accountNumber})` : ""}`),
    ].join("\n")
  }

  const account = accounts[0]!
  return [
    `Account context for ${account.accountName}:`,
    "",
    `- Status: ${account.status}`,
    `- Type: ${account.accountType?.name ?? "not set"}`,
    `- Owner: ${account.owner?.fullName ?? "not set"}`,
    `- Related records: ${account._count.contacts} contacts, ${account._count.opportunities} opportunities, ${account._count.revenueSchedules} revenue schedules, ${account._count.deposits} deposits, ${account._count.tickets} tickets.`,
  ].join("\n")
}

async function buildDepositLookupAnswer(request: AuthenticatedRequest, message: string) {
  const permissionError = assertReadPermission(request, RECONCILIATION_READ_PERMISSIONS, "deposit data")
  if (permissionError) return permissionError

  const query = extractLookupText(message, ["deposit detail for", "deposits for", "deposit for", "deposit", "for"])
  if (!query || query.length < 2) {
    return "Which deposit should I look up? Send a deposit name, vendor, distributor, or account name."
  }

  const contains = { contains: query, mode: "insensitive" as const }
  const deposits = await prisma.deposit.findMany({
    where: {
      tenantId: request.user.tenantId,
      OR: [
        { depositName: contains },
        { account: { accountName: contains } },
        { vendor: { accountName: contains } },
        { distributor: { accountName: contains } },
      ],
    },
    select: {
      depositName: true,
      paymentDate: true,
      status: true,
      reconciled: true,
      totalUsage: true,
      totalCommissions: true,
      itemsReconciled: true,
      itemsUnreconciled: true,
      account: { select: { accountName: true } },
      vendor: { select: { accountName: true } },
      distributor: { select: { accountName: true } },
    },
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    take: 5,
  })

  if (deposits.length === 0) return `I did not find deposits matching "${query}".`

  return [
    `Deposit matches for "${query}":`,
    "",
    ...deposits.map((deposit) => {
      const date = deposit.paymentDate ? deposit.paymentDate.toISOString().slice(0, 10) : "no payment date"
      return `- ${deposit.depositName} (${date}) - ${deposit.status}, reconciled: ${deposit.reconciled ? "yes" : "no"}, usage ${round(toFiniteNumber(deposit.totalUsage))}, commission ${round(toFiniteNumber(deposit.totalCommissions))}, unreconciled items ${deposit.itemsUnreconciled ?? 0}.`
    }),
  ].join("\n")
}

async function buildScheduleLookupAnswer(request: AuthenticatedRequest, message: string) {
  const permissionError = assertReadPermission(request, SCHEDULE_READ_PERMISSIONS, "revenue schedule data")
  if (permissionError) return permissionError

  const query = extractLookupText(message, ["revenue schedules for", "schedules for", "schedule for", "for"])
  if (!query || query.length < 2) {
    return "Which account, vendor, product, or schedule number should I search for?"
  }

  const contains = { contains: query, mode: "insensitive" as const }
  const schedules = await prisma.revenueSchedule.findMany({
    where: {
      tenantId: request.user.tenantId,
      deletedAt: null,
      OR: [
        { scheduleNumber: contains },
        { account: { accountName: contains } },
        { vendor: { accountName: contains } },
        { distributor: { accountName: contains } },
        { product: { productNameHouse: contains } },
        { product: { productNameVendor: contains } },
      ],
    },
    select: {
      scheduleNumber: true,
      scheduleDate: true,
      status: true,
      billingStatus: true,
      expectedUsage: true,
      actualUsage: true,
      expectedCommission: true,
      actualCommission: true,
      account: { select: { accountName: true } },
      product: { select: { productNameHouse: true, productNameVendor: true } },
    },
    orderBy: [{ scheduleDate: "desc" }, { updatedAt: "desc" }],
    take: 5,
  })

  if (schedules.length === 0) return `I did not find revenue schedules matching "${query}".`

  return [
    `Revenue schedule matches for "${query}":`,
    "",
    ...schedules.map((schedule) => {
      const date = schedule.scheduleDate ? schedule.scheduleDate.toISOString().slice(0, 10) : "no date"
      return `- ${schedule.scheduleNumber ?? "schedule"} (${date}) - ${schedule.account?.accountName ?? "no account"}, ${schedule.status}/${schedule.billingStatus}, expected usage ${round(toFiniteNumber(schedule.expectedUsage))}, actual usage ${round(toFiniteNumber(schedule.actualUsage))}.`
    }),
  ].join("\n")
}

async function buildLocalReadOnlyReply(request: AuthenticatedRequest, message: string) {
  const resolution = resolveIntentFromMessage({ message })
  const intent = resolution.primaryMatch?.intent ?? null

  switch (intent) {
    case "insight.top_usage_accounts":
      return { reply: await buildTopUsageAnswer(request, message), intent }
    case "workflow.reconciliation_summary":
      return { reply: await buildReconciliationSummaryAnswer(request), intent }
    case "workflow.import_status":
      return { reply: await buildImportStatusAnswer(request, message), intent }
    case "lookup.account_context":
      return { reply: await buildAccountContextAnswer(request, message), intent }
    case "lookup.deposit_detail":
      return { reply: await buildDepositLookupAnswer(request, message), intent }
    case "lookup.revenue_schedule_search":
      return { reply: await buildScheduleLookupAnswer(request, message), intent }
    case "action.preview_write_request":
      return {
        intent,
        reply:
          "I can help draft the review steps, but v1 is read-only. I will not create tickets, update schedules, run imports, or apply reconciliation changes. Send the issue details and I can prepare a non-persistent handoff summary for a human to review.",
      }
    case "insight.accounts_with_issues":
    case "insight.variance_summary":
      return {
        intent,
        reply:
          "That cross-entity insight is not yet a supported v1 capability. I can help with account context, revenue schedule search, top usage accounts, reconciliation summary, deposit lookup, or recent import status.",
      }
    default:
      return { reply: buildCapabilityOverview(), intent }
  }
}

async function logChatEvent(args: {
  request: AuthenticatedRequest
  requestId: string
  conversationId: string
  status: "success" | "error"
  messageCount: number
  responseStatus?: number
  errorCode?: string
  source?: ChatResponseSource
  intent?: string | null
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
      source: args.source ?? null,
      intent: args.intent ?? null,
      path: args.request.nextUrl.pathname,
    },
  })
}

async function buildLocalFallbackResponse(args: {
  request: AuthenticatedRequest
  requestId: string
  conversationId: string
  messages: ChatMessage[]
  userMessage: string
  errorCode: string
  responseStatus?: number
}) {
  const local = await buildLocalReadOnlyReply(args.request, args.userMessage)
  await logChatEvent({
    request: args.request,
    requestId: args.requestId,
    conversationId: args.conversationId,
    status: "success",
    messageCount: args.messages.length,
    responseStatus: args.responseStatus,
    errorCode: args.errorCode,
    source: "crm_readonly_fallback",
    intent: local.intent,
  })

  return NextResponse.json({
    data: {
      conversationId: args.conversationId,
      source: "crm_readonly_fallback" satisfies ChatResponseSource,
      intent: local.intent,
      message: {
        role: "assistant",
        content: local.reply,
      },
    },
    requestId: args.requestId,
  })
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (authenticatedRequest) => {
    const requestId = crypto.randomUUID()
    const chatCompletionsUrl = resolveChatCompletionsUrl()
    const gatewayToken = resolveGatewayToken()

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

    if (!chatCompletionsUrl || !gatewayToken) {
      return buildLocalFallbackResponse({
        request: authenticatedRequest,
        requestId,
        conversationId,
        messages,
        userMessage: lastMessage.content,
        errorCode: "openclaw_not_configured",
      })
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
              content: buildOpenClawReadOnlySystemPrompt("/api/bot/v1/tools"),
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

        return buildLocalFallbackResponse({
          request: authenticatedRequest,
          requestId,
          conversationId,
          messages,
          userMessage: lastMessage.content,
          errorCode: "openclaw_gateway_error",
          responseStatus: upstreamResponse.status,
        })
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

        return buildLocalFallbackResponse({
          request: authenticatedRequest,
          requestId,
          conversationId,
          messages,
          userMessage: lastMessage.content,
          errorCode: "empty_openclaw_response",
          responseStatus: upstreamResponse.status,
        })
      }

      await logChatEvent({
        request: authenticatedRequest,
        requestId,
        conversationId,
        status: "success",
        messageCount: messages.length,
        responseStatus: upstreamResponse.status,
        source: "openclaw_gateway",
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

      return buildLocalFallbackResponse({
        request: authenticatedRequest,
        requestId,
        conversationId,
        messages,
        userMessage: lastMessage.content,
        errorCode: aborted ? "openclaw_timeout" : "openclaw_request_failed",
      })
    } finally {
      clearTimeout(timeout)
    }
  })
}
