import { prisma } from './db'
import { AuditAction } from '@prisma/client'

export interface AuditLogParams {
  userId: string
  tenantId: string
  action: AuditAction
  entityName: string
  entityId: string
  requestId?: string
  changedFields?: Record<string, any>
  previousValues?: Record<string, any>
  newValues?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
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
export function getChangedFields(previous: Record<string, any>, current: Record<string, any>): Record<string, any> {
  const changed: Record<string, any> = {}
  
  // Check for changed values
  for (const key in current) {
    if (previous[key] !== current[key]) {
      changed[key] = {
        from: previous[key],
        to: current[key]
      }
    }
  }
  
  // Check for removed fields
  for (const key in previous) {
    if (!(key in current)) {
      changed[key] = {
        from: previous[key],
        to: null
      }
    }
  }
  
  return changed
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
  previousValues?: Record<string, any>,
  newValues?: Record<string, any>
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
 * Audit logging for contact operations
 */
export async function logContactAudit(
  action: AuditAction,
  contactId: string,
  userId: string,
  tenantId: string,
  request: Request,
  previousValues?: Record<string, any>,
  newValues?: Record<string, any>
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
 * Audit logging for user operations
 */
export async function logUserAudit(
  action: AuditAction,
  targetUserId: string,
  userId: string,
  tenantId: string,
  request: Request,
  previousValues?: Record<string, any>,
  newValues?: Record<string, any>
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
