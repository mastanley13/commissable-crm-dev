import { prisma } from "./db"
import { AuditAction, Prisma } from "@prisma/client"

export interface AuditLogParams {
  userId: string
  tenantId: string
  action: AuditAction
  entityName: string
  entityId: string
  requestId?: string
  changedFields?: Record<string, { from: unknown; to: unknown }>
  previousValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

/**
 * Centralized audit logging utility
 * Logs all CRUD operations and system events for compliance and tracking
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: params.action,
        entityName: params.entityName,
        entityId: params.entityId,
        requestId: params.requestId,
        changedFields: params.changedFields ? JSON.stringify(params.changedFields) : undefined, 
        previousValues: params.previousValues ? JSON.stringify(params.previousValues) : undefined,
        newValues: params.newValues ? JSON.stringify(params.newValues) : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: params.metadata ? JSON.stringify(params.metadata) : undefined
      }
    })
  } catch (error) {
    // Don't throw errors from audit logging to avoid breaking main operations
    console.error('Failed to log audit event:', error)
  }
}

/**
 * Helper function to extract changed fields between two objects
 */
export function getChangedFields(
  previous: Record<string, unknown>,
  current: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const changed: Record<string, { from: unknown; to: unknown }> = {}

  const allKeys = Array.from(
    new Set<string>([
      ...Object.keys(previous || {}),
      ...Object.keys(current || {})
    ])
  )

  for (const key of allKeys) {
    const prev = previous ? previous[key] : undefined
    const next = current ? current[key] : undefined

    if (areAuditValuesEqual(prev, next)) {
      continue
    }

    changed[key] = {
      from: normaliseAuditValue(prev),
      to: normaliseAuditValue(next)
    }
  }

  return changed
}

function areAuditValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true

  // Treat null/undefined as equivalent
  if (a == null && b == null) return true

  // Date comparison
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }

  if (a instanceof Date && typeof b === "string") {
    const parsed = new Date(b)
    return !Number.isNaN(parsed.getTime()) && a.getTime() === parsed.getTime()
  }

  if (b instanceof Date && typeof a === "string") {
    const parsed = new Date(a)
    return !Number.isNaN(parsed.getTime()) && b.getTime() === parsed.getTime()
  }

  // Decimal comparison (Prisma.Decimal)
  if (isPrismaDecimal(a) && isPrismaDecimal(b)) {
    const decA = a as Prisma.Decimal & { equals?: (other: Prisma.Decimal) => boolean }
    if (typeof decA.equals === "function") {
      return decA.equals(b as Prisma.Decimal)
    }
    return a.toString() === b.toString()
  }

  // Fallback – different types or objects we don't normalise specially
  return false
}

function normaliseAuditValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (isPrismaDecimal(value)) {
    try {
      const decimal = value as Prisma.Decimal & { toNumber?: () => number }
      const asNumber = decimal.toNumber ? decimal.toNumber() : Number(decimal.toString())
      return Number.isFinite(asNumber) ? asNumber : value.toString()
    } catch {
      return value.toString()
    }
  }

  if (typeof value === "bigint") {
    return value.toString()
  }

  return value
}

function isPrismaDecimal(value: unknown): value is Prisma.Decimal {
  if (!value || typeof value !== "object") return false

  if (value instanceof Prisma.Decimal) return true

  const ctorName = value.constructor?.name
  return ctorName === "Decimal"
}

/**
 * Helper function to get client IP from request headers
 */
export function getClientIP(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP
  }
  
  return undefined
}

/**
 * Helper function to get user agent from request headers
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined
}

/**
 * Audit logging for account operations
 */
export async function logAccountAudit(
  action: AuditAction,
  accountId: string,
  userId: string,
  tenantId: string,
  request: Request,
  previousValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
): Promise<void> {
  const changedFields = previousValues && newValues 
    ? getChangedFields(previousValues, newValues)
    : undefined

  await logAudit({
    userId,
    tenantId,
    action,
    entityName: 'Account',
    entityId: accountId,
    changedFields,
    previousValues,
    newValues,
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request)
  })
}

/**
 * Audit logging for product operations
 */
export async function logProductAudit(
  action: AuditAction,
  productId: string,
  userId: string,
  tenantId: string,
  request: Request,
  previousValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
): Promise<void> {
  const changedFields = previousValues && newValues
    ? getChangedFields(previousValues, newValues)
    : undefined

  await logAudit({
    userId,
    tenantId,
    action,
    entityName: 'Product',
    entityId: productId,
    changedFields,
    previousValues,
    newValues,
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request)
  })
}

/**
 * Audit logging for contact operations
 */
export async function logContactAudit(
  action: AuditAction,
  contactId: string,
  userId: string,
  tenantId: string,
  request: Request,
  previousValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
): Promise<void> {
  const changedFields = previousValues && newValues 
    ? getChangedFields(previousValues, newValues)
    : undefined

  await logAudit({
    userId,
    tenantId,
    action,
    entityName: 'Contact',
    entityId: contactId,
    changedFields,
    previousValues,
    newValues,
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request)
  })
}

/**
 * Audit logging for activity operations
 */
export async function logActivityAudit(
  action: AuditAction,
  activityId: string,
  userId: string,
  tenantId: string,
  request?: Request,
  previousValues?: unknown,
  newValues?: unknown
): Promise<void> {
  const prev =
    previousValues && typeof previousValues === "object"
      ? (previousValues as Record<string, unknown>)
      : undefined
  const next =
    newValues && typeof newValues === "object"
      ? (newValues as Record<string, unknown>)
      : undefined

  const changedFields = prev && next
    ? getChangedFields(prev, next)
    : undefined

  await logAudit({
    userId,
    tenantId,
    action,
    entityName: 'Activity',
    entityId: activityId,
    changedFields,
    previousValues: prev,
    newValues: next,
    ipAddress: request ? getClientIP(request) : undefined,
    userAgent: request ? getUserAgent(request) : undefined
  })
}
/**
 * Audit logging for user operations
 */
export async function logUserAudit(
  action: AuditAction,
  targetUserId: string,
  userId: string,
  tenantId: string,
  request: Request,
  previousValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
): Promise<void> {
  const changedFields = previousValues && newValues
    ? getChangedFields(previousValues, newValues)
    : undefined

  await logAudit({
    userId,
    tenantId,
    action,
    entityName: 'User',
    entityId: targetUserId,
    changedFields,
    previousValues,
    newValues,
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request)
  })
}

/**
 * Audit logging for opportunity operations
 */
export async function logOpportunityAudit(
  action: AuditAction,
  opportunityId: string,
  userId: string,
  tenantId: string,
  request: Request,
  previousValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
): Promise<void> {
  const changedFields = previousValues && newValues
    ? getChangedFields(previousValues, newValues)
    : undefined

  await logAudit({
    userId,
    tenantId,
    action,
    entityName: 'Opportunity',
    entityId: opportunityId,
    changedFields,
    previousValues,
    newValues,
    ipAddress: getClientIP(request),
    userAgent: getUserAgent(request)
  })
}
