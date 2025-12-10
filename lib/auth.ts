import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { cookies } from 'next/headers'
import { prisma } from './db'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const SALT_ROUNDS = 12

function resolveSessionDurationDays(): number {
  const raw = process.env.SESSION_DURATION_DAYS ?? '7'
  const parsed = Number.parseInt(raw, 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(`SESSION_DURATION_DAYS must be a positive integer, received "${raw}". Using default: 7`)
    return 7
  }

  return parsed
}

const SESSION_DURATION_DAYS = resolveSessionDurationDays()
const SESSION_DURATION_MS = SESSION_DURATION_DAYS * ONE_DAY_MS

export interface AuthUser {
  id: string
  tenantId: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  roleId: string | null
  status: string
  role?: {
    id: string
    code: string
    name: string
    permissions: Array<{
      id: string
      code: string
      name: string
      category: string
    }>
  }
}

const DERIVED_PERMISSION_MAP: Record<string, string[]> = {
  "revenue-schedules.manage": [
    "accounts.manage",
    "opportunities.manage"
  ],
  // Grant Data Settings access to roles that already have full system settings control
  "admin.data_settings.manage": [
    "system.settings.write"
  ]
}

function resolvePermissionCodes(user: AuthUser): Set<string> {
  const codes = new Set<string>()
  if (user.role?.permissions) {
    for (const permission of user.role.permissions) {
      codes.add(permission.code)
    }
  }

  for (const [target, fallbacks] of Object.entries(DERIVED_PERMISSION_MAP)) {
    if (codes.has(target)) {
      continue
    }
    if (fallbacks.some(code => codes.has(code))) {
      codes.add(target)
    }
  }

  return codes
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export async function createUserSession(
  userId: string,
  tenantId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ sessionToken: string; sessionId: string; expiresAt: Date }> {
  const sessionToken = generateOpaqueToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  const session = await prisma.userSession.create({
    data: {
      tenantId,
      userId,
      sessionToken,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      expiresAt,
      lastSeenAt: new Date()
    }
  })

  return {
    sessionToken,
    sessionId: session.id,
    expiresAt
  }
}

export async function getAuthenticatedUser(sessionToken?: string): Promise<AuthUser | null> {
  if (!sessionToken) {
    const cookieStore = await cookies()
    sessionToken = cookieStore.get('session-token')?.value
  }

  if (!sessionToken) {
    return null
  }

  const session = await prisma.userSession.findFirst({
    where: {
      sessionToken,
      expiresAt: { gt: new Date() },
      terminatedAt: null
    }
  })

  if (!session) {
    return null
  }

  await prisma.userSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() }
  })

  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      tenantId: session.tenantId,
      status: { in: ['Active', 'Invited'] }
    },
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
  })

  if (!user) {
    return null
  }

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
          permissions: user.role.permissions.map(rp => ({
            id: rp.permission.id,
            code: rp.permission.code,
            name: rp.permission.name,
            category: rp.permission.category
          }))
        }
      : undefined
  }
}

export async function terminateSession(sessionId: string): Promise<void> {
  await prisma.userSession.update({
    where: { id: sessionId },
    data: { terminatedAt: new Date() }
  })
}

export async function terminateAllUserSessions(userId: string, excludeSessionId?: string): Promise<void> {
  const where = excludeSessionId
    ? { userId, terminatedAt: null, id: { not: excludeSessionId } }
    : { userId, terminatedAt: null }

  await prisma.userSession.updateMany({
    where,
    data: { terminatedAt: new Date() }
  })
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.userSession.updateMany({
    where: {
      expiresAt: { lt: new Date() },
      terminatedAt: null
    },
    data: { terminatedAt: new Date() }
  })

  return result.count
}

export function hasPermission(user: AuthUser, permissionCode: string): boolean {
  const codes = resolvePermissionCodes(user)
  return codes.has(permissionCode)
}

export function hasAnyPermission(user: AuthUser, permissionCodes: string[]): boolean {
  return permissionCodes.some(code => hasPermission(user, code))
}

export function hasAllPermissions(user: AuthUser, permissionCodes: string[]): boolean {
  return permissionCodes.every(code => hasPermission(user, code))
}

export async function setSessionCookie(sessionToken: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set('session-token', sessionToken, {
    expires: expiresAt,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/'
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('session-token')
}
