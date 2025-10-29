'use client'

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

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

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
  hasPermission: (permissionCode: string) => boolean
  hasAnyPermission: (permissionCodes: string[]) => boolean
  hasAllPermissions: (permissionCodes: string[]) => boolean
}

const DERIVED_PERMISSION_MAP: Record<string, string[]> = {
  "revenue-schedules.manage": [
    "accounts.manage",
    "opportunities.manage"
  ]
}

function buildPermissionSet(user: AuthUser | null): Set<string> {
  const codes = new Set<string>()
  if (user?.role?.permissions) {
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


const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Login failed')
    }

    setUser(data.user)
    router.push('/accounts')
    router.refresh()
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      router.push('/login')
    }
  }

  const refreshAuth = async () => {
    await checkAuth()
  }

  const permissionCodes = useMemo(() => buildPermissionSet(user), [user])

  const hasPermission = useCallback((permissionCode: string): boolean => {
    return permissionCodes.has(permissionCode)
  }, [permissionCodes])

  const hasAnyPermission = useCallback((permissionCodesToCheck: string[]): boolean => {
    return permissionCodesToCheck.some(code => hasPermission(code))
  }, [hasPermission])

  const hasAllPermissions = useCallback((permissionCodesToCheck: string[]): boolean => {
    return permissionCodesToCheck.every(code => hasPermission(code))
  }, [hasPermission])

  useEffect(() => {
    checkAuth()
  }, [])

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    logout,
    refreshAuth,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}