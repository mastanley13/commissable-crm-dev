import { NextRequest } from 'next/server'
import { getAuthenticatedUser, hasPermission, hasAnyPermission, hasAllPermissions } from './auth'
import type { AuthUser } from './auth'

export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
}

export interface AuthenticatedRequest extends NextRequest {
  user: AuthUser
}

export async function getCurrentUser() {
  const user = await getAuthenticatedUser()
  if (!user) {
    throw new Error('Authentication required')
  }
  return { user, tenantId: user.tenantId }
}

export async function withAuth<T = any>(
  request: NextRequest,
  handler: (request: AuthenticatedRequest) => Promise<Response | ApiResponse<T>>
): Promise<Response> {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Add user to request object
    const authenticatedRequest = request as AuthenticatedRequest
    authenticatedRequest.user = user

    // Call the handler
    const result = await handler(authenticatedRequest)

    // If result is already a Response, return it
    if (result instanceof Response) {
      return result
    }

    // Otherwise, wrap in Response
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

export async function withPermissions<T = any>(
  request: NextRequest,
  permissions: string[],
  handler: (request: AuthenticatedRequest) => Promise<Response | ApiResponse<T>>,
  options: {
    requireAll?: boolean // If true, user must have ALL permissions; if false, user needs ANY permission
  } = {}
): Promise<Response> {
  const { requireAll = false } = options

  return withAuth(request, async (authenticatedRequest) => {
    const { user } = authenticatedRequest

    // Check permissions
    const hasRequiredPermissions = requireAll
      ? hasAllPermissions(user, permissions)
      : hasAnyPermission(user, permissions)

    if (!hasRequiredPermissions) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient permissions',
          required: permissions,
          requireAll
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return handler(authenticatedRequest)
  })
}

export async function withRole<T = any>(
  request: NextRequest,
  roles: string[],
  handler: (request: AuthenticatedRequest) => Promise<Response | ApiResponse<T>>
): Promise<Response> {
  return withAuth(request, async (authenticatedRequest) => {
    const { user } = authenticatedRequest

    // Check role
    if (!user.role || !roles.includes(user.role.code)) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient role access',
          required: roles,
          current: user.role?.code || null
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return handler(authenticatedRequest)
  })
}

export function createApiResponse<T>(
  data: T,
  status: number = 200,
  message?: string
): Response {
  const response: ApiResponse<T> = { data }
  if (message) response.message = message

  return new Response(
    JSON.stringify(response),
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

export function createErrorResponse(
  error: string,
  status: number = 400
): Response {
  return new Response(
    JSON.stringify({ error }),
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}