'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermissions?: string[]
  requireAll?: boolean // If true, user must have ALL permissions; if false, user needs ANY permission
  fallback?: React.ReactNode
}

export function ProtectedRoute({
  children,
  requiredPermissions,
  requireAll = false,
  fallback
}: ProtectedRouteProps) {
  const { user, isLoading, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // User not authenticated
  if (!user) {
    return null // Will redirect to login
  }

  // Check permissions if required
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasRequiredPermissions = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions)

    if (!hasRequiredPermissions) {
      if (fallback) {
        return <>{fallback}</>
      }

      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-4">
              You don&apos;t have permission to access this page.
            </p>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Go Back
            </button>
          </div>
        </div>
      )
    }
  }

  return <>{children}</>
}