'use client'

import { useAuth } from '@/lib/auth-context'

interface PermissionGateProps {
  children: React.ReactNode
  permissions: string[]
  requireAll?: boolean // If true, user must have ALL permissions; if false, user needs ANY permission
  fallback?: React.ReactNode
}

export function PermissionGate({
  children,
  permissions,
  requireAll = false,
  fallback = null
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth()

  if (!permissions || permissions.length === 0) {
    return <>{children}</>
  }

  const hasRequiredPermissions = requireAll
    ? hasAllPermissions(permissions)
    : hasAnyPermission(permissions)

  if (!hasRequiredPermissions) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface RoleGateProps {
  children: React.ReactNode
  roles: string[]
  fallback?: React.ReactNode
}

export function RoleGate({
  children,
  roles,
  fallback = null
}: RoleGateProps) {
  const { user } = useAuth()

  if (!roles || roles.length === 0) {
    return <>{children}</>
  }

  const hasRequiredRole = user?.role && roles.includes(user.role.code)

  if (!hasRequiredRole) {
    return <>{fallback}</>
  }

  return <>{children}</>
}