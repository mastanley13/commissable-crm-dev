import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { AuditAction, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getClientIP, getUserAgent, logAudit } from "@/lib/audit"
import { hasAllPermissions, hasAnyPermission, type AuthUser } from "@/lib/auth"

export interface BotContext {
  apiKeyLabel: string
  transactionId: string
  requestedBy: string | null
  conversationId: string | null
  channelId: string | null
}

export interface BotAuthenticatedRequest extends NextRequest {
  user: AuthUser
  bot: BotContext
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function resolveBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization")?.trim() ?? ""
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim() || null
  }

  const apiKeyHeader = request.headers.get("x-api-key")?.trim() ?? ""
  return apiKeyHeader || null
}

function mapUserToAuthUser(user: Prisma.UserGetPayload<{
  include: {
    role: {
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    }
  }
}>): AuthUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    roleId: user.roleId,
    status: user.status,
    role: user.role
      ? {
          id: user.role.id,
          code: user.role.code,
          name: user.role.name,
          permissions: user.role.permissions.map((entry) => ({
            id: entry.permission.id,
            code: entry.permission.code,
            name: entry.permission.name,
            category: entry.permission.category,
          })),
        }
      : undefined,
  }
}

async function resolveBotUser(): Promise<AuthUser | null> {
  const configuredUserId = process.env.OPENCLAW_BOT_USER_ID?.trim()
  const configuredEmail = process.env.OPENCLAW_BOT_USER_EMAIL?.trim().toLowerCase()

  if (!configuredUserId && !configuredEmail) {
    throw new Error("OPENCLAW_BOT_USER_ID or OPENCLAW_BOT_USER_EMAIL must be configured")
  }

  const user = await prisma.user.findFirst({
    where: {
      ...(configuredUserId ? { id: configuredUserId } : {}),
      ...(configuredEmail ? { email: configuredEmail } : {}),
      status: { in: ["Active", "Invited"] },
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  })

  if (!user) {
    return null
  }

  return mapUserToAuthUser(user)
}

export function createBotTransactionId(request: NextRequest): string {
  const forwarded = request.headers.get("x-transaction-id")?.trim()
  return forwarded && forwarded.length > 0 ? forwarded : crypto.randomUUID()
}

export async function withBotAuth(
  request: NextRequest,
  permissions: string[],
  handler: (request: BotAuthenticatedRequest) => Promise<Response>,
  options: { requireAll?: boolean } = {},
): Promise<Response> {
  try {
    const providedToken = resolveBearerToken(request)
    if (!providedToken) {
      return NextResponse.json({ error: "Missing API token" }, { status: 401 })
    }

    const expectedToken = getRequiredEnv("OPENCLAW_API_KEY")
    if (!timingSafeEqual(providedToken, expectedToken)) {
      return NextResponse.json({ error: "Invalid API token" }, { status: 401 })
    }

    const user = await resolveBotUser()
    if (!user) {
      return NextResponse.json({ error: "Configured bot user was not found" }, { status: 500 })
    }

    const requireAll = options.requireAll === true
    const hasRequiredPermissions = permissions.length === 0
      ? true
      : requireAll
        ? hasAllPermissions(user, permissions)
        : hasAnyPermission(user, permissions)

    if (!hasRequiredPermissions) {
      return NextResponse.json(
        {
          error: "Permission denied",
          required: permissions,
          requireAll,
        },
        { status: 403 },
      )
    }

    const authenticatedRequest = request as BotAuthenticatedRequest
    authenticatedRequest.user = user
    authenticatedRequest.bot = {
      apiKeyLabel: process.env.OPENCLAW_API_KEY_LABEL?.trim() || "openclaw",
      transactionId: createBotTransactionId(request),
      requestedBy: request.headers.get("x-openclaw-user")?.trim() || null,
      conversationId: request.headers.get("x-openclaw-conversation-id")?.trim() || null,
      channelId: request.headers.get("x-openclaw-channel-id")?.trim() || null,
    }

    return handler(authenticatedRequest)
  } catch (error) {
    console.error("Bot auth error:", error)
    return NextResponse.json({ error: "Bot auth configuration error" }, { status: 500 })
  }
}

export async function logBotAuditEvent(args: {
  request: BotAuthenticatedRequest
  action: AuditAction
  entityName: string
  entityId: string
  previousValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  metadata?: Record<string, unknown>
}) {
  const { request, action, entityName, entityId, previousValues, newValues, metadata } = args

  await logAudit({
    userId: request.user.id,
    tenantId: request.user.tenantId,
    action,
    entityName,
    entityId,
    requestId: request.bot.transactionId,
    previousValues,
    newValues,
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request),
    metadata: {
      actorType: "bot",
      botProvider: "openclaw",
      botKeyLabel: request.bot.apiKeyLabel,
      requestedBy: request.bot.requestedBy,
      conversationId: request.bot.conversationId,
      channelId: request.bot.channelId,
      method: request.method,
      path: request.nextUrl.pathname,
      ...metadata,
    },
  })
}
