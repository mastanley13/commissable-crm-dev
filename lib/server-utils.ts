import { prisma } from "./db"
import { getAuthenticatedUser } from "./auth"

/**
 * Resolve the tenant id to use for API operations. 
 * 
 * This function is now primarily used for development/fallback scenarios.
 * Production API routes should use withPermissions() to get tenantId from authenticated user context.
 * 
 * If an explicit id is provided it is returned, otherwise we fall back to:
 * 1. Authenticated user's tenantId (if available)
 * 2. Environment variable DEFAULT_TENANT_ID
 * 3. First tenant in the database (development fallback)
 */
export async function resolveTenantId(explicitTenantId?: string | null): Promise<string> {
  if (explicitTenantId && explicitTenantId.trim().length > 0) {
    return explicitTenantId
  }

  // Try to get tenantId from authenticated user first
  try {
    const user = await getAuthenticatedUser()
    if (user?.tenantId) {
      return user.tenantId
    }
  } catch (error) {
    // User not authenticated, continue with fallback methods
  }

  if (process.env.DEFAULT_TENANT_ID && process.env.DEFAULT_TENANT_ID.trim().length > 0) {
    return process.env.DEFAULT_TENANT_ID
  }

  const tenant = await prisma.tenant.findFirst({ select: { id: true } })
  if (!tenant) {
    throw new Error('No tenants available. Seed the database before using the API.')
  }

  return tenant.id
}

/**
 * Resolve a user id for the given tenant.
 * 
 * This function is now primarily used for development/fallback scenarios.
 * Production API routes should use withPermissions() to get userId from authenticated user context.
 * 
 * If an explicit id is provided it is returned, otherwise we fall back to:
 * 1. Authenticated user's id (if available and matches tenant)
 * 2. Environment variable DEFAULT_USER_ID
 * 3. First user in the tenant (development fallback)
 */
export async function resolveUserId(
  tenantId: string,
  explicitUserId?: string | null
): Promise<string> {
  if (explicitUserId && explicitUserId.trim().length > 0) {
    return explicitUserId
  }

  // Try to get userId from authenticated user first (if tenant matches)
  try {
    const user = await getAuthenticatedUser()
    if (user?.id && user?.tenantId === tenantId) {
      return user.id
    }
  } catch (error) {
    // User not authenticated, continue with fallback methods
  }

  if (process.env.DEFAULT_USER_ID && process.env.DEFAULT_USER_ID.trim().length > 0) {
    return process.env.DEFAULT_USER_ID
  }

  const user = await prisma.user.findFirst({
    where: { tenantId },
    select: { id: true },
    orderBy: { createdAt: 'asc' }
  })

  if (!user) {
    throw new Error('No users exist for the current tenant. Seed the database before using the API.')
  }

  return user.id
}
